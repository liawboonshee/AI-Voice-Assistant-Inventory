import { useEffect, useState } from 'react'
import { loadInventory } from './Storage'
import { loadRecords } from './Records'


const CUSTOMER_KEY = 'customers'


function loadDebt(){

  const data = localStorage.getItem(CUSTOMER_KEY)

  if(!data){

    return 0

  }


  const list = JSON.parse(data)


  return list.reduce(
    (sum:any,item:any)=>sum+(item.debt||0),
    0
  )

}



export default function Home(){


  const [data,setData] = useState(loadInventory())

  const [records,setRecords] = useState(loadRecords())

  const [debt,setDebt] = useState(loadDebt())



  useEffect(()=>{


    const timer=setInterval(()=>{

      setData(loadInventory())

      setRecords(loadRecords())

      setDebt(loadDebt())


    },500)



    return()=>clearInterval(timer)


  },[])



  const totalSaleWeight = records

    .filter(item=>item.type==='sale')

    .reduce(
      (sum,item)=>sum+item.weight,
      0
    )



  return (

    <div style={{padding:24}}>


      <h1>📦 库存宝</h1>



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
        {debt.toFixed(2)}
      </p>



      <p>
        📋 交易次数：
        {records.length}
      </p>



      <p>
        💵 实际利润：
        {data.profit.toFixed(2)}
      </p>



    </div>

  )

}
