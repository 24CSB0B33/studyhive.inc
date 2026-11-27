
import { io } from 'socket.io-client';

const SOCKET_SERVER_URL = process.env.REACT_APP_SOCKET_URL || window.location.origin;

let socketInstance = null;

export function getSocket(token) {
  if (!socketInstance) {
    socketInstance = io(SOCKET_SERVER_URL, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    socketInstance.on('connect', () => {
      console.log('[SocketClient] Connected to StudyHive server:', socketInstance.id);
    });

    socketInstance.on('connect_error', (err) => {
      console.warn('[SocketClient] Connection error:', err.message);
    });
  }
  if (token === undefined) return socketInstance;
  if (token) {
    const changed = socketInstance.auth?.token !== token;
    if (changed && socketInstance.connected) socketInstance.disconnect();
    socketInstance.auth = { token };
    if (!socketInstance.connected) socketInstance.connect();
  } else if (socketInstance.connected) socketInstance.disconnect();
  return socketInstance;
}
