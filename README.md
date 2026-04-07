# Douyin Live Overlay Assistant

Windows 桌面端直播辅助悬浮窗。当前一期不接真实抖音接口，数据输入支持内置 mock 和本地 WebSocket，后续可通过 adapter 层接入官方直播开放平台。

## 1. 项目目录结构

```text
.
├── electron/
│   ├── main/                 # Electron 主进程：窗口、热键、配置、日志、IPC
│   └── preload/              # contextBridge 安全暴露最小 API
├── mock-server/              # 本地 WebSocket mock server
├── scripts/                  # Electron 构建与开发启动脚本
├── src/
│   ├── data/                 # 事件模型校验、去重、聚合、adapter 接入层
│   ├── renderer/             # React UI、Zustand store、样式
│   └── shared/               # 主进程/渲染进程共享类型、配置、IPC channel
├── tests/                    # Vitest 数据层测试
├── configs/example.config.json
├── .env.example
├── package.json
└── vite.config.ts
```

## 2. 核心架构说明

主进程负责桌面能力：透明无边框 `BrowserWindow`、置顶、任务栏隐藏、默认不抢焦点、点击穿透、全局快捷键、窗口位置尺寸保存、日志文件写入。

渲染进程只负责显示：React + Zustand 维护配置、连接状态和最近事件列表，通过 preload 暴露的 `electronBridge` 调用主进程能力。

数据层与显示层解耦：`LiveEventClient` 只依赖 `src/data/adapters/` 下的 adapter 工厂，不直接写死 mock、WebSocket 或官方平台逻辑。adapter 输出统一 `LiveEvent` 后进入 `EventPipeline` 做格式校验、去重、点赞聚合和 ring buffer 限制，再推送给 Zustand。

## 3. 关键风险点

Windows 全屏独占游戏通常不允许普通透明窗口覆盖；建议使用游戏“无边框窗口化/窗口化全屏”。Electron 的 `setIgnoreMouseEvents(true, { forward: true })` 和 `showInactive()` 能降低抢焦点风险，但不同游戏反作弊和渲染模式可能有差异。

全局快捷键可能被系统或游戏占用；如果注册失败会写入日志。高频事件已在数据层做去重和点赞合并，在渲染层再用 100ms 批处理降低 React 更新频率。

## 4. 第一步可运行 MVP 代码

已实现透明悬浮窗、无边框、置顶、任务栏隐藏、默认点击穿透、默认不抢焦点和快捷键。

核心文件：

```text
electron/main/index.ts
electron/preload/index.ts
src/shared/ipc.ts
```

默认快捷键：

```text
Ctrl+Alt+O      显示/隐藏悬浮窗
Ctrl+Alt+L      切换点击穿透；关闭穿透时进入编辑模式
Ctrl+Alt+Up     提高透明度
Ctrl+Alt+Down   降低透明度
Ctrl+Alt+1      弹幕列表模式
Ctrl+Alt+2      礼物高亮模式
Ctrl+Alt+3      极简角落模式
```

## 5. 第二步加入 mock WebSocket 数据

内置 mock 模式默认开启，无需服务器即可看到数据。也可以启动本地 WebSocket server：

```bash
npm run mock
```

默认地址：

```text
ws://127.0.0.1:17890
```

如果要使用本地 WebSocket server，把配置里的 `data.mockMode` 改成 `false`，或在编辑模式 UI 中关闭 Mock 模式。

## 6. 第三步完成 UI 模板

已实现三种布局：

```text
list      弹幕列表模式
gift      礼物高亮模式
minimal   极简角落模式
```

UI 为深色半透明 HUD 风格，高优先级事件包括礼物和关注。编辑模式支持布局切换、透明度、字号、缩放、仅评论/仅礼物过滤、清空事件、窗口尺寸调整。

## 7. 第四步完善配置、日志、打包

配置存储位置使用 Electron `app.getPath('userData')/config.json`。日志写入 `app.getPath('userData')/logs/app.log`。

开发命令：

```bash
npm install
npm run dev
```

测试和类型检查：

```bash
npm test
npm run typecheck
```

打包命令：

```bash
npm run pack
npm run dist
```

`pack` 生成未安装目录，`dist` 生成 Windows 安装包/portable 包。macOS/Linux 开发机可执行构建校验，但 Windows 行为请在 Windows 10/11 上实测。

## 如何接入官方平台数据

当前项目已预留官方直播数据 adapter，但不包含任何私有抓包、逆向协议或伪造平台接口细节。相关文件：

```text
src/data/adapters/types.ts
src/data/adapters/mockAdapter.ts
src/data/adapters/websocketAdapter.ts
src/data/adapters/douyinOfficialAdapter.ts
src/data/adapters/index.ts
```

adapter 统一接口：

```ts
interface LiveEventAdapter {
  readonly name: string;
  start(): void;
  stop(): void;
}
```

adapter 通过 `LiveEventAdapterCallbacks` 向上层输出统一事件：

```ts
interface LiveEventAdapterCallbacks {
  onEvents(events: LiveEvent[]): void;
  onStatus(status: ConnectionStatus): void;
  onError(error: Error): void;
}
```

官方平台接入流程建议：

```text
1. 在官方直播开放平台完成开发者资质、应用创建、回调地址、签名密钥等配置。
2. 在你自己的后端服务接收官方回调/推送，并完成官方要求的验签、鉴权、重放防护和错误响应。
3. 将验签后的官方回调载荷转换为 DouyinOfficialCallbackEvent。
4. 调用 mapDouyinOfficialCallbackToLiveEvent() 或 DouyinOfficialAdapter.handleCallback() 转为统一 LiveEvent。
5. 通过现有 WebSocket adapter 或你新增的官方 adapter 传给本桌面端。
```

需要开发者根据实际平台资质补充的部分：

```text
官方应用凭证：appId/clientKey/callbackSecret 等以平台控制台实际字段为准。
官方回调入口：HTTP 路由、验签、时间戳/nonce 校验、重放防护。
官方 SDK 或 API 调用：按官方文档实现，不写入私有抓包逻辑。
部署地址：公网 HTTPS 回调地址、证书、网关和日志审计。
错误处理策略：官方要求的响应格式、重试处理、限流与告警。
```

`douyinOfficialAdapter` 当前只实现这些安全边界：

```text
类型定义：DouyinOfficialAdapterConfig、DouyinOfficialCallbackEvent 等。
事件映射：comment / like / gift / enter / follow 到统一 LiveEvent。
配置结构：仅保存官方接入所需的占位配置字段，不假设私有接口。
回调转换：mapDouyinOfficialCallbackToLiveEvent(callback)。
```

示例映射：

```ts
const event = mapDouyinOfficialCallbackToLiveEvent({
  eventId: 'official-comment-1',
  eventType: 'comment',
  timestamp: Date.now(),
  operator: {
    openId: 'official-open-id',
    nickname: '观众昵称'
  },
  data: {
    content: '弹幕内容'
  },
  raw: originalOfficialPayload
});
```

只要新增平台 adapter 继续输出同一个 `LiveEvent` 模型，悬浮窗 UI 层不需要修改。

## 8. README

本 README 即项目说明。环境变量参考 `.env.example`，示例配置参考 `configs/example.config.json`。

Electron IPC 设计：

```text
config:get                   渲染进程读取完整配置
config:update                渲染进程保存配置，主进程同步窗口状态
overlay:state                主进程广播或响应当前窗口状态
overlay:toggle-visibility    显示/隐藏悬浮窗
overlay:toggle-click-through 切换穿透/编辑模式
overlay:set-click-through    显式设置穿透状态
overlay:set-layout           设置布局
overlay:resize               调整窗口大小
app:log                      渲染进程写主进程日志
```

统一事件模型：

```ts
{
  eventId: string,
  type: 'comment' | 'gift' | 'like' | 'enter' | 'follow' | 'system',
  timestamp: number,
  user: {
    id: string,
    nickname: string,
    avatar?: string,
    fansLevel?: number
  },
  payload: {
    text?: string,
    giftName?: string,
    giftCount?: number,
    likeCount?: number
  },
  raw?: unknown
}
```
