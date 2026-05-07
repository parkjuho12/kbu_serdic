const WS_URL = process.env.REACT_APP_WS_URL;

export const fetchRooms = () =>
  fetch('/api/rooms').then(r => r.json());

export const fetchRoomsWithLlm = () =>
  fetch('/api/rooms?include_llm=true').then(r => r.json());

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