import { useState } from 'react'
import { saveRecord } from './Records'
import { loadInventory, saveInventory } from './Storage'


export default function Sale(){


const [weight,setWeight]=useState('')
const [price,setPrice]=useState('')
const [customer,setCustomer]=useState('')
const [message,setMessage]=useState('')



const addSale=()=>{


const w=Number(weight)

const total=Number(price)



if(!w || !total){

setMessage('请输入重量和总售价')

return

}



const data=loadInventory()



if(data.stock < w){

setMessage('库存不足')

return

}




// 计算平均成本

const averageCost =

data.stock > 0

?

data.totalWeightCost / data.stock

:

0



// 本次商品本金

const itemCost = w * averageCost



// 真实利润

const profit = total - itemCost




// 扣库存

data.stock -= w



// 扣除对应成本

data.totalWeightCost -= itemCost



// 增加收入

data.income += total



// 增加真实利润

data.profit += profit



saveInventory(data)




// 保存记录

saveRecord({

type:'sale',

date:new Date().toLocaleString(),

customer:customer || '未填写',

weight:w,

amount:total

})



setWeight('')

setPrice('')

setCustomer('')


setMessage(
`✅ 出货成功 利润: ${profit.toFixed(2)}`
)


}



return(

<div style={{padding:24}}>


<h1>📤 出货</h1>



<p>客户</p>


<input

value={customer}

onChange={(e)=>setCustomer(e.target.value)}

placeholder="客户名字"

/>




<p>重量(g)</p>


<input

value={
