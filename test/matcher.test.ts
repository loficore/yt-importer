import { describe, it, expect } from "vitest";
import {
  normalizeString,
  durationMatch,
  nameSimilarity,
  artistMatch,
  calculateConfidence,
  matchTrackToResults,
  filterByConfidence,
} from "../src/core/matcher.js";
import type { SpotifyTrack, YouTubeSong } from "../src/types/index.js";

describe("matcher.ts", () => {
  describe("normalizeString", () => {
    it("should convert to lowercase", () => {
      expect(normalizeString("HELLO")).toBe("hello");
    });

    it("should remove special characters", () => {
      expect(normalizeString("Hello!@#$World")).toBe("hello world");
    });

    it("should collapse multiple spaces", () => {
      expect(normalizeString("hello    world")).toBe("hello world");
    });

    it("should trim whitespace", () => {
      expect(normalizeString("  hello  ")).toBe("hello");
    });
  });

  describe("durationMatch", () => {
    it("should return true when durations are within tolerance", () => {
      expect(durationMatch(180000, 183000)).toBe(true);
    });

    it("should return true when durations are exactly equal", () => {
      expect(durationMatch(180000, 180000)).toBe(true);
    });

    it("should return false when durations exceed tolerance", () => {
      expect(durationMatch(180000, 190000)).toBe(false);
    });

    it("should return false when either duration is undefined", () => {
      expect(durationMatch(undefined, 180000)).toBe(false);
      expect(durationMatch(180000, undefined)).toBe(false);
    });
  });

  describe("nameSimilarity", () => {
    it("should return 1 for identical strings", () => {
      expect(nameSimilarity("hello world", "hello world")).toBe(1);
    });

    it("should return 0.8 when one contains the other", () => {
      expect(nameSimilarity("hello world", "world")).toBe(0.8);
    });

    it("should return 0 for completely different strings", () => {
      expect(nameSimilarity("hello", "goodbye")).toBe(0);
    });
  });

  describe("artistMatch", () => {
    it("should return true for identical artists", () => {
      expect(artistMatch("21 Clown", "21 Clown")).toBe(true);
    });

    it("should return true when YouTube artist contains Spotify artist", () => {
      expect(artistMatch("21 Clown", "21 Clown Official")).toBe(true);
    });

    it("should return true when Spotify artist contains YouTube artist", () => {
      expect(artistMatch("21 Clown Official", "21 Clown")).toBe(true);
    });

    it("should return false for different artists", () => {
      expect(artistMatch("21 Clown", "Nyamura")).toBe(false);
    });
  });

  describe("calculateConfidence", () => {
    const spotifyTrack: SpotifyTrack = {
      uri: "spotify:track:123",
      name: "Tokyo Nightmare? [Remix]",
      album: "Test Album",
      artist: "21 Clown",
      duration: 193000,
    };

    it("should return high confidence for exact match with duration", () => {
      const ytSong: YouTubeSong = {
        videoId: "abc123",
        name: "Tokyo Nightmare? [Remix]",
        artist: "21 Clown",
        duration: 193000,
      };
      const result = calculateConfidence(spotifyTrack, ytSong);
      expect(result.confidence).toBe("high");
      expect(result.reason).toBe("exact");
    });

    it("should return medium confidence for exact name/artist without duration", () => {
      const ytSong: YouTubeSong = {
        videoId: "abc123",
        name: "Tokyo Nightmare? [Remix]",
        artist: "21 Clown",
        duration: 200000,
      };
      const result = calculateConfidence(spotifyTrack, ytSong);
      expect(result.confidence).toBe("medium");
      expect(result.reason).toBe("fuzzy");
    });

    it("should return low confidence for duration match only", () => {
      const ytSong: YouTubeSong = {
        videoId: "abc123",
        name: "Different Song",
        artist: "Unknown Artist",
        duration: 193000,
      };
      const result = calculateConfidence(spotifyTrack, ytSong);
      expect(result.confidence).toBe("low");
      expect(result.reason).toBe("duration");
    });

    it("should return none for no match", () => {
      const ytSong: YouTubeSong = {
        videoId: "abc123",
        name: "Different Song",
        artist: "Unknown Artist",
        duration: 100000,
      };
      const result = calculateConfidence(spotifyTrack, ytSong);
      expect(result.confidence).toBe("none");
      expect(result.reason).toBe("none");
    });
  });

  describe("matchTrackToResults", () => {
    const spotifyTrack: SpotifyTrack = {
      uri: "spotify:track:123",
      name: "Tokyo Nightmare",
      album: "Test Album",
      artist: "21 Clown",
      duration: 193000,
    };

    it("should return none when no results", () => {
      const result = matchTrackToResults(spotifyTrack, []);
      expect(result.confidence).toBe("none");
      expect(result.youtubeSong).toBeNull();
    });

    it("should return the best match", () => {
      const ytSongs: YouTubeSong[] = [
        {
          videoId: "vid1",
          name: "Unrelated Song",
          artist: "Other Artist",
          duration: 100000,
        },
        {
          videoId: "vid2",
          name: "Tokyo Nightmare",
          artist: "21 Clown",
          duration: 193000,
        },
      ];
      const result = matchTrackToResults(spotifyTrack, ytSongs);
      expect(result.confidence).toBe("high");
      expect(result.youtubeSong?.videoId).toBe("vid2");
    });
  });

  describe("filterByConfidence", () => {
    it("should filter results by minimum confidence", () => {
      const testTrack: SpotifyTrack = {
        uri: "spotify:track:123",
        name: "Test",
        album: "Album",
        artist: "Artist",
        duration: 180000,
      };
      const results = [
        {
          track: testTrack,
          youtubeSong: { videoId: "v1", name: "Song1", artist: "A1" },
          confidence: "high" as const,
          matchReason: "exact" as const,
        },
        {
          track: testTrack,
          youtubeSong: { videoId: "v2", name: "Song2", artist: "A2" },
          confidence: "medium" as const,
          matchReason: "fuzzy" as const,
        },
        {
          track: testTrack,
          youtubeSong: { videoId: "v3", name: "Song3", artist: "A3" },
          confidence: "low" as const,
          matchReason: "duration" as const,
        },
        {
          track: testTrack,
          youtubeSong: null,
          confidence: "none" as const,
          matchReason: "none" as const,
        },
      ];

      const filtered = filterByConfidence(results, "medium");
      expect(filtered.length).toBe(2);
      expect(filtered.every((r) => r.confidence === "high" || r.confidence === "medium")).toBe(true);
    });
  });
});
