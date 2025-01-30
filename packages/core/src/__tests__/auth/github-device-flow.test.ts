import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { GitHubDeviceFlow } from "../../auth/github-device-flow";
import { CredentialVault } from "../../security/vault";

describe("GitHubDeviceFlow", () => {
  const mockClientId = "test-client-id";
  const mockScopes = ["repo", "user"];
  
  let deviceFlow: GitHubDeviceFlow;
  let mockVault: CredentialVault;
  
  // Mock fetch globally
  const mockFetch = vi.fn();
  global.fetch = mockFetch;

  beforeEach(() => {
    // Reset mocks
    mockFetch.mockReset();
    
    // Create mock vault
    mockVault = {
      setSecret: vi.fn(),
      getSecret: vi.fn(),
      deleteSecret: vi.fn(),
      hasSecret: vi.fn(),
      clear: vi.fn()
    } as any;

    // Create device flow instance
    deviceFlow = new GitHubDeviceFlow(mockClientId, mockScopes, mockVault);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("initiate", () => {
    it("initiates device flow successfully", async () => {
      const mockResponse = {
        device_code: "device-123",
        user_code: "USER-123",
        verification_uri: "https://github.com/login/device",
        expires_in: 900,
        interval: 5
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await deviceFlow.initiate();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://github.com/login/device/code",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            client_id: mockClientId,
            scope: mockScopes.join(" ")
          })
        })
      );

      expect(result).toEqual({
        verification_uri: mockResponse.verification_uri,
        user_code: mockResponse.user_code
      });
    });

    it("handles initiation errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: "Bad Request"
      });

      await expect(deviceFlow.initiate()).rejects.toThrow(
        "Failed to initiate GitHub device flow"
      );
    });
  });

  describe("poll", () => {
    const mockDeviceCode = "device-123";
    const mockAccessToken = "gho_mock123";

    beforeEach(async () => {
      // Setup successful initiation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          device_code: mockDeviceCode,
          user_code: "USER-123",
          verification_uri: "https://github.com/login/device",
          expires_in: 900,
          interval: 5
        })
      });
      await deviceFlow.initiate();
      mockFetch.mockReset();
    });

    it("polls until access token is received", async () => {
      // First poll: pending
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({
          error: "authorization_pending"
        })
      });

      // Second poll: success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: mockAccessToken,
          token_type: "bearer",
          scope: mockScopes.join(" ")
        })
      });

      const result = await deviceFlow.poll();

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockVault.setSecret).toHaveBeenCalledWith(
        "github_token",
        mockAccessToken
      );
      expect(result).toEqual({ access_token: mockAccessToken });
    });

    it("handles polling timeout", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({
          error: "authorization_pending"
        })
      });

      await expect(deviceFlow.poll()).rejects.toThrow(
        "Max polling attempts reached"
      );
    });

    it("handles expired device code", async () => {
      // Force expiration
      vi.advanceTimersByTime(1000000);

      await expect(deviceFlow.poll()).rejects.toThrow(
        "Device code has expired"
      );
    });
  });

  describe("revoke", () => {
    const mockToken = "gho_mock123";

    beforeEach(() => {
      mockVault.getSecret.mockResolvedValue(mockToken);
    });

    it("revokes token successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true
      });

      await deviceFlow.revoke();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/applications/"),
        expect.objectContaining({
          method: "DELETE",
          headers: expect.objectContaining({
            Authorization: expect.stringContaining("Basic")
          })
        })
      );

      expect(mockVault.deleteSecret).toHaveBeenCalledWith("github_token");
    });

    it("handles missing token gracefully", async () => {
      mockVault.getSecret.mockResolvedValue(null);

      await deviceFlow.revoke();

      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockVault.deleteSecret).not.toHaveBeenCalled();
    });

    it("handles revocation errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: "Unauthorized"
      });

      await expect(deviceFlow.revoke()).rejects.toThrow(
        "Failed to revoke GitHub token"
      );
    });
  });

  describe("token validation", () => {
    const mockToken = "gho_mock123";

    beforeEach(() => {
      mockVault.getSecret.mockResolvedValue(mockToken);
    });

    it("validates existing token successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true
      });

      const isValid = await deviceFlow.hasValidToken();
      expect(isValid).toBe(true);
    });

    it("handles invalid token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false
      });

      const isValid = await deviceFlow.hasValidToken();
      expect(isValid).toBe(false);
    });

    it("handles missing token", async () => {
      mockVault.getSecret.mockResolvedValue(null);

      const isValid = await deviceFlow.hasValidToken();
      expect(isValid).toBe(false);
    });
  });
}); 