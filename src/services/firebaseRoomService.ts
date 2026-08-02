import {
  db,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
  getDoc,
  getDocs,
  arrayUnion,
  deleteDoc,
} from '../lib/firebase';
import { OnlineRoomState, PlayerSymbol, Move, ChatMessage } from '../types';
import { createEmptyBoard, BOARD_SIZE, serializeBoard, deserializeBoard } from '../utils/caroLogic';
import firebaseConfig from '../../firebase-applet-config.json';

const ROOMS_COLLECTION = 'caro_rooms';

// Generate a clean 6-digit room code if not provided
export function generateRoomId(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Create a new room in Firebase Firestore
 */
export async function createRoom(options: {
  roomId?: string;
  roomName: string;
  hostName: string;
  isPublic: boolean;
  timePerTurn: number;
  ruleBlockedEnds: boolean;
}): Promise<{ roomId: string; role: 'X' }> {
  const roomId = options.roomId?.trim() || generateRoomId();
  const roomRef = doc(db, ROOMS_COLLECTION, roomId);

  const initialBoard = createEmptyBoard();
  const initialRoom: OnlineRoomState = {
    id: roomId,
    name: options.roomName || `Phòng ${roomId}`,
    createdAt: Date.now(),
    isPublic: options.isPublic,
    timePerTurn: options.timePerTurn || 30,
    ruleBlockedEnds: options.ruleBlockedEnds || false,
    boardSize: BOARD_SIZE,
    players: {
      X: { name: options.hostName || 'Người chơi 1', connected: true },
      O: null,
    },
    spectatorCount: 0,
    board: initialBoard,
    currentTurn: 'X',
    winner: null,
    winningLine: null,
    lastMove: null,
    moveHistory: [],
    status: 'waiting',
    chatMessages: [
      {
        id: 'sys-1',
        sender: 'Hệ thống',
        senderRole: 'system',
        text: `Đã tạo phòng ${roomId}. Đang chờ đối thủ...`,
        type: 'system',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ],
    rematchRequests: {},
    turnDeadline: Date.now() + (options.timePerTurn || 30) * 1000,
    lastHeartbeat: Date.now(),
  };

  const firestorePayload = {
    ...initialRoom,
    board: serializeBoard(initialBoard),
  };

  await setDoc(roomRef, firestorePayload);
  return { roomId, role: 'X' };
}

/**
 * Join an existing room in Firebase Firestore
 */
export async function joinRoom(
  roomId: string,
  playerName: string
): Promise<{ room: OnlineRoomState; role: 'X' | 'O' | 'spectator' }> {
  const roomRef = doc(db, ROOMS_COLLECTION, roomId);
  const snap = await getDoc(roomRef);

  if (!snap.exists()) {
    throw new Error('Phòng không tồn tại. Vui lòng kiểm tra lại mã phòng!');
  }

  const rawData = snap.data();
  const roomData: OnlineRoomState = {
    ...(rawData as any),
    board: deserializeBoard(rawData.board, rawData.boardSize || BOARD_SIZE),
  };

  let role: 'X' | 'O' | 'spectator' = 'spectator';
  const updatedPlayers = { ...roomData.players };
  let newStatus = roomData.status;

  // 1. Check if player is already assigned as X or O
  if (roomData.players.X?.name === playerName) {
    role = 'X';
    updatedPlayers.X = { name: playerName, connected: true };
  } else if (roomData.players.O?.name === playerName) {
    role = 'O';
    updatedPlayers.O = { name: playerName, connected: true };
  } else if (!roomData.players.X) {
    role = 'X';
    updatedPlayers.X = { name: playerName, connected: true };
  } else if (!roomData.players.O) {
    role = 'O';
    updatedPlayers.O = { name: playerName, connected: true };
  } else {
    role = 'spectator';
  }

  const isFullPlayers = updatedPlayers.X && updatedPlayers.O;
  if (isFullPlayers && (role === 'X' || role === 'O')) {
    if (newStatus !== 'ended') {
      newStatus = 'playing';
    }
  }

  const wasAlreadyInRoom =
    (role === 'X' && roomData.players.X?.name === playerName) ||
    (role === 'O' && roomData.players.O?.name === playerName);

  const updates: Partial<OnlineRoomState> = {
    players: updatedPlayers,
    status: newStatus,
    lastHeartbeat: Date.now(),
    spectatorCount:
      role === 'spectator' && !wasAlreadyInRoom
        ? (roomData.spectatorCount || 0) + 1
        : roomData.spectatorCount,
  };

  if (!wasAlreadyInRoom) {
    const joinMessage: ChatMessage = {
      id: 'sys-' + Date.now(),
      sender: 'Hệ thống',
      senderRole: 'system',
      text: `${playerName} đã tham gia phòng với vai trò ${
        role === 'spectator' ? 'Khán giả' : 'Người chơi ' + role
      }.`,
      type: 'system',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    updates.chatMessages = [...(roomData.chatMessages || []), joinMessage];
  }

  // Reset board to start fresh only if a NEW second player joined
  const isNewPlayerJoiningFullGame = !wasAlreadyInRoom && isFullPlayers && (role === 'X' || role === 'O');
  if (isNewPlayerJoiningFullGame) {
    updates.board = createEmptyBoard();
    updates.currentTurn = 'X';
    updates.winner = null;
    updates.winningLine = null;
    updates.lastMove = null;
    updates.moveHistory = [];
    updates.turnDeadline = Date.now() + roomData.timePerTurn * 1000;
  }

  const firestoreUpdates: any = { ...updates };
  if (updates.board) {
    firestoreUpdates.board = serializeBoard(updates.board);
  }

  await updateDoc(roomRef, firestoreUpdates);

  return {
    room: { ...roomData, ...updates },
    role,
  };
}

/**
 * Subscribe to real-time updates for a single room
 */
export function subscribeToRoom(
  roomId: string,
  onUpdate: (room: OnlineRoomState | null) => void,
  onError?: (err: Error) => void
) {
  const roomRef = doc(db, ROOMS_COLLECTION, roomId);
  return onSnapshot(
    roomRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const rawData = snapshot.data();
        const room: OnlineRoomState = {
          ...(rawData as any),
          board: deserializeBoard(rawData.board, rawData.boardSize || BOARD_SIZE),
        };
        onUpdate(room);
      } else {
        onUpdate(null);
      }
    },
    (error) => {
      console.error('Firestore room error:', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Scan Firestore and purge abandoned ghost rooms (0 players or created > 2 hours ago)
 */
export async function purgeStaleRooms() {
  try {
    const roomsRef = collection(db, ROOMS_COLLECTION);
    const snap = await getDocs(roomsRef);
    const now = Date.now();
    const MAX_WAITING_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours max lifetime for unjoined waiting rooms

    snap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const roomId = docSnap.id;
      const age = now - (data.createdAt || 0);

      const hasX = Boolean(data.players?.X);
      const hasO = Boolean(data.players?.O);

      const isZeroPlayers = !hasX && !hasO;
      const isStaleWaiting = data.status === 'waiting' && age > MAX_WAITING_AGE_MS;

      if (isZeroPlayers || isStaleWaiting) {
        console.log(`[Auto-Cleanup] Deleting ghost room #${roomId}`);
        deleteDoc(doc(db, ROOMS_COLLECTION, roomId)).catch(() => {});
      }
    });
  } catch (err) {
    console.error('Lỗi khi dọn dẹp phòng cũ:', err);
  }
}

/**
 * Subscribe to list of public rooms
 */
export function subscribeToPublicRooms(
  onUpdate: (
    rooms: { id: string; name: string; playersCount: number; status: string; timePerTurn: number; hostName: string }[]
  ) => void
) {
  // Trigger passive cleanup of ghost/stale rooms on subscription
  purgeStaleRooms();

  const roomsRef = collection(db, ROOMS_COLLECTION);
  const q = query(roomsRef, where('isPublic', '==', true));

  return onSnapshot(q, (snapshot) => {
    const roomsList: { id: string; name: string; playersCount: number; status: string; timePerTurn: number; hostName: string }[] = [];

    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const roomId = docSnap.id;
      let count = 0;
      if (data.players?.X) count++;
      if (data.players?.O) count++;

      const isZeroPlayers = count === 0;

      if (isZeroPlayers) {
        // Delete ghost room in background
        deleteDoc(doc(db, ROOMS_COLLECTION, roomId)).catch(() => {});
        return;
      }

      roomsList.push({
        id: data.id,
        name: data.name || `Phòng ${data.id}`,
        playersCount: count,
        status: data.status || 'waiting',
        timePerTurn: data.timePerTurn || 30,
        hostName: data.players?.X?.name || 'Chủ phòng',
      });
    });

    onUpdate(roomsList);
  });
}

/**
 * Make a move in a Firestore room
 */
export async function makeMoveInFirebase(
  roomId: string,
  row: number,
  col: number,
  player: PlayerSymbol,
  newBoard: (PlayerSymbol | null)[][],
  nextTurn: PlayerSymbol,
  gameStatus: 'waiting' | 'playing' | 'ended',
  winner: PlayerSymbol | 'DRAW' | null,
  winningLine: { row: number; col: number }[] | null,
  moveHistory: Move[],
  timePerTurn: number
) {
  const roomRef = doc(db, ROOMS_COLLECTION, roomId);

  const updates: any = {
    board: serializeBoard(newBoard),
    currentTurn: nextTurn,
    status: gameStatus,
    winner,
    winningLine,
    lastMove: { row, col },
    moveHistory,
    turnDeadline: gameStatus === 'playing' ? Date.now() + timePerTurn * 1000 : null,
  };

  if (gameStatus === 'ended') {
    let endText = '';
    try {
      const snap = await getDoc(roomRef);
      if (snap.exists()) {
        const roomData = snap.data();
        if (winner && winner !== 'DRAW') {
          const winnerPlayer = roomData.players?.[winner];
          const winnerName = winnerPlayer?.name || `Người chơi ${winner}`;
          endText = `Kết thúc trận đấu, ${winnerName} (cầm quân ${winner}) đã giành chiến thắng!`;
        } else {
          endText = 'Kết thúc trận đấu, hai người chơi hòa cờ!';
        }
      } else {
        endText = winner === 'DRAW' ? 'Kết thúc trận đấu, hai người chơi hòa cờ!' : `Kết thúc trận đấu, người chơi ${winner} (cầm quân ${winner}) đã giành chiến thắng!`;
      }
    } catch {
      endText = winner === 'DRAW' ? 'Kết thúc trận đấu, hai người chơi hòa cờ!' : `Kết thúc trận đấu, người chơi ${winner} (cầm quân ${winner}) đã giành chiến thắng!`;
    }

    const sysMsg: ChatMessage = {
      id: 'sys-' + Date.now(),
      sender: 'Hệ thống',
      senderRole: 'system',
      text: endText,
      type: 'system',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Use arrayUnion for system chat message
    await updateDoc(roomRef, {
      ...updates,
      chatMessages: arrayUnion(sysMsg),
    });
  } else {
    await updateDoc(roomRef, updates);
  }
}

/**
 * Send chat or emoji in room
 */
export async function sendChatMessage(
  roomId: string,
  sender: string,
  senderRole: 'X' | 'O' | 'spectator',
  text: string,
  type: 'chat' | 'emoji' = 'chat'
) {
  const roomRef = doc(db, ROOMS_COLLECTION, roomId);
  const newMsg: ChatMessage = {
    id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
    sender,
    senderRole: senderRole === 'spectator' ? 'system' : senderRole,
    text,
    type,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };

  await updateDoc(roomRef, {
    chatMessages: arrayUnion(newMsg),
  });
}

/**
 * Handle turn timeout in online mode: automatically pass turn to next player
 */
export async function handleOnlineTimeout(roomId: string, currentTurn: PlayerSymbol, timePerTurn: number) {
  const roomRef = doc(db, ROOMS_COLLECTION, roomId);
  const nextTurn = currentTurn === 'X' ? 'O' : 'X';
  const sysMsg: ChatMessage = {
    id: 'sys-' + Date.now(),
    sender: 'Hệ thống',
    senderRole: 'system',
    text: `Hết thời gian (${timePerTurn || 30}s)! Lượt đi tự động chuyển sang cho quân ${nextTurn}.`,
    type: 'system',
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };

  try {
    await updateDoc(roomRef, {
      currentTurn: nextTurn,
      turnDeadline: Date.now() + (timePerTurn || 30) * 1000,
      chatMessages: arrayUnion(sysMsg),
    });
  } catch (err) {
    console.error('Error handling online timeout:', err);
  }
}

/**
 * Request or accept rematch
 */
export async function requestRematch(roomId: string, playerRole: 'X' | 'O', currentRoomState: OnlineRoomState) {
  const roomRef = doc(db, ROOMS_COLLECTION, roomId);
  const otherRole = playerRole === 'X' ? 'O' : 'X';
  const rematchRequests = { ...(currentRoomState.rematchRequests || {}), [playerRole]: true };

  if (rematchRequests[otherRole]) {
    // Both agreed to rematch! Reset board
    const timePerTurn = currentRoomState.timePerTurn || 30;
    const resetUpdates: any = {
      board: serializeBoard(createEmptyBoard()),
      currentTurn: 'X',
      status: 'playing',
      winner: null,
      winningLine: null,
      lastMove: null,
      moveHistory: [],
      rematchRequests: {},
      turnDeadline: Date.now() + timePerTurn * 1000,
    };

    const sysMsg: ChatMessage = {
      id: 'sys-' + Date.now(),
      sender: 'Hệ thống',
      senderRole: 'system',
      text: 'Cả hai người chơi đã đồng ý ván mới! Bắt đầu ván mới.',
      type: 'system',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    await updateDoc(roomRef, {
      ...resetUpdates,
      chatMessages: arrayUnion(sysMsg),
    });
  } else {
    // Just request rematch
    const requesterName = currentRoomState.players[playerRole]?.name || `Người chơi ${playerRole}`;
    const sysMsg: ChatMessage = {
      id: 'sys-' + Date.now(),
      sender: 'Hệ thống',
      senderRole: 'system',
      text: `${requesterName} đã yêu cầu ván mới. Đang chờ đối thủ đồng ý...`,
      type: 'system',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    await updateDoc(roomRef, {
      rematchRequests,
      chatMessages: arrayUnion(sysMsg),
    });
  }
}

/**
 * Keepalive REST handler for browser tab close / window unload events
 */
export function leaveRoomKeepAlive(roomId: string, playerRole: 'X' | 'O' | 'spectator' | null) {
  if (!roomId || !playerRole || playerRole === 'spectator') return;

  const projectId = firebaseConfig.projectId;
  const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
  const apiKey = firebaseConfig.apiKey;

  if (!projectId || !apiKey) return;

  const restUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/${ROOMS_COLLECTION}/${roomId}?key=${apiKey}`;

  // If host (X) leaves or if both players leave, delete room document via REST with keepalive: true
  if (playerRole === 'X') {
    fetch(restUrl, {
      method: 'DELETE',
      keepalive: true,
    }).catch(() => {});
  } else if (playerRole === 'O') {
    // Set players.O to null and status to waiting
    const patchUrl = `${restUrl}&updateMask.fieldPaths=players.O&updateMask.fieldPaths=status`;
    fetch(patchUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          players: {
            mapValue: {
              fields: {
                X: { mapValue: { fields: { name: { stringValue: 'Người chơi X' }, connected: { booleanValue: true } } } },
                O: { nullValue: null },
              },
            },
          },
          status: { stringValue: 'waiting' },
        },
      }),
      keepalive: true,
    }).catch(() => {});
  }
}

/**
 * Leave room and automatically delete room data when both players or host have left
 */
export async function leaveRoom(roomId: string, playerRole: 'X' | 'O' | 'spectator' | null) {
  if (!roomId) return;
  const roomRef = doc(db, ROOMS_COLLECTION, roomId);

  try {
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return;

    const data = snap.data() as OnlineRoomState;
    const updatedPlayers = { ...data.players };

    if (playerRole === 'X') {
      updatedPlayers.X = null;
    } else if (playerRole === 'O') {
      updatedPlayers.O = null;
    } else if (playerRole === 'spectator') {
      await updateDoc(roomRef, {
        spectatorCount: Math.max(0, (data.spectatorCount || 1) - 1),
      });
      return;
    }

    // Auto cleanup: If both players left OR host (X) leaves a waiting room with no O, delete room immediately
    const noPlayersLeft = !updatedPlayers.X && !updatedPlayers.O;
    const hostLeftWaitingRoom = playerRole === 'X' && (data.status === 'waiting' || !updatedPlayers.O);

    if (noPlayersLeft || hostLeftWaitingRoom) {
      await deleteDoc(roomRef);
      console.log(`[Auto-Cleanup] Đã xóa phòng ${roomId} vì tất cả người chơi / chủ phòng đã rời phòng.`);
    } else {
      // One player remains, notify and set room status to waiting
      const leftPlayerName = playerRole ? data.players[playerRole]?.name || playerRole : 'Người chơi';

      const sysMsg: ChatMessage = {
        id: 'sys-' + Date.now(),
        sender: 'Hệ thống',
        senderRole: 'system',
        text: `${leftPlayerName} đã rời phòng. Đang chờ người chơi mới...`,
        type: 'system',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      await updateDoc(roomRef, {
        players: updatedPlayers,
        status: 'waiting',
        lastHeartbeat: Date.now(),
        chatMessages: arrayUnion(sysMsg),
      });
    }
  } catch (e) {
    console.error('Lỗi khi rời phòng:', e);
  }
}
