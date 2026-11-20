import type { Difficulty, RunSummary } from '../types';

/**
 * 最佳纪录持久化：与一局状态解耦，只存"赢局里最快通关 / 最高击杀"。
 * localStorage 不可用（隐私模式等）时静默降级为不记录。
 */

const STORAGE_KEY = 'qoder-defense-best';

export interface BestRecord {
  difficulty: Difficulty;
  kills: number;
  elapsedMs: number;
  wins: number;
}

export function loadBest(): BestRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<BestRecord>;
    if (typeof parsed.kills !== 'number' || typeof parsed.elapsedMs !== 'number') {
      return null;
    }
    return {
      difficulty: parsed.difficulty ?? 'normal',
      kills: parsed.kills,
      elapsedMs: parsed.elapsedMs,
      wins: parsed.wins ?? 1
    };
  } catch {
    return null;
  }
}

/** 胜利时尝试刷新纪录；返回是否创造了新纪录（用于结算展示）。 */
export function submitWin(summary: RunSummary, difficulty: Difficulty): boolean {
  const prev = loadBest();
  const better =
    !prev ||
    summary.kills > prev.kills ||
    (summary.kills === prev.kills && summary.elapsedMs < prev.elapsedMs);
  const next: BestRecord = {
    difficulty: better ? difficulty : (prev?.difficulty ?? difficulty),
    kills: better ? summary.kills : (prev?.kills ?? summary.kills),
    elapsedMs: better ? summary.elapsedMs : (prev?.elapsedMs ?? summary.elapsedMs),
    wins: (prev?.wins ?? 0) + 1
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* 忽略持久化失败 */
  }
  return better;
}

export function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
