import React, { useState, useMemo } from "react";
import { Box, Text, render, useInput } from "ink";
import { UI } from "../utils/constants.js";

/** 失败曲目数据结构定义 */
interface FailedTrack {
  /** 导入失败的 CSV 文件路径 */
  csv_path: string;
  /** 导入失败的时间戳 */
  created_at: string;
  /** 失败的曲目列表，每项包含曲目名称和艺术家 */
  failedTracks: {
    /** 曲目名称 */
    name: string;
    /** 艺术家名称 */
    artist: string;
  }[];
}

/** `ViewFailedProps` 组件的 props 定义 */
interface ViewFailedProps {
  /** 失败曲目数据数组，每项包含 CSV 路径、创建时间和失败曲目列表 */
  data: FailedTrack[];
  /** 用户返回主菜单的回调函数 */
  onBack: () => void;
}

/**
 * 失败曲目视图组件：在终端显示失败的曲目列表，支持分页浏览。
 * @param {ViewFailedProps} param0 组件 props 包含失败曲目数据和返回主菜单的回调
 * @param {FailedTrack[]} param0.data 失败曲目数据数组
 * @param {() => void} param0.onBack 用户返回主菜单的回调函数
 * @returns {React.JSX.Element} 渲染的失败曲目视图元素
 */
function ViewFailedView({ data, onBack }: ViewFailedProps): React.JSX.Element {
  const [page, setPage] = useState(0);
  const pageSize = UI.VIEW_FAILED_PAGE_SIZE;
  const totalPages = Math.ceil(data.length / pageSize);

  const paginatedData = useMemo(() => {
    const start = page * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, page]);

  useInput((input, key) => {
    if (input === "q" || key.escape) {
      onBack();
      return;
    }
    if ((input === "j" || key.downArrow) && page < totalPages - 1) {
      setPage(page + 1);
      return;
    }
    if ((input === "k" || key.upArrow) && page > 0) {
      setPage(page - 1);
      return;
    }
  });

  return (
    <Box flexDirection="column" gap={0}>
      <Text color="redBright">❌ 失败的歌曲</Text>
      <Text dimColor>────────────────────────────────────────</Text>

      {paginatedData.map((item) => (
        <Box key={item.csv_path} flexDirection="column" gap={0} marginTop={1}>
          <Text color="yellow">
            📁 {item.csv_path} ({item.created_at})
          </Text>
          <Text dimColor> {item.failedTracks.length} 首失败曲目:</Text>
          {item.failedTracks.slice(0, 5).map((track, idx) => (
            <Text key={idx} dimColor>
              {" "}
              {idx + 1}. {track.name} - {track.artist}
            </Text>
          ))}
          {item.failedTracks.length > 5 && (
            <Text dimColor> ... 还有 {item.failedTracks.length - 5} 首</Text>
          )}
        </Box>
      ))}

      <Text dimColor>────────────────────────────────────────</Text>
      <Text color="gray">
        第 {page + 1}/{totalPages} 页 | j/↓ 下一页 k/↑ 上一页 q/ESC 返回
      </Text>
    </Box>
  );
}

/**
 * 显示失败曲目的 TUI。
 * @param {FailedTrack[]} data 失败曲目数据数组
 * @returns {Promise<void>} Promise 在用户返回主菜单时解析
 */
export async function viewFailedTui(data: FailedTrack[]): Promise<void> {
  return new Promise<void>((resolve) => {
    const { unmount } = render(
      <ViewFailedView
        data={data}
        onBack={() => {
          unmount();
          setTimeout(() => resolve(), 100);
        }}
      />,
    );
  });
}
