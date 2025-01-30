import { z } from "zod";

export const FileChangeSchema = z.object({
  path: z.string(),
  action: z.enum(["create", "modify", "delete"]),
  content: z.string().optional(),
  diff: z.string().optional(),
  mode: z.string().optional(),
  oldPath: z.string().optional(),
});

export const ReviewerSchema = z.object({
  username: z.string(),
  reason: z.string(),
  expertise: z.array(z.string()),
});

export const PRDescriptionSchema = z.object({
  title: z.string().max(80),
  body: z.string().max(5000),
  type: z.enum([
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
  ]),
  scope: z.string().optional(),
  breaking: z.boolean().default(false),
  relatedIssues: z.array(z.string()).optional(),
  coAuthors: z.array(z.string()).optional(),
});

export const AIResponseSchema = z.object({
  files: z.array(FileChangeSchema),
  pr: PRDescriptionSchema,
  reviewers: z.array(ReviewerSchema),
  metadata: z.object({
    confidence: z.number().min(0).max(1),
    reasoning: z.string(),
    suggestedLabels: z.array(z.string()),
    estimatedComplexity: z.enum(["low", "medium", "high"]),
    securityConsiderations: z.array(z.string()).optional(),
    testingRecommendations: z.array(z.string()).optional(),
  }),
});

export type FileChange = z.infer<typeof FileChangeSchema>;
export type Reviewer = z.infer<typeof ReviewerSchema>;
export type PRDescription = z.infer<typeof PRDescriptionSchema>;
export type AIResponse = z.infer<typeof AIResponseSchema>; 