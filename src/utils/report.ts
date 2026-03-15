import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DB, type DBResult } from "./db.js";
import { getConfig, type ImporterConfig } from "./config.js";
import { t, getLanguage } from "./i18n.js";
import type { MatchConfidence, MatchReason } from "../types/index.js";

/**
 * 获取当前语言对应的 locale 字符串
 * @returns {string} locale 字符串（如 "en-US", "zh-CN", "ja-JP"）
 */
function getLocale(): string {
  const lang = getLanguage();
  switch (lang) {
    case "zh-CN":
      return "zh-CN";
    case "ja":
      return "ja-JP";
    default:
      return "en-US";
  }
}

/**
 * 格式化时长为友好显示
 * @param {number} ms - 毫秒数
 * @returns {string} 格式化后的时长字符串
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}${t("report_duration_days")} ${hours % 24}${t("report_duration_hours")} ${minutes % 60}${t("report_duration_minutes")}`;
  }
  if (hours > 0) {
    return `${hours}${t("report_duration_hours")} ${minutes % 60}${t("report_duration_minutes")} ${seconds % 60}${t("report_duration_seconds")}`;
  }
  if (minutes > 0) {
    return `${minutes}${t("report_duration_minutes")} ${seconds % 60}${t("report_duration_seconds")}`;
  }
  return `${seconds}${t("report_duration_seconds")}`;
}

/**
 * 格式化日期时间
 * @param {Date} date - Date 对象
 * @returns {string} 格式化后的日期时间字符串
 */
function formatDateTime(date: Date): string {
  const locale = getLocale();
  return date.toLocaleString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * 报告导出格式类型
 */
export type ReportFormat = "json" | "markdown" | "html";

/**
 * 失败曲目报告数据结构
 */
export interface FailedTrackReport {
  /** 曲目名称 */
  name: string;
  /** 艺术家名称 */
  artist: string;
  /** 专辑名称 */
  album: string;
  /** 时长（毫秒） */
  duration?: number;
  /** 错误信息 */
  errorMessage?: string;
  /** 匹配到的曲目名称 */
  matchedName?: string;
  /** 匹配到的艺术家名称 */
  matchedArtist?: string;
  /** 匹配原因 */
  matchReason?: MatchReason;
  /** 匹配置信度 */
  confidence?: MatchConfidence;
}

/**
 * 导入报告数据结构
 */
export interface ImportReport {
  /** 报告生成时间 */
  generatedAt: string;
  /** 运行 ID */
  runId: string;
  /** CSV 文件路径 */
  csvPath: string;
  /** 创建时间 */
  createdAt: string;
  /** 运行状态 */
  status: string;
  /** 运行时长（毫秒） */
  duration: number;
  /** 统计信息 */
  stats: {
    /** 总曲目数 */
    total: number;
    /** 匹配成功的曲目数 */
    matched: number;
    /** 高置信度匹配数 */
    highConfidence: number;
    /** 中置信度匹配数 */
    mediumConfidence: number;
    /** 低置信度匹配数 */
    lowConfidence: number;
    /** 未匹配的曲目数 */
    unmatched: number;
    /** 导入成功的曲目数 */
    importSuccess: number;
    /** 导入失败的曲目数 */
    importFailed: number;
    /** 跳过的曲目数 */
    skipped: number;
  };
  /** 失败曲目列表 */
  failedTracks: FailedTrackReport[];
}

/**
 * 根据运行 ID 从数据库获取运行记录
 * @param {string} runId - 运行 ID
 * @param {DB} db - 数据库实例
 * @returns {DBResult} 运行记录数据，如果找不到则返回 null
 */
function getRunById(runId: string, db: DB) {
  const result = db.getRunById(runId);
  if (
    !result.success ||
    !result.data ||
    !Array.isArray(result.data) ||
    result.data.length === 0
  ) {
    return null;
  }
  return result.data[0];
}

/**
 * 根据运行 ID 从数据库获取失败曲目列表
 * @param {string} runId - 运行 ID
 * @param  {DB} db - 数据库实例
 * @returns {DBResult} 失败曲目列表
 */
function getFailedTracks(runId: string, db: DB) {
  const result = db.listFailedTracks(runId, 1000);
  if (!result.success || !result.data || !Array.isArray(result.data)) {
    return [];
  }
  return result.data;
}

/**
 * 根据运行 ID 从数据库获取匹配成功的曲目列表
 * @param {string} runId - 运行 ID
 * @param {DB} db - 数据库实例
 * @returns {DBResult} 匹配成功的曲目列表
 */
function getMatchedTracks(runId: string, db: DB) {
  const result = db.listMatchedTracks(runId);
  if (!result.success || !result.data || !Array.isArray(result.data)) {
    return [];
  }
  return result.data;
}

/**
 * 根据运行 ID 生成导入报告
 * @param {string} runId - 运行 ID
 * @param {DB} db - 数据库实例
 * @returns {ImportReport | null} 导入报告数据，如果找不到运行记录则返回 null
 */
export function generateReport(runId: string, db: DB): ImportReport | null {
  const run = getRunById(runId, db);
  if (!run) {
    console.warn(t("report_run_not_found", { runId }));
    return null;
  }

  const runData = run as {
    /** 运行 ID */
    run_id: string;
    /** CSV 文件路径 */
    csv_path: string;
    /** 创建时间 */
    created_at: string;
    /** 运行状态 */
    status: string;
    /** 总轨道数 */
    total_tracks: number;
    /** 已处理轨道数 */
    processed_tracks: number;
    /** 已匹配轨道数 */
    matched_tracks: number;
    /** 失败轨道数 */
    failed_tracks: number;
    /** 跳过轨道数 */
    skipped_tracks: number;
  };

  const failedTracksData = getFailedTracks(runId, db);
  const matchedTracksData = getMatchedTracks(runId, db);

  let highConfidence = 0;
  let mediumConfidence = 0;
  let lowConfidence = 0;

  for (const matched of matchedTracksData) {
    const m = matched as {
      /** 匹配结果 JSON 字符串 */
      match_result_json: string;
    };
    try {
      const matchResult = JSON.parse(m.match_result_json);
      if (matchResult.confidence === "high") highConfidence++;
      else if (matchResult.confidence === "medium") mediumConfidence++;
      else if (matchResult.confidence === "low") lowConfidence++;
    } catch {
      // ignore parse errors
    }
  }

  const failedTracks: FailedTrackReport[] = [];
  for (const failed of failedTracksData) {
    const f = failed as {
      /** 曲目 JSON 字符串 */
      track_json: string;
      /** 匹配结果 JSON 字符串（如果有） */
      match_result_json?: string;
      /** 错误信息（如果有） */
      error_message?: string;
    };
    try {
      const track = JSON.parse(f.track_json);
      let matchResult: Record<string, unknown> | null = null;
      if (f.match_result_json) {
        try {
          matchResult = JSON.parse(f.match_result_json);
        } catch {
          // ignore
        }
      }
      failedTracks.push({
        name: track.name || "Unknown",
        artist: track.artist || "Unknown",
        album: track.album || "",
        duration: track.duration,
        errorMessage: f.error_message || undefined,
        matchedName: matchResult?.matchedName as string | undefined,
        matchedArtist: matchResult?.matchedArtist as string | undefined,
        matchReason: matchResult?.matchReason as MatchReason | undefined,
        confidence: matchResult?.confidence as MatchConfidence | undefined,
      });
    } catch {
      // ignore parse errors
    }
  }

  const createdAt = new Date(runData.created_at);
  const now = new Date();
  const duration = now.getTime() - createdAt.getTime();

  return {
    generatedAt: now.toISOString(),
    runId: runData.run_id,
    csvPath: runData.csv_path,
    createdAt: runData.created_at,
    status: runData.status,
    duration,
    stats: {
      total: runData.total_tracks,
      matched: runData.matched_tracks,
      highConfidence,
      mediumConfidence,
      lowConfidence,
      unmatched: runData.failed_tracks,
      importSuccess: runData.matched_tracks,
      importFailed: runData.failed_tracks,
      skipped: runData.skipped_tracks,
    },
    failedTracks,
  };
}

/**
 * 将报告格式化为 JSON 字符串
 * @param {ImportReport} report - 导入报告数据
 * @returns {string} JSON 格式的报告字符串
 */
export function formatJSON(report: ImportReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * 将报告格式化为 Markdown 字符串
 * @param {ImportReport} report - 导入报告数据
 * @returns {string} Markdown 格式的报告字符串
 */
export function formatMarkdown(report: ImportReport): string {
  const lines: string[] = [];
  const date = formatDateTime(new Date(report.createdAt));
  const duration = formatDuration(report.duration);

  lines.push(`# ${t("report_title")}`);
  lines.push("");
  lines.push(`**${t("report_csv_path")}:** ${report.csvPath}`);
  lines.push(`**${t("report_status")}:** ${report.status}`);
  lines.push(`**${t("report_created_at")}:** ${date}`);
  lines.push(`**${t("report_duration")}:** ${duration}`);
  lines.push("");

  lines.push(`## ${t("report_stats_title")}`);
  lines.push("");
  lines.push(
    `| ${t("report_stat_total")} | ${t("report_stat_matched")} | ${t("report_stat_unmatched")} | ${t("report_stat_skipped")} |`,
  );
  lines.push(`|---|---|---|---|`);
  lines.push(
    `| ${report.stats.total} | ${report.stats.matched} | ${report.stats.unmatched} | ${report.stats.skipped} |`,
  );
  lines.push("");

  lines.push(`### ${t("report_confidence_distribution")}`);
  lines.push("");
  lines.push(
    `- ${t("report_high_confidence")}: ${report.stats.highConfidence}`,
  );
  lines.push(
    `- ${t("report_medium_confidence")}: ${report.stats.mediumConfidence}`,
  );
  lines.push(`- ${t("report_low_confidence")}: ${report.stats.lowConfidence}`);
  lines.push("");

  if (report.failedTracks.length > 0) {
    lines.push(
      `## ${t("report_failed_tracks")} (${report.failedTracks.length})`,
    );
    lines.push("");
    lines.push(
      `| # | ${t("report_track_name")} | ${t("report_artist")} | ${t("report_error")} |`,
    );
    lines.push(`|---|---|---|---|`);
    report.failedTracks.forEach((track, index) => {
      const error = track.errorMessage || track.matchReason || "-";
      lines.push(
        `| ${index + 1} | ${track.name} | ${track.artist} | ${error} |`,
      );
    });
  }

  lines.push("");
  lines.push(
    `---\n*${t("report_generated_at")}: ${formatDateTime(new Date(report.generatedAt))}*`,
  );

  return lines.join("\n");
}

/**
 * 将报告格式化为 HTML 字符串
 * @param {ImportReport} report - 导入报告数据
 * @returns {string} HTML 格式的报告字符串
 */
export function formatHTML(report: ImportReport): string {
  const date = formatDateTime(new Date(report.createdAt));
  const duration = formatDuration(report.duration);

  const failedTracksHTML =
    report.failedTracks.length > 0
      ? `<div class="failed-list">
        <h2>${t("report_failed_tracks")} (${report.failedTracks.length})</h2>
        ${report.failedTracks
          .map(
            (track, index) => `
          <div class="failed-item">
            <div class="track-info"><strong>${index + 1}. ${track.name}</strong> - ${track.artist}</div>
            <div class="error">${track.errorMessage || track.matchReason || "-"}</div>
          </div>
        `,
          )
          .join("")}
      </div>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t("report_title")}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; background: #fafafa; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #2563eb; padding-bottom: 0.5rem; }
    h2 { color: #374151; margin-top: 1.5rem; }
    .meta { background: white; padding: 1rem; border-radius: 8px; margin: 1rem 0; }
    .meta-item { margin: 0.5rem 0; }
    .meta-label { font-weight: 600; color: #6b7280; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin: 1rem 0; }
    .stat-box { background: white; padding: 1rem; border-radius: 8px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .stat-value { font-size: 1.75rem; font-weight: bold; color: #2563eb; }
    .stat-label { color: #6b7280; margin-top: 0.25rem; font-size: 0.875rem; }
    .confidence { margin: 1rem 0; }
    .confidence-item { display: inline-block; margin-right: 1.5rem; padding: 0.5rem 1rem; background: #e5e7eb; border-radius: 4px; }
    .failed-list { background: white; padding: 1rem; border-radius: 8px; margin-top: 1rem; }
    .failed-item { padding: 0.75rem 0; border-bottom: 1px solid #e5e7eb; }
    .failed-item:last-child { border-bottom: none; }
    .track-info { color: #1f2937; }
    .error { color: #dc2626; font-size: 0.875rem; margin-top: 0.25rem; }
    .footer { margin-top: 2rem; color: #9ca3af; font-size: 0.875rem; text-align: center; }
  </style>
</head>
<body>
  <h1>${t("report_title")}</h1>
  
  <div class="meta">
    <div class="meta-item"><span class="meta-label">${t("report_csv_path")}:</span> ${report.csvPath}</div>
    <div class="meta-item"><span class="meta-label">${t("report_status")}:</span> ${report.status}</div>
    <div class="meta-item"><span class="meta-label">${t("report_created_at")}:</span> ${date}</div>
    <div class="meta-item"><span class="meta-label">${t("report_duration")}:</span> ${duration}</div>
  </div>

  <h2>${t("report_stats_title")}</h2>
  <div class="stats">
    <div class="stat-box"><div class="stat-value">${report.stats.total}</div><div class="stat-label">${t("report_stat_total")}</div></div>
    <div class="stat-box"><div class="stat-value">${report.stats.matched}</div><div class="stat-label">${t("report_stat_matched")}</div></div>
    <div class="stat-box"><div class="stat-value">${report.stats.unmatched}</div><div class="stat-label">${t("report_stat_unmatched")}</div></div>
    <div class="stat-box"><div class="stat-value">${report.stats.skipped}</div><div class="stat-label">${t("report_stat_skipped")}</div></div>
  </div>

  <div class="confidence">
    <div class="confidence-item">${t("report_high_confidence")}: ${report.stats.highConfidence}</div>
    <div class="confidence-item">${t("report_medium_confidence")}: ${report.stats.mediumConfidence}</div>
    <div class="confidence-item">${t("report_low_confidence")}: ${report.stats.lowConfidence}</div>
  </div>

  ${failedTracksHTML}

  <div class="footer">${t("report_generated_at")}: ${formatDateTime(new Date(report.generatedAt))}</div>
</body>
</html>`;
}

/**
 * 保存报告内容到文件
 * @param {string} content - 报告内容
 * @param {ReportFormat} format - 报告格式
 * @param {string} runId - 运行 ID
 * @param {ImporterConfig} config - 可选的配置对象
 * @returns {string} 保存的文件路径
 */
export function saveReport(
  content: string,
  format: ReportFormat,
  runId: string,
  config?: ImporterConfig,
): string {
  const cfg = config || getConfig();
  const reportDir = cfg.reportPath;

  if (!existsSync(reportDir)) {
    mkdirSync(reportDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `report-${runId}-${timestamp}.${format}`;
  const filePath = join(reportDir, filename);

  writeFileSync(filePath, content, "utf-8");

  return filePath;
}

/**
 * 在终端打印报告摘要
 * @param {ImportReport} report - 导入报告数据
 */
export function printReportSummary(report: ImportReport): void {
  console.log("");
  console.log(`========== ${t("report_summary_title")} ==========`);
  console.log(`${t("report_csv_path")}: ${report.csvPath}`);
  console.log(`${t("report_status")}: ${report.status}`);
  console.log(
    `${t("report_created_at")}: ${formatDateTime(new Date(report.createdAt))}`,
  );
  console.log(`${t("report_duration")}: ${formatDuration(report.duration)}`);
  console.log("");
  console.log(`${t("report_stat_total")}: ${report.stats.total}`);
  console.log(
    `${t("report_stat_matched")}: ${report.stats.matched} (${t("report_high_confidence")}: ${report.stats.highConfidence}, ${t("report_medium_confidence")}: ${report.stats.mediumConfidence}, ${t("report_low_confidence")}: ${report.stats.lowConfidence})`,
  );
  console.log(`${t("report_stat_unmatched")}: ${report.stats.unmatched}`);
  console.log(`${t("report_stat_skipped")}: ${report.stats.skipped}`);
  console.log("");

  if (report.failedTracks.length > 0) {
    console.log(
      `${t("report_failed_tracks")} (${report.failedTracks.length}):`,
    );
    const displayCount = Math.min(report.failedTracks.length, 10);
    for (let i = 0; i < displayCount; i++) {
      const track = report.failedTracks[i];
      if (!track) continue;
      const error = track.errorMessage || track.matchReason || "-";
      console.log(`  ${i + 1}. ${track.name} - ${track.artist} (${error})`);
    }
    if (report.failedTracks.length > 10) {
      console.log(
        `  ... ${t("report_and_more", { count: String(report.failedTracks.length - 10) })}`,
      );
    }
  }
  console.log("================================");
}
