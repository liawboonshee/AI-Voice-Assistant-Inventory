export type RecordItem = {

  type:'purchase' | 'sale'

  date:string

  customer?:string

  weight:number

  amount:number

}



const KEY='inventory_records'



export function loadRecords():RecordItem[]{

  const data=localStorage.getItem(KEY)

  if(!data){

    return []

  }

  return JSON.parse(data)

}



export function saveRecord(item:RecordItem){

  const records=loadRecords()

  records.push(item)

  localStorage.setItem(

    KEY,

    JSON.stringify(records)

  )

}



export function deleteRecord(index:number){

  const records=loadRecords()

  records.splice(index,1)


  localStorage.setItem(

    KEY,

    JSON.stringify(records)

  )

}
