import { useAuth } from './AuthContext.jsx'
import { FeaturesProvider } from './FeaturesContext.jsx'

/** Wraps children with FeaturesProvider using shared @hae/ui AuthContext. */
export default function FeaturesGate({ children }) {
  const { isSuperAdmin } = useAuth()
  return <FeaturesProvider isSuperAdmin={!!isSuperAdmin}>{children}</FeaturesProvider>
}
