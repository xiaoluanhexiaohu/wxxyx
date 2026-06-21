# 逻辑大师微信小游戏

这是纯原生微信小游戏项目，使用 Canvas 和微信小游戏 API，不包含 uni-app、Vue、WXML 或 WXSS 小程序版本。

## 微信开发者工具导入

选择“小游戏”项目类型，目录导入：

```text
minigame/
```

不要导入仓库根目录。调试时可使用小游戏测试号，上传时需要将 `minigame/project.config.json` 中的 `appid` 替换成正式微信小游戏 AppID。

## 目录

```text
minigame/                       原生小游戏完整工程
minigame/game.js               小游戏入口
minigame/game.json             小游戏配置
minigame/js/                   Canvas 场景和游戏逻辑
minigame/audio/                BGM 与音效
minigame/cloudfunctions/       微信云函数
scripts/download_wx_audio.js   音频下载和占位脚本
```

## 音频

```powershell
npm run audio:download
```

生成两段原创循环背景音乐：

```powershell
npm run audio:generate-bgm
```

也可以一次生成全部音频资源：

```powershell
npm run audio:setup
```

背景音乐文件为：

```text
minigame/audio/bgm_home.wav
minigame/audio/bgm_battle.wav
```

小游戏详细配置与云函数部署方式见 `minigame/README.md`。
