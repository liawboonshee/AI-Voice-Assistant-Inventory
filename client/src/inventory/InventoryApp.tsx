import { useCallback, useEffect, useMemo, useState } from 'react'

import { getVoiceAdapter } from '../voice/voiceAdapter'
import { speak } from '../utils/tts'
import { isSameLocalDay, recordCashIn, recordProfit } from './Analytics'
import { runInventoryTool } from './AITools'
import Backup from './Backup'
import Customers from './Customers'
import Income from './Income'
import Purchase from './Purchase'
import { loadRecords, type RecordItem } from './Records'
import RecordsPage from './RecordsPage'
import Sale from './Sale'
import Stock from './Stock'
import { loadInventory } from './Storage'

type InventoryPage =
  | 'home'
  | 'purchase'
  | 'sale'
  | 'customer'
  | 'stock'
  | 'records'
  | 'debt'
  | 'backup'
  | 'income'

type CustomerData = {
  name: string
  debt: number
}

type Props = {
  onOpenVoice?: () => void
}

function loadCustomers(): CustomerData[] {
  try {
    const value = JSON.parse(localStorage.getItem('customers') || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function formatMoney(value: number): string {
  return `RM${value.toFixed(2)}`
}

function recordTitle(item: RecordItem): string {
  if (item.type === 'purchase') return '📥 进货'
  if (item.type === 'adjustment') return '🧮 库存修正'
  if (item.type === 'debt') return '🧾 新增欠款'
  if (item.type === 'income') return item.note === '客户还款' ? '💳 客户还款' : '💰 收入'
  if (item.weight === 0 && (item.paidAmount || 0) > 0) return '💳 客户还款'
  return '📤 出货'
}

function DebtPage({ customers }: { customers: CustomerData[] }) {
  const owing = customers.filter((customer) => customer.debt > 0)
  const total = owing.reduce((sum, customer) => sum + customer.debt, 0)

  return (
    <section className="inventory-debt-page">
      <div className="inventory-debt-total">
        <span>欠款总额</span>
        <strong>{formatMoney(total)}</strong>
      </div>
      {owing.length === 0 ? (
        <div className="inventory-empty-card">✅ 目前没有客户欠款</div>
      ) : (
        owing.map((customer) => (
          <div className="inventory-debt-row" key={customer.name}>
            <span>👤 {customer.name}</span>
            <strong>{formatMoney(customer.debt)}</strong>
          </div>
        ))
      )}
    </section>
  )
}

export default function InventoryApp({ onOpenVoice }: Props) {
  const [page, setPage] = useState<InventoryPage>('home')
  const [data, setData] = useState(loadInventory())
  const [records, setRecords] = useState(loadRecords())
  const [customers, setCustomers] = useState(loadCustomers())
  const [isListening, setIsListening] = useState(false)
  const [voiceText, setVoiceText] = useState('')

  const refresh = useCallback(() => {
    setData({ ...loadInventory() })
    setRecords([...loadRecords()])
    setCustomers([...loadCustomers()])
  }, [])

  useEffect(() => {
    const timer = window.setInterval(refresh, 700)
    return () => window.clearInterval(timer)
  }, [refresh])

  const todayRecords = useMemo(() => records.filter((item) => isSameLocalDay(item.date)), [records])
  const todayIncome = todayRecords.reduce((sum, item) => sum + recordCashIn(item), 0)
  const todayProfit = todayRecords.reduce((sum, item) => sum + recordProfit(item), 0)
  const todayShipment = todayRecords
    .filter((item) => item.type === 'sale' && item.weight > 0)
    .reduce((sum, item) => sum + item.weight, 0)
  const totalDebt = customers.reduce((sum, customer) => sum + (customer.debt || 0), 0)
  const recentRecords = [...records].reverse().slice(0, 4)

  const startInventoryVoice = async () => {
    if (isListening) return
    setIsListening(true)
    setVoiceText('正在聆听，请说话…')

    try {
      await getVoiceAdapter().start({
        onPartial: (text) => setVoiceText(text),
        onFinal: (text) => {
          const answer = runInventoryTool(text) || '我还不明白，请换一种说法。'
          setVoiceText(`你说：${text}\n${answer}`)
          setIsListening(false)
          refresh()
          void speak(answer).catch(() => undefined)
        },
        onError: (message) => {
          setVoiceText(message)
          setIsListening(false)
        },
      })
    } catch (error) {
      setVoiceText(error instanceof Error ? error.message : '语音识别失败，请重试')
      setIsListening(false)
    }
  }

  const pageContent = () => {
    if (page === 'purchase') return <Purchase />
    if (page === 'sale') return <Sale />
    if (page === 'customer') return <Customers />
    if (page === 'stock') return <Stock />
    if (page === 'records') return <RecordsPage />
    if (page === 'backup') return <Backup />
    if (page === 'income') return <Income />
    if (page === 'debt') return <DebtPage customers={customers} />
    return null
  }

  return (
    <div className="inventory-app">
      <header className="inventory-pro-header">
        <div className="inventory-title-row">
          <div>
            <h1>📦 库存宝 AI 2.9</h1>
            <p>今天：{new Date().toLocaleDateString('zh-CN')}</p>
          </div>
          <div className="inventory-header-actions">
            {onOpenVoice && (
              <button aria-label="打开AI助手" className="inventory-icon-action" type="button" onClick={onOpenVoice}>
                🤖
              </button>
            )}
            <button type="button" onClick={() => setPage('backup')}>
              备份
            </button>
          </div>
        </div>
      </header>

      {page === 'home' ? (
        <main className="inventory-home">
          <section className="inventory-stat-grid">
            <div className="inventory-stat-card stat-green">
              <span>今日收入</span>
              <strong>{formatMoney(todayIncome)}</strong>
            </div>
            <div className="inventory-stat-card stat-orange">
              <span>今日盈利</span>
              <strong>{formatMoney(todayProfit)}</strong>
            </div>
            <div className="inventory-stat-card stat-blue">
              <span>总盈利</span>
              <strong>{formatMoney(data.profit)}</strong>
            </div>
            <div className="inventory-stat-card stat-purple">
              <span>当前库存</span>
              <strong>{data.stock.toFixed(2)}g</strong>
            </div>
            <div className="inventory-stat-card stat-red">
              <span>欠款总额</span>
              <strong>{formatMoney(totalDebt)}</strong>
            </div>
            <div className="inventory-stat-card stat-cyan">
              <span>今日出货</span>
              <strong>{todayShipment.toFixed(2)}g</strong>
            </div>
          </section>

          <button
            className={`inventory-ai-button ${isListening ? 'is-listening' : ''}`}
            type="button"
            onClick={startInventoryVoice}
          >
            🎙️ {isListening ? '正在聆听…' : 'AI语音记账'}
          </button>

          {voiceText && <div className="inventory-voice-result">{voiceText}</div>}

          <section className="inventory-quick-grid">
            <button type="button" onClick={() => setPage('sale')}>📤 出货</button>
            <button type="button" onClick={() => setPage('purchase')}>📥 进货</button>
            <button type="button" onClick={() => setPage('customer')}>👤 顾客</button>
            <button type="button" onClick={() => setPage('income')}>💰 收入</button>
          </section>

          <button className="inventory-report-button" type="button" onClick={() => setPage('records')}>
            📊 报表 / 搜索
          </button>

          <section className="inventory-recent-card">
            <h2>📋 最近交易</h2>
            {recentRecords.length === 0 ? (
              <p>暂无记录</p>
            ) : (
              recentRecords.map((item, index) => (
                <div className="inventory-recent-row" key={`${item.date}-${index}`}>
                  <div>
                    <strong>{recordTitle(item)}</strong>
                    <span>{item.customer || item.date}</span>
                  </div>
                  <div className="inventory-recent-amount">
                    <strong>{item.weight > 0 ? `${item.weight.toFixed(2)}g` : item.note || '收入'}</strong>
                    <span>{formatMoney(Math.abs(item.amount))}</span>
                  </div>
                </div>
              ))
            )}
          </section>
        </main>
      ) : (
        <main className="inventory-page-shell">
          <button className="inventory-back-button" type="button" onClick={() => setPage('home')}>
            ← 返回首页
          </button>
          {pageContent()}
        </main>
      )}

      <nav className="inventory-bottom-nav">
        {[
          ['home', '🏠', '首页'],
          ['sale', '📤', '出货'],
          ['stock', '📦', '库存'],
          ['customer', '👥', '顾客'],
          ['debt', '🧾', '欠款'],
        ].map(([key, icon, label]) => (
          <button
            className={page === key ? 'active' : ''}
            key={key}
            type="button"
            onClick={() => setPage(key as InventoryPage)}
          >
            <span>{icon}</span>
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}
