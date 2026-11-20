import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sellValue} from '../shared/raid-appraisal.mjs';
import {WEAPONS,MODS,MEDICAL,UTILITIES,armorStats} from '../shared/raid-catalog.mjs';
import {ARTIFACTS} from '../shared/raid-sectors.mjs';
import {item} from '../server/rules.mjs';
import {RaidStore} from '../server/store.mjs';

// The base sale value shown in the field must equal what the store pays out.
// These expectations encode the pre-existing store arithmetic across every item
// kind so a client-only price can never drift from the authoritative economy.
test('shared sellValue matches the store economy for every item kind',()=>{
 const cases=[
  ['weapon',item('weapon',{weapon:'sniper'}),Math.floor(WEAPONS.sniper.price*.3)],
  ['weapon default',item('weapon',{weapon:'unknown'}),Math.floor(100*.3)],
  ['armor',item('armor',{armor:'heavy'}),Math.floor(armorStats({armor:'heavy'}).price*.3)],
  ['med stack',item('med',{medical:'trauma',quantity:3}),Math.floor(MEDICAL.trauma.price*.2)*3],
  ['med default',item('med',{quantity:2}),Math.floor(25*.2)*2],
  ['mod',item('mod',{mod:'suppressor'}),Math.floor(MODS.suppressor.price*.3)],
  ['utility stack',item('utility',{utility:'smoke',quantity:2}),Math.floor(UTILITIES.smoke.price*.3)*2],
  ['utility default',item('utility',{utility:'unknown'}),0],
  ['valuable',item('valuable',{value:17}),17],
  ['valuable default',item('valuable'),1],
  ['contract artifact',item('contract',{artifact:'freight_manifest'}),ARTIFACTS.freight_manifest.value],
  ['contract unknown',item('contract',{artifact:'missing'}),0],
  ['ammo stack',item('ammo',{quantity:40}),Math.floor(40*.1)],
  ['ammo default',item('ammo'),Math.floor(1*.1)],
  ['material stack',item('material',{material:'steel',quantity:5}),Math.max(1,Math.floor(5*2))],
  ['other kind',item('other',{quantity:3}),Math.max(1,Math.floor(3*5))],
 ];
 for(const [name,it,expected] of cases){
  assert.equal(sellValue(it),expected,`sellValue ${name}`);
  assert.equal(new RaidStore().value(it),expected,`store.value ${name}`);
 }
});

test('store sale of an owned item pays exactly the published sale value',t=>{
 const store=new RaidStore();t.after(()=>store.close());
 const account=store.register('appraisal','a long appraisal password');
 const weapon=store.profile(account.id).items.find(it=>it.kind==='weapon'),expected=sellValue(weapon),before=store.profile(account.id).credits;
 assert.equal(store.value(weapon),expected);
 store.trade(account.id,{type:'sell',itemId:weapon.id,confirmFavorite:true});
 assert.equal(store.profile(account.id).credits,before+expected);
});
