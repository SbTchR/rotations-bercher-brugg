import { describe, expect, it, vi } from 'vitest'
import { loadViewModule } from './lazyView.js'

const memoryStorage = (initial = {}) => {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
}

describe('loadViewModule', () => {
  it('returns a view and clears a previous retry marker', async () => {
    const storage = memoryStorage({ 'rotations-view-retry:students': '1' })
    const loaded = await loadViewModule('students', async () => ({ default: 'Students' }), { storage, reload: vi.fn() })
    expect(loaded.default).toBe('Students')
    expect(storage.getItem('rotations-view-retry:students')).toBeNull()
  })

  it('reloads once when a published view file has changed', async () => {
    const storage = memoryStorage()
    const reload = vi.fn()
    void loadViewModule('students', async () => { throw new Error('ancien fichier introuvable') }, { storage, reload })
    await vi.waitFor(() => expect(reload).toHaveBeenCalledOnce())
    expect(storage.getItem('rotations-view-retry:students')).toBe('1')
  })

  it('surfaces the error after the automatic retry', async () => {
    const storage = memoryStorage({ 'rotations-view-retry:students': '1' })
    const reload = vi.fn()
    await expect(loadViewModule('students', async () => { throw new Error('toujours indisponible') }, { storage, reload })).rejects.toThrow('toujours indisponible')
    expect(reload).not.toHaveBeenCalled()
    expect(storage.getItem('rotations-view-retry:students')).toBeNull()
  })
})
