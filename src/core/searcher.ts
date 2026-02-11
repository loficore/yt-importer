import { Innertube } from "youtubei.js";
import { loadCookieHeader } from "@utils/cookies.js";
import type { Playlist } from "../types/index.js";

/** Innertube初始化选项接口*/
export interface InnertubeOptions {
  /** 语言 */
  lang?: string;
  /** 位置 */
  location?: string;
  /** 用户代理 */
  userAgent?: string;
  /** Cookies */
  cookies?: string;
}

/** 搜索器类 */
class Searcher {
  private innertube?: Innertube;

  /**
   * 初始化Innertube实例
   * @param {InnertubeOptions} options Innertube初始化选项
   * @param {string} source Cookie文件路径
   * @returns {Promise<void>} 返回一个Promise,用于返回错误
   */
  async init(options: InnertubeOptions, source: string): Promise<void> {
    if (source) {
      options.cookies = await loadCookieHeader(source);
    }
    this.innertube = await Innertube.create({
      lang: options.lang || "en",
      location: options.location || "US",
      user_agent:
        options.userAgent ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      cookie: options.cookies,
    });
  }

  /**
   * 搜索歌曲
   * @param {string[]} query 搜索关键词数组
   * @returns {Promise<unknown[]>} 搜索结果列表
   */
  async searchSongs(query: string[]): Promise<unknown[]> {
    if (!this.innertube) {
      throw new Error("Innertube没有初始化，请先调用init方法");
    }

    const results = [];
    try {
      for (const q of query) {
        const searchResults = await this.innertube.music.search(q, {
          type: "song",
        });
        results.push(searchResults);
      }
    } catch (e) {
      console.error("搜索过程中发生错误:", e);
    }

    return Promise.resolve(results);
  }

  /**
   * 创建播放列表
   * @param {string} name 播放列表名称
   * @returns {Promise<string>} 创建的播放列表ID
   */
  async createPlaylist(name: string): Promise<string> {
    if (!this.innertube) {
      throw new Error("Innertube没有初始化，请先调用init方法");
    }

    try {
      const response = await this.innertube.playlist.create(name, []);
      return response.playlist_id || "";
    } catch (error) {
      console.error("创建播放列表失败:", error);
      throw error;
    }
  }

  /**
   * 添加歌曲到播放列表
   * @param {string} playlistId 播放列表ID
   * @param {string[]} videoIds 视频ID数组
   * @returns {Promise<void>}
   */
  async addToPlaylist(playlistId: string, videoIds: string[]): Promise<void> {
    if (!this.innertube) {
      throw new Error("Innertube没有初始化，请先调用init方法");
    }

    try {
      await this.innertube.playlist.addVideos(playlistId, videoIds);
    } catch (error) {
      console.error(`向播放列表 ${playlistId} 添加视频失败:`, error);
      throw error;
    }
  }

  /**
   * 获取用户播放列表
   * @returns {Promise<Playlist[]>} 播放列表数组
   */
  async getPlaylists(): Promise<Playlist[]> {
    if (!this.innertube) {
      throw new Error("Innertube没有初始化，请先调用init方法");
    }

    try {
      const response = await this.innertube.getPlaylists();
      if (!response || !response.playlists) {
        return [];
      }

      return response.playlists.map((p) => {
        /** Playlist response structure from Innertube API */
        const playlist = p as unknown as {
          /** 播放列表ID */
          id: string;
          /** 播放列表标题 */
          title: { toString(): string };
          /** 播放列表总视频数 */
          total_items?: number;
          /** 播放列表内容 */
          contents?: { /** 视频ID */ videoId?: string }[];
        };
        return {
          id: playlist.id,
          name: String(playlist.title),
          trackCount: playlist.total_items || 0,
          videoIds:
            playlist.contents?.map((c) => c.videoId || "").filter(Boolean) ||
            [],
        };
      });
    } catch (error) {
      console.error("获取播放列表失败:", error);
      return [];
    }
  }
}

export default Searcher;
