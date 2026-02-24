import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { Importer } from "../core/importer.js";
import {
  validateConfig,
  setDefaultConfig,
  getConfig,
} from "../utils/config.js";
import type { ImporterOptions } from "../core/importer.js";
import {
  promptForImport,
  promptForImportOptions,
  promptForMultipleCsvFiles,
  promptForCsvFile,
  confirmImport,
  promptPressEnter,
  promptResolveLowConfidence,
} from "./prompts.js";
import { DB } from "../utils/db.js";
import { SearchCache } from "../utils/searchCache.js";
import {
  createImportProgressTui,
  type ImportProgressTuiController,
} from "../tui/progress.js";
import { promptSelectList } from "../tui/selectList.js";
import { promptTextInput } from "../tui/textInput.js";
import {
  initI18n,
  t,
  setLanguage,
  getCurrentLanguage,
  type Language,
} from "../utils/i18n.js";
import { testProxyConnection, testDirectConnection } from "../utils/proxy.js";
import { showProxyTestResult } from "../tui/proxyTestResult.js";
import { importCookiesTui } from "../tui/importCookies.js";
import { loadCookieHeader } from "../utils/cookies.js";
import { fileWatcher } from "../utils/fileWatcher.js";
import {
  showError,
  showSuccess,
  showWarning,
  showInfo,
} from "../tui/notification.js";
import { showImportSummary, showBatchSummary } from "../tui/importSummary.js";

const db = new DB("./import-progress.sqlite");
const searchCache = new SearchCache("./import-progress.sqlite");

/** 主菜单操作 */
export type MainMenuAction =
  | "new_import"
  | "batch_import"
  | "resume"
  | "incremental_import"
  | "progress"
  | "failed"
  | "settings"
  | "exit"
  | "language";

export const MENU_CHOICES: {
  /** 标签键 */
  labelKey: string;
  /** 主菜单操作值 */
  value: MainMenuAction;
}[] = [
  { labelKey: "menu_new_import", value: "new_import" },
  { labelKey: "menu_batch_import", value: "batch_import" },
  { labelKey: "menu_resume", value: "resume" },
  { labelKey: "menu_incremental_import", value: "incremental_import" },
  { labelKey: "menu_progress", value: "progress" },
  { labelKey: "menu_failed", value: "failed" },
  { labelKey: "menu_settings", value: "settings" },
  { labelKey: "menu_language", value: "language" },
  { labelKey: "menu_exit", value: "exit" },
];

/**
 * 初始化应用程序
 * 初始化i18n、数据库和搜索缓存
 */
export function initApp(): void {
  initI18n();
  db.init();
  searchCache.cleanupExpiredCaches();
  const savedConfig = db.getConfig();
  if (savedConfig.success && savedConfig.data) {
    const language = (
      savedConfig.data as {
        /** 语言 */
        language?: Language;
      }
    ).language;
    if (language) {
      setLanguage(language);
    }
  }
}

/**
 * 运行主循环
 * 显示主菜单并处理用户选择的操作
 */
export async function runMainLoop(): Promise<void> {
  while (true) {
    const action = await promptMainMenu();

    switch (action) {
      case "new_import":
        await handleNewImport();
        break;
      case "resume":
        await handleResume();
        break;
      case "batch_import":
        await handleBatchImport();
        break;
      case "incremental_import":
        await handleIncrementalImport();
        break;
      case "progress":
        await handleViewProgress();
        break;
      case "failed":
        await handleViewFailed();
        break;
      case "settings":
        await handleSettings();
        break;
      case "language":
        await handleLanguage();
        break;
      case "exit":
        console.clear();
        console.log(t("goodbye"));
        process.exit(0);
    }

    await promptContinue();
  }
}

/**
 * 显示主菜单并获取用户选择的操作
 * @returns {Promise<MainMenuAction>} 用户选择的主菜单操作
 */
async function promptMainMenu(): Promise<MainMenuAction> {
  const action = await promptSelectList({
    message: t("welcome_title"),
    choices: MENU_CHOICES.map((item) => ({
      name: t(item.labelKey),
      value: item.value,
    })),
  });
  return action;
}

/**
 * 处理语言设置
 * 允许用户选择界面语言并保存到数据库
 */
export async function handleLanguage(): Promise<void> {
  const choices = [
    { name: t("language_english"), value: "en" },
    { name: t("language_chinese"), value: "zh-CN" },
    { name: t("language_japanese"), value: "ja" },
    { name: t("menu_back"), value: "back" },
  ];
  const lang = await promptSelectList({
    message: t("language_select"),
    choices,
  });

  if (lang === "back") {
    return;
  }

  setLanguage(lang as Language);
  db.upsertConfig({ language: lang as Language });
}

/**
 * 处理新导入流程
 * 包括提示用户输入CSV文件、初始化导入器、处理曲目、创建播放列表和添加歌曲
 */
export async function handleNewImport(): Promise<void> {
  const answers = await promptForImport();
  if (!answers) {
    return;
  }

  if (!existsSync(answers.csvPath)) {
    await showError(t("error_csv_not_found", { path: answers.csvPath }));
    return;
  }

  const config = validateConfig({
    minConfidence: answers.minConfidence,
    requestDelay: answers.requestDelay,
    skipConfirmation: answers.skipConfirmation,
    saveProgress: false,
    progressDbPath: "./import-progress.sqlite",
    language: getCurrentLanguage(),
  });
  setDefaultConfig(config);

  const runId = randomUUID();
  const importerOptions: ImporterOptions = {
    csvPath: answers.csvPath,
    config,
    runId,
    db,
  };
  let progressTui: ImportProgressTuiController | undefined;
  let importer: Importer | null = null;

  try {
    importer = new Importer(importerOptions);

    await importer.init();
    importer.loadCsv();

    if (process.stdout.isTTY) {
      progressTui = createImportProgressTui({
        totalTracks: importer.getStats().total,
        processedTracks: 0,
        matchedTracks: 0,
        failedTracks: 0,
        skippedTracks: 0,
      });
      importer.setProgressCallback((payload) => {
        progressTui?.update(payload);
      });
    }

    db.createRUN({
      runId,
      csvPath: answers.csvPath,
      createdAt: Date.now(),
      status: "running",
      totalTracks: importer.getStats().total,
      processedTracks: 0,
      matchedTracks: 0,
      failedTracks: 0,
      skippedTracks: 0,
      playlistId: undefined,
    });

    const results = await importer.processTracks();

    importer.printSummary();

    const pendingLowConfidence = importer.getPendingLowConfidence();
    if (pendingLowConfidence.length > 0) {
      console.clear();
      await showWarning(
        `${pendingLowConfidence.length} low confidence songs need resolution`,
      );
      await promptResolveLowConfidence(pendingLowConfidence, importer);
    }

    const stats = importer.getStats();

    if (stats.matched > 0) {
      const proceed = await confirmImport(stats);
      if (proceed) {
        await showInfo(t("creating_playlist", { name: answers.playlistName }));
        await importer.createPlaylist(answers.playlistName);

        const playlistId = importer.getPlaylistId?.();
        if (playlistId) {
          await showInfo(t("adding_songs"));
          const importResult = await importer.importToPlaylist(
            playlistId,
            results,
          );
          await showImportSummary({
            title: t("import_complete"),
            data: {
              ...stats,
              success: importResult.success,
              failed: importResult.failed,
            },
          });
        }
      }
    }

    db.updateRunStatus(runId, "completed");
  } catch (error) {
    progressTui?.stop();
    db.updateRunStatus(runId, "failed");

    const errorMessage = error instanceof Error ? error.message : String(error);
    const { promptErrorDialog } = await import("../tui/errorDialog.js");
    await promptErrorDialog({
      errorMessage,
      stats: importer
        ? {
            total: importer.getStats().total,
            matched: importer.getStats().matched,
            failed: importer.getStats().importFailed,
          }
        : { total: 0, matched: 0, failed: 0 },
    });
  } finally {
    progressTui?.stop();
  }
}

/**
 * 处理恢复导入流程
 * 允许用户选择之前的导入会话并继续处理未完成的曲目
 */
export async function handleResume(): Promise<void> {
  const run = await selectRun();
  if (!run) {
    return;
  }

  const answers = await promptForImportOptions();

  if (!existsSync(run.csv_path)) {
    await showError(t("error_csv_not_found", { path: run.csv_path }));
    return;
  }

  const config = validateConfig({
    minConfidence: answers.minConfidence,
    requestDelay: answers.requestDelay,
    skipConfirmation: answers.skipConfirmation,
    saveProgress: false,
    progressDbPath: "./import-progress.sqlite",
    language: getCurrentLanguage(),
  });
  setDefaultConfig(config);

  const processedKeysResult = db.getProcessedTrackKeys(run.run_id);
  const processedKeys = new Set<string>(
    Array.isArray(processedKeysResult.data)
      ? processedKeysResult.data
          .map(
            (row) =>
              (
                row as {
                  /** 歌曲键 */
                  track_key?: string;
                }
              ).track_key,
          )
          .filter((key): key is string => Boolean(key))
      : [],
  );

  const importerOptions: ImporterOptions = {
    csvPath: run.csv_path,
    config,
    runId: run.run_id,
    db,
    processedTrackKeys: processedKeys,
  };
  let progressTui: ImportProgressTuiController | undefined;
  let importer: Importer | null = null;

  try {
    importer = new Importer(importerOptions);

    await importer.init();
    importer.loadCsv();

    if (process.stdout.isTTY) {
      progressTui = createImportProgressTui({
        totalTracks: importer.getStats().total,
        processedTracks: 0,
        matchedTracks: 0,
        failedTracks: 0,
        skippedTracks: 0,
      });
      importer.setProgressCallback((payload) => {
        progressTui?.update(payload);
      });
    }

    const results = await importer.processTracks();

    importer.printSummary();

    const pendingLowConfidence = importer.getPendingLowConfidence();
    if (pendingLowConfidence.length > 0) {
      console.clear();
      await showWarning(
        `${pendingLowConfidence.length} low confidence songs need resolution`,
      );
      await promptResolveLowConfidence(pendingLowConfidence, importer);
    }

    const stats = importer.getStats();

    if (stats.matched > 0) {
      const proceed = await confirmImport(stats);
      if (proceed) {
        await showInfo(t("creating_playlist", { name: answers.playlistName }));
        await importer.createPlaylist(answers.playlistName);

        const playlistId = importer.getPlaylistId?.();
        if (playlistId) {
          await showInfo(t("adding_songs"));
          const importResult = await importer.importToPlaylist(
            playlistId,
            results,
          );
          await showImportSummary({
            title: t("import_complete"),
            data: {
              ...stats,
              success: importResult.success,
              failed: importResult.failed,
            },
          });
        }
      }
    }

    db.updateRunStatus(run.run_id, "completed");
  } catch (error) {
    progressTui?.stop();
    db.updateRunStatus(run.run_id, "failed");

    const errorMessage = error instanceof Error ? error.message : String(error);
    const { promptErrorDialog } = await import("../tui/errorDialog.js");
    await promptErrorDialog({
      errorMessage,
      stats: importer
        ? {
            total: importer.getStats().total,
            matched: importer.getStats().matched,
            failed: importer.getStats().importFailed,
          }
        : { total: 0, matched: 0, failed: 0 },
    });
  } finally {
    progressTui?.stop();
  }
}

/**
 * 处理查看进度流程
 * 显示之前导入会话的进度信息
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

  const data = runs.map((run) => {
    const row = run as {
      /** 运行ID */
      run_id: string;
      /** CSV文件路径 */
      csv_path: string;
      /** 创建时间 */
      created_at: string;
      /** 导入状态 */
      status: string;
      /** 总曲目数 */
      total_tracks: number;
      /** 已处理曲目数 */
      processed_tracks: number;
      /** 匹配成功曲目数 */
      matched_tracks: number;
      /** 匹配失败曲目数 */
      failed_tracks: number;
      /** 跳过曲目数 */
      skipped_tracks: number;
    };
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
  const { viewProgressTui } = await import("../tui/viewProgress.js");
  await viewProgressTui(data);
}

/**
 * 处理批量导入
 * 允许用户选择多个CSV文件并为每个文件指定播放列表名称
 */
export async function handleBatchImport(): Promise<void> {
  if (process.stdout.isTTY) {
    process.stdout.write("\n");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const csvFiles = await promptForMultipleCsvFiles();
  if (!csvFiles || csvFiles.length === 0) {
    await showWarning(t("batch_no_files"));
    return;
  }

  await showInfo(t("batch_files_selected", { count: String(csvFiles.length) }));

  const playlistNames: string[] = [];
  for (const csvPath of csvFiles) {
    const fileName =
      csvPath
        .split("/")
        .pop()
        ?.replace(/\.csv$/, "") || "Playlist";

    const action = await promptSelectList({
      message: t("batch_playlist_action", { file: fileName }),
      choices: [
        {
          name: t("batch_playlist_use_default", { default: fileName }),
          value: "default",
        },
        { name: t("batch_playlist_enter_name"), value: "custom" },
        { name: t("menu_back"), value: "back" },
      ],
    });

    if (action === "back") {
      return;
    }

    if (action === "default") {
      playlistNames.push(fileName);
      continue;
    }

    const name = await promptTextInput({
      message: t("batch_playlist_prompt", { file: fileName }),
      defaultValue: fileName,
    });

    playlistNames.push(String(name || "").trim() || fileName);
  }

  const config = validateConfig({
    minConfidence: "low",
    requestDelay: 1500,
    skipConfirmation: false,
    saveProgress: false,
    progressDbPath: "./import-progress.sqlite",
    language: getCurrentLanguage(),
  });
  setDefaultConfig(config);

  const totalStats = {
    total: 0,
    matched: 0,
    highConfidence: 0,
    mediumConfidence: 0,
    lowConfidence: 0,
    unmatched: 0,
    importSuccess: 0,
    importFailed: 0,
    duration: 0,
  };

  for (let i = 0; i < csvFiles.length; i++) {
    const csvPath = csvFiles[i];
    if (!csvPath) continue;

    const fileName =
      csvPath
        .split("/")
        .pop()
        ?.replace(/\.csv$/, "") || "Playlist";
    const finalPlaylistName = playlistNames[i] || fileName;

    await showInfo(
      t("batch_processing_file", {
        current: String(i + 1),
        total: String(csvFiles.length),
        path: csvPath,
      }),
    );

    if (!existsSync(csvPath)) {
      await showError(t("error_csv_not_found", { path: csvPath }));
      continue;
    }

    const runId = randomUUID();
    const importerOptions: ImporterOptions = {
      csvPath,
      config,
      runId,
      db,
    };

    let importer: Importer | null = null;

    try {
      importer = new Importer(importerOptions);

      await importer.init();
      importer.loadCsv();

      db.createRUN({
        runId,
        csvPath,
        createdAt: Date.now(),
        status: "running",
        totalTracks: importer.getStats().total,
        processedTracks: 0,
        matchedTracks: 0,
        failedTracks: 0,
        skippedTracks: 0,
        playlistId: undefined,
      });

      const results = await importer.processTracks();

      const pendingLowConfidence = importer.getPendingLowConfidence();
      if (pendingLowConfidence.length > 0) {
        console.clear();
        await showWarning(
          `${pendingLowConfidence.length} low confidence songs need resolution`,
        );
        await promptResolveLowConfidence(pendingLowConfidence, importer);
      }

      const stats = importer.getStats();

      totalStats.total += stats.total;
      totalStats.matched += stats.matched;
      totalStats.highConfidence += stats.highConfidence;
      totalStats.mediumConfidence += stats.mediumConfidence;
      totalStats.lowConfidence += stats.lowConfidence;
      totalStats.unmatched += stats.unmatched;
      totalStats.importSuccess += stats.importSuccess;
      totalStats.importFailed += stats.importFailed;
      totalStats.duration += stats.duration;

      if (stats.matched > 0) {
        const proceed = await confirmImport(stats);
        if (proceed) {
          await showInfo(t("creating_playlist", { name: finalPlaylistName }));
          await importer.createPlaylist(finalPlaylistName);

          const playlistId = importer.getPlaylistId?.();
          if (playlistId) {
            await showInfo(t("adding_songs"));
            const importResult = await importer.importToPlaylist(
              playlistId,
              results,
            );
            await showImportSummary({
              title: t("import_complete"),
              data: {
                ...stats,
                success: importResult.success,
                failed: importResult.failed,
              },
            });
          }
        }
      }

      db.updateRunStatus(runId, "completed");
    } catch (error) {
      db.updateRunStatus(runId, "failed");

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const { promptErrorDialog } = await import("../tui/errorDialog.js");
      const action = await promptErrorDialog({
        errorMessage,
        stats: importer
          ? {
              total: importer.getStats().total,
              matched: importer.getStats().matched,
              failed: importer.getStats().importFailed,
            }
          : { total: 0, matched: 0, failed: 0 },
      });

      if (action === "exit") {
        break;
      }
    }
  }

  await showBatchSummary({
    count: csvFiles.length,
    data: totalStats,
  });

  await promptPressEnter();
}

/**
 * 处理增量导入到已有歌单
 * 允许用户选择目标播放列表并向其中添加歌曲
 */
export async function handleIncrementalImport(): Promise<void> {
  if (process.stdout.isTTY) {
    process.stdout.write("\n");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const csvPath = await promptForCsvFile();
  if (!csvPath) {
    return;
  }

  if (!existsSync(csvPath)) {
    await showError(t("error_csv_not_found", { path: csvPath }));
    return;
  }

  const config = validateConfig({
    minConfidence: "low",
    requestDelay: 1500,
    skipConfirmation: false,
    saveProgress: false,
    progressDbPath: "./import-progress.sqlite",
    language: getCurrentLanguage(),
  });
  setDefaultConfig(config);

  const runId = randomUUID();
  const importerOptions: ImporterOptions = {
    csvPath,
    config,
    runId,
    db,
  };

  let progressTui: ImportProgressTuiController | undefined;
  let importer: Importer | null = null;

  try {
    importer = new Importer(importerOptions);

    await importer.init();
    importer.loadCsv();

    const playlists = await importer.getSearcher().getPlaylists();
    if (playlists.length === 0) {
      await showWarning(t("no_playlists_found"));
      await promptPressEnter();
      return;
    }

    const selectedPlaylist = await promptSelectList({
      message: t("select_target_playlist"),
      choices: [
        ...playlists.map((p) => ({
          name: `${p.name} (${t("playlist_track_count", { count: String(p.trackCount) })})`,
          value: p.id,
        })),
        { name: t("menu_back"), value: "back" },
      ],
    });

    if (selectedPlaylist === "back") {
      return;
    }

    const targetPlaylistId = selectedPlaylist;

    if (process.stdout.isTTY) {
      progressTui = createImportProgressTui({
        totalTracks: importer.getStats().total,
        processedTracks: 0,
        matchedTracks: 0,
        failedTracks: 0,
        skippedTracks: 0,
      });
      importer.setProgressCallback((payload) => {
        progressTui?.update(payload);
      });
    }

    db.createRUN({
      runId,
      csvPath,
      createdAt: Date.now(),
      status: "running",
      totalTracks: importer.getStats().total,
      processedTracks: 0,
      matchedTracks: 0,
      failedTracks: 0,
      skippedTracks: 0,
      playlistId: targetPlaylistId,
    });

    const results = await importer.processTracks();

    importer.printSummary();

    const pendingLowConfidence = importer.getPendingLowConfidence();
    if (pendingLowConfidence.length > 0) {
      console.clear();
      await showWarning(
        `${pendingLowConfidence.length} low confidence songs need resolution`,
      );
      await promptResolveLowConfidence(pendingLowConfidence, importer);
    }

    const stats = importer.getStats();

    if (stats.matched > 0) {
      const proceed = await confirmImport(stats);
      if (proceed) {
        await showInfo(t("adding_songs"));
        const importResult = await importer.importToExistingPlaylist(
          targetPlaylistId,
          results,
        );
        await showImportSummary({
          title: t("import_complete"),
          data: {
            ...stats,
            success: importResult.success,
            failed: importResult.failed,
            skipped: importResult.skipped,
          },
        });
      }
    }

    db.updateRunStatus(runId, "completed");
  } catch (error) {
    progressTui?.stop();
    db.updateRunStatus(runId, "failed");

    const errorMessage = error instanceof Error ? error.message : String(error);
    const { promptErrorDialog } = await import("../tui/errorDialog.js");
    await promptErrorDialog({
      errorMessage,
      stats: importer
        ? {
            total: importer.getStats().total,
            matched: importer.getStats().matched,
            failed: importer.getStats().importFailed,
          }
        : { total: 0, matched: 0, failed: 0 },
    });
  } finally {
    progressTui?.stop();
  }
}

/**
 * 处理查看失败曲目流程
 * 显示之前导入会话中匹配失败的曲目信息
 */
export async function handleViewFailed(): Promise<void> {
  const runsResult = db.listRunSummaries(50);
  const runs = Array.isArray(runsResult.data) ? runsResult.data : [];

  const runsWithFailed: {
    /** 导入会话数据 */
    run: (typeof runs)[0];
    /** 失败曲目数 */
    failedCount: number;
  }[] = [];

  for (const run of runs) {
    const row = run as {
      /** 运行ID */
      run_id: string;
    };
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

  const data = runsWithFailed.map(({ run }) => {
    const row = run as {
      /**
       * CSV文件路径
       */
      csv_path: string;
      /**
       * 创建时间
       */
      created_at: string;
    };
    const failed = db.listFailedTracks(
      (
        run as {
          /**
           * 运行ID
           */
          run_id: string;
        }
      ).run_id,
      100,
    );
    const failedRows = Array.isArray(failed.data) ? failed.data : [];
    const failedTracks = failedRows
      .map((f) => {
        const fRow = f as {
          /**
           * 歌曲信息JSON字符串
           */
          track_json?: string;
        };
        const parsed = fRow.track_json ? JSON.parse(fRow.track_json) : null;
        return parsed ? { name: parsed.name, artist: parsed.artist } : null;
      })
      .filter(Boolean) as {
      /**
       * 歌曲名称
       */
      name: string;
      /**
       * 艺术家名称
       */
      artist: string;
    }[];

    return {
      csv_path: row.csv_path,
      created_at: row.created_at,
      failedTracks,
    };
  });

  console.clear();
  const { viewFailedTui } = await import("../tui/viewFailed.js");
  await viewFailedTui(data);
}

/**
 * 处理设置流程
 * 允许用户配置cookies、代理等设置
 */
export async function handleSettings(): Promise<void> {
  const setting = await promptSelectList({
    message: t("settings"),
    choices: [
      { name: t("settings_cookies"), value: "update_cookies" },
      { name: "代理设置 (Proxy Settings)", value: "proxy_settings" },
      { name: t("menu_back"), value: "back" },
    ],
  });

  if (setting === "update_cookies") {
    await handleUpdateCookies();
  } else if (setting === "proxy_settings") {
    await handleProxySettings();
  }
}

/**
 * 处理更新Cookies流程
 * 允许用户导入和自动更新cookies文件
 */
async function handleUpdateCookies(): Promise<void> {
  let cookieFilePath = "config/cookies.json";
  let autoWatchEnabled = false;
  let cleanupFn: (() => void) | null = null;

  /**
   * 验证并导入cookies文件
   * @returns {Promise<object>} 导入结果对象，包含成功状态、文件路径和消息
   */
  const validateAndImportCookies = async (): Promise<{
    /**  成功状态 */
    success: boolean;
    /** 导入的文件路径（如果成功） */
    path?: string;
    /** 导入结果消息 */
    message: string;
  }> => {
    if (!existsSync(cookieFilePath)) {
      return { success: false, message: "文件不存在" };
    }

    try {
      await loadCookieHeader(cookieFilePath);
      db.upsertConfig({ cookiePath: cookieFilePath });
      return {
        success: true,
        path: cookieFilePath,
        message: "Cookies 导入成功",
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return { success: false, message: `导入失败: ${errMsg}` };
    }
  };

  /**
   * 选择新的cookies文件路径
   * @returns {Promise<string | null>} 选定的新文件路径，如果用户取消选择则返回null
   */
  const selectNewFile = async (): Promise<string | null> => {
    const filePath = await promptForCsvFile();
    if (filePath) {
      cookieFilePath = filePath;
    }
    return filePath || null;
  };

  /**
   * 切换自动监视cookies文件变化的功能
   */
  const toggleAutoWatch = async (): Promise<void> => {
    autoWatchEnabled = !autoWatchEnabled;

    if (autoWatchEnabled && existsSync(cookieFilePath)) {
      await fileWatcher.watch({
        path: cookieFilePath,
        /**
         * 文件变化事件处理函数，检测到文件变化时自动导入新的cookies
         * @param {string} event  文件变化事件类型（如"change"）
         */
        onChange: (event) => {
          if (event === "change") {
            void validateAndImportCookies().then(async (result) => {
              console.clear();
              await showInfo("检测到 Cookies 文件变化，自动导入...");
              if (result.success) {
                await showSuccess(result.message);
              } else {
                await showError(result.message);
              }
            });
          }
        },
      });
      /**
       * 设置清理函数以在不需要监视时停止监视文件变化
       * @returns {void} 无返回值
       */
      cleanupFn = () => fileWatcher.unwatch(cookieFilePath);
    } else if (cleanupFn !== null) {
      cleanupFn();
      cleanupFn = null;
    }
  };

  await importCookiesTui({
    currentCookiePath: cookieFilePath,
    autoWatchEnabled,
    onImport: validateAndImportCookies,
    onSelectFile: selectNewFile,
    onToggleAutoWatch: toggleAutoWatch,
  });

  if (cleanupFn !== null) {
    (cleanupFn as () => void)();
  }
}

/**
 * 处理代理设置
 * 允许用户设置、清除和测试代理连接
 */
async function handleProxySettings(): Promise<void> {
  while (true) {
    const config = getConfig();
    const currentProxy = config.proxyUrl || "未设置";

    const action = await promptSelectList({
      message: `当前代理: ${currentProxy}`,
      choices: [
        { name: "设置代理 URL", value: "set_proxy" },
        { name: "清除代理", value: "clear_proxy" },
        { name: "测试直连 (无代理)", value: "test_direct" },
        { name: "测试代理连接", value: "test_proxy" },
        { name: t("menu_back"), value: "back" },
      ],
    });

    if (action === "back") {
      return;
    }

    if (action === "set_proxy") {
      const proxyUrl = await promptTextInput({
        message: "输入代理 URL (如 http://127.0.0.1:7890)",
        defaultValue: config.proxyUrl || "",
      });

      const trimmedProxy = String(proxyUrl || "").trim();

      if (trimmedProxy) {
        setDefaultConfig({ proxyUrl: trimmedProxy });
        db.upsertConfig({ proxyUrl: trimmedProxy });
      }
      continue;
    }

    if (action === "clear_proxy") {
      setDefaultConfig({ proxyUrl: undefined });
      db.upsertConfig({ proxyUrl: undefined });
      continue;
    }

    if (action === "test_direct") {
      const result = await testDirectConnection();
      await showProxyTestResult("direct", undefined, result);
      continue;
    }

    if (action === "test_proxy") {
      if (!config.proxyUrl) {
        continue;
      }

      const result = await testProxyConnection(config.proxyUrl);
      await showProxyTestResult("proxy", config.proxyUrl, result);
      continue;
    }
  }
}

/**
 * 显示可用的导入会话列表并让用户选择一个会话进行恢复或查看进度
 * @returns {Promise<{run_id: string; csv_path: string; created_at: string; status: string; total_tracks: number; processed_tracks: number; matched_tracks: number; failed_tracks: number; skipped_tracks: number; } | null>} 选定的导入会话信息，如果没有可用会话则返回null
 */
async function selectRun(): Promise<{
  /** 运行ID */
  run_id: string;
  /** CSV文件路径 */
  csv_path: string;
  /** 创建时间 */
  created_at: string;
  /** 导入状态 */
  status: string;
  /** 总曲目数 */
  total_tracks: number;
  /** 已处理曲目数 */
  processed_tracks: number;
  /** 匹配成功曲目数 */
  matched_tracks: number;
  /** 匹配失败曲目数 */
  failed_tracks: number;
  /** 跳过曲目数 */
  skipped_tracks: number;
} | null> {
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
        const row = run as {
          /** 运行ID */
          run_id: string;
          /** CSV文件路径 */
          csv_path: string;
          /** 创建时间 */
          created_at: string;
          /** 导入状态 */
          status: string;
        };
        const label = `${row.csv_path} | ${row.created_at} | ${row.status}`;
        return { name: label, value: run };
      }),
      { name: t("menu_back"), value: "back" },
    ],
  });

  if (selected === "back") {
    return null;
  }

  return selected as {
    /** 运行ID */
    run_id: string;
    /** CSV文件路径 */
    csv_path: string;
    /** 创建时间 */
    created_at: string;
    /** 导入状态 */
    status: string;
    /** 总曲目数 */
    total_tracks: number;
    /** 已处理曲目数 */
    processed_tracks: number;
    /** 匹配成功曲目数 */
    matched_tracks: number;
    /** 匹配失败曲目数 */
    failed_tracks: number;
    /** 跳过曲目数 */
    skipped_tracks: number;
  };
}

/**
 * 提示用户继续操作
 * 添加延迟以确保TUI完全清理
 */
async function promptContinue(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 150));
}

/**
 * 应用程序入口函数
 * 初始化应用并启动主循环
 */
export async function run(): Promise<void> {
  initApp();
  await runMainLoop();
}
