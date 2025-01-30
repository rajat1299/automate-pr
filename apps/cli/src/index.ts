#!/usr/bin/env node
import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { loadConfig } from "@automate-pr/core";
import { DeepSeekClient } from "@automate-pr/ai";
import { GitHubRepoManager } from "@automate-pr/github";
import { PRWorkflow } from "@automate-pr/core";

const program = new Command();

program
  .name("pr-automator")
  .description("AI-powered pull request automation")
  .version("0.1.0")
  .argument("<prompt>", "Natural language description of the changes")
  .option("-d, --dry-run", "Preview changes without creating PR", false)
  .option("--skip-safety", "Skip safety checks", false)
  .option("--env <path>", "Path to .env file")
  .action(async (prompt: string, options) => {
    const spinner = ora();
    try {
      spinner.start("Loading configuration");
      const config = loadConfig({ envPath: options.env });

      // Initialize clients
      const ai = new DeepSeekClient(config.DEEPSEEK_API_KEY);
      const github = new GitHubRepoManager(
        config.GITHUB_TOKEN,
        // TODO: Get these from git config or CLI args
        "owner",
        "repo",
        { baseUrl: config.GITHUB_API_URL }
      );

      // Create workflow
      const workflow = new PRWorkflow(config, github, ai);

      // Execute workflow
      spinner.text = "Generating PR";
      const prUrl = await workflow.createPR(prompt, {
        dryRun: options.dryRun,
        skipSafetyChecks: options.skipSafety
      });

      spinner.succeed(chalk.green("PR created successfully!"));
      console.log(`\n${chalk.blue("PR URL:")} ${prUrl}`);

    } catch (error) {
      spinner.fail(chalk.red("Failed to create PR"));
      console.error(chalk.red(`\nError: ${error.message}`));
      
      if (error.cause) {
        console.error(chalk.dim(`\nCause: ${error.cause.message}`));
      }

      process.exit(1);
    }
  });

program.parse(); 