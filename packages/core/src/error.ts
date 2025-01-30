export type ErrorType = "user" | "system" | "ai" | "github" | "validation";
export type ErrorSeverity = "info" | "warning" | "error" | "fatal";

export interface ErrorMetadata {
  code?: string;
  severity?: ErrorSeverity;
  source?: string;
  timestamp?: Date;
  [key: string]: unknown;
}

export class PRAutomatorError extends Error {
  public readonly timestamp: Date;

  constructor(
    public readonly type: ErrorType,
    message: string,
    public readonly metadata: ErrorMetadata = {}
  ) {
    super(message);
    this.name = "PRAutomatorError";
    this.timestamp = new Date();
    
    // Ensure stack trace points to the actual error location
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Create a user error (invalid input, permissions, etc.)
   */
  static user(message: string, metadata: Omit<ErrorMetadata, "severity"> = {}) {
    return new PRAutomatorError("user", message, { ...metadata, severity: "error" });
  }

  /**
   * Create a system error (IO, network, etc.)
   */
  static system(message: string, metadata: Omit<ErrorMetadata, "severity"> = {}) {
    return new PRAutomatorError("system", message, { ...metadata, severity: "error" });
  }

  /**
   * Create an AI-related error (model, parsing, etc.)
   */
  static ai(message: string, metadata: Omit<ErrorMetadata, "severity"> = {}) {
    return new PRAutomatorError("ai", message, { ...metadata, severity: "error" });
  }

  /**
   * Create a GitHub API error
   */
  static github(message: string, metadata: Omit<ErrorMetadata, "severity"> = {}) {
    return new PRAutomatorError("github", message, { ...metadata, severity: "error" });
  }

  /**
   * Create a validation error (safety checks, linting, etc.)
   */
  static validation(message: string, metadata: Omit<ErrorMetadata, "severity"> = {}) {
    return new PRAutomatorError("validation", message, { ...metadata, severity: "error" });
  }

  /**
   * Convert error to a structured object for logging/reporting
   */
  toJSON() {
    return {
      type: this.type,
      message: this.message,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
      ...this.metadata
    };
  }

  /**
   * Format error for display to users
   */
  format(): string {
    const parts = [
      `${this.type.toUpperCase()} ERROR: ${this.message}`
    ];

    if (this.metadata.code) {
      parts.push(`Code: ${this.metadata.code}`);
    }

    if (this.metadata.source) {
      parts.push(`Source: ${this.metadata.source}`);
    }

    return parts.join("\n");
  }
} 