# Douyin Live Overlay Assistant

Windows 10/11 桌面端直播悬浮窗工具。它提供透明、置顶、默认点击穿透的本地 Overlay，用于在游戏直播时显示弹幕、点赞、礼物、进场、关注和系统事件。

当前版本不伪装为“已直连抖音官方接口”。真实可用链路是 Mock、标准 WebSocket、Bridge Receiver。官方平台接入保留 adapter 壳，需开发者按官方资质和官方文档补充回调验签、授权和后端桥接。

## 功能状态

已实现：

```text
透明无边框悬浮窗、始终置顶、默认点击穿透、默认不抢焦点
编辑模式 / 直播穿透模式切换
托盘常驻、关闭到托盘、单实例运行、开机自启开关
全局快捷键、热键注册失败提示
Mock / WebSocket / Bridge Receiver / Official Adapter Shell 数据源模式
WebSocket 重连、连接状态、最后错误、事件速率
list / gift / minimal 三种布局
过滤关键词、高亮关键词、仅评论/仅礼物/仅系统、点赞聚合开关
配置版本迁移、配置导入导出、日志落盘与日志目录按钮
Bridge 示例 server 和 sample events
核心数据层、adapter、配置迁移、renderer 过滤测试
```

未实现且不会伪装：

```text
抖音官方平台直连认证、官方回调验签、官方 API/SDK 调用。
这些必须由具备平台资质的开发者根据官方文档在后端补充。
```

## 项目结构

```text
electron/
  main/                 主进程：窗口、托盘、单实例、热键、配置、日志、IPC
  preload/              contextBridge 最小 API
src/
  data/
    adapters/           mock、websocket、bridge、douyinOfficial adapter
    eventPipeline.ts    去重、ring buffer、点赞聚合
    eventSchema.ts      统一事件模型校验
    liveEventClient.ts  adapter 生命周期与事件管线入口
  renderer/             React UI、Zustand store、控制面板、布局
  shared/               配置、IPC、事件共享类型
bridge-service/         独立 Bridge Receiver 示例服务、schema 校验和 sample-events.json
plugin-bridge-helper/   Windows C++17 直播伴侣互动插件 helper，桥接官方 PipeSDK 到 overlay
mock-server/            Mock WebSocket server
configs/                示例配置
tests/                  Vitest 测试
scripts/                Electron 构建与开发启动脚本
```

## 安装与启动

```bash
npm install
npm run dev
```

默认会以内置 Mock 模式显示事件。按 `Ctrl+Alt+L` 进入编辑模式，设置数据源、地址、布局、透明度、字号、过滤器、自启和托盘行为。

## 常用快捷键

```text
Ctrl+Alt+O      显示 / 隐藏悬浮窗
Ctrl+Alt+L      编辑模式 / 直播穿透模式
Ctrl+Alt+Up     提高透明度
Ctrl+Alt+Down   降低透明度
Ctrl+Alt+1      list 布局
Ctrl+Alt+2      gift 布局
Ctrl+Alt+3      minimal 布局
```

如果快捷键被系统或游戏占用，设置面板会显示热键注册失败提示，同时主进程日志会记录失败项。

## Mock 模式

内置 Mock 模式无需外部服务，适合 UI 调试。

也可以启动 mock WebSocket server：

```bash
npm run mock
```

默认地址：

```text
ws://127.0.0.1:17890
```

在编辑模式中把数据源切到 `WebSocket`，地址填入上面的 URL 即可接收 mock server 推送。

## Bridge Receiver 模式

Bridge Receiver 是正式推荐的可用接入模式。本质是标准 WebSocket 输入，但协议、UI、示例和 README 都按正式功能维护。你可以把任意合规、已授权的数据源在自己的后端或本地脚本中转换为统一事件模型，再通过 Bridge 推给 Overlay。

启动示例 bridge：

```bash
npm run bridge:sample
```

默认地址：

```text
ws://127.0.0.1:17891
```

在 Overlay 编辑模式中选择 `Bridge Receiver`，Bridge 地址填入该 URL。

Bridge 示例服务位于：

```text
bridge-service/
```

它是独立 Node.js 实现，不从主工程数据层导入代码，包含 `src/schema.ts` 校验和 `sample-events.json`。

Bridge envelope：

```json
{
  "protocol": "douyin-live-overlay-bridge",
  "version": 1,
  "events": [
    {
      "eventId": "evt-1",
      "type": "comment",
      "timestamp": 1710000000000,
      "user": {
        "id": "user-1",
        "nickname": "观众"
      },
      "payload": {
        "text": "弹幕内容"
      }
    }
  ]
}
```

为简化第三方接入，Bridge adapter 也接受单个 `LiveEvent` 或 `LiveEvent[]` 原始 JSON，但推荐使用 envelope，便于后续版本协商和错误诊断。

## 统一事件模型

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

## 官方平台接入边界

如果要走“仅直播伴侣 + exe 包体”的官方互动插件路线，请使用新增的独立工程：

```text
plugin-bridge-helper/
```

它不重写 overlay，也不把官方 PipeSDK 逻辑塞进 Electron 主进程。目标链路是：

```text
抖音直播伴侣 -> plugin-bridge-helper.exe -> ws://127.0.0.1:17891 -> Overlay Bridge Receiver
```

详细构建、PipeSDK 放置、直播伴侣调试面板联调和能力 gating 说明见：

```text
plugin-bridge-helper/README.md
```

相关文件：

```text
src/data/adapters/douyinOfficialAdapter.ts
src/data/adapters/types.ts
```

当前官方 adapter 已提供：

```text
DouyinOfficialAdapterConfig 配置类型
DouyinOfficialCallbackEvent 回调数据类型
comment / like / gift / enter / follow 到 LiveEvent 的映射
mapDouyinOfficialCallbackToLiveEvent(callback)
DouyinOfficialAdapter.handleCallback(callback)
```

需要开发者根据实际平台资质补充：

```text
官方应用创建、appId/clientKey/callbackSecret 等字段确认
官方回调 HTTP 路由
官方验签、时间戳/nonce、重放防护
官方 SDK/API 调用与错误响应
公网 HTTPS 回调地址、证书、网关和审计日志
将验签后的官方回调转换为 DouyinOfficialCallbackEvent
通过 Bridge 或自定义 adapter 推送到 Overlay
```

禁止把私有抓包、逆向协议或不稳定字段硬编码进主工程。

## 配置与日志

配置文件位置：

```text
Electron app.getPath('userData')/config.json
```

日志目录：

```text
Electron app.getPath('userData')/logs/
```

在编辑模式设置面板中可以打开日志目录、导入配置、导出配置。示例配置见：

```text
configs/example.config.json
```

配置包含版本号，旧版 `data.mockMode` 会迁移为新版 `data.mode`。

## 打包

构建：

```bash
npm run build
```

生成未安装目录：

```bash
npm run pack
```

生成 Windows 安装包和 portable 包：

```bash
npm run dist:win
```

产物输出到：

```text
release/
```

Windows 真机建议使用 Windows 10/11 的无边框窗口化游戏模式测试，独占全屏游戏通常不保证被普通桌面 Overlay 覆盖。

Windows 使用建议：

```text
1. 安装或启动应用后，先按 Ctrl+Alt+L 进入编辑模式。
2. 把 Overlay 拖到游戏画面附近，设置透明度、字号和布局。
3. 再按 Ctrl+Alt+L 回到直播穿透模式，确认鼠标点击能落到游戏窗口。
4. 游戏使用“无边框窗口化/窗口化全屏”，不要使用独占全屏。
5. 如果热键被游戏拦截，在设置面板查看热键状态并修改配置。
```

OBS/直播场景推荐：

```text
游戏窗口：无边框窗口化。
Overlay：直播穿透模式，保持 alwaysOnTop。
OBS：优先采集显示器或游戏窗口化画面；如果 OBS 不能捕获透明悬浮窗，请改用显示器采集或把 Bridge 数据接入 OBS 自己的浏览器源。
```

## 测试

```bash
npm test
npm run typecheck
```

覆盖范围：

```text
事件 schema / pipeline / 去重 / 点赞聚合开关
adapter factory / douyinOfficial 映射
Bridge envelope 解析 / 独立 bridge-service schema 校验
WebSocket 重连
高频事件输入下的 ring buffer 稳定性
配置迁移和数值约束
renderer 事件过滤逻辑
```

## IPC 设计

```text
config:get                         读取完整配置
config:update                      保存配置并同步窗口状态
config:changed                     主进程广播配置变化
overlay:state                      获取或广播窗口状态
overlay:toggle-visibility          显示 / 隐藏悬浮窗
overlay:toggle-click-through       编辑模式 / 直播穿透模式
overlay:set-click-through          显式设置穿透状态
overlay:set-layout                 设置布局
overlay:resize                     调整窗口大小
app-info:get                       获取配置路径、日志路径、热键状态、自启状态
app:open-logs-dir                  打开日志目录
app:export-config                  导出配置 JSON
app:import-config                  导入配置 JSON
app:log                            渲染进程日志上报
```

## 故障排查

悬浮窗不显示：

```text
检查是否在托盘中隐藏。
按 Ctrl+Alt+O 显示。
确认游戏不是独占全屏，建议使用无边框窗口化。
```

鼠标点到悬浮窗：

```text
按 Ctrl+Alt+L 退出编辑模式，回到直播穿透模式。
设置面板中确认 clickThrough 已恢复。
```

Bridge 无事件：

```text
确认 npm run bridge:sample 正在运行。
确认 Overlay 数据源为 Bridge Receiver。
确认 Bridge 地址为 ws://127.0.0.1:17891。
查看设置面板里的最后错误和日志目录。
```

热键无效：

```text
查看设置面板热键状态。
被系统、输入法、录屏软件或游戏占用时需要修改配置。
```

打包失败：

```text
先运行 npm run typecheck 和 npm test。
Windows 安装包建议在 Windows 机器上执行 npm run dist:win。
```
