import type { PlayerProfile, ProgressState } from "@/types/game";

export type RankingMode = "simple" | "hard" | "speedrun";
export type RankingScope = "global" | "friend";

export interface RankingEntry {
  rank: number;
  nickname: string;
  score: number;
  level: number;
  bestTimeMs?: number;
  metricText: string;
  isMe: boolean;
}

const globalNames = [
  "推理师一号",
  "数独旅人",
  "逻辑玩家",
  "暗号专家",
  "线索猎手",
  "破局者",
  "数字侦探",
  "零点玩家",
  "快手解谜",
  "脑力达人",
];

const friendNames = [
  "微信好友A",
  "微信好友B",
  "微信好友C",
  "微信好友D",
  "微信好友E",
  "微信好友F",
  "微信好友G",
  "微信好友H",
  "微信好友I",
  "微信好友J",
];

export function createLeaderboard(
  profile: PlayerProfile | null,
  progress: ProgressState,
  scope: RankingScope,
  mode: RankingMode = "simple",
): RankingEntry[] {
  const names = scope === "global" ? globalNames : friendNames;
  const entries: Omit<RankingEntry, "rank">[] = Array.from({ length: 50 }, (_, index) => createMockEntry(names[index % names.length], index, mode));

  entries.push(createPlayerEntry(profile, progress, mode));

  return entries
    .sort((a, b) => {
      if (mode === "speedrun") {
        return (a.bestTimeMs ?? Number.MAX_SAFE_INTEGER) - (b.bestTimeMs ?? Number.MAX_SAFE_INTEGER);
      }
      return b.level - a.level;
    })
    .slice(0, 50)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
}

function createMockEntry(nickname: string, index: number, mode: RankingMode): Omit<RankingEntry, "rank"> {
  if (mode === "speedrun") {
    const bestTimeMs = 18000 + index * 1850 + ((index * 7) % 11) * 230;
    return {
      nickname,
      score: bestTimeMs,
      level: Math.max(1, 50 - index),
      bestTimeMs,
      metricText: formatTime(bestTimeMs),
      isMe: false,
    };
  }

  const base = mode === "hard" ? 72 : 96;
  const level = Math.max(1, base - Math.floor(index * (mode === "hard" ? 1.25 : 1.05)));
  return {
    nickname,
    score: level,
    level,
    metricText: `第 ${level} 关`,
    isMe: false,
  };
}

function createPlayerEntry(profile: PlayerProfile | null, progress: ProgressState, mode: RankingMode): Omit<RankingEntry, "rank"> {
  if (mode === "speedrun") {
    const bestTimeMs = progress.bestSpeedMs || Number.MAX_SAFE_INTEGER;
    return {
      nickname: profile?.nickname || "数字玩家",
      score: bestTimeMs,
      level: playerLevel(progress, mode),
      bestTimeMs,
      metricText: progress.bestSpeedMs ? formatTime(progress.bestSpeedMs) : "暂无成绩",
      isMe: true,
    };
  }

  const level = playerLevel(progress, mode);
  return {
    nickname: profile?.nickname || "数字玩家",
    score: level,
    level,
    metricText: `第 ${level} 关`,
    isMe: true,
  };
}

function playerLevel(progress: ProgressState, mode: RankingMode): number {
  return Math.max(1, progress.modeLevels[mode] - 1);
}

function formatTime(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds === Number.MAX_SAFE_INTEGER) return "暂无成绩";
  return `${(milliseconds / 1000).toFixed(2)} 秒`;
}
