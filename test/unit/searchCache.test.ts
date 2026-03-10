import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SearchCache } from "../../src/utils/searchCache.js";

describe("searchCache.ts", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "yt-cache-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("constructor", () => {
    it("should initialize database", () => {
      const cachePath = join(tempDir, "cache.sqlite");
      const cache = new SearchCache(cachePath);
      expect(cache).toBeDefined();
    });
  });

  describe("set", () => {
    it("should set cache without error", () => {
      const cachePath = join(tempDir, "cache1.sqlite");
      const cache = new SearchCache(cachePath);

      expect(() => {
        cache.set("test query", [
          { videoId: "abc123", name: "Test Song", artist: "Test Artist" },
        ]);
      }).not.toThrow();
    });

    it("should handle empty query gracefully", () => {
      const cachePath = join(tempDir, "cache2.sqlite");
      const cache = new SearchCache(cachePath);

      expect(() => {
        cache.set("", [{ videoId: "abc", name: "Test", artist: "Test" }]);
      }).not.toThrow();
    });

    it("should update existing cache", () => {
      const cachePath = join(tempDir, "cache3.sqlite");
      const cache = new SearchCache(cachePath);

      cache.set("same-query", [
        { videoId: "id1", name: "Song 1", artist: "Artist 1" },
      ]);
      expect(() => {
        cache.set("same-query", [
          { videoId: "id2", name: "Song 2", artist: "Artist 2" },
        ]);
      }).not.toThrow();
    });
  });

  describe("get", () => {
    it("should return null for empty query", () => {
      const cachePath = join(tempDir, "cache4.sqlite");
      const cache = new SearchCache(cachePath);

      expect(cache.get("")).toBeNull();
    });

    it("should return null for non-existent query", () => {
      const cachePath = join(tempDir, "cache5.sqlite");
      const cache = new SearchCache(cachePath);

      expect(cache.get("non-existent-query")).toBeNull();
    });
  });

  describe("cleanupExpiredCaches", () => {
    it("should not throw when called on empty cache", () => {
      const cachePath = join(tempDir, "cache6.sqlite");
      const cache = new SearchCache(cachePath);

      expect(() => {
        cache.cleanupExpiredCaches();
      }).not.toThrow();
    });

    it("should return number", () => {
      const cachePath = join(tempDir, "cache7.sqlite");
      const cache = new SearchCache(cachePath);

      const result = cache.cleanupExpiredCaches();
      expect(typeof result).toBe("number");
    });
  });
});
