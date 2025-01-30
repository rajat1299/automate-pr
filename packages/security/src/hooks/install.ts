import { mkdir, writeFile, chmod } from "node:fs/promises";
import { join } from "node:path";
import { PRAutomatorError } from "@automate-pr/core/error";

const PRE_COMMIT_HOOK = `#!/bin/sh
# GitGuardian pre-commit hook

# Run security scan on staged files
bunx pr-security scan --staged || exit 1
`;

const PRE_PUSH_HOOK = `#!/bin/sh
# GitGuardian pre-push hook

# Run security scan on diff against remote
bunx pr-security scan --diff origin/\${BRANCH:-main} || exit 1
`;

export async function installHooks(
  gitRoot: string,
  options: {
    preCommit?: boolean;
    prePush?: boolean;
  } = {}
): Promise<void> {
  try {
    const hooksDir = join(gitRoot, ".git", "hooks");
    
    // Ensure hooks directory exists
    await mkdir(hooksDir, { recursive: true });

    // Install pre-commit hook
    if (options.preCommit) {
      const preCommitPath = join(hooksDir, "pre-commit");
      await writeFile(preCommitPath, PRE_COMMIT_HOOK);
      await chmod(preCommitPath, 0o755);
    }

    // Install pre-push hook
    if (options.prePush) {
      const prePushPath = join(hooksDir, "pre-push");
      await writeFile(prePushPath, PRE_PUSH_HOOK);
      await chmod(prePushPath, 0o755);
    }
  } catch (error) {
    throw new PRAutomatorError(
      "security",
      `Failed to install git hooks: ${error.message}`,
      { error }
    );
  }
}

export async function uninstallHooks(
  gitRoot: string,
  options: {
    preCommit?: boolean;
    prePush?: boolean;
  } = {}
): Promise<void> {
  try {
    const hooksDir = join(gitRoot, ".git", "hooks");

    // Remove pre-commit hook
    if (options.preCommit) {
      const preCommitPath = join(hooksDir, "pre-commit");
      await unlink(preCommitPath).catch(() => {});
    }

    // Remove pre-push hook
    if (options.prePush) {
      const prePushPath = join(hooksDir, "pre-push");
      await unlink(prePushPath).catch(() => {});
    }
  } catch (error) {
    throw new PRAutomatorError(
      "security",
      `Failed to uninstall git hooks: ${error.message}`,
      { error }
    );
  }
} 