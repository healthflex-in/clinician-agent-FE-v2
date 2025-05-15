// Simple Express proxy server to solve CORS issues
// Save this as proxy-server.js

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();
const PORT = 3001;

// Configure proxy middleware
const apiProxy = createProxyMiddleware({
  target: 'https://devapi.stance.health',
  changeOrigin: true,
  pathRewrite: {
    '^/api/graphql': '/graphql', // rewrite path
  },
  onProxyReq: (proxyReq, req, res) => {
    // Add the API key to the proxied request
    proxyReq.setHeader(
      'x-api-key',
      '192090f41c5eac71ac2ff52e3ae4b4b80f4a083d71b64f704c0101b5b5d03e20'
    );
  },
});

// Use the proxy for all requests to /api/graphql
app.use('/api/graphql', apiProxy);

// Start the server
app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
});

/*
To use this proxy server:

1. Install the required packages:
   npm install express http-proxy-middleware

2. Run the proxy server:
   node proxy-server.js

3. In your frontend code, point your requests to:
   http://localhost:3001/api/graphql
   
With this setup, your frontend code will send requests to your local proxy server,
which will add the necessary headers and forward the request to the actual API.
*/
