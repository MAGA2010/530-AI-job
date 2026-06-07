const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 访问统计 + 管理员账号
let stats = { visits: 0, users: 0 };
const ADMIN = { user: "admin", pwd: "admin123" };

app.get('/api/visit', (req, res) => {
  stats.visits++;
  res.json({ ok: 1 });
});

app.post('/api/admin', (req, res) => {
  const { user, pwd } = req.body;
  if (user === ADMIN.user && pwd === ADMIN.pwd) {
    res.json({ stats });
  } else {
    res.json({ error: "无权限" });
  }
});

app.post('/api/new-user', (req, res) => {
  stats.users++;
  res.json({ ok: 1 });
});

// 适配 Xiaomi MIMO Token Plan 的AI出题接口
app.post('/api/ai-question', async (req, res) => {
  try {
    const resp = await axios.post("https://token-plan-cn.xiaomimimo.com/v1/chat/completions", {
      model: "mimo-v2.5-pro",
      messages: [{
        role: "user",
        content: `你是专业的海外大学升学顾问。
你的服务对象是：高一已考完AP、正在准备选择大学专业的学生。
请根据学生之前的答题情况，深度分析他的兴趣、能力、优势、学习风格，
然后生成1道适合AP体系学生的海外大学专业选择测评选择题，
必须包含4个选项，只返回标准JSON格式：
{"q":"题目内容","o":["选项A","选项B","选项C","选项D"]}`
      }],
      temperature: 0.7
    }, {
      headers: {
        "Authorization": `Bearer ${process.env.AI_API_KEY}`,
        "Content-Type": "application/json"
      }
    });
    res.json(JSON.parse(resp.data.choices[0].message.content));
  } catch (e) {
    console.error("AI出题失败:", e.response?.data || e.message);
    res.json({ q: "AI出题暂时不可用", o: ["继续"] });
  }
});

// 适配 Xiaomi MIMO Token Plan 的AI报告接口
app.post('/api/ai-report', async (req, res) => {
  try {
    const { answers } = req.body;
    const resp = await axios.post("https://token-plan-cn.xiaomimimo.com/v1/chat/completions", {
      model: "mimo-v2.5-pro",
      messages: [{
        role: "user",
        content: `你是一位深耕职业规划与专业选择领域的资深顾问，擅长为高一阶段、已完成AP课程的学生，基于其兴趣与能力倾向，提供精准、可落地的专业方向指引。你的风格是：专业严谨、逻辑清晰、语言精炼、建议可执行，避免空洞的套话和无关的院校推荐。

你的任务是，根据学生的所有答题结果，生成一份以「专业选择与职业发展」为核心的个性化测评报告。报告必须包含以下模块，且所有分析都需紧密结合学生的答题倾向：

1.  **学生核心特质与能力画像**
    - 性格与思维模式：提炼学生的核心性格特质、决策偏好和思维模式（如逻辑型、创造型、协作型等），并说明其如何影响专业与职业选择。
    - 能力优势与短板：重点分析学生在数理分析、语言表达、逻辑推理、动手实践、沟通协作、创新创造等方面的核心竞争力与待提升领域。
    - 兴趣倾向总结：从答题结果中归纳学生的核心兴趣方向（如人文社科、自然科学、工程技术、商业管理、艺术设计等），明确其兴趣的稳定性与适配场景。

2.  **Top 3 推荐专业方向（核心部分）**
    - 为学生推荐3个最匹配的专业方向，按适配度从高到低排序。
    - 对每个专业方向进行深度分析：
      - 专业核心定义与学习内容：用通俗语言解释该专业学什么、研究什么，包含哪些核心分支。
      - 适配学生的理由：明确指出学生的哪些答题结果、性格特质或能力优势，与该专业高度匹配。
      - 专业能力要求：说明学习该专业需要具备哪些关键能力，学生目前的优势与差距在哪里。
      - 学习路径建议：高一阶段可以提前做哪些准备（如AP科目选择、课外阅读、实践活动等），为后续学习打下基础。

3.  **专业适配度量化评估**
    - 对每个推荐专业给出0-100%的匹配度分数，并详细说明加分项（如学生的XX特质与专业要求高度契合）和扣分项（如学生在XX能力上存在短板，可能影响学习体验）。
    - 对比分析不同专业方向的优劣势，帮助学生理解推荐逻辑，清晰看到自己的适配场景。

4.  **专业对应的职业发展路径与前景**
    - 为每个推荐专业方向，梳理清晰的职业发展路径：从基础岗位到进阶岗位的典型路线。
    - 重点介绍该专业对应的核心就业领域、代表性职业类型、行业发展趋势和市场需求前景。
    - 结合学生的特质，给出职业选择的倾向性建议（如更适合技术研发岗、管理岗、创意岗还是服务岗）。

5.  **后续行动建议**
    - 针对学生的情况，给出可落地的短期行动建议，帮助学生进一步验证自己的专业兴趣。
    - 包括但不限于：可以尝试的入门课程、推荐阅读的书籍、相关的线上体验项目或实践活动方向。

报告语言必须正式、专业、简洁，结构清晰，分点明确，避免口语化表达，无需提及具体的大学或院校。请直接开始生成报告。`
      }],
      temperature: 0.7
    }, {
      headers: {
        "Authorization": `Bearer ${process.env.AI_API_KEY}`,
        "Content-Type": "application/json"
      }
    });
    res.json({ report: resp.data.choices[0].message.content });
  } catch (e) {
    console.error("报告生成失败:", e.response?.data || e.message);
    res.json({ report: "报告生成失败，请稍后再试" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server started on port", PORT));
