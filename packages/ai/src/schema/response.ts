import { z } from "zod";

// File change schemas
export const FileActionSchema = z.enum([
  "create",
  "modify",
  "delete",
  "rename"
]);

export const FileChangeSchema = z.object({
  path: z.string(),
  action: FileActionSchema,
  diff: z.string().optional(),
  content: z.string().optional(),
  oldPath: z.string().optional(),
  mode: z.number().optional()
});

// PR metadata schemas
export const CommitTypeSchema = z.enum([
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "perf",
  "test",
  "build",
  "ci",
  "chore",
  "revert"
]);

export const PRMetadataSchema = z.object({
  title: z.string().max(72), // GitHub's recommended max length
  body: z.string(),
  type: CommitTypeSchema,
  scope: z.string().optional(),
  breaking: z.boolean().default(false),
  draft: z.boolean().default(false)
});

// Reviewer schema
export const ReviewerSchema = z.object({
  username: z.string(),
  reason: z.string(),
  expertise: z.array(z.string())
});

// AI metadata schema
export const AIMetadataSchema = z.object({
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  suggestedLabels: z.array(z.string()),
  estimatedComplexity: z.enum(["low", "medium", "high"]),
  warnings: z.array(z.string()).optional(),
  suggestions: z.array(z.string()).optional()
});

// Main response schema
export const AIResponseSchema = z.object({
  files: z.array(FileChangeSchema),
  pr: PRMetadataSchema,
  reviewers: z.array(ReviewerSchema).optional(),
  metadata: AIMetadataSchema
});

// Export types
export type FileAction = z.infer<typeof FileActionSchema>;
export type FileChange = z.infer<typeof FileChangeSchema>;
export type CommitType = z.infer<typeof CommitTypeSchema>;
export type PRMetadata = z.infer<typeof PRMetadataSchema>;
export type Reviewer = z.infer<typeof ReviewerSchema>;
export type AIMetadata = z.infer<typeof AIMetadataSchema>;
export type AIResponse = z.infer<typeof AIResponseSchema>; 