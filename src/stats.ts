import type { Bid } from "./scoring";
import { isPlayed, ranking, scoreOf, totals, type Game, type Player, type ScoreOptions } from "./model";

/** Statistics across games, per saved player (matched by id). */

export interface PlayerStats {
  id: string;
  games: number;
  wins: number;
  points: number;
  deals: number;
  taken: number;
  takenWon: number;
  byContract: Record<Bid, { won: number; total: number }>;
  best: { score: number; contract: Bid; at: number } | null;
  /** most recent last: total and place in each game */
  history: { total: number; place: number; at: number }[];
  bestPartner: { id: string; won: number; total: number } | null;
  lastPlayed: number | null;
}

export interface TableStats {
  games: number;
  deals: number;
  passes: number;
  players: number;
  byContract: Record<Bid, { won: number; total: number }>;
}

const emptyContracts = (): Record<Bid, { won: number; total: number }> => ({
  prise: { won: 0, total: 0 }, garde: { won: 0, total: 0 }, gardeSans: { won: 0, total: 0 }, gardeContre: { won: 0, total: 0 },
});

/** Games that count: at least one deal, optionally only since a date. */
export function countedGames(games: readonly Game[], since: number | null): Game[] {
  return games.filter((g) => g.deals.length > 0 && (since === null || g.createdAt >= since));
}

export function tableStats(games: readonly Game[], opts: ScoreOptions): TableStats {
  const byContract = emptyContracts();
  let deals = 0, passes = 0;
  const people = new Set<string>();
  for (const g of games) {
    g.players.forEach((p) => people.add(p.id));
    for (const d of g.deals) {
      const r = scoreOf(g, d, opts);
      if (!r) { passes++; continue; }
      deals++;
      byContract[r.contract].total++;
      if (r.won) byContract[r.contract].won++;
    }
  }
  return { games: games.length, deals, passes, players: people.size, byContract };
}

export function playerStats(games: readonly Game[], id: string, opts: ScoreOptions): PlayerStats {
  const s: PlayerStats = {
    id, games: 0, wins: 0, points: 0, deals: 0, taken: 0, takenWon: 0, byContract: emptyContracts(),
    best: null, history: [], bestPartner: null, lastPlayed: null,
  };
  const partners = new Map<string, { won: number; total: number }>();
  const sorted = [...games].sort((a, b) => a.createdAt - b.createdAt);
  for (const g of sorted) {
    const seat = g.players.findIndex((p) => p.id === id);
    if (seat < 0) continue;
    s.games++;
    const rank = ranking(g, opts).find((r) => r.seat === seat);
    const total = totals(g, opts)[seat] ?? 0;
    s.points += total;
    if (rank?.place === 1) s.wins++;
    s.history.push({ total, place: rank?.place ?? 0, at: g.createdAt });
    s.lastPlayed = Math.max(s.lastPlayed ?? 0, g.createdAt);
    for (const d of g.deals) {
      if (!isPlayed(d)) continue;
      const r = scoreOf(g, d, opts);
      if (!r) continue;
      s.deals++;
      const mine = r.scores[seat] ?? 0;
      if (!s.best || mine > s.best.score) s.best = { score: mine, contract: r.contract, at: d.at };
      const onTakerSide = r.taker === seat || r.partner === seat;
      if (r.taker === seat) {
        s.taken++;
        s.byContract[r.contract].total++;
        if (r.won) { s.takenWon++; s.byContract[r.contract].won++; }
      }
      if (onTakerSide && r.partner !== null) {
        const other = g.players[r.taker === seat ? r.partner : r.taker];
        if (other) {
          const p = partners.get(other.id) ?? { won: 0, total: 0 };
          p.total++;
          if (r.won) p.won++;
          partners.set(other.id, p);
        }
      }
    }
  }
  for (const [pid, p] of partners) {
    const b = s.bestPartner;
    if (!b || p.won > b.won || (p.won === b.won && p.total < b.total)) s.bestPartner = { id: pid, ...p };
  }
  return s;
}

/** Players who appear in the counted games, most wins first. */
export function rankedPlayers(games: readonly Game[], registry: readonly Player[], opts: ScoreOptions): PlayerStats[] {
  const ids = new Set<string>();
  games.forEach((g) => g.players.forEach((p) => ids.add(p.id)));
  return [...ids]
    .map((id) => playerStats(games, id, opts))
    .sort((a, b) => b.wins - a.wins || b.points - a.points || (nameOf(registry, games, a.id) < nameOf(registry, games, b.id) ? -1 : 1));
}

export function nameOf(registry: readonly Player[], games: readonly Game[], id: string): string {
  const r = registry.find((p) => p.id === id);
  if (r) return r.name;
  for (const g of games) { const p = g.players.find((x) => x.id === id); if (p) return p.name; }
  return "?";
}

/** One row per player per deal: easy to pivot in a spreadsheet. */
export function toCsv(games: readonly Game[], registry: readonly Player[], opts: ScoreOptions): string {
  const head = ["date", "partie", "donne", "joueur", "score", "preneur", "contrat", "partenaire", "bouts", "points_preneur", "resultat", "passe"];
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [head.join(",")];
  for (const g of [...games].sort((a, b) => a.createdAt - b.createdAt)) {
    const name = (i: number | null) => (i === null ? "" : nameOf(registry, [g], g.players[i]?.id ?? ""));
    const date = new Date(g.createdAt).toISOString().slice(0, 10);
    g.deals.forEach((d, k) => {
      const r = scoreOf(g, d, opts);
      g.players.forEach((_, seat) => {
        lines.push([
          date, g.id, k + 1, name(seat), r ? r.scores[seat] ?? 0 : 0,
          r ? name(r.taker) : "", r ? r.contract : "", r ? name(r.partner) : "", r ? r.oudlers : "",
          r ? r.takerHalfPoints / 2 : "", r ? (r.won ? "fait" : "chute") : "", r ? "" : "oui",
        ].map(esc).join(","));
      });
    });
  }
  return lines.join("\n") + "\n";
}
