const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const MAX_DAILY_QUOTA = 3;

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
  if (res.data.length > 0) {
    usedCount = res.data[0].usedCount || 0;
  }

  const remaining = Math.max(0, MAX_DAILY_QUOTA - usedCount);

  return {
    remaining,
    total: MAX_DAILY_QUOTA,
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
    // 查询剩余次数
    const quotaInfo = await getQuota(openid);

    if (type === 'get') {
      return {
        code: 0,
        message: 'success',
        data: quotaInfo,
      };
    }

    if (type === 'check') {
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
