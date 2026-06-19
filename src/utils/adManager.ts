import { verifyRewardedAd } from "@/services/api";

type RewardScene = "stamina" | "gold" | "reveal";

interface RewardResult {
  granted: boolean;
  transactionId: string;
}

const AD_UNIT_IDS: Record<RewardScene, string> = {
  stamina: "替换为体力激励视频广告位",
  gold: "替换为金币激励视频广告位",
  reveal: "替换为透视镜激励视频广告位",
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

  async show(scene: RewardScene): Promise<RewardResult> {
    this.activeScene = scene;
    const creator = this.getCreator();

    if (!creator) {
      return {
        granted: true,
        transactionId: `mock-ad-${Date.now()}`,
      };
    }

    if (!this.ad || scene !== this.activeScene) this.preload(scene);

    return new Promise((resolve) => {
      const transactionId = `${this.platform()}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const closeHandler = async (res: { isEnded?: boolean }) => {
        if (this.ad.offClose) this.ad.offClose(closeHandler);
        const ended = res && res.isEnded === true;
        const verified = ended
          ? await verifyRewardedAd({
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
