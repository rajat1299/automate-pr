import { RepoContext, Framework, TestFramework, PackageManager } from "@automate-pr/types";
import { promises as fs } from "fs";
import path from "path";
import { PRAutomatorError } from "./error";

export class RepoAnalyzer {
  constructor(private readonly repoPath: string) {}

  async analyze(): Promise<Omit<RepoContext, "owner" | "repo" | "branch">> {
    try {
      const packageJson = await this.readPackageJson();
      const files = await this.scanFiles();
      
      return {
        root: this.repoPath,
        files,
        dependencies: this.analyzeDependencies(packageJson),
        framework: this.detectFramework(packageJson),
        testFramework: this.detectTestFramework(packageJson),
        packageManager: this.detectPackageManager(),
        patterns: await this.analyzePatterns(files),
        settings: await this.analyzeSettings(files, packageJson)
      };
    } catch (error) {
      throw new PRAutomatorError(
        "system",
        `Failed to analyze repository: ${error.message}`,
        { error }
      );
    }
  }

  private async readPackageJson(): Promise<any> {
    try {
      const content = await fs.readFile(
        path.join(this.repoPath, "package.json"),
        "utf-8"
      );
      return JSON.parse(content);
    } catch {
      throw new PRAutomatorError(
        "system",
        "Could not find or parse package.json"
      );
    }
  }

  private async scanFiles(): Promise<RepoContext["files"]> {
    const files: RepoContext["files"] = [];
    const ignoredDirs = new Set([
      "node_modules",
      ".git",
      "dist",
      "build",
      "coverage"
    ]);

    async function scan(dir: string): Promise<void> {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          if (!ignoredDirs.has(entry.name)) {
            files.push({
              path: fullPath,
              content: "",
              size: 0,
              type: "directory"
            });
            await scan(fullPath);
          }
        } else {
          const stat = await fs.stat(fullPath);
          if (stat.size < 1024 * 1024) { // Skip files larger than 1MB
            const content = await fs.readFile(fullPath, "utf-8");
            files.push({
              path: fullPath,
              content,
              size: stat.size,
              type: "file"
            });
          }
        }
      }
    }

    await scan(this.repoPath);
    return files;
  }

  private analyzeDependencies(packageJson: any): RepoContext["dependencies"] {
    return {
      production: packageJson.dependencies || {},
      development: packageJson.devDependencies || {},
      peer: packageJson.peerDependencies
    };
  }

  private detectFramework(packageJson: any): Framework {
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    if (deps["react"]) return "react";
    if (deps["vue"]) return "vue";
    if (deps["@angular/core"]) return "angular";
    if (deps["svelte"]) return "svelte";
    if (deps["express"]) return "express";
    if (deps["@nestjs/core"]) return "nest";
    if (deps["next"]) return "next";
    if (deps["nuxt"]) return "nuxt";
    
    return "none";
  }

  private detectTestFramework(packageJson: any): TestFramework {
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    if (deps["jest"]) return "jest";
    if (deps["vitest"]) return "vitest";
    if (deps["mocha"]) return "mocha";
    if (deps["ava"]) return "ava";
    if (deps["tap"]) return "tap";
    
    return "none";
  }

  private detectPackageManager(): PackageManager {
    if (fs.existsSync(path.join(this.repoPath, "bun.lockb"))) return "bun";
    if (fs.existsSync(path.join(this.repoPath, "pnpm-lock.yaml"))) return "pnpm";
    if (fs.existsSync(path.join(this.repoPath, "yarn.lock"))) return "yarn";
    return "npm";
  }

  private async analyzePatterns(
    files: RepoContext["files"]
  ): Promise<RepoContext["patterns"]> {
    const fileNames = files.map(f => path.basename(f.path));
    const componentFiles = files.filter(f => 
      /\.(tsx?|jsx?)$/.test(f.path) && 
      f.content.includes("export")
    );

    // Detect component style
    let hasClassComponents = false;
    let hasFunctionComponents = false;
    
    for (const file of componentFiles) {
      if (file.content.includes("extends React.Component")) {
        hasClassComponents = true;
      }
      if (file.content.includes("function") && file.content.includes("return")) {
        hasFunctionComponents = true;
      }
    }

    const componentStyle = hasClassComponents && hasFunctionComponents
      ? "mixed"
      : hasClassComponents
      ? "class"
      : "function";

    // Detect import style
    const hasESM = files.some(f => f.content.includes("import "));
    const hasCJS = files.some(f => f.content.includes("require("));
    const importStyle = hasESM && hasCJS ? "mixed" : hasESM ? "esm" : "commonjs";

    // Find test pattern
    const testFiles = files.filter(f => /\.(test|spec)\.(ts|js)x?$/.test(f.path));
    const testPattern = testFiles.length > 0
      ? path.basename(testFiles[0].path).replace(/^.*?(?=\.(test|spec))/, "*")
      : undefined;

    return {
      fileNaming: Array.from(new Set(fileNames)),
      componentStyle,
      testPattern,
      importStyle
    };
  }

  private async analyzeSettings(
    files: RepoContext["files"],
    packageJson: any
  ): Promise<RepoContext["settings"]> {
    return {
      hasWorkflows: files.some(f => f.path.includes(".github/workflows")),
      hasTypeScript: files.some(f => f.path.endsWith(".ts") || f.path.endsWith(".tsx")),
      hasLinter: !!(packageJson.devDependencies?.eslint || packageJson.devDependencies?.["@biomejs/biome"]),
      hasFormatter: !!(packageJson.devDependencies?.prettier || packageJson.devDependencies?.["@biomejs/biome"]),
      defaultBranch: "main", // TODO: Get from git
      isMonorepo: !!packageJson.workspaces
    };
  }
} 