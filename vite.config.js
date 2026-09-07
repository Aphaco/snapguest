import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunks
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react'
            }
            if (id.includes('@supabase') || id.includes('supabase')) {
              return 'vendor-supabase'
            }
            if (id.includes('bootstrap') || id.includes('react-bootstrap')) {
              return 'vendor-bootstrap'
            }
            if (id.includes('qrcode') || id.includes('date-fns') || id.includes('uuid')) {
              return 'vendor-utils'
            }
            return 'vendor'
          }
          return null
        }
      }
    }
  }
})