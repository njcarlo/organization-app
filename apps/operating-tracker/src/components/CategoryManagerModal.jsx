import { useEffect, useState } from 'react'
import { Modal } from '@hae/ui'
import { CATEGORY_COLOR_OPTIONS } from '../constants'

function AddCategoryForm({ onAdd }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || saving) return
    setSaving(true)
    setError('')
    try {
      const added = await onAdd(trimmed)
      if (added) setName('')
      else setError(`"${trimmed}" already exists.`)
    } catch (err) {
      setError(err.message || 'Could not add category.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="mb-3 flex items-start gap-2">
      <div className="flex-1">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New category name"
          disabled={saving}
          className="w-full rounded-md border border-hae-line px-2 py-1.5 text-sm outline-none focus:border-hae-crimson"
        />
        {error ? <p className="mt-1 text-xs text-hae-crimson">{error}</p> : null}
      </div>
      <button type="submit" className="hae-btn px-3 py-1.5 text-xs disabled:opacity-60" disabled={saving}>
        {saving ? 'Adding…' : 'Add'}
      </button>
    </form>
  )
}

function ColorSwatches({ category, onRecolor }) {
  const [saving, setSaving] = useState(false)

  const pick = async (className) => {
    if (className === category.className || saving) return
    setSaving(true)
    try {
      await onRecolor(category, className)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {CATEGORY_COLOR_OPTIONS.map((c) => {
        const active = c.className === category.className
        return (
          <button
            key={c.className}
            type="button"
            title={c.label}
            aria-label={`Set color to ${c.label}`}
            disabled={saving}
            onClick={() => pick(c.className)}
            className={`h-5 w-5 rounded-full border-2 disabled:opacity-60 ${c.className.split(' ')[0]} ${
              active ? 'border-hae-ink' : 'border-transparent'
            }`}
          />
        )
      })}
    </div>
  )
}

function CategoryRow({ category, onRename, onDelete, onRecolor }) {
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
        <span
          className={`inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${category.className.split(' ')[0]}`}
        />
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
      <ColorSwatches category={category} onRecolor={onRecolor} />
    </div>
  )
}

/** Add, rename, recolor, or delete event Categories in place — options come from useEventCategories. */
export default function CategoryManagerModal({
  open,
  onClose,
  options,
  onAdd,
  onRename,
  onDelete,
  onRecolor,
}) {
  return (
    <Modal open={open} onClose={onClose} title="Manage categories">
      <AddCategoryForm onAdd={onAdd} />
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
              onRecolor={onRecolor}
            />
          ))
        )}
      </div>
    </Modal>
  )
}
