import test from 'node:test';
import assert from 'node:assert/strict';
import {quoteRaidEconomy,strategyProjection,protectedPoolBounds,quoteBaseUpgrades} from '../scripts/economy-model.mjs';
test('economic quotes come from actual shop, ammo wear, armor damage, premiums and settlement',()=>{
 const q=quoteRaidEconomy();assert.equal(q.prices.weapon,100);assert.equal(q.prices.armor,70);assert.equal(q.prices.ammoPack,12);assert.equal(q.prices.medkit,25);assert.equal(q.premium,34);assert.equal(q.reward,20);assert.equal(q.outcomes.extract.conditions.weapon,95.6);assert.equal(q.outcomes.death.conditions.weapon,92.6);assert.equal(q.outcomes.extract.conditions.armor,66.666667);assert.equal(q.outcomes.extract.repairCredits,25);assert.equal(q.outcomes.extract.repairSteel,2);assert.equal(q.paidCapacity.protected,2);assert.equal(q.recoveryCapacity.protected,1);
});
test('a free empty escape has no imputed loot and paid break-even depends on real replacement costs',()=>{
 const quote=quoteRaidEconomy(),empty=strategyProjection({quote,survival:.5,strategy:'free_empty'}),paid=strategyProjection({quote,survival:.5,lootValue:80,strategy:'paid'});assert.equal(empty.expectedIncome,10);assert.equal(empty.expectedCost,0);assert.equal(empty.lootPerExtract,0);assert.equal(empty.expectedNetPerHour,300);assert.equal(paid.expectedCost,140.5);assert.equal(paid.expectedIncome,60);assert.equal(paid.breakEvenLootPerExtract,241);const threshold=strategyProjection({quote,survival:.5,lootValue:paid.breakEvenLootPerExtract,strategy:'paid'});assert.equal(threshold.expectedNet,0);
});
test('discounts and station upgrades change costs while canonical insurance premium remains unchanged',()=>{
 const ordinary=quoteRaidEconomy(),upgraded=quoteRaidEconomy({reputation:20,bay:2});assert.equal(upgraded.prices.weapon,80);assert.equal(upgraded.prices.armor,56);assert.equal(upgraded.premium,ordinary.premium);assert.ok(upgraded.outcomes.extract.repairCredits<ordinary.outcomes.extract.repairCredits);const base={survival:.5,lootValue:160,strategy:'paid'};assert.ok(strategyProjection({...base,quote:upgraded}).expectedCost<strategyProjection({...base,quote:ordinary}).expectedCost);
});
test('insurance claim likelihood and salvage valuation are explicit sensitivities, not guaranteed refunds',()=>{
 const quote=quoteRaidEconomy(),base={quote,survival:.5,lootValue:80,strategy:'insured'},none=strategyProjection({...base,unclaimed:0}),all=strategyProjection({...base,unclaimed:1});assert.ok(all.expectedCost<none.expectedCost);assert.equal(none.insuranceFavorableBelowSurvival,null);assert.ok(strategyProjection({...base,materialBasis:'resale'}).expectedCost<strategyProjection(base).expectedCost);assert.equal(strategyProjection({...base,survival:0}).breakEvenLootPerExtract,null);assert.throws(()=>strategyProjection({...base,survival:2}),/Invalid/);
});
test('a projected strategy cannot silently assume unlimited stock or immediate replacement supplies',()=>{
 const quote=quoteRaidEconomy(),base={quote,lootValue:240,strategy:'paid'};const fragile=strategyProjection({...base,survival:.5}),safer=strategyProjection({...base,survival:.75});assert.equal(fragile.expectedPurchasesPerHour.weapons,6);assert.equal(fragile.hourlyStock.weapons,4);assert.equal(fragile.stockFitsExpectedPurchases,false);assert.equal(safer.stockFitsExpectedPurchases,true);assert.equal(strategyProjection({...base,survival:.5,strategy:'free_scavenge'}).stockFitsExpectedPurchases,true);
});
test('protected pool sampling is deterministic and identifies capacity bounds without claiming traversability',()=>{
 const a=protectedPoolBounds({samples:4}),b=protectedPoolBounds({samples:4});assert.deepEqual(a,b);assert.equal(a.length,3);for(const pool of a){assert.ok(pool.oneProtectedSlot.max>0);assert.ok(pool.twoProtectedSlots.max>=pool.oneProtectedSlot.max)}assert.throws(()=>protectedPoolBounds({samples:0}),/Invalid/);
});
test('station budgets use actual upgrade transactions and preserve recipe/capacity gates',()=>{
 const base=quoteBaseUpgrades(),discounted=quoteBaseUpgrades({reputation:20});assert.equal(base.rows.length,7);assert.deepEqual(base.rows.filter(r=>r.upgrade==='stash').map(r=>r.stashSlots),[28,36,44]);const first=base.rows.find(r=>r.upgrade==='bay'&&r.to===1);assert.equal(first.credits,100);assert.equal(first.steel,2);assert.equal(first.wire,1);assert.equal(first.marketBudget,118);assert.equal(discounted.rows.find(r=>r.upgrade==='bay'&&r.to===1).marketBudget,115);assert.ok(base.rows.find(r=>r.upgrade==='bench'&&r.to===2).availableRecipes>base.rows.find(r=>r.upgrade==='bench'&&r.to===1).availableRecipes);
});
