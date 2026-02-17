import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { Importer } from "./core/importer.js";
import {
  validateConfig,
  setDefaultConfig,
} from "./utils/config.js";
import type { ImporterOptions } from "./core/importer.js";
import {
  promptForImport,
  promptForImportOptions,
  promptForMultipleCsvFiles,
  confirmImport,
} from "./cli/prompts.js";
import { DB } from "./utils/db.js";
import { SearchCache } from "./utils/search-cache.js";
import {
  createImportProgressTui,
  type ImportProgressTuiController,
} from "./tui/progress.js";
import {
  promptMainMenuTui,
  type MainMenuAction as TuiMainMenuAction,
} from "./tui/main-menu.js";
import {
  initI18n,
  t,
  setLanguage,
  getCurrentLanguage,
  type Language,
} from "./utils/i18n.js";
import { promptSelectList } from "./tui/select-list.js";
import { promptTextInput } from "./tui/text-input.js";
import { promptConfirm } from "./tui/confirm.js";

/**
 * 表示匹配结果的类型
 */
type MainMenuAction =
  | "new_import"
  | "batch_import"
  | "resume"
  | "progress"
  | "failed"
  | "settings"
  | "exit"
  | "language";

/**
 * 主菜单选项列表,包含每个选项的翻译键和对应的操作值
 */
const MENU_CHOICES: { labelKey: string; value: MainMenuAction }[] = [
  { labelKey: "menu_new_import", value: "new_import" },
  { labelKey: "menu_batch_import", value: "batch_import" },
  { labelKey: "menu_resume", value: "resume" },
  { labelKey: "menu_progress", value: "progress" },
  { labelKey: "menu_failed", value: "failed" },
  { labelKey: "menu_settings", value: "settings" },
  { labelKey: "menu_language", value: "language" },
  { labelKey: "menu_exit", value: "exit" },
];

const db = new DB("./import-progress.sqlite");
const searchCache = new SearchCache("./import-progress.sqlite");

/**
 * 应用程序入口点，显示主菜单并处理用户选择的操作
 */
async function main(): Promise<void> {
  initI18n();
  db.init();
  searchCache.cleanupExpiredCaches();
  const savedConfig = db.getConfig();
  if (savedConfig.success && savedConfig.data) {
    const language = (
      savedConfig.data as {
        /**
         * 用户界面语言，支持 "en"（英语）、"zh-CN"（中文）和 "ja"（日语）
         */
        language?: Language;
      }
    ).language;
    if (language) {
      setLanguage(language);
    }
  }

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
        console.log(`\n${t("goodbye")}`);
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
  const lang = getCurrentLanguage();
  const action = await promptMainMenuTui({
    title: t("welcome_title"),
    subtitle: t("welcome_subtitle"),
    langLabel: lang === "en" ? undefined : `[${lang.toUpperCase()}]`,
    items: MENU_CHOICES.map((item) => ({
      label: t(item.labelKey),
      value: item.value as TuiMainMenuAction,
    })),
  });
  // TUI 已经在内部延迟了，这里不需要额外等待
  return action as MainMenuAction;
}

/**
 * 处理语言设置，允许用户选择界面语言并保存到数据库
 */
async function handleLanguage(): Promise<void> {
  const lang = await promptSelectList<Language>({
    message: t("language_select"),
    choices: [
      { name: t("language_english"), value: "en" },
      { name: t("language_chinese"), value: "zh-CN" },
      { name: t("language_japanese"), value: "ja" },
    ],
  });

  setLanguage(lang);
  db.upsertConfig({ language: lang });
  console.log(`\n✓ ${t("language_set", { lang })}`);
}

/**
 * 处理新导入流程，包括提示用户输入、初始化导入器、处理曲目、创建播放列表和添加歌曲等步骤
 */
async function handleNewImport(): Promise<void> {
  console.log(`\n🚀 ${t("new_import")}\n`);

  const answers = await promptForImport();
  if (!answers) {
    return;
  }

  if (!existsSync(answers.csvPath)) {
    console.error(t("error_csv_not_found", { path: answers.csvPath }));
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

  try {
    const importer = new Importer(importerOptions);

    console.log(t("initializing"));
    await importer.init();

    console.log(t("loading_csv"));
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

    const stats = importer.getStats();

    if (stats.matched > 0) {
      const proceed = await confirmImport(stats);
      if (proceed) {
        console.log(
          `\n${t("creating_playlist", { name: answers.playlistName })}`,
        );
        await importer.createPlaylist(answers.playlistName);

        const playlistId = importer.getPlaylistId?.();
        if (playlistId) {
          console.log(t("adding_songs"));
          const importResult = await importer.importToPlaylist(
            playlistId,
            results,
          );
          console.log(`\n${t("import_complete")}`);
          console.log(`   ${t("success")}: ${importResult.success}`);
          console.log(`   ${t("failed_count")}: ${importResult.failed}`);
        }
      }
    }

    db.updateRunStatus(runId, "completed");
    console.log(`\n${t("done")}`);
  } catch (error) {
    db.updateRunStatus(runId, "failed");
    console.error(t("error_import_failed", { error: String(error) }));
  } finally {
    progressTui?.stop();
  }
}

/**
 * 处理恢复导入流程，允许用户选择之前的导入会话并继续处理未完成的曲目
 */
async function handleResume(): Promise<void> {
  const run = await selectRun();
  if (!run) {
    return;
  }

  console.log(`\n🔄 ${t("resume_import")}\n`);

  const answers = await promptForImportOptions();

  if (!existsSync(run.csv_path)) {
    console.error(t("error_csv_not_found", { path: run.csv_path }));
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
                  /**
                   * 唯一标识曲目的键，通常是基于曲目名称、艺术家和专辑等信息生成的字符串
                   */
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

  try {
    const importer = new Importer(importerOptions);

    console.log(t("initializing"));
    await importer.init();

    console.log(t("loading_csv"));
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

    console.log(`\n${t("resuming_session")}\n`);

    const results = await importer.processTracks();

    importer.printSummary();

    const stats = importer.getStats();

    if (stats.matched > 0) {
      const proceed = await confirmImport(stats);
      if (proceed) {
        console.log(
          `\n${t("creating_playlist", { name: answers.playlistName })}`,
        );
        await importer.createPlaylist(answers.playlistName);

        const playlistId = importer.getPlaylistId?.();
        if (playlistId) {
          console.log(t("adding_songs"));
          const importResult = await importer.importToPlaylist(
            playlistId,
            results,
          );
          console.log(`\n${t("import_complete")}`);
          console.log(`   ${t("success")}: ${importResult.success}`);
          console.log(`   ${t("failed_count")}: ${importResult.failed}`);
        }
      }
    }

    db.updateRunStatus(run.run_id, "completed");
    console.log(`\n${t("done")}`);
  } catch (error) {
    db.updateRunStatus(run.run_id, "failed");
    console.error(t("error_import_failed", { error: String(error) }));
  } finally {
    progressTui?.stop();
  }
}

/**
 * 处理查看进度流程，显示之前导入会话的进度信息
 */
async function handleViewProgress(): Promise<void> {
  const run = await selectRun();
  if (!run) {
    return;
  }

  console.log(`\n${t("view_progress")}`);
  console.log("═══════════════════════════════════");
  console.log(`  ${t("total_tracks")}:     ${run.total_tracks || 0}`);
  console.log(`  ${t("processed")}:         ${run.processed_tracks || 0}`);
  console.log(`  ${t("matched")}:           ${run.matched_tracks || 0}`);
  console.log(`  ${t("failed")}:            ${run.failed_tracks || 0}`);
  console.log(`  ${t("skipped")}:           ${run.skipped_tracks || 0}`);
  console.log("═══════════════════════════════════");

  if (run.processed_tracks < run.total_tracks) {
    const percent = Math.round((run.processed_tracks / run.total_tracks) * 100);
    console.log(`\n${t("percent_complete", { percent })}`);
  }
}

/**
 * 处理批量导入
 */
async function handleBatchImport(): Promise<void> {
  // 清空一行，确保从 TUI 切换后终端状态正确
  if (process.stdout.isTTY) {
    process.stdout.write("\n");
    // 额外等待，确保终端完全准备好接受 inquirer 输入
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  
  console.log(`\n📚 ${t("batch_import")}\n`);

  const csvFiles = await promptForMultipleCsvFiles();
  if (!csvFiles) {
    return;
  }

  if (csvFiles.length === 0) {
    console.log(`\n${t("batch_no_files")}`);
    return;
  }

  console.log(
    `\n${t("batch_files_selected", { count: String(csvFiles.length) })}`,
  );
  csvFiles.forEach((file, i) => console.log(`  ${i + 1}. ${file}`));
  console.log("");

  console.log("  为每个文件指定播放列表名称，或直接回车使用文件名");
  console.log("");

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

    const trimmedName = String(name || "").trim();
    playlistNames.push(trimmedName || fileName);
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

    console.log(
      `\n📁 ${t("batch_processing_file", { current: String(i + 1), total: String(csvFiles.length), path: csvPath })}`,
    );

    if (!existsSync(csvPath)) {
      console.error(t("error_csv_not_found", { path: csvPath }));
      continue;
    }

    const runId = randomUUID();
    const importerOptions: ImporterOptions = {
      csvPath,
      config,
      runId,
      db,
    };

    try {
      const importer = new Importer(importerOptions);

      console.log(t("initializing"));
      await importer.init();

      console.log(t("loading_csv"));
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
          console.log(t("creating_playlist", { name: finalPlaylistName }));
          await importer.createPlaylist(finalPlaylistName);

          const playlistId = importer.getPlaylistId?.();
          if (playlistId) {
            console.log(t("adding_songs"));
            const importResult = await importer.importToPlaylist(
              playlistId,
              results,
            );
            console.log(t("import_complete"));
            console.log(`   ${t("success")}: ${importResult.success}`);
            console.log(`   ${t("failed_count")}: ${importResult.failed}`);
          }
        }
      }

      db.updateRunStatus(runId, "completed");
    } catch (error) {
      db.updateRunStatus(runId, "failed");
      console.error(t("error_import_failed", { error: String(error) }));
    }
  }

  console.log(`\n${t("batch_summary_title", { count: csvFiles.length })}`);
  console.log("═══════════════════════════════════");
  console.log(`  ${t("summary_total")}:      ${totalStats.total}`);
  console.log(`  ${t("summary_matched")}:           ${totalStats.matched}`);
  console.log(`  ${t("summary_high")}:         ${totalStats.highConfidence}`);
  console.log(`  ${t("summary_medium")}:       ${totalStats.mediumConfidence}`);
  console.log(`  ${t("summary_low")}:          ${totalStats.lowConfidence}`);
  console.log(`  ${t("summary_unmatched")}:         ${totalStats.unmatched}`);
  console.log("═══════════════════════════════════");
}

/**
 * 处理查看失败曲目流程，显示之前导入会话中匹配失败的曲目信息，并允许用户返回主菜单
 */
async function handleViewFailed(): Promise<void> {
  const run = await selectRun();
  if (!run) {
    return;
  }

  const failed = db.listFailedTracks(run.run_id, 100);
  const failedRows = Array.isArray(failed.data) ? failed.data : [];
  if (failedRows.length === 0) {
    console.log(`\n✓ ${t("no_failed")}`);
    return;
  }

  console.log(`\n${t("failed_songs_title")} (${failedRows.length})`);
  console.log("═══════════════════════════════════");

  const displayCount = Math.min(failedRows.length, 20);
  for (let i = 0; i < displayCount; i++) {
    const row = failedRows[i] as {
      /**
       * 曲目信息的JSON字符串，包含曲目名称、艺术家、专辑等信息，用于显示匹配失败的曲目详情
       */
      track_json?: string;
    };
    const parsed = row.track_json ? JSON.parse(row.track_json) : null;
    if (parsed) {
      console.log(`  ${i + 1}. ${parsed.name} - ${parsed.artist}`);
    }
  }

  if (failedRows.length > 20) {
    console.log(`  ... and ${failedRows.length - 20} more`);
  }

  console.log("═══════════════════════════════════");

  await promptSelectList({
    message: t("failed_menu_action"),
    choices: [{ name: "↩️ Return to menu", value: "back" }],
  });
}

/**
 * 处理设置流程，显示当前的配置选项和说明，允许用户调整导入器的行为
 */
async function handleSettings(): Promise<void> {
  const setting = await promptSelectList({
    message: t("settings"),
    choices: [
      { name: t("settings_cookies"), value: "update_cookies" },
      { name: t("menu_back"), value: "back" },
    ],
  });

  if (setting === "update_cookies") {
    await handleUpdateCookies();
  }
}

/**
 * 处理更新 Cookies 流程
 */
async function handleUpdateCookies(): Promise<void> {
  console.log(`\n${t("cookies_update_title")}`);
  console.log("═══════════════════════════════════");
  console.log(t("cookies_update_steps_1"));
  console.log(t("cookies_update_steps_2"));
  console.log(t("cookies_update_steps_3"));
  console.log(t("cookies_update_steps_4"));
  console.log(t("cookies_update_steps_5"));
  console.log(t("cookies_update_steps_6"));
  console.log("═══════════════════════════════════\n");

  const cookiePath = "config/cookies.json";
  if (existsSync(cookiePath)) {
    console.log(`✓ ${t("cookies_file_found")}`);
    const proceed = await promptConfirm({
      message: t("cookies_update_prompt"),
      defaultValue: false,
    });

    if (proceed) {
      console.log(`✓ ${t("cookies_updated")}`);
    }
  } else {
    console.log(`⚠ ${t("cookies_file_missing")}`);
  }
}

/**
 * 显示可用的导入会话列表并让用户选择一个会话进行恢复或查看进度
 * @returns {Promise<{ run_id: string; csv_path: string; created_at: string; status: string; total_tracks: number; processed_tracks: number; matched_tracks: number; failed_tracks: number; skipped_tracks: number; } | null>} 选定的导入会话信息，如果没有可用会话则返回null
 */
async function selectRun(): Promise<{
  /** 运行id */
  run_id: string;
  /** csv文件路径 */
  csv_path: string;
  /** 创建时间 */
  created_at: string;
  /** 运行状态，可能的值包括 "running"、"completed" 和 "failed" */
  status: string;
  /** 总曲目数 */
  total_tracks: number;
  /** 已处理曲目数 */
  processed_tracks: number;
  /** 已匹配曲目数 */
  matched_tracks: number;
  /** 匹配失败曲目数 */
  failed_tracks: number;
  /** 跳过曲目数 */
  skipped_tracks: number;
} | null> {
  const runsResult = db.listRunSummaries(50);
  const runs = Array.isArray(runsResult.data) ? runsResult.data : [];
  if (runs.length === 0) {
    console.log(`\n⚠️  ${t("no_progress_found")}`);
    return null;
  }

  const { selected } = await promptSelectList({
    message: t("menu_resume"),
    choices: runs.map((run) => {
      const row = run as {
        /** 运行id */
        run_id: string;
        /** csv文件路径 */
        csv_path: string;
        /** 创建时间 */
        created_at: string;
        /** 运行状态，可能的值包括 "running"、"completed" 和 "failed" */
        status: string;
      };
      const label = `${row.csv_path} | ${row.created_at} | ${row.status}`;
      return { name: label, value: run };
    }),
  });

  return selected as {
    /** 运行id */
    run_id: string;
    /** csv文件路径 */
    csv_path: string;
    /** 创建时间 */
    created_at: string;
    /** 运行状态，可能的值包括 "running"、"completed" 和 "failed" */
    status: string;
    /** 总曲目数 */
    total_tracks: number;
    /** 已处理曲目数 */
    processed_tracks: number;
    /** 已匹配曲目数 */
    matched_tracks: number;
    /** 匹配失败曲目数 */
    failed_tracks: number;
    /** 跳过曲目数 */
    skipped_tracks: number;
  };
}

/**
 * 处理查看进度流程，显示之前导入会话的进度信息
 */
async function promptContinue(): Promise<void> {
  // 在 TTY 模式下跳过额外的确认提示，直接返回主菜单
  // 添加延迟以确保 TUI 完全清理
  await new Promise((resolve) => setTimeout(resolve, 150));
}

void main();
