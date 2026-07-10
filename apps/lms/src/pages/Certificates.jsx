import { useCallback, useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore'
import { Modal } from '@hae/ui'
import { db } from '../firebase'

export default function Certificates() {
  const [items, setItems] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [enrollmentId, setEnrollmentId] = useState('')

  const load = useCallback(async () => {
    const [certSnap, enSnap] = await Promise.all([
      getDocs(collection(db, 'certificates')),
      getDocs(collection(db, 'enrollments')),
    ])
    setItems(
      certSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.issuedAt || '').localeCompare(a.issuedAt || ''))
    )
    setEnrollments(
      enSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((e) =>
          ['Completed', 'Certificate Eligible'].includes(e.status)
        )
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const issue = async (e) => {
    e.preventDefault()
    const enrollment = enrollments.find((x) => x.id === enrollmentId)
    if (!enrollment) return
    const issuedAt = new Date().toISOString().slice(0, 10)
    await addDoc(collection(db, 'certificates'), {
      enrollmentId: enrollment.id,
      learnerName: enrollment.learnerName,
      learnerEmail: enrollment.learnerEmail || '',
      courseId: enrollment.courseId,
      courseName: enrollment.courseName,
      issuedAt,
      status: 'Issued',
      createdAt: serverTimestamp(),
    })
    setEnrollmentId('')
    setOpen(false)
    load()
  }

  const remove = async (id) => {
    if (!confirm('Delete certificate record?')) return
    await deleteDoc(doc(db, 'certificates', id))
    load()
  }

  if (loading) return <p className="text-sm text-hae-slate">Loading certificates…</p>

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-hae-ink sm:text-4xl">Certificates</h1>
        <p className="mt-1 text-sm text-hae-slate">
          HAE Certificate of Completion records for eligible learners
        </p>
      </header>

      
      
      <div className="hae-form-actions">
        <button type="button" className="hae-btn" onClick={() => setOpen(true)}>
          Issue certificate
        </button>
      </div>
<Modal
        open={open}
        onClose={() => !saving && setOpen(false)}
        title="Issue certificate"
        busy={saving}
        footer={
          <>
            <button type="button" className="hae-btn-secondary" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="cert-form" className="hae-btn" disabled={saving}>
              {saving ? 'Saving…' : 'Issue certificate'}
            </button>
          </>
        }
      >
        <form id="cert-form" onSubmit={issue} className="grid gap-3 sm:grid-cols-2">

<select
          required
          value={enrollmentId}
          onChange={(e) => setEnrollmentId(e.target.value)}
          className="border border-hae-line px-3 py-2 text-sm sm:col-span-2"
        >
          <option value="">Select completed / eligible enrollment</option>
          {enrollments.map((e) => (
            <option key={e.id} value={e.id}>
              {e.learnerName} — {e.courseName} ({e.status})
            </option>
          ))}
        </select>
        </form>
      </Modal>


      <div className="overflow-x-auto border border-hae-line bg-white">
        <table className="w-full min-w-[700px] text-left">
          <thead className="bg-hae-mist/80 text-[11px] tracking-wide text-hae-slate uppercase">
            <tr>
              <th className="px-3 py-2 font-semibold">Issued</th>
              <th className="px-3 py-2 font-semibold">Learner</th>
              <th className="px-3 py-2 font-semibold">Course</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold w-20" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-hae-slate">
                  No certificates issued yet
                </td>
              </tr>
            ) : (
              items.map((c) => (
                <tr key={c.id} className="group border-b border-hae-line/70">
                  <td className="px-3 py-2 text-sm text-hae-slate">{c.issuedAt}</td>
                  <td className="px-3 py-2">
                    <div className="text-sm font-medium">{c.learnerName}</div>
                    <div className="text-xs text-hae-slate">{c.learnerEmail || '—'}</div>
                  </td>
                  <td className="px-3 py-2 text-sm text-hae-slate">{c.courseName}</td>
                  <td className="px-3 py-2 text-sm text-hae-slate">{c.status}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => remove(c.id)}
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
