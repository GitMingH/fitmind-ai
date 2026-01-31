import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // 确保样式被引入

// --- 🛡️ 终极 API 拦截器 ---
const originalFetch = window.fetch;

window.fetch = async (input, init) => {
  let url = input instanceof Request ? input.url : input.toString();

  // 只拦截发往 Google 的请求
  if (url.includes('generativelanguage.googleapis.com')) {
    // 1. 将 URL 重定向到我们的 Vercel 代理
    const newUrl = url.replace('https://generativelanguage.googleapis.com', '/api/proxy');
    
    // 2. 处理 Request 对象的情况 (SDK 通常用这个)
    if (input instanceof Request) {
      // 创建新 Request，指向新 URL
      // 这里的关键是：使用 newUrl，并继承原 input 的 body/headers
      const newRequest = new Request(newUrl, input);
      
      // 删除 SDK 自带的 Header 中的假 Key
      newRequest.headers.delete('x-goog-api-key');
      
      return originalFetch(newRequest);
    } 
    
    // 3. 处理普通 URL 字符串的情况
    const newInit = { ...(init || {}) };
    const newHeaders = new Headers(newInit.headers || {});
    newHeaders.delete('x-goog-api-key'); // 删假 Key
    newInit.headers = newHeaders;
    
    return originalFetch(newUrl, newInit);
  }

  // 非 Google 请求，直接放行
  return originalFetch(input, init);
};
// --- 拦截器结束 ---

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element");

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);