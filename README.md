# YouTube Music 导入工具

将 Spotify 播放列表导入到 YouTube Music。

## 功能

- 读取 Spotify 导出格式的 CSV 文件
- 自动匹配歌曲到 YouTube Music
- 创建 YouTube Music 播放列表
- 支持断点续传
- 可配置匹配精度

## 环境要求

- [Bun](https://bun.sh) (JavaScript 运行时)

## 准备工作

1. 安装依赖：
   ```bash
   bun install
   ```

2. 配置 Cookie（如需登录功能）：
   - 复制 `config/cookies.example.json` 为 `config/cookies.json`
   - 填入你的 YouTube Music 浏览器 Cookie

## 使用方法

1. 准备 CSV 文件（可从 Exportify 等工具导出）
2. 运行程序：
   ```bash
   bun run start
   ```
3. 按提示操作：输入 CSV 路径、播放列表名称等

## 配置说明

- **匹配精度**：高/中/低/无，影响自动匹配歌曲的严格程度
- **请求间隔**：避免请求过快被限制
- 进度自动保存到 `import-progress.json`，中断后可继续

## 项目结构

```
yt-importer/
├── src/
│   ├── core/         # 核心逻辑
│   ├── cli/          # 交互提示
│   └── types/        # 类型定义
├── config/           # 配置文件
└── example_csv/      # 示例文件
```
