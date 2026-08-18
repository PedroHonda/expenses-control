import { Wallet } from 'lucide-react'

function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex items-center gap-2 border-b border-slate-200 bg-white px-6 py-4">
        <Wallet className="h-6 w-6 text-emerald-600" aria-hidden="true" />
        <h1 className="text-lg font-semibold">Expense Tracker</h1>
      </header>
      <main className="p-6">
        <p className="text-slate-600">
          Scaffold in progress — expense form, CSV import, and reporting views are next.
        </p>
      </main>
    </div>
  )
}

export default App
