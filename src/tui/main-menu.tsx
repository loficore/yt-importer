import React, { useCallback, useMemo, useState } from "react";
import { Box, Text, render, useInput } from "ink";

export type MainMenuAction =
  | "new_import"
  | "batch_import"
  | "resume"
  | "progress"
  | "failed"
  | "settings"
  | "exit"
  | "language";

interface MainMenuItem {
  label: string;
  value: MainMenuAction;
}

interface MainMenuProps {
  title: string;
  subtitle: string;
  langLabel?: string;
  items: MainMenuItem[];
  onSelect: (value: MainMenuAction) => void;
}

function MainMenuView({
  title,
  subtitle,
  langLabel,
  items,
  onSelect,
}: MainMenuProps): React.JSX.Element {
  const [index, setIndex] = useState(0);

  const safeItems = useMemo(() => (items.length > 0 ? items : []), [items]);

  const onUp = useCallback(() => {
    setIndex((prev) => (prev - 1 + safeItems.length) % safeItems.length);
  }, [safeItems.length]);

  const onDown = useCallback(() => {
    setIndex((prev) => (prev + 1) % safeItems.length);
  }, [safeItems.length]);

  useInput((input, key) => {
    if (safeItems.length === 0) return;

    if (key.upArrow || input === "k") {
      onUp();
      return;
    }

    if (key.downArrow || input === "j") {
      onDown();
      return;
    }

    if (key.return) {
      const item = safeItems[index];
      if (item) {
        onSelect(item.value);
      }
    }
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Text color="cyanBright">{title}</Text>
      <Text dimColor>{subtitle}</Text>
      {langLabel ? <Text color="yellow">{langLabel}</Text> : null}
      <Text dimColor>────────────────────────────────────────</Text>
      <Box flexDirection="column">
        {safeItems.map((item, itemIndex) => {
          const active = itemIndex === index;
          return (
            <Text key={item.value} color={active ? "greenBright" : "white"}>
              {active ? "❯ " : "  "}
              {item.label}
            </Text>
          );
        })}
      </Box>
      <Text dimColor>↑/↓ 或 j/k 选择，Enter 确认</Text>
    </Box>
  );
}

export async function promptMainMenuTui(params: {
  title: string;
  subtitle: string;
  langLabel?: string;
  items: MainMenuItem[];
}): Promise<MainMenuAction> {
  // 清空终端，确保每次显示菜单时屏幕干净
  console.clear();
  
  return new Promise<MainMenuAction>((resolve) => {
    const { unmount } = render(
      <MainMenuView
        title={params.title}
        subtitle={params.subtitle}
        langLabel={params.langLabel}
        items={params.items}
        onSelect={(value) => {
          unmount();
          // 增加延迟以确保终端状态完全恢复（从 Ink 切换到 inquirer）
          setTimeout(() => resolve(value), 300);
        }}
      />,
    );
  });
}
