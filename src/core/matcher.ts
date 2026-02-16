import type {
  SpotifyTrack,
  YouTubeSong,
  MatchResult,
  MatchConfidence,
  MatchReason,
} from "../types/index.js";

/**
 * 标准化字符串
 * @param {string} str 输入字符串
 * @returns {string} 标准化后的字符串
 */
export function normalizeString(str: string): string {
  return str
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const TITLE_STOP_WORDS = new Set([
  "live",
  "remastered",
  "remaster",
  "edit",
  "mix",
  "version",
  "radio",
  "karaoke",
  "acoustic",
  "instrumental",
]);

/**
 * 将标题分词并去除停用词
 * @param {string} title 标题字符串
 * @returns {string[]} 分词后的标题数组
 */
function tokenizeTitle(title: string): string[] {
  const normalized = normalizeString(title)
    .replace(/\b(feat|ft|featuring)\b/gu, " ")
    .replace(/\b\d{4}\b/gu, " ");
  return normalized
    .split(" ")
    .filter((token) => token && !TITLE_STOP_WORDS.has(token));
}

/**
 * 比较两个持续时间是否在容差范围内
 * @param {number | undefined} d1 第一个持续时间（毫秒）
 * @param {number | undefined} d2 第二个持续时间（毫秒）
 * @param {number} toleranceMs 容差范围（毫秒），默认为5000ms
 * @returns {boolean} 如果两个持续时间在容差范围内，则返回true；否则返回false
 */
export function durationMatch(
  d1: number | undefined,
  d2: number | undefined,
  toleranceMs = 5000,
): boolean {
  if (d1 === undefined || d2 === undefined) return false;
  return Math.abs(d1 - d2) <= toleranceMs;
}

/**
 * 计算两个字符串的相似度
 * @param {string} s1 第一个字符串
 * @param {string} s2 第二个字符串
 * @returns {number} 相似度分数，范围从0到1
 */
export function nameSimilarity(s1: string, s2: string): number {
  const tokens1 = tokenizeTitle(s1);
  const tokens2 = tokenizeTitle(s2);
  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  if (set1.size === set2.size && tokens1.every((t) => set2.has(t))) return 1;

  const n1 = normalizeString(s1);
  const n2 = normalizeString(s2);
  if (n1 === n2) return 1;
  if (n1.includes(n2) || n2.includes(n1)) return 0.8;

  let intersection = 0;
  for (const t of set1) {
    if (set2.has(t)) intersection += 1;
  }
  const union = set1.size + set2.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * 比较两个艺术家名称是否匹配
 * @param {string} trackArtist Spotify曲目的艺术家名称
 * @param {string} ytArtist YouTube曲目的艺术家名称
 * @returns {boolean} 如果艺术家名称匹配，则返回true；否则返回false
 */
export function artistMatch(trackArtist: string, ytArtist: string): boolean {
  /**
   * 将艺术家字符串分割成数组
   * @param {string} value - 艺术家字符串
   * @returns {string[]} 分割后的艺术家数组
   */
  const splitArtists = (value: string): string[] =>
    normalizeString(value)
      .replace(/\b(feat|ft|featuring|x|and)\b/gu, ",")
      .replace(/&/gu, ",")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const normalizedTrack = normalizeString(trackArtist);
  const normalizedYt = normalizeString(ytArtist);

  if (normalizedTrack === normalizedYt) return true;
  if (
    normalizedYt.includes(normalizedTrack) ||
    normalizedTrack.includes(normalizedYt)
  )
    return true;

  const trackArtists = splitArtists(trackArtist);
  const ytArtists = splitArtists(ytArtist);
  if (trackArtists.length === 0 || ytArtists.length === 0) return false;

  return trackArtists.some((a) => ytArtists.includes(a));
}

/**
 * 计算匹配的置信度
 * @param {SpotifyTrack} track Spotify曲目对象
 * @param {YouTubeSong} ytSong YouTube曲目对象
 * @returns {{ confidence: MatchConfidence; reason: MatchReason; score: number }} 包含匹配置信度、原因和分数的对象
 */
export function calculateConfidence(
  track: SpotifyTrack,
  ytSong: YouTubeSong,
): {
  /** 匹配置信度 */
  confidence: MatchConfidence;
  /** 匹配原因 */
  reason: MatchReason;
  /** 匹配分数 */
  score: number;
} {
  const nameScore = nameSimilarity(track.name, ytSong.name);
  const artistMatchResult = artistMatch(track.artist, ytSong.artist);
  const durationKnown =
    track.duration !== undefined && ytSong.duration !== undefined;
  const durationOk = durationKnown
    ? durationMatch(track.duration, ytSong.duration)
    : false;

  if (nameScore >= 0.8 && artistMatchResult) {
    if (durationOk) {
      return { confidence: "high", reason: "exact", score: 1.0 };
    }
    return { confidence: "medium", reason: "fuzzy", score: 0.85 };
  }

  if (nameScore >= 0.5 && artistMatchResult) {
    return { confidence: "medium", reason: "fuzzy", score: 0.7 };
  }

  if (!durationKnown && nameScore >= 0.4 && artistMatchResult) {
    return { confidence: "low", reason: "fuzzy", score: 0.45 };
  }

  if (durationOk && nameScore >= 0.3 && artistMatchResult) {
    return { confidence: "low", reason: "duration", score: 0.5 };
  }

  if (durationOk && nameScore >= 0.1) {
    return { confidence: "low", reason: "duration", score: 0.35 };
  }

  if (durationOk && artistMatchResult) {
    return { confidence: "low", reason: "duration", score: 0.3 };
  }

  if (durationOk) {
    return { confidence: "low", reason: "duration", score: 0.25 };
  }

  return { confidence: "none", reason: "none", score: 0 };
}

/**
 * 将Spotify曲目与YouTube搜索结果进行匹配
 * @param {SpotifyTrack} track Spotify曲目对象
 * @param {YouTubeSong[]} results YouTube搜索结果数组
 * @returns {MatchResult} 匹配结果对象
 */
export function matchTrackToResults(
  track: SpotifyTrack,
  results: YouTubeSong[],
): MatchResult {
  if (results.length === 0) {
    return {
      track,
      youtubeSong: null,
      confidence: "none",
      matchReason: "none",
    };
  }

  let bestResult: MatchResult | null = null;
  let bestScore = 0;

  for (const ytSong of results) {
    const { confidence, reason, score } = calculateConfidence(track, ytSong);
    if (score > bestScore) {
      bestScore = score;
      bestResult = {
        track,
        youtubeSong: ytSong,
        confidence,
        matchReason: reason,
        matchedName: ytSong.name,
        matchedArtist: ytSong.artist,
      };
    }
  }

  return (
    bestResult || {
      track,
      youtubeSong: null,
      confidence: "none",
      matchReason: "none",
    }
  );
}

/**
 * 根据最小置信度过滤匹配结果
 * @param {MatchResult[]} results 匹配结果数组
 * @param {MatchConfidence} minConfidence 最小置信度
 * @returns {MatchResult[]} 过滤后的匹配结果数组
 */
export function filterByConfidence(
  results: MatchResult[],
  minConfidence: MatchConfidence,
): MatchResult[] {
  const confidenceOrder: MatchConfidence[] = ["none", "low", "medium", "high"];
  const minIndex = confidenceOrder.indexOf(minConfidence);
  return results.filter((r): boolean => {
    const idx = confidenceOrder.indexOf(r.confidence);
    return idx >= minIndex;
  });
}
