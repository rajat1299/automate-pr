import { DeepSeekClient } from "@automate-pr/ai";
import { GitHubRepoManager } from "@automate-pr/github";
import { PRPlan, RepoContext } from "@automate-pr/types";
import { Config } from "./config";

export interface WorkflowOptions {
  dryRun?: boolean;
  skipSafetyChecks?: boolean;
}

export class WorkflowError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = "WorkflowError";
  }
}

export class PRWorkflow {
  constructor(
    private readonly config: Config,
    private readonly github: GitHubRepoManager,
    private readonly ai: DeepSeekClient
  ) {}

  async createPR(prompt: string, options: WorkflowOptions = {}): Promise<string> {
    try {
      // Step 1: Validate input
      this.validateInput(prompt);

      // Step 2: Get repository context
      const context = await this.getRepoContext();

      // Step 3: Generate PR plan using AI
      const plan = await this.ai.generatePRPlan(prompt, context);

      // Step 4: Validate the plan
      await this.validatePlan(plan, options);

      // Step 5: Create branch
      const branchName = this.generateBranchName(prompt);
      await this.github.createBranch(this.config.DEFAULT_BRANCH, branchName);

      // Step 6: Apply changes
      if (!options.dryRun) {
        await this.applyChanges(branchName, plan);
      }

      // Step 7: Create PR
      const prNumber = await this.github.createPullRequest({
        title: plan.pr.title,
        description: this.generatePRDescription(prompt, plan),
        headBranch: branchName,
        baseBranch: this.config.DEFAULT_BRANCH,
        isDraft: this.config.PR_DRAFT_BY_DEFAULT,
        reviewers: plan.pr.reviewers
      });

      return `https://github.com/${context.owner}/${context.repo}/pull/${prNumber}`;
    } catch (error) {
      throw new WorkflowError(
        `Failed to create PR: ${error.message}`,
        error as Error
      );
    }
  }

  private validateInput(prompt: string): void {
    if (!prompt?.trim()) {
      throw new WorkflowError("Prompt cannot be empty");
    }
    if (prompt.length > 1000) {
      throw new WorkflowError("Prompt is too long (max 1000 characters)");
    }
  }

  private async getRepoContext(): Promise<RepoContext> {
    // TODO: Implement repository context gathering
    // This should:
    // 1. Get current branch info
    // 2. Get relevant files based on the directory structure
    // 3. Load file contents as needed
    throw new Error("Not implemented");
  }

  private async validatePlan(plan: PRPlan, options: WorkflowOptions): Promise<void> {
    // Skip safety checks if explicitly disabled
    if (options.skipSafetyChecks || !this.config.SAFETY_CHECKS) {
      return;
    }

    // Validate number of files
    if (plan.files.length > this.config.MAX_FILES_PER_PR) {
      throw new WorkflowError(
        `Too many files in PR plan (${plan.files.length} > ${this.config.MAX_FILES_PER_PR})`
      );
    }

    // Check for protected files/paths
    const protectedPaths = [".github/workflows/", "security.config", "deploy.config"];
    const hasProtectedFiles = plan.files.some(file =>
      protectedPaths.some(path => file.path.includes(path))
    );
    if (hasProtectedFiles) {
      throw new WorkflowError("PR plan contains protected files");
    }

    // Validate branch protection
    const hasProtection = await this.github.getBranchProtection(this.config.DEFAULT_BRANCH);
    if (hasProtection && !options.skipSafetyChecks) {
      throw new WorkflowError(
        `Target branch '${this.config.DEFAULT_BRANCH}' is protected. Use --skip-safety-checks to override.`
      );
    }
  }

  private async applyChanges(branch: string, plan: PRPlan): Promise<void> {
    // Group files by action
    const { create, modify, remove } = this.groupFilesByAction(plan.files);

    // Handle file creations and modifications
    if (create.length > 0 || modify.length > 0) {
      await this.github.commitFiles(
        branch,
        "feat: apply AI-generated changes",
        [...create, ...modify].map(file => ({
          path: file.path,
          content: file.content || ""
        }))
      );
    }

    // TODO: Handle file deletions
    if (remove.length > 0) {
      // Implement file deletion logic
    }
  }

  private groupFilesByAction(files: PRPlan["files"]) {
    return files.reduce(
      (acc, file) => {
        if (file.action === "create") acc.create.push(file);
        if (file.action === "modify") acc.modify.push(file);
        if (file.action === "delete") acc.remove.push(file);
        return acc;
      },
      { create: [], modify: [], remove: [] } as Record<string, typeof files>
    );
  }

  private generateBranchName(prompt: string): string {
    const sanitized = prompt
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50);
    
    return `ai-pr/${sanitized}-${Date.now().toString(36)}`;
  }

  private generatePRDescription(prompt: string, plan: PRPlan): string {
    return [
      plan.pr.description,
      "",
      "---",
      "🤖 Generated by AutomatePR",
      `Original prompt: "${prompt}"`,
      "",
      "Changes:",
      ...plan.files.map(f => `- ${f.action} \`${f.path}\``)
    ].join("\n");
  }
} 