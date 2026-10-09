import { useState, useSyncExternalStore, type ChangeEvent } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { backupSummary, createBackup, parseBackup, restoreBackup } from './BackupData'
import { copyVerifiedText, saveWithPicker, shareVerifiedFile, type BackupOptions, type PickResult, type SaveResult, type ShareResult } from './BackupExport'
import { backupUi, requestBackupResume } from './BackupUi'

const NativeBackup = registerPlugin<{
  saveBackup(options: BackupOptions): Promise<SaveResult>
  shareBackup(options: BackupOptions): Promise<ShareResult>
  copyBackup(options: {contents: string}): Promise<{copied: true}>
  pickBackup(): Promise<PickResult>
}>('InventoryBackup')

function errorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message
  return fallback
}

export default function Backup() {
  const state = useSyncExternalStore(backupUi.subscribe, backupUi.getSnapshot)
  const [pasteText, setPasteText] = useState('')
  const android = Capacitor.getPlatform() === 'android'

  async function exportData(mode: 'save' | 'share' | 'copy') {
    if (backupUi.getSnapshot().busy) return
    backupUi.update({busy: true, message: ''})
    try {
      const backup = createBackup(localStorage)
      const contents = JSON.stringify(backup, null, 2)
      const fileName = '库存宝备份_' + Date.now() + '.json'
      backupUi.update({text: contents, summary: backupSummary(backup)})
      if (mode === 'copy') {
        const copy = android
          ? (text: string) => NativeBackup.copyBackup({contents: text})
          : async (text: string): Promise<{copied: true}> => {
            await navigator.clipboard.writeText(text)
            return {copied: true}
          }
        backupUi.update({message: await copyVerifiedText(copy, contents)})
      } else if (android) {
        requestBackupResume()
        backupUi.update({message: mode === 'share' ? '正在准备完整备份文件…' : '请在保存窗口选择文件夹，再按“保存”'})
        const message = mode === 'share'
          ? await shareVerifiedFile(options => NativeBackup.shareBackup(options), fileName, contents)
          : await saveWithPicker(options => NativeBackup.saveBackup(options), fileName, contents)
        backupUi.update({message})
      } else {
        const url = URL.createObjectURL(new Blob([contents], {type: 'application/json;charset=utf-8'}))
        const link = document.createElement('a')
        link.href = url
        link.download = fileName
        document.body.appendChild(link)
        try { link.click() } finally {
          link.remove()
          window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
        }
        backupUi.update({message: '已发起下载，请确认文件有内容后再换机'})
      }
    } catch (error) {
      backupUi.update({message: '❌ ' + errorMessage(error, '导出未完成，请使用“分享备份”或展开备份文字复制')})
    } finally {
      backupUi.update({busy: false})
    }
  }

  function stageRestore(contents: string, fileName: string) {
    const summary = backupSummary(parseBackup(contents))
    backupUi.update({incoming: {contents, fileName, summary}, message: '已读取完整备份，请核对下面的资料后点击“恢复这份备份”'})
  }

  async function chooseBackup() {
    if (backupUi.getSnapshot().busy) return
    backupUi.update({busy: true, message: '', incoming: null})
    requestBackupResume()
    try {
      const result = await NativeBackup.pickBackup()
      if (result.selected) stageRestore(result.contents, result.fileName)
      else backupUi.update({message: '已取消选择备份'})
    } catch (error) {
      backupUi.update({message: '❌ ' + errorMessage(error, '读取失败，请重新选择完整备份')})
    } finally {
      backupUi.update({busy: false})
    }
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file || backupUi.getSnapshot().busy) return
    backupUi.update({busy: true, message: '', incoming: null})
    try { stageRestore(await file.text(), file.name) }
    catch (error) { backupUi.update({message: '❌ ' + errorMessage(error, '读取失败，请重新选择完整备份')}) }
    finally { backupUi.update({busy: false}) }
  }

  function restore(contents: string) {
    if (backupUi.getSnapshot().busy) return
    backupUi.update({busy: true})
    try {
      const summary = backupSummary(parseBackup(contents))
      if (!window.confirm('将恢复库存 ' + summary.stock.toFixed(2) + 'G、' + summary.customers + ' 位顾客、' + summary.records +
        ' 条交易。\n这会替换本机现有库存、顾客、欠款和交易资料。确认恢复？')) {
        backupUi.update({message: '已取消恢复'})
        return
      }
      restoreBackup(localStorage, contents)
      backupUi.update({incoming: null, message: '✅ 恢复成功，正在刷新…'})
      window.setTimeout(() => window.location.reload(), 800)
    } catch (error) {
      backupUi.update({message: '❌ ' + errorMessage(error, '恢复未完成，请保留旧手机和备份文件')})
    } finally {
      backupUi.update({busy: false})
    }
  }

  return (
    <div style={{padding: 20}}>
      <h1>💾 数据备份</h1>
      <p>换机可用“分享备份”把完整文件传到新手机。</p>
      <button type="button" onClick={() => exportData('save')} disabled={state.busy}>导出备份</button>
      <div style={{display: 'grid', gridTemplateColumns: android ? '1fr 1fr' : '1fr', gap: 8, marginTop: 10}}>
        {android && <button type="button" onClick={() => exportData('share')} disabled={state.busy}>分享备份</button>}
        <button type="button" onClick={() => exportData('copy')} disabled={state.busy}>复制备份</button>
      </div>
      {state.summary && <p>本次备份：{state.summary.stock.toFixed(2)}G · {state.summary.customers} 位顾客 · {state.summary.records} 条交易</p>}
      <p role="status" aria-live="polite" style={{overflowWrap: 'anywhere'}}>{state.message}</p>
      {state.text && <details style={{marginBottom: 16}}>
        <summary>查看／手动复制备份文字</summary>
        <textarea aria-label="完整备份文字" readOnly value={state.text} rows={5}
          style={{width: '100%', boxSizing: 'border-box', fontSize: 12, marginTop: 8}} />
      </details>}
      <h2>恢复备份</h2>
      {android
        ? <button type="button" onClick={chooseBackup} disabled={state.busy}>选择备份文件</button>
        : <input type="file" accept=".json,application/json" onChange={importFile} disabled={state.busy} style={{maxWidth: '100%'}} />}
      {state.incoming && <div style={{marginTop: 12, overflowWrap: 'anywhere'}}>
        <p>{state.incoming.fileName}<br />库存 {state.incoming.summary.stock.toFixed(2)}G · {state.incoming.summary.customers} 位顾客 · {state.incoming.summary.records} 条交易</p>
        <button type="button" onClick={() => restore(state.incoming!.contents)} disabled={state.busy}>恢复这份备份</button>
      </div>}
      <details style={{marginTop: 16}}>
        <summary>备份文字恢复</summary>
        <textarea aria-label="粘贴完整备份文字" placeholder="在这里粘贴完整备份文字" value={pasteText}
          onChange={event => setPasteText(event.target.value)} rows={5}
          style={{width: '100%', boxSizing: 'border-box', marginTop: 8}} />
        <button type="button" onClick={() => restore(pasteText)} disabled={state.busy || !pasteText.trim()}>恢复备份文字</button>
      </details>
    </div>
  )
}
