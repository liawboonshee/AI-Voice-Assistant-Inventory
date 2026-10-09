import { useState, type ChangeEvent } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { backupSummary, createBackup, parseBackup, restoreBackup } from './BackupData'
import { saveWithPicker, type SaveResult } from './BackupExport'

const NativeBackup = registerPlugin<{
  saveBackup(options: { fileName: string; contents: string }): Promise<SaveResult>
}>('InventoryBackup')

export default function Backup() {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function exportData() {
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      const contents = JSON.stringify(createBackup(localStorage), null, 2)
      const fileName = '库存宝备份_' + Date.now() + '.json'
      if (Capacitor.getPlatform() === 'android') {
        setMessage('请在保存窗口选择文件夹，然后按“保存”')
        setMessage(await saveWithPicker(options => NativeBackup.saveBackup(options), fileName, contents))
      } else {
        const url = URL.createObjectURL(new Blob([contents], {type: 'application/json;charset=utf-8'}))
        const link = document.createElement('a')
        link.href = url
        link.download = fileName
        document.body.appendChild(link)
        try {
          link.click()
        } finally {
          link.remove()
          window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
        }
        setMessage('已发起下载：' + fileName + '。请在下载目录确认文件已保存')
      }
    } catch (error) {
      setMessage('❌ ' + (error instanceof Error ? error.message : '导出失败，请重试'))
    } finally {
      setBusy(false)
    }
  }

  async function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file || busy) return
    setBusy(true)
    setMessage('')
    try {
      const contents = await file.text()
      const summary = backupSummary(parseBackup(contents))
      if (!window.confirm(
        '将恢复库存 ' + summary.stock.toFixed(2) + 'G、' + summary.customers + ' 位顾客、' + summary.records +
        ' 条交易。\n这会替换本机现有库存、顾客、欠款和交易资料。确认恢复？',
      )) {
        setMessage('已取消导入')
        return
      }
      restoreBackup(localStorage, contents)
      setMessage('✅ 恢复成功，正在刷新…')
      window.setTimeout(() => window.location.reload(), 800)
    } catch (error) {
      setMessage('❌ ' + (error instanceof Error ? error.message : '导入失败，请检查备份文件'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{padding: 24}}>
      <h1>💾 数据备份</h1>
      <p>旧手机导出备份，传到新手机后选择文件恢复。</p>
      <button type="button" onClick={exportData} disabled={busy} style={{fontSize: 18, padding: 10}}>
        {busy ? '正在处理…' : '导出备份'}
      </button>
      <p>导出时请选“下载 / Download”文件夹，再按“保存”。</p>
      <label>
        导入备份
        <input type="file" accept=".json,application/json" onChange={importData} disabled={busy}
          style={{display: 'block', maxWidth: '100%', marginTop: 8}} />
      </label>
      <p role="status" aria-live="polite" style={{overflowWrap: 'anywhere'}}>{message}</p>
    </div>
  )
}
