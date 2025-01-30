import { describe, it, expect } from "vitest";
import { validateAIResponse, AIResponseSchema } from "../../parser/schema";
import { PRAutomatorError } from "../../error";

describe("AI Response Schema Validation", () => {
  const validResponse = {
    files: [
      {
        path: "src/utils/helper.ts",
        diff: "diff --git a/src/utils/helper.ts b/src/utils/helper.ts\n@@ -1,3 +1,4 @@\n+export const newFunction = () => {};",
        mode: "modify"
      }
    ],
    metadata: {
      title: "Add new utility function",
      description: "This PR adds a new utility function to help with data processing",
      branch: "feature/new-utility"
    }
  };

  describe("validateAIResponse", () => {
    it("should validate a correct response", () => {
      expect(() => validateAIResponse(validResponse)).not.toThrow();
    });

    it("should handle optional fields", () => {
      const response = {
        ...validResponse,
        reasoning: "Added this function to improve code reusability",
        metadata: {
          ...validResponse.metadata,
          labels: ["enhancement"],
          assignees: ["user1"],
          reviewers: ["user2"]
        }
      };

      expect(() => validateAIResponse(response)).not.toThrow();
    });

    it("should reject invalid file paths", () => {
      const response = {
        ...validResponse,
        files: [
          {
            ...validResponse.files[0],
            path: "../src/utils/helper.ts" // Path traversal attempt
          }
        ]
      };

      expect(() => validateAIResponse(response)).toThrow(PRAutomatorError);
    });

    it("should reject invalid diff format", () => {
      const response = {
        ...validResponse,
        files: [
          {
            ...validResponse.files[0],
            diff: "not a valid diff"
          }
        ]
      };

      expect(() => validateAIResponse(response)).toThrow(PRAutomatorError);
    });

    it("should reject invalid PR title", () => {
      const response = {
        ...validResponse,
        metadata: {
          ...validResponse.metadata,
          title: "a" // Too short
        }
      };

      expect(() => validateAIResponse(response)).toThrow(PRAutomatorError);
    });

    it("should reject invalid branch names", () => {
      const response = {
        ...validResponse,
        metadata: {
          ...validResponse.metadata,
          branch: "feature/new utility" // Contains space
        }
      };

      expect(() => validateAIResponse(response)).toThrow(PRAutomatorError);
    });
  });

  describe("Recovery Handling", () => {
    it("should recover from missing diff headers", () => {
      const response = {
        ...validResponse,
        files: [
          {
            ...validResponse.files[0],
            diff: "export const newFunction = () => {};"
          }
        ]
      };

      const result = validateAIResponse(response);
      expect(result.files[0].diff).toContain("diff --git");
      expect(result.files[0].diff).toContain("@@");
    });

    it("should handle string coercion for numeric values", () => {
      const response = {
        files: [
          {
            path: "test.ts",
            diff: validResponse.files[0].diff,
            mode: 1 // Should be coerced to string
          }
        ],
        metadata: {
          title: "Test PR",
          description: "Test description that meets minimum length requirement"
        }
      };

      expect(() => validateAIResponse(response)).not.toThrow();
    });

    it("should handle missing optional fields", () => {
      const response = {
        files: validResponse.files,
        metadata: {
          title: "Test PR Title Here",
          description: "This is a test description that meets the minimum length requirement"
        }
      };

      const result = validateAIResponse(response);
      expect(result.metadata.branch).toBeUndefined();
      expect(result.metadata.labels).toBeUndefined();
      expect(result.reasoning).toBeUndefined();
    });

    it("should reject completely invalid input", () => {
      expect(() => validateAIResponse("not an object")).toThrow(PRAutomatorError);
      expect(() => validateAIResponse(null)).toThrow(PRAutomatorError);
      expect(() => validateAIResponse(undefined)).toThrow(PRAutomatorError);
    });

    it("should enforce maximum limits", () => {
      const response = {
        ...validResponse,
        files: Array(25).fill(validResponse.files[0]), // Exceeds max files
        metadata: {
          ...validResponse.metadata,
          description: "a".repeat(5000) // Exceeds max length
        }
      };

      expect(() => validateAIResponse(response)).toThrow(PRAutomatorError);
    });
  });
}); 