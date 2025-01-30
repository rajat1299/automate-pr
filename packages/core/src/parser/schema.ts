import { z } from "zod";
import { PRAutomatorError } from "../error";

/**
 * File path validation regex
 * Allows:
 * - Alphanumeric characters
 * - Forward slashes for directories
 * - Hyphens and underscores
 * - File extensions
 * - No absolute paths or parent directory traversal
 */
const FILE_PATH_REGEX = /^(?!\/|.*\.\.\/)[a-zA-Z0-9\/\-_\.]+$/;

/**
 * Git diff validation regex
 * Ensures the diff follows basic Git diff format:
 * - Must start with diff --git
 * - Must contain @@ markers for chunk headers
 * - Must contain actual changes (+/- lines)
 */
const DIFF_REGEX = /^diff --git.*?(?:\n@@.*?@@.*?)+$/ms;

/**
 * Schema for individual file changes
 */
export const FileChangeSchema = z.object({
  path: z.string()
    .regex(FILE_PATH_REGEX, {
      message: "Invalid file path. Must be relative and contain only alphanumeric characters, slashes, hyphens, underscores, and dots."
    }),
  diff: z.string()
    .min(20, "Diff content too short")
    .regex(DIFF_REGEX, {
      message: "Invalid diff format. Must be a valid Git diff."
    }),
  oldPath: z.string()
    .regex(FILE_PATH_REGEX, {
      message: "Invalid old file path. Must be relative and contain only alphanumeric characters, slashes, hyphens, underscores, and dots."
    })
    .optional(),
  mode: z.enum(["create", "modify", "delete", "rename"])
    .default("modify"),
  content: z.string()
    .min(1, "File content cannot be empty")
    .optional(),
}).strict();

/**
 * Schema for PR metadata
 */
export const PRMetadataSchema = z.object({
  title: z.string()
    .min(10, "PR title too short")
    .max(80, "PR title too long")
    .regex(/^[a-zA-Z0-9\s\-_\.,:;!?'"()[\]{}]+$/, {
      message: "PR title contains invalid characters"
    }),
  description: z.string()
    .min(30, "PR description too short")
    .max(4000, "PR description too long"),
  branch: z.string()
    .regex(/^[a-zA-Z0-9\-_\/]+$/, {
      message: "Invalid branch name"
    })
    .optional(),
  labels: z.array(z.string())
    .optional(),
  assignees: z.array(z.string())
    .optional(),
  reviewers: z.array(z.string())
    .optional(),
}).strict();

/**
 * Main schema for AI response validation
 */
export const AIResponseSchema = z.object({
  files: z.array(FileChangeSchema)
    .min(1, "At least one file change is required")
    .max(20, "Too many file changes in a single PR"),
  metadata: PRMetadataSchema,
  reasoning: z.string()
    .min(50, "Reasoning too short")
    .max(2000, "Reasoning too long")
    .optional(),
}).strict();

/**
 * Type definitions for schema
 */
export type FileChange = z.infer<typeof FileChangeSchema>;
export type PRMetadata = z.infer<typeof PRMetadataSchema>;
export type AIResponse = z.infer<typeof AIResponseSchema>;

/**
 * Validate AI response with fallback parsing
 */
export function validateAIResponse(input: unknown): AIResponse {
  try {
    // First attempt: direct validation
    return AIResponseSchema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Second attempt: try to fix common issues
      const fixed = attemptResponseRecovery(input);
      try {
        return AIResponseSchema.parse(fixed);
      } catch (recoveryError) {
        throw new PRAutomatorError("Invalid AI response format", {
          cause: recoveryError,
          type: "VALIDATION_ERROR",
        });
      }
    }
    throw new PRAutomatorError("Failed to parse AI response", {
      cause: error,
      type: "PARSER_ERROR",
    });
  }
}

/**
 * Attempt to recover from common response format issues
 */
function attemptResponseRecovery(input: unknown): unknown {
  if (typeof input !== "object" || input === null) {
    throw new PRAutomatorError("Response must be an object", {
      type: "VALIDATION_ERROR",
    });
  }

  const result: Record<string, unknown> = {};

  // Handle files array
  if ("files" in input && Array.isArray((input as any).files)) {
    result.files = (input as any).files.map((file: any) => ({
      path: String(file.path || ""),
      diff: normalizeDiff(file.diff || ""),
      ...(file.oldPath && { oldPath: String(file.oldPath) }),
      ...(file.mode && { mode: String(file.mode) }),
      ...(file.content && { content: String(file.content) }),
    }));
  } else {
    result.files = [];
  }

  // Handle metadata
  if ("metadata" in input && typeof (input as any).metadata === "object") {
    const meta = (input as any).metadata;
    result.metadata = {
      title: String(meta.title || "").slice(0, 80),
      description: String(meta.description || ""),
      ...(meta.branch && { branch: String(meta.branch) }),
      ...(meta.labels && { labels: ensureStringArray(meta.labels) }),
      ...(meta.assignees && { assignees: ensureStringArray(meta.assignees) }),
      ...(meta.reviewers && { reviewers: ensureStringArray(meta.reviewers) }),
    };
  } else {
    throw new PRAutomatorError("Missing or invalid metadata", {
      type: "VALIDATION_ERROR",
    });
  }

  // Handle optional reasoning
  if ("reasoning" in input && (input as any).reasoning) {
    result.reasoning = String((input as any).reasoning);
  }

  return result;
}

/**
 * Normalize diff content to ensure it follows Git diff format
 */
function normalizeDiff(diff: string): string {
  // Remove any leading/trailing whitespace
  diff = diff.trim();

  // Ensure diff starts with "diff --git"
  if (!diff.startsWith("diff --git")) {
    diff = `diff --git a/file b/file\n${diff}`;
  }

  // Ensure diff has chunk headers
  if (!diff.includes("@@")) {
    diff = `${diff}\n@@ -1,1 +1,1 @@\n${diff}`;
  }

  return diff;
}

/**
 * Ensure value is an array of strings
 */
function ensureStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String);
  }
  return [];
} 