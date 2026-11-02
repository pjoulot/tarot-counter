# Tarot : compteur de points (Tarot Points)

Free score counter for French Tarot at the table (3, 4 or 5 players, FFT rules), from the Kalostoria studio. No account, no ads, works offline. Everything is stored on the phone.

Scoring lives in `src/scoring/`, a copy of the scoring code from the tarot game's rules engine, so the counter and the game score deals the same way. If a scoring rule ever changes, change it in the game first (it has the tests for the whole engine), then copy `summary.ts` here; `test/scoring.test.ts` holds the same hand-scored tests.

## Install it on your Android phone

```sh
pnpm install          # once
pnpm android:apk
```

That builds the web app, copies it into the Android project, runs Gradle, and leaves `tarot-points.apk` at the root of the repo.
If a phone is plugged in with USB debugging on, it installs it straight away; otherwise send the APK to the phone and open it
(Android asks once to allow installs from that app).

It needs the Android SDK (installed by Android Studio, found in `~/Android/Sdk` or `$ANDROID_HOME`) and Java 21
(`$JAVA_HOME`, or the one bundled with Android Studio). The first build downloads Gradle and takes a few minutes.
`pnpm android:open` opens the project in Android Studio instead.

## Run it in a browser

```sh
pnpm dev      # http://localhost:5174, also on your LAN for a phone
pnpm test     # scoring rules + app logic
pnpm build    # static site in dist/ (installable PWA)
```

## What's in it

Follows the "C — Convivial" design canvas:

- **First launch** and **home**: game in progress, previous games, statistics, rules, settings.
- **New game**: seats in table order (drag to reorder), saved players from "Qui joue ?" or "Souvent avec vous", who deals first, and how the game ends: when you decide (default), after 5/10/15/20 played deals (passes don’t count), or when a player reaches 500/1000/1500/2000 points.
- **Players**: saved players with an animal, a colour or their own photo (cropped on the phone, never sent anywhere). Deleting a player keeps them in past games and stats.
- **Score sheet**: ranking with bars, deal-by-deal table (with a totals row that stays above the buttons) or running-total chart, tap a deal for its detail, "Terminer" next to "Nouvelle donne" (asks first; a game with a planned length or target score offers "Voir les résultats" once it is reached; with a target score, a line under the ranking says how far the leader is), "…" menu (undo last deal, change the dealer, edit players).
- **Deal entry**: points, "fait / chuté de…", or card by card (bouts, R/D/C/V, then the other cards: trumps and low cards, écart included, chien added in garde sans and left out in garde contre); bonus sheet (petit au bout, poignées, chelem); "tout le monde passe".
- **End of game**: podium, highlights, share, play again with the same table.
- **Statistics**: all games or last 30 days; per player wins, points, takes made by contract, best deal, best partner, last 10 games.
- **About** ("Qui fait l’app ?", under the rules in settings): who makes the app, and a donation button.
- **Settings**: default entry mode, who deals after a passe (FFT: next player; or the same player), round scores to the nearest 10, show the calculation, language (fr/en), theme (auto/light/dark), backup export/import, CSV export.

## How it works

- `src/scoring/` — tarot scoring (contracts, bouts, petit au bout, poignées, chelem, how points split between taker, partner and defenders), copied from the game's engine.
- `src/model.ts` — players, games and deals. Scores are never stored: each deal keeps the summary the scoring works from, plus what was typed so it can be reopened and edited exactly as entered. Passes are deals with no score. Dealer rotation and rounding live here.
- `src/stats.ts` — statistics and CSV export (one row per player per deal).
- `src/storage.ts` — one versioned JSON document in `localStorage`; version 1 data (players by name) is migrated to saved players with ids.
- `src/native.ts` — on the phone: back button, share sheet, saving files, status-bar colour. In a browser it falls back to web features.
- `src/i18n.ts` — French and English. Contract names stay in French in both.
- `src/screens/*` — one file per screen; navigation is a stack mirrored in browser history so the back button works.
- `android/` — Capacitor project (`capacitor.config.ts`). The fox is the launcher icon and splash.

## Not done yet

- Names: "Tarot Points" under the icon (`APP_NAME` in `src/model.ts`, `capacitor.config.ts`, `android/app/src/main/res/values/strings.xml`); store titles "Tarot : compteur de points" and "French Tarot: Score Counter". A studio Kalostoria app.
- `appId` `com.kalostoria.tarotcounter` becomes permanent with the first Play Store upload.
- Release signing and the Play Store listing. iOS later.
- Donations: set `DONATE_URL` in `src/screens/About.tsx` (until then the button shows as unavailable). The Android app hides the
  button (`DONATE_IN_ANDROID = false`): Google Play generally wants payments made inside a Play app to go through Play Billing,
  and apps linking out to a donation page risk rejection. A Play Billing "tip" is the safe way to offer it there later.
- 6 or more players, sharing the final sheet as an image.
