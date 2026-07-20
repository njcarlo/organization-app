import DocumentGroupsSection from '../components/DocumentGroupsSection'

const ACADEMY_LINKS_PROGRAM_ID = 'academy-links'

export default function AcademyLinks() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-hae-ink">Academy Links</h1>
        <p className="text-sm text-hae-slate">All approved links for the Academy.</p>
      </div>

      <DocumentGroupsSection programId={ACADEMY_LINKS_PROGRAM_ID} showNotes />
    </div>
  )
}
