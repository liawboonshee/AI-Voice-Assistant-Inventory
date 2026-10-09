export type BackupSummary = { stock: number; customers: number; records: number }
export type BackupUiState = {
  busy: boolean
  message: string
  text: string
  summary: BackupSummary | null
  incoming: { contents: string; fileName: string; summary: BackupSummary } | null
}

function readMessage(): string {
  try { return sessionStorage.getItem('kucunbao_backup_status') || '' } catch { return '' }
}

let state: BackupUiState = { busy: false, message: readMessage(), text: '', summary: null, incoming: null }
const listeners = new Set<() => void>()

// The PIN screen unmounts InventoryApp while a native picker is open.
// Keep pending work and its outcome available when the user unlocks again.
export const backupUi = {
  getSnapshot: () => state,
  subscribe: (listener: () => void) => {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },
  update: (change: Partial<BackupUiState>) => {
    state = { ...state, ...change }
    try { sessionStorage.setItem('kucunbao_backup_status', state.message) } catch { /* optional UI state */ }
    for (const listener of listeners) listener()
  },
}

export function requestBackupResume(): void {
  try { sessionStorage.setItem('kucunbao_backup_resume', '1') } catch { /* optional UI state */ }
}

export function consumeBackupResume(): boolean {
  try {
    const resume = sessionStorage.getItem('kucunbao_backup_resume') === '1'
    sessionStorage.removeItem('kucunbao_backup_resume')
    return resume
  } catch { return false }
}
