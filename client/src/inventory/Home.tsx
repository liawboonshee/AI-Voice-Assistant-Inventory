import { useEffect, useState } from 'react'
import { loadInventory } from './Storage'
import { loadRecords } from './Records'
import { executeVoiceCommand } from './VoiceAction'


const CUSTOMER_KEY='customers'



function loadDebt(){


const data=
localStorage.getItem(CUSTOMER_KEY)


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


const [data,setData]=
useState(loadInventory())


const [records,setRecords]=
useState(loadRecords())


const [debt,setDebt]=
useState(loadDebt())


const [input,setInput]=
useState('')


const [message,setMessage]=
useState('')





useEffect(()=>{


const timer=setInterval(()=>{


setData(loadInventory())

setRecords(loadRecords())

setDebt(loadDebt())


},500)



return()=>clearInterval(timer)



},[])







function runCommand(){



if(!input){

return

}



const result=
executeVoiceCommand(input)



setMessage(
result || '没有识别到指令'
)



setInput('')


}







const totalSaleWeight =
records

.filter(
item=>item.type==='sale'
)

.reduce(
(sum,item)=>
sum+item.weight,
0
)








return(


<div
style={{
padding:24
}}
>



<h1>
📦 库存宝
</h1>





<p>
📦 当前库存：
{data.stock.toFixed(2)} g
</p>



<p>
📤 总出货：
{totalSaleWeight.toFixed(2)} g
</p>



<p>
💰 收入：
{data.income.toFixed(2)}
</p>



<p>
💵 利润：
{data.profit.toFixed(2)}
</p>



<p>
📒 欠款：
{debt.toFixed(2)}
</p>





<hr/>




<h2>
🎤 AI语音助手
</h2>




<input

value={input}

onChange={
e=>setInput(e.target.value)
}

placeholder="例如 出5 350 / 进10 1000"

style={{

width:'100%',

fontSize:18,

padding:12

}}


/>



<br/>
<br/>




<button

onClick={runCommand}

style={{

fontSize:20,

padding:'12px 30px'

}}

>

🎤 发送指令

</button>





<p>
