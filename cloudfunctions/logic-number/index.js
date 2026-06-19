"use strict";

const db = uniCloud.database();
const dbCmd = db.command;
const players = db.collection("players");

exports.main = async (event) => {
  const { action, payload } = event || {};
  if (action === "login") return login(payload);
  if (action === "sync") return sync(payload);
  if (action === "verifyReward") return verifyReward(payload);
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
    await players.doc(existing.data[0]._id).update({ nickname, avatarUrl: profile.avatarUrl, token });
  } else {
    await players.add({ ...profile, wallet: null, progress: null, rankScores: defaultRankScores() });
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

async function verifyReward(payload = {}) {
  // 正式广告接入后，应在这里校验平台服务端回调或广告交易号。
  return {
    verified: Boolean(payload.transactionId),
    transactionId: payload.transactionId,
  };
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

  const result = await query.orderBy(`rankScores.${mode}`, "desc").limit(50).get();
  return (result.data || [])
    .map((player) => {
      const progress = player.progress || {};
      const modeLevels = progress.modeLevels || {};
      const level = Math.max(1, Number(modeLevels[mode] || 1) - 1);
      const score = Number(player.rankScores?.[mode] || level * scoreWeight(mode));
      return {
        nickname: player.nickname || "数字玩家",
        score,
        level,
        isMe: player.openId === payload.openId,
      };
    })
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
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
  };
}

function defaultRankScores() {
  return {
    simple: 0,
    hard: 0,
    speedrun: 0,
  };
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
