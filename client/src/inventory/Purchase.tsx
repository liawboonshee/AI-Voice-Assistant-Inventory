import { useState } from 'react'
import { addInventoryBatch } from './Batches'
import { beginNewLotCycle } from './LotCycles'
import { currentRecordDate, saveRecord } from './Records'
import { loadInventory, saveInventory, redWineStock, RED_WINE_UNIT_COST } from './Storage'

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export default function Purchase() {
  const [weight, setWeight] = useState('')
  const [cost, setCost] = useState('')
  const [source, setSource] = useState('')
  const [message, setMessage] = useState('')
  const [wineQuantity, setWineQuantity] = useState('')
  const [wineSource, setWineSource] = useState('')
  const [wineMessage, setWineMessage] = useState('')

  function addWinePurchase() {
    const quantity = Number(wineQuantity)
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      setWineMessage('请输入正确的红酒进货粒数')
      return
    }
    const data = loadInventory()
    const next = redWineStock(data) + quantity
    if (!Number.isSafeInteger(next)) { setWineMessage('粒数过大，请重新输入'); return }
    const total = round(quantity * RED_WINE_UNIT_COST)
    data.redWineStock = next
    saveInventory(data)
    saveRecord({ type: 'purchase', product: 'red_wine', quantity, date: currentRecordDate(), source: wineSource.trim() || '未填写', weight: 0, amount: total, costAmount: total, unitCost: RED_WINE_UNIT_COST, profitAmount: 0, redWineStockAfter: next })
    setWineQuantity('')
    setWineSource('')
    setWineMessage(`✅ 红酒进货${quantity}粒，总本金RM${total.toFixed(2)}，剩余${next}粒`)
  }

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
      <hr />
      <section>
        <h2>🍷 红酒进货</h2>
        <p>现有库存：{redWineStock(loadInventory())}粒</p>
        <input aria-label="红酒供应来源" value={wineSource} onChange={event => setWineSource(event.target.value)} placeholder="供应来源（可选）" />
        <input aria-label="红酒进货粒数" value={wineQuantity} onChange={event => setWineQuantity(event.target.value)} placeholder="进货粒数" type="number" min="1" step="1" />
        {wineQuantity.trim() && Number.isSafeInteger(Number(wineQuantity)) && Number(wineQuantity) > 0 && <p>进货总本金：RM{(Number(wineQuantity) * RED_WINE_UNIT_COST).toFixed(2)}</p>}
        <button type="button" onClick={addWinePurchase}>保存红酒进货</button>
        {wineMessage && <p>{wineMessage}</p>}
      </section>
    </div>
  )
}
