# Dependency Updates Recipe

## Overview

This recipe demonstrates how to implement automated dependency updates with security checks and automated PR creation.

## Implementation

### 1. Dependency Scanner

```typescript
// src/scanners/dependencies.ts
import { PackageJson } from "type-fest";
import semver from "semver";

interface DependencyUpdate {
  name: string;
  currentVersion: string;
  latestVersion: string;
  type: "dependencies" | "devDependencies";
  breaking: boolean;
  securityFixes: boolean;
}

async function checkDependencies(
  packageJson: PackageJson
): Promise<DependencyUpdate[]> {
  const updates: DependencyUpdate[] = [];
  
  // Check both dependencies and devDependencies
  for (const type of ["dependencies", "devDependencies"] as const) {
    const deps = packageJson[type] || {};
    
    for (const [name, version] of Object.entries(deps)) {
      const current = semver.clean(version);
      if (!current) continue;
      
      // Get latest version from npm
      const latest = await getLatestVersion(name);
      if (!latest || latest === current) continue;
      
      updates.push({
        name,
        currentVersion: current,
        latestVersion: latest,
        type,
        breaking: semver.major(latest) > semver.major(current),
        securityFixes: await hasSecurityFixes(name, current, latest)
      });
    }
  }
  
  return updates;
}
```

### 2. Security Validation

```typescript
// src/security/validate.ts
import { runVulnerabilityCheck } from "./scanner";

interface SecurityCheck {
  package: string;
  version: string;
  vulnerabilities: Vulnerability[];
}

interface Vulnerability {
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  fixedIn: string;
}

async function validateDependency(
  name: string,
  version: string
): Promise<SecurityCheck> {
  // Run security checks
  const vulnerabilities = await runVulnerabilityCheck(name, version);
  
  return {
    package: name,
    version,
    vulnerabilities
  };
}
```

### 3. Update Strategy

```typescript
// src/updater/strategy.ts
interface UpdateStrategy {
  type: "all" | "security" | "non-breaking";
  schedule: "immediate" | "weekly" | "monthly";
  grouping: "none" | "type" | "breaking";
  maxPRs: number;
}

class DependencyUpdater {
  constructor(private strategy: UpdateStrategy) {}
  
  async planUpdates(
    updates: DependencyUpdate[]
  ): Promise<Map<string, DependencyUpdate[]>> {
    const groups = new Map<string, DependencyUpdate[]>();
    
    // Filter updates based on strategy
    const filtered = updates.filter(update => {
      if (this.strategy.type === "security") {
        return update.securityFixes;
      }
      if (this.strategy.type === "non-breaking") {
        return !update.breaking;
      }
      return true;
    });
    
    // Group updates
    if (this.strategy.grouping === "none") {
      filtered.forEach(update => {
        groups.set(update.name, [update]);
      });
    } else if (this.strategy.grouping === "type") {
      filtered.forEach(update => {
        const key = update.type;
        const group = groups.get(key) || [];
        group.push(update);
        groups.set(key, group);
      });
    } else {
      filtered.forEach(update => {
        const key = update.breaking ? "breaking" : "non-breaking";
        const group = groups.get(key) || [];
        group.push(update);
        groups.set(key, group);
      });
    }
    
    return groups;
  }
}
```

### 4. PR Creation

```typescript
// src/pr/generator.ts
interface UpdatePR {
  title: string;
  body: string;
  branch: string;
  updates: DependencyUpdate[];
}

class PRGenerator {
  async createUpdatePR(
    group: DependencyUpdate[]
  ): Promise<UpdatePR> {
    const breaking = group.some(u => u.breaking);
    const security = group.some(u => u.securityFixes);
    
    // Generate PR title
    const title = this.generateTitle(group, { breaking, security });
    
    // Generate PR body
    const body = this.generateBody(group);
    
    // Create branch
    const branch = await this.createBranch(group);
    
    // Update package.json
    await this.updateDependencies(branch, group);
    
    return { title, body, branch, updates: group };
  }
  
  private generateTitle(
    updates: DependencyUpdate[],
    flags: { breaking: boolean; security: boolean }
  ): string {
    if (updates.length === 1) {
      const update = updates[0];
      return `build(deps): bump ${update.name} from ${update.currentVersion} to ${update.latestVersion}`;
    }
    
    const prefix = flags.security ? "fix" : "build";
    const type = flags.breaking ? "major" : "minor";
    return `${prefix}(deps): ${type} dependency updates`;
  }
  
  private generateBody(updates: DependencyUpdate[]): string {
    let body = "## Dependency Updates\n\n";
    
    // Group by type
    const groups = new Map<string, DependencyUpdate[]>();
    updates.forEach(update => {
      const key = update.breaking ? "Breaking Changes" : 
                 update.securityFixes ? "Security Fixes" :
                 "Updates";
      const group = groups.get(key) || [];
      group.push(update);
      groups.set(key, group);
    });
    
    // Generate sections
    groups.forEach((groupUpdates, title) => {
      body += `### ${title}\n\n`;
      groupUpdates.forEach(update => {
        body += `- \`${update.name}\`: ${update.currentVersion} → ${update.latestVersion}\n`;
      });
      body += "\n";
    });
    
    return body;
  }
}
```

## Usage Example

```typescript
// Example usage
async function updateDependencies() {
  // Load package.json
  const packageJson = await readPackageJson();
  
  // Check for updates
  const updates = await checkDependencies(packageJson);
  
  // Create updater with strategy
  const updater = new DependencyUpdater({
    type: "all",
    schedule: "weekly",
    grouping: "breaking",
    maxPRs: 10
  });
  
  // Plan updates
  const groups = await updater.planUpdates(updates);
  
  // Generate PRs
  const generator = new PRGenerator();
  
  for (const [_, group] of groups) {
    // Validate security
    const checks = await Promise.all(
      group.map(u => validateDependency(u.name, u.latestVersion))
    );
    
    // Skip if vulnerabilities found
    if (checks.some(c => c.vulnerabilities.length > 0)) {
      continue;
    }
    
    // Create PR
    const pr = await generator.createUpdatePR(group);
    
    // Submit PR
    await submitPR(pr);
  }
}
```

## Configuration

### 1. Update Strategy Configuration

```yaml
# .github/dependency-updates.yml
strategy:
  type: all        # all | security | non-breaking
  schedule: weekly # immediate | weekly | monthly
  grouping: type   # none | type | breaking
  maxPRs: 10

security:
  requireApproval: true
  minimumAge: 7    # days
  ignoreScopes:
    - devDependencies

notifications:
  slack: true
  email: true
  teams: false
```

### 2. PR Template

```markdown
# .github/PULL_REQUEST_TEMPLATE/dependency-update.md
## Dependency Updates

### Changes
{{changes}}

### Security
- [ ] Updates include security fixes
- [ ] All dependencies scanned for vulnerabilities
- [ ] No new vulnerabilities introduced

### Testing
- [ ] Automated tests pass
- [ ] Manual testing required
- [ ] Breaking changes identified

### Notes
{{notes}}
```

## Best Practices

1. **Security First**
   - Always run security scans
   - Check for known vulnerabilities
   - Monitor security advisories
   - Maintain allowlist/blocklist

2. **Update Strategy**
   - Group related updates
   - Handle breaking changes separately
   - Consider update frequency
   - Set clear policies

3. **Testing**
   - Automated test suites
   - Integration testing
   - Dependency tree validation
   - Rollback procedures

4. **Monitoring**
   - Track update success rate
   - Monitor build stability
   - Watch for regressions
   - Log all changes

## Troubleshooting

### Common Issues

1. **Failed Updates**
```typescript
try {
  await updateDependency(name, version);
} catch (error) {
  await rollback();
  await notifyFailure(error);
}
```

2. **Version Conflicts**
```typescript
function resolveConflicts(
  updates: DependencyUpdate[]
): DependencyUpdate[] {
  // Implementation
}
```

3. **Breaking Changes**
```typescript
async function detectBreaking(
  update: DependencyUpdate
): Promise<boolean> {
  // Implementation
}
```

## Security Considerations

1. **Vulnerability Scanning**
   - Regular scans
   - Multiple scanners
   - Automated fixes
   - Update policies

2. **Access Control**
   - Limited permissions
   - Review requirements
   - Audit logging
   - Secure storage

3. **Monitoring**
   - Real-time alerts
   - Status reporting
   - Performance impact
   - Rollback triggers 