import { z } from "zod";

export const FrameworkSchema = z.enum([
  "react",
  "vue",
  "angular",
  "svelte",
  "express",
  "nest",
  "next",
  "nuxt",
  "none"
]);

export const TestFrameworkSchema = z.enum([
  "jest",
  "vitest",
  "mocha",
  "ava",
  "tap",
  "none"
]);

export const PackageManagerSchema = z.enum([
  "npm",
  "yarn",
  "pnpm",
  "bun"
]);

export const RepoContextSchema = z.object({
  // Basic info
  owner: z.string(),
  repo: z.string(),
  branch: z.string(),
  root: z.string(),

  // Project structure
  files: z.array(z.object({
    path: z.string(),
    content: z.string(),
    size: z.number(),
    type: z.enum(["file", "directory"]),
  })),

  // Dependencies
  dependencies: z.object({
    production: z.record(z.string()),
    development: z.record(z.string()),
    peer: z.record(z.string()).optional(),
  }),

  // Project metadata
  framework: FrameworkSchema,
  testFramework: TestFrameworkSchema,
  packageManager: PackageManagerSchema,
  
  // Patterns and conventions
  patterns: z.object({
    fileNaming: z.array(z.string()),
    componentStyle: z.enum(["class", "function", "mixed"]).optional(),
    testPattern: z.string().optional(),
    importStyle: z.enum(["esm", "commonjs", "mixed"]).optional(),
  }),

  // Repository settings
  settings: z.object({
    hasWorkflows: z.boolean(),
    hasTypeScript: z.boolean(),
    hasLinter: z.boolean(),
    hasFormatter: z.boolean(),
    defaultBranch: z.string(),
    isMonorepo: z.boolean(),
  })
});

export type Framework = z.infer<typeof FrameworkSchema>;
export type TestFramework = z.infer<typeof TestFrameworkSchema>;
export type PackageManager = z.infer<typeof PackageManagerSchema>;
export type RepoContext = z.infer<typeof RepoContextSchema>; 