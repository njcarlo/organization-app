import { useEffect, useState } from 'react'
import { Modal } from '@hae/ui'

function CategoryRow({ category, onRename, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(category.label)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setValue(category.label)
  }, [category.label])

  const cancel = () => {
    setValue(category.label)
    setError('')
    setEditing(false)
  }

  const save = async () => {
    const trimmed = value.trim()
    if (!trimmed || trimmed === category.label) {
      cancel()
      return
    }
    setSaving(true)
    setError('')
    try {
      await onRename(category, trimmed)
      setEditing(false)
    } catch (err) {
      setError(err.message || 'Could not rename category.')
    } finally {
      setSaving(false)
    }
  }

  const remove = () => {
    if (
      confirm(
        `Delete category "${category.label}"? Events already using it will keep the old value but it will no longer be selectable.`
      )
    ) {
      onDelete(category)
    }
  }

  return (
    <div className="border-b border-hae-line/60 py-2">
      <div className="flex items-center gap-2">
        {editing ? (
          <input
            autoFocus
            value={value}
            disabled={saving}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
              if (e.key === 'Escape') cancel()
            }}
            className="flex-1 rounded-md border border-hae-line px-2 py-1 text-sm outline-none focus:border-hae-crimson"
          />
        ) : (
          <span className="flex-1 text-sm text-hae-ink">{category.label}</span>
        )}
        {editing ? (
          <>
            <button
              type="button"
              className="hae-btn-secondary px-2 py-1 text-xs disabled:opacity-60"
              onClick={save}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              className="text-xs text-hae-slate hover:text-hae-ink"
              onClick={cancel}
              disabled={saving}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="text-xs text-hae-slate hover:text-hae-ink"
              onClick={() => setEditing(true)}
            >
              Rename
            </button>
            <button
              type="button"
              className="text-xs text-hae-crimson hover:underline"
              onClick={remove}
            >
              Delete
            </button>
          </>
        )}
      </div>
      {error ? <p className="mt-1 text-xs text-hae-crimson">{error}</p> : null}
    </div>
  )
}

/** Rename or delete event Categories in place — options come from useEventCategories. */
export default function CategoryManagerModal({ open, onClose, options, onRename, onDelete }) {
  return (
    <Modal open={open} onClose={onClose} title="Manage categories">
      <div className="max-h-[60vh] overflow-y-auto">
        {options.length === 0 ? (
          <p className="text-sm text-hae-slate">No categories yet.</p>
        ) : (
          options.map((category) => (
            <CategoryRow
              key={category.id}
              category={category}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </Modal>
  )
}
