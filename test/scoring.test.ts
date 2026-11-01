import { describe, expect, it } from "vitest";
import {
  RuleError, scoreFromSummary, halfPointsFromCounts, cardsWonByTakerSide, halfPointsFromMargin,
  type DealSummary,
} from "../src/scoring";

/**
 * Scoring a deal from what players say at the table (spec §2.7–2.8, §2.10), used by the
 * score-counter app. Every expected number below is worked out by hand in the comment.
 * Points are given in half-points (47 pts = 94).
 */
const pts = (p: number) => Math.round(p * 2);
const five = (o: Partial<DealSummary>): DealSummary => ({
  players: 5, taker: 0, partner: 1, contract: "garde", oudlers: 2, takerHalfPoints: pts(47), ...o,
});

describe("scoreFromSummary — contracts and margins (5 players, with partner)", () => {
  it("garde, 2 bouts, 47 pts: fait de 6 → (25 + 6) × 2 = 62", () => {
    const r = scoreFromSummary(five({}));
    expect(r.won).toBe(true);
    expect(r.base).toBe(31);
    expect(r.scores).toEqual([124, 62, -62, -62, -62]);
  });

  it("prise, 1 bout, 48 pts: chuté de 3 → 25 + 3 = 28", () => {
    const r = scoreFromSummary(five({ contract: "prise", taker: 3, partner: 0, oudlers: 1, takerHalfPoints: pts(48) }));
    expect(r.won).toBe(false);
    expect(r.scores).toEqual([-28, 28, 28, -56, 28]);
  });

  it("garde sans, 3 bouts, 40 pts: fait de 4 → 29 × 4 = 116", () => {
    const r = scoreFromSummary(five({ contract: "gardeSans", oudlers: 3, takerHalfPoints: pts(40) }));
    expect(r.scores).toEqual([232, 116, -116, -116, -116]);
  });

  it("garde contre, 0 bout, 60 pts: fait de 4 → 29 × 6 = 174", () => {
    const r = scoreFromSummary(five({ contract: "gardeContre", oudlers: 0, takerHalfPoints: pts(60) }));
    expect(r.scores).toEqual([348, 174, -174, -174, -174]);
  });

  it("exactly the points needed counts as made, by 0 → 25", () => {
    const r = scoreFromSummary(five({ contract: "prise", oudlers: 3, takerHalfPoints: pts(36) }));
    expect(r.won).toBe(true);
    expect(r.scores[1]).toBe(25);
  });

  it("40.5 pts with 2 bouts loses by 0.5, and the half point counts as a full one → 26", () => {
    const r = scoreFromSummary(five({ contract: "prise", takerHalfPoints: pts(40.5) }));
    expect(r.won).toBe(false);
    expect(r.base).toBe(26);
    expect(r.scores).toEqual([-52, -26, 26, 26, 26]);
  });

  it("41.5 pts with 2 bouts wins by 0.5 → 26", () => {
    const r = scoreFromSummary(five({ contract: "prise", takerHalfPoints: pts(41.5) }));
    expect(r.won).toBe(true);
    expect(r.scores[0]).toBe(52);
  });
});

describe("scoreFromSummary — taker alone at 5", () => {
  it("partner null: garde, 2 bouts, 45 pts → 29 × 2 = 58, taker gets 4×", () => {
    const r = scoreFromSummary(five({ partner: null, takerHalfPoints: pts(45) }));
    expect(r.partner).toBeNull();
    expect(r.scores).toEqual([232, -58, -58, -58, -58]);
  });

  it("calling one's own Roi (partner = taker) is the same as alone", () => {
    const a = scoreFromSummary(five({ partner: null, takerHalfPoints: pts(45) }));
    const b = scoreFromSummary(five({ partner: 0, takerHalfPoints: pts(45) }));
    expect(b.scores).toEqual(a.scores);
  });

  it("alone and chuté: prise, 1 bout, 48 pts → taker −112, each defender +28", () => {
    const r = scoreFromSummary(five({ contract: "prise", partner: null, oudlers: 1, takerHalfPoints: pts(48) }));
    expect(r.scores).toEqual([-112, 28, 28, 28, 28]);
  });
});

describe("scoreFromSummary — petit au bout (multiplied)", () => {
  it("taker side, deal made: (31 + 10) × 2 = 82", () => {
    const r = scoreFromSummary(five({ petitAuBout: 1 }));
    expect(r.scores[1]).toBe(82);
  });

  it("defence, deal made: (31 − 10) × 2 = 42", () => {
    const r = scoreFromSummary(five({ petitAuBout: -1 }));
    expect(r.scores[1]).toBe(42);
  });

  it("taker side, deal chuté de 3: 28 − 10 = 18 against the taker", () => {
    const r = scoreFromSummary(five({ contract: "prise", oudlers: 1, takerHalfPoints: pts(48), petitAuBout: 1 }));
    expect(r.scores).toEqual([-36, -18, 18, 18, 18]);
  });

  it("defence, deal chuté de 3: 28 + 10 = 38 against the taker", () => {
    const r = scoreFromSummary(five({ contract: "prise", oudlers: 1, takerHalfPoints: pts(48), petitAuBout: -1 }));
    expect(r.scores).toEqual([-76, -38, 38, 38, 38]);
  });
});

describe("scoreFromSummary — poignées (not multiplied, to the side that wins the deal)", () => {
  it("simple poignée, deal made: 62 + 20 = 82", () => {
    const r = scoreFromSummary(five({ poignees: ["simple"] }));
    expect(r.poigneeBonus).toBe(20);
    expect(r.scores).toEqual([164, 82, -82, -82, -82]);
  });

  it("simple poignée, deal chuté: the defence gets it, 28 + 20 = 48", () => {
    const r = scoreFromSummary(five({ contract: "prise", oudlers: 1, takerHalfPoints: pts(48), poignees: ["simple"] }));
    expect(r.scores).toEqual([-96, -48, 48, 48, 48]);
  });

  it("two poignées add up: simple + double = 50, garde made → 62 + 50 = 112", () => {
    const r = scoreFromSummary(five({ poignees: ["simple", "double"] }));
    expect(r.poigneeBonus).toBe(50);
    expect(r.scores[1]).toBe(112);
  });

  it("triple poignée is 40", () => {
    expect(scoreFromSummary(five({ poignees: ["triple"] })).poigneeBonus).toBe(40);
  });
});

describe("scoreFromSummary — chelem", () => {
  it("announced and made: garde, 3 bouts, 91 pts → (25 + 55) × 2 + 400 = 560", () => {
    const r = scoreFromSummary(five({ oudlers: 3, takerHalfPoints: pts(91), chelem: "madeAnnounced" }));
    expect(r.scores).toEqual([1120, 560, -560, -560, -560]);
  });

  it("made without announcement: + 200 → 360", () => {
    const r = scoreFromSummary(five({ oudlers: 3, takerHalfPoints: pts(91), chelem: "made" }));
    expect(r.scores[1]).toBe(360);
  });

  it("announced and failed, deal still made: 62 − 200 = −138 for the taker side", () => {
    const r = scoreFromSummary(five({ chelem: "failedAnnounced" }));
    expect(r.scores).toEqual([-276, -138, 138, 138, 138]);
  });

  it("announced and failed, deal chuté: −28 − 200 = −228", () => {
    const r = scoreFromSummary(five({ contract: "prise", oudlers: 1, takerHalfPoints: pts(48), chelem: "failedAnnounced" }));
    expect(r.scores[1]).toBe(-228);
  });
});

describe("scoreFromSummary — 3 and 4 players", () => {
  it("4 players, garde fait de 6: taker 3 × 62", () => {
    const r = scoreFromSummary({ players: 4, taker: 2, partner: null, contract: "garde", oudlers: 2, takerHalfPoints: pts(47) });
    expect(r.scores).toEqual([-62, -62, 186, -62]);
  });

  it("4 players, prise chuté de 3: taker −84", () => {
    const r = scoreFromSummary({ players: 4, taker: 0, partner: null, contract: "prise", oudlers: 1, takerHalfPoints: pts(48) });
    expect(r.scores).toEqual([-84, 28, 28, 28]);
  });

  it("3 players, garde fait de 6: taker 2 × 62", () => {
    const r = scoreFromSummary({ players: 3, taker: 1, partner: null, contract: "garde", oudlers: 2, takerHalfPoints: pts(47) });
    expect(r.scores).toEqual([-62, 124, -62]);
  });

  it("3 players, garde contre, 3 bouts, 50 pts: fait de 14 → 39 × 6 = 234", () => {
    const r = scoreFromSummary({ players: 3, taker: 0, partner: null, contract: "gardeContre", oudlers: 3, takerHalfPoints: pts(50) });
    expect(r.scores).toEqual([468, -234, -234]);
  });
});

describe("scoreFromSummary — invariants and input checks", () => {
  it("every deal sums to zero", () => {
    for (const players of [3, 4, 5] as const)
      for (const contract of ["prise", "garde", "gardeSans", "gardeContre"] as const)
        for (const oudlers of [0, 1, 2, 3] as const)
          for (const half of [0, 71, 82, 101, 150, 182])
            for (const partner of players === 5 ? [null, 2] : [null]) {
              const r = scoreFromSummary({
                players, taker: 1, partner, contract, oudlers, takerHalfPoints: half,
                petitAuBout: -1, poignees: ["simple"], chelem: half === 182 ? "made" : "none",
              });
              expect(r.scores.reduce((a, b) => a + b, 0)).toBe(0);
            }
  });

  it("rejects points outside 0–91 or not on a half point", () => {
    expect(() => scoreFromSummary(five({ takerHalfPoints: 183 }))).toThrow(RuleError);
    expect(() => scoreFromSummary(five({ takerHalfPoints: -1 }))).toThrow(RuleError);
    expect(() => scoreFromSummary(five({ takerHalfPoints: 94.5 }))).toThrow(RuleError);
  });

  it("rejects more than 3 bouts", () => {
    expect(() => scoreFromSummary(five({ oudlers: 4 as 3 }))).toThrow(RuleError);
  });

  it("rejects a partner at 3 or 4 players, and seats that don't exist", () => {
    expect(() => scoreFromSummary({ players: 4, taker: 0, partner: 1, contract: "prise", oudlers: 1, takerHalfPoints: 100 })).toThrow(RuleError);
    expect(() => scoreFromSummary(five({ taker: 5 }))).toThrow(RuleError);
    expect(() => scoreFromSummary(five({ partner: 7 }))).toThrow(RuleError);
  });
});

describe("helpers for entering a deal", () => {
  it("halfPointsFromMargin: fait de 6 with 2 bouts is 47; chuté de 3 with 1 bout is 48", () => {
    expect(halfPointsFromMargin(2, true, pts(6))).toBe(pts(47));
    expect(halfPointsFromMargin(1, false, pts(3))).toBe(pts(48));
    expect(halfPointsFromMargin(3, true, 0)).toBe(pts(36));
  });

  it("halfPointsFromMargin rejects a margin that leaves the 0–91 range", () => {
    expect(() => halfPointsFromMargin(0, false, pts(57))).toThrow(RuleError);
    expect(() => halfPointsFromMargin(3, true, pts(56))).toThrow(RuleError);
  });

  it("cardsWonByTakerSide: tricks × players, plus the chien except in garde contre", () => {
    expect(cardsWonByTakerSide(5, 8, "garde")).toBe(43);
    expect(cardsWonByTakerSide(5, 8, "gardeSans")).toBe(43);
    expect(cardsWonByTakerSide(5, 8, "gardeContre")).toBe(40);
    expect(cardsWonByTakerSide(4, 18, "prise")).toBe(78);
    expect(cardsWonByTakerSide(3, 10, "garde")).toBe(36);
  });

  it("halfPointsFromCounts: the whole deck is 91 points", () => {
    expect(halfPointsFromCounts({ oudlers: 3, rois: 4, dames: 4, cavaliers: 4, valets: 4, cards: 78 })).toBe(182);
  });

  it("halfPointsFromCounts: 2 bouts, 2 Rois, 1 Dame, 2 Cavaliers, 1 Valet in 43 cards → 45.5", () => {
    // 9+9 + 9+9 + 7 + 5+5 + 3 = 56, plus 35 small cards × 1 = 91 half-points
    expect(halfPointsFromCounts({ oudlers: 2, rois: 2, dames: 1, cavaliers: 2, valets: 1, cards: 43 })).toBe(pts(45.5));
  });

  it("halfPointsFromCounts rejects impossible counts", () => {
    expect(() => halfPointsFromCounts({ oudlers: 0, rois: 5, dames: 0, cavaliers: 0, valets: 0, cards: 20 })).toThrow(RuleError);
    expect(() => halfPointsFromCounts({ oudlers: 3, rois: 4, dames: 0, cavaliers: 0, valets: 0, cards: 5 })).toThrow(RuleError);
    expect(() => halfPointsFromCounts({ oudlers: 0, rois: 0, dames: 0, cavaliers: 0, valets: 0, cards: 79 })).toThrow(RuleError);
  });
});
