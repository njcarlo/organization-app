import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { ROLE_OPTIONS } from '../../../../packages/ui/src/rbac.js'
import { db, secondaryAuth } from '../firebase'
import {
  EXPORT_COLLECTIONS,
  downloadJson,
  exportCollections,
  importCollections,
} from '../utils/dataTransfer'

const CREATE_GUIDE = [
  {
    app: 'Roles (RBAC)',
    items: [
      { what: 'Admin', where: 'Full access — users, import/export, all apps' },
      { what: 'Staff', where: 'HAE team — Tracker, LMS manage, EiR manage, CRM, AMS' },
      { what: 'Member', where: 'Alumni — EiR directory/booking, AMS events & own membership' },
      { what: 'Student', where: 'Academy — LMS My learning, catalog, certificates; EiR browse' },
      { what: 'Legacy "user"', where: 'Treated as Staff automatically' },
    ],
  },
  {
    app: 'Operating Tracker',
    items: [
      { what: 'Users', where: 'Admin → Users (this page)' },
      { what: 'Programs', where: 'Admin → Programs (this page)' },
      { what: 'Projects', where: 'Programs → open a program → Add Project' },
      { what: 'Tasks', where: 'Programs → expand a project → Add Task' },
    ],
  },
  {
    app: 'LMS',
    items: [
      { what: 'Courses', where: 'LMS → Manage courses (staff)' },
      { what: 'Modules', where: 'LMS → Courses → open a course' },
      { what: 'Enrollments', where: 'LMS → Enrollments (use learner email = login email)' },
      { what: 'Office Hours', where: 'LMS → Sessions' },
      { what: 'Check-ins', where: 'LMS → Check-ins' },
      { what: 'Certificates', where: 'LMS → Issue certificates' },
    ],
  },
  {
    app: 'EiR',
    items: [{ what: 'Experts', where: 'EiR → Manage experts (staff/admin)' }],
  },
  {
    app: 'CRM',
    items: [
      { what: 'Contacts', where: 'CRM → Contacts (staff)' },
      { what: 'Interactions', where: 'CRM → Interactions' },
      { what: 'Pipeline stage', where: 'CRM → Pipeline (moves existing contacts)' },
    ],
  },
  {
    app: 'AMS',
    items: [
      { what: 'Members', where: 'AMS → Members (staff)' },
      { what: 'Memberships', where: 'AMS → Memberships (stores memberEmail for member view)' },
      { what: 'Events', where: 'AMS → Events' },
      { what: 'Committees', where: 'AMS → Committees' },
    ],
  },
]

const TABS = [
  { id: 'users', label: 'Users' },
  { id: 'programs', label: 'Programs' },
  { id: 'data', label: 'Import / Export' },
  { id: 'guide', label: 'Where to create' },
]

export default function Admin() {
  const [tab, setTab] = useState('users')
  const [users, setUsers] = useState([])
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'staff',
  })
  const [editingUserId, setEditingUserId] = useState(null)
  const [userDraft, setUserDraft] = useState(null)

  const [newProgram, setNewProgram] = useState({ name: '', lead: '' })
  const [editingProgramId, setEditingProgramId] = useState(null)
  const [programDraft, setProgramDraft] = useState(null)

  const [selectedExport, setSelectedExport] = useState(() =>
    EXPORT_COLLECTIONS.filter((c) =>
      ['programs', 'projects', 'tasks', 'users'].includes(c.id)
    ).map((c) => c.id)
  )
  const [replaceExtras, setReplaceExtras] = useState(false)
  const [dataBusy, setDataBusy] = useState(false)
  const [dataMessage, setDataMessage] = useState('')
  const fileRef = useRef(null)

  const load = useCallback(async () => {
    const [userSnap, programSnap] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'programs')),
    ])
    const userList = userSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    userList.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    const programList = programSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    programList.sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    setUsers(userList)
    setPrograms(programList)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const groupedCollections = useMemo(() => {
    const map = {}
    for (const c of EXPORT_COLLECTIONS) {
      if (!map[c.app]) map[c.app] = []
      map[c.app].push(c)
    }
    return map
  }, [])

  const toggleExport = (id) => {
    setSelectedExport((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const selectApp = (app) => {
    const ids = EXPORT_COLLECTIONS.filter((c) => c.app === app).map((c) => c.id)
    setSelectedExport((prev) => Array.from(new Set([...prev, ...ids])))
  }

  const handleExport = async () => {
    if (selectedExport.length === 0) {
      setDataMessage('Select at least one collection to export.')
      return
    }
    setDataBusy(true)
    setDataMessage('')
    setError('')
    try {
      const payload = await exportCollections(selectedExport)
      const stamp = new Date().toISOString().slice(0, 10)
      downloadJson(`hae-export-${stamp}.json`, payload)
      const counts = selectedExport
        .map((id) => `${id}: ${(payload[id] || []).length}`)
        .join(', ')
      setDataMessage(`Exported ${counts}`)
    } catch (err) {
      setError(err.message || 'Export failed')
    } finally {
      setDataBusy(false)
    }
  }

  const handleImportFile = async (file) => {
    if (!file) return
    setDataBusy(true)
    setDataMessage('')
    setError('')
    try {
      const text = await file.text()
      const payload = JSON.parse(text)
      const summary = await importCollections(payload, { replaceExtras })
      const parts = Object.entries(summary).map(
        ([k, v]) => `${k}: ${v.written} upserted${v.deleted ? `, ${v.deleted} removed` : ''}`
      )
      setDataMessage(
        parts.length
          ? `Import complete — ${parts.join('; ')}`
          : 'No matching collections found in file.'
      )
      await load()
    } catch (err) {
      setError(err.message || 'Import failed')
    } finally {
      setDataBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const addUser = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const cred = await createUserWithEmailAndPassword(
        secondaryAuth,
        newUser.email.trim(),
        newUser.password
      )
      await setDoc(doc(db, 'users', cred.user.uid), {
        name: newUser.name.trim(),
        email: newUser.email.trim().toLowerCase(),
        role: newUser.role,
        createdAt: serverTimestamp(),
      })
      await signOut(secondaryAuth)
      setNewUser({ name: '', email: '', password: '', role: 'staff' })
      await load()
    } catch (err) {
      setError(err.message || 'Failed to create user')
    }
  }

  const saveUser = async () => {
    if (!userDraft?.name.trim()) return
    await updateDoc(doc(db, 'users', editingUserId), {
      name: userDraft.name.trim(),
      role: userDraft.role,
    })
    setEditingUserId(null)
    setUserDraft(null)
    await load()
  }

  const removeUser = async (id) => {
    if (
      !confirm(
        'Delete this user from Firestore? Their Firebase Auth account will remain (Admin SDK required for full delete).'
      )
    ) {
      return
    }
    await deleteDoc(doc(db, 'users', id))
    await load()
  }

  const addProgram = async (e) => {
    e.preventDefault()
    if (!newProgram.name.trim()) return
    const maxOrder = programs.reduce((m, p) => Math.max(m, p.order ?? 0), 0)
    await addDoc(collection(db, 'programs'), {
      name: newProgram.name.trim(),
      lead: newProgram.lead.trim(),
      order: maxOrder + 1,
      createdAt: serverTimestamp(),
    })
    setNewProgram({ name: '', lead: '' })
    await load()
  }

  const saveProgram = async () => {
    if (!programDraft?.name.trim()) return
    await updateDoc(doc(db, 'programs', editingProgramId), {
      name: programDraft.name.trim(),
      lead: programDraft.lead.trim(),
    })
    setEditingProgramId(null)
    setProgramDraft(null)
    await load()
  }

  const removeProgram = async (id) => {
    if (
      !confirm(
        'Delete this program? Projects and tasks are not cascade-deleted.'
      )
    ) {
      return
    }
    await deleteDoc(doc(db, 'programs', id))
    await load()
  }

  if (loading) return <p className="text-sm text-hae-slate">Loading admin…</p>

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-hae-ink sm:text-4xl md:text-5xl">
          Admin
        </h1>
        <p className="mt-1 text-sm text-hae-slate">
          Manage users, programs, and platform data import/export
        </p>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-hae-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`border-b-2 px-3 py-2 text-sm font-semibold ${
              tab === t.id
                ? 'border-hae-crimson text-hae-crimson'
                : 'border-transparent text-hae-slate'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-hae-red">{error}</p>}

      {tab === 'users' && (
        <div className="space-y-4">
          <form
            onSubmit={addUser}
            className="grid gap-3 rounded-xl border border-hae-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"
          >
            <input
              required
              placeholder="Name"
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
            />
            <input
              required
              type="email"
              placeholder="Email"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
            />
            <input
              required
              type="password"
              minLength={6}
              placeholder="Temp password"
              value={newUser.password}
              onChange={(e) =>
                setNewUser({ ...newUser, password: e.target.value })
              }
              className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
            />
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              className="rounded-md border border-hae-line px-3 py-2 text-sm"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-md bg-hae-crimson px-3 py-2 text-sm font-semibold text-white"
            >
              Add user
            </button>
          </form>

          <div className="overflow-x-auto rounded-xl border border-hae-line bg-white">
            <table className="w-full text-left">
              <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
                <tr>
                  <th className="px-3 py-2 font-semibold">Name</th>
                  <th className="px-3 py-2 font-semibold">Email</th>
                  <th className="px-3 py-2 font-semibold">Role</th>
                  <th className="px-3 py-2 font-semibold w-24" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) =>
                  editingUserId === u.id && userDraft ? (
                    <tr key={u.id} className="bg-amber-50">
                      <td className="px-3 py-2">
                        <input
                          className="w-full rounded border border-hae-line px-2 py-1 text-sm"
                          value={userDraft.name}
                          onChange={(e) =>
                            setUserDraft({ ...userDraft, name: e.target.value })
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-sm text-hae-slate">{u.email}</td>
                      <td className="px-3 py-2">
                        <select
                          className="rounded border border-hae-line px-2 py-1 text-sm"
                          value={userDraft.role === 'user' ? 'staff' : userDraft.role}
                          onChange={(e) =>
                            setUserDraft({ ...userDraft, role: e.target.value })
                          }
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right text-xs">
                        <button
                          type="button"
                          onClick={saveUser}
                          className="font-semibold text-hae-crimson"
                        >
                          Save
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={u.id} className="group border-b border-hae-line/70">
                      <td className="px-3 py-2 text-sm font-medium">{u.name}</td>
                      <td className="px-3 py-2 text-sm text-hae-slate">{u.email}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                            u.role === 'admin'
                              ? 'bg-purple-100 text-purple-700'
                              : u.role === 'staff' || u.role === 'user'
                                ? 'bg-sky-100 text-sky-800'
                                : u.role === 'student'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-hae-slate'
                          }`}
                        >
                          {u.role === 'user' ? 'staff' : u.role}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingUserId(u.id)
                              setUserDraft({ name: u.name, role: u.role })
                            }}
                            className="text-xs text-hae-slate hover:text-hae-crimson"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => removeUser(u.id)}
                            className="text-xs text-hae-slate hover:text-hae-red"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'programs' && (
        <div className="space-y-4">
          <form
            onSubmit={addProgram}
            className="grid gap-3 rounded-xl border border-hae-line bg-white p-4 sm:grid-cols-3"
          >
            <input
              required
              placeholder="Program name"
              value={newProgram.name}
              onChange={(e) =>
                setNewProgram({ ...newProgram, name: e.target.value })
              }
              className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
            />
            <input
              placeholder="Overall lead"
              value={newProgram.lead}
              onChange={(e) =>
                setNewProgram({ ...newProgram, lead: e.target.value })
              }
              className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
            />
            <button
              type="submit"
              className="rounded-md bg-hae-crimson px-3 py-2 text-sm font-semibold text-white"
            >
              Add program
            </button>
          </form>

          <div className="overflow-x-auto rounded-xl border border-hae-line bg-white">
            <table className="w-full text-left">
              <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
                <tr>
                  <th className="px-3 py-2 font-semibold">Name</th>
                  <th className="px-3 py-2 font-semibold">Lead</th>
                  <th className="px-3 py-2 font-semibold">Order</th>
                  <th className="px-3 py-2 font-semibold w-24" />
                </tr>
              </thead>
              <tbody>
                {programs.map((p) =>
                  editingProgramId === p.id && programDraft ? (
                    <tr key={p.id} className="bg-amber-50">
                      <td className="px-3 py-2">
                        <input
                          className="w-full rounded border border-hae-line px-2 py-1 text-sm"
                          value={programDraft.name}
                          onChange={(e) =>
                            setProgramDraft({
                              ...programDraft,
                              name: e.target.value,
                            })
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className="w-full rounded border border-hae-line px-2 py-1 text-sm"
                          value={programDraft.lead}
                          onChange={(e) =>
                            setProgramDraft({
                              ...programDraft,
                              lead: e.target.value,
                            })
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-sm text-hae-slate">{p.order}</td>
                      <td className="px-3 py-2 text-right text-xs">
                        <button
                          type="button"
                          onClick={saveProgram}
                          className="font-semibold text-hae-crimson"
                        >
                          Save
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={p.id} className="group border-b border-hae-line/70">
                      <td className="px-3 py-2 text-sm font-medium">{p.name}</td>
                      <td className="px-3 py-2 text-sm text-hae-slate">
                        {p.lead || '—'}
                      </td>
                      <td className="px-3 py-2 text-sm text-hae-slate">{p.order}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProgramId(p.id)
                              setProgramDraft({
                                name: p.name,
                                lead: p.lead || '',
                              })
                            }}
                            className="text-xs text-hae-slate hover:text-hae-crimson"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => removeProgram(p.id)}
                            className="text-xs text-hae-slate hover:text-hae-red"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'data' && (
        <div className="space-y-6">
          <section className="rounded-xl border border-hae-line bg-white p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-hae-ink">Export JSON</h2>
            <p className="mt-1 text-sm text-hae-slate">
              Download selected Firestore collections. Documents include{' '}
              <code className="text-xs">_id</code> for round-trip import.
            </p>

            <div className="mt-4 space-y-4">
              {Object.entries(groupedCollections).map(([app, cols]) => (
                <div key={app}>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold tracking-wide text-hae-slate uppercase">
                      {app}
                    </span>
                    <button
                      type="button"
                      onClick={() => selectApp(app)}
                      className="text-xs font-semibold text-hae-crimson"
                    >
                      Select all
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {cols.map((c) => {
                      const on = selectedExport.includes(c.id)
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleExport(c.id)}
                          className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${
                            on
                              ? 'border-hae-crimson bg-hae-crimson/10 text-hae-crimson'
                              : 'border-hae-line text-hae-slate hover:bg-hae-mist'
                          }`}
                        >
                          {c.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              disabled={dataBusy}
              onClick={handleExport}
              className="mt-5 rounded-md bg-hae-crimson px-4 py-2 text-sm font-semibold tracking-wide text-white uppercase disabled:opacity-60"
            >
              {dataBusy ? 'Working…' : 'Download export'}
            </button>
          </section>

          <section className="rounded-xl border border-hae-line bg-white p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-hae-ink">Import JSON</h2>
            <p className="mt-1 text-sm text-hae-slate">
              Upsert documents by <code className="text-xs">_id</code>. User
              import updates profiles only — it does not create Firebase Auth
              accounts (use Users tab for that).
            </p>

            <label className="mt-4 flex items-start gap-2 text-sm text-hae-ink">
              <input
                type="checkbox"
                checked={replaceExtras}
                onChange={(e) => setReplaceExtras(e.target.checked)}
                className="mt-1"
              />
              <span>
                Also delete documents in imported collections that are{' '}
                <strong>not</strong> in the file (never deletes users)
              </span>
            </label>

            <div className="mt-4 flex flex-wrap gap-3">
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="block w-full max-w-md text-sm text-hae-slate file:mr-3 file:rounded-md file:border-0 file:bg-hae-mist file:px-3 file:py-2 file:text-sm file:font-semibold file:text-hae-ink"
                onChange={(e) => handleImportFile(e.target.files?.[0])}
                disabled={dataBusy}
              />
            </div>
          </section>

          {dataMessage && (
            <p className="text-sm text-hae-green">{dataMessage}</p>
          )}
        </div>
      )}

      {tab === 'guide' && (
        <div className="space-y-4">
          <p className="text-sm text-hae-slate">
            Each app creates its own records on list pages. Users for all apps
            are created here under <strong>Users</strong> (shared Firebase Auth +
            directory).
          </p>
          {CREATE_GUIDE.map((section) => (
            <section
              key={section.app}
              className="rounded-xl border border-hae-line bg-white p-4"
            >
              <h2 className="text-sm font-semibold text-hae-ink">{section.app}</h2>
              <ul className="mt-3 space-y-2">
                {section.items.map((item) => (
                  <li
                    key={item.what}
                    className="grid gap-1 text-sm sm:grid-cols-[140px_1fr]"
                  >
                    <span className="font-medium text-hae-ink">{item.what}</span>
                    <span className="text-hae-slate">{item.where}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
