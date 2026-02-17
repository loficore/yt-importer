import { z } from "zod";
import type {
  MatchConfidence,
  Language,
  ImporterConfig,
} from "../utils/config.js";
import {
  MatchConfidenceEnum,
  LanguageEnum,
  ImporterConfigSchema,
} from "../utils/config.js";

export type { MatchConfidence, Language, ImporterConfig };
export { MatchConfidenceEnum, LanguageEnum, ImporterConfigSchema };

export const SpotifyTrackSchema = z.object({
  uri: z.string(),
  name: z.string(),
  album: z.string(),
  artist: z.string(),
  duration: z.number(),
  popularity: z.number().optional(),
  explicit: z.boolean().optional(),
  releaseDate: z.string().optional(),
  genres: z.array(z.string()).optional(),
  recordLabel: z.string().optional(),
});

/** Spotify曲目类型 */
export type SpotifyTrack = z.infer<typeof SpotifyTrackSchema>;

export const YouTubeSongSchema = z.object({
  videoId: z.string(),
  name: z.string(),
  artist: z.string(),
  album: z.string().optional(),
  duration: z.number().optional(),
  thumbnails: z
    .array(
      z.object({
        url: z.string(),
        width: z.number(),
        height: z.number(),
      }),
    )
    .optional(),
});

/** YouTube歌曲类型 */
export type YouTubeSong = z.infer<typeof YouTubeSongSchema>;

export const MatchReasonEnum = z.enum(["exact", "fuzzy", "duration", "none"]);

/** 匹配原因类型 */
export type MatchReason = z.infer<typeof MatchReasonEnum>;

export const MatchResultSchema = z.object({
  track: SpotifyTrackSchema,
  youtubeSong: YouTubeSongSchema.nullable(),
  confidence: MatchConfidenceEnum,
  matchReason: MatchReasonEnum,
  matchedName: z.string().optional(),
  matchedArtist: z.string().optional(),
});

/** 匹配结果类型 */
export type MatchResult = z.infer<typeof MatchResultSchema>;

export const PlaylistSchema = z.object({
  id: z.string(),
  name: z.string(),
  trackCount: z.number(),
  videoIds: z.array(z.string()),
});

/** 播放列表类型 */
export type Playlist = z.infer<typeof PlaylistSchema>;

export const ImportProgressSchema = z.object({
  totalTracks: z.number(),
  processedTracks: z.number(),
  matchedTracks: z.number(),
  failedTracks: z.number(),
  skippedTracks: z.number(),
  playlistId: z.string().optional(),
  matchResults: z.array(MatchResultSchema),
  timestamp: z.number(),
});

/** 导入进度类型 */
export type ImportProgress = z.infer<typeof ImportProgressSchema>;

export const RunStatusEnum = z.enum([
  "running",
  "completed",
  "failed",
  "paused",
]);

/** 运行状态类型 */
export type RunStatus = z.infer<typeof RunStatusEnum>;

export const TrackStatusEnum = z.enum(["matched", "skipped", "failed"]);

/** 歌曲状态类型 */
export type TrackStatus = z.infer<typeof TrackStatusEnum>;

export const UpsertTrackInputSchema = z.object({
  runId: z.string(),
  trackKey: z.string(),
  track: SpotifyTrackSchema,
  matchResult: MatchResultSchema,
  status: TrackStatusEnum,
  errorMessage: z.string().optional(),
  updatedAt: z.string().optional(),
});

/** 更新或插入曲目输入类型 */
export type UpsertTrackInput = z.infer<typeof UpsertTrackInputSchema>;

export const ProgressRunSchema = z.object({
  runId: z.string(),
  csvPath: z.string(),
  createdAt: z.number(),
  status: RunStatusEnum,
  totalTracks: z.number(),
  processedTracks: z.number(),
  matchedTracks: z.number(),
  failedTracks: z.number(),
  skippedTracks: z.number(),
  playlistId: z.string().optional(),
});

/** 进度运行类型 */
export type ProgressRun = z.infer<typeof ProgressRunSchema>;

/** 运行统计增量类型 */
export interface RunStatsDelta {
  /** 处理的总曲目数 */
  processedTracks?: number;
  /** 匹配的曲目数 */
  matchedTracks?: number;
  /** 失败的曲目数 */
  failedTracks?: number;
  /** 跳过的曲目数 */
  skippedTracks?: number;
}

export const CookiesSchema = z.record(z.string(), z.string());

/** Cookies类型 */
export type Cookies = z.infer<typeof CookiesSchema>;

export const ImportStatsSchema = z.object({
  total: z.number(),
  matched: z.number(),
  highConfidence: z.number(),
  mediumConfidence: z.number(),
  lowConfidence: z.number(),
  unmatched: z.number(),
  importSuccess: z.number(),
  importFailed: z.number(),
  duration: z.number(),
});

/** 导入统计类型 */
export type ImportStats = z.infer<typeof ImportStatsSchema>;
