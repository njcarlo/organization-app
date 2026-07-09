import { useCallback, useEffect, useState } from 'react'
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
import { db, secondaryAuth } from '../firebase'

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
    role: 'user',
  })
  const [editingUserId, setEditingUserId] = useState(null)
  const [userDraft, setUserDraft] = useState(null)

  const [newProgram, setNewProgram] = useState({ name: '', lead: '' })
  const [editingProgramId, setEditingProgramId] = useState(null)
  const [programDraft, setProgramDraft] = useState(null)

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
      setNewUser({ name: '', email: '', password: '', role: 'user' })
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
        <h1 className="font-display text-4xl text-hae-ink md:text-5xl">Admin</h1>
        <p className="mt-1 text-sm text-hae-slate">Manage users and programs</p>
      </header>

      <div className="flex gap-2 border-b border-hae-line">
        {['users', 'programs'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`border-b-2 px-3 py-2 text-sm font-semibold capitalize ${
              tab === t
                ? 'border-hae-crimson text-hae-crimson'
                : 'border-transparent text-hae-slate'
            }`}
          >
            {t}
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
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
            />
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              className="rounded-md border border-hae-line px-3 py-2 text-sm"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="submit"
              className="rounded-md bg-hae-crimson px-3 py-2 text-sm font-semibold text-white"
            >
              Add user
            </button>
          </form>

          <div className="overflow-hidden rounded-xl border border-hae-line bg-white">
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
                          value={userDraft.role}
                          onChange={(e) =>
                            setUserDraft({ ...userDraft, role: e.target.value })
                          }
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
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
                              : 'bg-slate-100 text-hae-slate'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100">
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
              onChange={(e) => setNewProgram({ ...newProgram, name: e.target.value })}
              className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
            />
            <input
              placeholder="Overall lead"
              value={newProgram.lead}
              onChange={(e) => setNewProgram({ ...newProgram, lead: e.target.value })}
              className="rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
            />
            <button
              type="submit"
              className="rounded-md bg-hae-crimson px-3 py-2 text-sm font-semibold text-white"
            >
              Add program
            </button>
          </form>

          <div className="overflow-hidden rounded-xl border border-hae-line bg-white">
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
                            setProgramDraft({ ...programDraft, name: e.target.value })
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className="w-full rounded border border-hae-line px-2 py-1 text-sm"
                          value={programDraft.lead}
                          onChange={(e) =>
                            setProgramDraft({ ...programDraft, lead: e.target.value })
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
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProgramId(p.id)
                              setProgramDraft({ name: p.name, lead: p.lead || '' })
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
    </div>
  )
}
