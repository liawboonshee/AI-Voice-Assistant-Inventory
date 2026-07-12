import { useState } from 'react'
import { loadInventory, saveInventory } from './Storage'
import { saveRecord } from './Records'


const CUSTOMER_KEY='customers'


function addCustomerDebt(name:string,amount:number){

  const data=localStorage.getItem(CUSTOMER_KEY)

  const list=data?JSON.parse(data):[]


  const index=list.findIndex(
    (item:any)=>item.name===name
  )


  if(index>=0){

    list[index].debt += amount

  }else{

    list.push({

      name:name,

      debt:amount

    })

  }


  localStorage.setItem(
    CUSTOMER_KEY,
    JSON.stringify(list)
  )

}



export default function Sale(){


const [weight,setWeight]=useState('')
const [amount,setAmount]=useState('')
const [customer,setCustomer]=useState('')
const [paid,setPaid]=useState('yes')
const [message,setMessage]=useState('')



function addSale(){


const w=Number(weight)

const total=Number(amount)



if(!w || !total){

setMessage('请输入重量和金额')

return

}



const data=loadInventory()



if(data.stock<w){

setMessage('库存不足')

return

}



const costPerGram =
data.stock>0
?
data.totalWeightCost/data.stock
:
0



const cost =
costPerGram*w



const profit =
total-cost



data.stock-=w

data.totalWeightCost-=cost

data.income+=total

data.profit+=profit



saveInventory(data)



if(paid==='no' && customer){

addCustomerDebt(
customer,
total
)

}



saveRecord({

type:'sale',

date:new Date().toLocaleString(),

customer:customer||'未填写',

weight:w,

amount:total

})



setWeight('')
setAmount('')
setCustomer('')

setMessage('✅ 出货成功')

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

value={weight}

onChange={(e)=>setWeight(e.target.value)}

type="number"

step="0.01"

placeholder="例如 6.25"

/>



<p>总金额</p>

<input

value={amount}

onChange={(e)=>setAmount(e.target.value)}

type="number"

placeholder="例如 600"

/>



<p>付款状态</p>


<select

value={paid}

onChange={(e)=>setPaid(e.target.value)}

>


<option value="yes">

已付款

</option>


<option value="no">

未付款

</option>


</select>



<br/><br/>



<button onClick={addSale}>

保存出货

</button>



<p>{message}</p>



</div>

)

}
