import { describe, it, expect, beforeEach, vi } from "vitest";
import { RepoContextCache } from "../../cache/repo-cache";
import { createTestContext } from "../../../vitest.setup";

describe("RepoContextCache", () => {
  let cache: RepoContextCache;

  beforeEach(() => {
    cache = RepoContextCache.getInstance({
      maxSize: 10,
      ttl: 1000
    });
    cache.clear();
  });

  describe("Singleton Pattern", () => {
    it("returns the same instance", () => {
      const instance1 = RepoContextCache.getInstance();
      const instance2 = RepoContextCache.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("Cache Operations", () => {
    const owner = "test-owner";
    const repo = "test-repo";
    const branch = "main";
    const testContext = createTestContext();

    it("stores and retrieves context", async () => {
      await cache.set(owner, repo, branch, testContext);
      const retrieved = await cache.get(owner, repo, branch);
      expect(retrieved).toEqual(testContext);
    });

    it("returns null for non-existent context", async () => {
      const retrieved = await cache.get("unknown", repo, branch);
      expect(retrieved).toBeNull();
    });

    it("invalidates context", async () => {
      await cache.set(owner, repo, branch, testContext);
      await cache.invalidate(owner, repo, branch);
      
      const retrieved = await cache.get(owner, repo, branch);
      expect(retrieved).toBeNull();
    });

    it("clears all cached contexts", async () => {
      await cache.set(owner, repo, branch, testContext);
      await cache.set("other", repo, branch, testContext);
      
      await cache.clear();
      
      const retrieved1 = await cache.get(owner, repo, branch);
      const retrieved2 = await cache.get("other", repo, branch);
      
      expect(retrieved1).toBeNull();
      expect(retrieved2).toBeNull();
    });
  });

  describe("Cache Limits", () => {
    it("respects max size limit", async () => {
      const cache = RepoContextCache.getInstance({
        maxSize: 2,
        ttl: 1000
      });

      const testContext = createTestContext();

      // Add 3 items to a cache with max size 2
      await cache.set("owner1", "repo", "main", testContext);
      await cache.set("owner2", "repo", "main", testContext);
      await cache.set("owner3", "repo", "main", testContext);

      // First item should be evicted
      const retrieved1 = await cache.get("owner1", "repo", "main");
      expect(retrieved1).toBeNull();

      // Later items should still exist
      const retrieved2 = await cache.get("owner2", "repo", "main");
      const retrieved3 = await cache.get("owner3", "repo", "main");
      expect(retrieved2).toEqual(testContext);
      expect(retrieved3).toEqual(testContext);
    });

    it("respects TTL", async () => {
      const cache = RepoContextCache.getInstance({
        maxSize: 10,
        ttl: 50 // 50ms TTL
      });

      const testContext = createTestContext();
      await cache.set("owner", "repo", "main", testContext);

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 100));

      const retrieved = await cache.get("owner", "repo", "main");
      expect(retrieved).toBeNull();
    });
  });

  describe("Cache Statistics", () => {
    it("tracks cache statistics", async () => {
      const testContext = createTestContext();
      
      // Initial stats
      const initialStats = cache.getStats();
      expect(initialStats.size).toBe(0);
      expect(initialStats.hits).toBe(0);
      expect(initialStats.misses).toBe(0);

      // Add an item and retrieve it
      await cache.set("owner", "repo", "main", testContext);
      await cache.get("owner", "repo", "main"); // Hit
      await cache.get("unknown", "repo", "main"); // Miss

      const stats = cache.getStats();
      expect(stats.size).toBe(1);
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });
  });

  describe("Error Handling", () => {
    it("handles set operation errors", async () => {
      const cache = RepoContextCache.getInstance();
      const invalidContext = {} as any;

      await expect(
        cache.set("owner", "repo", "main", invalidContext)
      ).rejects.toThrow("Failed to cache repo context");
    });

    it("handles get operation errors", async () => {
      const cache = RepoContextCache.getInstance();
      vi.spyOn(cache["cache"], "get").mockImplementationOnce(() => {
        throw new Error("Cache error");
      });

      await expect(
        cache.get("owner", "repo", "main")
      ).rejects.toThrow("Failed to retrieve repo context from cache");
    });
  });
}); 