import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  collection,
  doc,
  getDocs,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase'
import { PIPELINE_STAGES } from '../constants'

export default function Pipeline() {
  const [contacts, setContacts] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const snap = await getDocs(collection(db, 'contacts'))
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    list.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    setContacts(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const moveStage = async (id, stage) => {
    await updateDoc(doc(db, 'contacts', id), { stage })
    load()
  }

  const columns = useMemo(() => {
    return PIPELINE_STAGES.map((s) => ({
      ...s,
      contacts: contacts.filter((c) => (c.stage || 'prospect') === s.value),
    }))
  }, [contacts])

  const tableRows =
    filter === 'all'
      ? contacts
      : contacts.filter((c) => (c.stage || 'prospect') === filter)

  if (loading) return <p className="text-sm text-hae-slate">Loading pipeline…</p>

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-hae-ink sm:text-4xl">Pipeline</h1>
        <p className="mt-1 text-sm text-hae-slate">
          Prospect → Engaged → Committed → Closed — board and table views
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {columns.map((col) => (
          <section key={col.value} className="border border-hae-line bg-white">
            <div className="flex items-center justify-between border-b border-hae-line px-3 py-2">
              <h2 className="text-xs font-semibold tracking-wider text-hae-slate uppercase">
                {col.label}
              </h2>
              <span className="font-display text-lg text-hae-ink">{col.contacts.length}</span>
            </div>
            <ul className="divide-y divide-hae-line">
              {col.contacts.length === 0 ? (
                <li className="px-3 py-4 text-xs text-hae-slate">Empty</li>
              ) : (
                col.contacts.map((c) => (
                  <li key={c.id} className="px-3 py-3">
                    <div className="text-sm font-medium">{c.name}</div>
                    <div className="text-xs capitalize text-hae-slate">
                      {c.type || '—'} · {c.region || '—'}
                    </div>
                    <select
                      value={c.stage || 'prospect'}
                      onChange={(e) => moveStage(c.id, e.target.value)}
                      className="mt-2 w-full border border-hae-line px-2 py-1 text-xs"
                    >
                      {PIPELINE_STAGES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </li>
                ))
              )}
            </ul>
          </section>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'all', label: 'All stages' },
          ...PIPELINE_STAGES.map((s) => ({ id: s.value, label: s.label })),
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 text-xs font-semibold ${
              filter === f.id
                ? 'bg-hae-ink text-white'
                : 'border border-hae-line bg-white text-hae-slate'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto border border-hae-line bg-white">
        <table className="w-full min-w-[700px] text-left">
          <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
            <tr>
              <th className="px-3 py-2 font-semibold">Contact</th>
              <th className="px-3 py-2 font-semibold">Type</th>
              <th className="px-3 py-2 font-semibold">Region</th>
              <th className="px-3 py-2 font-semibold">Stage</th>
              <th className="px-3 py-2 font-semibold">Follow-up</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-hae-slate">
                  No contacts in this stage
                </td>
              </tr>
            ) : (
              tableRows.map((c) => (
                <tr key={c.id} className="border-b border-hae-line/70">
                  <td className="px-3 py-2">
                    <div className="text-sm font-medium">{c.name}</div>
                    <div className="text-xs text-hae-slate">{c.email || '—'}</div>
                  </td>
                  <td className="px-3 py-2 text-sm capitalize text-hae-slate">
                    {c.type || '—'}
                  </td>
                  <td className="px-3 py-2 text-sm text-hae-slate">{c.region || '—'}</td>
                  <td className="px-3 py-2">
                    <select
                      value={c.stage || 'prospect'}
                      onChange={(e) => moveStage(c.id, e.target.value)}
                      className="border border-hae-line px-2 py-1 text-sm"
                    >
                      {PIPELINE_STAGES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-sm text-hae-slate">
                    {c.followUpDate || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
