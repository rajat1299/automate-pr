import { describe, it, expect, vi, beforeEach } from "vitest";
import { CredentialVault, PRAutomatorError } from "@automate-pr/core";
import { TokenManager } from "../../auth/token-manager";

// Mock fetch
global.fetch = vi.fn();

// Mock CredentialVault
vi.mock("@automate-pr/core", () => ({
  CredentialVault: vi.fn(),
  PRAutomatorError: class extends Error {
    constructor(message: string, options?: { cause?: Error; type?: string }) {
      super(message);
      this.name = "PRAutomatorError";
      if (options?.cause) this.cause = options.cause;
    }
  },
}));

describe("TokenManager", () => {
  let vault: CredentialVault;
  let manager: TokenManager;

  beforeEach(() => {
    vault = new CredentialVault({ appName: "test" });
    vi.mocked(vault.get).mockReturnValue(undefined);
    vi.mocked(vault.set).mockResolvedValue();

    manager = new TokenManager(vault);

    vi.mocked(fetch).mockReset();
    vi.useFakeTimers();
  });

  describe("getToken", () => {
    it("should return valid token", async () => {
      const tokenInfo = {
        access_token: "test-token",
        expires_at: Date.now() + 3600000 // 1 hour from now
      };

      vi.mocked(vault.get).mockReturnValue(JSON.stringify(tokenInfo));

      const token = await manager.getToken();
      expect(token).toBe(tokenInfo.access_token);
    });

    it("should throw when no token available", async () => {
      await expect(manager.getToken()).rejects.toThrow(PRAutomatorError);
    });

    it("should refresh token near expiry", async () => {
      const tokenInfo = {
        access_token: "old-token",
        refresh_token: "refresh-token",
        expires_at: Date.now() + 60000 // 1 minute from now
      };

      vi.mocked(vault.get).mockReturnValue(JSON.stringify(tokenInfo));

      const mockRefreshResponse = {
        access_token: "new-token",
        refresh_token: "new-refresh-token",
        expires_in: 3600
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRefreshResponse)
      } as Response);

      const token = await manager.getToken();
      expect(token).toBe(mockRefreshResponse.access_token);
    });
  });

  describe("executeRequest", () => {
    const mockRequest = vi.fn();

    beforeEach(() => {
      mockRequest.mockReset();
    });

    it("should execute request with valid token", async () => {
      const tokenInfo = {
        access_token: "test-token",
        expires_at: Date.now() + 3600000
      };

      vi.mocked(vault.get).mockReturnValue(JSON.stringify(tokenInfo));
      mockRequest.mockResolvedValueOnce("success");

      const result = await manager.executeRequest(mockRequest);
      expect(result).toBe("success");
      expect(mockRequest).toHaveBeenCalledWith(tokenInfo.access_token);
    });

    it("should handle rate limiting", async () => {
      const tokenInfo = {
        access_token: "test-token",
        expires_at: Date.now() + 3600000
      };

      vi.mocked(vault.get).mockReturnValue(JSON.stringify(tokenInfo));

      // Mock rate limit response
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          resources: {
            core: {
              limit: 5000,
              remaining: 0,
              reset: Math.floor(Date.now() / 1000) + 3600
            }
          }
        })
      } as Response);

      // Mock request that triggers rate limit
      mockRequest.mockRejectedValueOnce(new Error("rate limit exceeded"));

      await expect(
        manager.executeRequest(mockRequest)
      ).rejects.toThrow("Rate limit exceeded");

      // Verify backoff delay increased
      mockRequest.mockResolvedValueOnce("success");
      await manager.executeRequest(mockRequest);
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), expect.any(Number));
    });

    it("should retry with refreshed token on auth error", async () => {
      const tokenInfo = {
        access_token: "old-token",
        refresh_token: "refresh-token",
        expires_at: Date.now() + 3600000
      };

      vi.mocked(vault.get).mockReturnValue(JSON.stringify(tokenInfo));

      // Mock auth error and token refresh
      mockRequest
        .mockRejectedValueOnce({ response: { status: 401 } })
        .mockResolvedValueOnce("success");

      const mockRefreshResponse = {
        access_token: "new-token",
        refresh_token: "new-refresh-token",
        expires_in: 3600
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRefreshResponse)
      } as Response);

      const result = await manager.executeRequest(mockRequest);
      expect(result).toBe("success");
      expect(mockRequest).toHaveBeenCalledWith(mockRefreshResponse.access_token);
    });
  });

  describe("storeToken", () => {
    it("should store token info in vault", async () => {
      await manager.storeToken("test-token", 3600, "refresh-token");

      expect(vault.set).toHaveBeenCalledWith(
        "github.token_info",
        expect.stringContaining("test-token")
      );

      const storedData = JSON.parse(vi.mocked(vault.set).mock.calls[0][1]);
      expect(storedData).toEqual({
        access_token: "test-token",
        expires_at: expect.any(Number),
        refresh_token: "refresh-token"
      });
    });

    it("should handle missing optional fields", async () => {
      await manager.storeToken("test-token");

      const storedData = JSON.parse(vi.mocked(vault.set).mock.calls[0][1]);
      expect(storedData).toEqual({
        access_token: "test-token"
      });
    });
  });
}); 