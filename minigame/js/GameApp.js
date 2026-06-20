"use strict";

const CanvasUI = require("./ui/CanvasUI");
const drawLogin = require("./scenes/login");
const drawHome = require("./scenes/home");
const drawPlay = require("./scenes/play");
const drawBattle = require("./scenes/battle");
const adManager = require("./core/adManager");
const api = require("./core/api");
const storage = require("./core/storage");
const { createLeaderboard } = require("./core/rankings");
const { GameController, todayKey } = require("./core/GameController");

class GameApp {
  constructor(canvas, ctx, viewport) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.viewport = viewport;
    this.scale = viewport.width / 375;
    this.designHeight = viewport.height / this.scale;
    this.ui = new CanvasUI(ctx, 375, this.designHeight);
    this.controller = new GameController();
    this.controller.bootstrap();

    this.scene = this.controller.isLoggedIn ? (this.controller.puzzle ? "play" : "home") : "login";
    this.overlay = null;
    this.playOverlay = null;
    this.result = null;
    this.reviveVisible = false;
    this.rewardBusy = false;
    this.loginBusy = false;
    this.loginNickname = "数字玩家";
    this.toastMessage = "";
    this.toastUntil = 0;
    this.settings = storage.read("logic-number-settings", { sound: true, music: true, notice: true });

    this.rankMode = "simple";
    this.rankScope = "global";
    this.rankEntries = [];
    this.rankPage = 0;

    this.lotteryBusy = false;
    this.lotteryRotation = 0;
    this.lotteryStartRotation = 0;
    this.lotteryTargetRotation = 0;
    this.lotteryStartedAt = 0;
    this.lotteryRewardIndex = 0;
    this.lotteryMessage = "";

    this.inviteBattle = null;
    this.preparedBattleType = "checkpoint";
    this.preparedBattleSeed = this.createBattleSeed();
    this.sharePayload = null;
    this.today = todayKey();
    this.lastClockSecond = 0;

    this.processLaunchOptions(wx.getLaunchOptionsSync ? wx.getLaunchOptionsSync() : {});
    this.installEvents();
    this.loadRankings();
    adManager.preload("stamina");
    this.frame();
  }

  installEvents() {
    wx.onTouchStart((event) => {
      const touch = event.touches && event.touches[0];
      if (!touch) return;
      const x = Number(touch.clientX === undefined ? touch.x : touch.clientX) / this.scale;
      const y = Number(touch.clientY === undefined ? touch.y : touch.clientY) / this.scale;
      const action = this.ui.hit(x, y);
      if (action) {
        try {
          action();
        } catch (error) {
          this.toast(error && error.message ? error.message : "操作失败，请重试");
        }
      }
    });

    if (wx.showShareMenu) wx.showShareMenu({ withShareTicket: true });
    if (wx.onShareAppMessage) {
      wx.onShareAppMessage(() => this.sharePayload || {
        title: "逻辑大师：来挑战数字推理",
        query: this.controller.profile ? `scene=invite&inviteBy=${encodeURIComponent(this.controller.profile.openId)}` : "",
      });
    }
    if (wx.onShow) wx.onShow((options) => this.processLaunchOptions(options || {}));
  }

  processLaunchOptions(options) {
    const query = options.query || {};
    if (query.inviteBy) storage.write(storage.keys.pendingInviteBy, String(query.inviteBy));
    if (query.scene === "battle" && query.seed) {
      this.inviteBattle = { type: query.type === "speed" ? "speed" : "checkpoint", seed: String(query.seed) };
      if (this.controller.isLoggedIn) this.scene = "battle";
    }
  }

  frame() {
    this.update();
    this.render();
    const requestFrame = this.canvas.requestAnimationFrame
      ? this.canvas.requestAnimationFrame.bind(this.canvas)
      : (typeof requestAnimationFrame === "function" ? requestAnimationFrame : (callback) => setTimeout(callback, 16));
    requestFrame(() => this.frame());
  }

  update() {
    const now = Date.now();
    const second = Math.floor(now / 1000);
    if (second !== this.lastClockSecond) {
      this.lastClockSecond = second;
      this.today = todayKey();
      this.controller.tickTimer();
      this.controller.resetDailyCountersIfNeeded();
      if (second % 10 === 0) this.controller.recoverStamina();
    }
    if (this.lotteryBusy) {
      const progress = Math.min(1, (now - this.lotteryStartedAt) / 1400);
      const eased = 1 - Math.pow(1 - progress, 3);
      this.lotteryRotation = this.lotteryStartRotation + (this.lotteryTargetRotation - this.lotteryStartRotation) * eased;
      if (progress >= 1) {
        this.lotteryBusy = false;
        const result = this.controller.drawDailyLottery(this.lotteryRewardIndex);
        this.lotteryMessage = result.message;
        this.toast(result.message);
      }
    }
  }

  render() {
    this.ctx.save();
    this.ctx.scale(this.scale, this.scale);
    this.ui.begin();
    if (this.scene === "login") drawLogin(this, this.ui, this.designHeight);
    if (this.scene === "home") drawHome(this, this.ui, this.designHeight);
    if (this.scene === "play") drawPlay(this, this.ui, this.designHeight);
    if (this.scene === "battle") drawBattle(this, this.ui, this.designHeight);
    this.drawToast();
    this.ctx.restore();
  }

  drawToast() {
    if (!this.toastMessage || Date.now() >= this.toastUntil) return;
    const width = Math.min(325, Math.max(150, this.toastMessage.length * 13 + 34));
    const x = (375 - width) / 2;
    const y = this.designHeight - 150;
    this.ui.roundRect(x, y, width, 44, 12, "rgba(20, 35, 44, 0.9)");
    this.ui.text(this.toastMessage, 187.5, y + 22, 12.5, "#FFFFFF", "center", "bold");
  }

  toast(message) {
    this.toastMessage = String(message || "");
    this.toastUntil = Date.now() + 2200;
  }

  async login() {
    if (this.loginBusy) return;
    this.loginBusy = true;
    try {
      const user = await this.getWechatProfile();
      const nickname = user.nickName || this.loginNickname || "数字玩家";
      await this.controller.registerOrLogin(nickname, user.avatarUrl || "");
      await this.controller.bindPendingInviter();
      this.scene = this.inviteBattle ? "battle" : (this.controller.puzzle ? "play" : "home");
      this.toast("登录成功");
    } catch (_) {
      this.toast("登录失败，请重试");
    } finally {
      this.loginBusy = false;
    }
  }

  getWechatProfile() {
    if (typeof wx.getUserProfile !== "function") return Promise.resolve({});
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value || {});
      };
      wx.getUserProfile({
        desc: "用于绑定微信账号并展示玩家资料",
        success: (res) => finish(res.userInfo),
        fail: () => finish({}),
      });
      setTimeout(() => finish({}), 1800);
    });
  }

  logout() {
    this.closeOverlay();
    this.controller.logout();
    this.scene = "login";
    this.toast("已退出登录");
  }

  startMode(mode, difficulty) {
    const result = this.controller.startMode(mode, difficulty);
    if (!result.ok) {
      this.toast(result.message);
      return;
    }
    this.result = null;
    this.reviveVisible = false;
    this.scene = "play";
  }

  openBattle(type) {
    this.preparedBattleType = type;
    this.preparedBattleSeed = this.createBattleSeed();
    this.scene = "battle";
  }

  startBattle(type, seed) {
    const result = this.controller.startBattle(type, seed || this.preparedBattleSeed || this.createBattleSeed());
    if (!result.ok) {
      this.toast(result.message);
      return;
    }
    this.result = null;
    this.reviveVisible = false;
    this.scene = "play";
  }

  shareBattle(type) {
    this.preparedBattleType = type;
    this.preparedBattleSeed = this.createBattleSeed();
    this.sharePayload = {
      title: type === "checkpoint" ? "逻辑大师闯关对战：先过三关获胜" : "逻辑大师竞速对战：来比谁更快",
      query: `scene=battle&type=${type}&seed=${encodeURIComponent(this.preparedBattleSeed)}`,
    };
    if (wx.shareAppMessage) wx.shareAppMessage(this.sharePayload);
  }

  shareInvite() {
    this.sharePayload = {
      title: "逻辑大师：来挑战数字推理",
      query: this.controller.profile ? `scene=invite&inviteBy=${encodeURIComponent(this.controller.profile.openId)}` : "",
    };
    if (wx.shareAppMessage) wx.shareAppMessage(this.sharePayload);
  }

  createBattleSeed() {
    return `share-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  goHome() {
    this.overlay = null;
    this.playOverlay = null;
    this.result = null;
    this.reviveVisible = false;
    this.scene = "home";
  }

  resumePuzzle() {
    if (!this.controller.puzzle) {
      this.toast("当前没有未完成关卡");
      return;
    }
    this.scene = "play";
  }

  confirmLeavePlay() {
    this.goHome();
    this.toast(this.controller.puzzle ? "当前关卡已保存" : "已返回主页");
  }

  openOverlay(name) {
    this.overlay = name;
    if (name === "lottery") this.lotteryMessage = "";
  }

  closeOverlay() {
    if (this.lotteryBusy) return;
    this.overlay = null;
  }

  async watchAd(scene) {
    const reward = await adManager.show(scene);
    if (!reward.granted) {
      this.toast("广告未完整播放");
      return;
    }
    if (scene === "stamina") {
      this.controller.grantStamina(40);
      this.toast("体力 +40");
    } else if (scene === "gold") {
      this.controller.grantGold(80);
      this.toast("金币 +80");
    } else if (scene === "reveal") {
      this.controller.grantRevealTools(1);
      this.toast("显真镜 +1");
    }
  }

  buyRevealTool() {
    const result = this.controller.buyRevealTool();
    this.toast(result.message);
  }

  openRanking() {
    this.overlay = "ranking";
    this.rankPage = 0;
    this.loadRankings();
  }

  setRankMode(mode) {
    this.rankMode = mode;
    this.rankPage = 0;
    this.loadRankings();
  }

  toggleRankScope() {
    this.rankScope = this.rankScope === "global" ? "friend" : "global";
    this.rankPage = 0;
    this.loadRankings();
  }

  changeRankPage(delta) {
    this.rankPage = Math.max(0, Math.min(4, this.rankPage + delta));
  }

  async loadRankings() {
    this.rankEntries = createLeaderboard(this.controller.profile, this.controller.progress, this.rankScope, this.rankMode);
    const remote = await api.fetchLeaderboard({
      mode: this.rankMode,
      scope: this.rankScope,
      openId: this.controller.profile && this.controller.profile.openId,
    });
    if (Array.isArray(remote) && remote.length) {
      this.rankEntries = remote.slice(0, 50).map((entry, index) => ({
        ...entry,
        rank: entry.rank || index + 1,
        metricText: this.rankMode === "speedrun"
          ? (entry.bestTimeMs ? `${(entry.bestTimeMs / 1000).toFixed(2)} 秒` : "暂无成绩")
          : `第 ${entry.level || 1} 关`,
      }));
    }
  }

  claimSignIn() {
    const result = this.controller.claimDailySignIn();
    this.toast(result.message);
    if (result.ok) this.closeOverlay();
  }

  spinLottery() {
    if (this.lotteryBusy || this.controller.progress.lotteryDate === this.today) {
      this.toast("今日抽奖次数已用完");
      return;
    }
    this.lotteryRewardIndex = Math.floor(Math.random() * 6);
    const segment = Math.PI * 2 / 6;
    this.lotteryStartRotation = this.lotteryRotation;
    this.lotteryTargetRotation = this.lotteryRotation + Math.PI * 10 - this.lotteryRewardIndex * segment;
    this.lotteryStartedAt = Date.now();
    this.lotteryBusy = true;
    this.lotteryMessage = "转盘旋转中...";
  }

  toggleSetting(key) {
    this.settings[key] = !this.settings[key];
    storage.write("logic-number-settings", this.settings);
  }

  submitGuess() {
    const puzzle = this.controller.puzzle;
    if (!puzzle) return;
    const mode = this.controller.progress.selectedMode;
    const rewardCoins = mode === "simple" || mode === "hard"
      ? puzzle.difficulty.rewardGold
      : mode === "battleSpeed"
        ? 10
        : (mode === "battleCheckpoint" && this.controller.battle && this.controller.battle.completed + 1 >= this.controller.battle.target ? 20 : 0);
    const costStamina = puzzle.difficulty.staminaCost;
    const levelBefore = puzzle.round || this.controller.progress.modeLevels[mode];
    const result = this.controller.submitGuess();
    if (!result.ok) {
      this.toast(result.message);
      return;
    }
    if (!result.solved) {
      if (result.failed) this.reviveVisible = true;
      else this.toast(result.message);
      return;
    }
    const canContinue = mode === "simple" || mode === "hard" || (mode === "battleCheckpoint" && Boolean(this.controller.battle));
    this.result = {
      puzzle: result.puzzle,
      rewardCoins,
      costStamina,
      canContinue,
      progressText: canContinue ? `第 ${levelBefore + 1} 关已解锁` : result.message,
    };
  }

  async claimReward(multiplier) {
    if (this.rewardBusy || !this.result) return;
    this.rewardBusy = true;
    try {
      let transactionId = "";
      if (multiplier === 3) {
        const ad = await adManager.show("triple");
        if (!ad.granted) {
          this.toast("广告未完整播放");
          return;
        }
        transactionId = ad.transactionId;
      }
      const settled = await this.controller.settleLevelReward(multiplier, transactionId);
      if (!settled.ok) {
        this.toast(settled.message);
        return;
      }
      this.toast(`金币 +${settled.rewardCoins}`);
      this.continueAfterResult();
    } finally {
      this.rewardBusy = false;
    }
  }

  continueAfterResult() {
    if (!this.result) return;
    if (!this.result.canContinue) {
      this.goHome();
      return;
    }
    const next = this.controller.startPuzzle();
    if (!next.ok) {
      this.toast(next.message);
      this.goHome();
      return;
    }
    this.result = null;
    this.toast("下一关开始");
  }

  useRevealTool() {
    const result = this.controller.useRevealTool();
    this.toast(result.message);
    if (result.ok) this.playOverlay = null;
  }

  buyPlayReveal() {
    const result = this.controller.buyRevealTool();
    this.toast(result.message);
  }

  async watchRevealAd() {
    const reward = await adManager.show("reveal");
    if (!reward.granted) {
      this.toast("广告未完整播放");
      return;
    }
    const result = this.controller.revealFromAd();
    this.toast(result.message);
    if (result.ok) this.playOverlay = null;
  }

  async reviveByAd() {
    const reward = await adManager.show("revive");
    if (!reward.granted) {
      this.toast("广告未完整播放");
      return;
    }
    const result = this.controller.reviveCurrentPuzzle();
    this.toast(result.message);
    if (result.ok) this.reviveVisible = false;
  }

  giveUp() {
    const mode = this.controller.progress.selectedMode;
    this.reviveVisible = false;
    this.controller.failPuzzle();
    if (mode === "battleCheckpoint" || mode === "battleSpeed") {
      this.scene = "battle";
      return;
    }
    const next = this.controller.startPuzzle();
    if (!next.ok) {
      this.goHome();
      this.toast(next.message);
    } else {
      this.toast("已重新开始");
    }
  }

  elapsedText() {
    if (!this.controller.startedAt) return "0.00s";
    return `${((Date.now() - this.controller.startedAt) / 1000).toFixed(2)}s`;
  }
}

module.exports = GameApp;
