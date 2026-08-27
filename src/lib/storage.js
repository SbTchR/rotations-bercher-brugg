import { createClient } from '@supabase/supabase-js'
import { createBlankWorkspace, createDemoWorkspace, normalizeWorkspace } from '../data/demoData'

const LOCAL_KEY = 'rotations-bercher-brugg-v2'
const config = globalThis.window?.ROTATIONS_CONFIG || {}
export const cloudEnabled = Boolean(config.supabaseUrl && config.supabaseAnonKey)
const hostname = globalThis.window?.location?.hostname || ''
export const demoModeAllowed = config.allowDemo === true || ['localhost', '127.0.0.1', '[::1]'].includes(hostname)
export const supabase = cloudEnabled ? createClient(config.supabaseUrl, config.supabaseAnonKey) : null

export async function requestMagicLink(email) {
  if (!supabase) throw new Error('Le stockage partagé n’est pas configuré.')
  const redirectTo = `${window.location.origin}${window.location.pathname}`
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } })
  if (error) throw error
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut()
}

export async function getSession() {
  if (!supabase) return demoModeAllowed ? { user: { id: 'demo-user', email: 'mode-demo@local', role: 'demo' } } : null
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export async function loadWorkspace() {
  if (!supabase) {
    if (!demoModeAllowed) return { configurationRequired: true }
    try {
      const stored = localStorage.getItem(LOCAL_KEY)
      return { workspace: normalizeWorkspace(stored ? JSON.parse(stored) : createDemoWorkspace()), version: null }
    } catch {
      return { workspace: createDemoWorkspace(), version: null }
    }
  }
  const session = await getSession()
  if (!session?.user) return { requiresAuth: true }
  const { data, error } = await supabase
    .from('workspaces')
    .select('id,title,school_year,data,updated_at')
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return { unauthorized: true, user: session.user }
  const workspace = Array.isArray(data.data?.students) ? normalizeWorkspace(data.data) : createBlankWorkspace()
  workspace.meta = { ...workspace.meta, id: data.id, title: data.title, schoolYear: data.school_year }
  return { workspace, version: data.updated_at, user: session.user }
}

export async function saveWorkspace(workspace, version) {
  if (!supabase) {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(workspace))
    } catch {
      throw new Error('Le navigateur ne permet pas l’enregistrement local. Exportez une sauvegarde JSON avant de fermer la page.')
    }
    return { version: new Date().toISOString() }
  }
  const { data, error } = await supabase.rpc('save_workspace', {
    workspace_id: Number(workspace.meta.id),
    expected_updated_at: version,
    payload: workspace,
  })
  if (error) throw error
  if (!data?.length) {
    const conflict = new Error('Une collègue a enregistré une version plus récente. Rechargez avant de continuer.')
    conflict.code = 'VERSION_CONFLICT'
    throw conflict
  }
  return { version: data[0].updated_at }
}

export async function listVersions(workspaceId) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('workspace_versions')
    .select('id,saved_at,saved_by')
    .eq('workspace_id', workspaceId)
    .order('saved_at', { ascending: false })
    .limit(25)
  if (error) throw error
  return data || []
}
