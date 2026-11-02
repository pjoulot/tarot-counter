import {
  scoreFromSummary, type Bid, type DealResult, type DealSummary, type PlayerCount, type PoigneeLevel,
} from "./scoring";

/** Working name, until the real one is picked (spec.md §9, open decision 6). */
export const APP_NAME = "Feuille de Tarot";

export const ANIMALS = [
  "fox", "owl", "cat", "bear", "rabbit", "frog", "hedgehog", "raccoon", "penguin", "badger", "deer", "mouse",
] as const;
export type Animal = (typeof ANIMALS)[number];

export const COLORS = ["#F08A4B", "#3D7BF2", "#E0569B", "#7A5AF0", "#2FA36B", "#E0A100", "#1C9AA8", "#D64545"] as const;

/** A saved player. Games keep a copy of the look they had, and follow this record by `id` for display. */
export interface Player {
  id: string;
  name: string;
  animal: Animal;
  color: string;
  /** a small JPEG data URL, stored only on the phone */
  photo?: string | null;
  /** deleted from the list; kept so past games and stats still show them */
  archived?: boolean;
}

export type EntryMode = "points" | "cartes";
export type PasseRule = "next" | "same";

/** What the person typed, kept so a deal can be reopened and edited exactly as entered. */
export type DealInput =
  | { mode: "points"; quick: false; halfPoints: number }
  | { mode: "points"; quick: true; won: boolean; marginHalf: number }
  | {
      mode: "cartes"; bouts: { petit: boolean; vingtEtUn: boolean; excuse: boolean }; rois: number; dames: number; cavaliers: number; valets: number;
      /** the taker side's other cards: trumps and low cards, ½ point each */
      autres?: number;
      /** version 1.1 asked for tricks won instead of the other cards; still read when such a deal is reopened */
      tricks?: number;
    };

interface DealBase {
  id: string;
  dealer: number;
  at: number;
}
/**
 * House rule, off unless the table turns it on: a player holding no trumps (misère d'atout) or no
 * kings, queens, knights or jacks (misère de tête) wins `value` from each other player, whatever the
 * contract. Not FFT. The value is kept with the deal so changing the setting never rewrites old games.
 */
export interface Misere {
  /** seats with a misère d'atout */
  atout: number[];
  /** seats with a misère de tête */
  tete: number[];
  /** points won from each other player, per misère */
  value: number;
}
export const MISERE_VALUES = [10, 20] as const;

export interface PlayedDeal extends DealBase {
  kind?: "jouee";
  misere?: Misere | null;
  /** The summary the engine scores. Scores are never stored: they are always recomputed from this. */
  summary: Omit<DealSummary, "players">;
  input: DealInput;
}
/** Everybody passed: no points, the deal moves on (or not, per the table's rule). */
export interface PasseDeal extends DealBase {
  kind: "passe";
}
export type Deal = PlayedDeal | PasseDeal;

export function isPlayed(d: Deal): d is PlayedDeal {
  return d.kind !== "passe";
}

export interface Game {
  id: string;
  createdAt: number;
  players: Player[];
  firstDealer: number;
  deals: Deal[];
  finishedAt: number | null;
  /** set from "Changer le donneur"; cleared by the next deal */
  dealerOverride?: number | null;
  /** planned number of played deals (passes don't count); null or missing = no set length */
  targetDeals?: number | null;
  /** play until someone reaches this total; null or missing = no target score */
  targetScore?: number | null;
}

export interface ScoreOptions {
  /** round each deal to the nearest 10 before it is split, so the deal still sums to zero */
  round10: boolean;
}
const EXACT: ScoreOptions = { round10: false };

export function playerCount(game: Game): PlayerCount {
  return game.players.length as PlayerCount;
}

/** Rounds half away from zero: 25 → 30, −25 → −30, 62 → 60. */
export function roundTen(n: number): number {
  return Math.sign(n) * Math.round(Math.abs(n) / 10) * 10;
}

export function applyRounding(r: DealResult, opts: ScoreOptions): DealResult {
  if (!opts.round10) return r;
  const defender = r.scores.findIndex((_, i) => i !== r.taker && i !== r.partner);
  const unit = -(r.scores[defender] ?? 0); // what the taker side wins per defender
  if (unit === 0) return r;
  const rounded = roundTen(unit);
  return { ...r, scores: r.scores.map((s) => (s / unit) * rounded) };
}

/** Each seat's gain or loss from the misères of a deal; sums to zero. */
export function misereScores(players: number, m: Misere | null | undefined): number[] {
  const out: number[] = Array.from({ length: players }, () => 0);
  if (!m || m.value <= 0) return out;
  for (const seat of [...m.atout, ...m.tete]) {
    if (seat < 0 || seat >= players) continue;
    for (let i = 0; i < players; i++) out[i] = (out[i] ?? 0) + (i === seat ? m.value * (players - 1) : -m.value);
  }
  return out;
}

export function hasMisere(m: Misere | null | undefined): m is Misere {
  return !!m && m.value > 0 && m.atout.length + m.tete.length > 0;
}

/** The deal's score from the contract alone (after rounding), without any misère. */
export function contractScoreOf(game: Game, deal: Deal, opts: ScoreOptions = EXACT): DealResult | null {
  if (!isPlayed(deal)) return null;
  return applyRounding(scoreFromSummary({ ...deal.summary, players: playerCount(game) }), opts);
}

/** The deal's score for each seat: the contract, plus any misère. */
export function scoreOf(game: Game, deal: Deal, opts: ScoreOptions = EXACT): DealResult | null {
  const r = contractScoreOf(game, deal, opts);
  if (!r || !isPlayed(deal) || !hasMisere(deal.misere)) return r;
  const extra = misereScores(game.players.length, deal.misere);
  return { ...r, scores: r.scores.map((s, i) => s + (extra[i] ?? 0)) };
}

export function totals(game: Game, opts: ScoreOptions = EXACT): number[] {
  const t = game.players.map(() => 0);
  for (const d of game.deals) scoreOf(game, d, opts)?.scores.forEach((s, i) => { t[i] = (t[i] ?? 0) + s; });
  return t;
}

/** Running total after each deal, per seat, starting at 0. */
export function cumulative(game: Game, opts: ScoreOptions = EXACT): number[][] {
  const out = game.players.map(() => [0]);
  for (const d of game.deals) {
    const r = scoreOf(game, d, opts);
    out.forEach((line, i) => line.push((line[line.length - 1] ?? 0) + (r?.scores[i] ?? 0)));
  }
  return out;
}

/** Players ordered by total, best first. Ties share a place. */
export function ranking(game: Game, opts: ScoreOptions = EXACT): { seat: number; total: number; place: number }[] {
  const t = totals(game, opts);
  const order = t.map((total, seat) => ({ seat, total })).sort((a, b) => b.total - a.total || a.seat - b.seat);
  return order.map((r, i) => {
    const firstEqual = order.findIndex((o) => o.total === r.total);
    return { ...r, place: (firstEqual === -1 ? i : firstEqual) + 1 };
  });
}

/**
 * Who deals next. The deal passes to the next seat after every deal; after a passe it passes too,
 * unless the table's rule is that the same player redeals. "Changer le donneur" overrides it.
 */
export function nextDealer(game: Game, passeRule: PasseRule = "next"): number {
  if (game.dealerOverride !== undefined && game.dealerOverride !== null) return game.dealerOverride;
  const last = game.deals[game.deals.length - 1];
  if (!last) return game.firstDealer;
  if (!isPlayed(last) && passeRule === "same") return last.dealer;
  return (last.dealer + 1) % game.players.length;
}

export const GAME_LENGTHS = [5, 10, 15, 20] as const;
export const TARGET_SCORES = [500, 1000, 1500, 2000] as const;

/** Deals actually played: passes don't count towards a planned length. */
export function playedDeals(game: Game): number {
  return game.deals.filter(isPlayed).length;
}

/** The planned number of deals, or null when the game has no set length. */
export function plannedDeals(game: Game): number | null {
  return game.targetDeals ? game.targetDeals : null;
}

/** The leader's seat once someone has reached the target score, else null. */
export function scoreReached(game: Game, opts: ScoreOptions = EXACT): number | null {
  if (!game.targetScore) return null;
  const top = ranking(game, opts)[0];
  return top && top.total >= game.targetScore ? top.seat : null;
}

export interface Highlights {
  biggest: { seat: number; score: number } | null;
  bestTaker: { seat: number; won: number; taken: number } | null;
  deals: number;
}

export function highlights(game: Game, opts: ScoreOptions = EXACT): Highlights {
  let biggest: Highlights["biggest"] = null;
  const taken = game.players.map(() => ({ won: 0, taken: 0 }));
  for (const d of game.deals) {
    const r = scoreOf(game, d, opts);
    if (!r) continue;
    r.scores.forEach((s, seat) => { if (!biggest || s > biggest.score) biggest = { seat, score: s }; });
    const tk = taken[r.taker];
    if (tk) { tk.taken++; if (r.won) tk.won++; }
  }
  let bestTaker: Highlights["bestTaker"] = null;
  taken.forEach((t, seat) => {
    if (t.taken === 0) return;
    if (!bestTaker || t.won / t.taken > bestTaker.won / bestTaker.taken || (t.won / t.taken === bestTaker.won / bestTaker.taken && t.won > bestTaker.won))
      bestTaker = { seat, ...t };
  });
  return { biggest, bestTaker, deals: game.deals.filter(isPlayed).length };
}

export const CONTRACTS: readonly Bid[] = ["prise", "garde", "gardeSans", "gardeContre"];
export const POIGNEES: readonly PoigneeLevel[] = ["simple", "double", "triple"];

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** A light tint of a player colour, used behind their animal (the dark theme darkens it in CSS). */
export function tint(hex: string, amount = 0.22): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c * amount + 255 * (1 - amount));
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Suggest an animal and colour not already used. */
export function freshLook(taken: readonly Pick<Player, "animal" | "color">[], index: number): { animal: Animal; color: string } {
  const usedA = new Set(taken.map((p) => p.animal));
  const usedC = new Set(taken.map((p) => p.color));
  const animal = ANIMALS.find((a, i) => i >= index % ANIMALS.length && !usedA.has(a)) ?? ANIMALS.find((a) => !usedA.has(a)) ?? ANIMALS[index % ANIMALS.length] ?? "fox";
  const color = COLORS.find((c) => !usedC.has(c)) ?? COLORS[index % COLORS.length] ?? "#F08A4B";
  return { animal, color };
}

export function formatPoints(half: number, lang: string): string {
  const v = half / 2;
  return Number.isInteger(v) ? String(v) : v.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB", { minimumFractionDigits: 1 });
}

export function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0";
}
