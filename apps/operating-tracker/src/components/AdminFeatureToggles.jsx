import { useState } from 'react'
import { FEATURE_CATALOG, mergeFeatures, useFeatures } from '@hae/ui'

export default function AdminFeatureToggles() {
  const { flags, loading, saveFlags, isSuperAdmin } = useFeatures()
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const current = draft || flags

  if (!isSuperAdmin) {
    return (
      <p className="text-sm text-hae-slate">
        Feature toggles are only available to superadmins.
      </p>
    )
  }

  if (loading && !draft) {
    return <p className="text-sm text-hae-slate">Loading feature flags…</p>
  }

  const toggle = (id) => {
    setDraft((prev) => {
      const base = prev || { ...flags }
      return { ...base, [id]: !base[id] }
    })
    setMessage('')
    setError('')
  }

  const save = async () => {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const merged = await saveFlags(mergeFeatures(current))
      setDraft(null)
      setMessage('Feature toggles saved. Other users will see changes immediately.')
      // keep local in sync if provider lags
      void merged
    } catch (err) {
      setError(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const dirty = draft != null

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-hae-ink">Feature toggles</h2>
        <p className="mt-1 text-sm text-hae-slate">
          Turn platform apps and features on or off for everyone except
          superadmins. You and the other superadmin always see everything.
        </p>
      </div>

      {error && <p className="text-sm text-hae-red">{error}</p>}
      {message && <p className="text-sm text-hae-green">{message}</p>}

      {FEATURE_CATALOG.map((group) => (
        <section
          key={group.group}
          className="rounded-xl border border-hae-line bg-white p-4 sm:p-5"
        >
          <h3 className="text-xs font-semibold tracking-wide text-hae-slate uppercase">
            {group.group}
          </h3>
          <ul className="mt-3 divide-y divide-hae-line/70">
            {group.items.map((item) => {
              const on = current[item.id] !== false
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-hae-ink">{item.label}</div>
                    <div className="text-xs text-hae-slate">{item.description}</div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    onClick={() => toggle(item.id)}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                      on ? 'bg-hae-crimson' : 'bg-hae-line'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                        on ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                    <span className="sr-only">{on ? 'On' : 'Off'}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={save}
          className="rounded-md bg-hae-crimson px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save toggles'}
        </button>
        {dirty ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setDraft(null)
              setMessage('')
              setError('')
            }}
            className="rounded-md border border-hae-line px-4 py-2 text-sm font-semibold text-hae-slate"
          >
            Discard
          </button>
        ) : null}
      </div>
    </div>
  )
}
