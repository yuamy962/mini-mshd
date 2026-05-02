const cloud = require('wx-server-sdk');
const axios = require('axios');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const MAX_DAILY_QUOTA = 3;

/**
 * 构建 Normal 模式 Prompt（v1.3 增加 summary_comment + risk_tip）
 */
function buildNormalPrompt(role, question, background) {
  return `你是一位资深HR和面试教练。

请根据以下信息，生成一份高质量面试回答：

【岗位】：${role}
【问题】：${question}
【候选人背景】：${background || '未提供'}

要求：
1. 回答真实自然，不要AI感
2. 适合中国职场语境
3. 控制在1分钟表达长度
4. 必须按以下JSON格式输出，不要包含任何其他文字：

{
  "answer": "面试回答（标准版）",
  "advanced": "加分表达（更高级一点）",
  "insight": "面试官在想什么（评估维度：稳定性、逻辑能力、可培养性）",
  "followup": "可能的追问 + 建议回答",
  "score": {
    "total": 85,
    "clarity": 88,
    "logic": 82,
    "authenticity": 86,
    "target": 92,
    "suggestion": "具体优化建议"
  },
  "recommendQuestions": ["自我介绍", "优缺点", "职业规划"],
  "summary_comment": "一句话点评这个回答的优缺点，例如：这是一个逻辑清晰但略偏保守的回答",
  "risk_tip": "面试雷点提醒，指出这个回答中容易被面试官追问或质疑的地方",
  "improved_score": 92
}

评分规则（score）：
- total: 总分 0-100
- clarity: 表达清晰度 0-100
- logic: 逻辑结构 0-100
- authenticity: 真实感 0-100
- target: 优化后可达分数
- suggestion: 一句话优化建议

推荐问题规则（recommendQuestions）：
- 根据岗位和问题，推荐3个最可能被追问的相关问题
- 用中文短语，每个不超过8个字

一句话点评（summary_comment）：
- 用一句话概括这个回答的核心特点
- 格式：这是一个"xxx但xxx"的回答
- 字数控制在20字以内

面试雷点提醒（risk_tip）：
- 指出原回答中最容易被面试官抓住追问的点
- 给出一句具体、 actionable 的提醒
- 字数控制在30字以内

风格：
- 不要空话
- 不要鸡汤
- 要具体`;
}

/**
 * 构建 Advanced 模式 Prompt（90+ 高分优化版本）
 */
function buildAdvancedPrompt(role, question, background, originalAnswer) {
  return `你是一位有5-10年经验的面试教练，同时也是一线业务负责人（而不是HR）。

请基于真实职场经验，帮候选人优化一段"更有说服力、更像真人"的高分面试回答。

【岗位】：${role}
【问题】：${question}
【候选人背景】：${background || '未提供'}
【原回答参考】：${originalAnswer || '未提供'}

目标：生成一份能让面试官"认可你能干活"的回答，而不是空泛表达。

请严格按照以下JSON格式输出，不要包含任何其他文字：

{
  "highScoreAnswer": "高分回答（90分+版本），用具体经历表达，包含STAR结构，加入数字和案例",
  "optimizationNote": "优化点说明：指出原回答的问题，并说明为什么这样优化更好",
  "enhancedInsight": "面试官视角强化：说明这个回答为什么会打动面试官，体现抗压/逻辑/价值",
  "deepFollowup": "潜在追问（更深一层）：给出1个更刁钻的追问 + 高质量回答"
}

高分回答要求（highScoreAnswer）：
- 用"具体经历"表达，而不是抽象总结
- 必须包含：场景 + 行动 + 结果（STAR结构）
- 尽量加入细节（数字、案例、结果变化）
- 语气自然，像真实工作的人在讲，而不是背稿
- 控制在1分钟口语表达长度

风格要求：
- 禁止空话（如：我很努力 / 我很负责）
- 禁止模板化表达
- 必须像真实经历

额外要求（关键）：
👉 如果背景信息不足，请合理补充一个"可信的场景"，但不要夸张
👉 输出必须让人感觉"这是一个真实干过活的人说的"`;
}

/**
 * 检查并扣除次数
 */
async function checkAndDeductQuota(openid) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const quotaRes = await db.collection('quota').where({
    openid: openid,
    date: dateStr,
  }).get();

  let usedCount = 0;
  if (quotaRes.data.length > 0) {
    usedCount = quotaRes.data[0].usedCount || 0;
  }

  if (usedCount >= MAX_DAILY_QUOTA) {
    return {
      canUse: false,
      remaining: 0,
    };
  }

  // 扣减次数
  if (quotaRes.data.length > 0) {
    await db.collection('quota').doc(quotaRes.data[0]._id).update({
      data: {
        usedCount: db.command.inc(1),
        updateTime: db.serverDate(),
      },
    });
  } else {
    await db.collection('quota').add({
      data: {
        openid: openid,
        date: dateStr,
        usedCount: 1,
        createTime: db.serverDate(),
        updateTime: db.serverDate(),
      },
    });
  }

  return {
    canUse: true,
    remaining: MAX_DAILY_QUOTA - usedCount - 1,
  };
}

/**
 * 保存使用记录
 */
async function saveUsage(openid, role, question, background, result, mode) {
  try {
    await db.collection('usage').add({
      data: {
        openid: openid,
        role: role,
        question: question,
        background: background || '',
        result: result,
        mode: mode || 'normal',
        createTime: db.serverDate(),
      },
    });
  } catch (e) {
    console.error('保存使用记录失败:', e);
  }
}

/**
 * 调用 DeepSeek API
 */
async function callDeepSeek(prompt) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('未配置 DEEPSEEK_API_KEY');
  }

  const res = await axios.post(
    'https://api.deepseek.com/chat/completions',
    {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: '你是一个专业的面试回答生成助手，输出必须严格为JSON格式。' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );

  const content = res.data.choices[0].message.content;
  return JSON.parse(content);
}

// 云函数入口
exports.main = async (event, context) => {
  const { role, question, background, mode = 'normal', originalAnswer } = event;

  if (!role || !question) {
    return {
      code: -1,
      message: '岗位和面试问题不能为空',
    };
  }

  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  if (!openid) {
    return {
      code: -1,
      message: '未获取到用户信息',
    };
  }

  // 1. 检查次数
  const quotaResult = await checkAndDeductQuota(openid);
  if (!quotaResult.canUse) {
    return {
      code: -2,
      message: '今日免费次数已用完，明天再来吧~',
    };
  }

  try {
    // 2. 根据 mode 选择 Prompt 并调用 AI
    let prompt;
    if (mode === 'advanced') {
      prompt = buildAdvancedPrompt(role, question, background, originalAnswer);
    } else {
      prompt = buildNormalPrompt(role, question, background);
    }

    const aiResult = await callDeepSeek(prompt);

    // 3. 保存记录
    await saveUsage(openid, role, question, background, aiResult, mode);

    // 4. 组装返回数据
    if (mode === 'advanced') {
      return {
        code: 0,
        message: 'success',
        remaining: quotaResult.remaining,
        data: {
          highScoreAnswer: aiResult.highScoreAnswer || '',
          optimizationNote: aiResult.optimizationNote || '',
          enhancedInsight: aiResult.enhancedInsight || '',
          deepFollowup: aiResult.deepFollowup || '',
        },
      };
    }

    // normal 模式
    const score = aiResult.score || {};
    const recommendQuestions = aiResult.recommendQuestions || [];

    return {
      code: 0,
      message: 'success',
      remaining: quotaResult.remaining,
      data: {
        answer: aiResult.answer || '',
        advanced: aiResult.advanced || '',
        insight: aiResult.insight || '',
        followup: aiResult.followup || '',
        score: {
          total: score.total || 0,
          clarity: score.clarity || 0,
          logic: score.logic || 0,
          authenticity: score.authenticity || 0,
          target: score.target || 0,
          suggestion: score.suggestion || '',
        },
        recommendQuestions: Array.isArray(recommendQuestions) ? recommendQuestions : [],
        summaryComment: aiResult.summary_comment || aiResult.summaryComment || '',
        riskTip: aiResult.risk_tip || aiResult.riskTip || '',
        improvedScore: aiResult.improved_score || aiResult.improvedScore || score.target || 0,
      },
    };
  } catch (e) {
    console.error('生成失败:', e);
    return {
      code: -1,
      message: e.message || '生成失败，请稍后重试',
    };
  }
};
