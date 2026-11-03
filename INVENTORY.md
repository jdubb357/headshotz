# Inventory transfers and quantities

The persistent raid service owns every item and quantity. These rules apply to the online raid entry, not the separate legacy modes. Item identifiers are created by the service; a browser cannot supply new equipment or a new stack identifier.

## Stash

Split stack opens a quantity dialog. Choose a whole number from one through the current quantity minus one. A split needs a free stash slot and creates a new item with lineage back to the original stack. Merge stack combines compatible stacks only when the complete result fits the stack limit. Both operations preserve quantity and favorites. Medical type, ammunition/material/utility type, condition, recovery status and starter-supply owner must agree.

Stash operations require the displayed inventory revision. A stale tab or a repeated request cannot split the newer inventory again. Current controls also bind ordinary trade quotes to the displayed revision, preventing a changed balance from silently changing starter funding. Refresh the inventory after a stale-revision error. Active deployments cannot edit the escrowed loadout through these controls.

Sale buttons display the service's current quote. Ammunition is valued at one credit per ten rounds, rounded down per stack; a stack smaller than ten rounds has a zero-credit quote. Splitting and selling fragments cannot increase the original sale value. Merging fragments can recover rounding loss, within the ordinary stack limit. No currency is granted by splitting or merging.

## Recycling

Recycle displays the salvage yield before use. Ammunition produces one steel per complete manufacturing batch: 40 light rounds, 30 medium rounds, 10 heavy rounds or 12 shells. Leftover rounds keep their original item identifier in the stash. For example, recycling 65 medium rounds consumes 60, creates two steel, and keeps the five remaining rounds. A partial batch cannot be recycled. Merge compatible fragments to reach a batch; splitting never increases salvage.

Medical stacks yield one chemical per item and utility stacks one steel per item. Weapons/armor yield three steel; attachments yield one wire. Other eligible single items yield one steel. Attached equipment is consumed with its parent, so detach wanted attachments first. Existing salvage is used directly by crafting, upgrades and repairs; it cannot be recycled into another material. Favorite, recovery and reserved-contract guards remain in force.

A complete conversion can replace its original stash slot. If leftovers remain, the new salvage requires another free slot. An unsuccessful conversion leaves the original item, quantities, credits, revision and audit unchanged. Successful conversion records the input, output, consumed quantity and remainder atomically. The recycling patch did not itself change the action protocol; the service validates these rules even if an older cached client displays a stale recycling control.

## During a raid

Searching is a single sustained interaction. Stay still within three metres with clear access for 2.4 seconds. Starting another search releases the first claim; revival and boarding cannot overlap it. Movement, damage, downing, elimination or another gameplay action cancels the search, immediately allowing another operator to claim it. Looking and squad pings do not cancel it. Repeated requests preserve the active timer, and retries cannot replace a newer interaction. Vault unlock costs stay consumed when the following search is interrupted; failed writes roll the unlock and payment back together. RAID_RULES.md documents the shared interaction rules.

- Take transfers a whole stack. Take amount lets you choose a positive whole quantity up to the available quantity. Partial pickup leaves the remainder in the original container and creates a child stack in your backpack.
- A pickup needs a free backpack slot, sufficient weight allowance, and a reachable opened container or bag within three metres with a clear path. The service charges only the requested portion's weight. Make room or merge compatible backpack stacks before taking another item; pickup does not automatically fill an existing stack.
- Split stack can divide carried equipment, backpack or protected stacks into a free backpack slot. The child is in the backpack and is exposed to loss even if its parent remains protected.
- Move to backpack withdraws an entire protected item into a free backpack slot. Protection ends for that item immediately. Withdraw it before dropping it; ordinary use/treatment and loss rules then apply.
- Drop places equipment or backpack items in a bag at the operator's actual position. Remove worn armor first, following the armor change rules in COMBAT.md. A dropped weapon retains its identity and ammunition. Dropping the active weapon selects another carried weapon when available; otherwise the operator becomes unarmed. Picking up a weapon allows it to be equipped again.
- Merge stack combines compatible backpack stacks within their maximum quantity. It does not pull items from another container or the protected pocket.

Contested pickups settle through the same durable transaction as ownership and audit records. An accepted action retry returns its receipt instead of transferring the quantity again. Failed checkpoint writes roll back both the transfer and its audit record. Another operator claiming an insured item prevents its original owner from also recovering it through insurance.

The quantity dialog supports keyboard submission, Escape and Cancel. Opening it clears held movement and voice transmission; closing it restores the previous inventory control when it still exists. Leaving an account or deployment invalidates a pending quantity selection.

## Compatibility and verification

Schema 10 and protocol 7 introduce the quantity/transfer behavior and explicit unarmed persistence. Migration from schema 9 advances the schema marker without rewriting existing equipment. Older binaries reject newer save schemas. Old checkpoint records without an explicit weapon selection keep their legacy inference; an explicitly unarmed operator remains unarmed on restart.

`tests/raid-transfers.test.mjs` covers owned quantities, contested partial pickup, capacity/weight rejection, protected withdrawal, stack compatibility, rollback, revision checks, insurance and file-backed unarmed restart/re-equipping/settlement. `tests/raid-browser-transfers.mjs` exercises the actual controls, keyboard dialog/focus, quoted sales, partial pickup and first/third-person weapon visibility using two isolated accounts. Its loot and observer positions are arranged fixtures, not human route or WAN acceptance.

`tests/raid-recycling.test.mjs` covers the prior single-round conversion exploit, batch leftovers, full-stash and audit failure rollback, complete-stack yields and salvage type restrictions. `tests/raid-browser-recycling.mjs` exercises purchased/merged ammo, displayed yield/remainder, rejected direct bypasses, favorites and medical/material controls.

`scripts/economy-audit.mjs` checks all legal binary splits of catalog stacks alongside static trader/recipe exchanges and buy/craft/recycle/sell paths, including merging purchased stacks to reach a recycling batch. The former minimum-per-item recycling rule allowed a 12-credit medium-ammo purchase to become 60 credits after splitting; the current batch rule removes that loop. The audit does not establish long-term progression balance or resistance to every account-farming strategy. Human contested looting, inventory comprehension, physical devices and full release acceptance remain in RELEASE_ACCEPTANCE.md.

ECONOMY.md documents the subsequent schema-11/protocol-8 boundary: starter supplies and proceeds keep their original owner, ordinary loot remains transferable, and loaded starter rounds cannot be passed inside an ordinary weapon. Existing items are not retroactively bound.

LOADOUTS.md records the equipment-bench preparation rules: stash ordering/filtering does not change the selected primary, presets preserve ordered item identity, inspection/preview use actual selected gear, and a mismatched readied loadout must be reconciled before deployment. Presets select equipment without buying replacements or insurance.
