export default async function handler(req, res) {
  // 设置 CORS 允许前端访问
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // 1. 解析真实路径 (去掉 /api/proxy)
    const urlPath = req.url.replace(/^\/api\/proxy/, '');
    
    // 2. 拼接 Google 目标地址
    const targetUrl = new URL(`https://generativelanguage.googleapis.com${urlPath}`);
    
    // 3. 【关键】添加 Vercel 环境变量里的真 Key
    targetUrl.searchParams.append('key', process.env.GEMINI_API_KEY);

    // 4. 转发请求 (不带 headers，避免带上前端的假 Key)
    const googleRes = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });

    const data = await googleRes.json();
    res.status(googleRes.status).json(data);

  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: error.message });
  }
}