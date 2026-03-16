import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import { defineConfig, loadEnv } from 'vite'
import circleDependency from 'vite-plugin-circular-dependency'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Set VITE_BUILD_DEBUG=1 (or use npm run build:debug) to disable minification so runtime
// errors show real variable names (e.g. "nutritionLatestWeek" instead of "kn") for faster fault finding.
const isDebugBuild = process.env.VITE_BUILD_DEBUG === '1'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Explicitly load .env from project root so Supabase URL/key are available for the build (including Capacitor).
  const env = loadEnv(mode, __dirname, '')
  const supabaseUrl = (env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
  const supabaseAnonKey = (env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim()
  process.env.VITE_SUPABASE_URL = supabaseUrl
  process.env.VITE_SUPABASE_ANON_KEY = supabaseAnonKey
  const hasSupabaseEnv = !!(supabaseUrl && supabaseAnonKey)
  if (!hasSupabaseEnv && mode !== 'test') {
    const envPath = path.join(__dirname, '.env')
    const envExists = fs.existsSync(envPath)
    console.warn(
      '[vite] Supabase not configured for this build. Sign-in will show "Sign-in unavailable".\n' +
        '  Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env (copy from .env.example), then run npm run build again.\n' +
        (envExists ? '  (.env exists - check variable names and that they have no typos.)' : '  (No .env file found in project root.)')
    )
  }

  return {
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
    base: './',
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
  }
})