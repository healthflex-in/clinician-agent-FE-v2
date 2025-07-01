const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();
const PORT = 3001;

const apiProxy = createProxyMiddleware({
  target: 'https://api.stance.health',
  changeOrigin: true,
  pathRewrite: {
    '^/api/graphql': '/graphql',
  },
  onProxyReq: (proxyReq, req) => {
    proxyReq.setHeader(
      'x-api-key',
      '192090f41c5eac71ac2ff52e3ae4b4b80f4a083d71b64f704c0101b5b5d03e20'
    );

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
