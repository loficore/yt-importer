import { setDefaultConfig, getConfig } from "../../utils/config.js";
import {
  testProxyConnection,
  testDirectConnection,
} from "../../utils/proxy.js";
import { showProxyTestResult } from "../../tui/proxyTestResult.js";
import { promptSelectList } from "../../tui/selectList.js";
import { promptTextInput } from "../../tui/textInput.js";
import { promptPressKey } from "../../tui/pressKey.js";
import { promptConfirm } from "../../tui/confirm.js";

import { t, setLanguage, type Language } from "../../utils/i18n.js";
import { handleUpdateCookies } from "./importHandlers.js";
import { DB } from "../../utils/db.js";
import { CLEANUP } from "../../utils/constants.js";
import { validateCsv } from "../../core/csvValidator.js";

const db = new DB("./import-progress.sqlite");

/**
 * 处理语言更改
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
 * 处理设置菜单
 */
export async function handleSettings(): Promise<void> {
  const setting = await promptSelectList({
    message: t("settings"),
    choices: [
      { name: t("settings_cookies"), value: "update_cookies" },
      { name: "代理设置 (Proxy Settings)", value: "proxy_settings" },
      { name: "清理历史进度", value: "cleanup_progress" },
      { name: t("menu_back"), value: "back" },
    ],
  });

  if (setting === "update_cookies") {
    await handleUpdateCookies();
  } else if (setting === "proxy_settings") {
    await handleProxySettings();
  } else if (setting === "cleanup_progress") {
    await handleCleanupProgress();
  }
}

/**
 * 处理代理设置
 */
export async function handleProxySettings(): Promise<void> {
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
      db.upsertConfig({ proxyUrl: null });
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
 * 处理进度清理
 */
export async function handleCleanupProgress(): Promise<void> {
  while (true) {
    const action = await promptSelectList({
      message: "清理历史进度",
      choices: [
        { name: `清理 7 天前的记录`, value: "7" },
        { name: `清理 14 天前的记录`, value: "14" },
        {
          name: `清理 ${CLEANUP.DEFAULT_RETENTION_DAYS} 天前的记录 (默认)`,
          value: String(CLEANUP.DEFAULT_RETENTION_DAYS),
        },
        { name: "清理 90 天前的记录", value: "90" },
        { name: "清空所有历史记录", value: "all" },
        { name: t("menu_back"), value: "back" },
      ],
    });

    if (action === "back") {
      return;
    }

    if (action === "all") {
      const confirm = await promptConfirm({
        message: "确定要清空所有历史进度记录吗？此操作不可恢复！",
        defaultValue: false,
      });
      if (!confirm) {
        continue;
      }
      db.clearAllRuns();
      console.log(t("settings_cleanup_completed"));
      return;
    }

    const days = parseInt(action, 10);
    const confirm = await promptConfirm({
      message: `确定要清理 ${days} 天前的历史进度记录吗？`,
      defaultValue: false,
    });
    if (!confirm) {
      continue;
    }
    db.cleanupOldRuns(days);
    console.log(t("settings_cleanup_days_completed", { days }));
    return;
  }
}

/**
 * 处理 CSV 文件验证
 */
export async function handleValidateCsv(): Promise<void> {
  while (true) {
    const filePath = await promptTextInput({
      message: "输入 CSV 文件路径",
      defaultValue: "",
    });

    if (!filePath || filePath.trim() === "") {
      continue;
    }

    const trimmedPath = filePath.trim();

    console.log("");
    const result = await validateCsv(trimmedPath);

    console.clear();
    console.log("");
    console.log(`📁 文件: ${trimmedPath}`);
    console.log("─".repeat(50));

    if (result.isValid) {
      console.log("✅ 验证通过 - 该 CSV 文件格式正确\n");
    } else {
      console.log("❌ 验证失败 - 发现以下问题:\n");
    }

    console.log(`总行数: ${result.totalRows}`);
    console.log(`有效曲目: ${result.validTracks}`);
    console.log(`错误: ${result.errors.length} 个`);
    console.log(`警告: ${result.warnings.length} 个`);
    console.log("");

    if (result.errors.length > 0) {
      console.log("--- 错误详情 ---");
      const errorMap = new Map<string, number>();
      for (const err of result.errors) {
        const key = `${err.column}: ${err.message}`;
        errorMap.set(key, (errorMap.get(key) || 0) + 1);
      }
      for (const [key, count] of errorMap) {
        console.log(`  • ${key} (${count} 次)`);
      }
      console.log("");
    }

    if (result.warnings.length > 0) {
      console.log("--- 警告 ---");
      for (const warn of result.warnings) {
        console.log(`  • ${warn.message}`);
      }
      console.log("");
    }

    console.log("─".repeat(50));

    await promptPressKey("按 Enter 键继续...");

    const action = await promptSelectList({
      message: "验证其他文件?",
      choices: [
        { name: "继续验证", value: "continue" },
        { name: t("menu_back"), value: "back" },
      ],
    });

    if (action === "back") {
      return;
    }
  }
}

/**
 * 处理杂项工具菜单
 */
export async function handleTools(): Promise<void> {
  const tool = await promptSelectList({
    message: "杂项工具",
    choices: [
      { name: "CSV 文件验证", value: "validate_csv" },
      { name: t("menu_back"), value: "back" },
    ],
  });

  if (tool === "validate_csv") {
    await handleValidateCsv();
  }
}
