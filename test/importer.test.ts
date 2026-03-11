import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { MockDatabase, MockSearchCache } = vi.hoisted(() => {
  return {
    MockDatabase: class MockDatabase {
      run = vi.fn();
      prepare = vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue(undefined),
        run: vi.fn(),
      });
    },
    MockSearchCache: class MockSearchCache {
      get = vi.fn().mockReturnValue(null);
      set = vi.fn();
      cleanupExpiredCaches = vi.fn().mockReturnValue(0);
    },
  };
});

vi.mock("bun:sqlite", () => ({
  Database: MockDatabase,
}));

vi.mock("../src/utils/searchCache.js", () => ({
  SearchCache: MockSearchCache,
}));
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Importer } from "../src/core/importer.js";
import type { ImporterOptions } from "../src/core/importer.js";
import type {
  MatchResult,
  RunStatsDelta,
  UpsertTrackInput,
} from "../src/types/index.js";

let shouldThrowSearch = false;

vi.mock("../src/core/searcher.js", () => {
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

const matchTrackToResults = vi.hoisted(() => vi.fn());
const matchTrackWithCandidates = vi.hoisted(() => vi.fn());

vi.mock("../src/core/matcher.js", () => {
  return {
    matchTrackToResults,
    matchTrackWithCandidates,
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
    matchTrackToResults.mockReset();
    matchTrackWithCandidates.mockReset();
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

    matchTrackWithCandidates.mockImplementation((track) => {
      return {
        track,
        youtubeSong: {
          videoId: "vid",
          name: track.name,
          artist: track.artist,
        },
        confidence: "high",
        matchReason: "exact",
        candidates: [],
      } as MatchResult;
    });

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
    expect(db.updateRunStatsCalls[0]?.matchedTracks).toBe(1);
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
