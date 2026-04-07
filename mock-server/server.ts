import { WebSocketServer } from 'ws';
import { createMockEvent } from '../src/data/mockEvents';

const port = Number(process.env.MOCK_WS_PORT ?? 17890);
const wss = new WebSocketServer({ port });

wss.on('connection', (socket) => {
  socket.send(
    JSON.stringify({
      ...createMockEvent('system'),
      payload: { text: 'Mock WebSocket 已连接' }
    })
  );
});

setInterval(() => {
  const burst = Math.random() > 0.85 ? 6 : 1;
  const messages = Array.from({ length: burst }, () => createMockEvent());
  const payload = burst > 1 ? JSON.stringify(messages) : JSON.stringify(messages[0]);
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    }
  }
}, 260);

console.log(`Mock WebSocket server listening on ws://127.0.0.1:${port}`);
