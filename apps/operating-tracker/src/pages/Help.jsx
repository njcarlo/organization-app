import { HelpGuide } from '@hae/ui'
import { useAuth } from '../context/AuthContext'

export default function Help() {
  const { role, roleLabel } = useAuth()
  return (
    <HelpGuide moduleId="tracker" role={role} roleLabel={roleLabel} />
  )
}
