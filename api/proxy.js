export default async function handler(req, res) {
  // 1. 设置 CORS 头，允许任何来源访问（解决前端跨域问题）
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // 处理浏览器的预检请求 (OPTIONS)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // 2. 解析请求路径
    // 前端请求：/api/proxy/v1beta/models/...
    // 我们需要提取出：/v1beta/models/...
    // 这里的正则把 /api/proxy 去掉
    const urlPath = req.url.replace(/^\/api\/proxy/, '');
    
    // 3. 拼接 Google 的真实地址
    const targetUrl = new URL(`https://generativelanguage.googleapis.com${urlPath}`);
    
    // 4. 从 Vercel 环境变量中获取 Key，添加到 URL 参数中
    // 这样前端代码里就不需要存 Key 了，非常安全
    targetUrl.searchParams.append('key', process.env.GEMINI_API_KEY);

    // 5. 发起转发请求 (Server-to-Server)
    const googleRes = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
      // 如果有请求体（比如 Prompt），则转发，否则 undefined
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    // 6. 将 Google 的结果原封不动返回给前端
    const data = await googleRes.json();
    res.status(googleRes.status).json(data);

  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: 'Proxy failed', details: error.message });
  }
}