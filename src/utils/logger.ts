import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
} from "node:fs";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const LOG_DIR = "./logs";
const MAX_LOG_FILES = 7;

/**
 * 获取当前日期的日志文件路径，格式为 logs/app-YYYY-MM-DD.log
 * @returns {string} 获取到的日志文件路径
 */
function getLogFilePath(): string {
  const date = new Date().toISOString().split("T")[0];
  return `${LOG_DIR}/app-${date}.log`;
}

/**
 * 确保日志目录存在，如果不存在则创建
 */
function ensureLogDir(): void {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

/**
 *  格式化日志消息
 * @param {string} level - 日志级别
 * @param {string} message - 日志消息
 * @param {unknown} [data] - 可选的附加数据
 * @returns {string} 格式化后的日志字符串
 */
function formatMessage(level: string, message: string, data?: unknown): string {
  const timestamp = new Date().toISOString();
  let log = `[${timestamp}] [${level}] ${message}`;
  if (data !== undefined) {
    log += ` ${JSON.stringify(data)}`;
  }
  return log + "\n";
}

/**
 * 校验日志数量,使其不超过 MAX_LOG_FILES 个,超过则删除最旧的日志文件
 * @returns {void}
 */
function rotateLogs(): void {
  try {
    if (!existsSync(LOG_DIR)) return;

    const files = readdirSync(LOG_DIR)
      .filter((f: string) => f.startsWith("app-") && f.endsWith(".log"))
      .sort()
      .reverse();

    for (let i = MAX_LOG_FILES; i < files.length; i++) {
      unlinkSync(`${LOG_DIR}/${files[i]}`);
    }
  } catch {
    // Ignore rotation errors
  }
}

export const logger = {
  debug(message: string, data?: unknown): void {
    const formatted = formatMessage("DEBUG", message, data);
    ensureLogDir();
    rotateLogs();
    appendFileSync(getLogFilePath(), formatted);
  },

  info(message: string, data?: unknown): void {
    const formatted = formatMessage("INFO", message, data);
    ensureLogDir();
    rotateLogs();
    appendFileSync(getLogFilePath(), formatted);
  },

  warn(message: string, data?: unknown): void {
    const formatted = formatMessage("WARN", message, data);
    ensureLogDir();
    rotateLogs();
    appendFileSync(getLogFilePath(), formatted);
  },

  error(message: string, data?: unknown): void {
    const formatted = formatMessage("ERROR", message, data);
    ensureLogDir();
    rotateLogs();
    appendFileSync(getLogFilePath(), formatted);
  },
};
