import { useState } from 'react'
import { consumeInventoryBatches } from './Batches'
import { recordLotCycleSale } from './LotCycles'
import { loadInventory, saveInventory } from './Storage'
import { currentRecordDate, saveRecord } from './Records'
import { calculatePaymentBreakdown, paymentSummary } from './Payments'

type CustomerData = { name: string; phone?: string; debt: number }

const RED_WINE_UNIT_COST = 8.5

const QUICK_SALES = [
  { price: 50, weight: 0.25 },
  { price: 80, weight: 0.4 },
  { price: 100, weight: 0.55 },
  { price: 150, weight: 1 },
  { price: 300, weight: 2.5 },
] as const

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function loadCustomers(): CustomerData[] {
  try {
    const data = JSON.parse(localStorage.getItem('customers') || '[]')
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function saveCustomerSale(name: string, debtAmount: number): void {
  const customers = loadCustomers()
  const customer = customers.find((item) => item.name === name)
  if (customer) customer.debt = round((customer.debt || 0) + debtAmount)
  else customers.push({ name, debt: round(debtAmount) })
  localStorage.setItem('customers', JSON.stringify(customers))
}

function repayCustomerDebt(name: string, amount: number): void {
  if (amount <= 0) return
  const customers = loadCustomers()
  const customer = customers.find((item) => item.name === name)
  if (!customer) return
  customer.debt = Math.max(0, round((customer.debt || 0) - amount))
  localStorage.setItem('customers', JSON.stringify(customers))
}

export default function Sale() {
  const [customers, setCustomers] = useState<CustomerData[]>(loadCustomers)
  const [customer, setCustomer] = useState('')
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false)
  const [weight, setWeight] = useState('')
  const [redWine, setRedWine] = useState(false)
  const [price, setPrice] = useState('')
  const [transfer, setTransfer] = useState('')
  const [debt, setDebt] = useState('')
  const [selectedPresetPrice, setSelectedPresetPrice] = useState<number | null>(null)
  const [message, setMessage] = useState('')

  const customerQuery = customer.trim().toLowerCase()
  const customerSuggestions = customers
    .filter((item) => !customerQuery || item.name.toLowerCase().includes(customerQuery))
    .slice(0, 6)

  function selectQuickSale(priceValue: number, weightValue: number) {
    setRedWine(false)
    setPrice(String(priceValue))
    setWeight(String(weightValue))
    setSelectedPresetPrice(priceValue)
    setMessage('')
  }

  const addSale = () => {
    const quantity = redWine ? Number(weight) : 0
    if (redWine && (!Number.isSafeInteger(quantity) || quantity < 1 || !Number.isFinite(quantity * RED_WINE_UNIT_COST))) {
      setMessage('请输入红酒粒数（正整数）')
      return
    }
    const w = redWine ? 0 : round(Number(weight))
    if (!redWine && (!Number.isFinite(w) || w < 0.01)) {
      setMessage('请输入至少0.01G的重量；售价可以留空')
      return
    }

    const totalValue = price.trim() === '' ? undefined : Number(price)
    if (redWine && (totalValue === undefined || !Number.isFinite(totalValue) || totalValue <= 0)) {
      setMessage('请填写红酒总售价')
      return
    }
    const transferValue = transfer.trim() === '' ? undefined : Number(transfer)
    const debtValue = debt.trim() === '' ? undefined : Number(debt)
    let saleTransferValue = transferValue
    let oldDebtPayment = 0
    if (
      totalValue !== undefined &&
      transferValue !== undefined &&
      Number.isFinite(totalValue) &&
      Number.isFinite(transferValue) &&
      transferValue > totalValue
    ) {
      if ((debtValue || 0) > 0) {
        setMessage('转账超过总售价时不能同时新增本次欠款')
        return
      }
      saleTransferValue = round(totalValue)
      oldDebtPayment = round(transferValue - totalValue)
    }
    const automaticCash = totalValue === undefined
      ? undefined
      : round(totalValue - (saleTransferValue || 0) - (debtValue || 0))
    if (automaticCash !== undefined && automaticCash < 0) {
      setMessage('转账和欠款合计不能超过总售价')
      return
    }

    const payment = calculatePaymentBreakdown({
      total: totalValue,
      cashAmount: automaticCash,
      transferAmount: saleTransferValue,
      debtAmount: debtValue,
    })
    if (typeof payment === 'string') {
      setMessage(payment)
      return
    }

    const data = loadInventory()
    if (!redWine && data.stock < w) {
      setMessage(`库存不足，目前只有${data.stock.toFixed(2)}G`)
      return
    }

    const customerName = customer.trim() || '未填写'
    if (payment.debtAmount > 0 && !customer.trim()) {
      setMessage('有欠款时必须填写顾客名字')
      return
    }
    if (oldDebtPayment > 0) {
      const existingCustomer = loadCustomers().find((item) => item.name === customer.trim())
      if (!customer.trim() || !existingCustomer) {
        setMessage('转账超过总售价时必须选择已有顾客，才能扣除旧账')
        return
      }
      const existingDebt = Math.max(0, existingCustomer.debt || 0)
      if (oldDebtPayment > existingDebt) {
        setMessage(`多余转账RM${oldDebtPayment.toFixed(2)}超过该顾客旧欠款RM${existingDebt.toFixed(2)}`)
        return
      }
    }

    const inventoryBeforeSale = { ...data }
    const batchResult = redWine ? null : consumeInventoryBatches(data, w)
    if (!redWine && !batchResult) {
      setMessage('批次库存不足，请先到库存页面盘点修正')
      return
    }
    const saleCost = redWine ? round(quantity * RED_WINE_UNIT_COST) : batchResult!.saleCost
    const hasAmount = payment.total > 0
    // 欠款暂不计利润；只按实际收到的现金与转账确认利润。
    const profitAmount = hasAmount ? round(payment.paidAmount - saleCost) : 0

    if (batchResult) {
      data.stock = batchResult.stockAfter
      data.totalWeightCost = batchResult.costAfter
    }
    data.income = round(data.income + payment.paidAmount + oldDebtPayment)
    data.profit = round(data.profit + profitAmount + oldDebtPayment)
    saveInventory(data)

    const date = currentRecordDate()
    const lotCycleId = redWine ? undefined : recordLotCycleSale(inventoryBeforeSale, {
      date,
      weight: w,
      amount: payment.total,
      paidAmount: payment.paidAmount,
      cashAmount: payment.cashAmount,
      transferAmount: payment.transferAmount,
      debtAmount: payment.debtAmount,
      costAmount: saleCost,
      profitAmount,
      stockAfter: data.stock,
      costAfter: data.totalWeightCost,
    })

    saveCustomerSale(customerName, payment.debtAmount)
    repayCustomerDebt(customerName, oldDebtPayment)
    saveRecord({
      type: 'sale',
      date,
      customer: customerName,
      weight: w,
      amount: payment.total,
      cashAmount: payment.cashAmount,
      transferAmount: payment.transferAmount,
      debtAmount: payment.debtAmount,
      paidAmount: payment.paidAmount,
      costAmount: saleCost,
      profitAmount,
      paymentMethod: payment.paymentMethod,
      batchAllocations: batchResult?.allocations,
      ...(redWine ? { product: 'red_wine' as const, quantity, unitCost: RED_WINE_UNIT_COST } : {}),
      lotCycleId,
      stockAfter: data.stock,
    })
    if (oldDebtPayment > 0) {
      saveRecord({
        type: 'income',
        date,
        customer: customerName,
        weight: 0,
        amount: oldDebtPayment,
        transferAmount: oldDebtPayment,
        paidAmount: oldDebtPayment,
        costAmount: 0,
        profitAmount: oldDebtPayment,
        paymentMethod: 'transfer',
        note: '客户还款',
      })
    }

    setCustomer('')
    setRedWine(false)
    setWeight('')
    setPrice('')
    setTransfer('')
    setDebt('')
    setSelectedPresetPrice(null)
    setMessage(
      hasAmount
        ? `✅ 出货成功：${paymentSummary(payment)}${
          oldDebtPayment > 0 ? `；多余转账RM${oldDebtPayment.toFixed(2)}已扣旧账` : ''
        }；${redWine ? `红酒${quantity}粒，本金` : '本批成本'}RM${saleCost.toFixed(2)}，单笔利润RM${profitAmount.toFixed(2)}`
        : '✅ 出货成功，未填写金额，已扣除库存',
    )
  }

  return (
    <div>
      <h1>📤 出货</h1>
      <p>客户</p>
      <div className="customer-combobox">
        <input
          aria-autocomplete="list"
          aria-expanded={showCustomerSuggestions && customerSuggestions.length > 0}
          aria-label="顾客名称"
          autoComplete="off"
          role="combobox"
          value={customer}
          onBlur={() => window.setTimeout(() => setShowCustomerSuggestions(false), 150)}
          onChange={(event) => {
            setCustomer(event.target.value)
            setShowCustomerSuggestions(true)
          }}
          onFocus={() => {
            setCustomers(loadCustomers())
            setShowCustomerSuggestions(true)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setShowCustomerSuggestions(false)
          }}
          placeholder="输入或选择顾客名字"
        />
        {showCustomerSuggestions && customerSuggestions.length > 0 && (
          <div className="customer-suggestion-list" role="listbox">
            {customerSuggestions.map((item) => (
              <button
                className="customer-suggestion-button"
                key={item.name}
                type="button"
                onClick={() => {
                  setCustomer(item.name)
                  setShowCustomerSuggestions(false)
                }}
              >
                <strong>👤 {item.name}</strong>
                <span>{item.phone || '未填电话'} · 欠款RM{(item.debt || 0).toFixed(2)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="inventory-sale-fields-grid">
        <label className="inventory-sale-unit-field inventory-sale-weight-field">
          <input aria-label={redWine ? "红酒粒数" : "重量（G）"} value={weight} onChange={(event) => {
            setWeight(event.target.value)
            setSelectedPresetPrice(null)
          }} placeholder={redWine ? "粒数" : "重量（G）"} type="number" min={redWine ? 1 : 0.01} step={redWine ? 1 : 0.01} />
          <strong>{redWine ? "粒" : "G"}</strong>
        </label>
        <label className="inventory-sale-unit-field inventory-sale-price-field">
          <input aria-label="总售价（RM）" value={price} onChange={(event) => {
            setPrice(event.target.value)
            setSelectedPresetPrice(null)
          }} placeholder="总售价（RM）" type="number" step="0.01" />
          <strong>RM</strong>
        </label>
        <label className="inventory-sale-unit-field inventory-sale-transfer-field">
          <input aria-label="转账" value={transfer} onChange={(event) => setTransfer(event.target.value)} placeholder="转账" type="number" step="0.01" />
          <strong>RM</strong>
        </label>
        <label className="inventory-sale-unit-field inventory-sale-debt-field">
          <input aria-label="欠款" value={debt} onChange={(event) => setDebt(event.target.value)} placeholder="欠款" type="number" step="0.01" />
          <strong>RM</strong>
        </label>
      </div>
      <p className="inventory-sale-preset-label">快捷出货选项（点击自动填写）</p>
      <div className="inventory-sale-preset-grid">
        {QUICK_SALES.map((item) => (
          <button
            aria-pressed={selectedPresetPrice === item.price}
            className={`inventory-sale-preset-button${selectedPresetPrice === item.price ? ' active' : ''}`}
            key={item.price}
            type="button"
            onClick={() => selectQuickSale(item.price, item.weight)}
          >
            <strong>RM{item.price}</strong>
            <span>{item.weight.toFixed(2)}G</span>
          </button>
        ))}
        <button type="button" aria-pressed={redWine} className={`inventory-sale-preset-button${redWine ? ' active' : ''}`} onClick={() => {
          setRedWine(true)
          setWeight('1')
          setPrice('')
          setTransfer('')
          setDebt('')
          setSelectedPresetPrice(null)
          setMessage('')
        }}>
          <strong>🍷 红酒</strong><span>本金 RM8.50 / 粒</span>
        </button>
      </div>
      {redWine && <p>红酒本金：RM{(Math.max(0, Number(weight) || 0) * RED_WINE_UNIT_COST).toFixed(2)}（不扣 G 库存）</p>}
      <button className="inventory-save-sale-button" type="button" onClick={addSale}>✅ 保存出货</button>
      {message && <p>{message}</p>}
    </div>
  )
}
