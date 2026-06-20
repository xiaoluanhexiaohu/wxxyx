"use strict";

const globalNames = ["推理师一号", "数独旅人", "逻辑玩家", "暗号专家", "线索猎手", "破局者", "数字侦探", "零点玩家", "快手解谜", "脑力达人"];
const friendNames = ["微信好友A", "微信好友B", "微信好友C", "微信好友D", "微信好友E", "微信好友F", "微信好友G", "微信好友H", "微信好友I", "微信好友J"];

function createLeaderboard(profile, progress, scope, mode = "simple") {
  const names = scope === "global" ? globalNames : friendNames;
  const entries = Array.from({ length: 50 }, (_, index) => createMockEntry(names[index % names.length], index, mode));
  entries.push(createPlayerEntry(profile, progress, mode));
  return entries.sort((a, b) => mode === "speedrun"
    ? (a.bestTimeMs || Number.MAX_SAFE_INTEGER) - (b.bestTimeMs || Number.MAX_SAFE_INTEGER)
    : b.level - a.level)
    .slice(0, 50)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function createMockEntry(nickname, index, mode) {
  if (mode === "speedrun") {
    const bestTimeMs = 18000 + index * 1850 + ((index * 7) % 11) * 230;
    return { nickname, level: Math.max(1, 50 - index), bestTimeMs, metricText: formatTime(bestTimeMs), isMe: false };
  }
  const base = mode === "hard" ? 72 : 96;
  const level = Math.max(1, base - Math.floor(index * (mode === "hard" ? 1.25 : 1.05)));
  return { nickname, level, metricText: `第 ${level} 关`, isMe: false };
}

function createPlayerEntry(profile, progress, mode) {
  if (mode === "speedrun") {
    return {
      nickname: (profile && profile.nickname) || "数字玩家",
      level: playerLevel(progress, mode),
      bestTimeMs: progress.bestSpeedMs || Number.MAX_SAFE_INTEGER,
      metricText: progress.bestSpeedMs ? formatTime(progress.bestSpeedMs) : "暂无成绩",
      isMe: true,
    };
  }
  const level = playerLevel(progress, mode);
  return { nickname: (profile && profile.nickname) || "数字玩家", level, metricText: `第 ${level} 关`, isMe: true };
}

function playerLevel(progress, mode) {
  return Math.max(1, Number(progress.modeLevels[mode] || 1) - 1);
}

function formatTime(ms) {
  return Number.isFinite(ms) && ms !== Number.MAX_SAFE_INTEGER ? `${(ms / 1000).toFixed(2)} 秒` : "暂无成绩";
}

module.exports = { createLeaderboard };
