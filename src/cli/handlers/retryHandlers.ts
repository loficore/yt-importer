import { DB } from "../../utils/db.js";
import { t } from "../../utils/i18n.js";
import { promptSelectList } from "../../tui/selectList.js";
import { promptConfirm } from "../../tui/confirm.js";
import { showWarning, showSuccess } from "../../tui/notification.js";
import { promptPressEnter } from "../../cli/prompts.js";
import { ConcurrentSearcher } from "../../core/conCurrentSearcher.js";
import { Searcher } from "../../core/searcher.js";
import { matchTrackWithCandidates } from "../../core/matcher.js";
import type { SpotifyTrack, YouTubeSong } from "../../types/index.js";
import { SearchCache } from "../../utils/searchCache.js";
import { DEFAULT_CONFIG } from "../../utils/config.js";
import { logger } from "../../utils/logger.js";
import { batchRetryTui } from "../../tui/batchRetry.js";
import { existsSync } from "node:fs";

const db = new DB("./import-progress.sqlite");

/**
 *
 */
interface FailedTrackRow {
  /**
   *
   */
  track_json?: string;
  /**
   *
   */
  match_result_json?: string;
  /**
   *
   */
  error_message?: string;
  /**
   *
   */
  updated_at: string;
}

/**
 *
 */
interface FailedTrackInfo {
  /**
   *
   */
  name: string;
  /**
   *
   */
  artist: string;
  /**
   *
   */
  album?: string;
  /**
   *
   */
  duration?: number;
}

/**
 *
 */
interface RunWithFailedTracks {
  /**
   *
   */
  runId: string;
  /**
   *
   */
  csvPath: string;
  /**
   *
   */
  createdAt: string;
  /**
   *
   */
  playlistId?: string;
  /**
   *
   */
  failedTracks: FailedTrackInfo[];
}

/**
 * 从数据库中获取具有失败曲目的运行记录，并解析失败曲目的信息
 * @returns {RunWithFailedTracks[]} 包含失败曲目信息的运行记录列表
 */
function getRunsWithFailedTracks(): RunWithFailedTracks[] {
  const runsResult = db.listRunSummaries(50);
  const runs = Array.isArray(runsResult.data) ? runsResult.data : [];

  const runsWithFailed: RunWithFailedTracks[] = [];

  for (const run of runs as {
    /**
     *
     */
    run_id: string;
    /**
     *
     */
    csv_path: string;
    /**
     *
     */
    created_at: string;
    /**
     *
     */
    playlist_id?: string;
  }[]) {
    const failedResult = db.listFailedTracks(run.run_id, 1000);
    const failedRows = Array.isArray(failedResult.data)
      ? failedResult.data
      : [];

    if (failedRows.length > 0) {
      const failedTracks: FailedTrackInfo[] = failedRows
        .map((f) => {
          const row = f as FailedTrackRow;
          const parsed = row.track_json ? JSON.parse(row.track_json) : null;
          return parsed
            ? {
                name: parsed.name,
                artist: parsed.artist,
                album: parsed.album,
                duration: parsed.duration,
              }
            : null;
        })
        .filter(Boolean) as FailedTrackInfo[];

      if (failedTracks.length > 0) {
        runsWithFailed.push({
          runId: run.run_id,
          csvPath: run.csv_path,
          createdAt: run.created_at,
          playlistId: run.playlist_id,
          failedTracks,
        });
      }
    }
  }

  return runsWithFailed;
}

/**
 * 使用多策略搜索单个曲目，依次尝试不同的查询方式，直到找到匹配结果或用尽所有策略
 * @param {Searcher} searcher - 搜索器实例
 * @param {SpotifyTrack} track - Spotify曲目信息
 * @returns {Promise<YouTubeSong|null>} - 匹配的YouTube歌曲信息或null
 */
async function searchWithMultiStrategy(
  searcher: Searcher,
  track: SpotifyTrack,
): Promise<YouTubeSong | null> {
  const queries = [`${track.name} ${track.artist}`.trim(), track.name.trim()];

  for (const query of queries) {
    if (!query) continue;

    try {
      const results = await searcher.searchSongs([query]);
      if (results && results.length > 0) {
        const songs = results[0] as YouTubeSong[];
        if (songs && songs.length > 0) {
          const matchResult = matchTrackWithCandidates(track, songs);
          if (matchResult.youtubeSong) {
            logger.info(
              `Multi-strategy search found match for "${track.name}"`,
              {
                query,
                matched: matchResult.youtubeSong.name,
              },
            );
            return matchResult.youtubeSong;
          }
        }
      }
    } catch (error) {
      logger.warn(`Search failed for query "${query}"`, { error });
    }
  }

  return null;
}

/**
 * 处理批量重试逻辑，允许用户选择具有失败曲目的运行记录，选择要重试的曲目，并将成功匹配的曲目添加到播放列表
 */
export async function handleBatchRetry(): Promise<void> {
  console.clear();

  const runsWithFailed = getRunsWithFailedTracks();

  if (runsWithFailed.length === 0) {
    await showWarning(t("no_failed"));
    await promptPressEnter();
    return;
  }

  const runChoices: {
    /**
     * 运行记录的显示名称
     */
    name: string; 
    /**
     * 运行记录的值
     */
    value: RunWithFailedTracks | "back";
  }[] = [
    ...runsWithFailed.map((run) => ({
      name: `${run.csvPath} (${run.failedTracks.length} failed) - ${run.createdAt}`,
      value: run,
    })),
    { name: t("menu_back"), value: "back" },
  ];

  const selected = await promptSelectList({
    message: t("tool_batch_retry"),
    choices: runChoices,
  });

  if (selected === "back" || !selected) {
    return;
  }

  const selectedRun = selected;

  if (!selectedRun.playlistId) {
    await showWarning("No playlist associated with this import. Cannot retry.");
    await promptPressEnter();
    return;
  }

  const retryTracks: FailedTrackInfo[] = selectedRun.failedTracks;

  const selectedTracks = await batchRetryTui(retryTracks);

  if (!selectedTracks || selectedTracks.length === 0) {
    return;
  }

  console.clear();
  console.log(t("processing"));
  console.log(`Retrying ${selectedTracks.length} tracks...`);

  const searcher = new Searcher();
  const concurrentSearcher = new ConcurrentSearcher();
  const searchCache = new SearchCache(DEFAULT_CONFIG.cachePath);

  const cookiePath = "config/cookies.json";
  const innertubeOptions = {
    lang: "en",
    location: "US",
    proxy: DEFAULT_CONFIG.proxyUrl,
  };

  if (existsSync(cookiePath)) {
    await searcher.init(innertubeOptions, cookiePath);
  } else {
    await showWarning("No cookies file found. Please configure cookies first.");
    await promptPressEnter();
    return;
  }

  concurrentSearcher.init(
    DEFAULT_CONFIG.concurrency,
    DEFAULT_CONFIG.searchQps,
    DEFAULT_CONFIG.maxRetries,
    DEFAULT_CONFIG.retryDelay,
    searchCache,
    searcher,
  );

  const results: {
    /**
     * Spotify曲目信息
     */
    track: SpotifyTrack; 
    /**
     * YouTube歌曲信息或null
     */
    result: YouTubeSong | null;
  }[] = [];

  for (const trackInfo of selectedTracks) {
    const spotifyTrack: SpotifyTrack = {
      uri: "",
      name: trackInfo.name,
      artist: trackInfo.artist,
      album: trackInfo.album || "",
      duration: trackInfo.duration || 0,
    };

    console.log(`\nSearching: ${trackInfo.name} - ${trackInfo.artist}`);

    const result = await searchWithMultiStrategy(searcher, spotifyTrack);

    if (result) {
      console.log(`  ✓ Found: ${result.name} - ${result.artist}`);
    } else {
      console.log(`  ✗ Not found`);
    }

    results.push({ track: spotifyTrack, result });
  }

  const matchedSongs = results
    .filter((r) => r.result !== null)
    .map((r) => r.result as YouTubeSong);

  if (matchedSongs.length === 0) {
    await showWarning("No tracks were successfully matched.");
    await promptPressEnter();
    return;
  }

  const confirmAdd = await promptConfirm({
    message: `Add ${matchedSongs.length} matched tracks to playlist?`,
    defaultValue: true,
  });

  if (!confirmAdd) {
    return;
  }

  console.log("\nAdding tracks to playlist...");

  const videoIds = matchedSongs.map((song) => song.videoId);

  const batchSize = 100;
  for (let i = 0; i < videoIds.length; i += batchSize) {
    const batch = videoIds.slice(i, i + batchSize);
    await searcher.addToPlaylist(selectedRun.playlistId, batch);
    console.log(
      `  Added ${Math.min(i + batchSize, videoIds.length)}/${videoIds.length}`,
    );
  }

  await showSuccess(
    `Successfully added ${matchedSongs.length} tracks to playlist!`,
  );
  await promptPressEnter();
}
