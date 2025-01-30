import { describe, it, expect, vi, beforeEach } from "vitest";
import { Command } from "commander";
import { GitHubDeviceFlow } from "@automate-pr/core/auth";
import { CredentialVault } from "@automate-pr/core/security";
import { PRAutomatorError } from "@automate-pr/core/error";
import { authCommand } from "../../commands/auth";
import ora from "ora";

// Mock dependencies
vi.mock("ora", () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    info: vi.fn().mockReturnThis(),
    text: ""
  }))
}));

vi.mock("@automate-pr/core/auth", () => ({
  GitHubDeviceFlow: vi.fn()
}));

vi.mock("@automate-pr/core/security", () => ({
  CredentialVault: vi.fn()
}));

vi.mock("../../config", () => ({
  loadConfig: vi.fn().mockResolvedValue({
    github: { clientId: "test-client-id" }
  })
}));

// Mock console methods
const originalConsole = { ...console };
beforeEach(() => {
  console.log = vi.fn();
  console.error = vi.fn();
  global.fetch = vi.fn();
});

afterEach(() => {
  console.log = originalConsole.log;
  console.error = originalConsole.error;
});

describe("Auth Commands", () => {
  describe("login", () => {
    it("should successfully complete the login flow", async () => {
      const mockDeviceFlow = {
        initiate: vi.fn().mockResolvedValue({
          verification_uri: "https://github.com/login/device",
          user_code: "ABCD-1234"
        }),
        poll: vi.fn().mockResolvedValue(undefined),
        executeRequest: vi.fn().mockResolvedValue("testuser"),
        getToken: vi.fn().mockResolvedValue("test-token")
      };

      vi.mocked(GitHubDeviceFlow).mockImplementation(() => mockDeviceFlow as any);

      await authCommand.parseAsync(["login"], { from: "user" });

      expect(mockDeviceFlow.initiate).toHaveBeenCalled();
      expect(mockDeviceFlow.poll).toHaveBeenCalled();
      expect(mockDeviceFlow.executeRequest).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Complete authentication")
      );
    });

    it("should handle missing client ID", async () => {
      vi.mocked(loadConfig).mockResolvedValueOnce({ github: {} });

      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

      await authCommand.parseAsync(["login"], { from: "user" });

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Details"),
        expect.any(String)
      );
    });

    it("should support custom scopes", async () => {
      const mockDeviceFlow = {
        initiate: vi.fn().mockResolvedValue({
          verification_uri: "https://github.com/login/device",
          user_code: "ABCD-1234"
        }),
        poll: vi.fn().mockResolvedValue(undefined),
        executeRequest: vi.fn().mockResolvedValue("testuser"),
        getToken: vi.fn().mockResolvedValue("test-token")
      };

      vi.mocked(GitHubDeviceFlow).mockImplementation(() => mockDeviceFlow as any);

      await authCommand.parseAsync(
        ["login", "--scopes", "repo,read:org"],
        { from: "user" }
      );

      expect(GitHubDeviceFlow).toHaveBeenCalledWith(
        expect.any(CredentialVault),
        expect.objectContaining({
          scopes: ["repo", "read:org"]
        })
      );
    });
  });

  describe("logout", () => {
    it("should successfully logout", async () => {
      const mockDeviceFlow = {
        revoke: vi.fn().mockResolvedValue(undefined)
      };

      vi.mocked(GitHubDeviceFlow).mockImplementation(() => mockDeviceFlow as any);

      await authCommand.parseAsync(["logout"], { from: "user" });

      expect(mockDeviceFlow.revoke).toHaveBeenCalled();
    });
  });

  describe("status", () => {
    it("should show authenticated status", async () => {
      const mockDeviceFlow = {
        executeRequest: vi.fn().mockResolvedValue("testuser")
      };

      vi.mocked(GitHubDeviceFlow).mockImplementation(() => mockDeviceFlow as any);

      await authCommand.parseAsync(["status"], { from: "user" });

      expect(mockDeviceFlow.executeRequest).toHaveBeenCalled();
    });

    it("should show unauthenticated status", async () => {
      const mockDeviceFlow = {
        executeRequest: vi.fn().mockRejectedValue(new Error("Not authenticated"))
      };

      vi.mocked(GitHubDeviceFlow).mockImplementation(() => mockDeviceFlow as any);

      await authCommand.parseAsync(["status"], { from: "user" });

      expect(mockDeviceFlow.executeRequest).toHaveBeenCalled();
    });
  });

  describe("token", () => {
    it("should display current token", async () => {
      const mockDeviceFlow = {
        getToken: vi.fn().mockResolvedValue("test-token")
      };

      vi.mocked(GitHubDeviceFlow).mockImplementation(() => mockDeviceFlow as any);

      await authCommand.parseAsync(["token"], { from: "user" });

      expect(mockDeviceFlow.getToken).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith("test-token");
    });

    it("should handle missing token", async () => {
      const mockDeviceFlow = {
        getToken: vi.fn().mockRejectedValue(new Error("No token found"))
      };

      vi.mocked(GitHubDeviceFlow).mockImplementation(() => mockDeviceFlow as any);

      await authCommand.parseAsync(["token"], { from: "user" });

      expect(mockDeviceFlow.getToken).toHaveBeenCalled();
    });
  });
}); 