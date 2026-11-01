# Feuille de Tarot — project conventions

Free score counter for French Tarot (3/4/5 players, FFT rules): React + Vite web app (installable PWA) and an Android app
via Capacitor. No account, no ads; everything is stored on the phone. Read `README.md` first.

## Layout
- `src/scoring/` — tarot scoring copied from the tarot game's engine (`packages/engine/src/summary.ts` in the game repo).
  Don't change scoring here on its own: change it in the game first, then copy it over, so both keep scoring alike.
- `src/model.ts`, `src/stats.ts`, `src/storage.ts` — app logic; `src/screens/*` — one file per screen.
- `android/` — Capacitor project.

## Conventions
- pnpm. `pnpm test`, `pnpm typecheck`, `pnpm build`.
- TypeScript strict, `noUncheckedIndexedAccess`. No `any`.
- Game terms stay in French in code and UI: `prise`, `garde`, `gardeSans`, `gardeContre`, `chien`, `poignee`, `chelem`,
  `petitAuBout`, `excuse`, `oudler`.
- Every user-facing string goes through `src/i18n.ts`, in French and English.
- Tests are behaviour-level. Scoring rules are test-first, with hand-worked numbers in the test comments.
