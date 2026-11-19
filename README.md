# Hue & Seek

An original 3D **online multiplayer** camouflage hide-and-seek game for desktop and mobile browsers.
Hiders either paint their slim, jointed *Huelings* to match the world — sample colours with an eyedropper,
apply wood/stone/fabric patterns, strike a pose — **or transform into real objects** (a water jug, a chair, a
teddy bear…) and move around as that object. Seekers have to spot them and poke them.

- 2–8 players per room, private rooms with 6-character codes, public matchmaking
- Server-authoritative realtime multiplayer (Socket.IO), reconnection to running matches
- **3 hiding styles** picked by the host: 🎨 Color Camouflage · 🪑 Object Transformation (prop hunt) · 🌀 Hybrid Chaos
- ~85 transformable object types (central registry with per-object size, collider and movement style:
  upright / roll / tip / slide / hop / waddle), each with a detailed procedural 3D model
- 7 original fully enclosed maps (walls, ceilings, doors, windows, stairs), 5 game modes, 9 abilities (+2 chaos bonus powers)
- Low / Medium / High graphics presets, rewritten mobile controls (floating joystick + multi-touch camera)
- Real paint system on a per-player texture atlas (brush, fills, patterns, undo/redo, presets)
- **Voice chat** in private rooms (WebRTC): mic on/off, choose who hears you (everyone / your team / picked players), mute anyone
- Accounts without personal data, XP/levels, coins, shop, daily missions, achievements,
  global + friends leaderboards, friends, invites, recent players, profiles, preset quick-chat
- PostgreSQL persistence (embedded PGlite fallback for zero-config local dev)
- All art, audio and music are generated procedurally at runtime — no external assets

---

## Quick start (local development)

Requirements: **Node.js 20+** (22 recommended). PostgreSQL is optional for development.

```bash
npm install
```

```bash
npm run dev
```

This starts the game server on `http://localhost:3001` and the Vite dev client on
**http://localhost:5173** (open this one). With no `DATABASE_URL`, data is stored in an embedded
PGlite database under `server/data/pglite`.

To test multiplayer on one machine, open the game in two different browsers (or a normal + a private
window): each browser gets its own guest account. Create a room in one, join with the code in the other.
To play from a phone on the same Wi-Fi, open `http://<your-computer-ip>:5173`.

### Using PostgreSQL locally

```bash
cp .env.example server/.env
```

Then set `DATABASE_URL=postgres://user:pass@localhost:5432/hueandseek` in `server/.env`.
The schema (`server/src/database/schema.sql`) is applied automatically and idempotently on start.

### Quick local testing

`FAST_TIMERS=true` in `server/.env` shortens all phases to 25% so you can play through a round quickly.

---

## How to play

| Phase | What happens |
|---|---|
| Lobby | Host picks map, mode, **hiding style** (big cards with 3D previews) and timers; players press **Ready**; host presses **Start** |
| Team reveal | Players are split into Hiders and Seekers (fair rotation: people who seeked least seek first) |
| Preparation (30–60 s) | Seekers are blindfolded. Hiders paint themselves in the **Camouflage Studio** (P) and/or **transform** into an object (R), and find a spot |
| Hunt (1.5–5 min) | Hiders can only sneak slowly; standing still closes their eyes (eyelids take the body paint). Seekers poke suspicious spots |
| Results | Winners, finds, survival times, scores, XP, coins, achievements. **Play Again** or **Return to Lobby** |

**Desktop controls:** WASD move · mouse look (click the view to lock the pointer, Esc to release) ·
Space jump · Shift sprint · E interact (doors, lamps, toys) · P paint studio · R transform into the aimed
object · X turn back into a Hueling · V cancel the selected object · 1–5 abilities ·
left click / F poke (seeker) · C pose menu · T quick chat · G emotes · Q next spectator view.
In the paint studio: drag on yourself to paint, drag elsewhere (or right-drag) to rotate, Z/Y undo/redo.

**Mobile controls:** put a thumb anywhere on the left 42 % of the screen and a floating joystick appears
under it — movement is always relative to the camera (stick up = walk into the screen). Drag anywhere else
to turn the camera (both thumbs work at the same time). Tap the world to poke (seeker) or to select an
object to transform into (hider). Jump / Sprint / Poke buttons, ability buttons on the right, paint studio
as a bottom sheet. **Settings** has joystick sensitivity, touch-camera speed, mouse sensitivity and
invert X / invert Y.

### Hiding styles
| Style | What hiders do |
|---|---|
| 🎨 **Color Camouflage** | Paint the character (brush, fill part/all, patterns, eyedropper, poses, shapes) |
| 🪑 **Object Transformation** | Aim at a real object in the map (mouse crosshair on PC, reticle or tap on mobile) — it gets a green outline (red = not allowed, with the reason). The panel shows a 3D preview of the target; press **TRANSFORM** to become it. You keep moving with the normal controls, but with that object's size, collider, speed and movement style (jugs glide upright, balls roll, chairs tip-walk, ducks waddle…). Transform again into something else at any time, or press ↩ / X to become a Hueling again. Cooldown: 1.2 s during preparation, 6 s during the hunt |
| 🌀 **Hybrid Chaos** | Both: paint yourself *and/or* transform |

The server validates every transform: you must be a hider, it must be the right phase and style, the cooldown
must have passed, the object must exist and be transformable, be within 4.5 m, be in line of sight (not
through walls), and its collider must fit where you stand. During preparation the seekers' clients are not
even told which object anyone became.

### Voice chat
Open **🎧 Voice** in the lobby or in-game (V toggles the mic on desktop).
- **Voice chat on/off** joins the channel to listen; the microphone is only requested when you turn the mic on.
- **Who hears me?** *Everyone*, *My team* (only your team during a round, everyone in the lobby), or *Choose*
  (tick players). Your mic track is only sent to those players, so nobody else receives your audio.
- **🔈 Hear / 🔇 Muted** per player controls whom you hear. A voice volume slider is in Settings.
- Only in private rooms. Players who have been caught can only talk to other caught players until the round ends.
- Audio is peer-to-peer; the server only relays connection setup. Most Wi-Fi/mobile networks work with the
  default STUN servers. If some players can't connect (strict mobile networks), add a TURN server via
  `VOICE_TURN_URL`, `VOICE_TURN_USERNAME`, `VOICE_TURN_CREDENTIAL` (see `.env.example`).

### Game modes
1. **Classic** — seekers must find every hider before the timer ends.
2. **Infection** — caught hiders join the seekers.
3. **Everyone Hides** — everybody paints and hides; at the hunt your disguise becomes a statue and
   everyone hunts everyone else's statue for points.
4. **Team Battle** — Red vs Blue over two rounds, swapping roles; highest combined score wins.
5. **Chaos** — Classic plus random events: blackout (seekers get a flashlight), fog, colour storm,
   decoration shuffle, and limited-time bonus powers (Vanish / Radar).

### Abilities (all server-validated, with cooldowns)
| Hider | | Seeker | |
|---|---|---|---|
| Decoy | painted fake copy; poking it stuns the seeker | Scanner Pulse | rough zones where hiders lurk (14 m) |
| Freeze | fully still, eyes shut, invisible to scanner/sound/footprints | Footprint Vision | hider trails from the last 20 s |
| Color Shift | tint toward the nearest surface's colour | Sound Detection | direction of the nearest *moving* hider |
| Silent Steps | no footsteps or footprints | Speed Boost | +60% speed for 5 s |
| Quick Disguise | apply your saved camouflage preset, even mid-hunt | | |

### Maps
- **Cozy House** (rebuilt, two storeys): living room, kitchen, hallway, bedroom, bathroom, storage room,
  real staircase, kids' room and attic upstairs — every room furnished with hundreds of objects
- **MegaMart** (aisles with crawl-in shelf gaps, fridges, stockroom)
- **Sunnyvale School** (classrooms, library, gym, playground)
- **Toy World** (giant teddy, ball pit, crayon forest, dollhouse)
- **Rust Factory** (dim machinery hall, catwalk, storage rooms)
- **Skyline Office** *(new)*: open-plan desks, meeting room, break room, manager office, copy room
- **Bella Bistro** *(new)*: dining hall, bar, kitchen, pantry, restrooms

All maps are enclosed (walls, ceilings, windows, doors) and have ceiling lights, doors, lamps and
noise-making toys that are synchronised for all players. The camera uses multi-ray collision, never goes
under the floor and pulls in instead of clipping through walls or ceilings. Each map has its own music flavour.

---

## Architecture

```
client/  React + TypeScript + three.js / React Three Fiber / Drei + Tailwind + Zustand
server/  Node.js + Express (REST) + Socket.IO (realtime) + PostgreSQL (pg) / PGlite
shared/  Types, constants, map data, physics and game rules used by BOTH sides
e2e/     Socket-level integration tests, mode tests and browser (Playwright) E2E tests
```

- **Server-authoritative.** The server owns rooms, phases, timers, team assignment, tagging, abilities,
  scores, XP and rewards. Clients only send *intents* (move, paint op, tag point, ability id).
- **Movement** uses client-side prediction with the *same* shared physics code
  (`shared/src/game-rules/physics.ts`). The server validates every update against a speed budget,
  phase locks (blindfolded seekers, frozen hiders, slow hiders during the hunt), map bounds and wall
  collision, and sends corrections. Remote players are rendered ~110 ms in the past with interpolation.
- **Anti-cheat visibility.** During preparation seekers receive *no* hider positions and *no* hider paint
  data; vanished hiders are filtered out of seeker snapshots.
- **Tagging.** A seeker sends the 3D point they poked; the server checks range, line of sight against the
  map colliders, cooldown/stun, and that the point actually touches a hider, decoy or statue.
- **Maps are data** (`shared/src/maps/*`): the client turns props into merged, spatially-chunked meshes
  (≈35–55 draw calls per frame), the server builds a collision grid from the same props.
- **Painting.** Each Hueling's UVs are split into regions of a 512×512 canvas atlas. Paint operations
  (strokes, region fills, clears, pattern fills) are validated by the server, stored as an op log and
  replayed identically on every client, so undo/redo, reconnects and late joiners stay consistent.
  Environment textures and paint patterns come from the same procedural generators, and the eyedropper
  samples the true surface colour (vertex colour × texture texel in linear space), so camouflage matches.
- **Rewards are idempotent.** `match_players` has a `(match_id, player_id)` primary key; XP/coins/missions
  are only granted inside the transaction that inserts that row.

### Project layout (main files)
```
shared/src/types           network + domain types
shared/src/constants       timings, physics, abilities, modes, cosmetics, quick chat
shared/src/game-rules      physics.ts, rules.ts (teams, validation, colours), progression.ts
shared/src/maps            builder.ts + house / supermarket / school / toyworld / factory / office / restaurant
shared/src/props           registry.ts — every transformable object (size, collider, movement style, speed)
server/src/index.ts        bootstrap (Express, Socket.IO, static client)
server/src/network         socket handlers (validation + rate limiting)
server/src/rooms           Room, RoomPlayer, RoomManager (codes, cleanup, tick loop)
server/src/game-engine     Match.ts — phases, modes, movement validation, tagging, abilities, chaos
server/src/matchmaking     public matchmaking
server/src/database        schema.sql, db.ts (pg / PGlite), repo.ts (all queries)
server/src/security        auth (tokens, scrypt), rate limiting, input validation
server/src/api             REST routes
client/src/game            GameScreen, LocalPlayer, RemotePlayers, PaintController, HUD, effects,
                           transform.ts (targeting + requests), TransformUI.tsx (panel, preview, reticle)
client/src/props           models.ts (procedural 3D model for every registry object), PropView.tsx (animated disguise)
client/src/characters      Hueling jointed rig + animations, cosmetics, paint atlas, previews
client/src/maps            map mesh builder, procedural textures, scene
client/src/multiplayer     socket client + interpolation, REST client
client/src/screens         welcome, menu, lobby, customize/shop, social, settings
client/src/audio           synthesised SFX + procedural music
```

### Database schema
`server/src/database/schema.sql` — `players` (profile, XP, coins, cosmetics, owned items, stats),
`sessions` (hashed tokens), `matches`, `match_players` (dedupes rewards), `player_achievements`,
`daily_missions`, `friendships`.

### Security
- Guest accounts need only a nickname; optional username + password (scrypt) — no email or personal data.
- Session tokens are random 256-bit values stored only as SHA-256 hashes.
- All socket payloads are type-checked and rate-limited per socket and per event type; REST is rate-limited
  per IP. Paint ops are schema-validated and capped.
- Names are validated (charset, length, profanity filter); chat is preset-only, so there is no free text.
- Hosts can kick (kicked players cannot rejoin that room) and transfer ownership.
- No secrets in client code; configuration is server-side environment only.

---

## Testing

```bash
npm test                    # unit tests: physics, map spawns/colliders, rules, progression
npm run test:integration    # 2 real socket clients play a full match (rooms, anti-cheat, tagging, DB rewards,
                            # reconnection, host tools, matchmaking, friends, shop)
npm run test:modes          # Infection, Everyone Hides, Team Battle, Chaos + every ability, decoys, interactables
npm run test:props          # object transformation over sockets: range, line of sight, cooldown, fit, masking, revert
npm run test:voice          # 3 browsers with fake mics: real WebRTC audio + who-hears-me routing
npm run test:e2e            # builds the client, then (1) Color Camouflage: 2 Chromium clients + 1 emulated iPhone
                            # play a full match, and (2) Object Transformation: jug -> move -> other player sees it
                            # -> chair -> back to Hueling, camera/wall checks, mobile joystick/camera/multi-touch,
                            # tap-to-select + transform on an emulated iPhone
npm run test:props:e2e      # only part (2)
npm run test:all            # everything above
npm run gallery             # screenshots of every screen and map into e2e/screenshots/gallery
npx tsx e2e/tour.mjs        # interior screenshots of every map into e2e/screenshots/tour
npm run typecheck
```
The socket tests walk players through the maps with the game's real shared physics (`e2e/physwalk.mjs`), so
they also catch walls, stairs and doors that would block real players.

Run the integration tests against PostgreSQL by setting `DATABASE_URL` in the environment.
The browser tests use Playwright's Chromium (`npm i -D playwright && npx playwright install chromium`
if it is not already installed on your machine).

---

## Production build & deployment

```bash
npm run build
```

```bash
DATABASE_URL=postgres://... npm start
```

`npm run build` creates `client/dist` (static, code-split; each map is a lazily loaded chunk) and
`server/dist/index.js`. The server serves the client, the REST API (`/api`) and WebSockets
(`/socket.io`) from a single port — one process is all you need.

### Docker
```bash
docker compose up --build
```
starts PostgreSQL and the game on http://localhost:3001 (set `POSTGRES_PASSWORD` first).
Or build just the image with `docker build -t hue-and-seek .` and run it with `DATABASE_URL` set.

### One-click deploy on Render (works from a phone/tablet browser)
1. Push this repository to GitHub.
2. On https://render.com sign in with GitHub, then **New → Blueprint**, pick the repository and press **Apply**.
3. `render.yaml` creates the web service and a PostgreSQL database. When the deploy finishes, open the
   `https://<name>.onrender.com` URL and share it with friends.

Free-plan notes: the service sleeps after ~15 minutes without visitors (first load then takes up to a
minute), and Render's free PostgreSQL databases expire after a limited period; upgrade the plans in
`render.yaml` for a permanent setup.

### Hosting notes (Render, Railway, Fly.io, a VPS, ...)
- Run as a **single instance** (room state lives in memory). Scaling horizontally needs sticky sessions
  plus a shared room directory (e.g. the Socket.IO Redis adapter) — not included in this version.
- The platform must support WebSockets. Set `TRUST_PROXY=true` behind a proxy/load balancer.
- Use managed PostgreSQL or Supabase (its Postgres connection string works as `DATABASE_URL`,
  usually with `DATABASE_SSL=true`).
- Health check endpoint: `GET /api/health`.

---

## Known limitations / honest notes
- Performance was checked by measuring draw calls/triangles in the rebuilt house's living room
  (Low: ≈54 draw calls / 26k triangles; Medium: ≈89 / 76k; High: ≈89 / 81k plus the shadow pass) and by
  testing in headless Chromium with software WebGL and an emulated iPhone; it has **not** been profiled on
  physical phones. If a device struggles, switch Settings → Graphics to **Low** (no shadows, no reflections,
  lower resolution).
- Mobile touch controls were tested with emulated touch events on an emulated iPhone, not on a real device.
- When the camera would clip into a wall it moves closer to the player rather than fading the wall out.
- Textures are generated procedurally at runtime (128 px tiles), so there are no texture files to compress.
- Quick Disguise presets are stored per device (localStorage).
- Clients predict movement and the server validates it (speed, collisions, phase locks) rather than
  simulating every input on the server; this is the common approach for browser games.
- Room state is in memory: a server restart ends running matches (accounts and progress are persisted).
