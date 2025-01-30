#!/usr/bin/env node
import { Command } from "commander";
import { authCommand } from "./commands/auth";
import { version } from "../package.json";

const program = new Command()
  .name("automate-pr")
  .description("Automate PR creation with AI assistance")
  .version(version);

// Add commands
program.addCommand(authCommand);

// Parse arguments
program.parse(); 