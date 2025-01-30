import { mkdir, writeFile, unlink, access } from "node:fs/promises";
import { join } from "node:path";
import { PRAutomatorError } from "@automate-pr/core";

const PRE_COMMIT_HOOK = `#!/bin/sh
# PR Automator Security Pre-commit Hook
# This hook runs security scans on staged files

# Run security scan on staged files
bunx pr-security scan --staged

# Exit with scan result status
exit $?`;

const PRE_PUSH_HOOK = `#!/bin/sh
# PR Automator Security Pre-push Hook
# This hook runs security scans on the diff against the remote

# Get the current branch name
BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Run security scan on diff against remote
bunx pr-security scan --diff origin/\${BRANCH:-main}

# Exit with scan result status
exit $?`;

export interface HookOptions {
  preCommit?: boolean;
  prePush?: boolean;
}

/**
 * Install Git hooks for security scanning
 */
export async function installHooks(
  gitRoot: string,
  options: HookOptions = {}
): Promise<void> {
  const hooksDir = join(gitRoot, ".git", "hooks");

  try {
    // Ensure hooks directory exists
    await mkdir(hooksDir, { recursive: true });

    // Install pre-commit hook
    if (options.preCommit !== false) {
      await writeFile(join(hooksDir, "pre-commit"), PRE_COMMIT_HOOK, {
        mode: 0o755,
      });
    }

    // Install pre-push hook
    if (options.prePush) {
      await writeFile(join(hooksDir, "pre-push"), PRE_PUSH_HOOK, {
        mode: 0o755,
      });
    }
  } catch (error) {
    throw new PRAutomatorError("Failed to install Git hooks", {
      cause: error,
      type: "HOOK_ERROR",
    });
  }
}

/**
 * Uninstall Git hooks
 */
export async function uninstallHooks(gitRoot: string): Promise<void> {
  const hooksDir = join(gitRoot, ".git", "hooks");

  try {
    // Check if hooks exist
    const hooks = ["pre-commit", "pre-push"];
    for (const hook of hooks) {
      const hookPath = join(hooksDir, hook);
      try {
        await access(hookPath);
        await unlink(hookPath);
      } catch {
        // Hook doesn't exist, skip
      }
    }
  } catch (error) {
    throw new PRAutomatorError("Failed to uninstall Git hooks", {
      cause: error,
      type: "HOOK_ERROR",
    });
  }
} 