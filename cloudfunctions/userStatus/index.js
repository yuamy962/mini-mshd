const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

/**
 * 获取用户解锁记录
 */
async function getUnlockRecord(openid, recordId) {
  const res = await db.collection('user_unlock').where({
    openid: openid,
    recordId: recordId,
  }).get();

  return res.data.length > 0 ? res.data[0] : null;
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

  const { type, recordId } = event;

  try {
    if (type === 'get') {
      // 查询某条记录是否已解锁
      if (!recordId) {
        return {
          code: -1,
          message: '缺少 recordId',
        };
      }

      const record = await getUnlockRecord(openid, recordId);

      return {
        code: 0,
        message: 'success',
        data: {
          unlocked: !!record,
          unlockTime: record ? record.createTime : null,
        },
      };
    }

    if (type === 'unlock') {
      // 解锁某条记录
      if (!recordId) {
        return {
          code: -1,
          message: '缺少 recordId',
        };
      }

      const existing = await getUnlockRecord(openid, recordId);
      if (existing) {
        return {
          code: 0,
          message: '已解锁',
          data: { unlocked: true },
        };
      }

      await db.collection('user_unlock').add({
        data: {
          openid: openid,
          recordId: recordId,
          createTime: db.serverDate(),
        },
      });

      return {
        code: 0,
        message: '解锁成功',
        data: { unlocked: true },
      };
    }

    if (type === 'getVip') {
      // 查询 VIP 状态（预留）
      return {
        code: 0,
        message: 'success',
        data: {
          isVip: false,
          expireTime: null,
        },
      };
    }

    return {
      code: -1,
      message: '未知的操作类型',
    };
  } catch (e) {
    console.error('userStatus error:', e);
    return {
      code: -1,
      message: e.message || '操作失败',
    };
  }
};
