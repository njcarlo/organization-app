import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
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
import AdminAddItems from '../components/AdminAddItems'
import CategoryItemsAdmin from '../components/CategoryItemsAdmin'
import ModuleImportPanel from '../components/ModuleImportPanel'
import AdminFeatureToggles from '../components/AdminFeatureToggles'
import LeadSelect from '../components/LeadSelect'
import { namesLabel, toNameList } from '../utils'
import { useAuth } from '../context/AuthContext'
import { FEATURES, useFeatures } from '@hae/ui'
import {
  parseEmailList,
  provisionAuthUsers,
} from '../utils/provisionAuthUsers'

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
    app: 'Operations',
    items: [
      { what: 'Users', where: 'Admin → Users (this page)' },
      { what: 'Programs', where: 'Admin → Programs (this page)' },
      { what: 'Projects & tasks', where: 'Admin → Add items, or Programs → open a program' },
      { what: 'Surveys', where: 'Tracker → Surveys (or Import surveys / Admin → Bulk import)' },
    ],
  },
  {
    app: 'LMS',
    items: [
      { what: 'Courses, modules, enrollments…', where: 'Admin → Add items, Bulk import, or LMS manage pages' },
      { what: 'Learner email', where: 'Must match login email for student views' },
    ],
  },
  {
    app: 'EiR',
    items: [{ what: 'Experts', where: 'Admin → Add items / Bulk import, or EiR → Manage experts' }],
  },
  {
    app: 'CRM',
    items: [
      { what: 'Contacts & interactions', where: 'Admin → Add items / Bulk import, or CRM pages' },
      { what: 'Pipeline stage', where: 'CRM → Pipeline (moves existing contacts)' },
    ],
  },
  {
    app: 'AMS',
    items: [
      { what: 'Members, memberships, events…', where: 'Admin → Add items / Bulk import, or AMS pages' },
      { what: 'Member email', where: 'Stored on memberships for member view' },
    ],
  },
]

const TABS = [
  { id: 'add', label: 'Add items' },
  { id: 'bulk', label: 'Bulk import', feature: 'bulk_import' },
  { id: 'users', label: 'Users' },
  { id: 'programs', label: 'Programs' },
  { id: 'academy', label: 'Academy' },
  { id: 'customPrograms', label: 'Custom Programs' },
  { id: 'features', label: 'Features', superadminOnly: true },
  { id: 'data', label: 'Import / Export' },
  { id: 'guide', label: 'Where to create' },
]

function BulkImportGate() {
  const { isEnabled } = useFeatures()
  if (!isEnabled(FEATURES.BULK_IMPORT)) {
    return (
      <p className="text-sm text-hae-slate">
        Bulk import is turned off in Feature toggles.
      </p>
    )
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-hae-slate">
        Import CSV or JSON lists into Surveys, LMS, EiR, CRM, AMS, or Tracker
        tasks. Expand <strong>How to format your list</strong> for column
        names, examples, and how to paste data for Cursor / AI.
      </p>
      <ModuleImportPanel
        moduleIds={[
          'surveys',
          'contacts',
          'members',
          'experts',
          'courses',
          'enrollments',
          'courseRegistrations',
          'tasks',
        ]}
        defaultModuleId="contacts"
      />
    </div>
  )
}

export default function Admin() {
  const { isSuperAdmin } = useAuth()
  const { isEnabled } = useFeatures()
  const [tab, setTab] = useState('add')
  const visibleTabs = TABS.filter((t) => {
    if (t.superadminOnly && !isSuperAdmin) return false
    if (t.feature && !isEnabled(t.feature)) return false
    return true
  })
  const [users, setUsers] = useState([])
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'staff',
  })
  const [inviteEmails, setInviteEmails] = useState('')
  const [inviteRole, setInviteRole] = useState('staff')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [editingUserId, setEditingUserId] = useState(null)
  const [userDraft, setUserDraft] = useState(null)

  const [newProgram, setNewProgram] = useState({ name: '', lead: [] })
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
    setNotice('')
    const email = newUser.email.trim().toLowerCase()
    const name = newUser.name.trim() || email.split('@')[0]
    try {
      if (newUser.password) {
        const cred = await createUserWithEmailAndPassword(
          secondaryAuth,
          email,
          newUser.password
        )
        await setDoc(doc(db, 'users', cred.user.uid), {
          name,
          email,
          role: newUser.role,
          createdAt: serverTimestamp(),
        })
        await signOut(secondaryAuth)
        setNotice(`Created Auth account for ${email}`)
      } else {
        const { results } = await provisionAuthUsers({
          emails: [email],
          role: newUser.role,
          nameByEmail: { [email]: name },
          sendReset: true,
        })
        const row = results[0]
        if (!row || row.status === 'error') {
          throw new Error(row?.error || 'Failed to create user')
        }
        setNotice(
          row.status === 'created'
            ? `Created Auth account for ${email} and sent password reset`
            : `Auth already exists for ${email}` +
                (row.resetSent ? ' — password reset sent' : '')
        )
      }
      setNewUser({ name: '', email: '', password: '', role: 'staff' })
      await load()
    } catch (err) {
      try {
        await signOut(secondaryAuth)
      } catch {
        /* ignore */
      }
      setError(err.message || 'Failed to create user')
    }
  }

  const inviteUsers = async (e) => {
    e.preventDefault()
    setError('')
    setNotice('')
    const emails = parseEmailList(inviteEmails)
    if (emails.length === 0) {
      setError('Paste at least one valid email')
      return
    }
    setInviteBusy(true)
    try {
      const { results, via } = await provisionAuthUsers({
        emails,
        role: inviteRole,
        sendReset: true,
      })
      const created = results.filter((r) => r.status === 'created').length
      const exists = results.filter((r) => r.status === 'exists').length
      const failed = results.filter((r) => r.status === 'error')
      setNotice(
        `Firebase Auth: ${created} created, ${exists} already existed` +
          (via === 'client' ? ' (client fallback)' : '') +
          `. Password reset sent where possible.`
      )
      if (failed.length) {
        setError(
          failed.map((r) => `${r.email}: ${r.error || 'error'}`).join(' · ')
        )
      }
      setInviteEmails('')
      await load()
    } catch (err) {
      setError(err.message || 'Invite failed')
    } finally {
      setInviteBusy(false)
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

  const sendReset = async (email) => {
    if (!email) {
      setError('User has no email')
      return
    }
    setError('')
    setNotice('')
    try {
      await sendPasswordResetEmail(secondaryAuth, String(email).trim())
      setNotice(`Password reset email sent to ${email}`)
    } catch (err) {
      setError(err.message || 'Failed to send reset email')
    }
  }

  const addProgram = async (e) => {
    e.preventDefault()
    if (!newProgram.name.trim()) return
    const maxOrder = programs.reduce((m, p) => Math.max(m, p.order ?? 0), 0)
    await addDoc(collection(db, 'programs'), {
      name: newProgram.name.trim(),
      lead: newProgram.lead,
      order: maxOrder + 1,
      createdAt: serverTimestamp(),
    })
    setNewProgram({ name: '', lead: [] })
    await load()
  }

  const saveProgram = async () => {
    if (!programDraft?.name.trim()) return
    await updateDoc(doc(db, 'programs', editingProgramId), {
      name: programDraft.name.trim(),
      lead: programDraft.lead,
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
          Add platform items, manage users and programs, and import/export data
        </p>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-hae-line">
        {visibleTabs.map((t) => (
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
      {notice && <p className="text-sm text-hae-green">{notice}</p>}

      {tab === 'add' && <AdminAddItems />}

      {tab === 'bulk' && <BulkImportGate />}

      {tab === 'users' && (
        <div className="space-y-4">
          <p className="text-sm text-hae-slate">
            Adding a user creates a <strong>Firebase Auth</strong> login for that
            email (required for sign-in and password reset). Leave password blank
            to invite via reset email.
          </p>
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
              type="password"
              minLength={6}
              placeholder="Temp password (optional)"
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
              Add to Auth
            </button>
          </form>

          <form
            onSubmit={inviteUsers}
            className="space-y-3 rounded-xl border border-hae-line bg-white p-4"
          >
            <div>
              <h2 className="text-sm font-semibold text-hae-ink">
                Bulk put emails in Firebase Auth
              </h2>
              <p className="mt-1 text-xs text-hae-slate">
                Paste emails (comma, space, or newline). Creates Auth accounts if
                missing, upserts directory profiles, and sends password-reset
                emails so people can set their own password.
              </p>
            </div>
            <textarea
              rows={4}
              value={inviteEmails}
              onChange={(e) => setInviteEmails(e.target.value)}
              placeholder="name@harvardae.org&#10;another@example.com"
              className="w-full rounded-md border border-hae-line px-3 py-2 font-mono text-sm outline-none focus:border-hae-crimson"
            />
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
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
                disabled={inviteBusy}
                className="rounded-md bg-hae-crimson px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {inviteBusy ? 'Provisioning…' : 'Create Auth accounts'}
              </button>
            </div>
          </form>

          <div className="hae-table-scroll rounded-xl border border-hae-line bg-white">
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
                            onClick={() => sendReset(u.email)}
                            className="text-xs text-hae-slate hover:text-hae-crimson"
                          >
                            Reset pw
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

      {tab === 'features' && isSuperAdmin && <AdminFeatureToggles />}

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
            <LeadSelect
              value={newProgram.lead}
              onChange={(lead) => setNewProgram({ ...newProgram, lead })}
              placeholder="Overall lead"
            />
            <button
              type="submit"
              className="rounded-md bg-hae-crimson px-3 py-2 text-sm font-semibold text-white"
            >
              Add program
            </button>
          </form>

          <div className="hae-table-scroll rounded-xl border border-hae-line bg-white">
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
                        <LeadSelect
                          className="w-full rounded border border-hae-line px-2 py-1 text-sm"
                          value={programDraft.lead}
                          onChange={(lead) =>
                            setProgramDraft({ ...programDraft, lead })
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
                        {namesLabel(p.lead) || '—'}
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
                                lead: toNameList(p.lead),
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

      {tab === 'academy' && (
        <CategoryItemsAdmin collectionName="academyPrograms" itemLabel="Academy item" showCourseFields />
      )}

      {tab === 'customPrograms' && (
        <CategoryItemsAdmin collectionName="customPrograms" itemLabel="Custom program" />
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
            <h2 className="text-sm font-semibold text-hae-ink">
              Import JSON (full backup)
            </h2>
            <p className="mt-1 text-sm text-hae-slate">
              Upsert documents by <code className="text-xs">_id</code>. User
              import updates profiles only — it does not create Firebase Auth
              accounts (use Users tab → <strong>Bulk put emails in Firebase
              Auth</strong>). For everyday CSV lists of
              contacts, members, surveys, etc., prefer the{' '}
              <strong>Bulk import</strong> tab.
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
