import { useState } from 'react'
import Purchase from './Purchase'
import Sale from './Sale'
import { loadInventory } from './Storage'

export default function InventoryApp() {

  const [page, setPage] = useState('home')
  const data = loadInventory()

  return (
    <div style={{paddingBottom:100}}>

      {page === 'home' && (
        <div style={{padding:24}}>
          <h1>📦 库存宝</h1>

          <p>今日收入：{data.income}</p>

          <p>
            当前库存：
            {data.stock.toFixed(2)} g
          </p>

          <p>
            总盈利：
            {data.profit}
          </p>
        </div>
      )}


      {page === 'purchase' && (
        <Purchase />
      )}


      {page === 'sale' && (
        <Sale />
      )}


      {page === 'stock' && (
        <div style={{padding:24}}>
          <h1>📦 库存</h1>
          <p>
            剩余：
            {data.stock.toFixed(2)} g
          </p>
        </div>
      )}


      {page === 'customer' && (
        <div style={{padding:24}}>
          <h1>👤 客户</h1>
          <p>客户功能开发中</p>
        </div>
      )}


      <div
        style={{
          position:'fixed',
          bottom:60,
          left:0,
          right:0,
          display:'flex',
          justifyContent:'space-around',
          background:'#111827',
          padding:10
        }}
      >

        <button onClick={()=>setPage('home')}>
          首页
        </button>

        <button onClick={()=>setPage('purchase')}>
          进货
        </button>

        <button onClick={()=>setPage('sale')}>
          出货
        </button>

        <button onClick={()=>setPage('customer')}>
          客户
        </button>

        <button onClick={()=>setPage('stock')}>
          库存
        </button>

      </div>

    </div>
  )
}
