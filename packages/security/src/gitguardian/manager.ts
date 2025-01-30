import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { CredentialVault, PRAutomatorError } from "@automate-pr/core";
import type { GitGuardianConfig } from "../schema/config";

const execFileAsync = promisify(execFile);

export interface ScanResult {
  violations: Array<{
    severity: string;
    file: string;
    line: number;
    message: string;
  }>;
  scannedFiles: number;
  totalViolations: number;
}

export interface ScanOptions {
  /**
   * Only scan staged files
   */
  staged?: boolean;
  /**
   * Scan diff against specified branch
   */
  diffBranch?: string;
  /**
   * Specific files to scan
   */
  files?: string[];
}

export class GitGuardianManager {
  private readonly vault: CredentialVault;
  private readonly config: GitGuardianConfig;
  private static readonly API_KEY_NAME = "gitguardian.api_key";

  constructor(vault: CredentialVault, config: GitGuardianConfig) {
    this.vault = vault;
    this.config = config;
  }

  /**
   * Initialize GitGuardian by ensuring API key is available
   */
  async initialize(): Promise<void> {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      await this.runSetupFlow();
    }
  }

  /**
   * Run the setup flow to get API key from user
   */
  private async runSetupFlow(): Promise<void> {
    throw new PRAutomatorError(
      "GitGuardian API key not found. Please set it using:\n" +
      "pr-security config set gitguardian.api_key YOUR_API_KEY\n\n" +
      "You can get your API key from: https://dashboard.gitguardian.com/api/v2/token",
      { type: "CONFIG_ERROR" }
    );
  }

  /**
   * Get the API key from vault or environment
   */
  private async getApiKey(): Promise<string | undefined> {
    return (
      this.vault.get(GitGuardianManager.API_KEY_NAME) ||
      process.env.GITGUARDIAN_API_KEY
    );
  }

  /**
   * Verify the API key is valid
   */
  async verifyApiKey(): Promise<boolean> {
    const apiKey = await this.getApiKey();
    if (!apiKey) return false;

    try {
      await execFileAsync("ggshield", ["auth", "check"], {
        env: { ...process.env, GITGUARDIAN_API_KEY: apiKey },
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Run a security scan
   */
  async scan(options: ScanOptions = {}): Promise<ScanResult> {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      throw new PRAutomatorError("GitGuardian API key not found", {
        type: "CONFIG_ERROR",
      });
    }

    const args = ["secret", "scan"];

    // Add scan mode options
    if (options.staged) {
      args.push("--staged");
    } else if (options.diffBranch) {
      args.push("--diff", options.diffBranch);
    } else if (options.files?.length) {
      args.push(...options.files);
    }

    // Add config options
    if (this.config.severity_level) {
      args.push("--minimum-severity", this.config.severity_level);
    }
    if (this.config.scan_mode === "full-scan") {
      args.push("--all");
    }
    if (this.config.allowed_patterns?.length) {
      args.push("--allowed-patterns", this.config.allowed_patterns.join(","));
    }
    if (this.config.exclusion_paths?.length) {
      args.push("--exclude", this.config.exclusion_paths.join(","));
    }
    if (this.config.timeout) {
      args.push("--timeout", this.config.timeout.toString());
    }

    // Add output formatting
    args.push("--json");

    try {
      const { stdout } = await execFileAsync("ggshield", args, {
        env: { ...process.env, GITGUARDIAN_API_KEY: apiKey },
      });

      return this.parseResults(stdout);
    } catch (error) {
      if (error instanceof Error && "stdout" in error) {
        // ggshield exits with non-zero when violations found
        return this.parseResults((error as any).stdout);
      }
      throw new PRAutomatorError("Failed to run security scan", {
        cause: error,
        type: "SCAN_ERROR",
      });
    }
  }

  /**
   * Parse scan results from JSON output
   */
  private parseResults(output: string): ScanResult {
    try {
      const results = JSON.parse(output);
      return {
        violations: results.policies_breaks.map((violation: any) => ({
          severity: violation.break_type,
          file: violation.file_path,
          line: violation.line_number,
          message: violation.policy,
        })),
        scannedFiles: results.total_scanned,
        totalViolations: results.total_policies_breaks,
      };
    } catch (error) {
      throw new PRAutomatorError("Failed to parse scan results", {
        cause: error,
        type: "SCAN_ERROR",
      });
    }
  }

  /**
   * Check if scan results contain blocking violations
   */
  hasBlockingViolations(results: ScanResult): boolean {
    const severityLevels = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    const configLevel = severityLevels[this.config.severity_level || "high"];
    
    return results.violations.some(
      (v) => severityLevels[v.severity.toLowerCase() as keyof typeof severityLevels] >= configLevel
    );
  }
} 