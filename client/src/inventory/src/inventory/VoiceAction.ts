import { loadInventory, saveInventory } from './Storage'
import { saveRecord } from './Records'


function getNumber(text:string){

  const match =
    text.match(/\d+(\.\d+)?/)

  if(match){

    return Number(match[0])

  }

  return 0

}



export function executeVoiceCommand(text:string){


const t=text
.replace(/点/g,'.')
.replace(/克/g,'')
.replace(/块/g,'')
.replace(/元/g,'')





const data=loadInventory()






// 出货

if(

t.includes('卖')

||

t.includes('出货')

||

t.includes('出售')

){



const nums =
t.match(/\d+(\.\d+)?/g)



if(!nums || nums.length<2){

return '没有识别到重量和金额'

}



const weight=Number(nums[0])

const amount=Number(nums[1])





if(data.stock < weight){

return '库存不足'

}




data.stock -= weight


data.income += amount


data.profit += amount



saveInventory(data)





saveRecord({

type:'sale',

date:new Date().toLocaleString(),

customer:'语音客户',

weight,

amount

})





return `出货成功 ${weight} 克，金额 ${amount}`


}







// 进货

if(

t.includes('进货')

||

t.includes('买入')

){



const nums =
t.match(/\d+(\.\d+)?/g)



if(!nums || nums.length<2){

return '没有识别到重量和成本'

}



const weight=Number(nums[0])

const cost=Number(nums[1])




data.stock += weight


data.cost += cost



saveInventory(data)





saveRecord({

type:'purchase',

date:new Date().toLocaleString(),

weight,

amount:cost

})





return `进货成功 ${weight} 克`


}







return null


}
