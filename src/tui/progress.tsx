import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, render } from "ink";

/**
 * 导入进度快照，表示当前整体导入统计。
 */
export interface ImportProgressSnapshot {
  /** 总曲目数 */
  totalTracks: number;
  /** 已处理的曲目数 */
  processedTracks: number;
  /** 匹配的曲目数 */
  matchedTracks: number;
  /** 失败的曲目数 */
  failedTracks: number;
  /** 跳过的曲目数 */
  skippedTracks: number;
  /** 当前处理的曲目 */
  currentTrack?: string;
}

/**
 * 进度更新负载：允许部分字段更新，并可包含 `done` 标志。
 */
type ImportProgressPayload = Partial<ImportProgressSnapshot> & {
  /** 可选的完成标志，表示导入处理已完成。 */
  done?: boolean;
};

/**
 * Progress 组件的 props。
 */
interface ProgressProps {
  /** 初始的进度快照 */
  initial: ImportProgressSnapshot;
  /** 订阅更新的函数，返回用于取消订阅的函数 */
  subscribe: (listener: (payload: ImportProgressPayload) => void) => () => void;
}

/** 进度条宽度（字符数） */
const BAR_WIDTH = 36;

/**
 * 格式化剩余秒数为 MM:SS 格式的字符串。
 * @param {number} seconds 剩余秒数
 * @returns {string} 格式化字符串或 `--:--`（不可用时）
 */
function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "--:--";
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * 进度视图组件：用于在终端显示导入进度与 ETA 等信息。
 * @param {ProgressProps} props 组件 props
 * @returns {React.JSX.Element} 渲染的进度视图元素
 */
function ProgressView({
  initial,
  subscribe,
}: ProgressProps): React.JSX.Element {
  const [state, setState] = useState<ImportProgressSnapshot>(initial);
  const [done, setDone] = useState(false);
  const [startedAt] = useState(() => Date.now());

  useEffect(() => {
    const unsubscribe = subscribe((payload) => {
      setState((prev) => ({ ...prev, ...payload }));
      if (payload.done) {
        setDone(true);
      }
    });
    return unsubscribe;
  }, [subscribe]);

  const percent = useMemo(() => {
    if (state.totalTracks <= 0) return 0;
    return Math.min(1, state.processedTracks / state.totalTracks);
  }, [state.processedTracks, state.totalTracks]);

  const bar = useMemo(() => {
    const filled = Math.round(percent * BAR_WIDTH);
    const empty = Math.max(0, BAR_WIDTH - filled);
    return `${"█".repeat(filled)}${"░".repeat(empty)}`;
  }, [percent]);

  const eta = useMemo(() => {
    if (state.processedTracks <= 0) return "--:--";
    const elapsedSeconds = (Date.now() - startedAt) / 1000;
    const speed = state.processedTracks / elapsedSeconds;
    if (speed <= 0) return "--:--";
    const remaining = Math.max(0, state.totalTracks - state.processedTracks);
    return formatEta(remaining / speed);
  }, [startedAt, state.processedTracks, state.totalTracks]);

  const matchRate = useMemo(() => {
    if (state.processedTracks <= 0) return 0;
    return (state.matchedTracks / state.processedTracks) * 100;
  }, [state.matchedTracks, state.processedTracks]);

  return (
    <Box flexDirection="column" gap={1}>
      <Text color={done ? "green" : "cyan"}>
        {done ? "✅ 导入处理完成" : "🎵 正在处理歌曲..."}
      </Text>
      <Text>
        {bar} {Math.round(percent * 100)}%
      </Text>
      <Text>
        进度: {state.processedTracks}/{state.totalTracks} | 匹配: {" "}
        {state.matchedTracks} | 失败: {state.failedTracks} | 跳过: {" "}
        {state.skippedTracks}
      </Text>
      <Text>匹配成功率: {matchRate.toFixed(1)}%</Text>
      <Text>ETA: {eta}</Text>
      <Text dimColor>当前: {state.currentTrack ?? "-"}</Text>
    </Box>
  );
}

/**
 * 控制器接口：用于外部更新进度或停止显示。
 */
export interface ImportProgressTuiController {
  /** 更新进度视图，接受部分更新负载 */
  update: (payload: ImportProgressPayload) => void;
  /** 停止并卸载进度视图 */
  stop: () => void;
}

/**
 * 创建并显示导入进度 TUI，返回控制器用于后续更新或停止。
 * @param {ImportProgressSnapshot} initial 初始的进度快照
 * @returns {ImportProgressTuiController} 控制器
 */
export function createImportProgressTui(
  initial: ImportProgressSnapshot,
): ImportProgressTuiController {
  const listeners = new Set<(payload: ImportProgressPayload) => void>();

  const { unmount } = render(
    <ProgressView
      initial={initial}
      subscribe={(listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      }}
    />,
  );

  return {
    update(payload) {
      for (const listener of listeners) {
        listener(payload);
      }
    },
    stop() {
      for (const listener of listeners) {
        listener({ done: true });
      }
      // 增加延迟以确保终端状态完全恢复
      setTimeout(() => unmount(), 300);
    },
  };
}
