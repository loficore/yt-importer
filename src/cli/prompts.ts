import inquirer from "inquirer";
import { existsSync } from "node:fs";
import { glob } from "glob";
import type { ImportStats, MatchConfidence } from "../types/index.js";
import { t } from "../utils/i18n.js";

/** 导入选项接口 */
export interface ImportAnswers {
  /** CSV文件路径 */
  csvPath: string;
  /** 创建的YouTube Music播放列表名称 */
  playlistName: string;
  /** 最小匹配置信度 */
  minConfidence: MatchConfidence;
  /** 请求之间的延迟（毫秒） */
  requestDelay: number;
  /** 是否跳过确认提示 */
  skipConfirmation: boolean;
}

/** 导入配置选项接口（不包含CSV路径） */
export interface ImportOptionsAnswers {
  /** 创建的YouTube Music播放列表名称 */
  playlistName: string;
  /** 最小匹配置信度 */
  minConfidence: MatchConfidence;
  /** 请求之间的延迟（毫秒） */
  requestDelay: number;
  /** 是否跳过确认提示 */
  skipConfirmation: boolean;
}

/**
 * 提示用户输入导入选项，并返回一个包含这些选项的对象。
 * @returns {Promise<ImportAnswers>} 包含用户输入的导入选项的对象
 */
export async function promptForImport(): Promise<ImportAnswers> {
  const csvPath = await promptForCsvFile();
  const playlistName = await promptForPlaylistName();
  const minConfidence = await promptForMinConfidence();
  const requestDelay = await promptForDelay();
  const skipConfirmation = await promptForConfirmation();

  return {
    csvPath,
    playlistName,
    minConfidence,
    requestDelay,
    skipConfirmation,
  };
}

/**
 * 提示用户输入导入配置选项（不包含CSV路径）
 * @returns {Promise<ImportOptionsAnswers>} 导入配置选项
 */
export async function promptForImportOptions(): Promise<ImportOptionsAnswers> {
  const playlistName = await promptForPlaylistName();
  const minConfidence = await promptForMinConfidence();
  const requestDelay = await promptForDelay();
  const skipConfirmation = await promptForConfirmation();

  return {
    playlistName,
    minConfidence,
    requestDelay,
    skipConfirmation,
  };
}

/**
 * 提示用户选择或输入CSV文件路径
 * @returns {Promise<string>} 用户选择或输入的CSV文件路径
 * @throws {Error} 如果用户输入的路径无效或文件不存在
 * @description 首先搜索当前目录及子目录中的CSV文件，并让用户选择。如果没有找到文件或用户选择浏览，则提示用户输入路径，并验证输入的有效性。
 */
export async function promptForCsvFile(): Promise<string> {
  const csvFiles = await findCsvFiles();

  if (csvFiles.length > 0) {
    const { selectedFile } = await inquirer.prompt([
      {
        type: "list",
        name: "selectedFile",
        message: t("csv_select"),
        choices: [
          { name: t("csv_browse"), value: "browse" },
          new inquirer.Separator(),
          ...csvFiles.map((file) => ({
            name: file,
            value: file,
          })),
        ],
      },
    ]);

    if (selectedFile !== "browse") {
      return selectedFile;
    }
  }

  const { customPath } = await inquirer.prompt([
    {
      type: "input",
      name: "customPath",
      message: t("csv_enter_path"),
      /**
       * 验证用户输入的CSV文件路径是否有效：
       * @type {string} 用户输入的CSV文件路径
       * @returns {boolean|string} 如果输入有效，返回true；否则返回错误消息字符串
       */
      validate: (input: string) => {
        /** @type {boolean | string} */
        let result: boolean | string = true;
        if (!input.trim()) {
          result = t("csv_validate_empty");
        } else if (!existsSync(input)) {
          result = t("csv_validate_not_found");
        } else if (!input.endsWith(".csv")) {
          result = t("csv_validate_extension");
        }
        return result;
      },
    },
  ]);

  return customPath;
}

/**
 * 提示用户选择多个CSV文件进行批量导入
 * @returns {Promise<string[]>} 用户选择的CSV文件路径数组
 */
export async function promptForMultipleCsvFiles(): Promise<string[]> {
  const csvFiles = await findCsvFiles();

  if (csvFiles.length === 0) {
    const { customPath } = await inquirer.prompt([
      {
        type: "input",
        name: "customPath",
        message: t("csv_enter_path"),
        /**
         *  验证用户输入的CSV文件路径是否有效：
         * @param {string} input - 用户输入的CSV文件路径
         * @returns {boolean|string} - 如果输入有效，返回true；否则返回错误消息字符串
         */
        validate: (input: string) => {
          /** @type {boolean | string} */
          let result: boolean | string = true;
          if (!input.trim()) {
            result = t("csv_validate_empty");
          } else if (!existsSync(input)) {
            result = t("csv_validate_not_found");
          } else if (!input.endsWith(".csv")) {
            result = t("csv_validate_extension");
          }
          return result;
        },
      },
    ]);
    return [customPath];
  }

  const { selectedFiles } = await inquirer.prompt([
    {
      type: "checkbox",
      name: "selectedFiles",
      message: t("csv_select_multiple"),
      /**
       * 验证用户选择的CSV文件路径是否有效：
       * @param {string[]} input - 用户选择的CSV文件路径数组
       * @returns {boolean|string} - 如果输入有效，返回true；否则返回错误消息字符串
       */
      validate: (input: string[]) => {
        if (input.length === 0) {
          return "Please select at least one file";
        }
        return true;
      },
      choices: [
        ...csvFiles.map((file) => ({
          name: file,
          value: file,
          checked: false,
        })),
        new inquirer.Separator(),
        { name: t("csv_browse"), value: "browse", checked: false },
      ],
    },
  ]);

  if (Array.isArray(selectedFiles) && selectedFiles.includes("browse")) {
    const { customPath } = await inquirer.prompt([
      {
        type: "input",
        name: "customPath",
        message: t("csv_enter_path"),
        /**
         * 验证用户输入的CSV文件路径是否有效：
         * @param {string} input - 用户输入的CSV文件路径
         * @returns {boolean|string} - 如果输入有效，返回true；否则返回错误消息字符串
         */
        validate: (input: string) => {
          /** @type {boolean | string} */
          let result: boolean | string = true;
          if (!input.trim()) {
            result = t("csv_validate_empty");
          } else if (!existsSync(input)) {
            result = t("csv_validate_not_found");
          } else if (!input.endsWith(".csv")) {
            result = t("csv_validate_extension");
          }
          return result;
        },
      },
    ]);
    const filteredFiles = selectedFiles.filter((f: string) => f !== "browse");
    return [...filteredFiles, customPath];
  }

  return selectedFiles;
}

/**
 * 搜索当前目录及子目录中的CSV文件
 * @returns {Promise<string[]>} 找到的CSV文件路径数组
 */
async function findCsvFiles(): Promise<string[]> {
  const patterns = ["**/*.csv", "!node_modules", "!node_modules/**"];

  try {
    const files = await glob(patterns, { ignore: ["node_modules"] });
    return files.sort();
  } catch {
    return [];
  }
}

/**
 * 提示用户输入YouTube Music播放列表的名称
 * @returns {Promise<string>} 用户输入的播放列表名称
 */
async function promptForPlaylistName(): Promise<string> {
  const { name } = await inquirer.prompt([
    {
      type: "input",
      name: "name",
      message: t("playlist_name"),
      default: t("playlist_default"),
    },
  ]);

  return name;
}

/**
 * 提示用户选择最小匹配置信度
 * @returns {Promise<MatchConfidence>} 用户选择的最小匹配置信度
 */
async function promptForMinConfidence(): Promise<MatchConfidence> {
  const { confidence } = await inquirer.prompt([
    {
      type: "list",
      name: "confidence",
      message: t("confidence"),
      choices: [
        {
          name: "High (exact match only)",
          value: "high",
        },
        {
          name: "Medium (fuzzy match)",
          value: "medium",
        },
        {
          name: "Low (include duration-based matches)",
          value: "low",
        },
      ],
      default: "low",
    },
  ]);

  return confidence;
}

/**
 * 提示用户输入请求之间的延迟时间（毫秒）
 * @returns {Promise<number>} 用户输入的延迟时间
 * @description 该函数使用inquirer提示用户输入一个数字，表示请求之间的延迟时间。输入会被验证，确保是一个非负数。
 */
async function promptForDelay(): Promise<number> {
  const { delay } = await inquirer.prompt([
    {
      type: "number",
      name: "delay",
      message: t("request_delay"),
      default: 1500,
      /**
       * 验证用户输入的延迟时间是否有效：
       * @param {number} input - 用户输入的延迟时间
       * @returns {boolean|string} 如果输入有效，返回true；否则返回错误消息字符串
       */
      validate: (input: number) => {
        if (typeof input !== "number" || input < 0) {
          return "Please enter a valid number (0 or greater)";
        }
        return true;
      },
    },
  ]);

  return delay;
}

/**
 * 提示用户确认是否跳过低置信度匹配的确认提示
 * @returns {Promise<boolean>} 用户选择是否跳过确认提示
 */
async function promptForConfirmation(): Promise<boolean> {
  const { skip } = await inquirer.prompt([
    {
      type: "confirm",
      name: "skip",
      message: t("skip_confirmation"),
      default: false,
    },
  ]);

  return skip;
}

/**
 * 提示用户确认是否导入匹配的歌曲到YouTube Music
 * @param {ImportStats} stats - 导入统计信息
 * @returns {Promise<boolean>} 用户选择是否继续导入
 */
export async function confirmImport(stats: ImportStats): Promise<boolean> {
  const { proceed } = await inquirer.prompt([
    {
      type: "confirm",
      name: "proceed",
      message: `Import ${stats.matched} matched songs to YouTube Music?`,
      default: true,
    },
  ]);

  return proceed;
}

/**
 * 提示用户确认是否接受低置信度匹配
 * @param {string} trackName - 原始歌曲名称
 * @param {string} matchName - 匹配的歌曲名称
 * @param {string} matchArtist - 匹配的艺术家名称
 * @param {string} confidence - 匹配的置信度
 * @returns {Promise<boolean>} 用户选择是否接受匹配
 */
export async function confirmLowConfidenceMatch(
  trackName: string,
  matchName: string,
  matchArtist: string,
  confidence: string,
): Promise<boolean> {
  const { accept } = await inquirer.prompt([
    {
      type: "confirm",
      name: "accept",
      message: `Accept match for "${trackName}"?\n  → "${matchName}" by ${matchArtist} (${confidence})`,
      default: false,
    },
  ]);

  return accept;
}

/**
 * 提示用户选择匹配的歌曲
 * @param {string} trackName - 原始歌曲名称
 * @param {Array<{ name: string; videoId: string; artist: string }>} options - 可选的匹配歌曲列表
 * @returns {Promise<string | null>} 用户选择的匹配歌曲的videoId，如果选择跳过则返回null
 */
export async function selectMatch(
  trackName: string,
  options: {
    /**
     * 匹配的歌曲名称
     */
    name: string;
    /**
     * 匹配的YouTube视频ID
     */
    videoId: string;
    /**
     * 匹配的艺术家名称
     */
    artist: string;
  }[],
): Promise<string | null> {
  const { selected } = await inquirer.prompt([
    {
      type: "list",
      name: "selected",
      message: `Select a match for "${trackName}":`,
      choices: [
        { name: "Skip this song", value: "skip" },
        new inquirer.Separator(),
        ...options.map((opt, idx) => ({
          name: `${idx + 1}. "${opt.name}" by ${opt.artist}`,
          value: opt.videoId,
        })),
      ],
    },
  ]);

  if (selected === "skip") {
    return null;
  }

  return selected;
}

/**
 * 打印导入总结信息
 * @param {ImportStats} stats - 导入统计信息
 */
export function printSummary(stats: ImportStats): void {
  console.log(`\n${"=".repeat(40)}`);
  console.log(`           ${t("summary_title")}`);
  console.log("=".repeat(40));
  console.log(`  ${t("summary_total")}:      ${stats.total}`);
  console.log(`  ${t("summary_matched")}:           ${stats.matched}`);
  console.log(`    - ${t("summary_high")}:         ${stats.highConfidence}`);
  console.log(`    - ${t("summary_medium")}:       ${stats.mediumConfidence}`);
  console.log(`    - ${t("summary_low")}:          ${stats.lowConfidence}`);
  console.log(`  ${t("summary_unmatched")}:         ${stats.unmatched}`);
  console.log(
    `  ${t("summary_duration")}:          ${Math.round(stats.duration / 1000)}s`,
  );
  console.log("=".repeat(40));
}

/**
 * 提示用户是否重试失败的歌曲导入
 * @param {number} failedCount - 失败的歌曲数量
 * @returns {Promise<boolean>} 用户选择是否重试
 */
export async function promptForRetry(failedCount: number): Promise<boolean> {
  const { retry } = await inquirer.prompt([
    {
      type: "confirm",
      name: "retry",
      message: `${failedCount} songs failed. Retry?`,
      default: false,
    },
  ]);

  return retry;
}
