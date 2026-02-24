import { z } from "zod";

export const MatchConfidenceEnum = z.enum(["high", "medium", "low", "none"]);

/** 匹配置信度类型 */
export type MatchConfidence = z.infer<typeof MatchConfidenceEnum>;

export const LanguageEnum = z.enum(["en", "zh-CN", "ja"]);

/** 语言类型 */
export type Language = z.infer<typeof LanguageEnum>;

export const ImporterConfigSchema = z.object({
  skipConfirmation: z.boolean().default(false),
  minConfidence: MatchConfidenceEnum.default("low"),
  requestDelay: z.number().min(100).max(60000).default(1500),
  saveProgress: z.boolean().default(true),
  progressFile: z.string().default("./import-progress.json"),
  progressDbPath: z.string().default("./import-progress.sqlite"),
  language: LanguageEnum.default("en"),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  maxRetries: z.number().min(0).max(10).default(3),
  retryDelay: z.number().min(100).max(10000).default(2000),
  enableCache: z.boolean().default(true),
  cachePath: z.string().default("./search-cache.sqlite"),
  batchSize: z.number().min(1).max(100).default(50),
  proxyUrl: z.string().optional(),
});

/** 导入器配置接口 */
export type ImporterConfig = z.infer<typeof ImporterConfigSchema>;

export const DEFAULT_CONFIG: ImporterConfig = {
  skipConfirmation: false,
  minConfidence: "low",
  requestDelay: 1500,
  saveProgress: true,
  progressFile: "./import-progress.json",
  progressDbPath: "./import-progress.sqlite",
  language: "en",
  logLevel: "info",
  maxRetries: 3,
  retryDelay: 2000,
  enableCache: true,
  cachePath: "./search-cache.sqlite",
  batchSize: 50,
  proxyUrl: undefined,
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
    `Config validation failed: ${result.error.errors.map((e) => e.message).join(", ")}`,
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
