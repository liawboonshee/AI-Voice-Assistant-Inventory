import { loadRecords } from './Records'


export default function RecordsPage(){

const list = loadRecords()


return (

<div style={{padding:24}}>

<h1>📋 交易记录</h1>


{
list.map((item,index)=>(

<div key={index}>

<p>
{item.type==='sale'
?'📤 出货'
:'📥 进货'}
</p>

<p>
日期：
{item.date}
</p>

<p>
重量：
{item.weight} g
</p>

<p>
金额：
{item.amount}
</p>

<hr/>

</div>

))

}


</div>

)

}
