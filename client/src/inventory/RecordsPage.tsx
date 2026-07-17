import { useEffect, useMemo, useState } from 'react'
import { formatRecordDate, isSameLocalDay, isSameLocalMonth, recordCashIn, recordCashOut, recordProfit } from './Analytics'
import { loadRecords, type RecordItem } from './Records'
import { loadInventory } from './Storage'

function recordLabel(item: RecordItem): string {
  if (item.type === 'purchase') return '📥 进货'
  if (item.type === 'adjustment') return '🧮 库存修正'
  if (item.type === 'debt') return '🧾 新增欠款'
  if (item.type === 'income') return item.note === '客户还款' ? '💳 客户还款' : '💰 收入'
  return '📤 出货'
}

function paymentLabel(item: RecordItem): string {
  if (item.type !== 'sale') return ''
  if (item.paymentMethod === 'none') return '未填金额'
  if (item.paymentMethod === 'mixed') return '混合收款'
  if (item.paymentMethod === 'transfer') return '转账'
  if (item.paymentMethod === 'debt' || (item.debtAmount || 0) > 0) return '欠款'
  return '现金'
}

export default function RecordsPage() {
  const [records, setRecords] = useState(loadRecords())
  const [inventory, setInventory] = useState(loadInventory())
  const [search, setSearch] = useState('')

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRecords(loadRecords())
      setInventory({ ...loadInventory() })
    }, 700)
    return () => window.clearInterval(timer)
  }, [])

  const summary = useMemo(() => {
    const todayRecords = records.filter((item) => isSameLocalDay(item.date))
    const monthRecords = records.filter((item) => isSameLocalMonth(item.date))
    const todayIncome = todayRecords.reduce((sum, item) => sum + recordCashIn(item), 0)
    const todayCost = todayRecords
      .filter((item) => item.type === 'sale' && item.weight > 0)
      .reduce((sum, item) => sum + (item.costAmount || 0), 0)
    const todayProfit = todayRecords.reduce((sum, item) => sum + recordProfit(item), 0)
    const monthSales = monthRecords
      .filter((item) => item.type === 'sale' && item.weight > 0)
      .reduce((sum, item) => sum + item.amount, 0)
    const monthShipment = monthRecords
      .filter((item) => item.type === 'sale' && item.weight > 0)
      .reduce((sum, item) => sum + item.weight, 0)
    const monthProfit = monthRecords.reduce((sum, item) => sum + recordProfit(item), 0)
    const cashIn = records.reduce((sum, item) => sum + recordCashIn(item), 0)
    const cashOut = records.reduce((sum, item) => sum + recordCashOut(item), 0)
    return {
      todayIncome,
      todayCost,
      todayProfit,
      monthSales,
      monthShipment,
      monthProfit,
      cashIn,
      cashOut,
      cashFlow: cashIn - cashOut,
    }
  }, [records])

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return records
    return records.filter((item) =>
      [item.date, item.customer, item.source, item.note, recordLabel(item)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword)),
    )
  }, [records, search])

  return (
    <div>
      <h1>📋 报表 / 交易记录</h1>
      <section className="records-summary-grid">
        <div><span>今日收入</span><strong>RM{summary.todayIncome.toFixed(2)}</strong></div>
        <div><span>今日成本</span><strong>RM{summary.todayCost.toFixed(2)}</strong></div>
        <div><span>今日利润</span><strong>RM{summary.todayProfit.toFixed(2)}</strong></div>
        <div><span>本月销售</span><strong>RM{summary.monthSales.toFixed(2)}</strong></div>
        <div><span>本月利润</span><strong>RM{summary.monthProfit.toFixed(2)}</strong></div>
        <div><span>本月出货</span><strong>{summary.monthShipment.toFixed(2)}g</strong></div>
        <div><span>总利润</span><strong>RM{inventory.profit.toFixed(2)}</strong></div>
        <div><span>现金流</span><strong>RM{summary.cashFlow.toFixed(2)}</strong></div>
      </section>

      <input className="record-search-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索客户、供应来源或日期，例如：阿明" />
      {filtered.length === 0 && <p>暂无符合记录</p>}

      {filtered.slice().reverse().map((item, index) => (
        <section className="record-entry" key={`${item.date}-${records.length - index}`}>
          <h3>{recordLabel(item)}</h3>
          <p>日期：{formatRecordDate(item.date)}</p>
          {item.customer && <p>客户：{item.customer}</p>}
          {item.source && <p>供应来源：{item.source}</p>}
          {item.type === 'adjustment' && <p>库存变化：{item.weight >= 0 ? '+' : ''}{item.weight.toFixed(2)}g</p>}
          {item.type !== 'adjustment' && item.weight > 0 && <p>重量：{item.weight.toFixed(2)}g</p>}
          <p>金额：RM{Math.abs(item.amount).toFixed(2)}</p>
          {item.type === 'sale' && <p>收款方式：{paymentLabel(item)}</p>}
          {item.type === 'sale' && (item.cashAmount || 0) > 0 && <p>现金：RM{item.cashAmount?.toFixed(2)}</p>}
          {item.type === 'sale' && (item.transferAmount || 0) > 0 && <p>转账：RM{item.transferAmount?.toFixed(2)}</p>}
          {(item.debtAmount || 0) > 0 && <p>欠款：RM{item.debtAmount?.toFixed(2)}</p>}
          {item.type === 'purchase' && item.unitCost !== undefined && <p>本批成本：RM{item.unitCost.toFixed(2)}/g</p>}
          {item.averageCostAfter !== undefined && <p>重算平均成本：RM{item.averageCostAfter.toFixed(2)}/g</p>}
          {item.stockAfter !== undefined && <p>完成后库存：{item.stockAfter.toFixed(2)}g</p>}
          {item.type === 'sale' && item.weight > 0 && <p>单笔利润：RM{recordProfit(item).toFixed(2)}</p>}
          {item.note && <p>备注：{item.note}</p>}
        </section>
      ))}
    </div>
  )
}
