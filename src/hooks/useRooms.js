import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchRooms, createWebSocket } from '../api';

export default function useRooms() {
  const [rooms, setRooms] = useState([]);
  const [floor, setFloor] = useState(2);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const updateRooms = useCallback((data) => {
    setRooms((prev) => data.map((room) => {
      const existing = prev.find((item) => item.room_id === room.room_id);
      return existing?.llm ? { ...room, llm: existing.llm } : room;
    }));

    setLastUpdated(new Date().toLocaleTimeString('ko-KR'));
    setSelectedRoom((prev) => {
      if (!prev) return null;
      const matched = data.find((room) => room.room_id === prev.room_id);
      return matched ? { ...matched, llm: prev.llm } : prev;
    });
  }, []);

  const setRoomLlm = useCallback((roomId, llm) => {
    setRooms((prev) => prev.map((room) => (
      room.room_id === roomId ? { ...room, llm } : room
    )));
    setSelectedRoom((prev) => (
      prev?.room_id === roomId ? { ...prev, llm } : prev
    ));
  }, []);

  const loadRooms = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchRooms();
      updateRooms(data);
    } catch (error) {
      console.error('데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  }, [updateRooms]);

  useEffect(() => {
    loadRooms();
    const interval = setInterval(loadRooms, 300000);
    return () => clearInterval(interval);
  }, [loadRooms]);

  useEffect(() => {
    let ws;
    let reconnectTimer;

    const connect = () => {
      try {
        ws = createWebSocket(
          (msg) => {
            if (msg.type === 'update' && msg.data) {
              updateRooms(msg.data);
            }
          },
          () => {
            setIsLive(false);
            reconnectTimer = setTimeout(connect, 5000);
          }
        );

        ws.onopen = () => setIsLive(true);
        ws.onclose = () => {
          setIsLive(false);
          reconnectTimer = setTimeout(connect, 5000);
        };
      } catch {
        setIsLive(false);
        reconnectTimer = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [updateRooms]);

  const floorRooms = useMemo(
    () => rooms.filter((room) => room.floor === floor),
    [rooms, floor]
  );
  const dangerRooms = useMemo(
    () => rooms.filter((room) => ['danger', 'abnormal'].includes(room.hasState)),
    [rooms]
  );

  return {
    rooms,
    floor,
    selectedRoom,
    loading,
    isLive,
    lastUpdated,
    floorRooms,
    dangerRooms,
    setFloor,
    setSelectedRoom,
    setRoomLlm,
    loadRooms,
  };
}
