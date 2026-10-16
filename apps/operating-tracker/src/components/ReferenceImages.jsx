import { useRef, useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { logHistory } from '../utils/activityLog'

// No Firebase Storage on this project (Blaze-only), so reference images are
// downscaled + JPEG-compressed in the browser and saved as data URLs on the
// record itself. Firestore caps a document at 1 MiB, so each image gets a
// fixed budget and a record holds at most MAX_IMAGES.
const MAX_IMAGES = 5
const MAX_DATA_URL_CHARS = 140_000 // ~100 KB of JPEG once base64-encoded
const MAX_DIMENSION = 1280

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`Couldn't read ${file.name} as an image`))
    }
    img.src = url
  })
}

async function compressImage(file) {
  const img = await loadImage(file)
  let scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight))
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  // Shrink quality first, then dimensions, until the image fits its budget.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    ctx.fillStyle = '#ffffff' // flatten PNG transparency instead of turning it black
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    for (const quality of [0.8, 0.65, 0.5]) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      if (dataUrl.length <= MAX_DATA_URL_CHARS) {
        return { dataUrl, name: file.name, width: canvas.width, height: canvas.height }
      }
    }
    scale *= 0.75
  }
  throw new Error(`${file.name} is too large to attach`)
}

/**
 * Compressed reference images stored on a record's `referenceImages` array.
 * Used by the Graphics and Social Media Calendar detail cards; the record's
 * link field stays the source of truth for the full-quality file.
 */
export default function ReferenceImages({
  collectionName,
  docId,
  parentName,
  images = [],
  readOnly = false,
  onChanged,
}) {
  const { user, userProfile } = useAuth()
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [previewIndex, setPreviewIndex] = useState(null)
  const list = Array.isArray(images) ? images : []
  const remaining = MAX_IMAGES - list.length

  const save = async (next, action) => {
    await updateDoc(doc(db, collectionName, docId), { referenceImages: next })
    logHistory({
      parentType: collectionName,
      parentId: docId,
      parentName,
      action: 'updated',
      changes: [{ field: 'referenceImages', label: 'Reference images', before: '—', after: action }],
      byId: user?.uid,
      byName: userProfile?.name || user?.email || 'Someone',
    })
    onChanged?.()
  }

  const addFiles = async (e) => {
    const files = [...(e.target.files || [])].filter((f) => f.type.startsWith('image/'))
    e.target.value = ''
    if (!files.length || readOnly) return
    setError('')
    if (files.length > remaining) {
      setError(`Up to ${MAX_IMAGES} images per item — only the first ${remaining} were added.`)
    }
    const picked = files.slice(0, remaining)
    if (!picked.length) return
    setBusy(true)
    try {
      const compressed = []
      for (const file of picked) compressed.push(await compressImage(file))
      const added = compressed.map((c) => ({ ...c, addedAt: new Date().toISOString() }))
      await save([...list, ...added], `Added ${added.map((a) => a.name).join(', ')}`)
    } catch (err) {
      setError(err.message || 'Failed to attach image')
    } finally {
      setBusy(false)
    }
  }

  const removeAt = async (index) => {
    if (readOnly || busy) return
    if (!confirm('Remove this image?')) return
    setBusy(true)
    setError('')
    try {
      const removed = list[index]
      await save(
        list.filter((_, i) => i !== index),
        `Removed ${removed?.name || 'image'}`
      )
      setPreviewIndex(null)
    } catch (err) {
      setError(err.message || 'Failed to remove image')
    } finally {
      setBusy(false)
    }
  }

  const preview = previewIndex != null ? list[previewIndex] : null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-[11px] font-semibold tracking-wider text-hae-slate uppercase">Reference images</h4>
        {!readOnly && remaining > 0 ? (
          <>
            <button
              type="button"
              className="hae-btn-secondary px-2 py-1 text-xs disabled:opacity-60"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
            >
              {busy ? 'Compressing…' : '+ Attach images'}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={addFiles}
            />
          </>
        ) : null}
      </div>
      <p className="text-xs text-hae-slate">
        For reference only — images are automatically compressed and may look lower quality. Use the
        link field for the full-resolution file.
      </p>
      {error && <p className="text-xs text-hae-red">{error}</p>}

      {list.length === 0 ? (
        <p className="text-sm text-hae-slate">No images attached.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {list.map((img, i) => (
            <div key={`${img.addedAt}-${i}`} className="group relative">
              <button
                type="button"
                onClick={() => setPreviewIndex(previewIndex === i ? null : i)}
                className={`block h-20 w-20 overflow-hidden rounded-md border bg-hae-mist/40 ${
                  previewIndex === i ? 'border-hae-crimson' : 'border-hae-line'
                }`}
                title={img.name}
              >
                <img src={img.dataUrl} alt={img.name || 'Reference image'} className="h-full w-full object-cover" />
              </button>
              {!readOnly ? (
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  disabled={busy}
                  className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-hae-line bg-white text-xs text-hae-ink shadow-sm"
                  aria-label={`Remove ${img.name || 'image'}`}
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {preview ? (
        <figure className="rounded-md border border-hae-line bg-hae-mist/30 p-2">
          <img
            src={preview.dataUrl}
            alt={preview.name || 'Reference image'}
            className="mx-auto max-h-96 w-auto object-contain"
          />
          <figcaption className="mt-1 text-center text-xs text-hae-slate">{preview.name}</figcaption>
        </figure>
      ) : null}
    </div>
  )
}
