import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runRaidLoad} from '../scripts/raid-load.mjs';
test('load runner rejects invalid bounds before starting a fixture',async()=>{
 for(const options of [{players:0},{seconds:NaN},{seconds:Infinity},{latencyMs:NaN},{loss:NaN},{seed:-1},{seed:1.1},{profile:'unknown'}])await assert.rejects(runRaidLoad(options),/Invalid load parameters/);
});
test('raid workload starts through real account, trader, owned-loadout and authenticated action APIs',async()=>{
 const report=await runRaidLoad({players:3,seconds:1,profile:'raid'});assert.equal(report.profile,'raid');assert.equal(report.baseActions.accept,3);assert.ok(report.baseActions.buy>=1);assert.ok(report.completedActions>=3,JSON.stringify({accepted:report.accepted,completed:report.completedActions,failed:report.failedActions,clients:report.checks.allClientsCompleted,elapsed:report.elapsedSeconds}));assert.equal(report.completedActions,Object.values(report.accepted).reduce((sum,n)=>sum+n,0));assert.equal(report.failedActions,0);assert.ok(report.navigation.length>=3);assert.ok(report.source.files.some(file=>file.path==='scripts/lib/raid-pilot.mjs'));for(const secret of ['load_agent_','raid_session','disposable load fixture password','deploymentId','accountId'])assert.ok(!JSON.stringify(report).includes(secret));
 assert.equal(report.economy.initial.credits,750);assert.equal(report.economy.initial.starterCredits,750);assert.equal(report.economy.initial.earnedCredits,0);assert.equal(report.economy.totals.paidDeployments,3);assert.equal(report.economy.activeAtEnd,3);assert.ok(report.economy.flows.trade_buy.spending>0);assert.ok(report.economy.flows.deployment.spending>0);assert.ok(report.economy.checks.allObservedBalancesConserved);assert.ok(report.source.files.some(file=>file.path==='scripts/lib/raid-economy-observer.mjs'));
});
test('isolated file-backed HTTP load completes with private aggregate results',async()=>{
 const report=await runRaidLoad({players:3,seconds:1});assert.ok(report.completedActions>=3);assert.ok(report.completedActions<=24,'150 ms movement pacing must not burst requests near the deadline');assert.equal(report.failedActions,0);assert.equal(report.checks.allClientsCompleted,true);assert.equal(report.checks.noSimulationErrors,true);assert.equal(report.server.activeOperators,3);assert.ok(report.server.tickInterval.count>0);assert.ok(report.server.memory.rss>0);
 assert.match(report.source.sha256,/^[a-f0-9]{64}$/);assert.ok(report.source.files.some(file=>file.path==='server/raids.mjs'));assert.ok(report.source.files.every(file=>!file.path.startsWith('/')&&/^[a-f0-9]{64}$/.test(file.sha256)));
 for(const secret of ['load_agent_','raid_session','disposable load fixture password','deploymentId','accountId'])assert.ok(!JSON.stringify(report).includes(secret));
 // Timing budgets are enforced only in dedicated measurements, not under parallel unit-test load.
});
