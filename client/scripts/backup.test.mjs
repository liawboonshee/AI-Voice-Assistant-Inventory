import assert from 'node:assert/strict'
import test from 'node:test'
import { createBackup, parseBackup, restoreBackup, backupSummary } from '../src/inventory/BackupData.ts'
import { saveWithPicker, shareVerifiedFile, copyVerifiedText } from '../src/inventory/BackupExport.ts'
import { backupUi, requestBackupResume, consumeBackupResume } from '../src/inventory/BackupUi.ts'

class MemoryStorage {
  constructor(values = {}) { this.values = new Map(Object.entries(values)); this.failOnce = null }
  getItem(key) { return this.values.get(key) ?? null }
  setItem(key, value) {
    if (this.failOnce === key) { this.failOnce = null; throw new Error('quota exceeded') }
    this.values.set(key, value)
  }
  removeItem(key) { this.values.delete(key) }
  snapshot() { return Object.fromEntries(this.values) }
}

const original = {
  inventory_data: JSON.stringify({stock: 12.34, income: 800, profit: -5, cost: 4500, totalWeightCost: 400}),
  inventory_records: JSON.stringify([{type: 'sale', date: '2026-10-10T00:00:00Z', customer: '阿明', weight: 0.01, amount: 300, debtAmount: 100}]),
  customers: JSON.stringify([{name: '阿明', debt: 100, phone: '0123456789'}]),
  inventory_batches_v1: JSON.stringify([{id: 'B1', remainingWeight: 12.34, remainingCost: 400}]),
  inventory_lot_cycles_v1: JSON.stringify([{id: 'L1', sequence: 1, status: 'active', profit: -5}]),
}

function backupText(values = original) { return JSON.stringify(createBackup(new MemoryStorage(values))) }

test('round-trip preserves all inventory, debt, records, batches and 0.01G precision', () => {
  const source = new MemoryStorage({...original, pin_hash: 'private-setting', proxy_token: 'private-setting'})
  const text = JSON.stringify(createBackup(source, new Date('2026-10-10T00:00:00Z')))
  assert.ok(!text.includes('private-setting'))
  const target = new MemoryStorage({pin_hash: 'new-phone-setting'})
  restoreBackup(target, text)
  assert.deepEqual(target.snapshot(), {...original, pin_hash: 'new-phone-setting'})
  assert.deepEqual(backupSummary(parseBackup(text)), {stock: 12.34, records: 1, customers: 1})
})

test('legacy backup restores and removes stale derived batch data', () => {
  const {format, version, batches, lotCycles, ...legacy} = createBackup(new MemoryStorage(original))
  const target = new MemoryStorage({...original})
  restoreBackup(target, JSON.stringify(legacy))
  assert.equal(target.getItem('inventory_batches_v1'), null)
  assert.equal(target.getItem('inventory_lot_cycles_v1'), null)
  assert.equal(target.getItem('customers'), original.customers)
})

test('empty backup clears existing business data without clearing phone settings', () => {
  const target = new MemoryStorage({...original, pin_hash: 'keep'})
  restoreBackup(target, backupText({}))
  assert.deepEqual(target.snapshot(), {pin_hash: 'keep'})
})

test('UTF-8 BOM and Chinese customer names restore correctly', () => {
  const target = new MemoryStorage()
  restoreBackup(target, '\uFEFF' + backupText())
  assert.equal(JSON.parse(target.getItem('customers'))[0].name, '阿明')
})

for (const [label, invalid] of [
  ['unrelated JSON', JSON.stringify({hello: 'world'})],
  ['invalid nested core JSON', JSON.stringify({...createBackup(new MemoryStorage(original)), records: '['})],
  ['invalid optional field before any write', JSON.stringify({...createBackup(new MemoryStorage(original)), lotCycles: '{}'})],
  ['unsupported format', JSON.stringify({...createBackup(new MemoryStorage(original)), format: 'another-app'})],
  ['unsupported version', JSON.stringify({...createBackup(new MemoryStorage(original)), version: 99})],
]) {
  test(label + ' cannot modify existing records', () => {
    const target = new MemoryStorage(original)
    assert.throws(() => restoreBackup(target, invalid))
    assert.deepEqual(target.snapshot(), original)
  })
}

test('storage failure restores the whole original snapshot', () => {
  const target = new MemoryStorage({...original, customers: '[{"name":"旧顾客","debt":999}]'})
  const before = target.snapshot()
  target.failOnce = 'customers'
  assert.throws(() => restoreBackup(target, backupText()), /已还原/)
  assert.deepEqual(target.snapshot(), before)
})

test('picker cancellation cannot report a successful backup', async () => {
  const message = await saveWithPicker(async () => ({saved: false, cancelled: true}), '库存宝.json', backupText())
  assert.match(message, /尚未导出/)
  assert.ok(!message.includes('✅'))
})

test('native failure propagates instead of claiming success', async () => {
  await assert.rejects(saveWithPicker(async () => { throw new Error('write failed') }, '库存宝.json', backupText()), /write failed/)
})

test('success uses the actual file name returned by the picker', async () => {
  const message = await saveWithPicker(async () => ({saved: true, fileName: '库存宝备份(1).json', byteCount: Buffer.byteLength(backupText(), 'utf8')}), '库存宝备份.json', backupText())
  assert.match(message, /已保存：库存宝备份\(1\).json/)
})

test('unverified native response cannot report a successful backup', async () => {
  await assert.rejects(saveWithPicker(async () => ({}), '库存宝.json', backupText()), /未能确认/)
})

test('zero-byte native save cannot report success', async () => {
  await assert.rejects(saveWithPicker(async () => ({saved: true, fileName: '空备份.json', byteCount: 0}), '库存宝.json', backupText()), /未能确认/)
})

test('partial native save cannot report success', async () => {
  await assert.rejects(saveWithPicker(async () => ({saved: true, fileName: '部分.json', byteCount: 10}), '库存宝.json', backupText()), /未能确认/)
})

test('sharing opens only a full byte-verified file and does not claim delivery', async () => {
  const text = backupText()
  const message = await shareVerifiedFile(async () => ({prepared: true, opened: true, fileName: '库存宝.json', byteCount: Buffer.byteLength(text, 'utf8')}), '库存宝.json', text)
  assert.match(message, /已打开分享窗口/)
  assert.ok(!message.includes('已传送'))
})

test('zero-byte shared file is rejected', async () => {
  await assert.rejects(shareVerifiedFile(async () => ({prepared: true, opened: true, fileName: '空.json', byteCount: 0}), '库存宝.json', backupText()), /未准备完整/)
})

test('clipboard must acknowledge the copy before reporting success', async () => {
  await assert.rejects(copyVerifiedText(async () => ({}), backupText()), /复制未完成/)
  assert.match(await copyVerifiedText(async () => ({copied: true}), backupText()), /备份文字已复制/)
})

test('pending export and outcome survive PIN screen unmount and remount', () => {
  backupUi.update({busy: true, message: '正在保存', text: backupText()})
  const unsubscribe = backupUi.subscribe(() => {})
  unsubscribe()
  assert.equal(backupUi.getSnapshot().busy, true)
  let latest
  const newUnsubscribe = backupUi.subscribe(() => { latest = backupUi.getSnapshot() })
  backupUi.update({busy: false, message: '保存未完成，请分享备份'})
  assert.equal(latest.busy, false)
  assert.match(latest.message, /分享备份/)
  assert.equal(latest.text, backupText())
  newUnsubscribe()
})

test('return from native picker resumes the backup page once after unlocking', () => {
  const previous = globalThis.sessionStorage
  globalThis.sessionStorage = new MemoryStorage()
  requestBackupResume()
  assert.equal(consumeBackupResume(), true)
  assert.equal(consumeBackupResume(), false)
  globalThis.sessionStorage = previous
})
