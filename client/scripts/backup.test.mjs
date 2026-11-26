import { parseVoiceCommand, matchCustomerAlias, scoreCustomerTranscript, selectInventoryTranscript } from '../src/inventory/VoiceCommand.ts'
import { calculatePaymentBreakdown } from '../src/inventory/Payments.ts'
import { recordProfit, recordCashIn } from '../src/inventory/Analytics.ts'
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


test('red wine sale profit and quantity survive backup without gram stock changes', () => {
  const record = {type:'sale', product:'red_wine', quantity:2, weight:0, date:'2026-11-25T00:00:00Z', amount:30, costAmount:17, cashAmount:20, transferAmount:0, debtAmount:10, paidAmount:20, profitAmount:3};
  assert.equal(recordProfit(record), 3);
  assert.equal(recordCashIn(record), 20);
  assert.equal(recordProfit({...record, cashAmount:0, paidAmount:0, debtAmount:30}), -17);
  const source = new MemoryStorage({...original, inventory_records:JSON.stringify([record])});
  const backup = createBackup(source);
  const parsed = parseBackup(JSON.stringify(backup));
  assert.deepEqual(JSON.parse(parsed.records), [record]);
  assert.equal(JSON.parse(parsed.inventory).stock, 12.34);
});


test('voice take shortcut keeps customer IDs, weights, cash and debt correct', () => {
  const samples = [
    ['0764拿100欠30','0764',0.55,100,70,30],
    ['8829拿150欠50','8829',1,150,100,50],
    ['铁山朋友拿100','铁山朋友',0.55,100,100,0],
    ['uk拿6.25收650','uk',6.25,650,650,0],
    ['小明拿半套','小明',2.5,300,300,0],
    ['零七六四拿一百欠三十','0764',0.55,100,70,30],
    ['8829拿一百五欠五十','8829',1,150,100,50],
    ['uk拿六点二五收六百五','uk',6.25,650,650,0],
    ['uk拿6点25收650','uk',6.25,650,650,0],
    ['阿明拿50','阿明',0.25,50,50,0],
    ['阿明拿80','阿明',0.4,80,80,0],
    ['阿明拿300','阿明',2.5,300,300,0],
    ['阿明拿100收70欠30','阿明',0.55,100,70,30],
    ['阿明拿100克收650','阿明',100,650,650,0],
    ['阿明拿100收70','阿明',0.55,100,70,30],
    ['0764拿100，欠30。','0764',0.55,100,70,30],
  ];
  for (const [utterance,customer,weight,total,cash,debt] of samples) {
    const cmd = parseVoiceCommand(utterance);
    assert.equal(cmd.error,undefined,utterance);
    assert.equal(cmd.type,'sale',utterance);
    assert.equal(cmd.customer,customer,utterance);
    assert.equal(cmd.weight,weight,utterance);
    const payment = calculatePaymentBreakdown({total:cmd.amount,cashAmount:cmd.cashAmount,transferAmount:cmd.transferAmount,debtAmount:cmd.debtAmount});
    assert.equal(payment.total,total,utterance);
    assert.equal(payment.cashAmount,cash,utterance);
    assert.equal(payment.debtAmount,debt,utterance);
  }
  assert.equal(parseVoiceCommand('uk拿6.25').amount,undefined);
  for (const input of ['0764拿100欠130','0764拿100欠','0764拿100收80欠30','0764拿100 30']) {
    assert.ok(parseVoiceCommand(input).error,input);
  }
  assert.equal(parseVoiceCommand('进货125克4500').type,'purchase');
});


test('red wine inventory and purchase survive backup', () => {
  const data = {...JSON.parse(original.inventory_data), redWineStock:20};
  const purchase = {type:'purchase',product:'red_wine',quantity:20,weight:0,amount:170,costAmount:170,unitCost:8.5,redWineStockAfter:20,date:'2026-11-25T00:00:00Z'};
  const source = new MemoryStorage({...original, inventory_data:JSON.stringify(data), inventory_records:JSON.stringify([purchase])});
  const backup = createBackup(source);
  const parsed = parseBackup(JSON.stringify(backup));
  assert.equal(JSON.parse(parsed.inventory).redWineStock,20);
  assert.equal(JSON.parse(parsed.inventory).stock,data.stock);
  assert.deepEqual(JSON.parse(parsed.records),[purchase]);
  assert.throws(() => parseBackup(JSON.stringify({...backup,inventory:JSON.stringify({...data,redWineStock:-1})})));
});


test('customer pronunciation aliases map to the confirmed name, preserve IDs and reject conflicts', () => {
  const list = [{name:'0764',voiceAliases:['零七六四','零七六死']},{name:'铁山朋友',voiceAliases:['铁三朋友']},{name:'uk',voiceAliases:['优凯']}];
  assert.equal(matchCustomerAlias('零七六四',list).name,'0764');
  assert.equal(matchCustomerAlias('铁三朋友',list).name,'铁山朋友');
  assert.equal(matchCustomerAlias('优凯',list).name,'uk');
  assert.equal(matchCustomerAlias('0765',list).name,undefined);
  assert.equal(matchCustomerAlias('优凯',[...list,{name:'优凯'}]).ambiguous,true);
  const old = Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:new MemoryStorage({customers:JSON.stringify(list)})});
  try {
    const sale = parseVoiceCommand('铁三朋友拿100欠30');
    assert.equal(sale.customer,'铁山朋友');
    assert.equal(sale.cashAmount,70);
    assert.equal(sale.weight,0.55);
    assert.equal(parseVoiceCommand('零七六死拿150').customer,'0764');
    assert.equal(parseVoiceCommand('优凯拿6.25收650').customer,'uk');
    assert.ok(scoreCustomerTranscript('优凯拿100') > scoreCustomerTranscript('优开拿100'));
    globalThis.localStorage.setItem('customers',JSON.stringify([...list,{name:'优凯'}]));
    assert.ok(parseVoiceCommand('优凯拿100').error);
    const source = new MemoryStorage({...original,customers:JSON.stringify(list)});
    assert.deepEqual(JSON.parse(parseBackup(JSON.stringify(createBackup(source))).customers),list);
  } finally {
    if(old) Object.defineProperty(globalThis,'localStorage',old);
    else delete globalThis.localStorage;
  }
});


test('debt speech homophones and incomplete payment alternatives', () => {
  for (const text of ['0764拿100欠款30','0764拿100钱30','0764拿100签30','0764拿100千30','0764拿一百千三十','0764拿一百钱三十','0764拿100欠了30','0764拿100还欠30','0764拿100块欠30','0764拿100，欠：30','0764拿100欠钱30','0764拿100欠三十块']) {
    const command = parseVoiceCommand(text);
    assert.equal(command.error,undefined,text);
    assert.equal(command.customer,'0764',text);
    assert.equal(command.amount,100,text);
    assert.equal(command.weight,0.55,text);
    assert.equal(command.cashAmount,70,text);
    assert.equal(command.debtAmount,30,text);
  }
  assert.equal(parseVoiceCommand('0764拿100块钱').cashAmount,100);
  assert.equal(parseVoiceCommand('0764拿100').cashAmount,100);
  assert.equal(parseVoiceCommand('0764拿100收100').cashAmount,100);
  assert.ok(parseVoiceCommand('0764拿100签130').error);
  assert.ok(parseVoiceCommand('0764拿100欠').error);
  assert.equal(parseVoiceCommand('0764拿6.25收650').cashAmount,650);
  assert.equal(selectInventoryTranscript(['0764拿100','0764拿100欠30']).text,'0764拿100欠30');
  assert.ok(selectInventoryTranscript(['0764拿100','0764拿100欠']).warning);
  assert.ok(selectInventoryTranscript(['0764拿100欠30','0764拿100欠50']).warning);
  assert.ok(selectInventoryTranscript(['0764拿100欠30','0764拿100收100']).warning);
  assert.equal(selectInventoryTranscript(['0764拿100']).text,'0764拿100');
});
