import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// --- 🛡️ 核心补丁：全局 API 代理拦截器 ---
// 作用：强制将所有发往 Google 的请求重定向到 Vercel 代理 (/api/proxy)
// 这解决了 SDK 不听话、直连 Google 导致 400/超时的问题
const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  let url = input instanceof Request ? input.url : input.toString();
  
  // 拦截目标：generativelanguage.googleapis.com
  if (url.includes('generativelanguage.googleapis.com')) {
    // 1. 替换域名为当前网站的 /api/proxy
    // 例如：https://generativelanguage.googleapis.com/v1beta/... 
    // 变为：/api/proxy/v1beta/...
    const newUrl = url.replace('https://generativelanguage.googleapis.com', '/api/proxy');
    
    // 2. 复制配置并清理 Header
    const newInit = { ...init };
    if (newInit.headers) {
      // 必须删除 SDK 自带的假 Key，否则代理转发时 Google 会报错
      const headers = new Headers(newInit.headers);
      headers.delete('x-goog-api-key'); 
      newInit.headers = headers;
    }

    // 3. 发起新请求
    return originalFetch(newUrl, newInit);
  }
  
  return originalFetch(input, init);
};
// --- 补丁结束 ---

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element");

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);