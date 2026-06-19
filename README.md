# 逻辑推理数字小程序

这是一个 uni-app 小程序工程，当前面向微信小程序和抖音小程序构建。主流程为：微信/平台一键绑定登录 -> 小马主题主页 -> 选择模式 -> 填数字推理。

## 当前实现

- 首页：小马动态形象、动态背景、体力、金币、显真透视镜、设置入口。
- 模式：简单模式、困难模式、每日挑战、极速竞赛、好友对战。
- 排行榜：主页点击后先显示简单模式、困难模式、极速竞赛三个入口，再从底部弹出排行榜；上线后可由云函数返回真实榜单。
- 每日抽奖：转盘抽奖，可获得金币、体力、显真透视镜次数。
- 显真透视镜：放大镜样式，右上角红点显示数量；可金币购买，游戏页可直接使用或看广告使用一次。
- 玩法：数字可以重复，简单 4 位 4 条提示，困难 5 位 5 条提示；提示合并后可推出唯一答案。
- 进度：本地保存用户资料、钱包、显真透视镜、模式关卡、当前关卡、提交记录。
- 每日挑战和极速竞赛每天各 2 次，跨本地 0 点刷新。
- 好友对战：支持分享同一局种子，闯关对战三关胜，竞速对战一关比用时。
- 云函数：`cloudfunctions/logic-number` 提供登录、进度同步、广告奖励校验、排行榜入口。

## 目录结构

```text
src/App.vue
src/main.ts
src/manifest.json
src/pages.json
src/stores/useGameStore.ts
src/utils/numberPuzzle.ts
src/utils/adManager.ts
src/utils/rankings.ts
src/services/api.ts
src/services/storage.ts
src/pages/login/login.vue
src/pages/home/home.vue
src/pages/play/play.vue
src/pages/battle/battle.vue
cloudfunctions/logic-number/
```

## 构建

```bash
npm run build:mp-weixin
npm run build:mp-toutiao
```

微信开发者工具导入：

```text
dist/build/mp-weixin
```

抖音开发者工具导入：

```text
dist/build/mp-toutiao
```

## 上线前必须替换

- `src/manifest.json` 里的微信/抖音 AppID。
- `src/utils/adManager.ts` 里的三个激励视频广告位 ID。
- 云函数环境变量 `WEIXIN_APPID`、`WEIXIN_SECRET`。
- 正式隐私协议、用户协议、广告校验、后端风控、好友榜关系数据。

更完整的审核、备案、域名和试玩说明见 `docs/launch-gap-audit.md`。
