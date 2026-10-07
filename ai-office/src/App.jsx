import { useState } from 'react'
import Office3D from './components/Office3D.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import Sidebar from './components/Sidebar.jsx'
import { useOffice } from './lib/useOffice.js'

export default function App() {
  const office = useOffice()
  const [focusId, setFocusId] = useState(null)

  return (
    <div className="flex h-full bg-slate-950">
      <main className="relative flex-1">
        <ErrorBoundary>
          <Office3D {...office} focusId={focusId} setFocusId={setFocusId} />
        </ErrorBoundary>
        {focusId && (
          <button
            onClick={() => setFocusId(null)}
            className="absolute left-4 top-4 rounded-lg bg-slate-900/80 px-3 py-2 text-sm backdrop-blur hover:bg-slate-800"
          >
            ← Umumiy ko'rinish
          </button>
        )}
        <div className="pointer-events-none absolute bottom-3 left-4 text-xs text-slate-500">
          Personajni bosing — kamera yaqinlashadi
        </div>
      </main>
      <Sidebar {...office} focusId={focusId} setFocusId={setFocusId} />
    </div>
  )
}
