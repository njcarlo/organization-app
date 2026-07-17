import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import CategoryProgramPage from './CategoryProgramPage'

/** Wraps CategoryProgramPage for user-created sections, resolving the section's label for the header. */
export default function CustomSectionItemPage() {
  const { sectionId } = useParams()
  const [label, setLabel] = useState('')

  useEffect(() => {
    let cancelled = false
    getDoc(doc(db, 'customSections', sectionId))
      .then((snap) => {
        if (!cancelled && snap.exists()) setLabel(snap.data().label || '')
      })
      .catch((err) => console.error('Failed to load custom section', err))
    return () => {
      cancelled = true
    }
  }, [sectionId])

  return <CategoryProgramPage collectionName="customSectionItems" categoryLabel={label || 'Section'} />
}