export type InventoryData = {

  stock:number

  income:number

  profit:number

  cost:number

  // 当前库存总本金
  totalWeightCost:number

}



const KEY='inventory_data'



const defaultData:InventoryData={

  stock:0,

  income:0,

  profit:0,

  cost:0,

  totalWeightCost:0

}



export function loadInventory():InventoryData{


const data=localStorage.getItem(KEY)



if(!data){

return defaultData

}



const result=JSON.parse(data)



// 兼容旧数据

if(result.totalWeightCost===undefined){

result.totalWeightCost=0

}



return result



}



export function saveInventory(data:InventoryData){


localStorage.setItem(

KEY,

JSON.stringify(data)

)


}
