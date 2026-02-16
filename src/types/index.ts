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

export type YouTubeSong = z.infer<typeof YouTubeSongSchema>;

export const MatchReasonEnum = z.enum(["exact", "fuzzy", "duration", "none"]);

export type MatchReason = z.infer<typeof MatchReasonEnum>;

export const MatchResultSchema = z.object({
  track: SpotifyTrackSchema,
  youtubeSong: YouTubeSongSchema.nullable(),
  confidence: MatchConfidenceEnum,
  matchReason: MatchReasonEnum,
  matchedName: z.string().optional(),
  matchedArtist: z.string().optional(),
});

export type MatchResult = z.infer<typeof MatchResultSchema>;

export const PlaylistSchema = z.object({
  id: z.string(),
  name: z.string(),
  trackCount: z.number(),
  videoIds: z.array(z.string()),
});

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

export type ImportProgress = z.infer<typeof ImportProgressSchema>;

export const RunStatusEnum = z.enum([
  "running",
  "completed",
  "failed",
  "paused",
]);

export type RunStatus = z.infer<typeof RunStatusEnum>;

export const TrackStatusEnum = z.enum(["matched", "skipped", "failed"]);

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

export type ProgressRun = z.infer<typeof ProgressRunSchema>;

export interface RunStatsDelta {
  processedTracks?: number;
  matchedTracks?: number;
  failedTracks?: number;
  skippedTracks?: number;
}

export const CookiesSchema = z.record(z.string(), z.string());

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

export type ImportStats = z.infer<typeof ImportStatsSchema>;
