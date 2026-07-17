import { useState } from 'react'
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
      setMessage('请输入至少0.01g的重量和正确成本')
      return
    }

    const data = loadInventory()
    const batchUnitCost = round(c / w)
    data.stock = round(data.stock + w)
    data.totalWeightCost = round(data.totalWeightCost + c)
    data.cost = round(data.cost + c)
    const averageCostAfter = data.stock > 0 ? round(data.totalWeightCost / data.stock) : 0
    saveInventory(data)

    saveRecord({
      type: 'purchase',
      date: currentRecordDate(),
      source: source.trim() || '未填写',
      weight: w,
      amount: c,
      costAmount: c,
      profitAmount: 0,
      batchId: `B${Date.now()}`,
      unitCost: batchUnitCost,
      averageCostAfter,
      stockAfter: data.stock,
    })

    setWeight('')
    setCost('')
    setSource('')
    setMessage(`✅ 新批次${w.toFixed(2)}g，批次成本RM${batchUnitCost.toFixed(2)}/g；库存平均成本已重算为RM${averageCostAfter.toFixed(2)}/g`)
  }

  return (
    <div>
      <h1>📥 进货</h1>
      <p>供应来源（可选）</p>
      <input value={source} onChange={(event) => setSource(event.target.value)} placeholder="例如：阿强供应商" />
      <p>重量（g，最小0.01）</p>
      <input value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="例如 125" type="number" step="0.01" />
      <p>总成本（RM）</p>
      <input value={cost} onChange={(event) => setCost(event.target.value)} placeholder="例如 4500" type="number" step="0.01" />
      <button type="button" onClick={addPurchase}>保存进货</button>
      <small>每次加入新批货，系统会用剩余库存本金加新批成本，重新计算平均每克成本。</small>
      {message && <p>{message}</p>}
    </div>
  )
}
