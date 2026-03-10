import type {
  SpotifyTrack,
  YouTubeSong,
  MatchResult,
  MatchConfidence,
  MatchReason,
  MatchResultWithCandidates,
} from "../types/index.js";
import { logger } from "../utils/logger.js";

/**
 * 全角转半角映射表
 */
const FULLWIDTH_TO_HALFWIDTH: Record<string, string> = {
  "！": "!",
  "？": "?",
  "．": ".",
  "，": ",",
  "：": ":",
  "；": ";",
  "／": "/",
  "－": "-",
  "（": "(",
  "）": ")",
  "［": "[",
  "］": "]",
  "｛": "{",
  "｝": "}",
  "｜": "|",
  "＋": "+",
  "＝": "=",
  "＊": "*",
  "％": "%",
  "＠": "@",
  "｀": "`",
  "￣": "~",
  "・": "·",
};

/**
 * 平假名转片假名映射表
 */
const HIRAGANA_TO_KATAKANA: Record<string, string> = {
  あ: "ア",
  い: "イ",
  う: "ウ",
  え: "エ",
  お: "オ",
  か: "カ",
  き: "キ",
  く: "ク",
  け: "ケ",
  こ: "コ",
  さ: "サ",
  し: "シ",
  す: "ス",
  せ: "セ",
  そ: "ソ",
  た: "タ",
  ち: "チ",
  つ: "ツ",
  て: "テ",
  と: "ト",
  な: "ナ",
  に: "ニ",
  ぬ: "ヌ",
  ね: "ネ",
  の: "ノ",
  は: "ハ",
  ひ: "ヒ",
  ふ: "フ",
  へ: "ヘ",
  ほ: "ホ",
  ま: "マ",
  み: "ミ",
  む: "ム",
  め: "メ",
  も: "モ",
  や: "ヤ",
  ゆ: "ユ",
  よ: "ヨ",
  ら: "ラ",
  り: "リ",
  る: "ル",
  れ: "レ",
  ろ: "ロ",
  わ: "ワ",
  を: "ヲ",
  ん: "ン",
  が: "ガ",
  ぎ: "ギ",
  ぐ: "グ",
  げ: "ゲ",
  ご: "ゴ",
  ざ: "ザ",
  じ: "ジ",
  ず: "ズ",
  ぜ: "ゼ",
  ぞ: "ゾ",
  だ: "ダ",
  ぢ: "ヂ",
  づ: "ヅ",
  で: "デ",
  ど: "ド",
  ば: "バ",
  び: "ビ",
  ぶ: "ブ",
  べ: "ベ",
  ぼ: "ボ",
  ぱ: "パ",
  ぴ: "ピ",
  ぷ: "プ",
  ぺ: "ペ",
  ぽ: "ポ",
  ぁ: "ァ",
  ぃ: "ィ",
  ぅ: "ゥ",
  ぇ: "ェ",
  ぉ: "ォ",
  ゃ: "ャ",
  ゅ: "ュ",
  ょ: "ョ",
  っ: "ッ",
};

/**
 * 将全角字符转换为半角
 * @param {string} str 输入字符串
 * @returns {string} 转换后的字符串
 */
export function fullwidthToHalfwidth(str: string): string {
  let result = "";
  for (const char of str) {
    const code = char.codePointAt(0);
    if (code !== undefined && code >= 0xff01 && code <= 0xff5e) {
      result +=
        FULLWIDTH_TO_HALFWIDTH[char] ||
        String.fromCodePoint(code - 0xff00 + 0x20);
    } else if (char === "　") {
      result += " ";
    } else {
      result += char;
    }
  }
  return result;
}

/**
 * 将平假名转换为片假名
 * @param {string} str 输入字符串
 * @returns {string} 转换后的字符串
 */
export function hiraganaToKatakana(str: string): string {
  let result = "";
  for (const char of str) {
    result += HIRAGANA_TO_KATAKANA[char] || char;
  }
  return result;
}

/**
 * 标准化字符串
 * @param {string} str 输入字符串
 * @returns {string} 标准化后的字符串
 */
export function normalizeString(str: string): string {
  const result = str.normalize("NFKC");

  let normalized = "";
  for (const char of result) {
    const code = char.codePointAt(0);
    if (code !== undefined && code >= 0xff01 && code <= 0xff5e) {
      normalized +=
        FULLWIDTH_TO_HALFWIDTH[char] ||
        String.fromCodePoint(code - 0xff00 + 0x20);
    } else if (code !== undefined && code >= 0x3040 && code <= 0x309f) {
      normalized += HIRAGANA_TO_KATAKANA[char] || char;
    } else if (char === "　") {
      normalized += " ";
    } else {
      normalized += char;
    }
  }

  return normalized
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
 * 版本信息正则表达式
 */
const VERSION_PATTERNS = [
  /\b(remix)\b/i,
  /\b(original\s*mix)\b/i,
  /\b(radio\s*edit)\b/i,
  /\b(extended\s*mix)\b/i,
  /\b(extended\s*version)\b/i,
  /\b(album\s*version)\b/i,
  /\b(instrumental)\b/i,
  /\b(acoustic)\b/i,
  /\b(live)\b/i,
  /\b(clean\s*version)\b/i,
  /\b(explicit\s*version)\b/i,
  /\b(remastered)\b/i,
  /\b(demo)\b/i,
  /\b(cover)\b/i,
  /\b(feat\.?|featuring|ft\.?)\b\.?/i,
];

/**
 * 提取版本信息并返回清理后的标题
 * @param {string} title 原始标题
 * @returns {{ cleanTitle: string; version: string }} 清理后的标题和版本信息
 */
export function extractVersionInfo(title: string): {
  /** 清理后的标题 */
  cleanTitle: string;
  /** 版本信息 */
  version: string;
} {
  const normalized = normalizeFeature(title).toLowerCase();
  const versionParts: string[] = [];
  let cleanTitle = normalized;

  for (const pattern of VERSION_PATTERNS) {
    const match = cleanTitle.match(pattern);
    if (match) {
      versionParts.push(match[0]);
      cleanTitle = cleanTitle.replace(pattern, " ");
    }
  }

  cleanTitle = cleanTitle.replace(/\s+/g, " ").trim();

  return {
    cleanTitle,
    version: versionParts.join(" | "),
  };
}

/**
 * 统一协作艺术家变体
 * @param {string} str 输入字符串
 * @returns {string} 统一后的字符串
 */
export function normalizeFeature(str: string): string {
  return str
    .replace(/\b(feat\.?|featuring)\b\.?/gi, "feat")
    .replace(/\bft\.?\b\.?/gi, "feat")
    .replace(/\band\b/gi, "&")
    .replace(/\s*\+\s*/g, " & ")
    .replace(/\s*,\s*/g, " & ");
}

/**
 * 将标题分词并去除停用词
 * @param {string} title 标题字符串
 * @returns {string[]} 分词后的标题数组
 */
function tokenizeTitle(title: string): string[] {
  const normalized = normalizeFeature(normalizeString(title))
    .replace(/\b(feat)\b/gu, " ")
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
  const normalizedTrack = normalizeFeature(normalizeString(trackArtist));
  const normalizedYt = normalizeFeature(normalizeString(ytArtist));

  if (normalizedTrack === normalizedYt) return true;
  if (
    normalizedYt.includes(normalizedTrack) ||
    normalizedTrack.includes(normalizedYt)
  )
    return true;

  /**
   * 将艺术家字符串分割成数组
   * @param {string} value - 艺术家字符串
   * @returns {string[]} 分割后的艺术家数组
   */
  const splitArtists = (value: string): string[] =>
    normalizeFeature(value)
      .replace(/[&,]/g, " ")
      .split(" ")
      .map((s) => s.trim())
      .filter(Boolean);

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

  logger.debug("计算匹配置信度", {
    trackName: track.name,
    trackArtist: track.artist,
    ytName: ytSong.name,
    ytArtist: ytSong.artist,
    nameScore,
    artistMatchResult,
    durationKnown,
    durationOk,
  });

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
    logger.debug("搜索结果为空", {
      trackName: track.name,
      trackArtist: track.artist,
    });
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

  const finalResult = bestResult || {
    track,
    youtubeSong: null,
    confidence: "none",
    matchReason: "none",
  };

  logger.debug("匹配完成", {
    trackName: track.name,
    confidence: finalResult.confidence,
    reason: finalResult.matchReason,
    score: bestScore,
  });

  return finalResult;
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

/**
 * 计算单个候选的匹配信息
 * @param {SpotifyTrack} track Spotify曲目对象
 * @param {YouTubeSong} ytSong YouTube曲目对象
 * @returns {{ confidence: MatchConfidence; reason: MatchReason; score: number }} 匹配信息
 */
function computeMatchInfo(
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
  return calculateConfidence(track, ytSong);
}

/**
 * 将Spotify曲目与YouTube搜索结果进行匹配，返回包含候选列表的结果
 * @param {SpotifyTrack} track Spotify曲目对象
 * @param {YouTubeSong[]} results YouTube搜索结果数组
 * @param {number} maxCandidates 最大候选数量，默认5
 * @returns {MatchResultWithCandidates} 带候选列表的匹配结果
 */
export function matchTrackWithCandidates(
  track: SpotifyTrack,
  results: YouTubeSong[],
  maxCandidates = 5,
): MatchResultWithCandidates {
  if (results.length === 0) {
    return {
      track,
      youtubeSong: null,
      confidence: "none",
      matchReason: "none",
      candidates: [],
    };
  }

  const scoredResults: {
    /** YouTube歌曲对象 */
    song: YouTubeSong;
    /** 匹配置信度 */
    confidence: MatchConfidence;
    /** 匹配原因 */
    reason: MatchReason;
    /** 匹配分数 */
    score: number;
  }[] = [];

  for (const ytSong of results) {
    const { confidence, reason, score } = computeMatchInfo(track, ytSong);
    scoredResults.push({ song: ytSong, confidence, reason, score });
  }

  scoredResults.sort((a, b) => b.score - a.score);

  const candidates = scoredResults.slice(0, maxCandidates).map((r) => r.song);

  const best = scoredResults[0];
  if (!best) {
    return {
      track,
      youtubeSong: null,
      confidence: "none",
      matchReason: "none",
      candidates: [],
    };
  }

  return {
    track,
    youtubeSong: best.song,
    confidence: best.confidence,
    matchReason: best.reason,
    matchedName: best.song.name,
    matchedArtist: best.song.artist,
    candidates,
  };
}
