import Searcher from "./searcher.js";
import { t } from "../utils/i18n.js";
import type { SearchCache } from "../utils/searchCache.js";
import type { SpotifyTrack, YouTubeSong } from "../types/index.js";

/**
 * 搜索工具类 - 提供静态搜索相关的工具函数
 */
export class SearchUtils {
  /**
   * 重试搜索歌曲
   * @param {SpotifyTrack} track Spotify曲目对象
   * @param {Searcher} searcher 搜索器实例
   * @param {SearchCache | undefined} searchCache 搜索缓存（可选）
   * @param {number} maxRetries 最大重试次数
   * @param {number} retryDelay 重试延迟（毫秒）
   * @returns {Promise<YouTubeSong[]>} 搜索结果数组
   */
  static async searchSongsWithRetry(
    track: SpotifyTrack,
    searcher: Searcher,
    searchCache: SearchCache | undefined,
    maxRetries: number,
    retryDelay: number,
  ): Promise<YouTubeSong[]> {
    const queries = this.getSearchQueryVariants(track);
    let lastError: unknown = null;
    let hadSuccessfulSearch = false;

    for (let qIndex = 0; qIndex < queries.length; qIndex += 1) {
      const query = queries[qIndex];
      if (!query) continue;
      let attempt = 0;

      if (searchCache) {
        const cached = searchCache.get(query);
        if (cached) {
          if (cached.length > 0) {
            return cached;
          }
          console.warn(t("search_no_results", { query }));
          if (qIndex < queries.length - 1) {
            console.warn(
              t("search_fallback", {
                query: queries[qIndex + 1] ?? "",
              }),
            );
          }
          continue;
        }
      }

      while (attempt <= maxRetries) {
        try {
          const searchResults = await searcher.searchSongs([query]);
          const songs = this.extractSongsFromResults(searchResults);
          hadSuccessfulSearch = true;
          if (searchCache) {
            searchCache.set(query, songs);
          }
          if (songs.length > 0) {
            return songs;
          }
          console.warn(t("search_no_results", { query }));
          break;
        } catch (error) {
          lastError = error;

          // 认证错误不重试，直接失败并提示用户
          if (this.isAuthenticationError(error)) {
            console.error(
              t("cookies_expired", {
                reason: this.getErrorMessage(error),
              }),
            );
            throw error;
          }

          const retryable = this.isRetryableError(error);
          if (!retryable || attempt >= maxRetries) {
            break;
          }

          const delayMs = this.getRetryDelayMs(attempt, error, retryDelay);
          const reasonKey = this.isRateLimitError(error)
            ? "search_retry_reason_rate_limited"
            : "search_retry_reason_error";
          console.warn(
            t("search_retrying", {
              reason: t(reasonKey),
              attempt: String(attempt + 1),
              max: String(maxRetries),
              seconds: String(Math.round(delayMs / 1000)),
            }),
          );
          await this.sleep(delayMs);
          attempt += 1;
        }
      }

      if (qIndex < queries.length - 1) {
        console.warn(
          t("search_fallback", {
            query: queries[qIndex + 1] ?? "",
          }),
        );
      }
    }

    if (hadSuccessfulSearch) {
      return [];
    }

    throw (lastError as Error) ?? new Error("Search failed after retries");
  }

  /**
   * 从搜索结果中提取歌曲列表
   * @param {unknown[]} searchResults 搜索结果
   * @returns {YouTubeSong[]} YouTube歌曲数组
   */
  static extractSongsFromResults(searchResults: unknown[]): YouTubeSong[] {
    const songs: YouTubeSong[] = [];

    for (const result of searchResults) {
      if (!result || typeof result !== "object") continue;
      const resultObj = result as Record<string, unknown>;
      const contents = resultObj.contents as unknown[] | undefined;
      if (!contents) continue;

      for (const item of contents) {
        if (!item || typeof item !== "object") continue;
        const itemRecord = item as Record<string, unknown>;
        const itemType =
          typeof itemRecord.type === "string" ? itemRecord.type : "";
        if (itemType !== "MusicShelf") continue;

        const shelfContents = itemRecord.contents as unknown[] | undefined;
        if (!shelfContents) continue;

        for (const song of shelfContents) {
          if (!song || typeof song !== "object") continue;
          const songRecord = song as {
            /** YouTube视频ID */
            id?: string;
            /** 歌曲标题 */
            title?: string;
            /** 歌曲时长 */
            duration?: {
              /** 时长文本 */
              text: string;
              /** 时长秒数 */
              seconds?: number;
            };
            /** 专辑信息 */
            album?: {
              /** 专辑名称 */
              name?: string;
            };
            /** 艺术家信息 */
            artists?: {
              /** 艺术家名称 */
              name?: string;
            }[];
            /** 缩略图信息 */
            thumbnail?: {
              /** 缩略图内容 */
              contents?: {
                /** 缩略图URL */
                url: string;
              }[];
            };
          };

          if (!songRecord.id && !songRecord.title) continue;

          const videoId = songRecord.id || "";
          const name = songRecord.title || "Unknown";
          const artistInfo = songRecord.artists || [];
          const artist = artistInfo[0]?.name || "Unknown";
          const albumInfo = songRecord.album;
          const album = albumInfo?.name;
          const durationSec = songRecord.duration?.seconds;
          const duration = durationSec ? durationSec * 1000 : undefined;
          const thumbnail = songRecord.thumbnail?.contents?.[0]?.url;

          songs.push({
            videoId,
            name,
            artist,
            album,
            duration,
            thumbnails: thumbnail
              ? [{ url: thumbnail, width: 120, height: 120 }]
              : undefined,
          });
        }
      }
    }

    return songs;
  }

  /**
   * 生成搜索查询变体
   * @param {SpotifyTrack} track Spotify曲目对象
   * @returns {string[]} 搜索查询变体数组
   */
  static getSearchQueryVariants(track: SpotifyTrack): string[] {
    const queries = [`${track.name} ${track.artist}`.trim()];
    if (track.name) {
      queries.push(track.name.trim());
    }
    if (track.artist) {
      queries.push(track.artist.trim());
    }

    const deduped = new Set<string>();
    for (const q of queries) {
      if (q) deduped.add(q);
    }
    return Array.from(deduped);
  }

  /**
   * 计算重试延迟时间
   * @param {number} attempt 当前尝试次数
   * @param {unknown} error 错误对象
   * @param {number} baseRetryDelay 基础重试延迟（毫秒）
   * @returns {number} 延迟时间（毫秒）
   */
  static getRetryDelayMs(
    attempt: number,
    error: unknown,
    baseRetryDelay: number,
  ): number {
    const backoff = baseRetryDelay * Math.pow(2, attempt);
    const jitter = Math.floor(Math.random() * 250);
    const rateLimitMultiplier = this.isRateLimitError(error) ? 2 : 1;
    return backoff * rateLimitMultiplier + jitter;
  }

  /**
   * 判断错误是否可重试
   * @param {unknown} error 错误对象
   * @returns {boolean} 是否可重试
   */
  static isRetryableError(error: unknown): boolean {
    if (this.isRateLimitError(error)) return true;

    const message = this.getErrorMessage(error).toLowerCase();
    return (
      message.includes("timeout") ||
      message.includes("timed out") ||
      message.includes("econnreset") ||
      message.includes("econnrefused") ||
      message.includes("network") ||
      message.includes("temporarily unavailable")
    );
  }

  /**
   * 判断错误是否为认证错误（401/403）
   * @param {unknown} error 错误对象
   * @returns {boolean} 是否为认证错误
   */
  static isAuthenticationError(error: unknown): boolean {
    if (!error) return false;
    if (typeof error === "string") {
      return (
        error.includes("401") ||
        error.includes("403") ||
        error.toLowerCase().includes("unauthorized") ||
        error.toLowerCase().includes("forbidden")
      );
    }

    const candidate = error as {
      /** 连接状态 */
      status?: number;
      /** HTTP状态码 */
      statusCode?: number;
      /** 错误代码 */
      code?: number | string;
      /** 错误消息 */
      message?: string;
    };
    if (candidate.status === 401 || candidate.statusCode === 401) return true;
    if (candidate.status === 403 || candidate.statusCode === 403) return true;
    if (candidate.code === 401 || candidate.code === "401") return true;
    if (candidate.code === 403 || candidate.code === "403") return true;

    const message = this.getErrorMessage(error).toLowerCase();
    return (
      message.includes("401") ||
      message.includes("403") ||
      message.includes("unauthorized") ||
      message.includes("forbidden") ||
      message.includes("access denied")
    );
  }

  /**
   * 判断错误是否为速率限制错误
   * @param {unknown} error 错误对象
   * @returns {boolean} 是否为速率限制错误
   */
  static isRateLimitError(error: unknown): boolean {
    if (!error) return false;
    if (typeof error === "string") {
      return error.includes("429") || error.toLowerCase().includes("too many");
    }

    const candidate = error as {
      /** 连接状态 */
      status?: number;
      /** HTTP状态码 */
      statusCode?: number;
      /** 错误代码 */
      code?: number | string;
      /** 错误消息 */
      message?: string;
    };
    if (candidate.status === 429 || candidate.statusCode === 429) return true;
    if (candidate.code === 429 || candidate.code === "429") return true;

    const message = this.getErrorMessage(error).toLowerCase();
    return message.includes("429") || message.includes("too many requests");
  }

  /**
   * 从错误对象中提取错误消息
   * @param {unknown} error 错误对象
   * @returns {string} 错误消息
   */
  static getErrorMessage(error: unknown): string {
    if (!error) return "";
    if (typeof error === "string") return error;
    if (error instanceof Error) return error.message;
    const candidate = error as {
      /** 错误消息 */
      message?: string;
    };
    return candidate.message ?? "";
  }

  /**
   * 睡眠指定时间
   * @param {number} ms 毫秒数
   * @returns {Promise<void>}
   */
  static async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
