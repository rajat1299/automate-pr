import { expect, vi } from "vitest";
import { promises as fs } from "fs";
import path from "path";

// Add custom matchers
expect.extend({
  toMatchErrorSnapshot(received: Error, name: string) {
    const { message, ...rest } = received;
    const snapshot = {
      message,
      ...rest
    };
    
    expect(snapshot).toMatchSnapshot(name);
    return { pass: true, message: () => "Error matches snapshot" };
  }
});

// Mock console in tests by default
vi.spyOn(console, "log").mockImplementation(() => {});
vi.spyOn(console, "error").mockImplementation(() => {});
vi.spyOn(console, "warn").mockImplementation(() => {});

// Helper to load test fixtures
export async function loadFixture(name: string): Promise<string> {
  return fs.readFile(
    path.join(__dirname, "__fixtures__", name),
    "utf-8"
  );
}

// Helper to create test repo context
export function createTestContext(overrides = {}) {
  return {
    owner: "test-owner",
    repo: "test-repo",
    branch: "main",
    root: "/test/repo",
    files: [],
    dependencies: {
      production: {},
      development: {}
    },
    framework: "none" as const,
    testFramework: "none" as const,
    packageManager: "npm" as const,
    patterns: {
      fileNaming: [],
      importStyle: "esm" as const
    },
    settings: {
      hasWorkflows: false,
      hasTypeScript: false,
      hasLinter: false,
      hasFormatter: false,
      defaultBranch: "main",
      isMonorepo: false
    },
    ...overrides
  };
} 