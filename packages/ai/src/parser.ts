import { AIResponse, AIResponseSchema } from "./schema/response";
import { PRAutomatorError } from "@automate-pr/core/error";

export class ResponseParser {
  /**
   * Extract JSON from markdown-like response
   */
  private static extractJSON(response: string): string {
    const jsonMatch = response.match(/```(?:json)?\n([\s\S]*?)\n```/);
    if (!jsonMatch) {
      throw new PRAutomatorError(
        "ai",
        "No JSON found in response"
      );
    }
    return jsonMatch[1].trim();
  }

  /**
   * Parse and validate AI response
   */
  static parse(response: string): AIResponse {
    try {
      // Extract JSON from response
      const jsonStr = this.extractJSON(response);

      // Parse JSON
      let data: unknown;
      try {
        data = JSON.parse(jsonStr);
      } catch (error) {
        throw new PRAutomatorError(
          "ai",
          "Failed to parse JSON from AI response",
          { error }
        );
      }

      // Validate against schema
      try {
        return AIResponseSchema.parse(data);
      } catch (error) {
        throw new PRAutomatorError(
          "ai",
          "Invalid AI response format",
          { error }
        );
      }
    } catch (error) {
      if (error instanceof PRAutomatorError) {
        throw error;
      }
      throw new PRAutomatorError(
        "ai",
        `Failed to parse AI response: ${error.message}`,
        { error }
      );
    }
  }

  /**
   * Parse unified diff format into structured changes
   */
  static parseDiff(diff: string): {
    chunks: Array<{
      oldStart: number;
      oldLines: number;
      newStart: number;
      newLines: number;
      content: string;
    }>;
    files: string[];
    additions: number;
    deletions: number;
  } {
    const chunks: Array<{
      oldStart: number;
      oldLines: number;
      newStart: number;
      newLines: number;
      content: string;
    }> = [];

    const files = new Set<string>();
    let additions = 0;
    let deletions = 0;

    try {
      // Split diff into chunks
      const diffChunks = diff.split(/(?=^@@)/m);

      for (const chunk of diffChunks) {
        // Skip empty chunks
        if (!chunk.trim()) continue;

        // Parse file names
        if (chunk.startsWith("---")) {
          const fileMatch = chunk.match(/^--- a\/(.*)/m);
          if (fileMatch) {
            files.add(fileMatch[1]);
          }
          continue;
        }

        // Parse chunk header
        const headerMatch = chunk.match(
          /^@@ -(\d+),?(\d+)? \+(\d+),?(\d+)? @@/
        );
        if (!headerMatch) continue;

        const [, oldStart, oldLines, newStart, newLines] = headerMatch;

        // Count changes
        const lines = chunk.split("\n").slice(1);
        for (const line of lines) {
          if (line.startsWith("+")) additions++;
          if (line.startsWith("-")) deletions++;
        }

        chunks.push({
          oldStart: parseInt(oldStart, 10),
          oldLines: oldLines ? parseInt(oldLines, 10) : 1,
          newStart: parseInt(newStart, 10),
          newLines: newLines ? parseInt(newLines, 10) : 1,
          content: chunk
        });
      }

      return {
        chunks,
        files: Array.from(files),
        additions,
        deletions
      };
    } catch (error) {
      throw new PRAutomatorError(
        "ai",
        `Failed to parse diff: ${error.message}`,
        { error, diff }
      );
    }
  }

  /**
   * Format PR title into conventional commit format
   */
  static formatCommitMessage(
    type: string,
    scope: string | undefined,
    breaking: boolean,
    title: string
  ): string {
    const parts = [type];
    
    if (scope) {
      parts.push(`(${scope})`);
    }
    
    if (breaking) {
      parts.push("!");
    }
    
    parts.push(": ", title);
    
    return parts.join("");
  }

  /**
   * Validate file changes against repository structure
   */
  static validateChanges(
    changes: AIResponse["files"],
    repoFiles: Set<string>
  ): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    for (const change of changes) {
      switch (change.action) {
        case "create":
          if (repoFiles.has(change.path)) {
            errors.push(
              `File ${change.path} already exists but marked for creation`
            );
          }
          if (!change.content) {
            errors.push(
              `No content provided for new file ${change.path}`
            );
          }
          break;

        case "modify":
        case "delete":
          if (!repoFiles.has(change.path)) {
            errors.push(
              `File ${change.path} does not exist but marked for ${change.action}`
            );
          }
          if (change.action === "modify" && !change.diff) {
            errors.push(
              `No diff provided for modified file ${change.path}`
            );
          }
          break;

        case "rename":
          if (!repoFiles.has(change.path)) {
            errors.push(
              `File ${change.path} does not exist but marked for rename`
            );
          }
          if (!change.oldPath) {
            errors.push(
              `No old path provided for renamed file ${change.path}`
            );
          }
          break;
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
} 