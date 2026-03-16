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
        'dinum-project': path.resolve(__dirname, 'dinum-project.html'),
        'dinum-activation-pipeline': path.resolve(__dirname, 'dinum-activation-pipeline.html'),
        'dinum-retention-pipeline': path.resolve(__dirname, 'dinum-retention-pipeline.html'),
        'default-interaction': path.resolve(__dirname, 'default-interaction.html'),
      },
    },
  },
  optimizeDeps: {
    include: ['@tiptap/react/menus'],
  },
});
