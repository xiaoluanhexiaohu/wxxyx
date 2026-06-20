"use strict";

function drawBattle(app, ui, height) {
  ui.ctx.fillStyle = "#2C3E50";
  ui.ctx.fillRect(0, 0, 375, height);
  ui.text("好友对战", 24, 54, 28, "#FFFFFF", "left", "bold");
  ui.button("返回", 298, 32, 54, 38, "#496579", () => app.goHome(), { fontSize: 13, radius: 10 });
  ui.wrappedText("双方使用完全相同的答案和线索", 24, 83, 320, 18, { size: 13, color: "#BFD2DE" });

  battleCard(app, ui, 24, 128, "闯关对战", "先完成三关的一方获胜", "3关连胜", "#2ECC71", "checkpoint");
  battleCard(app, ui, 24, 292, "竞速对战", "完成同一关，用时更少获胜", "速度比拼", "#4A90E2", "speed");

  if (app.inviteBattle) {
    ui.shadowCard(24, 478, 327, 120, 16, "#FFFFFF");
    ui.text("收到好友邀请", 44, 510, 16, "#2C3E50", "left", "bold");
    ui.text(`${app.inviteBattle.type === "checkpoint" ? "闯关对战" : "竞速对战"} · ${app.inviteBattle.seed.slice(-8)}`, 44, 540, 13, "#687B87");
    ui.button("进入同局", 229, 524, 100, 48, "#F1C40F", () => app.startBattle(app.inviteBattle.type, app.inviteBattle.seed), { textColor: "#4A3A00", fontSize: 14 });
  }
}

function battleCard(app, ui, x, y, title, description, badge, color, type) {
  ui.shadowCard(x, y, 327, 136, 18, "#FFFFFF");
  ui.roundRect(x, y, 10, 136, 8, color);
  ui.text(title, x + 28, y + 30, 21, "#2C3E50", "left", "bold");
  ui.text(description, x + 28, y + 58, 13, "#687B87");
  ui.pill(badge, x + 28, y + 78, 76, 26, `${color}22`, color, 11);
  ui.button("邀请", x + 170, y + 76, 58, 42, "#F1C40F", () => app.shareBattle(type), { textColor: "#5B4700", fontSize: 13 });
  ui.button("开始", x + 238, y + 76, 66, 42, color, () => app.startBattle(type), { fontSize: 13 });
}

module.exports = drawBattle;
