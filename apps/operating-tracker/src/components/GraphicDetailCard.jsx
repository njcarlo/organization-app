import { useEffect, useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import CommentsPanel from './CommentsPanel'
import { WHERE_TO_POST_OPTIONS } from '../constants'

/** Expanded graphic detail — where to post, caption, tagging, and comments. */
export default function GraphicDetailCard({ graphic, onChanged }) {
  const [caption, setCaption] = useState(graphic.caption || '')
  const [whoToTag, setWhoToTag] = useState(graphic.whoToTag || '')

  useEffect(() => {
    setCaption(graphic.caption || '')
    setWhoToTag(graphic.whoToTag || '')
  }, [graphic.id])

  const wherePosted = Array.isArray(graphic.whereToPost) ? graphic.whereToPost : []

  const toggleWhereToPost = async (option) => {
    const next = wherePosted.includes(option)
      ? wherePosted.filter((o) => o !== option)
      : [...wherePosted, option]
    await updateDoc(doc(db, 'trackerGraphicsRequests', graphic.id), { whereToPost: next })
    onChanged?.()
  }

  const saveCaption = async () => {
    if (caption === (graphic.caption || '')) return
    await updateDoc(doc(db, 'trackerGraphicsRequests', graphic.id), { caption: caption.trim() })
    onChanged?.()
  }

  const saveWhoToTag = async () => {
    if (whoToTag === (graphic.whoToTag || '')) return
    await updateDoc(doc(db, 'trackerGraphicsRequests', graphic.id), { whoToTag: whoToTag.trim() })
    onChanged?.()
  }

  return (
    <div className="space-y-4 rounded-xl border border-hae-line bg-white p-4 sm:p-5">
      <h3 className="text-lg font-semibold text-hae-ink">{graphic.title || 'Untitled graphic'}</h3>

      <div>
        <h4 className="mb-2 text-[11px] font-semibold tracking-wider text-hae-slate uppercase">
          Where to post?
        </h4>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {WHERE_TO_POST_OPTIONS.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm text-hae-ink">
              <input
                type="checkbox"
                checked={wherePosted.includes(option)}
                onChange={() => toggleWhereToPost(option)}
              />
              {option}
            </label>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-semibold tracking-wider text-hae-slate uppercase">Caption</span>
        <textarea
          rows={3}
          className="w-full resize-y rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onBlur={saveCaption}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-semibold tracking-wider text-hae-slate uppercase">Who to tag</span>
        <input
          className="w-full rounded-md border border-hae-line px-3 py-2 text-sm outline-none focus:border-hae-crimson"
          value={whoToTag}
          onChange={(e) => setWhoToTag(e.target.value)}
          onBlur={saveWhoToTag}
        />
      </label>

      <div className="border-t border-hae-line/60 pt-3">
        <CommentsPanel parentType="trackerGraphicsRequests" parentId={graphic.id} parentName={graphic.title} />
      </div>
    </div>
  )
}
