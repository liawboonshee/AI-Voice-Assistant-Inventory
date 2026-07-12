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

  maxAlternatives:number


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




// 数字修正

function fixVoiceText(text:string){

  return text

    .replace(/点/g,'.')

    .replace(/。/g,'.')

    .replace(/克/g,'g')

    .replace(/块/g,'')

    .replace(/元/g,'')

    .replace(/两/g,'2')

}







export function createWebSpeechAdapter():VoiceAdapter{


let recognition:SpeechRecognitionLike|null=null

let handlers:VoiceListenHandlers|null=null


let finalText=''


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


finalText=''


recognition?.stop()



const instance=new Ctor()



// 中文

instance.lang='zh-CN'


// 单句识别

instance.continuous=false



// 开启临时结果

instance.interimResults=true



// 多候选，提高数字准确率

instance.maxAlternatives=3






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


finalText += text




if(sendTimer){

clearTimeout(sendTimer)

}



sendTimer=setTimeout(()=>{


const result=
fixVoiceText(finalText.trim())



if(result){

handlers?.onFinal(result)

finalText=''

}



},2500)



}else{


handlers?.onPartial?.(text)

}



}







instance.onerror=(event)=>{


if(event.error==='no-speech'){

return

}



handlers?.onError(

`语音错误：${event.error}`

)


}







instance.onend=()=>{

recognition=null

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



if(sendTimer){

clearTimeout(sendTimer)

}



recognition?.stop()



recognition=null


handlers=null



}





}


}
