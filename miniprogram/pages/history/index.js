// 安全解码 URL 编码的字符串
function safeDecode(str) {
  if (!str || typeof str !== 'string') return str || '';
  try {
    return decodeURIComponent(str);
  } catch (e) {
    return str;
  }
}

Page({
  data: {
    loading: false,
    list: [],
    page: 1,
    pageSize: 20,
    total: 0,
    hasMore: false,
  },

  onLoad() {
    this.fetchHistory();
  },

  onPullDownRefresh() {
    this.setData({ page: 1, list: [] });
    this.fetchHistory().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  async fetchHistory() {
    if (this.data.loading) return;
    this.setData({ loading: true });

    try {
      const res = await wx.cloud.callFunction({
        name: 'getHistory',
        data: {
          page: this.data.page,
          pageSize: this.data.pageSize,
        },
      });

      const { code, data } = res.result;
      if (code === 0) {
        // 对 role 和 question 做安全解码（兼容旧数据中的 URL 编码）
        const decodedList = data.list.map(item => ({
          ...item,
          role: safeDecode(item.role),
          question: safeDecode(item.question),
          background: safeDecode(item.background),
        }));
        const newList = this.data.page === 1 ? decodedList : [...this.data.list, ...decodedList];
        this.setData({
          list: newList,
          total: data.total,
          hasMore: data.hasMore,
        });
      } else {
        wx.showToast({ title: res.result.message || '获取失败', icon: 'none' });
      }
    } catch (e) {
      console.error(e);
      wx.showToast({ title: '网络异常', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onLoadMore() {
    if (!this.data.hasMore || this.data.loading) return;
    this.setData({ page: this.data.page + 1 });
    this.fetchHistory();
  },

  onViewDetail(e) {
    const { index } = e.currentTarget.dataset;
    const item = this.data.list[index];
    if (!item || !item.result) return;

    // 将历史记录的结果数据传递到结果页展示
    const resultData = item.result;
    const score = resultData.score || {};
    const recommendQuestions = resultData.recommendQuestions || [];

    const dataStr = encodeURIComponent(JSON.stringify({
      answer: resultData.answer || '',
      advanced: resultData.advanced || '',
      insight: resultData.insight || '',
      followup: resultData.followup || '',
      score: {
        total: score.total || 0,
        clarity: score.clarity || 0,
        logic: score.logic || 0,
        authenticity: score.authenticity || 0,
        target: score.target || 0,
        suggestion: score.suggestion || '',
      },
      recommendQuestions: Array.isArray(recommendQuestions) ? recommendQuestions : [],
    }));

    wx.navigateTo({
      url: `/pages/result/index?fromHistory=1&role=${encodeURIComponent(item.role)}&question=${encodeURIComponent(item.question)}&resultData=${dataStr}`,
    });
  },

  onGoHome() {
    wx.switchTab({
      url: '/pages/index/index',
    });
  },
});
