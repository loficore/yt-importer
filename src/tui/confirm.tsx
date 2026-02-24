import React, { useState } from "react";
import { Box, Text, render, useInput } from "ink";

/** `ConfirmView` 组件的 props。 */
interface ConfirmProps {
  /** 提示信息，显示在选项上方。 */
  message: string;
  /** 默认值，true 表示默认选中 Yes，false 表示默认选中 No。默认为 false。 */
  defaultValue?: boolean;
  /**
   * 提交时调用，参数为用户选择的值，true 表示选择 Yes，false 表示选择 No。
   * @param {boolean} value 用户选择的值，true 表示选择 Yes，false 表示选择 No。
   * @returns 
   */
  onSubmit: (value: boolean) => void;
}

/**
 * 在终端渲染的交互式确认提示组件，基于 Ink。
 * @param {ConfirmProps} param0  组件属性对象，包含提示信息、默认值和提交回调函数。
 * @returns {React.JSX.Element} 渲染的组件。
 */
function ConfirmView({
  message,
  defaultValue = false,
  onSubmit,
}: ConfirmProps): React.JSX.Element {
  const [value, setValue] = useState(defaultValue);

  useInput((input, key) => {
    if (key.return) {
      onSubmit(value);
      return;
    }

    if (key.leftArrow || key.rightArrow) {
      setValue((prev) => !prev);
      return;
    }

    const lower = input.toLowerCase();
    if (lower === "y") {
      setValue(true);
    } else if (lower === "n") {
      setValue(false);
    }
  });

  return (
    <Box flexDirection="column" gap={0}>
      <Text color="cyan">? {message}</Text>
      <Box marginTop={1} gap={2}>
        <Text color={value ? "cyan" : "gray"}>{value ? "❯" : " "} Yes</Text>
        <Text color={!value ? "cyan" : "gray"}>{!value ? "❯" : " "} No</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>y/n or ←/→ to toggle, Enter to confirm</Text>
      </Box>
    </Box>
  );
}

/**
 * 在终端显示确认提示并返回用户选择结果。
 * @param {object} params 提示参数
 * @param {string} params.message 提示信息，显示在选项上方。
 * @param {boolean} [params.defaultValue] 默认值，true 表示默认选中 Yes，false 表示默认选中 No。
 * @returns {Promise<boolean>} 解析为用户选择值的 Promise，true 表示选择 Yes，false 表示选择 No。
 */
export async function promptConfirm(params: {
  /** 提示信息，显示在选项上方。 */
  message: string;
  /** 默认值，true 表示默认选中 Yes，false 表示默认选中 No。默认为 false。 */
  defaultValue?: boolean;
}): Promise<boolean> {
  // 清空终端
  console.clear();

  return new Promise<boolean>((resolve) => {
    const { unmount } = render(
      <ConfirmView
        message={params.message}
        defaultValue={params.defaultValue}
        onSubmit={(value) => {
          unmount();
          setTimeout(() => resolve(value), 100);
        }}
      />,
    );
  });
}
