import type { InventoryData } from './Storage'

export type InventoryBatch = {
  id: string
  date: string
  source: string
  originalWeight: number
  remainingWeight: number
  originalCost: number
  remainingCost: number
  unitCost: number
}

export type BatchAllocation = {
  batchId: string
  weight: number
  cost: number
  unitCost: number
}

type NewBatch = {
  id: string
  date: string
  source?: string
  weight: number
  cost: number
}

const KEY = 'inventory_batches_v1'

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function roundWeight(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function sumWeight(batches: InventoryBatch[]): number {
  return roundWeight(batches.reduce((total, batch) => total + batch.remainingWeight, 0))
}

function sumCost(batches: InventoryBatch[]): number {
  return roundMoney(batches.reduce((total, batch) => total + batch.remainingCost, 0))
}

function fallbackBatch(inventory: InventoryData, source = '升级前库存'): InventoryBatch[] {
  if (inventory.stock <= 0) return []
  const cost = Math.max(0, roundMoney(inventory.totalWeightCost || 0))
  return [{
    id: `LEGACY-${Date.now()}`,
    date: new Date().toISOString(),
    source,
    originalWeight: roundWeight(inventory.stock),
    remainingWeight: roundWeight(inventory.stock),
    originalCost: cost,
    remainingCost: cost,
    unitCost: inventory.stock > 0 ? cost / inventory.stock : 0,
  }]
}

function normalizeBatch(value: Partial<InventoryBatch>): InventoryBatch | null {
  const remainingWeight = roundWeight(Number(value.remainingWeight || 0))
  const remainingCost = roundMoney(Number(value.remainingCost || 0))
  const originalWeight = roundWeight(Number(value.originalWeight || remainingWeight))
  const originalCost = roundMoney(Number(value.originalCost || remainingCost))
  if (!value.id || !Number.isFinite(remainingWeight) || remainingWeight < 0) return null
  if (!Number.isFinite(remainingCost) || remainingCost < 0) return null
  return {
    id: String(value.id),
    date: String(value.date || new Date().toISOString()),
    source: String(value.source || '未填写'),
    originalWeight,
    remainingWeight,
    originalCost,
    remainingCost,
    unitCost: Number.isFinite(Number(value.unitCost))
      ? Number(value.unitCost)
      : originalWeight > 0 ? originalCost / originalWeight : 0,
  }
}

export function saveInventoryBatches(batches: InventoryBatch[]): void {
  localStorage.setItem(KEY, JSON.stringify(batches))
}

/** 首次升级会把现有库存完整保留为一个原始批次。 */
export function loadInventoryBatches(inventory: InventoryData): InventoryBatch[] {
  let batches: InventoryBatch[] = []
  const stored = localStorage.getItem(KEY)

  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) {
        batches = parsed
          .map((item) => normalizeBatch(item))
          .filter((item): item is InventoryBatch => item !== null)
      }
    } catch {
      batches = []
    }
  }

  if (!stored) {
    batches = fallbackBatch(inventory)
    saveInventoryBatches(batches)
    return batches
  }

  const stockMismatch = Math.abs(sumWeight(batches) - inventory.stock) >= 0.01
  const costMismatch = Math.abs(sumCost(batches) - inventory.totalWeightCost) >= 0.02
  if (stockMismatch || costMismatch) {
    batches = fallbackBatch(inventory, '库存同步批次')
    saveInventoryBatches(batches)
  }
  return batches
}

export function addInventoryBatch(inventoryBeforePurchase: InventoryData, input: NewBatch): InventoryBatch {
  const batches = loadInventoryBatches(inventoryBeforePurchase)
  const weight = roundWeight(input.weight)
  const cost = roundMoney(input.cost)
  const batch: InventoryBatch = {
    id: input.id,
    date: input.date,
    source: input.source?.trim() || '未填写',
    originalWeight: weight,
    remainingWeight: weight,
    originalCost: cost,
    remainingCost: cost,
    unitCost: weight > 0 ? cost / weight : 0,
  }
  batches.push(batch)
  saveInventoryBatches(batches)
  return batch
}

export function consumeInventoryBatches(inventory: InventoryData, requestedWeight: number): {
  allocations: BatchAllocation[]
  saleCost: number
  stockAfter: number
  costAfter: number
} | null {
  const batches = loadInventoryBatches(inventory)
  let remaining = roundWeight(requestedWeight)
  const allocations: BatchAllocation[] = []

  if (sumWeight(batches) + 0.001 < remaining) return null

  for (const batch of batches) {
    if (remaining <= 0 || batch.remainingWeight <= 0) continue
    const take = roundWeight(Math.min(batch.remainingWeight, remaining))
    if (take <= 0) continue
    const takesWholeRemainder = Math.abs(take - batch.remainingWeight) < 0.001
    const cost = takesWholeRemainder
      ? batch.remainingCost
      : roundMoney(batch.unitCost * take)

    batch.remainingWeight = Math.max(0, roundWeight(batch.remainingWeight - take))
    batch.remainingCost = Math.max(0, roundMoney(batch.remainingCost - cost))
    allocations.push({ batchId: batch.id, weight: take, cost, unitCost: batch.unitCost })
    remaining = Math.max(0, roundWeight(remaining - take))
  }

  if (remaining > 0.001) return null
  saveInventoryBatches(batches)
  return {
    allocations,
    saleCost: roundMoney(allocations.reduce((total, item) => total + item.cost, 0)),
    stockAfter: sumWeight(batches),
    costAfter: sumCost(batches),
  }
}

export function restoreInventoryBatchAllocations(
  inventory: InventoryData,
  allocations: BatchAllocation[] | undefined,
  fallbackWeight: number,
  fallbackCost: number,
): { stockAfter: number; costAfter: number } {
  const batches = loadInventoryBatches(inventory)
  const restored = allocations && allocations.length > 0
    ? allocations
    : [{
        batchId: `RESTORED-${Date.now()}`,
        weight: roundWeight(fallbackWeight),
        cost: roundMoney(fallbackCost),
        unitCost: fallbackWeight > 0 ? fallbackCost / fallbackWeight : 0,
      }]

  for (const item of restored) {
    let batch = batches.find((candidate) => candidate.id === item.batchId)
    if (!batch) {
      batch = {
        id: item.batchId,
        date: new Date().toISOString(),
        source: '恢复的出货批次',
        originalWeight: 0,
        remainingWeight: 0,
        originalCost: 0,
        remainingCost: 0,
        unitCost: item.unitCost,
      }
      batches.push(batch)
    }
    batch.originalWeight = roundWeight(Math.max(batch.originalWeight, batch.remainingWeight + item.weight))
    batch.originalCost = roundMoney(Math.max(batch.originalCost, batch.remainingCost + item.cost))
    batch.remainingWeight = roundWeight(batch.remainingWeight + item.weight)
    batch.remainingCost = roundMoney(batch.remainingCost + item.cost)
    if (batch.unitCost <= 0) batch.unitCost = item.unitCost
  }

  saveInventoryBatches(batches)
  return { stockAfter: sumWeight(batches), costAfter: sumCost(batches) }
}

export function resetInventoryBatches(stock: number, cost: number, date: string, source: string): void {
  const inventory = {
    stock: roundWeight(stock),
    totalWeightCost: roundMoney(cost),
    income: 0,
    profit: 0,
    cost: 0,
  }
  const batches = fallbackBatch(inventory, source)
  if (batches[0]) {
    batches[0].id = `ADJUST-${Date.now()}`
    batches[0].date = date
  }
  saveInventoryBatches(batches)
}
