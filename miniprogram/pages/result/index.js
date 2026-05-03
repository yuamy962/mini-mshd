Page({
  data: {
    loading: true,
    result: null,
    errorMsg: '',
    role: '',
    question: '',
    fromHistory: false,
    recordId: '',
    // 分享卡片
    showShareModal: false,
    shareImagePath: '',
    canvasReady: false,
    canvasScale: 0.5,
    // 付费解锁
    showUnlockModal: false,
    unlockType: '', // 'advanced' | 'followup'
    unlockedAdvanced: false,
    unlockedFollowup: false,
    // v1.3 新增
    advancedResult: null,
    showAdvancedLoading: false,
    // v1.3 P1 新增
    showShareGuide: false,
    shareMode: 'normal', // 'normal' | 'compare'
  },

  onLoad(options) {
    let { role, question, background, fromHistory, resultData } = options;

    // 小程序 URL 参数不会自动 decode，必须手动解码
    try {
      role = role ? decodeURIComponent(role) : '';
      question = question ? decodeURIComponent(question) : '';
      background = background ? decodeURIComponent(background) : '';
    } catch (e) {
      console.error('URL 参数解码失败', e);
    }

    this.setData({ role, question, fromHistory: !!fromHistory });

    // 从历史记录进入，直接展示缓存的结果
    if (fromHistory && resultData) {
      try {
        const parsed = JSON.parse(decodeURIComponent(resultData));
        this.setData({
          loading: false,
          result: parsed,
        });
        // 历史记录默认视为已解锁
        this.setData({
          unlockedAdvanced: true,
          unlockedFollowup: true,
        });
        return;
      } catch (e) {
        console.error('解析历史数据失败', e);
      }
    }

    // 正常流程：调用云函数生成
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

      const { code, message, data } = res.result;

      if (code !== 0) {
        this.setData({
          loading: false,
          errorMsg: message,
        });
        return;
      }

      // 生成唯一记录 ID（基于时间戳+随机数，用于解锁标识）
      const recordId = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      this.setData({
        loading: false,
        result: data,
        recordId,
        advancedResult: null,
      });

      // 尝试从本地缓存读取解锁状态
      this.loadLocalUnlockStatus(recordId);

      // P1：检查是否首次生成，如果是则显示分享引导弹窗
      this.checkFirstShare();
    } catch (e) {
      console.error('调用失败:', e);
      this.setData({
        loading: false,
        errorMsg: '网络异常，请稍后重试',
      });
    }
  },

  loadLocalUnlockStatus(recordId) {
    try {
      const localStatus = wx.getStorageSync(`unlock_${recordId}`);
      if (localStatus) {
        this.setData({
          unlockedAdvanced: localStatus.advanced || false,
          unlockedFollowup: localStatus.followup || false,
        });
      }
    } catch (e) {
      console.error('读取本地解锁状态失败', e);
    }
  },

  saveLocalUnlockStatus() {
    try {
      const { recordId, unlockedAdvanced, unlockedFollowup } = this.data;
      wx.setStorageSync(`unlock_${recordId}`, {
        advanced: unlockedAdvanced,
        followup: unlockedFollowup,
      });
    } catch (e) {
      console.error('保存本地解锁状态失败', e);
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

  // ========== P1：分享引导弹窗 ==========
  checkFirstShare() {
    try {
      const hasGenerated = wx.getStorageSync('hasGenerated');
      if (!hasGenerated) {
        // 首次生成，显示分享引导弹窗
        setTimeout(() => {
          this.setData({ showShareGuide: true });
        }, 1500);
        wx.setStorageSync('hasGenerated', '1');
      }
    } catch (e) {
      console.error('检查首次生成失败', e);
    }
  },

  onCloseShareGuide() {
    this.setData({ showShareGuide: false });
  },

  onShareNow() {
    this.setData({ showShareGuide: false });
    this.onShowShareModal();
  },

  // ========== P1：对比卡片模式 ==========
  onToggleShareMode() {
    const newMode = this.data.shareMode === 'normal' ? 'compare' : 'normal';
    this.setData({ shareMode: newMode, shareImagePath: '' });
    this.drawShareCard();
  },

  getPoorAnswer(role) {
    const map = {
      '程序员': '我技术还行，学习能力挺强的，加班也没问题',
      '产品经理': '我沟通能力不错，很有责任心，用户需求我都能理解',
      '行政': '我做事很细心，办公软件都会用，性格比较稳重',
      '应届生': '我是应届毕业生，虽然没经验但是我很努力',
    };
    return map[role] || '我很努力，有责任心，学习能力很强';
  },

  // v1.3 新增：优化到90+版本
  async onOptimizeTo90() {
    const { role, question, result } = this.data;
    if (!result || !result.answer) {
      wx.showToast({ title: '暂无原回答', icon: 'none' });
      return;
    }

    this.setData({ showAdvancedLoading: true });

    try {
      const res = await wx.cloud.callFunction({
        name: 'generateAnswer',
        data: {
          role,
          question,
          background: '',
          mode: 'advanced',
          originalAnswer: result.answer,
        },
      });

      const { code, message, data } = res.result;

      if (code !== 0) {
        wx.showToast({ title: message || '优化失败', icon: 'none' });
        this.setData({ showAdvancedLoading: false });
        return;
      }

      this.setData({
        advancedResult: data,
        showAdvancedLoading: false,
      });

      wx.pageScrollTo({
        selector: '.card-advanced-result',
        duration: 300,
      });
    } catch (e) {
      console.error('优化失败:', e);
      wx.showToast({ title: '网络异常，请稍后重试', icon: 'none' });
      this.setData({ showAdvancedLoading: false });
    }
  },

  onGoHome() {
    wx.switchTab({
      url: '/pages/index/index',
    });
  },

  onRecommendQuestion(e) {
    const { text } = e.currentTarget.dataset;
    if (!text) return;
    wx.redirectTo({
      url: `/pages/result/index?role=${encodeURIComponent(this.data.role)}&question=${encodeURIComponent(text)}`,
    });
  },

  // ========== 分享卡片 ==========
  onShowShareModal() {
    // 计算 Canvas 缩放比例，适配不同屏幕宽度
    const sysInfo = wx.getSystemInfoSync();
    const screenWidth = sysInfo.windowWidth;
    const canvasScale = (screenWidth - 40) / 750; // 左右各留 20px 边距

    this.setData({
      showShareModal: true,
      canvasScale: Math.max(0.4, Math.min(canvasScale, 1)), // 限制在 0.4 ~ 1.0 之间
    });
    this.drawShareCard();
  },

  onCloseShareModal() {
    this.setData({ showShareModal: false, shareImagePath: '' });
  },

  // Canvas 绘制分享卡片
  drawShareCard() {
    const { result, question, role, shareMode } = this.data;
    if (!result) return;

    const ctx = wx.createCanvasContext('shareCanvas');
    const W = 750;
    const H = 1100;

    // 清空画布
    ctx.clearRect(0, 0, W, H);

    // 背景
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(1, '#f5f7fa');
    ctx.setFillStyle(grd);
    ctx.fillRect(0, 0, W, H);

    // 顶部绿色装饰条
    ctx.setFillStyle('#07c160');
    ctx.fillRect(0, 0, W, 16);

    if (shareMode === 'compare') {
      // ========== 对比模式 ==========
      // 标题
      ctx.setFillStyle('#333');
      ctx.setFontSize(42);
      ctx.setTextAlign('center');
      ctx.fillText('面试回答对比', W / 2, 90);

      ctx.setFillStyle('#999');
      ctx.setFontSize(24);
      ctx.fillText('看看差回答和好回答的差距', W / 2, 130);

      // 分隔线
      ctx.setStrokeStyle('#e8e8e8');
      ctx.setLineWidth(2);
      ctx.beginPath();
      ctx.moveTo(60, 155);
      ctx.lineTo(W - 60, 155);
      ctx.stroke();

      // 问题
      ctx.setFillStyle('#666');
      ctx.setFontSize(24);
      ctx.setTextAlign('center');
      ctx.fillText(`【${role || '未知岗位'}】${question || '面试问题'}`, W / 2, 185);

      // 上半部分：差回答
      ctx.setFillStyle('#ffebee');
      ctx.fillRect(60, 190, W - 120, 190);

      ctx.setFillStyle('#c62828');
      ctx.setFontSize(26);
      ctx.setTextAlign('left');
      ctx.fillText('我以前这样回答：', 85, 220);

      const poorAnswer = this.getPoorAnswer(role);
      ctx.setFillStyle('#555');
      ctx.setFontSize(26);
      this.drawWrapText(ctx, poorAnswer, 85, 255, W - 170, 42, 3);

      ctx.setFillStyle('#c62828');
      ctx.setFontSize(22);
      ctx.setTextAlign('center');
      ctx.fillText('面试官无感', W / 2, 365);

      // 中间分隔线
      ctx.setStrokeStyle('#ddd');
      ctx.setLineWidth(2);
      ctx.setLineDash([10, 10], 0);
      ctx.beginPath();
      ctx.moveTo(100, 410);
      ctx.lineTo(W - 100, 410);
      ctx.stroke();
      ctx.setLineDash([], 0);

      // 下半部分：好回答
      ctx.setFillStyle('#e8f5e9');
      ctx.fillRect(60, 435, W - 120, 240);

      ctx.setFillStyle('#2e7d32');
      ctx.setFontSize(26);
      ctx.setTextAlign('left');
      ctx.fillText('用这个回答后：', 85, 465);

      const goodAnswer = result.answer ? result.answer.substring(0, 56) + (result.answer.length > 56 ? '...' : '') : '';
      ctx.setFillStyle('#333');
      ctx.setFontSize(26);
      this.drawWrapText(ctx, goodAnswer, 85, 500, W - 170, 42, 3);

      // 评分
      if (result.score && result.score.total) {
        ctx.setFillStyle('#e65100');
        ctx.setFontSize(28);
        ctx.setTextAlign('center');
        ctx.fillText(`评分：${result.score.total}分`, W / 2, 630);
      }

      ctx.setFillStyle('#2e7d32');
      ctx.setFontSize(22);
      ctx.setTextAlign('center');
      ctx.fillText('面试官认可', W / 2, 660);

      // 底部引导语
      ctx.setFillStyle('#999');
      ctx.setFontSize(24);
      ctx.setTextAlign('center');
      ctx.fillText('你会给这个回答打几分？', W / 2, H - 120);
    } else {
      // ========== 普通模式 ==========
      // 标题
      ctx.setFillStyle('#333');
      ctx.setFontSize(44);
      ctx.setTextAlign('center');
      ctx.fillText('HR会点头的回答', W / 2, 100);

      // 副标题
      ctx.setFillStyle('#999');
      ctx.setFontSize(26);
      ctx.fillText('建议直接背诵，面试时用得上', W / 2, 150);

      // 分隔线
      ctx.setStrokeStyle('#e8e8e8');
      ctx.setLineWidth(2);
      ctx.beginPath();
      ctx.moveTo(60, 180);
      ctx.lineTo(W - 60, 180);
      ctx.stroke();

      // 岗位标签
      ctx.setFillStyle('#e8f5e9');
      ctx.fillRect(60, 210, 160, 52);
      ctx.setFillStyle('#2e7d32');
      ctx.setFontSize(26);
      ctx.setTextAlign('center');
      ctx.fillText(role || '未知岗位', 140, 244);

      // 问题
      ctx.setFillStyle('#333');
      ctx.setFontSize(30);
      ctx.setTextAlign('left');
      this.drawWrapText(ctx, question || '面试问题', 60, 300, W - 120, 46, 2);

      // 回答内容区域背景
      ctx.setFillStyle('#f8f9fa');
      ctx.fillRect(60, 390, W - 120, 300);

      // 回答内容
      ctx.setFillStyle('#444');
      ctx.setFontSize(28);
      const answerText = result.answer ? result.answer.substring(0, 100) + (result.answer.length > 100 ? '...' : '') : '';
      this.drawWrapText(ctx, answerText, 90, 440, W - 180, 44, 5);

      // 一句话点评（v1.3）
      if (result.summaryComment) {
        ctx.setFillStyle('#e3f2fd');
        ctx.fillRect(60, 720, W - 120, 60);
        ctx.setFillStyle('#1565c0');
        ctx.setFontSize(24);
        ctx.setTextAlign('center');
        ctx.fillText(result.summaryComment, W / 2, 758);
      }

      // 评分展示
      const scoreY = result.summaryComment ? 860 : 780;
      if (result.score && result.score.total) {
        const scoreX = W / 2;

        // 圆形背景
        ctx.beginPath();
        ctx.arc(scoreX, scoreY, 70, 0, 2 * Math.PI);
        ctx.setFillStyle('#fff3e0');
        ctx.fill();

        // 分数
        ctx.setFillStyle('#e65100');
        ctx.setFontSize(64);
        ctx.setTextAlign('center');
        ctx.fillText(String(result.score.total), scoreX, scoreY + 18);

        ctx.setFontSize(24);
        ctx.fillText('分', scoreX + 42, scoreY - 6);

        // 评分标签
        ctx.setFillStyle('#666');
        ctx.setFontSize(26);
        ctx.fillText('回答质量评分', scoreX, scoreY + 100);
      }
    }

    // 底部提示
    ctx.setFillStyle('#bbb');
    ctx.setFontSize(22);
    ctx.setTextAlign('center');
    ctx.fillText('扫码使用「面试回答生成器」，3分钟搞定面试难题', W / 2, H - 80);

    // 底部绿色装饰条
    ctx.setFillStyle('#07c160');
    ctx.fillRect(0, H - 16, W, 16);

    // 旧版 canvas draw 不支持回调，用 setTimeout 确保绘制完成
    ctx.draw();
    setTimeout(() => {
      wx.canvasToTempFilePath({
        canvasId: 'shareCanvas',
        success: (res) => {
          this.setData({
            shareImagePath: res.tempFilePath,
            canvasReady: true,
          });
        },
        fail: (err) => {
          console.error('生成图片失败', err);
          wx.showToast({ title: '生成失败', icon: 'none' });
        },
      });
    }, 500);
  },

  // Canvas 多行文本绘制工具（修复版）
  drawWrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    if (!text) return;
    const chars = text.split('');
    let line = '';
    let lineCount = 0;

    for (let i = 0; i < chars.length; i++) {
      const testLine = line + chars[i];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && line !== '') {
        lineCount++;
        if (maxLines && lineCount >= maxLines) {
          ctx.fillText(line.substring(0, line.length - 1) + '...', x, y);
          return;
        }
        ctx.fillText(line, x, y);
        line = chars[i];
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    if (line) {
      lineCount++;
      if (!maxLines || lineCount <= maxLines) {
        ctx.fillText(line, x, y);
      }
    }
  },

  onSaveShareImage() {
    const { shareImagePath } = this.data;
    if (!shareImagePath) {
      wx.showToast({ title: '图片未生成', icon: 'none' });
      return;
    }

    wx.saveImageToPhotosAlbum({
      filePath: shareImagePath,
      success: () => {
        wx.showToast({ title: '已保存到相册', icon: 'success' });
      },
      fail: (err) => {
        if (err.errMsg.includes('auth deny')) {
          wx.showModal({
            title: '需要授权',
            content: '请允许保存图片到相册',
            success: (res) => {
              if (res.confirm) {
                wx.openSetting();
              }
            },
          });
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' });
        }
      },
    });
  },

  // ========== 付费解锁 ==========
  onShowUnlockModal(e) {
    const { type } = e.currentTarget.dataset;
    this.setData({
      showUnlockModal: true,
      unlockType: type,
    });
  },

  onCloseUnlockModal() {
    this.setData({ showUnlockModal: false, unlockType: '' });
  },

  async onUnlockByAd() {
    // 模拟看广告解锁（v1.2 预留广告 SDK 接入点）
    wx.showLoading({ title: '加载中...' });

    setTimeout(() => {
      wx.hideLoading();
      this.performUnlock();
    }, 800);
  },

  onUnlockFree() {
    // 免费体验解锁（测试用）
    this.performUnlock();
  },

  performUnlock() {
    const { unlockType } = this.data;
    if (unlockType === 'advanced') {
      this.setData({ unlockedAdvanced: true });
    } else if (unlockType === 'followup') {
      this.setData({ unlockedFollowup: true });
    }

    this.saveLocalUnlockStatus();
    this.setData({ showUnlockModal: false, unlockType: '' });

    wx.showToast({
      title: '解锁成功',
      icon: 'success',
    });
  },
});
