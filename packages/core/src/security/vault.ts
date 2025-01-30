import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { PRAutomatorError } from "../error";

export interface VaultOptions {
  /**
   * The name of the application using the vault
   */
  appName: string;
  /**
   * The directory to store the vault file in
   * @default ~/.config/[appName]
   */
  vaultDir?: string;
}

/**
 * A secure vault for storing sensitive credentials
 */
export class CredentialVault {
  private readonly vaultPath: string;
  private credentials: Record<string, string> = {};

  constructor(options: VaultOptions) {
    const vaultDir = options.vaultDir ?? join(homedir(), ".config", options.appName);
    this.vaultPath = join(vaultDir, "credentials.json");
  }

  /**
   * Initialize the vault by loading existing credentials
   */
  async initialize(): Promise<void> {
    try {
      const data = await readFile(this.vaultPath, "utf-8");
      this.credentials = JSON.parse(data);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        // Vault doesn't exist yet, create empty one
        await this.save();
      } else {
        throw new PRAutomatorError("Failed to initialize credential vault", {
          cause: error,
          type: "VAULT_ERROR"
        });
      }
    }
  }

  /**
   * Get a credential from the vault
   */
  get(key: string): string | undefined {
    return this.credentials[key];
  }

  /**
   * Store a credential in the vault
   */
  async set(key: string, value: string): Promise<void> {
    this.credentials[key] = value;
    await this.save();
  }

  /**
   * Remove a credential from the vault
   */
  async remove(key: string): Promise<void> {
    delete this.credentials[key];
    await this.save();
  }

  /**
   * Save the current state of the vault to disk
   */
  private async save(): Promise<void> {
    try {
      await mkdir(join(this.vaultPath, ".."), { recursive: true });
      await writeFile(this.vaultPath, JSON.stringify(this.credentials, null, 2));
    } catch (error) {
      throw new PRAutomatorError("Failed to save credential vault", {
        cause: error,
        type: "VAULT_ERROR"
      });
    }
  }
} 