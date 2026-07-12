import { useState } from 'react'
import { loadRecords } from './Records'


export default function RecordsPage(){

  const [list,setList] = useState(loadRecords())


  const refresh = ()=>{

    setList(loadRecords())

  }


  return (

    <div style={{padding:24}}>


      <h1>📋 交易记录</h1>


      <button onClick={refresh}>
        刷新
      </button>


      <br/>
      <br/>


      {
        list.length===0 && (
          <p>暂无记录</p>
        )
      }



      {
        list.map((item,index)=>(

          <div
            key={index}
            style={{
              border:'1px solid #555',
              padding:12,
              marginBottom:10,
              borderRadius:8
            }}
          >


            <p>
              类型：
              {item.type==='sale'
              ? '📤 出货'
              : '📥 进货'}
            </p>


            <p>
              日期：
              {item.date}
            </p>


            {
              item.customer && (
                <p>
                  客户：
                  {item.customer}
                </p>
              )
            }


            <p>
              重量：
              {item.weight.toFixed(2)} g
            </p>


            <p>
              金额：
              {item.amount.toFixed(2)}
            </p>


          </div>

        ))
      }


    </div>

  )

}
