import { describe, expect, it } from 'vitest'
import { accountEmail, accountLabel, normalizeAccountId } from './accounts'

describe('generic accounts', () => {
  it('normalizes a valid reusable identifier', () => {
    expect(normalizeAccountId(' Responsable3 ')).toBe('responsable3')
    expect(accountEmail(' Responsable3 ')).toBe('responsable3@comptes.rotations-bercher-brugg.invalid')
  })

  it('rejects identifiers that were not created in advance', () => {
    expect(() => accountEmail('responsable6')).toThrow('Identifiant ou mot de passe incorrect.')
  })

  it('shows a friendly account label instead of the technical email', () => {
    expect(accountLabel('responsable4@comptes.rotations-bercher-brugg.invalid')).toBe('Responsable 4')
  })
})
