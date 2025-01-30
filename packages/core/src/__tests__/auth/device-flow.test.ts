import { describe, it, expect, vi, beforeEach } from "vitest";
import { CredentialVault, PRAutomatorError } from "@automate-pr/core";
import { GitHubDeviceFlow } from "../../auth/device-flow";

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

describe("GitHubDeviceFlow", () => {
  let vault: CredentialVault;
  let flow: GitHubDeviceFlow;

  beforeEach(() => {
    vault = new CredentialVault({ appName: "test" });
    vi.mocked(vault.get).mockReturnValue(undefined);
    vi.mocked(vault.set).mockResolvedValue();
    vi.mocked(vault.remove).mockResolvedValue();

    flow = new GitHubDeviceFlow(vault, {
      clientId: "test-client-id",
      scopes: ["repo", "user"],
    });

    vi.mocked(fetch).mockReset();
  });

  describe("initiate", () => {
    it("should initiate device flow successfully", async () => {
      const mockResponse = {
        device_code: "test-device-code",
        user_code: "TEST-CODE",
        verification_uri: "https://github.com/login/device",
        expires_in: 900,
        interval: 5,
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await flow.initiate();

      expect(fetch).toHaveBeenCalledWith(
        "https://github.com/login/device/code",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            client_id: "test-client-id",
            scope: "repo user",
          }),
        })
      );

      expect(result).toEqual({
        verification_uri: mockResponse.verification_uri,
        user_code: mockResponse.user_code,
      });
    });

    it("should handle API errors", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        statusText: "Bad Request",
      } as Response);

      await expect(flow.initiate()).rejects.toThrow(PRAutomatorError);
    });
  });

  describe("poll", () => {
    it("should poll and store token successfully", async () => {
      // Mock successful device flow initiation
      const mockDeviceResponse = {
        device_code: "test-device-code",
        user_code: "TEST-CODE",
        verification_uri: "https://github.com/login/device",
        expires_in: 900,
        interval: 5,
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDeviceResponse),
      } as Response);

      await flow.initiate();

      // Mock successful token response
      const mockTokenResponse = {
        access_token: "test-token",
        token_type: "bearer",
        scope: "repo user",
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse),
        } as Response)
        .mockResolvedValueOnce({
          ok: true, // Token verification
        } as Response);

      await flow.poll();

      expect(vault.set).toHaveBeenCalledWith(
        "github.oauth_token",
        mockTokenResponse.access_token
      );
    });

    it("should handle polling timeout", async () => {
      // Mock successful device flow initiation
      const mockDeviceResponse = {
        device_code: "test-device-code",
        user_code: "TEST-CODE",
        verification_uri: "https://github.com/login/device",
        expires_in: 900,
        interval: 1, // Short interval for testing
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDeviceResponse),
      } as Response);

      await flow.initiate();

      // Mock failed token responses
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        statusText: "Authorization pending",
      } as Response);

      await expect(
        flow.poll()
      ).rejects.toThrow("Authentication timeout");
    });

    it("should handle invalid tokens", async () => {
      // Mock successful device flow initiation
      const mockDeviceResponse = {
        device_code: "test-device-code",
        user_code: "TEST-CODE",
        verification_uri: "https://github.com/login/device",
        expires_in: 900,
        interval: 5,
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDeviceResponse),
      } as Response);

      await flow.initiate();

      // Mock token response with invalid token
      const mockTokenResponse = {
        access_token: "invalid-token",
        token_type: "bearer",
        scope: "repo user",
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          statusText: "Unauthorized",
        } as Response);

      await expect(flow.poll()).rejects.toThrow("Invalid access token");
    });
  });

  describe("getToken", () => {
    it("should return stored token", async () => {
      const mockToken = "test-token";
      vi.mocked(vault.get).mockReturnValue(mockToken);

      const token = await flow.getToken();
      expect(token).toBe(mockToken);
    });

    it("should return undefined when no token stored", async () => {
      const token = await flow.getToken();
      expect(token).toBeUndefined();
    });
  });

  describe("revoke", () => {
    it("should remove stored token", async () => {
      await flow.revoke();
      expect(vault.remove).toHaveBeenCalledWith("github.oauth_token");
    });
  });
}); 