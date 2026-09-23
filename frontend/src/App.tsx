import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { CompleteSignupPage } from './features/auth/CompleteSignupPage'
import { PublicOnly, RequireNoPetshop, RequireReady } from './features/auth/guards'
import { LoginPage } from './features/auth/LoginPage'
import { SessionProvider } from './features/auth/SessionProvider'
import { SignupPage } from './features/auth/SignupPage'
import { SettingsPage } from './features/petshop/SettingsPage'
import { ProductsPage } from './features/products/ProductsPage'
import { ScannerSpike } from './features/scanner/ScannerSpike'
import { AppShell } from './shared/ui/AppShell'
import { Icon } from './shared/ui/Icon'

/** Spike de T-01, público até T-07 integrar o scanner ao cadastro. */
function SpikePage() {
  return (
    <main>
      <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name="paw" />
        PetGest — Spike do scanner
      </h1>
      <ScannerSpike />
    </main>
  )
}

function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <Routes>
          <Route path="/spike" element={<SpikePage />} />

          <Route element={<PublicOnly />}>
            <Route path="/entrar" element={<LoginPage />} />
            <Route path="/criar-conta" element={<SignupPage />} />
          </Route>

          <Route element={<RequireNoPetshop />}>
            <Route path="/concluir-cadastro" element={<CompleteSignupPage />} />
          </Route>

          <Route element={<RequireReady />}>
            <Route element={<AppShell />}>
              <Route path="/produtos" element={<ProductsPage />} />
              <Route path="/configuracoes" element={<SettingsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/produtos" replace />} />
        </Routes>
      </SessionProvider>
    </BrowserRouter>
  )
}

export default App
