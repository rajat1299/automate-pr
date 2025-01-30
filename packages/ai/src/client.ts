import { RepoContext, PRPlan } from "@automate-pr/types";
import fetch from "node-fetch";

export interface DeepSeekOptions {
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

export class DeepSeekError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly response?: any
  ) {
    super(message);
    this.name = "DeepSeekError";
  }
}

export class DeepSeekClient {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  
  constructor(
    private readonly apiKey: string,
    options: DeepSeekOptions = {}
  ) {
    this.baseUrl = options.baseUrl || "https://api.deepseek.com/v1";
    this.timeout = options.timeout || 30000;
    this.maxRetries = options.maxRetries || 3;
  }

  async generatePRPlan(prompt: string, context: RepoContext): Promise<PRPlan> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.apiKey}`,
            "User-Agent": "AutomatePR/1.0"
          },
          body: JSON.stringify({
            model: "deepseek-r1",
            messages: [{
              role: "system",
              content: this.buildSystemPrompt(context)
            }, {
              role: "user",
              content: prompt
            }],
            temperature: 0.2,
            stream: false,
            max_tokens: 4000
          }),
          timeout: this.timeout
        });

        if (!response.ok) {
          throw new DeepSeekError(
            `API request failed with status ${response.status}`,
            response.status,
            await response.json()
          );
        }

        const data = await response.json();
        return this.parseResponse(data);
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on authentication errors
        if (error instanceof DeepSeekError && error.status === 401) {
          throw error;
        }

        // Last attempt failed
        if (attempt === this.maxRetries) {
          throw new DeepSeekError(
            `Failed to generate PR plan after ${this.maxRetries} attempts: ${lastError.message}`,
            undefined,
            lastError
          );
        }

        // Wait before retrying (exponential backoff)
        await new Promise(resolve => 
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        );
      }
    }

    // TypeScript type guard
    throw new Error("Unreachable");
  }

  private buildSystemPrompt(context: RepoContext): string {
    return `You are a senior software engineer tasked with generating a pull request plan.
Repository Context:
- Owner: ${context.owner}
- Repository: ${context.repo}
- Branch: ${context.branch}
- Files: ${context.files.length} files provided

Your task is to analyze the context and generate a detailed pull request plan that includes:
1. List of files to modify or create
2. Exact code changes in unified diff format
3. PR title and description following conventional commits
4. Suggested reviewers based on file ownership

Please ensure:
- All code changes are valid and follow the project's style
- Changes are atomic and focused
- Description explains the what and why
- Security-sensitive code is highlighted for review`;
  }

  private parseResponse(data: any): PRPlan {
    try {
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("Invalid API response format");
      }

      // TODO: Implement proper parsing of the AI response into PRPlan format
      // For now, return a mock plan
      return {
        files: [],
        pr: {
          title: "chore: placeholder PR",
          description: "TODO: Parse AI response",
          reviewers: []
        }
      };
    } catch (error) {
      throw new DeepSeekError(
        `Failed to parse API response: ${error.message}`,
        undefined,
        data
      );
    }
  }
} 