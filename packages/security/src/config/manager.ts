import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { PRAutomatorError } from "@automate-pr/core";
import { SecurityConfigSchema } from "../schema/config";

const CONFIG_DIR = join(homedir(), ".config", "pr-automator");
const CONFIG_FILE = join(CONFIG_DIR, "security.json");

/**
 * Load security configuration from disk
 */
export async function loadConfig(): Promise<Record<string, any>> {
  try {
    const data = await readFile(CONFIG_FILE, "utf-8");
    const config = JSON.parse(data);
    return SecurityConfigSchema.parse(config);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      // Config doesn't exist yet, return defaults
      return SecurityConfigSchema.parse({});
    }
    throw new PRAutomatorError("Failed to load security configuration", {
      cause: error,
      type: "CONFIG_ERROR",
    });
  }
}

/**
 * Save security configuration to disk
 */
export async function saveConfig(config: Record<string, any>): Promise<void> {
  try {
    // Validate config before saving
    SecurityConfigSchema.parse(config);

    // Ensure config directory exists
    await mkdir(CONFIG_DIR, { recursive: true });

    // Write config file
    await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (error) {
    throw new PRAutomatorError("Failed to save security configuration", {
      cause: error,
      type: "CONFIG_ERROR",
    });
  }
} 