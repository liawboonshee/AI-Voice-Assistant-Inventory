import { useState } from 'react'
import { addInventoryBatch } from './Batches'
import { beginNewLotCycle } from './LotCycles'
import { currentRecordDate, saveRecord } from './Records'
import { loadInventory, saveInventory } from './Storage'

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export default function Purchase() {
  const [weight, setWeight] = useState('')
  const [cost, setCost] = useState('')
  const [source, setSource] = useState('')
  const [message, setMessage] = useState('')

  const addPurchase = () => {
    const w = round(Number(weight))
    const c = round(Number(cost))
    if (!Number.isFinite(w) || w < 0.01 || !Number.isFinite(c) || c <= 0) {
      setMessage('请输入至少0.01G的重量和正确成本')
      return
    }

    const data = loadInventory()
    const date = currentRecordDate()
    const batchId = `B${Date.now()}`
    const lotCycle = beginNewLotCycle(data, {
      date,
      source,
      weight: w,
      cost: c,
    })
    const batch = addInventoryBatch(data, {
      id: batchId,
      date,
      source,
      weight: w,
      cost: c,
    })
    const batchUnitCost = round(batch.unitCost)
    data.stock = round(data.stock + w)
    data.totalWeightCost = round(data.totalWeightCost + c)
    data.cost = round(data.cost + c)
    const averageCostAfter = data.stock > 0 ? round(data.totalWeightCost / data.stock) : 0
    saveInventory(data)

    saveRecord({
      type: 'purchase',
      date,
      source: source.trim() || '未填写',
      weight: w,
      amount: c,
      costAmount: c,
      profitAmount: 0,
      batchId,
      lotCycleId: lotCycle.id,
      unitCost: batchUnitCost,
      averageCostAfter,
      stockAfter: data.stock,
    })

    setWeight('')
    setCost('')
    setSource('')
    setMessage(`✅ 已开始第${lotCycle.sequence}批：进货${w.toFixed(2)}G，RM${batchUnitCost.toFixed(2)}/G；上一批已封存`)
  }

  return (
    <div>
      <h1>📥 进货</h1>
      <p>供应来源（可选）</p>
      <input value={source} onChange={(event) => setSource(event.target.value)} placeholder="供应来源（可选）" />
      <p>重量（G，最小0.01）</p>
      <input value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="重量（G）" type="number" step="0.01" />
      <p>总成本（RM）</p>
      <input value={cost} onChange={(event) => setCost(event.target.value)} placeholder="总成本（RM）" type="number" step="0.01" />
      <button type="button" onClick={addPurchase}>保存进货</button>
      <small>每次进货都会封存上一批，并开启新的批次包；上一批结余库存和本金会带入本批。</small>
      {message && <p>{message}</p>}
    </div>
  )
}
