import type { SpotifyTrack, YouTubeSong } from "../types/index.js";
import { RateLimiter } from "../utils/rateLimiter.js";
import type { SearchCache } from "../utils/searchCache.js";
import Searcher from "./searcher.js";
import { SearchUtils } from "./searchUtils.js";
import { logger } from "../utils/logger.js";

/**
 * 并发搜索器 - 支持并发搜索和 QPS 限流
 */
export class ConcurrentSearcher {
  private rateLimiter: RateLimiter;
  private searchCache: SearchCache | undefined;
  private searcher: Searcher | undefined;
  private concurrency: number;
  private maxRetries: number;
  private retryDelay: number;
  private activeCount: number;
  /** 待处理搜索任务队列 */
  private queue: {
    /** 需要搜索的spotify歌曲 */
    track: SpotifyTrack;
    /** 成功时处理搜索到对应的Youtube歌曲的回调函数 */
    resolve: (songs: YouTubeSong[]) => void;
    /** 失败时用于返回err的回调函数 */
    reject: (err: unknown) => void;
  }[] = [];

  /**
   * 构造函数
   */
  constructor() {
    this.rateLimiter = new RateLimiter();
    this.concurrency = 0;
    this.maxRetries = 3;
    this.retryDelay = 2000;
    this.activeCount = 0;
    this.queue = [];
  }

  /**
   * 初始化并发搜索器
   * @param {number} concurrency 最大并发任务数
   * @param {number} searchQPS 每秒搜索次数
   * @param {number} maxRetries 最大重试次数
   * @param {number} retryDelay 重试延迟（毫秒）
   * @param {SearchCache} searchCache 搜索缓存实例
   * @param {Searcher} searcher 搜索器实例
   */
  init(
    concurrency: number,
    searchQPS: number,
    maxRetries: number,
    retryDelay: number,
    searchCache: SearchCache | undefined,
    searcher: Searcher,
  ): void {
    this.concurrency = concurrency;
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
    this.rateLimiter.init(searchQPS);
    this.searchCache = searchCache;
    this.searcher = searcher;

    logger.info("ConcurrentSearcher 初始化完成", {
      concurrency,
      searchQPS,
      maxRetries,
      retryDelay,
      hasCache: !!searchCache,
    });
  }

  /**
   * 搜索单首曲目（入队）
   * @param {SpotifyTrack} track 需要搜索的Spotify曲目
   * @returns {Promise<YouTubeSong[]>} 搜索结果
   */
  async searchTrack(track: SpotifyTrack): Promise<YouTubeSong[]> {
    logger.debug("加入搜索队列", {
      trackName: track.name,
      queueSize: this.queue.length + 1,
    });
    return new Promise((resolve, reject) => {
      this.queue.push({ track, resolve, reject });
      this.tryDispatchNextTask().catch(reject);
    });
  }

  /**
   * 尝试分派下一个待处理的搜索任务（若满足并发条件）
   * 前置条件：还有任务 && 活跃任务数 < 并发上限
   */
  private async tryDispatchNextTask(): Promise<void> {
    if (this.queue.length === 0 || this.activeCount >= this.concurrency) {
      return;
    }

    if (!this.searcher) {
      throw new Error(
        "ConcurrentSearcher not initialized: searcher is undefined",
      );
    }

    this.activeCount++;
    const { track, resolve, reject } = this.queue.shift()!;

    logger.debug("开始搜索任务", {
      trackName: track.name,
      activeCount: this.activeCount,
      queueSize: this.queue.length,
    });

    try {
      // 等待令牌（QPS 限流）
      await this.rateLimiter.wait();

      // 执行搜索
      const result = await SearchUtils.searchSongsWithRetry(
        track,
        this.searcher,
        this.searchCache,
        this.maxRetries,
        this.retryDelay,
      );
      logger.debug("搜索任务完成", {
        trackName: track.name,
        resultCount: result.length,
      });
      resolve(result);
    } catch (error) {
      logger.error("搜索任务失败", {
        trackName: track.name,
        error: String(error),
      });
      reject(error);
    } finally {
      this.activeCount--;
      // 递归启动下一个任务
      await this.tryDispatchNextTask();
    }
  }
}
