import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Importer } from "../../src/core/importer.js";
import type { ImporterOptions } from "../../src/core/importer.js";
import type {
  MatchResult,
  RunStatsDelta,
  UpsertTrackInput,
} from "../../src/types/index.js";

let shouldThrowSearch = false;

const mockMatchTrackToResults = vi.fn();

vi.mock("../../src/core/searcher.js", () => {
  return {
    default: class Searcher {
      async init(): Promise<void> {
        return;
      }

      async searchSongs(): Promise<unknown[]> {
        if (shouldThrowSearch) {
          throw new Error("search failed");
        }
        return [];
      }

      async createPlaylist(): Promise<string> {
        return "playlist-id";
      }

      async addToPlaylist(): Promise<void> {
        return;
      }
    },
  };
});

vi.mock("../../src/core/matcher.js", () => {
  return {
    matchTrackWithCandidates: (...args: unknown[]) =>
      mockMatchTrackToResults(...args),
  };
});

class MockDb {
  upsertTrackCalls: UpsertTrackInput[] = [];
  updateRunStatsCalls: RunStatsDelta[] = [];

  upsertTrack(input: UpsertTrackInput) {
    this.upsertTrackCalls.push(input);
    return { success: true };
  }

  updateRunStats(_runId: string, deltas: RunStatsDelta) {
    this.updateRunStatsCalls.push(deltas);
    return { success: true };
  }
}

describe("importer.ts", () => {
  let tempDir: string;
  let csvPath: string;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "yt-importer-"));
    csvPath = join(tempDir, "tracks.csv");
    shouldThrowSearch = false;
    mockMatchTrackToResults.mockReset();
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("skips already processed track keys", async () => {
    writeFileSync(
      csvPath,
      "Track URI,Track Name,Album Name,Artist Name(s),Duration (ms)\n" +
        "spotify:track:1,Song One,Album,Artist,180000\n" +
        "spotify:track:2,Song Two,Album,Artist,180000\n",
    );

    mockMatchTrackToResults.mockImplementation(
      (track: unknown, results: unknown) => {
        const t = track as { name: string; artist: string };
        return {
          track,
          youtubeSong: {
            videoId: "vid",
            name: t.name,
            artist: t.artist,
          },
          confidence: "high",
          matchReason: "exact",
          candidates: [],
        } as MatchResult;
      },
    );

    const db = new MockDb();
    const importerOptions: ImporterOptions = {
      csvPath,
      config: {
        saveProgress: false,
        progressDbPath: "./import-progress.sqlite",
      },
      runId: "run-1",
      db: db as unknown as any,
      processedTrackKeys: new Set(["spotify:track:1"]),
    };

    const importer = new Importer(importerOptions);
    await importer.init();
    importer.loadCsv();

    await importer.processTracks();

    expect(db.upsertTrackCalls.length).toBe(1);
    expect(db.upsertTrackCalls[0]?.trackKey).toBe("spotify:track:2");
    expect(db.updateRunStatsCalls.length).toBe(1);
    expect(db.updateRunStatsCalls[0]).toBeDefined();
  });

  it("records failure when search throws", async () => {
    writeFileSync(
      csvPath,
      "Track URI,Track Name,Album Name,Artist Name(s),Duration (ms)\n" +
        "spotify:track:1,Song One,Album,Artist,180000\n",
    );

    shouldThrowSearch = true;

    const db = new MockDb();
    const importerOptions: ImporterOptions = {
      csvPath,
      config: {
        saveProgress: false,
        progressDbPath: "./import-progress.sqlite",
      },
      runId: "run-2",
      db: db as unknown as any,
      processedTrackKeys: new Set(),
    };

    const importer = new Importer(importerOptions);
    await importer.init();
    importer.loadCsv();

    await importer.processTracks();

    expect(db.upsertTrackCalls.length).toBe(1);
    expect(db.upsertTrackCalls[0]?.status).toBe("failed");
    expect(db.updateRunStatsCalls.length).toBe(1);
    expect(db.updateRunStatsCalls[0]?.failedTracks).toBe(1);
  });
});
