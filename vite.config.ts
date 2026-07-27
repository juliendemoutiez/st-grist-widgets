import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_URL ?? '/',
  resolve: {
    alias: {
      '@grist-widgets/ui': path.resolve(__dirname, 'src/lib'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        'nested-form': path.resolve(__dirname, 'pages/nested-form.html'),
        'kanban': path.resolve(__dirname, 'pages/kanban.html'),
        'todo': path.resolve(__dirname, 'pages/todo.html'),
        'schema-diagram': path.resolve(__dirname, 'pages/schema-diagram.html'),
        'notes': path.resolve(__dirname, 'pages/notes.html'),
        'chart-heatmap': path.resolve(__dirname, 'pages/chart-heatmap.html'),
        'chart-barres': path.resolve(__dirname, 'pages/chart-barres.html'),
        'chart-ligne': path.resolve(__dirname, 'pages/chart-ligne.html'),
        'chart-objectif': path.resolve(__dirname, 'pages/chart-objectif.html'),
        'chart-dashboard': path.resolve(__dirname, 'pages/chart-dashboard.html'),
      },
    },
  },
});
