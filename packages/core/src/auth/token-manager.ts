import { CredentialVault, PRAutomatorError } from "@automate-pr/core";

interface TokenInfo {
  access_token: string;
  expires_at?: number; // Unix timestamp in milliseconds
  refresh_token?: string;
}

interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp in seconds
}

/**
 * Manages GitHub access tokens with refresh and rate limiting
 */
export class TokenManager {
  private static readonly TOKEN_INFO_KEY = "github.token_info";
  private static readonly RATE_LIMIT_KEY = "github.rate_limit";
  private static readonly MIN_TOKEN_LIFETIME = 5 * 60 * 1000; // 5 minutes in ms
  private static readonly DEFAULT_BACKOFF = 1000; // 1 second

  private readonly vault: CredentialVault;
  private rateLimitInfo?: RateLimitInfo;
  private lastRequest: number = 0;
  private backoffDelay: number = TokenManager.DEFAULT_BACKOFF;

  constructor(vault: CredentialVault) {
    this.vault = vault;
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  async getToken(): Promise<string> {
    const tokenInfo = await this.getStoredTokenInfo();
    if (!tokenInfo) {
      throw new PRAutomatorError("No token available", { type: "AUTH_ERROR" });
    }

    // Check if token needs refresh
    if (await this.shouldRefreshToken(tokenInfo)) {
      return this.refreshToken(tokenInfo);
    }

    return tokenInfo.access_token;
  }

  /**
   * Store token information
   */
  async storeToken(
    accessToken: string,
    expiresIn?: number,
    refreshToken?: string
  ): Promise<void> {
    const tokenInfo: TokenInfo = {
      access_token: accessToken,
      ...(expiresIn && {
        expires_at: Date.now() + expiresIn * 1000
      }),
      ...(refreshToken && { refresh_token: refreshToken })
    };

    await this.vault.set(
      TokenManager.TOKEN_INFO_KEY,
      JSON.stringify(tokenInfo)
    );
  }

  /**
   * Execute an API request with rate limiting and token refresh
   */
  async executeRequest<T>(
    request: (token: string) => Promise<T>
  ): Promise<T> {
    // Check and wait for rate limit
    await this.waitForRateLimit();

    try {
      const token = await this.getToken();
      const result = await request(token);

      // Reset backoff on success
      this.backoffDelay = TokenManager.DEFAULT_BACKOFF;
      
      // Update rate limit info from response headers
      await this.updateRateLimitInfo();

      return result;
    } catch (error) {
      if (this.isRateLimitError(error)) {
        // Increase backoff exponentially
        this.backoffDelay *= 2;
        throw new PRAutomatorError("Rate limit exceeded", {
          cause: error,
          type: "RATE_LIMIT"
        });
      }

      if (this.isAuthError(error)) {
        // Token might be invalid, try refreshing
        const token = await this.refreshToken();
        return request(token);
      }

      throw error;
    }
  }

  /**
   * Get stored token information
   */
  private async getStoredTokenInfo(): Promise<TokenInfo | undefined> {
    const data = this.vault.get(TokenManager.TOKEN_INFO_KEY);
    if (!data) return undefined;

    try {
      return JSON.parse(data) as TokenInfo;
    } catch {
      return undefined;
    }
  }

  /**
   * Check if token should be refreshed
   */
  private async shouldRefreshToken(tokenInfo: TokenInfo): Promise<boolean> {
    if (!tokenInfo.expires_at) return false;

    // Refresh if token expires in less than 5 minutes
    return Date.now() + TokenManager.MIN_TOKEN_LIFETIME > tokenInfo.expires_at;
  }

  /**
   * Refresh the access token
   */
  private async refreshToken(tokenInfo?: TokenInfo): Promise<string> {
    if (!tokenInfo) {
      tokenInfo = await this.getStoredTokenInfo();
    }

    if (!tokenInfo?.refresh_token) {
      throw new PRAutomatorError(
        "No refresh token available",
        { type: "AUTH_ERROR" }
      );
    }

    try {
      const response = await fetch(
        "https://github.com/login/oauth/access_token",
        {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            grant_type: "refresh_token",
            refresh_token: tokenInfo.refresh_token
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }

      const data = await response.json();
      await this.storeToken(
        data.access_token,
        data.expires_in,
        data.refresh_token
      );

      return data.access_token;
    } catch (error) {
      throw new PRAutomatorError("Failed to refresh token", {
        cause: error,
        type: "AUTH_ERROR"
      });
    }
  }

  /**
   * Update rate limit information from response headers
   */
  private async updateRateLimitInfo(): Promise<void> {
    try {
      const response = await fetch("https://api.github.com/rate_limit", {
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${await this.getToken()}`
        }
      });

      if (!response.ok) return;

      const data = await response.json();
      this.rateLimitInfo = {
        limit: parseInt(data.resources.core.limit),
        remaining: parseInt(data.resources.core.remaining),
        reset: parseInt(data.resources.core.reset)
      };

      await this.vault.set(
        TokenManager.RATE_LIMIT_KEY,
        JSON.stringify(this.rateLimitInfo)
      );
    } catch {
      // Ignore rate limit check errors
    }
  }

  /**
   * Wait if rate limited
   */
  private async waitForRateLimit(): Promise<void> {
    // Ensure minimum delay between requests
    const timeSinceLastRequest = Date.now() - this.lastRequest;
    if (timeSinceLastRequest < this.backoffDelay) {
      await new Promise(resolve => 
        setTimeout(resolve, this.backoffDelay - timeSinceLastRequest)
      );
    }

    // Check rate limit info
    if (this.rateLimitInfo) {
      if (this.rateLimitInfo.remaining === 0) {
        const waitTime = (this.rateLimitInfo.reset * 1000) - Date.now();
        if (waitTime > 0) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    this.lastRequest = Date.now();
  }

  /**
   * Check if error is due to rate limiting
   */
  private isRateLimitError(error: any): boolean {
    return error?.response?.status === 429 ||
           error?.message?.includes("rate limit");
  }

  /**
   * Check if error is due to authentication
   */
  private isAuthError(error: any): boolean {
    return error?.response?.status === 401 ||
           error?.message?.includes("Unauthorized");
  }
} 