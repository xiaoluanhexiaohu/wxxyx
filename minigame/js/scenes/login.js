"use strict";

function drawLogin(app, ui, height) {
  app.audio.stopBgm();
  const ctx = ui.ctx;
  const gradient = ctx.createLinearGradient(0, 0, 375, height);
  gradient.addColorStop(0, "#2C3E50");
  gradient.addColorStop(0.62, "#356E9F");
  gradient.addColorStop(1, "#4A90E2");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 375, height);

  ui.text("微信小游戏", 28, 74, 14, "#BDEFD4", "left", "bold");
  ui.text("逻辑大师", 28, 115, 34, "#FFFFFF", "left", "bold");
  ui.wrappedText("观察线索，推理出唯一正确的数字组合", 28, 148, 315, 22, { size: 15, color: "#DCEAF4" });

  ui.shadowCard(24, 235, 327, 245, 18, "#FFFFFF");
  ui.text("玩家登录", 46, 270, 20, "#2C3E50", "left", "bold");
  ui.roundRect(46, 302, 283, 54, 12, "#F1F5F7", "#D8E2E8");
  ui.text(app.loginNickname, 62, 329, 16, "#334A5C", "left", "bold");
  ui.button(app.loginBusy ? "正在绑定微信..." : "微信一键绑定 / 登录", 46, 378, 283, 56, "#2ECC71", () => app.login(), {
    disabled: app.loginBusy,
    fontSize: 17,
  });
  ui.wrappedText("登录后自动保存金币、体力、闯关进度和每日活动记录", 46, 449, 283, 18, { size: 12, color: "#70828E", maxLines: 2 });

  ui.text("纯 Canvas 渲染 · 微信小游戏运行时", 187.5, height - 38, 12, "rgba(255,255,255,0.72)", "center");
}

module.exports = drawLogin;
