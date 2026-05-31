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
        content: `你是专业海外大学升学顾问，服务对象是高一已考完AP、正在选择大学专业的学生。
请根据学生全部答题结果，进行专业分析：
1. 学生性格、优势、能力特点
2. 推荐最适合的 3 个海外大学专业
3. 每个专业的匹配度
4. 适合留学的国家
5. 未来就业方向
报告语言正式、清晰、专业、简洁。`
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
