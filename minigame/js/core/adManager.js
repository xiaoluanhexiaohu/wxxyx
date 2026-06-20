"use strict";

const config = require("../config");
const api = require("./api");

const rewardTypes = {
  stamina: "ad_stamina",
  gold: "ad_gold",
  reveal: "ad_reveal",
  revive: "ad_revive",
};

class AdManager {
  constructor() {
    this.ads = {};
  }

  preload(scene) {
    const adUnitId = config.rewardedAds[scene];
    if (!adUnitId || typeof wx.createRewardedVideoAd !== "function") return;
    const ad = wx.createRewardedVideoAd({ adUnitId });
    ad.onError(() => {});
    if (ad.load) ad.load().catch(() => {});
    this.ads[scene] = ad;
  }

  async show(scene) {
    const adUnitId = config.rewardedAds[scene];
    if (!adUnitId || typeof wx.createRewardedVideoAd !== "function") {
      return { granted: true, transactionId: `mock-ad-${scene}-${Date.now()}` };
    }
    let ad = this.ads[scene];
    if (!ad) {
      this.preload(scene);
      ad = this.ads[scene];
    }
    if (!ad) return { granted: false, transactionId: "" };
    const transactionId = `weixin-${scene}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return new Promise((resolve) => {
      const close = async (result) => {
        if (ad.offClose) ad.offClose(close);
        if (!result || result.isEnded !== true) {
          resolve({ granted: false, transactionId });
          return;
        }
        if (scene === "triple") {
          resolve({ granted: true, transactionId });
          return;
        }
        const rewardType = rewardTypes[scene];
        const verified = rewardType ? await api.verifyRewardedAd({
          rewardType,
          scene,
          platform: "weixin-game",
          adUnitId,
          transactionId,
        }) : false;
        resolve({ granted: verified, transactionId });
      };
      ad.onClose(close);
      Promise.resolve(ad.show()).catch(() => Promise.resolve(ad.load()).then(() => ad.show())).catch(() => {
        if (ad.offClose) ad.offClose(close);
        resolve({ granted: false, transactionId });
      });
    });
  }
}

module.exports = new AdManager();
