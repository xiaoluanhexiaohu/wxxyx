import type { GameMode, PlayerProfile, ProgressState, WalletState } from "@/types/game";
import type { RankingEntry, RankingMode, RankingScope } from "@/utils/rankings";

const API_BASE_URL = "https://your-api.example.com";
const PROFILE_KEY = "logic-number-profile";

export interface LoginPayload {
  code: string;
  nickname: string;
  avatarUrl?: string;
}

export type RewardType = "ad_gold" | "ad_stamina" | "ad_reveal" | "ad_revive";

export interface RewardVerifyPayload {
  rewardType: RewardType;
  scene?: "stamina" | "gold" | "reveal" | "revive";
  platform: string;
  adUnitId: string;
  transactionId: string;
  openId?: string;
}

export interface SettleLevelPayload {
  openId: string;
  mode: GameMode;
  isWin: boolean;
  adMultiplier?: 1 | 3;
  transactionId?: string;
}

export interface SettleLevelResult {
  ok: boolean;
  message?: string;
  rewardCoins: number;
  wallet?: Partial<WalletState> | null;
}

export async function loginOrRegister(payload: LoginPayload): Promise<PlayerProfile> {
  if (!payload.code || payload.code.startsWith("mock-")) {
    return createMockProfile(payload.nickname, payload.avatarUrl);
  }

  try {
    const result = await callBackend<PlayerProfile>("login", payload, "/auth/miniprogram-login");
    return result;
  } catch {
    return createMockProfile(payload.nickname, payload.avatarUrl);
  }
}

export async function syncPlayerState(profile: PlayerProfile, wallet: WalletState, progress: ProgressState) {
  try {
    await callBackend("sync", { token: profile.token, openId: profile.openId, wallet, progress }, "/player/sync");
  } catch {
    // Local storage is already updated. Network sync should not block play.
  }
}

export async function fetchLeaderboard(payload: {
  mode: RankingMode;
  scope: RankingScope;
  openId?: string;
  friendOpenIds?: string[];
}): Promise<RankingEntry[]> {
  try {
    return await callBackend<RankingEntry[]>("leaderboard", payload, "/leaderboard/query");
  } catch {
    return [];
  }
}

export async function verifyRewardedAd(payload: RewardVerifyPayload): Promise<boolean> {
  const openId = payload.openId || getCurrentOpenId();
  if (payload.transactionId.startsWith("mock-") || openId.startsWith("mock-")) return true;
  try {
    const result = await callBackend<{ verified: boolean }>("verifyReward", { ...payload, openId }, "/ads/reward/verify");
    return result.verified;
  } catch {
    return false;
  }
}

export async function settleLevelReward(payload: SettleLevelPayload): Promise<SettleLevelResult> {
  if (!payload.openId || payload.openId.startsWith("mock-")) {
    return mockSettleLevel(payload);
  }

  try {
    return await callBackend<SettleLevelResult>("settleLevel", payload, "/level/settle");
  } catch {
    return mockSettleLevel(payload);
  }
}

export async function bindInviter(payload: { openId: string; inviteBy: string }): Promise<{ ok: boolean; message?: string }> {
  if (!payload.openId || !payload.inviteBy || payload.openId === payload.inviteBy) return { ok: false };
  if (payload.openId.startsWith("mock-") || payload.inviteBy.startsWith("mock-")) return { ok: true };

  try {
    return await callBackend<{ ok: boolean; message?: string }>("bindInviter", payload, "/invite/bind");
  } catch {
    return { ok: false };
  }
}

function callBackend<T>(action: string, payload: unknown, httpPath: string): Promise<T> {
  const cloud = getUniCloud();
  if (cloud) {
    return new Promise((resolve, reject) => {
      cloud.callFunction({
        name: "logic-number",
        data: { action, payload },
        success: (res: { result: T }) => resolve(res.result),
        fail: reject,
      });
    });
  }

  return request<T>(httpPath, "POST", payload);
}

function getUniCloud(): { callFunction: (options: unknown) => void } | null {
  try {
    const runtime = globalThis as unknown as { uniCloud?: { callFunction?: (options: unknown) => void } };
    const cloud = runtime.uniCloud;
    return cloud && typeof cloud.callFunction === "function" ? (cloud as { callFunction: (options: unknown) => void }) : null;
  } catch {
    return null;
  }
}

function request<T>(path: string, method: "GET" | "POST", data?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${API_BASE_URL}${path}`,
      method,
      data: data as any,
      success: (response) => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data as T);
        } else {
          reject(new Error(`request failed: ${response.statusCode}`));
        }
      },
      fail: reject,
    });
  });
}

function createMockProfile(nickname: string, avatarUrl = ""): PlayerProfile {
  return {
    openId: `mock-openid-${Date.now()}`,
    token: `mock-token-${Math.random().toString(16).slice(2)}`,
    nickname: nickname || "数字玩家",
    avatarUrl,
    registeredAt: Date.now(),
  };
}

function getCurrentOpenId(): string {
  try {
    const profile = uni.getStorageSync(PROFILE_KEY) as PlayerProfile | undefined;
    return profile?.openId || "";
  } catch {
    return "";
  }
}

function mockSettleLevel(payload: SettleLevelPayload): SettleLevelResult {
  const rewards: Record<GameMode, number> = {
    simple: 10,
    hard: 18,
    daily: 0,
    speedrun: 0,
    battleCheckpoint: 20,
    battleSpeed: 10,
  };
  const multiplier = payload.adMultiplier === 3 ? 3 : 1;
  return {
    ok: payload.isWin,
    rewardCoins: (rewards[payload.mode] || 0) * multiplier,
    wallet: null,
  };
}
