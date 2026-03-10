import { DB } from "../utils/db.js";
import { SearchCache } from "../utils/searchCache.js";
import { initI18n, t, setLanguage, type Language } from "../utils/i18n.js";
import { setDefaultConfig } from "../utils/config.js";
import { promptSelectList } from "../tui/selectList.js";
import {
  handleNewImport,
  handleResume,
  handleBatchImport,
  handleIncrementalImport,
} from "./handlers/importHandlers.js";
import {
  handleViewProgress,
  handleViewFailed,
} from "./handlers/viewHandlers.js";
import { handleGenerateReport } from "./handlers/reportHandlers.js";
import { handleSettings, handleLanguage } from "./handlers/settingsHandlers.js";

const db = new DB("./import-progress.sqlite");
const searchCache = new SearchCache("./import-progress.sqlite");

/**
 * 主菜单动作类型。
 */
export type MainMenuAction =
  | "new_import"
  | "batch_import"
  | "resume"
  | "incremental_import"
  | "progress"
  | "failed"
  | "report"
  | "settings"
  | "exit"
  | "language";

/**
 * 主菜单选项。
 */
interface MenuChoice {
  /**
   * 国际化文案 key。
   */
  labelKey: string;
  /**
   * 对应的菜单动作。
   */
  value: MainMenuAction;
}

/**
 * 从数据库读取的应用配置。
 */
interface SavedAppConfig {
  /**
   * 当前界面语言。
   */
  language?: Language;
  /**
   * 代理 URL。
   */
  proxy_url?: string;
}

/**
 * 主菜单选项列表。
 */
export const MENU_CHOICES: MenuChoice[] = [
  { labelKey: "menu_new_import", value: "new_import" },
  { labelKey: "menu_batch_import", value: "batch_import" },
  { labelKey: "menu_resume", value: "resume" },
  { labelKey: "menu_incremental_import", value: "incremental_import" },
  { labelKey: "menu_progress", value: "progress" },
  { labelKey: "menu_failed", value: "failed" },
  { labelKey: "menu_report", value: "report" },
  { labelKey: "menu_settings", value: "settings" },
  { labelKey: "menu_language", value: "language" },
  { labelKey: "menu_exit", value: "exit" },
];

/**
 * 初始化应用所需资源。
 * @returns {void}
 */
export function initApp(): void {
  initI18n();
  db.init();
  searchCache.cleanupExpiredCaches();
  const savedConfig = db.getConfig();
  if (savedConfig.success && savedConfig.data) {
    const config = savedConfig.data as SavedAppConfig;
    if (config.language) {
      setLanguage(config.language);
    }
    if (config.proxy_url !== undefined) {
      setDefaultConfig({ proxyUrl: config.proxy_url || undefined });
    }
  }
}

/**
 * 运行主菜单循环。
 * @returns {Promise<void>} 菜单循环不会主动返回。
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
      case "report":
        await handleGenerateReport();
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
 * 显示主菜单并返回用户选择。
 * @returns {Promise<MainMenuAction>} 用户选择的主菜单动作。
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
 * 操作完成后的短暂间隔，避免界面切换过快。
 * @returns {Promise<void>} 在短暂延时后 resolved。
 */
async function promptContinue(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 150));
}

/**
 * 启动 CLI 应用。
 * @returns {Promise<void>} 应用退出时 resolved。
 */
export async function run(): Promise<void> {
  initApp();
  await runMainLoop();
}
