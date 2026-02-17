import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, render } from "ink";

export interface ImportProgressSnapshot {
  totalTracks: number;
  processedTracks: number;
  matchedTracks: number;
  failedTracks: number;
  skippedTracks: number;
  currentTrack?: string;
}

type ImportProgressPayload = Partial<ImportProgressSnapshot> & {
  done?: boolean;
};

interface ProgressProps {
  initial: ImportProgressSnapshot;
  subscribe: (listener: (payload: ImportProgressPayload) => void) => () => void;
}

const BAR_WIDTH = 36;

function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "--:--";
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function ProgressView({ initial, subscribe }: ProgressProps): React.JSX.Element {
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
        进度: {state.processedTracks}/{state.totalTracks} | 匹配: {state.matchedTracks} | 失败: {state.failedTracks} | 跳过: {state.skippedTracks}
      </Text>
      <Text>匹配成功率: {matchRate.toFixed(1)}%</Text>
      <Text>ETA: {eta}</Text>
      <Text dimColor>
        当前: {state.currentTrack ?? "-"}
      </Text>
    </Box>
  );
}

export interface ImportProgressTuiController {
  update: (payload: ImportProgressPayload) => void;
  stop: () => void;
}

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
