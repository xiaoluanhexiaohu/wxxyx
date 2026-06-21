"use strict";

const config = require("./js/config");
const GameApp = require("./js/GameApp");
const audioManager = require("./js/core/AudioManager");

function getWindowInfo() {
  if (typeof wx.getWindowInfo === "function") {
    return wx.getWindowInfo();
  }

  return wx.getSystemInfoSync();
}

const windowInfo = getWindowInfo();
const screenWidth = windowInfo.windowWidth;
const screenHeight = windowInfo.windowHeight;
const pixelRatio = Math.min(windowInfo.pixelRatio || 1, 3);

const canvas = wx.createCanvas();
const ctx = canvas.getContext("2d");

canvas.width = Math.round(screenWidth * pixelRatio);
canvas.height = Math.round(screenHeight * pixelRatio);
ctx.scale(pixelRatio, pixelRatio);

GameGlobal.canvas = canvas;
GameGlobal.ctx = ctx;
GameGlobal.viewport = {
  width: screenWidth,
  height: screenHeight,
  pixelRatio,
};
GameGlobal.audioManager = audioManager;

if (wx.cloud && typeof wx.cloud.init === "function") {
  const cloudOptions = { traceUser: true };
  if (config.cloudEnvId) cloudOptions.env = config.cloudEnvId;
  try {
    wx.cloud.init(cloudOptions);
  } catch (_) {}
}

GameGlobal.gameApp = new GameApp(canvas, ctx, GameGlobal.viewport);
