import { describe, it, expect, beforeEach, vi } from "vitest";
import { RepoAnalyzer } from "../repo-analyzer";
import { promises as fs } from "fs";
import path from "path";

// Mock filesystem
vi.mock("fs", () => ({
  promises: {
    readFile: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
    existsSync: vi.fn()
  }
}));

describe("RepoAnalyzer", () => {
  let analyzer: RepoAnalyzer;
  
  beforeEach(() => {
    analyzer = new RepoAnalyzer("/test/repo");
    vi.resetAllMocks();
  });

  describe("Framework Detection", () => {
    it("detects React projects", async () => {
      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify({
        dependencies: {
          "react": "^18.0.0",
          "react-dom": "^18.0.0"
        }
      }));

      const result = await analyzer.analyze();
      expect(result.framework).toBe("react");
    });

    it("detects Next.js projects", async () => {
      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify({
        dependencies: {
          "next": "^14.0.0",
          "react": "^18.0.0"
        }
      }));

      const result = await analyzer.analyze();
      expect(result.framework).toBe("next");
    });
  });

  describe("Test Framework Detection", () => {
    it("detects Vitest", async () => {
      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify({
        devDependencies: {
          "vitest": "^1.0.0"
        }
      }));

      const result = await analyzer.analyze();
      expect(result.testFramework).toBe("vitest");
    });
  });

  describe("Package Manager Detection", () => {
    it("detects Bun", async () => {
      vi.mocked(fs.existsSync).mockImplementation((path: string) => 
        path.includes("bun.lockb")
      );

      const result = await analyzer.analyze();
      expect(result.packageManager).toBe("bun");
    });
  });

  describe("Pattern Analysis", () => {
    beforeEach(() => {
      // Mock file system for pattern analysis
      vi.mocked(fs.readdir).mockResolvedValue([
        { name: "App.tsx", isDirectory: () => false },
        { name: "components", isDirectory: () => true }
      ] as any[]);

      vi.mocked(fs.stat).mockResolvedValue({
        size: 1000,
        isDirectory: () => false
      } as any);
    });

    it("detects component styles", async () => {
      vi.mocked(fs.readFile).mockImplementationOnce(() => 
        Promise.resolve(JSON.stringify({ dependencies: {} }))
      );

      vi.mocked(fs.readFile).mockImplementationOnce(() => 
        Promise.resolve(`
          class UserProfile extends React.Component {
            render() {
              return <div>Profile</div>;
            }
          }
        `)
      );

      const result = await analyzer.analyze();
      expect(result.patterns.componentStyle).toBe("class");
    });

    it("detects import styles", async () => {
      vi.mocked(fs.readFile).mockImplementationOnce(() => 
        Promise.resolve(JSON.stringify({ dependencies: {} }))
      );

      vi.mocked(fs.readFile).mockImplementationOnce(() => 
        Promise.resolve(`
          import React from 'react';
          import { useState } from 'react';
        `)
      );

      const result = await analyzer.analyze();
      expect(result.patterns.importStyle).toBe("esm");
    });
  });

  describe("Settings Detection", () => {
    it("detects TypeScript usage", async () => {
      vi.mocked(fs.readFile).mockImplementationOnce(() => 
        Promise.resolve(JSON.stringify({
          devDependencies: {
            "typescript": "^5.0.0"
          }
        }))
      );

      vi.mocked(fs.readdir).mockResolvedValue([
        { name: "index.ts", isDirectory: () => false }
      ] as any[]);

      const result = await analyzer.analyze();
      expect(result.settings.hasTypeScript).toBe(true);
    });

    it("detects monorepo setup", async () => {
      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify({
        workspaces: ["packages/*"]
      }));

      const result = await analyzer.analyze();
      expect(result.settings.isMonorepo).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("handles missing package.json", async () => {
      vi.mocked(fs.readFile).mockRejectedValueOnce(new Error("ENOENT"));

      await expect(analyzer.analyze()).rejects.toThrow("Could not find or parse package.json");
    });

    it("handles invalid package.json", async () => {
      vi.mocked(fs.readFile).mockResolvedValueOnce("invalid json");

      await expect(analyzer.analyze()).rejects.toThrow("Could not find or parse package.json");
    });
  });
}); 