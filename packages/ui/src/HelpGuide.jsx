import { useEffect, useMemo, useState } from 'react'
import { useAuthOptional } from './AuthContext.jsx'
import { sectionsForRole } from './helpContent.js'

/**
 * In-app documentation.
 *
 * Apps that use @hae/ui AuthProvider can render <HelpGuide moduleId="lms" />.
 * Operating Tracker uses its own AuthProvider — pass role + roleLabel props:
 *   <HelpGuide moduleId="tracker" role={role} roleLabel={roleLabel} />
 */
export default function HelpGuide({
  moduleId = null,
  role: roleProp,
  roleLabel: roleLabelProp,
}) {
  // Prefer explicit props (Tracker) so we never touch @hae/ui AuthContext.
  if (roleProp !== undefined) {
    return (
      <HelpGuideView
        moduleId={moduleId}
        role={roleProp || 'member'}
        roleLabel={roleLabelProp || ''}
      />
    )
  }
  return <HelpGuideFromAuth moduleId={moduleId} />
}

function HelpGuideFromAuth({ moduleId }) {
  const auth = useAuthOptional()
  return (
    <HelpGuideView
      moduleId={moduleId}
      role={auth?.role || 'member'}
      roleLabel={auth?.roleLabel || ''}
    />
  )
}

function HelpGuideView({ moduleId, role, roleLabel }) {
  const sections = useMemo(() => sectionsForRole(role), [role])
  const [query, setQuery] = useState('')
  const [activeId, setActiveId] = useState(
    () => moduleId || sections[0]?.id || 'start'
  )

  useEffect(() => {
    if (moduleId && sections.some((s) => s.id === moduleId)) {
      setActiveId(moduleId)
    }
  }, [moduleId, sections])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sections
    return sections
      .map((section) => {
        const body = section.body.filter((block) => {
          const hay = [block.heading, ...(block.steps || [])]
            .join(' ')
            .toLowerCase()
          return (
            section.title.toLowerCase().includes(q) ||
            hay.includes(q)
          )
        })
        if (
          !body.length &&
          !section.title.toLowerCase().includes(q)
        ) {
          return null
        }
        return { ...section, body: body.length ? body : section.body }
      })
      .filter(Boolean)
  }, [sections, query])

  const active =
    filtered.find((s) => s.id === activeId) || filtered[0] || null

  useEffect(() => {
    if (active && active.id !== activeId) setActiveId(active.id)
  }, [active, activeId])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-hae-ink sm:text-4xl md:text-5xl">
          Help
        </h1>
        <p className="mt-1 text-sm text-hae-slate">
          How to use the HAE platform
          {roleLabel ? ` · showing guides for ${roleLabel}` : ''}
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search help…"
          className="w-full max-w-md rounded-md border border-hae-line bg-white px-3 py-2 text-sm outline-none focus:border-hae-crimson"
        />
        <p className="text-xs text-hae-slate">
          Tip: open Help anytime from the sidebar.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="space-y-1 lg:sticky lg:top-6 lg:self-start">
          {filtered.length === 0 ? (
            <p className="text-sm text-hae-slate">No matching topics.</p>
          ) : (
            filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveId(s.id)}
                className={`block w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  active?.id === s.id
                    ? 'bg-hae-crimson/10 font-semibold text-hae-crimson'
                    : 'text-hae-ink/80 hover:bg-black/5'
                }`}
              >
                {s.title}
              </button>
            ))
          )}
        </nav>

        <div className="min-w-0 space-y-6">
          {!active ? (
            <p className="text-sm text-hae-slate">Select a topic.</p>
          ) : (
            <article className="rounded-xl border border-hae-line bg-white p-5 sm:p-6">
              <h2 className="font-display text-2xl text-hae-ink">{active.title}</h2>
              <div className="mt-5 space-y-6">
                {active.body.map((block) => (
                  <section key={block.heading}>
                    <h3 className="text-sm font-semibold text-hae-ink">
                      {block.heading}
                    </h3>
                    <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-hae-slate">
                      {(block.steps || []).map((step) => (
                        <li key={step} className="leading-relaxed">
                          {step}
                        </li>
                      ))}
                    </ol>
                  </section>
                ))}
              </div>
            </article>
          )}

          <aside className="rounded-xl border border-dashed border-hae-line bg-hae-mist/50 p-4 text-sm text-hae-slate">
            <p className="font-medium text-hae-ink">Still stuck?</p>
            <p className="mt-1">
              Ask an HAE admin to check your role and email on Tracker → Admin →
              Users. For LMS/AMS self-service views, your login email must match
              the learner or member email on the record.
            </p>
          </aside>
        </div>
      </div>
    </div>
  )
}
