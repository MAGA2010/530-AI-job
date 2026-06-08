const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static('public'));

// ============ 配置 ============
const AI_API_KEY = process.env.AI_API_KEY;
const PORT = process.env.PORT || 10000;

if (!AI_API_KEY) {
  console.warn('⚠️  警告: AI_API_KEY 未设置，AI功能将不可用');
}

// ============ 格式化答题数据 ============
function formatAnswers(answers) {
  return answers.map((a, i) => {
    return `第${i+1}题：${a.question}\n学生选择了：${a.selected}`;
  }).join('\n\n');
}

// ============ AI 出题 ============
app.post('/api/ai-question', async (req, res) => {
  if (!AI_API_KEY) {
    return res.json({ q: "AI服务未配置，暂时无法出题", o: ["跳过", "跳过", "跳过", "跳过"] });
  }
  try {
    const { answers } = req.body || {};
    if (!Array.isArray(answers)) {
      return res.status(400).json({ error: '参数错误' });
    }
    const answerSummary = formatAnswers(answers);
    const resp = await axios.post("https://token-plan-cn.xiaomimimo.com/v1/chat/completions", {
      model: "mimo-v2.5-pro",
      messages: [{
        role: "user",
        content: `你是专业的海外大学升学顾问，专注于为AP体系学生提供专业选择指导。

以下是学生已完成的基础测评答题记录：
${answerSummary}

【你的任务】
基于以上答题记录，深度分析学生的：
1. 兴趣倾向（理工/人文/社科/艺术）
2. 能力优势（逻辑分析/语言表达/沟通协作/创意设计）
3. 思维方式（理性型/感性型/实践型/创新型）
4. 学习风格（独立研究/团队合作/动手实践/理论学习）

然后生成1道能进一步探明学生专业倾向的自适应选择题。

【出题要求】
- 题目应针对学生答题中暴露的模糊地带或潜在兴趣进行深入挖掘
- 选项应涵盖不同专业方向，帮助区分学生的真实偏好
- 避免与已有题目重复
- 只返回JSON格式：{"q":"题目","o":["A","B","C","D"]}`
      }],
      temperature: 0.7
    }, {
      headers: {
        "Authorization": `Bearer ${AI_API_KEY}`,
        "Content-Type": "application/json"
      },
      timeout: 30000
    });
    const content = resp.data.choices[0].message.content;
    const parsed = JSON.parse(content);
    if (!parsed.q || !Array.isArray(parsed.o) || parsed.o.length !== 4) {
      throw new Error('AI返回格式不正确');
    }
    res.json(parsed);
  } catch (e) {
    console.error("AI出题失败:", e.response?.data || e.message);
    res.json({ q: "AI出题暂时不可用，请跳过此题", o: ["跳过", "跳过", "跳过", "跳过"] });
  }
});

// ============ AI 报告 ============
app.post('/api/ai-report', async (req, res) => {
  if (!AI_API_KEY) {
    return res.json({ report: "AI服务未配置，请联系管理员设置 AI_API_KEY 环境变量。" });
  }
  try {
    const { answers } = req.body || {};
    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ error: '答题数据为空' });
    }
    const answerSummary = formatAnswers(answers);
    const resp = await axios.post("https://token-plan-cn.xiaomimimo.com/v1/chat/completions", {
      model: "mimo-v2.5-pro",
      messages: [{
        role: "user",
        content: `你是一位深耕职业规划与专业选择领域的资深顾问，擅长为高一阶段、已完成AP课程的学生，基于其兴趣与能力倾向，提供精准、可落地的专业方向指引。

【重要原则】
- 你的所有分析必须基于学生的真实答题选择，不能凭空推测
- 在分析中要引用学生具体选择了什么，例如："你在第X题选择了XX，说明你..."
- 推荐的专业方向必须与学生的答题倾向逻辑一致

以下是学生的完整答题记录：
${answerSummary}

请根据以上答题记录，生成个性化测评报告，包含以下模块：

1.  **学生核心特质与能力画像**
    - 兴趣倾向：从答题中归纳学生的核心兴趣（理工/人文/社科/艺术），引用具体题目选择作为依据
    - 能力优势：分析学生在逻辑分析、语言表达、沟通协作、创意设计等方面的表现
    - 思维方式：判断学生是理性型、感性型、实践型还是创新型

2.  **Top 3 推荐专业方向**
    - 按适配度排序，每个专业都要说明：
      - 为什么适合这个学生（引用具体答题选择）
      - 专业学什么、未来做什么
      - 高一阶段可以做什么准备

3.  **专业适配度评分**
    - 给出0-100%的匹配度分数
    - 说明加分项和扣分项

4.  **职业发展路径**
    - 每个推荐专业的典型职业路线
    - 行业前景和市场需求

5.  **行动建议**
    - 具体可执行的下一步行动

报告语言正式、专业、简洁，直接开始生成。`
      }],
      temperature: 0.7
    }, {
      headers: {
        "Authorization": `Bearer ${AI_API_KEY}`,
        "Content-Type": "application/json"
      },
      timeout: 120000
    });
    res.json({ report: resp.data.choices[0].message.content });
  } catch (e) {
    console.error("报告生成失败:", e.response?.data || e.message);
    res.json({ report: "报告生成失败，请稍后再试。\n错误信息：" + (e.message || '未知错误') });
  }
});

// ============ 报告存储（localStorage 备份） ============
const fs = require('fs');
const path = require('path');
const REPORTS_DIR = path.join(__dirname, 'data', 'reports');
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

app.post('/api/report/save', (req, res) => {
  const { username, report } = req.body || {};
  if (!username || !report) return res.status(400).json({ error: '参数错误' });
  const safeName = username.replace(/[^a-zA-Z0-9\u4e00-\u9fff_\-]/g, '_');
  const filePath = path.join(REPORTS_DIR, `${safeName}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify({ username, report, date: new Date().toISOString() }));
    res.json({ ok: 1 });
  } catch (e) {
    res.status(500).json({ error: '保存失败' });
  }
});

app.get('/api/report/:username', (req, res) => {
  const safeName = req.params.username.replace(/[^a-zA-Z0-9\u4e00-\u9fff_\-]/g, '_');
  const filePath = path.join(REPORTS_DIR, `${safeName}.json`);
  try {
    if (fs.existsSync(filePath)) {
      res.json(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
    } else {
      res.json({ report: null });
    }
  } catch (e) {
    res.status(500).json({ error: '读取失败' });
  }
});

app.listen(PORT, () => console.log(`✅ Server started on port ${PORT}`));
