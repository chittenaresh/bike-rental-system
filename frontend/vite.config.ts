import { defineConfig, loadEnv, Plugin, LogLevel } from 'vite';
import react from '@vitejs/plugin-react-swc';

// Plugin to suppress proxy connection errors in development
function suppressProxyErrors(): Plugin {
  return {
    name: 'suppress-proxy-errors',
    configureServer() {
      // Override stderr to filter proxy errors
      const originalError = process.stderr.write.bind(process.stderr);
      process.stderr.write = (
        chunk: string | Uint8Array,
        encoding?: BufferEncoding | ((error?: Error | null) => void),
        cb?: (error?: Error | null) => void
      ) => {
        const message = chunk?.toString() || '';
        // Suppress specific proxy connection errors
        if (
          message.includes('http proxy error') ||
          (message.includes('ECONNREFUSED') && message.includes('/api'))
        ) {
          // Silently ignore - backend might not be running
          if (typeof encoding === 'function') {
            encoding();
          } else if (typeof cb === 'function') {
            cb();
          }
          return true;
        }
        return originalError(chunk, encoding as any, cb as any);
      };
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }: { mode: string }) => {
  const env = loadEnv(mode, process.cwd());
  const target = env.VITE_API_PROXY_TARGET || 'http://localhost:3020';
  const isProduction = mode === 'production';

  return {
    server: {
      host: '::',
      port: 8080,
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
          secure: false,
          ws: true,
        },
      },
    },
    plugins: [react(), suppressProxyErrors()],
    resolve: {
      alias: {
        '@': '/src',
      },
    },
    build: {
      // Production optimizations
      target: 'es2020',
      minify: 'esbuild' as const,
      cssMinify: true,
      sourcemap: (isProduction ? 'hidden' : true) as boolean | 'hidden' | 'inline',
      // Increase chunk size warning limit
      chunkSizeWarningLimit: 1000,
      reportCompressedSize: false, // Speed up build
    },
    logLevel: (isProduction ? 'warn' : 'info') as LogLevel,
    clearScreen: false,
  };
});
