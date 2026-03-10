import { Innertube } from "youtubei.js";
import { loadCookieHeader } from "@utils/cookies.js";
import { logger } from "@utils/logger.js";
import { t } from "@utils/i18n.js";
import type { Playlist } from "../types/index.js";

/**
 * 歌单曲目接口
 */
export interface PlaylistTrack {
  /** 视频ID */
  videoId: string;
  /** 歌曲名称 */
  name: string;
  /** 艺术家名称 */
  artist: string;
}

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
  /** 代理URL */
  proxy?: string;
}

/** 搜索器类 */
export class Searcher {
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
    const initOptions: {
      /** 语言 */
      lang: string;
      /** 位置 */
      location: string;
      /** UA */
      user_agent: string;
      /** cookies数据 */
      cookie?: string;
      /** 代理URL */
      proxy?: string;
    } = {
      lang: options.lang || "en",
      location: options.location || "US",
      user_agent:
        options.userAgent ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      cookie: options.cookies,
    };
    if (options.proxy) {
      initOptions.proxy = options.proxy;
    }
    this.innertube = await Innertube.create(initOptions);
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

    logger.info("开始搜索歌曲", { queryCount: query.length, queries: query });

    const results = [];
    for (const q of query) {
      logger.debug("执行搜索查询", { query: q });
      const searchResults = await this.innertube.music.search(q, {
        type: "song",
      });
      results.push(searchResults);
      logger.debug("搜索完成", { query: q, hasResults: !!searchResults });
    }

    logger.info("搜索完成", {
      totalQueries: query.length,
      totalResults: results.length,
    });
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
      console.error(
        t("error_playlist_create_failed", { error: String(error) }),
      );
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
      console.error(
        t("error_playlist_add_failed", {
          id: playlistId,
          error: String(error),
        }),
      );
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
      logger.debug("getPlaylists response", {
        hasResponse: !!response,
        hasPlaylists: !!response?.playlists,
        playlistCount: response?.playlists?.length,
      });
      if (!response || !response.playlists) {
        return [];
      }

      return response.playlists.map((p) => {
        logger.debug("playlist item raw", {
          data: JSON.stringify(p)?.slice(0, 1000),
          keys: Object.keys(p),
          type: p.type,
        });

        if (p.type === "LockupView") {
          const lockup = p as unknown as {
            /** 内容id */
            content_id: string;
            /** 内容类型 */
            content_type: string;
            /** 内容图片信息 */
            content_image: {
              /** 主缩略图 */
              primary_thumbnail?: {
                /** 覆盖信息 */
                overlays?: {
                  /** 徽章文本 */
                  badges?: {
                    /** 徽章文本，可能包含曲目数量等信息*/
                    text?: string;
                  }[];
                }[];
              };
            };
            /** 元数据信息 */
            metadata: {
              /** 标题 */
              title: { toString(): string };
            };
          };
          const title = lockup.metadata?.title?.toString() || "Unknown";

          let trackCount = 0;
          const overlays =
            lockup.content_image?.primary_thumbnail?.overlays || [];
          for (const overlay of overlays) {
            const badges = overlay?.badges || [];
            for (const badge of badges) {
              const text = String(badge?.text || "");
              const match = text.match(/(\d+)\s*(video|歌曲|songs?)?/i);
              if (match) {
                trackCount = parseInt(match[1]!, 10);
                break;
              }
            }
            if (trackCount > 0) break;
          }

          return {
            id: lockup.content_id,
            name: title,
            trackCount,
            videoIds: [],
          };
        }

        const playlist = p as unknown as {
          /** 播放列表ID */
          id: string;
          /** 播放列表标题 */
          title: {
            /** 文本 */
            text?: string;
            toString(): string;
          };
          /** 歌曲总数 */
          total_items?: number;
          /** 内容信息 */
          contents?: {
            /** 视频ID */
            videoId?: string;
          }[];
        };
        const title = playlist.title?.text ?? String(playlist.title);
        return {
          id: playlist.id,
          name: title,
          trackCount: playlist.total_items || 0,
          videoIds:
            playlist.contents?.map((c) => c.videoId || "").filter(Boolean) ||
            [],
        };
      });
    } catch (error) {
      console.error(t("error_get_playlists_failed", { error: String(error) }));
      return [];
    }
  }

  /**
   * 获取播放列表的所有曲目
   * @param {string} playlistId 播放列表ID
   * @returns {Promise<PlaylistTrack[]>} 播放列表曲目数组
   */
  async getPlaylistTracks(playlistId: string): Promise<PlaylistTrack[]> {
    if (!this.innertube) {
      throw new Error("Innertube没有初始化，请先调用init方法");
    }

    try {
      const response = await this.innertube.getPlaylist(playlistId);
      if (!response || !response.items) {
        return [];
      }

      const tracks: PlaylistTrack[] = [];
      for (const item of response.items) {
        if (!item || typeof item !== "object") continue;

        const record = item as {
          /** 视频ID */
          id?: string;
          /** 歌曲标题 */
          title?: { toString(): string };
          /** 艺术家信息 */
          artists?: {
            /** 艺术家名称 */
            name?: string;
          }[];
        };

        const videoId = record.id || "";
        const name = record.title ? String(record.title) : "Unknown";
        const artistInfo = record.artists || [];
        const artist = artistInfo[0]?.name || "Unknown";

        if (videoId) {
          tracks.push({ videoId, name, artist });
        }
      }

      return tracks;
    } catch (error) {
      console.error(
        t("error_get_playlist_tracks_failed", {
          id: playlistId,
          error: String(error),
        }),
      );
      return [];
    }
  }
}

export default Searcher;
