import { describe, it, expect } from "vitest";
import { SearchUtils } from "../../src/core/searchUtils.js";
import type { SpotifyTrack, YouTubeSong } from "../../src/types/index.js";

describe("searchUtils.ts", () => {
  describe("getSearchQueryVariants", () => {
    it("should generate query with name and artist", () => {
      const track: SpotifyTrack = {
        uri: "spotify:track:123",
        name: "Tokyo Nightmare",
        album: "Test Album",
        artist: "21 Clown",
        duration: 180000,
      };
      const variants = SearchUtils.getSearchQueryVariants(track);
      expect(variants).toContain("Tokyo Nightmare 21 Clown");
      expect(variants).toContain("Tokyo Nightmare");
      expect(variants).toContain("21 Clown");
    });

    it("should handle empty artist", () => {
      const track: SpotifyTrack = {
        uri: "spotify:track:123",
        name: "Test Song",
        album: "Album",
        artist: "",
        duration: 180000,
      };
      const variants = SearchUtils.getSearchQueryVariants(track);
      expect(variants).toEqual(["Test Song"]);
    });

    it("should handle empty name", () => {
      const track: SpotifyTrack = {
        uri: "spotify:track:123",
        name: "",
        album: "Album",
        artist: "Artist",
        duration: 180000,
      };
      const variants = SearchUtils.getSearchQueryVariants(track);
      expect(variants).toEqual(["Artist"]);
    });

    it("should deduplicate queries", () => {
      const track: SpotifyTrack = {
        uri: "spotify:track:123",
        name: "Song",
        album: "Album",
        artist: "Song",
        duration: 180000,
      };
      const variants = SearchUtils.getSearchQueryVariants(track);
      expect(variants).toHaveLength(2);
    });

    it("should trim leading/trailing whitespace", () => {
      const track: SpotifyTrack = {
        uri: "spotify:track:123",
        name: "  Song  ",
        album: "Album",
        artist: "  Artist  ",
        duration: 180000,
      };
      const variants = SearchUtils.getSearchQueryVariants(track);
      expect(variants).toContain("Song     Artist");
    });
  });

  describe("extractSongsFromResults", () => {
    it("should extract songs from valid search results", () => {
      const searchResults = [
        {
          contents: [
            {
              type: "MusicShelf",
              contents: [
                {
                  id: "abc123",
                  title: "Test Song",
                  duration: { text: "3:30", seconds: 210 },
                  artists: [{ name: "Test Artist" }],
                  album: { name: "Test Album" },
                  thumbnail: {
                    contents: [{ url: "https://example.com/thumb.jpg" }],
                  },
                },
              ],
            },
          ],
        },
      ];
      const songs = SearchUtils.extractSongsFromResults(
        searchResults as unknown[],
      );
      expect(songs).toHaveLength(1);
      expect(songs[0]?.videoId).toBe("abc123");
      expect(songs[0]?.name).toBe("Test Song");
      expect(songs[0]?.artist).toBe("Test Artist");
      expect(songs[0]?.album).toBe("Test Album");
      expect(songs[0]?.duration).toBe(210000);
    });

    it("should return empty array for empty results", () => {
      const songs = SearchUtils.extractSongsFromResults([]);
      expect(songs).toHaveLength(0);
    });

    it("should handle results without contents", () => {
      const searchResults = [{ notContents: true }];
      const songs = SearchUtils.extractSongsFromResults(
        searchResults as unknown[],
      );
      expect(songs).toHaveLength(0);
    });

    it("should handle songs without optional fields", () => {
      const searchResults = [
        {
          contents: [
            {
              type: "MusicShelf",
              contents: [{ id: "xyz", title: "Minimal Song" }],
            },
          ],
        },
      ];
      const songs = SearchUtils.extractSongsFromResults(
        searchResults as unknown[],
      );
      expect(songs).toHaveLength(1);
      expect(songs[0]?.videoId).toBe("xyz");
      expect(songs[0]?.name).toBe("Minimal Song");
      expect(songs[0]?.artist).toBe("Unknown");
    });

    it("should skip items without id and title", () => {
      const searchResults = [
        {
          contents: [
            {
              type: "MusicShelf",
              contents: [{ notIdOrTitle: true }],
            },
          ],
        },
      ];
      const songs = SearchUtils.extractSongsFromResults(
        searchResults as unknown[],
      );
      expect(songs).toHaveLength(0);
    });

    it("should handle multiple songs", () => {
      const searchResults = [
        {
          contents: [
            {
              type: "MusicShelf",
              contents: [
                { id: "1", title: "Song 1", artists: [{ name: "Artist 1" }] },
                { id: "2", title: "Song 2", artists: [{ name: "Artist 2" }] },
                { id: "3", title: "Song 3", artists: [{ name: "Artist 3" }] },
              ],
            },
          ],
        },
      ];
      const songs = SearchUtils.extractSongsFromResults(
        searchResults as unknown[],
      );
      expect(songs).toHaveLength(3);
    });
  });

  describe("getRetryDelayMs", () => {
    it("should calculate exponential backoff", () => {
      const delay = SearchUtils.getRetryDelayMs(0, {}, 1000);
      expect(delay).toBeGreaterThanOrEqual(1000);
      expect(delay).toBeLessThan(1250);
    });

    it("should double delay for each attempt", () => {
      const delay0 = SearchUtils.getRetryDelayMs(0, {}, 1000);
      const delay1 = SearchUtils.getRetryDelayMs(1, {}, 1000);
      const delay2 = SearchUtils.getRetryDelayMs(2, {}, 1000);
      expect(delay1).toBeGreaterThan(delay0);
      expect(delay2).toBeGreaterThan(delay1);
    });

    it("should apply rate limit multiplier", () => {
      const rateLimitError = { status: 429 };
      const normalError = {};
      const rateLimitDelay = SearchUtils.getRetryDelayMs(
        0,
        rateLimitError,
        1000,
      );
      const normalDelay = SearchUtils.getRetryDelayMs(0, normalError, 1000);
      expect(rateLimitDelay).toBeGreaterThan(normalDelay);
    });

    it("should add jitter", () => {
      const delays: number[] = [];
      for (let i = 0; i < 10; i++) {
        delays.push(SearchUtils.getRetryDelayMs(0, {}, 1000));
      }
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
  });

  describe("isRetryableError", () => {
    it("should return true for timeout errors", () => {
      expect(SearchUtils.isRetryableError(new Error("timeout"))).toBe(true);
      expect(SearchUtils.isRetryableError("Request timed out")).toBe(true);
    });

    it("should return true for network errors", () => {
      expect(SearchUtils.isRetryableError(new Error("ECONNRESET"))).toBe(true);
      expect(SearchUtils.isRetryableError("ECONNREFUSED")).toBe(true);
      expect(SearchUtils.isRetryableError("network error")).toBe(true);
    });

    it("should return true for rate limit errors", () => {
      expect(SearchUtils.isRetryableError({ status: 429 })).toBe(true);
    });

    it("should return false for other errors", () => {
      expect(SearchUtils.isRetryableError(new Error("Not found"))).toBe(false);
      expect(SearchUtils.isRetryableError({ status: 404 })).toBe(false);
    });
  });

  describe("isAuthenticationError", () => {
    it("should detect 401 status", () => {
      expect(SearchUtils.isAuthenticationError({ status: 401 })).toBe(true);
      expect(SearchUtils.isAuthenticationError({ statusCode: 401 })).toBe(true);
    });

    it("should detect 403 status", () => {
      expect(SearchUtils.isAuthenticationError({ status: 403 })).toBe(true);
      expect(SearchUtils.isAuthenticationError({ code: 403 })).toBe(true);
    });

    it("should detect auth-related messages", () => {
      expect(SearchUtils.isAuthenticationError("unauthorized")).toBe(true);
      expect(SearchUtils.isAuthenticationError("forbidden")).toBe(true);
    });

    it("should return false for non-auth errors", () => {
      expect(SearchUtils.isAuthenticationError({ status: 500 })).toBe(false);
      expect(SearchUtils.isAuthenticationError("Not found")).toBe(false);
    });

    it("should handle null/undefined", () => {
      expect(SearchUtils.isAuthenticationError(null)).toBe(false);
      expect(SearchUtils.isAuthenticationError(undefined)).toBe(false);
    });
  });

  describe("isRateLimitError", () => {
    it("should detect 429 status", () => {
      expect(SearchUtils.isRateLimitError({ status: 429 })).toBe(true);
      expect(SearchUtils.isRateLimitError({ statusCode: 429 })).toBe(true);
      expect(SearchUtils.isRateLimitError({ code: 429 })).toBe(true);
    });

    it("should detect rate limit messages", () => {
      expect(SearchUtils.isRateLimitError("429 Too Many Requests")).toBe(true);
      expect(SearchUtils.isRateLimitError("too many requests")).toBe(true);
    });

    it("should return false for non-rate-limit errors", () => {
      expect(SearchUtils.isRateLimitError({ status: 404 })).toBe(false);
      expect(SearchUtils.isRateLimitError("Not found")).toBe(false);
    });

    it("should handle null/undefined", () => {
      expect(SearchUtils.isRateLimitError(null)).toBe(false);
      expect(SearchUtils.isRateLimitError(undefined)).toBe(false);
    });
  });

  describe("getErrorMessage", () => {
    it("should extract message from Error", () => {
      expect(SearchUtils.getErrorMessage(new Error("test error"))).toBe(
        "test error",
      );
    });

    it("should return string as-is", () => {
      expect(SearchUtils.getErrorMessage("string error")).toBe("string error");
    });

    it("should extract message from object", () => {
      expect(SearchUtils.getErrorMessage({ message: "object error" })).toBe(
        "object error",
      );
    });

    it("should handle missing message", () => {
      expect(SearchUtils.getErrorMessage({})).toBe("");
    });

    it("should handle null/undefined", () => {
      expect(SearchUtils.getErrorMessage(null)).toBe("");
      expect(SearchUtils.getErrorMessage(undefined)).toBe("");
    });
  });

  describe("sleep", () => {
    it("should resolve after specified time", async () => {
      const start = Date.now();
      await SearchUtils.sleep(100);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(90);
    });
  });
});
