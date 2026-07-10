import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase'
import { SURVEY_STATUSES } from '../surveys'
import { useAuth } from '../context/AuthContext'
import ModuleImportPanel from '../components/ModuleImportPanel'

export default function Surveys() {
  const { isAdmin, isStaff } = useAuth()
  const [surveys, setSurveys] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showImport, setShowImport] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const snap = await getDocs(query(collection(db, 'surveys'), orderBy('updatedAt', 'desc')))
      setSurveys(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    } catch (err) {
      // Fallback if index missing / no updatedAt yet
      try {
        const snap = await getDocs(collection(db, 'surveys'))
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        list.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
        setSurveys(list)
      } catch (err2) {
        setError(err2.message || err.message || 'Failed to load surveys')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const setStatus = async (id, status) => {
    await updateDoc(doc(db, 'surveys', id), {
      status,
      updatedAt: new Date().toISOString(),
    })
    load()
  }

  const remove = async (id) => {
    if (!confirm('Delete this survey? Responses are not cascade-deleted.')) return
    await deleteDoc(doc(db, 'surveys', id))
    load()
  }

  if (loading) return <p className="text-sm text-hae-slate">Loading surveys…</p>

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-hae-ink sm:text-4xl md:text-5xl">
            Surveys
          </h1>
          <p className="mt-1 text-sm text-hae-slate">
            Create surveys, share a link, and invite people by email from your own inbox
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(isAdmin || isStaff) && (
            <button
              type="button"
              onClick={() => setShowImport((v) => !v)}
              className="rounded-md border border-hae-line bg-white px-3 py-2 text-sm font-semibold text-hae-ink hover:bg-hae-mist"
            >
              {showImport ? 'Hide import' : 'Import surveys'}
            </button>
          )}
          <Link
            to="/surveys/new"
            className="hae-btn"
          >
            + New survey
          </Link>
        </div>
      </header>

      {error && <p className="text-sm text-hae-red">{error}</p>}

      {showImport && (isAdmin || isStaff) && (
        <ModuleImportPanel
          moduleIds={['surveys']}
          onImported={() => {
            load()
          }}
        />
      )}

      <div className="hae-table-scroll rounded-xl border border-hae-line bg-white">
        <table className="w-full min-w-[640px] text-left">
          <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
            <tr>
              <th className="px-3 py-2 font-semibold">Title</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold">Questions</th>
              <th className="px-3 py-2 font-semibold">Updated</th>
              <th className="px-3 py-2 font-semibold w-40" />
            </tr>
          </thead>
          <tbody>
            {surveys.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-sm text-hae-slate">
                  No surveys yet. Create one to get a shareable link.
                </td>
              </tr>
            ) : (
              surveys.map((s) => (
                <tr key={s.id} className="group border-b border-hae-line/70">
                  <td className="px-3 py-2">
                    <Link
                      to={`/surveys/${s.id}`}
                      className="text-sm font-medium text-hae-ink hover:text-hae-crimson"
                    >
                      {s.title || 'Untitled'}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="rounded border border-hae-line px-2 py-1 text-xs"
                      value={s.status || 'Draft'}
                      onChange={(e) => setStatus(s.id, e.target.value)}
                    >
                      {SURVEY_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-sm text-hae-slate">
                    {(s.questions || []).length}
                  </td>
                  <td className="px-3 py-2 text-sm text-hae-slate">
                    {(s.updatedAt || s.createdAt || '').toString().slice(0, 10) || '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-xs">
                    <Link
                      to={`/surveys/${s.id}`}
                      className="mr-2 font-semibold text-hae-crimson"
                    >
                      Open
                    </Link>
                    <button
                      type="button"
                      onClick={() => remove(s.id)}
                      className="text-hae-slate opacity-100 hover:text-hae-red sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      Delete
                    </button>
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
