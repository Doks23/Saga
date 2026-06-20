/// <reference types="vitest/config" />
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const apiKey = env.GEMINI_API_KEY || '';

    return {
      server: {
        port: 3002,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        {
          name: 'inject-api-key',
          transform(code, id) {
            if (id.endsWith('.tsx') || id.endsWith('.ts') || id.endsWith('.js')) {
              const replaced = code.replace(
                /process\.env\.API_KEY/g,
                JSON.stringify(apiKey),
              );
              return { code: replaced };
            }
          },
        },
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        },
      },
      test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/test-setup.ts',
      },
    };
});
