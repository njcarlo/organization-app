import { useSearchParams } from 'react-router-dom'
import AdvancementDataEntry from './AdvancementDataEntry'
import AdvancementReport from './AdvancementReport'

const TABS = [
  { id: 'report', label: 'Report' },
  { id: 'data', label: 'Enter Data' },
]

/**
 * HAE Advancement — executive dashboard for the president and board. Two
 * tabs behind one nav item: a board-ready printable Report (matches the
 * board deck screenshot) and an Enter Data page where the president
 * maintains the underlying numbers. Tab selection lives in `?tab=` so the
 * Report can be linked/printed directly.
 */
export default function AdvancementDashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'data' ? 'data' : 'report'

  const setTab = (next) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      params.set('tab', next)
      return params
    })
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="font-display text-3xl text-hae-ink">HAE Advancement</h1>
          <p className="mt-1 text-sm text-hae-slate">
            Executive view of revenue, pipeline, and program impact for the president and board.
          </p>
        </div>
        <div className="flex rounded-md border border-hae-line bg-white p-0.5 text-xs font-semibold">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded px-3 py-1.5 ${tab === t.id ? 'bg-hae-crimson text-white' : 'text-hae-slate'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'data' ? <AdvancementDataEntry /> : <AdvancementReport />}
    </div>
  )
}
