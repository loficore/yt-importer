import { watch, type FSWatcher } from "node:fs";
import { stat } from "node:fs/promises";
import { logger } from "./logger.js";

/** 文件监控选项定义 */
export interface FileWatcherOptions {
  /** 文件路径 */
  path: string;
  /** 文件变化回调 */
  onChange: (event: "change" | "delete", mtime: number) => void;
  /** 轮询间隔（毫秒），用于处理某些不触发 watch 的情况 */
  pollInterval?: number;
}

/** 文件监控类，支持基于 fs.watch 和轮询的文件变化检测 */
class FileWatcher {
  private watchers: Map<string, FSWatcher> = new Map();
  private pollTimers: Map<string, NodeJS.Timeout> = new Map();
  private lastMtime: Map<string, number> = new Map();

  /**
   * 开始监控指定文件的变化。
   * @param {FileWatcherOptions} options 文件监控选项
   */
  async watch(options: FileWatcherOptions): Promise<void> {
    const { path, onChange, pollInterval = 5000 } = options;

    try {
      const stats = await stat(path);
      this.lastMtime.set(path, stats.mtimeMs);
    } catch {
      // 文件不存在，忽略
    }

    try {
      const watcher = watch(path, (eventType) => {
        if (eventType === "change") {
          void this.handleFileChange(path, onChange);
        }
      });

      watcher.on("unlink", () => {
        onChange("delete", Date.now());
      });

      this.watchers.set(path, watcher);
    } catch {
      logger.warn(`Failed to watch file: ${path}`);
    }

    const timer = setInterval(() => {
      void stat(path)
        .then((stats) => {
          const lastMtime = this.lastMtime.get(path) || 0;

          if (stats.mtimeMs > lastMtime) {
            this.lastMtime.set(path, stats.mtimeMs);
            onChange("change", stats.mtimeMs);
          }
        })
        .catch(() => {
          // 文件不存在
        });
    }, pollInterval);

    this.pollTimers.set(path, timer);
  }

  /**
   * 处理文件变化事件。
   * @param {string} path 文件路径
   * @param {(event: "change" | "delete", mtime: number) => void} onChange 文件变化回调
   */
  private async handleFileChange(
    path: string,
    onChange: (event: "change" | "delete", mtime: number) => void,
  ): Promise<void> {
    try {
      const stats = await stat(path);
      const lastMtime = this.lastMtime.get(path) || 0;

      if (stats.mtimeMs > lastMtime) {
        this.lastMtime.set(path, stats.mtimeMs);
        onChange("change", stats.mtimeMs);
      }
    } catch {
      onChange("delete", Date.now());
    }
  }

  /**
   * 停止监控指定文件。
   * @param {string} path 文件路径
   */
  unwatch(path: string): void {
    const watcher = this.watchers.get(path);
    if (watcher) {
      watcher.close();
      this.watchers.delete(path);
    }

    const timer = this.pollTimers.get(path);
    if (timer) {
      clearInterval(timer);
      this.pollTimers.delete(path);
    }

    this.lastMtime.delete(path);
  }

  /**
   * 停止监控所有文件。
   */
  unwatchAll(): void {
    for (const path of this.watchers.keys()) {
      this.unwatch(path);
    }
  }
}

export const fileWatcher = new FileWatcher();
