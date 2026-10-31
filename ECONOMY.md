# Raid economy and starter support

Raid credits, items, contracts and upgrades belong to the authoritative account. They are separate from the legacy device-local diamond wallet, classes, pets and cosmetics. There is no purchase or currency-conversion endpoint. Normal earned loot can be transferred through the raid's owned-item pickup rules.

## New accounts and recovery

A new account receives 250 starter credits, a starter rifle, armor and two medical supplies. The displayed credit total includes the remaining starter balance; the base shows starter and earned credits separately. Starter supplies belong to their original operator. That operator can deploy, use, lose, insure, extract, sell and recycle them under ordinary capacity/risk rules. Another operator cannot pick them up or bank them. The stash, shop and item inspection identify these supplies before a decision.

This closes the instant fresh-account donation path: registration, a starter-funded purchase and a drop cannot create ordinary bankable gear for another account. There is no replenishment/reset endpoint for the allowance. It is not a protection against every form of alternate-account play.

A player with no credits or equipment can always choose the free recovery rifle/medical kit. It has eight backpack slots, one protected slot and a 22 kg limit, compared with 18/two/40 kg for ordinary paid deployments. Recovery equipment cannot be banked, sold, recycled or insured. It cannot be mixed with paid bring-in equipment. Actual recovered loot and earned rewards still belong to the recovering operator. A recovery extraction does not replenish the starter allowance.

## How value keeps its source

Earned credits pay first. A purchase paid partly or entirely with starter credits becomes a starter supply. Selling starter supplies returns starter credits; bulk selling separates those proceeds internally. Selling earned equipment returns earned credits. The UI gives the credit type in the sale quote.

Splitting preserves the supply's owner. Starter and ordinary stacks cannot merge. Recycling preserves starter status in the resulting salvage, including partial ammunition batches and their leftovers. Existing salvage cannot be transmuted through recycling. INVENTORY.md specifies batch sizes, yields and limits.

Crafting consumes earned materials first. If it needs starter materials or starter credits, its output is a starter supply. Repairing with starter resources binds the repaired equipment, and its button states this before use. Installing a starter attachment binds the weapon; installing it on an ordinary weapon asks for confirmation. Detaching the attachment does not remove that binding. Earned components and credits leave ordinary equipment transferable.

Starter ammunition can reload an ordinary weapon without binding the weapon itself. Remaining starter-funded rounds retain their source through shots, saves and restarts. If another operator takes that weapon, the service removes those starter rounds while preserving the weapon and its remaining earned ammunition. The transfer audit records the removed quantity. The original operator can extract and retain their own starter ammunition. Recovery rounds keep the separate existing end-of-raid removal rule; firing never charges two source categories for one shot.

Delivery contracts require earned salvage. Buying starter steel and delivering it cannot turn the allowance into an ordinary contract payout. Exploration, combat and recovered-artifact objectives still reward actual server-backed raid activity. Contract stages can be claimed only once. Base upgrades remain personal and can consume starter support; they do not grant equipment to another account.

Insurance premiums retain their earned/starter proportions. An aborted deployment refunds those exact portions once. A normal death or disconnect has the documented equipment/claim policy rather than an aborted-raid refund. The service records canonical ownership and audited settlement; no browser endpoint accepts a valuable reward claim.

Current base controls send the displayed inventory revision. If another tab spends the earned balance before a quoted purchase, the service rejects the stale request and the client refreshes it; the purchase cannot silently become starter-funded. Split/merge requests always require a revision. Internal/older API callers without an optional ordinary-trade revision still receive current authoritative ownership and credit rules.

## Current rewards, costs and limits

Successful extraction grants 20 earned credits and 20 XP before activity bonuses. Activity adds up to 50 XP from machine kills (five each) and distinct explored sites (three each). Death/timeout/disconnect do not grant the extraction payment; qualifying server-backed activity and existing contract rules still apply. Empty-handed escape is valid.

Three traders have account-specific hourly stock, capped reputation and discounts up to 20 percent. Buying and crafting improve the appropriate reputation; contracts award reputation and unlock choices. Weapon/armor/ammo/medicine purchases, consumables, access costs, repairs, crafting fees, insurance and base upgrades are sinks. Recipe, item, contract and trader definitions are in shared/raid-catalog.mjs; current armor/medical rules are in COMBAT.md. These numbers are current tuning, not proof of a balanced long-term economy.

## Save compatibility and evidence

Schema 11 and protocol 8 fence binaries/clients that do not understand starter provenance. Migration does not rewrite existing equipment, credits, sessions or active checkpoints. Pre-update accounts keep their existing ordinary balance and items and receive no new allowance. Fresh registrations use the new policy. This is not a save wipe or a retroactive confiscation. Backups support schemas 3–12.

`tests/raid-grants.test.mjs` covers repeated fresh accounts, owner-only recovery, ordinary transfers, split/recycle/sell/craft/repair/attachment provenance, earned-only delivery, exact refunds, loaded ammunition, restart/migration, stale quotes and failed-write rollback. Transfer/insurance/backup tests arrange earned purchases when they need ordinary equipment; they no longer treat free starter gear as ordinary loot. `tests/raid-browser-grants.mjs` checks two actual account/shop/stash/raid interfaces, including a rejected direct pickup bypass and a successfully banked ordinary weapon. Credit funding and meeting/departure positions are arranged fixtures, not human economy or route acceptance.

`scripts/economy-audit.mjs` audits buy/craft/sell and recycle/resale paths, merging and all legal binary stack splits. Reproduced prior exploits and exact source fingerprints are retained in tests/evidence. Still required: quantitative repeat-raid loot/reward/sink modeling, progression speed, insurance/recovery strategies, realistic player behavior and human balance acceptance. RELEASE_ACCEPTANCE.md preserves those requirements and the complete release scope.

## Quantitative analysis and observed flows

ECONOMY_MODEL.md documents the reproducible sensitivity model, actual service upgrade/repair/insurance quotes, trader stock constraints, protected-pool ceilings and a source-fingerprinted fifteen-minute mixed-strategy cohort. The load runner now reports starter/earned wallet flows separately and excludes returned bring-in equipment from new-loot counts. These measurements do not establish human survival, total account wealth or indefinitely recurring income. Targeted protected-rush/insurance-delay strategies and longer progression/balance acceptance remain open.
