import { z } from "zod";

export const SeverityLevelSchema = z.enum([
  "low",
  "medium",
  "high",
  "critical"
]);

export const GitGuardianConfigSchema = z.object({
  /**
   * Minimum severity level to trigger a violation
   * @default "high"
   */
  severity_level: SeverityLevelSchema.default("high"),

  /**
   * Patterns to allow (will not trigger violations)
   * @default []
   */
  allowed_patterns: z.array(z.string()).default([]),

  /**
   * Whether to automatically quarantine detected secrets
   * @default true
   */
  auto_quarantine: z.boolean().default(true),

  /**
   * Scan mode - either scan only changes or full repository
   * @default "diff-only"
   */
  scan_mode: z.enum(["diff-only", "full-scan"]).default("diff-only"),

  /**
   * Paths to exclude from scanning
   * @default [".env.sample", "tests/fixtures/", "**/*.test.ts", "**/*.spec.ts"]
   */
  exclusion_paths: z.array(z.string()).default([
    ".env.sample",
    "tests/fixtures/",
    "**/*.test.ts",
    "**/*.spec.ts"
  ]),

  /**
   * Timeout in seconds for scan operations
   * @default 60
   */
  timeout: z.number().int().min(1).max(300).default(60),

  /**
   * Maximum number of retries for failed operations
   * @default 3
   */
  max_retries: z.number().int().min(0).max(5).default(3)
}).default({});

export const SecurityConfigSchema = z.object({
  /**
   * GitGuardian specific configuration
   */
  gitguardian: GitGuardianConfigSchema,

  /**
   * Git hook configuration
   */
  hooks: z.object({
    /**
     * Enable pre-commit hook
     * @default true
     */
    pre_commit: z.boolean().default(true),

    /**
     * Enable pre-push hook
     * @default false
     */
    pre_push: z.boolean().default(false)
  }).default({}),

  /**
   * Notification configuration
   */
  notifications: z.object({
    /**
     * Slack webhook URL for notifications
     */
    slack_webhook: z.string().url().optional(),

    /**
     * Email address for notifications
     */
    email: z.string().email().optional(),

    /**
     * Severity levels that trigger notifications
     * @default ["high", "critical"]
     */
    notify_on: z.array(SeverityLevelSchema).default(["high", "critical"])
  }).default({})
}).default({});

// Export types
export type SeverityLevel = z.infer<typeof SeverityLevelSchema>;
export type GitGuardianConfig = z.infer<typeof GitGuardianConfigSchema>;
export type SecurityConfig = z.infer<typeof SecurityConfigSchema>; 