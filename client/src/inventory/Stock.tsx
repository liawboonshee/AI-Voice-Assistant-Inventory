import { useEffect, useState } from 'react'
import { currentRecordDate, saveRecord } from './Records'
import { loadInventory, saveInventory } from './Storage'

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export default function Stock() {
  const [data, setData] = useState(loadInventory())
  const [actualStock, setActualStock] = useState('')
  const [actualCost, setActualCost] = useState('')
  const [note, setNote] = useState('盘点修正')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const timer = window.setInterval(() => setData({ ...loadInventory() }), 500)
    return () => window.clearInterval(timer)
  }, [])

  const avgCost = data.stock > 0 ? data.totalWeightCost / data.stock : 0

  function adjustStock() {
    const nextStock = round(Number(actualStock))
    if (!Number.isFinite(nextStock) || nextStock < 0) {
      setMessage('实际库存必须是0或更大的数字')
      return
    }

    let nextCost = actualCost.trim() === '' ? round(avgCost * nextStock) : round(Number(actualCost))
    if (!Number.isFinite(nextCost) || nextCost < 0) {
      setMessage('库存本金不能小于0')
      return
    }
    if (nextStock === 0) nextCost = 0

    const oldStock = data.stock
    const oldCost = data.totalWeightCost
    const next = { ...data, stock: nextStock, totalWeightCost: nextCost }
    saveInventory(next)
    saveRecord({
      type: 'adjustment',
      date: currentRecordDate(),
      weight: round(nextStock - oldStock),
      amount: 0,
      costAmount: round(nextCost - oldCost),
      profitAmount: 0,
      note: note.trim() || '盘点修正',
      stockAfter: nextStock,
      averageCostAfter: nextStock > 0 ? round(nextCost / nextStock) : 0,
    })

    setData(next)
    setActualStock('')
    setActualCost('')
    setMessage(`✅ 库存已由${oldStock.toFixed(2)}g修正为${nextStock.toFixed(2)}g`)
  }

  return (
    <div className="inventory-stock-page">
      <h1>📦 库存详情</h1>
      <section className="inventory-stock-summary">
        <p>剩余库存：<strong>{data.stock.toFixed(2)}g</strong></p>
        <p>库存本金：<strong>RM{data.totalWeightCost.toFixed(2)}</strong></p>
        <p>平均成本：<strong>RM{avgCost.toFixed(2)}/g</strong></p>
        <p>累计进货成本：<strong>RM{data.cost.toFixed(2)}</strong></p>
        <p>收入：<strong>RM{data.income.toFixed(2)}</strong></p>
        <p>利润：<strong>RM{data.profit.toFixed(2)}</strong></p>
      </section>

      <section className="inventory-stock-adjust">
        <h2>🧮 修改库存 / 盘点修正</h2>
        <p>实际库存重量（g）</p>
        <input type="number" min="0" step="0.01" value={actualStock} onChange={(event) => setActualStock(event.target.value)} placeholder={`目前 ${data.stock.toFixed(2)}g`} />
        <p>实际库存本金（RM，可不填）</p>
        <input type="number" min="0" step="0.01" value={actualCost} onChange={(event) => setActualCost(event.target.value)} placeholder="不填则保持原平均成本" />
        <p>备注</p>
        <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="例如：盘点修正" />
        <button type="button" onClick={adjustStock}>保存库存修改</button>
        {message && <p>{message}</p>}
      </section>
    </div>
  )
}
