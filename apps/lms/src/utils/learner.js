/** Match LMS learner records to the signed-in user profile. */
export function matchesLearner(record, profile) {
  if (!record || !profile) return false
  const email = (profile.email || '').trim().toLowerCase()
  const name = (profile.name || '').trim().toLowerCase()
  const recEmail = (record.learnerEmail || '').trim().toLowerCase()
  const recName = (record.learnerName || '').trim().toLowerCase()
  if (email && recEmail && email === recEmail) return true
  if (name && recName && name === recName) return true
  return false
}

export const CATALOG_STATUSES = ['Open', 'In Progress']
