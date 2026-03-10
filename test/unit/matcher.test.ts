import { describe, it, expect } from "vitest";
import {
  normalizeString,
  extractVersionInfo,
  normalizeFeature,
  durationMatch,
  nameSimilarity,
  artistMatch,
  calculateConfidence,
  matchTrackToResults,
  filterByConfidence,
  matchTrackWithCandidates,
} from "../../src/core/matcher.js";
import type { SpotifyTrack, YouTubeSong } from "../../src/types/index.js";

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
      expect(
        filtered.every(
          (r) => r.confidence === "high" || r.confidence === "medium",
        ),
      ).toBe(true);
    });
  });

  describe("normalizeString - extended", () => {
    it("should handle Unicode characters", () => {
      expect(normalizeString("東京ドリーム")).toBe("東京ドリーム");
    });

    it("should normalize NFKC", () => {
      expect(normalizeString("caf\u00e9")).toBe("caf\u00e9");
    });

    it("should remove feat variations", () => {
      expect(normalizeString("Song feat. Artist")).toBe("song feat artist");
      expect(normalizeString("Song ft. Artist")).toBe("song ft artist");
      expect(normalizeString("Song featuring Artist")).toBe(
        "song featuring artist",
      );
    });

    it("should not remove year from title", () => {
      expect(normalizeString("Song 2023")).toBe("song 2023");
      expect(normalizeString("2023 Song")).toBe("2023 song");
    });

    it("should not remove stop words in normalizeString", () => {
      expect(normalizeString("Song Live")).toBe("song live");
      expect(normalizeString("Song Remix")).toBe("song remix");
      expect(normalizeString("Song Radio Edit")).toBe("song radio edit");
    });
  });

  describe("durationMatch - extended", () => {
    it("should use custom tolerance", () => {
      expect(durationMatch(180000, 181000, 5000)).toBe(true);
      expect(durationMatch(180000, 190000, 5000)).toBe(false);
    });

    it("should handle zero durations", () => {
      expect(durationMatch(0, 0)).toBe(true);
      expect(durationMatch(0, 5000)).toBe(true);
    });
  });

  describe("nameSimilarity - extended", () => {
    it("should handle empty strings", () => {
      expect(nameSimilarity("", "")).toBe(0);
      expect(nameSimilarity("", "test")).toBe(0);
    });

    it("should handle case differences", () => {
      expect(nameSimilarity("Hello World", "hello world")).toBe(1);
    });

    it("should return moderate similarity for partial matches", () => {
      const similarity = nameSimilarity("Hello", "Hello World");
      expect(similarity).toBeGreaterThan(0.5);
      expect(similarity).toBeLessThan(1);
    });
  });

  describe("artistMatch - extended", () => {
    it("should handle empty strings", () => {
      expect(artistMatch("", "")).toBe(true);
      expect(artistMatch("", "Artist")).toBe(true);
    });

    it("should handle multiple artists", () => {
      expect(artistMatch("Artist1, Artist2", "Artist1")).toBe(true);
    });

    it("should be case insensitive", () => {
      expect(artistMatch("HELLO", "hello")).toBe(true);
    });
  });

  describe("calculateConfidence - extended", () => {
    it("should return none when YouTube song has no name", () => {
      const spotifyTrack: SpotifyTrack = {
        uri: "spotify:track:123",
        name: "Test Song",
        album: "Album",
        artist: "Artist",
        duration: 180000,
      };
      const ytSong: YouTubeSong = {
        videoId: "abc123",
        name: "",
        artist: "Artist",
      };
      const result = calculateConfidence(spotifyTrack, ytSong);
      expect(result.confidence).toBe("none");
    });
  });

  describe("matchTrackWithCandidates", () => {
    it("should return none when no results", () => {
      const track: SpotifyTrack = {
        uri: "spotify:track:123",
        name: "Test",
        album: "Album",
        artist: "Artist",
        duration: 180000,
      };
      const result = matchTrackWithCandidates(track, []);
      expect(result.confidence).toBe("none");
      expect(result.youtubeSong).toBeNull();
      expect(result.candidates).toHaveLength(0);
    });

    it("should limit candidates to maxCandidates", () => {
      const track: SpotifyTrack = {
        uri: "spotify:track:123",
        name: "Test",
        album: "Album",
        artist: "Artist",
        duration: 180000,
      };
      const songs: YouTubeSong[] = [
        { videoId: "1", name: "Song1", artist: "A1" },
        { videoId: "2", name: "Song2", artist: "A2" },
        { videoId: "3", name: "Song3", artist: "A3" },
        { videoId: "4", name: "Song4", artist: "A4" },
        { videoId: "5", name: "Song5", artist: "A5" },
        { videoId: "6", name: "Song6", artist: "A6" },
      ];
      const result = matchTrackWithCandidates(track, songs, 3);
      expect(result.candidates).toHaveLength(3);
    });

    it("should include candidates even when no match", () => {
      const track: SpotifyTrack = {
        uri: "spotify:track:123",
        name: "Unique Song Name",
        album: "Album",
        artist: "Artist",
        duration: 180000,
      };
      const songs: YouTubeSong[] = [
        { videoId: "1", name: "Different Song", artist: "Other" },
      ];
      const result = matchTrackWithCandidates(track, songs);
      expect(result.candidates).toHaveLength(1);
    });
  });

  describe("filterByConfidence - edge cases", () => {
    it("should return empty array for empty input", () => {
      const result = filterByConfidence([], "high");
      expect(result).toHaveLength(0);
    });

    it("should return all when minConfidence is none", () => {
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
          youtubeSong: { videoId: "v1", name: "S1", artist: "A1" },
          confidence: "high" as const,
          matchReason: "exact" as const,
        },
        {
          track: testTrack,
          youtubeSong: { videoId: "v2", name: "S2", artist: "A2" },
          confidence: "none" as const,
          matchReason: "none" as const,
        },
      ];
      const filtered = filterByConfidence(results, "none");
      expect(filtered).toHaveLength(2);
    });
  });

  describe("extractVersionInfo", () => {
    it("should extract remix version", () => {
      const result = extractVersionInfo("Song Name Remix");
      expect(result.cleanTitle).toBe("song name");
      expect(result.version).toContain("remix");
    });

    it("should extract multiple version info", () => {
      const result = extractVersionInfo("Song Radio Edit Remix");
      expect(result.cleanTitle).toBe("song");
      expect(result.version).toContain("radio edit");
      expect(result.version).toContain("remix");
    });

    it("should handle title without version", () => {
      const result = extractVersionInfo("Clean Song Title");
      expect(result.cleanTitle).toBe("clean song title");
      expect(result.version).toBe("");
    });

    it("should extract feat info", () => {
      const result = extractVersionInfo("Song feat. Artist");
      expect(result.version).toContain("feat");
    });

    it("should handle Japanese characters", () => {
      const result = extractVersionInfo("東京ドリーム Remix");
      expect(result.cleanTitle).toBe("東京ドリーム");
      expect(result.version.toLowerCase()).toContain("remix");
    });
  });

  describe("normalizeFeature", () => {
    it("should normalize feat variations to feat", () => {
      expect(normalizeFeature("Song feat. Artist")).toBe("Song feat Artist");
      expect(normalizeFeature("Song featuring Artist")).toBe(
        "Song feat Artist",
      );
      expect(normalizeFeature("Song ft. Artist")).toBe("Song feat Artist");
      expect(normalizeFeature("Song ft Artist")).toBe("Song feat Artist");
    });

    it("should normalize and to &", () => {
      expect(normalizeFeature("Artist1 and Artist2")).toBe("Artist1 & Artist2");
    });

    it("should normalize + to &", () => {
      expect(normalizeFeature("Artist1 + Artist2")).toBe("Artist1 & Artist2");
    });

    it("should normalize commas to &", () => {
      expect(normalizeFeature("Artist1, Artist2")).toBe("Artist1 & Artist2");
    });
  });

  describe("normalizeString - CJK support", () => {
    it("should preserve Chinese characters", () => {
      expect(normalizeString("北京")).toBe("北京");
      expect(normalizeString("北京北京")).toBe("北京北京");
    });

    it("should convert fullwidth ASCII to halfwidth then remove", () => {
      expect(normalizeString("ＡＢＣ")).toBe("abc");
      expect(normalizeString("１２３")).toBe("123");
      expect(normalizeString("（Ａ）")).toBe("a");
    });

    it("should convert hiragana to katakana", () => {
      expect(normalizeString("あ")).toBe("ア");
      expect(normalizeString("とり")).toBe("トリ");
    });

    it("should handle mixed CJK and English", () => {
      expect(normalizeString("Tokyo 東京")).toBe("tokyo 東京");
      expect(normalizeString("Hello 世界")).toBe("hello 世界");
    });
  });

  describe("artistMatch - feat variations", () => {
    it("should match artists with feat variations", () => {
      expect(artistMatch("Artist1 feat. Artist2", "Artist1")).toBe(true);
      expect(artistMatch("Artist1", "Artist1 feat. Artist2")).toBe(true);
      expect(artistMatch("Artist1 featuring Artist2", "Artist1")).toBe(true);
      expect(artistMatch("Artist1 ft. Artist2", "Artist1 & Artist2")).toBe(
        true,
      );
    });

    it("should match artists with & and and", () => {
      expect(artistMatch("A and B", "A & B")).toBe(true);
      expect(artistMatch("A + B", "A & B")).toBe(true);
      expect(artistMatch("A, B", "A & B")).toBe(true);
    });
  });
});
