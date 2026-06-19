import { verifyRewardedAd, type RewardType } from "@/services/api";

export type RewardScene = "stamina" | "gold" | "reveal" | "revive" | "triple";

interface RewardResult {
  granted: boolean;
  transactionId: string;
}

const AD_UNIT_IDS: Record<RewardScene, string> = {
  stamina: "replace-with-stamina-rewarded-video-ad-unit",
  gold: "replace-with-gold-rewarded-video-ad-unit",
  reveal: "replace-with-reveal-rewarded-video-ad-unit",
  revive: "replace-with-revive-rewarded-video-ad-unit",
  triple: "replace-with-triple-rewarded-video-ad-unit",
};

const REWARD_TYPES: Partial<Record<RewardScene, RewardType>> = {
  stamina: "ad_stamina",
  gold: "ad_gold",
  reveal: "ad_reveal",
  revive: "ad_revive",
};

class RewardedAdManager {
  private ad: any;
  private loaded: boolean;
  private activeScene: RewardScene;

  constructor() {
    this.ad = null;
    this.loaded = false;
    this.activeScene = "stamina";
  }

  preload(scene: RewardScene = "stamina") {
    this.activeScene = scene;
    const creator = this.getCreator();
    if (!creator) return;

    this.ad = creator({ adUnitId: AD_UNIT_IDS[scene] });
    if (this.ad.onLoad) this.ad.onLoad(() => {
      this.loaded = true;
    });
    if (this.ad.onError) this.ad.onError(() => {
      this.loaded = false;
    });
    if (this.ad.load) this.ad.load();
  }

  showRewardedVideoAd(scene: RewardScene): Promise<RewardResult> {
    return this.show(scene);
  }

  async show(scene: RewardScene): Promise<RewardResult> {
    this.activeScene = scene;
    const creator = this.getCreator();

    if (!creator) {
      return {
        granted: true,
        transactionId: `mock-ad-${scene}-${Date.now()}`,
      };
    }

    if (!this.ad || scene !== this.activeScene) this.preload(scene);

    return new Promise((resolve) => {
      const transactionId = `${this.platform()}-${scene}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const closeHandler = async (res: { isEnded?: boolean }) => {
        if (this.ad.offClose) this.ad.offClose(closeHandler);
        const ended = res && res.isEnded === true;
        if (!ended) {
          resolve({ granted: false, transactionId });
          return;
        }

        if (scene === "triple") {
          resolve({ granted: true, transactionId });
          return;
        }

        const rewardType = REWARD_TYPES[scene];
        const verified = rewardType
          ? await verifyRewardedAd({
              rewardType,
              scene,
              platform: this.platform(),
              adUnitId: AD_UNIT_IDS[scene],
              transactionId,
            })
          : false;
        resolve({ granted: verified, transactionId });
      };

      if (this.ad.onClose) this.ad.onClose(closeHandler);
      let showResult: unknown;
      if (this.loaded) {
        showResult = this.ad.show ? this.ad.show() : undefined;
      } else {
        const loadResult = this.ad.load ? this.ad.load() : undefined;
        showResult = Promise.resolve(loadResult).then(() => (this.ad.show ? this.ad.show() : undefined));
      }
      Promise.resolve(showResult).catch(() => {
        this.preload(scene);
        resolve({ granted: false, transactionId });
      });
    });
  }

  private getCreator() {
    const uniCreator = (uni as any).createRewardedVideoAd;
    if (typeof uniCreator === "function") return uniCreator;
    if (typeof wx !== "undefined" && wx.createRewardedVideoAd) return wx.createRewardedVideoAd;
    if (typeof tt !== "undefined" && tt.createRewardedVideoAd) return tt.createRewardedVideoAd;
    return null;
  }

  private platform() {
    // #ifdef MP-WEIXIN
    return "weixin";
    // #endif
    // #ifdef MP-TOUTIAO
    return "douyin";
    // #endif
    return "dev";
  }
}

export const adManager = new RewardedAdManager();
