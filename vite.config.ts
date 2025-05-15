// vite.config.ts with CORS proxy added to your existing configuration

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { componentTagger } from 'lovable-tagger';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: '::',
    port: 9000,
    // Add proxy configuration for CORS handling
    proxy: {
      // Proxying /api/graphql to the actual API endpoint
      '/api/graphql': {
        target: 'https://devapi.stance.health',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/graphql/, '/graphql'),
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, _req, _res) => {
            // Add API key to the proxied request
            proxyReq.setHeader(
              'x-api-key',
              '192090f41c5eac71ac2ff52e3ae4b4b80f4a083d71b64f704c0101b5b5d03e20'
            );
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
    'import.meta.env.VITE_CORS_STRATEGY': JSON.stringify('local_proxy'),
    'import.meta.env.VITE_PROXY_URL': JSON.stringify('/api/graphql'),
  },
}));
