import { Command, Flags } from '@oclif/core';
import { Octokit } from '@octokit/rest';
import * as inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { getToken } from '../utils/auth';
import { analyzeChanges } from '../utils/changes';
import { generatePRDescription } from '../utils/description';

export default class PR extends Command {
  static description = 'Create an automated pull request';

  static examples = [
    '$ automate-pr pr',
    '$ automate-pr pr --title="feat: add new feature"',
    '$ automate-pr pr --branch=feature/new-feature',
  ];

  static flags = {
    title: Flags.string({
      char: 't',
      description: 'Pull request title',
      required: false,
    }),
    branch: Flags.string({
      char: 'b',
      description: 'Branch name to create PR from',
      required: false,
    }),
    base: Flags.string({
      char: 'B',
      description: 'Base branch to create PR against',
      default: 'main',
      required: false,
    }),
    draft: Flags.boolean({
      char: 'd',
      description: 'Create PR as draft',
      default: false,
    }),
    labels: Flags.string({
      char: 'l',
      description: 'Comma-separated list of labels',
      required: false,
    }),
  };

  async run() {
    const spinner = ora('Preparing to create pull request...').start();

    try {
      // Get authentication token
      const token = await getToken();
      const octokit = new Octokit({ auth: token });

      // Parse flags
      const { flags } = await this.parse(PR);
      
      // Get current branch if not specified
      let branch = flags.branch;
      if (!branch) {
        const { stdout } = await this.config.runCommand('git', ['branch', '--show-current']);
        branch = stdout.trim();
      }

      // Analyze changes
      spinner.text = 'Analyzing changes...';
      const changes = await analyzeChanges(branch, flags.base);

      // Generate PR title if not provided
      let title = flags.title;
      if (!title) {
        const suggestedTitle = await this.generateTitle(changes);
        const { confirmedTitle } = await inquirer.prompt([{
          type: 'input',
          name: 'confirmedTitle',
          message: 'PR Title:',
          default: suggestedTitle,
        }]);
        title = confirmedTitle;
      }

      // Generate PR description
      spinner.text = 'Generating PR description...';
      const description = await generatePRDescription(changes);

      // Get repository info
      const { stdout: remoteUrl } = await this.config.runCommand('git', ['remote', 'get-url', 'origin']);
      const [owner, repo] = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/)?.slice(1) ?? [];

      // Create PR
      spinner.text = 'Creating pull request...';
      const { data: pullRequest } = await octokit.pulls.create({
        owner,
        repo,
        title,
        body: description,
        head: branch,
        base: flags.base,
        draft: flags.draft,
      });

      // Add labels if specified
      if (flags.labels) {
        const labels = flags.labels.split(',').map(l => l.trim());
        await octokit.issues.addLabels({
          owner,
          repo,
          issue_number: pullRequest.number,
          labels,
        });
      }

      spinner.succeed(chalk.green(`Pull request created successfully: ${pullRequest.html_url}`));

    } catch (error) {
      spinner.fail(chalk.red('Failed to create pull request'));
      this.error(error as Error);
    }
  }

  private async generateTitle(changes: any): Promise<string> {
    // Analyze the type of changes (feat, fix, etc.)
    const type = changes.type || 'chore';
    const scope = changes.scope ? `(${changes.scope})` : '';
    const description = changes.description || 'update codebase';

    return `${type}${scope}: ${description}`;
  }
} 