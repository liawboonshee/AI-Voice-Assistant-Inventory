import { useEffect, useState } from 'react'
import { loadInventory } from './Storage'
import { loadRecords } from './Records'


const CUSTOMER_KEY='customers'



function loadDebt(){

const data=localStorage.getItem(CUSTOMER_KEY)


if(!data){

return 0

}


const list=JSON.parse(data)



return list.reduce(

(sum:any,item:any)=>

sum+(item.debt||0),

0

)

}





export default function Home(){



const [data,setData]=useState(loadInventory())

const [records,setRecords]=useState(loadRecords())

const [debt,setDebt]=useState(loadDebt())





useEffect(()=>{


const timer=setInterval(()=>{


setData(loadInventory())

setRecords(loadRecords())

setDebt(loadDebt())


},500)



return()=>clearInterval(timer)



},[])







const totalSaleWeight=

records

.filter(item=>item.type==='sale')

.reduce(

(sum,item)=>

sum+item.weight,

0

)






// 平均成本

const averageCost=

data.stock>0

?

data.totalWeightCost/data.stock

:

0







return(


<div style={{padding:24}}>



<h1>📦 库存宝</h1>



<h2>库存总览</h2>




<p>

📦 当前库存：

<b>

{data.stock.toFixed(2)} g

</b>

</p>





<p>

⚖️ 平均成本：

<b>

{averageCost.toFixed(2)}

</b>

</p>





<p>

💰 库存本金：

<b>

{data.totalWeightCost.toFixed(2)}

</b>

</p>





<p>

📤 总出货量：

<b>

{totalSaleWeight.toFixed(2)} g

</b>

</p>





<p>

💵 总收入：

<b>

{data.income.toFixed(2)}

</b>

</p>





<p>

📈 实际利润：

<b>

{data.profit.toFixed(2)}

</b>

</p>





<p>

📒 客户欠款：

<b>

{debt.toFixed(2)}

</b>

</p>





<p>

📋 交易次数：

<b>

{records.length}

</b>

</p>





</div>


)


}
