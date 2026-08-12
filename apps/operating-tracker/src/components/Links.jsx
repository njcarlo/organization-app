import { useState } from 'react'

/**
 * URL-based links (Drive / Dropbox / SharePoint / general web links), shown
 * and edited as a table — not Firebase Storage, so Spark-safe.
 */
export function parseLinks(value) {
  if (Array.isArray(value)) {
    return value
      .map((l) => ({
        name: String(l?.name || l?.url || 'Link').trim(),
        url: String(l?.url || '').trim(),
      }))
      .filter((l) => l.url)
  }
  return []
}

/** Drop blank rows and anything that isn't a real http(s) URL before saving. */
export function sanitizeLinks(links) {
  return (Array.isArray(links) ? links : [])
    .map((l) => ({ name: String(l?.name || '').trim(), url: String(l?.url || '').trim() }))
    .filter((l) => /^https?:\/\//i.test(l.url))
    .map((l) => ({ name: l.name || l.url, url: l.url }))
}

/**
 * Links table, edited fully inline — no separate edit mode. Existing rows
 * show the label as a clickable link plus "Edit"/"×" actions; pass onEdit to
 * let a row's label/URL be rewritten in place, and onAdd to reveal a
 * "+ Add Link" row that appends without leaving this view.
 */
export function LinksTable({ links, onAdd, onEdit, onDelete }) {
  const list = parseLinks(links)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [editingIdx, setEditingIdx] = useState(null)
  const [editName, setEditName] = useState('')
  const [editUrl, setEditUrl] = useState('')

  const commitAdd = () => {
    const url = newUrl.trim()
    if (!/^https?:\/\//i.test(url)) return
    onAdd?.({ name: newName.trim() || url, url })
    setNewName('')
    setNewUrl('')
    setAdding(false)
  }
  const cancelAdd = () => {
    setAdding(false)
    setNewName('')
    setNewUrl('')
  }

  const startEdit = (idx, link) => {
    setAdding(false)
    setEditingIdx(idx)
    setEditName(link.name || '')
    setEditUrl(link.url || '')
  }
  const cancelEdit = () => {
    setEditingIdx(null)
    setEditName('')
    setEditUrl('')
  }
  const commitEdit = () => {
    const url = editUrl.trim()
    if (!/^https?:\/\//i.test(url)) return
    onEdit?.(editingIdx, { name: editName.trim() || url, url })
    cancelEdit()
  }

  if (!list.length && !adding && !onAdd) {
    return <p className="text-sm text-hae-slate">No links yet.</p>
  }

  return (
    <div>
      {(list.length || adding) ? (
        <div className="overflow-x-auto rounded-md border border-hae-line">
          <table className="w-full text-sm">
            <tbody>
              {list.map((l, idx) =>
                editingIdx === idx ? (
                  <tr key={`${l.url}-${l.name}`} className="border-b border-hae-line/60 last:border-0">
                    <td className="p-1.5" colSpan={2}>
                      <div className="flex flex-wrap gap-1.5">
                        <input
                          autoFocus
                          className="w-24 rounded border border-hae-line px-2 py-1 text-sm outline-none focus:border-hae-crimson"
                          placeholder="Label"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitEdit()
                            if (e.key === 'Escape') cancelEdit()
                          }}
                        />
                        <input
                          className="min-w-0 flex-1 rounded border border-hae-line px-2 py-1 text-sm outline-none focus:border-hae-crimson"
                          placeholder="https://..."
                          value={editUrl}
                          onChange={(e) => setEditUrl(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitEdit()
                            if (e.key === 'Escape') cancelEdit()
                          }}
                        />
                        <button
                          type="button"
                          className="text-xs font-semibold text-hae-crimson hover:underline"
                          onClick={commitEdit}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="text-xs text-hae-slate hover:text-hae-ink"
                          onClick={cancelEdit}
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={`${l.url}-${l.name}`} className="border-b border-hae-line/60 last:border-0">
                    <td className="px-3 py-1.5">
                      <a href={l.url} target="_blank" rel="noreferrer" className="text-hae-crimson hover:underline">
                        {l.name || l.url}
                      </a>
                    </td>
                    {(onEdit || onDelete) && (
                      <td className="w-16 px-2 py-1.5 text-center whitespace-nowrap">
                        {onEdit && (
                          <button
                            type="button"
                            className="mr-2 text-xs text-hae-slate/70 hover:text-hae-crimson"
                            title="Edit link"
                            onClick={() => startEdit(idx, l)}
                          >
                            Edit
                          </button>
                        )}
                        {onDelete && (
                          <button
                            type="button"
                            className="text-hae-slate/60 hover:text-hae-red"
                            title="Remove link"
                            onClick={() => onDelete(idx)}
                          >
                            ×
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                )
              )}
              {adding && (
                <tr className="border-b border-hae-line/60 last:border-0">
                  <td className="p-1.5">
                    <div className="flex gap-1.5">
                      <input
                        autoFocus
                        className="w-24 rounded border border-hae-line px-2 py-1 text-sm outline-none focus:border-hae-crimson"
                        placeholder="Label"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') cancelAdd()
                        }}
                      />
                      <input
                        className="flex-1 rounded border border-hae-line px-2 py-1 text-sm outline-none focus:border-hae-crimson"
                        placeholder="https://..."
                        value={newUrl}
                        onChange={(e) => setNewUrl(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitAdd()
                          if (e.key === 'Escape') cancelAdd()
                        }}
                        onBlur={() => {
                          if (newUrl.trim()) commitAdd()
                          else cancelAdd()
                        }}
                      />
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : null}
      {onAdd && !adding && (
        <button
          type="button"
          className="mt-1.5 text-xs font-semibold text-hae-crimson hover:underline"
          onClick={() => setAdding(true)}
        >
          + Add Link
        </button>
      )}
    </div>
  )
}

/** Editable table of links: add/remove rows of Label + URL. */
export function LinksEditor({ links, onChange, className = '' }) {
  const rows = Array.isArray(links) ? links : []

  const updateRow = (idx, patch) => {
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }
  const addRow = () => onChange([...rows, { name: '', url: '' }])
  const removeRow = (idx) => onChange(rows.filter((_, i) => i !== idx))

  return (
    <div className={`block ${className}`}>
      <span className="mb-1 block text-[10px] font-semibold tracking-wide text-hae-slate/80 uppercase">Links</span>
      <div className="overflow-x-auto rounded-md border border-hae-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hae-line bg-hae-mist/40 text-left text-[10px] font-semibold tracking-wide text-hae-slate uppercase">
              <th className="px-2 py-1.5">Label</th>
              <th className="px-2 py-1.5">URL</th>
              <th className="w-8 px-2 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row, idx) => (
                <tr key={idx} className="border-b border-hae-line/60 last:border-0">
                  <td className="p-1.5">
                    <input
                      className="w-full rounded border border-hae-line px-2 py-1 text-sm outline-none focus:border-hae-crimson"
                      placeholder="Label"
                      value={row.name}
                      onChange={(e) => updateRow(idx, { name: e.target.value })}
                    />
                  </td>
                  <td className="p-1.5">
                    <input
                      className="w-full rounded border border-hae-line px-2 py-1 text-sm outline-none focus:border-hae-crimson"
                      placeholder="https://..."
                      value={row.url}
                      onChange={(e) => updateRow(idx, { url: e.target.value })}
                    />
                  </td>
                  <td className="p-1.5 text-center">
                    <button
                      type="button"
                      className="text-hae-slate/60 hover:text-hae-red"
                      title="Remove link"
                      onClick={() => removeRow(idx)}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="px-2 py-2 text-center text-xs text-hae-slate">
                  No links yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="mt-1.5 text-xs font-semibold text-hae-crimson hover:underline"
        onClick={addRow}
      >
        + Add Link
      </button>
    </div>
  )
}
