<template>
  <view class="page" v-if="game.puzzle">
    <view class="topbar">
      <view>
        <text class="eyebrow">{{ modeName }} / {{ game.puzzle.difficulty.label }}</text>
        <text class="title">填写数字</text>
      </view>
      <view class="top-stats">
        <text>体力 {{ game.wallet.stamina }}</text>
        <text>金币 {{ game.wallet.gold }}</text>
        <text>机会 {{ game.attemptsLeft }}/3</text>
      </view>
    </view>

    <view class="input-area">
      <view class="cells">
        <view v-for="(_, index) in game.input" :key="index" class="cell" :class="{ locked: game.locked[index] }">
          {{ game.input[index] }}
        </view>
      </view>
      <button class="reveal-button" @tap="showRevealPanel = true">
        <view class="mini-magnifier">
          <view class="mini-lens"></view>
          <view class="mini-handle"></view>
        </view>
        <text>透视镜</text>
        <text v-if="game.wallet.revealTools > 0" class="badge">{{ game.wallet.revealTools }}</text>
      </button>
    </view>

    <view class="hint-board">
      <view class="hint-title">
        <text>提示</text>
        <text>{{ game.puzzle.guaranteedUnique ? "唯一解线索" : "待校验线索" }} · {{ game.puzzle.clues.length }} 条</text>
      </view>
      <view v-for="(clue, index) in game.puzzle.clues" :key="`${index}-${clue.guess}`" class="hint-row">
        <text class="hint-index">{{ index + 1 }}</text>
        <text class="hint-number">{{ clue.guess }}</text>
        <text class="hint-text">{{ clue.text }}</text>
      </view>
    </view>

    <view class="keyboard">
      <button
        v-for="digit in digits"
        :key="digit"
        class="digit-key"
        @tap="game.pressDigit(digit)"
      >
        {{ digit }}
      </button>
    </view>

    <view class="actions">
      <button class="secondary-button" @tap="game.backspace()">退格</button>
      <button class="secondary-button" @tap="game.clearEditableInput()">清空</button>
      <button class="primary-button" @tap="submit()">提交</button>
    </view>

    <view class="history">
      <view class="history-title">
        <text>提交记录</text>
        <text>剩余 {{ game.attemptsLeft }} 次</text>
      </view>
      <view v-if="game.guesses.length === 0" class="empty">还没有提交记录</view>
      <view v-for="record in game.guesses" :key="record.createdAt" class="history-row">
        <text class="hint-number">{{ record.guess }}</text>
        <view class="record-result">
          <text class="result-pill">数字 {{ record.correctNumbers }} 个</text>
          <text class="result-pill exact">位置 {{ record.correctPositions }} 个</text>
        </view>
      </view>
    </view>

    <view v-if="showRevealPanel" class="mask" @tap="showRevealPanel = false"></view>
    <view v-if="showRevealPanel" class="center-modal">
      <button class="modal-close" @tap="showRevealPanel = false">×</button>
      <text class="modal-title">显真透视镜</text>
      <text class="modal-note">当前拥有 {{ game.wallet.revealTools }} 个。使用后随机显示一个正确数字。</text>
      <button class="primary-action" @tap="useRevealTool()">使用道具</button>
      <button class="ghost-action" @tap="buyRevealTool()">金币购买 {{ revealCost }}</button>
      <button class="ghost-action" @tap="watchRevealAd()">看广告使用一次</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { REVEAL_TOOL_COST, useGameStore } from "@/stores/useGameStore";
import { DIGITS } from "@/utils/numberPuzzle";
import { adManager } from "@/utils/adManager";

const game = useGameStore();
const digits = DIGITS;
const showRevealPanel = ref(false);
let timer: number | undefined;
const revealCost = computed(() => String(REVEAL_TOOL_COST));

const modeName = computed(() => {
  const map = {
    simple: "简单模式",
    hard: "困难模式",
    daily: `每日挑战 ${game.dailyLeftSeconds}s`,
    speedrun: "极速竞赛",
    battleCheckpoint: `好友闯关 ${game.battle ? `${game.battle.completed + 1}/${game.battle.target}` : ""}`,
    battleSpeed: "好友竞速",
  };
  return map[game.progress.selectedMode];
});

onMounted(() => {
  if (!game.puzzle) {
    uni.reLaunch({ url: "/pages/home/home" });
    return;
  }
  timer = setInterval(() => game.tickTimer(), 1000) as unknown as number;
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

function submit() {
  const result = game.submitGuess();
  if (!result.ok) {
    uni.showToast({ title: result.message, icon: "none" });
    return;
  }

  if (!result.solved) {
    if (result.failed) {
      uni.showModal({
        title: "机会用完",
        content: result.message,
        confirmText: "回主页",
        cancelText: "再来",
        success: (res) => {
          if (res.confirm) {
            uni.reLaunch({ url: "/pages/home/home" });
          } else {
            restartCurrentMode();
          }
        },
      });
      return;
    }
    uni.showToast({ title: result.message, icon: "none" });
    return;
  }

  const canContinue = canContinueAfterSuccess();
  uni.showModal({
    title: canContinue ? "闯关成功" : "完成",
    content: result.message,
    confirmText: canContinue ? "继续" : "回主页",
    cancelText: "回主页",
    success: (res) => {
      if (canContinue && res.confirm) {
        const next = game.startPuzzle();
        if (next.ok) {
          uni.showToast({ title: "下一关开始", icon: "none" });
          return;
        }
        uni.showModal({
          title: "无法继续",
          content: next.message,
          confirmText: "回主页",
          success: () => uni.reLaunch({ url: "/pages/home/home" }),
        });
        return;
      }
      uni.reLaunch({ url: "/pages/home/home" });
    },
  });
}

function canContinueAfterSuccess() {
  const mode = game.progress.selectedMode;
  if (mode === "simple" || mode === "hard") return true;
  return mode === "battleCheckpoint" && Boolean(game.battle);
}

function restartCurrentMode() {
  const mode = game.progress.selectedMode;
  if (mode === "battleCheckpoint" || mode === "battleSpeed") {
    uni.redirectTo({ url: "/pages/battle/battle" });
    return;
  }

  const next = game.startPuzzle();
  if (next.ok) {
    uni.showToast({ title: "重新开始", icon: "none" });
    return;
  }
  uni.showModal({
    title: "无法开始",
    content: next.message,
    confirmText: "回主页",
    success: () => uni.reLaunch({ url: "/pages/home/home" }),
  });
}

function useRevealTool() {
  const result = game.useRevealTool();
  if (result.ok) {
    showRevealPanel.value = false;
    uni.showToast({ title: result.message, icon: "none" });
    return;
  }
  uni.showToast({ title: result.message, icon: "none" });
}

function buyRevealTool() {
  const result = game.buyRevealTool();
  uni.showToast({ title: result.message, icon: "none" });
}

async function watchRevealAd() {
  const reward = await adManager.show("reveal");
  if (!reward.granted) {
    uni.showToast({ title: "广告未完成", icon: "none" });
    return;
  }
  const reveal = game.revealFromAd();
  if (reveal.ok) showRevealPanel.value = false;
  uni.showToast({ title: reveal.message, icon: "none" });
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 54rpx 24rpx 34rpx;
  background: #121212;
}

.topbar,
.input-area,
.hint-title,
.actions,
.history-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.eyebrow,
.top-stats,
.hint-title,
.history-title,
.hint-text,
.empty {
  color: #9da7ad;
  font-size: 24rpx;
}

.title {
  display: block;
  margin-top: 8rpx;
  color: #f4f7f7;
  font-size: 46rpx;
  font-weight: 800;
}

.top-stats {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8rpx;
}

.input-area {
  margin-top: 28rpx;
}

.cells {
  flex: 1;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(62rpx, 1fr);
  gap: 10rpx;
}

.cell {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid #3c444b;
  border-radius: 10rpx;
  background: #111315;
  color: #f4f7f7;
  font-size: 42rpx;
  font-weight: 800;
}

.cell.locked {
  border-color: #00e676;
  color: #00e676;
  background: rgba(0, 230, 118, 0.12);
}

.reveal-button {
  position: relative;
  width: 164rpx;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  background: #ffab00;
  color: #171100;
  font-size: 24rpx;
  font-weight: 800;
}

.mini-magnifier {
  position: relative;
  width: 36rpx;
  height: 36rpx;
}

.mini-lens {
  position: absolute;
  top: 2rpx;
  left: 2rpx;
  width: 22rpx;
  height: 22rpx;
  border: 4rpx solid #171100;
  border-radius: 50%;
}

.mini-handle {
  position: absolute;
  right: 3rpx;
  bottom: 5rpx;
  width: 16rpx;
  height: 5rpx;
  border-radius: 999rpx;
  background: #171100;
  transform: rotate(45deg);
}

.badge {
  position: absolute;
  top: -8rpx;
  right: -8rpx;
  min-width: 30rpx;
  height: 30rpx;
  padding: 0 8rpx;
  border: 3rpx solid #121212;
  border-radius: 999rpx;
  background: #ff315d;
  color: #fff;
  font-size: 20rpx;
  line-height: 30rpx;
}

.hint-board,
.history {
  margin-top: 28rpx;
  padding: 22rpx;
  border: 1rpx solid #30353a;
  border-radius: 10rpx;
  background: #1b1d1f;
}

.hint-row,
.history-row {
  display: grid;
  grid-template-columns: 42rpx 132rpx 1fr;
  gap: 14rpx;
  align-items: center;
  min-height: 72rpx;
  margin-top: 14rpx;
  padding: 14rpx;
  border-radius: 8rpx;
  background: #151719;
}

.history-row {
  grid-template-columns: 132rpx 1fr;
}

.record-result {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.result-pill {
  padding: 8rpx 12rpx;
  border-radius: 8rpx;
  background: rgba(255, 171, 0, 0.14);
  color: #ffab00;
  font-size: 24rpx;
  font-weight: 800;
}

.result-pill.exact {
  background: rgba(0, 230, 118, 0.14);
  color: #00e676;
}

.hint-index {
  color: #00e676;
  font-size: 24rpx;
  font-weight: 800;
}

.hint-number {
  color: #f4f7f7;
  font-family: "DIN Alternate", "Cascadia Mono", monospace;
  font-size: 32rpx;
  font-weight: 800;
  letter-spacing: 0;
}

.hint-text {
  line-height: 1.45;
}

.keyboard {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12rpx;
  margin-top: 26rpx;
}

.digit-key {
  height: 88rpx;
  border: 1rpx solid #3b4248;
  background: #24282c;
  color: #f4f7f7;
  font-size: 34rpx;
  font-weight: 800;
}

.actions {
  margin-top: 18rpx;
}

.secondary-button,
.primary-button {
  flex: 1;
  height: 84rpx;
  font-size: 28rpx;
  font-weight: 800;
}

.secondary-button {
  border: 1rpx solid #30353a;
  background: #1b1d1f;
  color: #f4f7f7;
}

.primary-button {
  background: #00e676;
  color: #08120d;
}

.empty {
  padding: 28rpx 0 8rpx;
  text-align: center;
}

.mask {
  position: fixed;
  z-index: 9;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(0, 0, 0, 0.48);
}

.center-modal {
  position: fixed;
  z-index: 10;
  top: 50%;
  left: 50%;
  width: 570rpx;
  padding: 34rpx 30rpx;
  border-radius: 24rpx;
  background: #1b1d1f;
  transform: translate(-50%, -50%);
  text-align: center;
}

.modal-close {
  position: absolute;
  top: 18rpx;
  right: 18rpx;
  width: 58rpx;
  height: 58rpx;
  border: 1rpx solid #30353a;
  border-radius: 50%;
  background: #202326;
  color: #f4f7f7;
  font-size: 32rpx;
  font-weight: 800;
}

.modal-title,
.modal-note {
  display: block;
}

.modal-title {
  color: #f4f7f7;
  font-size: 34rpx;
  font-weight: 800;
}

.modal-note {
  margin-top: 18rpx;
  color: #9da7ad;
  font-size: 24rpx;
  line-height: 1.5;
}

.primary-action,
.ghost-action {
  width: 100%;
  height: 78rpx;
  margin-top: 18rpx;
  border-radius: 12rpx;
  font-size: 27rpx;
  font-weight: 800;
}

.primary-action {
  background: #00e676;
  color: #08120d;
}

.ghost-action {
  border: 1rpx solid #30353a;
  background: #202326;
  color: #f4f7f7;
}
</style>
