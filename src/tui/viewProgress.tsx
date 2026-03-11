import React, { useState, useMemo } from "react";
import { Box, Text, render, useInput } from "ink";
import { UI } from "../utils/constants.js";

/** 页面数据结构定义 */
export interface PageData {
  /** CSV 文件路径 */
  csv_path: string;
  /** 创建时间 */
  created_at: string;
  /** 状态 */
  status: string;
  /** 总曲目数 */
  total_tracks: number;
  /** 已处理曲目数 */
  processed_tracks: number;
  /** 已匹配曲目数 */
  matched_tracks: number;
  /** 失败曲目数 */
  failed_tracks: number;
  /** 已跳过曲目数 */
  skipped_tracks: number;
}

/** `ViewProgressProps` 组件的 props 定义 */
interface ViewProgressProps {
  /** 页面数据数组，每项包含 CSV 路径、创建时间、状态和曲目统计信息 */
  data: PageData[];
  /** 用户返回主菜单的回调函数 */
  onBack: () => void;
}

/**
 * 显示导入进度的视图组件。
 * @param {ViewProgressProps} param0 组件 props 包含页面数据和返回主菜单的回调
 * @param {PageData[]} param0.data 页面数据数组
 * @param {() => void} param0.onBack 用户返回主菜单的回调函数
 * @returns {React.JSX.Element} 渲染的导入进度视图元素
 */
export function ViewProgressView({
  data,
  onBack,
}: ViewProgressProps): React.JSX.Element {
  const [page, setPage] = useState(0);
  const pageSize = UI.VIEW_PROGRESS_PAGE_SIZE;
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
      <Text color="cyanBright">📊 导入进度</Text>
      <Text dimColor>────────────────────────────────────────</Text>

      {paginatedData.map((row) => {
        const percent =
          row.total_tracks > 0
            ? Math.round((row.processed_tracks / row.total_tracks) * 100)
            : 0;
        return (
          <Box key={row.csv_path} flexDirection="column" gap={0} marginTop={1}>
            <Text color="yellow">📁 {row.csv_path}</Text>
            <Text dimColor>
              {" "}
              {row.created_at} | {row.status}
            </Text>
            <Text dimColor>
              {" "}
              总: {row.total_tracks} | 已处理: {row.processed_tracks} ({percent}
              %)
            </Text>
            <Text dimColor>
              {" "}
              已匹配: {row.matched_tracks} | 失败: {row.failed_tracks} | 已跳过:{" "}
              {row.skipped_tracks}
            </Text>
          </Box>
        );
      })}

      <Text dimColor>────────────────────────────────────────</Text>
      <Text color="gray">
        第 {page + 1}/{totalPages} 页 | j/↓ 下一页 k/↑ 上一页 q/ESC 返回
      </Text>
    </Box>
  );
}

/**
 * 显示导入进度的 TUI。
 * @param {PageData[]} data 页面数据数组
 * @returns {Promise<void>} Promise 在用户返回主菜单时解析
 */
export async function viewProgressTui(data: PageData[]): Promise<void> {
  return new Promise<void>((resolve) => {
    const { unmount } = render(
      <ViewProgressView
        data={data}
        onBack={() => {
          unmount();
          setTimeout(() => resolve(), 100);
        }}
      />,
    );
  });
}
