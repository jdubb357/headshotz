import assert from 'node:assert/strict';
import {browserHarness} from './browser-harness.mjs';
const browser=await browserHarness();
try{
 const page=await browser.page('/?q=low&noassets&nohum');
 await page.wait("!!window.__hsz?.raid && !!document.querySelector('meta[name=headshotz-raid-service]')");
 await page.evaluate("document.getElementById('raidBtn').click()");
 await page.wait("location.pathname==='/raid-online.html' && !!document.getElementById('login')");
 assert.deepEqual(page.errors,[]);
 const deep=await browser.page('/?raid=1&q=low&noassets&nohum');await deep.wait("location.pathname==='/raid-online.html' && !!document.getElementById('login')");assert.deepEqual(deep.errors,[]);
 const saved=await browser.page('/?q=low&noassets&nohum');await saved.wait("!!window.__hsz?.raid && !!document.querySelector('meta[name=headshotz-raid-service]')");await saved.evaluate("sessionStorage.setItem('hsz_raidOpen','1')");await saved.command('Page.reload');await saved.wait("location.pathname==='/raid-online.html' && !!document.getElementById('login')");assert.equal(await saved.evaluate("sessionStorage.getItem('hsz_raidOpen')"),null);assert.deepEqual(saved.errors,[]);
 const local=await browser.page('/?q=low&noassets&nohum');await local.wait("!!window.__hsz?.raid && !!document.querySelector('meta[name=headshotz-raid-service]')");await local.evaluate("document.querySelector('meta[name=headshotz-raid-service]').remove();document.getElementById('raidBtn').click()");await local.wait("location.pathname==='/raid-online.html' && location.search.includes('offline=1')");await local.wait("document.body.dataset.raidTransport==='offline'");assert.deepEqual(local.errors,[]);
 const classic=await browser.page('/?q=low&noassets&nohum');await classic.wait("!!window.__hsz?.raid && !!document.querySelector('meta[name=headshotz-raid-service]')");await classic.evaluate("document.querySelector('meta[name=headshotz-raid-service]').remove();document.getElementById('raidLegacyBtn').classList.remove('hidden');document.getElementById('raidLegacyBtn').click()");await classic.wait("!document.getElementById('raid').classList.contains('hidden')");assert.equal(await classic.evaluate('location.pathname'),'/');assert.deepEqual(classic.errors,[]);
 console.log(JSON.stringify({mainGameEntry:true,persistentRaidNavigation:true,savedQueryEntry:true,savedSessionEntry:true,staticDeployOffline:true,classicExtractionPreserved:true,browserErrors:[],scope:'Static fallback is simulated by removing the server marker; DEPLOY must boot the offline raid client and the secondary control must keep the old co-op raid base.'}));
}finally{await browser.close()}
