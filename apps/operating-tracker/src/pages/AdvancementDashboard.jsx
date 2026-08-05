import AdvancementReport from './AdvancementReport'

/**
 * HAE Advancement — executive dashboard for the president and board. One
 * board-ready, printable Report that the president edits directly in place
 * (click any value to change it) — no separate data-entry page to keep in
 * sync.
 */
export default function AdvancementDashboard() {
  return (
    <div>
      <div className="mb-6 print:hidden">
        <h1 className="font-display text-3xl text-hae-ink">HAE Advancement</h1>
        <p className="mt-1 text-sm text-hae-slate">
          Executive view of revenue, pipeline, and program impact for the president and board. Click any value to edit it.
        </p>
      </div>

      <AdvancementReport />
    </div>
  )
}
