import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import './index.css'
import App from './App.tsx'
import { loadBackend } from './shared/backend'

const root = document.getElementById('root')!

// O backend (Supabase ou API, por VITE_BACKEND) é carregado antes do primeiro render
// (design D1 da T-16). Configuração ausente ou inválida para aqui, com a variável
// nomeada na tela — difícil de depurar no celular só pelo console.
loadBackend().then(
  () =>
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  (error: unknown) => {
    console.error(error)
    root.textContent = error instanceof Error ? error.message : String(error)
    root.style.cssText =
      'padding: 24px; font-family: system-ui, sans-serif; color: #b42318; white-space: normal; overflow-wrap: anywhere;'
  },
)
