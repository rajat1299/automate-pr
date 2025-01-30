# Contributor Guide

## Getting Started

1. **Prerequisites**
   - Bun 1.1+
   - Git
   - GitHub account

2. **Setup**
   ```bash
   # Clone the repository
   git clone <repository-url>
   cd <repository-name>

   # Install dependencies
   bun install
   ```

3. **Development Workflow**
   ```bash
   # Start development
   bun run dev

   # Run tests
   bun test

   # Type checking
   bun run typecheck

   # Lint
   bun run lint
   ```

## Project Structure

- `.github/`: GitHub Actions workflows
- `apps/`: Applications
  - `cli/`: Command-line interface
  - `web/`: Web dashboard
- `packages/`: Shared packages
  - `core/`: Core PR automation logic
  - `github/`: GitHub API integration
  - `ai/`: AI model integration
  - `types/`: Shared TypeScript types
  - `utils/`: Common utilities

## Contributing Guidelines

1. **Branch Naming**
   - Feature: `feature/description`
   - Fix: `fix/description`
   - Docs: `docs/description`

2. **Commit Messages**
   - Follow conventional commits
   - Example: `feat(cli): add support for custom templates`

3. **Pull Requests**
   - Create PR against `main` branch
   - Fill out PR template
   - Ensure all checks pass
   - Request review from maintainers

4. **Code Style**
   - Follow TypeScript best practices
   - Use Biome for formatting
   - Write tests for new features

## Need Help?

- Check existing issues
- Join our Discord community
- Read the documentation
- Contact maintainers 