export default async function handler(req, res) {
  // CORS 配置
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // 1. 还原路径
    const urlPath = req.url.replace(/^\/api\/proxy/, '');
    const targetUrl = new URL(`https://generativelanguage.googleapis.com${urlPath}`);

    // 2. 【核心修复】强制删除前端传来的假 Key，防止冲突
    targetUrl.searchParams.delete('key'); 
    
    // 3. 填入 Vercel 环境变量里的真 Key
    targetUrl.searchParams.append('key', process.env.GEMINI_API_KEY);

    // 4. 转发请求
    // 注意：headers 不能直接透传，否则 Host 会冲突，且需确保 content-type 正确
    const headers = {
      'Content-Type': 'application/json',
    };

    const googleRes = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: headers,
      // 只有非 GET/HEAD 请求才带 Body
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    const data = await googleRes.json();
    
    // 如果 Google 返回错误，打印出来方便调试
    if (!googleRes.ok) {
      console.error('Google API Error:', data);
    }

    res.status(googleRes.status).json(data);

  } catch (error) {
    console.error('Proxy Internal Error:', error);
    res.status(500).json({ error: 'Proxy failed', details: error.message });
  }
}