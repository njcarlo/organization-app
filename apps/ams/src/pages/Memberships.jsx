import { useCallback, useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { Modal } from '@hae/ui'
import { db } from '../firebase'
import { MEMBERSHIP_TIERS, PAYMENT_STATUSES } from '../constants'

export default function Memberships() {
  const [memberships, setMemberships] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    memberId: '',
    tier: 'standard',
    renewalDate: '',
    paymentStatus: 'Pending',
  })

  const load = useCallback(async () => {
    const [ms, m] = await Promise.all([
      getDocs(collection(db, 'memberships')),
      getDocs(collection(db, 'members')),
    ])
    setMembers(m.docs.map((d) => ({ id: d.id, ...d.data() })))
    const list = ms.docs.map((d) => ({ id: d.id, ...d.data() }))
    list.sort((a, b) => (a.renewalDate || '').localeCompare(b.renewalDate || ''))
    setMemberships(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const create = async (e) => {
    e.preventDefault()
    const member = members.find((x) => x.id === form.memberId)
    if (!member) return
    await addDoc(collection(db, 'memberships'), {
      memberId: member.id,
      memberName: member.name,
      memberEmail: (member.email || '').toLowerCase(),
      tier: form.tier,
      renewalDate: form.renewalDate || '',
      paymentStatus: form.paymentStatus,
      createdAt: serverTimestamp(),
    })
    setForm({
      memberId: '',
      tier: 'standard',
      renewalDate: '',
      paymentStatus: 'Pending',
    })
    setOpen(false)
    load()
  }

  const updatePayment = async (id, paymentStatus) => {
    await updateDoc(doc(db, 'memberships', id), { paymentStatus })
    load()
  }

  const remove = async (id) => {
    if (!confirm('Delete membership record?')) return
    await deleteDoc(doc(db, 'memberships', id))
    load()
  }

  if (loading) return <p className="text-sm text-hae-slate">Loading memberships…</p>

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-hae-ink sm:text-4xl">Memberships</h1>
          <p className="mt-1 text-sm text-hae-slate">
            Tiers, renewal dates, and payment status
          </p>
        </div>
        <button type="button" className="hae-btn" onClick={() => setOpen(true)}>
          Add membership
        </button>
      </header>

      
      <Modal
        open={open}
        onClose={() => !saving && setOpen(false)}
        title="Add membership"
        busy={saving}
        footer={
          <>
            <button type="button" className="hae-btn-secondary" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="add-membership-form" className="hae-btn" disabled={saving}>
              {saving ? 'Saving…' : 'Add membership'}
            </button>
          </>
        }
      >
        <form id="add-membership-form" onSubmit={create} className="grid gap-3 sm:grid-cols-2">

          <select
            required
            value={form.memberId}
            onChange={(e) => setForm({ ...form, memberId: e.target.value })}
            className="border border-hae-line px-3 py-2 text-sm"
          >
            <option value="">Select member</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <select
            value={form.tier}
            onChange={(e) => setForm({ ...form, tier: e.target.value })}
            className="border border-hae-line px-3 py-2 text-sm"
          >
            {MEMBERSHIP_TIERS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={form.renewalDate}
            onChange={(e) => setForm({ ...form, renewalDate: e.target.value })}
            className="border border-hae-line px-3 py-2 text-sm"
          />
          <select
            value={form.paymentStatus}
            onChange={(e) => setForm({ ...form, paymentStatus: e.target.value })}
            className="border border-hae-line px-3 py-2 text-sm"
          >
            {PAYMENT_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </form>
      </Modal>

      <div className="hae-table-scroll border border-hae-line bg-white">
        <table className="w-full min-w-[520px] lg:min-w-[700px] text-left">
          <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
            <tr>
              <th className="px-3 py-2 font-semibold">Member</th>
              <th className="px-3 py-2 font-semibold">Tier</th>
              <th className="px-3 py-2 font-semibold">Renewal</th>
              <th className="px-3 py-2 font-semibold">Payment</th>
              <th className="px-3 py-2 font-semibold w-20" />
            </tr>
          </thead>
          <tbody>
            {memberships.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-hae-slate">
                  No memberships yet
                </td>
              </tr>
            ) : (
              memberships.map((m) => (
                <tr key={m.id} className="group border-b border-hae-line/70">
                  <td className="px-3 py-2 text-sm font-medium">{m.memberName}</td>
                  <td className="px-3 py-2 text-sm capitalize text-hae-slate">{m.tier}</td>
                  <td className="px-3 py-2 text-sm text-hae-slate">
                    {m.renewalDate || '—'}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={m.paymentStatus}
                      onChange={(e) => updatePayment(m.id, e.target.value)}
                      className="border border-hae-line px-2 py-1 text-sm"
                    >
                      {PAYMENT_STATUSES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => remove(m.id)}
                      className="text-xs text-hae-slate opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:text-hae-red"
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
