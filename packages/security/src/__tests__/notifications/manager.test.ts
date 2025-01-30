import { describe, it, expect, vi, beforeEach } from "vitest";
import { PRAutomatorError } from "@automate-pr/core";
import { NotificationManager } from "../../notifications/manager";
import type { SecurityConfig } from "../../schema/config";
import type { ScanResult } from "../../gitguardian/manager";

// Mock fetch
global.fetch = vi.fn();

describe("NotificationManager", () => {
  let manager: NotificationManager;
  let mockConfig: SecurityConfig["notifications"];
  let mockScanResult: ScanResult;

  beforeEach(() => {
    manager = new NotificationManager();
    
    mockConfig = {
      slack_webhook: "https://hooks.slack.com/test",
      email: "test@example.com",
      notify_on: ["high", "critical"]
    };

    mockScanResult = {
      violations: [
        {
          severity: "high",
          file: "test.js",
          line: 1,
          message: "API key found"
        }
      ],
      scannedFiles: 10,
      totalViolations: 1
    };

    vi.mocked(fetch).mockReset();
  });

  describe("notify", () => {
    it("should not send notifications when no channels configured", async () => {
      await manager.notify({
        config: { notify_on: ["high"] },
        scanResult: mockScanResult
      });

      expect(fetch).not.toHaveBeenCalled();
    });

    it("should not send notifications when no violations meet threshold", async () => {
      mockConfig.notify_on = ["critical"];
      
      await manager.notify({
        config: mockConfig,
        scanResult: mockScanResult
      });

      expect(fetch).not.toHaveBeenCalled();
    });

    it("should send Slack notification for matching violations", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true
      } as Response);

      await manager.notify({
        config: mockConfig,
        scanResult: mockScanResult,
        repoName: "test-repo",
        branch: "main"
      });

      expect(fetch).toHaveBeenCalledWith(
        mockConfig.slack_webhook,
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          }
        })
      );

      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
      expect(body.text).toContain("Security Scan Alert");
      expect(body.text).toContain("Repository: test-repo");
      expect(body.text).toContain("Branch: main");
      expect(body.text).toContain("[HIGH]");
    });

    it("should handle Slack API errors", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error("API Error"));

      await expect(
        manager.notify({
          config: mockConfig,
          scanResult: mockScanResult
        })
      ).rejects.toThrow(PRAutomatorError);
    });

    it("should throw for email notifications (not implemented)", async () => {
      mockConfig.slack_webhook = undefined;

      await expect(
        manager.notify({
          config: mockConfig,
          scanResult: mockScanResult
        })
      ).rejects.toThrow("Email notifications not implemented yet");
    });
  });
}); 