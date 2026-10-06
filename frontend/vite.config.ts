import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // `npm run dev:lan` (modo `lan`): HTTPS com certificado local, para o celular na
  // mesma rede ter câmera (design D6 da T-16). Lê também `.env.lan.local`.
  plugins: [react(), ...(mode === 'lan' ? [basicSsl()] : [])],
  server: {
    port: 5183,
    strictPort: true,
    // Modo `api` local: `VITE_API_URL=/api` e o Vite repassa para a API em
    // localhost:5080 — mesma origem, sem CORS nem conteúdo misto.
    proxy: {
      '/api': {
        target: 'http://localhost:5080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}))
