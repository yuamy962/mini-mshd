Page({
  data: {
    roles: ['程序员', '产品经理', '行政', '应届生'],
    selectedRole: '',
    question: '',
    background: '',
    quickQuestions: ['自我介绍', '优缺点', '为什么离职', '职业规划'],
    remaining: 3,
    loading: false,
    showExhaustedModal: false,
  },

  onLoad() {
    this.fetchQuota();
  },

  onShow() {
    this.fetchQuota();
  },

  async fetchQuota() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'quota',
        data: { type: 'get' },
      });
      if (res.result.code === 0) {
        this.setData({
          remaining: res.result.data.remaining,
        });
      }
    } catch (e) {
      console.error('获取次数失败:', e);
    }
  },

  onCloseExhaustedModal() {
    this.setData({ showExhaustedModal: false });
  },

  async onWatchAd() {
    /* ============================================================
       激励视频广告接入说明（当前为模拟模式，开通流量主后启用）
       ============================================================
       开通条件：小程序累计独立访客（UV）≥ 1000
       开通路径：微信公众平台 → 推广 → 流量主 → 申请开通
       创建广告位：流量主 → 广告管理 → 新建「激励式视频」广告位
       获取 adUnitId 后，将下方注释的代码取消注释即可
       ============================================================ */

    // ===== 真实广告模式（开通流量主后启用）=====
    // const rewardedVideoAd = wx.createRewardedVideoAd({
    //   adUnitId: '你的_adUnitId', // 从流量主后台获取
    // });
    //
    // rewardedVideoAd.onClose(async (res) => {
    //   if (res && res.isEnded) {
    //     // 用户完整看完广告，调用云函数增加次数
    //     wx.showLoading({ title: '发放奖励中...' });
    //     try {
    //       const result = await wx.cloud.callFunction({
    //         name: 'quota',
    //         data: { type: 'watchAd' },
    //       });
    //       wx.hideLoading();
    //       if (result.result.code === 0) {
    //         this.setData({
    //           remaining: result.result.data.remaining,
    //           showExhaustedModal: false,
    //         });
    //         wx.showToast({ title: '已获得3次额度', icon: 'success' });
    //       }
    //     } catch (e) {
    //       wx.hideLoading();
    //       wx.showToast({ title: '发放失败', icon: 'none' });
    //     }
    //   } else {
    //     wx.showToast({ title: '需要看完广告才能获得奖励', icon: 'none' });
    //   }
    // });
    //
    // rewardedVideoAd.show().catch(() => {
    //   rewardedVideoAd.load().then(() => rewardedVideoAd.show());
    // });

    // ===== 模拟模式（当前使用，测试/上线初期）=====
    wx.showLoading({ title: '加载中...' });

    try {
      const res = await wx.cloud.callFunction({
        name: 'quota',
        data: { type: 'watchAd' },
      });

      wx.hideLoading();

      if (res.result.code === 0) {
        this.setData({
          remaining: res.result.data.remaining,
          showExhaustedModal: false,
        });
        wx.showToast({
          title: `已获得${res.result.data.adBonus || 3}次额度`,
          icon: 'success',
        });
      } else {
        wx.showToast({ title: res.result.message || '操作失败', icon: 'none' });
      }
    } catch (e) {
      wx.hideLoading();
      console.error(e);
      wx.showToast({ title: '网络异常', icon: 'none' });
    }
  },

  onOpenVip() {
    wx.showToast({ title: '会员功能即将上线', icon: 'none' });
    this.setData({ showExhaustedModal: false });
  },

  onSelectRole(e) {
    const { role } = e.currentTarget.dataset;
    this.setData({ selectedRole: role });
  },

  onQuestionInput(e) {
    this.setData({ question: e.detail.value });
  },

  onBackgroundInput(e) {
    this.setData({ background: e.detail.value });
  },

  onQuickQuestion(e) {
    const { text } = e.currentTarget.dataset;
    this.setData({ question: text });
  },

  async onGenerate() {
    const { selectedRole, question, remaining } = this.data;

    if (!selectedRole) {
      wx.showToast({ title: '请选择岗位', icon: 'none' });
      return;
    }
    if (!question.trim()) {
      wx.showToast({ title: '请输入面试问题', icon: 'none' });
      return;
    }
    if (remaining <= 0) {
      this.setData({ showExhaustedModal: true });
      return;
    }

    this.setData({ loading: true });

    try {
      const checkRes = await wx.cloud.callFunction({
        name: 'quota',
        data: { type: 'check' },
      });

      if (checkRes.result.code !== 0 || !checkRes.result.data.canUse) {
        this.setData({ loading: false, showExhaustedModal: true });
        return;
      }

      const { background } = this.data;
      const url = `/pages/result/index?role=${encodeURIComponent(selectedRole)}&question=${encodeURIComponent(question)}&background=${encodeURIComponent(background)}`;
      wx.navigateTo({ url });
    } catch (e) {
      console.error(e);
      wx.showToast({ title: '出错了，请重试', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onGoHistory() {
    wx.navigateTo({
      url: '/pages/history/index',
    });
  },

  onShareAppMessage() {
    return {
      title: '面试回答生成器 - 3分钟搞定面试难题',
      path: '/pages/index/index',
    };
  },
});
