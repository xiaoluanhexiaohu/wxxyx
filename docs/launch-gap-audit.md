# 上线差距自检

## 当前程序闭环状态

已完成：
- 微信、抖音小程序端构建已通过。
- 登录页、主页、游戏页、好友对战流程完整。
- 本地保存用户、体力、金币、显真透视镜、进度、当前关卡、提交记录。
- 每关三次机会，每次提交后显示数字正确数和位置正确数。
- 激励视频广告管理器已预留，完整观看后才发放奖励。
- uniCloud 云函数示例已提供登录、进度同步、广告奖励校验、排行榜入口。
- 首页已提供小马主题 UI、模式入口、每日抽奖、签到、排行榜底部弹层和设置弹层。

未达到正式上线标准：
- `src/manifest.json` 仍是占位 AppID。
- `src/utils/adManager.ts` 仍是占位广告位 ID。
- 云函数需要配置 `WEIXIN_APPID`、`WEIXIN_SECRET` 环境变量；否则开发环境会退回本地 mock openId。
- 广告校验仍是示例逻辑，正式版应接平台服务端回调或交易校验。
- 没有正式隐私政策、用户协议、儿童/未成年人保护说明。
- 没有真实 ICP 备案域名、HTTPS 证书、request 合法域名配置。
- 没有真实风控：金币、体力、通关结果仍可被前端篡改，正式版必须以后端为准。
- 好友榜需要接入微信开放数据域或后端好友关系，当前接口已预留 `friendOpenIds`。
- 还没有埋点、崩溃日志、召回机制。

结论：当前是“可调试原型 + 可构建小程序包”，还不是“可直接提交审核上线”的生产版本。

## 对比热门小游戏

热门小游戏通常具备：
- 首局 5 秒内进入核心玩法，少输入、少解释。
- 强反馈：过关动画、音效、连胜奖励、失败后快速再来。
- 留存闭环：每日任务、签到、排行榜、分享复活、限时活动。
- 商业闭环：体力耗尽、失败复活、道具不足、结算翻倍等广告点。
- 数据闭环：服务端保存资产，客户端只展示，不决定最终金币和体力。
- 审核闭环：隐私协议、广告合规、备案域名、类目资质、软著材料齐全。

当前程序的核心玩法闭环基本成立，但商业化、留存、服务端风控、审核材料还不够。

## 备案和域名步骤

1. 准备主体资料：个人或企业身份证明、手机号、负责人信息。
2. 购买域名，例如 `yourgame.com`。
3. 购买国内服务器或云函数服务；如果使用国内可访问 HTTPS API，域名通常需要 ICP 备案。
4. 在云服务商完成 ICP 备案，等待管局审核。
5. 给域名配置 HTTPS 证书。
6. 部署后端接口，例如：
   - `https://api.yourgame.com/auth/miniprogram-login`
   - `https://api.yourgame.com/player/sync`
   - `https://api.yourgame.com/ads/reward/verify`
7. 微信公众平台后台配置服务器域名：request、uploadFile、downloadFile、socket。
8. 抖音开放平台后台配置服务器域名。
9. 在小程序后台填写隐私协议、服务类目、版本说明后提交审核。

## 怎么试玩

微信：
1. 运行 `npm.cmd run build:mp-weixin`。
2. 打开微信开发者工具。
3. 选择“导入项目”。
4. 项目目录选择 `dist/build/mp-weixin`。
5. AppID 使用你自己的微信小程序 AppID。
6. 编译后进入登录页，输入昵称并点击“微信一键绑定 / 登录”。

抖音：
1. 运行 `npm.cmd run build:mp-toutiao`。
2. 打开抖音小程序开发者工具。
3. 导入 `dist/build/mp-toutiao`。
4. 编译后进入登录页，输入昵称并点击登录。

## 官方文档入口

- 微信网络/服务器域名：[网络 | 微信开放文档](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html)
- 微信激励视频广告：[RewardedVideoAd | 微信开放文档](https://developers.weixin.qq.com/minigame/dev/api/ad/wx.createRewardedVideoAd.html)
- 抖音服务器域名管理：[抖音开放平台文档](https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/server/domain-name-management)
- 抖音激励视频广告：[tt.createRewardedVideoAd | 抖音开放平台文档](https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/api/ads/rewarded-video-ad/tt-create-rewarded-video-ad)
- 抖音发布流程：[抖音开放平台发布流程](https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/operation/release/release-process)
