"use strict";

const keys = {
  profile: "logic-number-profile",
  wallet: "logic-number-wallet",
  progress: "logic-number-progress",
  session: "logic-number-current-session",
  pendingInviteBy: "logic-number-pending-invite-by",
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

module.exports = { keys, read, write, remove };
