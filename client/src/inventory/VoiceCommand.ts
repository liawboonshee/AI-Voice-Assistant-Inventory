export type VoiceCommand = {

  type:'sale' | 'purchase' | 'query' | null

  customer?:string

  weight?:number

  amount?:number

}



export function parseVoiceCommand(text:string):VoiceCommand{


const t=text.replace(/\s+/g,'')



let result:VoiceCommand={

type:null

}



// 查询

if(
t.includes('库存') ||
t.includes('多少')
){

result.type='query'

return result

}



// 出货

if(
t.includes('卖') ||
t.includes('出货') ||
t.includes('出售')
){

result.type='sale'

}



// 进货

if(
t.includes('进货') ||
t.includes('买入')
){

result.type='purchase'

}




// 重量

const weight=t.match(
/(\d+(\.\d+)?)g/
)


if(weight){

result.weight=Number(weight[1])

}




// 金额

const money=t.match(
/(\d+(\.\d+)?)/
)


if(money){

result.amount=Number(money[1])

}



// 客户

const customer=t.match(
/给(.+?)(\d|g|元|块)/
)


if(customer){

result.customer=customer[1]

}



return result


}
