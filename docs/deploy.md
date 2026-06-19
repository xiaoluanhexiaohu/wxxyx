# 微信/抖音上线接入清单

## 1. 基础配置

1. 在 `manifest.json` 填入微信小程序 AppID 和抖音小程序 AppID。
2. 在平台后台配置 request 合法域名。
3. 在 `src/utils/adManager.ts` 替换激励视频广告位 ID。
4. 上传 `cloudfunctions/logic-number`，或把 `services/api.ts` 改成你的 Node.js 后端域名。
5. 云函数环境变量配置 `WEIXIN_APPID` 和 `WEIXIN_SECRET`，用于微信登录 code 换取稳定 openId。

## 2. 数据闭环

- 本地：`stores/useGameStore.ts` 已保存用户、钱包、进度、当前关卡。
- 云端：`services/api.ts` 会在登录和通关后同步数据。
- 后端：云函数示例包含 `login`、`sync`、`verifyReward`、`leaderboard` 四个动作。
- 排行榜：玩家通关后同步 `rankScores`，总榜按简单、困难、极速竞赛三个模式分别取前 50；好友榜接口已预留 `friendOpenIds` 参数。

## 3. 广告闭环

- 体力不足：看广告恢复体力。
- 主页：看广告补体力或拿金币。
- 游戏中：金币不足时看广告使用一次显真透视镜。
- 奖励发放必须依赖完整观看和服务端校验，当前代码已经预留校验入口。

## 4. 审核前检查

- 小程序名称、软著、备案主体保持一致。
- 隐私协议说明登录、存储、广告奖励、排行榜数据用途。
- 不要在前端写平台密钥。
- 广告奖励数值以服务端结果为准，避免被改包刷金币或体力。
