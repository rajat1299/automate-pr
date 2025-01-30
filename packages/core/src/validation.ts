import { CodeChange } from "./git";
import { PRAutomatorError } from "./error";

export interface ValidationResult {
  type: "secret" | "license" | "quality" | "security";
  level: "info" | "warning" | "error";
  message: string;
  file?: string;
  line?: number;
  rule?: string;
  suggestion?: string;
}

export interface ValidationOptions {
  skipSecrets?: boolean;
  skipLicenses?: boolean;
  skipLinting?: boolean;
  skipSecurity?: boolean;
  customRules?: ValidationRule[];
}

export interface ValidationRule {
  id: string;
  description: string;
  validate: (change: CodeChange) => Promise<ValidationResult[]>;
}

export class ValidationError extends PRAutomatorError {
  constructor(message: string, results: ValidationResult[]) {
    super("validation", message, { results });
  }
}

const SECRET_PATTERNS = [
  /(?i)(\b(?:key|token|secret|password|credential)\b.*?['"][a-zA-Z0-9+/=]{32,}['"])/,
  /(?i)(?:^|\b)(?:gh|github)(?:_token|_secret)\b.*?['"][a-zA-Z0-9+/=]{36,}['"])/,
  /(?i)(?:^|\b)(?:aws|amazon).*?(?:key|token|secret).*?['"][A-Za-z0-9/+=]{40}['"])/
];

const LICENSE_KEYWORDS = [
  "license",
  "copyright",
  "proprietary",
  "confidential",
  "all rights reserved"
];

export async function validateCodeChanges(
  changes: CodeChange[],
  options: ValidationOptions = {}
): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  
  try {
    // 1. Secret Scanning
    if (!options.skipSecrets) {
      results.push(...await checkForSecrets(changes));
    }
    
    // 2. License Compliance
    if (!options.skipLicenses) {
      results.push(...await checkLicenses(changes));
    }
    
    // 3. Code Quality
    if (!options.skipLinting) {
      results.push(...await runLinter(changes));
    }
    
    // 4. Security Analysis
    if (!options.skipSecurity) {
      results.push(...await runStaticAnalysis(changes));
    }

    // 5. Custom Rules
    if (options.customRules) {
      for (const rule of options.customRules) {
        for (const change of changes) {
          results.push(...await rule.validate(change));
        }
      }
    }

    // Check for blocking issues
    const blockingIssues = results.filter(r => r.level === "error");
    if (blockingIssues.length > 0) {
      throw new ValidationError(
        "Validation failed with blocking issues",
        blockingIssues
      );
    }

    return results;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError("Validation failed", []);
  }
}

async function checkForSecrets(changes: CodeChange[]): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  for (const change of changes) {
    if (!change.content) continue;

    const lines = change.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      for (const pattern of SECRET_PATTERNS) {
        if (pattern.test(line)) {
          results.push({
            type: "secret",
            level: "error",
            message: "Potential secret found in code",
            file: change.path,
            line: i + 1,
            rule: "no-secrets",
            suggestion: "Remove or externalize the secret"
          });
        }
      }
    }
  }

  return results;
}

async function checkLicenses(changes: CodeChange[]): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  for (const change of changes) {
    if (!change.content) continue;

    const content = change.content.toLowerCase();
    for (const keyword of LICENSE_KEYWORDS) {
      if (content.includes(keyword)) {
        results.push({
          type: "license",
          level: "warning",
          message: `Found license-related keyword: ${keyword}`,
          file: change.path,
          rule: "license-check",
          suggestion: "Review license implications"
        });
      }
    }
  }

  return results;
}

async function runLinter(changes: CodeChange[]): Promise<ValidationResult[]> {
  // TODO: Integrate with Biome for actual linting
  return [];
}

async function runStaticAnalysis(changes: CodeChange[]): Promise<ValidationResult[]> {
  // TODO: Integrate with a static analysis tool
  return [];
} 