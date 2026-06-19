<template>
  <view class="play-page">
    <block v-if="game.puzzle">
      <view class="status-bar">
        <view class="status-pill">
          <text class="status-label">剩余机会</text>
          <text class="status-value">{{ attemptsText }}</text>
        </view>
        <view class="level-title">
          <text>{{ modeName }}</text>
          <text>第 {{ currentLevel }} 关</text>
        </view>
        <view class="status-pill timer-pill" v-if="showTimer">
          <text class="status-label">计时器</text>
          <text class="status-value">{{ timerText }}</text>
        </view>
        <view class="status-pill timer-pill" v-else>
          <text class="status-label">体力</text>
          <text class="status-value">{{ game.wallet.stamina }}/100</text>
        </view>
      </view>

      <view class="input-panel">
        <view class="digit-cells" :class="{ hard: game.input.length === 5 }">
          <view
            v-for="(_, index) in game.input"
            :key="index"
            class="digit-cell"
            :class="{ filled: Boolean(game.input[index]), locked: game.locked[index] }"
          >
            <text class="lock-icon" v-if="game.locked[index]">🔒</text>
            <text>{{ game.input[index] }}</text>
          </view>
        </view>
        <text v-if="game.puzzle.noviceReveal" class="novice-tip">新手福利：已为您揭晓一位数字</text>
      </view>

      <view class="clue-panel game-card">
        <view class="panel-head">
          <text class="panel-title">线索列表</text>
          <text class="panel-sub">{{ game.puzzle.guaranteedUnique ? "可推出唯一答案" : "推理线索" }}</text>
        </view>
        <scroll-view class="clue-list" scroll-y>
          <view
            v-for="(clue, index) in game.puzzle.clues"
            :key="`${index}-${clue.guess}`"
            class="clue-row"
            :class="{ exact: clue.result.exact === game.puzzle.difficulty.digitLength }"
          >
            <text class="clue-no">clue {{ index + 1 }}</text>
            <view class="clue-main">
              <text class="clue-guess">{{ clue.guess }}</text>
              <text class="clue-text">{{ clue.text }}</text>
            </view>
          </view>
        </scroll-view>
      </view>

      <view class="history-panel" v-if="game.guesses.length">
        <text class="history-title">提交历史</text>
        <view v-for="record in game.guesses" :key="record.createdAt" class="history-row">
          <text class="history-code">{{ record.guess }}</text>
          <text class="history-result">数字正确 {{ record.correctNumbers }} 个，位置正确 {{ record.correctPositions }} 个</text>
        </view>
      </view>

      <view class="keyboard-shell">
        <button class="tool-fab" @tap="showRevealPanel = true">
          🔍
          <text v-if="game.wallet.revealTools > 0">{{ game.wallet.revealTools }}</text>
        </button>

        <view class="keyboard-grid">
          <button v-for="digit in digits" :key="digit" class="digit-key" @tap="game.pressDigit(digit)">
            {{ digit }}
          </button>
        </view>

        <view class="action-row">
          <button class="action-btn ghost" @tap="game.backspace()">退格</button>
          <button class="action-btn ghost" @tap="game.clearEditableInput()">清空</button>
          <button class="action-btn submit" @tap="submit()">提交</button>
        </view>
      </view>
    </block>

    <view v-else class="empty-panel game-card">
      <text class="panel-title">暂无进行中的关卡</text>
      <text class="panel-sub">请返回主页选择模式开始游戏</text>
      <button class="game-btn game-btn--success empty-btn" @tap="goHome()">返回主页</button>
    </view>

    <view v-if="showRevealPanel" class="mask" @tap="showRevealPanel = false"></view>
    <view v-if="showRevealPanel" class="center-modal">
      <button class="modal-close" @tap="showRevealPanel = false">×</button>
      <text class="modal-title">显真透视镜</text>
      <text class="modal-note">当前拥有 {{ game.wallet.revealTools }} 个。使用后随机显示一位正确数字。</text>
      <text v-if="speedrunRevealText" class="modal-note limit-note">{{ speedrunRevealText }}</text>
      <button class="game-btn game-btn--success modal-action" @tap="useRevealTool()">使用道具</button>
      <button class="game-btn game-btn--warning modal-action" @tap="buyRevealTool()">金币购买 {{ revealCost }}</button>
      <button class="game-btn game-btn--ghost modal-action" @tap="watchRevealAd()">看广告使用一次</button>
    </view>

    <view v-if="reviveModal.visible" class="result-mask"></view>
    <view v-if="reviveModal.visible" class="result-modal revive-modal">
      <view class="revive-icon">!</view>
      <text class="result-title">差一点点就猜中啦！</text>
      <text class="revive-copy">看视频可以额外获得 1 次机会，继续推理当前题目。</text>
      <button class="revive-button" :disabled="reviveModal.busy" @tap="watchReviveAd()">
        {{ reviveModal.busy ? "视频加载中..." : "看视频额外获得1次机会" }}
      </button>
      <button class="giveup-button" :disabled="reviveModal.busy" @tap="giveUpAfterFailure()">放弃重来</button>
    </view>

    <view v-if="resultModal.visible" class="result-mask"></view>
    <view v-if="resultModal.visible" class="result-modal">
      <view class="success-icon">✓</view>
      <text class="result-title">通关成功！</text>
      <view class="reward-card">
        <view class="reward-row">
          <text>金币</text>
          <text class="reward-plus">+{{ resultModal.rewardCoins }}</text>
        </view>
        <view class="reward-row">
          <text>体力消耗</text>
          <text class="reward-cost">-{{ resultModal.costStamina }}</text>
        </view>
        <view class="reward-row">
          <text>关卡进度</text>
          <text>{{ resultModal.progressText }}</text>
        </view>
      </view>
      <button
        v-if="resultModal.rewardCoins > 0"
        class="triple-button"
        :disabled="rewardClaimBusy"
        @tap="claimTripleReward()"
      >
        {{ rewardClaimBusy ? "领取中..." : `看视频领取 3 倍奖励（${tripleRewardCoins} 金币）` }}
      </button>
      <button class="next-button" :disabled="rewardClaimBusy" @tap="claimNormalReward()">
        {{ resultModal.rewardCoins > 0 ? "普通领取" : resultModal.canContinue ? "下一关" : "完成" }}
      </button>
      <button class="home-button" @tap="goHome()">返回主页</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from "vue";
import { REVEAL_TOOL_COST, SPEEDRUN_REVEAL_LIMIT, useGameStore } from "@/stores/useGameStore";
import { DIGITS } from "@/utils/numberPuzzle";
import { adManager } from "@/utils/adManager";

const game = useGameStore();
const digits = DIGITS;
const showRevealPanel = ref(false);
const nowTick = ref(Date.now());
const rewardClaimBusy = ref(false);
let timer: number | undefined;
const revealCost = computed(() => String(REVEAL_TOOL_COST));

const resultModal = reactive({
  visible: false,
  rewardCoins: 0,
  costStamina: 0,
  progressText: "",
  canContinue: false,
});

const reviveModal = reactive({
  visible: false,
  busy: false,
});

const modeName = computed(() => {
  const map = {
    simple: "简单模式",
    hard: "困难模式",
    daily: "每日挑战",
    speedrun: "极速竞赛",
    battleCheckpoint: "好友闯关",
    battleSpeed: "好友竞速",
  };
  return map[game.progress.selectedMode];
});

const currentLevel = computed(() => game.puzzle?.round ?? game.progress.modeLevels[game.progress.selectedMode] ?? 1);
const attemptsText = computed(() => `${game.attemptsLeft}/3`);
const showTimer = computed(() => game.progress.selectedMode === "daily" || game.progress.selectedMode === "speedrun");
const tripleRewardCoins = computed(() => resultModal.rewardCoins * 3);
const speedrunRevealText = computed(() => {
  if (game.progress.selectedMode !== "speedrun") return "";
  return `极速竞赛每局只能使用 ${SPEEDRUN_REVEAL_LIMIT} 个显真镜，本局已用 ${game.speedrunRevealUsed}/${SPEEDRUN_REVEAL_LIMIT}`;
});
const timerText = computed(() => {
  if (game.progress.selectedMode === "daily") return formatDuration(game.dailyLeftSeconds);
  if (game.progress.selectedMode === "speedrun") return formatDuration(Math.floor((nowTick.value - game.startedAt) / 1000));
  return "00:00";
});

onMounted(() => {
  if (!game.puzzle) {
    uni.reLaunch({ url: "/pages/home/home" });
    return;
  }
  timer = setInterval(() => {
    nowTick.value = Date.now();
    game.tickTimer();
  }, 1000) as unknown as number;
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

function submit() {
  if (!game.puzzle) return;

  const rewardCoins = levelRewardForMode();
  const costStamina = game.puzzle.difficulty.staminaCost;
  const levelBefore = currentLevel.value;
  const result = game.submitGuess();

  if (!result.ok) {
    uni.showToast({ title: result.message, icon: "none" });
    return;
  }

  if (!result.solved) {
    if (result.failed) {
      reviveModal.visible = true;
      return;
    }
    uni.showToast({ title: result.message, icon: "none" });
    return;
  }

  resultModal.rewardCoins = rewardCoins;
  resultModal.costStamina = costStamina;
  resultModal.canContinue = canContinueAfterSuccess();
  resultModal.progressText = resultModal.canContinue ? `第 ${levelBefore + 1} 关已解锁` : result.message;
  resultModal.visible = true;
}

async function claimTripleReward() {
  if (rewardClaimBusy.value) return;
  rewardClaimBusy.value = true;
  try {
    const reward = await adManager.showRewardedVideoAd("triple");
    if (!reward.granted) {
      uni.showToast({ title: "广告未完成", icon: "none" });
      return;
    }
    await settleAndContinue(3, reward.transactionId);
  } finally {
    rewardClaimBusy.value = false;
  }
}

async function claimNormalReward() {
  if (rewardClaimBusy.value) return;
  rewardClaimBusy.value = true;
  try {
    await settleAndContinue(1);
  } finally {
    rewardClaimBusy.value = false;
  }
}

async function settleAndContinue(adMultiplier: 1 | 3, transactionId = "") {
  if (resultModal.rewardCoins > 0) {
    const settled = await game.settleLevelReward(adMultiplier, transactionId);
    if (!settled.ok) {
      uni.showToast({ title: settled.message, icon: "none" });
      return;
    }
    uni.showToast({ title: adMultiplier === 3 ? `3倍奖励 +${settled.rewardCoins}` : `金币 +${settled.rewardCoins}`, icon: "none" });
  }
  continueAfterResult();
}

function continueAfterResult() {
  if (!resultModal.canContinue) {
    goHome();
    return;
  }

  const next = game.startPuzzle();
  if (next.ok) {
    resultModal.visible = false;
    uni.showToast({ title: "下一关开始", icon: "none" });
    return;
  }

  uni.showModal({
    title: "无法继续",
    content: next.message,
    confirmText: "回主页",
    success: () => goHome(),
  });
}

async function watchReviveAd() {
  if (reviveModal.busy) return;
  reviveModal.busy = true;
  try {
    const reward = await adManager.showRewardedVideoAd("revive");
    if (!reward.granted) {
      uni.showToast({ title: "广告未完成", icon: "none" });
      return;
    }
    const revived = game.reviveCurrentPuzzle();
    if (!revived.ok) {
      uni.showToast({ title: revived.message, icon: "none" });
      return;
    }
    reviveModal.visible = false;
    uni.showToast({ title: revived.message, icon: "none" });
  } finally {
    reviveModal.busy = false;
  }
}

function giveUpAfterFailure() {
  reviveModal.visible = false;
  game.failPuzzle();
  restartCurrentMode();
}

function canContinueAfterSuccess() {
  const mode = game.progress.selectedMode;
  if (mode === "simple" || mode === "hard") return true;
  return mode === "battleCheckpoint" && Boolean(game.battle);
}

function levelRewardForMode() {
  const mode = game.progress.selectedMode;
  if (mode === "simple" || mode === "hard") return game.puzzle?.difficulty.rewardGold ?? 0;
  if (mode === "battleSpeed") return 10;
  if (mode === "battleCheckpoint" && game.battle && game.battle.completed + 1 >= game.battle.target) return 20;
  return 0;
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
    success: () => goHome(),
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
  if (game.progress.selectedMode === "speedrun" && game.speedrunRevealUsed >= SPEEDRUN_REVEAL_LIMIT) {
    uni.showToast({ title: "极速竞赛每局只能使用 1 个显真镜。", icon: "none" });
    return;
  }
  const reward = await adManager.show("reveal");
  if (!reward.granted) {
    uni.showToast({ title: "广告未完成", icon: "none" });
    return;
  }
  const reveal = game.revealFromAd();
  if (reveal.ok) showRevealPanel.value = false;
  uni.showToast({ title: reveal.message, icon: "none" });
}

function goHome() {
  resultModal.visible = false;
  uni.reLaunch({ url: "/pages/home/home" });
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(Math.max(0, totalSeconds) / 60);
  const seconds = String(Math.max(0, totalSeconds) % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}
</script>

<style scoped>
.play-page {
  position: relative;
  min-height: 100vh;
  padding: 50rpx 24rpx 330rpx;
  background: #2c3e50;
  color: #ffffff;
}

.status-bar {
  display: grid;
  grid-template-columns: 1fr 1.2fr 1fr;
  gap: 14rpx;
  align-items: center;
}

.status-pill {
  min-height: 92rpx;
  padding: 12rpx 16rpx;
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.12);
  box-shadow: 0 4rpx 0 rgba(0, 0, 0, 0.18);
}

.timer-pill {
  background: rgba(241, 196, 15, 0.92);
}

.status-label,
.status-value,
.level-title text,
.panel-title,
.panel-sub,
.clue-no,
.clue-guess,
.clue-text,
.history-title,
.history-code,
.history-result,
.modal-title,
.modal-note,
.result-title {
  display: block;
}

.status-label {
  color: rgba(255, 255, 255, 0.72);
  font-size: 21rpx;
}

.timer-pill .status-label,
.timer-pill .status-value {
  color: #2c3e50;
}

.status-value {
  margin-top: 6rpx;
  color: #fff;
  font-size: 30rpx;
  font-weight: 900;
}

.level-title {
  padding: 16rpx 12rpx;
  border-radius: 20rpx;
  background: rgba(74, 144, 226, 0.9);
  text-align: center;
  box-shadow: 0 4rpx 0 rgba(23, 70, 125, 0.55);
}

.level-title text:first-child {
  color: rgba(255, 255, 255, 0.82);
  font-size: 22rpx;
}

.level-title text:last-child {
  margin-top: 4rpx;
  color: #fff;
  font-size: 30rpx;
  font-weight: 900;
}

.input-panel {
  margin-top: 34rpx;
  padding: 26rpx;
  border-radius: 28rpx;
  background: linear-gradient(135deg, rgba(46, 204, 113, 0.96), rgba(74, 144, 226, 0.92));
  box-shadow: 0 8rpx 0 rgba(0, 0, 0, 0.18);
}

.novice-tip {
  display: block;
  margin-top: 18rpx;
  padding: 14rpx 18rpx;
  border-radius: 18rpx;
  background: rgba(255, 247, 216, 0.92);
  color: #2c3e50;
  font-size: 24rpx;
  font-weight: 900;
  text-align: center;
}

.digit-cells {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16rpx;
}

.digit-cells.hard {
  grid-template-columns: repeat(5, 1fr);
  gap: 12rpx;
}

.digit-cell {
  position: relative;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 18rpx;
  background: rgba(44, 62, 80, 0.45);
  color: rgba(255, 255, 255, 0.6);
  font-size: 52rpx;
  font-weight: 900;
  box-shadow: inset 0 -4rpx 0 rgba(0, 0, 0, 0.12);
}

.digit-cell.filled {
  background: #fff7d8;
  color: #2c3e50;
  box-shadow: 0 5rpx 0 rgba(168, 131, 31, 0.48);
}

.digit-cell.locked {
  background: #dff9ec;
  color: #2ecc71;
}

.lock-icon {
  position: absolute;
  top: 8rpx;
  right: 8rpx;
  font-size: 20rpx;
}

.clue-panel {
  margin-top: 26rpx;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.panel-title {
  color: #2c3e50;
  font-size: 31rpx;
  font-weight: 900;
}

.panel-sub {
  color: #8a98a8;
  font-size: 22rpx;
}

.clue-list {
  max-height: 360rpx;
  margin-top: 16rpx;
}

.clue-row {
  display: grid;
  grid-template-columns: 112rpx 1fr;
  gap: 16rpx;
  align-items: center;
  min-height: 92rpx;
  margin-bottom: 14rpx;
  padding: 16rpx;
  border-radius: 18rpx;
  background: #f7fbff;
  color: #333333;
  box-shadow: 0 4rpx 0 rgba(44, 62, 80, 0.1);
}

.clue-row.exact {
  background: #dcf8e7;
}

.clue-no {
  color: #4a90e2;
  font-size: 22rpx;
  font-weight: 900;
}

.clue-guess {
  color: #2c3e50;
  font-family: "DIN Alternate", "Cascadia Mono", monospace;
  font-size: 32rpx;
  font-weight: 900;
  letter-spacing: 0;
}

.clue-text {
  margin-top: 4rpx;
  color: #333333;
  font-size: 23rpx;
  line-height: 1.45;
}

.history-panel {
  margin-top: 20rpx;
  padding: 20rpx;
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.12);
}

.history-title {
  color: rgba(255, 255, 255, 0.82);
  font-size: 24rpx;
  font-weight: 800;
}

.history-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-top: 12rpx;
}

.history-code {
  width: 118rpx;
  color: #f1c40f;
  font-size: 28rpx;
  font-weight: 900;
}

.history-result {
  flex: 1;
  color: rgba(255, 255, 255, 0.78);
  font-size: 22rpx;
}

.keyboard-shell {
  position: fixed;
  z-index: 6;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 26rpx 24rpx 34rpx;
  border-radius: 34rpx 34rpx 0 0;
  background: #20364b;
  box-shadow: 0 -8rpx 26rpx rgba(0, 0, 0, 0.22);
}

.tool-fab {
  position: absolute;
  right: 28rpx;
  top: -58rpx;
  width: 108rpx;
  height: 108rpx;
  border-radius: 50%;
  background: #f1c40f;
  color: #2c3e50;
  font-size: 44rpx;
  font-weight: 900;
  box-shadow: 0 6rpx 0 rgba(171, 132, 0, 0.65);
}

.tool-fab text {
  position: absolute;
  top: -6rpx;
  right: -2rpx;
  min-width: 34rpx;
  height: 34rpx;
  padding: 0 8rpx;
  border: 3rpx solid #20364b;
  border-radius: 999rpx;
  background: #e74c3c;
  color: #fff;
  font-size: 20rpx;
  line-height: 34rpx;
}

.keyboard-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 14rpx;
}

.digit-key {
  height: 82rpx;
  border-radius: 18rpx;
  background: #edf5ff;
  color: #2c3e50;
  font-size: 34rpx;
  font-weight: 900;
  box-shadow: 0 5rpx 0 rgba(131, 154, 179, 0.65);
  transition: transform 0.08s ease, box-shadow 0.08s ease;
}

.digit-key:active {
  transform: scale(0.94) translateY(4rpx);
  box-shadow: 0 1rpx 0 rgba(131, 154, 179, 0.65);
}

.action-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1.5fr;
  gap: 14rpx;
  margin-top: 18rpx;
}

.action-btn {
  height: 88rpx;
  border-radius: 20rpx;
  font-size: 28rpx;
  font-weight: 900;
}

.action-btn.ghost {
  border: 2rpx solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  box-shadow: 0 4rpx 0 rgba(0, 0, 0, 0.22);
}

.action-btn.submit {
  background: #2ecc71;
  color: #fff;
  box-shadow: 0 5rpx 0 rgba(26, 139, 76, 0.7);
}

.empty-panel {
  margin-top: 220rpx;
}

.empty-btn {
  width: 100%;
  margin-top: 24rpx;
}

.mask,
.result-mask {
  position: fixed;
  z-index: 10;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(0, 0, 0, 0.52);
}

.center-modal,
.result-modal {
  position: fixed;
  z-index: 11;
  top: 50%;
  left: 50%;
  width: 620rpx;
  padding: 36rpx 30rpx;
  border-radius: 28rpx;
  background: #fff;
  transform: translate(-50%, -50%);
  text-align: center;
  box-shadow: 0 8rpx 24rpx rgba(18, 38, 63, 0.12);
}

.modal-close {
  position: absolute;
  top: 18rpx;
  right: 18rpx;
  width: 62rpx;
  height: 62rpx;
  border-radius: 50%;
  background: #edf5ff;
  color: #2c3e50;
  font-size: 34rpx;
  font-weight: 900;
  line-height: 62rpx;
}

.modal-title {
  color: #2c3e50;
  font-size: 34rpx;
  font-weight: 900;
}

.modal-note {
  margin: 18rpx auto 0;
  max-width: 500rpx;
  color: #8a98a8;
  font-size: 24rpx;
  line-height: 1.5;
}

.limit-note {
  color: #e67e22;
  font-weight: 800;
}

.modal-action {
  width: 100%;
  margin-top: 18rpx;
}

.result-mask {
  z-index: 20;
}

.result-modal {
  z-index: 21;
  transform: translate(-50%, -50%) scale(1);
  animation: popIn 0.22s ease-out;
}

.success-icon {
  width: 118rpx;
  height: 118rpx;
  margin: 0 auto 16rpx;
  border-radius: 50%;
  background: #2ecc71;
  color: #fff;
  font-size: 76rpx;
  font-weight: 900;
  line-height: 118rpx;
  box-shadow: 0 6rpx 0 rgba(26, 139, 76, 0.65);
}

.revive-icon {
  width: 112rpx;
  height: 112rpx;
  margin: 0 auto 16rpx;
  border-radius: 50%;
  background: #e67e22;
  color: #fff;
  font-size: 72rpx;
  font-weight: 1000;
  line-height: 112rpx;
  box-shadow: 0 6rpx 0 rgba(174, 91, 22, 0.65);
}

.revive-copy {
  display: block;
  margin: 18rpx auto 4rpx;
  max-width: 520rpx;
  color: #8a98a8;
  font-size: 25rpx;
  line-height: 1.5;
}

.result-title {
  color: #2ecc71;
  font-size: 48rpx;
  font-weight: 900;
  text-shadow: 0 4rpx 0 rgba(46, 204, 113, 0.18);
}

.reward-card {
  margin-top: 24rpx;
  padding: 20rpx;
  border-radius: 22rpx;
  background: #f7fbff;
}

.reward-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 56rpx;
  color: #333333;
  font-size: 26rpx;
  font-weight: 800;
}

.reward-plus {
  color: #2ecc71;
}

.reward-cost {
  color: #e67e22;
}

.triple-button,
.revive-button,
.giveup-button,
.next-button,
.home-button {
  width: 100%;
  height: 88rpx;
  margin-top: 20rpx;
  border-radius: 22rpx;
  font-size: 29rpx;
  font-weight: 900;
}

.triple-button,
.revive-button {
  background: linear-gradient(180deg, #55f08f, #2ecc71);
  color: #fff;
  box-shadow: 0 6rpx 0 rgba(26, 139, 76, 0.72), 0 0 28rpx rgba(46, 204, 113, 0.42);
  animation: glowPulse 1.2s ease-in-out infinite;
}

.next-button {
  background: #2ecc71;
  color: #fff;
  box-shadow: 0 5rpx 0 rgba(26, 139, 76, 0.7);
}

.home-button,
.giveup-button {
  border: 2rpx solid #d8e5ee;
  background: #f7fbff;
  color: #2c3e50;
  box-shadow: 0 4rpx 0 rgba(44, 62, 80, 0.12);
}

.giveup-button {
  color: #8a98a8;
}

@keyframes popIn {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.86);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

@keyframes jumpPulse {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6rpx);
  }
}

@keyframes glowPulse {
  0%,
  100% {
    transform: translateY(0);
    box-shadow: 0 6rpx 0 rgba(26, 139, 76, 0.72), 0 0 18rpx rgba(46, 204, 113, 0.35);
  }
  50% {
    transform: translateY(-6rpx);
    box-shadow: 0 8rpx 0 rgba(26, 139, 76, 0.68), 0 0 36rpx rgba(46, 204, 113, 0.62);
  }
}
</style>
