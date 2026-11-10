import test from 'node:test';
import assert from 'node:assert/strict';
import {LOOT_TIERS,lootPresentation,lootCelebrationText} from '../shared/raid-loot-presentation.mjs';
import {ACTION_CUES} from '../raid-audio.mjs';

test('rarity tiers and their presentation are deterministic', () => {
 const common=lootPresentation({rarity:0}),uncommon=lootPresentation({rarity:1}),rare=lootPresentation({rarity:2}),epic=lootPresentation({rarity:3}),legendary=lootPresentation({rarity:4}),special=lootPresentation({rarity:5});
 assert.deepEqual([common.tier,uncommon.tier,rare.tier,epic.tier,legendary.tier,special.tier],LOOT_TIERS);
 assert.deepEqual(common.celebrate,false,'common pickups stay a plain recovered line');
 assert.deepEqual(uncommon.celebrate,false,'uncommon pickups stay a plain recovered line');
 for(const tier of [rare,epic,legendary,special])assert.equal(tier.celebrate,true,tier.tier+' should celebrate');
 assert.equal(new Set([rare.accent,epic.accent,legendary.accent,special.accent]).size,4,'celebrated tiers have distinct accents');
});

test('celebrated pickups use a richer cue that the audio engine knows', () => {
 for(const rarity of [2,3,4,5]){
  const presentation=lootPresentation({rarity});
  assert.ok(ACTION_CUES[presentation.cue],presentation.cue+' has a synthesized action cue');
 }
 assert.equal(lootPresentation({rarity:0}).cue,'take');
 assert.equal(lootPresentation({rarity:1}).cue,'take');
});

test('rarity input is clamped and missing values are common', () => {
 for(const value of [undefined,null,NaN,Infinity,-1,99,2.9,'4']){
  const presentation=lootPresentation({rarity:value});
  assert.ok(LOOT_TIERS.includes(presentation.tier),String(value)+' maps to a known tier');
  assert.ok(presentation.rarity>=0&&presentation.rarity<=5);
 }
 assert.equal(lootPresentation({}).tier,'common');
});

test('pickup narration names the item and its rarity', () => {
 assert.equal(lootCelebrationText({rarity:0},'Field Vest'),'Common item recovered: Field Vest.');
 assert.equal(lootCelebrationText({rarity:1},'Compact SMG'),'Uncommon item recovered: Compact SMG.');
 assert.equal(lootCelebrationText({rarity:2},'Scout Rifle'),'Rare haul: Scout Rifle recovered.');
 assert.equal(lootCelebrationText({rarity:3},'Bulwark Rig'),'Epic haul: Bulwark Rig recovered.');
 assert.equal(lootCelebrationText({rarity:4},'Foundry Artifact'),'Legendary haul: Foundry Artifact recovered.');
});
