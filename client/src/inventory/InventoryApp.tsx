import { useState } from 'react'

function Home() {
  return (
    <div style={{ padding: 24 }}>
      <h1>📦 库存宝</h1>

      <h2>库存管理系统</h2>

      <p>今日收入：0</p>
      <p>当前库存：0.00 g</p>
      <p>总盈利：0</p>
    </div>
  )
}

function Purchase() {
  return (
    <div style={{ padding: 24 }}>
      <h1>📥 进货</h1>
      <p>记录进货重量、成本</p>
    </div>
  )
}

function Sales() {
  return (
    <div style={{ padding: 24 }}>
      <h1>📤 出货</h1>
      <p>记录客户、重量、金额</p>
    </div>
  )
}

function Customers() {
  return (
    <div style={{ padding: 24 }}>
      <h1>👤 客户</h1>
      <p>客户资料和欠款记录</p>
    </div>
  )
}

function Stock() {
  return (
    <div style={{ padding: 24 }}>
      <h1>📦 库存</h1>
      <p>查看剩余库存</p>
    </div>
  )
}


export default function InventoryApp() {
  const [page, setPage] = useState('home')

  return (
    <div style={{ paddingBottom: 80 }}>

      {page === 'home' && <Home />}
      {page === 'purchase' && <Purchase />}
      {page === 'sales' && <Sales />}
      {page === 'customers' && <Customers />}
      {page === 'stock' && <Stock />}

      <div
        style={{
          position: 'fixed',
          bottom: 60,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'space-around',
          padding: 10,
          background: '#111827'
        }}
      >
        <button onClick={() => setPage('home')}>首页</button>
        <button onClick={() => setPage('purchase')}>进货</button>
        <button onClick={() => setPage('sales')}>出货</button>
        <button onClick={() => setPage('customers')}>客户</button>
        <button onClick={() => setPage('stock')}>库存</button>
      </div>

    </div>
  )
}
