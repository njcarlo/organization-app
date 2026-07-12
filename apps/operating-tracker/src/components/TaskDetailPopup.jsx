import { Modal } from '@hae/ui'
import {
  effectivePriority,
  formatDate,
  namesLabel,
  programNameOf,
  projectNameOf,
} from '../utils'

function Row({ label, value }) {
  if (value == null || value === '') return null
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2 border-b border-hae-line/60 py-2 last:border-0 sm:grid-cols-[8.5rem_1fr]">
      <dt className="text-[11px] font-semibold tracking-wide text-hae-slate uppercase">
        {label}
      </dt>
      <dd className="text-sm text-hae-ink break-words">{value}</dd>
    </div>
  )
}

/**
 * Read-only floating popup for mobile task/attention cards.
 */
export default function TaskDetailPopup({
  open,
  onClose,
  title = 'Details',
  rows = [],
  footer = null,
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="md" footer={footer}>
      <dl className="-my-1">
        {rows.map((row) => (
          <Row key={row.label} label={row.label} value={row.value} />
        ))}
      </dl>
    </Modal>
  )
}

export function taskDetailRows(task, { programsById = {}, projectsById = {} } = {}) {
  if (!task) return []
  return [
    { label: 'Status', value: task.status || '—' },
    { label: 'Due', value: formatDate(task.dueDate) },
    { label: 'Owner', value: namesLabel(task.owner) },
    { label: 'Program', value: programNameOf(task, programsById) },
    { label: 'Project', value: projectNameOf(task, projectsById) },
    { label: 'Priority', value: effectivePriority(task) },
    { label: 'Waiting on', value: task.waitingOn || '' },
    { label: 'Leadership', value: task.leadershipAttention || '' },
    { label: 'Next action', value: task.nextAction || '' },
    { label: 'Notes', value: task.notes || '' },
  ]
}
