import LRUCache from "lru-cache";
import { RepoContext } from "../types";
import { PRAutomatorError } from "../error";

export interface RepoCacheOptions {
  maxSize?: number;
  ttl?: number;
}

export class RepoContextCache {
  private static instance: RepoContextCache;
  private readonly cache: LRUCache<string, RepoContext>;

  private constructor(options: RepoCacheOptions = {}) {
    this.cache = new LRUCache({
      max: options.maxSize || 100,
      ttl: options.ttl || 60 * 60 * 1000, // 1 hour default TTL
      updateAgeOnGet: true,
      allowStale: false
    });
  }

  static getInstance(options?: RepoCacheOptions): RepoContextCache {
    if (!RepoContextCache.instance) {
      RepoContextCache.instance = new RepoContextCache(options);
    }
    return RepoContextCache.instance;
  }

  /**
   * Generate a unique cache key for a repository
   */
  private getCacheKey(owner: string, repo: string, branch: string): string {
    return `${owner}/${repo}:${branch}`;
  }

  /**
   * Store repository context in cache
   */
  async set(
    owner: string,
    repo: string,
    branch: string,
    context: RepoContext
  ): Promise<void> {
    try {
      const key = this.getCacheKey(owner, repo, branch);
      this.cache.set(key, context);
    } catch (error) {
      throw new PRAutomatorError(
        "system",
        `Failed to cache repo context: ${error.message}`,
        { owner, repo, branch, error }
      );
    }
  }

  /**
   * Retrieve repository context from cache
   */
  async get(
    owner: string,
    repo: string,
    branch: string
  ): Promise<RepoContext | null> {
    try {
      const key = this.getCacheKey(owner, repo, branch);
      return this.cache.get(key) || null;
    } catch (error) {
      throw new PRAutomatorError(
        "system",
        `Failed to retrieve repo context from cache: ${error.message}`,
        { owner, repo, branch, error }
      );
    }
  }

  /**
   * Remove repository context from cache
   */
  async invalidate(owner: string, repo: string, branch: string): Promise<void> {
    try {
      const key = this.getCacheKey(owner, repo, branch);
      this.cache.delete(key);
    } catch (error) {
      throw new PRAutomatorError(
        "system",
        `Failed to invalidate repo context cache: ${error.message}`,
        { owner, repo, branch, error }
      );
    }
  }

  /**
   * Clear entire cache
   */
  async clear(): Promise<void> {
    try {
      this.cache.clear();
    } catch (error) {
      throw new PRAutomatorError(
        "system",
        `Failed to clear repo context cache: ${error.message}`,
        { error }
      );
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.cache.max,
      itemCount: this.cache.size,
      hits: this.cache.hits,
      misses: this.cache.misses
    };
  }
} 