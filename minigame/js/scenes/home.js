"use strict";

const { LOTTERY_REWARDS, REVEAL_TOOL_COST, SIGN_IN_REWARDS, STAMINA_RECOVER_MS } = require("../core/GameController");

function drawHome(app, ui, height) {
  app.audio.playBgm("home");
  drawBackground(ui, height);
  const game = app.controller;

  ui.roundRect(20, 28, 48, 48, 24, "#FFF4D6");
  ui.text("🧠", 44, 53, 25, "#333333", "center");
  ui.text((game.profile && game.profile.nickname) || "数字玩家", 80, 44, 18, "#FFFFFF", "left", "bold");
  ui.text(`累计通关 ${game.totalClears}`, 80, 66, 12, "#DDEAF1");
  ui.button(app.audio.isBgmEnabled ? "♫" : "×♫", 264, 35, 28, 30, app.audio.isBgmEnabled ? "#2ECC71" : "#6F818C", () => app.toggleAudio("bgm"), { fontSize: 12, radius: 9, shadow: false });
  ui.button(app.audio.isSfxEnabled ? "声" : "静", 298, 35, 28, 30, app.audio.isSfxEnabled ? "#4A90E2" : "#6F818C", () => app.toggleAudio("sfx"), { fontSize: 11, radius: 9, shadow: false });
  ui.button("享", 332, 35, 24, 30, "#F1C40F", () => app.shareInvite(), { textColor: "#4A3A00", fontSize: 11, radius: 9, shadow: false });

  drawResources(app, ui, 20, 90);
  ui.text("选择模式", 22, 188, 19, "#FFFFFF", "left", "bold");
  if (game.puzzle) {
    ui.button("继续当前关卡", 251, 171, 101, 32, "#F1C40F", () => app.resumePuzzle(), { textColor: "#4A3A00", fontSize: 11, radius: 10, shadow: false });
  } else {
    ui.text("进度自动保存", 352, 188, 11, "#E4F0F5", "right");
  }

  const cards = [
    { title: "简单模式", desc: "4数字 · 4线索", meta: "⚡ -5   金币 +10", level: `第 ${game.progress.modeLevels.simple} 关`, color: "#2ECC71", icon: "🐱", action: () => app.startMode("simple", "easy") },
    { title: "困难模式", desc: "5数字 · 5线索", meta: "⚡ -8   金币 +18", level: `第 ${game.progress.modeLevels.hard} 关`, color: "#E67E22", icon: "🦁", action: () => app.startMode("hard", "hard") },
    { title: "每日挑战", desc: `剩余 ${game.dailyAttemptsLeft}/2 次`, meta: "完成后体力 +15", level: "每日 0 点刷新", color: "#4A90E2", icon: "🔎", action: () => app.startMode("daily", "easy") },
    { title: "极速竞赛", desc: `剩余 ${game.speedrunAttemptsLeft}/2 次`, meta: game.progress.bestSpeedMs ? `最佳 ${(game.progress.bestSpeedMs / 1000).toFixed(2)}秒` : "挑战最佳时间", level: "计时模式", color: "#21A6A1", icon: "⏱", action: () => app.startMode("speedrun", "easy") },
    { title: "好友闯关", desc: "分享同题对战", meta: "先完成 3 关", level: "3关连胜", color: "#F1C40F", icon: "🔗", dark: true, action: () => app.openBattle("checkpoint") },
    { title: "好友竞速", desc: "相同答案线索", meta: "用时更少获胜", level: "速度比拼", color: "#5A86D6", icon: "🏃", action: () => app.openBattle("speed") },
  ];
  const cardTop = 204;
  const gap = 10;
  const cardW = 162.5;
  const cardH = Math.min(112, Math.max(94, (height - cardTop - 92 - gap * 2) / 3));
  cards.forEach((card, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    drawModeCard(ui, 20 + col * (cardW + gap), cardTop + row * (cardH + gap), cardW, cardH, card);
  });

  drawNavigation(app, ui, height);
  if (app.overlay) {
    ui.hits = [];
    drawOverlay(app, ui, height);
  }
}

function drawBackground(ui, height) {
  const gradient = ui.ctx.createLinearGradient(0, 0, 375, height);
  gradient.addColorStop(0, "#2C3E50");
  gradient.addColorStop(0.52, "#3D7FAB");
  gradient.addColorStop(1, "#85C9B0");
  ui.ctx.fillStyle = gradient;
  ui.ctx.fillRect(0, 0, 375, height);
}

function drawResources(app, ui, x, y) {
  const game = app.controller;
  ui.shadowCard(x, y, 335, 78, 16, "#FFFFFF");
  const items = [
    { icon: "⚡", value: `${game.wallet.stamina}/${game.staminaLimit}`, hint: staminaText(game), action: () => app.watchAd("stamina") },
    { icon: "●", value: String(game.wallet.gold), hint: "金币", action: () => app.watchAd("gold") },
    { icon: "🔍", value: String(game.wallet.revealTools), hint: "显真镜", action: () => app.openOverlay("reveal") },
  ];
  items.forEach((item, index) => {
    const left = x + index * 111;
    if (index) ui.divider(left, y + 14, 1, "#DCE4E8");
    ui.text(item.icon, left + 18, y + 26, 18, index === 1 ? "#F1C40F" : "#333333", "center", "bold");
    ui.text(item.value, left + 37, y + 24, 15, "#2C3E50", "left", "bold");
    ui.text(item.hint, left + 12, y + 53, 9.5, "#70828E");
    ui.button("+", left + 82, y + 13, 22, 22, "#2ECC71", item.action, { fontSize: 15, radius: 11, shadow: false });
  });
}

function staminaText(game) {
  if (game.wallet.stamina >= game.staminaLimit) return "已满 · 12分钟+1";
  const seconds = Math.max(0, Math.ceil((game.wallet.lastStaminaAt + STAMINA_RECOVER_MS - Date.now()) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} 后+1`;
}

function drawModeCard(ui, x, y, w, h, card) {
  ui.roundRect(x, y + 4, w, h, 14, "rgba(30,55,65,0.3)");
  ui.roundRect(x, y, w, h, 14, card.color);
  ui.text(card.icon, x + 26, y + 27, 24, "#FFFFFF", "center");
  const textColor = card.dark ? "#4A3A00" : "#FFFFFF";
  ui.text(card.title, x + 49, y + 21, 15, textColor, "left", "bold");
  ui.text(card.desc, x + 49, y + 42, 10.5, card.dark ? "#6B5700" : "rgba(255,255,255,0.88)");
  ui.text(card.meta, x + 14, y + h - 34, 10.5, textColor, "left", "bold");
  ui.text(card.level, x + w - 12, y + h - 14, 10, card.dark ? "#6B5700" : "rgba(255,255,255,0.9)", "right");
  ui.addHit(x, y, w, h + 4, card.action);
}

function drawNavigation(app, ui, height) {
  const y = height - 72;
  ui.roundRect(12, y, 351, 60, 15, "#254359");
  const items = [
    ["排行", "📊", () => app.openRanking()],
    ["签到", "📅", () => app.openOverlay("sign")],
    ["抽奖", "🎁", () => app.openOverlay("lottery")],
    ["设置", "⚙", () => app.openOverlay("settings")],
  ];
  items.forEach((item, index) => {
    const cx = 56 + index * 88;
    ui.text(item[1], cx, y + 20, 18, "#FFFFFF", "center");
    ui.text(item[0], cx, y + 43, 10, "#D9E8EF", "center", "bold");
    ui.addHit(cx - 38, y, 76, 60, item[2]);
  });
}

function drawOverlay(app, ui, height) {
  ui.ctx.fillStyle = "rgba(13, 27, 36, 0.72)";
  ui.ctx.fillRect(0, 0, 375, height);
  if (app.overlay === "ranking") drawRanking(app, ui, height);
  if (app.overlay === "sign") drawSign(app, ui, height);
  if (app.overlay === "lottery") drawLottery(app, ui, height);
  if (app.overlay === "settings") drawSettings(app, ui, height);
  if (app.overlay === "reveal") drawReveal(app, ui, height);
}

function modalBase(app, ui, x, y, w, h, title) {
  ui.shadowCard(x, y, w, h, 18, "#FFFFFF");
  ui.text(title, x + 22, y + 30, 21, "#2C3E50", "left", "bold");
  ui.button("×", x + w - 42, y + 13, 28, 28, "#DDE5E9", () => app.closeOverlay(), { textColor: "#536873", fontSize: 18, radius: 14, shadow: false });
}

function drawRanking(app, ui, height) {
  const x = 18;
  const y = 56;
  const h = height - 90;
  modalBase(app, ui, x, y, 339, h, "排行榜 TOP 50");
  const modes = [["simple", "简单"], ["hard", "困难"], ["speedrun", "竞速"]];
  modes.forEach((item, index) => {
    ui.button(item[1], x + 18 + index * 74, y + 52, 66, 34, app.rankMode === item[0] ? "#2ECC71" : "#E8EEF1", () => app.setRankMode(item[0]), { textColor: app.rankMode === item[0] ? "#FFFFFF" : "#536873", fontSize: 12, shadow: false });
  });
  ui.button(app.rankScope === "global" ? "总榜" : "好友榜", x + 249, y + 52, 72, 34, "#4A90E2", () => app.toggleRankScope(), { fontSize: 12, shadow: false });
  const entries = app.rankEntries.slice(app.rankPage * 10, app.rankPage * 10 + 10);
  entries.forEach((entry, index) => {
    const rowY = y + 102 + index * 42;
    if (entry.isMe) ui.roundRect(x + 14, rowY - 4, 311, 38, 8, "#E8FAF0");
    ui.text(String(entry.rank), x + 34, rowY + 14, 13, entry.rank <= 3 ? "#E67E22" : "#657985", "center", "bold");
    ui.text(entry.nickname, x + 58, rowY + 14, 13, "#2C3E50", "left", entry.isMe ? "bold" : "normal");
    ui.text(entry.metricText, x + 306, rowY + 14, 12, "#4A90E2", "right", "bold");
  });
  const bottom = y + h - 52;
  ui.button("上一页", x + 42, bottom, 76, 34, "#E8EEF1", () => app.changeRankPage(-1), { textColor: "#536873", fontSize: 12, shadow: false, disabled: app.rankPage === 0 });
  ui.text(`${app.rankPage + 1}/5`, x + 169.5, bottom + 17, 12, "#657985", "center", "bold");
  ui.button("下一页", x + 221, bottom, 76, 34, "#2ECC71", () => app.changeRankPage(1), { fontSize: 12, shadow: false, disabled: app.rankPage >= 4 });
}

function drawSign(app, ui, height) {
  const x = 28;
  const y = Math.max(95, height / 2 - 250);
  modalBase(app, ui, x, y, 319, 500, "每日签到");
  ui.text("连续参与，每天领取不同奖励", x + 22, y + 61, 12, "#70828E");
  SIGN_IN_REWARDS.forEach((reward, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const itemX = x + 20 + col * 142;
    const itemY = y + 92 + row * 72;
    const isToday = (new Date().getDate() - 1) % 7 === index;
    ui.roundRect(itemX, itemY, 132, 58, 10, isToday ? "#E8FAF0" : "#F3F6F8", isToday ? "#2ECC71" : null, 2);
    ui.text(`第 ${index + 1} 天`, itemX + 12, itemY + 18, 11, "#70828E");
    ui.text(reward.label, itemX + 12, itemY + 40, 14, "#2C3E50", "left", "bold");
  });
  const signed = app.controller.progress.signInDate === app.today;
  ui.button(signed ? "今日已签到" : "领取今日奖励", x + 28, y + 425, 263, 50, "#2ECC71", () => app.claimSignIn(), { disabled: signed });
}

function drawLottery(app, ui, height) {
  const x = 20;
  const y = Math.max(56, height / 2 - 330);
  modalBase(app, ui, x, y, 335, 650, "每日抽奖");
  ui.text("每日免费 1 次", x + 168, y + 63, 12, "#70828E", "center");
  drawWheel(app, ui, x + 167.5, y + 270, 150);
  const used = app.controller.progress.lotteryDate === app.today;
  ui.button(app.lotteryBusy ? "转盘旋转中..." : used ? "今日已抽奖" : "点击抽奖", x + 58, y + 468, 219, 54, "#2ECC71", () => app.spinLottery(), { disabled: app.lotteryBusy || used, fontSize: 17 });
  ui.wrappedText(app.lotteryMessage || "金币、体力和显真镜都有机会获得", x + 35, y + 548, 265, 20, { size: 13, color: "#657985", align: "center", maxLines: 2 });
}

function drawWheel(app, ui, cx, cy, radius) {
  const ctx = ui.ctx;
  const colors = ["#FFD166", "#F29A61", "#49C3DF", "#2ECC71", "#F6D55C", "#76B9EB"];
  const step = Math.PI * 2 / LOTTERY_REWARDS.length;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(app.lotteryRotation);
  LOTTERY_REWARDS.forEach((reward, index) => {
    const start = -Math.PI / 2 + index * step;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, start, start + step);
    ctx.closePath();
    ctx.fillStyle = colors[index];
    ctx.fill();
    ctx.save();
    ctx.rotate(start + step / 2);
    ui.text(reward.label, radius * 0.62, 0, 12, "#5A3A19", "center", "bold");
    ctx.restore();
  });
  ctx.restore();
  ctx.lineWidth = 7;
  ctx.strokeStyle = "#F7E27A";
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 3, 0, Math.PI * 2);
  ctx.stroke();
  ui.roundRect(cx - 37, cy - 28, 74, 56, 28, "#16A777", "#F7E27A", 4);
  ui.text("抽奖", cx, cy, 17, "#FFFFFF", "center", "bold");
  ctx.fillStyle = "#F1C40F";
  ctx.beginPath();
  ctx.moveTo(cx, cy - radius - 2);
  ctx.lineTo(cx - 15, cy - radius - 28);
  ctx.lineTo(cx + 15, cy - radius - 28);
  ctx.closePath();
  ctx.fill();
}

function drawSettings(app, ui, height) {
  const x = 40;
  const y = Math.max(160, height / 2 - 210);
  modalBase(app, ui, x, y, 295, 410, "设置");
  [["sound", "游戏音效"], ["music", "背景音乐"], ["notice", "活动提醒"]].forEach((item, index) => {
    const rowY = y + 84 + index * 64;
    ui.text(item[1], x + 24, rowY, 15, "#2C3E50", "left", "bold");
    const enabled = app.settings[item[0]];
    ui.button(enabled ? "开" : "关", x + 213, rowY - 18, 50, 36, enabled ? "#2ECC71" : "#A8B2B8", () => app.toggleSetting(item[0]), { fontSize: 12, shadow: false });
  });
  ui.button("退出登录", x + 24, y + 310, 247, 48, "#E67E22", () => app.logout(), { fontSize: 14 });
}

function drawReveal(app, ui, height) {
  const x = 38;
  const y = Math.max(180, height / 2 - 190);
  modalBase(app, ui, x, y, 299, 375, "显真透视镜");
  ui.text("🔍", x + 149.5, y + 100, 50, "#333333", "center");
  ui.text(`当前拥有 ${app.controller.wallet.revealTools} 个`, x + 149.5, y + 154, 15, "#2C3E50", "center", "bold");
  ui.wrappedText("进入关卡后使用，可随机显示一位正确数字。", x + 36, y + 181, 227, 20, { size: 13, color: "#70828E", align: "center" });
  ui.button(`金币购买 ${REVEAL_TOOL_COST}`, x + 28, y + 247, 243, 46, "#E67E22", () => app.buyRevealTool(), { fontSize: 14 });
  ui.button("看广告获得 1 个", x + 28, y + 307, 243, 42, "#2ECC71", () => app.watchAd("reveal"), { fontSize: 13 });
}

module.exports = drawHome;
