# YouTube Music Importer - TODO

## 项目概述

将 Spotify 歌单 CSV 文件导入到 YouTube Music

## 核心功能

### 1. CSV 解析模块 ✅ 规划完成

- [X]  分析 Exportify CSV 格式
- [X]  定义 SpotifyTrack 类型
- [X]  实现 CSV 解析器
  - [X]  读取 CSV 文件
  - [X]  解析 Track Name, Artist Name, Album Name, Duration
  - [X]  验证数据完整性
  - [X]  错误处理

### 2. 歌曲搜索模块 ✅ 已实现

- [X]  使用 youtubei.js 搜索歌曲
  - [X]  实现 `src/core/searcher.ts`
  - [X]  实现 `searchSongs()` 调用
  - [X]  处理搜索结果
- [ ]  搜索结果缓存
  - [ ]  避免重复搜索
  - [ ]  缓存文件格式设计
- [X]  认证支持
  - [X]  从 `config/cookies.json` 加载 cookies
  - [X]  注入到 Innertube 会话

### 3. 歌曲匹配算法 ⏳ 部分实现

- [ ]  匹配策略实现
  - [X]  精确匹配 (歌名 + 艺术家)
  - [X]  模糊匹配 (去除特殊字符)
  - [X]  时长辅助匹配 (±5秒容差)
- [X]  置信度评分系统
  - [X]  High: 精确匹配
  - [X]  Medium: 模糊匹配
  - [X]  Low: 时长匹配
  - [X]  None: 无法匹配

### 4. youtubei.js 客户端模块 ✅ 已实现

#### 4.1 核心功能实现

- [X]  创建 `src/core/searcher.ts`
  - [X]  封装 Innertube 初始化
  - [X]  支持 cookies 认证加载
  - [X]  实现统一接口

#### 4.2 API 接口设计

```typescript
// 核心接口
interface YouTubeMusicClient {
  // 搜索歌曲
  searchSongs(query: string): Promise<YouTubeSong[]>;

  // 获取用户歌单
  getPlaylists(): Promise<Playlist[]>;

  // 创建歌单
  createPlaylist(name: string, description?: string): Promise<string>;

  // 添加歌曲到歌单
  addToPlaylist(playlistId: string, videoIds: string[]): Promise<void>;

  // 获取歌曲详情
  getSongInfo(videoId: string): Promise<YouTubeSong | null>;
}
```

#### 4.3 youtubei.js API 映射

| 功能 | youtubei.js 方法 |
|------|-----------------|
| 搜索 | `innertube.music.search(query, { type: 'song' })` |
| 获取歌单 | `innertube.getPlaylists()` 或 `innertube.getLibrary().playlists_section` |
| 创建歌单 | `innertube.playlist.create(title, videoIds)` |
| 添加歌曲 | `innertube.playlist.addVideos(playlistId, videoIds)` |
| 歌曲详情 | `innertube.music.getInfo(videoId)` |
| 认证 | `Innertube.create({ cookie: string })` |

### 5. 浏览器自动化模块 🔶 可选（待办）

> **说明**：youtubei.js 可直接使用 cookies 认证，Puppeteer 仅在认证失败时作为备选方案

- [ ]  Puppeteer 备选认证方案
  - [ ]  实现浏览器启动配置
  - [ ]  访问 music.youtube.com 并登录
  - [ ]  提取有效 cookies
  - [ ]  注入到 youtubei.js 会话
- [ ]  反检测措施
  - [ ]  随机延迟
  - [ ]  模拟人类行为（仅备选方案使用）

### 6. 断点续传系统 🔶 部分实现

- [X]  进度保存/加载实现
  - [X]  JSON 格式设计
  - [X]  写入/读取实现
- [ ]  恢复机制
  - [ ]  检测已有进度
  - [ ]  跳过已处理歌曲 ← **未实现**
  - [ ]  从断点继续

### 7. 交互式界面 ✅ 已实现

- [X]  主菜单 (交互式 CLI)
  - [X]  选择 CSV 文件（自动扫描或手动输入）
  - [X]  输入播放列表名称
  - [X]  配置选项
- [X]  匹配确认流程
  - [X]  显示匹配结果
  - [X]  低置信度确认
  - [X]  跳过/手动选择选项
- [ ]  进度显示
  - [ ]  实时进度条
  - [ ]  ETA 计算

### 8. 日志和报告 ⏳ 待实现

- [ ]  详细日志
  - [ ]  文件日志
  - [ ]  控制台输出
- [ ]  导入报告
  - [ ]  匹配统计
  - [ ]  失败列表
  - [ ]  导出报告

## 文件结构

```
yt-importer/
├── src/
│   ├── index.ts                  # 主入口
│   ├── types/
│   │   └── index.ts            # 类型定义
│   ├── core/
│   │   ├── csvParser.ts        # CSV 解析
│   │   ├── searcher.ts         # YouTube Music API 搜索客户端
│   │   ├── matcher.ts          # 匹配算法
│   │   └── importer.ts         # 导入逻辑
│   ├── utils/
│   │   └── cookies.ts          # Cookies 管理
├── config/
│   └── cookies.json            # YouTube 登录 Cookies
├── example_csv/                # 示例文件
├── TODO.md                    # 本文件
└── package.json
```

## 技术决策

### 已确定

- **运行时**: Bun
- **YouTube API**: youtubei.js (InnerTube 客户端)
- **浏览器自动化**: Puppeteer (仅备选认证方案)
- **CSV 格式**: Exportify 标准格式
- **Cookies**: 手动输入 JSON 格式
- **交互方式**: 交互式 + 低置信度确认

### 备选方案

- **Puppeteer 认证** 🔶 待办
  - 当 youtubei.js 直接使用 cookies 认证失败时启用
  - 使用真实浏览器绕过检测

### 待确定

- [ ]  匹配算法细节参数
- [ ]  延迟策略
- [ ]  错误处理策略

## 注意事项

### 风险点

1. **YouTube 检测**

   - 可能检测到自动化行为
   - 建议：使用真实浏览器配置
2. **匹配准确率**

   - 预期 60-80%
   - 取决于音乐类型
3. **速率限制**

   - 需要适当延迟
   - 大规模导入需要很长时间

### 优化方向

- [ ]  并发搜索 (需控制频率)
- [ ]  缓存已匹配歌曲
- [ ]  失败自动重试

## 开发进度

### Phase 1: 基础架构 ✅

- [X]  项目初始化
- [X]  依赖安装
- [X]  类型定义
- [X]  TODO 文档

### Phase 2: 核心模块 ✅ 完成

- [X]  CSV 解析器 (csvParser.ts)
- [X]  搜索模块 (searcher.ts)
- [X]  匹配算法 (matcher.ts)
- [X]  导入逻辑 (importer.ts)
- [ ]  断点续传 ← 部分实现（需修复跳过已处理歌曲）

### Phase 3: 浏览器自动化 ⏳

- [ ]  Puppeteer 集成 (可选备选)
- [ ]  播放列表操作

### Phase 4: 用户体验 🚧 开发中

- [X]  交互式 CLI（inquirer 菜单）
- [X]  确认流程（低置信度匹配）
- [ ]  进度条显示
- [ ]  日志报告导出

## 运行示例

```bash
# 开发模式 (带热重载)
bun run dev

# 生产模式
bun run start

# 指定 CSV 文件
bun run start --csv=example_csv/Liked_Songs.csv

# 指定播放列表名称
bun run start --csv=example_csv/Liked_Songs.csv --playlist="My Playlist"

# 使用自定义延迟
bun run start --csv=example_csv/Liked_Songs.csv --delay=2000

# 跳过确认提示
bun run start --csv=example_csv/Liked_Songs.csv --skip-confirmation
```

## 参考资料

- [ytmusic-api NPM](https://www.npmjs.com/package/ytmusic-api)
- [Puppeteer 文档](https://pptr.dev/)
- [Exportify](https://exportify.net/)
- [YouTube Music](https://music.youtube.com/)
