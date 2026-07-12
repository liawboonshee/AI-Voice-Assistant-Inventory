import { useState } from 'react'
import { saveRecord } from './Records'
import { loadInventory, saveInventory } from './Storage'


export default function Purchase(){


const [weight,setWeight]=useState('')
const [cost,setCost]=useState('')
const [message,setMessage]=useState('')



const addPurchase=()=>{


const w=Number(weight)

const c=Number(cost)



if(!w || !c){

setMessage('请输入重量和成本')

return

}




const data=loadInventory()



// 原来的库存成本

const oldCost=data.totalWeightCost



// 增加库存

data.stock += w



// 增加成本

data.cost += c



// 保存总重量成本

data.totalWeightCost = oldCost + c



saveInventory(data)



saveRecord({

type:'purchase',

date:new Date().toLocaleString(),

weight:w,

amount:c

})



setWeight('')

setCost('')


setMessage('✅ 进货成功')


}




return(

<div style={{padding:24}}>


<h1>📥 进货</h1>



<p>重量(g)</p>


<input

value={weight}

onChange={(e)=>setWeight(e.target.value)}

placeholder="例如 10.00"

type="number"

step="0.01"

/>




<p>成本</p>


<input

value={cost}

onChange={(e)=>setCost(e.target.value)}

placeholder="例如 500"

type="number"

step="0.01"

/>



<br/><br/>



<button onClick={addPurchase}>

保存进货

</button>



<p>{message}</p>



</div>

)


}
