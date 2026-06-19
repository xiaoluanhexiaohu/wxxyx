import type { PlayerProfile, ProgressState } from "@/types/game";

export type RankingMode = "simple" | "hard" | "speedrun";
export type RankingScope = "global" | "friend";

export interface RankingEntry {
  rank: number;
  nickname: string;
  score: number;
  level: number;
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
  const base = mode === "hard" ? 65 : mode === "speedrun" ? 45 : 80;
  const step = mode === "hard" ? 1.4 : mode === "speedrun" ? 0.8 : 1;
  const entries: Omit<RankingEntry, "rank">[] = Array.from({ length: 50 }, (_, index) => {
    const level = Math.max(1, Math.floor(base - index * step + ((index * 7) % 9)));
    return {
      nickname: `${names[index % names.length]}${index + 1}`,
      score: level * scoreWeight(mode) + (50 - index) * 7,
      level,
      isMe: false,
    };
  });

  const myLevel = playerLevel(progress, mode);
  entries.push({
    nickname: profile?.nickname || "数字玩家",
    score: playerScore(progress, mode),
    level: myLevel,
    isMe: true,
  });

  return entries
    .sort((a, b) => b.score - a.score)
    .slice(0, 50)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
}

function playerLevel(progress: ProgressState, mode: RankingMode): number {
  return Math.max(1, progress.modeLevels[mode] - 1);
}

function playerScore(progress: ProgressState, mode: RankingMode): number {
  return playerLevel(progress, mode) * scoreWeight(mode);
}

function scoreWeight(mode: RankingMode): number {
  if (mode === "hard") return 180;
  if (mode === "speedrun") return 150;
  return 120;
}
