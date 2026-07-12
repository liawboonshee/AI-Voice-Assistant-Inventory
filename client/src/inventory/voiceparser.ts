export function fixVoiceText(text:string){

let t=text



// 中文数字转阿拉伯数字
const nums:any={

'零':0,
'一':1,
'二':2,
'三':3,
'四':4,
'五':5,
'六':6,
'七':7,
'八':8,
'九':9,
'十':10

}



// 六点二五 -> 6.25
t=t.replace(
/([一二三四五六七八九零]+)点([一二三四五六七八九零]+)/g,
(_,a,b)=>{

let n1=''

for(const c of a){

n1+=nums[c]??c

}


let n2=''

for(const c of b){

n2+=nums[c]??c

}


return n1+'.'+n2

}

)



// 十克 -> 10g
t=t.replace(

/十([克g])/g,

'10g'

)



// 中文整十
t=t.replace(

/([一二三四五六七八九])十/g,

(_,n)=>{

return String(nums[n]*10)

}

)



// 常见金额

t=t.replace(

/([一二三四五六七八九零]+)百/g,

(_,a)=>{


let n=0

for(const c of a){

n=n*10+(nums[c]??0)

}


return String(n*100)

}

)



// 单位统一

t=t.replace(
/克|公克/g,
'g'
)


t=t.replace(
/块|元钱/g,
''
)



return t.trim()


}
