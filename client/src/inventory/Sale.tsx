import { useState } from 'react'
import { loadInventory, saveInventory } from './Storage'
import { currentRecordDate, saveRecord } from './Records'
import { calculatePaymentBreakdown, paymentSummary } from './Payments'

type CustomerData = { name: string; phone?: string; debt: number }

const QUICK_SALES = [
  { price: 50, weight: 0.25 },
  { price: 80, weight: 0.4 },
  { price: 100, weight: 0.53 },
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

export default function Sale() {
  const [customers, setCustomers] = useState<CustomerData[]>(loadCustomers)
  const [customer, setCustomer] = useState('')
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false)
  const [weight, setWeight] = useState('')
  const [price, setPrice] = useState('')
  const [transfer, setTransfer] = useState('')
  const [debt, setDebt] = useState('')
  const [message, setMessage] = useState('')

  const customerQuery = customer.trim().toLowerCase()
  const customerSuggestions = customers
    .filter((item) => !customerQuery || item.name.toLowerCase().includes(customerQuery))
    .slice(0, 6)

  const selectedPreset = QUICK_SALES.find(
    (item) => Number(price) === item.price && Number(weight) === item.weight,
  )

  function selectQuickSale(priceValue: number, weightValue: number) {
    setPrice(String(priceValue))
    setWeight(String(weightValue))
    setMessage('')
  }

  const addSale = () => {
    const w = round(Number(weight))
    if (!Number.isFinite(w) || w < 0.01) {
      setMessage('请输入至少0.01g的重量；售价可以留空')
      return
    }

    const totalValue = price.trim() === '' ? undefined : Number(price)
    const transferValue = transfer.trim() === '' ? undefined : Number(transfer)
    const debtValue = debt.trim() === '' ? undefined : Number(debt)
    const automaticCash = totalValue === undefined
      ? undefined
      : round(totalValue - (transferValue || 0) - (debtValue || 0))
    if (automaticCash !== undefined && automaticCash < 0) {
      setMessage('转账和欠款合计不能超过总售价')
      return
    }

    const payment = calculatePaymentBreakdown({
      total: totalValue,
      cashAmount: automaticCash,
      transferAmount: transferValue,
      debtAmount: debtValue,
    })
    if (typeof payment === 'string') {
      setMessage(payment)
      return
    }

    const data = loadInventory()
    if (data.stock < w) {
      setMessage(`库存不足，目前只有${data.stock.toFixed(2)}g`)
      return
    }

    const oldStock = data.stock
    const costPerGram = oldStock > 0 ? data.totalWeightCost / oldStock : 0
    const saleCost = round(costPerGram * w)
    const hasAmount = payment.total > 0
    // 欠款暂不计利润；只按实际收到的现金与转账确认利润。
    const profitAmount = hasAmount ? round(payment.paidAmount - saleCost) : 0
    const customerName = customer.trim() || '未填写'
    if (payment.debtAmount > 0 && !customer.trim()) {
      setMessage('有欠款时必须填写顾客名字')
      return
    }

    data.stock = round(data.stock - w)
    data.totalWeightCost = Math.max(0, round(data.totalWeightCost - saleCost))
    data.income = round(data.income + payment.paidAmount)
    data.profit = round(data.profit + profitAmount)
    saveInventory(data)

    saveCustomerSale(customerName, payment.debtAmount)
    saveRecord({
      type: 'sale',
      date: currentRecordDate(),
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
      stockAfter: data.stock,
    })

    setCustomer('')
    setWeight('')
    setPrice('')
    setTransfer('')
    setDebt('')
    setMessage(
      hasAmount
        ? `✅ 出货成功：${paymentSummary(payment)}；单笔利润RM${profitAmount.toFixed(2)}`
        : '✅ 出货成功，未填写金额，已扣除库存',
    )
  }

  return (
    <div>
      <h1>📤 出货</h1>
      <p className="inventory-sale-preset-label">先选择出货金额</p>
      <div className="inventory-sale-preset-grid">
        {QUICK_SALES.map((item) => (
          <button
            aria-pressed={selectedPreset === item}
            className={`inventory-sale-preset-button${selectedPreset === item ? ' active' : ''}`}
            key={item.price}
            type="button"
            onClick={() => selectQuickSale(item.price, item.weight)}
          >
            <strong>RM{item.price}</strong>
            <span>{item.weight.toFixed(2)}g</span>
          </button>
        ))}
      </div>
      {selectedPreset && (
        <div className="inventory-sale-selection">
          ✅ 已选择 RM{selectedPreset.price}，出货 {selectedPreset.weight.toFixed(2)}g
        </div>
      )}
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
      <details className="inventory-sale-extra-details">
        <summary>✏️ 其他填写（重量、金额、收款方式）</summary>
        <p>重量（g，最小0.01）</p>
        <input value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="例如 10" type="number" step="0.01" />
        <p>总售价（RM，可不填）</p>
        <input value={price} onChange={(event) => setPrice(event.target.value)} placeholder="可留空；例如 800" type="number" step="0.01" />
        <p className="inventory-payment-heading">💳 收款方式（剩余金额自动算现金）</p>
        <div className="inventory-payment-split">
          <label>
            <span>🏦 转账</span>
            <input value={transfer} onChange={(event) => setTransfer(event.target.value)} placeholder="例如 200" type="number" step="0.01" />
          </label>
          <label>
            <span>🧾 欠款</span>
            <input value={debt} onChange={(event) => setDebt(event.target.value)} placeholder="可自动计算" type="number" step="0.01" />
          </label>
        </div>
        <small>例如总售价300、转账200，其余RM100会自动记录为现金。</small>
      </details>
      <button className="inventory-save-sale-button" type="button" onClick={addSale}>✅ 保存出货</button>
      {message && <p>{message}</p>}
    </div>
  )
}
