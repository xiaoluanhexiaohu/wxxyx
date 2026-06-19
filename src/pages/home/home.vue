<template>
  <view class="home-page">
    <view v-if="loadError" class="state-panel game-card">
      <text class="state-title">主页加载失败</text>
      <text class="state-desc">{{ loadError }}</text>
      <button class="game-btn game-btn--success" @tap="goLogin()">回到登录页</button>
    </view>

    <view v-else-if="!ready" class="state-panel game-card">
      <text class="state-title">加载中</text>
      <text class="state-desc">正在读取账号、体力和闯关进度</text>
    </view>

    <block v-else>
      <view class="player-panel">
        <view class="avatar">
          <text>🦁</text>
        </view>
        <view class="player-copy">
          <text class="player-name">{{ displayName }}</text>
          <text class="player-sub">逻辑大师 · 今日继续推理</text>
        </view>
      </view>

      <view class="resource-card game-card">
        <view class="resource-item">
          <view class="resource-main">
            <text class="resource-icon">⚡</text>
            <view>
              <text class="resource-label">体力</text>
              <text class="resource-value">{{ game.wallet.stamina }}/100</text>
            </view>
          </view>
          <button class="resource-plus" @tap="watchStaminaAd()">+</button>
          <text class="resource-tip">{{ staminaRecoverText }}</text>
        </view>

        <view class="resource-item">
          <view class="resource-main">
            <text class="resource-icon coin">●</text>
            <view>
              <text class="resource-label">金币</text>
              <text class="resource-value">{{ game.wallet.gold }}</text>
            </view>
          </view>
          <button class="resource-plus" @tap="watchGoldAd()">+</button>
          <text class="resource-tip">用于购买显真镜</text>
        </view>

        <view class="resource-item">
          <view class="resource-main">
            <text class="resource-icon">🔍</text>
            <view>
              <text class="resource-label">显真镜</text>
              <text class="resource-value">{{ game.wallet.revealTools }}</text>
            </view>
          </view>
          <button class="resource-plus" @tap="showRevealPanel = true">+</button>
          <text class="resource-tip">随机显示一位答案</text>
        </view>
      </view>

      <view class="section-head">
        <text class="section-title">选择模式</text>
        <text class="section-desc">每个模式会保存独立进度</text>
      </view>

      <view class="mode-grid">
        <button class="mode-card mode-simple" @tap="startGame('simple', 'easy')">
          <view class="mode-icon">🐱</view>
          <text class="mode-title">简单模式</text>
          <text class="mode-desc">4数字 · 4线索</text>
          <view class="mode-meta">
            <text>⚡ -5</text>
            <text>🪙 +10</text>
          </view>
          <text class="mode-level">第 {{ simpleLevel }} 关</text>
        </button>

        <button class="mode-card mode-hard" @tap="startGame('hard', 'hard')">
          <view class="mode-icon">🦁</view>
          <text class="mode-title">困难模式</text>
          <text class="mode-desc">5数字 · 5线索</text>
          <view class="mode-meta">
            <text>⚡ -8</text>
            <text>🪙 +18</text>
          </view>
          <text class="mode-level">第 {{ hardLevel }} 关</text>
        </button>

        <button class="mode-card mode-daily" @tap="startGame('daily', 'easy')">
          <view class="mode-icon">🔎</view>
          <text class="mode-title">每日挑战</text>
          <text class="mode-desc">每天2次 · 剩余 {{ game.dailyAttemptsLeft }}/2</text>
          <view class="mode-meta">
            <text>奖励体力</text>
            <text>限时推理</text>
          </view>
        </button>

        <button class="mode-card mode-speed" @tap="startGame('speedrun', 'easy')">
          <view class="mode-icon">⏱</view>
          <text class="mode-title">极速竞赛</text>
          <text class="mode-desc">历史最佳 {{ speedText }}</text>
          <view class="mode-meta">
            <text>今日 {{ game.speedrunAttemptsLeft }}/2</text>
            <text>速度榜</text>
          </view>
        </button>

        <button class="mode-card mode-battle" @tap="openBattleMode('checkpoint')">
          <view class="mode-icon">🔗</view>
          <text class="mode-title">好友闯关</text>
          <text class="mode-desc">3关连胜</text>
          <view class="mode-meta">
            <text>同题对战</text>
            <text>分享邀请</text>
          </view>
        </button>

        <button class="mode-card mode-race" @tap="openBattleMode('speed')">
          <view class="mode-icon">🏃</view>
          <text class="mode-title">好友竞速</text>
          <text class="mode-desc">速度比拼</text>
          <view class="mode-meta">
            <text>一局定胜</text>
            <text>同题同线索</text>
          </view>
        </button>
      </view>
    </block>

    <view class="bottom-nav">
      <button class="nav-btn" @tap="openRankMenu()">📊<text>排行榜</text></button>
      <button class="nav-btn" @tap="showSignIn = true">📅<text>签到</text></button>
      <button class="nav-btn" @tap="showLottery = true">🎁<text>抽奖</text></button>
      <button class="nav-btn" @tap="showSettings = true">⚙<text>设置</text></button>
    </view>

    <view v-if="showRankMenu" class="rank-popover game-card">
      <button v-for="item in rankModes" :key="item.key" class="rank-chip" @tap="openRankSheet(item.key)">
        {{ item.label }}
      </button>
    </view>

    <view v-if="showRankSheet" class="mask" @tap="closeRankSheet()"></view>
    <view v-if="showRankSheet" class="bottom-sheet">
      <view class="sheet-handle"></view>
      <view class="sheet-head">
        <view>
          <text class="sheet-title">{{ rankTitle }}</text>
          <text class="sheet-sub">总榜和微信好友榜前 50 名</text>
        </view>
        <button class="close-button" @tap="closeRankSheet()">×</button>
      </view>
      <view class="tabs">
        <button class="tab" :class="{ active: rankScope === 'global' }" @tap="setRankScope('global')">总榜</button>
        <button class="tab" :class="{ active: rankScope === 'friend' }" @tap="setRankScope('friend')">好友</button>
      </view>
      <scroll-view class="rank-list" scroll-y>
        <view v-for="entry in currentRankList" :key="`${rankScope}-${rankMode}-${entry.rank}-${entry.nickname}`" class="rank-row" :class="{ me: entry.isMe }">
          <text class="rank-no">{{ entry.rank }}</text>
          <view class="rank-main">
            <text class="rank-name">{{ entry.nickname }}</text>
            <text class="rank-sub">{{ entry.metricText || `第 ${entry.level} 关` }}</text>
          </view>
          <text class="rank-score">{{ rankMode === "speedrun" ? "用时" : "关卡" }}</text>
        </view>
      </scroll-view>
    </view>

    <view v-if="showSignIn" class="mask" @tap="showSignIn = false"></view>
    <view v-if="showSignIn" class="center-modal sign-modal">
      <button class="modal-close" @tap="showSignIn = false">×</button>
      <text class="modal-title">每日签到</text>
      <text class="modal-note">每个日期都有固定奖励，签到后会记录当天获得的东西。</text>
      <scroll-view class="sign-calendar" scroll-y>
        <view
          v-for="day in signInDays"
          :key="day.dateKey"
          class="sign-day"
          :class="{ today: day.today, signed: day.signed }"
        >
          <text class="sign-date">{{ day.day }}</text>
          <text class="sign-reward">{{ day.signed ? game.progress.signInHistory[day.dateKey] : day.reward }}</text>
        </view>
      </scroll-view>
      <button class="game-btn game-btn--success modal-action" @tap="claimSignIn()">今日签到</button>
    </view>

    <view v-if="showLottery" class="mask" @tap="showLottery = false"></view>
    <view v-if="showLottery" class="center-modal lottery-modal">
      <button class="modal-close lottery-close" @tap="showLottery = false">×</button>
      <view class="lottery-title-row">
        <text class="lottery-title-deco">\\</text>
        <text class="lottery-title">每日抽奖</text>
        <text class="lottery-title-deco">/</text>
      </view>
      <view class="wheel-wrap">
        <view class="wheel-pointer"></view>
        <view class="wheel" :style="{ transform: `rotate(${wheelDeg}deg)` }">
          <view
            v-for="(reward, index) in lotteryRewards"
            :key="reward.key"
            class="wheel-sector"
            :class="index % 2 === 0 ? 'blue' : 'green'"
          >
            <text class="reward-value">{{ reward.label }}</text>
            <text class="reward-icon">{{ lotteryIcon(reward.key) }}</text>
          </view>
        </view>
        <button class="wheel-center" :disabled="lotteryBusy" @tap="spinLottery()">
          {{ lotteryBusy ? "转动" : "抽奖" }}
        </button>
      </view>
      <button class="lottery-main-btn" :disabled="lotteryBusy" @tap="spinLottery()">
        {{ lotteryBusy ? "抽奖中..." : "点击抽奖" }}
      </button>
      <text class="lottery-note">{{ lotteryMessage || "每日免费 1 次" }}</text>
    </view>

    <view v-if="showRevealPanel" class="mask" @tap="showRevealPanel = false"></view>
    <view v-if="showRevealPanel" class="center-modal">
      <button class="modal-close" @tap="showRevealPanel = false">×</button>
      <text class="modal-title">显真透视镜</text>
      <text class="modal-note">当前拥有 {{ game.wallet.revealTools }} 个。进入关卡后可随机显示一个正确数字。</text>
      <button class="game-btn game-btn--warning modal-action" @tap="buyRevealTool()">金币购买 {{ revealCost }}</button>
      <button class="game-btn game-btn--ghost modal-action" @tap="goUseReveal()">去关卡使用</button>
    </view>

    <view v-if="showSettings" class="mask" @tap="showSettings = false"></view>
    <view v-if="showSettings" class="center-modal settings-modal">
      <button class="modal-close" @tap="showSettings = false">×</button>
      <text class="modal-title">设置</text>
      <view class="setting-row">
        <text>音效</text>
        <switch :checked="settings.sound" color="#2ECC71" @change="settings.sound = !settings.sound" />
      </view>
      <view class="setting-row">
        <text>背景音乐</text>
        <switch :checked="settings.music" color="#2ECC71" @change="settings.music = !settings.music" />
      </view>
      <view class="setting-row">
        <text>消息提醒</text>
        <switch :checked="settings.notice" color="#2ECC71" @change="settings.notice = !settings.notice" />
      </view>
      <button class="game-btn game-btn--ghost modal-action" @tap="showToast('客服入口上线时接入')">联系客服</button>
      <button class="game-btn game-btn--danger modal-action" @tap="logout()">退出登录</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import {
  useGameStore,
  LOTTERY_REWARDS,
  MAX_STAMINA,
  REVEAL_TOOL_COST,
  SIGN_IN_REWARDS,
  STAMINA_RECOVER_AMOUNT,
  STAMINA_RECOVER_MS,
  type LotteryRewardIndex,
} from "@/stores/useGameStore";
import type { BattleType, DifficultyKey, GameMode } from "@/types/game";
import { adManager } from "@/utils/adManager";
import { fetchLeaderboard } from "@/services/api";
import { createLeaderboard, type RankingEntry, type RankingMode, type RankingScope } from "@/utils/rankings";

const game = useGameStore();
const ready = ref(false);
const loadError = ref("");
const nowTick = ref(Date.now());
const showRankMenu = ref(false);
const showRankSheet = ref(false);
const rankMode = ref<RankingMode>("simple");
const rankScope = ref<RankingScope>("global");
const rankList = ref<RankingEntry[]>([]);
const showLottery = ref(false);
const lotteryBusy = ref(false);
const lotteryMessage = ref("");
const wheelDeg = ref(0);
const selectedLotteryIndex = ref<LotteryRewardIndex | null>(null);
const showSignIn = ref(false);
const showRevealPanel = ref(false);
const showSettings = ref(false);
const settings = reactive({
  sound: true,
  music: true,
  notice: true,
});
let clockTimer: number | undefined;

const rankModes: Array<{ key: RankingMode; label: string }> = [
  { key: "simple", label: "简单模式" },
  { key: "hard", label: "困难模式" },
  { key: "speedrun", label: "极速竞赛" },
];

const displayName = computed(() => (game.profile ? game.profile.nickname : "数字玩家"));
const simpleLevel = computed(() => String(game.progress.modeLevels.simple));
const hardLevel = computed(() => String(game.progress.modeLevels.hard));
const speedText = computed(() => (game.progress.bestSpeedMs ? `${(game.progress.bestSpeedMs / 1000).toFixed(2)} 秒` : "暂无"));
const revealCost = computed(() => String(REVEAL_TOOL_COST));
const rankTitle = computed(() => rankModes.find((item) => item.key === rankMode.value)?.label || "排行榜");
const currentRankList = computed(() => (rankList.value.length ? rankList.value : createLeaderboard(game.profile, game.progress, rankScope.value, rankMode.value)));
const lotteryRewards = LOTTERY_REWARDS;
const signInDays = computed(() => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const reward = SIGN_IN_REWARDS[index % SIGN_IN_REWARDS.length];
    return {
      day,
      dateKey,
      reward: reward.label,
      signed: Boolean(game.progress.signInHistory?.[dateKey]),
      today: day === today,
    };
  });
});
const staminaRecoverText = computed(() => {
  const minutes = STAMINA_RECOVER_MS / 60000;
  if (game.wallet.stamina >= MAX_STAMINA) {
    return `已满，每 ${minutes} 分钟恢复 ${STAMINA_RECOVER_AMOUNT} 点`;
  }

  const nextAt = game.wallet.lastStaminaAt + STAMINA_RECOVER_MS;
  const seconds = Math.max(0, Math.ceil((nextAt - nowTick.value) / 1000));
  return `${formatDuration(seconds)} 后恢复`;
});

onMounted(() => {
  clockTimer = setInterval(() => {
    nowTick.value = Date.now();
    game.resetDailyCountersIfNeeded();
    game.recoverStamina();
  }, 1000) as unknown as number;
});

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer);
});

onShow(async () => {
  ready.value = false;
  loadError.value = "";
  try {
    await game.bootstrap();
    if (!game.isLoggedIn) {
      uni.reLaunch({ url: "/pages/login/login" });
      return;
    }
    ready.value = true;
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : "未知错误";
    ready.value = true;
  }
});

function goLogin() {
  uni.reLaunch({ url: "/pages/login/login" });
}

function startGame(mode: GameMode, difficulty: DifficultyKey) {
  const result = game.startMode(mode, difficulty);
  if (!result.ok) {
    uni.showToast({ title: result.message, icon: "none" });
    return;
  }
  uni.navigateTo({ url: "/pages/play/play" });
}

function openBattleMode(type: BattleType) {
  uni.navigateTo({ url: `/pages/battle/battle?type=${type}` });
}

function openRankMenu() {
  showRankMenu.value = !showRankMenu.value;
}

function openRankSheet(mode: RankingMode) {
  rankMode.value = mode;
  rankScope.value = "global";
  showRankMenu.value = false;
  showRankSheet.value = true;
  loadRankList();
}

function closeRankSheet() {
  showRankSheet.value = false;
}

function setRankScope(scope: RankingScope) {
  rankScope.value = scope;
  loadRankList();
}

async function loadRankList() {
  rankList.value = [];
  const remoteList = await fetchLeaderboard({
    mode: rankMode.value,
    scope: rankScope.value,
    openId: game.profile?.openId,
  });
  rankList.value = remoteList;
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function claimSignIn() {
  const result = game.claimDailySignIn();
  if (result.ok) {
    showSignIn.value = false;
  }
  uni.showToast({ title: result.message, icon: "none" });
}

function lotteryIcon(key: string) {
  if (key.includes("gold")) return "🪙";
  if (key.includes("stamina")) return "⚡";
  return "🔍";
}

function spinLottery() {
  if (lotteryBusy.value) return;
  if (game.progress.lotteryDate === todayKey()) {
    const message = "今日抽奖次数已用完。";
    lotteryMessage.value = message;
    uni.showToast({ title: message, icon: "none" });
    return;
  }
  const rewardIndex = Math.floor(Math.random() * LOTTERY_REWARDS.length) as LotteryRewardIndex;
  selectedLotteryIndex.value = rewardIndex;
  lotteryBusy.value = true;
  lotteryMessage.value = "转盘转动中...";
  const segmentDeg = 360 / LOTTERY_REWARDS.length;
  const finalDeg = 360 * 5 - rewardIndex * segmentDeg;
  wheelDeg.value += finalDeg;
  setTimeout(() => {
    try {
      const result = game.drawDailyLottery(rewardIndex);
      lotteryMessage.value = result.message;
      uni.showToast({ title: result.message, icon: "none" });
    } catch (error) {
      lotteryMessage.value = "抽奖失败，请再试一次。";
      uni.showToast({ title: "抽奖失败，请再试一次", icon: "none" });
    } finally {
      lotteryBusy.value = false;
    }
  }, 1000);
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function buyRevealTool() {
  const result = game.buyRevealTool();
  uni.showToast({ title: result.message, icon: "none" });
}

function goUseReveal() {
  if (game.puzzle) {
    showRevealPanel.value = false;
    uni.navigateTo({ url: "/pages/play/play" });
    return;
  }
  uni.showToast({ title: "进入关卡后可使用", icon: "none" });
}

function showToast(title: string) {
  uni.showToast({ title, icon: "none" });
}

function logout() {
  game.logout();
  uni.reLaunch({ url: "/pages/login/login" });
}

async function watchStaminaAd() {
  const reward = await adManager.show("stamina");
  if (!reward.granted) {
    uni.showToast({ title: "广告未完成", icon: "none" });
    return;
  }
  game.grantStamina(40);
  uni.showToast({ title: "体力 +40", icon: "none" });
}

async function watchGoldAd() {
  const reward = await adManager.show("gold");
  if (!reward.granted) {
    uni.showToast({ title: "广告未完成", icon: "none" });
    return;
  }
  game.grantGold(60);
  uni.showToast({ title: "金币 +60", icon: "none" });
}
</script>

<style scoped>
.home-page {
  position: relative;
  min-height: 100vh;
  padding: 56rpx 24rpx 150rpx;
  overflow: hidden;
  background: linear-gradient(160deg, #2c3e50 0%, #4a90e2 54%, #a8e6cf 100%);
  color: #333333;
}

.state-panel {
  margin-top: 220rpx;
}

.state-title,
.state-desc {
  display: block;
}

.state-title {
  color: #333333;
  font-size: 34rpx;
  font-weight: 900;
}

.state-desc {
  margin: 16rpx 0 24rpx;
  color: #8a98a8;
  font-size: 26rpx;
}

.player-panel {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 20rpx;
  border-radius: 28rpx;
  background: rgba(74, 144, 226, 0.92);
  box-shadow: 0 6rpx 0 rgba(35, 82, 138, 0.35);
}

.avatar {
  width: 108rpx;
  height: 108rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 6rpx solid rgba(255, 255, 255, 0.7);
  border-radius: 50%;
  background: #fff6cf;
  font-size: 64rpx;
}

.player-copy {
  flex: 1;
}

.player-name,
.player-sub,
.section-title,
.section-desc,
.resource-label,
.resource-value,
.resource-tip,
.mode-title,
.mode-desc,
.mode-level,
.sheet-title,
.sheet-sub,
.rank-name,
.rank-sub,
.modal-title,
.modal-note {
  display: block;
}

.player-name {
  color: #ffffff;
  font-size: 36rpx;
  font-weight: 900;
}

.player-sub {
  margin-top: 8rpx;
  color: rgba(255, 255, 255, 0.82);
  font-size: 24rpx;
}

.resource-card {
  position: sticky;
  z-index: 2;
  top: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14rpx;
  margin-top: 22rpx;
}

.resource-item {
  position: relative;
  min-height: 128rpx;
  padding: 12rpx;
  border-radius: 22rpx;
  background: #f7fbff;
}

.resource-main {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.resource-icon {
  width: 42rpx;
  height: 42rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(241, 196, 15, 0.25);
  font-size: 28rpx;
}

.resource-icon.coin {
  color: #f1c40f;
  text-shadow: 0 2rpx 0 rgba(0, 0, 0, 0.2);
}

.resource-label {
  color: #8a98a8;
  font-size: 20rpx;
}

.resource-value {
  margin-top: 2rpx;
  color: #2c3e50;
  font-size: 27rpx;
  font-weight: 900;
}

.resource-plus {
  position: absolute;
  top: 10rpx;
  right: 10rpx;
  width: 34rpx;
  height: 34rpx;
  border-radius: 50%;
  background: #2ecc71;
  color: #fff;
  font-size: 26rpx;
  font-weight: 900;
  line-height: 34rpx;
  box-shadow: 0 3rpx 0 rgba(26, 139, 76, 0.65);
}

.resource-tip {
  margin-top: 12rpx;
  color: #8a98a8;
  font-size: 18rpx;
  line-height: 1.25;
}

.section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-top: 28rpx;
}

.section-title {
  color: #ffffff;
  font-size: 34rpx;
  font-weight: 900;
}

.section-desc {
  color: rgba(255, 255, 255, 0.7);
  font-size: 22rpx;
}

.mode-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
  margin-top: 18rpx;
}

.mode-card {
  position: relative;
  min-height: 236rpx;
  padding: 22rpx;
  border: 0;
  border-radius: 24rpx;
  color: #ffffff;
  text-align: left;
  box-shadow: 0 6rpx 0 rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.mode-card::after {
  content: "";
  position: absolute;
  right: -24rpx;
  bottom: -34rpx;
  width: 130rpx;
  height: 130rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.14);
}

.mode-icon {
  position: absolute;
  right: 18rpx;
  top: 18rpx;
  font-size: 58rpx;
}

.mode-title {
  max-width: 210rpx;
  color: #fff;
  font-size: 31rpx;
  font-weight: 900;
}

.mode-desc {
  margin-top: 10rpx;
  color: rgba(255, 255, 255, 0.88);
  font-size: 23rpx;
}

.mode-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 18rpx;
}

.mode-meta text {
  padding: 7rpx 12rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.22);
  color: #fff;
  font-size: 21rpx;
  font-weight: 800;
}

.mode-level {
  margin-top: 16rpx;
  color: rgba(255, 255, 255, 0.9);
  font-size: 22rpx;
}

.mode-simple {
  background: linear-gradient(135deg, #2ecc71, #1abc9c);
}

.mode-hard {
  background: linear-gradient(135deg, #e67e22, #d35400);
}

.mode-daily {
  background: linear-gradient(135deg, #4a90e2, #6bb6ff);
}

.mode-speed {
  background: linear-gradient(135deg, #2bbbd8, #3498db);
}

.mode-battle {
  background: linear-gradient(135deg, #f1c40f, #f39c12);
}

.mode-race {
  background: linear-gradient(135deg, #95a5a6, #7f8c8d);
}

.bottom-nav {
  position: fixed;
  z-index: 8;
  right: 24rpx;
  bottom: 24rpx;
  left: 24rpx;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10rpx;
  padding: 14rpx;
  border-radius: 28rpx;
  background: rgba(26, 45, 64, 0.94);
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.24);
}

.nav-btn {
  min-height: 78rpx;
  border-radius: 20rpx;
  background: transparent;
  color: #fff;
  font-size: 34rpx;
}

.nav-btn text {
  display: block;
  margin-top: 4rpx;
  color: rgba(255, 255, 255, 0.82);
  font-size: 20rpx;
}

.rank-popover {
  position: fixed;
  z-index: 9;
  right: 24rpx;
  bottom: 138rpx;
  left: 24rpx;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
}

.rank-chip {
  height: 72rpx;
  border-radius: 18rpx;
  background: #edf5ff;
  color: #2c3e50;
  font-size: 24rpx;
  font-weight: 900;
}

.mask {
  position: fixed;
  z-index: 10;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(0, 0, 0, 0.48);
}

.bottom-sheet,
.center-modal {
  position: fixed;
  z-index: 11;
  background: #fff;
  box-shadow: 0 8rpx 24rpx rgba(18, 38, 63, 0.12);
}

.bottom-sheet {
  right: 0;
  bottom: 0;
  left: 0;
  max-height: 78vh;
  padding: 16rpx 28rpx 34rpx;
  border-radius: 36rpx 36rpx 0 0;
}

.sheet-handle {
  width: 86rpx;
  height: 8rpx;
  margin: 0 auto 20rpx;
  border-radius: 999rpx;
  background: #d8e5ee;
}

.sheet-head,
.tabs,
.rank-row,
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.sheet-title,
.modal-title {
  color: #2c3e50;
  font-size: 34rpx;
  font-weight: 900;
}

.sheet-sub,
.modal-note,
.rank-sub {
  color: #8a98a8;
  font-size: 23rpx;
}

.close-button,
.modal-close {
  width: 62rpx;
  height: 62rpx;
  border-radius: 50%;
  background: #edf5ff;
  color: #2c3e50;
  font-size: 34rpx;
  font-weight: 900;
  line-height: 62rpx;
}

.tabs {
  margin-top: 22rpx;
  padding: 8rpx;
  border-radius: 22rpx;
  background: #edf5ff;
}

.tab {
  flex: 1;
  height: 64rpx;
  border-radius: 18rpx;
  background: transparent;
  color: #8a98a8;
  font-size: 26rpx;
  font-weight: 900;
}

.tab.active {
  background: #2ecc71;
  color: #fff;
}

.rank-list {
  height: 52vh;
  margin-top: 18rpx;
}

.rank-row {
  min-height: 84rpx;
  margin-bottom: 12rpx;
  padding: 14rpx 18rpx;
  border-radius: 20rpx;
  background: #f7fbff;
}

.rank-row.me {
  background: #dcf8e7;
}

.rank-no,
.rank-score {
  color: #e67e22;
  font-size: 30rpx;
  font-weight: 900;
}

.rank-no {
  width: 58rpx;
}

.rank-main {
  flex: 1;
}

.rank-name {
  color: #333333;
  font-size: 28rpx;
  font-weight: 900;
}

.sign-modal {
  width: 660rpx;
}

.sign-calendar {
  height: 520rpx;
  margin-top: 22rpx;
  padding-right: 4rpx;
}

.sign-day {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 132rpx;
  height: 116rpx;
  margin: 0 10rpx 12rpx 0;
  border: 2rpx solid #e3edf5;
  border-radius: 18rpx;
  background: #f7fbff;
}

.sign-day.today {
  border-color: #2ecc71;
  background: #dcf8e7;
}

.sign-day.signed {
  border-color: #f1c40f;
  background: #fff7d8;
}

.sign-date,
.sign-reward {
  display: block;
}

.sign-date {
  color: #2c3e50;
  font-size: 28rpx;
  font-weight: 900;
}

.sign-reward {
  margin-top: 8rpx;
  color: #8a98a8;
  font-size: 20rpx;
  line-height: 1.2;
}

.center-modal {
  top: 50%;
  left: 50%;
  width: 620rpx;
  padding: 36rpx 30rpx;
  border-radius: 28rpx;
  transform: translate(-50%, -50%);
  text-align: center;
}

.modal-close {
  position: absolute;
  top: 18rpx;
  right: 18rpx;
}

.lottery-modal {
  width: 670rpx;
  padding: 26rpx 28rpx 34rpx;
  border: 4rpx solid rgba(255, 255, 255, 0.4);
  border-radius: 34rpx;
  background:
    radial-gradient(circle at 18% 12%, rgba(241, 196, 15, 0.2), transparent 18%),
    radial-gradient(circle at 88% 18%, rgba(255, 255, 255, 0.22), transparent 16%),
    linear-gradient(180deg, #1aa889 0%, #117764 100%);
  box-shadow: 0 12rpx 0 rgba(13, 90, 77, 0.75), 0 26rpx 48rpx rgba(0, 0, 0, 0.28);
  color: #fff;
  overflow: visible;
}

.lottery-close {
  top: 14rpx;
  right: 14rpx;
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
}

.lottery-title-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  margin-top: -6rpx;
}

.lottery-title,
.lottery-title-deco {
  color: #fff7ba;
  font-size: 54rpx;
  font-weight: 1000;
  line-height: 1;
  text-shadow: 0 5rpx 0 rgba(18, 105, 87, 0.8), 0 0 18rpx rgba(255, 255, 255, 0.35);
}

.lottery-title-deco {
  color: #87f5c8;
  font-size: 38rpx;
}

.wheel-wrap {
  position: relative;
  width: 560rpx;
  height: 560rpx;
  margin: 24rpx auto 26rpx;
  border-radius: 50%;
  background: rgba(255, 247, 186, 0.16);
  box-shadow: inset 0 0 0 8rpx rgba(255, 255, 255, 0.14), 0 0 36rpx rgba(241, 196, 15, 0.35);
}

.wheel-wrap::before,
.wheel-wrap::after {
  content: "";
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}

.wheel-wrap::before {
  inset: 26rpx;
  z-index: 1;
  border: 8rpx solid #f8df6f;
  box-shadow: inset 0 0 0 8rpx rgba(35, 152, 126, 0.6);
}

.wheel-wrap::after {
  inset: 48rpx;
  z-index: 3;
  border: 6rpx dotted rgba(255, 255, 210, 0.95);
}

.wheel-pointer {
  position: absolute;
  z-index: 7;
  top: -4rpx;
  left: 50%;
  width: 70rpx;
  height: 82rpx;
  border: 6rpx solid #f3d75b;
  border-radius: 18rpx;
  background: linear-gradient(180deg, #77e9a2 0%, #24b66d 100%);
  box-shadow: 0 6rpx 0 rgba(18, 105, 87, 0.8);
  transform: translateX(-50%) rotate(45deg);
}

.wheel-pointer::after {
  content: "";
  position: absolute;
  right: 16rpx;
  bottom: -24rpx;
  width: 0;
  height: 0;
  border-left: 16rpx solid transparent;
  border-right: 16rpx solid transparent;
  border-top: 30rpx solid #f1c40f;
  transform: rotate(-45deg);
}

.wheel {
  position: absolute;
  inset: 42rpx;
  border: 10rpx solid #f6dd77;
  border-radius: 50%;
  background: conic-gradient(
    #56c8e8 0deg 60deg,
    #2ecc71 60deg 120deg,
    #56c8e8 120deg 180deg,
    #2ecc71 180deg 240deg,
    #56c8e8 240deg 300deg,
    #2ecc71 300deg 360deg
  );
  transition: transform 0.9s cubic-bezier(0.18, 0.9, 0.16, 1);
  overflow: hidden;
}

.wheel-sector {
  position: absolute;
  z-index: 2;
  width: 150rpx;
  height: 112rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.wheel-sector.blue,
.wheel-sector.green {
  background: transparent;
}

.wheel-sector:nth-child(1) {
  top: 42rpx;
  left: 50%;
  transform: translateX(-50%);
}

.wheel-sector:nth-child(2) {
  top: 118rpx;
  right: 34rpx;
  transform: rotate(26deg);
}

.wheel-sector:nth-child(3) {
  right: 34rpx;
  bottom: 114rpx;
  transform: rotate(-26deg);
}

.wheel-sector:nth-child(4) {
  bottom: 42rpx;
  left: 50%;
  transform: translateX(-50%);
}

.wheel-sector:nth-child(5) {
  bottom: 114rpx;
  left: 34rpx;
  transform: rotate(26deg);
}

.wheel-sector:nth-child(6) {
  top: 118rpx;
  left: 34rpx;
  transform: rotate(-26deg);
}

.reward-value,
.reward-icon {
  display: block;
  color: #6b3b18;
  font-weight: 1000;
  text-align: center;
  text-shadow: 0 2rpx 0 rgba(255, 255, 255, 0.38);
}

.reward-value {
  max-width: 136rpx;
  font-size: 24rpx;
  line-height: 1.15;
}

.reward-icon {
  margin-top: 6rpx;
  font-size: 48rpx;
  line-height: 1;
}

.wheel-sector.blue .reward-value,
.wheel-sector.blue .reward-icon {
  color: #fff;
  text-shadow: 0 3rpx 0 rgba(30, 102, 126, 0.45);
}

.wheel-center {
  position: absolute;
  z-index: 8;
  top: 50%;
  left: 50%;
  width: 134rpx;
  height: 134rpx;
  padding: 0;
  border: 8rpx solid #f7d85d;
  border-radius: 50%;
  background: linear-gradient(180deg, #35d989 0%, #179b6f 100%);
  box-shadow: 0 8rpx 0 #0b6e56, inset 0 8rpx 12rpx rgba(255, 255, 255, 0.24);
  color: #fff7ba;
  font-size: 34rpx;
  font-weight: 1000;
  line-height: 118rpx;
  transform: translate(-50%, -50%);
}

.wheel-center:active,
.lottery-main-btn:active {
  transform: translate(-50%, -48%) scale(0.96);
}

.lottery-main-btn {
  width: 440rpx;
  height: 88rpx;
  margin: -2rpx auto 0;
  border: 4rpx solid rgba(255, 255, 255, 0.58);
  border-radius: 999rpx;
  background: linear-gradient(180deg, #8df278 0%, #2ecc71 68%, #22a95b 100%);
  box-shadow: 0 8rpx 0 #118a53, 0 12rpx 24rpx rgba(0, 0, 0, 0.2);
  color: #fff;
  font-size: 34rpx;
  font-weight: 1000;
  line-height: 80rpx;
  text-shadow: 0 3rpx 0 rgba(17, 120, 76, 0.55);
}

.lottery-main-btn:active {
  transform: scale(0.97);
}

.wheel-center[disabled],
.lottery-main-btn[disabled] {
  opacity: 0.82;
}

.lottery-note {
  display: block;
  margin-top: 18rpx;
  color: rgba(255, 255, 255, 0.92);
  font-size: 24rpx;
  font-weight: 800;
}

.modal-note {
  margin: 16rpx auto 0;
  max-width: 500rpx;
  line-height: 1.5;
}

.modal-action {
  width: 100%;
  margin-top: 18rpx;
}

.settings-modal {
  text-align: left;
}

.setting-row {
  min-height: 78rpx;
  margin-top: 16rpx;
  padding: 0 18rpx;
  border-radius: 18rpx;
  background: #f7fbff;
  color: #2c3e50;
  font-size: 28rpx;
  font-weight: 900;
}
</style>
