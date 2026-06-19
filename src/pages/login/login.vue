<template>
  <view class="login-page">
    <view class="login-brand">
      <text class="login-eyebrow">微信 / 抖音小程序</text>
      <text class="login-title">逻辑推理数字</text>
      <text class="login-subtitle">绑定微信后保存金币、体力和闯关进度</text>
    </view>

    <view class="login-panel">
      <text class="login-panel-title">玩家资料</text>
      <input v-model="nickname" class="nickname-input" maxlength="12" placeholder="输入昵称" placeholder-class="placeholder" />
      <button class="primary-button" :loading="loading" :disabled="loading" @tap="handleWechatLogin()">
        微信一键绑定 / 登录
      </button>
      <text class="login-hint">调试时如果微信接口不可用，会自动使用本地调试账号进入游戏；上线后使用真实 AppID 和后端换取 openId。</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useGameStore } from "@/stores/useGameStore";

const LOGIN_TIMEOUT_MS = 1800;
const game = useGameStore();

interface WechatUserInfo {
  nickName?: string;
  avatarUrl?: string;
}

interface WechatProfileResult {
  userInfo?: WechatUserInfo;
}

const nickname = ref("数字玩家");
const loading = ref(false);

async function handleWechatLogin() {
  if (loading.value) return;

  loading.value = true;
  try {
    await game.bootstrap();
    const userInfo = await getWechatUserInfo();
    const displayName = userInfo.nickName || nickname.value.trim() || "数字玩家";
    await game.registerOrLogin(displayName, userInfo.avatarUrl || "");
    await game.bindPendingInviter();

    uni.showToast({ title: "登录成功", icon: "success" });
    setTimeout(() => {
      uni.reLaunch({ url: "/pages/home/home" });
    }, 250);
  } catch {
    uni.showToast({ title: "登录失败，请重试", icon: "none" });
  } finally {
    loading.value = false;
  }
}

function getWechatUserInfo(): Promise<WechatUserInfo> {
  const uniApi = uni as unknown as {
    getUserProfile?: (options: {
      desc: string;
      success: (res: WechatProfileResult) => void;
      fail: () => void;
    }) => void;
  };

  const getUserProfile = uniApi.getUserProfile;
  if (typeof getUserProfile !== "function") {
    return Promise.resolve({});
  }

  return withTimeout(
    new Promise((resolve) => {
      getUserProfile({
        desc: "用于绑定微信账号并展示玩家昵称头像",
        success: (res) => resolve(res.userInfo || {}),
        fail: () => resolve({}),
      });
    }),
    {},
  );
}

function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(fallback);
    }, LOGIN_TIMEOUT_MS);

    promise.then((value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    }).catch(() => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(fallback);
    });
  });
}
</script>

<style>
.login-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 64rpx 32rpx 40rpx;
  background: #121212;
  color: #f4f7f7;
}

.login-brand {
  margin-top: 70rpx;
}

.login-eyebrow,
.login-subtitle,
.login-hint {
  display: block;
  color: #9da7ad;
  font-size: 24rpx;
}

.login-title {
  display: block;
  margin-top: 18rpx;
  color: #f4f7f7;
  font-size: 64rpx;
  font-weight: 800;
  line-height: 1.08;
}

.login-subtitle {
  margin-top: 18rpx;
}

.login-panel {
  margin-top: 80rpx;
  padding: 28rpx;
  border: 1rpx solid #30353a;
  border-radius: 12rpx;
  background: #1b1d1f;
}

.login-panel-title {
  display: block;
  color: #f4f7f7;
  font-size: 32rpx;
  font-weight: 700;
}

.nickname-input {
  height: 92rpx;
  margin-top: 24rpx;
  padding: 0 24rpx;
  border: 1rpx solid #30353a;
  border-radius: 10rpx;
  background: #111315;
  color: #f4f7f7;
  font-size: 30rpx;
}

.placeholder {
  color: #646c72;
}

.primary-button {
  height: 92rpx;
  margin-top: 22rpx;
  border-radius: 12rpx;
  background: #00e676;
  color: #08120d;
  font-size: 30rpx;
  font-weight: 800;
  line-height: 92rpx;
}

.primary-button[disabled] {
  opacity: 0.72;
}

.login-hint {
  margin-top: 18rpx;
  line-height: 1.5;
}
</style>
