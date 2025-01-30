# Automate PR

An AI-driven pull request automation tool powered by DeepSeek R1, designed to streamline the PR creation process.

## Features

- AI-powered code changes based on natural language prompts
- Automated PR creation and management
- GitHub integration with security best practices
- Modern TypeScript monorepo with Bun runtime
- Comprehensive testing and validation

## Quick Start

```bash
# Install dependencies
bun install

# Start development
bun run dev

# Run tests
bun test
```

## Project Structure

```
.github/
  workflows/      # GitHub Actions workflows
apps/
  cli/           # Main CLI tool
  web/           # Future dashboard
packages/
  core/          # AI/PR logic
  github/        # GitHub API abstraction
  ai/            # DeepSeek R1 integration
  types/         # Shared TS types
  utils/         # Common utilities
docs/            # Documentation
```

## Documentation

- [Architecture Overview](docs/architecture.md)
- [Contributor Guide](docs/contributor-guide.md)

## License

MIT 