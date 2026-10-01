import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

// Version comes from package.json so there's one place to bump it; the build
// date is stamped at build time. Both are shown in the footer and About page.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  // Pinned, not incidental: this origin is on Supabase's OAuth redirect
  // allowlist. strictPort makes a busy port fail loudly rather than silently
  // shifting to 5174 and breaking sign-in.
  server: { port: 5173, strictPort: true },
})
