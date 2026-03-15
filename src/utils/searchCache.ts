import { Database } from "bun:sqlite";
import type { YouTubeSong } from "../types/index.js";

const CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24小时

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
 * 搜索结果缓存类，使用SQLite数据库存储搜索结果
 */
export class SearchCache {
  private db: Database;

  /**
   * 创建SearchCache实例
   * @param {string} path SQLite数据库文件路径
   */
  constructor(path: string) {
    this.db = new Database(path);
    this.init();
  }

  /**
   * 初始化数据库，创建search_cache表
   */
  private init(): void {
    this.db.run("PRAGMA journal_mode = WAL;");
    this.db.run(sql`
      CREATE TABLE IF NOT EXISTS search_cache (
        query TEXT PRIMARY KEY NOT NULL,
        result_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    this.db.run(sql`
      CREATE INDEX IF NOT EXISTS idx_search_cache_updated_at ON search_cache (updated_at)
    `);
  }

  /**
   * 从缓存中获取搜索结果，若缓存过期自动删除
   * @param {string} query 搜索查询字符串
   * @returns {YouTubeSong[] | null} YouTube歌曲数组或null
   */
  get(query: string): YouTubeSong[] | null {
    if (!query) return null;

    const row = this.db
      .prepare(sql`
        SELECT
          result_json,
          updated_at
        FROM
          search_cache
        WHERE
          query = ?
        LIMIT
          1
      `)
      .get(query) as
      | {
          /** 缓存查询结果*/
          result_json?: string;
          /** 缓存更新时间（ISO 8601 字符串）*/
          updated_at?: string;
        }
      | undefined;

    if (!row?.result_json || !row?.updated_at) return null;

    const now = new Date().getTime();
    const updatedAtMs = new Date(row.updated_at).getTime();

    if (now - updatedAtMs > CACHE_EXPIRATION_MS) {
      // 缓存过期，删除缓存
      this.db.run(
        sql`
          DELETE FROM search_cache
          WHERE
            query = ?
        `,
        [query],
      );
      return null;
    }

    try {
      const parsed = JSON.parse(row.result_json) as unknown;
      if (Array.isArray(parsed)) {
        return parsed as YouTubeSong[];
      }
    } catch {
      return null;
    }

    return null;
  }

  /**
   * 将搜索结果存储到缓存中
   * @param {string} query 搜索查询字符串
   * @param {YouTubeSong[]} songs YouTube歌曲数组
   */
  set(query: string, songs: YouTubeSong[]): void {
    if (!query) return;

    const payload = JSON.stringify(songs ?? []);
    const now = new Date().toISOString();
    this.db.run(
      sql`
        INSERT INTO
          search_cache (query, result_json, updated_at)
        VALUES
          (?, ?, ?)
        ON CONFLICT (query) DO UPDATE
        SET
          result_json = excluded.result_json,
          updated_at = excluded.updated_at
      `,
      [query, payload, now],
    );
  }

  /**
   * 批量扫描并删除所有过期的缓存项（推荐在启动时或定期调用）
   * @returns {number} 删除的缓存项数量
   */
  cleanupExpiredCaches(): number {
    const now = new Date().toISOString();
    this.db.run(
      sql`
        DELETE FROM search_cache
        WHERE
          datetime(updated_at) < datetime(?, '-24 hours')
      `,
      [now],
    );

    const result = this.db.prepare("SELECT changes() as count").get() as
      | {
          /** 删除的数量 */
          count: number;
        }
      | undefined;
    const deletedCount = result?.count || 0;
    if (deletedCount > 0) {
      console.info(`Cleaned up ${deletedCount} expired cache entries.`);
    }
    return deletedCount;
  }
}
