const PROFILE_KEY = "logic-number-profile";
const WALLET_KEY = "logic-number-wallet";
const PROGRESS_KEY = "logic-number-progress";
const PUZZLE_KEY = "logic-number-current-puzzle";
const SESSION_KEY = "logic-number-current-session";

export const storageKeys = {
  profile: PROFILE_KEY,
  wallet: WALLET_KEY,
  progress: PROGRESS_KEY,
  puzzle: PUZZLE_KEY,
  session: SESSION_KEY,
};

export function readStorage<T>(key: string, fallback: T): T {
  try {
    const value = uni.getStorageSync(key);
    return value ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStorage<T>(key: string, value: T): void {
  uni.setStorageSync(key, value);
}

export function removeStorage(key: string): void {
  uni.removeStorageSync(key);
}
