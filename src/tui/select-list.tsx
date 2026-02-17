import React, { useCallback, useMemo, useState } from "react";
import { Box, Text, render, useInput } from "ink";

export interface SelectListChoice<T = string> {
  name: string;
  value: T;
  disabled?: boolean;
  description?: string;
}

interface SelectListProps<T = string> {
  message: string;
  choices: SelectListChoice<T>[];
  onSelect: (value: T) => void;
  loop?: boolean;
}

function SelectListView<T = string>({
  message,
  choices,
  onSelect,
  loop = false,
}: SelectListProps<T>): React.JSX.Element {
  const [index, setIndex] = useState(0);

  // 过滤掉禁用的选项
  const enabledChoices = useMemo(
    () => choices.filter((choice) => !choice.disabled),
    [choices],
  );

  const onUp = useCallback(() => {
    setIndex((prev) => {
      if (loop) {
        return (prev - 1 + enabledChoices.length) % enabledChoices.length;
      }
      return Math.max(0, prev - 1);
    });
  }, [enabledChoices.length, loop]);

  const onDown = useCallback(() => {
    setIndex((prev) => {
      if (loop) {
        return (prev + 1) % enabledChoices.length;
      }
      return Math.min(enabledChoices.length - 1, prev + 1);
    });
  }, [enabledChoices.length, loop]);

  useInput((input, key) => {
    if (key.upArrow || input === "k") {
      onUp();
      return;
    }

    if (key.downArrow || input === "j") {
      onDown();
      return;
    }

    if (key.return) {
      const choice = enabledChoices[index];
      if (choice) {
        onSelect(choice.value);
      }
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

          if (choice.disabled) {
            return (
              <Text key={choiceIndex} dimColor>
                  {choice.name}
              </Text>
            );
          }

          return (
            <Box key={choiceIndex} flexDirection="column">
              <Text color={active ? "cyan" : undefined}>
                {active ? "❯ " : "  "}
                {choice.name}
              </Text>
              {choice.description && active ? (
                <Box marginLeft={2}>
                  <Text dimColor>{choice.description}</Text>
                </Box>
              ) : null}
            </Box>
          );
        })}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          ↑/↓ or j/k to navigate, Enter to select
        </Text>
      </Box>
    </Box>
  );
}

export async function promptSelectList<T = string>(params: {
  message: string;
  choices: SelectListChoice<T>[];
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
