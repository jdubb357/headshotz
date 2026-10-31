# Extraction and equipment-risk rules

These rules describe the persistent authoritative raid service. Legacy cooperative Extraction and the static PeerJS raid path are separate modes. Raid credits/equipment remain separate from the device-local diamond wallet and ordinary-mode progression.

## Searches and sustained interactions

An operator can search one container, revive one squadmate or board one exit at a time. Starting a different interaction releases the old claim or seat reservation. Searching takes 2.4 seconds. Starting it stops the operator's previous movement; continued movement input cancels it. Intentional movement, damage, elimination, firing, jumping, using equipment or another gameplay action interrupts the current search/revival/boarding. Looking around, zero-direction movement keepalives and squad pings preserve it. A rejected action or failed database write does not discard the existing interaction.

Searches also require a living, standing operator within three metres with clear physical access. Downed or invalid historical claims cannot open containers. An interrupted claim becomes immediately available to another operator. Repeating the same active search does not reset its timer; retrying a previously acknowledged request does not take over a newer interaction. Unlocking a vault consumes its key immediately; interrupting the subsequent search does not refund the key or lock the vault again. Opened containers remain open and competing pickups still resolve by canonical item ownership.

## Squad rescue

A standing operator can revive or pick up a living downed squadmate within 2 metres of three-dimensional distance, with clear physical access to the downed body. Solid walls, roofs and ramps block that access; smoke does not. A player cannot start rescue after the patient's bleed deadline. Revival takes five seconds and requires continued range/access. Damage to either operator cancels it immediately, including damage within the same simulation timestamp. A delayed tick cannot revive an already expired patient. Successful revival restores 30 health.

One operator can carry one downed squadmate. A carrier can always put down their own passenger without another pickup reach check. Downing, eliminating or disconnect-settling the carrier releases that link; recovering the carrier cannot teleport the former passenger back. Checkpoint restoration preserves valid reciprocal links and replaying a pickup does not toggle it into a drop. Stale or inconsistent links are detached before movement. The backpack shows named rescue controls with server-derived availability, explains blocked access and preserves keyboard focus when Carry changes to Drop. A carried pair needs two extraction seats and receives two separate settlements under the exit rules below.

## Extraction sites

New raids have these four routes on each authored map:

| Route | Access and schedule | Capacity and limits | Boarding |
| --- | --- | --- | --- |
| West evacuation beacon | Free call-in; arrives 35 seconds after calling and stays 30 seconds | Three people per arrival; at most two calls per raid | 2.2 seconds |
| South cargo lift | Opens three minutes after the raid starts; departs at four minutes | Six people total; one scheduled departure | 2.2 seconds |
| North maintenance hatch | One owned access key opens it for 45 seconds | One person per opening; at most two openings | 2.2 seconds |
| Emergency freight winch | Two owned fuel open it for 40 seconds | Two people total; one opening | 3 seconds |

Access keys/fuel can be brought in an owned loadout or found during the raid. Free recovery kits cannot include extra paid equipment or materials. Fuel must exist as actual carried material items, not as workshop material balances or another browser's stash. Costs can be drawn from carried equipment, backpack or protected pocket; payment is an explicit use of those items. The interface lists access costs and capacity before deployment and again in the backpack.

Access costs are consumed when a route is opened. They are not refunded if it expires, another player uses the seats, boarding is interrupted, or the payer dies. Whoever pays does not own the departure: rival squads can use available seats. Calling transport produces an audible machine-investigation signal and a raid announcement. The timer, payment, use count and seat state are server-owned and durable.

The server reserves seats when boarding starts. A standing operator needs one seat; carrying a living downed squadmate needs two. Both must be in the reachable boarding area. If there are too few seats, neither boards. Downed operators cannot independently start boarding. A carried teammate receives a separate settlement with the same departure route.

Stay still within four metres with a clear path to the site until boarding finishes. Movement, another gameplay action, damage to the carrier **or passenger**, downing, final death, leaving/losing line of sight, putting down/changing a passenger, a closed exit or a different departure cancels the reservation. Reserved seats become available again. Repeated boarding requests do not reset the same boarding timer. Only successful boarding consumes seats; the consumed seats remain unavailable for that wave even after the player leaves the screen.

Completing extraction ends only those passengers' raids. Rival players and squadmates left behind remain vulnerable and can use another exit. Multiple opposing squads can succeed independently; empty-handed extraction is valid. There are no combat respawns or reinforcement lives in the persistent raid service.

A subsequent deployment must enter a different raid. Neither death nor successful extraction permits returning with a fresh loadout to a raid already entered. Party matchmaking checks every member's prior participation, so changing leaders or joining another squad cannot bypass that rule. Reconnect resumes the existing deployment/body; restoring historical checkpoints selects the account's durable current/latest deployment rather than whichever body happens to be visited last.

Open, scheduled/inbound, full, exhausted and departed states are written in the backpack. Counts distinguish available seats and current boarders. World/minimap indicators change with status. A contested label appears only when a visible rival is near the site; it does not disclose hidden rival identities or positions. Seat availability itself is shared departure information.

Existing checkpoints keep their saved exits and policies. A pre-policy checkpoint is not retroactively given a fuel route, seat caps or limited activations. New rules and reservations survive checkpoint/restart, and failed durable writes roll back payments, reservations, seat consumption and settlement together. Same-payload action retries cannot charge or extract twice. An ordinary disconnect does not cancel risk or restore access costs.

## Equipment outcome

INVENTORY.md describes stash/carried stack splitting and merging, partial pickup, protected-pocket withdrawal, equipped-item drops and unarmed persistence. These actions preserve service-owned quantities and share the normal durable ownership, receipt and audit rules.

ECONOMY.md describes the starter allowance for new registrations. Starter-funded equipment can be recovered only by its original operator; earned loot remains transferable. Selling, recycling, crafting and repairs retain starter status, delivery contracts need earned salvage, and starter-funded rounds are removed when an ordinary weapon changes hands. Existing saves retain their previous ordinary items/balances without a new allowance.

Bring-in items leave the usable stash at deployment. Carried fuel participates in the normal ownership, stack, weight, escrow and loss rules. Successful extraction banks surviving eligible items; consumed keys/fuel remain consumed. Death, timeout or a disconnected operator's eventual outcome loses unsecured equipment. Eligible protected items survive according to the protected-pocket rules. Recovery artifacts are unsecured contract items: they cannot enter protected storage or another deployment, and only successful extraction earns artifact recovery credit. WORLD_CONTENT.md describes sector objectives, sale protection and delivery. Recovery equipment cannot be banked or insured.

Raid records show returned/lost items, insurance premium/refund, ammunition/medicine/key use, exit-access costs and the successful departure route. Closing the play screen does not extract the operator. Reconnect to the same operator within the documented 45-second disconnect window; the body remains vulnerable meanwhile.

## Verification and remaining release work

`tests/raid-exits.test.mjs` covers contested last-seat admission, cancellation and seat reuse, carried passengers and separate outcomes, finite departure counts, resource-stack payment and retry safety, canonical consumption, failed checkpoint rollback and restart/legacy compatibility. The shared geometry tests route to all four sites on every authored map.

`tests/raid-browser-exits.mjs` uses two isolated browser accounts. It deploys actual owned fuel through the UI, pays at the resource exit, races for a fixture's final seat, cancels a rival's boarding through server damage, extracts independently and checks capacity/cost reporting and returned equipment. The fixture arranges positions and prior seat use; it does not prove human map traversal, camping counterplay or encounter balance. Those playtests, remote-network/device acceptance and the rest of issue #1 remain release gates.


## Field utilities and friendly fire

Ashveil smoke, Scrapchatter lures and Shatter charges are ordinary owned items. Buy/craft/find them, carry up to three per stack, and pay their weight/slot costs. They cannot enter protected storage or insurance. Throwing consumes one immediately; an unused item can be taken from a death bag and banked by its new owner. Server receipts and checkpoints cover that transfer and consumption.

Utility / G throws the first carried utility; Backpack lets you choose one. A short server-derived sight line places it before solid cover, with a 1.5-second reuse cooldown. Throwing ends spawn protection. Downed operators cannot throw. The smoke screen lasts 18 seconds after a 0.8-second activation delay and blocks machine sight/enemy identification, but not bullets or an attack already committed to a position. Nearby strike warnings remain visible through smoke. Squad markers remain available. Lures pulse for 12 seconds after 0.5 seconds and attract investigating machines within 32 metres; visible operators have priority. Charges explode after 1.5 seconds, with a four-metre radius, distance falloff, solid-cover protection and machine armor rules.

Squad weapon and explosive friendly fire is off. Explosives can injure their thrower. Opposing operators remain valid targets; smoke is concealment, not invulnerability. A called extraction, shot or lure can attract machines. These are the current authoritative rules, with practical balance/counterplay still subject to playtesting.

## Progression persistence and reset policy

The release policy is persistent progression with **no scheduled seasonal wipes**. Ordinary restarts and supported migrations retain accounts, stash, credits, contracts, trader reputation, upgrades, insurance and results. There is no player-facing wipe/reset endpoint. Recreating a disposable test fixture does not describe production save behavior.

Extraction progression and credits remain separate from ordinary-mode cosmetics, classes, pets and the local diamond wallet. Raid deaths cannot delete permanent cosmetics. There is no real-money equipment purchase or currency conversion.

Any future seasonal system would require a separately specified, clearly announced save policy before release; it is not permission for a silent wipe of existing accounts. Migration rollback follows OPERATIONS.md and verified backups. This policy does not replace the remaining economy/progression balance work.

## Post-raid reconciliation

New reports record a stable public outcome reason: operator gunfire, machine attack, blast, fall, environmental damage, untreated bleeding, downed timer expiry, finishing damage, disconnect grace expiry, raid deadline, successful extraction or service recovery abort. Reports do not reveal an attacker identity or location. Older deaths without a cause remain explicitly unknown. The map version and elapsed deployment time accompany the report. Pending causes survive checkpoint recovery and transactional rollback.

The credit ledger covers the settlement transaction only: balance before and after, starter/earned portions, earned raid reward and any aborted-deployment premium refund. The premium and its starter-funded portion are shown separately as a deployment-time charge; they are not deducted twice. Base purchases, sales, repair/crafting and later contract reward claims are separate transactions, not hidden inside a raid's settlement delta. Contract progress is shown separately from claimed rewards.

The committed loadout is shown as an immutable deployment snapshot, including original quantities/condition and explicitly temporary recovery gear. Compare it with consumption counters and returned/lost lists; a deployed item used up or left behind earlier is not silently labeled as a death drop. Returned items include protected storage and explicit overflow locations; dropped/lost items are not guaranteed to remain available in the field. Insurance lists each covered equipment label and its status at settlement. Extraction does not cancel insurance on gear left behind: only actually returned equipment needs no recovery claim. A pending claim is conditional on raid closure, recoverable condition and nobody else claiming the item. Its later status belongs in the base insurance panel; the historical raid report does not promise a future return. Older reports without a ledger or insurance detail say those details were not recorded.
