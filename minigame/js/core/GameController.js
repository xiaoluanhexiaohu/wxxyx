"use strict";

const api = require("./api");
const audioManager = require("./AudioManager");
const storage = require("./storage");
const {
  DIFFICULTIES,
  DIGITS,
  compareDigits,
  createSolvedPuzzle,
  isValidGuess,
  randomUnrevealedIndex,
  toCountHint,
} = require("./numberPuzzle");

const MAX_STAMINA = 100;
const MAX_GUESSES = 3;
const DAILY_CHALLENGE_LIMIT = 2;
const SPEEDRUN_CHALLENGE_LIMIT = 2;
const STAMINA_RECOVER_MS = 12 * 60 * 1000;
const STAMINA_RECOVER_AMOUNT = 1;
const REVEAL_TOOL_COST = 80;
const SPEEDRUN_REVEAL_LIMIT = 1;

const LOTTERY_REWARDS = [
  { key: "gold10", gold: 10, stamina: 0, revealTools: 0, label: "10金币" },
  { key: "gold20", gold: 20, stamina: 0, revealTools: 0, label: "20金币" },
  { key: "stamina10", gold: 0, stamina: 10, revealTools: 0, label: "10体力" },
  { key: "stamina20", gold: 0, stamina: 20, revealTools: 0, label: "20体力" },
  { key: "reveal1", gold: 0, stamina: 0, revealTools: 1, label: "1个显真镜" },
  { key: "reveal2", gold: 0, stamina: 0, revealTools: 2, label: "2个显真镜" },
];

const SIGN_IN_REWARDS = [
  { gold: 10, stamina: 0, revealTools: 0, label: "10金币" },
  { gold: 0, stamina: 10, revealTools: 0, label: "10体力" },
  { gold: 20, stamina: 0, revealTools: 0, label: "20金币" },
  { gold: 0, stamina: 20, revealTools: 0, label: "20体力" },
  { gold: 0, stamina: 0, revealTools: 1, label: "1个显真镜" },
  { gold: 30, stamina: 0, revealTools: 0, label: "30金币" },
  { gold: 0, stamina: 0, revealTools: 2, label: "2个显真镜" },
];

function defaultModeLevels() {
  return { simple: 1, hard: 1, daily: 1, speedrun: 1, battleCheckpoint: 1, battleSpeed: 1 };
}

function defaultWallet() {
  return { stamina: 100, staminaLimit: MAX_STAMINA, gold: 80, revealTools: 1, lastStaminaAt: Date.now() };
}

function defaultProgress() {
  return {
    endlessLevel: 1,
    bestEndlessLevel: 0,
    bestSpeedMs: 0,
    dailyDate: "",
    dailyFinished: false,
    challengeDate: todayKey(),
    dailyAttemptsUsed: 0,
    speedrunAttemptsUsed: 0,
    signInDate: "",
    signInHistory: {},
    lotteryDate: "",
    speedrunRevealUsed: 0,
    modeLevels: defaultModeLevels(),
    bestModeLevels: defaultModeLevels(),
    selectedMode: "simple",
    selectedDifficulty: "easy",
  };
}

class GameController {
  constructor() {
    this.profile = null;
    this.wallet = defaultWallet();
    this.progress = defaultProgress();
    this.puzzle = null;
    this.input = [];
    this.locked = [];
    this.guesses = [];
    this.startedAt = 0;
    this.dailyLeftSeconds = 100;
    this.speedrunRevealUsed = 0;
    this.battle = null;
  }

  get isLoggedIn() {
    return Boolean(this.profile && this.profile.token);
  }

  get attemptsLeft() {
    return Math.max(0, MAX_GUESSES - this.guesses.length);
  }

  get staminaLimit() {
    return this.wallet.staminaLimit || MAX_STAMINA;
  }

  get totalClears() {
    return Object.values(this.progress.bestModeLevels || {}).reduce((sum, level) => sum + Math.max(0, Number(level || 1) - 1), 0);
  }

  get dailyAttemptsLeft() {
    return Math.max(0, DAILY_CHALLENGE_LIMIT - this.progress.dailyAttemptsUsed);
  }

  get speedrunAttemptsLeft() {
    return Math.max(0, SPEEDRUN_CHALLENGE_LIMIT - this.progress.speedrunAttemptsUsed);
  }

  bootstrap() {
    this.profile = storage.read(storage.keys.profile, null);
    this.wallet = normalizeWallet(storage.read(storage.keys.wallet, defaultWallet()));
    this.progress = normalizeProgress(storage.read(storage.keys.progress, defaultProgress()));
    this.resetDailyCountersIfNeeded();
    const session = storage.read(storage.keys.session, null);
    this.battle = (session && session.battle) || null;
    if (session && session.puzzle && isSupportedPuzzle(session.puzzle)) {
      this.puzzle = session.puzzle;
      const length = session.puzzle.difficulty.digitLength;
      this.input = session.input || Array(length).fill("");
      this.locked = session.locked || Array(length).fill(false);
      this.guesses = session.guesses || [];
      this.startedAt = session.startedAt || Date.now();
      this.dailyLeftSeconds = session.dailyLeftSeconds || 100;
      this.speedrunRevealUsed = session.speedrunRevealUsed || this.progress.speedrunRevealUsed || 0;
    }
    this.recoverStamina();
  }

  async registerOrLogin(nickname, avatarUrl = "") {
    const code = await this.getLoginCode();
    this.profile = await api.loginOrRegister({ code, nickname, avatarUrl });
    this.persistAll();
    await this.syncCloud();
    return this.profile;
  }

  logout() {
    this.profile = null;
    this.puzzle = null;
    this.input = [];
    this.locked = [];
    this.guesses = [];
    this.battle = null;
    storage.remove(storage.keys.profile);
    storage.remove(storage.keys.session);
  }

  startMode(mode, difficulty = defaultDifficultyForMode(mode)) {
    this.battle = null;
    this.progress.selectedMode = mode;
    this.progress.selectedDifficulty = difficulty;
    return this.startPuzzle();
  }

  startBattle(type, seed = createBattleSeed()) {
    this.battle = { type, seed, completed: 0, target: type === "checkpoint" ? 3 : 1, startedAt: Date.now() };
    this.progress.selectedMode = type === "checkpoint" ? "battleCheckpoint" : "battleSpeed";
    this.progress.selectedDifficulty = "easy";
    return this.startPuzzle();
  }

  startPuzzle() {
    this.recoverStamina();
    this.resetDailyCountersIfNeeded();
    const mode = this.progress.selectedMode;
    const difficulty = DIFFICULTIES[this.progress.selectedDifficulty];
    if (consumesStamina(mode) && this.wallet.stamina < difficulty.staminaCost) {
      return { ok: false, message: "体力不足，观看激励视频可恢复体力。" };
    }
    if (consumesStamina(mode)) {
      this.wallet.stamina -= difficulty.staminaCost;
      this.wallet.lastStaminaAt = Date.now();
    }
    if (mode === "daily") {
      if (this.progress.dailyAttemptsUsed >= DAILY_CHALLENGE_LIMIT) return { ok: false, message: "今日每日挑战次数已用完，明天 0 点刷新。" };
      this.progress.dailyAttemptsUsed += 1;
      this.applyDailyGift();
      this.dailyLeftSeconds = 100;
    }
    if (mode === "speedrun") {
      if (this.progress.speedrunAttemptsUsed >= SPEEDRUN_CHALLENGE_LIMIT) return { ok: false, message: "今日极速竞赛次数已用完，明天 0 点刷新。" };
      this.progress.speedrunAttemptsUsed += 1;
    }
    const seed = this.puzzleSeedForCurrentMode();
    const generated = createSolvedPuzzle(difficulty, seed);
    this.puzzle = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      secret: generated.secret,
      difficulty,
      clues: generated.clues,
      guaranteedUnique: generated.guaranteedUnique,
      createdAt: Date.now(),
      seed,
      round: this.battle ? this.battle.completed + 1 : this.progress.modeLevels[mode],
    };
    this.input = Array(difficulty.digitLength).fill("");
    this.locked = Array(difficulty.digitLength).fill(false);
    this.guesses = [];
    this.startedAt = Date.now();
    this.speedrunRevealUsed = 0;
    this.progress.speedrunRevealUsed = 0;
    if (this.totalClears <= 3 && this.puzzle.secret.length > 0) {
      this.input[0] = this.puzzle.secret[0];
      this.locked[0] = true;
      this.puzzle.noviceReveal = true;
    }
    this.persistAll();
    return { ok: true, message: "关卡已开始。" };
  }

  pressDigit(digit) {
    if (!this.puzzle || !DIGITS.includes(String(digit))) return;
    const index = this.input.findIndex((value, i) => !this.locked[i] && !value);
    if (index >= 0) {
      this.input[index] = String(digit);
      this.persistSession();
      // Number placement is this puzzle game's equivalent of a tile merge action.
      audioManager.playSfx("merge");
    }
  }

  backspace() {
    for (let index = this.input.length - 1; index >= 0; index -= 1) {
      if (!this.locked[index] && this.input[index]) {
        this.input[index] = "";
        this.persistSession();
        return;
      }
    }
  }

  clearEditableInput() {
    this.input = this.input.map((value, index) => (this.locked[index] ? value : ""));
    this.persistSession();
  }

  submitGuess() {
    if (!this.puzzle) return { ok: false, solved: false, failed: false, message: "请先开始关卡。" };
    const puzzleSnapshot = this.puzzle;
    if (!isValidGuess(this.input, puzzleSnapshot.difficulty.digitLength)) {
      return { ok: false, solved: false, failed: false, message: `请输入 ${puzzleSnapshot.difficulty.digitLength} 个数字，数字可以重复。` };
    }
    const guess = this.input.join("");
    const result = compareDigits(puzzleSnapshot.secret, guess);
    const text = toCountHint(result);
    this.guesses.unshift({
      guess,
      text,
      correctNumbers: result.exact + result.misplaced,
      correctPositions: result.exact,
      createdAt: Date.now(),
    });
    if (result.exact === puzzleSnapshot.difficulty.digitLength) {
      audioManager.playSfx("win");
      const message = this.finishPuzzle();
      return { ok: true, solved: true, failed: false, message, puzzle: puzzleSnapshot };
    }
    if (this.guesses.length >= MAX_GUESSES) {
      audioManager.playSfx("lose");
      this.persistSession();
      return { ok: true, solved: false, failed: true, message: "三次机会已用完，可看视频额外获得 1 次机会。" };
    }
    this.input = this.input.map((value, index) => (this.locked[index] ? value : ""));
    this.persistSession();
    return { ok: true, solved: false, failed: false, message: `${text}剩余 ${this.attemptsLeft} 次机会。` };
  }

  useRevealTool() {
    if (!this.puzzle) return { ok: false, message: "请先开始关卡。" };
    if (this.progress.selectedMode === "speedrun" && this.speedrunRevealUsed >= SPEEDRUN_REVEAL_LIMIT) return { ok: false, message: "极速竞赛每局只能使用 1 个显真镜。" };
    if (this.wallet.revealTools <= 0) return { ok: false, message: "没有可用的显真透视镜。" };
    const result = this.revealOneDigit();
    if (!result.ok) return result;
    this.wallet.revealTools -= 1;
    this.markSpeedrunReveal();
    this.persistAll();
    return { ok: true, message: "已使用显真透视镜。" };
  }

  buyRevealTool() {
    if (this.wallet.gold < REVEAL_TOOL_COST) return { ok: false, message: `金币不足，购买一个显真镜需要 ${REVEAL_TOOL_COST} 金币。` };
    this.wallet.gold -= REVEAL_TOOL_COST;
    this.wallet.revealTools += 1;
    this.persistWallet();
    return { ok: true, message: "购买成功，显真透视镜 +1。" };
  }

  revealFromAd() {
    if (this.progress.selectedMode === "speedrun" && this.speedrunRevealUsed >= SPEEDRUN_REVEAL_LIMIT) return { ok: false, message: "极速竞赛每局只能使用 1 个显真镜。" };
    const result = this.revealOneDigit();
    if (result.ok) {
      this.markSpeedrunReveal();
      this.persistAll();
    }
    return result;
  }

  revealOneDigit() {
    if (!this.puzzle) return { ok: false, message: "请先开始关卡。" };
    const index = randomUnrevealedIndex(this.locked);
    if (index < 0) return { ok: false, message: "所有数字都已经显示。" };
    this.input[index] = this.puzzle.secret[index];
    this.locked[index] = true;
    return { ok: true, message: "已随机显示一个正确数字。" };
  }

  markSpeedrunReveal() {
    if (this.progress.selectedMode === "speedrun") {
      this.speedrunRevealUsed += 1;
      this.progress.speedrunRevealUsed = this.speedrunRevealUsed;
    }
  }

  grantStamina(amount) {
    this.recoverStamina();
    this.wallet.stamina = Math.min(this.staminaLimit, this.wallet.stamina + amount);
    this.wallet.lastStaminaAt = Date.now();
    this.persistWallet();
  }

  grantGold(amount) {
    this.wallet.gold += amount;
    this.persistWallet();
  }

  grantRevealTools(amount) {
    this.wallet.revealTools += amount;
    this.persistWallet();
  }

  reviveCurrentPuzzle() {
    if (!this.puzzle) return { ok: false, message: "请先开始关卡。" };
    if (this.guesses.length < MAX_GUESSES) return { ok: false, message: "当前还没有用完机会。" };
    this.guesses = this.guesses.slice(0, MAX_GUESSES - 1);
    this.input = this.input.map((value, index) => (this.locked[index] ? value : ""));
    this.persistSession();
    return { ok: true, message: "已额外获得 1 次机会。" };
  }

  async settleLevelReward(adMultiplier = 1, transactionId = "") {
    if (!this.profile) return { ok: false, message: "请先登录。", rewardCoins: 0 };
    const result = await api.settleLevelReward({
      openId: this.profile.openId,
      mode: this.progress.selectedMode,
      isWin: true,
      adMultiplier,
      transactionId,
    });
    if (!result.ok) return { ok: false, message: result.message || "结算失败，请稍后重试。", rewardCoins: 0 };
    if (result.wallet) this.applyRemoteWallet(result.wallet);
    else if (result.rewardCoins > 0) this.wallet.gold += result.rewardCoins;
    this.persistWallet();
    this.syncCloud();
    return { ok: true, message: `获得 ${result.rewardCoins} 金币。`, rewardCoins: result.rewardCoins };
  }

  async bindPendingInviter() {
    if (!this.profile) return;
    const inviteBy = storage.read(storage.keys.pendingInviteBy, "");
    if (!inviteBy || inviteBy === this.profile.openId) return;
    const result = await api.bindInviter({ openId: this.profile.openId, inviteBy });
    if (result.ok) storage.remove(storage.keys.pendingInviteBy);
  }

  claimDailySignIn() {
    const today = todayKey();
    if (this.progress.signInDate === today) return { ok: false, message: "今日已签到。" };
    const reward = signInRewardForDate(today);
    this.progress.signInDate = today;
    this.progress.signInHistory[today] = reward.label;
    this.applyReward(reward);
    this.persistAll();
    return { ok: true, message: `签到成功，获得 ${reward.label}。` };
  }

  drawDailyLottery(rewardIndex) {
    const today = todayKey();
    if (this.progress.lotteryDate === today) return { ok: false, message: "今日抽奖次数已用完。" };
    const index = typeof rewardIndex === "number" ? rewardIndex : Math.floor(Math.random() * LOTTERY_REWARDS.length);
    const reward = LOTTERY_REWARDS[index];
    this.progress.lotteryDate = today;
    this.applyReward(reward);
    this.persistAll();
    return { ok: true, message: `抽奖获得：${reward.label}。`, rewardIndex: index };
  }

  applyReward(reward) {
    this.wallet.gold += reward.gold || 0;
    this.wallet.stamina = Math.min(this.staminaLimit, this.wallet.stamina + (reward.stamina || 0));
    this.wallet.revealTools += reward.revealTools || 0;
  }

  recoverStamina() {
    if (this.wallet.stamina >= this.staminaLimit) {
      this.wallet.lastStaminaAt = Date.now();
      this.persistWallet();
      return;
    }
    const recovered = Math.floor((Date.now() - this.wallet.lastStaminaAt) / STAMINA_RECOVER_MS);
    if (recovered <= 0) return;
    this.wallet.stamina = Math.min(this.staminaLimit, this.wallet.stamina + recovered * STAMINA_RECOVER_AMOUNT);
    this.wallet.lastStaminaAt += recovered * STAMINA_RECOVER_MS;
    this.persistWallet();
  }

  tickTimer() {
    if (this.progress.selectedMode !== "daily" || !this.startedAt || !this.puzzle) return;
    this.dailyLeftSeconds = Math.max(0, 100 - Math.floor((Date.now() - this.startedAt) / 1000));
  }

  finishPuzzle() {
    if (!this.puzzle) return "";
    const mode = this.progress.selectedMode;
    const reward = this.puzzle.difficulty.rewardGold;
    let message = "恭喜，数字全部正确。";
    if (mode === "simple") {
      this.progress.modeLevels.simple += 1;
      this.progress.bestModeLevels.simple = Math.max(this.progress.bestModeLevels.simple, this.progress.modeLevels.simple);
      this.progress.endlessLevel = this.progress.modeLevels.simple;
      this.progress.bestEndlessLevel = Math.max(this.progress.bestEndlessLevel, this.progress.modeLevels.simple - 1);
      message = `闯关成功，获得 ${reward} 金币。`;
    } else if (mode === "hard") {
      this.progress.modeLevels.hard += 1;
      this.progress.bestModeLevels.hard = Math.max(this.progress.bestModeLevels.hard, this.progress.modeLevels.hard);
      message = `困难模式闯关成功，获得 ${reward} 金币。`;
    } else if (mode === "daily") {
      this.wallet.stamina = Math.min(this.staminaLimit, this.wallet.stamina + 15);
      this.progress.dailyFinished = true;
      this.advanceMode(mode);
      message = "每日挑战完成，体力 +15。";
    } else if (mode === "speedrun") {
      const elapsed = Date.now() - this.startedAt;
      this.wallet.stamina = Math.min(this.staminaLimit, this.wallet.stamina + 15);
      this.progress.bestSpeedMs = this.progress.bestSpeedMs ? Math.min(this.progress.bestSpeedMs, elapsed) : elapsed;
      this.advanceMode(mode);
      message = `极速竞赛完成，用时 ${(elapsed / 1000).toFixed(2)} 秒，体力 +15。`;
    } else if (mode === "battleCheckpoint" && this.battle) {
      this.battle.completed += 1;
      if (this.battle.completed >= this.battle.target) {
        this.advanceMode(mode);
        message = "闯关对战完成，三关全部通过，金币 +20。";
        this.battle = null;
      } else {
        message = `闯关成功，已完成 ${this.battle.completed}/${this.battle.target}，点击继续进入下一关。`;
      }
    } else if (mode === "battleSpeed" && this.battle) {
      const elapsed = Date.now() - this.startedAt;
      this.advanceMode(mode);
      message = `竞速对战完成，用时 ${(elapsed / 1000).toFixed(2)} 秒，金币 +10。`;
      this.battle = null;
    }
    this.puzzle = null;
    this.input = [];
    this.locked = [];
    this.guesses = [];
    this.persistAll();
    this.syncCloud();
    return message;
  }

  advanceMode(mode) {
    this.progress.modeLevels[mode] += 1;
    this.progress.bestModeLevels[mode] = Math.max(this.progress.bestModeLevels[mode], this.progress.modeLevels[mode]);
  }

  failPuzzle() {
    if (this.progress.selectedMode === "battleCheckpoint" || this.progress.selectedMode === "battleSpeed") this.battle = null;
    this.puzzle = null;
    this.input = [];
    this.locked = [];
    this.guesses = [];
    this.persistAll();
    this.syncCloud();
  }

  resetDailyCountersIfNeeded() {
    const today = todayKey();
    if (this.progress.challengeDate === today) return;
    this.progress.challengeDate = today;
    this.progress.dailyAttemptsUsed = 0;
    this.progress.speedrunAttemptsUsed = 0;
    this.progress.dailyFinished = false;
    this.persistProgress();
  }

  applyDailyGift() {
    const today = todayKey();
    if (this.progress.dailyDate === today) return;
    this.wallet.stamina = Math.min(this.staminaLimit, this.wallet.stamina + 15);
    this.progress.dailyDate = today;
    this.progress.dailyFinished = false;
  }

  puzzleSeedForCurrentMode() {
    if (this.battle) return `${this.battle.seed}:${this.battle.completed + 1}`;
    if (this.progress.selectedMode === "daily") return `daily:${todayKey()}:${this.progress.selectedDifficulty}:${this.progress.dailyAttemptsUsed}`;
    return "";
  }

  applyRemoteWallet(remote) {
    const remoteGold = Number(remote.gold === undefined ? remote.coins : remote.gold);
    this.wallet = normalizeWallet({ ...this.wallet, ...remote, gold: Number.isFinite(remoteGold) ? remoteGold : this.wallet.gold });
  }

  persistAll() {
    if (this.profile) storage.write(storage.keys.profile, this.profile);
    this.persistWallet();
    this.persistProgress();
    this.persistSession();
  }

  persistWallet() {
    storage.write(storage.keys.wallet, this.wallet);
  }

  persistProgress() {
    storage.write(storage.keys.progress, this.progress);
  }

  persistSession() {
    storage.write(storage.keys.session, {
      puzzle: this.puzzle,
      input: this.input,
      locked: this.locked,
      guesses: this.guesses,
      startedAt: this.startedAt,
      dailyLeftSeconds: this.dailyLeftSeconds,
      speedrunRevealUsed: this.speedrunRevealUsed,
      battle: this.battle,
    });
  }

  async syncCloud() {
    if (this.profile) await api.syncPlayerState(this.profile, this.wallet, this.progress);
  }

  getLoginCode() {
    return new Promise((resolve) => {
      wx.login({ success: (res) => resolve(res.code || `mock-code-${Date.now()}`), fail: () => resolve(`mock-code-${Date.now()}`) });
    });
  }
}

function normalizeWallet(wallet) {
  const fallback = defaultWallet();
  return { ...fallback, ...(wallet || {}), staminaLimit: (wallet && wallet.staminaLimit) || fallback.staminaLimit, lastStaminaAt: (wallet && wallet.lastStaminaAt) || Date.now() };
}

function normalizeProgress(progress) {
  const fallback = defaultProgress();
  const saved = progress || {};
  const selectedMode = normalizeMode(saved.selectedMode);
  const selectedDifficulty = saved.selectedDifficulty === "hard" ? "hard" : defaultDifficultyForMode(selectedMode);
  const simpleLevel = (saved.modeLevels && (saved.modeLevels.simple || saved.modeLevels.endless)) || saved.endlessLevel || 1;
  const bestSimple = (saved.bestModeLevels && (saved.bestModeLevels.simple || saved.bestModeLevels.endless)) || saved.bestEndlessLevel || 1;
  return {
    ...fallback,
    ...saved,
    selectedMode,
    selectedDifficulty,
    signInHistory: saved.signInHistory || {},
    modeLevels: { ...fallback.modeLevels, ...(saved.modeLevels || {}), simple: simpleLevel },
    bestModeLevels: { ...fallback.bestModeLevels, ...(saved.bestModeLevels || {}), simple: bestSimple },
    endlessLevel: simpleLevel,
    bestEndlessLevel: Math.max(0, bestSimple - 1, saved.bestEndlessLevel || 0),
    challengeDate: saved.challengeDate || todayKey(),
  };
}

function normalizeMode(mode) {
  if (mode === "endless") return "simple";
  return ["simple", "hard", "daily", "speedrun", "battleCheckpoint", "battleSpeed"].includes(mode) ? mode : "simple";
}

function defaultDifficultyForMode(mode) {
  return mode === "hard" ? "hard" : "easy";
}

function consumesStamina(mode) {
  return mode === "simple" || mode === "hard";
}

function createBattleSeed() {
  return `battle-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isSupportedPuzzle(puzzle) {
  return puzzle && puzzle.difficulty && (puzzle.difficulty.key === "easy" || puzzle.difficulty.key === "hard");
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function signInRewardForDate(dateKey) {
  return SIGN_IN_REWARDS[(Number(dateKey.slice(-2)) - 1) % SIGN_IN_REWARDS.length];
}

module.exports = {
  DAILY_CHALLENGE_LIMIT,
  DIFFICULTIES,
  LOTTERY_REWARDS,
  MAX_GUESSES,
  MAX_STAMINA,
  REVEAL_TOOL_COST,
  SIGN_IN_REWARDS,
  SPEEDRUN_CHALLENGE_LIMIT,
  SPEEDRUN_REVEAL_LIMIT,
  STAMINA_RECOVER_AMOUNT,
  STAMINA_RECOVER_MS,
  GameController,
  todayKey,
};
