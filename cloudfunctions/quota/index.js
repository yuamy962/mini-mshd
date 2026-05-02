const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const MAX_DAILY_QUOTA = 3;
const AD_BONUS = 3;

/**
 * 获取用户今日剩余次数
 */
async function getQuota(openid) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const res = await db.collection('quota').where({
    openid: openid,
    date: dateStr,
  }).get();

  let usedCount = 0;
  let adBonus = 0;
  if (res.data.length > 0) {
    usedCount = res.data[0].usedCount || 0;
    adBonus = res.data[0].adBonus || 0;
  }

  // 总可用次数 = 基础 3 次 + 广告奖励次数
  const totalQuota = MAX_DAILY_QUOTA + adBonus;
  const remaining = Math.max(0, totalQuota - usedCount);

  return {
    remaining,
    total: totalQuota,
    baseQuota: MAX_DAILY_QUOTA,
    adBonus,
  };
}

// 云函数入口
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  if (!openid) {
    return {
      code: -1,
      message: '未获取到用户信息',
    };
  }

  const { type } = event;

  try {
    const dateStr = new Date().toISOString().slice(0, 10);

    if (type === 'get') {
      const quotaInfo = await getQuota(openid);
      return {
        code: 0,
        message: 'success',
        data: quotaInfo,
      };
    }

    if (type === 'check') {
      const quotaInfo = await getQuota(openid);
      return {
        code: 0,
        message: 'success',
        data: {
          ...quotaInfo,
          canUse: quotaInfo.remaining > 0,
        },
      };
    }

    if (type === 'watchAd') {
      // 用户看广告，增加 3 次额度
      const quotaRes = await db.collection('quota').where({
        openid: openid,
        date: dateStr,
      }).get();

      if (quotaRes.data.length > 0) {
        await db.collection('quota').doc(quotaRes.data[0]._id).update({
          data: {
            adBonus: db.command.inc(AD_BONUS),
            updateTime: db.serverDate(),
          },
        });
      } else {
        await db.collection('quota').add({
          data: {
            openid: openid,
            date: dateStr,
            usedCount: 0,
            adBonus: AD_BONUS,
            createTime: db.serverDate(),
            updateTime: db.serverDate(),
          },
        });
      }

      const quotaInfo = await getQuota(openid);
      return {
        code: 0,
        message: 'success',
        data: {
          ...quotaInfo,
          canUse: quotaInfo.remaining > 0,
        },
      };
    }

    return {
      code: -1,
      message: '未知的操作类型',
    };
  } catch (e) {
    console.error('quota error:', e);
    return {
      code: -1,
      message: e.message || '查询失败',
    };
  }
};
