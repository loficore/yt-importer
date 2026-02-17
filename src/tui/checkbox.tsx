import React, { useCallback, useMemo, useState } from "react";
import { Box, Text, render, useInput } from "ink";

export interface CheckboxChoice<T = string> {
  name: string;
  value: T;
  checked?: boolean;
  disabled?: boolean;
}

interface CheckboxProps<T = string> {
  message: string;
  choices: CheckboxChoice<T>[];
  onSubmit: (values: T[]) => void;
  validate?: (values: T[]) => boolean | string;
}

function CheckboxView<T = string>({
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

  const onUp = useCallback(() => {
    setIndex((prev) => (prev - 1 + enabledChoices.length) % enabledChoices.length);
  }, [enabledChoices.length]);

  const onDown = useCallback(() => {
    setIndex((prev) => (prev + 1) % enabledChoices.length);
  }, [enabledChoices.length]);

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

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === enabledChoices.length) {
        return new Set();
      }
      return new Set(enabledChoices.map((c) => c.value));
    });
    setError(null);
  }, [enabledChoices]);

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

export async function promptCheckbox<T = string>(params: {
  message: string;
  choices: CheckboxChoice<T>[];
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
