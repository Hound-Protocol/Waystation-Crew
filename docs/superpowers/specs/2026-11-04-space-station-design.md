# Waystation Crew: Design Spec (formerly "Space Station X")

Date: 2026-11-04 | Status: draft for owner review

## 1. Concept
A browser-based, non-interactive, persistent shared world: a pixel-art space station run entirely by autonomous characters. Each Instagram follower gets a named character who arrives by ship, takes a job, lives a daily routine and helps the station grow. Viewers cannot control anything; they watch the station and their own character on a dashboard. Revenue comes from small paid cosmetic and job-selection upgrades.

Inspiration: Space Station 14 (vibe only; no names, sprites or assets copied).

### 1a. Product definition
- Category: a persistent, community-populated, zero-player simulation (a "living station"). It is not a game to play; it is a place followers belong to. Tagline: "Follow to move in."
- Collaborative by design: every follower adds a character to one shared world. Population drives growth (the 70% expansion rule), so the community visibly builds the station together. Milestones and a station chronicle record shared history.
- Viewers navigate, inspect and follow characters, but never control them.

## 2. Goals and non-goals
Goals
- Characters make real decisions from station state (e.g. the engineering director sees housing near capacity and plans habitation modules).
- A new follower sees their character arrive within minutes (the share-worthy hook).
- Expands smoothly: new modules, jobs and stations are added as data, not rewrites.
- Handles 1,000+ characters per deployment now; design target 10,000 across multiple stations.

Non-goals (v1)
- No player control of characters or the station.
- No native apps; browser only.
- No LLM dependency in the core loop.
- No real-time combat or twitch gameplay.

## 3. Decisions (made by engineering, owner delegated)
| Area | Decision |
|---|---|
| Language | TypeScript end to end |
| Sim | Single authoritative Node process; headless, deterministic (seeded RNG), fast-forwardable |
| Transport | WebSocket, viewport-based delta updates |
| Renderer | PixiJS (2D, WebGL, Canvas fallback) |
| Art | 16x16 pixel sprites, layered characters |
| Persistence | SQLite via WAL for v1 (snapshots + event log), Postgres-compatible schema |
| AI | Utility scoring with role concerns; LLM optional later for dialogue/flavor |
| Hosting | Cloudflare for the website, domain, DNS, TLS, DDoS protection and asset delivery (static client on Pages/Workers, sprites and sounds on R2, WebSocket proxying); one small VPS runs the simulation server and database; stations isolated so they can later split across processes or move to Durable Objects |
| Payments | Stripe Checkout; bundles/credits (1 EUR single payments lose ~25% to fees) |

## 4. Architecture
```
Instagram claim flow -> API server (Fastify) -> Sim server (tick loop)
                               |                      |
                          Accounts/Payments      Station modules (isolated)
                               |                      |
                           SQLite  <-- snapshots/events --
Browser: Dashboard + PixiJS station viewer <-- WebSocket deltas <-- Sim server
```
Units and boundaries
- `sim-core`: pure logic, no I/O. Input: state + tick; output: new state + events. Fully unit-testable.
- `content`: JSON/TS data defs for modules, jobs, items, needs, concerns, ship types.
- `server`: runs the tick loop, persistence, WebSocket gateway, claim/payment APIs.
- `client`: dashboard + viewer; read-only.
- Stations never share state directly; they communicate through messages (ships, trade, transfers). This is what allows splitting into processes later.

## 5. Simulation core
- Tick: 1 world tick per second. Movement is interpolated client-side.
- Decision staggering: each character re-decides every 5-30 sim seconds (jittered), not every tick. At 10k characters this is ~500-2,000 decisions/s.
- Level of detail: sleeping, eating and off-station characters use abstract state (activity + ETA), no pathfinding.
- Pathfinding: precomputed room graph; paths between rooms cached; local A* only inside a room.
- Time: accelerated game clock (e.g. 1 real hour = 1 game day) with shifts and schedules.

### Character brain
Needs (energy, hunger, social, comfort) + job duties + personality traits -> utility scores -> chosen action. Actions: work task, eat, sleep, socialize, wander, travel, go on mission.

### Station state and metrics
Modules, power, oxygen, food, materials, credits, population vs housing capacity, safety. Metrics are computed each minute and exposed to role concerns.

### Role concerns -> projects -> jobs (the autonomy loop)
1. Each leadership role owns concerns: a metric, threshold, weight and a response template.
   - Engineering Director: station occupancy >= 70% of effective capacity -> propose an expansion for the bottleneck (habitation, hydroponics, power or life support). Effective capacity = min(housing, food, power, oxygen). One expansion project at a time, sized in steps (e.g. +25 capacity); re-evaluated when each completes. If arrivals outrun construction, new characters wait on an arrival manifest. Bots do not count toward capacity.
   - Quartermaster: food < 3 days -> propose hydroponics or supply run.
   - Medical, Security: similar for health and incidents.
2. A concern fires -> a Project is created (needs budget, materials, location).
3. Commander (or budget rule) approves or defers based on credits and priorities.
4. An approved Project spawns Jobs on the job board (mine ore, haul, build, power up).
5. Characters with matching skills claim jobs via their utility scores.
6. Completion spawns the module; metrics change; the cycle repeats.
New stations: when the whole station is near its hard limit and expansion space is exhausted, a "Station Expansion" project is created. It runs the same loop at larger scale, using a construction ship crew and an outpost module as the seed. When done, a new station instance is created nearby and linked.

### Events
Every notable thing emits a structured event (arrivals, promotions, approvals, completions, incidents, arguments). The event log drives the news feed and per-character history.

### 5a. Character AI design (scalable, emergent)
- Data layout: character state in flat typed arrays (ECS-style); time-sliced buckets of due characters per tick.
- Needs: energy, hunger, social, comfort, purpose; decay over time, restored by actions.
- Thoughts: per-character ring buffer of recent happenings with fading mood effects. Mood is derived from needs plus active thoughts, scaled by traits; mood influences work speed, social choices and action selection.
- Status shown on the dashboard is the readable form of needs, mood and current intent.
- Decisions: utility scoring over affordances. Objects advertise actions (bed: sleep, terminal: work, bench: chat). Job board entries are scored the same way, so work and personal life compete naturally. Leaders also evaluate station-level concerns (section 5).
- Interactions: co-located characters trigger encounter rolls (chat, joke, argument, help, gossip) chosen from relationship, moods and traits. Outcomes update thoughts and a sparse relationship graph (cap ~20-30 per character, decaying). Dialogue comes from tagged templates and small grammars filled with names, jobs and recent events. Per-room encounter budget caps cost.
- Scale controls: level of detail by viewer attention and situation; load shedding delays low-priority decisions first; deterministic seeded RNG for replay.
- Tunability: curves, weights, templates and traits are data; a debug view explains why an action was chosen; a fast-forward soak mode finds broken economies.
- Optional later: rate-limited, cached LLM use for rare story moments.

### 5b. Non-player crew (robots, cyborgs, station AI)
- Purpose: cold-start liveliness, baseline stability when humans are few, and extra story content.
- Archetypes use the same brain framework: robots (needs: power, wear, maintenance), cyborgs (mixed needs), and a station AI agent that monitors metrics, announces events and assigns urgent jobs.
- Limit as mechanics: automation is bounded by robot bays and power, runs at reduced efficiency (target ~50-60% of a human crew), requires repair jobs, and cannot hold leadership roles or make major decisions.
- Human characters keep careers, relationships and leadership; bots take unglamorous essential work. As human population grows, automation hands over roles.
- Bots are visually distinct at 16x16 (silhouette and palette) and count toward the 10k simulation budget.

### 5c. Life-sim layers (autonomous inner life)
Characters think on several timescales, from cheapest to most expensive:
1. Reflex (seconds): react to hazards, interruptions, someone greeting them.
2. Action (minutes): pick the next activity by utility scoring (needs, mood, traits, schedule, distance).
3. Daily plan (once per game day, staggered): build a plan from routine blocks, goals and pending invitations ("hang out at 20:00 in the rec room").
4. Life goals (days to weeks): ambitions such as promotion, making friends, learning a skill, upgrading quarters, joining a club, finding a hobby.
- Identity: lightweight traits (e.g. sociable, diligent, curious, cautious, playful), preferences (favourite places, food, hobbies) and a skill set that grows with practice.
- Self-directed activities (data-driven catalog): walking the corridors, observation deck stargazing, gym, cards or board games, cooking, music, reading, gardening, hanging out in the mess hall or rec room, quiet time in quarters, helping a friend.
- Group activities are single shared "event" entities (movie night, game night, birthday, celebration) with a host and participants, so coordinating many characters stays cheap.
- Memory and gossip: characters remember notable interactions and events; information spreads by encounter, fades with time, and shapes opinions and conversation topics.
- Reference feel: depth like Space Station 14 or RimWorld (jobs, social life and incidents interlock), with originality in names, art and content.

### 5d. Organization: departments, ranks, access and security
- Departments (v1): Command, Engineering, Medical, Security, Supply (mining, hauling), Service (food, hydroponics, hospitality), and Research later. Role names are generic and original.
- Rank ladder per department: Trainee, Technician, Specialist, Senior, Chief; Command at the top (Station Commander). Promotion depends on experience, performance, vacancy and standing with superiors. Rank is earned; the paid "job selection" only sets a preferred department, never buys rank.
- Job slots scale with population (e.g. a station of 100 has one commander, a few chiefs, and slot counts per role); the first arrivals fill founding positions.
- Chain of command: chiefs and the commander issue tasks and priorities through the job board and direct orders; characters follow orders weighted by rank, trait and mood.
- Access levels: ID access tiers (public, crew, department, command) gate rooms, consoles and doors; access comes from rank and department and feeds pathfinding.
- Security: officers patrol, respond to incidents (trespass, brawl, theft, sabotage, emergencies), use a small brig for short holds, and handle evacuations. Incidents are mild by default (see 5g). Security also enforces access rules.
- Emergencies (fire, power loss, hull breach): each department has a response role, and drills can be scheduled.

### 5e. Routines and shifts
- Game day cycle with three shifts (day, evening, night); critical posts are staffed around the clock by rotation.
- Each role has a schedule template (sleep, meals, work blocks, leisure, social time) that each character personalises (night owls, early risers, favourite breaks). Days off and station-wide events (holidays, "arrival anniversary" parties) break the routine.
- Schedules are soft in leisure time and hard for critical duty, so the station never goes unstaffed.

### 5f. Social system and relationships
- Relationship graph is sparse and decays: acquaintance, friend, close friend, rival, mentor/mentee, colleague bond; romance is purely in-game and character-driven (see 5g).
- Encounters pick topics from shared history, jobs, mood, traits and recent events; outcomes shift opinion and mood.
- Cliques and clubs emerge from repeated friendships and shared hobbies; friends invite each other to events; mentors coach juniors in the same department.
- Conflicts are small and resolve (arguments, pranks, jealousy); they never end a character.

### 5g. Content guardrails (characters carry real people's names)
- No death or lasting harm to any character: injuries and critical states are allowed (see 5h) but always recoverable, with no gore; no sexual content; no hateful content.
- Negative arcs (security incidents involving a named character, firing, rivalry) are light-hearted and capped. Players can opt their character out of drama and security incidents in their dashboard (default: mild).
- Romance is purely in-game and character-driven (owner decision): characters can fall in love, date and pair up on their own, shown with hearts, shared walks and events, and always wholesome (no sexual content). It is not tied to the owners' real relationships. Owners can opt out of romance and drama from the dashboard (free).
- Troublemaker and incident roles are filled by non-player characters first.
- All displayed text passes the name and content filters; a report path exists for any user.

### 5h. Medical system (no death, always recoverable)
- Health states: healthy, hurt (minor), injured, critical (down, incapacitated), stabilized, recovering. Characters cannot die; there is no death timer. Care quality only changes how long recovery takes.
- Causes (rate-capped per day, reduced by the owner's drama opt-out): work accidents, hazards (fire, depressurization, meteor), mining mission mishaps, rare mild scuffles, fatigue collapse.
- Response chain:
  1. A distress event alerts Medical and the station AI; a "rescue" job goes on the job board at high priority.
  2. The nearest available paramedic claims it, travels with a medkit, stabilizes the patient on site, and loads them on a stretcher.
  3. The paramedic brings the patient to the medical bay, where a doctor triages and assigns a bed.
  4. Treatment follows. If the injury needs surgery, a surgeon on station operates in the surgery room.
  5. The patient recovers, is discharged, and returns to routine (with a thought and relationship effect such as gratitude toward the rescuer).
- Fallbacks so nobody is stuck: if no paramedic is free, a medical bot is dispatched; if no surgeon is on station, the patient waits stabilized or is treated more slowly by a medical bot, or is transferred by shuttle to a nearby station's medical bay (uses the multi-station system).
- Capacity: medical bay beds and surgery rooms are station metrics. The Chief Medical Officer's concern (beds per population) can trigger a medical expansion project.
- Roles and skills: paramedic (field rescue), doctor (treatment), surgeon (specialist), chief medical officer; first aid and surgery skills grow with practice.
- Visuals and audio: critical characters lie down with a status icon and "needs help" bubble; bandage or limp overlays while recovering; stretcher and medical bay props; alarm and monitor sounds (owner-supplied).
- Dev panel: trigger an injury, force critical, force surgery, and test the full rescue chain.

### 5i. Incident director, troublemakers and antagonists
Inspired by SS14's departments, antagonist roles and "game director" idea (events steered by a chaos budget), adapted to a persistent, non-interactive, self-building world. There are no rounds; the cycle never ends.
- Incident director: schedules events continuously to keep the station inside a target tension band. Each event declares its load (security, medical, power, morale). Negative events raise tension, positive events (celebrations, parties, good news) lower it, and calm beats follow spikes. The director never lets load exceed what Security, Medical and Engineering can plausibly handle.
- Baseline events: breaker trips, gas leaks, fires, meteor showers, power outages, supply shortages, false alarms, festivals.
- Troublemakers are part of the cycle: petty theft, trespass, vandalism, pranks, brawls. Non-player characters fill the role first; some crew have a "mischievous" trait that occasionally triggers it. Security handles it.
- Traitor (1 EUR or director-picked): the character gets a random mission from a mild list (steal an item, sabotage a console temporarily, steal or forge ID access, cut power briefly, graffiti, disrupt a department). Attacks incapacitate or injure, never kill; sabotage is repairable. Limits: a per-character cooldown and a cap on simultaneous traitors per station. The traitor is caught by Security or the mission times out; the character then returns to normal routine.
- Hostile faction (1 EUR or director-picked): raiders arrive by ship; their size scales to Security's capacity so it is a fair fight. Objectives: loot cargo, breach a room, hold an area. Security and armed crew respond; damage is repairable; wounded characters go critical and follow the medical chain (5h), never die. The conflict ends when raiders are repelled, detained or leave after a timer; then a 20-minute cooldown begins.
- Paid events enter the director queue and are announced in the station chronicle.
- Safeguards: characters that opted out of drama are never picked as victims; caps and cooldowns prevent spam; refunds if a paid event cannot run.

### 5j. Security procedure and station code
Inspired by SS14 and SS13 security procedure (arrest, brig, records), simplified and mild.
- Every character carries a PDA with an emergency call and radio channels. If someone is attacked or sees a crime, they pick up the PDA and call Security with location and type of incident. Calls generate a dispatch with priority.
- Dispatch: nearest available officers respond, with backup scaled by severity. Medical is alerted in parallel if anyone is hurt (5h).
- On scene: secure the area, interview witnesses (using character memory), collect clues (broken locks, access-log anomalies, who was seen where), identify a suspect (probabilistic, improves with evidence), pursue, detain with non-lethal means, escort to the brig, and register the case in the security records console.
- Station code: a small table of offences with short sentence ranges in game minutes (warnings for minor offences). Resisting arrest adds time. No permanent confinement. Longer sentences need approval from the brig warden or head of security (like SS14's rule that longer sentences go through the warden or head).
- Brig: timer-based cells; the warden updates records, looks after prisoners (food, medical) and releases them when the sentence ends.
- Access and ID: each character has an ID with access tiers; a Personnel Officer manages jobs and access through an ID console. Stolen or forged ID is a traitor mission, and unusual access use is flagged to Security.
- Alert levels: green (normal), blue (suspected threat), red (active hostile). They change patrol density and equipment access; the commander or the director sets them.

### 5k. Personality and customization
- Personality is randomized at arrival: weighted trait draws with light correlation to department fit. The owner does not choose it by default.
- Unlocking customization (1 EUR) lets the owner choose traits and appearance; scope to be confirmed. Everything else stays autonomous.

### 5l. Self-assessment and self-building station
Goal: the crew continuously assesses the station and designs and builds its own growth, with the depth increasing over time.
- Assessment loop: leaders and the station AI periodically audit the station. Inputs: occupancy vs capacity per resource (housing, food, power, oxygen, medical beds), room utilisation and queues, travel times and crowding, air and power margins, maintenance backlog, safety record, morale. The audit produces a ranked list of deficits and opportunities, each with an urgency score.
- Planner: for the top deficit, the Engineering Director (with the commander's approval) selects a module template, then picks a placement from valid hardpoints using scoring rules (adjacency preferences such as medical near docking, noisy engineering away from quarters, short walking distance for heavy-traffic rooms, power and air connectivity, room for later growth).
- Growth model: modular. The station has hardpoints (docking nodes, ring segments, corridor stubs). Modules come from authored room templates (habitation, galley, hydroponics, medical bay, surgery, security and brig, engineering, storage, rec room, observation deck, docking bay, robot bay). This is far more reliable than free-form tile placement and keeps the look coherent. Finer interior layout and decoration can be handled by the crew later (personal quarters furnishing, posters, plants).
- Construction pipeline: blueprint, budget, material list, jobs (mine ore, haul, fabricate, weld, install, power-up, inspect), commissioning, then the module opens. Delays happen when materials or workers are short; characters report progress in the chronicle.
- Maintenance and decay: systems wear, break and need repairs, which creates continuous work and lets the director cause realistic failures.
- Navigation and rendering: navigation graph and access rules update incrementally as modules are added; wall and floor tiles auto-connect so any layout looks right.
- Safeguards: layouts are validated (every room reachable, life support connected, no soft-locks), with a fallback template if the planner fails, and the dev panel can show the planner's reasoning and force or undo a build.
- Build order for complexity: every layer is data-driven and feature-flagged, shipped as a vertical slice, logged, and soak-tested before the next layer: (1) needs and jobs, (2) assessment and expansion (the 70% rule), (3) maintenance and decay, (4) social life, (5) medical and security, (6) incident director and antagonists, (7) economy and trade between stations, (8) interior self-decoration.

### 5m. Internal economy (Space Credits, SC)
- Currency: Space Credits (SC), purely in-game. SC cannot be bought with real money, cannot be withdrawn, and donations never convert to SC. This keeps the economy fair and avoids legal and gambling-like issues.
- Accounts: every character has an SC account (balance and transaction history). Payroll runs hourly in game time, in a batched pass, into each character's account. Wages depend on role and rank; visitors and the unemployed get a small stipend so nobody is stuck.
- Sources (money entering): the station treasury earns from mining exports, trade and contracts with other stations, and corporate grants. Sinks (money leaving): rent for quarters, food, clothing, entertainment, repairs, shop taxes, and construction costs.
- Treasury and balance: a finance or budget officer (Command or Supply) sets wages and a budget; the incident and economy directors watch for runaway inflation or collapse and adjust prices, wages, or grants.
- Shops and places: canteen and mess hall, vending machines, general store, clothing boutique, bar and rec shop, market stalls. Service-department characters or automated vendors run them. Stock is restocked by Supply jobs, and prices follow simple supply and demand. Shop price boards are functional displays.
- Spending behaviour: characters decide purchases through the utility brain (needs, wants, saving goals such as a new outfit, better quarters, or a gift for a friend or partner). Personality affects thrift vs spending.
- Clothing: a catalog of in-game outfits by tier. Characters buy and wear work uniforms and casual off-duty outfits, which gives visual variety (outfits are sprite layers). Real-money appearance features (customization unlock) set the owner's chosen look; in-game purchases are the character's own autonomous choices and never replace that.
- Scale: payroll and purchases are processed in bulk per game hour, so cost stays small even at 10,000 characters.
- Dev panel: view treasury, inflation graph, wages and prices, and trigger an economic event.

## 6. Data model (v1)
- `account`: id, instagram_handle, claim_state, created_at.
- `character`: id, account_id, station_id, name, skills, traits, preferences, needs, mood, department, rank, job_id, access_level, schedule, goals[], daily_plan, location, appearance (layer ids + palette), custom_item_id?, drama_opt_out, romance_opt_out, health_state, traitor_cooldown, personality_seed, injuries[]
- `relationship` (sparse): character_a, character_b, type, strength, last_interaction
- `memory_item`: character_id, event_id, valence, decay
- `sc_account`: character_id, balance_sc, wage_rate, last_payroll; `ledger`: tx id, from, to, amount, reason, game_time
- `shop`, `shop_item`, `outfit`: catalog, stock, price, tier, sprite layer ids
- `station`: id, name, position (sector coords), modules[], resources, metrics.
- `module`: id, type, station_id, grid position, state, capacity/effects.
- `project`, `job`, `ship`, `event`, `purchase`, `cosmetic_item`.
All gameplay definitions live in `content/` and are versioned.

## 7. Viewer protocol and dashboard
- Viewers subscribe to a station + viewport rectangle; server sends compressed deltas (entity enter/leave/move/state) at ~2-4 Hz.
- The owner's character is always included (full detail) even off-screen.
- Dashboard: character card (name, job, status, needs, schedule), live location with "follow" camera, recent events, store (job/appearance changes).
- Public read-only station view needs no login.

## 8. Onboarding (highest-risk integration)
Problem: Instagram has no follower-list or follow-event API. However, the Instagram Messaging "User Profile API" does return, for a user who has messaged the business account, their username, follower count, verified flag and whether they follow the business (is_user_follow_business), keyed by a stable Instagram-scoped ID. This makes a DM claim flow viable.
v1 approach: a "claim" flow. The user DMs a short code to the official Business/Creator account or submits their handle plus a code on the site; the Instagram messaging webhook confirms the claim. Follower status is trusted/spot-checked, not API-verified. A spike must confirm what the current Meta APIs allow before the build commits to this flow.
Arrival queue: if the station is at capacity, the character is placed on an incoming ship manifest ("docking soon") so the user still gets an immediate response.

### 8a. Follow/unfollow sync (owner requirement)
Rule: following the official account makes the character appear (arrival ship); unfollowing makes it depart.
- No official API provides a follower list or follow/unfollow events, and scraping or tracker services violate Instagram terms, so v1 does not use them.
- v1 source of truth: the owner's Instagram followers export, uploaded to an admin page. The server diffs it against the previous snapshot: new names -> arrival queue; missing names -> departure after a grace period (default 3 days) so brief unfollows or export glitches don't remove characters.
- Matching: by username from the export; the DM claim code links a stable Instagram-scoped ID so username changes can be reconciled.
- Departed characters are archived, not deleted; refollowing restores the character with its purchases.
- Primary automated check (spike to confirm): the User Profile API's is_user_follow_business flag for users who have messaged the account. The spike must confirm whether it can be re-queried later to detect unfollows (consent is set when the user messages). If not, the export diff remains the unfollow source. The owner's own account should qualify for Standard Access (no app review for accounts you own).
- Any other automation only if compliant with Meta's terms.

### 8b. Bot and abuse prevention
- A character is created only for a verified resident: the account followed AND completed the DM claim (DM a keyword; the webhook gives the stable ID; the profile check confirms the follow). Followers who never DM never appear. Bots rarely complete this, and Instagram rate-limits DM automation.
- Risk scoring from profile signals (no profile picture, odd username patterns, very low or extreme follower counts, many claims arriving in a burst). Weak signals do not block; they place the account on hold for review.
- Probation: new characters start as "visitors" (no leadership role, minimal social footprint) and become full residents after a short delay, a verified payment, or manual approval.
- Throttles: per-hour arrival cap and arrival manifest queue; station population caps mean bots cannot flood the station. Spam bursts auto-hold.
- Website claim step uses a Cloudflare Turnstile check. Paid accounts count as trusted.
- Moderation tools in the dev panel: flag, hold, depart, ban; plus removing bot followers on Instagram itself.
- Impact is limited by design: the world is non-interactive, so a bot gains nothing beyond a population slot.

## 9. Monetization
- Characters are fully autonomous with a randomized personality, appearance and department at arrival. Following is free.
- Default price is 1 EUR per feature (credits bundles recommended because card fees make single 1 EUR payments inefficient). Items:
  - Unlock customization (1 EUR): choose appearance and personality traits (exact scope of the unlock to be confirmed).
  - Job selection (1 EUR): sets a preferred department; rank is still earned.
  - Appearance change (1 EUR).
  - Send a hostile faction (1 EUR): raiders arrive and conflict follows (see 5i). A 20-minute cooldown starts when the conflict ends; purchases made during a conflict or cooldown queue for the next slot. The chronicle credits the sender (optional anonymity).
  - Become a traitor (1 EUR): the owner's own character gets a random mission and becomes a menace until caught or the mission ends (see 5i).
  - Custom item for a specific character (5 EUR): moderated queue.
  - Exceptions (price to be set per feature when added).
- Custom item (5 EUR equivalent): layered 16x16 sprite, delivered through a moderated queue (hand-made or AI-assisted, human approved).
- Job selection is a preference weight, not a guarantee: the character still must qualify and the station must have the opening.
- Purchases are idempotent and recorded in `purchase`; the sim applies them at the next safe tick.

## 10. Art pipeline
- 16x16 grid; layered characters (body, head/hair, outfit, accessory, custom slot) with palette swaps for appearance variety.
- Tiles, modules and props on the same 16x16 grid; modules are multi-tile compositions.
- Sprites authored as palette-indexed grids in repo data, rendered with nearest-neighbor scaling.
- A small sprite tool/preview page is part of v1 to speed up iteration.

### 10a. Art bible (LOCKED 2026-11-04): "Industrial Dark Pixel"
- Grid: 16x16 tiles and sprites, top-down three-quarter view, nearest-neighbor scaling only.
- Characters (slim): head 6 wide x 5 tall (hair 2 rows, face 2 rows, neck 1), torso 4 wide, 1px arms, 4-row legs. One-pixel near-black outline (#07080b). Three-tone shading with light from the top-left (highlight left/top, shadow right/bottom). Tiles have no outline.
- Mood: dark, grimy, industrial, "dead space" tone. Station surfaces are desaturated cool metals; only emissive colors are bright and saturated.
- Core palette: floor #22252c / #17191e / #292d35; wall #2e323b / #454a56 / #252830; suits #2b3038 / #3a404b / #1c2026; hazard stripe #b8941f / #15171b; pipe rust #a56a3d / #7a4a2b / #4a2b18; emissive cyan #4de1ff, orange #ff8a2a, green #7dffb0 (#3fd98a), red #ff4040, lamp #ffd866.
- Role identity by color: engineer orange, medic grey-white with red, commander navy with gold and cyan, miner olive with yellow headlamp; robots gunmetal with an orange eye.
- Lighting: low ambient (~0.2), point lights quantized to ~6 brightness steps, edge vignette, emissive pixels never darkened. Done in the client renderer (shader), not baked into sprites.
- Sprites are generated by code as palette-indexed parts (reproducible, parametric, recolorable). Reference generators live in the repo under `art/`.

### 10b. Animation and rendering standard
- Render target: 60 FPS with smooth interpolation; adaptive fallback to 30 FPS on weak devices. Motion must never look janky.
- Render rate and animation frame rate are separate. Movement, camera and zoom are interpolated every render frame (free). Sprite animation frames play at ~8-12 fps, the pixel-art norm; 60 fps of hand-authored frames is neither needed nor wanted.
- The server sends paths and targets (waypoints plus timing), not per-frame positions; the client moves characters along paths itself. Server updates are ~2-4 Hz and never drive visible stutter.
- Animation set (v1): idle (2 frames), walk (6 frames, 4 facings, side facings mirrored), work/typing (4), sit/sleep (2), talk (mouth cycle), carry. Because sprites are generated by code, frames are parametric (leg shifts, body bob), so this is moderate work, not a large art budget.
- Layers share one animation rig with anchor points per frame, so a paid custom item needs one sprite plus anchors, not a full frame set.
- Zoom has six levels with animated transitions and per-level detail (see 10f); rendering snaps to device pixels to avoid shimmer.
- Perf: only visible entities are drawn (culling), off-screen ones update abstractly, and far zoom draws crew as colored markers.

### 10c. Functional objects and displays (no decorative screens)
- Every screen is functional: it has a data binding or it does not exist. Abstract art only; no fake readouts.
- Objects have state, affordances and effects. When a character uses one, the action has a real simulation effect and the object visibly reacts (the console lights up, the display changes).
- Bindings (v1): power console (power, oxygen, food, occupancy bars), job board terminal (open jobs, who claimed what, live), bridge display (announcements and the update countdown), hydroponics tray (growth stage), doors (real lock/open/airlock state), quarters door plates (occupant name).
- Rendering: displays are tiny dynamic textures drawn with a 3x5 pixel font plus bar and icon glyphs; refreshed at ~1 Hz and only when on screen. Legible only when zoomed in.
- Interaction visibility: an actively used display shows an active frame (cursor, highlighted row, typing animation) so you can see someone is working on it.

### 10d. Expressions, emotes and status bubbles
- Face expressions are data patches on the 6x2 face area (eyes row, mouth row) plus optional accent pixels. Set (v1): neutral, blink, talking (mouth cycles), focused (narrowed eyes), happy, sad, angry (brow), tired (half-lidded), surprised.
- Expressions are chosen by the sim: talking when in an encounter, focused when working, mood drives the idle expression, and events trigger short reactions.
- Emote icons: small 8x8 icons in a bubble above the head (?, !, heart, gear, zzz, sweat, music note) for notable moments; they fade after a couple of seconds.
- Status bubbles: when zoomed in, a short text bubble with an icon shows the current action ("Fixing power conduit", "Heading to mess hall"). Crisp screen-space text, fades in above a zoom threshold, and shows the name tag as well. Hidden at far zoom.

### 10e. Viewer navigation and interaction
- Pan (drag, WASD, touch) and zoom (wheel, pinch) across the whole station; smooth animated camera moves.
- Click or tap a character: opens a card (name, role, mood, current action, needs, top relationships, recent thoughts and events) with a Follow camera button. The viewer's own character is pinned and highlighted.
- Click an object or room: shows its state and readouts. Search by name or Instagram handle; minimap; overlays for power, oxygen and occupancy.
- Level of detail follows the six zoom levels in 10f.
- Public view is read-only; clicking never changes the world.

### 10f. Zoom levels and level of detail (6 levels)
Detail grows with zoom; each step doubles the scale (screen pixels per tile). Characters are drawn from purpose-made LOD sprites.
| Level | Scale | What you see |
|---|---|---|
| Z1 Overview | ~2 px/tile | Whole station (and nearby stations); room tint colors; characters as 1px dots; no labels except station name |
| Z2 Sector | 4 px/tile | Rooms and corridors as simple shapes; characters as 2x3 px role-colored columns walking; room names |
| Z3 Area | 8 px/tile | 8x8 silhouette sprites (role color, no face), basic props; room and population labels |
| Z4 Local | 16 px/tile | Full 16x16 sprites, walk animations, full tiles and props, lighting; no bubbles |
| Z5 Close | 32 px/tile | Z4 plus expressions, emotes, name tags, status bubbles, readable displays |
| Z6 Detail | 64 px/tile | Maximum detail: legible screens, particles and small effects, full lighting, close-up inspection |
- Zoom feel: zooming magnifies the existing pixels, then the sharper level resolves in with a very quick crossfade (~100-150 ms) so detail "clears out" instead of popping. Zoom is centered on the cursor or pinch point and is animated, never abrupt.
- LOD assets: every character and prop has LOD variants (full, 8x8, 2x3 column, 1px dot); coarse tile views are generated from tile data at build time, not hand-drawn.
- Performance: characters at Z1-Z3 are drawn as instanced points or quads in a single batch (10k+ is fine); expressions, bubbles, lighting detail and dynamic screens run only at Z4+ and only for visible entities.
- Audio follows the same levels (see 10g).

### 10g. Sound
- Sounds are supplied by the owner. The engine uses Web Audio with simple buses (master, ambience, effects, UI) and per-bus volume and mute.
- Footsteps: per-surface sample pools (metal plate, grating, hazard strip, corridor, carpet/other as supplied), 3-5 variations each with small random pitch and volume, triggered on the walk animation's footfall frames. Surface comes from the tile data.
- Area ambience: each room type has a loop (bridge, mess hall, engine room, hydroponics, quarters, corridor, airlock, space/exterior). Loops crossfade based on the camera position.
- Object and event sounds: doors, consoles, alarms, shuttle landing and takeoff, announcements, construction, airlock, the update countdown.
- Positional rules: volume falls off with distance from the camera center and with zoom level. At Z1-Z2 only station-wide ambience and big events are audible; at Z4+ individual footsteps and nearby objects are audible. A voice cap (~24) with priorities prevents noise at scale.
- Browser autoplay: audio starts after a user gesture ("enter the station"); mute is remembered per viewer.
- Asset pipeline: compressed (ogg/mp3) bundles with a manifest mapping sound ids to files, loop points and categories. The owner must confirm that all supplied sounds are licensed for commercial use.

### 10h. Dev control panel (admin only)
Separate admin route behind authentication, not part of the public site. Same code runs against local, dry-run and live environments, with destructive actions confirmed and logged.
- Time: pause, step one tick, speed (1x, 10x, 100x), skip to next shift.
- Characters: searchable list; inspect brain (needs, mood, thoughts, last utility scores, "why did they do that"); spawn test characters (count, role, appearance); remove or depart; teleport; set needs or mood; assign a job.
- Ships: trigger a shuttle landing or departure with chosen or synthetic passengers; simulate follower-export imports.
- Events: trigger fire, power outage, meteor, shortage, celebration; run a dry-run data-disk update.
- Station: list modules, projects and jobs; force-complete or cancel projects; edit resources; place modules; scenario presets (e.g. "60 characters at capacity").
- State tools: snapshot, restore, roll back, reseed RNG, compare runs.
- Observability: tick time, entity counts, population, power, oxygen and food graphs, event log with filters, FPS and draw-call overlay, audio debug (active sounds), debug draw (paths, rooms, light radii, utility scores).
- Safety: sandbox station for experiments; live-station changes need confirmation; feature flags.

## 10b. Smoothness principle (binding)

The entire UI must be smooth: every change eases in or out, and nothing pops in or out. Applies to camera (eased zoom, pan momentum, eased follow), character motion (a render clock that advances every frame), LOD changes (crossfades), spawns (fade-in), selection markers, panels and lists (transitions, keyed updates instead of rebuilds), and the first load (fade-in). New features must meet this before they ship.

## 11. Scaling plan
- Cap per station ~2-3k characters; extra arrivals queue or go to a new station.
- 10k characters = ~4 stations; station = unit of sharding (process or worker later).
- Load tests with synthetic characters before any public launch; target tick budget under 50% of the 1s tick at cap.
- Persistence: snapshot every N minutes + append-only event log; recovery replays from the last snapshot.

### 11c. Free-start hosting plan
- Code, issues and CI on GitHub (free).
- Client website on Cloudflare's free static hosting (Pages/Workers static assets). GitHub Pages is not used for the live site because its terms disallow sites that run a business or sell things.
- Sprites and sounds on Cloudflare R2 (free tier); DNS, TLS and Turnstile free.
- Dry-run simulation server, in order of preference: (1) a home or dev PC exposed through a free Cloudflare Tunnel (instant, online only while the PC is on); (2) a Cloudflare Durable Object on the free plan (SQLite-backed, small stations only; watch free limits); (3) an Oracle Always Free VM (smaller than before, capacity not guaranteed).
- Standalone dev mode: because `sim-core` is pure logic with no I/O, the same code can run inside the browser (Web Worker) with the dev control panel, so the whole station can be tested from a static page with no server. Single viewer, state saved locally, no multiplayer. Used for early testing on a static host, in a Codespace, locally, or as a shared artifact page.
- Upgrade trigger: before going public 24/7 or taking payments, move the simulation to a small paid VPS (a few euros a month). Stations stay isolated so the move is a deploy change, not a rewrite.

### 11a. Multi-server and seamless station switching
- Each station is its own process (later its own machine) and exclusively owns its characters and modules.
- A system service holds the station registry and solar-system coordinates, and routes ship traffic between stations.
- Character transfer is a handoff: A releases -> system service holds the character in transit -> B accepts. Exactly one owner at any time; handoffs are idempotent and persisted so a crash cannot duplicate or lose a character.
- A gateway multiplexes one browser WebSocket across several stations. Neighbouring stations are pre-subscribed at low detail.
- One shared sprite atlas is loaded at start, so switching never loads assets. The client has a solar-system overview (stations as nodes, ships in transit); switching is a camera move, and the detailed stream is ready on arrival.
- Name (locked for now): **Waystation Crew**. Used as product/brand name and as the in-world station designation. Kept in one config value so it can change. Owner still to verify Instagram handle, domain and EU trademark (TMview/EUIPO); the podcast "The Waystation" is the closest known conflict. Later stations may extend the pattern (e.g. Waystation Zero/Prime).

### 11b. Diegetic updates (the data disk ritual)
- A release is built, tested and staged as a "data disk" (sim + content bundle); an update scheduler sets the time.
- At the scheduled time a supply ship docks, the captain takes the disk to the bridge, announces the patch notes in-world, inserts the disk, and a real 10-minute countdown starts.
- The countdown is the deadline. The scripted scene has fallbacks (backup officer, skip-ahead) so character behaviour can never delay the deploy.
- Restart: snapshot, shut down, start the new version, load and migrate the snapshot. Gateway keeps viewers connected; screens show an in-world reboot, then the client reloads itself to the matching version.
- Health check after boot; on failure, reload the pre-update snapshot with the old version (in-world: "disk rejected").
- Multi-station: the flagship station updates first; its crew ships disks to the other stations for staged rollout.

## 12. Moderation and safety
- Name filter on arrival and rename; report/rename path.
- Custom items approved by a human before they appear.
- No user-supplied free text rendered in-world beyond the character name.

## 13. Testing strategy
- `sim-core` unit tests (deterministic seeds); scenario tests (e.g. "housing 90% -> habitation module built within N game days").
- Long-run soak simulations (game-months) checking for economic collapse, starvation spirals and runaway growth.
- Protocol tests for deltas and viewport culling; Playwright smoke test for the dashboard.
- Load test with 10k synthetic characters.

## 13a. v1 launch scope
- One station supporting 100 human characters (housing, food, power, oxygen), plus a small non-player crew.
- Self-expansion: at 70% of effective capacity the crew builds more modules (see section 5) to keep growing.
- Core roles only: commander, engineering director, quartermaster, medical, miners, builders, hydroponics, general crew.
- Dashboard and arrival ship; follow-sync via export upload. Payments, custom items and multi-station follow after v1 proves the loop.
- Acceptance test: start at 60 characters with no spare capacity, add arrivals to 70%, and the crew completes a new module before 95% occupancy without human intervention.

### Rollout phases
- Phase A: private dry run. Owner (and invited testers) only, no payments, no public followers. Test characters, dev panel, ships, events and the update ritual are exercised live.
- Phase B: closed beta. Real followers join through the DM claim flow; everything is still free. Watch retention, balance and bot defenses.
- Phase C: paid features (customization unlock, job selection, hostile faction, traitor, custom items) switch on only after the station is proven fun to watch.
- Hosting for A and B stays free or near-free (section 11c); migrate to a small paid server before C.

## 14. Milestones
0. Live dry-run skeleton: deploy an empty station page (hosting, domain, CI/CD) so every later milestone ships live and is tested together with the owner.
1. Spike: Instagram claim flow feasibility; sim performance spike with 10k dummy agents.
2. Headless sim: station, needs, jobs, role concerns, habitation-expansion scenario passing.
3. Viewer and tools: PixiJS station view with the six zoom levels and LOD art, 16x16 art set v1, WebSocket deltas, audio engine, and the dev control panel (CLI version arrives with milestone 2).
4. Accounts + claim flow + character dashboard + arrival ship.
5. Payments + cosmetics + moderation queue.
6. Multi-station expansion + load testing + public launch.

## 15. Assumptions and open risks
- Goal assumed to be a lean launch with monetization built in but not the primary driver; revisit if the owner wants revenue first.
- Instagram verification may force a weaker claim flow (see section 8).
- Economy balance is the main technical risk; tuning tools are in scope.
- Art volume (custom items) is an operational bottleneck, not a technical one.
- Dialogue is template-based in v1; an LLM layer is a later add-on.
