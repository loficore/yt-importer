import { describe, it, expect } from "vitest";
import { parse } from "csv-parse/sync";
import type { SpotifyTrack } from "../../src/types/index.js";

interface CsvRecord {
  "Track URI": string;
  "Track Name": string;
  "Album Name": string;
  "Artist Name(s)": string;
  "Duration (ms)": string;
  [key: string]: string;
}

describe("csvParser.ts", () => {
  describe("CSV parsing", () => {
    it("should parse valid CSV content", () => {
      const csvContent = `Track URI,Track Name,Album Name,Artist Name(s),Duration (ms)
spotify:track:abc123,Tokyo Nightmare,Test Album,21 Clown,180000
spotify:track:def456,Lullaby,Album 2,Artist2,200000`;

      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
      }) as CsvRecord[];

      expect(records.length).toBe(2);
      expect(records[0]?.["Track Name"]).toBe("Tokyo Nightmare");
      expect(records[1]?.["Artist Name(s)"]).toBe("Artist2");
    });

    it("should convert CSV to SpotifyTrack objects", () => {
      const csvContent = `Track URI,Track Name,Album Name,Artist Name(s),Duration (ms)
spotify:track:123,Test Song,Test Album,Test Artist,180000`;

      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
      }) as CsvRecord[];

      const tracks: SpotifyTrack[] = records.map((record) => ({
        uri: record["Track URI"] ?? "",
        name: record["Track Name"] || "Unknown",
        album: record["Album Name"] || "Unknown",
        artist: record["Artist Name(s)"] || "Unknown",
        duration: Number.parseInt(record["Duration (ms)"] ?? "0", 10),
      }));

      expect(tracks.length).toBe(1);
      expect(tracks[0]?.name).toBe("Test Song");
      expect(tracks[0]?.duration).toBe(180000);
    });

    it("should handle Unicode characters", () => {
      const csvContent = `Track URI,Track Name,Album Name,Artist Name(s),Duration (ms)
spotify:track:123,東京ドリーム,テストアルバム,テストアーティスト,240000`;

      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
      }) as CsvRecord[];

      expect(records[0]?.["Track Name"]).toBe("東京ドリーム");
      expect(records[0]?.["Artist Name(s)"]).toBe("テストアーティスト");
    });

    it("should handle empty fields with defaults", () => {
      const csvContent = `Track URI,Track Name,Album Name,Artist Name(s),Duration (ms)
,Unknown Song,,,180000`;

      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
      }) as CsvRecord[];

      const tracks: SpotifyTrack[] = records.map((record) => ({
        uri: record["Track URI"] ?? "",
        name: record["Track Name"] || "Unknown",
        album: record["Album Name"] || "Unknown",
        artist: record["Artist Name(s)"] || "Unknown",
        duration: Number.parseInt(record["Duration (ms)"] ?? "0", 10),
      }));

      expect(tracks[0]?.uri).toBe("");
      expect(tracks[0]?.name).toBe("Unknown Song");
      expect(tracks[0]?.album).toBe("Unknown");
      expect(tracks[0]?.artist).toBe("Unknown");
    });

    it("should parse duration in milliseconds", () => {
      const csvContent = `Track URI,Track Name,Album Name,Artist Name(s),Duration (ms)
spotify:track:123,Test,Album,Artist,183000`;

      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
      }) as CsvRecord[];

      const duration = Number.parseInt(
        records[0]?.["Duration (ms)"] ?? "0",
        10,
      );
      expect(duration).toBe(183000);
      expect(typeof duration).toBe("number");
    });

    it("should handle special characters in track names", () => {
      const csvContent = `Track URI,Track Name,Album Name,Artist Name(s),Duration (ms)
spotify:track:123,Hello! (feat. World),Album,Artist,180000
spotify:track:456,Rock & Roll - Remix,Album,Artist,200000
spotify:track:789,Lullaby? (Acoustic Version),Album,Artist,210000`;

      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
      }) as CsvRecord[];

      expect(records[0]?.["Track Name"]).toContain("!");
      expect(records[1]?.["Track Name"]).toContain("&");
      expect(records[2]?.["Track Name"]).toContain("?");
    });

    it("should handle large CSV files", () => {
      const lines = [
        "Track URI,Track Name,Album Name,Artist Name(s),Duration (ms)",
      ];
      for (let i = 0; i < 1000; i++) {
        lines.push(
          `spotify:track:${i},Song ${i},Album ${i},Artist ${i},${180000 + i}`,
        );
      }
      const csvContent = lines.join("\n");

      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
      }) as CsvRecord[];

      expect(records.length).toBe(1000);
    });
  });
});
