import { ScannerSpike } from './features/scanner/ScannerSpike'
import { Icon } from './shared/ui/Icon'

function App() {
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

export default App
