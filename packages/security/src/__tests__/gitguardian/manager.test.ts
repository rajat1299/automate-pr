import { describe, it, expect, vi, beforeEach } from "vitest";
import { CredentialVault, PRAutomatorError } from "@automate-pr/core";
import { GitGuardianManager } from "../../gitguardian/manager";

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

// Mock child_process.execFile
vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

describe("GitGuardianManager", () => {
  let vault: CredentialVault;
  let manager: GitGuardianManager;

  beforeEach(() => {
    vault = new CredentialVault({ appName: "test" });
    vi.mocked(vault.get).mockReturnValue(undefined);
    vi.mocked(vault.set).mockResolvedValue();

    manager = new GitGuardianManager(vault, {
      severity_level: "high",
      allowed_patterns: [],
      auto_quarantine: true,
      scan_mode: "diff-only",
      exclusion_paths: [],
      timeout: 60,
      max_retries: 3,
    });
  });

  describe("initialize", () => {
    it("should throw error when API key is not found", async () => {
      await expect(manager.initialize()).rejects.toThrow(PRAutomatorError);
    });

    it("should not throw when API key is available", async () => {
      vi.mocked(vault.get).mockReturnValue("test-key");
      await expect(manager.initialize()).resolves.not.toThrow();
    });
  });

  describe("verifyApiKey", () => {
    it("should return false when API key is not found", async () => {
      expect(await manager.verifyApiKey()).toBe(false);
    });

    it("should return true when API key is valid", async () => {
      vi.mocked(vault.get).mockReturnValue("valid-key");
      vi.mocked(require("node:child_process").execFile).mockImplementation(
        (cmd: string, args: string[], opts: any, callback: Function) => {
          callback(null, { stdout: "" });
        }
      );

      expect(await manager.verifyApiKey()).toBe(true);
    });

    it("should return false when API key is invalid", async () => {
      vi.mocked(vault.get).mockReturnValue("invalid-key");
      vi.mocked(require("node:child_process").execFile).mockImplementation(
        (cmd: string, args: string[], opts: any, callback: Function) => {
          callback(new Error("Invalid key"));
        }
      );

      expect(await manager.verifyApiKey()).toBe(false);
    });
  });

  describe("scan", () => {
    const mockScanResult = {
      policies_breaks: [
        {
          break_type: "high",
          file_path: "test.js",
          line_number: 1,
          policy: "API key found",
        },
      ],
      total_scanned: 10,
      total_policies_breaks: 1,
    };

    beforeEach(() => {
      vi.mocked(vault.get).mockReturnValue("test-key");
    });

    it("should scan staged files", async () => {
      vi.mocked(require("node:child_process").execFile).mockImplementation(
        (cmd: string, args: string[], opts: any, callback: Function) => {
          expect(args).toContain("--staged");
          callback(null, { stdout: JSON.stringify(mockScanResult) });
        }
      );

      const result = await manager.scan({ staged: true });
      expect(result.violations).toHaveLength(1);
      expect(result.scannedFiles).toBe(10);
    });

    it("should scan diff against branch", async () => {
      vi.mocked(require("node:child_process").execFile).mockImplementation(
        (cmd: string, args: string[], opts: any, callback: Function) => {
          expect(args).toContain("--diff");
          expect(args).toContain("main");
          callback(null, { stdout: JSON.stringify(mockScanResult) });
        }
      );

      const result = await manager.scan({ diffBranch: "main" });
      expect(result.violations).toHaveLength(1);
    });

    it("should handle scan errors", async () => {
      vi.mocked(require("node:child_process").execFile).mockImplementation(
        (cmd: string, args: string[], opts: any, callback: Function) => {
          callback(new Error("Scan failed"));
        }
      );

      await expect(manager.scan()).rejects.toThrow(PRAutomatorError);
    });
  });

  describe("hasBlockingViolations", () => {
    it("should return true for violations above threshold", () => {
      const result = {
        violations: [
          { severity: "critical", file: "test.js", line: 1, message: "test" },
        ],
        scannedFiles: 1,
        totalViolations: 1,
      };

      expect(manager.hasBlockingViolations(result)).toBe(true);
    });

    it("should return false for violations below threshold", () => {
      const result = {
        violations: [
          { severity: "low", file: "test.js", line: 1, message: "test" },
        ],
        scannedFiles: 1,
        totalViolations: 1,
      };

      expect(manager.hasBlockingViolations(result)).toBe(false);
    });
  });
}); 