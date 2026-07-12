import RecordsPage from './RecordsPage'
import { useState } from 'react'

import Purchase from './Purchase'
import Sale from './Sale'
import Customers from './Customers'
import Stock from './Stock'

import { loadInventory } from './Storage'



export default function InventoryApp(){


const [page,setPage]=useState('home')

  {page==='records' && (
  <RecordsPage />
)}

const data=loadInventory()



return(


<div style={{paddingBottom:100}}>



{

page==='home' &&

<div style={{padding:24}}>


<h1>📦 库存宝</h1>


<h2>库存管理系统</h2>


<p>

今日收入：

{data.income}

</p>



<p>

当前库存：

{data.stock.toFixed(2)} g

</p>



<p>

总盈利：

{data.profit}

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

<button onClick={()=>setPage('records')}>
  记录
</button>

</div>


</div>


)

}
