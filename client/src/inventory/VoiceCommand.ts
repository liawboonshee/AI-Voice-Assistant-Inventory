export type VoiceCommand = {

  type:'sale' | 'purchase' | 'query' | null

  customer?:string

  weight?:number

  amount?:number

}



function normalize(text:string){

return text

.replace(/\s+/g,'')

.replace(/点/g,'.')

.replace(/克/g,'')

.replace(/gram/g,'')

.replace(/公斤/g,'kg')

.replace(/kg/g,'')

.replace(/g/g,'')

.replace(/块/g,'')

.replace(/元/g,'')

.replace(/两/g,'2')



}





export function parseVoiceCommand(text:string):VoiceCommand{


const t=normalize(text)



let result:VoiceCommand={

type:null

}




// 查询

if(

t.includes('库存')

||

t.includes('多少')

||

t.includes('还有')

){

result.type='query'

return result

}





// 出货

if(

t.includes('卖')

||

t.includes('出货')

||

t.includes('出售')

){

result.type='sale'

}





// 进货

if(

t.includes('进货')

||

t.includes('买入')

){

result.type='purchase'

}





// 提取数字

const nums =
t.match(/\d+(\.\d+)?/g)





if(nums){


// 第一个数字重量

result.weight =
Number(nums[0])




// 最后一个数字金额

if(nums.length>=2){

result.amount =
Number(nums[nums.length-1])

}


}





// 客户

const customerMatch =
text.match(
/给(.+?)(\d|克|g|gram|元|块)/
)


if(customerMatch){

result.customer =
customerMatch[1]

}





return result


}
