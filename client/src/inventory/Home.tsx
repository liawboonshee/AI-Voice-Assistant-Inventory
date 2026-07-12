import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { loadInventory } from './Storage'
import { loadRecords } from './Records'

import { createWebSpeechAdapter } from '../voice/webSpeechAdapter'
import { executeVoiceCommand } from './VoiceAction'



const CUSTOMER_KEY='customers'



function loadDebt(){


const data =
localStorage.getItem(CUSTOMER_KEY)


if(!data){

return 0

}


const list = JSON.parse(data)


return list.reduce(

(sum:number,item:any)=>

sum+(item.debt||0),

0

)

}







export default function Home(){


const navigate = useNavigate()



const [data,setData]=
useState(loadInventory())


const [records,setRecords]=
useState(loadRecords())


const [debt,setDebt]=
useState(loadDebt())


const [text,setText]=
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









// 麦克风


const startVoice=async()=>{


const voice =
createWebSpeechAdapter()



await voice.start({



onFinal:(result)=>{


setText(result)



const answer =
executeVoiceCommand(result)



setMessage(

answer || '无法处理'

)


},




onPartial:(t)=>{


setText(t)


},




onError:(e)=>{


setMessage(e)


}



})



}









// 文字输入


const sendText=()=>{


const answer =
executeVoiceCommand(text)



setMessage(

answer || '无法识别'

)


}









const totalSaleWeight = records


.filter(

item=>item.type==='sale'

)


.reduce(

(sum,item)=>

sum+item.weight,

0

)









return(


<div style={{padding:24}}>



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

💰 总收入：

{data.income.toFixed(2)}

</p>




<p>

📒 客户欠款：

{debt.toFixed(2)}

</p>




<p>

💵 实际利润：

{data.profit.toFixed(2)}

</p>







<hr/>





<h2>
AI语音助手
</h2>






<button

onClick={startVoice}

style={{

fontSize:40,

padding:'15px 30px'

}}

>

🎤

</button>







<br/>
<br/>







<input


value={text}


onChange={

e=>setText(e.target.value)

}


placeholder="例如 出货6点25克1000"


style={{

width:'100%',

fontSize:20,

padding:10

}}


/>








<br/>
<br/>






<button

onClick={sendText}

style={{

fontSize:20,

padding:'10px 30px'

}}

>

确认处理

</button>







<p>

{message}

</p>







<hr/>






<h2>

快捷功能

</h2>







<button


onClick={()=>navigate('/sale')}


style={{

fontSize:18,

padding:15,

margin:5

}}


>

📤 出货

</button>







<button


onClick={()=>navigate('/purchase')}


style={{

fontSize:18,

padding:15,

margin:5

}}


>

📥 进货

</button>







</div>


)


}
