import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_URL ?? '/',
  resolve: {
    alias: {
      '@grist-widgets/ui': path.resolve(__dirname, '../../packages/ui/src'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        crm: path.resolve(__dirname, 'index.html'),
        kanban: path.resolve(__dirname, 'kanban.html'),
      },
    },
  },
  optimizeDeps: {
    include: ['@tiptap/react/menus'],
  },
});
