import { z } from "zod";
import { config } from "dotenv";
import path from "path";

const Schema = z.object({
  DEEPSEEK_API_KEY: z.string().min(20),
  GITHUB_TOKEN: z.string().min(40),
  DEFAULT_BRANCH: z.string().default("main"),
  SAFETY_CHECKS: z.boolean().default(true),
  // Additional useful configurations
  GITHUB_API_URL: z.string().url().default("https://api.github.com"),
  MAX_FILES_PER_PR: z.number().int().positive().default(50),
  PR_DRAFT_BY_DEFAULT: z.boolean().default(true),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info")
});

export type Config = z.infer<typeof Schema>;

export interface ConfigOptions {
  envPath?: string;
  overrides?: Partial<Config>;
}

export function loadConfig(options: ConfigOptions = {}): Config {
  // Load from multiple possible .env locations
  const envPaths = [
    options.envPath,
    ".env",
    ".env.local",
    path.join(process.cwd(), ".env"),
  ].filter(Boolean) as string[];

  for (const envPath of envPaths) {
    config({ path: envPath });
  }

  // Merge process.env with overrides
  const rawConfig = {
    ...process.env,
    ...options.overrides,
    // Convert string "true"/"false" to boolean
    SAFETY_CHECKS: process.env.SAFETY_CHECKS === "true" || process.env.SAFETY_CHECKS === undefined,
    PR_DRAFT_BY_DEFAULT: process.env.PR_DRAFT_BY_DEFAULT === "true" || process.env.PR_DRAFT_BY_DEFAULT === undefined,
    MAX_FILES_PER_PR: process.env.MAX_FILES_PER_PR ? parseInt(process.env.MAX_FILES_PER_PR) : undefined
  };

  try {
    return Schema.parse(rawConfig);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.issues
        .filter(issue => issue.code === "invalid_type" && issue.received === "undefined")
        .map(issue => issue.path.join("."));
      
      throw new Error(
        `Missing required environment variables: ${missingVars.join(", ")}\n` +
        "Please check your .env file or environment configuration."
      );
    }
    throw error;
  }
} 