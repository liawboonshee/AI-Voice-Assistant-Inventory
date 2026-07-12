import type { VoiceAdapter, VoiceListenHandlers } from './types'


interface SpeechRecognitionEventLike {

  resultIndex:number

  results:ArrayLike<{

    isFinal:boolean

    0:{
      transcript:string
    }

  }>

}



interface SpeechRecognitionLike {

  lang:string

  continuous:boolean

  interimResults:boolean


  onresult:
    ((event:SpeechRecognitionEventLike)=>void)|null


  onerror:
    ((event:{error:string})=>void)|null


  onend:
    (()=>void)|null


  start:()=>void

  stop:()=>void

}



type SpeechRecognitionConstructor =
  new()=>SpeechRecognitionLike




declare global {

  interface Window {

    SpeechRecognition?:SpeechRecognitionConstructor

    webkitSpeechRecognition?:SpeechRecognitionConstructor

  }

}





function getSpeechRecognitionCtor(){

  return (

    window.SpeechRecognition ??

    window.webkitSpeechRecognition ??

    null

  )

}






export function createWebSpeechAdapter():VoiceAdapter{


let recognition:SpeechRecognitionLike|null=null

let handlers:VoiceListenHandlers|null=null

let manualStop=false


// 累积完整语句

let finalText=''


// 延迟发送计时器

let sendTimer:any=null





return {





async isSupported(){

  return !!getSpeechRecognitionCtor()

},





async requestPermission(){


if(!getSpeechRecognitionCtor()){

  return false

}



try{


const stream =
await navigator.mediaDevices.getUserMedia({

  audio:true

})


stream
.getTracks()
.forEach(t=>t.stop())


return true



}catch{


return false


}



},






async start(nextHandlers){



const Ctor=getSpeechRecognitionCtor()



if(!Ctor){


nextHandlers.onError(
'当前设备不支持语音识别'
)


return


}





handlers=nextHandlers

manualStop=false

finalText=''



if(sendTimer){

clearTimeout(sendTimer)

}





recognition?.stop()



const instance=new Ctor()





// 中文

instance.lang='zh-CN'



// 持续监听

instance.continuous=true



// 开启临时结果

instance.interimResults=true






instance.onresult=(event)=>{


let text=''



for(

let i=event.resultIndex;

i<event.results.length;

i++

){


text +=

event.results[i]?.[0]?.transcript ?? ''



}





const last =
event.results[event.results.length-1]





if(last?.isFinal){



// 累积语音

finalText += text





// 每次新讲话重新计时

if(sendTimer){

clearTimeout(sendTimer)

}





// 停顿1.5秒才发送

sendTimer=setTimeout(()=>{



const result=finalText.trim()



if(result){


handlers?.onFinal(result)


finalText=''


}



},1500)






}else{


handlers?.onPartial?.(text)


}



}








instance.onerror=(event)=>{



if(event.error==='no-speech'){

return

}




const message =


event.error==='not-allowed'


?

'麦克风权限被拒绝，请允许录音权限'


:

`语音错误：${event.error}`




handlers?.onError(message)



}









instance.onend=()=>{



recognition=null




// 非手动停止自动恢复

if(!manualStop){



setTimeout(()=>{



try{


instance.start()



}catch{}



},1000)



}




}








recognition=instance




try{


instance.start()



}catch{


handlers?.onError(
'启动语音失败'
)


}




},








async stop(){



manualStop=true



if(sendTimer){

clearTimeout(sendTimer)

}



recognition?.stop()



recognition=null



handlers=null



}






}


}
