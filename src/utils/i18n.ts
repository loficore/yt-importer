import toml from "toml";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 支持的语言类型
 */
export type Language = "en" | "zh-CN" | "ja";

/**
 * i18n配置接口
 */
export interface I18nConfig {
  /** 语言代码 */
  lang: Language;
  /** 翻译内容 */
  translations: Record<string, string>;
}

let currentConfig: I18nConfig | null = null;

/**
 * 获取当前系统语言
 * @returns {Language} 检测到的语言代码
 */
export function getLanguage(): Language {
  const envLang = process.env.LANG || process.env.LANGUAGE || "";
  if (envLang.startsWith("zh")) return "zh-CN";
  if (envLang.startsWith("ja")) return "ja";
  return "en";
}

/**
 * 初始化国际化配置
 * @param {Language} [lang] - 可选的语言代码，如果不提供则自动检测
 * @returns {I18nConfig} 初始化后的配置对象
 */
export function initI18n(lang?: Language): I18nConfig {
  const selectedLang = lang || getLanguage();
  const translationsDir = join(process.cwd(), "config/translations");
  const configPath = join(translationsDir, `${selectedLang}.toml`);

  let translations: Record<string, string> = {};

  if (existsSync(configPath)) {
    const content = readFileSync(configPath, "utf-8");
    const parsed = toml.parse(content);
    const langSection = parsed[selectedLang] as Record<string, string>;
    if (langSection) {
      translations = langSection;
    }
  } else {
    console.warn(`Translation file not found: ${configPath}`);
  }

  currentConfig = {
    lang: selectedLang,
    translations,
  };

  return currentConfig;
}

/**
 * 翻译键值到对应语言的文本
 * @param {string} key - 翻译键
 * @param {Record<string, string | number>} [params] - 可选的格式化参数
 * @returns {string} 翻译后的文本
 */
export function t(
  key: string,
  params?: Record<string, string | number>,
): string {
  if (!currentConfig) {
    initI18n();
  }

  const template = currentConfig?.translations[key] || key;

  if (!params) return template;

  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return String(params[key] ?? match);
  });
}

/**
 * 设置当前语言
 * @param {Language} lang - 要设置的语言代码
 */
export function setLanguage(lang: Language): void {
  initI18n(lang);
}

/**
 * 获取当前语言
 * @returns {Language} 当前语言代码
 */
export function getCurrentLanguage(): Language {
  return currentConfig?.lang || "en";
}
