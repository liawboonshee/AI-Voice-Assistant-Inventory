import { emptyPackInputs, parsePacks, packsWeight, packSummary } from './Packs'
import PackQuantityFields from './PackQuantityFields'
import { useState } from 'react'
import { employeePacks, employeePackError, employeeStock, loadEmployees, ownerStock, stockError } from './EmployeesData'
import { loadRecords } from './Records'
import { consumeInventoryBatches } from './Batches'
import { recordLotCycleSale } from './LotCycles'
import { loadInventory, saveInventory } from './Storage'
import { currentRecordDate, saveRecord } from './Records'
import { calculatePaymentBreakdown, paymentSummary } from './Payments'

type CustomerData = { name: string; phone?: string; debt: number }

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

export default function Sale({ initialEmployeeId = '' }: { initialEmployeeId?: string }) {
  const [employees] = useState(loadEmployees)
  const [employeeId, setEmployeeId] = useState(initialEmployeeId)
  const selectedEmployee = employees.find(item => item.id === employeeId)
  const [customers, setCustomers] = useState<CustomerData[]>(loadCustomers)
  const [customer, setCustomer] = useState('')
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false)
  const [quantities, setQuantities] = useState(emptyPackInputs)
  const [price, setPrice] = useState('')
  const [transfer, setTransfer] = useState('')
  const [debt, setDebt] = useState('')
  const [message, setMessage] = useState('')

  const customerQuery = customer.trim().toLowerCase()
  const customerSuggestions = customers
    .filter((item) => !customerQuery || item.name.toLowerCase().includes(customerQuery))
    .slice(0, 6)

  const addSale = () => {
    let packCounts
    try { packCounts = parsePacks(quantities) } catch (error) { setMessage(error instanceof Error ? error.message : '数量不正确'); return }
    const w = packsWeight(packCounts)
    if (!Number.isFinite(w) || w < 0.01) {
      setMessage('请填写各规格的出货数量（至少1个）；售价可以留空')
      return
    }

    const totalValue = price.trim() === '' ? undefined : Number(price)
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
    const allocationError = (employeeId ? employeePackError(loadRecords(), employeeId, packCounts) : null) || stockError(data.stock, loadRecords(), w, employeeId)
    if (employeeId && !selectedEmployee) { setMessage('找不到员工，请重新选择'); return }
    if (allocationError) {
      setMessage(allocationError)
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
    const batchResult = consumeInventoryBatches(data, w)
    if (!batchResult) {
      setMessage('批次库存不足，请先到库存页面盘点修正')
      return
    }
    const saleCost = batchResult.saleCost
    const hasAmount = payment.total > 0
    // 欠款暂不计利润；只按实际收到的现金与转账确认利润。
    const profitAmount = hasAmount ? round(payment.paidAmount - saleCost) : 0

    data.stock = batchResult.stockAfter
    data.totalWeightCost = batchResult.costAfter
    data.income = round(data.income + payment.paidAmount + oldDebtPayment)
    data.profit = round(data.profit + profitAmount + oldDebtPayment)
    saveInventory(data)

    const date = currentRecordDate()
    const lotCycleId = recordLotCycleSale(inventoryBeforeSale, {
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
      packCounts,
      employeeId: selectedEmployee?.id,
      employeeName: selectedEmployee?.name,
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
      batchAllocations: batchResult.allocations,
      lotCycleId,
      stockAfter: data.stock,
    })
    if (oldDebtPayment > 0) {
      saveRecord({
        type: 'income',
        employeeId: selectedEmployee?.id,
        employeeName: selectedEmployee?.name,
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
    setQuantities(emptyPackInputs())
    setPrice('')
    setTransfer('')
    setDebt('')
    setMessage(
      hasAmount
        ? `✅ 出货成功：${paymentSummary(payment)}${
          oldDebtPayment > 0 ? `；多余转账RM${oldDebtPayment.toFixed(2)}已扣旧账` : ''
        }；本批成本RM${saleCost.toFixed(2)}，单笔利润RM${profitAmount.toFixed(2)}`
        : '✅ 出货成功，未填写金额，已扣除库存',
    )
  }

  return (
    <div>
      <h1>📤 出货</h1>
      <label>从谁手里出货？<select aria-label="出货员工" value={employeeId} onChange={event => { setEmployeeId(event.target.value); setMessage('') }}>
        <option value="">我手里的货</option>
        {employees.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      <p>可出货：<strong>{(employeeId ? employeeStock(loadRecords(), employeeId) : ownerStock(loadInventory().stock, loadRecords())).toFixed(2)}G</strong></p>
      {employeeId && <p className="pack-balance">手里剩余：{packSummary(employeePacks(loadRecords(), employeeId), true)}</p>}
      <PackQuantityFields value={quantities} onChange={setQuantities} />
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
        <label className="inventory-sale-unit-field inventory-sale-price-field">
          <input aria-label="总售价（RM）" value={price} onChange={(event) => {
            setPrice(event.target.value)
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
      <button className="inventory-save-sale-button" type="button" onClick={addSale}>✅ 保存出货</button>
      {message && <p>{message}</p>}
    </div>
  )
}
