const fields = [
  ['inventory', 'inventory_data', '库存'],
  ['records', 'inventory_records', '交易记录'],
  ['customers', 'customers', '顾客'],
  ['batches', 'inventory_batches_v1', '进货批次'],
  ['lotCycles', 'inventory_lot_cycles_v1', '批次汇总'],
] as const

type Field = typeof fields[number][0]

export type InventoryBackup = Record<Field, string | null> & {
  format: 'kucunbao'
  version: 1
  time: string
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function createBackup(storage: Storage, now = new Date()): InventoryBackup {
  return {
    format: 'kucunbao',
    version: 1,
    time: now.toISOString(),
    inventory: storage.getItem('inventory_data'),
    records: storage.getItem('inventory_records'),
    customers: storage.getItem('customers'),
    batches: storage.getItem('inventory_batches_v1'),
    lotCycles: storage.getItem('inventory_lot_cycles_v1'),
  }
}

/** Validate the entire file before changing any existing phone data. */
export function parseBackup(text: string): InventoryBackup {
  let data: unknown
  try {
    data = JSON.parse(text.replace(/^\uFEFF/, ''))
  } catch {
    throw new Error('备份文件不是有效的 JSON，请重新选择完整备份文件')
  }
  if (!isObject(data) ||
      !['inventory', 'records', 'customers'].every(field => Object.prototype.hasOwnProperty.call(data, field))) {
    throw new Error('这不是库存宝的完整备份文件')
  }
  if (data.format !== undefined && data.format !== 'kucunbao') {
    throw new Error('这不是库存宝备份文件')
  }
  if (data.version !== undefined && data.version !== 1) {
    throw new Error('备份版本暂不支持，请使用对应版本的库存宝恢复')
  }

  const backup: InventoryBackup = {
    format: 'kucunbao',
    version: 1,
    time: typeof data.time === 'string' ? data.time : '',
    inventory: null,
    records: null,
    customers: null,
    batches: null,
    lotCycles: null,
  }

  for (const [field, , label] of fields) {
    const raw = data[field]
    if (raw === null || (raw === undefined && (field === 'batches' || field === 'lotCycles'))) {
      continue
    }
    if (typeof raw !== 'string') {
      throw new Error('备份里的' + label + '数据格式错误')
    }
    let value: unknown
    try {
      value = JSON.parse(raw)
    } catch {
      throw new Error('备份里的' + label + '数据不完整')
    }
    if (field === 'inventory') {
      if (!isObject(value) ||
          !['stock', 'income', 'profit', 'cost'].every(key =>
            typeof value[key] === 'number' && Number.isFinite(value[key])) ||
          (value.totalWeightCost !== undefined &&
            (typeof value.totalWeightCost !== 'number' || !Number.isFinite(value.totalWeightCost)))) {
        throw new Error('备份里的库存数据格式错误')
      }
    } else if (!Array.isArray(value) || !value.every(isObject)) {
      throw new Error('备份里的' + label + '列表格式错误')
    }
    backup[field] = raw
  }
  return backup
}

export function backupSummary(backup: InventoryBackup) {
  const inventory = backup.inventory ? JSON.parse(backup.inventory) : null
  return {
    stock: inventory?.stock ?? 0,
    records: backup.records ? JSON.parse(backup.records).length : 0,
    customers: backup.customers ? JSON.parse(backup.customers).length : 0,
  }
}

/** Roll back all five keys if storage fails during restore. Unrelated settings stay intact. */
export function restoreBackup(storage: Storage, text: string): void {
  const backup = parseBackup(text)
  const previous = fields.map(([, key]) => [key, storage.getItem(key)] as const)
  try {
    for (const [field, key] of fields) {
      const value = backup[field]
      if (value === null) storage.removeItem(key)
      else storage.setItem(key, value)
    }
  } catch {
    let restored = true
    for (const [key, value] of previous) {
      try {
        if (value === null) storage.removeItem(key)
        else storage.setItem(key, value)
      } catch {
        restored = false
      }
    }
    throw new Error(restored
      ? '手机存储写入失败，已还原原来的资料。请腾出空间后重试'
      : '恢复未完成，请保留备份文件和旧手机，并检查手机存储空间')
  }
}
