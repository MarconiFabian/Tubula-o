import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Aumenta o limite do aviso para 2500kb (2.5MB) para silenciar o aviso no Vercel
    // devido às bibliotecas pesadas de 3D e PDF.
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        // Separa as bibliotecas (node_modules) em um arquivo 'vendor' separado
        // Isso ajuda o navegador a fazer cache das bibliotecas separadamente do seu código
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
  },
})