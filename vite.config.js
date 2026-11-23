import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

// The Worker serves ./dist as static assets (see wrangler.toml). Everything runs in the browser.
export default defineConfig({
  plugins: [react()],
  build: {outDir: 'dist', chunkSizeWarningLimit: 4000},
});
