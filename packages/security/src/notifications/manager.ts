import { PRAutomatorError } from "@automate-pr/core";
import type { SecurityConfig } from "../schema/config";
import type { ScanResult } from "../gitguardian/manager";

interface NotificationOptions {
  config: SecurityConfig["notifications"];
  scanResult: ScanResult;
  repoName?: string;
  branch?: string;
}

export class NotificationManager {
  /**
   * Send notifications based on scan results and configuration
   */
  async notify({ config, scanResult, repoName, branch }: NotificationOptions): Promise<void> {
    if (!config.slack_webhook && !config.email) {
      return; // No notification channels configured
    }

    // Check if any violations meet notification threshold
    const notifyViolations = scanResult.violations.filter(v => 
      config.notify_on.includes(v.severity.toLowerCase() as any)
    );

    if (notifyViolations.length === 0) {
      return; // No violations meeting notification threshold
    }

    // Build notification message
    const message = this.formatMessage({
      violations: notifyViolations,
      totalViolations: scanResult.totalViolations,
      scannedFiles: scanResult.scannedFiles,
      repoName,
      branch
    });

    // Send notifications
    const promises: Promise<void>[] = [];

    if (config.slack_webhook) {
      promises.push(this.sendSlackNotification(config.slack_webhook, message));
    }

    if (config.email) {
      promises.push(this.sendEmailNotification(config.email, message));
    }

    try {
      await Promise.all(promises);
    } catch (error) {
      throw new PRAutomatorError("Failed to send notifications", {
        cause: error,
        type: "NOTIFICATION_ERROR"
      });
    }
  }

  /**
   * Format notification message
   */
  private formatMessage({
    violations,
    totalViolations,
    scannedFiles,
    repoName,
    branch
  }: {
    violations: ScanResult["violations"];
    totalViolations: number;
    scannedFiles: number;
    repoName?: string;
    branch?: string;
  }): string {
    const context = [
      repoName && `Repository: ${repoName}`,
      branch && `Branch: ${branch}`,
      `Files scanned: ${scannedFiles}`,
      `Total violations: ${totalViolations}`
    ].filter(Boolean).join("\n");

    const details = violations
      .map(v => `[${v.severity.toUpperCase()}] ${v.file}:${v.line}\n${v.message}`)
      .join("\n\n");

    return `🚨 Security Scan Alert\n\n${context}\n\nViolations:\n${details}`;
  }

  /**
   * Send notification to Slack
   */
  private async sendSlackNotification(webhook: string, message: string): Promise<void> {
    try {
      const response = await fetch(webhook, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: message
        })
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.statusText}`);
      }
    } catch (error) {
      throw new PRAutomatorError("Failed to send Slack notification", {
        cause: error,
        type: "NOTIFICATION_ERROR"
      });
    }
  }

  /**
   * Send notification via email
   * Note: This is a placeholder - actual implementation would need an email service
   */
  private async sendEmailNotification(email: string, message: string): Promise<void> {
    // TODO: Implement email sending
    // This would typically use a service like SendGrid, AWS SES, etc.
    throw new PRAutomatorError(
      "Email notifications not implemented yet",
      { type: "NOT_IMPLEMENTED" }
    );
  }
} 