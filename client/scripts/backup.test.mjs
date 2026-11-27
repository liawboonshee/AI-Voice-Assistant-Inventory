import { deleteCustomerProfile } from '../src/inventory/CustomerDeletion.ts'
import { parseVoiceCommand, parseSpokenNumber, extractFirstSpokenNumber, matchCustomerAlias, scoreCustomerTranscript, selectInventoryTranscript } from '../src/inventory/VoiceCommand.ts'
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
    assert.equal(parseVoiceCommand('优凯拿100').needsCustomer,true);
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


test('colloquial Malaysian Mandarin hundreds resolve to tens, not ones', () => {
  for (const [spoken,expected] of [
    ['百一',110],['百二',120],['百三',130],['百四',140],['百五',150],
    ['百六',160],['百七',170],['百八',180],['百九',190],
    ['一百五',150],['一百五十',150],['百零五',105],['一百零五',105],
    ['百5',150],['1百5',150],['1百五',150],['六百五',650],
    ['千五',1500],['一千零五',1005],
  ]) {
    assert.equal(parseSpokenNumber(spoken),expected,spoken);
    assert.equal(extractFirstSpokenNumber(spoken),expected,spoken);
  }
  const sale = parseVoiceCommand('8829拿百五欠五十');
  assert.equal(sale.error,undefined);
  assert.equal(sale.customer,'8829');
  assert.equal(sale.weight,1);
  assert.equal(sale.amount,150);
  assert.equal(sale.cashAmount,100);
  assert.equal(sale.debtAmount,50);
  const mixed = parseVoiceCommand('8829拿300欠百五');
  assert.equal(mixed.debtAmount,150);
  assert.equal(mixed.cashAmount,150);
  const direct = parseVoiceCommand('uk拿6.25收百五');
  assert.equal(direct.cashAmount,150);
  assert.equal(direct.amount,150);
  assert.equal(parseVoiceCommand('百五拿100').customer,'百五');
  assert.equal(parseVoiceCommand('8829拿百五').cashAmount,150);
  assert.equal(parseVoiceCommand('8829拿1百5').weight,1);
  assert.ok(parseVoiceCommand('8829拿百二').error);
  for (const text of ['8829拿百几','8829拿一百多','8829拿300欠百几','uk拿6.25收一百多','8829拿百五欠百多']) {
    assert.ok(parseVoiceCommand(text).error,text);
  }
  assert.equal(extractFirstSpokenNumber('百几'),null);
});


test('1G default price, explicit price overrides and 625 weight shorthand', () => {
  const cases = [
    ['8829拿1g',1,150,150,0],
    ['8829拿一克',1,150,150,0],
    ['8829拿1',1,150,150,0],
    ['8829拿1G收160',1,160,160,0],
    ['8829拿1g 160',1,160,160,0],
    ['8829拿一克收百二',1,120,120,0],
    ['8829拿1g欠30',1,150,120,30],
    ['8829拿1g收160欠30',1,190,160,30],
    ['8829拿150欠30',1,150,120,30],
    ['uk拿625收650',6.25,650,650,0],
    ['uk拿625 650',6.25,650,650,0],
    ['uk拿六二五收650',6.25,650,650,0],
    ['uk拿六百二十五收650',6.25,650,650,0],
    ['uk拿6.25收625',6.25,625,625,0],
    ['625拿100',0.55,100,100,0],
  ];
  for (const [text,weight,total,cash,debt] of cases) {
    const c = parseVoiceCommand(text);
    assert.equal(c.error,undefined,text);
    assert.equal(c.weight,weight,text);
    assert.equal(c.amount,total,text);
    const p = calculatePaymentBreakdown({total:c.amount,cashAmount:c.cashAmount,transferAmount:c.transferAmount,debtAmount:c.debtAmount});
    assert.equal(p.cashAmount,cash,text);
    assert.equal(p.debtAmount,debt,text);
  }
  assert.equal(parseVoiceCommand('625拿100').customer,'625');
  assert.equal(parseVoiceCommand('uk拿625').weight,6.25);
  assert.equal(parseVoiceCommand('uk拿625').amount,undefined);
  assert.equal(parseVoiceCommand('uk拿625g收650').weight,625);
  assert.ok(parseVoiceCommand('8829拿1g欠180').error);
});


test('customer deletion preserves ledger and refuses outstanding debt', () => {
  const list = [{name:'0764',debt:0,phone:'123',voiceAliases:['零七六四']},{name:'阿明',debt:100}];
  const source = new MemoryStorage({...original,customers:JSON.stringify(list)});
  const before = source.snapshot();
  assert.equal(deleteCustomerProfile(source,'阿明').ok,false);
  assert.deepEqual(source.snapshot(),before);
  assert.equal(deleteCustomerProfile(source,'不存在').ok,false);
  assert.equal(deleteCustomerProfile(source,'0764').ok,true);
  assert.deepEqual(source.snapshot(),{...before,customers:JSON.stringify([list[1]])});
  assert.equal(deleteCustomerProfile(source,'0764').ok,false);
  const invalid = new MemoryStorage({customers:'invalid'});
  assert.equal(deleteCustomerProfile(invalid,'0764').ok,false);
  const failed = new MemoryStorage({...before});
  failed.failOnce='customers';
  assert.equal(deleteCustomerProfile(failed,'0764').ok,false);
  assert.deepEqual(failed.snapshot(),before);
});


test('voice sale accepts 1G payment despite omitted 拿 or missing customer', () => {
  const old = Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  const list = [{name:'0764',debt:0,voiceAliases:['零七六四']},{name:'铁山朋友',debt:0,voiceAliases:['铁三朋友']},{name:'8829',debt:0}];
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:new MemoryStorage({customers:JSON.stringify(list)})});
  try {
    for (const text of ['0764拿1g收 100','0764 1G收100','0764那1g收100','铁三朋友一克收一百','铁山朋友拿一鸡收100','铁山朋友拿一级收100','铁山朋友拿1G收款100','铁山朋友拿1G首100']) {
      const cmd = parseVoiceCommand(text);
      assert.equal(cmd.error,undefined,text);
      assert.equal(cmd.type,'sale',text);
      assert.equal(cmd.weight,1,text);
      assert.equal(cmd.amount,100,text);
      assert.equal(cmd.cashAmount,100,text);
      assert.equal(cmd.debtAmount ?? 0,0,text);
      assert.equal(cmd.needsCustomer,false,text);
    }
    for (const text of ['1g收 100','拿1g收100','陌生顾客拿1g收100','铁三朋有1G收100']) {
      const cmd = parseVoiceCommand(text);
      assert.equal(cmd.error,undefined,text);
      assert.equal(cmd.weight,1,text);
      assert.equal(cmd.amount,100,text);
      assert.equal(cmd.needsCustomer,true,text);
    }
    assert.equal(parseVoiceCommand('0765拿100').needsCustomer,true);
    assert.equal(parseVoiceCommand('0764拿100').weight,0.55);
    assert.equal(parseVoiceCommand('0764拿1G').amount,150);
    assert.equal(parseVoiceCommand('进货125克4500').type,'purchase');
    assert.equal(parseVoiceCommand('0764拿625收650').weight,6.25);
    assert.equal(selectInventoryTranscript(['0764拿1G','0764拿1G收100']).text,'0764拿1G收100');
    assert.equal(parseVoiceCommand(selectInventoryTranscript(['0764拿1G收100','8829拿1G收100']).text).needsCustomer,true);
    assert.ok(selectInventoryTranscript(['0764拿1G收100','8829拿1G收120']).warning);
  } finally {
    if(old) Object.defineProperty(globalThis,'localStorage',old);
    else delete globalThis.localStorage;
  }
});
