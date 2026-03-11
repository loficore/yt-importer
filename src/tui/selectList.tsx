import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Text, render, useInput } from "ink";
import {
  getEnabledChoices,
  getInputAction,
  getRenderableChoices,
  getSelectedChoice,
  moveSelection,
  type SelectListChoice,
} from "./selectListLogic.js";

/** 选择列表组件的 props 定义 */
interface SelectListProps<T = string> {
  /** 提示信息 */
  message: string;
  /** 选项列表 */
  choices: SelectListChoice<T>[];
  /** 用户选择后的回调函数，参数为选中的值 */
  onSelect: (value: T) => void;
  /** 是否循环导航，默认为 false */
  loop?: boolean;
}

/**
 * 选择列表视图组件：在终端显示一个可导航的选项列表，支持上下键和回车选择。
 * @param {SelectListProps} param0 组件 props 包含提示信息、选项列表、选择回调和循环导航设置
 * @param {string} param0.message 提示信息，显示在选项上方
 * @param {SelectListChoice[]} param0.choices 选项列表，每项包含名称、值、禁用状态和描述
 * @param {(value: unknown) => void} param0.onSelect 用户选择后的回调函数，参数为选中的值
 * @param {boolean} [param0.loop] 是否启用循环导航，默认为 false
 * @returns {React.JSX.Element} 渲染的选择列表视图元素
 */
export function SelectListView<T = string>({
  message,
  choices,
  onSelect,
  loop = false,
}: SelectListProps<T>): React.JSX.Element {
  const enabledChoices = useMemo(() => getEnabledChoices(choices), [choices]);
  const [index, setIndex] = useState(enabledChoices.length > 0 ? 0 : -1);

  useEffect(() => {
    setIndex((prev) => {
      if (enabledChoices.length === 0) {
        return -1;
      }

      return Math.min(Math.max(prev, 0), enabledChoices.length - 1);
    });
  }, [enabledChoices.length]);

  const renderableChoices = useMemo(
    () => getRenderableChoices(choices, index),
    [choices, index],
  );

  const onUp = useCallback(() => {
    setIndex((prev) => moveSelection(prev, enabledChoices.length, "up", loop));
  }, [enabledChoices.length, loop]);

  const onDown = useCallback(() => {
    setIndex((prev) =>
      moveSelection(prev, enabledChoices.length, "down", loop),
    );
  }, [enabledChoices.length, loop]);

  useInput((input, key) => {
    const action = getInputAction(input, key);

    if (action === "up") {
      onUp();
      return;
    }

    if (action === "down") {
      onDown();
      return;
    }

    if (action === "select") {
      const choice = getSelectedChoice(choices, index);
      if (choice) {
        onSelect(choice.value);
      }
    }
  });

  return (
    <Box flexDirection="column" gap={0}>
      <Text color="cyan">? {message}</Text>
      <Box flexDirection="column" marginTop={1}>
        {renderableChoices.map((choice, choiceIndex) => {
          if (choice.disabled) {
            return (
              <Text key={choiceIndex} dimColor>
                {choice.name}
              </Text>
            );
          }

          return (
            <Box key={choiceIndex} flexDirection="column">
              <Text color={choice.active ? "cyan" : undefined}>
                {choice.active ? "❯ " : "  "}
                {choice.name}
              </Text>
              {choice.description && choice.active ? (
                <Box marginLeft={2}>
                  <Text dimColor>{choice.description}</Text>
                </Box>
              ) : null}
            </Box>
          );
        })}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>↑/↓ or j/k to navigate, Enter to select</Text>
      </Box>
    </Box>
  );
}

/**
 * 显示选择列表的 TUI。
 * @template T 选择列表中选项值的类型，默认为 string
 * @param {object} params 参数对象
 * @param {string} params.message 提示信息
 * @param {SelectListChoice[]} params.choices 选项列表
 * @param {boolean} [params.loop] 是否启用循环导航，默认为 false
 * @returns {Promise<T>} 用户选择的值的 Promise
 */
export async function promptSelectList<T = string>(params: {
  /** 提示信息 */
  message: string;
  /** 选项列表 */
  choices: SelectListChoice<T>[];
  /** 是否启用循环导航，默认为 false */
  loop?: boolean;
}): Promise<T> {
  // 清空终端
  console.clear();

  return new Promise<T>((resolve) => {
    const { unmount } = render(
      <SelectListView
        message={params.message}
        choices={params.choices}
        loop={params.loop}
        onSelect={(value) => {
          unmount();
          setTimeout(() => resolve(value), 100);
        }}
      />,
    );
  });
}
