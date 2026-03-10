import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { Importer } from "../../core/importer.js";
import type { ImporterOptions } from "../../core/importer.js";
import { validateConfig, setDefaultConfig } from "../../utils/config.js";
import { getCurrentLanguage } from "../../utils/i18n.js";
import { DB } from "../../utils/db.js";
import { fileWatcher } from "../../utils/fileWatcher.js";
import {
  promptForImport,
  promptForImportOptions,
  promptForMultipleCsvFiles,
  promptForCsvFile,
  confirmImport,
  promptPressEnter,
  promptResolveLowConfidence,
} from "../prompts.js";
import {
  createImportProgressTui,
  type ImportProgressTuiController,
} from "../../tui/progress.js";
import { promptSelectList } from "../../tui/selectList.js";
import { promptConfirm } from "../../tui/confirm.js";
import { promptTextInput } from "../../tui/textInput.js";
import {
  showError,
  showSuccess,
  showWarning,
  showInfo,
} from "../../tui/notification.js";
import {
  showImportSummary,
  showBatchSummary,
} from "../../tui/importSummary.js";
import { t } from "../../utils/i18n.js";
import { loadCookieHeader } from "../../utils/cookies.js";
import { importCookiesTui } from "../../tui/importCookies.js";

const db = new DB("./import-progress.sqlite");

/**
 * 处理新的导入
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
    } else {
      await showWarning(t("no_new_tracks_to_import"));
    }

    db.updateRunStatus(runId, "completed");
  } catch (error) {
    progressTui?.stop();
    db.updateRunStatus(runId, "failed");

    const errorMessage = error instanceof Error ? error.message : String(error);
    const { promptErrorDialog } = await import("../../tui/errorDialog.js");
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
 * 处理导入恢复
 */
export async function handleResume(): Promise<void> {
  const run = await selectRun();
  if (!run) {
    return;
  }

  if (run.status === "running") {
    const isCompleted = run.processed_tracks >= run.total_tracks;
    if (isCompleted) {
      const confirm = await promptConfirm({
        message: "此导入已完成，是否将状态改为 completed?",
        defaultValue: false,
      });
      if (!confirm) {
        return;
      }
      db.updateRunStatus(run.run_id, "completed");
    } else {
      const confirm = await promptConfirm({
        message: "此导入正在运行中，是否继续?",
        defaultValue: true,
      });
      if (!confirm) {
        return;
      }
    }
  }

  if (
    run.status === "completed" ||
    (run.status === "running" && run.processed_tracks >= run.total_tracks)
  ) {
    const confirm = await promptConfirm({
      message: "此导入已完成，是否重新导入?",
      defaultValue: false,
    });
    if (!confirm) {
      return;
    }
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
    } else {
      await showWarning(t("no_new_tracks_to_import"));
    }

    db.updateRunStatus(run.run_id, "completed");
  } catch (error) {
    progressTui?.stop();
    db.updateRunStatus(run.run_id, "failed");

    const errorMessage = error instanceof Error ? error.message : String(error);
    const { promptErrorDialog } = await import("../../tui/errorDialog.js");
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
 * 处理批量导入
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
      const { promptErrorDialog } = await import("../../tui/errorDialog.js");
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
}

/**
 * 处理批量导入
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
    const { promptErrorDialog } = await import("../../tui/errorDialog.js");
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
 * 显示运行记录列表并让用户选择一个记录以恢复导入
 * @returns {Promise<object>} 返回用户选择的运行记录对象，包含 run_id、csv_path、created_at、status、total_tracks、processed_tracks、matched_tracks、failed_tracks 和 skipped_tracks 等字段；如果用户选择返回，则返回 null。
 */
async function selectRun(): Promise<{
  /** 运行id */
  run_id: string;
  /** CSV文件路径 */
  csv_path: string;
  /** 创建时间 */
  created_at: string;
  /** 运行状态 */
  status: string;
  /** 总歌曲数 */
  total_tracks: number;
  /** 已处理歌曲数 */
  processed_tracks: number;
  /** 匹配歌曲数 */
  matched_tracks: number;
  /** 导入失败歌曲数 */
  failed_tracks: number;
  /** 跳过歌曲数 */
  skipped_tracks: number;
} | null> {
  const runsResult = db.listRunSummaries(50);
  const runs = Array.isArray(runsResult.data) ? runsResult.data : [];
  if (runs.length === 0) {
    await showWarning(t("no_progress_found"));
    await promptPressEnter();
    return null;
  }

  const result = await promptSelectList({
    message: t("menu_resume"),
    choices: [
      ...runs.map((run) => {
        const row = run as {
          /** 运行id */
          run_id: string;
          /** CSV文件路径 */
          csv_path: string;
          /** 创建时间 */
          created_at: string;
          /** 运行状态 */
          status: string;
        };
        const label = `${row.csv_path} | ${row.created_at} | ${row.status}`;
        return { name: label, value: run };
      }),
      { name: t("menu_back"), value: "back" },
    ],
  });

  const selected = result;

  if (selected === "back") {
    return null;
  }

  return selected as {
    /** 运行id */
    run_id: string;
    /** CSV文件路径 */
    csv_path: string;
    /** 创建时间 */
    created_at: string;
    /** 运行状态 */
    status: string;
    /** 总歌曲数 */
    /** 已处理歌曲数 */
    total_tracks: number;
    /** 已处理歌曲数 */
    processed_tracks: number;
    /** 匹配歌曲数 */
    matched_tracks: number;
    /** 导入失败歌曲数 */
    failed_tracks: number;
    /** 跳过歌曲数 */
    skipped_tracks: number;
  };
}

/**
 * 处理更新Cookies
 */
export async function handleUpdateCookies(): Promise<void> {
  let cookieFilePath = "config/cookies.json";
  let autoWatchEnabled = false;
  let cleanupFn: (() => void) | null = null;

  /**
   * 验证并导入Cookies
   * @returns {Promise<object>} 返回一个对象，包含 success（布尔值，表示导入是否成功）、path（字符串，表示导入的文件路径，仅在成功时返回）和 message（字符串，表示导入结果的消息）等字段。
   */
  const validateAndImportCookies = async (): Promise<{
    /** 导入是否成功 */
    success: boolean;
    /** 导入的文件路径，仅在成功时返回 */
    path?: string;
    /** 导入结果的消息 */
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
   * 让用户选择新的Cookies文件并导入
   * @returns {Promise<string | null>} 返回导入的文件路径（字符串）或 null（如果用户取消选择或导入失败）
   */
  const selectNewFile = async (): Promise<string | null> => {
    const filePath = await promptForCsvFile();
    if (filePath) {
      cookieFilePath = filePath;
    }
    return filePath || null;
  };

  /**
   * 切换自动监视功能：如果启用，则监视当前Cookies文件的变化并自动导入；如果禁用，则停止监视。
   */
  const toggleAutoWatch = async (): Promise<void> => {
    autoWatchEnabled = !autoWatchEnabled;

    if (autoWatchEnabled && existsSync(cookieFilePath)) {
      await fileWatcher.watch({
        path: cookieFilePath,
        /**
         * 文件变化时的回调函数：如果事件类型是 "change"，则调用 validateAndImportCookies 函数验证并导入Cookies，并根据结果显示相应的消息。
         * @param {string} event - 文件事件类型，例如 "change"、"rename" 等。
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
       * 设置 cleanupFn 函数：当自动监视启用时，cleanupFn 被赋值为一个函数，该函数调用 fileWatcher.unwatch(cookieFilePath) 来停止监视当前的 Cookies 文件；当自动监视禁用时，如果 cleanupFn 不为 null，则调用 cleanupFn() 来停止监视，并将 cleanupFn 设为 null。
       * @returns {void}
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
