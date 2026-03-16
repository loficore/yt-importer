import React, { useCallback, useState } from "react";
import type {JSX} from "react";
import { Box, Text, render, useInput } from "ink";

/**
 *
 */
interface FailedTrackInfo {
  /**
   *
   */
  name: string;
  /**
   *
   */
  artist: string;
  /**
   *
   */
  album?: string;
  /**
   *
   */
  duration?: number;
}

/**
 *
 */
interface BatchRetryProps {
  /**
   *
   */
  tracks: FailedTrackInfo[];
  /**
   *
   */
  onSubmit: (tracks: FailedTrackInfo[]) => void;
}

/**
 * 批量重试界面组件，允许用户选择要重试的曲目
 * @param {object} props - 组件属性
 * @param {FailedTrackInfo[]} props.tracks - 具有失败曲目的列表
 * @param {(tracks: FailedTrackInfo[]) => void} props.onSubmit - 提交选择的回调函数，参数为选中的曲目列表
 * @returns {JSX.Element} - 渲染的组件元素
 */
export function BatchRetryView({
  tracks,
  onSubmit,
}: BatchRetryProps): React.JSX.Element {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(
    new Set(tracks.map((_, i) => i)),
  );

  const onUp = useCallback(() => {
    setIndex((prev) => (prev - 1 + tracks.length) % tracks.length);
  }, [tracks.length]);

  const onDown = useCallback(() => {
    setIndex((prev) => (prev + 1) % tracks.length);
  }, [tracks.length]);

  const toggleSelection = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, [index]);

  const selectAll = useCallback(() => {
    setSelected(new Set(tracks.map((_, i) => i)));
  }, [tracks.length]);

  const deselectAll = useCallback(() => {
    setSelected(new Set());
  }, []);

  const handleSubmit = useCallback(() => {
    const selectedTracks = Array.from(selected)
      .map((i) => tracks[i])
      .filter((t): t is FailedTrackInfo => t !== undefined);
    onSubmit(selectedTracks);
  }, [selected, tracks, onSubmit]);

  useInput((input, key) => {
    if (input === "q" || key.escape) {
      onSubmit([]);
      return;
    }

    if (input === "j" || key.downArrow) {
      onUp();
      return;
    }

    if (input === "k" || key.upArrow) {
      onDown();
      return;
    }

    if (input === " ") {
      toggleSelection();
      return;
    }

    if (input === "a") {
      selectAll();
      return;
    }

    if (input === "n") {
      deselectAll();
      return;
    }

    if (input === "\r") {
      handleSubmit();
      return;
    }
  });

  return (
    <Box flexDirection="column" gap={0}>
      <Text color="cyan">
        🔁 Select tracks to retry ({selected.size}/{tracks.length})
      </Text>
      <Text dimColor>────────────────────────────────────────</Text>

      {tracks.map((track, i) => (
        <Box key={i} gap={1}>
          <Text color={selected.has(i) ? "green" : "gray"}>
            {selected.has(i) ? "[✓]" : "[ ]"}
          </Text>
          <Text bold={i === index} dimColor={i !== index}>
            {i + 1}. {track.name}
          </Text>
          <Text dimColor>- {track.artist}</Text>
        </Box>
      ))}

      <Text dimColor>────────────────────────────────────────</Text>
      <Text color="gray">
        Space: toggle | a: select all | n: deselect all | Enter: submit | q/ESC:
        cancel
      </Text>
    </Box>
  );
}

/**
 * 显示批量重试界面，允许用户选择要重试的曲目，并返回选中的曲目信息列表
 * @param {FailedTrackInfo[]} tracks - 具有失败曲目的列表
 * @returns {Promise<FailedTrackInfo[]>} - 返回选中的曲目信息列表
 */
export async function batchRetryTui(
  tracks: FailedTrackInfo[],
): Promise<FailedTrackInfo[]> {
  return new Promise<FailedTrackInfo[]>((resolve) => {
    const { unmount } = render(
      <BatchRetryView
        tracks={tracks}
        onSubmit={(selected) => {
          unmount();
          setTimeout(() => resolve(selected), 100);
        }}
      />,
    );
  });
}
