export type VoiceCommand = {

  type:'sale' | 'purchase' | 'query' | null

  customer?:string

  weight?:number

  amount?:number

}





// 中文数字转换

function chineseNumber(text:string):number|null{


const map:any={

'零':0,

'一':1,

'二':2,

'两':2,

'三':3,

'四':4,

'五':5,

'六':6,

'七':7,

'八':8,

'九':9

}



if(!/[一二三四五六七八九零]/.test(text)){

return null

}





if(text.includes('十')){


const arr=text.split('十')


let a=arr[0] ? map[arr[0]] : 1

let b=arr[1] ? map[arr[1]] : 0


return a*10+b


}




let result=''


for(const c of text){

if(map[c]!==undefined){

result+=map[c]

}

}



if(result){

return Number(result)

}



return null


}









function normalize(text:string){


return text

.replace(/\s+/g,'')

.replace(/克/g,'')

.replace(/gram/g,'')

.replace(/公斤/g,'kg')

.replace(/kg/g,'')

.replace(/g/g,'')

.replace(/块/g,'')

.replace(/元/g,'')

.replace(/两/g,'二')


}









function parseWeightNumber(text:string):number|null{



if(text.includes('.')){

return Number(text)

}





// 625 = 6.25

if(/^\d{3}$/.test(text)){


return Number(

text.slice(0,1)+'.'+text.slice(1)

)


}





// 25 = 0.25

if(/^\d{2}$/.test(text)){


return Number(

'0.'+text

)


}





// 05 = 0.5

if(/^0\d$/.test(text)){


return Number(

'0.'+text[1]

)


}





if(/^\d+$/.test(text)){


return Number(text)

}



return null


}











export function parseVoiceCommand(text:string):VoiceCommand{


const original=text



let t=normalize(text)



t=t.replace(/点/g,'.')






let result:VoiceCommand={

type:null

}







// =================
// 快捷出货
// 出5
// 出5 350
// 出6251000
// =================


const saleQuick = original.match(

/出(\d+(\.\d+)?)\s*(\d+)?/

)



if(saleQuick){


result.type='sale'



const w=parseWeightNumber(
saleQuick[1]
)



result.weight =

w !== null

? w

: Number(saleQuick[1])





if(saleQuick[3]){

result.amount=

Number(saleQuick[3])

}



return result


}









// =================
// 快捷进货
// 进10 1000
// 进货10 1000
// =================


const purchaseQuick = original.match(

/进(?:货)?(\d+(\.\d+)?)\s*(\d+)?/

)



if(purchaseQuick){


result.type='purchase'



const w=parseWeightNumber(

purchaseQuick[1]

)



result.weight=

w !== null

? w

: Number(purchaseQuick[1])





if(purchaseQuick[3]){

result.amount=

Number(purchaseQuick[3])

}



return result


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










// 客户

const customerMatch = original.match(

/给(.+?)(\d|克|g|gram|元|块)/

)



if(customerMatch){


result.customer=

customerMatch[1]


}









// 数字解析

const nums=t.match(/\d+(\.\d+)?/g)



if(nums){



const weight=

parseWeightNumber(nums[0])



if(weight!==null){

result.weight=weight

}




if(nums.length>=2){

result.amount=

Number(

nums[nums.length-1]

)

}



}










// 中文重量

if(!result.weight){


const chinese=

original.match(

/([一二三四五六七八九零十点二两]+)(克|g|gram)?/

)



if(chinese){



let c=chinese[1]



c=c.replace(/点/g,'.')



const parts=c.split('.')




if(parts.length===2){



const a=chineseNumber(parts[0])

const b=chineseNumber(parts[1])



if(a!==null && b!==null){


result.weight=

Number(`${a}.${b}`)


}



}else{



const n=chineseNumber(c)



if(n!==null){

result.weight=n

}



}



}


}






return result


}
