import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { aliasError, isOffensiveAlias, TERMS_VERSION } from '../src/carematch/safety.mjs'
import { getDeviceToken, loadBlocks, clearPlayerStorage, DEVICE_KEY } from '../src/carematch/player.mjs'
import { createHandler, digest } from '../supabase/functions/carematch-api/handler.mjs'

const deviceToken = 'a'.repeat(64)
function fixture() {
  const calls = []
  const handler = createHandler({ publicKeys:['test'], ipSecret:'private', rpc:async(name,args) => { if (name === 'carematch_cleanup') return null; calls.push({name,args}); return {id:crypto.randomUUID(),weekly:[],allTime:[],roundsRemoved:1,reportsRemoved:1} } })
  const request = body => handler(new Request('https://example.com', {method:'POST',headers:{apikey:'test','Content-Type':'application/json'},body:JSON.stringify(body)}))
  return { calls, request }
}
const online = body => ({deviceToken,termsVersion:TERMS_VERSION,...body})

test('client/server safety source matches exactly', () => assert.equal(readFileSync(new URL('../src/carematch/safety.mjs',import.meta.url),'utf8'),readFileSync(new URL('../supabase/functions/carematch-api/safety.mjs',import.meta.url),'utf8')))
test('offensive names, spaced punctuation, leetspeak, look-alikes and markup are rejected', () => {
  for (const name of ['FUCK','F.U.C.K','SH1T','P U T A','ＰＵＴＡ','аsshole','<script>','N1GG3R']) assert.ok(aliasError(name),name)
  assert.ok(isOffensiveAlias('ＦＵＣＫ'))
  for (const name of ['JOEY','ARCADE_7','LIEZL','SHIFT HERO','QA-001']) assert.equal(aliasError(name),'',name)
})
test('publishing requires explicit current terms and valid device proof', async () => {
  const f=fixture()
  assert.equal((await f.request({action:'start',alias:'JOEY'})).status,428)
  assert.equal((await f.request(online({action:'start',alias:'JOEY',termsVersion:'old'}))).status,428)
  assert.equal((await f.request(online({action:'start',alias:'JOEY',deviceToken:'bad'}))).status,400)
  assert.equal((await f.request(online({action:'start',alias:'F.U.C.K'}))).status,400)
  assert.equal(f.calls.length,0)
  assert.equal((await f.request(online({action:'start',alias:'JOEY'}))).status,200)
  assert.equal(f.calls[0].args.p_player_hash,await digest(deviceToken))
  assert.equal(f.calls[0].args.p_terms_version,TERMS_VERSION)
  assert.ok(!JSON.stringify(f.calls).includes(deviceToken))
})
test('reports are bounded structured private submissions, and admin actions cannot be invoked',async() => {
  const f=fixture()
  assert.equal((await f.request(online({action:'report',alias:'OTHER',reason:'arbitrary'}))).status,400)
  const response=await f.request(online({action:'report',alias:'other',reason:'Offensive alias'}))
  assert.equal(response.status,200)
  assert.equal(f.calls[0].name,'carematch_report_alias')
  assert.equal(f.calls[0].args.p_alias,'OTHER')
  assert.equal(f.calls[0].args.p_reporter_hash,await digest(deviceToken))
  assert.equal((await f.request(online({action:'moderate',alias:'OTHER'}))).status,400)
})
test('deletion authenticates with installation secret and needs no renewed terms',async() => {
  const f=fixture()
  assert.equal((await f.request({action:'delete',deviceToken:'bad'})).status,400)
  assert.equal((await f.request({action:'delete',deviceToken,alias:'OTHER'})).status,200)
  assert.deepEqual(f.calls[0],{name:'carematch_delete_device',args:{p_player_hash:await digest(deviceToken)}})
})
test('block filtering is bounded and normalized before server-side ranking',async() => {
  const f=fixture()
  assert.equal((await f.request({action:'rankings',excluded:Array(201).fill('JOEY')})).status,400)
  assert.equal((await f.request({action:'rankings',excluded:['joey']})).status,200)
  assert.deepEqual(f.calls[0].args,{p_excluded:['JOEY']})
})
test('device identity persists, deletion clears only game storage, and blocked lists survive restart', () => {
  const map=new Map([['unrelated','keep']]);const storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)}
  const token=getDeviceToken(storage);assert.match(token,/^[a-f0-9]{64}$/);assert.equal(getDeviceToken(storage),token)
  storage.setItem('carematch:blocked:v1','["JOEY"]');assert.deepEqual(loadBlocks(storage),['JOEY'])
  clearPlayerStorage(storage);assert.equal(storage.getItem(DEVICE_KEY),undefined);assert.equal(storage.getItem('unrelated'),'keep');assert.notEqual(getDeviceToken(storage),token)
  assert.throws(()=>getDeviceToken({getItem:()=>null,setItem:()=>{}}),/storage/)
})
