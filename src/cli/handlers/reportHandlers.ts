import { DB } from "../../utils/db.js";
import { t } from "../../utils/i18n.js";
import {
  generateReport,
  formatJSON,
  formatMarkdown,
  formatHTML,
  saveReport,
  printReportSummary,
  type ReportFormat,
} from "../../utils/report.js";
import { promptSelectList } from "../../tui/selectList.js";
import { showWarning, showSuccess } from "../../tui/notification.js";
import { promptPressEnter } from "../prompts.js";

const db = new DB("./import-progress.sqlite");

/**
 * 导入运行摘要行数据类型
 */
interface RunSummaryRow {
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
}

/**
 * 处理生成报告的 CLI 交互流程
 */
export async function handleGenerateReport(): Promise<void> {
  const runsResult = db.listRunSummaries(50);
  const runs = Array.isArray(runsResult.data) ? runsResult.data : [];

  if (runs.length === 0) {
    console.clear();
    await showWarning(t("report_no_runs"));
    await promptPressEnter();
    return;
  }

  const selectedRun = await promptSelectList({
    message: t("report_select_run"),
    choices: [
      ...runs.map((run) => {
        const row = run as RunSummaryRow;
        const label = `${row.csv_path} | ${row.created_at} | ${row.status}`;
        return { name: label, value: row.run_id };
      }),
      { name: t("menu_back"), value: "back" },
    ],
  });

  if (selectedRun === "back") {
    return;
  }

  const runId = selectedRun;

  const reportFormat = await promptSelectList<ReportFormat>({
    message: t("report_select_format"),
    choices: [
      { name: t("report_format_json"), value: "json" },
      { name: t("report_format_markdown"), value: "markdown" },
      { name: t("report_format_html"), value: "html" },
    ],
  });

  const report = generateReport(runId, db);

  if (!report) {
    await showWarning(t("report_run_not_found", { runId }));
    await promptPressEnter();
    return;
  }

  let content: string;
  switch (reportFormat) {
    case "json":
      content = formatJSON(report);
      break;
    case "markdown":
      content = formatMarkdown(report);
      break;
    case "html":
      content = formatHTML(report);
      break;
  }

  const filePath = saveReport(content, reportFormat, runId);

  console.clear();
  printReportSummary(report);
  console.log("");
  await showSuccess(t("report_saved", { path: filePath }));
  await promptPressEnter();
}
