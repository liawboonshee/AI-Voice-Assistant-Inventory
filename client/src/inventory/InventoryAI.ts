import { loadInventory } from './Storage'
import { loadRecords } from './Records'


// 修正语音文字

function normalize(text:string){

  return text

  .replace(/两/g,'二')

  .replace(/点/g,'.')

  .replace(/克/g,'')

  .replace(/gram/g,'')

  .replace(/g/g,'')

  .replace(/公斤/g,'kg')

  .trim()

}







export function askInventory(command:string){


  let text =
  normalize(command.toLowerCase())



  const data=loadInventory()

  const records=loadRecords()





  // 查询库存

  if(

    text.includes('库存')

    ||

    text.includes('多少')

  ){

    return `目前库存还有 ${data.stock.toFixed(2)} 克`

  }






  // 查询收入

  if(

    text.includes('收入')

    ||

    text.includes('赚')

    ||

    text.includes('营业')

  ){

    return `目前总收入 ${data.income.toFixed(2)}`

  }







  // 查询利润

  if(

    text.includes('利润')

    ||

    text.includes('盈利')

  ){

    return `目前利润 ${data.profit.toFixed(2)}`

  }







  // 查询总出货

  if(

    text.includes('出货')

    ||

    text.includes('卖了多少')

    ||

    text.includes('卖')

  ){


    const total =

    records

    .filter(r=>r.type==='sale')

    .reduce(

      (sum,r)=>sum+r.weight,

      0

    )


    return `目前总出货量 ${total.toFixed(2)} 克`

  }







  // 查询交易次数

  if(

    text.includes('交易')

    ||

    text.includes('记录')

  ){

    return `目前共有 ${records.length} 笔交易`

  }








  // 查询欠款

  if(

    text.includes('欠')

    ||

    text.includes('欠款')

    ||

    text.includes('账')

  ){


    const customers =

    JSON.parse(

      localStorage.getItem('customers') || '[]'

    )



    const debt =

    customers.reduce(

      (sum:any,c:any)=>

      sum+(c.debt||0),

      0

    )


    return `目前客户欠款 ${debt.toFixed(2)}`

  }








  // 数字测试

  if(

    text.includes('多少克')

    ||

    text.includes('重量')

  ){

    const num=

    text.match(/\d+(\.\d+)?/)


    if(num){

      return `识别重量 ${num[0]} 克`

    }

  }





  return null

}
