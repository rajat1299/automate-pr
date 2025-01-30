#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { CredentialVault, PRAutomatorError } from "@automate-pr/core";
import { GitGuardianManager } from "./gitguardian/manager";
import { SecurityConfigSchema } from "./schema/config";
import { installHooks, uninstallHooks } from "./hooks/installer";
import { loadConfig, saveConfig } from "./config/manager";
import { NotificationManager } from "./notifications/manager";

const program = new Command();

program
  .name("pr-security")
  .description("Security scanning and configuration tools")
  .version("0.1.0");

// Initialize shared resources
const vault = new CredentialVault({ appName: "pr-automator" });
const config = SecurityConfigSchema.parse({});
const manager = new GitGuardianManager(vault, config.gitguardian);

program
  .command("scan")
  .description("Run a security scan")
  .option("-s, --staged", "Scan staged files only")
  .option("-d, --diff <branch>", "Scan diff against specified branch")
  .option("-f, --files <files...>", "Scan specific files")
  .option("--repo <name>", "Repository name for notifications")
  .option("--branch <name>", "Branch name for notifications")
  .action(async (options) => {
    const spinner = ora("Initializing security scan...").start();

    try {
      // Load full config for notifications
      const fullConfig = await loadConfig();
      
      await vault.initialize();
      await manager.initialize();

      spinner.text = "Running security scan...";
      const results = await manager.scan({
        staged: options.staged,
        diffBranch: options.diff,
        files: options.files,
      });

      spinner.stop();

      // Display results
      console.log("\n🔍 Security Scan Results:\n");
      console.log(`Files scanned: ${results.scannedFiles}`);
      console.log(`Violations found: ${results.totalViolations}\n`);

      if (results.violations.length > 0) {
        results.violations.forEach((v) => {
          const severity = v.severity.toLowerCase();
          const color = {
            critical: "red",
            high: "yellow",
            medium: "blue",
            low: "gray",
          }[severity] || "white";

          console.log(
            `${chalk[color as keyof typeof chalk](
              `[${v.severity}]`
            )} ${v.file}:${v.line}`
          );
          console.log(`  ${v.message}\n`);
        });

        // Send notifications if configured
        const notifier = new NotificationManager();
        await notifier.notify({
          config: fullConfig.notifications,
          scanResult: results,
          repoName: options.repo,
          branch: options.branch || options.diff
        });

        if (manager.hasBlockingViolations(results)) {
          process.exit(1);
        }
      } else {
        console.log(chalk.green("✨ No security violations found!"));
      }
    } catch (error) {
      spinner.fail("Security scan failed");
      if (error instanceof PRAutomatorError) {
        console.error(chalk.red(`\n${error.message}`));
        if (error.cause) {
          console.error(chalk.gray(`\nCause: ${error.cause}`));
        }
      } else {
        console.error(chalk.red("\nAn unexpected error occurred"));
        console.error(chalk.gray(`\n${error}`));
      }
      process.exit(1);
    }
  });

program
  .command("hooks")
  .description("Manage Git hooks")
  .command("install")
  .description("Install Git hooks")
  .option("--no-pre-commit", "Skip pre-commit hook installation")
  .option("--pre-push", "Install pre-push hook")
  .action(async (options) => {
    const spinner = ora("Installing Git hooks...").start();

    try {
      await installHooks(process.cwd(), {
        preCommit: options.preCommit,
        prePush: options.prePush,
      });
      spinner.succeed("Git hooks installed successfully");
    } catch (error) {
      spinner.fail("Failed to install Git hooks");
      if (error instanceof PRAutomatorError) {
        console.error(chalk.red(`\n${error.message}`));
      } else {
        console.error(chalk.red("\nAn unexpected error occurred"));
        console.error(chalk.gray(`\n${error}`));
      }
      process.exit(1);
    }
  });

program
  .command("hooks")
  .command("uninstall")
  .description("Uninstall Git hooks")
  .action(async () => {
    const spinner = ora("Uninstalling Git hooks...").start();

    try {
      await uninstallHooks(process.cwd());
      spinner.succeed("Git hooks uninstalled successfully");
    } catch (error) {
      spinner.fail("Failed to uninstall Git hooks");
      if (error instanceof PRAutomatorError) {
        console.error(chalk.red(`\n${error.message}`));
      } else {
        console.error(chalk.red("\nAn unexpected error occurred"));
        console.error(chalk.gray(`\n${error}`));
      }
      process.exit(1);
    }
  });

// Config commands
program
  .command("config")
  .description("Manage security configuration")
  .command("get <key>")
  .description("Get a configuration value")
  .action(async (key: string) => {
    try {
      const config = await loadConfig();
      const value = key.split(".").reduce((obj: any, k) => obj?.[k], config);
      
      if (value === undefined) {
        console.error(chalk.red(`Configuration key '${key}' not found`));
        process.exit(1);
      }

      if (typeof value === "object") {
        console.log(JSON.stringify(value, null, 2));
      } else {
        console.log(value);
      }
    } catch (error) {
      console.error(chalk.red("Failed to get configuration"));
      console.error(chalk.gray(`\n${error}`));
      process.exit(1);
    }
  });

program
  .command("config")
  .command("set <key> <value>")
  .description("Set a configuration value")
  .action(async (key: string, value: string) => {
    try {
      // Special handling for GitGuardian API key
      if (key === "gitguardian.api_key") {
        await vault.initialize();
        await vault.set(GitGuardianManager.API_KEY_NAME, value);
        console.log(chalk.green("API key stored in vault"));
        return;
      }

      // Handle other configuration values
      const config = await loadConfig();
      const keys = key.split(".");
      const lastKey = keys.pop()!;
      
      // Build the path to the value
      let current = config;
      for (const k of keys) {
        current[k] = current[k] || {};
        current = current[k];
      }

      // Set and validate the value
      try {
        // Parse value based on type
        const parsed = 
          value.toLowerCase() === "true" ? true :
          value.toLowerCase() === "false" ? false :
          !isNaN(Number(value)) ? Number(value) :
          value;
        
        current[lastKey] = parsed;
        
        // Validate entire config
        SecurityConfigSchema.parse(config);
        
        // Save if valid
        await saveConfig(config);
        console.log(chalk.green("Configuration updated successfully"));
      } catch (error) {
        throw new PRAutomatorError("Invalid configuration value", {
          cause: error,
          type: "CONFIG_ERROR"
        });
      }
    } catch (error) {
      console.error(chalk.red("Failed to set configuration"));
      if (error instanceof PRAutomatorError) {
        console.error(chalk.red(`\n${error.message}`));
        if (error.cause) {
          console.error(chalk.gray(`\nCause: ${error.cause}`));
        }
      } else {
        console.error(chalk.gray(`\n${error}`));
      }
      process.exit(1);
    }
  });

program.parse(); 