"use strict";

const keys = {
  profile: "logic-number-profile",
  wallet: "logic-number-wallet",
  progress: "logic-number-progress",
  session: "logic-number-current-session",
  pendingInviteBy: "logic-number-pending-invite-by",
  audioSettings: "logic-number-audio-settings",
};

function read(key, fallback) {
  try {
    const value = wx.getStorageSync(key);
    return value === "" || value === undefined || value === null ? fallback : value;
  } catch (_) {
    return fallback;
  }
}

function write(key, value) {
  try {
    wx.setStorageSync(key, value);
  } catch (_) {}
}

function remove(key) {
  try {
    wx.removeStorageSync(key);
  } catch (_) {}
}

function getAudioSettings() {
  const saved = read(keys.audioSettings, null);
  const legacy = read("logic-number-settings", null);
  return {
    isBgmEnabled: saved && typeof saved.isBgmEnabled === "boolean"
      ? saved.isBgmEnabled
      : !(legacy && legacy.music === false),
    isSfxEnabled: saved && typeof saved.isSfxEnabled === "boolean"
      ? saved.isSfxEnabled
      : !(legacy && legacy.sound === false),
  };
}

function setAudioSettings(settings) {
  const normalized = {
    isBgmEnabled: settings.isBgmEnabled !== false,
    isSfxEnabled: settings.isSfxEnabled !== false,
  };
  write(keys.audioSettings, normalized);
  return normalized;
}

module.exports = { keys, read, write, remove, getAudioSettings, setAudioSettings };
