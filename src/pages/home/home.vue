<template>
  <view class="page">
    <view class="sky-dot dot-a"></view>
    <view class="sky-dot dot-b"></view>

    <view v-if="loadError" class="error-panel">
      <text class="mode-title">主页加载失败</text>
      <text class="mode-desc">{{ loadError }}</text>
      <button class="small-button" @tap="goLogin()">回到登录页</button>
    </view>

    <view v-else-if="!ready" class="error-panel">
      <text class="mode-title">加载中</text>
      <text class="mode-desc">正在读取本地账号和游戏进度</text>
    </view>

    <block v-else>
      <view class="topbar">
        <view class="profile">
          <text class="profile-name">{{ displayName }}</text>
          <text class="profile-sub">欢迎回来</text>
        </view>
        <button class="settings-button" @tap="showSettings = true">⚙</button>
      </view>

      <view class="resource-bar">
        <view class="resource-item stamina">
          <view class="resource-icon bolt"></view>
          <text class="resource-value">{{ staminaText }}</text>
        </view>
        <view class="resource-item coin">
          <view class="resource-icon coin-dot"></view>
          <text class="resource-value">{{ goldText }}</text>
        </view>
        <button class="resource-item reveal" @tap="showRevealPanel = true">
          <view class="magnifier">
            <view class="lens"></view>
            <view class="handle"></view>
          </view>
          <text class="resource-value">透视镜</text>
          <text v-if="game.wallet.revealTools > 0" class="badge">{{ game.wallet.revealTools }}</text>
        </button>
      </view>

      <view class="hero">
        <view class="hero-copy">
          <text class="hero-kicker">数字推理挑战</text>
          <text class="hero-title">敢不敢来比一局</text>
          <text class="hero-sub">{{ staminaRecoverText }}</text>
        </view>
        <view class="pony-wrap">
          <view class="pony">
            <view class="pony-ear left"></view>
            <view class="pony-ear right"></view>
            <view class="pony-head">
              <view class="mane"></view>
              <view class="eye left"></view>
              <view class="eye right"></view>
              <view class="brow left"></view>
              <view class="brow right"></view>
              <view class="nose"></view>
              <view class="mouth"></view>
            </view>
            <view class="pony-body"></view>
          </view>
        </view>
      </view>

      <view class="quick-actions">
        <button class="quick-button" @tap="openRankMenu()">排行榜</button>
        <button class="quick-button" @tap="showLottery = true">每日抽奖</button>
        <button class="quick-button" @tap="claimSignIn()">签到</button>
        <button class="quick-button" @tap="openBattle()">好友对战</button>
      </view>

      <view v-if="showRankMenu" class="rank-menu">
        <button v-for="item in rankModes" :key="item.key" class="rank-chip" @tap="openRankSheet(item.key)">
          {{ item.label }}
        </button>
      </view>

      <view class="mode-grid">
        <button class="level-card simple-card" @tap="startGame('simple', 'easy')">
          <text class="level-label">简单模式</text>
          <text class="level-number">简单第 {{ simpleLevel }} 关</text>
        </button>
        <button class="level-card hard-card" @tap="startGame('hard', 'hard')">
          <text class="level-label">困难模式</text>
          <text class="level-number">困难第 {{ hardLevel }} 关</text>
        </button>
      </view>

      <button class="wide-mode daily-card" @tap="startGame('daily', 'easy')">
        <view>
          <text class="wide-title">开始每日挑战</text>
          <text class="wide-sub">今日剩余 {{ game.dailyAttemptsLeft }}/2 次，午夜刷新</text>
        </view>
        <text class="wide-arrow">开始</text>
      </button>

      <button class="wide-mode speed-card" @tap="startGame('speedrun', 'easy')">
        <view>
          <text class="wide-title">极速竞赛</text>
          <text class="wide-sub">当前第 {{ game.progress.modeLevels.speedrun }} 关，最佳 {{ speedText }}</text>
        </view>
        <text class="wide-arrow">冲刺</text>
      </button>

      <view class="ad-row">
        <button class="small-button" @tap="watchStaminaAd()">看广告补体力</button>
        <button class="small-button" @tap="watchGoldAd()">看广告拿金币</button>
      </view>
    </block>

    <view v-if="showRankSheet" class="mask" @tap="closeRankSheet()"></view>
    <view v-if="showRankSheet" class="bottom-sheet">
      <view class="sheet-handle"></view>
      <view class="sheet-head">
        <view>
          <text class="sheet-title">{{ rankTitle }}</text>
          <text class="sheet-sub">上线后由服务器返回真实榜单</text>
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
            <text class="rank-sub">第 {{ entry.level }} 关</text>
          </view>
          <text class="rank-score">{{ entry.score }}</text>
        </view>
      </scroll-view>
    </view>

    <view v-if="showLottery" class="mask" @tap="showLottery = false"></view>
    <view v-if="showLottery" class="center-modal">
      <button class="modal-close" @tap="showLottery = false">×</button>
      <text class="modal-title">每日免费抽奖</text>
      <view class="wheel-wrap">
        <view class="pointer"></view>
        <view class="wheel" :style="{ transform: `rotate(${wheelDeg}deg)` }">
          <text class="wheel-prize p1">金币</text>
          <text class="wheel-prize p2">体力</text>
          <text class="wheel-prize p3">透视镜</text>
          <text class="wheel-prize p4">大奖</text>
        </view>
      </view>
      <text class="modal-note">{{ lotteryMessage || "每天一次，可能获得金币、体力或显真透视镜。" }}</text>
      <button class="primary-action" :loading="lotteryBusy" @tap="spinLottery()">免费抽奖</button>
    </view>

    <view v-if="showRevealPanel" class="mask" @tap="showRevealPanel = false"></view>
    <view v-if="showRevealPanel" class="center-modal compact">
      <button class="modal-close" @tap="showRevealPanel = false">×</button>
      <view class="big-magnifier">
        <view class="big-lens"></view>
        <view class="big-handle"></view>
      </view>
      <text class="modal-title">显真透视镜</text>
      <text class="modal-note">当前拥有 {{ game.wallet.revealTools }} 个。进入关卡后可随机显示一个正确数字。</text>
      <button class="primary-action" @tap="buyRevealTool()">金币购买 {{ revealCost }}</button>
      <button class="ghost-action" @tap="goUseReveal()">去关卡使用</button>
    </view>

    <view v-if="showSettings" class="mask" @tap="showSettings = false"></view>
    <view v-if="showSettings" class="center-modal compact">
      <button class="modal-close" @tap="showSettings = false">×</button>
      <text class="modal-title">设置</text>
      <view class="setting-row">
        <text>音效</text>
        <switch :checked="settings.sound" color="#29a8ff" @change="settings.sound = !settings.sound" />
      </view>
      <view class="setting-row">
        <text>背景音乐</text>
        <switch :checked="settings.music" color="#29a8ff" @change="settings.music = !settings.music" />
      </view>
      <view class="setting-row">
        <text>消息提醒</text>
        <switch :checked="settings.notice" color="#29a8ff" @change="settings.notice = !settings.notice" />
      </view>
      <button class="ghost-action" @tap="showToast('客服入口上线时接入')">联系客服</button>
      <button class="ghost-action" @tap="showToast('隐私协议上线前补充')">隐私协议</button>
      <button class="danger-action" @tap="logout()">退出登录</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { useGameStore, MAX_STAMINA, REVEAL_TOOL_COST, STAMINA_RECOVER_AMOUNT, STAMINA_RECOVER_MS } from "@/stores/useGameStore";
import type { DifficultyKey, GameMode } from "@/types/game";
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

const displayName = computed(() => game.profile ? game.profile.nickname : "数字玩家");
const simpleLevel = computed(() => String(game.progress.modeLevels.simple));
const hardLevel = computed(() => String(game.progress.modeLevels.hard));
const speedText = computed(() => {
  if (!game.progress.bestSpeedMs) return "暂无";
  return `${(game.progress.bestSpeedMs / 1000).toFixed(2)}秒`;
});
const staminaText = computed(() => game.wallet.stamina > MAX_STAMINA ? String(game.wallet.stamina) : `${game.wallet.stamina}/${MAX_STAMINA}`);
const goldText = computed(() => String(game.wallet.gold));
const revealCost = computed(() => String(REVEAL_TOOL_COST));
const rankTitle = computed(() => rankModes.find((item) => item.key === rankMode.value)?.label || "排行榜");
const currentRankList = computed(() => rankList.value.length ? rankList.value : createLeaderboard(game.profile, game.progress, rankScope.value, rankMode.value));
const staminaRecoverText = computed(() => {
  const minutes = STAMINA_RECOVER_MS / 60000;
  if (game.wallet.stamina >= MAX_STAMINA) {
    return `体力已满，每 ${minutes} 分钟恢复 ${STAMINA_RECOVER_AMOUNT} 点`;
  }

  const nextAt = game.wallet.lastStaminaAt + STAMINA_RECOVER_MS;
  const seconds = Math.max(0, Math.ceil((nextAt - nowTick.value) / 1000));
  return `每 ${minutes} 分钟恢复 ${STAMINA_RECOVER_AMOUNT} 点，${formatDuration(seconds)} 后恢复`;
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

function openBattle() {
  uni.navigateTo({ url: "/pages/battle/battle" });
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function claimSignIn() {
  const result = game.claimDailySignIn();
  uni.showToast({ title: result.message, icon: "none" });
}

function spinLottery() {
  if (lotteryBusy.value) return;
  const result = game.drawDailyLottery();
  if (!result.ok) {
    uni.showToast({ title: result.message, icon: "none" });
    lotteryMessage.value = result.message;
    return;
  }

  lotteryBusy.value = true;
  lotteryMessage.value = "转盘转动中...";
  wheelDeg.value += 1260 + Math.floor(Math.random() * 360);
  setTimeout(() => {
    lotteryBusy.value = false;
    lotteryMessage.value = result.message;
    uni.showToast({ title: result.message, icon: "none" });
  }, 900);
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
.page {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  padding: 58rpx 26rpx 36rpx;
  background: linear-gradient(180deg, #74c9ff 0%, #bfeefe 48%, #f7fbf2 100%);
  color: #1a2430;
}

.sky-dot {
  position: absolute;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.55);
  animation: floatCloud 7s ease-in-out infinite;
}

.dot-a {
  top: 130rpx;
  left: 36rpx;
  width: 160rpx;
  height: 64rpx;
}

.dot-b {
  top: 250rpx;
  right: 26rpx;
  width: 118rpx;
  height: 48rpx;
  animation-delay: 1.6s;
}

.error-panel,
.hero,
.rank-menu,
.wide-mode,
.bottom-sheet,
.center-modal {
  position: relative;
  z-index: 1;
}

.error-panel {
  margin-top: 180rpx;
  padding: 30rpx;
  border: 2rpx solid rgba(20, 60, 90, 0.12);
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.86);
}

.topbar,
.resource-bar,
.quick-actions,
.mode-grid,
.ad-row,
.sheet-head,
.tabs,
.rank-row,
.setting-row {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.profile-name,
.profile-sub,
.mode-title,
.mode-desc,
.wide-title,
.wide-sub,
.modal-title,
.modal-note,
.sheet-title,
.sheet-sub {
  display: block;
}

.profile-name {
  color: #10324a;
  font-size: 34rpx;
  font-weight: 900;
}

.profile-sub,
.hero-sub,
.wide-sub,
.sheet-sub,
.rank-sub,
.modal-note {
  color: #567083;
  font-size: 23rpx;
}

.settings-button {
  width: 72rpx;
  height: 72rpx;
  border: 3rpx solid rgba(16, 50, 74, 0.18);
  border-radius: 50%;
  background: #ffffff;
  color: #19435e;
  font-size: 34rpx;
  font-weight: 900;
}

.resource-bar {
  margin-top: 22rpx;
}

.resource-item {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  min-height: 70rpx;
  padding: 0 16rpx;
  border: 3rpx solid rgba(16, 50, 74, 0.12);
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.92);
}

.resource-value {
  color: #143a54;
  font-size: 25rpx;
  font-weight: 900;
}

.resource-icon {
  width: 34rpx;
  height: 34rpx;
}

.bolt {
  border-radius: 10rpx;
  background: #ff5e7d;
  transform: skew(-14deg);
}

.coin-dot {
  border-radius: 50%;
  background: #ffc44d;
  box-shadow: inset 0 0 0 7rpx #f5951b;
}

.reveal {
  padding: 0 10rpx;
}

.magnifier {
  position: relative;
  width: 42rpx;
  height: 42rpx;
}

.lens {
  position: absolute;
  top: 2rpx;
  left: 2rpx;
  width: 26rpx;
  height: 26rpx;
  border: 5rpx solid #29a8ff;
  border-radius: 50%;
  background: rgba(41, 168, 255, 0.08);
}

.handle {
  position: absolute;
  right: 5rpx;
  bottom: 5rpx;
  width: 18rpx;
  height: 6rpx;
  border-radius: 999rpx;
  background: #29a8ff;
  transform: rotate(45deg);
}

.badge {
  position: absolute;
  top: -8rpx;
  right: -2rpx;
  min-width: 30rpx;
  height: 30rpx;
  padding: 0 8rpx;
  border: 3rpx solid #fff;
  border-radius: 999rpx;
  background: #ff315d;
  color: #fff;
  font-size: 20rpx;
  font-weight: 900;
  line-height: 30rpx;
}

.hero {
  display: flex;
  min-height: 260rpx;
  margin-top: 22rpx;
  padding: 28rpx;
  border-radius: 34rpx;
  background: rgba(255, 255, 255, 0.58);
  box-shadow: 0 18rpx 36rpx rgba(43, 130, 180, 0.16);
}

.hero-copy {
  flex: 1;
  padding-top: 10rpx;
}

.hero-kicker {
  color: #2b78b0;
  font-size: 24rpx;
  font-weight: 900;
}

.hero-title {
  display: block;
  margin-top: 12rpx;
  color: #102f45;
  font-size: 48rpx;
  font-weight: 900;
  line-height: 1.05;
}

.hero-sub {
  display: block;
  margin-top: 16rpx;
  line-height: 1.45;
}

.pony-wrap {
  position: relative;
  width: 220rpx;
}

.pony {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 200rpx;
  height: 220rpx;
  animation: ponyBounce 1.8s ease-in-out infinite;
}

.pony-head {
  position: absolute;
  right: 18rpx;
  top: 20rpx;
  width: 142rpx;
  height: 136rpx;
  border: 5rpx solid #704822;
  border-radius: 56% 48% 52% 50%;
  background: #f3a657;
}

.pony-ear {
  position: absolute;
  top: 10rpx;
  width: 44rpx;
  height: 58rpx;
  border: 5rpx solid #704822;
  border-radius: 40rpx 40rpx 12rpx 12rpx;
  background: #f3a657;
}

.pony-ear.left {
  right: 122rpx;
  transform: rotate(-22deg);
}

.pony-ear.right {
  right: 36rpx;
  transform: rotate(24deg);
}

.mane {
  position: absolute;
  top: -12rpx;
  left: 42rpx;
  width: 44rpx;
  height: 96rpx;
  border-radius: 999rpx;
  background: #7a3f2d;
  transform: rotate(15deg);
}

.eye {
  position: absolute;
  top: 54rpx;
  width: 18rpx;
  height: 18rpx;
  border-radius: 50%;
  background: #20140f;
}

.eye.left {
  left: 42rpx;
}

.eye.right {
  right: 30rpx;
}

.brow {
  position: absolute;
  top: 42rpx;
  width: 34rpx;
  height: 7rpx;
  border-radius: 999rpx;
  background: #20140f;
}

.brow.left {
  left: 30rpx;
  transform: rotate(18deg);
}

.brow.right {
  right: 20rpx;
  transform: rotate(-18deg);
}

.nose {
  position: absolute;
  right: 26rpx;
  bottom: 30rpx;
  width: 58rpx;
  height: 34rpx;
  border-radius: 999rpx;
  background: #f7c187;
}

.mouth {
  position: absolute;
  right: 42rpx;
  bottom: 22rpx;
  width: 32rpx;
  height: 8rpx;
  border-radius: 999rpx;
  background: #20140f;
}

.pony-body {
  position: absolute;
  right: 28rpx;
  bottom: 0;
  width: 138rpx;
  height: 82rpx;
  border: 5rpx solid #704822;
  border-radius: 52rpx;
  background: #dc8741;
}

.quick-actions,
.ad-row {
  margin-top: 18rpx;
}

.quick-button,
.small-button {
  flex: 1;
  min-height: 78rpx;
  border: 0;
  border-radius: 22rpx;
  background: #ffffff;
  color: #153c58;
  font-size: 25rpx;
  font-weight: 900;
  box-shadow: 0 8rpx 16rpx rgba(43, 130, 180, 0.12);
}

.rank-menu {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  margin-top: 14rpx;
}

.rank-chip {
  height: 72rpx;
  border: 3rpx solid rgba(16, 50, 74, 0.1);
  border-radius: 20rpx;
  background: #fff;
  color: #1b5578;
  font-size: 24rpx;
  font-weight: 900;
}

.mode-grid {
  margin-top: 22rpx;
}

.level-card {
  flex: 1;
  min-height: 168rpx;
  padding: 26rpx;
  border: 0;
  border-radius: 30rpx;
  color: #fff;
  text-align: left;
  box-shadow: 0 12rpx 22rpx rgba(48, 72, 100, 0.18);
}

.simple-card {
  background: linear-gradient(135deg, #169cff, #4fd0ff);
}

.hard-card {
  background: linear-gradient(135deg, #ff4a57, #ff8b5a);
}

.level-label,
.level-number {
  display: block;
  color: #fff;
  font-weight: 900;
}

.level-label {
  font-size: 30rpx;
}

.level-number {
  margin-top: 18rpx;
  font-size: 42rpx;
}

.wide-mode {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 126rpx;
  margin-top: 18rpx;
  padding: 22rpx 26rpx;
  border: 0;
  border-radius: 30rpx;
  text-align: left;
  box-shadow: 0 12rpx 22rpx rgba(48, 72, 100, 0.15);
}

.daily-card {
  background: #fff6d6;
}

.speed-card {
  background: #e8f1ff;
}

.wide-title {
  color: #153c58;
  font-size: 32rpx;
  font-weight: 900;
}

.wide-sub {
  margin-top: 10rpx;
}

.wide-arrow {
  flex-shrink: 0;
  min-width: 92rpx;
  height: 58rpx;
  border-radius: 999rpx;
  background: #143a54;
  color: #fff;
  font-size: 24rpx;
  font-weight: 900;
  line-height: 58rpx;
  text-align: center;
}

.mask {
  position: fixed;
  z-index: 9;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(15, 31, 44, 0.45);
}

.bottom-sheet {
  position: fixed;
  z-index: 10;
  right: 0;
  bottom: 0;
  left: 0;
  max-height: 78vh;
  padding: 14rpx 28rpx 34rpx;
  border-radius: 36rpx 36rpx 0 0;
  background: #f7fbff;
}

.sheet-handle {
  width: 76rpx;
  height: 8rpx;
  margin: 0 auto 20rpx;
  border-radius: 999rpx;
  background: #c3d4df;
}

.sheet-title,
.modal-title {
  color: #153c58;
  font-size: 34rpx;
  font-weight: 900;
}

.close-button,
.modal-close {
  width: 62rpx;
  height: 62rpx;
  border: 0;
  border-radius: 50%;
  background: #e6f0f7;
  color: #153c58;
  font-size: 34rpx;
  font-weight: 900;
}

.tabs {
  margin-top: 20rpx;
  padding: 8rpx;
  border-radius: 22rpx;
  background: #e6f0f7;
}

.tab {
  flex: 1;
  height: 64rpx;
  border: 0;
  border-radius: 18rpx;
  background: transparent;
  color: #567083;
  font-size: 26rpx;
  font-weight: 900;
}

.tab.active {
  background: #29a8ff;
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
  background: #fff;
}

.rank-row.me {
  background: #e4f7ff;
}

.rank-no,
.rank-score {
  color: #ff7a3c;
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
  display: block;
  color: #153c58;
  font-size: 28rpx;
  font-weight: 900;
}

.center-modal {
  position: fixed;
  z-index: 10;
  top: 50%;
  left: 50%;
  width: 620rpx;
  padding: 34rpx 30rpx;
  border-radius: 32rpx;
  background: #fff;
  transform: translate(-50%, -50%);
  text-align: center;
}

.center-modal.compact {
  width: 570rpx;
}

.modal-close {
  position: absolute;
  top: 18rpx;
  right: 18rpx;
}

.wheel-wrap {
  position: relative;
  width: 390rpx;
  height: 390rpx;
  margin: 30rpx auto 18rpx;
}

.wheel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  border: 16rpx solid #ffcf5d;
  border-radius: 50%;
  background: linear-gradient(135deg, #29a8ff 0%, #29a8ff 49%, #ffd66d 50%, #ffd66d 100%);
  transition: transform 0.85s cubic-bezier(0.2, 0.82, 0.18, 1);
}

.pointer {
  position: absolute;
  z-index: 1;
  top: -10rpx;
  left: 50%;
  width: 0;
  height: 0;
  border-left: 22rpx solid transparent;
  border-right: 22rpx solid transparent;
  border-top: 42rpx solid #153c58;
  transform: translateX(-50%);
}

.wheel-prize {
  position: absolute;
  color: #fff;
  font-size: 26rpx;
  font-weight: 900;
}

.p1 {
  top: 76rpx;
  left: 168rpx;
}

.p2 {
  top: 170rpx;
  right: 42rpx;
}

.p3 {
  bottom: 76rpx;
  left: 148rpx;
}

.p4 {
  top: 170rpx;
  left: 44rpx;
}

.modal-note {
  margin: 16rpx auto 0;
  max-width: 470rpx;
  line-height: 1.5;
}

.primary-action,
.ghost-action,
.danger-action {
  width: 100%;
  height: 78rpx;
  margin-top: 18rpx;
  border-radius: 22rpx;
  font-size: 27rpx;
  font-weight: 900;
}

.primary-action {
  border: 0;
  background: #29a8ff;
  color: #fff;
}

.ghost-action {
  border: 2rpx solid #d8e8f2;
  background: #f6fbff;
  color: #153c58;
}

.danger-action {
  border: 0;
  background: #ff4a57;
  color: #fff;
}

.big-magnifier {
  position: relative;
  width: 96rpx;
  height: 96rpx;
  margin: 10rpx auto 18rpx;
}

.big-lens {
  position: absolute;
  top: 0;
  left: 0;
  width: 62rpx;
  height: 62rpx;
  border: 10rpx solid #29a8ff;
  border-radius: 50%;
}

.big-handle {
  position: absolute;
  right: 6rpx;
  bottom: 12rpx;
  width: 44rpx;
  height: 12rpx;
  border-radius: 999rpx;
  background: #29a8ff;
  transform: rotate(45deg);
}

.setting-row {
  min-height: 74rpx;
  margin-top: 16rpx;
  padding: 0 18rpx;
  border-radius: 18rpx;
  background: #f6fbff;
  color: #153c58;
  font-size: 28rpx;
  font-weight: 900;
}

@keyframes ponyBounce {
  0%, 100% {
    transform: translateY(0) rotate(-1deg);
  }
  50% {
    transform: translateY(-12rpx) rotate(2deg);
  }
}

@keyframes floatCloud {
  0%, 100% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(26rpx);
  }
}
</style>
