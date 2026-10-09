export type SaveResult =
  | { saved: true; fileName: string; byteCount: number }
  | { saved: false; cancelled: true }
export type ShareResult = { prepared: true; opened: true; fileName: string; byteCount: number }
export type PickResult =
  | { selected: true; fileName: string; contents: string; byteCount: number }
  | { selected: false; cancelled: true }

export type BackupOptions = { fileName: string; contents: string }
export type SaveBackup = (options: BackupOptions) => Promise<SaveResult>

function matchesByteCount(contents: string, count: number): boolean {
  const expected = new TextEncoder().encode(contents).length
  return expected > 0 && Number.isFinite(count) && count === expected
}

/** Only a completed and byte-verified write can be presented as a saved backup. */
export async function saveWithPicker(save: SaveBackup, fileName: string, contents: string): Promise<string> {
  const result = await save({ fileName, contents })
  if (result.saved === true && result.fileName && matchesByteCount(contents, result.byteCount)) {
    return '✅ 已保存：' + result.fileName + '（' + (result.byteCount / 1024).toFixed(2) + ' KB）。文件在你选择的文件夹里'
  }
  if (result.saved === false && result.cancelled === true) return '已取消保存，尚未导出备份'
  throw new Error('未能确认完整备份已保存，请改用“分享备份”')
}

export async function shareVerifiedFile(share: (options: BackupOptions) => Promise<ShareResult>, fileName: string, contents: string): Promise<string> {
  const result = await share({ fileName, contents })
  if (result.prepared !== true || result.opened !== true || !result.fileName || !matchesByteCount(contents, result.byteCount)) {
    throw new Error('备份文件未准备完整，请改用“复制备份”')
  }
  return '已打开分享窗口：' + result.fileName + '（' + (result.byteCount / 1024).toFixed(2) + ' KB）。请选择新手机接收文件'
}

export async function copyVerifiedText(copy: (contents: string) => Promise<{copied: true}>, contents: string): Promise<string> {
  if (!contents || (await copy(contents)).copied !== true) throw new Error('复制未完成，请展开备份文字长按复制')
  return '✅ 备份文字已复制。请粘贴保存，或传到新手机后用“备份文字恢复”'
}
