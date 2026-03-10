import { describe, it, expect, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

vi.mock("bun:sqlite", () => {
  type ProgressRunRow = {
    run_id: string;
    csv_path: string;
    created_at: string;
    status: string;
    total_tracks: number;
    processed_tracks: number;
    matched_tracks: number;
    failed_tracks: number;
    skipped_tracks: number;
    playlist_id: string | null;
  };

  type ImportTrackRow = {
    uuid: string;
    track_key: string;
    track_json: string;
    match_result_json: string;
    status: string;
    error_message: string | null;
    updated_at: string;
    run_id: string;
  };

  type ImporterConfigRow = {
    id: number;
    skip_confirmation: boolean | null;
    min_confidence: string | null;
    request_delay: number | null;
    save_progress: boolean | null;
    progress_db_path: string | null;
    language: string | null;
  };

  class FakeDatabase {
    private progressRuns = new Map<string, ProgressRunRow>();
    private importTracks = new Map<string, ImportTrackRow>();
    private importerConfig: ImporterConfigRow | null = null;

    private normalize(sqlText: string): string {
      return sqlText.replace(/\s+/g, " ").trim().toLowerCase();
    }

    exec(): void {
      return;
    }

    run(sqlText: string, params: unknown[] = []): void {
      const sql = this.normalize(sqlText);
      if (sql.includes("insert into progress_runs")) {
        const [runId, csvPath, createdAt, status, totalTracks, playlistId] =
          params as [string, string, string, string, number, string | null];
        this.progressRuns.set(runId, {
          run_id: runId,
          csv_path: csvPath,
          created_at: createdAt,
          status,
          total_tracks: totalTracks,
          processed_tracks: 0,
          matched_tracks: 0,
          failed_tracks: 0,
          skipped_tracks: 0,
          playlist_id: playlistId ?? null,
        });
        return;
      }

      if (sql.includes("update progress_runs") && sql.includes("set status")) {
        const [status, runId] = params as [string, string];
        const row = this.progressRuns.get(runId);
        if (row) row.status = status;
        return;
      }

      if (
        sql.includes("update progress_runs") &&
        sql.includes("processed_tracks")
      ) {
        const [processed, matched, failed, skipped, runId] = params as [
          number,
          number,
          number,
          number,
          string,
        ];
        const row = this.progressRuns.get(runId);
        if (row) {
          row.processed_tracks += processed;
          row.matched_tracks += matched;
          row.failed_tracks += failed;
          row.skipped_tracks += skipped;
        }
        return;
      }

      if (sql.includes("insert into import_tracks")) {
        const [
          uuid,
          trackKey,
          trackJson,
          matchJson,
          status,
          errorMessage,
          updatedAt,
          runId,
        ] = params as [
          string,
          string,
          string,
          string,
          string,
          string | null,
          string,
          string,
        ];
        const key = `${runId}:${trackKey}`;
        this.importTracks.set(key, {
          uuid,
          track_key: trackKey,
          track_json: trackJson,
          match_result_json: matchJson,
          status,
          error_message: errorMessage ?? null,
          updated_at: updatedAt,
          run_id: runId,
        });
        return;
      }

      if (sql.includes("insert into importer_config")) {
        const [
          skipConfirmation,
          minConfidence,
          requestDelay,
          saveProgress,
          progressDbPath,
          language,
        ] = params as [
          boolean | null,
          string | null,
          number | null,
          boolean | null,
          string | null,
          string | null,
        ];
        this.importerConfig = {
          id: 1,
          skip_confirmation: skipConfirmation,
          min_confidence: minConfidence,
          request_delay: requestDelay,
          save_progress: saveProgress,
          progress_db_path: progressDbPath,
          language,
        };
      }
    }

    prepare(sqlText: string) {
      const sql = this.normalize(sqlText);
      return {
        all: (...params: unknown[]) => {
          if (sql.includes("from progress_runs") && sql.includes("where")) {
            const [runId] = params as [string];
            const row = this.progressRuns.get(runId);
            return row ? [row] : [];
          }

          if (sql.includes("from progress_runs") && sql.includes("limit")) {
            const [limit] = params as [number];
            return Array.from(this.progressRuns.values()).slice(0, limit);
          }

          if (
            sql.includes("from import_tracks") &&
            sql.includes("track_key") &&
            !sql.includes("status = 'failed'")
          ) {
            const [runId] = params as [string];
            return Array.from(this.importTracks.values())
              .filter((row) => row.run_id === runId)
              .map((row) => ({ track_key: row.track_key }));
          }

          if (sql.includes("status = 'failed'")) {
            const [runId, limit] = params as [string, number];
            return Array.from(this.importTracks.values())
              .filter((row) => row.run_id === runId && row.status === "failed")
              .slice(0, limit);
          }

          return [];
        },
        get: () => {
          return this.importerConfig;
        },
        run: (...params: unknown[]) => this.run(sqlText, params),
      };
    }

    transaction(fn: () => void) {
      return () => fn();
    }
  }

  return { Database: FakeDatabase };
});

import { DB } from "../../src/utils/db.js";
import type { UpsertTrackInput } from "../../src/types/index.js";

type TestDb = {
  db: DB;
  dir: string;
};

const createTestDb = (): TestDb => {
  const dir = mkdtempSync(join(tmpdir(), "yt-importer-"));
  const dbPath = join(dir, "test.sqlite");
  const db = new DB(dbPath);
  db.init();
  return { db, dir };
};

describe("db.ts", () => {
  let current: TestDb | null = null;

  afterEach(() => {
    if (current) {
      rmSync(current.dir, { recursive: true, force: true });
      current = null;
    }
  });

  it("creates a run and lists summaries", () => {
    current = createTestDb();
    const runId = randomUUID();

    const create = current.db.createRUN({
      runId,
      csvPath: "/tmp/test.csv",
      createdAt: Date.now(),
      status: "running",
      totalTracks: 2,
      processedTracks: 0,
      matchedTracks: 0,
      failedTracks: 0,
      skippedTracks: 0,
      playlistId: undefined,
    });

    expect(create.success).toBe(true);

    const summaries = current.db.listRunSummaries(10);
    expect(summaries.success).toBe(true);
    const rows = Array.isArray(summaries.data) ? summaries.data : [];
    const found = rows.find(
      (row) => (row as { run_id?: string }).run_id === runId,
    );
    expect(found).toBeTruthy();
  });

  it("updates run stats", () => {
    current = createTestDb();
    const runId = randomUUID();

    current.db.createRUN({
      runId,
      csvPath: "/tmp/test.csv",
      createdAt: Date.now(),
      status: "running",
      totalTracks: 2,
      processedTracks: 0,
      matchedTracks: 0,
      failedTracks: 0,
      skippedTracks: 0,
      playlistId: undefined,
    });

    current.db.updateRunStats(runId, {
      processedTracks: 1,
      matchedTracks: 1,
      failedTracks: 0,
      skippedTracks: 0,
    });

    const run = current.db.getRunById(runId);
    const rows = Array.isArray(run.data) ? run.data : [];
    const row = rows[0] as {
      processed_tracks?: number;
      matched_tracks?: number;
    };
    expect(row.processed_tracks).toBe(1);
    expect(row.matched_tracks).toBe(1);
  });

  it("upserts tracks and lists failed", () => {
    current = createTestDb();
    const runId = randomUUID();

    current.db.createRUN({
      runId,
      csvPath: "/tmp/test.csv",
      createdAt: Date.now(),
      status: "running",
      totalTracks: 1,
      processedTracks: 0,
      matchedTracks: 0,
      failedTracks: 0,
      skippedTracks: 0,
      playlistId: undefined,
    });

    const input: UpsertTrackInput = {
      runId,
      trackKey: "spotify:track:123",
      track: {
        uri: "spotify:track:123",
        name: "Test Song",
        album: "Album",
        artist: "Artist",
        duration: 180000,
      },
      matchResult: {
        track: {
          uri: "spotify:track:123",
          name: "Test Song",
          album: "Album",
          artist: "Artist",
          duration: 180000,
        },
        youtubeSong: null,
        confidence: "none",
        matchReason: "none",
      },
      status: "failed",
      errorMessage: "no match",
    };

    const upsert = current.db.upsertTrack(input);
    expect(upsert.success).toBe(true);

    const keys = current.db.getProcessedTrackKeys(runId);
    const keyRows = Array.isArray(keys.data) ? keys.data : [];
    const hasKey = keyRows.some(
      (row) => (row as { track_key?: string }).track_key === input.trackKey,
    );
    expect(hasKey).toBe(true);

    const failed = current.db.listFailedTracks(runId, 10);
    const failedRows = Array.isArray(failed.data) ? failed.data : [];
    const row = failedRows[0] as { track_json?: string };
    const parsed = row.track_json ? JSON.parse(row.track_json) : null;
    expect(parsed?.name).toBe("Test Song");
  });

  it("persists config", () => {
    current = createTestDb();

    const write = current.db.upsertConfig({
      language: "ja",
      minConfidence: "medium",
      requestDelay: 2000,
      skipConfirmation: true,
      saveProgress: false,
      progressDbPath: "./import-progress.sqlite",
    });

    expect(write.success).toBe(true);

    const config = current.db.getConfig();
    const row = config.data as { language?: string; min_confidence?: string };
    expect(row.language).toBe("ja");
    expect(row.min_confidence).toBe("medium");
  });

  it("cleans up old runs by days", () => {
    current = createTestDb();
    const oldRunId = randomUUID();
    const recentRunId = randomUUID();

    current.db.createRUN({
      runId: oldRunId,
      csvPath: "/tmp/old.csv",
      createdAt: Date.now(),
      status: "completed",
      totalTracks: 10,
      processedTracks: 10,
      matchedTracks: 8,
      failedTracks: 2,
      skippedTracks: 0,
      playlistId: undefined,
    });

    current.db.createRUN({
      runId: recentRunId,
      csvPath: "/tmp/recent.csv",
      createdAt: Date.now(),
      status: "completed",
      totalTracks: 5,
      processedTracks: 5,
      matchedTracks: 5,
      failedTracks: 0,
      skippedTracks: 0,
      playlistId: undefined,
    });

    const cleanup = current.db.cleanupOldRuns(30);
    expect(cleanup.success).toBe(true);
  });

  it("clears all runs", () => {
    current = createTestDb();

    for (let i = 0; i < 3; i++) {
      current.db.createRUN({
        runId: randomUUID(),
        csvPath: `/tmp/test${i}.csv`,
        createdAt: Date.now(),
        status: "completed",
        totalTracks: 10,
        processedTracks: 10,
        matchedTracks: 8,
        failedTracks: 2,
        skippedTracks: 0,
        playlistId: undefined,
      });
    }

    const clear = current.db.clearAllRuns();
    expect(clear.success).toBe(true);
  });

  it("upserts track batch", () => {
    current = createTestDb();
    const runId = randomUUID();

    current.db.database.run(
      `INSERT INTO progress_runs (run_id, csv_path, created_at, status, total_tracks, processed_tracks, matched_tracks, failed_tracks, skipped_tracks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        runId,
        "/tmp/batch.csv",
        new Date().toISOString(),
        "running",
        3,
        0,
        0,
        0,
        0,
      ],
    );

    const inputs: UpsertTrackInput[] = [
      {
        runId,
        trackKey: "track:1",
        track: {
          uri: "spotify:track:1",
          name: "Song 1",
          album: "Album",
          artist: "Artist",
          duration: 180000,
        },
        matchResult: {
          track: {} as any,
          youtubeSong: null,
          confidence: "none",
          matchReason: "none",
        },
        status: "matched",
      },
      {
        runId,
        trackKey: "track:2",
        track: {
          uri: "spotify:track:2",
          name: "Song 2",
          album: "Album",
          artist: "Artist",
          duration: 200000,
        },
        matchResult: {
          track: {} as any,
          youtubeSong: null,
          confidence: "none",
          matchReason: "none",
        },
        status: "failed",
        errorMessage: "not found",
      },
      {
        runId,
        trackKey: "track:3",
        track: {
          uri: "spotify:track:3",
          name: "Song 3",
          album: "Album",
          artist: "Artist",
          duration: 150000,
        },
        matchResult: {
          track: {} as any,
          youtubeSong: null,
          confidence: "none",
          matchReason: "none",
        },
        status: "skipped",
      },
    ];

    const batch = current.db.upsertTrackBatch(inputs);
    expect(batch.success).toBe(true);

    const keys = current.db.getProcessedTrackKeys(runId);
    const keyRows = Array.isArray(keys.data) ? keys.data : [];
    expect(keyRows.length).toBe(3);
  });

  it("lists matched tracks", () => {
    current = createTestDb();
    const runId = randomUUID();

    current.db.createRUN({
      runId,
      csvPath: "/tmp/matched.csv",
      createdAt: Date.now(),
      status: "running",
      totalTracks: 3,
      processedTracks: 0,
      matchedTracks: 0,
      failedTracks: 0,
      skippedTracks: 0,
      playlistId: undefined,
    });

    const result = current.db.listMatchedTracks(runId);
    expect(result.success).toBe(true);
  });

  it("lists matched tracks with failed ones excluded", () => {
    current = createTestDb();
    const runId = randomUUID();

    current.db.createRUN({
      runId,
      csvPath: "/tmp/matched.csv",
      createdAt: Date.now(),
      status: "running",
      totalTracks: 3,
      processedTracks: 0,
      matchedTracks: 0,
      failedTracks: 0,
      skippedTracks: 0,
      playlistId: undefined,
    });

    current.db.upsertTrack({
      runId,
      trackKey: "track:2",
      track: {
        uri: "spotify:track:2",
        name: "Song 2",
        album: "Album",
        artist: "Artist",
        duration: 200000,
      },
      matchResult: {
        track: {} as any,
        youtubeSong: null,
        confidence: "none",
        matchReason: "none",
      },
      status: "failed",
    });

    const matched = current.db.listMatchedTracks(runId);
    const rows = Array.isArray(matched.data) ? matched.data : [];
    expect(rows.length).toBe(0);
  });

  it("handles empty database gracefully", () => {
    current = createTestDb();

    const summaries = current.db.listRunSummaries(10);
    expect(summaries.success).toBe(true);
    expect(Array.isArray(summaries.data)).toBe(true);

    const failed = current.db.listFailedTracks("non-existent", 10);
    expect(failed.success).toBe(true);
    expect(Array.isArray(failed.data)).toBe(true);

    const matched = current.db.listMatchedTracks("non-existent");
    expect(matched.success).toBe(true);
    expect(Array.isArray(matched.data)).toBe(true);
  });
});
