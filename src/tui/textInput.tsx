import React, { useState } from "react";
import { Box, Text, render, useInput } from "ink";

/** `TextInputView` 组件的 props 定义 */
interface TextInputProps {
  /** 提示信息 */
  message: string;
  /** 默认值 */
  defaultValue?: string;
  /** 占位符 */
  placeholder?: string;
  /** 验证函数 */
  validate?: (value: string) => boolean | string;
  /** 提交回调 */
  onSubmit: (value: string) => void;
}

/**
 * 文本输入视图组件：在终端显示一个可输入文本的视图，支持回车提交和输入验证。
 * @param {TextInputProps} param0 组件 props 包含提示信息、默认值、占位符、验证函数和提交回调
 * @param {string} param0.message 提示信息，显示在输入框上方
 * @param {string} [param0.defaultValue] 默认值，输入框初始显示的内容
 * @param {string} [param0.placeholder] 占位符，当输入框为空时显示
 * @param {(value: string) => boolean | string} [param0.validate] 验证函数，返回 true 表示有效，返回字符串表示错误信息
 * @param {(value: string) => void} param0.onSubmit 提交回调，参数为输入的值
 * @returns {React.JSX.Element} 渲染的文本输入视图元素
 */
function TextInputView({
  message,
  defaultValue = "",
  placeholder = "",
  validate,
  onSubmit,
}: TextInputProps): React.JSX.Element {
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);

  useInput((input, key) => {
    if (key.return) {
      if (validate) {
        const result = validate(value);
        if (result !== true) {
          setError(typeof result === "string" ? result : "Invalid input");
          return;
        }
      }
      onSubmit(value);
      return;
    }

    if (key.backspace || key.delete) {
      setValue((prev) => prev.slice(0, -1));
      setError(null);
      return;
    }

    if (key.ctrl && input === "u") {
      setValue("");
      setError(null);
      return;
    }

    if (!key.ctrl && !key.meta && input) {
      setValue((prev) => prev + input);
      setError(null);
    }
  });

  const displayValue = value || placeholder;
  const showPlaceholder = !value && placeholder;

  return (
    <Box flexDirection="column" gap={0}>
      <Text color="cyan">? {message}</Text>
      <Box marginTop={1}>
        <Text color={showPlaceholder ? "gray" : "white"}>
          › {displayValue}
          <Text inverse> </Text>
        </Text>
      </Box>
      {error ? (
        <Box marginTop={1}>
          <Text color="red">✖ {error}</Text>
        </Box>
      ) : null}
      <Box marginTop={1}>
        <Text dimColor>Type your answer, Ctrl+U to clear, Enter to submit</Text>
      </Box>
    </Box>
  );
}

/**
 * 显示文本输入的 TUI。
 * @param {object} params 参数对象
 * @param {string} params.message 提示信息
 * @param {string} [params.defaultValue] 默认值
 * @param {string} [params.placeholder] 占位符
 * @param {(value: string) => boolean | string} [params.validate] 验证函数
 * @returns {Promise<string>} 用户输入的值的 Promise
 */
export async function promptTextInput(params: {
  /** 提示信息 */
  message: string;
  /** 默认值 */
  defaultValue?: string;
  /** 占位符 */
  placeholder?: string;
  /** 验证函数 */
  validate?: (value: string) => boolean | string;
}): Promise<string> {
  // 清空终端
  console.clear();

  return new Promise<string>((resolve) => {
    const { unmount } = render(
      <TextInputView
        message={params.message}
        defaultValue={params.defaultValue}
        placeholder={params.placeholder}
        validate={params.validate}
        onSubmit={(value) => {
          unmount();
          setTimeout(() => resolve(value), 100);
        }}
      />,
    );
  });
}
