import {
  existsSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
  openSync,
  writeSync,
  closeSync,
} from "node:fs";

/**
 * 日志等级枚举，由低到高：DEBUG < INFO < WARN < ERROR
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * 获取日志等级的字符串表示
 * @param {LogLevel} level - 日志等级
 * @returns {string} 等级字符串
 */
export function logLevelToString(level: LogLevel): string {
  switch (level) {
    case LogLevel.DEBUG:
      return "DEBUG";
    case LogLevel.INFO:
      return "INFO";
    case LogLevel.WARN:
      return "WARN";
    case LogLevel.ERROR:
      return "ERROR";
  }
}

/**
 * 获取日志等级的 Emoji 前缀
 * @param {LogLevel} level - 日志等级
 * @returns {string} Emoji 字符
 */
export function logLevelEmoji(level: LogLevel): string {
  switch (level) {
    case LogLevel.DEBUG:
      return "🐛";
    case LogLevel.INFO:
      return "ℹ️";
    case LogLevel.WARN:
      return "⚠️";
    case LogLevel.ERROR:
      return "❌";
  }
}

/**
 * 从字符串解析日志等级
 * @param {string} str - 字符串（不区分大小写）
 * @returns {LogLevel | null} 日志等级，找不到返回 null
 */
export function parseLogLevel(str: string): LogLevel | null {
  const trimmed = str.trim().toUpperCase();
  switch (trimmed) {
    case "DEBUG":
      return LogLevel.DEBUG;
    case "INFO":
      return LogLevel.INFO;
    case "WARN":
    case "WARNING":
      return LogLevel.WARN;
    case "ERROR":
      return LogLevel.ERROR;
    default:
      return null;
  }
}

import { LOG } from "./constants.js";

/**
 * 日志系统类
 */
export class Logger {
  currentLevel = LogLevel.INFO;

  enableTimestamp = true;

  logDir = LOG.DIR;

  maxLogFiles = LOG.MAX_FILES;

  private fileHandle: number | null = null;

  private currentLogFile = "";

  /**
   * 创建 Logger 实例
   * @param {object} options - 配置选项
   * @param {LogLevel} [options.level] - 初始日志等级
   * @param {string} [options.logDir] - 日志目录
   * @param {number} [options.maxLogFiles] - 最大日志文件数量
   * @param {boolean} [options.enableTimestamp] - 是否启用时间戳
   */
  constructor(options?: {
    /** 日志等级 */
    level?: LogLevel;
    /** 日志目录 */
    logDir?: string;
    /** 最大日志文件数量 */
    maxLogFiles?: number;
    /** 是否启用时间戳 */
    enableTimestamp?: boolean;
  }) {
    if (options?.level !== undefined) {
      this.currentLevel = options.level;
    }
    if (options?.logDir !== undefined) {
      this.logDir = options.logDir;
    }
    if (options?.maxLogFiles !== undefined) {
      this.maxLogFiles = options.maxLogFiles;
    }
    if (options?.enableTimestamp !== undefined) {
      this.enableTimestamp = options.enableTimestamp;
    }
  }

  /**
   * 获取当前日期的日志文件路径
   * @returns {string} 日志文件路径
   */
  private getLogFilePath(): string {
    const date = new Date().toISOString().split("T")[0];
    return `${this.logDir}/app-${date}.log`;
  }

  /**
   * 确保日志目录存在
   */
  private ensureLogDir(): void {
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * 校验并执行日志轮转
   */
  private rotateLogs(): void {
    try {
      if (!existsSync(this.logDir)) return;

      const files = readdirSync(this.logDir)
        .filter((f) => f.startsWith("app-") && f.endsWith(".log"))
        .sort()
        .reverse();

      for (let i = this.maxLogFiles; i < files.length; i++) {
        unlinkSync(`${this.logDir}/${files[i]}`);
      }
    } catch {
      // Ignore rotation errors
    }
  }

  /**
   * 打开日志文件（保持文件句柄）
   */
  private openLogFile(): void {
    const logPath = this.getLogFilePath();

    if (this.currentLogFile === logPath && this.fileHandle !== null) {
      return;
    }

    this.ensureLogDir();
    this.rotateLogs();

    if (this.fileHandle !== null) {
      try {
        closeSync(this.fileHandle);
      } catch {
        // Ignore close errors
      }
    }

    this.fileHandle = openSync(logPath, "a");
    this.currentLogFile = logPath;
  }

  /**
   * 关闭日志文件
   */
  close(): void {
    if (this.fileHandle !== null) {
      try {
        closeSync(this.fileHandle);
      } catch {
        // Ignore close errors
      }
      this.fileHandle = null;
      this.currentLogFile = "";
    }
  }

  /**
   * 格式化时间戳
   * @returns {string} 格式化后的时间戳字符串
   */
  private formatTimestamp(): string {
    if (!this.enableTimestamp) {
      return "";
    }
    return new Date().toISOString();
  }

  /**
   * 内部日志输出函数
   * @param {LogLevel} level - 日志等级
   * @param {string} message - 日志消息
   * @param {unknown} data - 可选的附加数据
   */
  private log(level: LogLevel, message: string, data?: unknown): void {
    if (level < this.currentLevel) {
      return;
    }

    const timestamp = this.formatTimestamp();
    const levelStr = logLevelToString(level);
    const emoji = logLevelEmoji(level);

    // 输出到控制台
    if (timestamp) {
      process.stdout.write(`[${timestamp}] `);
    }
    process.stdout.write(`[${levelStr}] ${emoji} ${message}`);
    if (data !== undefined) {
      process.stdout.write(` ${JSON.stringify(data)}`);
    }
    process.stdout.write("\n");

    // 输出到文件
    const logLine = timestamp
      ? `[${timestamp}] [${levelStr}] ${emoji} ${message}${data !== undefined ? ` ${JSON.stringify(data)}` : ""}\n`
      : `[${levelStr}] ${emoji} ${message}${data !== undefined ? ` ${JSON.stringify(data)}` : ""}\n`;

    this.openLogFile();
    if (this.fileHandle !== null) {
      try {
        writeSync(this.fileHandle, logLine);
      } catch {
        // Ignore write errors
      }
    }
  }

  /**
   * DEBUG 等级日志（最详细的调试信息）
   * @param {string} message - 日志消息
   * @param {unknown} data - 可选的附加数据
   */
  debug(message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * INFO 等级日志（一般信息）
   * @param {string} message - 日志消息
   * @param {unknown} data - 可选的附加数据
   */
  info(message: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * WARN 等级日志（警告信息，可能有问题）
   * @param {string} message - 日志消息
   * @param {unknown} data - 可选的附加数据
   */
  warn(message: string, data?: unknown): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * ERROR 等级日志（错误信息，需要处理）
   * @param {string} message - 日志消息
   * @param {unknown} data - 可选的附加数据
   */
  error(message: string, data?: unknown): void {
    this.log(LogLevel.ERROR, message, data);
  }

  /**
   * 设置日志输出等级
   * @param {LogLevel} level - 新的日志等级
   */
  setLevel(level: LogLevel): void {
    this.currentLevel = level;
    this.info(`日志等级已改变为: ${logLevelToString(level)}`);
  }

  /**
   * 设置日志目录
   * @param {string} dir - 新的日志目录
   */
  setLogDir(dir: string): void {
    this.logDir = dir;
    this.currentLogFile = "";
    if (this.fileHandle !== null) {
      this.close();
    }
    this.info(`日志目录已改变为: ${dir}`);
  }

  /**
   * 设置是否启用时间戳
   * @param {boolean} enable - 是否启用时间戳
   */
  setTimestamp(enable: boolean): void {
    this.enableTimestamp = enable;
  }
}

/**
 * 全局日志实例
 */
export const logger = new Logger();
