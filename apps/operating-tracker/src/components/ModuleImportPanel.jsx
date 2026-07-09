import { useRef, useState } from 'react'
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { db } from '../firebase'
import {
  HOW_TO_PROVIDE_DATA,
  MODULE_IMPORT_SPECS,
  downloadExample,
  parseImportText,
} from '../utils/moduleImport'

/**
 * Admin import panel for a module (or a selectable set of modules).
 * props:
 *   moduleIds: string[] — keys from MODULE_IMPORT_SPECS
 *   defaultModuleId?: string
 *   onImported?: (summary) => void
 *   compact?: boolean
 */
export default function ModuleImportPanel({
  moduleIds,
  defaultModuleId,
  onImported,
  compact = false,
}) {
  const specs = moduleIds
    .map((id) => MODULE_IMPORT_SPECS[id])
    .filter(Boolean)
  const [moduleId, setModuleId] = useState(
    defaultModuleId && MODULE_IMPORT_SPECS[defaultModuleId]
      ? defaultModuleId
      : specs[0]?.id
  )
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [showGuide, setShowGuide] = useState(!compact)
  const fileRef = useRef(null)

  const spec = MODULE_IMPORT_SPECS[moduleId] || specs[0]
  if (!spec) return null

  const runImport = async (rawText) => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const rows = parseImportText(rawText)
      if (!rows.length) throw new Error('No rows found. Check the header and data.')

      const mapped = []
      for (const row of rows) {
        try {
          const docData = spec.mapRow(row)
          if (docData) mapped.push(docData)
        } catch (err) {
          throw new Error(err.message || 'Row mapping failed')
        }
      }
      if (!mapped.length) {
        throw new Error(
          `No valid rows. Required columns: ${spec.required.join(', ')}`
        )
      }

      let created = 0
      let updated = 0
      for (const row of mapped) {
        const { _id, ...fields } = row
        const payload = {
          ...fields,
          createdAt: serverTimestamp(),
        }
        if (_id) {
          // merge update / upsert with stable id
          const { createdAt, ...rest } = payload
          await setDoc(
            doc(db, spec.collection, String(_id)),
            { ...rest, updatedAt: new Date().toISOString() },
            { merge: true }
          )
          updated += 1
        } else {
          await addDoc(collection(db, spec.collection), payload)
          created += 1
        }
      }

      const summary = { module: spec.id, created, updated, total: mapped.length }
      setMessage(
        `Imported ${summary.total} ${spec.label.toLowerCase()} (${created} new${updated ? `, ${updated} upserted` : ''}).`
      )
      setText('')
      if (fileRef.current) fileRef.current.value = ''
      onImported?.(summary)
    } catch (err) {
      setError(err.message || 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  const onFile = async (file) => {
    if (!file) return
    const content = await file.text()
    setText(content)
    await runImport(content)
  }

  return (
    <section
      className={`space-y-4 rounded-xl border border-hae-line bg-white ${compact ? 'p-4' : 'p-4 sm:p-5'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-hae-ink">
            Import {specs.length > 1 ? 'data' : spec.label}
          </h2>
          <p className="mt-1 text-sm text-hae-slate">{spec.description}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowGuide((v) => !v)}
          className="text-xs font-semibold text-hae-crimson"
        >
          {showGuide ? 'Hide format guide' : 'How to format your list'}
        </button>
      </div>

      {specs.length > 1 && (
        <label className="block max-w-xs">
          <span className="mb-1 block text-xs font-semibold tracking-wide text-hae-slate uppercase">
            Module
          </span>
          <select
            className="w-full rounded-md border border-hae-line px-3 py-2 text-sm"
            value={spec.id}
            onChange={(e) => {
              setModuleId(e.target.value)
              setError('')
              setMessage('')
            }}
          >
            {specs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {showGuide && (
        <div className="space-y-3 rounded-lg border border-dashed border-hae-line bg-hae-mist/40 p-4 text-sm text-hae-slate">
          <p className="font-medium text-hae-ink">{HOW_TO_PROVIDE_DATA.title}</p>
          <p>{HOW_TO_PROVIDE_DATA.intro}</p>
          <ul className="list-disc space-y-1 pl-5">
            {HOW_TO_PROVIDE_DATA.rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <div>
            <p className="font-medium text-hae-ink">Columns for {spec.label}</p>
            <p className="mt-1">
              <span className="font-semibold text-hae-ink">Required:</span>{' '}
              {spec.required.join(', ')}
            </p>
            <p>
              <span className="font-semibold text-hae-ink">Optional:</span>{' '}
              {spec.optional.join(', ') || '—'}
            </p>
          </div>
          <div>
            <p className="font-medium text-hae-ink">Giving a list to Cursor / AI</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {HOW_TO_PROVIDE_DATA.forAi.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => downloadExample(spec, 'csv')}
              className="rounded-md border border-hae-line bg-white px-3 py-1.5 text-xs font-semibold text-hae-ink hover:bg-hae-mist"
            >
              Download CSV example
            </button>
            <button
              type="button"
              onClick={() => downloadExample(spec, 'json')}
              className="rounded-md border border-hae-line bg-white px-3 py-1.5 text-xs font-semibold text-hae-ink hover:bg-hae-mist"
            >
              Download JSON example
            </button>
            <button
              type="button"
              onClick={() => setText(spec.exampleCsv)}
              className="rounded-md border border-hae-line bg-white px-3 py-1.5 text-xs font-semibold text-hae-ink hover:bg-hae-mist"
            >
              Paste CSV example
            </button>
          </div>
          <pre className="overflow-x-auto rounded-md bg-white p-3 text-[11px] leading-relaxed text-hae-ink">
            {spec.exampleCsv}
          </pre>
        </div>
      )}

      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold tracking-wide text-hae-slate uppercase">
            Upload CSV or JSON
          </span>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.json,text/csv,application/json"
            disabled={busy}
            className="block w-full max-w-md text-sm text-hae-slate file:mr-3 file:rounded-md file:border-0 file:bg-hae-mist file:px-3 file:py-2 file:text-sm file:font-semibold file:text-hae-ink"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold tracking-wide text-hae-slate uppercase">
            Or paste your list
          </span>
          <textarea
            rows={compact ? 6 : 8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Paste CSV (with header) or a JSON array for ${spec.label}…`}
            className="w-full rounded-md border border-hae-line px-3 py-2 font-mono text-xs outline-none focus:border-hae-crimson"
            disabled={busy}
          />
        </label>

        <button
          type="button"
          disabled={busy || !text.trim()}
          onClick={() => runImport(text)}
          className="rounded-md bg-hae-crimson px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? 'Importing…' : `Import ${spec.label}`}
        </button>
      </div>

      {error && <p className="text-sm text-hae-red">{error}</p>}
      {message && <p className="text-sm text-hae-green">{message}</p>}
    </section>
  )
}
