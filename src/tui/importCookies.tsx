import React from "react";
import { Box, Text, render, useInput } from "ink";
import { existsSync } from "node:fs";

/**
 * 导入 Cookies 操作的结果。
 * @typedef {object} ImportCookiesResult
 * @property {boolean} success 操作是否成功。
 * @property {string} [path] 成功时的文件路径。
 * @property {string} message 结果信息，供 UI 显示。
 */
interface ImportCookiesResult {
  /** 操作是否成功。 */
  success: boolean;
  /** 成功时的文件路径。 */
  path?: string;
  /** 结果信息，供 UI 显示。 */
  message: string;
}

/**
 * `ImportCookiesView` 组件的 props。
 * @typedef {object} ImportCookiesProps
 * @property {string | undefined} currentCookiePath 当前 cookies 文件路径或 undefined。
 * @property {boolean} autoWatchEnabled 是否启用了自动监控。
 * @property {() => Promise<ImportCookiesResult>} onImport 导入操作回调，返回结果。
 * @property {() => Promise<string | null>} onSelectFile 文件选择回调，返回选中路径或 null。
 * @property {() => Promise<void>} onToggleAutoWatch 切换自动监控的回调。
 * @property {() => void} onBack 返回主菜单的回调。
 */
interface ImportCookiesProps {
  /** 当前 cookies 文件路径或 undefined。 */
  currentCookiePath: string | undefined;
  /** 是否启用了自动监控。 */
  autoWatchEnabled: boolean;
  /** 导入操作回调，返回结果。 */
  onImport: () => Promise<ImportCookiesResult>;
  /** 文件选择回调，返回选中路径或 null。 */
  onSelectFile: () => Promise<string | null>;
  /** 切换自动监控的回调。 */
  onToggleAutoWatch: () => Promise<void>;
  /** 返回主菜单的回调。 */
  onBack: () => void;
}

/**
 * 导入 Cookies 的 TUI 视图组件。
 * 提供导入当前文件、选择新文件、切换自动监控和返回的操作。
 * 使用 `useInput` 监听用户按键并通过传入的回调执行操作。
 * @param {ImportCookiesProps} props 组件 props。
 * @returns {React.JSX.Element} 渲染的 Ink 组件。
 */
function ImportCookiesView({
  currentCookiePath,
  autoWatchEnabled,
  onImport,
  onSelectFile,
  onToggleAutoWatch,
  onBack,
}: ImportCookiesProps): React.JSX.Element {
  const [importing, setImporting] = React.useState(false);
  const [result, setResult] = React.useState<ImportCookiesResult | null>(null);

  useInput((input, key) => {
    // 使用内部异步 IIFE 避免向 useInput 返回 Promise（修复 no-misused-promises）
    void (async () => {
      if (importing) return;

      if (input === "1") {
        setImporting(true);
        setResult(null);
        const res = await onImport();
        setResult(res);
        setImporting(false);
        return;
      }

      if (input === "2") {
        const path = await onSelectFile();
        if (path) {
          setImporting(true);
          setResult(null);
          const res = await onImport();
          setResult(res);
          setImporting(false);
        }
        return;
      }

      if (input === "3") {
        await onToggleAutoWatch();
        return;
      }

      if (input === "q" || key.escape || key.return) {
        onBack();
        return;
      }
    })();
  });

  const cookieFile = currentCookiePath || "未设置";
  const fileExists = currentCookiePath ? existsSync(currentCookiePath) : false;

  return (
    <Box flexDirection="column" gap={1} padding={1}>
      <Text bold color="cyan">
        🍪 Cookies 设置
      </Text>
      <Text dimColor>{"─".repeat(50)}</Text>

      <Box flexDirection="column" gap={0}>
        <Text>当前 Cookies 文件:</Text>
        <Text color={fileExists ? "green" : "red"}>
          {fileExists ? "✓ " : "✗ "}
          {cookieFile}
        </Text>
      </Box>

      <Text dimColor>{"─".repeat(50)}</Text>

      <Text bold>操作:</Text>
      <Text color={importing ? "yellow" : undefined}>
        {importing ? "⏳ 处理中..." : "❶ 导入当前文件"}
      </Text>
      <Text>❷ 选择新的 Cookies 文件</Text>
      <Text>❸ 自动监控: {autoWatchEnabled ? "✓ 开启" : "✗ 关闭"}</Text>

      {result && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>{"─".repeat(50)}</Text>
          <Text color={result.success ? "green" : "red"}>
            {result.success ? "✓" : "✗"} {result.message}
          </Text>
        </Box>
      )}

      <Text dimColor>{"─".repeat(50)}</Text>
      <Text dimColor>按数字键选择，Enter/q 返回</Text>
    </Box>
  );
}

/**
 * 在终端显示导入 Cookies 的交互式界面，允许用户导入当前文件、选择新文件、切换自动监控和返回。
 * @param {object} params - 包含导入 cookies 所需参数的对象。
 * @param {string | undefined} params.currentCookiePath - 当前 cookies 文件路径或 undefined。
 * @param {boolean} params.autoWatchEnabled - 是否启用了自动监控。
 * @param {() => Promise<ImportCookiesResult>} params.onImport - 导入操作回调，返回结果。
 * @param {() => Promise<string | null>} params.onSelectFile - 文件选择回调，返回选中路径或 null。
 * @param {() => Promise<void>} params.onToggleAutoWatch - 切换自动监控的回调。
 * @returns {Promise<void>} 无返回值的 Promise。
 */
export async function importCookiesTui(params: {
  /** 当前 cookies 文件路径或 undefined。 */
  currentCookiePath: string | undefined;
  /** 是否启用了自动监控。 */
  autoWatchEnabled: boolean;
  /** 导入操作回调，返回结果。 */
  onImport: () => Promise<ImportCookiesResult>;
  /** 文件选择回调，返回选中路径或 null。 */
  onSelectFile: () => Promise<string | null>;
  /** 切换自动监控的回调。 */
  onToggleAutoWatch: () => Promise<void>;
}): Promise<void> {
  console.clear();

  return new Promise<void>((resolve) => {
    const { unmount } = render(
      <ImportCookiesView
        currentCookiePath={params.currentCookiePath}
        autoWatchEnabled={params.autoWatchEnabled}
        onImport={params.onImport}
        onSelectFile={params.onSelectFile}
        onToggleAutoWatch={params.onToggleAutoWatch}
        onBack={() => {
          unmount();
          setTimeout(() => resolve(), 100);
        }}
      />,
    );
  });
}
