import { useMemo } from 'react'
import { projectNameOf } from '../utils'

export default function WinsSection({ tasks, projectsById }) {
  const wins = useMemo(
    () => tasks.filter((t) => t.status === 'Complete').slice(0, 12),
    [tasks]
  )

  return (
    <section className="overflow-hidden rounded-xl border border-hae-line bg-white">
      <div className="border-b border-hae-line px-4 py-3">
        <h2 className="text-sm font-semibold text-hae-ink">Wins</h2>
        <p className="text-xs text-hae-slate">Recently completed tasks</p>
      </div>
      {wins.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-hae-slate">No completed tasks yet</p>
      ) : (
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {wins.map((task) => (
            <div key={task.id} className="border-l-2 border-hae-green pl-3">
              <div className="text-sm font-medium text-hae-ink">{task.name}</div>
              <div className="text-xs text-hae-slate">
                {projectNameOf(task, projectsById)}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
