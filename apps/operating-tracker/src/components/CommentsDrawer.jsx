import { Drawer } from '@hae/ui'
import ActivityLog from './ActivityLog'
import CommentsPanel from './CommentsPanel'

/** Right-side collapsible pane for a task/project's comments + notes and activity history. */
export default function CommentsDrawer({
  open,
  onClose,
  parentType,
  parentId,
  parentName,
  programId,
  programPath,
}) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={parentName ? `Comments · ${parentName}` : 'Comments'}
      size="sm"
    >
      {parentId ? (
        <div className="space-y-4">
          <CommentsPanel
            parentType={parentType}
            parentId={parentId}
            parentName={parentName}
            programId={programId}
            programPath={programPath}
          />
          <div className="border-t border-hae-line/60 pt-4">
            <ActivityLog parentType={parentType} parentId={parentId} />
          </div>
        </div>
      ) : null}
    </Drawer>
  )
}
