import { lazy } from 'react'

const retryPrefix = 'rotations-view-retry:'

const getRetryStorage = () => {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export async function loadViewModule(viewName, importer, runtime = null) {
  const retryKey = `${retryPrefix}${viewName}`
  const storage = runtime?.storage ?? getRetryStorage()
  const reload = runtime?.reload ?? (() => window.location.reload())

  try {
    const loaded = await importer()
    storage?.removeItem(retryKey)
    return loaded
  } catch (error) {
    const alreadyRetried = storage?.getItem(retryKey) === '1'
    if (!alreadyRetried) {
      storage?.setItem(retryKey, '1')
      reload()
      return new Promise(() => {})
    }
    storage?.removeItem(retryKey)
    throw error
  }
}

export const lazyView = (viewName, importer) => lazy(() => loadViewModule(viewName, importer))
