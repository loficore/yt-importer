import React, { useCallback, useMemo, useState } from "react";
import { Box, Text, render, useInput } from "ink";

/**
 * 单个复选项的定义。
 * @template T 值的类型。
 * @property {string} name 显示名称。
 * @property {T} value 选项对应的值。
 * @property {boolean} [checked] 是否默认选中。
 * @property {boolean} [disabled] 是否禁用该项（不可选择）。
 */
export interface CheckboxChoice<T = string> {
  /** 显示名称，显示在选项列表中。 */
  name: string;
  /** 选项对应的值，提交时返回。 */
  value: T;
  /** 是否默认选中，默认为 false。 */
  checked?: boolean;
  /** 是否禁用该项，禁用项无法选择且显示为灰色。默认为 false。 */
  disabled?: boolean;
}

/**
 * `CheckboxView` 组件的 props。
 * @template T 选项值的类型。
 * @property {string} message 提示信息，显示在选项上方。
 * @property {CheckboxChoice<T>[]} choices 可用选项数组。
 * @property {(values: T[]) => void} onSubmit 提交时调用，参数为已选值数组。
 * @property {(values: T[]) => boolean | string} [validate] 可选的校验函数，返回 true 或错误消息。
 */
interface CheckboxProps<T = string> {
  /** 提示信息，显示在选项上方。 */
  message: string;
  /** 可用选项数组。 */
  choices: CheckboxChoice<T>[];
  /** 提交时调用，参数为已选值数组。 */
  onSubmit: (values: T[]) => void;
  /** 可选的校验函数，返回 true 或错误消息。 */
  validate?: (values: T[]) => boolean | string;
}

/**
 * 在终端渲染的交互式复选列表组件，基于 Ink。
 * 支持上下键、空格选择、全部切换和取反操作。
 * @template T 选项值的类型。
 * @param {CheckboxProps<T>} props 组件属性。
 * @returns {React.JSX.Element} 渲染的组件。
 */
export function CheckboxView<T = string>({
  message,
  choices,
  onSubmit,
  validate,
}: CheckboxProps<T>): React.JSX.Element {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<Set<T>>(
    new Set(choices.filter((c) => c.checked).map((c) => c.value)),
  );
  const [error, setError] = useState<string | null>(null);

  // 过滤掉禁用的选项
  const enabledChoices = useMemo(
    () => choices.filter((choice) => !choice.disabled),
    [choices],
  );

  /** 将光标上移到上一个可用选项（循环）。 */
  const onUp = useCallback(() => {
    setIndex(
      (prev) => (prev - 1 + enabledChoices.length) % enabledChoices.length,
    );
  }, [enabledChoices.length]);

  /** 将光标下移到下一个可用选项（循环）。 */
  const onDown = useCallback(() => {
    setIndex((prev) => (prev + 1) % enabledChoices.length);
  }, [enabledChoices.length]);

  /** 切换当前高亮项的选中状态。 */
  const toggleSelection = useCallback(() => {
    const choice = enabledChoices[index];
    if (!choice) return;

    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(choice.value)) {
        next.delete(choice.value);
      } else {
        next.add(choice.value);
      }
      return next;
    });
    setError(null);
  }, [enabledChoices, index]);

  /** 切换全部选中：若全部已选则清空，否则全选。 */
  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === enabledChoices.length) {
        return new Set();
      }
      return new Set(enabledChoices.map((c) => c.value));
    });
    setError(null);
  }, [enabledChoices]);

  /** 取反当前选中状态（仅针对可用项）。 */
  const invertSelection = useCallback(() => {
    setSelected((prev) => {
      const next = new Set<T>();
      for (const choice of enabledChoices) {
        if (!prev.has(choice.value)) {
          next.add(choice.value);
        }
      }
      return next;
    });
    setError(null);
  }, [enabledChoices]);

  useInput((input, key) => {
    if (key.upArrow || input === "k") {
      onUp();
      return;
    }

    if (key.downArrow || input === "j") {
      onDown();
      return;
    }

    if (input === " ") {
      toggleSelection();
      return;
    }

    if (input === "a") {
      toggleAll();
      return;
    }

    if (input === "i") {
      invertSelection();
      return;
    }

    if (key.return) {
      const values = Array.from(selected);
      if (validate) {
        const result = validate(values);
        if (result !== true) {
          setError(typeof result === "string" ? result : "Invalid selection");
          return;
        }
      }
      onSubmit(values);
    }
  });

  return (
    <Box flexDirection="column" gap={0}>
      <Text color="cyan">? {message}</Text>
      <Box flexDirection="column" marginTop={1}>
        {choices.map((choice, choiceIndex) => {
          const enabledIndex = enabledChoices.findIndex(
            (c) => c.value === choice.value,
          );
          const active = enabledIndex === index && !choice.disabled;
          const isSelected = selected.has(choice.value);

          if (choice.disabled) {
            return (
              <Text key={choiceIndex} dimColor>
                {choice.name}
              </Text>
            );
          }

          return (
            <Text key={choiceIndex} color={active ? "cyan" : undefined}>
              {active ? "❯" : " "}
              {isSelected ? "◉" : "◯"} {choice.name}
            </Text>
          );
        })}
      </Box>
      {error ? (
        <Box marginTop={1}>
          <Text color="red">✖ {error}</Text>
        </Box>
      ) : null}
      <Box marginTop={1}>
        <Text dimColor>
          Space to select, a to toggle all, i to invert, Enter to submit
        </Text>
      </Box>
    </Box>
  );
}

/**
 * 提示用户选择多个选项并返回选中的值数组。
 * @template T 选项值类型。
 * @param {object} params 提示参数
 * @param {string} params.message 提示信息，显示在选项上方。
 * @param {CheckboxChoice<T>[]} params.choices 可用选项数组。
 * @param {(values: T[]) => boolean | string} [params.validate] 可选的校验函数，返回 true 或错误消息。
 * @returns {Promise<T[]>} 解析为选中的值数组的 Promise
 */
export async function promptCheckbox<T = string>(params: {
  /** 提示信息，显示在选项上方。 */
  message: string;
  /** 可用选项数组。 */
  choices: CheckboxChoice<T>[];
  /** 可选的校验函数，返回 true 或错误消息。 */
  validate?: (values: T[]) => boolean | string;
}): Promise<T[]> {
  // 清空终端
  console.clear();

  return new Promise<T[]>((resolve) => {
    const { unmount } = render(
      <CheckboxView
        message={params.message}
        choices={params.choices}
        validate={params.validate}
        onSubmit={(values) => {
          unmount();
          setTimeout(() => resolve(values), 100);
        }}
      />,
    );
  });
}
