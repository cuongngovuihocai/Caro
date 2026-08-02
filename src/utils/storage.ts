import { PlayerStats, BoardTheme } from '../types';

const STATS_KEY = 'caro_game_stats_v1';
const THEME_KEY = 'caro_game_theme_v1';
const SOUND_KEY = 'caro_game_sound_v1';
const PLAYER_NAME_KEY = 'caro_player_name_v1';

export function getStoredStats(): PlayerStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading stats:', e);
  }
  return {
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
}

export function saveStats(stats: PlayerStats) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch (e) {
    console.error('Error saving stats:', e);
  }
}

export function recordGameResult(mode: 'vs-ai' | 'online' | 'local', result: 'win' | 'loss' | 'draw') {
  const stats = getStoredStats();

  if (mode === 'vs-ai') {
    if (result === 'win') {
      stats.vsAiWins++;
      stats.currentStreak++;
      if (stats.currentStreak > stats.maxStreak) stats.maxStreak = stats.currentStreak;
    } else if (result === 'loss') {
      stats.vsAiLosses++;
      stats.currentStreak = 0;
    } else {
      stats.vsAiDraws++;
    }
  } else if (mode === 'online') {
    if (result === 'win') {
      stats.onlineWins++;
      stats.currentStreak++;
      if (stats.currentStreak > stats.maxStreak) stats.maxStreak = stats.currentStreak;
    } else if (result === 'loss') {
      stats.onlineLosses++;
      stats.currentStreak = 0;
    } else {
      stats.onlineDraws++;
    }
  } else if (mode === 'local') {
    stats.localGames++;
  }

  saveStats(stats);
  return stats;
}

export function getStoredTheme(): BoardTheme {
  try {
    const theme = localStorage.getItem(THEME_KEY) as BoardTheme;
    if (theme && ['notebook', 'blackboard'].includes(theme)) return theme;
  } catch (e) {}
  return 'notebook'; // Default notebook theme for nostalgia!
}

export function saveStoredTheme(theme: BoardTheme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (e) {}
}

export function getStoredSound(): boolean {
  try {
    const raw = localStorage.getItem(SOUND_KEY);
    if (raw !== null) return JSON.parse(raw);
  } catch (e) {}
  return true;
}

export function saveStoredSound(enabled: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, JSON.stringify(enabled));
  } catch (e) {}
}

export function getStoredPlayerName(): string {
  try {
    const name = localStorage.getItem(PLAYER_NAME_KEY);
    if (name) return name;
  } catch (e) {}
  return 'Cờ Thủ ' + Math.floor(100 + Math.random() * 900);
}

export function saveStoredPlayerName(name: string) {
  try {
    localStorage.setItem(PLAYER_NAME_KEY, name);
  } catch (e) {}
}
