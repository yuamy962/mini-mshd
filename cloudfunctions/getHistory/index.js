const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;

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

  const { page = 1, pageSize = 20 } = event;

  try {
    const countRes = await db.collection('usage').where({
      openid: openid,
    }).count();

    const total = countRes.total;

    const listRes = await db.collection('usage')
      .where({
        openid: openid,
      })
      .orderBy('createTime', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    const list = listRes.data.map(item => {
      const date = item.createTime ? new Date(item.createTime) : new Date();
      return {
        _id: item._id,
        role: item.role,
        question: item.question,
        background: item.background,
        result: item.result,
        dateStr: `${date.getMonth() + 1}月${date.getDate()}日`,
        timeStr: `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`,
      };
    });

    return {
      code: 0,
      message: 'success',
      data: {
        list,
        total,
        page,
        pageSize,
        hasMore: total > page * pageSize,
      },
    };
  } catch (e) {
    console.error('获取历史记录失败:', e);
    return {
      code: -1,
      message: e.message || '获取失败',
    };
  }
};
