import { Octokit } from "@octokit/rest";
import { PRParams } from "@automate-pr/types";

export interface GitHubOptions {
  baseUrl?: string;
  timeoutMs?: number;
  retries?: number;
}

export class GitHubError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly response?: any
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

export class GitHubRepoManager {
  private readonly octokit: Octokit;

  constructor(
    token: string,
    private readonly owner: string,
    private readonly repo: string,
    options: GitHubOptions = {}
  ) {
    this.octokit = new Octokit({
      auth: token,
      baseUrl: options.baseUrl,
      request: {
        timeout: options.timeoutMs || 10000
      }
    });
  }

  async createBranch(baseBranch: string, newBranch: string): Promise<void> {
    try {
      const { data: ref } = await this.octokit.git.getRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${baseBranch}`
      });

      await this.octokit.git.createRef({
        owner: this.owner,
        repo: this.repo,
        ref: `refs/heads/${newBranch}`,
        sha: ref.object.sha
      });
    } catch (error) {
      throw this.handleError(error, `Failed to create branch ${newBranch}`);
    }
  }

  async createPullRequest(params: PRParams): Promise<number> {
    try {
      const { data: pr } = await this.octokit.pulls.create({
        owner: this.owner,
        repo: this.repo,
        title: params.title,
        head: params.headBranch,
        base: params.baseBranch,
        body: params.description,
        draft: params.isDraft
      });

      if (params.reviewers?.length) {
        await this.octokit.pulls.requestReviewers({
          owner: this.owner,
          repo: this.repo,
          pull_number: pr.number,
          reviewers: params.reviewers
        });
      }

      return pr.number;
    } catch (error) {
      throw this.handleError(error, "Failed to create pull request");
    }
  }

  async commitFiles(
    branch: string,
    message: string,
    files: Array<{ path: string; content: string; }>
  ): Promise<void> {
    try {
      // Get the latest commit SHA
      const { data: ref } = await this.octokit.git.getRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${branch}`
      });

      // Create blobs for each file
      const fileBlobs = await Promise.all(
        files.map(file =>
          this.octokit.git.createBlob({
            owner: this.owner,
            repo: this.repo,
            content: Buffer.from(file.content).toString("base64"),
            encoding: "base64"
          })
        )
      );

      // Create tree
      const { data: tree } = await this.octokit.git.createTree({
        owner: this.owner,
        repo: this.repo,
        base_tree: ref.object.sha,
        tree: files.map((file, index) => ({
          path: file.path,
          mode: "100644",
          type: "blob",
          sha: fileBlobs[index].data.sha
        }))
      });

      // Create commit
      const { data: commit } = await this.octokit.git.createCommit({
        owner: this.owner,
        repo: this.repo,
        message,
        tree: tree.sha,
        parents: [ref.object.sha]
      });

      // Update branch reference
      await this.octokit.git.updateRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${branch}`,
        sha: commit.sha
      });
    } catch (error) {
      throw this.handleError(error, "Failed to commit files");
    }
  }

  async getBranchProtection(branch: string): Promise<boolean> {
    try {
      await this.octokit.repos.getBranchProtection({
        owner: this.owner,
        repo: this.repo,
        branch
      });
      return true;
    } catch (error) {
      if (error.status === 404) {
        return false;
      }
      throw this.handleError(error, `Failed to get branch protection for ${branch}`);
    }
  }

  private handleError(error: any, context: string): GitHubError {
    const status = error.status;
    const response = error.response?.data;
    
    let message = `${context}: ${error.message}`;
    if (response?.message) {
      message += ` - ${response.message}`;
    }

    return new GitHubError(message, status, response);
  }
} 