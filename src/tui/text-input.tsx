import React, { useState } from "react";
import { Box, Text, render, useInput } from "ink";

interface TextInputProps {
  message: string;
  defaultValue?: string;
  placeholder?: string;
  validate?: (value: string) => boolean | string;
  onSubmit: (value: string) => void;
}

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
        <Text dimColor>
          Type your answer, Ctrl+U to clear, Enter to submit
        </Text>
      </Box>
    </Box>
  );
}

export async function promptTextInput(params: {
  message: string;
  defaultValue?: string;
  placeholder?: string;
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
