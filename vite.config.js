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
export default defineConfig(({ mode, command }) => {
  // Explicitly load env files from project root so Supabase URL/key are available for the build (including Capacitor).
  const env = loadEnv(mode, __dirname, '')
  const supabaseUrl = (env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
  const supabaseAnonKey = (env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim()
  process.env.VITE_SUPABASE_URL = supabaseUrl
  process.env.VITE_SUPABASE_ANON_KEY = supabaseAnonKey
  const hasSupabaseEnv = !!(supabaseUrl && supabaseAnonKey)
  if (!hasSupabaseEnv && mode !== 'test') {
    const envPath = path.join(__dirname, '.env.local')
    const envExists = fs.existsSync(envPath)
    console.warn(
      '[vite] Supabase not configured for this build. Sign-in will show "Sign-in unavailable".\n' +
        '  Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local (copy from .env.example), then run npm run build again.\n' +
        (envExists
          ? '  (.env.local exists - check variable names and that they have no typos.)'
          : '  (No .env.local file found in project root.)')
    )
  }

  // Safari rejects absolute dev URLs that use host 0.0.0.0 ("Invalid URL"). With server.host: true
  // Vite can otherwise emit those for @vite/client and modules. origin + hmr.host keep a real hostname.
  const SERVER_PORT = 5173
  const devOrigin = (process.env.VITE_DEV_SERVER_ORIGIN || `http://127.0.0.1:${SERVER_PORT}`).replace(/\/$/, '')
  let hmrHost = '127.0.0.1'
  try {
    hmrHost = new URL(devOrigin).hostname
  } catch {
    /* keep default */
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
    // Use absolute asset URLs so deep links (/messages/123, /auth/callback, etc.)
    // resolve JS/CSS correctly in production and Capacitor.
    base: '/',
    // Keep build output quiet; show Local/Network URLs for `vite` and `vite preview` (otherwise it looks hung).
    logLevel: command === 'build' ? 'error' : 'info',
    preview: {
      port: 4173,
      host: true,
      strictPort: false,
    },
    server: {
      port: SERVER_PORT,
      host: '127.0.0.1',
      strictPort: true,
      origin: devOrigin,
      hmr: {
        protocol: 'ws',
        host: hmrHost,
        port: SERVER_PORT,
        clientPort: SERVER_PORT,
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: process.env.NODE_ENV === 'production' ? false : 'inline',
      minify: isDebugBuild ? false : 'esbuild',
      chunkSizeWarningLimit: 1000, // warn above 1MB
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Vendor: React core (+ router; this app uses react-router-dom)
            if (
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/react-router')
            ) {
              return 'vendor-react'
            }
            // Vendor: Supabase
            if (id.includes('node_modules/@supabase')) {
              return 'vendor-supabase'
            }
            // Vendor: UI / charting
            if (
              id.includes('node_modules/recharts') ||
              id.includes('node_modules/d3-') ||
              id.includes('node_modules/victory')
            ) {
              return 'vendor-charts'
            }
            // Vendor: Stripe
            if (id.includes('node_modules/@stripe')) {
              return 'vendor-stripe'
            }
            // Vendor: Capacitor
            if (id.includes('node_modules/@capacitor')) {
              return 'vendor-capacitor'
            }
            // Vendor: Tanstack Query
            if (id.includes('node_modules/@tanstack')) {
              return 'vendor-query'
            }
            // App: Programme builder (large, rarely needed on first load)
            if (
              id.includes('src/pages/ProgramBuilder') ||
              id.includes('src/pages/PersonalPlanBuilder')
            ) {
              return 'chunk-program-builder'
            }
            // App: Workout player
            if (
              id.includes('src/pages/WorkoutPlayer') ||
              id.includes('src/components/workout/')
            ) {
              return 'chunk-workout'
            }
            // App: Marketing pages (not needed by app users)
            if (id.includes('src/pages/marketing/')) {
              return 'chunk-marketing'
            }
            // NOTE: Avoid manual chunk pinning for comp-prep/onboarding page groups.
            // We hit a production white-screen caused by cross-chunk circular evaluation
            // ("Cannot access <var> before initialization") between forced chunks.
            // Let Rollup decide these boundaries to keep module init order safe.
          },
        },
      },
    },
    plugins: [
      circleDependency({
        circleImportThrowErr: false,
        outputFilePath: './circular-deps.json',
      }),
      svgr({ include: '**/*.svg?react' }),
      react(),
    ],
  }
})