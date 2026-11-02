import { describe, expect, it } from "vitest";
import {
  applyRounding, cumulative, highlights, misereScores, nextDealer, plannedDeals, playedDeals, ranking, scoreReached, roundTen, scoreOf, tint, totals,
  type Deal, type Game, type Misere, type PlayedDeal,
} from "../src/model";
import { newPlayer, parseBackup, touchPlayers } from "../src/storage";
import { countedGames, playerStats, rankedPlayers, tableStats, toCsv } from "../src/stats";

const P = (name: string) => ({ id: name.toLowerCase(), name, animal: "fox" as const, color: "#F08A4B" });
const EXACT = { round10: false };
const ROUND = { round10: true };

function game5(deals: (PlayedDeal["summary"] | "passe")[], extra: Partial<Game> = {}): Game {
  return {
    id: "g", createdAt: 0, firstDealer: 2, finishedAt: null,
    players: ["Marie", "Luc", "Sophie", "Karim", "Anne"].map(P),
    deals: deals.map((d, i): Deal => (d === "passe"
      ? { id: String(i), at: i, dealer: 0, kind: "passe" }
      : { id: String(i), at: i, dealer: 0, summary: d, input: { mode: "points", quick: false, halfPoints: d.takerHalfPoints } })),
    ...extra,
  };
}

/** The four deals shown on the design canvas. */
const canvasDeals: PlayedDeal["summary"][] = [
  { taker: 0, partner: 1, contract: "garde", oudlers: 2, takerHalfPoints: 94 }, // fait de 6
  { taker: 3, partner: 2, contract: "prise", oudlers: 1, takerHalfPoints: 96 }, // chuté de 3
  { taker: 4, partner: 0, contract: "garde", oudlers: 2, takerHalfPoints: 86 }, // fait de 2
  { taker: 1, partner: 3, contract: "prise", oudlers: 1, takerHalfPoints: 108 }, // fait de 3
];

describe("running totals", () => {
  it("adds each deal's scores and always sums to zero", () => {
    const t = totals(game5(canvasDeals));
    expect(t).toEqual([124 + 28 + 54 - 28, 62 + 28 - 54 + 56, -62 - 28 - 54 - 28, -62 - 56 - 54 + 28, -62 + 28 + 108 - 28]);
    expect(t.reduce((a, b) => a + b, 0)).toBe(0);
  });

  it("a passe scores nothing and is skipped in totals", () => {
    expect(totals(game5([...canvasDeals.slice(0, 2), "passe", ...canvasDeals.slice(2)]))).toEqual(totals(game5(canvasDeals)));
    expect(scoreOf(game5(["passe"]), { id: "x", at: 0, dealer: 0, kind: "passe" })).toBeNull();
  });

  it("running totals start at 0 and step once per deal, passes included", () => {
    const c = cumulative(game5([canvasDeals[0] as PlayedDeal["summary"], "passe"]));
    expect(c[0]).toEqual([0, 124, 124]);
    expect(c.every((line) => line.length === 3)).toBe(true);
  });

  it("ranks best first and gives tied players the same place", () => {
    const g = game5([{ taker: 0, partner: 1, contract: "garde", oudlers: 2, takerHalfPoints: 94 }]);
    expect(ranking(g).map((r) => [r.seat, r.place])).toEqual([[0, 1], [1, 2], [2, 3], [3, 3], [4, 3]]);
  });

  it("highlights the biggest single score and the best taker, ignoring passes", () => {
    const h = highlights(game5([...canvasDeals, "passe"]));
    expect(h.biggest).toEqual({ seat: 0, score: 124 });
    expect(h.deals).toBe(4);
  });
});

describe("who deals next", () => {
  const withDealers = (dealers: number[], kinds: ("jouee" | "passe")[]): Game => {
    const g = game5(kinds.map((k) => (k === "passe" ? "passe" : canvasDeals[0] as PlayedDeal["summary"])));
    g.deals = g.deals.map((d, i) => ({ ...d, dealer: dealers[i] ?? 0 }));
    return g;
  };

  it("starts with the chosen first dealer, then moves one seat each deal", () => {
    expect(nextDealer(game5([]))).toBe(2);
    expect(nextDealer(withDealers([2], ["jouee"]))).toBe(3);
    expect(nextDealer(withDealers([4], ["jouee"]))).toBe(0);
  });

  it("after a passe the next player deals (FFT) unless the table says the same player redeals", () => {
    const g = withDealers([3], ["passe"]);
    expect(nextDealer(g, "next")).toBe(4);
    expect(nextDealer(g, "same")).toBe(3);
  });

  it("a manual dealer change wins until the next deal", () => {
    expect(nextDealer({ ...withDealers([2], ["jouee"]), dealerOverride: 0 })).toBe(0);
  });
});

describe("game length", () => {
  const d = canvasDeals[0] as PlayedDeal["summary"];

  it("has no planned end unless a number of deals was chosen", () => {
    expect(plannedDeals(game5([]))).toBeNull();
    expect(plannedDeals(game5([], { targetDeals: null }))).toBeNull();
    expect(plannedDeals(game5([], { targetDeals: 10 }))).toBe(10);
  });

  it("counts only played deals towards the planned length, not passes", () => {
    expect(playedDeals(game5([d, "passe", d]))).toBe(2);
  });

  it("ends on a target score once the leader reaches it", () => {
    // After the canvas deals Marie leads with 178 (see "running totals").
    expect(scoreReached(game5(canvasDeals))).toBeNull();
    expect(scoreReached(game5(canvasDeals, { targetScore: 200 }))).toBeNull();
    expect(scoreReached(game5(canvasDeals, { targetScore: 178 }))).toBe(0);
  });
});

describe("misère (house rule)", () => {
  const withMisere = (m: Misere | null): Game => {
    const g = game5([canvasDeals[0] as PlayedDeal["summary"]]);
    g.deals = g.deals.map((d) => ({ ...d, misere: m }));
    return g;
  };

  it("wins the value from each other player and sums to zero", () => {
    // 5 players, 10 points: the holder gets 4 × 10 = +40, everyone else −10.
    expect(misereScores(5, { atout: [3], tete: [], value: 10 })).toEqual([-10, -10, -10, 40, -10]);
    expect(misereScores(5, { atout: [3], tete: [1], value: 20 }).reduce((a, b) => a + b, 0)).toBe(0);
  });

  it("counts both kinds, even held by the same player", () => {
    // Luc (seat 1) has both: 2 × (4 × 10) = +80; others −20 each.
    expect(misereScores(5, { atout: [1], tete: [1], value: 10 })).toEqual([-20, 80, -20, -20, -20]);
  });

  it("is added to the contract's score, whatever the contract's result", () => {
    // Canvas deal 1: Marie +124, Luc +62, others −62. Karim (seat 3) misère d'atout at 10: +40, others −10.
    expect(totals(withMisere({ atout: [3], tete: [], value: 10 }))).toEqual([114, 52, -72, -22, -72]);
  });

  it("changes nothing when there is none", () => {
    expect(totals(withMisere(null))).toEqual(totals(game5([canvasDeals[0] as PlayedDeal["summary"]])));
    expect(totals(withMisere({ atout: [], tete: [], value: 10 }))).toEqual(totals(game5([canvasDeals[0] as PlayedDeal["summary"]])));
  });

  it("is added after rounding, so rounding only touches the contract", () => {
    // Canvas deal 2 is rounded on the contract alone; then Anne (seat 4) adds her misère: +40, others −10.
    const g = game5([canvasDeals[1] as PlayedDeal["summary"]]);
    const plain = totals(g, ROUND);
    g.deals = g.deals.map((d) => ({ ...d, misere: { atout: [4], tete: [], value: 10 } }));
    expect(totals(g, ROUND)).toEqual(plain.map((v, i) => v + (i === 4 ? 40 : -10)));
  });
});

describe("rounding to the nearest ten", () => {
  it("rounds half away from zero", () => {
    expect([62, 25, 116, 26, -25, -64, 0].map(roundTen)).toEqual([60, 30, 120, 30, -30, -60, 0]);
  });

  it("rounds the deal before splitting it, so it still sums to zero", () => {
    const g = game5([{ taker: 0, partner: 1, contract: "garde", oudlers: 2, takerHalfPoints: 94 }]);
    const r = scoreOf(g, g.deals[0] as Deal, ROUND);
    expect(r?.scores).toEqual([120, 60, -60, -60, -60]);
    expect(totals(g, ROUND).reduce((a, b) => a + b, 0)).toBe(0);
  });

  it("alone at 5 (taker ×4): 29 rounds to 30 → taker +120", () => {
    const g = game5([{ taker: 2, partner: null, contract: "prise", oudlers: 2, takerHalfPoints: 90 }]);
    expect(scoreOf(g, g.deals[0] as Deal, ROUND)?.scores).toEqual([-30, -30, 120, -30, -30]);
  });

  it("does nothing when switched off", () => {
    const g = game5(canvasDeals);
    const r = scoreOf(g, g.deals[0] as Deal, EXACT);
    expect(r && applyRounding(r, EXACT)).toEqual(r);
  });
});

describe("storage", () => {
  it("rejects anything that isn't a backup", () => {
    expect(parseBackup("nope")).toBeNull();
    expect(parseBackup(JSON.stringify({ v: 3, games: [] }))).toBeNull();
  });

  it("fills in missing settings from defaults", () => {
    const d = parseBackup(JSON.stringify({ v: 2, games: [], players: [] }));
    expect(d?.settings.passeRule).toBe("next");
    expect(d?.settings.round10).toBe(false);
    expect(d?.settings.theme).toBe("auto");
  });

  it("migrates version 1: one saved player per name, games point at them", () => {
    const v1 = {
      v: 1,
      recentPlayers: [{ name: "Marie", animal: "fox", color: "#F08A4B" }, { name: "Paul", animal: "bear", color: "#3D7BF2" }],
      games: [{ id: "a", createdAt: 1, firstDealer: 0, finishedAt: 2, deals: [], players: [{ name: "marie", animal: "fox", color: "#F08A4B" }, { name: "Luc", animal: "owl", color: "#3D7BF2" }] }],
    };
    const d = parseBackup(JSON.stringify(v1));
    expect(d?.v).toBe(2);
    expect(d?.players.map((p) => p.name).sort()).toEqual(["Luc", "Marie", "Paul"]);
    const marie = d?.players.find((p) => p.name === "Marie");
    expect(d?.games[0]?.players[0]?.id).toBe(marie?.id);
  });

  it("new players get a look nobody else has", () => {
    const a = newPlayer("A", []);
    const b = newPlayer("B", [a]);
    expect(b.animal).not.toBe(a.animal);
    expect(b.color).not.toBe(a.color);
  });

  it("players of a new game move to the front of the list", () => {
    expect(touchPlayers([P("A"), P("B"), P("C")], ["c"]).map((p) => p.id)).toEqual(["c", "a", "b"]);
  });
});

describe("statistics", () => {
  const g1 = { ...game5(canvasDeals), id: "g1", createdAt: 1000, finishedAt: 2000 };
  const g2 = { ...game5([canvasDeals[0] as PlayedDeal["summary"], "passe"]), id: "g2", createdAt: 3000, finishedAt: 4000 };
  const games = [g1, g2];

  it("counts games, deals and passes", () => {
    const t = tableStats(games, EXACT);
    expect(t).toMatchObject({ games: 2, deals: 5, passes: 1, players: 5 });
    expect(t.byContract.garde).toEqual({ won: 3, total: 3 });
    expect(t.byContract.prise).toEqual({ won: 1, total: 2 });
  });

  it("per player: wins, points, takes, best deal and best partner", () => {
    const s = playerStats(games, "marie", EXACT);
    expect(s.games).toBe(2);
    expect(s.wins).toBe(2); // Marie leads both games
    expect(s.points).toBe(178 + 124);
    expect(s.taken).toBe(2);
    expect(s.takenWon).toBe(2);
    expect(s.best?.score).toBe(124);
    expect(s.bestPartner?.id).toBe("luc");
    expect(s.history.map((h) => h.place)).toEqual([1, 1]);
  });

  it("filters by date and ranks players by wins", () => {
    expect(countedGames(games, 2500).map((g) => g.id)).toEqual(["g2"]);
    expect(rankedPlayers(games, [], EXACT)[0]?.id).toBe("marie");
  });

  it("exports one CSV row per player per deal", () => {
    const csv = toCsv([g2], [], EXACT).trim().split("\n");
    expect(csv[0]).toBe("date,partie,donne,joueur,score,preneur,contrat,partenaire,bouts,points_preneur,resultat,passe");
    expect(csv).toHaveLength(1 + 2 * 5);
    expect(csv[1]).toContain(",1,Marie,124,Marie,garde,Luc,2,47,fait,");
    expect(csv[6]).toMatch(/,2,Marie,0,.*,oui$/);
  });
});

describe("tint", () => {
  it("mixes a colour with white", () => {
    expect(tint("#000000", 0)).toBe("#ffffff");
    expect(tint("#ffffff", 0.5)).toBe("#ffffff");
  });
});
