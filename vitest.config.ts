import { defineConfig } from 'vitest/config'

// Kept separate from vite.config.ts so tests don't run inside the Cloudflare worker runtime
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
})
