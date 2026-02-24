import React, { useState } from "react";
import { Box, Text, render, useInput } from "ink";

/** 错误操作类型 */
export type ErrorAction = "retry" | "continue" | "exit";

/** 错误对话框属性 */
interface ErrorDialogProps {
  /** 错误信息 */
  errorMessage: string;
  /** 统计信息 */
  stats: {
    /** 已处理的总数 */
    total: number;
    /** 已匹配的数量 */
    matched: number;
    /** 已失败的数量 */
    failed: number;
  };
  /**
   * 
   * @param {ErrorAction} action - 用户选择的操作类型
   */
  onAction: (action: ErrorAction) => void;
}

/**
 * 错误对话框组件
 * @param {ErrorDialogProps} param0 - 错误对话框属性
 * @returns {React.JSX.Element} - 错误对话框组件
 */
function ErrorDialogView({
  errorMessage,
  stats,
  onAction,
}: ErrorDialogProps): React.JSX.Element {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const options = [
    { label: "重试 (Retry)", value: "retry" as ErrorAction },
    { label: "继续 (Continue)", value: "continue" as ErrorAction },
    { label: "退出 (Exit)", value: "exit" as ErrorAction },
  ];

  useInput((input, key) => {
    if (key.upArrow || input === "k") {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
      return;
    }
    if (key.downArrow || input === "j") {
      setSelectedIndex((prev) => Math.min(options.length - 1, prev + 1));
      return;
    }
    if (key.return) {
      onAction(options[selectedIndex]!.value);
      return;
    }
  });

  return (
    <Box
      flexDirection="column"
      gap={1}
      padding={1}
      borderStyle="round"
      borderColor="red"
    >
      <Text color="red" bold>
        ❌ 导入错误
      </Text>
      <Text dimColor>{"─".repeat(50)}</Text>

      <Box flexDirection="column" gap={0}>
        <Text bold>错误信息:</Text>
        <Text color="red" wrap="truncate">
          {errorMessage.length > 60
            ? `${errorMessage.slice(0, 60)}...`
            : errorMessage}
        </Text>
      </Box>

      <Text dimColor>{"─".repeat(50)}</Text>

      <Box flexDirection="column" gap={0}>
        <Text bold>当前进度:</Text>
        <Text> - 已处理: {stats.total}</Text>
        <Text> - 已匹配: {stats.matched}</Text>
        <Text> - 已失败: {stats.failed}</Text>
      </Box>

      <Text dimColor>{"─".repeat(50)}</Text>

      <Text bold>请选择操作:</Text>
      {options.map((option, index) => (
        <Text
          key={option.value}
          color={index === selectedIndex ? "cyan" : undefined}
        >
          {index === selectedIndex ? "❯ " : "  "}
          {option.label}
        </Text>
      ))}

      <Text dimColor>{"─".repeat(50)}</Text>
      <Text dimColor>↑/↓ or j/k 选择，Enter 确认</Text>
    </Box>
  );
}

/**
 * 弹出错误对话框并等待用户选择操作
 * @param {object} params - 参数对象
 * @param {string} params.errorMessage - 错误信息
 * @param {object} params.stats - 统计信息
 * @param {number} params.stats.total - 已处理的总数
 * @param {number} params.stats.matched - 已匹配的数量
 * @param {number} params.stats.failed - 已失败的数量
 * @returns {Promise<ErrorAction>} 返回用户选择的操作类型
 */
export async function promptErrorDialog(params: {
  /** 错误信息 */
  errorMessage: string;
  /** 统计信息 */
  stats: {
    /** 已处理的总数 */
    total: number;
    /** 已匹配的数量 */
    matched: number;
    /** 已失败的数量 */
    failed: number;
  };
}): Promise<ErrorAction> {
  console.clear();

  return new Promise<ErrorAction>((resolve) => {
    const { unmount } = render(
      <ErrorDialogView
        errorMessage={params.errorMessage}
        stats={params.stats}
        onAction={(action) => {
          unmount();
          setTimeout(() => resolve(action), 100);
        }}
      />,
    );
  });
}
