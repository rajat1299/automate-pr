import { PRAutomatorError } from "./error";
import { exec } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";
import path from "path";

const execAsync = promisify(exec);

export interface CodeChange {
  path: string;
  operation: "create" | "modify" | "delete";
  content?: string;
  hash?: string;
  mode?: string;
  oldPath?: string; // For renames
}

export interface GitOperationOptions {
  author?: {
    name: string;
    email: string;
  };
  dryRun?: boolean;
  noVerify?: boolean;
}

export class GitError extends PRAutomatorError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super("system", message, { ...metadata, source: "git" });
  }
}

export class GitOperations {
  constructor(private readonly repoPath: string) {}

  /**
   * Apply a set of changes to a branch atomically
   */
  async applyChanges(
    changes: CodeChange[],
    branch: string,
    options: GitOperationOptions = {}
  ): Promise<void> {
    try {
      // Validate branch exists
      await this.checkBranchExists(branch);

      // Switch to branch
      await this.checkout(branch);

      // Create temporary staging area
      const stagingDir = await this.createStagingArea();

      try {
        // Apply changes to staging
        await this.stageChanges(changes, stagingDir);

        // Commit changes
        if (!options.dryRun) {
          await this.commitStagedChanges(branch, options);
        }
      } finally {
        // Cleanup
        await fs.rm(stagingDir, { recursive: true, force: true });
      }
    } catch (error) {
      throw new GitError(
        `Failed to apply changes to branch ${branch}: ${error.message}`,
        { branch, error }
      );
    }
  }

  private async checkBranchExists(branch: string): Promise<void> {
    try {
      await execAsync(`git show-ref --verify refs/heads/${branch}`, {
        cwd: this.repoPath
      });
    } catch {
      throw new GitError(`Branch ${branch} does not exist`);
    }
  }

  private async checkout(branch: string): Promise<void> {
    try {
      await execAsync(`git checkout ${branch}`, { cwd: this.repoPath });
    } catch (error) {
      throw new GitError(`Failed to checkout branch ${branch}`, {
        branch,
        error: error.message
      });
    }
  }

  private async createStagingArea(): Promise<string> {
    const stagingDir = path.join(this.repoPath, ".git", "staging");
    await fs.mkdir(stagingDir, { recursive: true });
    return stagingDir;
  }

  private async stageChanges(
    changes: CodeChange[],
    stagingDir: string
  ): Promise<void> {
    for (const change of changes) {
      const targetPath = path.join(this.repoPath, change.path);
      const stagingPath = path.join(stagingDir, change.path);

      await fs.mkdir(path.dirname(stagingPath), { recursive: true });

      switch (change.operation) {
        case "create":
        case "modify":
          if (!change.content) {
            throw new GitError(
              `Missing content for ${change.operation} operation on ${change.path}`
            );
          }
          await fs.writeFile(stagingPath, change.content);
          await execAsync(`git add "${change.path}"`, { cwd: this.repoPath });
          break;

        case "delete":
          try {
            await execAsync(`git rm "${change.path}"`, { cwd: this.repoPath });
          } catch (error) {
            throw new GitError(`Failed to delete file ${change.path}`, {
              path: change.path,
              error: error.message
            });
          }
          break;

        default:
          throw new GitError(`Unknown operation: ${change.operation}`);
      }
    }
  }

  private async commitStagedChanges(
    branch: string,
    options: GitOperationOptions
  ): Promise<void> {
    const args = ["commit"];

    if (options.noVerify) {
      args.push("--no-verify");
    }

    if (options.author) {
      args.push(
        `--author="${options.author.name} <${options.author.email}>"`
      );
    }

    args.push("-m", "feat: apply automated changes");

    try {
      await execAsync(`git ${args.join(" ")}`, { cwd: this.repoPath });
    } catch (error) {
      throw new GitError(`Failed to commit changes to ${branch}`, {
        branch,
        error: error.message
      });
    }
  }

  /**
   * Get the current repository context
   */
  async getRepoContext(): Promise<{
    owner: string;
    repo: string;
    branch: string;
    root: string;
  }> {
    try {
      // Get remote URL
      const { stdout: remoteUrl } = await execAsync(
        "git config --get remote.origin.url",
        { cwd: this.repoPath }
      );

      // Parse owner and repo from URL
      const match = remoteUrl.trim()
        .match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?$/);
      
      if (!match) {
        throw new GitError("Could not parse GitHub repository from remote URL");
      }

      const [, owner, repo] = match;

      // Get current branch
      const { stdout: branch } = await execAsync(
        "git rev-parse --abbrev-ref HEAD",
        { cwd: this.repoPath }
      );

      return {
        owner,
        repo,
        branch: branch.trim(),
        root: this.repoPath
      };
    } catch (error) {
      throw new GitError("Failed to get repository context", {
        error: error.message
      });
    }
  }
} 