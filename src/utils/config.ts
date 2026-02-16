import { z } from "zod";

export const MatchConfidenceEnum = z.enum(["high", "medium", "low", "none"]);
export type MatchConfidence = z.infer<typeof MatchConfidenceEnum>;

export const LanguageEnum = z.enum(["en", "zh-CN", "ja"]);
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
});
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
};

const configMap = new Map<string, ImporterConfig>();

export function getConfig(key?: string): ImporterConfig {
  if (key && configMap.has(key)) {
    const config = configMap.get(key);
    if (config) return config;
  }
  const defaultConfig = configMap.get("default");
  return defaultConfig ?? DEFAULT_CONFIG;
}

export function setConfig(key: string, config: Partial<ImporterConfig>): void {
  const current = configMap.get(key) ?? { ...DEFAULT_CONFIG };
  configMap.set(key, { ...current, ...config });
}

export function setDefaultConfig(config: Partial<ImporterConfig>): void {
  setConfig("default", config);
}

export function mergeConfig(
  base: Partial<ImporterConfig>,
  overrides: Partial<ImporterConfig>,
): ImporterConfig {
  return { ...base, ...overrides } as ImporterConfig;
}

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

export function getConfigKeys(): string[] {
  return Array.from(configMap.keys());
}

export function clearConfig(key?: string): void {
  if (key) {
    configMap.delete(key);
  } else {
    configMap.clear();
  }
}
