import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { GameMode, BoardTheme, AIDifficulty, PlayerSymbol, Move, OnlineRoomState, ChatMessage, PlayerStats } from './types';
import { Header } from './components/Header';
import { Board } from './components/Board';
import { Controls } from './components/Controls';
import { OnlineRoomModal } from './components/OnlineRoomModal';
import { ChatPanel } from './components/ChatPanel';
import { StatsModal } from './components/StatsModal';
import { RulesModal } from './components/RulesModal';
import { createEmptyBoard, checkWin, checkDraw, getBestAIMove, getHint, BOARD_SIZE } from './utils/caroLogic';
import { soundFx } from './utils/sound';
import {
  getStoredStats,
  recordGameResult,
  getStoredTheme,
  saveStoredTheme,
  getStoredSound,
  saveStoredSound,
  getStoredPlayerName,
  saveStoredPlayerName,
} from './utils/storage';
import {
  createRoom,
  joinRoom,
  subscribeToRoom,
  subscribeToPublicRooms,
  makeMoveInFirebase,
  sendChatMessage,
  requestRematch,
  leaveRoom,
} from './services/firebaseRoomService';

export default function App() {
  // Application Settings
  const [mode, setMode] = useState<GameMode>('vs-ai');
  const [theme, setTheme] = useState<BoardTheme>(getStoredTheme);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(getStoredSound);
  const [playerName, setPlayerNameState] = useState<string>(getStoredPlayerName);
  const [stats, setStats] = useState<PlayerStats>(getStoredStats);

  // Local Game State
  const [board, setBoard] = useState<(PlayerSymbol | null)[][]>(() => createEmptyBoard());
  const [currentTurn, setCurrentTurn] = useState<PlayerSymbol>('X');
  const [playerSymbol, setPlayerSymbol] = useState<PlayerSymbol>('X'); // Player 1 is X
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>('medium');
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);
  const [ruleBlockedEnds, setRuleBlockedEnds] = useState<boolean>(false);
  const [gameStatus, setGameStatus] = useState<'waiting' | 'playing' | 'ended'>('playing');
  const [winner, setWinner] = useState<PlayerSymbol | 'DRAW' | null>(null);
  const [winningLine, setWinningLine] = useState<{ row: number; col: number }[] | null>(null);
  const [lastMove, setLastMove] = useState<{ row: number; col: number } | null>(null);
  const [moveHistory, setMoveHistory] = useState<Move[]>([]);
  const [hintCell, setHintCell] = useState<{ row: number; col: number } | null>(null);

  // Local Timer (30s per turn in offline mode)
  const [turnTimeLeft, setTurnTimeLeft] = useState<number | null>(30);
  const MAX_TURN_TIME = 30;

  // Modals Visibility
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);

  // WebSocket Online Multiplayer State
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [onlineRoom, setOnlineRoom] = useState<OnlineRoomState | null>(null);
  const [myOnlineRole, setMyOnlineRole] = useState<'X' | 'O' | 'spectator' | null>(null);
  const [publicRooms, setPublicRooms] = useState<
    { id: string; name: string; playersCount: number; status: string; timePerTurn: number; hostName: string }[]
  >([]);
  const [onlineError, setOnlineError] = useState<string | null>(null);

  // Sound Sync
  useEffect(() => {
    soundFx.setEnabled(soundEnabled);
    saveStoredSound(soundEnabled);
  }, [soundEnabled]);

  // Theme Sync
  const handleThemeChange = (newTheme: BoardTheme) => {
    setTheme(newTheme);
    saveStoredTheme(newTheme);
  };

  const handlePlayerNameChange = (name: string) => {
    setPlayerNameState(name);
    saveStoredPlayerName(name);
  };

  // Trigger Victory Confetti Celebration
  const triggerConfetti = useCallback(() => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
    soundFx.playWin();
  }, []);

  // Subscribe to public rooms in online mode
  useEffect(() => {
    if (mode !== 'online') return;

    setIsConnected(true);
    setOnlineError(null);

    const unsubscribe = subscribeToPublicRooms((rooms) => {
      setPublicRooms(rooms);
    });

    return () => {
      unsubscribe();
    };
  }, [mode]);

  // Subscribe to current active room in real-time
  useEffect(() => {
    if (!onlineRoom?.id) return;

    const unsubscribe = subscribeToRoom(
      onlineRoom.id,
      (updatedRoom) => {
        if (!updatedRoom) {
          setOnlineRoom(null);
          setOnlineError('Phòng đã bị đóng hoặc không còn tồn tại.');
          return;
        }

        const prevWinner = onlineRoom?.winner;

        setOnlineRoom(updatedRoom);
        setBoard(updatedRoom.board || createEmptyBoard());
        setCurrentTurn(updatedRoom.currentTurn || 'X');
        setGameStatus(updatedRoom.status || 'waiting');
        setWinner(updatedRoom.winner || null);
        setWinningLine(updatedRoom.winningLine || null);
        setLastMove(updatedRoom.lastMove || null);
        setMoveHistory(updatedRoom.moveHistory || []);
        setRuleBlockedEnds(updatedRoom.ruleBlockedEnds || false);

        if (
          updatedRoom.status === 'ended' &&
          updatedRoom.winner &&
          updatedRoom.winner !== 'DRAW' &&
          prevWinner !== updatedRoom.winner
        ) {
          triggerConfetti();
        }
      },
      (err) => {
        setOnlineError('Lỗi kết nối Firebase: ' + err.message);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [onlineRoom?.id, triggerConfetti]);

  // Local Game Timer Countdown Interval
  useEffect(() => {
    if (mode === 'online') return; // Server handles online timer
    if (gameStatus !== 'playing') return;
    if (moveHistory.length === 0) return; // Timer only starts after player 1 places the first move

    const timer = setInterval(() => {
      setTurnTimeLeft((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          // Timeout! Pass turn automatically
          soundFx.playTick();
          const nextTurn = currentTurn === 'X' ? 'O' : 'X';
          setCurrentTurn(nextTurn);
          return MAX_TURN_TIME;
        }
        if (prev <= 5) {
          soundFx.playTick();
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [mode, gameStatus, currentTurn, moveHistory.length]);

  // Trigger AI Move when in 'vs-ai' mode
  useEffect(() => {
    if (mode !== 'vs-ai') return;
    if (gameStatus !== 'playing') return;
    if (currentTurn !== 'O') return; // AI plays as 'O'

    setIsAiThinking(true);

    const aiTimer = setTimeout(() => {
      const aiMove = getBestAIMove(board, 'O', aiDifficulty, BOARD_SIZE, ruleBlockedEnds);

      if (aiMove) {
        const { row, col } = aiMove;
        const newBoard = board.map((r) => [...r]);
        newBoard[row][col] = 'O';

        soundFx.playPlacePiece(theme);

        const winResult = checkWin(newBoard, row, col, 'O', BOARD_SIZE, ruleBlockedEnds);

        setBoard(newBoard);
        setLastMove({ row, col });
        setMoveHistory((prev) => [...prev, { row, col, player: 'O', timestamp: Date.now() }]);
        setHintCell(null);

        if (winResult.win) {
          setGameStatus('ended');
          setWinner('O');
          setWinningLine(winResult.line);
          const updated = recordGameResult('vs-ai', 'loss');
          setStats(updated);
        } else if (checkDraw(newBoard, BOARD_SIZE)) {
          setGameStatus('ended');
          setWinner('DRAW');
          const updated = recordGameResult('vs-ai', 'draw');
          setStats(updated);
        } else {
          setCurrentTurn('X');
          setTurnTimeLeft(MAX_TURN_TIME);
        }
      }

      setIsAiThinking(false);
    }, 120); // Fast on-device calculation delay

    return () => clearTimeout(aiTimer);
  }, [mode, gameStatus, currentTurn, board, aiDifficulty, ruleBlockedEnds, theme]);

  // Handle Board Cell Click
  const handleCellClick = (row: number, col: number) => {
    if (gameStatus !== 'playing') return;
    if (board[row][col] !== null) return;

    soundFx.playPlacePiece(theme);

    // ONLINE MULTIPLAYER MOVE
    if (mode === 'online') {
      if (!onlineRoom) return;

      const isMyTurn =
        (currentTurn === 'X' && myOnlineRole === 'X') || (currentTurn === 'O' && myOnlineRole === 'O');

      if (!isMyTurn) {
        setOnlineError('Chưa đến lượt của bạn!');
        return;
      }

      const newBoard = board.map((r) => [...r]);
      newBoard[row][col] = currentTurn;

      const winResult = checkWin(newBoard, row, col, currentTurn, BOARD_SIZE, ruleBlockedEnds);
      const newHistory = [...moveHistory, { row, col, player: currentTurn, timestamp: Date.now() }];

      let newStatus: 'waiting' | 'playing' | 'ended' = 'playing';
      let gameWinner: PlayerSymbol | 'DRAW' | null = null;
      let winLine: { row: number; col: number }[] | null = null;

      if (winResult.win) {
        newStatus = 'ended';
        gameWinner = currentTurn;
        winLine = winResult.line;
      } else if (checkDraw(newBoard, BOARD_SIZE)) {
        newStatus = 'ended';
        gameWinner = 'DRAW';
      }

      const nextTurn: PlayerSymbol = currentTurn === 'X' ? 'O' : 'X';

      makeMoveInFirebase(
        onlineRoom.id,
        row,
        col,
        currentTurn,
        newBoard,
        nextTurn,
        newStatus,
        gameWinner,
        winLine,
        newHistory,
        onlineRoom.timePerTurn
      ).catch((err) => {
        setOnlineError('Lỗi gửi nước đi: ' + err.message);
      });

      return;
    }

    // LOCAL / VS AI MOVE
    if (mode === 'vs-ai' && currentTurn !== 'X') return; // Wait for AI turn

    const newBoard = board.map((r) => [...r]);
    newBoard[row][col] = currentTurn;

    const winResult = checkWin(newBoard, row, col, currentTurn, BOARD_SIZE, ruleBlockedEnds);

    setBoard(newBoard);
    setLastMove({ row, col });
    setMoveHistory((prev) => [...prev, { row, col, player: currentTurn, timestamp: Date.now() }]);
    setHintCell(null);

    if (winResult.win) {
      setGameStatus('ended');
      setWinner(currentTurn);
      setWinningLine(winResult.line);
      triggerConfetti();

      const result = currentTurn === 'X' ? 'win' : 'loss';
      const updated = recordGameResult(mode, result);
      setStats(updated);
    } else if (checkDraw(newBoard, BOARD_SIZE)) {
      setGameStatus('ended');
      setWinner('DRAW');
      const updated = recordGameResult(mode, 'draw');
      setStats(updated);
    } else {
      const nextTurn = currentTurn === 'X' ? 'O' : 'X';
      setCurrentTurn(nextTurn);
      setTurnTimeLeft(MAX_TURN_TIME);
    }
  };

  // Undo Last Move (VS AI / Local)
  const handleUndo = () => {
    if (gameStatus !== 'playing') return;
    if (mode === 'online' && myOnlineRole === 'spectator') return;

    if (mode === 'vs-ai') {
      // In VS AI mode, undoing rolls back BOTH AI's last move and player's last move!
      if (moveHistory.length < 2) return;

      const newHistory = [...moveHistory];
      const aiLast = newHistory.pop();
      const playerLast = newHistory.pop();

      const newBoard = createEmptyBoard();
      newHistory.forEach((m) => {
        newBoard[m.row][m.col] = m.player;
      });

      const previousMove = newHistory.length > 0 ? { row: newHistory[newHistory.length - 1].row, col: newHistory[newHistory.length - 1].col } : null;

      setBoard(newBoard);
      setMoveHistory(newHistory);
      setLastMove(previousMove);
      setCurrentTurn('X');
      setHintCell(null);
      setTurnTimeLeft(MAX_TURN_TIME);
      soundFx.playClick();
    } else if (mode === 'local') {
      if (moveHistory.length === 0) return;

      const newHistory = [...moveHistory];
      newHistory.pop();

      const newBoard = createEmptyBoard();
      newHistory.forEach((m) => {
        newBoard[m.row][m.col] = m.player;
      });

      const previousMove = newHistory.length > 0 ? { row: newHistory[newHistory.length - 1].row, col: newHistory[newHistory.length - 1].col } : null;

      setBoard(newBoard);
      setMoveHistory(newHistory);
      setLastMove(previousMove);
      setCurrentTurn(currentTurn === 'X' ? 'O' : 'X');
      setHintCell(null);
      setTurnTimeLeft(MAX_TURN_TIME);
      soundFx.playClick();
    }
  };

  // Hint Request
  const handleHint = () => {
    if (gameStatus !== 'playing') return;
    if (mode === 'online' && myOnlineRole === 'spectator') return;

    const bestCell = getHint(board, currentTurn, BOARD_SIZE, ruleBlockedEnds);
    if (bestCell) {
      setHintCell(bestCell);
      soundFx.playClick();
    }
  };

  // Surrender
  const handleSurrender = () => {
    if (gameStatus !== 'playing') return;

    if (mode === 'online') {
      if (!onlineRoom || !myOnlineRole || myOnlineRole === 'spectator') return;
      const winnerRole: PlayerSymbol = myOnlineRole === 'X' ? 'O' : 'X';
      makeMoveInFirebase(
        onlineRoom.id,
        lastMove?.row || 0,
        lastMove?.col || 0,
        currentTurn,
        board,
        currentTurn,
        'ended',
        winnerRole,
        null,
        moveHistory,
        onlineRoom.timePerTurn
      );
      return;
    }

    const surrenderingWinner = currentTurn === 'X' ? 'O' : 'X';
    setGameStatus('ended');
    setWinner(surrenderingWinner);

    if (mode === 'vs-ai') {
      const updated = recordGameResult('vs-ai', 'loss');
      setStats(updated);
    }
    soundFx.playClick();
  };

  // Restart / Reset Game
  const handleRestart = () => {
    if (mode === 'online') {
      if (!onlineRoom || !myOnlineRole || myOnlineRole === 'spectator') return;
      requestRematch(onlineRoom.id, myOnlineRole, onlineRoom);
      return;
    }

    setBoard(createEmptyBoard());
    setCurrentTurn('X');
    setGameStatus('playing');
    setWinner(null);
    setWinningLine(null);
    setLastMove(null);
    setMoveHistory([]);
    setHintCell(null);
    setIsAiThinking(false);
    setTurnTimeLeft(MAX_TURN_TIME);
    soundFx.playClick();
  };

  // Online Room Operations via Firebase
  const handleCreateOnlineRoom = async (options: {
    roomName: string;
    timePerTurn: number;
    isPublic: boolean;
    ruleBlockedEnds: boolean;
  }) => {
    try {
      setOnlineError(null);
      const { roomId, role } = await createRoom({
        roomName: options.roomName,
        hostName: playerName,
        isPublic: options.isPublic,
        timePerTurn: options.timePerTurn,
        ruleBlockedEnds: options.ruleBlockedEnds,
      });

      setMyOnlineRole(role);
      setOnlineRoom({
        id: roomId,
        name: options.roomName || `Phòng ${roomId}`,
        createdAt: Date.now(),
        isPublic: options.isPublic,
        timePerTurn: options.timePerTurn || 30,
        ruleBlockedEnds: options.ruleBlockedEnds || false,
        boardSize: BOARD_SIZE,
        players: { X: { name: playerName, connected: true }, O: null },
        spectatorCount: 0,
        board: createEmptyBoard(),
        currentTurn: 'X',
        winner: null,
        winningLine: null,
        lastMove: null,
        moveHistory: [],
        status: 'waiting',
        chatMessages: [],
        rematchRequests: {},
        turnDeadline: null,
      });
    } catch (err: any) {
      setOnlineError(err.message || 'Không thể tạo phòng!');
    }
  };

  const handleJoinOnlineRoom = async (code: string) => {
    try {
      setOnlineError(null);
      const { room, role } = await joinRoom(code.trim(), playerName);
      setMyOnlineRole(role);
      setOnlineRoom(room);
    } catch (err: any) {
      setOnlineError(err.message || 'Không thể tham gia phòng!');
    }
  };

  // Handle tab close / unload to clean up online room
  useEffect(() => {
    if (!onlineRoom?.id || !myOnlineRole) return;

    const handleUnload = () => {
      leaveRoom(onlineRoom.id, myOnlineRole);
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [onlineRoom?.id, myOnlineRole]);

  const handleRefreshPublicRooms = () => {
    // Firestore syncs public rooms in real time automatically
  };

  const handleLeaveOnlineRoom = async () => {
    if (!onlineRoom?.id || !myOnlineRole) return;
    await leaveRoom(onlineRoom.id, myOnlineRole);
    setOnlineRoom(null);
    setMyOnlineRole(null);
  };

  const handleSendChatMessage = (text: string, type: 'chat' | 'emoji' = 'chat') => {
    if (!onlineRoom || !myOnlineRole) return;
    sendChatMessage(onlineRoom.id, playerName, myOnlineRole, text, type).catch((err) => {
      console.error('Lỗi gửi tin nhắn:', err);
    });
  };

  return (
    <div className="min-h-screen bg-[#f3efe6] text-amber-950 font-sans flex flex-col justify-between selection:bg-amber-200">
      {/* Header Navigation & Modes */}
      <Header
        mode={mode}
        setMode={(newMode) => {
          setMode(newMode);
          handleRestart();
        }}
        theme={theme}
        setTheme={handleThemeChange}
        soundEnabled={soundEnabled}
        toggleSound={() => setSoundEnabled(!soundEnabled)}
        onOpenStats={() => setIsStatsOpen(true)}
        onOpenRules={() => setIsRulesOpen(true)}
        isSpectator={mode === 'online' && myOnlineRole === 'spectator'}
      />

      {/* Main Content Area */}
      <main className="max-w-6xl w-full mx-auto px-3 py-2 flex-1 flex flex-col justify-center">
        {/* Online Room Modal / Joining view if in online mode and no room active */}
        {mode === 'online' && !onlineRoom ? (
          <OnlineRoomModal
            roomState={onlineRoom}
            playerName={playerName}
            setPlayerName={handlePlayerNameChange}
            onCreateRoom={handleCreateOnlineRoom}
            onJoinRoom={handleJoinOnlineRoom}
            onRefreshPublicRooms={handleRefreshPublicRooms}
            publicRooms={publicRooms}
            isConnected={isConnected}
            errorMsg={onlineError}
          />
        ) : (
          <div className="flex flex-col items-center">
            {/* Online Room Active Banner */}
            {mode === 'online' && onlineRoom && (
              <OnlineRoomModal
                roomState={onlineRoom}
                playerName={playerName}
                setPlayerName={handlePlayerNameChange}
                onCreateRoom={handleCreateOnlineRoom}
                onJoinRoom={handleJoinOnlineRoom}
                onRefreshPublicRooms={handleRefreshPublicRooms}
                onLeaveRoom={handleLeaveOnlineRoom}
                publicRooms={publicRooms}
                isConnected={isConnected}
                errorMsg={onlineError}
              />
            )}

            {/* Game Controls & Turn Indicators */}
            <Controls
              mode={mode}
              currentTurn={currentTurn}
              playerSymbol={playerSymbol}
              aiDifficulty={aiDifficulty}
              setAiDifficulty={setAiDifficulty}
              isAiThinking={isAiThinking}
              ruleBlockedEnds={ruleBlockedEnds}
              setRuleBlockedEnds={setRuleBlockedEnds}
              turnTimeLeft={turnTimeLeft}
              maxTurnTime={MAX_TURN_TIME}
              onUndo={handleUndo}
              onHint={handleHint}
              onSurrender={handleSurrender}
              onRestart={handleRestart}
              canUndo={mode === 'vs-ai' ? moveHistory.length >= 2 : moveHistory.length >= 1}
              gameStatus={gameStatus}
              winner={winner}
              p1Name={
                mode === 'online'
                  ? onlineRoom?.players.X?.name || 'X'
                  : mode === 'local'
                  ? 'Người chơi 1'
                  : 'Bạn'
              }
              p2Name={
                mode === 'vs-ai'
                  ? 'Máy AI (' + (aiDifficulty === 'easy' ? 'Mơ mộng' : aiDifficulty === 'medium' ? 'Hoàng tử Lai' : 'Chúa tể Hắc ám') + ')'
                  : mode === 'online'
                  ? onlineRoom?.players.O?.name || 'Đang chờ O...'
                  : 'Người chơi 2'
              }
              isSpectator={mode === 'online' && myOnlineRole === 'spectator'}
            />

            {/* The Caro Board */}
            <Board
              board={board}
              onCellClick={handleCellClick}
              currentTurn={currentTurn}
              theme={theme}
              lastMove={lastMove}
              winningLine={winningLine}
              hintCell={hintCell}
              disabled={
                gameStatus !== 'playing' ||
                (mode === 'vs-ai' && currentTurn === 'O') ||
                isAiThinking ||
                (mode === 'online' && myOnlineRole === 'spectator')
              }
            />

            {/* Chat & Reaction Panel for Online Mode */}
            {mode === 'online' && onlineRoom && (
              <ChatPanel
                messages={onlineRoom.chatMessages || []}
                onSendMessage={handleSendChatMessage}
                playerName={playerName}
              />
            )}
          </div>
        )}
      </main>

      {/* Footer Poem */}
      <footer className="text-center py-2.5 px-4 text-amber-950 border-t border-amber-300/60 bg-amber-100/40 backdrop-blur-xs">
        <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-center justify-center gap-3 md:gap-8 text-center text-sm md:text-base italic leading-relaxed text-amber-900 font-medium">
          <div className="space-y-0.5">
            <p>Giấy học trò kẻ sẵn những ô vuông,</p>
            <p>Gom hai chữ X, O vào một góc.</p>
            <p>Vai kề vai chung một bàn cờ nhỏ,</p>
            <p>Nét bút nghiêng bày tỏ chút tâm tình.</p>
          </div>
          <div className="hidden md:block w-px h-12 bg-amber-300/80" />
          <div className="space-y-0.5">
            <p>Một đường ngang, năm ô dài theo lối,</p>
            <p>Chữ O tròn vây bọc nét X đan.</p>
            <p>Cờ chưa dứt như lòng đang bối rối,</p>
            <p>Biết bao giờ nối đủ một hàng ngang?</p>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <StatsModal
        isOpen={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
        stats={stats}
        onResetStats={() => {
          const fresh: PlayerStats = {
            vsAiWins: 0,
            vsAiLosses: 0,
            vsAiDraws: 0,
            onlineWins: 0,
            onlineLosses: 0,
            onlineDraws: 0,
            localGames: 0,
            currentStreak: 0,
            maxStreak: 0,
          };
          localStorage.removeItem('caro_game_stats_v1');
          setStats(fresh);
        }}
      />

      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />
    </div>
  );
}
