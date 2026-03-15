import { Database } from "bun:sqlite";
import { t } from "./i18n.js";
import type {
  ProgressRun,
  RunStatsDelta,
  RunStatus,
  UpsertTrackInput,
} from "../types/index.js";

/**
 * 用于 SQL 模板字符串的 tag，便于 Prettier 格式化 SQL 内容
 * @param {TemplateStringsArray} strings - 模板字符串数组
 * @param {unknown[]} exprs - 可变参数列表
 * @returns {string} 拼接后的 SQL 字符串
 */
const sql = (strings: TemplateStringsArray, ...exprs: unknown[]) =>
  strings.reduce((acc, s, i) => {
    const expr = exprs[i];
    if (expr === null || expr === undefined) return acc + s;
    if (typeof expr === "string") return acc + s + expr;
    if (typeof expr === "number" || typeof expr === "boolean") {
      return acc + s + String(expr);
    }
    if (typeof expr === "bigint") return acc + s + expr.toString();
    if (expr instanceof Date) return acc + s + expr.toISOString();
    const serialized = JSON.stringify(expr);
    return acc + s + (serialized ?? "");
  }, "");

/**
 * 表示操作结果的类型
 */
export interface DBResult {
  /** 操作是否成功 */
  success: boolean;
  /** 可选的数据，包含在操作成功时返回 */
  data?: unknown;
  /** 可选的错误信息，包含在操作失败时返回 */
  error?: Error;
}

/**
 * DB类用于管理SQLite数据库连接和操作
 */
export class DB {
  private db: Database;

  /**
   * 获取底层数据库实例（用于测试）
   * @returns {Database} 数据库实例
   */
  get database(): Database {
    return this.db;
  }

  /**
   * 创建一个新的DB实例
   * @param {string} db_path - SQLite数据库文件的路径
   */
  constructor(db_path: string) {
    this.db = new Database(db_path);
  }

  /**
   * 初始化数据库，创建必要的表和索引
   */
  init() {
    // 设置WAL模式以提高性能
    this.db.run("PRAGMA journal_mode = WAL;");

    //开启外键支持
    this.db.run("PRAGMA foreign_keys = ON;");

    // 创建progress_runs表，如果不存在的话
    this.db.run(sql`
      CREATE TABLE IF NOT EXISTS progress_runs (
        run_id TEXT PRIMARY KEY NOT NULL,
        csv_path TEXT NOT NULL,
        created_at TEXT NOT NULL, -- created_at 使用ISO8601字符串格式存储
        status TEXT CHECK (
          status IN ('running', 'completed', 'failed', 'paused')
        ),
        total_tracks INTEGER,
        processed_tracks INTEGER DEFAULT 0,
        matched_tracks INTEGER DEFAULT 0,
        failed_tracks INTEGER DEFAULT 0,
        skipped_tracks INTEGER DEFAULT 0,
        playlist_id TEXT
      )
    `);
    // 创建importer_config表，如果不存在的话
    this.db.run(sql`
      CREATE TABLE IF NOT EXISTS importer_config (
        id INTEGER PRIMARY KEY DEFAULT 1,
        skip_confirmation BOOLEAN,
        min_confidence TEXT CHECK (
          min_confidence IN ('none', 'low', 'medium', 'high')
        ),
        request_delay INTEGER,
        save_progress BOOLEAN,
        progress_db_path TEXT,
        language TEXT CHECK (language IN ('en', 'zh-CN', 'ja')),
        proxy_url TEXT
      )
    `);
    // 创建import_tracks表，如果不存在的话
    this.db.run(sql`
      CREATE TABLE IF NOT EXISTS import_tracks (
        uuid TEXT PRIMARY KEY NOT NULL,
        track_key TEXT NOT NULL,
        track_json TEXT NOT NULL,
        match_result_json TEXT NOT NULL,
        status TEXT CHECK (status IN ('matched', 'skipped', 'failed')),
        error_message TEXT,
        updated_at TEXT NOT NULL, -- 使用ISO8601字符串格式存储
        run_id TEXT NOT NULL,
        FOREIGN KEY (run_id) REFERENCES progress_runs (run_id),
        UNIQUE (run_id, track_key)
      )
    `);

    //创建索引以提高查询性能
    this.db.run(sql`
      CREATE INDEX IF NOT EXISTS idx_import_tracks_run_id ON import_tracks (run_id);
    `);
    this.db.run(sql`
      CREATE INDEX IF NOT EXISTS idx_progress_runs_created_at ON progress_runs (created_at);
    `);

    // 数据库迁移：为现有的 importer_config 表添加 proxy_url 字段（如果不存在）
    this.migrateAddProxyUrl();
  }

  /**
   * 迁移：为 importer_config 表添加 proxy_url 字段
   * @private
   */
  private migrateAddProxyUrl(): void {
    try {
      /** 表结构信息 */
      const tableInfo = this.db
        .query("PRAGMA table_info(importer_config)")
        .all() as {
        /** 列名 */
        name: string;
      }[];
      /** 是否已存在 proxy_url 字段 */
      const hasProxyUrl = tableInfo.some((col) => col.name === "proxy_url");

      if (!hasProxyUrl) {
        this.db.run(sql`
          ALTER TABLE importer_config
          ADD COLUMN proxy_url TEXT
        `);
        console.log("Database migrated: Added proxy_url column");
      }
    } catch (error) {
      // 如果表不存在或迁移失败，忽略错误（表刚创建时已包含该字段）
      console.warn("Migration warning:", error);
    }
  }

  /**
   * 创建一个新的运行记录
   * @param {ProgressRun} config - 包含运行配置的对象
   * @returns {DBResult} 表示操作结果的对象
   */
  createRUN(config: ProgressRun): DBResult {
    const createdAt = new Date().toISOString();
    if (config.csvPath === undefined) {
      console.log(t("error_csvpath_undefined"));
      return {
        success: false,
        error: new Error("csvPath is required"),
      };
    } else if (config.runId === undefined) {
      console.log(t("error_runid_undefined"));
      return {
        success: false,
        error: new Error("runId is required"),
      };
    } else if (
      config.totalTracks === undefined ||
      isNaN(config.totalTracks) ||
      config.totalTracks < 0
    ) {
      console.log(t("error_totaltracks_invalid"));
      return {
        success: false,
        error: new Error(
          "totalTracks is required and must be a non-negative number",
        ),
      };
    }

    try {
      this.db.run(
        sql`
          INSERT INTO
            progress_runs (
              run_id,
              csv_path,
              created_at,
              status,
              total_tracks,
              playlist_id
            )
          VALUES
            (?, ?, ?, ?, ?, ?)
        `,
        [
          config.runId,
          config.csvPath,
          createdAt,
          "running",
          config.totalTracks,
          config.playlistId || null,
        ],
      );
      return { success: true };
    } catch (error) {
      console.log(t("error_create_run_failed", { error: String(error) }));
      return {
        success: false,
        error: new Error("Failed to create run", { cause: error }),
      };
    }
  }

  /**
   * 列出最近的运行记录
   * @param {number} limit - 要返回的记录数量，默认为10
   * @returns {DBResult} 表示操作结果的对象
   */
  listRuns(limit = 10): DBResult {
    const result = this.db
      .prepare(sql`
        SELECT
          *
        FROM
          progress_runs
        ORDER BY
          created_at DESC
        LIMIT
          ?
      `)
      .all(limit);

    return { success: true, data: result };
  }

  /**
   * 根据运行ID查询特定的运行记录
   * @param {string} runId - 要查询的运行记录的ID
   * @returns {DBResult} 表示操作结果的对象
   */
  getRunById(runId: string): DBResult {
    if (!runId) {
      return { success: false, error: new Error("runId is required") };
    }

    const result = this.db
      .prepare(sql`
        SELECT
          *
        FROM
          progress_runs
        WHERE
          run_id = ?
      `)
      .all(runId);

    return { success: true, data: result };
  }

  /**
   * 更新运行记录的状态和统计信息,非批量化方法,不要频繁调用
   * @param {UpsertTrackInput} input - 包含要写入数据库的曲目信息和匹配结果的对象
   * @returns {DBResult} 表示操作结果的对象
   */
  upsertTrack(input: UpsertTrackInput): DBResult {
    const updatedAt = input.updatedAt || new Date().toISOString();
    if (!input.runId) {
      return { success: false, error: new Error("runId is required") };
    } else if (!input.trackKey) {
      return { success: false, error: new Error("trackKey is required") };
    } else if (!input.track) {
      return { success: false, error: new Error("track is required") };
    } else if (!input.matchResult) {
      return { success: false, error: new Error("matchResult is required") };
    } else if (!input.status) {
      return { success: false, error: new Error("status is required") };
    }

    const uuid = `${input.runId}:${input.trackKey}`;

    try {
      this.db.run(
        sql`
          INSERT INTO
            import_tracks (
              uuid,
              track_key,
              track_json,
              match_result_json,
              status,
              error_message,
              updated_at,
              run_id
            )
          VALUES
            (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (run_id, track_key) DO UPDATE
          SET
            track_json = excluded.track_json,
            match_result_json = excluded.match_result_json,
            status = excluded.status,
            error_message = excluded.error_message,
            updated_at = excluded.updated_at
        `,
        [
          uuid,
          input.trackKey,
          JSON.stringify(input.track),
          JSON.stringify(input.matchResult),
          input.status,
          input.errorMessage || null,
          updatedAt,
          input.runId,
        ],
      );
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: new Error("Failed to upsert track", { cause: error }),
      };
    }
  }

  /**
   * 批量更新运行记录的状态和统计信息,使用事务批量写入以提高性能,适用于大量曲目数据的写入操作
   * @param {UpsertTrackInput[]} inputs - 包含要写入数据库的曲目信息和匹配结果的对象数组
   * @returns {DBResult} 表示操作结果的对象
   */
  upsertTrackBatch(inputs: UpsertTrackInput[]): DBResult {
    const updatedAt = new Date().toISOString();
    const insertStmt = this.db.prepare(sql`
      INSERT INTO
        import_tracks (
          uuid,
          track_key,
          track_json,
          match_result_json,
          status,
          error_message,
          updated_at,
          run_id
        )
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (run_id, track_key) DO UPDATE
      SET
        track_json = excluded.track_json,
        match_result_json = excluded.match_result_json,
        status = excluded.status,
        error_message = excluded.error_message,
        updated_at = excluded.updated_at
    `);
    const runBatch = this.db.transaction(() => {
      for (const input of inputs) {
        if (!input.runId) {
          throw new Error("runId is required");
        } else if (!input.trackKey) {
          throw new Error("trackKey is required");
        } else if (!input.track) {
          throw new Error("track is required");
        } else if (!input.matchResult) {
          throw new Error("matchResult is required");
        } else if (!input.status) {
          throw new Error("status is required");
        }

        const uuid = `${input.runId}:${input.trackKey}`;
        insertStmt.run(
          uuid,
          input.trackKey,
          JSON.stringify(input.track),
          JSON.stringify(input.matchResult),
          input.status,
          input.errorMessage || null,
          input.updatedAt || updatedAt,
          input.runId,
        );
      }
    });

    try {
      runBatch();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: new Error("Failed to upsert track batch", { cause: error }),
      };
    }
  }

  /**
   * 更新运行记录的统计信息
   * @param {string} runId 运行记录的ID
   * @param {RunStatsDelta} deltas 统计信息的增量
   * @returns {DBResult} 表示操作结果的对象
   */
  updateRunStats(runId: string, deltas: RunStatsDelta): DBResult {
    this.db.run(
      sql`
        UPDATE progress_runs
        SET
          processed_tracks = processed_tracks + ?,
          matched_tracks = matched_tracks + ?,
          failed_tracks = failed_tracks + ?,
          skipped_tracks = skipped_tracks + ?
        WHERE
          run_id = ?
      `,
      [
        deltas.processedTracks || 0,
        deltas.matchedTracks || 0,
        deltas.failedTracks || 0,
        deltas.skippedTracks || 0,
        runId,
      ],
    );
    return { success: true };
  }

  /**
   * 更新运行记录的状态
   * @param {string} runId 运行记录的ID
   * @param {RunStatus} status 要更新的状态
   * @returns {DBResult} 表示操作结果的对象
   */
  updateRunStatus(runId: string, status: RunStatus): DBResult {
    this.db.run(
      sql`
        UPDATE progress_runs
        SET
          status = ?
        WHERE
          run_id = ?
      `,
      [status, runId],
    );
    return { success: true };
  }

  /**
   * 获取运行记录摘要列表（用于TUI展示）
   * @param {number} limit - 要返回的记录数量
   * @returns {DBResult} 表示操作结果的对象
   */
  listRunSummaries(limit = 20): DBResult {
    const result = this.db
      .prepare(sql`
        SELECT
          run_id,
          csv_path,
          created_at,
          status,
          total_tracks,
          processed_tracks,
          matched_tracks,
          failed_tracks,
          skipped_tracks
        FROM
          progress_runs
        ORDER BY
          created_at DESC
        LIMIT
          ?
      `)
      .all(limit);

    return { success: true, data: result };
  }

  /**
   * 获取某次运行已处理的track_key集合
   * @param {string} runId - 运行记录的ID
   * @returns {DBResult} 表示操作结果的对象
   */
  getProcessedTrackKeys(runId: string): DBResult {
    if (!runId) {
      return { success: false, error: new Error("runId is required") };
    }

    const result = this.db
      .prepare(sql`
        SELECT
          track_key
        FROM
          import_tracks
        WHERE
          run_id = ?
      `)
      .all(runId);

    return { success: true, data: result };
  }

  /**
   * 获取失败的匹配记录（用于TUI/失败列表）
   * @param {string} runId - 运行记录的ID
   * @param {number} limit - 返回数量限制
   * @returns {DBResult} 表示操作结果的对象
   */
  listFailedTracks(runId: string, limit = 50): DBResult {
    if (!runId) {
      return { success: false, error: new Error("runId is required") };
    }

    const result = this.db
      .prepare(sql`
        SELECT
          track_json,
          match_result_json,
          error_message,
          updated_at
        FROM
          import_tracks
        WHERE
          run_id = ?
          AND status = 'failed'
        ORDER BY
          updated_at DESC
        LIMIT
          ?
      `)
      .all(runId, limit);

    return { success: true, data: result };
  }

  /**
   * 读取全局配置（单行）
   * @returns {DBResult} 表示操作结果的对象
   */
  getConfig(): DBResult {
    const result = this.db
      .prepare(sql`
        SELECT
          *
        FROM
          importer_config
        WHERE
          id = 1
      `)
      .get();

    return { success: true, data: result || null };
  }

  /**
   * 写入全局配置（单行）
   * @param {Record<string, unknown>} config - 配置对象
   * @returns {DBResult} 表示操作结果的对象
   */
  upsertConfig(config: Record<string, unknown>): DBResult {
    const existing = (this.getConfig().data ?? {}) as Record<string, unknown>;
    /**
     * 检查配置对象中是否包含指定的键
     * @param {string} key - 要检查的键名
     * @returns {boolean} 如果配置对象中存在该键，则返回 true；否则返回 false
     */
    const has = (key: string) =>
      Object.prototype.hasOwnProperty.call(config, key);

    const payload: Record<string, unknown> = {
      skip_confirmation: has("skipConfirmation")
        ? config.skipConfirmation
        : (existing.skip_confirmation ?? null),
      min_confidence: has("minConfidence")
        ? config.minConfidence
        : (existing.min_confidence ?? null),
      request_delay: has("requestDelay")
        ? config.requestDelay
        : (existing.request_delay ?? null),
      save_progress: has("saveProgress")
        ? config.saveProgress
        : (existing.save_progress ?? null),
      progress_db_path: has("progressDbPath")
        ? config.progressDbPath
        : (existing.progress_db_path ?? null),
      language: has("language") ? config.language : (existing.language ?? null),
      proxy_url: has("proxyUrl")
        ? config.proxyUrl
        : (existing.proxy_url ?? null),
    };

    this.db.run(
      sql`
        INSERT INTO
          importer_config (
            id,
            skip_confirmation,
            min_confidence,
            request_delay,
            save_progress,
            progress_db_path,
            language,
            proxy_url
          )
        VALUES
          (1, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (id) DO UPDATE
        SET
          skip_confirmation = excluded.skip_confirmation,
          min_confidence = excluded.min_confidence,
          request_delay = excluded.request_delay,
          save_progress = excluded.save_progress,
          progress_db_path = excluded.progress_db_path,
          language = excluded.language,
          proxy_url = excluded.proxy_url
      `,
      [
        payload.skip_confirmation as boolean | null,
        payload.min_confidence as string | null,
        payload.request_delay as number | null,
        payload.save_progress as boolean | null,
        payload.progress_db_path as string | null,
        payload.language as string | null,
        payload.proxy_url as string | null,
      ],
    );

    return { success: true };
  }

  /**
   * 获取匹配的曲目记录（用于报告统计）
   * @param {string} runId - 运行记录的ID
   * @returns {DBResult} 表示操作结果的对象
   */
  listMatchedTracks(runId: string): DBResult {
    if (!runId) {
      return { success: false, error: new Error("runId is required") };
    }

    const result = this.db
      .prepare(sql`
        SELECT
          track_json,
          match_result_json
        FROM
          import_tracks
        WHERE
          run_id = ?
          AND status = 'matched'
      `)
      .all(runId);

    return { success: true, data: result };
  }

  /**
   * 删除指定日期之前的运行记录
   * @param {number} days - 保留天数
   * @returns {DBResult} 表示操作结果的对象
   */
  cleanupOldRuns(days: number): DBResult {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoff = cutoffDate.toISOString();

    const deleteTracks = this.db.run(sql`
      DELETE FROM import_tracks
      WHERE
        run_id IN (
          SELECT
            run_id
          FROM
            import_runs
          WHERE
            created_at < ${cutoff}
        )
    `);

    const deleteRuns = this.db.run(sql`
      DELETE FROM import_runs
      WHERE
        created_at < ${cutoff}
    `);

    return {
      success: true,
      data: { tracksDeleted: deleteTracks, runsDeleted: deleteRuns },
    };
  }

  /**
   * 删除所有运行记录
   * @returns {DBResult} 表示操作结果的对象
   */
  clearAllRuns(): DBResult {
    this.db.run(sql`DELETE FROM import_tracks`);
    this.db.run(sql`DELETE FROM import_runs`);

    return { success: true, data: { cleared: true } };
  }
}
