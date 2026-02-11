import { z } from "zod";

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

/** 表示Spotify曲目的类型*/
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

/** 表示YouTube歌曲的类型*/
export type YouTubeSong = z.infer<typeof YouTubeSongSchema>;

/**表示搜索置信度 */
export const MatchConfidenceEnum = z.enum(["high", "medium", "low", "none"]);

/** 表示搜索置信度的类型*/
export type MatchConfidence = z.infer<typeof MatchConfidenceEnum>;

export const MatchReasonEnum = z.enum(["exact", "fuzzy", "duration", "none"]);

/** 表示搜索原因的类型*/
export type MatchReason = z.infer<typeof MatchReasonEnum>;

export const MatchResultSchema = z.object({
  track: SpotifyTrackSchema,
  youtubeSong: YouTubeSongSchema.nullable(),
  confidence: MatchConfidenceEnum,
  matchReason: MatchReasonEnum,
  matchedName: z.string().optional(),
  matchedArtist: z.string().optional(),
});

/**
 * 表示匹配结果的类型
 */
export type MatchResult = z.infer<typeof MatchResultSchema>;

export const PlaylistSchema = z.object({
  id: z.string(),
  name: z.string(),
  trackCount: z.number(),
  videoIds: z.array(z.string()),
});

/**
 * 表示播放列表的类型
 */
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

/**
 * 表示导入进度的类型
 */
export type ImportProgress = z.infer<typeof ImportProgressSchema>;

export const ImporterConfigSchema = z.object({
  skipConfirmation: z.boolean().default(false),
  minConfidence: MatchConfidenceEnum.default("low"),
  requestDelay: z.number().min(100).max(10000).default(1500),
  saveProgress: z.boolean().default(true),
  progressFile: z.string().default("./import-progress.json"),
});

/**
 * 表示导入器配置的类型
 */
export type ImporterConfig = z.infer<typeof ImporterConfigSchema>;

export const CookiesSchema = z.record(z.string(), z.string());
/**
 * 表示Cookies的类型
 */
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

/** 表示导入统计的类型*/
export type ImportStats = z.infer<typeof ImportStatsSchema>;
