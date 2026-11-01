/**
 * The few rules constants and types the scoring needs, copied from the tarot game's engine
 * (packages/engine/src: types.ts, variants.ts, bidding.ts). Keep them in step with the game.
 */

/** Thrown when a deal summary is impossible (e.g. more than 4 kings, a margin that can't happen). */
export class RuleError extends Error {}

export type PlayerCount = 3 | 4 | 5;

export type Bid = "prise" | "garde" | "gardeSans" | "gardeContre";
export const BID_MULTIPLIER: Record<Bid, number> = { prise: 1, garde: 2, gardeSans: 4, gardeContre: 6 };

export interface DealResult {
  taker: number;
  partner: number | null;
  contract: Bid;
  multiplier: number;
  /** half-points held by the taker's side (tricks + écart/chien as applicable) */
  takerHalfPoints: number;
  oudlers: number;
  /** half-points needed */
  neededHalfPoints: number;
  won: boolean;
  petitAuBout: -1 | 0 | 1; // +1 taker side, -1 defence, 0 none
  poigneeBonus: number;
  chelem: "none" | "made" | "madeAnnounced" | "failedAnnounced";
  /** signed score per player; sums to zero */
  scores: number[];
  /** the base score before multiplier and bonuses, for the score sheet */
  base: number;
}

/** Everything that differs by table size lives here. spec.md §2.10 */
export interface Variant {
  players: PlayerCount;
  handSize: number;
  chienSize: number;
  dealBatch: number;
  /** trumps required for simple / double / triple poignée */
  poignee: readonly [number, number, number];
  /** taker multiplier on the per-defender score when the taker has a partner (5p) or not */
  takerShare: (alone: boolean) => number;
  partnerShare: number;
  defenderCount: (alone: boolean) => number;
}

export const VARIANTS: Record<PlayerCount, Variant> = {
  3: {
    players: 3, handSize: 24, chienSize: 6, dealBatch: 4, poignee: [13, 15, 18],
    takerShare: () => 2, partnerShare: 0, defenderCount: () => 2,
  },
  4: {
    players: 4, handSize: 18, chienSize: 6, dealBatch: 3, poignee: [10, 13, 15],
    takerShare: () => 3, partnerShare: 0, defenderCount: () => 3,
  },
  5: {
    players: 5, handSize: 15, chienSize: 3, dealBatch: 3, poignee: [8, 10, 13],
    takerShare: (alone) => (alone ? 4 : 2), partnerShare: 1, defenderCount: (alone) => (alone ? 4 : 3),
  },
};

export const POIGNEE_BONUS: readonly [number, number, number] = [20, 30, 40];

/** half-points needed by oudler count. spec.md §2.7 */
export const NEEDED_HALF_POINTS: readonly number[] = [112, 102, 82, 72]; // 56, 51, 41, 36 pts

export function variant(players: PlayerCount): Variant {
  return VARIANTS[players];
}
