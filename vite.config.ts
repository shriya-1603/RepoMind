import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  css: {
    postcss: {
      plugins: [
        tailwindcss,
        autoprefixer,
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/analyze-repo': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/analyze-local': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/analysis-status': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/repo-summary': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/repository-summary-real': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/repositories': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/graph-real': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/graph': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/impact-analysis-real': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/impact-analysis': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/semantic-search-real': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/semantic-search': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/change-simulation-real': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/change-simulation': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/repository-activity': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
