# Squad placement and connection policy

This describes the current authoritative single-region service. It does not claim a distributed allocator, a public regional fleet or physical-network acceptance. Full release acceptance remains in RELEASE_ACCEPTANCE.md.

## Placement

- Actual deploying group size determines the preferred pool: one operator is solo, two duo, three trio. A trio-capacity party with one member still deploys as one operator. The entire ready group is placed in one transaction.
- Same-size open sessions are preferred, then fuller compatible sessions, then older sessions. **Allow mixed squad sizes** enables fallback only when every group already admitted to that session also permits it. A strict same-size group cannot receive larger/smaller opponents through someone else's opt-in.
- Gear and skill matching are open. There is no hidden equipment score, ordinary-mode class/pet bonus, paid priority or skill bucket. Choices are explicit; permanent ordinary-mode progression does not replace owned raid equipment.
- A session admits at most nine total operators, including historical participants, during its first 60 seconds. Death/extraction does not free a combat respawn seat. Every member's prior participation excludes that session, including after changing party leaders.
- A whole group that cannot fit starts elsewhere; it is never split. If no safe compatible session exists, create a fresh raid. There is no forced minimum human population, invented human opponent or silent weakening of the chosen size policy. New rivals may join during the first minute; the machine population remains the PvE threat.

These are development session budgets, not a production capacity guarantee. PERFORMANCE.md retains measured limits and pending load/device/network work.

## Spawns and groups

New group anchors use unused authored spawn sites, favoring distance from living rivals. A chosen anchor must be at least 28 metres from rival operators and 16 metres from living machines. If none is safe, do not force a dangerous join into that session. New squad members use separate reachable formation positions within six metres of the leader, with at least 1.1 metres between members and at least 24 metres from living rivals. The earlier overlapping-trio positions are no longer used.

Collision, heights and fixed map versions still govern placement. Whole-group escrow/placement rolls back if a safe formation or valid member loadout cannot be committed. Existing five-second spawn protection is not permission to attack invulnerably: firing or throwing a utility removes it. These separation rules do not replace practical spawn/camping balance playtests.

## Connection limits

The client offers 150, 250, 400 ms or **No limit**, with 250 ms as the initial UI choice. This is a round-trip limit for admission to the currently connected server, not a promise about future latency or packet loss.

The authenticated latency check issues an unpredictable, session-bound nonce. The client returns it; the server measures elapsed monotonic time, including network and client/server scheduling. Client-supplied RTT values cannot lower that measurement. Challenges expire after ten seconds, are single-use and account/session-bound, and yield a private 30-second measurement proof. They do not debit equipment or reserve a raid.

Paid/free deployment with a limit requires a fresh valid measurement at or below that limit. A high/expired/missing check rejects before equipment debit. Choose a higher limit explicitly or retry; the service does not silently relax it. **No limit** deliberately bypasses this admission condition and makes no low-latency claim. Repeating an already committed deployment ID returns its existing operator even after the measurement expires.

Party members measure before readying. Ready clients refresh approximately every eight seconds, while the party roster shows each member's fresh RTT/limit status. Final deployment checks every member, not just the leader. A leader cannot override the saved party limit in the deployment body. Expired/revoked sessions cannot provide a valid check. Measurement proofs and session hashes are not sent to other party members or saved in browser storage.

The leader may change size fallback/connection limit before deployment; everyone becomes unready. Other members see those preferences but cannot change them. Active deployments prevent party changes. Stale asynchronous connection/deployment/resume responses cannot start a raid UI after the client changes account identity.

## Regions and updates

The briefing shows the server's actual configured region. This service does not silently route to an unconfigured region. A conflicting explicit solo or party region request is rejected, with equipment retained. A different region needs an actual server there; provider selection, discovery/routing, shared identity and distributed capacity remain deployment work.

Protocol 6 (including the later combat update) rejects older deployment clients before equipment debit. Schema 8 fences persistent squad-size consent/placement semantics against older binaries. Supported migration preserves profiles, credentials, equipment and checkpoints. Legacy sessions retain their prior mixed policy; they are not relabeled strict. Fresh strict groups do not join legacy mixed sessions. Backup tooling supports schemas 3–9; never lower version markers to reopen data with incompatible code.

## Evidence and remaining acceptance

`tests/matchmaking.test.mjs` covers size preference/consent, formation/separation, whole-group capacity and join deadlines, configured regions, leader-only preference updates, server-clock nonce binding/expiry/revocation, pre-debit rejection, whole-party measurement rules, active-deployment retries and v7 preservation. `tests/raid-browser-matchmaking.mjs` uses a server-clock fixture to verify the actual high-latency rejection/gear preservation/higher-limit/strict-pool UI. It is not a WAN measurement. Existing party/account/controls/raid browser scenarios remain regression checks.

Open requirements include distributed allocation, cross-region identity/routing, population and skill/gear policy balance, actual WAN and physical devices, practical solo/duo/trio onboarding, and multi-hour capacity. A source-fingerprinted two-hour delayed/lossy gameplay soak is being observed separately; no final outcome is claimed until it completes. Its loaded modules precede the subsequent leader-configure UI addition, so it will not retroactively prove that flow.
