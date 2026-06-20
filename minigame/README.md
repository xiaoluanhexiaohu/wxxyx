# 逻辑大师原生微信小游戏

本目录是独立的微信小游戏工程。它不依赖 uni-app、Vue、WXML、WXSS 或 DOM，不要再导入 `dist/build/mp-weixin`。

## 导入微信开发者工具

1. 在导入窗口左侧选择“小游戏”。
2. 项目目录选择本 `minigame` 目录，不要选择仓库根目录或 `dist`。
3. 调试阶段可以使用测试号；准备上传时，将 `project.config.json` 中的 `appid` 换成已注册的微信小游戏 AppID。
4. 小程序 AppID 与小游戏 AppID 是不同的主体类型，原小程序 AppID 不能直接当作小游戏 AppID 上传。

## 上线前配置

编辑 `js/config.js`：

- `cloudEnvId`：微信云开发环境 ID。
- `rewardedAds`：五个激励视频广告位 ID。
- 如使用自建 HTTP 后端，填写 `apiBaseUrl`。

微信云开发需要创建以下数据库集合：

- `players`
- `ad_transactions`
- `invite_relations`

然后在微信开发者工具中右键 `cloudfunctions/logic-number`，选择“上传并部署：云端安装依赖”。

未填写云环境或广告位时，工程自动使用本地存储和调试奖励，便于完整试玩；正式上线前必须填写真实配置。

## 目录说明

```text
minigame/
├── game.js                         # 小游戏入口和 Canvas 初始化
├── game.json                       # 小游戏全局配置
├── project.config.json             # compileType: game
├── js/
│   ├── GameApp.js                  # 场景、触摸、登录、分享和业务编排
│   ├── config.js                   # 云环境和广告位配置
│   ├── core/                       # 算法、状态、存储、排行和广告
│   ├── scenes/                     # Canvas 页面绘制
│   └── ui/                         # Canvas 基础绘制和点击命中
└── cloudfunctions/logic-number/    # 微信云函数
```
