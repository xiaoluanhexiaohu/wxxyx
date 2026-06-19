<template>
  <view class="page">
    <view class="top">
      <view>
        <text class="eyebrow">好友</text>
        <text class="title">好友对战</text>
      </view>
      <button class="back-button" @tap="goHome()">返回</button>
    </view>

    <view class="battle-list">
      <view class="battle-card">
        <view>
          <text class="battle-title">闯关对战</text>
          <text class="battle-desc">先完成三关获胜</text>
        </view>
        <view class="battle-actions">
          <button class="share-button" open-type="share" @tap="prepareShare('checkpoint')">邀请</button>
          <button class="start-button" @tap="startBattle('checkpoint')">开始</button>
        </view>
      </view>

      <view class="battle-card">
        <view>
          <text class="battle-title">竞速对战</text>
          <text class="battle-desc">同一关用时更少获胜</text>
        </view>
        <view class="battle-actions">
          <button class="share-button" open-type="share" @tap="prepareShare('speed')">邀请</button>
          <button class="start-button" @tap="startBattle('speed')">开始</button>
        </view>
      </view>
    </view>

    <view class="invite-panel" v-if="inviteSeed">
      <text class="invite-title">邀请局</text>
      <text class="invite-code">{{ inviteLabel }}</text>
      <button class="start-wide" @tap="startBattle(inviteType)">进入同局</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad, onShareAppMessage, onShow } from "@dcloudio/uni-app";
import { useGameStore } from "@/stores/useGameStore";
import type { BattleType } from "@/types/game";

const game = useGameStore();
const shareType = ref<BattleType>("checkpoint");
const shareSeed = ref(createLocalSeed());
const inviteType = ref<BattleType>("checkpoint");
const inviteSeed = ref("");

const inviteLabel = computed(() => `${inviteType.value === "checkpoint" ? "闯关对战" : "竞速对战"} · ${inviteSeed.value.slice(-8)}`);

onLoad((query) => {
  const type = typeof query?.type === "string" && query.type === "speed" ? "speed" : "checkpoint";
  const seed = typeof query?.seed === "string" ? query.seed : "";
  if (seed) {
    inviteType.value = type;
    inviteSeed.value = seed;
    shareType.value = type;
    shareSeed.value = seed;
  }
});

onShow(async () => {
  await game.bootstrap();
  uni.showShareMenu?.({ withShareTicket: true });
});

onShareAppMessage(() => ({
  title: shareType.value === "checkpoint" ? "逻辑推理数字闯关对战" : "逻辑推理数字竞速对战",
  path: `/pages/battle/battle?type=${shareType.value}&seed=${shareSeed.value}`,
}));

function prepareShare(type: BattleType) {
  shareType.value = type;
  shareSeed.value = createLocalSeed();
}

function startBattle(type: BattleType) {
  const seed = inviteSeed.value && inviteType.value === type ? inviteSeed.value : shareSeed.value || createLocalSeed();
  const result = game.startBattle(type, seed);
  if (!result.ok) {
    uni.showToast({ title: result.message, icon: "none" });
    return;
  }
  uni.navigateTo({ url: "/pages/play/play" });
}

function goHome() {
  uni.reLaunch({ url: "/pages/home/home" });
}

function createLocalSeed() {
  return `share-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 64rpx 28rpx 34rpx;
  background: #121212;
  color: #f4f7f7;
}

.top,
.battle-card,
.battle-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.eyebrow,
.battle-desc {
  color: #9da7ad;
  font-size: 24rpx;
}

.title {
  display: block;
  margin-top: 8rpx;
  font-size: 48rpx;
  font-weight: 800;
}

.back-button {
  width: 118rpx;
  height: 72rpx;
  border: 1rpx solid #30353a;
  background: #202326;
  color: #f4f7f7;
  font-size: 26rpx;
  font-weight: 700;
}

.battle-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 34rpx;
}

.battle-card,
.invite-panel {
  padding: 26rpx;
  border: 1rpx solid #30353a;
  border-radius: 10rpx;
  background: #1b1d1f;
}

.battle-title,
.battle-desc,
.invite-title,
.invite-code {
  display: block;
}

.battle-title,
.invite-title {
  color: #f4f7f7;
  font-size: 34rpx;
  font-weight: 800;
}

.battle-desc,
.invite-code {
  margin-top: 12rpx;
}

.battle-actions {
  flex-shrink: 0;
}

.share-button,
.start-button,
.start-wide {
  height: 76rpx;
  font-size: 26rpx;
  font-weight: 800;
}

.share-button {
  width: 118rpx;
  border: 1rpx solid #30353a;
  background: #202326;
  color: #f4f7f7;
}

.start-button,
.start-wide {
  background: #00e676;
  color: #08120d;
}

.start-button {
  width: 118rpx;
}

.invite-panel {
  margin-top: 28rpx;
}

.invite-code {
  color: #ffab00;
  font-size: 26rpx;
  font-weight: 800;
}

.start-wide {
  width: 100%;
  margin-top: 20rpx;
}
</style>
