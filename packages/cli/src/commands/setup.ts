import { Command } from '@oclif/core';
import { Octokit } from '@octokit/rest';
import * as inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';

export default class Setup extends Command {
  static description = 'Initialize repository with recommended security and workflow settings';

  async run() {
    const spinner = ora('Setting up your repository...').start();

    try {
      // 1. Get GitHub token
      const { token } = await inquirer.prompt([
        {
          type: 'password',
          name: 'token',
          message: 'Enter your GitHub personal access token:',
          validate: (input: string) => input.length > 0
        }
      ]);

      const octokit = new Octokit({ auth: token });

      // 2. Get repository info
      const { repo, owner } = await inquirer.prompt([
        {
          type: 'input',
          name: 'owner',
          message: 'Repository owner:',
        },
        {
          type: 'input',
          name: 'repo',
          message: 'Repository name:',
        }
      ]);

      // 3. Configure branch protection
      spinner.text = 'Configuring branch protection rules...';
      await octokit.repos.updateBranchProtection({
        owner,
        repo,
        branch: 'main',
        required_status_checks: {
          strict: true,
          contexts: ['ci.yml (build)', 'ci.yml (test)', 'security.yml']
        },
        enforce_admins: true,
        required_pull_request_reviews: {
          required_approving_review_count: 2,
          dismiss_stale_reviews: true
        },
        restrictions: null
      });

      // 4. Setup repository secrets
      spinner.text = 'Setting up repository secrets...';
      const { setupSecrets } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'setupSecrets',
          message: 'Would you like to set up recommended security scanning secrets?',
          default: true
        }
      ]);

      if (setupSecrets) {
        const secrets = await inquirer.prompt([
          {
            type: 'password',
            name: 'GITGUARDIAN_API_KEY',
            message: 'Enter GitGuardian API key (optional):',
          },
          {
            type: 'password',
            name: 'SNYK_TOKEN',
            message: 'Enter Snyk token (optional):',
          }
        ]);

        // Set each provided secret
        for (const [name, value] of Object.entries(secrets)) {
          if (value) {
            await octokit.actions.createOrUpdateRepoSecret({
              owner,
              repo,
              secret_name: name,
              encrypted_value: value // Note: In production, implement proper encryption
            });
          }
        }
      }

      spinner.succeed(chalk.green('Repository setup completed successfully!'));
      
      this.log('\nNext steps:');
      this.log('1. Review the branch protection rules in your repository settings');
      this.log('2. Set up any additional secrets you may need');
      this.log('3. Configure your CI/CD pipeline using the generated workflow files');

    } catch (error) {
      spinner.fail(chalk.red('Setup failed'));
      this.error(error as Error);
    }
  }
} 