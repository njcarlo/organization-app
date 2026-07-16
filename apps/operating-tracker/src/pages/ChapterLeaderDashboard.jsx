import { useCallback, useEffect, useState } from 'react'
import { addDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore'
import { Modal } from '@hae/ui'
import { db } from '../firebase'
import ChapterLeaderDetailCard from '../components/ChapterLeaderDetailCard'
import { MEMBERSHIP_STATUS_OPTIONS } from '../constants'
import { formatDate, membershipStatusBadgeClass } from '../utils'

const emptyForm = {
  chapter: '',
  firstName: '',
  lastName: '',
  position: '',
  email: '',
  membershipStatus: MEMBERSHIP_STATUS_OPTIONS[0],
  membershipExpiration: '',
}

/**
 * Chapter Leader dashboard — Chapter, First/Last Name, Chapter Position, Email,
 * Membership Status, Membership Expiration Date at a glance. Add via modal.
 * Click a row to open its detail popup, which owns Edit/Save/Delete plus comments.
 */
export default function ChapterLeaderDashboard() {
  const [rows, setRows] = useState([])
  const [chapterNames, setChapterNames] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [modal, setModal] = useState(null) // { form }
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const [leaderSnap, chapterSnap] = await Promise.all([
        getDocs(collection(db, 'chapterLeaders')),
        getDocs(collection(db, 'chapters')),
      ])
      const list = leaderSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
      setRows(list)
      const names = chapterSnap.docs
        .map((d) => d.data().name)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b))
      setChapterNames(names)
    } catch (err) {
      setError(err.message || 'Failed to load chapter leaders')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openAdd = () => setModal({ form: emptyForm })

  const closeModal = () => {
    if (saving) return
    setModal(null)
  }

  const submitModal = async (e) => {
    e.preventDefault()
    if (!modal?.form.firstName.trim() || saving) return
    setSaving(true)
    setError('')
    try {
      const { form } = modal
      const data = {
        chapter: form.chapter.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        position: form.position.trim(),
        email: form.email.trim(),
        membershipStatus: form.membershipStatus,
        membershipExpiration: form.membershipExpiration,
      }
      const maxOrder = rows.reduce((m, r) => Math.max(m, r.order ?? 0), 0)
      await addDoc(collection(db, 'chapterLeaders'), {
        ...data,
        order: maxOrder + 1,
        createdAt: serverTimestamp(),
      })
      setModal(null)
      await load()
    } catch (err) {
      setError(err.message || 'Failed to save chapter leader')
    } finally {
      setSaving(false)
    }
  }

  const selectedRow = rows.find((r) => r.id === selectedId) || null

  if (loading) return <p className="text-sm text-hae-slate">Loading chapter leader dashboard…</p>

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-hae-line pb-6">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-hae-crimson uppercase">
            Harvard Alumni Entrepreneurs
          </p>
          <h1 className="mt-2 font-display text-3xl text-hae-ink sm:text-4xl md:text-5xl">
            Chapter Leader Dashboard
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-hae-slate">
            Every chapter leader at a glance — click a row to view details and comments.
          </p>
        </div>
        <button type="button" className="hae-btn" onClick={openAdd}>
          + Add a Chapter Leader
        </button>
      </header>

      {error && <p className="text-sm text-hae-red">{error}</p>}

      <Modal
        open={!!modal}
        onClose={closeModal}
        title="Add a chapter leader"
        busy={saving}
        footer={
          <>
            <button type="button" className="hae-btn-secondary" onClick={closeModal} disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="chapter-leader-form" className="hae-btn" disabled={saving}>
              {saving ? 'Saving…' : 'Add chapter leader'}
            </button>
          </>
        }
      >
        {modal ? (
          <form id="chapter-leader-form" onSubmit={submitModal} className="grid gap-3 sm:grid-cols-2">
            {error && <p className="text-sm text-hae-red sm:col-span-2">{error}</p>}
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-hae-slate">Chapter</span>
              <select
                value={modal.form.chapter}
                onChange={(e) => setModal({ ...modal, form: { ...modal.form, chapter: e.target.value } })}
                className="rounded-md border border-hae-line px-3 py-2 text-sm"
              >
                <option value="">Select chapter</option>
                {chapterNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-hae-slate">Chapter Position</span>
              <input
                value={modal.form.position}
                onChange={(e) => setModal({ ...modal, form: { ...modal.form, position: e.target.value } })}
                className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-hae-slate">First Name</span>
              <input
                required
                value={modal.form.firstName}
                onChange={(e) => setModal({ ...modal, form: { ...modal.form, firstName: e.target.value } })}
                className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-hae-slate">Last Name</span>
              <input
                value={modal.form.lastName}
                onChange={(e) => setModal({ ...modal, form: { ...modal.form, lastName: e.target.value } })}
                className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-xs font-medium text-hae-slate">Email</span>
              <input
                type="email"
                value={modal.form.email}
                onChange={(e) => setModal({ ...modal, form: { ...modal.form, email: e.target.value } })}
                className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-hae-slate">Membership Status</span>
              <select
                value={modal.form.membershipStatus}
                onChange={(e) =>
                  setModal({ ...modal, form: { ...modal.form, membershipStatus: e.target.value } })
                }
                className="rounded-md border border-hae-line px-3 py-2 text-sm"
              >
                {MEMBERSHIP_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-hae-slate">Membership Expiration Date</span>
              <input
                type="date"
                value={modal.form.membershipExpiration}
                onChange={(e) =>
                  setModal({ ...modal, form: { ...modal.form, membershipExpiration: e.target.value } })
                }
                className="rounded-md border border-hae-line px-3 py-2 text-sm"
              />
            </label>
          </form>
        ) : null}
      </Modal>

      <div className="hae-table-scroll rounded-xl border border-hae-line bg-white">
        <table className="w-full min-w-[960px] text-left">
          <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
            <tr>
              <th className="px-3 py-2 font-semibold">Chapter</th>
              <th className="px-3 py-2 font-semibold">First Name</th>
              <th className="px-3 py-2 font-semibold">Last Name</th>
              <th className="px-3 py-2 font-semibold">Chapter Position</th>
              <th className="px-3 py-2 font-semibold">Email</th>
              <th className="px-3 py-2 font-semibold">Membership Status</th>
              <th className="px-3 py-2 font-semibold">Membership Expiration Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-hae-slate">
                  No chapter leaders yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setSelectedId(row.id)}
                  className={`cursor-pointer border-b border-hae-line/70 hover:bg-hae-mist/40 ${
                    selectedId === row.id ? 'bg-hae-mist/40' : ''
                  }`}
                >
                  <td className="px-3 py-2 text-sm text-hae-ink">{row.chapter || '—'}</td>
                  <td className="px-3 py-2 text-sm font-medium text-hae-ink">{row.firstName || '—'}</td>
                  <td className="px-3 py-2 text-sm text-hae-ink">{row.lastName || '—'}</td>
                  <td className="px-3 py-2 text-sm text-hae-slate">{row.position || '—'}</td>
                  <td className="px-3 py-2 text-sm text-hae-slate">{row.email || '—'}</td>
                  <td className="px-3 py-2 text-sm">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${membershipStatusBadgeClass(row.membershipStatus)}`}
                    >
                      {row.membershipStatus || MEMBERSHIP_STATUS_OPTIONS[0]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm text-hae-slate">
                    {row.membershipExpiration ? formatDate(row.membershipExpiration) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedRow ? (
        <ChapterLeaderDetailCard
          leader={selectedRow}
          chapterNames={chapterNames}
          onClose={() => setSelectedId(null)}
          onChanged={load}
          onDeleted={() => {
            setSelectedId(null)
            load()
          }}
        />
      ) : null}
    </div>
  )
}
