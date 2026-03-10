import { DB } from "../../utils/db.js";
import { promptPressEnter } from "../prompts.js";
import { promptSelectList } from "../../tui/selectList.js";
import { showWarning, showSuccess } from "../../tui/notification.js";
import { t } from "../../utils/i18n.js";

const db = new DB("./import-progress.sqlite");

/**
 * 导入运行摘要行。
 */
interface RunSummaryRow {
  /**
   * 运行 ID。
   */
  run_id: string;
  /**
   * CSV 文件路径。
   */
  csv_path: string;
  /**
   * 创建时间。
   */
  created_at: string;
  /**
   * 运行状态。
   */
  status: string;
  /**
   * 总轨道数。
   */
  total_tracks: number;
  /**
   * 已处理轨道数。
   */
  processed_tracks: number;
  /**
   * 已匹配轨道数。
   */
  matched_tracks: number;
  /**
   * 失败轨道数。
   */
  failed_tracks: number;
  /**
   * 跳过轨道数。
   */
  skipped_tracks: number;
}

/**
 * 失败轨道记录行。
 */
interface FailedTrackRow {
  /**
   * 轨道 JSON 字符串。
   */
  track_json?: string;
}

/**
 * 失败轨道展示项。
 */
interface FailedTrackPreview {
  /**
   * 歌曲名。
   */
  name: string;
  /**
   * 艺术家名。
   */
  artist: string;
}

/**
 * 带失败数量的运行项。
 */
interface RunWithFailedCount {
  /**
   * 运行摘要。
   */
  run: RunSummaryRow;
  /**
   * 失败条目数量。
   */
  failedCount: number;
}

/**
 * 展示进度页时使用的数据行。
 */
interface ViewProgressItem {
  /**
   * CSV 文件路径。
   */
  csv_path: string;
  /**
   * 创建时间。
   */
  created_at: string;
  /**
   * 运行状态。
   */
  status: string;
  /**
   * 总轨道数。
   */
  total_tracks: number;
  /**
   * 已处理轨道数。
   */
  processed_tracks: number;
  /**
   * 已匹配轨道数。
   */
  matched_tracks: number;
  /**
   * 失败轨道数。
   */
  failed_tracks: number;
  /**
   * 跳过轨道数。
   */
  skipped_tracks: number;
}

/**
 * 展示失败页时使用的数据行。
 */
interface ViewFailedItem {
  /**
   * CSV 文件路径。
   */
  csv_path: string;
  /**
   * 创建时间。
   */
  created_at: string;
  /**
   * 失败轨道预览。
   */
  failedTracks: FailedTrackPreview[];
}

/**
 * 可恢复导入的选项。
 */
interface ResumeSelection {
  /**
   * 运行 ID。
   */
  run_id: string;
  /**
   * CSV 文件路径。
   */
  csv_path: string;
  /**
   * 创建时间。
   */
  created_at: string;
  /**
   * 运行状态。
   */
  status: string;
  /**
   * 总轨道数。
   */
  total_tracks: number;
  /**
   * 已处理轨道数。
   */
  processed_tracks: number;
  /**
   * 已匹配轨道数。
   */
  matched_tracks: number;
  /**
   * 失败轨道数。
   */
  failed_tracks: number;
  /**
   * 跳过轨道数。
   */
  skipped_tracks: number;
}

/**
 * 查看历史导入进度。
 * @returns {Promise<void>} 页面关闭后 resolved。
 */
export async function handleViewProgress(): Promise<void> {
  const runsResult = db.listRunSummaries(50);
  const runs = Array.isArray(runsResult.data) ? runsResult.data : [];
  if (runs.length === 0) {
    console.clear();
    await showWarning(t("no_progress_found"));
    await promptPressEnter();
    return;
  }

  const data: ViewProgressItem[] = runs.map((run) => {
    const row = run as RunSummaryRow;
    return {
      csv_path: row.csv_path,
      created_at: row.created_at,
      status: row.status,
      total_tracks: row.total_tracks,
      processed_tracks: row.processed_tracks,
      matched_tracks: row.matched_tracks,
      failed_tracks: row.failed_tracks,
      skipped_tracks: row.skipped_tracks,
    };
  });

  console.clear();
  const { viewProgressTui } = await import("../../tui/viewProgress.js");
  await viewProgressTui(data);
}

/**
 * 查看失败轨道列表。
 * @returns {Promise<void>} 页面关闭后 resolved。
 */
export async function handleViewFailed(): Promise<void> {
  const runsResult = db.listRunSummaries(50);
  const runs = Array.isArray(runsResult.data) ? runsResult.data : [];

  const runsWithFailed: RunWithFailedCount[] = [];

  for (const run of runs) {
    const row = run as RunSummaryRow;
    const failed = db.listFailedTracks(row.run_id, 1);
    const failedRows = Array.isArray(failed.data) ? failed.data : [];
    if (failedRows.length > 0) {
      const failedCount = db.listFailedTracks(row.run_id, 1000);
      runsWithFailed.push({
        run,
        failedCount: Array.isArray(failedCount.data)
          ? failedCount.data.length
          : 0,
      });
    }
  }

  if (runsWithFailed.length === 0) {
    console.clear();
    await showSuccess(t("no_failed"));
    await promptPressEnter();
    return;
  }

  const data: ViewFailedItem[] = runsWithFailed.map(({ run }) => {
    const row = run;
    const failed = db.listFailedTracks(row.run_id, 100);
    const failedRows = Array.isArray(failed.data) ? failed.data : [];
    const failedTracks = failedRows
      .map((f) => {
        const fRow = f as FailedTrackRow;
        const parsed = fRow.track_json ? JSON.parse(fRow.track_json) : null;
        return parsed ? { name: parsed.name, artist: parsed.artist } : null;
      })
      .filter(Boolean) as FailedTrackPreview[];

    return {
      csv_path: row.csv_path,
      created_at: row.created_at,
      failedTracks,
    };
  });

  console.clear();
  const { viewFailedTui } = await import("../../tui/viewFailed.js");
  await viewFailedTui(data);
}

/**
 * 选择一条可恢复的导入记录。
 * @returns {Promise<ResumeSelection | null>} 选择结果；返回 null 表示取消。
 */
export async function handleViewResumeSelect(): Promise<ResumeSelection | null> {
  const runsResult = db.listRunSummaries(50);
  const runs = Array.isArray(runsResult.data) ? runsResult.data : [];
  if (runs.length === 0) {
    await showWarning(t("no_progress_found"));
    await promptPressEnter();
    return null;
  }

  const { selected } = await promptSelectList({
    message: t("menu_resume"),
    choices: [
      ...runs.map((run) => {
        const row = run as RunSummaryRow;
        const label = `${row.csv_path} | ${row.created_at} | ${row.status}`;
        return { name: label, value: run };
      }),
      { name: t("menu_back"), value: "back" },
    ],
  });

  if (selected === "back") {
    return null;
  }

  return selected as ResumeSelection;
}
