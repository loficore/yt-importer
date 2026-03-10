import React from "react";
import { Box, Text, render, useInput } from "ink";

/**
 * 导入摘要数据结构
 */
export interface ImportSummaryData {
  /** 总曲目数 */
  total: number;
  /** 匹配的曲目数 */
  matched: number;
  /** 高置信度匹配数 */
  highConfidence: number;
  /** 中置信度匹配数 */
  mediumConfidence: number;
  /** 低置信度匹配数 */
  lowConfidence: number;
  /** 未匹配的曲目数 */
  unmatched: number;
  /** 成功导入的曲目数（可选） */
  success?: number;
  /** 导入失败的曲目数（可选） */
  failed?: number;
  /** 跳过的曲目数（可选） */
  skipped?: number;
  /** 导入操作持续时间（毫秒， 可选） */
  duration?: number;
}

/**
 * `ImportSummaryView` 组件的 props
 * onConfirm/onCancel 为可选回调，仅在 `showActions` 为 true 时使用
 */
interface ImportSummaryProps {
  /** 标题文本，显示在摘要上方。 */
  title: string;
  /** 导入摘要数据，包含统计信息和结果。 */
  data: ImportSummaryData;
  /** 用户确认导入的回调函数，参数为用户选择的值。 */
  onConfirm?: () => void;
  /** 用户取消导入的回调函数，参数为用户选择的值。 */
  onCancel?: () => void;
  /** 是否显示确认/取消操作提示，默认为 false。 */
  showActions?: boolean;
}

/**
 * 显示导入摘要的终端视图组件（基于 Ink）
 * 支持可选的交互操作（确认/取消）
 * @param {ImportSummaryProps} props 组件属性
 * @returns {React.JSX.Element} 渲染的元素
 */
function ImportSummaryView({
  title,
  data,
  onConfirm,
  onCancel,
  showActions = false,
}: ImportSummaryProps): React.JSX.Element {
  const [selected, setSelected] = React.useState(0);

  useInput((input) => {
    if (!showActions) {
      // 当不显示操作选项时，按任意键都会触发 onConfirm（关闭摘要）
      onConfirm?.();
      return;
    }

    if (input === "y" || input === "Y") {
      void onConfirm?.();
    } else if (input === "n" || input === "N") {
      void onCancel?.();
    } else if (input === "j" || input === "k") {
      setSelected((prev) => (prev + 1) % 2);
    }
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color="cyan">
        {title}
      </Text>
      <Text dimColor>────────────────────────────────────────</Text>
      <Box flexDirection="column" gap={0}>
        <Text> {data.total} tracks total</Text>
        <Text> {data.matched} matched</Text>
        <Box gap={2} marginLeft={2}>
          <Text dimColor>- {data.highConfidence} high</Text>
          <Text dimColor>- {data.mediumConfidence} medium</Text>
          <Text dimColor>- {data.lowConfidence} low</Text>
        </Box>
        <Text> {data.unmatched} unmatched</Text>
        {data.success !== undefined && (
          <Text> {data.success} imported successfully</Text>
        )}
        {data.failed !== undefined && (
          <Text color="red"> {data.failed} import failed</Text>
        )}
        {data.skipped !== undefined && (
          <Text dimColor> {data.skipped} skipped</Text>
        )}
        {data.duration !== undefined && (
          <Text dimColor> Duration: {Math.round(data.duration / 1000)}s</Text>
        )}
      </Box>
      <Text dimColor>────────────────────────────────────────</Text>
      {!showActions && (
        <Text color="cyan">按任意键返回主菜单...</Text>
      )}
      {showActions && (
        <Box flexDirection="column" gap={0}>
          <Text color={selected === 0 ? "green" : "gray"}>
            {selected === 0 ? "❯ " : "  "}Yes - Import to playlist
          </Text>
          <Text color={selected === 1 ? "green" : "gray"}>
            {selected === 1 ? "❯ " : "  "}No - Skip import
          </Text>
          <Text dimColor>y/n or j/k to select</Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * 在终端显示一个简短的导入摘要,并在用户按键后返回
 * @param {object} params 标题与摘要数据
 * @param {string} params.title 摘要标题
 * @param {ImportSummaryData} params.data 摘要数据
 * @returns {Promise<void>} 在用户关闭摘要后解析
 */
export async function showImportSummary(params: {
  /** 摘要标题 */
  title: string;
  /** 摘要数据 */
  data: ImportSummaryData;
}): Promise<void> {
  console.clear();

  return new Promise<void>((resolve) => {
    const { unmount } = render(
      <ImportSummaryView
        title={params.title}
        data={params.data}
        onConfirm={() => {
          unmount();
          setTimeout(() => resolve(), 100);
        }}
      />,
    );
  });
}

/**
 * 显示带交互操作的导入摘要，用户确认或取消会触发传入的异步回调
 * 回调由内部异步流程执行，函数返回时不会阻塞 UI
 * @param {object} params 标题、摘要数据与回调函数
 * @param {string} params.title 摘要标题
 * @param {ImportSummaryData} params.data 摘要数据
 * @param {() => Promise<void>} params.onConfirm 用户确认后的异步回调
 * @param {() => Promise<void>} params.onCancel 用户取消后的异步回调
 * @returns {Promise<void>} 在用户选择后解析
 */
export async function promptImportSummary(params: {
  /** 摘要标题 */
  title: string;
  /** 摘要数据 */
  data: ImportSummaryData;
  /** 用户确认后的异步回调 */
  onConfirm: () => Promise<void>;
  /** 用户取消后的异步回调 */
  onCancel: () => Promise<void>;
}): Promise<void> {
  console.clear();

  return new Promise<void>((resolve) => {
    const { unmount } = render(
      <ImportSummaryView
        title={params.title}
        data={params.data}
        showActions
        onConfirm={() => {
          unmount();
          void (async () => {
            await new Promise((r) => setTimeout(r, 150));
            await params.onConfirm();
            resolve();
          })();
        }}
        onCancel={() => {
          unmount();
          void (async () => {
            await new Promise((r) => setTimeout(r, 150));
            await params.onCancel();
            resolve();
          })();
        }}
      />,
    );
  });
}

/**
 * 展示批量导入摘要并等待用户按键关闭
 * @param {object} params 标题与摘要数据
 * @param {number} params.count 导入的文件数量
 * @param {ImportSummaryData} params.data 摘要数据
 * @returns {Promise<void>} 用户按键后解析
 */
export async function showBatchSummary(params: {
  /** 导入的文件数量 */
  count: number;
  /** 摘要数据 */
  data: ImportSummaryData;
}): Promise<void> {
  console.clear();

  return new Promise<void>((resolve) => {
    const { unmount } = render(
      <ImportSummaryView
        title={`Batch Import Summary (${params.count} files)`}
        data={params.data}
        onConfirm={() => {
          unmount();
          setTimeout(() => resolve(), 100);
        }}
      />,
    );
  });
}
