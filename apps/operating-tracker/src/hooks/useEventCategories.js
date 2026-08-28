import { useCallback, useEffect, useState } from 'react'
import { addDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { EVENT_TYPE_OPTIONS } from '../constants'

let cache = null
let inflight = null

function mergeOptions(custom) {
  const extra = custom
    .filter((c) => !EVENT_TYPE_OPTIONS.some((o) => o.value === c.name))
    .map((c) => ({ value: c.name, label: c.name, className: 'bg-gray-200 text-black' }))
  return [...EVENT_TYPE_OPTIONS, ...extra].sort((a, b) => a.label.localeCompare(b.label))
}

function fetchCustom() {
  if (!inflight) {
    inflight = getDocs(collection(db, 'eventCategories')).then((snap) => {
      cache = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      return cache
    })
  }
  return inflight
}

/** Event "Category" dropdown options: the built-in list plus any org-added custom categories. */
export function useEventCategories() {
  const [custom, setCustom] = useState(cache || [])

  const load = useCallback(async () => {
    inflight = null
    const list = await fetchCustom()
    setCustom(list)
  }, [])

  useEffect(() => {
    if (cache) return
    let cancelled = false
    fetchCustom().then((list) => {
      if (!cancelled) setCustom(list)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const addCategory = useCallback(
    async (name) => {
      const trimmed = name.trim()
      if (!trimmed) return null
      const existing = mergeOptions(custom).find(
        (o) => o.value.toLowerCase() === trimmed.toLowerCase()
      )
      if (existing) return existing.value
      await addDoc(collection(db, 'eventCategories'), {
        name: trimmed,
        createdAt: serverTimestamp(),
      })
      await load()
      return trimmed
    },
    [custom, load]
  )

  return { options: mergeOptions(custom), addCategory }
}
