export type SaveResult =
  | { saved: true; fileName: string }
  | { saved: false; cancelled: true }

export type SaveBackup = (options: { fileName: string; contents: string }) => Promise<SaveResult>

/** A cancelled or failed save must never be presented as a completed backup. */
export async function saveWithPicker(save: SaveBackup, fileName: string, contents: string): Promise<string> {
  const result = await save({ fileName, contents })
  if (result.saved === true && result.fileName) {
    return '✅ 已保存：' + result.fileName + '。文件在你刚才选择的文件夹里'
  }
  if (result.saved === false && result.cancelled === true) {
    return '已取消保存，尚未导出备份'
  }
  throw new Error('未能确认备份已保存，请重试')
}
