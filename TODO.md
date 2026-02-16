# YouTube Music Importer - TODO

## 项目概述

将 Spotify 歌单 CSV 文件导入到 YouTube Music

## 核心功能

### 1. CSV 解析模块 ✅ 已完成

- [x] 分析 Exportify CSV 格式
- [x] 定义 SpotifyTrack 类型
- [x] 实现 CSV 解析器

### 2. 歌曲搜索模块 ✅ 已完成

- [x] 使用 youtubei.js 搜索歌曲
- [x] 认证支持（从 config/cookies.json 加载 cookies）
- [ ] 搜索结果缓存
  - [ ] 避免重复搜索相同歌曲
  - [ ] 缓存文件格式设计

### 3. 歌曲匹配算法 ✅ 已完成

- [x] 精确匹配 (歌名 + 艺术家)
- [x] 模糊匹配 (去除特殊字符)
- [x] 时长辅助匹配 (±5秒容差)
- [x] 置信度评分系统 (High/Medium/Low/None)

### 4. 匹配算法优化 ⏳ 待实现

- [ ] 多语言特殊字符处理
  - [ ] 增强 normalizeString 支持中文、日文等语言
  - [ ] 处理全角/半角字符转换
- [ ] 同义词识别
  - [ ] 统一处理 "feat."、"ft."、"featuring" 等协作艺术家变体
  - [ ] 处理 "&"、"and"、"+" 等连接符
- [ ] 混音版本智能识别
  - [ ] 识别 "Remix"、"Original Mix"、"Radio Edit" 等版本后缀
  - [ ] 版本信息不参与核心匹配，仅供参考

### 5. 搜索策略改进 ⏳ 待实现

- [ ] 搜索结果缓存
  - [ ] 基于歌曲 URI 的缓存机制
  - [ ] 缓存过期策略设计
  - [ ] 缓存文件格式（JSON/SQLite）
- [ ] 智能重试机制
  - [ ] 首次搜索失败后自动换搜索词重试
  - [ ] 多关键词组合尝试（单独搜索歌名、单独搜索艺术家）
  - [ ] 重试次数和间隔配置
- [ ] 多关键词搜索策略
  - [ ] "歌名 艺术家" 基础搜索
  - [ ] 单独搜索歌名
  - [ ] 单独搜索艺术家
  - [ ] 搜索艺术家专辑页再找歌曲

### 6. youtubei.js 客户端模块 ✅ 已完成

- [x] 封装 Innertube 初始化
- [x] 支持 cookies 认证加载
- [x] 搜索、创建播放列表、添加歌曲等核心 API

### 7. 断点续传系统 ✅ SQLite 已接入

- [x] SQLite 持久化进度存储
- [x] 恢复机制与历史 run 列表选择

### 8. 交互式界面 ⏳ 部分完成

- [x] 主菜单 (交互式 CLI)
- [x] CSV 文件选择
- [x] 匹配确认流程
- [ ] 进度显示
  - [ ] 实时进度条（TUI）
  - [ ] ETA 计算
  - [ ] 实时统计动态更新

### 9. 用户体验提升 ⏳ 待实现

#### 9.1 进度显示优化

- [ ] 实时进度条
  - [ ] 使用 TUI 库（blessed 或 react-blessed）
  - [ ] 显示当前处理的歌曲索引
  - [ ] 显示匹配成功率百分比
- [ ] ETA 计算
  - [ ] 基于历史处理速度预估剩余时间
  - [ ] 显示预计完成时间点
- [ ] 实时统计面板
  - [ ] 处理过程中动态更新统计数据
  - [ ] 置信度分布可视化

#### 9.2 日志和报告

- [ ] 详细日志系统
  - [ ] 文件日志（按日期归档）
  - [ ] 日志级别控制（DEBUG/INFO/WARN/ERROR）
  - [ ] 控制台输出优化
- [ ] 导入报告生成
  - [ ] 匹配统计摘要
  - [ ] 失败列表详细报告
  - [ ] 报告导出格式（HTML/JSON/Markdown）

### 10. 健壮性和可靠性 ⏳ 待实现

#### 10.1 错误处理增强

- [ ] YouTube API 限流处理
  - [ ] 检测 429 状态码
  - [ ] 优雅降级策略
  - [ ] 长时间延迟后自动恢复
- [ ] 网络重试机制
  - [ ] 指数退避算法
  - [ ] 最大重试次数配置
  - [ ] 区分可重试错误和不可重试错误
- [ ] Cookies 过期检测
  - [ ] 自动检测 cookies 是否失效
  - [ ] 提示用户重新获取 cookies
  - [ ] 区分认证错误和网络错误

#### 10.2 数据一致性

- [ ] 统一进度存储
  - [ ] 统一使用 SQLite，移除 JSON 进度文件
  - [ ] 或统一使用 JSON，移除 SQLite 依赖
- [ ] 进度文件自动清理
  - [ ] 自动清理超过 N 天的历史进度
  - [ ] 手动清理命令
  - [ ] 清理前确认提示

### 11. 功能扩展 ⏳ 待实现

#### 11.1 批量操作

- [ ] 失败曲目批量重试
  - [ ] 批量选择失败歌曲
  - [ ] 批量使用不同搜索策略重试
- [ ] 跨播放列表去重
  - [ ] 检测目标播放列表是否已有相同歌曲
  - [ ] 跳过已存在歌曲的选项
- [ ] 增量导入
  - [ ] 只导入新增的歌曲
  - [ ] 基于上次导入记录去重

#### 11.2 搜索增强

- [ ] 手动选择搜索结果
  - [ ] 当自动匹配不确定时，让用户从多个结果中选择
  - [ ] 显示每个结果的详细信息（时长、专辑等）
- [ ] 艺术家专辑页搜索
  - [ ] 先搜索艺术家
  - [ ] 从艺术家页面中定位歌曲
- [ ] 相似歌曲推荐
  - [ ] 利用 YouTube 的推荐算法
  - [ ] 作为备选搜索策略

### 12. 测试覆盖 ⏳ 待实现

- [ ] 集成测试
  - [ ] 端到端导入流程测试
  - [ ] Mock YouTube API 响应
- [ ] Searcher 模块测试
  - [ ] 搜索功能单元测试
  - [ ] 播放列表操作测试
- [ ] CLI 测试
  - [ ] 用户交互流程测试
  - [ ] 输入验证测试
- [ ] 性能测试
  - [ ] 大文件处理性能
  - [ ] 内存使用监控

### 13. 代码质量 ⏳ 待实现

- [ ] 配置统一管理
  - [ ] 创建统一 Config 类
  - [ ] 配置验证和默认值
  - [ ] 配置持久化
- [ ] 依赖注入重构
  - [ ] 引入轻量级 DI 容器
  - [ ] 类之间解耦
  - [ ] 便于单元测试
- [ ] 常量统一管理
  - [ ] 创建 constants.ts 文件
  - [ ] 魔法数字替换

### 14. 性能和优化 ⏳ 待实现

- [ ] 并发控制
  - [ ] 智能并发搜索（控制 QPS）
  - [ ] 可配置并发数
  - [ ] 动态调整策略
- [ ] 数据库写入优化
  - [ ] 批量写入进度
  - [ ] 减少保存频率
- [ ] 内存优化
  - [ ] 大 CSV 文件流式处理
  - [ ] 分块处理避免 OOM

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
│   ├── cli/
│   │   └── prompts.ts          # 交互提示
│   ├── utils/
│   │   ├── cookies.ts          # Cookies 管理
│   │   ├── db.ts               # SQLite 进度存储
│   │   ├── i18n.ts             # 国际化
│   │   └── constants.ts        # 常量定义（待创建）
│   └── config/
│       └── constants.ts         # 配置常量
├── config/
│   └── cookies.json            # YouTube 登录 Cookies
├── example_csv/                 # 示例文件
├── import-progress.sqlite       # SQLite 进度存储
├── TODO.md                     # 本文件
└── package.json
```

## 技术决策

### 已确定

- **运行时**: Bun
- **YouTube API**: youtubei.js (InnerTube 客户端)
- **CSV 格式**: Exportify 标准格式
- **交互方式**: 交互式 + 低置信度确认
- **进度存储**: SQLite

### 待确定

- [ ] 日志系统选型（pino/winston/bunyan）
- [ ] TUI 库选型（blessed/react-blessed/ink）
- [ ] 配置管理方案（单一配置类 vs 配置文件）
- [ ] DI 框架选型（tsyringe/typedi 或手写）

## 注意事项

### 风险点

1. **YouTube 检测**
   - 可能检测到自动化行为
   - 建议：使用真实浏览器配置
   - 实现：添加随机延迟和人类行为模拟

2. **匹配准确率**
   - 预期 60-80%
   - 取决于音乐类型
   - 优化：持续改进匹配算法

3. **速率限制**
   - 需要适当延迟
   - 大规模导入需要很长时间
   - 实现：智能限流和退避策略

## 开发进度

### Phase 1: 基础架构 ✅

- [x] 项目初始化
- [x] 依赖安装
- [x] 类型定义
- [x] TODO 文档

### Phase 2: 核心模块 ✅ 完成

- [x] CSV 解析器
- [x] 搜索模块
- [x] 匹配算法
- [x] 导入逻辑
- [x] 断点续传

### Phase 3: 用户体验 🚧 开发中

- [x] 交互式 CLI
- [x] 确认流程
- [ ] 进度条显示
- [ ] 日志报告导出

### Phase 4: 稳定性优化 ⏳ 待开始

- [ ] 错误处理和重试机制
- [ ] 搜索缓存
- [ ] 配置统一管理

### Phase 5: 高级功能 ⏳ 待规划

- [ ] 批量重试
- [ ] 增量导入
- [ ] 手动选择搜索结果

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

- [youtubei.js NPM](https://www.npmjs.com/package/youtubei.js)
- [Puppeteer 文档](https://pptr.dev/)
- [Exportify](https://exportify.net/)
- [YouTube Music](https://music.youtube.com/)
- [Inquirer.js](https://github.com/SBoudrias/Inquirer.js)
- [Zod](https://zod.dev/)
- [Bun SQLite](https://bun.sh/docs/api/sqlite)
