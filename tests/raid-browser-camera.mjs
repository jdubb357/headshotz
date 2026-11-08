import assert from 'node:assert/strict';
import {once} from 'node:events';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {browserHarness} from './browser-harness.mjs';

// The third-person boom must shorten before it enters authored geometry; a
// chase camera that ignores world collision clips through walls behind roofs.
const store=new RaidStore(),runtime=createRaidServer(store),prior=process.env.RAID_TEST_URL;
runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');
process.env.RAID_TEST_URL='http://127.0.0.1:'+runtime.server.address().port;
const h=await browserHarness();
try{
 const p=await h.page();await p.wait("document.getElementById('message')?.textContent.includes('Sign in')");
 const result=await p.evaluate(`(async()=>{
  const {RaidView}=await import('./raid-view.mjs'),{getWorld}=await import('./shared/raid-worlds.mjs'),THREE=await import('./lib/three.module.min.js');
  document.querySelector('main').hidden=true;const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%';document.body.append(canvas);
  const view=new RaidView(canvas),base=getWorld('relay',10);
  view.world={...base,terrain:null,blocks:[],ramps:[]};
  const eye=new THREE.Vector3(0,1.6,-3),desired=new THREE.Vector3(0,1.6,3),open=view.clearChase(eye,desired);
  view.world={...base,terrain:null,blocks:[[0,0,4,1,4]],ramps:[]};
  const walled=view.clearChase(eye,desired);
  const blockedAt=z=>view.world.blocks.some(([bx,bz,w,d,h])=>Math.abs(0-bx)<w/2&&Math.abs(z-bz)<d/2&&1.6+0.32>0.04&&1.6<h-0.04);
  view.renderer.dispose();await view.audio.context?.close();
  return {openDistance:open.distanceTo(desired),walledZ:walled.z,walledDistance:eye.distanceTo(walled),lineHasWall:blockedAt(0),walledOpens:walled.z>desired.z?false:true};
 })()`);
 assert.ok(result.openDistance<.01,'empty terrain must not shorten the boom');
 assert.equal(result.lineHasWall,true);
 assert.ok(result.walledZ<-.5,'chase boom must stop before the authored wall');
 assert.ok(result.walledDistance>1,'chase boom must keep some separation from the operator');
 assert.deepEqual(p.errors,[]);
 console.log(JSON.stringify({chaseAvoidsWalls:true,openBoomFullLength:true,shortenedZ:result.walledZ,browserErrors:p.errors,scope:'Synthetic terrain-free block fixture through RaidView.clearChase; authored 1,440 m sectors and real deployments are covered by the smoke/worlds graders.'}));
}finally{await h.close();runtime.server.close();await once(runtime.server,'close');store.close();if(prior===undefined)delete process.env.RAID_TEST_URL;else process.env.RAID_TEST_URL=prior}
