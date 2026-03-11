import React, { useCallback, useMemo, useState } from "react";
import { Box, Text, render, useInput } from "ink";
import type { Key } from "ink";

/**
 * 主菜单支持的动作类型。
 */
export type MainMenuAction =
  | "new_import"
  | "batch_import"
  | "resume"
  | "progress"
  | "failed"
  | "settings"
  | "exit"
  | "language";

/**
 * 主菜单的单项定义。
 */
interface MainMenuItem {
  /** 显示标签 */
  label: string;
  /** 对应的动作值 */
  value: MainMenuAction;
}

/**
 * `MainMenuView` 组件的 props。
 */
interface MainMenuProps {
  /** 菜单标题文本，显示在顶部。 */
  title: string;
  /** 菜单副标题或说明文字，显示在标题下方。 */
  subtitle: string;
  /** 可选的语言标签文本，显示在副标题下方。 */
  langLabel?: string;
  /** 菜单项数组，每项包含显示标签和对应动作值。 */
  items: MainMenuItem[];
  /** 用户选择菜单项后的回调函数，参数为选中的动作值。 */
  onSelect: (value: MainMenuAction) => void;
}

/**
 * 在终端显示主菜单的视图组件，支持上下选择与回车确认。
 * @param {MainMenuProps} props 组件属性
 * @returns {React.JSX.Element} 渲染的 Ink 组件
 */
export function MainMenuView({
  title,
  subtitle,
  langLabel,
  items,
  onSelect,
}: MainMenuProps): React.JSX.Element {
  const [index, setIndex] = useState(0);

  const safeItems = useMemo(() => (items.length > 0 ? items : []), [items]);
  /** 将光标上移到上一个可用项（循环）。 */
  const onUp = useCallback(() => {
    setIndex((prev) => (prev - 1 + safeItems.length) % safeItems.length);
  }, [safeItems.length]);

  /** 将光标下移到下一个可用项（循环）。 */
  const onDown = useCallback(() => {
    setIndex((prev) => (prev + 1) % safeItems.length);
  }, [safeItems.length]);

  /**
   * 处理用户输入的函数（供 `useInput` 使用）。
   * @param {string} input 当前输入字符
   * @param {Key} key 键位信息对象
   */
  const handleInput = (input: string, key: Key) => {
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
  };

  useInput(handleInput);

  return (
    <Box flexDirection="column" gap={1}>
      <Text color="cyanBright">{title}</Text>
      <Text dimColor>{subtitle}</Text>
      {langLabel ? <Text color="yellow">{langLabel}</Text> : null}
      <Text dimColor>────────────────────────────────────────</Text>
      <Box flexDirection="column">
        {safeItems.map((item, itemIndex) => {
          /**
           * 渲染单个菜单项。
           * @param {MainMenuItem} item 菜单项
           * @param {number} itemIndex 索引
           */
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

/**
 * 在终端展示主菜单并返回用户选择的动作。
 * @param {{title:string, subtitle:string, langLabel?:string, items: MainMenuItem[]}} params 菜单参数
 * @returns {Promise<MainMenuAction>} 用户选择的动作
 */
/**
 * 在终端展示主菜单并返回用户选择的动作。
 * @param {object} params 菜单参数对象
 * @param {string} params.title 菜单标题
 * @param {string} params.subtitle 副标题或说明文字
 * @param {string} [params.langLabel] 可选的语言标签文本
 * @param {MainMenuItem[]} params.items 菜单项数组
 * @returns {Promise<MainMenuAction>} 用户选择的动作
 */
export async function promptMainMenuTui(params: {
  /** 菜单标题 */
  title: string;
  /** 菜单副标题或说明文字 */
  subtitle: string;
  /** 可选的语言标签文本 */
  langLabel?: string;
  /** 菜单项数组 */
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
