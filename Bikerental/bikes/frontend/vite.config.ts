import { defineConfig, loadEnv, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
// No Node path imports to avoid TS Node type dependency

// Plugin to suppress proxy connection errors in development
function suppressProxyErrors(): Plugin {
  return {
    name: 'suppress-proxy-errors',
    configureServer(server) {
      // Override stderr to filter proxy errors
      const originalError = process.stderr.write.bind(process.stderr);
      process.stderr.write = (chunk: any, encoding?: any, cb?: any) => {
        const message = chunk?.toString() || '';
        // Suppress specific proxy connection errors
        if (
          message.includes('http proxy error') ||
          (message.includes('ECONNREFUSED') && message.includes('/api'))
        ) {
          // Silently ignore - backend might not be running
          return true;
        }
        return originalError(chunk, encoding, cb);
      };
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  const target = env.VITE_API_PROXY_TARGET || "http://localhost:3000";
  const isProduction = mode === 'production';
  
  return {
    server: {
      host: "::",
      port: 8080,
      proxy: {
        "/api": {
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
        "@": "/src",
      },
    },
    build: {
      // Production optimizations
      target: 'es2020',
      minify: 'esbuild',
      cssMinify: true,
      sourcemap: !isProduction,
      // Increase chunk size warning limit
      chunkSizeWarningLimit: 1000,
      reportCompressedSize: false, // Speed up build
    },
    logLevel: isProduction ? 'warn' : 'info',
    clearScreen: false,
  };
});
