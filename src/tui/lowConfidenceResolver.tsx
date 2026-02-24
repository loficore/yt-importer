import React, { useState} from "react";
import { Box, Text, render, useInput } from "ink";
import type { MatchResultWithCandidates, YouTubeSong } from "../types/index.js";

/**
 * 将毫秒时长格式化为 M:SS 字符串表示。
 * @param {number|undefined} ms 毫秒数（可选）。
 * @returns {string} 格式化后的时长，如 `3:05`，若缺失返回 `--:--`。
 */
function formatDuration(ms: number | undefined): string {
  if (!ms) return "--:--";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
/**
 * Props for `LowConfidenceResolverView` component.
 */
interface LowConfidenceResolverViewProps {
  /** 需要处理的低置信度匹配列表，每项包含原始 track 和候选项数组。 */
  candidates: MatchResultWithCandidates[];
  /** 当前正在处理的 track 索引。 */
  currentIndex: number;
  /** 当前选中的候选项索引。 */
  selectedCandidateIndex: number;
  /** 选择候选项的回调，参数为选中候选项的索引。 */
  onSelect: (candidateIndex: number) => void;
  /** 跳过当前 track 的回调。 */
  onSkip: () => void;
  /** 批量导入所有低置信度匹配的回调。 */
  onResolveAll: () => void;
  /** 退出解析界面的回调。 */
  onQuit: () => void;
}

/**
 * 处理低置信度匹配的交互式界面组件。
 * 显示当前 track 及其候选项，允许选择、跳过或批量导入。
 * @param {LowConfidenceResolverViewProps} props 组件 props。
 * @returns {React.JSX.Element} 渲染的元素。
 */
function LowConfidenceResolverView({
  candidates,
  currentIndex,
  selectedCandidateIndex,
  onSelect,
  onSkip,
  onResolveAll,
  onQuit,
}: LowConfidenceResolverViewProps): React.JSX.Element {
  const [showConfirm, setShowConfirm] = useState(false);

  useInput((input, key) => {
    if (showConfirm) {
      if (input === "y" || input === "Y" || key.return) {
        setShowConfirm(false);
        onResolveAll();
        return;
      }
      if (input === "n" || input === "N" || key.escape) {
        setShowConfirm(false);
        return;
      }
      return;
    }

    if (input >= "1" && input <= "5") {
      const idx = parseInt(input, 10) - 1;
      const currentCandidates = candidates[currentIndex]?.candidates || [];
      if (idx < currentCandidates.length) {
        onSelect(idx);
      }
      return;
    }

    if (input === "s" || input === "S") {
      onSkip();
      return;
    }

    if (input === "a" || input === "A") {
      setShowConfirm(true);
      return;
    }

    if (input === "q" || input === "Q" || key.escape) {
      onQuit();
      return;
    }

    if (
      (input === "j" || key.downArrow) &&
      currentIndex < candidates.length - 1
    ) {
      return;
    }

    if ((input === "k" || key.upArrow) && currentIndex > 0) {
      return;
    }
  });

  if (candidates.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="yellow">
          ✓ All low confidence songs have been resolved!
        </Text>
      </Box>
    );
  }

  const current = candidates[currentIndex];
  if (!current) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="green">
          ✓ All low confidence songs have been resolved!
        </Text>
      </Box>
    );
  }

  const track = current.track;
  const trackCandidates = current.candidates || [];

  return (
    <Box flexDirection="column" padding={1}>
      {showConfirm ? (
        <Box flexDirection="column" gap={1}>
          <Text color="yellow" bold>
            ⚠️ Confirm Bulk Import
          </Text>
          <Text>
            Will automatically select the first candidate for all{" "}
            {candidates.length} low confidence songs.
          </Text>
          <Text bold>This action cannot be undone.</Text>
          <Text dimColor>────────────────────────────────────────</Text>
          <Text>
            Confirm? <Text color="green">[Y]</Text> /{" "}
            <Text color="red">[N]</Text>
          </Text>
        </Box>
      ) : (
        <>
          <Box flexDirection="column" gap={0}>
            <Text color="cyanBright">
              🎵 Low Confidence Resolution ({currentIndex + 1}/
              {candidates.length})
            </Text>
            <Text dimColor>
              {"────────────────────────────────────────────────"}
            </Text>
          </Box>

          <Box flexDirection="column" gap={0} marginTop={1}>
            <Text bold>Track:</Text>
            <Text> {track.name}</Text>
            <Text bold>Artist:</Text>
            <Text> {track.artist}</Text>
            {track.album && (
              <>
                <Text bold>Album:</Text>
                <Text> {track.album}</Text>
              </>
            )}
            <Text bold>Duration:</Text>
            <Text> {formatDuration(track.duration)}</Text>
          </Box>

          <Text dimColor>────────────────────────────────────────</Text>
          <Text bold>Candidates:</Text>

          {trackCandidates.length === 0 ? (
            <Box marginTop={1}>
              <Text color="red">
                No candidates available - press [s] to skip
              </Text>
            </Box>
          ) : (
            <Box flexDirection="column" gap={0} marginTop={1}>
              {trackCandidates.map((candidate, idx) => {
                const isSelected = idx === selectedCandidateIndex;
                return (
                  <Box
                    key={candidate.videoId}
                    flexDirection="column"
                    marginLeft={2}
                  >
                    <Text color={isSelected ? "green" : undefined}>
                      {isSelected ? "❯ " : "  "}
                      {idx + 1}. {candidate.name} - {candidate.artist}
                      {"  "}
                      {formatDuration(candidate.duration)}
                      {idx === 0 && " ★"}
                    </Text>
                    {candidate.album && isSelected && (
                      <Box marginLeft={4}>
                        <Text dimColor>Album: {candidate.album}</Text>
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>
          )}

          <Text dimColor>────────────────────────────────────────</Text>
          <Text>
            <Text color="cyan">[1-5]</Text> Select <Text color="cyan">[s]</Text>{" "}
            Skip <Text color="cyan">[a]</Text> Import All{" "}
            <Text color="cyan">[q]</Text> Quit
          </Text>
        </>
      )}
    </Box>
  );
}

/**
 *  在终端显示低置信度匹配的交互式解析界面，允许用户选择候选项、跳过或批量导入。
 * @param {MatchResultWithCandidates[]} candidates 需要处理的低置信度匹配列表
 * @param {object} callbacks 回调函数对象，包含处理每个候选项、批量处理和完成时的回调
 * @param {(index: number, selectedSong: YouTubeSong | null) => void} callbacks.onResolve 处理单个候选项的回调，参数为当前索引和选中的歌曲（或 null 表示跳过）
 * @param {() => void} callbacks.onResolveAll 处理所有候选项的回调
 * @param {() => void} callbacks.onComplete 完成处理后的回调
 * @returns {Promise<void>} 一个 Promise，在所有低置信度匹配处理完成后解析
 */
export async function resolveLowConfidenceTui(
  candidates: MatchResultWithCandidates[],
  callbacks: {
    /**
     * @param {number} index 当前处理的候选项索引
     * @param {YouTubeSong | null} selectedSong 选中的歌曲对象或 null（表示跳过）
     */
    onResolve: (index: number, selectedSong: YouTubeSong | null) => void;
    /**
     * 匹配所有的低置信度的歌曲为候选列表中的第一项，通常在用户选择批量导入时调用。
     */
    onResolveAll: () => void;
    /**
     * 结束匹配低置信度歌曲
     */
    onComplete: () => void;
  },
): Promise<void> {
  let currentIndex = 0;
  let selectedCandidateIndex = 0;

  /**
   * 更新界面显示当前候选项，并设置新的回调函数以处理用户选择。
   */
  const update = () => {
    unmount();
    setTimeout(() => {
      const { unmount: newUnmount } = render(
        <LowConfidenceResolverView
          candidates={candidates}
          currentIndex={currentIndex}
          selectedCandidateIndex={selectedCandidateIndex}
          onSelect={(idx) => {
            const current = candidates[currentIndex];
            if (current && current.candidates[idx]) {
              callbacks.onResolve(currentIndex, current.candidates[idx]);
              currentIndex = Math.min(currentIndex, candidates.length - 1);
              selectedCandidateIndex = 0;
              if (currentIndex >= candidates.length) {
                callbacks.onComplete();
              } else {
                update();
              }
            }
          }}
          onSkip={() => {
            callbacks.onResolve(currentIndex, null);
            currentIndex = Math.min(currentIndex, candidates.length - 1);
            selectedCandidateIndex = 0;
            if (currentIndex >= candidates.length) {
              callbacks.onComplete();
            } else {
              update();
            }
          }}
          onResolveAll={() => {
            callbacks.onResolveAll();
            callbacks.onComplete();
          }}
          onQuit={() => {
            callbacks.onComplete();
          }}
        />,
      );
      unmount = newUnmount;
    }, 100);
  };

  /**
   * 初始渲染界面并获取卸载函数，以便后续更新界面时调用。用户的选择会通过回调函数传递给外部逻辑，处理完成后解析 Promise。
   * @returns {Promise<void>} 在所有低置信度匹配处理完成后解析的 Promise
   */
  let unmount: (error?: number | Error | null) => void = () => undefined;

  console.clear();

  return new Promise<void>((resolve) => {
    const { unmount: initialUnmount } = render(
      <LowConfidenceResolverView
        candidates={candidates}
        currentIndex={currentIndex}
        selectedCandidateIndex={selectedCandidateIndex}
        onSelect={(idx) => {
          const current = candidates[currentIndex];
          if (current && current.candidates[idx]) {
            callbacks.onResolve(currentIndex, current.candidates[idx]);
            currentIndex = Math.min(currentIndex, candidates.length - 1);
            selectedCandidateIndex = 0;
            if (currentIndex >= candidates.length) {
              initialUnmount();
              setTimeout(() => resolve(), 100);
            } else {
              update();
            }
          }
        }}
        onSkip={() => {
          callbacks.onResolve(currentIndex, null);
          currentIndex = Math.min(currentIndex, candidates.length - 1);
          selectedCandidateIndex = 0;
          if (currentIndex >= candidates.length) {
            initialUnmount();
            setTimeout(() => resolve(), 100);
          } else {
            update();
          }
        }}
        onResolveAll={() => {
          callbacks.onResolveAll();
          initialUnmount();
          setTimeout(() => resolve(), 100);
        }}
        onQuit={() => {
          initialUnmount();
          setTimeout(() => resolve(), 100);
        }}
      />,
    );
    unmount = initialUnmount;
  });
}
