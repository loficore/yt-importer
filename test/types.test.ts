import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  SpotifyTrackSchema,
  YouTubeSongSchema,
  MatchConfidenceEnum,
  MatchReasonEnum,
  MatchResultSchema,
  PlaylistSchema,
  ImportProgressSchema,
  ImporterConfigSchema,
  ImportStatsSchema,
} from "../src/types/index.js";

describe("types/index.ts", () => {
  describe("SpotifyTrackSchema", () => {
    it("should parse valid Spotify track", () => {
      const track = {
        uri: "spotify:track:123",
        name: "Tokyo Nightmare",
        album: "Test Album",
        artist: "21 Clown",
        duration: 180000,
      };
      const result = SpotifyTrackSchema.parse(track);
      expect(result.name).toBe("Tokyo Nightmare");
      expect(result.duration).toBe(180000);
    });

    it("should throw on missing required fields", () => {
      expect(() => {
        SpotifyTrackSchema.parse({ name: "Test" });
      }).toThrow();
    });

    it("should accept optional fields", () => {
      const track = {
        uri: "spotify:track:123",
        name: "Test",
        album: "Album",
        artist: "Artist",
        duration: 180000,
        popularity: 80,
        explicit: false,
        releaseDate: "2024-01-01",
        genres: ["rock"],
        recordLabel: "Test Label",
      };
      const result = SpotifyTrackSchema.parse(track);
      expect(result.popularity).toBe(80);
      expect(result.genres).toEqual(["rock"]);
    });
  });

  describe("YouTubeSongSchema", () => {
    it("should parse valid YouTube song", () => {
      const song = {
        videoId: "abc123",
        name: "Tokyo Nightmare",
        artist: "21 Clown",
        duration: 180000,
      };
      const result = YouTubeSongSchema.parse(song);
      expect(result.videoId).toBe("abc123");
      expect(result.name).toBe("Tokyo Nightmare");
    });

    it("should allow optional fields", () => {
      const song = {
        videoId: "abc123",
        name: "Test",
        artist: "Artist",
        album: "Test Album",
        thumbnails: [{ url: "https://example.com/img.jpg", width: 120, height: 120 }],
      };
      const result = YouTubeSongSchema.parse(song);
      expect(result.album).toBe("Test Album");
      expect(result.thumbnails?.length).toBe(1);
    });
  });

  describe("MatchConfidenceEnum", () => {
    it("should accept valid confidence values", () => {
      expect(MatchConfidenceEnum.parse("high")).toBe("high");
      expect(MatchConfidenceEnum.parse("medium")).toBe("medium");
      expect(MatchConfidenceEnum.parse("low")).toBe("low");
      expect(MatchConfidenceEnum.parse("none")).toBe("none");
    });

    it("should throw on invalid value", () => {
      expect(() => {
        MatchConfidenceEnum.parse("invalid");
      }).toThrow();
    });
  });

  describe("MatchReasonEnum", () => {
    it("should accept valid reason values", () => {
      expect(MatchReasonEnum.parse("exact")).toBe("exact");
      expect(MatchReasonEnum.parse("fuzzy")).toBe("fuzzy");
      expect(MatchReasonEnum.parse("duration")).toBe("duration");
      expect(MatchReasonEnum.parse("none")).toBe("none");
    });
  });

  describe("MatchResultSchema", () => {
    it("should parse valid match result", () => {
      const result = {
        track: {
          uri: "spotify:track:123",
          name: "Test",
          album: "Album",
          artist: "Artist",
          duration: 180000,
        },
        youtubeSong: {
          videoId: "abc123",
          name: "Test",
          artist: "Artist",
        },
        confidence: "high" as const,
        matchReason: "exact" as const,
      };
      const parsed = MatchResultSchema.parse(result);
      expect(parsed.confidence).toBe("high");
      expect(parsed.youtubeSong?.videoId).toBe("abc123");
    });

    it("should allow null youtubeSong", () => {
      const result = {
        track: {
          uri: "spotify:track:123",
          name: "Test",
          album: "Album",
          artist: "Artist",
          duration: 180000,
        },
        youtubeSong: null,
        confidence: "none" as const,
        matchReason: "none" as const,
      };
      const parsed = MatchResultSchema.parse(result);
      expect(parsed.youtubeSong).toBeNull();
    });
  });

  describe("PlaylistSchema", () => {
    it("should parse valid playlist", () => {
      const playlist = {
        id: "PL123",
        name: "My Playlist",
        trackCount: 10,
        videoIds: ["abc", "def", "ghi"],
      };
      const result = PlaylistSchema.parse(playlist);
      expect(result.id).toBe("PL123");
      expect(result.videoIds.length).toBe(3);
    });
  });

  describe("ImporterConfigSchema", () => {
    it("should use default values", () => {
      const config = ImporterConfigSchema.parse({});
      expect(config.skipConfirmation).toBe(false);
      expect(config.minConfidence).toBe("low");
      expect(config.requestDelay).toBe(1500);
      expect(config.saveProgress).toBe(true);
      expect(config.progressFile).toBe("./import-progress.json");
    });

    it("should accept custom values", () => {
      const config = ImporterConfigSchema.parse({
        skipConfirmation: true,
        minConfidence: "high",
        requestDelay: 2000,
      });
      expect(config.skipConfirmation).toBe(true);
      expect(config.minConfidence).toBe("high");
      expect(config.requestDelay).toBe(2000);
    });
  });

  describe("ImportStatsSchema", () => {
    it("should parse valid stats", () => {
      const stats = {
        total: 100,
        matched: 80,
        highConfidence: 50,
        mediumConfidence: 20,
        lowConfidence: 10,
        unmatched: 20,
        importSuccess: 75,
        importFailed: 5,
        duration: 60000,
      };
      const result = ImportStatsSchema.parse(stats);
      expect(result.total).toBe(100);
      expect(result.matched).toBe(80);
    });
  });
});
