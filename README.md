# YouTube Music 导入工具

将 Spotify 播放列表导入到 YouTube Music。

## 功能

- 读取 Spotify 导出格式的 CSV 文件（Exportify 格式）
- 自动匹配歌曲到 YouTube Music
- 支持增量导入到已有歌单
- 置信度分级（高/中/低），可配置自动匹配严格程度
- 低置信度歌曲统一收集，手动选择最佳匹配
- 创建 YouTube Music 播放列表
- 断点续传（SQLite 持久化）
- 搜索结果缓存（支持 TTL 过期策略）
- 智能重试机制（指数退避 + 429 限流检测）
- Cookie 过期自动检测
- 实时进度条显示（含 ETA 预估）
- 多语言支持（English / 简体中文 / 日本語）
- 纯 Ink TUI 实现，流畅的交互体验

## 环境要求

- [Bun](https://bun.sh) (JavaScript 运行时)

## 准备工作

1. 安装依赖：

   ```bash
   bun install
   ```

2. 配置 Cookie（如需登录功能）：
   - 在 `config/` 目录下创建 `cookies.json`
   - 填入你的 YouTube Music 浏览器 Cookie

## 使用方法

1. 准备 CSV 文件（可从 Exportify 等工具导出）
2. 运行程序：
   ```bash
   bun run start
   ```
3. 按提示操作：选择功能、输入 CSV 路径、播放列表名称等

### 主菜单功能

- **新建导入**：创建新歌单并导入歌曲
- **增量导入**：向已有歌单追加歌曲（自动跳过已存在）
- **继续导入**：从中断处继续导入
- **查看进度**：查看历史导入记录
- **查看失败**：查看失败曲目列表
- **设置**：调整匹配精度、请求间隔等
- **语言**：切换界面语言

## 配置说明

- **匹配精度**：高/中/低，影响自动匹配歌曲的严格程度
- **请求间隔**：避免请求过快被限制
- 进度自动保存到 SQLite 数据库，中断后可继续

## 项目结构

```
yt-importer/
├── src/
│   ├── core/           # 核心逻辑（CSV解析、搜索、匹配、导入）
│   ├── cli/            # 交互提示
│   ├── tui/            # Ink TUI 组件
│   ├── types/          # 类型定义（Zod schemas）
│   ├── utils/          # 工具函数（数据库、缓存、i18n）
│   └── index.ts        # 主入口
├── config/             # 配置文件
│   ├── cookies.json    # YouTube Cookie（敏感）
│   └── translations/   # 多语言翻译
├── example_csv/        # 示例文件
└── import-progress.sqlite  # 进度存储
```

## 相关文档

- [youtubei.js](https://www.npmjs.com/package/youtubei.js) - YouTube API 客户端
- [Exportify](https://exportify.net/) - Spotify 歌单导出工具
