import { CredentialVault } from "../security/vault";
import { PRAutomatorError } from "../error";
import { TokenManager } from "./token-manager";

const GITHUB_DEVICE_ENDPOINTS = {
  DEVICE_CODE: "https://github.com/login/device/code",
  ACCESS_TOKEN: "https://github.com/login/oauth/access_token",
  VERIFY: "https://api.github.com/user"
} as const;

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  refresh_token?: string;
  expires_in?: number;
}

export interface DeviceFlowOptions {
  /**
   * GitHub OAuth client ID
   */
  clientId: string;

  /**
   * Required OAuth scopes
   * @default ["repo"]
   */
  scopes?: string[];

  /**
   * Maximum number of polling attempts
   * @default 12 (5 minutes with 25s interval)
   */
  maxAttempts?: number;

  /**
   * Custom polling interval in seconds
   * @default 25
   */
  pollInterval?: number;
}

/**
 * GitHub OAuth2 Device Flow Implementation
 */
export class GitHubDeviceFlow {
  private readonly clientId: string;
  private readonly scopes: string[];
  private readonly maxAttempts: number;
  private readonly pollInterval: number;
  private readonly tokenManager: TokenManager;
  private deviceCode?: string;
  private expiresAt?: Date;

  constructor(vault: CredentialVault, options: DeviceFlowOptions) {
    this.clientId = options.clientId;
    this.scopes = options.scopes || ["repo"];
    this.maxAttempts = options.maxAttempts || 12;
    this.pollInterval = (options.pollInterval || 25) * 1000; // Convert to ms
    this.tokenManager = new TokenManager(vault);
  }

  /**
   * Initialize the device flow
   * Returns the verification URI and user code for device activation
   */
  async initiate(): Promise<{ verification_uri: string; user_code: string }> {
    try {
      const response = await fetch(GITHUB_DEVICE_ENDPOINTS.DEVICE_CODE, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          client_id: this.clientId,
          scope: this.scopes.join(" ")
        })
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }

      const data = (await response.json()) as DeviceCodeResponse;
      
      // Store device code and expiry
      this.deviceCode = data.device_code;
      this.expiresAt = new Date(Date.now() + (data.expires_in * 1000));

      return {
        verification_uri: data.verification_uri,
        user_code: data.user_code
      };
    } catch (error) {
      throw new PRAutomatorError("Failed to initiate device flow", {
        cause: error,
        type: "AUTH_ERROR"
      });
    }
  }

  /**
   * Poll for the access token
   * Throws if max attempts reached or device code expired
   */
  async poll(): Promise<void> {
    if (!this.deviceCode || !this.expiresAt) {
      throw new PRAutomatorError(
        "Device flow not initiated. Call initiate() first.",
        { type: "AUTH_ERROR" }
      );
    }

    if (Date.now() > this.expiresAt.getTime()) {
      throw new PRAutomatorError("Device code expired", { type: "AUTH_ERROR" });
    }

    let attempts = 0;
    while (attempts < this.maxAttempts) {
      try {
        const response = await fetch(GITHUB_DEVICE_ENDPOINTS.ACCESS_TOKEN, {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            client_id: this.clientId,
            device_code: this.deviceCode,
            grant_type: "urn:ietf:params:oauth:grant-type:device_code"
          })
        });

        if (!response.ok) {
          throw new Error(`GitHub API error: ${response.statusText}`);
        }

        const data = (await response.json()) as TokenResponse;

        // Verify token before storing
        await this.verifyToken(data.access_token);

        // Store token with refresh info
        await this.tokenManager.storeToken(
          data.access_token,
          data.expires_in,
          data.refresh_token
        );
        return;
      } catch (error) {
        if (error instanceof PRAutomatorError) throw error;
        
        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, this.pollInterval));
        attempts++;
      }
    }

    throw new PRAutomatorError(
      "Authentication timeout. Please try again.",
      { type: "AUTH_ERROR" }
    );
  }

  /**
   * Get the stored access token
   */
  async getToken(): Promise<string> {
    return this.tokenManager.getToken();
  }

  /**
   * Execute an authenticated request with automatic token refresh and rate limiting
   */
  async executeRequest<T>(
    request: (token: string) => Promise<T>
  ): Promise<T> {
    return this.tokenManager.executeRequest(request);
  }

  /**
   * Verify if a token is valid
   */
  private async verifyToken(token: string): Promise<void> {
    try {
      const response = await fetch(GITHUB_DEVICE_ENDPOINTS.VERIFY, {
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Token verification failed: ${response.statusText}`);
      }
    } catch (error) {
      throw new PRAutomatorError("Invalid access token", {
        cause: error,
        type: "AUTH_ERROR"
      });
    }
  }

  /**
   * Revoke the stored access token
   */
  async revoke(): Promise<void> {
    await this.tokenManager.executeRequest(async (token) => {
      const response = await fetch(
        "https://api.github.com/applications/${this.clientId}/token",
        {
          method: "DELETE",
          headers: {
            "Accept": "application/json",
            "Authorization": `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Token revocation failed: ${response.statusText}`);
      }
    });
  }
} 