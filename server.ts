import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

interface Player {
  id: string;
  name: string;
  role: 'X' | 'O';
  ws: WebSocket;
  connected: boolean;
}

interface Move {
  row: number;
  col: number;
  player: 'X' | 'O';
  timestamp: number;
}

interface ChatMessage {
  id: string;
  sender: string;
  senderRole?: 'X' | 'O' | 'system';
  text: string;
  type: 'chat' | 'emoji' | 'system';
  time: string;
}

interface Room {
  id: string;
  name: string;
  createdAt: number;
  isPublic: boolean;
  timePerTurn: number; // in seconds, 0 = unlimited
  ruleBlockedEnds: boolean; // if true, 5 in a row blocked at both ends doesn't win
  boardSize: number; // 15
  players: {
    X?: Player;
    O?: Player;
  };
  spectators: { id: string; name: string; ws: WebSocket }[];
  board: (string | null)[][];
  currentTurn: 'X' | 'O';
  winner: 'X' | 'O' | 'DRAW' | null;
  winningLine: { row: number; col: number }[] | null;
  lastMove: { row: number; col: number } | null;
  moveHistory: Move[];
  status: 'waiting' | 'playing' | 'ended';
  chatMessages: ChatMessage[];
  rematchRequests: { X?: boolean; O?: boolean };
  turnDeadline: number | null; // timestamp when turn expires
}

const rooms = new Map<string, Room>();

// Helper to generate 6-digit room code
function generateRoomCode(): string {
  let code = '';
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (rooms.has(code));
  return code;
}

// Check Gomoku win condition (5 in a row)
function checkWin(
  board: (string | null)[][],
  row: number,
  col: number,
  player: 'X' | 'O',
  boardSize: number,
  ruleBlockedEnds: boolean
): { win: boolean; line: { row: number; col: number }[] } | null {
  const directions = [
    [0, 1],   // Horizontal
    [1, 0],   // Vertical
    [1, 1],   // Diagonal Down-Right
    [1, -1],  // Diagonal Down-Left
  ];

  for (const [dr, dc] of directions) {
    const line: { row: number; col: number }[] = [{ row, col }];

    // Check positive direction
    let r = row + dr;
    let c = col + dc;
    let posBlocked = false;
    while (r >= 0 && r < boardSize && c >= 0 && c < boardSize && board[r][c] === player) {
      line.push({ row: r, col: c });
      r += dr;
      c += dc;
    }
    if (r >= 0 && r < boardSize && c >= 0 && c < boardSize && board[r][c] !== null) {
      posBlocked = true;
    } else if (r < 0 || r >= boardSize || c < 0 || c >= boardSize) {
      posBlocked = true;
    }

    // Check negative direction
    r = row - dr;
    c = col - dc;
    let negBlocked = false;
    while (r >= 0 && r < boardSize && c >= 0 && c < boardSize && board[r][c] === player) {
      line.unshift({ row: r, col: c });
      r -= dr;
      c -= dc;
    }
    if (r >= 0 && r < boardSize && c >= 0 && c < boardSize && board[r][c] !== null) {
      negBlocked = true;
    } else if (r < 0 || r >= boardSize || c < 0 || c >= boardSize) {
      negBlocked = true;
    }

    if (line.length >= 5) {
      // If ruleBlockedEnds is true, 5 in a row blocked on BOTH ends does NOT win (requires open 5 or blocked on max 1 end)
      if (ruleBlockedEnds && line.length === 5 && posBlocked && negBlocked) {
        continue;
      }
      return { win: true, line };
    }
  }

  return null;
}

function checkDraw(board: (string | null)[][], boardSize: number): boolean {
  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      if (board[r][c] === null) return false;
    }
  }
  return true;
}

function sanitizeRoomState(room: Room) {
  return {
    id: room.id,
    name: room.name,
    createdAt: room.createdAt,
    isPublic: room.isPublic,
    timePerTurn: room.timePerTurn,
    ruleBlockedEnds: room.ruleBlockedEnds,
    boardSize: room.boardSize,
    players: {
      X: room.players.X ? { name: room.players.X.name, connected: room.players.X.connected } : null,
      O: room.players.O ? { name: room.players.O.name, connected: room.players.O.connected } : null,
    },
    spectatorCount: room.spectators.length,
    board: room.board,
    currentTurn: room.currentTurn,
    winner: room.winner,
    winningLine: room.winningLine,
    lastMove: room.lastMove,
    moveHistory: room.moveHistory,
    status: room.status,
    chatMessages: room.chatMessages,
    rematchRequests: room.rematchRequests,
    turnDeadline: room.turnDeadline,
  };
}

function broadcastToRoom(room: Room, type: string, payload: any) {
  const msg = JSON.stringify({ type, ...payload });
  if (room.players.X?.ws.readyState === WebSocket.OPEN) {
    room.players.X.ws.send(msg);
  }
  if (room.players.O?.ws.readyState === WebSocket.OPEN) {
    room.players.O.ws.send(msg);
  }
  room.spectators.forEach((s) => {
    if (s.ws.readyState === WebSocket.OPEN) {
      s.ws.send(msg);
    }
  });
}

function addSystemMessage(room: Room, text: string) {
  const msg: ChatMessage = {
    id: Math.random().toString(36).substring(2, 9),
    sender: 'Hệ thống',
    senderRole: 'system',
    text,
    type: 'system',
    time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
  };
  room.chatMessages.push(msg);
}

// Clean up stale rooms after 2 hours
setInterval(() => {
  const now = Date.now();
  for (const [id, room] of rooms.entries()) {
    if (now - room.createdAt > 2 * 60 * 60 * 1000 && !room.players.X?.connected && !room.players.O?.connected) {
      rooms.delete(id);
    }
  }
}, 30 * 60 * 1000);

async function startServer() {
  const app = express();
  const PORT = 3000;
  const server = http.createServer(app);

  app.use(express.json());

  // API endpoints
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.get('/api/rooms', (_req, res) => {
    const publicRooms = Array.from(rooms.values())
      .filter((r) => r.isPublic && r.status !== 'ended')
      .map((r) => ({
        id: r.id,
        name: r.name,
        playersCount: (r.players.X ? 1 : 0) + (r.players.O ? 1 : 0),
        status: r.status,
        timePerTurn: r.timePerTurn,
        hostName: r.players.X?.name || 'Khách',
      }));
    res.json({ rooms: publicRooms });
  });

  // Create WebSocket Server
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    let currentRoomId: string | null = null;
    let clientPlayerId: string = Math.random().toString(36).substring(2, 9);

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        const { type } = message;

        if (type === 'CREATE_ROOM') {
          const { playerName, isPublic = true, timePerTurn = 30, ruleBlockedEnds = false, roomName } = message;
          const roomId = generateRoomCode();
          const boardSize = 20;

          const emptyBoard: (string | null)[][] = Array(boardSize)
            .fill(null)
            .map(() => Array(boardSize).fill(null));

          const player: Player = {
            id: clientPlayerId,
            name: playerName || 'Người chơi 1',
            role: 'X',
            ws,
            connected: true,
          };

          const room: Room = {
            id: roomId,
            name: roomName || `Phòng của ${player.name}`,
            createdAt: Date.now(),
            isPublic,
            timePerTurn: Number(timePerTurn) || 30,
            ruleBlockedEnds: Boolean(ruleBlockedEnds),
            boardSize,
            players: { X: player },
            spectators: [],
            board: emptyBoard,
            currentTurn: 'X',
            winner: null,
            winningLine: null,
            lastMove: null,
            moveHistory: [],
            status: 'waiting',
            chatMessages: [],
            rematchRequests: {},
            turnDeadline: null,
          };

          addSystemMessage(room, `Phòng ${roomId} đã được tạo bởi ${player.name}. Đang chờ đối thủ...`);
          rooms.set(roomId, room);
          currentRoomId = roomId;

          ws.send(
            JSON.stringify({
              type: 'ROOM_CREATED',
              roomId,
              role: 'X',
              roomState: sanitizeRoomState(room),
            })
          );
        } else if (type === 'JOIN_ROOM') {
          const { roomId, playerName } = message;
          const room = rooms.get(roomId);

          if (!room) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Không tìm thấy phòng chơi này!' }));
            return;
          }

          currentRoomId = roomId;

          let role: 'X' | 'O' | 'spectator' = 'spectator';
          const pName = playerName || 'Người chơi';

          if (!room.players.X) {
            role = 'X';
            room.players.X = { id: clientPlayerId, name: pName, role: 'X', ws, connected: true };
          } else if (!room.players.O && room.players.X.id !== clientPlayerId) {
            role = 'O';
            room.players.O = { id: clientPlayerId, name: pName, role: 'O', ws, connected: true };
            room.status = 'playing';
            if (room.timePerTurn > 0) {
              room.turnDeadline = Date.now() + room.timePerTurn * 1000;
            }
            addSystemMessage(room, `${pName} đã tham gia! Trận đấu bắt đầu! Lượt của X (${room.players.X.name}).`);
          } else {
            // Spectator or reconnecting player
            if (room.players.X?.id === clientPlayerId) {
              role = 'X';
              room.players.X.ws = ws;
              room.players.X.connected = true;
              addSystemMessage(room, `${room.players.X.name} (X) đã kết nối lại.`);
            } else if (room.players.O?.id === clientPlayerId) {
              role = 'O';
              room.players.O.ws = ws;
              room.players.O.connected = true;
              addSystemMessage(room, `${room.players.O.name} (O) đã kết nối lại.`);
            } else {
              role = 'spectator';
              room.spectators.push({ id: clientPlayerId, name: pName, ws });
              addSystemMessage(room, `${pName} đang xem trận đấu.`);
            }
          }

          ws.send(
            JSON.stringify({
              type: 'ROOM_JOINED',
              roomId,
              role,
              roomState: sanitizeRoomState(room),
            })
          );

          broadcastToRoom(room, 'ROOM_UPDATED', { roomState: sanitizeRoomState(room) });
        } else if (type === 'MAKE_MOVE') {
          const { roomId, row, col } = message;
          const room = rooms.get(roomId);

          if (!room) return;
          if (room.status !== 'playing') return;

          const isX = room.players.X?.id === clientPlayerId;
          const isO = room.players.O?.id === clientPlayerId;

          if ((room.currentTurn === 'X' && !isX) || (room.currentTurn === 'O' && !isO)) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Chưa đến lượt của bạn!' }));
            return;
          }

          if (row < 0 || row >= room.boardSize || col < 0 || col >= room.boardSize) return;
          if (room.board[row][col] !== null) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Ô này đã có quân cờ!' }));
            return;
          }

          const currentPlayer = room.currentTurn;
          room.board[row][col] = currentPlayer;
          room.lastMove = { row, col };
          room.moveHistory.push({ row, col, player: currentPlayer, timestamp: Date.now() });

          // Check win
          const winResult = checkWin(room.board, row, col, currentPlayer, room.boardSize, room.ruleBlockedEnds);

          if (winResult?.win) {
            room.winner = currentPlayer;
            room.winningLine = winResult.line;
            room.status = 'ended';
            room.turnDeadline = null;
            const winnerName = currentPlayer === 'X' ? room.players.X?.name : room.players.O?.name;
            addSystemMessage(room, `🎉 CHÚC MỪNG! ${winnerName} (${currentPlayer}) ĐÃ CHIẾN THẮNG!`);
          } else if (checkDraw(room.board, room.boardSize)) {
            room.winner = 'DRAW';
            room.status = 'ended';
            room.turnDeadline = null;
            addSystemMessage(room, `🤝 Trận đấu hòa! Cả hai bên đã lấp đầy bàn cờ.`);
          } else {
            // Switch turn
            room.currentTurn = currentPlayer === 'X' ? 'O' : 'X';
            if (room.timePerTurn > 0) {
              room.turnDeadline = Date.now() + room.timePerTurn * 1000;
            }
          }

          broadcastToRoom(room, 'ROOM_UPDATED', { roomState: sanitizeRoomState(room) });
        } else if (type === 'SEND_CHAT') {
          const { roomId, text, chatType = 'chat' } = message;
          const room = rooms.get(roomId);
          if (!room) return;

          let senderName = 'Khán giả';
          let senderRole: 'X' | 'O' | 'system' = 'system';

          if (room.players.X?.id === clientPlayerId) {
            senderName = room.players.X.name;
            senderRole = 'X';
          } else if (room.players.O?.id === clientPlayerId) {
            senderName = room.players.O.name;
            senderRole = 'O';
          }

          const chatMsg: ChatMessage = {
            id: Math.random().toString(36).substring(2, 9),
            sender: senderName,
            senderRole,
            text: text.slice(0, 150),
            type: chatType,
            time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          };

          room.chatMessages.push(chatMsg);
          broadcastToRoom(room, 'CHAT_MESSAGE', { message: chatMsg, roomState: sanitizeRoomState(room) });
        } else if (type === 'REQUEST_REMATCH') {
          const { roomId } = message;
          const room = rooms.get(roomId);
          if (!room || room.status !== 'ended') return;

          let playerRole: 'X' | 'O' | null = null;
          if (room.players.X?.id === clientPlayerId) playerRole = 'X';
          if (room.players.O?.id === clientPlayerId) playerRole = 'O';

          if (!playerRole) return;

          room.rematchRequests[playerRole] = true;

          const pName = playerRole === 'X' ? room.players.X?.name : room.players.O?.name;
          addSystemMessage(room, `${pName} muốn đấu lại trận mới!`);

          if (room.rematchRequests.X && room.rematchRequests.O) {
            // Reset board for new game
            room.board = Array(room.boardSize)
              .fill(null)
              .map(() => Array(room.boardSize).fill(null));
            room.status = 'playing';
            room.winner = null;
            room.winningLine = null;
            room.lastMove = null;
            room.moveHistory = [];
            room.rematchRequests = {};
            // Swap starting turn
            room.currentTurn = Math.random() > 0.5 ? 'X' : 'O';
            if (room.timePerTurn > 0) {
              room.turnDeadline = Date.now() + room.timePerTurn * 1000;
            }
            addSystemMessage(room, `🎮 Ván mới đã bắt đầu! ${room.currentTurn} đánh trước.`);
          }

          broadcastToRoom(room, 'ROOM_UPDATED', { roomState: sanitizeRoomState(room) });
        } else if (type === 'SURRENDER') {
          const { roomId } = message;
          const room = rooms.get(roomId);
          if (!room || room.status !== 'playing') return;

          let surrenderingPlayer: 'X' | 'O' | null = null;
          if (room.players.X?.id === clientPlayerId) surrenderingPlayer = 'X';
          if (room.players.O?.id === clientPlayerId) surrenderingPlayer = 'O';

          if (!surrenderingPlayer) return;

          const winner = surrenderingPlayer === 'X' ? 'O' : 'X';
          room.winner = winner;
          room.status = 'ended';
          room.turnDeadline = null;

          const surName = surrenderingPlayer === 'X' ? room.players.X?.name : room.players.O?.name;
          const winName = winner === 'X' ? room.players.X?.name : room.players.O?.name;

          addSystemMessage(room, `🏳️ ${surName} đã đầu hàng. ${winName} chiến thắng!`);
          broadcastToRoom(room, 'ROOM_UPDATED', { roomState: sanitizeRoomState(room) });
        } else if (type === 'GET_PUBLIC_ROOMS') {
          const publicRooms = Array.from(rooms.values())
            .filter((r) => r.isPublic && r.status === 'waiting')
            .map((r) => ({
              id: r.id,
              name: r.name,
              playersCount: (r.players.X ? 1 : 0) + (r.players.O ? 1 : 0),
              status: r.status,
              timePerTurn: r.timePerTurn,
              hostName: r.players.X?.name || 'Khách',
            }));
          ws.send(JSON.stringify({ type: 'PUBLIC_ROOMS_LIST', rooms: publicRooms }));
        }
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    });

    ws.on('close', () => {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (!room) return;

      if (room.players.X?.id === clientPlayerId) {
        room.players.X.connected = false;
        addSystemMessage(room, `${room.players.X.name} (X) đã mất kết nối.`);
      } else if (room.players.O?.id === clientPlayerId) {
        room.players.O.connected = false;
        addSystemMessage(room, `${room.players.O.name} (O) đã mất kết nối.`);
      } else {
        room.spectators = room.spectators.filter((s) => s.id !== clientPlayerId);
      }

      broadcastToRoom(room, 'ROOM_UPDATED', { roomState: sanitizeRoomState(room) });
    });
  });

  // Turn Timeout Monitor Interval
  setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
      if (room.status === 'playing' && room.turnDeadline && now > room.turnDeadline) {
        const timedOutPlayer = room.currentTurn;
        const winner = timedOutPlayer === 'X' ? 'O' : 'X';
        room.winner = winner;
        room.status = 'ended';
        room.turnDeadline = null;

        const loserName = timedOutPlayer === 'X' ? room.players.X?.name : room.players.O?.name;
        const winnerName = winner === 'X' ? room.players.X?.name : room.players.O?.name;

        addSystemMessage(room, `⏰ ${loserName} đã hết thời gian suy nghĩ! ${winnerName} thắng cuộc!`);
        broadcastToRoom(room, 'ROOM_UPDATED', { roomState: sanitizeRoomState(room) });
      }
    }
  }, 1000);

  // Vite middleware in dev
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Caro Express Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
