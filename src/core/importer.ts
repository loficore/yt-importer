import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import Searcher from "./searcher.js";
import { matchTrackToResults } from "./matcher.js";
import type {
  SpotifyTrack,
  YouTubeSong,
  MatchResult,
  ImportProgress,
  ImporterConfig,
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

  /**
   * 构造函数
   * @param {ImporterOptions} options 导入选项
   */
  constructor(options: ImporterOptions) {
    this.searcher = new Searcher();
    this.csvPath = options.csvPath;
    this.config = {
      skipConfirmation: false,
      minConfidence: "low",
      requestDelay: 1500,
      saveProgress: true,
      progressFile: "./import-progress.json",
      ...options.config,
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
  }

  /**
   * 初始化搜索器
   * @returns {Promise<void>}
   */
  async init(): Promise<void> {
    const cookiePath = "config/cookies.json";
    if (existsSync(cookiePath)) {
      await this.searcher.init({}, cookiePath);
      console.log("✓ Searcher initialized with cookies");
    } else {
      await this.searcher.init({ lang: "en", location: "US" }, "");
      console.log("✓ Searcher initialized without cookies");
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
    console.log(`✓ Loaded ${this.tracks.length} tracks from CSV`);
  }

  /**
   * 处理所有曲目
   * @returns {Promise<MatchResult[]>} 匹配结果数组
   */
  async processTracks(): Promise<MatchResult[]> {
    const results: MatchResult[] = [];
    const confidenceOrder: MatchConfidence[] = [
      "none",
      "low",
      "medium",
      "high",
    ];
    const minIndex = confidenceOrder.indexOf(this.config.minConfidence);

    const startIndex = this.progress.processedTracks;

    for (let i = startIndex; i < this.tracks.length; i++) {
      const track = this.tracks[i];
      if (!track) continue;

      console.log(
        `\n[${i + 1}/${this.tracks.length}] Processing: ${track.name} - ${track.artist}`,
      );

      try {
        const searchResults = await this.searcher.searchSongs([
          `${track.name} ${track.artist}`,
        ]);
        const ytSongs = this.extractSongsFromResults(searchResults);
        const matchResult = matchTrackToResults(track, ytSongs);

        results.push(matchResult);
        this.progress.matchResults.push(matchResult);

        const meetsThreshold =
          confidenceOrder.indexOf(matchResult.confidence) >= minIndex;

        if (matchResult.confidence !== "none" && meetsThreshold) {
          this.progress.matchedTracks++;
          console.log(
            `  ✓ Matched: ${matchResult.confidence} (${matchResult.matchReason})`,
          );
          if (matchResult.youtubeSong) {
            console.log(
              `    → ${matchResult.youtubeSong.name} - ${matchResult.youtubeSong.artist}`,
            );
          }
        } else if (matchResult.confidence !== "none" && !meetsThreshold) {
          this.progress.skippedTracks++;
          console.log(
            `  ⊘ Skipped: confidence below threshold (${matchResult.confidence} < ${this.config.minConfidence})`,
          );
        } else {
          this.progress.failedTracks++;
          console.log("  ✗ No match found");
        }

        this.progress.processedTracks++;
        this.saveProgress();

        if (this.config.requestDelay > 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.config.requestDelay),
          );
        }
      } catch (error) {
        console.error("  ✗ Error processing track:", error);
        this.progress.failedTracks++;
        this.progress.processedTracks++;
      }
    }

    return results;
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
      console.log(`✓ Created playlist: ${name} (ID: ${this.playlistId})`);
    } catch (error) {
      console.error("✗ Failed to create playlist:", error);
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

    console.log(`\n→ Importing ${videoIds.length} songs to playlist...`);

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
          `  ✓ Added ${Math.min(i + batchSize, videoIds.length)}/${videoIds.length} songs`,
        );
      } catch {
        failed += batch.length;
        console.error(`  ✗ Failed to add batch ${i / batchSize + 1}`);
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
   * 从搜索结果中提取歌曲列表
   * @param {unknown[]} searchResults 搜索结果
   * @returns {YouTubeSong[]} YouTube歌曲数组
   */
  private extractSongsFromResults(searchResults: unknown[]): YouTubeSong[] {
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
          `✓ Loaded progress: ${this.progress.processedTracks}/${this.progress.totalTracks} processed`,
        );
        return true;
      } catch {
        console.warn("⚠ Failed to load progress file, starting fresh");
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
    console.log("\n=== Import Summary ===");
    console.log(`Total tracks: ${stats.total}`);
    console.log(
      `Matched: ${stats.matched} (High: ${stats.highConfidence}, Medium: ${stats.mediumConfidence}, Low: ${stats.lowConfidence})`,
    );
    console.log(`Unmatched: ${stats.unmatched}`);
    console.log(`Duration: ${Math.round(stats.duration / 1000)}s`);
  }

  /**
   * 获取当前播放列表ID
   * @returns {string | undefined} 播放列表ID
   */
  getPlaylistId(): string | undefined {
    return this.playlistId;
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
