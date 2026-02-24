import React from "react";
import { Box, Text, render, useInput } from "ink";

/**
 * `PressKeyView` 组件的 props 定义。
 */
interface PressKeyProps {
  /** 可选的提示消息，显示在按键提示上方。默认为 "按任意键继续..."。 */
  message?: string;
  /** 用户按下任意键时触发的回调函数。 */
  onPress: () => void;
}

/**
 * `PressKeyView` 组件：显示一个提示用户按任意键继续的界面，并在用户按下任意键后触发 `onPress` 回调。
 * @param {PressKeyProps} param0  组件 props 包含可选的提示消息和按键回调函数
 * @returns {React.JSX.Element} 渲染的按键提示元素
 */
function PressKeyView({ message, onPress }: PressKeyProps): React.JSX.Element {
  useInput(() => {
    onPress();
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Text dimColor>────────────────────────────────────────</Text>
      <Text color="cyan">{message || "按任意键继续..."}</Text>
    </Box>
  );
}

/**
 * 在终端显示一个提示用户按任意键继续的界面，并在用户按下任意键后解析。
 * @param {string} [message] - 可选的提示消息，默认 "按任意键继续..."
 * @returns {Promise<void>} 在用户按下任意键后解析
 */
export async function promptPressKey(message?: string): Promise<void> {
  return new Promise<void>((resolve) => {
    const { unmount } = render(
      <PressKeyView
        message={message || "按任意键继续..."}
        onPress={() => {
          unmount();
          setTimeout(() => resolve(), 100);
        }}
      />,
    );
  });
}
