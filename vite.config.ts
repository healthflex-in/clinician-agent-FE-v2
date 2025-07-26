// vite.config.ts with CORS proxy added to your existing configuration

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { componentTagger } from 'lovable-tagger';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    port: 9000,
    proxy: {
      '/api/graphql': {
        target: process.env.VITE_API_URL || 'http://localhost:8080/graphql',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/graphql/, '/graphql'),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            proxyReq.setHeader(
              'x-api-key',
              '192090f41c5eac71ac2ff52e3ae4b4b80f4a083d71b64f704c0101b5b5d03e20'
            );

            const orgId = req.headers['x-organization-id'];
            if (orgId) {
              proxyReq.setHeader('x-organization-id', orgId);
            }
          });
        },
      },
    },
  },
  plugins: [react(), mode === 'development' && componentTagger()].filter(
    Boolean
  ),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Define environment variables with default values
  define: {
    'import.meta.env.VITE_CORS_STRATEGY': JSON.stringify('direct'),
    // 'import.meta.env.VITE_CORS_STRATEGY': JSON.stringify('local_proxy'),
    // 'import.meta.env.VITE_PROXY_URL': JSON.stringify('/api/graphql'),
  },
}));
