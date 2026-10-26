import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative asset paths so the build works from a repo subpath (GitHub Pages) as well as a root domain.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 3000,
    open: false
  }
});
