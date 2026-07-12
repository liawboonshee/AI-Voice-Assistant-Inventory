import { useState } from 'react'

import Purchase from './Purchase'
import Sale from './Sale'
import Customers from './Customers'
import Stock from './Stock'
import RecordsPage from './RecordsPage'
import Backup from './Backup'

import { loadInventory } from './Storage'
import { loadRecords } from './Records'


export default function InventoryApp(){


  const [page,setPage] = useState('home')


  const data = loadInventory()

  const records = loadRecords()



  const totalSaleWeight = records

    .filter(item=>item.type==='sale')

    .reduce(
      (sum,item)=>sum+item.weight,
      0
    )



  const customers = JSON.parse(
    localStorage.getItem('customers') || '[]'
  )


  const totalDebt = customers

    .reduce(
      (sum:any,item:any)=>
      sum+(item.debt||0),
      0
    )



  return (

    <div style={{paddingBottom:100}}>



      {
        page==='home' &&

        <div style={{padding:24}}>

          <h1>📦 库存宝</h1>

          <h2>库存管理系统</h2>


          <p>
            📦 当前库存：
            {data.stock.toFixed(2)} g
          </p>


          <p>
            📤 总出货量：
            {totalSaleWeight.toFixed(2)} g
          </p>


          <p>
            💰 总收入：
            {data.income.toFixed(2)}
          </p>


          <p>
            📒 客户欠款：
            {totalDebt.toFixed(2)}
          </p>


          <p>
            📋 交易次数：
            {records.length}
          </p>


          <p>
            💵 总盈利：
            {data.profit.toFixed(2)}
          </p>


        </div>

      }





      {
        page==='purchase' &&

        <Purchase/>

      }





      {
        page==='sale' &&

        <Sale/>

      }





      {
        page==='customer' &&

        <Customers/>

      }





      {
        page==='stock' &&

        <Stock/>

      }





      {
        page==='records' &&

        <RecordsPage/>

      }





      {
        page==='backup' &&

        <Backup/>

      }






      <div

        style={{

          position:'fixed',

          bottom:60,

          left:0,

          right:0,

          display:'flex',

          justifyContent:'space-around',

          background:'#111827',

          padding:10,

          overflowX:'auto'

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



        <button onClick={()=>setPage('records')}>
          记录
        </button>



        <button onClick={()=>setPage('backup')}>
          备份
        </button>



      </div>


    </div>

  )

}
