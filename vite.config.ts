import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Pinned, not incidental: this origin is on Supabase's OAuth redirect
  // allowlist. strictPort makes a busy port fail loudly rather than silently
  // shifting to 5174 and breaking sign-in.
  server: { port: 5173, strictPort: true },
})
