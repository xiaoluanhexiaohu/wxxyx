import type { PlayerProfile, ProgressState, WalletState } from "@/types/game";
import type { RankingEntry, RankingMode, RankingScope } from "@/utils/rankings";

const API_BASE_URL = "https://your-api.example.com";

export interface LoginPayload {
  code: string;
  nickname: string;
  avatarUrl?: string;
}

export interface RewardVerifyPayload {
  scene: "stamina" | "gold" | "reveal";
  platform: string;
  adUnitId: string;
  transactionId: string;
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
    // 本地存储已经落盘，接口失败不阻断游戏。
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
  if (payload.transactionId.startsWith("mock-")) return true;
  try {
    const result = await callBackend<{ verified: boolean }>("verifyReward", payload, "/ads/reward/verify");
    return result.verified;
  } catch {
    return false;
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
