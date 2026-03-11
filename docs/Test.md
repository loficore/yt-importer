# 测试运行时说明（为什么使用 Node）

## 结论

本项目的测试默认使用 Node 运行时，而不是直接使用 Bun 运行 Vitest。

当前脚本定义：

- `test`: `node ./node_modules/vitest/vitest.mjs`
- `test:bun`: `vitest`（仅用于对比或调试）

## 背景问题

项目包含 Ink 终端 UI 组件测试（TUI tests），例如：

- `test/unit/tui/selectList.tui.test.tsx`
- `test/unit/tui/confirm.tui.test.tsx`
- `test/unit/tui/checkbox.tui.test.tsx`
- `test/unit/tui/textInput.tui.test.tsx`
- `test/unit/tui/pressKey.tui.test.tsx`
- `test/unit/tui/notification.tui.test.tsx`

在 `Bun + Vitest worker` 组合下，测试进程内会出现 `console.Console` 不可用（`undefined`）的情况。

而 Ink 在渲染流程中依赖该能力，导致组件测试可能报错或行为异常（包括 worker 异常退出、渲染阶段失败、交互不稳定）。

## 为什么 Node 更合适

1. Node 运行 Vitest 的 worker 环境与 Ink 兼容性更稳定。
2. `console.Console` 在测试进程内可用，避免 Ink 渲染链路报错。
3. 现有 TUI 测试在 Node 下已验证可稳定通过。
4. 降低 CI 抖动，减少“本地偶发过 / CI 偶发挂”的运行时差异问题。

## 使用方式

常规执行：

```bash
bun run test
```

只跑 TUI 测试：

```bash
bun run test --run test/unit/tui/*.test.tsx
```

类型检查：

```bash
bun run build:check
```

## 什么时候用 `test:bun`

`test:bun` 主要用于以下场景：

1. 对比 Node 与 Bun 下的行为差异。
2. 调试运行时兼容问题。
3. 验证某个问题是否与 Bun worker 环境相关。

不建议把 `test:bun` 作为默认 CI 路径。

## 后续建议

1. 新增 TUI 测试时，优先复用 `test/unit/tui/inkTestUtils.ts` 的输入辅助工具。
2. 交互测试尽量在断言前等待帧更新，避免事件循环时序导致的假阴性。
3. 默认保持 Node 运行时，除非 Bun 侧兼容性问题已被明确修复并回归验证通过。
