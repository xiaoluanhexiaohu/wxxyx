"use strict";

const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const command = db.command;
const players = db.collection("players");
const adTransactions = db.collection("ad_transactions");
const inviteRelations = db.collection("invite_relations");

const LEVEL_REWARDS = {
  simple: 10,
  hard: 18,
  daily: 0,
  speedrun: 0,
  battleCheckpoint: 20,
  battleSpeed: 10,
};

const AD_REWARDS = {
  ad_gold: { coins: 80 },
  ad_stamina: { stamina: 40 },
  ad_reveal: { revealTools: 1 },
  ad_revive: {},
};

exports.main = async (event) => {
  const action = event && event.action;
  const payload = (event && event.payload) || {};
  const openId = cloud.getWXContext().OPENID;
  if (!openId) return { ok: false, message: "missing openId" };
  if (action === "login") return login(openId, payload);
  if (action === "sync") return sync(openId, payload);
  if (action === "verifyReward") return verifyReward(openId, payload);
  if (action === "settleLevel") return settleLevel(openId, payload);
  if (action === "bindInviter") return bindInviter(openId, payload);
  if (action === "leaderboard") return leaderboard(openId, payload);
  return { ok: false, message: "unknown action" };
};

async function login(openId, payload) {
  const nickname = String(payload.nickname || "数字玩家").slice(0, 20);
  const token = `wx-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const profile = {
    openId,
    token,
    nickname,
    avatarUrl: String(payload.avatarUrl || ""),
    registeredAt: Date.now(),
  };
  const existing = await getPlayer(openId);
  if (existing) {
    await players.doc(existing._id).update({
      data: { nickname, avatarUrl: profile.avatarUrl, token, updatedAt: Date.now() },
    });
  } else {
    await players.add({
      data: {
        ...profile,
        wallet: defaultWallet(),
        progress: null,
        rankScores: defaultRankScores(),
        createdAt: Date.now(),
      },
    });
  }
  return profile;
}

async function sync(openId, payload) {
  const existing = await getPlayer(openId);
  if (!existing) return { ok: false, message: "player not found" };
  await players.doc(existing._id).update({
    data: {
      wallet: sanitizeWallet(payload.wallet),
      progress: payload.progress || {},
      rankScores: rankScoresFromProgress(payload.progress || {}),
      updatedAt: Date.now(),
    },
  });
  return { ok: true };
}

async function settleLevel(openId, payload) {
  const mode = Object.prototype.hasOwnProperty.call(LEVEL_REWARDS, payload.mode) ? payload.mode : "simple";
  if (payload.isWin !== true) return { ok: false, message: "level is not won" };
  const multiplier = payload.adMultiplier === 3 ? 3 : 1;
  const transactionId = String(payload.transactionId || "").trim();
  if (transactionId && await hasTransaction(transactionId)) {
    return { ok: false, message: "duplicate transaction", code: "DUPLICATE_TRANSACTION" };
  }
  if (transactionId) {
    await adTransactions.add({ data: { transactionId, openId, action: "settleLevel", mode, multiplier, createdAt: Date.now() } });
  }
  const rewardCoins = (LEVEL_REWARDS[mode] || 0) * multiplier;
  if (rewardCoins > 0) {
    await players.where({ openId }).update({
      data: {
        "wallet.gold": command.inc(rewardCoins),
        "wallet.coins": command.inc(rewardCoins),
        updatedAt: Date.now(),
      },
    });
  }
  const player = await getPlayer(openId);
  return { ok: true, mode, rewardCoins, wallet: player && player.wallet };
}

async function verifyReward(openId, payload) {
  const rewardType = String(payload.rewardType || "");
  const transactionId = String(payload.transactionId || "").trim();
  if (!transactionId || !AD_REWARDS[rewardType]) return { verified: false, message: "invalid reward" };
  if (await hasTransaction(transactionId)) return { verified: false, message: "duplicate transaction" };
  await adTransactions.add({
    data: {
      transactionId,
      openId,
      action: "verifyReward",
      rewardType,
      platform: String(payload.platform || ""),
      adUnitId: String(payload.adUnitId || ""),
      createdAt: Date.now(),
    },
  });
  const reward = AD_REWARDS[rewardType];
  const data = { updatedAt: Date.now() };
  if (reward.coins) {
    data["wallet.gold"] = command.inc(reward.coins);
    data["wallet.coins"] = command.inc(reward.coins);
  }
  if (reward.stamina) data["wallet.stamina"] = command.inc(reward.stamina);
  if (reward.revealTools) data["wallet.revealTools"] = command.inc(reward.revealTools);
  if (Object.keys(data).length > 1) await players.where({ openId }).update({ data });
  const player = await getPlayer(openId);
  return { verified: true, transactionId, rewardType, reward, wallet: player && player.wallet };
}

async function bindInviter(openId, payload) {
  const inviterOpenId = String(payload.inviteBy || "");
  if (!inviterOpenId || inviterOpenId === openId) return { ok: false, message: "invalid inviter" };
  const existing = await inviteRelations.where({ invitedOpenId: openId }).limit(1).get();
  if (existing.data.length) return { ok: false, message: "invite relation already bound" };
  await inviteRelations.add({ data: { inviterOpenId, invitedOpenId: openId, staminaLimitBonus: 20, createdAt: Date.now() } });
  await players.where({ openId: inviterOpenId }).update({
    data: { "wallet.staminaLimit": command.inc(20), updatedAt: Date.now() },
  });
  return { ok: true, inviterOpenId, invitedOpenId: openId, staminaLimitBonus: 20 };
}

async function leaderboard(openId, payload) {
  const mode = ["simple", "hard", "speedrun"].includes(payload.mode) ? payload.mode : "simple";
  const scope = payload.scope === "friend" ? "friend" : "global";
  let query = players;
  if (scope === "friend") {
    const supplied = Array.isArray(payload.friendOpenIds) ? payload.friendOpenIds : [];
    const openIds = [...new Set([openId, ...supplied].filter(Boolean))];
    query = players.where({ openId: command.in(openIds) });
  }
  const sortField = mode === "speedrun" ? "rankScores.speedrunTime" : `rankScores.${mode}`;
  const result = await query.orderBy(sortField, mode === "speedrun" ? "asc" : "desc").limit(50).get();
  return result.data.map((player, index) => {
    const progress = player.progress || {};
    const modeLevels = progress.modeLevels || {};
    return {
      rank: index + 1,
      nickname: player.nickname || "数字玩家",
      level: Math.max(1, Number(modeLevels[mode] || 1) - 1),
      bestTimeMs: Number(progress.bestSpeedMs || 0),
      isMe: player.openId === openId,
    };
  });
}

async function getPlayer(openId) {
  const result = await players.where({ openId }).limit(1).get();
  return result.data[0] || null;
}

async function hasTransaction(transactionId) {
  const result = await adTransactions.where({ transactionId }).limit(1).get();
  return result.data.length > 0;
}

function sanitizeWallet(wallet) {
  const source = wallet || {};
  return {
    stamina: Math.max(0, Number(source.stamina || 0)),
    staminaLimit: Math.max(100, Number(source.staminaLimit || 100)),
    gold: Math.max(0, Number(source.gold || 0)),
    coins: Math.max(0, Number(source.gold || source.coins || 0)),
    revealTools: Math.max(0, Number(source.revealTools || 0)),
    lastStaminaAt: Number(source.lastStaminaAt || Date.now()),
  };
}

function rankScoresFromProgress(progress) {
  const levels = progress.modeLevels || {};
  return {
    simple: Math.max(0, Number(levels.simple || 1) - 1) * 120,
    hard: Math.max(0, Number(levels.hard || 1) - 1) * 180,
    speedrun: Math.max(0, Number(levels.speedrun || 1) - 1) * 150,
    speedrunTime: Number(progress.bestSpeedMs || 0) || 999999999,
  };
}

function defaultRankScores() {
  return { simple: 0, hard: 0, speedrun: 0, speedrunTime: 999999999 };
}

function defaultWallet() {
  return { stamina: 100, staminaLimit: 100, gold: 80, coins: 80, revealTools: 1, lastStaminaAt: Date.now() };
}
