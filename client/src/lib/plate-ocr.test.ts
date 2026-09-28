import assert from 'node:assert/strict';
import { requestPlateRecognition } from './plate-ocr';
const reply=(status:number,body:unknown)=>(async()=>new Response(JSON.stringify(body),{status})) as typeof fetch;
await assert.rejects(requestPlateRecognition('image',reply(401,{message:'Unauthorized'})),/sign-in has expired/);
await assert.rejects(requestPlateRecognition('image',reply(502,{})),/service is unavailable/);
await assert.rejects(requestPlateRecognition('image',reply(200,{text:''})),/No readable text/);
await assert.rejects(requestPlateRecognition('image',(async()=>{throw new Error('offline')}) as typeof fetch),/Check your connection/);
assert.equal(await requestPlateRecognition('image',reply(200,{text:'品川 500 あ 12-34'})),'品川 500 あ 12-34');
console.log('OCR checks passed: expired sign-in, upstream failure, no text, network failure, Japanese text.');
