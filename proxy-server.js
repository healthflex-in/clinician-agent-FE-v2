const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const PORT = 3001;
const app = express();

const apiProxy = createProxyMiddleware({
  changeOrigin: true,
  target: 'https://api.stance.health',
  pathRewrite: {
    '^/api/graphql': '/graphql',
  },
  onProxyReq: (proxyReq, req) => {
    proxyReq.setHeader('x-api-key', process.env.VITE_API_KEY || '');

    const orgId = req.headers['x-organization-id'];
    if (orgId) {
      proxyReq.setHeader('x-organization-id', orgId);
    }
  },
});

app.use('/api/graphql', apiProxy);

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
});
