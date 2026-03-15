import {
  MatchConfidenceEnum,
  LanguageEnum,
  ImporterConfigSchema,
  type MatchConfidence,
  type Language,
  type ImporterConfig,
} from "../types/index.js";
import { DB, IMPORT } from "./constants.js";
import { t } from "./i18n.js";

export type { MatchConfidence, Language, ImporterConfig };
export { MatchConfidenceEnum, LanguageEnum, ImporterConfigSchema };

export const DEFAULT_CONFIG: ImporterConfig = {
  skipConfirmation: false,
  minConfidence: "low",
  requestDelay: IMPORT.DEFAULT_REQUEST_DELAY,
  saveProgress: true,
  progressFile: "./import-progress.json",
  progressDbPath: DB.PROGRESS_DB_NAME,
  language: "en",
  logLevel: "info",
  maxRetries: IMPORT.DEFAULT_MAX_RETRIES,
  retryDelay: IMPORT.DEFAULT_RETRY_DELAY,
  enableCache: true,
  cachePath: DB.SEARCH_CACHE_DB_NAME,
  batchSize: IMPORT.DEFAULT_BATCH_SIZE,
  proxyUrl: undefined,
  concurrency: IMPORT.DEFAULT_CONCURRENCY,
  searchQps: IMPORT.DEFAULT_SEARCH_QPS,
  reportPath: "./reports",
};

const configMap = new Map<string, ImporterConfig>();

/**
 * 获取配置
 * @param {string} [key] 配置键
 * @returns {ImporterConfig} 配置对象
 */
export function getConfig(key?: string): ImporterConfig {
  if (key && configMap.has(key)) {
    const config = configMap.get(key);
    if (config) return config;
  }
  const defaultConfig = configMap.get("default");
  return defaultConfig ?? DEFAULT_CONFIG;
}

/**
 * 设置配置
 * @param {string} key 配置键
 * @param {Partial<ImporterConfig>} config 配置对象
 */
export function setConfig(key: string, config: Partial<ImporterConfig>): void {
  const current = configMap.get(key) ?? { ...DEFAULT_CONFIG };
  configMap.set(key, { ...current, ...config });
}

/**
 * 设置默认配置
 * @param {Partial<ImporterConfig>} config 默认配置对象
 */
export function setDefaultConfig(config: Partial<ImporterConfig>): void {
  setConfig("default", config);
}

/**
 * 合并配置
 * @param {Partial<ImporterConfig>} base 基础配置
 * @param {Partial<ImporterConfig>} overrides 覆盖配置
 * @returns {ImporterConfig} 合并后的配置对象
 */
export function mergeConfig(
  base: Partial<ImporterConfig>,
  overrides: Partial<ImporterConfig>,
): ImporterConfig {
  return { ...base, ...overrides } as ImporterConfig;
}

/**
 *  验证配置对象
 * @param {Record<string, unknown>} config 配置对象
 * @returns {ImporterConfig} 验证后的配置对象
 */
export function validateConfig(
  config: Record<string, unknown>,
): ImporterConfig {
  const result = ImporterConfigSchema.safeParse(config);
  if (result.success) {
    return result.data;
  }
  console.warn(
    t("config_validation_failed", {
      errors: result.error.errors.map((e) => e.message).join(", "),
    }),
  );
  return { ...DEFAULT_CONFIG };
}

/**
 * 获取所有配置键
 * @returns {string[]} 配置键数组
 */
export function getConfigKeys(): string[] {
  return Array.from(configMap.keys());
}

/**
 * 清除配置
 * @param {string} key 配置键，如果未提供则清除所有配置
 */
export function clearConfig(key?: string): void {
  if (key) {
    configMap.delete(key);
  } else {
    configMap.clear();
  }
}
