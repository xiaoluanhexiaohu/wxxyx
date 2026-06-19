export type GameMode = "simple" | "hard" | "daily" | "speedrun" | "battleCheckpoint" | "battleSpeed";
export type DifficultyKey = "easy" | "hard";
export type BattleType = "checkpoint" | "speed";

export interface DifficultyConfig {
  key: DifficultyKey;
  label: string;
  digitLength: number;
  clueCount: number;
  staminaCost: number;
  rewardGold: number;
  revealCost: number;
  description: string;
}

export interface ModeConfig {
  key: GameMode;
  label: string;
  description: string;
  difficulty: DifficultyKey;
}

export interface ClueResult {
  exact: number;
  misplaced: number;
}

export interface PuzzleClue {
  guess: string;
  result: ClueResult;
  text: string;
  constraints?: PuzzleConstraint[];
}

export type PuzzleConstraint =
  | { kind: "sum"; indexes: number[]; value: number }
  | { kind: "diff"; left: number; right: number; value: number }
  | { kind: "total"; value: number };

export interface PuzzleState {
  id: string;
  secret: string;
  difficulty: DifficultyConfig;
  clues: PuzzleClue[];
  guaranteedUnique: boolean;
  createdAt: number;
  seed?: string;
  round?: number;
}

export interface GuessRecord {
  guess: string;
  text: string;
  correctNumbers: number;
  correctPositions: number;
  createdAt: number;
}

export interface PlayerProfile {
  openId: string;
  token: string;
  nickname: string;
  avatarUrl: string;
  registeredAt: number;
}

export interface WalletState {
  stamina: number;
  gold: number;
  revealTools: number;
  lastStaminaAt: number;
}

export interface BattleState {
  type: BattleType;
  seed: string;
  completed: number;
  target: number;
  startedAt: number;
}

export interface ProgressState {
  endlessLevel: number;
  bestEndlessLevel: number;
  bestSpeedMs: number;
  dailyDate: string;
  dailyFinished: boolean;
  challengeDate: string;
  dailyAttemptsUsed: number;
  speedrunAttemptsUsed: number;
  signInDate: string;
  signInHistory: Record<string, string>;
  lotteryDate: string;
  speedrunRevealUsed: number;
  modeLevels: Record<GameMode, number>;
  bestModeLevels: Record<GameMode, number>;
  selectedMode: GameMode;
  selectedDifficulty: DifficultyKey;
}
