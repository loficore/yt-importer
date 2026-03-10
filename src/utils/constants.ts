/**
 * 应用程序常量定义
 */

/** 数据库相关 */
export const DB = {
  /** 进度数据库文件名 */
  PROGRESS_DB_NAME: "import-progress.sqlite",
  /** 搜索缓存数据库文件名 */
  SEARCH_CACHE_DB_NAME: "search-cache.sqlite",
};

/** 日志相关 */
export const LOG = {
  /** 日志目录 */
  DIR: "./logs",
  /** 最大日志文件数量 */
  MAX_FILES: 7,
};

/** TUI 分页相关 */
export const UI = {
  /** 进度查看页面大小 */
  VIEW_PROGRESS_PAGE_SIZE: 10,
  /** 失败曲目查看页面大小 */
  VIEW_FAILED_PAGE_SIZE: 5,
  /** 默认超时（毫秒） */
  DEFAULT_TIMEOUT: 100,
};

/** 导入相关 */
export const IMPORT = {
  /** 默认请求延迟（毫秒） */
  DEFAULT_REQUEST_DELAY: 1500,
  /** 默认最大重试次数 */
  DEFAULT_MAX_RETRIES: 3,
  /** 默认重试延迟（毫秒） */
  DEFAULT_RETRY_DELAY: 2000,
  /** 默认批量大小 */
  DEFAULT_BATCH_SIZE: 50,
  /** 默认并发数 */
  DEFAULT_CONCURRENCY: 5,
  /** 默认搜索 QPS */
  DEFAULT_SEARCH_QPS: 10,
};

/** 匹配算法相关 */
export const MATCH = {
  /** 完全匹配分数 */
  EXACT_SCORE: 1.0,
  /** 模糊匹配分数（高） */
  FUZZY_HIGH_SCORE: 0.85,
  /** 模糊匹配分数（中） */
  FUZZY_MEDIUM_SCORE: 0.7,
  /** 模糊匹配分数（低） */
  FUZZY_LOW_SCORE: 0.45,
  /** 时长匹配分数（各种情况） */
  DURATION_HIGH_SCORE: 0.5,
  DURATION_MEDIUM_SCORE: 0.35,
  DURATION_LOW_SCORE: 0.3,
  DURATION_VERY_LOW_SCORE: 0.25,
  /** 无匹配分数 */
  NONE_SCORE: 0,
};

/** 进度清理相关 */
export const CLEANUP = {
  /** 默认保留天数 */
  DEFAULT_RETENTION_DAYS: 30,
};
