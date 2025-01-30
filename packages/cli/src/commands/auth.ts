import { Command } from "commander";
import { GitHubDeviceFlow } from "@automate-pr/core/auth";
import { PRAutomatorError } from "@automate-pr/core/error";
import { CredentialVault } from "@automate-pr/core/security";
import ora from "ora";
import chalk from "chalk";
import { loadConfig } from "../config";

export const authCommand = new Command("auth")
  .description("Manage GitHub authentication")
  .addCommand(
    new Command("login")
      .description("Login to GitHub using device flow")
      .option("--scopes <scopes>", "Comma-separated list of OAuth scopes", "repo,workflow,write:packages")
      .action(async (options) => {
        const spinner = ora("Initializing GitHub authentication...").start();
        
        try {
          const config = await loadConfig();
          if (!config.github?.clientId) {
            throw new PRAutomatorError(
              "GitHub client ID not found in config",
              { type: "CONFIG_ERROR" }
            );
          }

          const vault = new CredentialVault({ appName: "automate-pr" });
          const flow = new GitHubDeviceFlow(vault, {
            clientId: config.github.clientId,
            scopes: options.scopes.split(","),
          });

          // Start device flow
          spinner.text = "Getting device code...";
          const { verification_uri, user_code } = await flow.initiate();

          // Show user instructions
          spinner.stop();
          console.log("\n🔐 Complete authentication in your browser:");
          console.log(`\n1. Visit: ${chalk.cyan(verification_uri)}`);
          console.log(`2. Enter code: ${chalk.green(user_code)}\n`);

          // Start polling
          spinner.start("Waiting for authentication...");
          await flow.poll();

          // Verify token works
          spinner.text = "Verifying authentication...";
          await flow.executeRequest(async (token) => {
            const response = await fetch("https://api.github.com/user", {
              headers: {
                "Authorization": `Bearer ${token}`,
                "Accept": "application/json"
              }
            });
            
            if (!response.ok) {
              throw new Error("Failed to verify token");
            }
            
            const user = await response.json();
            return user.login;
          });

          spinner.succeed(`Successfully logged in to GitHub as ${chalk.green(await flow.getToken())}`);
        } catch (error) {
          spinner.fail(error.message);
          if (error instanceof PRAutomatorError) {
            console.error(chalk.red("\nDetails:"), error.cause?.message || "Unknown error");
          }
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command("logout")
      .description("Logout from GitHub")
      .action(async () => {
        const spinner = ora("Logging out from GitHub...").start();
        
        try {
          const config = await loadConfig();
          if (!config.github?.clientId) {
            throw new PRAutomatorError(
              "GitHub client ID not found in config",
              { type: "CONFIG_ERROR" }
            );
          }

          const vault = new CredentialVault({ appName: "automate-pr" });
          const flow = new GitHubDeviceFlow(vault, {
            clientId: config.github.clientId
          });

          await flow.revoke();
          spinner.succeed("Successfully logged out from GitHub");
        } catch (error) {
          spinner.fail(error.message);
          if (error instanceof PRAutomatorError) {
            console.error(chalk.red("\nDetails:"), error.cause?.message || "Unknown error");
          }
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command("status")
      .description("Check authentication status")
      .action(async () => {
        const spinner = ora("Checking authentication status...").start();
        
        try {
          const config = await loadConfig();
          if (!config.github?.clientId) {
            throw new PRAutomatorError(
              "GitHub client ID not found in config",
              { type: "CONFIG_ERROR" }
            );
          }

          const vault = new CredentialVault({ appName: "automate-pr" });
          const flow = new GitHubDeviceFlow(vault, {
            clientId: config.github.clientId
          });

          try {
            const username = await flow.executeRequest(async (token) => {
              const response = await fetch("https://api.github.com/user", {
                headers: {
                  "Authorization": `Bearer ${token}`,
                  "Accept": "application/json"
                }
              });
              
              if (!response.ok) {
                throw new Error("Failed to verify token");
              }
              
              const user = await response.json();
              return user.login;
            });
            
            spinner.succeed(`Authenticated with GitHub as ${chalk.green(username)}`);
          } catch (error) {
            spinner.info("Not authenticated with GitHub");
          }
        } catch (error) {
          spinner.fail(error.message);
          if (error instanceof PRAutomatorError) {
            console.error(chalk.red("\nDetails:"), error.cause?.message || "Unknown error");
          }
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command("token")
      .description("Show current access token")
      .action(async () => {
        const spinner = ora("Retrieving access token...").start();
        
        try {
          const config = await loadConfig();
          if (!config.github?.clientId) {
            throw new PRAutomatorError(
              "GitHub client ID not found in config",
              { type: "CONFIG_ERROR" }
            );
          }

          const vault = new CredentialVault({ appName: "automate-pr" });
          const flow = new GitHubDeviceFlow(vault, {
            clientId: config.github.clientId
          });

          try {
            const token = await flow.getToken();
            spinner.stop();
            console.log(token);
          } catch (error) {
            spinner.info("No valid token found");
          }
        } catch (error) {
          spinner.fail(error.message);
          if (error instanceof PRAutomatorError) {
            console.error(chalk.red("\nDetails:"), error.cause?.message || "Unknown error");
          }
          process.exit(1);
        }
      })
  ); 