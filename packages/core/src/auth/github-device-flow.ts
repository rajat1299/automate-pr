import { CredentialVault } from "../security/vault";
import { PRAutomatorError } from "../error";

const GITHUB_DEVICE_ENDPOINTS = {
  DEVICE_CODE: "https://github.com/login/device/code",
  ACCESS_TOKEN: "https://github.com/login/oauth/access-token",
  REVOKE: "https://api.github.com/applications"
} as const;

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface AccessTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

export interface OAuth2DeviceFlow {
  initiate(): Promise<{ verification_uri: string; user_code: string }>;
  poll(): Promise<{ access_token: string }>;
  revoke(): Promise<void>;
}

export class GitHubDeviceFlow implements OAuth2DeviceFlow {
  private readonly clientId: string;
  private readonly scopes: string[];
  private readonly vault: CredentialVault;
  
  private deviceCode?: string;
  private pollInterval: number = 5000;
  private maxAttempts: number = 12;
  private expiresAt?: Date;

  constructor(
    clientId: string,
    scopes: string[] = ["repo"],
    vault = CredentialVault.getInstance()
  ) {
    this.clientId = clientId;
    this.scopes = scopes;
    this.vault = vault;
  }

  /**
   * Initiate the device flow by requesting a device code
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
        throw new Error(`Failed to initiate device flow: ${response.statusText}`);
      }

      const data = (await response.json()) as DeviceCodeResponse;
      
      // Store device code and update polling parameters
      this.deviceCode = data.device_code;
      this.pollInterval = data.interval * 1000; // Convert to ms
      this.expiresAt = new Date(Date.now() + data.expires_in * 1000);

      return {
        verification_uri: data.verification_uri,
        user_code: data.user_code
      };
    } catch (error) {
      throw new PRAutomatorError(
        "auth",
        `Failed to initiate GitHub device flow: ${error.message}`,
        { error }
      );
    }
  }

  /**
   * Poll for the access token after user authorization
   */
  async poll(): Promise<{ access_token: string }> {
    if (!this.deviceCode) {
      throw new PRAutomatorError(
        "auth",
        "Device flow not initiated. Call initiate() first."
      );
    }

    if (this.expiresAt && Date.now() > this.expiresAt.getTime()) {
      throw new PRAutomatorError(
        "auth",
        "Device code has expired. Please initiate a new flow."
      );
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
          const error = await response.json();
          if (error.error === "authorization_pending") {
            // User hasn't authorized yet, continue polling
            await new Promise(resolve => setTimeout(resolve, this.pollInterval));
            attempts++;
            continue;
          }
          throw new Error(error.error_description || response.statusText);
        }

        const data = (await response.json()) as AccessTokenResponse;
        
        // Store the token securely
        await this.vault.setSecret("github_token", data.access_token);
        
        return { access_token: data.access_token };
      } catch (error) {
        if (attempts === this.maxAttempts - 1) {
          throw new PRAutomatorError(
            "auth",
            `Failed to obtain access token: ${error.message}`,
            { error }
          );
        }
      }
    }

    throw new PRAutomatorError(
      "auth",
      "Max polling attempts reached. Please try again."
    );
  }

  /**
   * Revoke the current access token
   */
  async revoke(): Promise<void> {
    try {
      const token = await this.vault.getSecret("github_token");
      if (!token) {
        return; // No token to revoke
      }

      const response = await fetch(
        `${GITHUB_DEVICE_ENDPOINTS.REVOKE}/${this.clientId}/token`,
        {
          method: "DELETE",
          headers: {
            "Accept": "application/json",
            "Authorization": `Basic ${Buffer.from(
              `${this.clientId}:${token}`
            ).toString("base64")}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to revoke token: ${response.statusText}`);
      }

      // Remove the token from secure storage
      await this.vault.deleteSecret("github_token");
    } catch (error) {
      throw new PRAutomatorError(
        "auth",
        `Failed to revoke GitHub token: ${error.message}`,
        { error }
      );
    }
  }

  /**
   * Get the stored access token if available
   */
  async getStoredToken(): Promise<string | null> {
    return this.vault.getSecret("github_token");
  }

  /**
   * Check if we have a valid stored token
   */
  async hasValidToken(): Promise<boolean> {
    const token = await this.getStoredToken();
    if (!token) return false;

    try {
      // Verify token with GitHub API
      const response = await fetch("https://api.github.com/user", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/json"
        }
      });

      return response.ok;
    } catch {
      return false;
    }
  }
} 