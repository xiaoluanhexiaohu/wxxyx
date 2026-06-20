"use strict";

const config = require("../config");
const storage = require("./storage");

function cloudCall(action, payload) {
  if (!wx.cloud) return Promise.reject(new Error("cloud unavailable"));
  return wx.cloud.callFunction({ name: "logic-number", data: { action, payload } }).then((res) => res.result);
}

function request(path, data) {
  if (!config.apiBaseUrl) return Promise.reject(new Error("api unavailable"));
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${config.apiBaseUrl}${path}`,
      method: "POST",
      data,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data);
        else reject(new Error(`request failed: ${res.statusCode}`));
      },
      fail: reject,
    });
  });
}

async function callBackend(action, payload, path) {
  try {
    return await cloudCall(action, payload);
  } catch (_) {
    return request(path, payload);
  }
}

async function loginOrRegister(payload) {
  if (!payload.code || payload.code.startsWith("mock-")) return createMockProfile(payload.nickname, payload.avatarUrl);
  try {
    return await callBackend("login", payload, "/auth/minigame-login");
  } catch (_) {
    return createMockProfile(payload.nickname, payload.avatarUrl);
  }
}

async function syncPlayerState(profile, wallet, progress) {
  try {
    await callBackend("sync", { token: profile.token, openId: profile.openId, wallet, progress }, "/player/sync");
  } catch (_) {}
}

async function fetchLeaderboard(payload) {
  try {
    return await callBackend("leaderboard", payload, "/leaderboard/query");
  } catch (_) {
    return [];
  }
}

async function verifyRewardedAd(payload) {
  const profile = storage.read(storage.keys.profile, null);
  const openId = payload.openId || (profile && profile.openId) || "";
  if (payload.transactionId.startsWith("mock-") || openId.startsWith("mock-")) return true;
  try {
    const result = await callBackend("verifyReward", { ...payload, openId }, "/ads/reward/verify");
    return result.verified === true;
  } catch (_) {
    return false;
  }
}

async function settleLevelReward(payload) {
  const rewards = { simple: 10, hard: 18, daily: 0, speedrun: 0, battleCheckpoint: 20, battleSpeed: 10 };
  if (!payload.openId || payload.openId.startsWith("mock-")) {
    return { ok: payload.isWin, rewardCoins: (rewards[payload.mode] || 0) * (payload.adMultiplier === 3 ? 3 : 1), wallet: null };
  }
  try {
    return await callBackend("settleLevel", payload, "/level/settle");
  } catch (_) {
    return { ok: true, rewardCoins: (rewards[payload.mode] || 0) * (payload.adMultiplier === 3 ? 3 : 1), wallet: null };
  }
}

async function bindInviter(payload) {
  if (!payload.openId || !payload.inviteBy || payload.openId === payload.inviteBy) return { ok: false };
  if (payload.openId.startsWith("mock-") || payload.inviteBy.startsWith("mock-")) return { ok: true };
  try {
    return await callBackend("bindInviter", payload, "/invite/bind");
  } catch (_) {
    return { ok: false };
  }
}

function createMockProfile(nickname, avatarUrl = "") {
  const saved = storage.read(storage.keys.profile, null);
  if (saved && saved.openId) return { ...saved, nickname: nickname || saved.nickname, avatarUrl: avatarUrl || saved.avatarUrl };
  return {
    openId: `mock-openid-${Date.now()}`,
    token: `mock-token-${Math.random().toString(16).slice(2)}`,
    nickname: nickname || "数字玩家",
    avatarUrl,
    registeredAt: Date.now(),
  };
}

module.exports = {
  bindInviter,
  fetchLeaderboard,
  loginOrRegister,
  settleLevelReward,
  syncPlayerState,
  verifyRewardedAd,
};
