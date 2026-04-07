# Douyin Live Overlay Bridge Service

独立 Bridge 示例服务，用于把任意已授权外部事件源转换为 Douyin Live Overlay Assistant 的统一事件模型，并通过 WebSocket 推送到本机 Overlay。

默认监听：

```text
ws://127.0.0.1:17891
```

启动：

```bash
npm run bridge:sample
```

也可以把本目录作为独立服务运行：

```bash
cd bridge-service
npm install
npm run start:sample
```

自定义事件文件：

```bash
npm run bridge:sample -- --file bridge-service/sample-events.json --interval 1000 --port 17891
```

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

接入真实外部数据源时，只需要替换 `sample-events.json` 的来源或在 `src/server.ts` 中把你自己的授权数据源回调转换为 `LiveEvent`，再调用同样的 envelope 发送逻辑。不要在 Overlay 主工程里写私有抓包或逆向逻辑。
