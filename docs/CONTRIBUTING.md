# Contributing Guide

## Getting Started

### Prerequisites
- Node.js 18+
- Git
- GitHub account with 2FA enabled
- GitGuardian account (for security scanning)

### Development Setup
```bash
# Clone the repository
git clone https://github.com/yourusername/automate-pr.git
cd automate-pr

# Install dependencies
npm install

# Setup development environment
npm run setup

# Build all packages
npm run build

# Run tests
npm test
```

## Project Structure
```
automate-pr/
├── apps/
│   ├── cli/          # Command-line interface
│   └── web/          # Future web dashboard
├── packages/
│   ├── core/         # Core functionality
│   ├── security/     # Security features
│   ├── github/       # GitHub integration
│   └── types/        # Shared types
├── docs/             # Documentation
└── scripts/          # Development scripts
```

## Development Workflow

### 1. Branch Naming
```
feature/   # New features
fix/       # Bug fixes
docs/      # Documentation changes
refactor/  # Code refactoring
test/      # Test improvements
```

### 2. Commit Messages
```
feat: Add new authentication command
fix: Resolve token refresh issue
docs: Update security documentation
test: Add token manager tests
refactor: Improve error handling
```

### 3. Pull Request Process
1. Create feature branch
2. Make changes
3. Run tests and linting
4. Create pull request
5. Address review feedback
6. Merge after approval

## Testing Guidelines

### 1. Unit Tests
```typescript
describe("TokenManager", () => {
  it("should refresh expired tokens", async () => {
    // Test implementation
  });
});
```

### 2. Integration Tests
```typescript
describe("GitHub Authentication", () => {
  it("should complete device flow", async () => {
    // Test implementation
  });
});
```

### 3. E2E Tests
```typescript
describe("CLI Commands", () => {
  it("should login successfully", async () => {
    // Test implementation
  });
});
```

## Code Style Guide

### 1. TypeScript Guidelines
```typescript
// Use explicit types
function authenticate(options: AuthOptions): Promise<void>

// Use interfaces for complex types
interface AuthOptions {
  clientId: string;
  scopes: string[];
}

// Use enums for constants
enum AuthStatus {
  SUCCESS = "success",
  FAILED = "failed"
}
```

### 2. Error Handling
```typescript
try {
  await tokenManager.refresh();
} catch (error) {
  if (error instanceof TokenError) {
    // Handle specific error
  } else {
    // Handle unknown error
  }
}
```

### 3. Async/Await
```typescript
// Prefer async/await over promises
async function handleAuth() {
  const token = await getToken();
  await validateToken(token);
}
```

## Documentation Guidelines

### 1. Code Comments
```typescript
/**
 * Manages GitHub access tokens with automatic refresh
 * and rate limiting support.
 */
class TokenManager {
  /**
   * Refreshes the access token if it's expired or about to expire
   * @throws {TokenError} If refresh fails
   */
  async refresh(): Promise<void>
}
```

### 2. README Files
- Project overview
- Setup instructions
- Usage examples
- Configuration options
- Troubleshooting

### 3. API Documentation
```typescript
/**
 * @api {post} /auth/token Refresh access token
 * @apiName RefreshToken
 * @apiGroup Auth
 * @apiParam {String} refresh_token Refresh token
 * @apiSuccess {String} access_token New access token
 */
```

## Security Guidelines

### 1. Code Security
- No hardcoded secrets
- Input validation
- Output encoding
- Safe dependencies

### 2. Authentication
- Token encryption
- Secure storage
- Rate limiting
- Error handling

### 3. Testing
- Security test cases
- Vulnerability scanning
- Dependency audits
- Code reviews

## Release Process

### 1. Version Bump
```bash
npm version patch # For bug fixes
npm version minor # For new features
npm version major # For breaking changes
```

### 2. Changelog
```markdown
## [1.1.0] - 2024-03-20
### Added
- New authentication commands
- Token refresh functionality

### Fixed
- Rate limiting issues
- Token storage bug
```

### 3. Release Steps
1. Update version
2. Update changelog
3. Run tests
4. Build packages
5. Create release
6. Publish packages

## Support

### 1. Issue Reporting
- Bug description
- Reproduction steps
- Expected behavior
- System information

### 2. Feature Requests
- Use case description
- Proposed solution
- Alternative approaches
- Implementation considerations

### 3. Questions
- Check existing documentation
- Search closed issues
- Ask in discussions
- Provide context

## Code of Conduct

### 1. Standards
- Respectful communication
- Constructive feedback
- Inclusive environment
- Professional conduct

### 2. Responsibilities
- Maintain code quality
- Review contributions
- Address issues
- Support community

### 3. Enforcement
- Warning system
- Temporary bans
- Permanent bans
- Appeal process 