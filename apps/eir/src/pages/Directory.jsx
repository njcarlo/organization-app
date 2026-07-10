import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase'

/**
 * People directory — public or member workspace.
 * @param {{ basePath?: string, publicMode?: boolean }} props
 *   basePath: prefix for expert profile links ('' public, '/app' workspace)
 */
export default function Directory({ basePath = '', publicMode = false }) {
  const [experts, setExperts] = useState([])
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState('all')
  const [org, setOrg] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const profileBase = `${basePath}/experts`

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setError('')
      try {
        // Query must constrain status for public Firestore rules.
        const snap = await getDocs(
          query(collection(db, 'experts'), where('status', '==', 'Active'))
        )
        if (cancelled) return
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        setExperts(list)
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load directory.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const tags = useMemo(() => {
    const set = new Set()
    for (const e of experts) {
      for (const t of e.expertise || []) set.add(t)
    }
    return [...set].sort()
  }, [experts])

  const orgs = useMemo(() => {
    const set = new Set()
    for (const e of experts) {
      if (e.organization) set.add(e.organization)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [experts])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return experts.filter((e) => {
      if (tag !== 'all' && !(e.expertise || []).includes(tag)) return false
      if (org !== 'all' && e.organization !== org) return false
      if (!q) return true
      const hay = [
        e.name,
        e.title,
        e.organization,
        e.bio,
        ...(e.expertise || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [experts, search, tag, org])

  if (loading) return <p className="text-sm text-hae-slate">Loading directory…</p>
  if (error) return <p className="text-sm text-hae-red">{error}</p>

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-hae-ink sm:text-4xl">Directory</h1>
        <p className="mt-1 text-sm text-hae-slate">
          {publicMode
            ? 'Browse SMEs, explore expertise, then open a profile to book 30 minutes.'
            : 'Member directory — same public profiles, managed from this workspace.'}
        </p>
      </header>

      <div className="flex flex-col gap-3 lg:flex-row">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, expertise, organization…"
          className="flex-1 border border-hae-line bg-white px-3 py-2 text-sm outline-none focus:border-hae-crimson"
        />
        <select
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          className="border border-hae-line bg-white px-3 py-2 text-sm"
        >
          <option value="all">All expertise</option>
          {tags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={org}
          onChange={(e) => setOrg(e.target.value)}
          className="border border-hae-line bg-white px-3 py-2 text-sm"
        >
          <option value="all">All organizations</option>
          {orgs.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs text-hae-slate">
        {filtered.length} expert{filtered.length === 1 ? '' : 's'}
      </p>

      {filtered.length === 0 ? (
        <p className="text-sm text-hae-slate">No experts match this search.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e) => {
            const bookable = Boolean(e.bookingUrl)
            return (
              <Link
                key={e.id}
                to={`${profileBase}/${e.id}`}
                className="flex flex-col border border-hae-line bg-white p-4 transition-colors hover:border-hae-crimson"
              >
                <div className="flex items-start gap-3">
                  {e.photoUrl ? (
                    <img
                      src={e.photoUrl}
                      alt=""
                      className="h-14 w-14 object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center bg-hae-crimson/10 font-display text-lg text-hae-crimson">
                      {(e.name || '?').slice(0, 1)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-sm font-semibold text-hae-ink">
                        {e.name}
                      </div>
                      {bookable ? (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-hae-green">
                          Bookable
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-hae-slate">
                      {e.title || 'Expert'}
                      {e.organization ? ` · ${e.organization}` : ''}
                    </div>
                  </div>
                </div>
                {e.bio ? (
                  <p className="mt-3 line-clamp-3 text-xs text-hae-slate">{e.bio}</p>
                ) : null}
                <div className="mt-auto flex flex-wrap gap-1 pt-3">
                  {(e.expertise || []).slice(0, 4).map((t) => (
                    <span
                      key={t}
                      className="bg-hae-mist px-1.5 py-0.5 text-[10px] font-medium text-hae-slate"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
