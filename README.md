# Dream Football 11

An original 11v11 mobile football game: build your squad, buy collectible
player cards with coins earned in matches, and play quick matches or an
8-team knockout tournament against the CPU.

- Full-screen landscape match view — rotate the phone, hold it with two
  hands: virtual joystick under the left thumb, pass / shoot / tackle
  buttons under the right thumb, TV-style scorebug on the pitch.
- Game-style hub: player cards (rating, position, kit figure, stat strip),
  a 4-3-3 formation pitch for the squad screen, shield-badge team tiles.
- Accounts are created in-game with a name + email and start with a
  16-player starter squad and 500 coins.

All teams and players are fictional and original to this game — no real
club crests, player names, or likenesses.

## Layout

- `client/` — React game client (hub screens in `src/App.tsx`, match
  screen in `src/MatchScreen.tsx`, 11v11 engine in `src/engine.ts`)
- `server/` — typed actions and the game catalog (teams, players, rewards)
- `drizzle/` — database migrations

Note: this snapshot contains the text source. Binary assets
(`client/src/assets/stadium-hero.webp`, the app icon) live with the hosted
game and are not part of the snapshot push.
