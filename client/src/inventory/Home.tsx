import { useEffect, useState } from 'react'
import { loadInventory } from './Storage'
import { loadRecords } from './Records'
import { executeVoiceCommand } from './VoiceAction'
import { createWebSpeechAdapter } from '../voice/webSpeechAdapter'


const CUSTOMER_KEY = 'customers'



function loadDebt(){

  const data =
    localStorage.getItem(CUSTOMER_KEY)


  if(!data){

    return 0

  }


  const list = JSON.parse(data)


  return list.reduce(
    (sum:any,item:any)=>
      sum + (item.debt || 0),
    0
  )

}






export default function Home(){


  const [data,setData] =
    useState(loadInventory())


  const [records,setRecords] =
    useState(loadRecords())


  const [debt,setDebt] =
    useState(loadDebt())


  const [input,setInput] =
    useState('')


  const [message,setMessage] =
    useState('')


  const [listening,setListening] =
    useState(false)



  const voice =
    createWebSpeechAdapter()







  useEffect(()=>{


    const timer =
      setInterval(()=>{


        setData(loadInventory())

        setRecords(loadRecords())

        setDebt(loadDebt())


      },500)



    return ()=>clearInterval(timer)


  },[])









  function runCommand(){


    if(!input){

      return

    }



    const result =
      executeVoiceCommand(input)



    setMessage(
      result || '没有识别到指令'
    )



    setInput('')


  }









  async function startVoice(){



    if(listening){


      await voice.stop()


      setListening(false)


      return

    }






    setListening(true)






    await voice.start({
