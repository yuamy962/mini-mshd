Page({
  data: {
    loading: true,
    result: null,
    errorMsg: '',
    role: '',
    question: '',
  },

  onLoad(options) {
    const { role, question, background } = options;
    this.setData({ role, question });
    this.generateAnswer(role, question, background);
  },

  async generateAnswer(role, question, background) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'generateAnswer',
        data: {
          role,
          question,
          background,
        },
      });

      const { code, message, data, remaining } = res.result;

      if (code !== 0) {
        this.setData({
          loading: false,
          errorMsg: message,
        });
        return;
      }

      this.setData({
        loading: false,
        result: data,
        remaining,
      });
    } catch (e) {
      console.error('调用失败:', e);
      this.setData({
        loading: false,
        errorMsg: '网络异常，请稍后重试',
      });
    }
  },

  onCopyText(e) {
    const { text } = e.currentTarget.dataset;
    if (!text) return;
    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({
          title: '已复制',
          icon: 'success',
        });
      },
    });
  },

  onRegenerate() {
    wx.redirectTo({
      url: '/pages/index/index',
    });
  },

  onGoHome() {
    wx.switchTab({
      url: '/pages/index/index',
    });
  },
});
