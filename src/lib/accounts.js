export const ACCOUNT_DOMAIN = 'comptes.rotations-bercher-brugg.invalid'

export function normalizeAccountId(value) {
  return String(value || '').trim().toLowerCase()
}

export function accountEmail(accountId) {
  const normalized = normalizeAccountId(accountId)
  if (!/^responsable[1-5]$/.test(normalized)) {
    throw new Error('Identifiant ou mot de passe incorrect.')
  }
  return `${normalized}@${ACCOUNT_DOMAIN}`
}

export function accountLabel(email) {
  const [accountId, domain] = String(email || '').toLowerCase().split('@')
  if (domain === ACCOUNT_DOMAIN && /^responsable[1-5]$/.test(accountId)) {
    return `Responsable ${accountId.slice(-1)}`
  }
  return email || 'Mode démonstration'
}
