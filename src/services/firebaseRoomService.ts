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
  arrayUnion,
  deleteDoc,
} from '../lib/firebase';
import { OnlineRoomState, PlayerSymbol, Move, ChatMessage } from '../types';
import { createEmptyBoard, BOARD_SIZE, serializeBoard, deserializeBoard } from '../utils/caroLogic';

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

  if (!roomData.players.X) {
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
    newStatus = 'playing';
  }

  const joinMessage: ChatMessage = {
    id: 'sys-' + Date.now(),
    sender: 'Hệ thống',
    senderRole: 'system',
    text: `${playerName} đã tham gia phòng với vai trò ${role === 'spectator' ? 'Khán giả' : 'Người chơi ' + role}.`,
    type: 'system',
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };

  const updates: Partial<OnlineRoomState> = {
    players: updatedPlayers,
    status: newStatus,
    spectatorCount: role === 'spectator' ? (roomData.spectatorCount || 0) + 1 : roomData.spectatorCount,
    chatMessages: [...(roomData.chatMessages || []), joinMessage],
    turnDeadline: Date.now() + roomData.timePerTurn * 1000,
  };

  // Reset board to start fresh if a player joined to complete the 2-player game
  if (isFullPlayers && (role === 'X' || role === 'O')) {
    updates.board = createEmptyBoard();
    updates.currentTurn = 'X';
    updates.winner = null;
    updates.winningLine = null;
    updates.lastMove = null;
    updates.moveHistory = [];
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
 * Subscribe to list of public rooms
 */
export function subscribeToPublicRooms(
  onUpdate: (
    rooms: { id: string; name: string; playersCount: number; status: string; timePerTurn: number; hostName: string }[]
  ) => void
) {
  const roomsRef = collection(db, ROOMS_COLLECTION);
  const q = query(roomsRef, where('isPublic', '==', true));

  return onSnapshot(q, (snapshot) => {
    const roomsList = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      let count = 0;
      if (data.players?.X) count++;
      if (data.players?.O) count++;

      return {
        id: data.id,
        name: data.name || `Phòng ${data.id}`,
        playersCount: count,
        status: data.status || 'waiting',
        timePerTurn: data.timePerTurn || 30,
        hostName: data.players?.X?.name || 'Chủ phòng',
      };
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
    const endText = winner === 'DRAW' ? 'Hòa cờ!' : `Người chơi ${winner} đã giành chiến thắng!`;
    const sysMsg: ChatMessage = {
      id: 'sys-' + Date.now(),
      sender: 'Hệ thống',
      senderRole: 'system',
      text: `Kết thúc trận đấu: ${endText}`,
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
 * Request or accept rematch
 */
export async function requestRematch(roomId: string, playerRole: 'X' | 'O', currentRoomState: OnlineRoomState) {
  const roomRef = doc(db, ROOMS_COLLECTION, roomId);
  const otherRole = playerRole === 'X' ? 'O' : 'X';
  const rematchRequests = { ...(currentRoomState.rematchRequests || {}), [playerRole]: true };

  if (rematchRequests[otherRole]) {
    // Both agreed to rematch! Reset board
    const resetUpdates: any = {
      board: serializeBoard(createEmptyBoard()),
      currentTurn: 'X',
      status: 'playing',
      winner: null,
      winningLine: null,
      lastMove: null,
      moveHistory: [],
      rematchRequests: {},
      turnDeadline: Date.now() + currentRoomState.timePerTurn * 1000,
    };

    const sysMsg: ChatMessage = {
      id: 'sys-' + Date.now(),
      sender: 'Hệ thống',
      senderRole: 'system',
      text: 'Cả hai người chơi đã đồng ý tái đấu! Bắt đầu ván mới.',
      type: 'system',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    await updateDoc(roomRef, {
      ...resetUpdates,
      chatMessages: arrayUnion(sysMsg),
    });
  } else {
    // Just request rematch
    const sysMsg: ChatMessage = {
      id: 'sys-' + Date.now(),
      sender: 'Hệ thống',
      senderRole: 'system',
      text: `${currentRoomState.players[playerRole]?.name || playerRole} muốn đấu lại!`,
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
 * Leave room and automatically delete room data when both players have left
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

    // Auto cleanup: If both players have left (both X and O are null), delete the room immediately
    if (!updatedPlayers.X && !updatedPlayers.O) {
      await deleteDoc(roomRef);
      console.log(`Đã xóa phòng ${roomId} vì cả 2 người chơi đã rời phòng.`);
    } else {
      // One player remains, notify and set room status to waiting
      const remainingRole = updatedPlayers.X ? 'X' : 'O';
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
        chatMessages: arrayUnion(sysMsg),
      });
    }
  } catch (e) {
    console.error('Lỗi khi rời phòng:', e);
  }
}
