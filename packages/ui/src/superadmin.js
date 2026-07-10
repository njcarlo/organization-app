/** Hard-coded platform owners — always superadmin regardless of users.role */
export const SUPERADMIN_EMAILS = [
  'njcarlo@gmail.com',
  'inahmarchadesch@gmail.com',
]

export function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase()
}

export function isSuperAdminEmail(email) {
  const e = normalizeEmail(email)
  return Boolean(e) && SUPERADMIN_EMAILS.includes(e)
}
