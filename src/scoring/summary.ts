import { BID_MULTIPLIER, NEEDED_HALF_POINTS, POIGNEE_BONUS, RuleError, variant, type Bid, type DealResult, type PlayerCount } from "./rules.js";

/**
 * Scoring a deal from a summary of what happened, rather than from the cards played.
 * The score-counter app uses this directly; `scoreDeal` counts the cards and then calls it,
 * so both always agree. spec.md §2.7, §2.8, §2.10
 */

export type PoigneeLevel = "simple" | "double" | "triple";
const POIGNEE_INDEX: Record<PoigneeLevel, 0 | 1 | 2> = { simple: 0, double: 1, triple: 2 };

export interface DealSummary {
  players: PlayerCount;
  taker: number;
  /** 5 players: the called partner's seat; `null` or the taker's own seat when the taker is alone. Always `null` at 3 and 4. */
  partner: number | null;
  contract: Bid;
  /** oudlers (bouts) in the taker side's cards */
  oudlers: 0 | 1 | 2 | 3;
  /** card points of the taker's side, in half-points (47 pts = 94), 0..182 */
  takerHalfPoints: number;
  /** side that won the last trick with the Petit: +1 taker side, −1 defence, 0 none */
  petitAuBout?: -1 | 0 | 1;
  /** every poignée shown during the deal, whoever showed it */
  poignees?: readonly PoigneeLevel[];
  chelem?: DealResult["chelem"];
}

const TOTAL_HALF_POINTS = 182;

function check(ok: boolean, msg: string): asserts ok {
  if (!ok) throw new RuleError(msg);
}

export function scoreFromSummary(s: DealSummary): DealResult {
  const n = s.players;
  const v = variant(n);
  check(Number.isInteger(s.taker) && s.taker >= 0 && s.taker < n, `taker ${s.taker} is not a seat`);
  check([0, 1, 2, 3].includes(s.oudlers), `bad oudler count ${s.oudlers}`);
  check(
    Number.isInteger(s.takerHalfPoints) && s.takerHalfPoints >= 0 && s.takerHalfPoints <= TOTAL_HALF_POINTS,
    `taker points must be 0–91 in half points, got ${s.takerHalfPoints / 2}`,
  );
  if (s.partner !== null) {
    check(n === 5, "only 5-player deals have a partner");
    check(Number.isInteger(s.partner) && s.partner >= 0 && s.partner < n, `partner ${s.partner} is not a seat`);
  }
  const alone = s.partner === null || s.partner === s.taker;
  const side = alone ? [s.taker] : [s.taker, s.partner as number];

  const needed = NEEDED_HALF_POINTS[s.oudlers] as number;
  const won = s.takerHalfPoints >= needed;
  const diffHalf = Math.abs(s.takerHalfPoints - needed);
  // 25 + difference, difference rounded up to the next full point (0.5 counts as 1)
  const base = 25 + Math.ceil(diffHalf / 2);

  const petitAuBout = s.petitAuBout ?? 0;
  const pabForWinner = petitAuBout === 0 ? 0 : (won ? petitAuBout : -petitAuBout) * 10;

  const multiplier = BID_MULTIPLIER[s.contract];
  const poigneeBonus = (s.poignees ?? []).reduce((t, p) => t + (POIGNEE_BONUS[POIGNEE_INDEX[p]] as number), 0);
  const result = (base + pabForWinner) * multiplier + poigneeBonus; // for whoever wins the deal
  let takerResult = won ? result : -result;

  const chelem = s.chelem ?? "none";
  if (chelem === "madeAnnounced") takerResult += 400;
  else if (chelem === "made") takerResult += 200;
  else if (chelem === "failedAnnounced") takerResult -= 200;

  const scores = Array.from({ length: n }, () => 0);
  scores[s.taker] = v.takerShare(alone) * takerResult;
  if (!alone) scores[s.partner as number] = v.partnerShare * takerResult;
  for (let i = 0; i < n; i++) if (!side.includes(i)) scores[i] = -takerResult;

  return {
    taker: s.taker,
    partner: alone ? null : s.partner,
    contract: s.contract,
    multiplier,
    takerHalfPoints: s.takerHalfPoints,
    oudlers: s.oudlers,
    neededHalfPoints: needed,
    won,
    petitAuBout,
    poigneeBonus,
    chelem,
    scores,
    base,
  };
}

/** "Fait de 6" / "chuté de 3" → the taker side's points, in half-points. */
export function halfPointsFromMargin(oudlers: 0 | 1 | 2 | 3, won: boolean, marginHalf: number): number {
  check(Number.isInteger(marginHalf) && marginHalf >= 0, "margin must be a whole number of half points");
  const needed = NEEDED_HALF_POINTS[oudlers] as number;
  const half = won ? needed + marginHalf : needed - marginHalf;
  check(half >= 0 && half <= TOTAL_HALF_POINTS, "that margin is not possible with this many bouts");
  return half;
}

/**
 * Number of cards the taker's side ends with: every trick won, plus the écart (prise, garde)
 * or the chien (garde sans). In garde contre the chien goes to the defence. The Excuse
 * exchange swaps a card for a card, so the count holds.
 */
export function cardsWonByTakerSide(players: PlayerCount, tricks: number, contract: Bid): number {
  const v = variant(players);
  check(Number.isInteger(tricks) && tricks >= 0 && tricks <= v.handSize, `tricks must be 0–${v.handSize}`);
  return tricks * players + (contract === "gardeContre" ? 0 : v.chienSize);
}

export interface CardCounts {
  oudlers: number;
  rois: number;
  dames: number;
  cavaliers: number;
  valets: number;
  /** all cards held by the side, honours included */
  cards: number;
}

/** Points from counting honours: every card not listed is worth 0.5. spec.md §2.2 */
export function halfPointsFromCounts(c: CardCounts): number {
  check(c.oudlers >= 0 && c.oudlers <= 3, "at most 3 bouts");
  for (const k of ["rois", "dames", "cavaliers", "valets"] as const) check(c[k] >= 0 && c[k] <= 4, `at most 4 ${k}`);
  const honours = c.oudlers + c.rois + c.dames + c.cavaliers + c.valets;
  check(c.cards >= honours && c.cards <= 78, "card count does not match the honours");
  return c.oudlers * 9 + c.rois * 9 + c.dames * 7 + c.cavaliers * 5 + c.valets * 3 + (c.cards - honours);
}
