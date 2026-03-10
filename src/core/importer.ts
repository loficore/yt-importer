import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import Searcher from "./searcher.js";
import { matchTrackWithCandidates } from "./matcher.js";
import { SearchUtils } from "./searchUtils.js";
import { ConcurrentSearcher } from "./conCurrentSearcher.js";
import { t } from "../utils/i18n.js";
import type { DB } from "../utils/db.js";
import { DEFAULT_CONFIG, type ImporterConfig } from "../utils/config.js";
import { SearchCache } from "../utils/searchCache.js";
import type {
  SpotifyTrack,
  YouTubeSong,
  MatchResult,
  MatchResultWithCandidates,
  ImportProgress,
  ImportStats,
  MatchConfidence,
} from "../types/index.js";

/** 导入器选项接口 */
export interface ImporterOptions {
  /** CSV文件路径 */
  csvPath: string;
  /** Cookies文件路径（可选） */
  cookiePath?: string;
  /** 导入配置（可选） */
  config?: Partial<ImporterConfig>;
  /** 运行ID（可选） */
  runId?: string;
  /** DB实例（可选） */
  db?: DB;
  /** 已处理曲目key集合（可选） */
  processedTrackKeys?: Set<string>;
  /** 导入进度回调（可选） */
  onProgress?: (payload: ImporterProgressPayload) => void;
}

/** 导入进度回调载荷 */
export interface ImporterProgressPayload {
  /** 总曲目数 */
  totalTracks: number;
  /** 已处理曲目数 */
  processedTracks: number;
  /** 已匹配曲目数 */
  matchedTracks: number;
  /** 失败曲目数 */
  failedTracks: number;
  /** 跳过曲目数 */
  skippedTracks: number;
  /** 当前处理曲目描述 */
  currentTrack?: string;
}

/** CSV记录接口 */
interface CsvRecord {
  /** Spotify曲目URI */
  "Track URI": string;
  /** 曲目名称 */
  "Track Name": string;
  /** 专辑名称 */
  "Album Name": string;
  /** 艺术家名称 */
  "Artist Name(s)": string;
  /** 时长（毫秒） */
  "Duration (ms)": string;
  /** 其他字段 */
  [key: string]: string;
}

/** 导入器类 */
export class Importer {
  private searcher: Searcher;
  private config: ImporterConfig;
  private progress: ImportProgress;
  private tracks: SpotifyTrack[] = [];
  private playlistId?: string;
  private csvPath: string;
  private runId?: string;
  private db?: DB;
  private processedTrackKeys: Set<string>;
  private searchCache?: SearchCache;
  private onProgress?: (payload: ImporterProgressPayload) => void;
  private pendingLowConfidence: MatchResultWithCandidates[] = [];

  /**
   * 构造函数
   * @param {ImporterOptions} options 导入选项
   */
  constructor(options: ImporterOptions) {
    this.searcher = new Searcher();
    this.csvPath = options.csvPath;
    const userConfig = options.config ?? {};
    this.config = {
      ...DEFAULT_CONFIG,
      ...userConfig,
      logLevel: userConfig.logLevel ?? DEFAULT_CONFIG.logLevel,
      maxRetries: userConfig.maxRetries ?? DEFAULT_CONFIG.maxRetries,
      retryDelay: userConfig.retryDelay ?? DEFAULT_CONFIG.retryDelay,
      enableCache: userConfig.enableCache ?? DEFAULT_CONFIG.enableCache,
      cachePath: userConfig.cachePath ?? DEFAULT_CONFIG.cachePath,
      batchSize: userConfig.batchSize ?? DEFAULT_CONFIG.batchSize,
    };

    this.progress = {
      totalTracks: 0,
      processedTracks: 0,
      matchedTracks: 0,
      failedTracks: 0,
      skippedTracks: 0,
      playlistId: undefined,
      matchResults: [],
      timestamp: Date.now(),
    };

    this.runId = options.runId;
    this.db = options.db;
    this.processedTrackKeys = options.processedTrackKeys ?? new Set();
    this.onProgress = options.onProgress;
    if (this.config.enableCache) {
      this.searchCache = new SearchCache(this.config.cachePath);
    }
    if (this.processedTrackKeys.size > 0) {
      this.progress.processedTracks = this.processedTrackKeys.size;
    }
  }

  /**
   * 初始化搜索器
   * @returns {Promise<void>}
   */
  async init(): Promise<void> {
    const cookiePath = "config/cookies.json";
    const innertubeOptions = {
      lang: "en",
      location: "US",
      proxy: this.config.proxyUrl,
    };
    if (existsSync(cookiePath)) {
      try {
        await this.searcher.init(innertubeOptions, cookiePath);
        console.log(t("searcher_init_with_cookies"));
        await this.validateCookies();
      } catch (error) {
        if (SearchUtils.isAuthenticationError(error)) {
          console.error(
            t("cookies_expired", {
              reason: SearchUtils.getErrorMessage(error),
            }),
          );
          throw new Error(
            "Cookies are invalid or expired. Please update config/cookies.json",
            { cause: error },
          );
        }
        throw error;
      }
    } else {
      await this.searcher.init(innertubeOptions, "");
      console.log(t("searcher_init_without_cookies"));
    }
  }

  /**
   * 验证 Cookies 是否有效
   * @returns {Promise<void>}
   */
  async validateCookies(): Promise<void> {
    try {
      const testQuery = "test";
      const searchResults = await this.searcher.searchSongs([testQuery]);
      const songs = SearchUtils.extractSongsFromResults(searchResults);
      if (songs && Array.isArray(songs)) {
        console.log(t("cookies_validation_passed"));
        return;
      }
    } catch (error) {
      if (SearchUtils.isAuthenticationError(error)) {
        console.error(
          t("cookies_expired", {
            reason: SearchUtils.getErrorMessage(error),
          }),
        );
        throw new Error(
          "Cookies are invalid or expired. Please update config/cookies.json",
          { cause: error },
        );
      }
      console.warn(t("cookies_validation_skipped"));
    }
  }

  /**
   * 加载CSV文件
   */
  loadCsv(): void {
    if (!existsSync(this.csvPath)) {
      throw new Error(`CSV file not found: ${this.csvPath}`);
    }

    const fileContent = readFileSync(this.csvPath, "utf-8");
    const records = parse<CsvRecord>(fileContent, {
      columns: true,
      skip_empty_lines: true,
    });

    this.tracks = records.map((record) => ({
      uri: record["Track URI"] || "",
      name: record["Track Name"] || "Unknown",
      album: record["Album Name"] || "Unknown",
      artist: record["Artist Name(s)"] || "Unknown",
      duration: Number.parseInt(record["Duration (ms)"] || "0", 10),
    }));

    this.progress.totalTracks = this.tracks.length;
    console.log(t("loaded_tracks", { count: String(this.tracks.length) }));
    this.emitProgress();
  }

  /**
   * 处理所有曲目（并发版本）
   * @returns {Promise<MatchResult[]>} 匹配结果数组
   */
  async processTracks(): Promise<MatchResult[]> {
    // 初始化并发搜索器
    const concurrentSearcher = new ConcurrentSearcher();
    concurrentSearcher.init(
      this.config.concurrency,
      this.config.searchQps,
      this.config.maxRetries,
      this.config.retryDelay,
      this.searchCache,
      this.searcher,
    );

    const confidenceOrder: MatchConfidence[] = [
      "none",
      "low",
      "medium",
      "high",
    ];
    const minIndex = confidenceOrder.indexOf(this.config.minConfidence);

    const startIndex =
      this.processedTrackKeys.size > 0 ? 0 : this.progress.processedTracks;

    // 🔑 第一阶段：发起所有搜索任务（不等待）
    const searchPromises = this.tracks.map((track, index) => {
      if (!track || index < startIndex) {
        return Promise.resolve(null);
      }

      const trackKey = this.getTrackKey(track);
      if (this.processedTrackKeys.has(trackKey)) {
        return Promise.resolve(null);
      }

      console.log(
        `\n${t("searching_track", { current: String(index + 1), total: String(this.tracks.length) })} ${track.name} - ${track.artist}`,
      );

      // 发起异步搜索（立即返回 Promise，后续由 worker 执行）
      return concurrentSearcher
        .searchTrack(track)
        .then((ytSongs) => ({
          index,
          track,
          trackKey,
          ytSongs,
          error: null as unknown,
        }))
        .catch((error) => ({
          index,
          track,
          trackKey,
          ytSongs: [] as YouTubeSong[],
          error,
        }));
    });

    // 🔑 第二阶段：等待所有搜索完成
    const searchResults = await Promise.all(searchPromises);

    // 🔑 第三阶段：单线程处理结果（匹配、置信度判断、DB 落盘）
    const results: MatchResult[] = [];
    for (const result of searchResults) {
      if (!result) continue;

      const { index, track, trackKey, ytSongs, error } = result;

      try {
        if (error) throw error;

        // 匹配 + 置信度判断
        const matchResult = matchTrackWithCandidates(track, ytSongs);
        results[index] = matchResult;
        this.progress.matchResults.push(matchResult);

        const confidence = matchResult.confidence;
        const meetsThreshold = confidenceOrder.indexOf(confidence) >= minIndex;

        let trackStatus: "matched" | "skipped" | "failed" = "failed";

        if (matchResult.confidence !== "none" && meetsThreshold) {
          this.progress.matchedTracks++;
          trackStatus = "matched";
          console.log(
            t("matched_track", {
              confidence: matchResult.confidence,
              reason: matchResult.matchReason,
            }),
          );
          if (matchResult.youtubeSong) {
            console.log(
              t("matched_track_result", {
                name: matchResult.youtubeSong.name,
                artist: matchResult.youtubeSong.artist,
              }),
            );
          }
        } else if (matchResult.confidence !== "none" && !meetsThreshold) {
          this.progress.skippedTracks++;
          trackStatus = "skipped";
          this.pendingLowConfidence.push(matchResult);
          console.log(
            t("skipped_low_confidence", {
              confidence: matchResult.confidence,
              minConfidence: this.config.minConfidence,
            }),
          );
          console.log(
            t("added_to_pending_queue", {
              count: String(matchResult.candidates.length),
            }),
          );
        } else {
          this.progress.failedTracks++;
          trackStatus = "failed";
          console.log(t("no_match_found"));
        }

        this.progress.processedTracks++;
        this.recordDbProgress(track, trackKey, matchResult, trackStatus);
      } catch (err) {
        console.error(t("error_processing_track", { error: String(err) }));
        this.progress.failedTracks++;
        this.progress.processedTracks++;
        this.recordDbFailure(track, trackKey, String(err));
      }

      this.emitProgress(`${track.name} - ${track.artist}`);
    }

    // 保存最终进度
    this.saveProgress();

    return results.filter((r) => r !== undefined);
  }

  /**
   * 设置导入进度回调
   * @param {(payload: ImporterProgressPayload) => void | undefined} onProgress 进度回调
   */
  setProgressCallback(
    onProgress?: (payload: ImporterProgressPayload) => void,
  ): void {
    this.onProgress = onProgress;
  }

  /**
   * 发送当前进度
   * @param {string | undefined} currentTrack 当前曲目
   */
  private emitProgress(currentTrack?: string): void {
    this.onProgress?.({
      totalTracks: this.progress.totalTracks,
      processedTracks: this.progress.processedTracks,
      matchedTracks: this.progress.matchedTracks,
      failedTracks: this.progress.failedTracks,
      skippedTracks: this.progress.skippedTracks,
      currentTrack,
    });
  }

  /**
   * 创建YouTube Music播放列表
   * @param {string} name 播放列表名称
   * @returns {Promise<void>}
   */
  async createPlaylist(name: string): Promise<void> {
    try {
      this.playlistId = await this.searcher.createPlaylist(name);
      this.progress.playlistId = this.playlistId;
      console.log(t("created_playlist", { name, id: String(this.playlistId) }));
    } catch (error) {
      console.error(t("failed_create_playlist", { error: String(error) }));
      throw error;
    }
  }

  /**
   * 将匹配结果导入到播放列表
   * @param {string} playlistId 播放列表ID
   * @param {MatchResult[]} results 匹配结果数组
   * @returns {Promise<{ success: number; failed: number }>} 成功和失败数量
   */
  async importToPlaylist(
    playlistId: string,
    results: MatchResult[],
  ): Promise<{
    /** 成功的数量    */
    success: number;
    /** 失败的数量 */ failed: number;
  }> {
    const videoIds: string[] = [];
    const confidenceOrder: MatchConfidence[] = [
      "none",
      "low",
      "medium",
      "high",
    ];
    const minIndex = confidenceOrder.indexOf(this.config.minConfidence);

    for (const result of results) {
      if (result.youtubeSong && result.confidence !== "none") {
        if (confidenceOrder.indexOf(result.confidence) >= minIndex) {
          videoIds.push(result.youtubeSong.videoId);
        }
      }
    }

    console.log(t("importing_songs", { count: String(videoIds.length) }));

    /** 成功数量 */
    let success = 0;
    /** 失败数量 */
    let failed = 0;
    /** 批次大小 */
    const batchSize = 50;

    for (let i = 0; i < videoIds.length; i += batchSize) {
      const batch = videoIds.slice(i, i + batchSize);
      try {
        await this.searcher.addToPlaylist(playlistId, batch);
        success += batch.length;
        console.log(
          t("added_batch_songs", {
            current: String(Math.min(i + batchSize, videoIds.length)),
            total: String(videoIds.length),
          }),
        );
      } catch {
        failed += batch.length;
        console.error(
          t("failed_add_batch", {
            batch: String(Math.floor(i / batchSize) + 1),
          }),
        );
        if (this.config.requestDelay > 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.config.requestDelay),
          );
        }
      }
    }

    /**
     * 导入结果
     * @type {{ success: number; failed: number }}
     */
    return { success, failed };
  }

  /**
   * 增量导入到已有播放列表
   * @param {string} playlistId 播放列表ID
   * @param {MatchResult[]} results 匹配结果数组
   * @returns {Promise<{ success: number; failed: number; skipped: number; skippedTracks: string[] }>} 成功、失败和跳过的数量及跳过曲目列表
   */
  async importToExistingPlaylist(
    playlistId: string,
    results: MatchResult[],
  ): Promise<{
    /** 成功的数量 */
    success: number;
    /** 失败的数量 */
    failed: number;
    /** 跳过的数量 */
    skipped: number;
    /** 跳过的曲目列表 */
    skippedTracks: string[];
  }> {
    const existingTracks = await this.searcher.getPlaylistTracks(playlistId);
    const existingVideoIds = new Set(existingTracks.map((t) => t.videoId));

    const confidenceOrder: MatchConfidence[] = [
      "none",
      "low",
      "medium",
      "high",
    ];
    const minIndex = confidenceOrder.indexOf(this.config.minConfidence);

    const newVideoIds: string[] = [];
    const skippedTracks: string[] = [];

    for (const result of results) {
      if (result.youtubeSong && result.confidence !== "none") {
        if (confidenceOrder.indexOf(result.confidence) >= minIndex) {
          const videoId = result.youtubeSong.videoId;
          if (existingVideoIds.has(videoId)) {
            skippedTracks.push(
              `${result.youtubeSong.name} - ${result.youtubeSong.artist}`,
            );
          } else {
            newVideoIds.push(videoId);
          }
        }
      }
    }

    console.log(
      t("incremental_import_summary", {
        newCount: String(newVideoIds.length),
        skippedCount: String(skippedTracks.length),
      }),
    );

    if (skippedTracks.length > 0) {
      console.log(`\n${t("skipped_tracks_title")} (${skippedTracks.length}):`);
      const displayCount = Math.min(skippedTracks.length, 10);
      for (let i = 0; i < displayCount; i++) {
        console.log(`  - ${skippedTracks[i]}`);
      }
      if (skippedTracks.length > 10) {
        console.log(`  ... and ${skippedTracks.length - 10} more`);
      }
    }

    if (newVideoIds.length === 0) {
      console.log(t("no_new_tracks_to_import"));
      return {
        success: 0,
        failed: 0,
        skipped: skippedTracks.length,
        skippedTracks,
      };
    }

    console.log(t("importing_songs", { count: String(newVideoIds.length) }));

    let success = 0;
    let failed = 0;
    const batchSize = 50;

    for (let i = 0; i < newVideoIds.length; i += batchSize) {
      const batch = newVideoIds.slice(i, i + batchSize);
      try {
        await this.searcher.addToPlaylist(playlistId, batch);
        success += batch.length;
        console.log(
          t("added_batch_songs", {
            current: String(Math.min(i + batchSize, newVideoIds.length)),
            total: String(newVideoIds.length),
          }),
        );
      } catch {
        failed += batch.length;
        console.error(
          t("failed_add_batch", {
            batch: String(Math.floor(i / batchSize) + 1),
          }),
        );
        if (this.config.requestDelay > 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.config.requestDelay),
          );
        }
      }
    }

    return { success, failed, skipped: skippedTracks.length, skippedTracks };
  }

  /**
   * 解析歌曲时长
   * @param {string} durationStr 时长字符串（格式为 "HH:MM:SS" 或 "MM:SS"）
   * @returns {number} 时长（毫秒）
   */
  private parseDuration(durationStr: string): number {
    const parts = durationStr.split(":").map(Number);
    if (parts.length === 3) {
      const hours = parts[0] ?? 0;
      const minutes = parts[1] ?? 0;
      const seconds = parts[2] ?? 0;
      return (hours * 3600 + minutes * 60 + seconds) * 1000;
    }
    if (parts.length === 2) {
      const minutes = parts[0] ?? 0;
      const seconds = parts[1] ?? 0;
      return (minutes * 60 + seconds) * 1000;
    }
    return 0;
  }

  /**
   * 生成曲目唯一键
   * @param {SpotifyTrack} track Spotify曲目对象
   * @returns {string} 曲目唯一键
   */
  private getTrackKey(track: SpotifyTrack): string {
    const uri = track.uri?.trim();
    if (uri) return uri;
    return `${track.name}|${track.artist}|${track.duration}`;
  }

  /**
   * 记录数据库进度
   * @param {SpotifyTrack} track Spotify曲目对象
   * @param {string} trackKey 曲目唯一键
   * @param {MatchResult} matchResult 匹配结果对象
   * @param {"matched" | "skipped" | "failed"} status 匹配状态
   */
  private recordDbProgress(
    track: SpotifyTrack,
    trackKey: string,
    matchResult: MatchResult,
    status: "matched" | "skipped" | "failed",
  ): void {
    if (!this.db || !this.runId) return;

    this.db.upsertTrack({
      runId: this.runId,
      trackKey,
      track,
      matchResult,
      status,
    });

    this.db.updateRunStats(this.runId, {
      processedTracks: 1,
      matchedTracks: status === "matched" ? 1 : 0,
      failedTracks: status === "failed" ? 1 : 0,
      skippedTracks: status === "skipped" ? 1 : 0,
    });
  }

  /**
   * 记录数据库失败信息
   * @param {SpotifyTrack} track Spotify曲目对象
   * @param {string} trackKey 曲目唯一键
   * @param {string} errorMessage 错误消息
   */
  private recordDbFailure(
    track: SpotifyTrack,
    trackKey: string,
    errorMessage: string,
  ): void {
    if (!this.db || !this.runId) return;

    this.db.updateRunStats(this.runId, {
      processedTracks: 1,
      failedTracks: 1,
    });

    this.db.upsertTrack({
      runId: this.runId,
      trackKey,
      track,
      matchResult: {
        track,
        youtubeSong: null,
        confidence: "none",
        matchReason: "none",
      },
      status: "failed",
      errorMessage,
    });
  }

  /**
   * 保存当前进度到文件
   */
  saveProgress(): void {
    if (this.config.saveProgress) {
      writeFileSync(
        this.config.progressFile,
        JSON.stringify(this.progress, null, 2),
      );
    }
  }

  /**
   * 加载进度从文件
   * @returns {boolean} 是否成功加载进度
   */
  loadProgress(): boolean {
    if (existsSync(this.config.progressFile)) {
      try {
        const saved = JSON.parse(
          readFileSync(this.config.progressFile, "utf-8"),
        );
        this.progress = { ...this.progress, ...saved };
        console.log(
          t("load_progress_success", {
            processed: String(this.progress.processedTracks),
            total: String(this.progress.totalTracks),
          }),
        );
        return true;
      } catch {
        console.warn(t("load_progress_failed"));
        return false;
      }
    }
    return false;
  }

  /**
   * 获取当前导入统计信息
   * @returns {ImportStats} 导入统计信息对象
   */
  getStats(): ImportStats {
    const matchResults = this.progress.matchResults;
    return {
      total: this.progress.totalTracks,
      matched: matchResults.filter((r) => r.confidence !== "none").length,
      highConfidence: matchResults.filter((r) => r.confidence === "high")
        .length,
      mediumConfidence: matchResults.filter((r) => r.confidence === "medium")
        .length,
      lowConfidence: matchResults.filter((r) => r.confidence === "low").length,
      unmatched: matchResults.filter((r) => r.confidence === "none").length,
      importSuccess: 0,
      importFailed: 0,
      duration: Date.now() - this.progress.timestamp,
    };
  }

  /**
   * 打印导入总结信息
   */
  printSummary(): void {
    const stats = this.getStats();
    console.log(`\n=== ${t("import_summary_title")} ===`);
    console.log(`${t("import_summary_total")}: ${stats.total}`);
    console.log(
      `${t("import_summary_matched")}: ${stats.matched} (${t("import_summary_high")}: ${stats.highConfidence}, ${t("import_summary_medium")}: ${stats.mediumConfidence}, ${t("import_summary_low")}: ${stats.lowConfidence})`,
    );
    console.log(`${t("import_summary_unmatched")}: ${stats.unmatched}`);
    console.log(
      `${t("import_summary_duration")}: ${Math.round(stats.duration / 1000)}s`,
    );
  }

  /**
   * 获取当前播放列表ID
   * @returns {string | undefined} 播放列表ID
   */
  getPlaylistId(): string | undefined {
    return this.playlistId;
  }

  /**
   * 获取搜索器实例
   * @returns {Searcher} 搜索器实例
   */
  getSearcher(): Searcher {
    return this.searcher;
  }

  /**
   * 获取待解决的低置信度歌曲列表
   * @returns {MatchResultWithCandidates[]} 待解决的低置信度歌曲列表
   */
  getPendingLowConfidence(): MatchResultWithCandidates[] {
    return this.pendingLowConfidence;
  }

  /**
   * 获取所有匹配结果（包含已解决的）
   * @returns {MatchResult[]} 所有匹配结果数组
   */
  getAllResults(): MatchResult[] {
    return this.progress.matchResults;
  }

  /**
   * 解决低置信度歌曲 - 更新匹配结果
   * @param {number} index pendingLowConfidence 数组中的索引
   * @param {YouTubeSong | null} selectedSong 用户选择的歌曲，null 表示跳过
   */
  resolveLowConfidenceSong(
    index: number,
    selectedSong: YouTubeSong | null,
  ): void {
    if (index < 0 || index >= this.pendingLowConfidence.length) {
      return;
    }

    const pending = this.pendingLowConfidence[index]!;
    const track = pending.track;
    const trackKey = this.getTrackKey(track);

    if (selectedSong) {
      pending.youtubeSong = selectedSong;
      pending.confidence = "medium";
      pending.matchReason = "manual";
      pending.matchedName = selectedSong.name;
      pending.matchedArtist = selectedSong.artist;

      const existingIndex = this.progress.matchResults.findIndex(
        (r) => r.track.name === track.name && r.track.artist === track.artist,
      );
      if (existingIndex >= 0) {
        this.progress.matchResults[existingIndex] = pending;
      }

      this.progress.matchedTracks++;
      this.progress.skippedTracks--;
      this.recordDbProgress(track, trackKey, pending, "matched");
      console.log(
        t("resolved_track", {
          name: selectedSong.name,
          artist: selectedSong.artist,
        }),
      );
    } else {
      console.log(
        t("skipped_track", { name: track.name, artist: track.artist }),
      );
    }

    this.pendingLowConfidence.splice(index, 1);
    this.saveProgress();
  }

  /**
   * 批量导入所有低置信度歌曲（选择第一个候选）
   * @returns {{ resolved: number; skipped: number }} 解决的数量和跳过的数量
   */
  resolveAllLowConfidence(): {
    /** 已解决的歌曲数量 */
    resolved: number;
    /** 已跳过的歌曲数量 */
    skipped: number;
  } {
    let resolved = 0;
    let skipped = 0;

    while (this.pendingLowConfidence.length > 0) {
      const pending = this.pendingLowConfidence[0]!;
      if (pending.candidates.length > 0) {
        this.resolveLowConfidenceSong(0, pending.candidates[0]!);
        resolved++;
      } else {
        this.resolveLowConfidenceSong(0, null);
        skipped++;
      }
    }

    return { resolved, skipped };
  }
}

/**
 * 运行导入流程
 * @param {ImporterOptions} options 导入选项
 * @returns {Promise<void>}
 */
export async function runImport(options: ImporterOptions): Promise<void> {
  const importer = new Importer(options);

  await importer.init();
  importer.loadCsv();
  importer.loadProgress();

  await importer.processTracks();
  importer.printSummary();
}
