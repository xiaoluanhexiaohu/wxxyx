"use strict";

const { REVEAL_TOOL_COST } = require("../core/GameController");

const modeNames = {
  simple: "简单模式",
  hard: "困难模式",
  daily: "每日挑战",
  speedrun: "极速竞赛",
  battleCheckpoint: "好友闯关",
  battleSpeed: "好友竞速",
};

function drawPlay(app, ui, height) {
  const game = app.controller;
  const puzzle = game.puzzle || (app.result && app.result.puzzle);
  ui.ctx.fillStyle = "#20384F";
  ui.ctx.fillRect(0, 0, 375, height);

  ui.button("‹", 18, 24, 40, 38, "#385773", () => app.confirmLeavePlay(), { fontSize: 24, radius: 10 });
  ui.text(modeNames[game.progress.selectedMode] || "数字推理", 187.5, 38, 18, "#FFFFFF", "center", "bold");
  ui.text(`第 ${(puzzle && puzzle.round) || game.progress.modeLevels[game.progress.selectedMode]} 关`, 187.5, 59, 11, "#BFD2DE", "center");
  ui.pill(`机会 ${game.attemptsLeft}/3`, 72, 24, 83, 34, "#31516D", "#FFFFFF", 11);
  const timer = game.progress.selectedMode === "daily" ? `${game.dailyLeftSeconds}s` : app.elapsedText();
  if (game.progress.selectedMode === "daily" || game.progress.selectedMode === "speedrun" || game.progress.selectedMode === "battleSpeed") {
    ui.pill(timer, 292, 24, 64, 34, "#F1C40F", "#4A3A00", 11);
  }

  if (puzzle) {
    drawInput(ui, game, puzzle, 76);
    drawClues(ui, puzzle, 156, height - 425);
  }
  if (game.puzzle) {
    drawKeyboard(app, ui, height);
  }

  if (app.playOverlay || app.result || app.reviveVisible) {
    ui.hits = [];
    ui.ctx.fillStyle = "rgba(8, 18, 27, 0.76)";
    ui.ctx.fillRect(0, 0, 375, height);
    if (app.playOverlay === "reveal") drawReveal(app, ui, height);
    else if (app.reviveVisible) drawRevive(app, ui, height);
    else if (app.result) drawResult(app, ui, height);
  }
}

function drawInput(ui, game, puzzle, y) {
  ui.roundRect(18, y, 339, 68, 16, "#2ECC71");
  const length = puzzle.difficulty.digitLength;
  const gap = 8;
  const slotW = length === 5 ? 52 : 62;
  const total = length * slotW + (length - 1) * gap;
  const start = (375 - total) / 2;
  for (let index = 0; index < length; index += 1) {
    const filled = Boolean(game.input[index]);
    ui.roundRect(start + index * (slotW + gap), y + 10, slotW, 48, 9, filled ? "#FFF8D8" : "rgba(25,55,64,0.45)", game.locked[index] ? "#F1C40F" : null, 3);
    ui.text(filled ? game.input[index] : "?", start + index * (slotW + gap) + slotW / 2, y + 35, 25, filled ? "#2C3E50" : "rgba(255,255,255,0.7)", "center", "bold");
    if (game.locked[index]) ui.text("锁", start + index * (slotW + gap) + slotW - 7, y + 17, 8, "#9A6C00", "center", "bold");
  }
}

function drawClues(ui, puzzle, y, availableHeight) {
  ui.text("推理线索", 20, y + 12, 15, "#FFFFFF", "left", "bold");
  ui.text(puzzle.guaranteedUnique ? "唯一解" : "线索组合", 352, y + 12, 11, "#A8E6CF", "right", "bold");
  const rowTop = y + 31;
  const rowH = Math.min(57, Math.max(48, (availableHeight - 34) / puzzle.clues.length));
  puzzle.clues.forEach((clue, index) => {
    const rowY = rowTop + index * rowH;
    ui.roundRect(18, rowY, 339, rowH - 6, 10, clue.result.exact === puzzle.difficulty.digitLength ? "#DDF8E9" : "#FFFFFF");
    ui.pill(clue.guess, 28, rowY + 9, puzzle.difficulty.digitLength === 5 ? 74 : 66, 29, "#EAF0F3", "#2C3E50", 13);
    ui.wrappedText(clue.text, 106, rowY + 8, 238, 15, { size: 10.5, color: "#405664", maxLines: 3 });
  });
}

function drawKeyboard(app, ui, height) {
  const game = app.controller;
  const kbY = height - 242;
  ui.button(`🔍 ${game.wallet.revealTools}`, 288, kbY - 48, 68, 36, "#F1C40F", () => { app.playOverlay = "reveal"; }, { textColor: "#4A3A00", fontSize: 12, radius: 18 });
  if (game.guesses.length) {
    const last = game.guesses[0];
    ui.text(`${last.guess}：数字正确 ${last.correctNumbers}，位置正确 ${last.correctPositions}`, 18, kbY - 26, 11, "#D9E8EF");
  }
  const gap = 7;
  const keyW = (339 - gap * 4) / 5;
  for (let digit = 0; digit <= 9; digit += 1) {
    const col = digit % 5;
    const row = Math.floor(digit / 5);
    const x = 18 + col * (keyW + gap);
    const y = kbY + row * 51;
    ui.button(String(digit), x, y, keyW, 43, "#F4F7F8", () => game.pressDigit(String(digit)), { textColor: "#2C3E50", fontSize: 19, radius: 8, shadowColor: "#122A3E" });
  }
  const actionY = height - 128;
  ui.button("退格", 18, actionY, 72, 48, "#5D7180", () => game.backspace(), { fontSize: 13 });
  ui.button("清空", 99, actionY, 72, 48, "#E67E22", () => game.clearEditableInput(), { fontSize: 13 });
  ui.button("提交", 181, actionY, 176, 48, "#2ECC71", () => app.submitGuess(), { fontSize: 17 });
}

function drawReveal(app, ui, height) {
  const game = app.controller;
  const x = 34;
  const y = height / 2 - 210;
  ui.shadowCard(x, y, 307, 420, 18, "#FFFFFF");
  ui.text("使用显真镜", x + 22, y + 32, 21, "#2C3E50", "left", "bold");
  ui.button("×", x + 263, y + 14, 28, 28, "#DDE5E9", () => { app.playOverlay = null; }, { textColor: "#536873", shadow: false, radius: 14 });
  ui.text("🔍", x + 153.5, y + 105, 50, "#333333", "center");
  ui.text(`当前拥有 ${game.wallet.revealTools} 个`, x + 153.5, y + 160, 14, "#536873", "center", "bold");
  ui.wrappedText("随机锁定一位正确数字，极速竞赛每局最多使用一次。", x + 35, y + 188, 237, 20, { size: 13, color: "#70828E", align: "center", maxLines: 3 });
  ui.button("使用 1 个", x + 28, y + 270, 251, 44, "#2ECC71", () => app.useRevealTool(), { fontSize: 14 });
  ui.button(`购买 ${REVEAL_TOOL_COST} 金币`, x + 28, y + 330, 120, 42, "#E67E22", () => app.buyPlayReveal(), { fontSize: 12 });
  ui.button("看广告获得", x + 159, y + 330, 120, 42, "#4A90E2", () => app.watchRevealAd(), { fontSize: 12 });
}

function drawRevive(app, ui, height) {
  const x = 31;
  const y = height / 2 - 190;
  ui.shadowCard(x, y, 313, 380, 18, "#FFFFFF");
  ui.roundRect(x + 126, y + 38, 60, 60, 30, "#FDE9D8");
  ui.text("!", x + 156, y + 69, 34, "#E67E22", "center", "bold");
  ui.text("差一点就猜中啦！", x + 156, y + 130, 22, "#2C3E50", "center", "bold");
  ui.wrappedText("三次机会已用完。看视频可以额外获得一次机会，继续当前题目。", x + 38, y + 165, 237, 21, { size: 13, color: "#70828E", align: "center", maxLines: 3 });
  ui.button("看视频获得 1 次机会", x + 30, y + 250, 253, 48, "#2ECC71", () => app.reviveByAd(), { fontSize: 14 });
  ui.button("放弃重来", x + 30, y + 316, 253, 42, "#E8EEF1", () => app.giveUp(), { textColor: "#536873", fontSize: 13 });
}

function drawResult(app, ui, height) {
  const result = app.result;
  const x = 28;
  const modalH = result.rewardCoins > 0 ? 520 : 430;
  const y = height / 2 - modalH / 2;
  ui.shadowCard(x, y, 319, modalH, 18, "#FFFFFF");
  ui.roundRect(x + 124, y + 26, 72, 72, 36, "#2ECC71");
  ui.text("✓", x + 160, y + 64, 43, "#FFFFFF", "center", "bold");
  ui.text("通关成功！", x + 160, y + 129, 26, "#2C3E50", "center", "bold");
  ui.roundRect(x + 24, y + 160, 271, 122, 12, "#F3F7F8");
  ui.text(`金币奖励  +${result.rewardCoins}`, x + 44, y + 190, 14, "#2C3E50", "left", "bold");
  ui.text(`体力消耗  -${result.costStamina}`, x + 44, y + 221, 13, "#E67E22");
  ui.wrappedText(result.progressText, x + 44, y + 246, 230, 18, { size: 12, color: "#657985", maxLines: 2 });
  if (result.rewardCoins > 0) {
    ui.button(`看广告领取 3 倍（+${result.rewardCoins * 3}）`, x + 25, y + 310, 269, 52, "#2ECC71", () => app.claimReward(3), { fontSize: 14, disabled: app.rewardBusy });
    ui.button("普通领取", x + 25, y + 380, 269, 46, "#4A90E2", () => app.claimReward(1), { fontSize: 14, disabled: app.rewardBusy });
    ui.button("返回主页", x + 25, y + 445, 269, 40, "#E8EEF1", () => app.goHome(), { textColor: "#536873", fontSize: 12 });
  } else {
    ui.button(result.canContinue ? "下一关" : "完成", x + 25, y + 315, 269, 52, "#2ECC71", () => app.continueAfterResult(), { fontSize: 16 });
    ui.button("返回主页", x + 25, y + 380, 269, 38, "#E8EEF1", () => app.goHome(), { textColor: "#536873", fontSize: 12 });
  }
}

module.exports = drawPlay;
