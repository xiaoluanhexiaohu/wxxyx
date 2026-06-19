import { defineStore } from "pinia";
import type {
  BattleState,
  BattleType,
  DifficultyKey,
  GameMode,
  GuessRecord,
  PlayerProfile,
  ProgressState,
  PuzzleState,
  WalletState,
} from "@/types/game";
import { loginOrRegister, syncPlayerState } from "@/services/api";
import { readStorage, removeStorage, storageKeys, writeStorage } from "@/services/storage";
import {
  compareDigits,
  createSolvedPuzzle,
  DIFFICULTIES,
  DIGITS,
  isValidGuess,
  randomUnrevealedIndex,
  toCountHint,
} from "@/utils/numberPuzzle";

export const MAX_STAMINA = 100;
export const MAX_GUESSES = 3;
export const DAILY_CHALLENGE_LIMIT = 2;
export const SPEEDRUN_CHALLENGE_LIMIT = 2;
export const STAMINA_RECOVER_MS = 12 * 60 * 1000;
export const STAMINA_RECOVER_AMOUNT = 1;
export const REVEAL_TOOL_COST = 80;

const defaultModeLevels = (): Record<GameMode, number> => ({
  simple: 1,
  hard: 1,
  daily: 1,
  speedrun: 1,
  battleCheckpoint: 1,
  battleSpeed: 1,
});

const defaultWallet = (): WalletState => ({
  stamina: 100,
  gold: 80,
  revealTools: 1,
  lastStaminaAt: Date.now(),
});

const defaultProgress = (): ProgressState => ({
  endlessLevel: 1,
  bestEndlessLevel: 0,
  bestSpeedMs: 0,
  dailyDate: "",
  dailyFinished: false,
  challengeDate: todayKey(),
  dailyAttemptsUsed: 0,
  speedrunAttemptsUsed: 0,
  signInDate: "",
  lotteryDate: "",
  modeLevels: defaultModeLevels(),
  bestModeLevels: defaultModeLevels(),
  selectedMode: "simple",
  selectedDifficulty: "easy",
});

interface SavedSession {
  puzzle: PuzzleState | null;
  input: string[];
  locked: boolean[];
  guesses: GuessRecord[];
  startedAt: number;
  dailyLeftSeconds: number;
  battle: BattleState | null;
}

interface GameStoreState {
  profile: PlayerProfile | null;
  wallet: WalletState;
  progress: ProgressState;
  puzzle: PuzzleState | null;
  input: string[];
  locked: boolean[];
  guesses: GuessRecord[];
  startedAt: number;
  dailyLeftSeconds: number;
  battle: BattleState | null;
}

export const useGameStore = defineStore("game", {
  state: (): GameStoreState => ({
    profile: null,
    wallet: defaultWallet(),
    progress: defaultProgress(),
    puzzle: null,
    input: [],
    locked: [],
    guesses: [],
    startedAt: 0,
    dailyLeftSeconds: 100,
    battle: null,
  }),

  getters: {
    isLoggedIn: (state) => Boolean(state.profile?.token),
    selectedDifficultyConfig: (state) => DIFFICULTIES[state.progress.selectedDifficulty],
    inputText: (state) => state.input.join(""),
    availableDigits: () => DIGITS,
    attemptsLeft: (state) => Math.max(0, MAX_GUESSES - state.guesses.length),
    dailyAttemptsLeft: (state) => Math.max(0, DAILY_CHALLENGE_LIMIT - state.progress.dailyAttemptsUsed),
    speedrunAttemptsLeft: (state) => Math.max(0, SPEEDRUN_CHALLENGE_LIMIT - state.progress.speedrunAttemptsUsed),
    staminaRecoverRuleText: () => `每 ${STAMINA_RECOVER_MS / 60000} 分钟恢复 ${STAMINA_RECOVER_AMOUNT} 点体力`,
  },

  actions: {
    async bootstrap() {
      this.profile = readStorage<PlayerProfile | null>(storageKeys.profile, null);
      this.wallet = normalizeWallet(readStorage<WalletState>(storageKeys.wallet, defaultWallet()));
      this.progress = normalizeProgress(readStorage<ProgressState>(storageKeys.progress, defaultProgress()));
      this.resetDailyCountersIfNeeded();

      const session = readStorage<SavedSession | null>(storageKeys.session, null);
      this.battle = session?.battle ?? null;
      if (session?.puzzle && isSupportedPuzzle(session.puzzle)) {
        this.puzzle = session.puzzle;
        this.input = session.input ?? Array(session.puzzle.difficulty.digitLength).fill("");
        this.locked = session.locked ?? Array(session.puzzle.difficulty.digitLength).fill(false);
        this.guesses = session.guesses ?? [];
        this.startedAt = session.startedAt ?? Date.now();
        this.dailyLeftSeconds = session.dailyLeftSeconds ?? 100;
      }

      this.recoverStamina();
    },

    async registerOrLogin(nickname: string, avatarUrl = "") {
      const code = await this.getLoginCode();
      this.profile = await loginOrRegister({ code, nickname, avatarUrl });
      this.persistAll();
      await this.syncCloud();
    },

    logout() {
      this.profile = null;
      this.puzzle = null;
      this.input = [];
      this.locked = [];
      this.guesses = [];
      this.battle = null;
      removeStorage(storageKeys.profile);
      removeStorage(storageKeys.puzzle);
      removeStorage(storageKeys.session);
    },

    selectMode(mode: GameMode) {
      this.progress.selectedMode = mode;
      this.progress.selectedDifficulty = defaultDifficultyForMode(mode);
      this.persistProgress();
    },

    selectDifficulty(difficulty: DifficultyKey) {
      this.progress.selectedDifficulty = difficulty;
      this.persistProgress();
    },

    startMode(mode: GameMode, difficulty: DifficultyKey = defaultDifficultyForMode(mode)): { ok: boolean; message: string } {
      this.battle = null;
      this.progress.selectedMode = mode;
      this.progress.selectedDifficulty = difficulty;
      return this.startPuzzle();
    },

    startBattle(type: BattleType, seed = createBattleSeed()): { ok: boolean; message: string } {
      this.battle = {
        type,
        seed,
        completed: 0,
        target: type === "checkpoint" ? 3 : 1,
        startedAt: Date.now(),
      };
      this.progress.selectedMode = type === "checkpoint" ? "battleCheckpoint" : "battleSpeed";
      this.progress.selectedDifficulty = "easy";
      return this.startPuzzle();
    },

    startPuzzle(): { ok: boolean; message: string } {
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
        if (this.progress.dailyAttemptsUsed >= DAILY_CHALLENGE_LIMIT) {
          return { ok: false, message: "今日每日挑战次数已用完，明天 0 点刷新。" };
        }
        this.progress.dailyAttemptsUsed += 1;
        this.applyDailyGift();
        this.dailyLeftSeconds = 100;
      }

      if (mode === "speedrun") {
        if (this.progress.speedrunAttemptsUsed >= SPEEDRUN_CHALLENGE_LIMIT) {
          return { ok: false, message: "今日极速竞赛次数已用完，明天 0 点刷新。" };
        }
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
      this.persistAll();
      return { ok: true, message: "关卡已开始。" };
    },

    pressDigit(digit: string) {
      if (!this.puzzle) return;
      const index = this.input.findIndex((value, i) => !this.locked[i] && !value);
      if (index >= 0) {
        this.input[index] = digit;
        this.persistPuzzle();
      }
    },

    backspace() {
      for (let index = this.input.length - 1; index >= 0; index -= 1) {
        if (!this.locked[index] && this.input[index]) {
          this.input[index] = "";
          this.persistPuzzle();
          return;
        }
      }
    },

    clearEditableInput() {
      this.input = this.input.map((value, index) => (this.locked[index] ? value : ""));
      this.persistPuzzle();
    },

    submitGuess(): { ok: boolean; solved: boolean; failed: boolean; message: string } {
      if (!this.puzzle) return { ok: false, solved: false, failed: false, message: "请先开始关卡。" };
      if (!isValidGuess(this.input, this.puzzle.difficulty.digitLength)) {
        return {
          ok: false,
          solved: false,
          failed: false,
          message: `请输入 ${this.puzzle.difficulty.digitLength} 个数字，数字可以重复。`,
        };
      }

      const guess = this.input.join("");
      const result = compareDigits(this.puzzle.secret, guess);
      const text = toCountHint(result);
      this.guesses.unshift({
        guess,
        text,
        correctNumbers: result.exact + result.misplaced,
        correctPositions: result.exact,
        createdAt: Date.now(),
      });

      if (result.exact === this.puzzle.difficulty.digitLength) {
        const message = this.finishPuzzle();
        return { ok: true, solved: true, failed: false, message };
      }

      if (this.guesses.length >= MAX_GUESSES) {
        const answer = this.puzzle.secret;
        this.failPuzzle();
        return {
          ok: true,
          solved: false,
          failed: true,
          message: `三次机会已用完，正确答案是 ${answer}。`,
        };
      }

      this.input = this.input.map((value, index) => (this.locked[index] ? value : ""));
      this.persistPuzzle();
      return { ok: true, solved: false, failed: false, message: `${text}剩余 ${this.attemptsLeft} 次机会。` };
    },

    useRevealTool(): { ok: boolean; message: string } {
      if (!this.puzzle) return { ok: false, message: "请先开始关卡。" };
      if (this.wallet.revealTools <= 0) {
        return { ok: false, message: "没有可用的显真透视镜。" };
      }
      const result = this.revealOneDigit();
      if (!result.ok) return result;
      this.wallet.revealTools -= 1;
      this.persistAll();
      return { ok: true, message: "已使用显真透视镜。" };
    },

    buyRevealTool(): { ok: boolean; message: string } {
      if (this.wallet.gold < REVEAL_TOOL_COST) {
        return { ok: false, message: `金币不足，购买一个显真透视镜需要 ${REVEAL_TOOL_COST} 金币。` };
      }
      this.wallet.gold -= REVEAL_TOOL_COST;
      this.wallet.revealTools += 1;
      this.persistWallet();
      return { ok: true, message: `购买成功，显真透视镜 +1。` };
    },

    revealWithGold(): { ok: boolean; message: string } {
      const purchase = this.buyRevealTool();
      if (!purchase.ok) return purchase;
      return this.useRevealTool();
    },

    revealFromAd(): { ok: boolean; message: string } {
      const result = this.revealOneDigit();
      if (result.ok) this.persistAll();
      return result;
    },

    grantStamina(amount: number) {
      this.recoverStamina();
      this.wallet.stamina = Math.min(MAX_STAMINA, this.wallet.stamina + amount);
      this.wallet.lastStaminaAt = Date.now();
      this.persistWallet();
    },

    grantGold(amount: number) {
      this.wallet.gold += amount;
      this.persistWallet();
    },

    grantRevealTools(amount: number) {
      this.wallet.revealTools += amount;
      this.persistWallet();
    },

    claimDailySignIn(): { ok: boolean; message: string } {
      const today = todayKey();
      if (this.progress.signInDate === today) {
        return { ok: false, message: "今日已签到。" };
      }
      this.progress.signInDate = today;
      this.wallet.gold += 30;
      this.wallet.stamina = Math.min(MAX_STAMINA, this.wallet.stamina + 20);
      this.persistAll();
      return { ok: true, message: "签到成功，金币 +30，体力 +20。" };
    },

    drawDailyLottery(): { ok: boolean; message: string } {
      const today = todayKey();
      if (this.progress.lotteryDate === today) {
        return { ok: false, message: "今日抽奖次数已用完。" };
      }

      const rewards = [
        { gold: 20, stamina: 0, revealTools: 0, label: "金币 +20" },
        { gold: 50, stamina: 0, revealTools: 0, label: "金币 +50" },
        { gold: 0, stamina: 15, revealTools: 0, label: "体力 +15" },
        { gold: 30, stamina: 10, revealTools: 0, label: "金币 +30，体力 +10" },
        { gold: 0, stamina: 0, revealTools: 1, label: "显真透视镜 +1" },
      ];
      const reward = rewards[Math.floor(Math.random() * rewards.length)];
      this.progress.lotteryDate = today;
      this.wallet.gold += reward.gold;
      this.wallet.stamina = Math.min(MAX_STAMINA, this.wallet.stamina + reward.stamina);
      this.wallet.revealTools += reward.revealTools;
      this.persistAll();
      return { ok: true, message: `抽奖获得：${reward.label}。` };
    },

    recoverStamina() {
      if (this.wallet.stamina >= MAX_STAMINA) {
        this.wallet.lastStaminaAt = Date.now();
        this.persistWallet();
        return;
      }

      const elapsed = Date.now() - this.wallet.lastStaminaAt;
      const recovered = Math.floor(elapsed / STAMINA_RECOVER_MS);
      if (recovered <= 0) return;

      this.wallet.stamina = Math.min(MAX_STAMINA, this.wallet.stamina + recovered * STAMINA_RECOVER_AMOUNT);
      this.wallet.lastStaminaAt += recovered * STAMINA_RECOVER_MS;
      this.persistWallet();
    },

    tickTimer() {
      if (this.progress.selectedMode !== "daily" || !this.startedAt || !this.puzzle) return;
      const elapsed = Math.floor((Date.now() - this.startedAt) / 1000);
      this.dailyLeftSeconds = Math.max(0, 100 - elapsed);
    },

    async syncCloud() {
      if (!this.profile) return;
      await syncPlayerState(this.profile, this.wallet, this.progress);
    },

    persistAll() {
      this.persistProfile();
      this.persistWallet();
      this.persistProgress();
      this.persistPuzzle();
    },

    persistProfile() {
      if (this.profile) writeStorage(storageKeys.profile, this.profile);
    },

    persistWallet() {
      writeStorage(storageKeys.wallet, this.wallet);
    },

    persistProgress() {
      writeStorage(storageKeys.progress, this.progress);
    },

    persistPuzzle() {
      writeStorage<SavedSession>(storageKeys.session, {
        puzzle: this.puzzle,
        input: this.input,
        locked: this.locked,
        guesses: this.guesses,
        startedAt: this.startedAt,
        dailyLeftSeconds: this.dailyLeftSeconds,
        battle: this.battle,
      });
    },

    async getLoginCode(): Promise<string> {
      return new Promise((resolve) => {
        uni.login({
          success: (res) => resolve(res.code || `mock-code-${Date.now()}`),
          fail: () => resolve(`mock-code-${Date.now()}`),
        });
      });
    },

    applyDailyGift() {
      const today = todayKey();
      if (this.progress.dailyDate === today) return;
      this.wallet.stamina = Math.min(MAX_STAMINA, this.wallet.stamina + 15);
      this.progress.dailyDate = today;
      this.progress.dailyFinished = false;
    },

    revealOneDigit(): { ok: boolean; message: string } {
      if (!this.puzzle) return { ok: false, message: "请先开始关卡。" };
      const index = randomUnrevealedIndex(this.locked);
      if (index < 0) return { ok: false, message: "所有数字都已经显示。" };
      this.input[index] = this.puzzle.secret[index];
      this.locked[index] = true;
      return { ok: true, message: "已随机显示一个正确数字。" };
    },

    finishPuzzle(): string {
      if (!this.puzzle) return "";
      const mode = this.progress.selectedMode;
      const reward = this.puzzle.difficulty.rewardGold;
      let message = "恭喜，数字全部正确。";

      if (mode === "simple") {
        this.wallet.gold += reward;
        this.progress.modeLevels.simple += 1;
        this.progress.bestModeLevels.simple = Math.max(this.progress.bestModeLevels.simple, this.progress.modeLevels.simple);
        this.progress.endlessLevel = this.progress.modeLevels.simple;
        this.progress.bestEndlessLevel = Math.max(this.progress.bestEndlessLevel, this.progress.modeLevels.simple - 1);
        message = `闯关成功，获得 ${reward} 金币。`;
      }

      if (mode === "hard") {
        this.wallet.gold += reward;
        this.progress.modeLevels.hard += 1;
        this.progress.bestModeLevels.hard = Math.max(this.progress.bestModeLevels.hard, this.progress.modeLevels.hard);
        message = `困难模式闯关成功，获得 ${reward} 金币。`;
      }

      if (mode === "daily") {
        this.wallet.stamina = Math.min(MAX_STAMINA, this.wallet.stamina + 15);
        this.progress.dailyFinished = true;
        this.progress.modeLevels.daily += 1;
        this.progress.bestModeLevels.daily = Math.max(this.progress.bestModeLevels.daily, this.progress.modeLevels.daily);
        message = "每日挑战完成，体力 +15。";
      }

      if (mode === "speedrun") {
        const elapsed = Date.now() - this.startedAt;
        this.wallet.stamina = Math.min(MAX_STAMINA, this.wallet.stamina + 15);
        this.progress.bestSpeedMs = this.progress.bestSpeedMs ? Math.min(this.progress.bestSpeedMs, elapsed) : elapsed;
        this.progress.modeLevels.speedrun += 1;
        this.progress.bestModeLevels.speedrun = Math.max(this.progress.bestModeLevels.speedrun, this.progress.modeLevels.speedrun);
        message = `极速竞赛完成，用时 ${(elapsed / 1000).toFixed(2)} 秒，体力 +15。`;
      }

      if (mode === "battleCheckpoint" && this.battle) {
        this.battle.completed += 1;
        if (this.battle.completed >= this.battle.target) {
          this.wallet.gold += 20;
          this.progress.modeLevels.battleCheckpoint += 1;
          this.progress.bestModeLevels.battleCheckpoint = Math.max(
            this.progress.bestModeLevels.battleCheckpoint,
            this.progress.modeLevels.battleCheckpoint,
          );
          message = "闯关对战完成，三关全部通过，金币 +20。";
          this.battle = null;
        } else {
          message = `闯关成功，已完成 ${this.battle.completed}/${this.battle.target}，点击继续进入下一关。`;
        }
      }

      if (mode === "battleSpeed" && this.battle) {
        const elapsed = Date.now() - this.startedAt;
        this.wallet.gold += 10;
        this.progress.modeLevels.battleSpeed += 1;
        this.progress.bestModeLevels.battleSpeed = Math.max(this.progress.bestModeLevels.battleSpeed, this.progress.modeLevels.battleSpeed);
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
    },

    failPuzzle() {
      if (this.progress.selectedMode === "battleCheckpoint" || this.progress.selectedMode === "battleSpeed") {
        this.battle = null;
      }
      this.puzzle = null;
      this.input = [];
      this.locked = [];
      this.guesses = [];
      this.persistAll();
      this.syncCloud();
    },

    resetDailyCountersIfNeeded() {
      const today = todayKey();
      if (this.progress.challengeDate === today) return;
      this.progress.challengeDate = today;
      this.progress.dailyAttemptsUsed = 0;
      this.progress.speedrunAttemptsUsed = 0;
      this.progress.dailyFinished = false;
      this.persistProgress();
    },

    puzzleSeedForCurrentMode(): string {
      if (this.battle) {
        return `${this.battle.seed}:${this.battle.completed + 1}`;
      }
      if (this.progress.selectedMode === "daily") {
        return `daily:${todayKey()}:${this.progress.selectedDifficulty}:${this.progress.dailyAttemptsUsed}`;
      }
      return "";
    },
  },
});

function normalizeWallet(wallet: WalletState): WalletState {
  const fallback = defaultWallet();
  return {
    ...fallback,
    ...wallet,
    revealTools: wallet.revealTools ?? fallback.revealTools,
    lastStaminaAt: wallet.lastStaminaAt || Date.now(),
  };
}

function normalizeProgress(progress: ProgressState): ProgressState {
  const fallback = defaultProgress();
  const saved = progress as ProgressState & {
    selectedMode?: string;
    selectedDifficulty?: string;
    modeLevels?: Record<string, number>;
    bestModeLevels?: Record<string, number>;
  };
  const selectedMode = normalizeMode(saved.selectedMode);
  const selectedDifficulty = normalizeDifficulty(saved.selectedDifficulty, selectedMode);
  const simpleLevel = saved.modeLevels?.simple ?? saved.modeLevels?.endless ?? progress.endlessLevel ?? fallback.modeLevels.simple;
  const bestSimpleLevel = saved.bestModeLevels?.simple ?? saved.bestModeLevels?.endless ?? progress.bestEndlessLevel ?? fallback.bestModeLevels.simple;

  return {
    ...fallback,
    ...progress,
    selectedMode,
    selectedDifficulty,
    signInDate: progress.signInDate ?? "",
    lotteryDate: progress.lotteryDate ?? "",
    modeLevels: {
      ...fallback.modeLevels,
      ...(saved.modeLevels ?? {}),
      simple: simpleLevel,
      hard: saved.modeLevels?.hard ?? fallback.modeLevels.hard,
      daily: saved.modeLevels?.daily ?? fallback.modeLevels.daily,
      speedrun: saved.modeLevels?.speedrun ?? fallback.modeLevels.speedrun,
      battleCheckpoint: saved.modeLevels?.battleCheckpoint ?? fallback.modeLevels.battleCheckpoint,
      battleSpeed: saved.modeLevels?.battleSpeed ?? fallback.modeLevels.battleSpeed,
    },
    bestModeLevels: {
      ...fallback.bestModeLevels,
      ...(saved.bestModeLevels ?? {}),
      simple: bestSimpleLevel,
      hard: saved.bestModeLevels?.hard ?? fallback.bestModeLevels.hard,
      daily: saved.bestModeLevels?.daily ?? fallback.bestModeLevels.daily,
      speedrun: saved.bestModeLevels?.speedrun ?? fallback.bestModeLevels.speedrun,
      battleCheckpoint: saved.bestModeLevels?.battleCheckpoint ?? fallback.bestModeLevels.battleCheckpoint,
      battleSpeed: saved.bestModeLevels?.battleSpeed ?? fallback.bestModeLevels.battleSpeed,
    },
    endlessLevel: simpleLevel,
    bestEndlessLevel: Math.max(0, bestSimpleLevel - 1, progress.bestEndlessLevel ?? 0),
    challengeDate: progress.challengeDate || todayKey(),
    dailyAttemptsUsed: progress.dailyAttemptsUsed ?? 0,
    speedrunAttemptsUsed: progress.speedrunAttemptsUsed ?? 0,
  };
}

function todayKey(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function normalizeMode(mode: string | undefined): GameMode {
  if (mode === "endless") return "simple";
  if (mode === "simple" || mode === "hard" || mode === "daily" || mode === "speedrun" || mode === "battleCheckpoint" || mode === "battleSpeed") {
    return mode;
  }
  return "simple";
}

function normalizeDifficulty(difficulty: string | undefined, mode: GameMode): DifficultyKey {
  if (difficulty === "hard") return "hard";
  if (difficulty === "easy") return "easy";
  return defaultDifficultyForMode(mode);
}

function defaultDifficultyForMode(mode: GameMode): DifficultyKey {
  return mode === "hard" ? "hard" : "easy";
}

function consumesStamina(mode: GameMode): boolean {
  return mode === "simple" || mode === "hard";
}

function createBattleSeed(): string {
  return `battle-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isSupportedPuzzle(puzzle: PuzzleState): boolean {
  return puzzle.difficulty.key === "easy" || puzzle.difficulty.key === "hard";
}
