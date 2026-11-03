import {test} from 'node:test';
import assert from 'node:assert/strict';
import {auditEconomy} from '../scripts/economy-audit.mjs';
test('maximum reputation discounts and crafting cannot create a profitable resale loop',()=>{
 const audit=auditEconomy();assert.ok(audit.trades.length>=10);assert.ok(audit.recipes.length>=8);assert.deepEqual(audit.profitableLoops,[]);
});
