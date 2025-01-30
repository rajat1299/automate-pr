import { describe, it, expect } from "vitest";
import { ResponseParser } from "../parser";
import { PRAutomatorError } from "@automate-pr/core/error";

describe("ResponseParser", () => {
  describe("parse", () => {
    it("parses valid AI response", () => {
      const response = `Here's the plan for your changes:

\`\`\`json
{
  "files": [
    {
      "path": "src/components/Button.tsx",
      "action": "modify",
      "diff": "@@ -1,4 +1,4 @@\\n-const Button = () => {\\n+const Button = ({ children }) => {\\n"
    }
  ],
  "pr": {
    "title": "fix: improve Button component props",
    "body": "Add support for children prop in Button component",
    "type": "fix",
    "scope": "components",
    "breaking": false
  },
  "reviewers": [
    {
      "username": "ui-team-lead",
      "reason": "UI component expertise",
      "expertise": ["react", "typescript", "design-systems"]
    }
  ],
  "metadata": {
    "confidence": 0.95,
    "reasoning": "Simple prop addition with no breaking changes",
    "suggestedLabels": ["components", "enhancement"],
    "estimatedComplexity": "low"
  }
}
\`\`\``;

      const result = ResponseParser.parse(response);
      expect(result).toMatchSnapshot();
    });

    it("handles missing JSON block", () => {
      const response = "Here's what we should do...";
      
      expect(() => ResponseParser.parse(response)).toThrow(
        new PRAutomatorError("ai", "No JSON found in response")
      );
    });

    it("handles invalid JSON", () => {
      const response = "\`\`\`json\ninvalid json\n\`\`\`";
      
      expect(() => ResponseParser.parse(response)).toThrow(
        new PRAutomatorError("ai", "Failed to parse JSON from AI response")
      );
    });

    it("validates against schema", () => {
      const response = `\`\`\`json
{
  "files": [],
  "pr": {
    "title": "x".repeat(100),
    "body": "test",
    "type": "invalid-type"
  }
}
\`\`\``;
      
      expect(() => ResponseParser.parse(response)).toThrow(
        new PRAutomatorError("ai", "Invalid AI response format")
      );
    });
  });

  describe("parseDiff", () => {
    it("parses unified diff format", () => {
      const diff = `--- a/src/components/Button.tsx
+++ b/src/components/Button.tsx
@@ -1,4 +1,4 @@
-const Button = () => {
+const Button = ({ children }) => {
   return (
-    <button>Click me</button>
+    <button>{children}</button>
   );
};`;

      const result = ResponseParser.parseDiff(diff);
      expect(result).toMatchSnapshot();
      expect(result.additions).toBe(2);
      expect(result.deletions).toBe(2);
      expect(result.files).toContain("src/components/Button.tsx");
    });

    it("handles multiple chunks", () => {
      const diff = `--- a/file.ts
+++ b/file.ts
@@ -1,2 +1,2 @@
-line1
+newline1
@@ -10,2 +10,2 @@
-line2
+newline2`;

      const result = ResponseParser.parseDiff(diff);
      expect(result.chunks).toHaveLength(2);
      expect(result.additions).toBe(2);
      expect(result.deletions).toBe(2);
    });

    it("handles invalid diff format", () => {
      const diff = "invalid diff";
      
      expect(() => ResponseParser.parseDiff(diff)).toThrow(
        new PRAutomatorError("ai", "Failed to parse diff")
      );
    });
  });

  describe("formatCommitMessage", () => {
    it.each([
      {
        type: "feat",
        scope: "ui",
        breaking: false,
        title: "add button component",
        expected: "feat(ui): add button component"
      },
      {
        type: "fix",
        scope: undefined,
        breaking: true,
        title: "change API response format",
        expected: "fix!: change API response format"
      },
      {
        type: "chore",
        scope: "deps",
        breaking: false,
        title: "update dependencies",
        expected: "chore(deps): update dependencies"
      }
    ])("formats $type commit with scope=$scope breaking=$breaking", ({
      type, scope, breaking, title, expected
    }) => {
      const result = ResponseParser.formatCommitMessage(type, scope, breaking, title);
      expect(result).toBe(expected);
    });
  });

  describe("validateChanges", () => {
    const repoFiles = new Set([
      "src/components/Button.tsx",
      "src/utils/index.ts"
    ]);

    it("validates valid changes", () => {
      const changes = [
        {
          path: "src/components/NewComponent.tsx",
          action: "create" as const,
          content: "// New component"
        },
        {
          path: "src/components/Button.tsx",
          action: "modify" as const,
          diff: "@@ -1 +1 @@\n-old\n+new"
        }
      ];

      const result = ResponseParser.validateChanges(changes, repoFiles);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("detects file existence conflicts", () => {
      const changes = [
        {
          path: "src/components/Button.tsx",
          action: "create" as const,
          content: "// Duplicate"
        },
        {
          path: "nonexistent.ts",
          action: "modify" as const,
          diff: "@@ -1 +1 @@\n-old\n+new"
        }
      ];

      const result = ResponseParser.validateChanges(changes, repoFiles);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toContain("already exists");
      expect(result.errors[1]).toContain("does not exist");
    });

    it("validates required fields", () => {
      const changes = [
        {
          path: "new.ts",
          action: "create" as const
        },
        {
          path: "src/components/Button.tsx",
          action: "modify" as const
        },
        {
          path: "src/utils/index.ts",
          action: "rename" as const
        }
      ];

      const result = ResponseParser.validateChanges(changes, repoFiles);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors[0]).toContain("No content provided");
      expect(result.errors[1]).toContain("No diff provided");
      expect(result.errors[2]).toContain("No old path provided");
    });
  });
}); 