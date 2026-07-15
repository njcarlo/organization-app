import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@hae/firebase'

let cache = null
let inflight = null

function fetchUsers() {
  if (!inflight) {
    inflight = getDocs(collection(db, 'users')).then((snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      cache = list
      return list
    })
  }
  return inflight
}

/** All HAE staff/admin users, for @mention autocomplete. Fetched once and cached across apps. */
export function useStaffUsers() {
  const [users, setUsers] = useState(cache || [])

  useEffect(() => {
    if (cache) return
    let cancelled = false
    fetchUsers().then((list) => {
      if (!cancelled) setUsers(list)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return users
}
