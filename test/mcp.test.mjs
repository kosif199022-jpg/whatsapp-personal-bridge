import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { normalizeTo } from '../mcp/index.mjs';
const invoke = async (name, args, reply = {sent:true,id:'real-id'}) => {
  const calls=[];
  const env={BRIDGE:{fetch:async request=>{ calls.push({url:request.url,body:request.method==='POST'?await request.json():null}); return Response.json(reply); }}};
  const response=await worker.fetch(new Request('https://mcp.test/mcp',{method:'POST',body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})}),env);
  return {rpc:await response.json(),calls};
};
test('normalizes Saudi, international and Arabic numbers without guessing other local countries',()=>{
  assert.equal(normalizeTo('٠٥٠١٢٣٤٥٦٧'),'966501234567');
  assert.equal(normalizeTo('0044 7700 900123'),'447700900123');
  assert.equal(normalizeTo('+20 101 234 5678'),'201012345678');
  assert.throws(()=>normalizeTo('arbitrary@example.com'));
  assert.throws(()=>normalizeTo('01012345678'));
});
test('rejects missing idempotency before bridge call',async()=>{
  const r=await invoke('send_whatsapp_message',{key:'test',to:'+966501234567',message:'hello'});
  assert.equal(r.rpc.result.isError,true); assert.equal(r.calls.length,0);
});
test('preserves message IDs and operation key without claiming delivered',async()=>{
  const r=await invoke('send_whatsapp_message',{key:'test',to:'0501234567',message:'hello',idempotencyKey:'op-1'});
  assert.equal(r.rpc.result.structuredContent.messageId,'real-id');
  assert.equal(r.rpc.result.structuredContent.status,'sent');
  assert.equal(r.calls[0].body.idempotencyKey,'op-1');
});
test('partial bundle stays failed and retains successful IDs',async()=>{
  const r=await invoke('send_whatsapp_bundle',{key:'test',to:'+966501234567',message:'hello',idempotencyKey:'op-2'},{sent:false,results:[{ok:true,id:'first'},{ok:false,error:'failed'}]});
  assert.equal(r.rpc.result.isError,true);assert.deepEqual(r.rpc.result.structuredContent.messageIds,['first']);
});
test('missing credentials cannot reach bridge',async()=>{
  const r=await invoke('get_whatsapp_status',{});assert.equal(r.rpc.result.isError,true);assert.equal(r.calls.length,0);
});
test('pair code uses protected existing route and normalized account phone',async()=>{
  const r=await invoke('pair_whatsapp',{key:'test',method:'code',phone:'0501234567'},{code:'TEST-ONLY'});
  assert.equal(r.calls[0].body.phone,'966501234567');assert.match(r.calls[0].url,/\/pair\/code$/);
});
