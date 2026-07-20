import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { NavIcon } from '@hae/ui'

/**
 * Soft, animated drag-reordering for a vertical list of items — same
 * @dnd-kit-based feel as the sidebar's category reordering (SideNav), so
 * dragging a project feels consistent with dragging a sidebar item.
 * `items` must each carry a stable `id`; `onReorder` receives the full
 * reordered array so the caller can persist it.
 */
function SortableRow({ id, checkbox, children }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group/drag flex items-start gap-1 ${isDragging ? 'z-10 opacity-90' : ''}`}
    >
      <div className="flex shrink-0 items-center gap-1 pt-4">
        {checkbox}
        <button
          type="button"
          {...attributes}
          {...listeners}
          ref={setActivatorNodeRef}
          aria-label="Reorder"
          title="Drag to reorder"
          className="flex h-5 w-5 touch-none items-center justify-center rounded text-hae-slate/40 opacity-0 hover:text-hae-ink active:cursor-grabbing cursor-grab group-hover/drag:opacity-100"
        >
          <NavIcon name="grip" className="[&>svg]:h-4 [&>svg]:w-4" />
        </button>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

export default function DraggableList({ items, onReorder, renderItem, renderCheckbox }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((it) => it.id === active.id)
    const newIndex = items.findIndex((it) => it.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    onReorder(arrayMove(items, oldIndex, newIndex))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((it) => it.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {items.map((item) => (
            <SortableRow key={item.id} id={item.id} checkbox={renderCheckbox?.(item)}>
              {renderItem(item)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
