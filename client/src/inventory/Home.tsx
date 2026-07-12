import { useEffect, useState } from 'react'
import { loadInventory } from './Storage'


export default function Home(){

  const [data,setData] = useState(loadInventory())


  useEffect(()=>{

    const timer=setInterval(()=>{

      setData(loadInventory())

    },500)


    return ()=>clearInterval(timer)

  },[])



  const avgCost =
    data.stock > 0
    ? data.totalWeightCost / data.stock
    : 0



  return (

    <div style={{padding:24}}>


      <h1>📦 库存宝</h1>


      <h2>库存管理系统</h2>


      <p>
        今日收入：
        {data.income.toFixed(2)}
      </p>


      <p>
        当前库存：
        {data.stock.toFixed(2)} g
      </p>


      <p>
        库存本金：
        {data.totalWeightCost.toFixed(2)}
      </p>


      <p>
        平均成本：
        {avgCost.toFixed(2)} /g
      </p>


      <p>
        总成本：
        {data.cost.toFixed(2)}
      </p>


      <p>
        实际盈利：
        {data.profit.toFixed(2)}
      </p>


    </div>

  )

}
