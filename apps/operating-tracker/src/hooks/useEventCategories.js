import { useCallback, useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase'
import { EVENT_TYPE_OPTIONS } from '../constants'

let cache = null
let inflight = null

function toOptions(categories) {
  return [...categories]
    .map((c) => ({
      id: c.id,
      value: c.name,
      label: c.name,
      className: c.className || 'bg-gray-200 text-black',
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

/** One-time migration: seed the collection from the built-in list the first time it's empty. */
async function seedIfEmpty(categories) {
  if (categories.length > 0) return categories
  const batch = writeBatch(db)
  const seeded = EVENT_TYPE_OPTIONS.map((o) => {
    const ref = doc(collection(db, 'eventCategories'))
    batch.set(ref, { name: o.value, className: o.className, createdAt: serverTimestamp() })
    return { id: ref.id, name: o.value, className: o.className }
  })
  await batch.commit()
  return seeded
}

function fetchCategories() {
  if (!inflight) {
    inflight = getDocs(collection(db, 'eventCategories'))
      .then((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      .then(seedIfEmpty)
      .then((categories) => {
        cache = categories
        return categories
      })
  }
  return inflight
}

/**
 * Event "Category" dropdown, backed by Firestore so it can be renamed/deleted from the UI.
 * Renaming updates every trackerEvents doc using the old name so existing events stay correct.
 */
export function useEventCategories() {
  const [categories, setCategories] = useState(cache || [])

  const load = useCallback(async () => {
    inflight = null
    const list = await fetchCategories()
    setCategories(list)
  }, [])

  useEffect(() => {
    if (cache) return
    let cancelled = false
    fetchCategories().then((list) => {
      if (!cancelled) setCategories(list)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const addCategory = useCallback(
    async (name) => {
      const trimmed = name.trim()
      if (!trimmed) return null
      const existing = categories.find((c) => c.name.toLowerCase() === trimmed.toLowerCase())
      if (existing) return existing.name
      // Re-adding a built-in name (e.g. after deleting it) restores its original color.
      const builtIn = EVENT_TYPE_OPTIONS.find(
        (o) => o.value.toLowerCase() === trimmed.toLowerCase()
      )
      await addDoc(collection(db, 'eventCategories'), {
        name: trimmed,
        className: builtIn?.className || null,
        createdAt: serverTimestamp(),
      })
      await load()
      return trimmed
    },
    [categories, load]
  )

  const setCategoryColor = useCallback(
    async (category, className) => {
      await updateDoc(doc(db, 'eventCategories', category.id), { className })
      await load()
    },
    [load]
  )

  const renameCategory = useCallback(
    async (category, newName) => {
      const oldName = category.value ?? category.name
      const trimmed = newName.trim()
      if (!trimmed || trimmed === oldName) return
      const dupe = categories.find(
        (c) => c.id !== category.id && c.name.toLowerCase() === trimmed.toLowerCase()
      )
      if (dupe) throw new Error(`"${trimmed}" already exists.`)
      await updateDoc(doc(db, 'eventCategories', category.id), { name: trimmed })
      const affected = await getDocs(
        query(collection(db, 'trackerEvents'), where('type', '==', oldName))
      )
      if (!affected.empty) {
        const batch = writeBatch(db)
        affected.docs.forEach((d) => batch.update(d.ref, { type: trimmed }))
        await batch.commit()
      }
      await load()
    },
    [categories, load]
  )

  const deleteCategory = useCallback(
    async (category) => {
      await deleteDoc(doc(db, 'eventCategories', category.id))
      await load()
    },
    [load]
  )

  return {
    options: toOptions(categories),
    categories,
    addCategory,
    renameCategory,
    deleteCategory,
    setCategoryColor,
  }
}
