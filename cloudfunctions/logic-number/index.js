"use strict";

const db = uniCloud.database();
const dbCmd = db.command;
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
  const { action, payload } = event || {};
  if (action === "login") return login(payload);
  if (action === "sync") return sync(payload);
  if (action === "verifyReward") return verifyReward(payload);
  if (action === "settleLevel") return settleLevel(payload);
  if (action === "bindInviter") return bindInviter(payload);
  if (action === "leaderboard") return leaderboard(payload);
  return { ok: false, message: "unknown action" };
};

async function login(payload = {}) {
  const nickname = payload.nickname || "数字玩家";
  const openId = await resolveOpenId(payload.code);
  const token = `token-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const profile = {
    openId,
    token,
    nickname,
    avatarUrl: payload.avatarUrl || "",
    registeredAt: Date.now(),
  };

  const existing = await players.where({ openId }).limit(1).get();
  if (existing.data && existing.data.length) {
    const updateData = { nickname, avatarUrl: profile.avatarUrl, token, updatedAt: Date.now() };
    if (!existing.data[0].wallet) updateData.wallet = defaultWallet();
    await players.doc(existing.data[0]._id).update(updateData);
  } else {
    await players.add({
      ...profile,
      wallet: defaultWallet(),
      progress: null,
      rankScores: defaultRankScores(),
      createdAt: Date.now(),
    });
  }

  return profile;
}

async function sync(payload = {}) {
  if (!payload.openId) return { ok: false };
  const existing = await players.where({ openId: payload.openId }).limit(1).get();
  if (!existing.data || !existing.data.length) return { ok: false };

  await players.doc(existing.data[0]._id).update({
    wallet: payload.wallet,
    progress: payload.progress,
    rankScores: rankScoresFromProgress(payload.progress || {}),
    updatedAt: Date.now(),
  });
  return { ok: true };
}

async function settleLevel(payload = {}) {
  const openId = String(payload.openId || "");
  const mode = normalizeMode(payload.mode);
  const isWin = payload.isWin === true;
  const adMultiplier = payload.adMultiplier === 3 ? 3 : 1;
  const transactionId = normalizeTransactionId(payload.transactionId);

  if (!openId) return { ok: false, message: "missing openId" };
  if (!isWin) return { ok: false, message: "level is not won" };

  if (transactionId) {
    const duplicate = await hasTransaction(transactionId);
    if (duplicate) return { ok: false, message: "duplicate transaction", code: "DUPLICATE_TRANSACTION" };
    await adTransactions.add({
      transactionId,
      openId,
      action: "settleLevel",
      rewardType: "level_3x",
      mode,
      adMultiplier,
      createdAt: Date.now(),
    });
  }

  const baseReward = LEVEL_REWARDS[mode] || 0;
  const rewardCoins = baseReward * adMultiplier;
  const updateData = {
    updatedAt: Date.now(),
  };

  if (rewardCoins > 0) {
    updateData["wallet.coins"] = dbCmd.inc(rewardCoins);
    updateData["wallet.gold"] = dbCmd.inc(rewardCoins);
  }

  await players.where({ openId }).update(updateData);
  const player = await getPlayer(openId);
  return {
    ok: true,
    mode,
    rewardCoins,
    wallet: player?.wallet || null,
  };
}

async function verifyReward(payload = {}) {
  const openId = String(payload.openId || "");
  const rewardType = String(payload.rewardType || rewardTypeFromScene(payload.scene));
  const transactionId = normalizeTransactionId(payload.transactionId);

  if (!openId) return { verified: false, message: "missing openId" };
  if (!transactionId) return { verified: false, message: "missing transactionId" };
  if (!AD_REWARDS[rewardType]) return { verified: false, message: "invalid rewardType" };

  const duplicate = await hasTransaction(transactionId);
  if (duplicate) return { verified: false, message: "duplicate transaction", code: "DUPLICATE_TRANSACTION" };

  await adTransactions.add({
    transactionId,
    openId,
    action: "verifyReward",
    rewardType,
    platform: payload.platform || "",
    adUnitId: payload.adUnitId || "",
    createdAt: Date.now(),
  });

  const reward = AD_REWARDS[rewardType];
  const updateData = { updatedAt: Date.now() };
  if (reward.coins) {
    updateData["wallet.coins"] = dbCmd.inc(reward.coins);
    updateData["wallet.gold"] = dbCmd.inc(reward.coins);
  }
  if (reward.stamina) updateData["wallet.stamina"] = dbCmd.inc(reward.stamina);
  if (reward.revealTools) updateData["wallet.revealTools"] = dbCmd.inc(reward.revealTools);

  if (Object.keys(updateData).length > 1) await players.where({ openId }).update(updateData);
  const player = await getPlayer(openId);
  return {
    verified: true,
    transactionId,
    rewardType,
    reward,
    wallet: player?.wallet || null,
  };
}

async function bindInviter(payload = {}) {
  const invitedOpenId = String(payload.openId || "");
  const inviterOpenId = String(payload.inviteBy || "");
  if (!invitedOpenId || !inviterOpenId) return { ok: false, message: "missing invite relation" };
  if (invitedOpenId === inviterOpenId) return { ok: false, message: "cannot invite self" };

  const existing = await inviteRelations.where({ invitedOpenId }).limit(1).get();
  if (existing.data && existing.data.length) return { ok: false, message: "invite relation already bound" };

  await inviteRelations.add({
    inviterOpenId,
    invitedOpenId,
    staminaLimitBonus: 20,
    createdAt: Date.now(),
  });

  await players.where({ openId: inviterOpenId }).update({
    "wallet.staminaLimit": dbCmd.inc(20),
    updatedAt: Date.now(),
  });

  return { ok: true, inviterOpenId, invitedOpenId, staminaLimitBonus: 20 };
}

async function leaderboard(payload = {}) {
  const mode = ["simple", "hard", "speedrun"].includes(payload.mode) ? payload.mode : "simple";
  const scope = payload.scope === "friend" ? "friend" : "global";
  const friendOpenIds = Array.isArray(payload.friendOpenIds) ? payload.friendOpenIds : [];

  let query = players;
  if (scope === "friend") {
    const openIds = friendOpenIds.length ? [...new Set([...friendOpenIds, payload.openId].filter(Boolean))] : [payload.openId].filter(Boolean);
    if (!openIds.length) return [];
    query = players.where({ openId: dbCmd.in(openIds) });
  }

  const sortField = mode === "speedrun" ? "rankScores.speedrunTime" : `rankScores.${mode}`;
  const sortOrder = mode === "speedrun" ? "asc" : "desc";
  const result = await query.orderBy(sortField, sortOrder).limit(50).get();
  return (result.data || [])
    .map((player) => {
      const progress = player.progress || {};
      const modeLevels = progress.modeLevels || {};
      const level = Math.max(1, Number(modeLevels[mode] || 1) - 1);
      const bestTimeMs = Number(progress.bestSpeedMs || 0);
      const score = Number(player.rankScores?.[mode] || level * scoreWeight(mode));
      return {
        nickname: player.nickname || "数字玩家",
        score,
        level,
        bestTimeMs,
        isMe: player.openId === payload.openId,
      };
    })
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
}

function normalizeMode(mode) {
  return Object.prototype.hasOwnProperty.call(LEVEL_REWARDS, mode) ? mode : "simple";
}

function normalizeTransactionId(value) {
  const transactionId = String(value || "").trim();
  return transactionId ? transactionId : "";
}

async function hasTransaction(transactionId) {
  const existing = await adTransactions.where({ transactionId }).limit(1).get();
  return Boolean(existing.data && existing.data.length);
}

async function getPlayer(openId) {
  const result = await players.where({ openId }).limit(1).get();
  return result.data && result.data.length ? result.data[0] : null;
}

function rewardTypeFromScene(scene) {
  if (scene === "gold") return "ad_gold";
  if (scene === "stamina") return "ad_stamina";
  if (scene === "reveal") return "ad_reveal";
  if (scene === "revive") return "ad_revive";
  return "";
}

function scoreWeight(mode) {
  if (mode === "hard") return 180;
  if (mode === "speedrun") return 150;
  return 120;
}

function rankScoresFromProgress(progress = {}) {
  const modeLevels = progress.modeLevels || {};
  return {
    simple: Math.max(0, Number(modeLevels.simple || 1) - 1) * scoreWeight("simple"),
    hard: Math.max(0, Number(modeLevels.hard || 1) - 1) * scoreWeight("hard"),
    speedrun: Math.max(0, Number(modeLevels.speedrun || 1) - 1) * scoreWeight("speedrun"),
    speedrunTime: Number(progress.bestSpeedMs || 0) || 999999999,
  };
}

function defaultRankScores() {
  return {
    simple: 0,
    hard: 0,
    speedrun: 0,
    speedrunTime: 999999999,
  };
}

function defaultWallet() {
  return { stamina: 100, staminaLimit: 100, gold: 80, coins: 80, revealTools: 1, lastStaminaAt: Date.now() };
}

async function resolveOpenId(code) {
  const wxContext = getWxContext();
  if (wxContext?.OPENID) return wxContext.OPENID;
  if (code) {
    const session = await code2Session(code);
    if (session?.openid) return session.openid;
  }
  return code ? `dev-${hash(code)}` : `mock-${Date.now()}`;
}

function getWxContext() {
  try {
    if (typeof uniCloud.getWXContext === "function") return uniCloud.getWXContext();
  } catch {}
  return null;
}

async function code2Session(code) {
  const appid = process.env.WEIXIN_APPID;
  const secret = process.env.WEIXIN_SECRET;
  if (!appid || !secret || !uniCloud.httpclient?.request) return null;

  const response = await uniCloud.httpclient.request("https://api.weixin.qq.com/sns/jscode2session", {
    method: "GET",
    dataType: "json",
    data: {
      appid,
      secret,
      js_code: code,
      grant_type: "authorization_code",
    },
  });
  return response.data;
}

function hash(input) {
  let value = 0;
  for (let i = 0; i < input.length; i += 1) {
    value = (value * 31 + input.charCodeAt(i)) >>> 0;
  }
  return value.toString(16);
}
