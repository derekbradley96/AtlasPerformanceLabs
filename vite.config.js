import path from 'path'
import { fileURLToPath } from 'url'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import { defineConfig } from 'vite'
import circleDependency from 'vite-plugin-circular-dependency'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Set VITE_BUILD_DEBUG=1 (or use npm run build:debug) to disable minification so runtime
// errors show real variable names (e.g. "nutritionLatestWeek" instead of "kn") for faster fault finding.
const isDebugBuild = process.env.VITE_BUILD_DEBUG === '1'

// https://vite.dev/config/
export default defineConfig({
  root: __dirname,
  optimizeDeps: { entries: ['index.html'] },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx,js,jsx}'],
    exclude: ['src/lib/intelligence/__tests__/rules.test.js'],
    environment: 'node',
    passWithNoTests: true,
  },
  base: "./",
  logLevel: 'error',
  server: {
    port: 5174,
    host: true,
    strictPort: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: isDebugBuild ? false : 'esbuild',
    rollupOptions: {
      external: ['@capacitor/local-notifications', '@capacitor/share'],
    },
  },
  plugins: [
    circleDependency({ circleImportThrowErr: true }),
    svgr({ include: '**/*.svg?react' }),
    react(),
  ],
});