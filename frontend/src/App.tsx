import { useState } from 'react'
import { Settings, Upload, Wallet } from 'lucide-react'
import { DashboardView } from './components/DashboardView'
import { CsvImportView } from './components/CsvImportView'
import { SettingsView } from './components/SettingsView'

type View = 'dashboard' | 'import' | 'settings'

function App() {
  const [view, setView] = useState<View>('dashboard')

  function renderView() {
    switch (view) {
      case 'import':
        return <CsvImportView />
      case 'settings':
        return <SettingsView />
      case 'dashboard':
        return <DashboardView />
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <button
          type="button"
          onClick={() => {
            setView('dashboard')
          }}
          className="flex items-center gap-2"
        >
          <Wallet className="h-6 w-6 text-emerald-600" aria-hidden="true" />
          <h1 className="text-lg font-semibold">Expense Tracker</h1>
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setView((current) => (current === 'import' ? 'dashboard' : 'import'))
            }}
            className="flex items-center gap-1 rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            {view === 'import' ? 'Back to Dashboard' : 'Import CSV'}
          </button>
          <button
            type="button"
            onClick={() => {
              setView((current) => (current === 'settings' ? 'dashboard' : 'settings'))
            }}
            aria-label={view === 'settings' ? 'Back to Dashboard' : 'Settings'}
            className="flex items-center gap-1 rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
            {view === 'settings' ? 'Back to Dashboard' : 'Settings'}
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-6">{renderView()}</main>
    </div>
  )
}

export default App
