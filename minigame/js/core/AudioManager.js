"use strict";

const storage = require("./storage");

const BGM_FILES = {
  home: "audio/bgm_home.wav",
  battle: "audio/bgm_battle.wav",
};

const SFX_FILES = {
  click: "audio/sfx_click.mp3",
  merge: "audio/sfx_merge.mp3",
  win: "audio/sfx_win.mp3",
  lose: "audio/sfx_lose.mp3",
};

const SFX_POOL_SIZE = 6;

function createSilentContext() {
  return {
    src: "",
    loop: false,
    autoplay: false,
    volume: 1,
    play() {},
    pause() {},
    stop() {},
    seek() {},
    destroy() {},
    onPlay() {},
    onPause() {},
    onStop() {},
    onEnded() {},
    onError() {},
  };
}

function createContext() {
  if (typeof wx !== "undefined" && typeof wx.createInnerAudioContext === "function") {
    return wx.createInnerAudioContext();
  }
  return createSilentContext();
}

class AudioManager {
  constructor() {
    if (AudioManager.instance) return AudioManager.instance;

    const settings = storage.getAudioSettings();
    this.isBgmEnabled = settings.isBgmEnabled;
    this.isSfxEnabled = settings.isSfxEnabled;
    this.requestedBgmType = null;
    this.currentBgmType = null;
    this.bgmPlaying = false;
    this.bgmPlayRequested = false;
    this.sfxPoolIndex = 0;

    this.bgmContext = createContext();
    this.bgmContext.loop = true;
    this.bgmContext.autoplay = false;
    this.bgmContext.volume = 0.45;
    this.bgmContext.obeyMuteSwitch = true;
    this.bindBgmEvents();

    this.sfxContexts = Array.from({ length: SFX_POOL_SIZE }, () => {
      const context = createContext();
      context.loop = false;
      context.autoplay = false;
      context.volume = 0.8;
      context.obeyMuteSwitch = true;
      if (typeof context.onError === "function") context.onError(() => {});
      return context;
    });

    AudioManager.instance = this;
  }

  static getInstance() {
    return AudioManager.instance || new AudioManager();
  }

  bindBgmEvents() {
    if (typeof this.bgmContext.onPlay === "function") this.bgmContext.onPlay(() => { this.bgmPlaying = true; });
    if (typeof this.bgmContext.onPause === "function") this.bgmContext.onPause(() => { this.bgmPlaying = false; this.bgmPlayRequested = false; });
    if (typeof this.bgmContext.onStop === "function") this.bgmContext.onStop(() => { this.bgmPlaying = false; this.bgmPlayRequested = false; });
    if (typeof this.bgmContext.onEnded === "function") this.bgmContext.onEnded(() => { this.bgmPlaying = false; this.bgmPlayRequested = false; });
    if (typeof this.bgmContext.onError === "function") this.bgmContext.onError(() => { this.bgmPlaying = false; });
  }

  playBgm(type) {
    if (!BGM_FILES[type]) return;
    this.requestedBgmType = type;
    if (!this.isBgmEnabled) return;
    if (this.currentBgmType === type && (this.bgmPlaying || this.bgmPlayRequested)) return;

    if (this.currentBgmType !== type) {
      this.safeCall(this.bgmContext, "stop");
      this.bgmContext.src = BGM_FILES[type];
      this.currentBgmType = type;
    }
    this.bgmPlayRequested = true;
    this.safeCall(this.bgmContext, "play");
  }

  stopBgm() {
    if (!this.requestedBgmType && !this.currentBgmType && !this.bgmPlaying && !this.bgmPlayRequested) return;
    this.requestedBgmType = null;
    this.currentBgmType = null;
    this.bgmPlaying = false;
    this.bgmPlayRequested = false;
    this.safeCall(this.bgmContext, "stop");
  }

  playSfx(name) {
    if (!this.isSfxEnabled || !SFX_FILES[name] || !this.sfxContexts.length) return;
    const context = this.sfxContexts[this.sfxPoolIndex % this.sfxContexts.length];
    this.sfxPoolIndex = (this.sfxPoolIndex + 1) % this.sfxContexts.length;
    this.safeCall(context, "stop");
    context.src = SFX_FILES[name];
    this.safeCall(context, "seek", 0);
    this.safeCall(context, "play");
  }

  toggleBgm() {
    this.isBgmEnabled = !this.isBgmEnabled;
    this.persistSettings();
    if (!this.isBgmEnabled) {
      this.bgmPlaying = false;
      this.bgmPlayRequested = false;
      this.safeCall(this.bgmContext, "pause");
    } else if (this.requestedBgmType) {
      this.bgmPlayRequested = false;
      this.playBgm(this.requestedBgmType);
    }
    return this.isBgmEnabled;
  }

  toggleSfx() {
    this.isSfxEnabled = !this.isSfxEnabled;
    this.persistSettings();
    if (!this.isSfxEnabled) {
      this.sfxContexts.forEach((context) => this.safeCall(context, "stop"));
    }
    return this.isSfxEnabled;
  }

  persistSettings() {
    storage.setAudioSettings({
      isBgmEnabled: this.isBgmEnabled,
      isSfxEnabled: this.isSfxEnabled,
    });
  }

  safeCall(context, method, ...args) {
    try {
      if (context && typeof context[method] === "function") {
        const result = context[method](...args);
        if (result && typeof result.catch === "function") result.catch(() => {});
      }
    } catch (_) {}
  }
}

module.exports = AudioManager.getInstance();
module.exports.AudioManager = AudioManager;
