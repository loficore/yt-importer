import React, { useState } from "react";
import { Box, Text, render, useInput } from "ink";

interface ConfirmProps {
  message: string;
  defaultValue?: boolean;
  onSubmit: (value: boolean) => void;
}

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
        <Text color={value ? "cyan" : "gray"}>
          {value ? "❯" : " "} Yes
        </Text>
        <Text color={!value ? "cyan" : "gray"}>
          {!value ? "❯" : " "} No
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          y/n or ←/→ to toggle, Enter to confirm
        </Text>
      </Box>
    </Box>
  );
}

export async function promptConfirm(params: {
  message: string;
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
