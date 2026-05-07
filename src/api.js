const WS_URL = process.env.REACT_APP_WS_URL || 'ws://100.79.44.109:6668/ws';

export const fetchRooms = () =>
  fetch('/api/rooms').then(r => r.json());

export const fetchRoom = (roomId) =>
  fetch(`/api/rooms/${roomId}`).then(r => r.json());

export const explainRoom = (roomId) =>
  fetch(`/api/rooms/${roomId}/explain`).then(r => r.json());

export const controlAC = (roomId, action) =>
  fetch(`/api/rooms/${roomId}/ac/${action}`, { method: 'POST' }).then(r => r.json());

export const createWebSocket = (onMessage, onError) => {
  const ws = new WebSocket(WS_URL);
  ws.onmessage = (e) => { try { onMessage(JSON.parse(e.data)); } catch {} };
  ws.onerror = onError;
  return ws;
};
