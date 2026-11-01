import { useMemo, useState } from "react";
import { useApp } from "../App";
import { signed } from "../model";
import { countedGames, nameOf, playerStats, rankedPlayers, tableStats } from "../stats";
import { CONTRACT_LABEL, formatDate } from "../i18n";
import { Avatar, Header, Icon, IconButton, MoreIcon, Seg } from "../components/ui";
import { CONTRACTS } from "../model";

const DAY = 24 * 3600 * 1000;

function Meter({ won, total, color }: { won: number; total: number; color: string }) {
  const pct = total ? (won / total) * 100 : 0;
  return <div className="meter" aria-hidden="true"><div style={{ width: `${pct}%`, background: color }} /></div>;
}

/** "50 %" in French (with a narrow no-break space), "50%" in English. */
function pct(x: number, of: number, lang: "fr" | "en"): string {
  const p = Math.round((x / of) * 100);
  return lang === "fr" ? `${p}\u202F%` : `${p}%`;
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string | undefined }) {
  return (
    <div className="card tile-stat">
      <span className="tiny muted">{label}</span>
      <span className="tile-value">{value}</span>
      {sub && <span className="tiny muted">{sub}</span>}
    </div>
  );
}

export function Stats() {
  const { data, t, lang, back, go, player, opts } = useApp();
  const [range, setRange] = useState<"all" | "30">("all");
  const since = useMemo(() => (range === "30" ? Date.now() - 30 * DAY : null), [range]);
  const games = useMemo(() => countedGames(data.games, since), [data.games, since]);
  const table = useMemo(() => tableStats(games, opts), [games, opts]);
  const players = useMemo(() => rankedPlayers(games, data.players, opts), [games, data.players, opts]);

  return (
    <main className="screen">
      <Header title={t("statistics")} onBack={back} backLabel={t("back")} />
      <Seg label={t("statistics")} value={range} onChange={setRange} small options={[{ value: "all" as const, label: t("allGames") }, { value: "30" as const, label: t("last30") }]} />
      {games.length === 0 ? (
        <p className="muted pad4">{t("noStats")}</p>
      ) : (
        <>
          <div className="grid3">
            <Tile label={t("gamesLabel")} value={String(table.games)} />
            <Tile label={t("dealsLabel")} value={String(table.deals + table.passes)} />
            <Tile label={t("playersLabel")} value={String(table.players)} />
          </div>
          <section className="col gap6">
            <h2 className="h2 small-h pad4">{t("playersLabel")}</h2>
            <div className="card list">
              {players.map((s) => {
                const p = player(s.id) ?? games.flatMap((g) => g.players).find((x) => x.id === s.id);
                if (!p) return null;
                return (
                  <button type="button" key={s.id} className="list-row" onClick={() => go({ name: "playerStats", playerId: s.id })}>
                    <Avatar player={p} size={44} />
                    <span className="col grow gap6">
                      <span className="row-between"><span className="strong">{nameOf(data.players, games, s.id)}</span>
                        <span className="small muted">{t("gamesCount", { n: s.games, count: s.games })}</span></span>
                      <span className="row gap8">
                        <span className="tiny muted nowrap">{t("takesMade")}</span>
                        <span className="grow"><Meter won={s.takenWon} total={s.taken} color={p.color} /></span>
                        <span className="small strong right min40">{s.taken ? pct(s.takenWon, s.taken, lang) : "—"}</span>
                      </span>
                    </span>
                    {Icon.chev}
                  </button>
                );
              })}
            </div>
          </section>
          <section className="col gap6">
            <h2 className="h2 small-h pad4">{t("contractsPlayed")}</h2>
            <div className="card contracts">
              {CONTRACTS.map((c) => (
                <div key={c} className="contract-row">
                  <span className="strong small nowrap">{CONTRACT_LABEL[c]}</span>
                  <Meter won={table.byContract[c].won} total={table.byContract[c].total} color="var(--accent)" />
                  <span className="small muted right nowrap">{table.byContract[c].total ? t("pctOfN", { p: pct(table.byContract[c].won, table.byContract[c].total, lang), n: table.byContract[c].total, count: table.byContract[c].total }) : "—"}</span>
                </div>
              ))}
              {table.passes > 0 && <span className="tiny muted">{t("passesNote", { d: table.deals, p: table.passes })}</span>}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

export function PlayerStatsScreen({ playerId }: { playerId: string }) {
  const { data, t, lang, back, go, player, opts } = useApp();
  const games = useMemo(() => countedGames(data.games, null), [data.games]);
  const s = useMemo(() => playerStats(games, playerId, opts), [games, playerId, opts]);
  const p = player(playerId) ?? games.flatMap((g) => g.players).find((x) => x.id === playerId);
  if (!p) return null;
  const name = nameOf(data.players, games, playerId);
  const last = s.history.slice(-10);
  const mx = Math.max(1, ...last.map((h) => Math.abs(h.total)));
  const partner = s.bestPartner ? player(s.bestPartner.id) ?? games.flatMap((g) => g.players).find((x) => x.id === s.bestPartner?.id) : undefined;
  const bw = 24, gap = 8, h0 = 84;

  return (
    <main className="screen">
      <Header title={name} onBack={back} backLabel={t("back")}
        right={player(playerId) && !player(playerId)?.archived ? <IconButton label={t("editX", { name })} onClick={() => go({ name: "editPlayer", playerId })}>{MoreIcon.pencil}</IconButton> : undefined} />
      <div className="row gap14 pad4">
        <Avatar player={p} size={64} />
        <div className="col gap2">
          <span className="h2">{t("gamesPlayedH", { n: s.games, count: s.games })}</span>
          {s.lastPlayed && <span className="small muted">{t("dealsAndLast", { d: s.deals, date: formatDate(s.lastPlayed, lang), count: s.deals })}</span>}
        </div>
      </div>
      <div className="grid2 gap8">
        <Tile label={t("gamesWonTile")} value={s.games ? pct(s.wins, s.games, lang) : "—"} sub={s.games ? t("xOfY", { x: s.wins, y: s.games }) : undefined} />
        <Tile label={t("takesMade")} value={s.taken ? pct(s.takenWon, s.taken, lang) : "—"} sub={s.taken ? t("xOfY", { x: s.takenWon, y: s.taken }) : t("neverTook")} />
        <Tile label={t("pointsTotal")} value={signed(s.points)} sub={s.games ? t("perGameAvg", { n: signed(Math.round(s.points / s.games)), count: s.games }) : undefined} />
        <Tile label={t("bestDeal")} value={s.best ? signed(s.best.score) : "—"} sub={s.best ? `${CONTRACT_LABEL[s.best.contract].toLowerCase()}, ${formatDate(s.best.at, lang)}` : undefined} />
      </div>
      {last.length > 0 && (
        <section className="card pad-card col gap8">
          <div className="row-between"><span className="h3">{t("lastGames", { n: last.length, count: last.length })}</span><span className="tiny muted">{t("crownWon")}</span></div>
          <svg width="100%" viewBox={`0 0 ${8 + 10 * (bw + gap)} ${h0 + 60}`} role="img" aria-label={t("lastGames", { n: last.length })}>
            {last.map((g, k) => {
              const x = 8 + k * (bw + gap);
              const hgt = (Math.abs(g.total) / mx) * (h0 - 26);
              const y = g.total >= 0 ? h0 - hgt : h0;
              return (
                <g key={k}>
                  <rect x={x} y={y} width={bw} height={Math.max(hgt, 2)} rx={5} fill={p.color} opacity={g.total >= 0 ? 1 : 0.45} />
                  {g.place === 1 && <polygon transform={`translate(${x + 4},${g.total >= 0 ? y - 20 : h0 - 20})`} points="1,5 5,8.5 8,3 11,8.5 15,5 13.5,14 2.5,14" fill="#E0A100" />}
                </g>
              );
            })}
            <line x1={0} x2={8 + 10 * (bw + gap)} y1={h0} y2={h0} stroke="var(--rule)" strokeWidth={1.5} />
          </svg>
          {last[0] && <div className="row-between tiny muted"><span>{formatDate(last[0].at, lang)}</span><span>{formatDate(last[last.length - 1]?.at ?? 0, lang)}</span></div>}
        </section>
      )}
      <section className="card contracts">
        <span className="h3">{t("whenTaking")}</span>
        {CONTRACTS.map((c) => (
          <div key={c} className="contract-row">
            <span className="strong small nowrap">{CONTRACT_LABEL[c]}</span>
            <Meter won={s.byContract[c].won} total={s.byContract[c].total} color={p.color} />
            <span className="small muted right nowrap">{s.byContract[c].total ? t("pctOfN", { p: pct(s.byContract[c].won, s.byContract[c].total, lang), n: s.byContract[c].total, count: s.byContract[c].total }) : "—"}</span>
          </div>
        ))}
      </section>
      {s.bestPartner && s.bestPartner.won > 0 && partner && (
        <section className="card pad-card row gap12 bottom-space">
          <Avatar player={partner} size={40} />
          <div className="col gap2"><span className="small muted">{t("bestPartner")}</span>
            <span className="strong">{t("partnerLine", { name: nameOf(data.players, games, s.bestPartner.id), w: s.bestPartner.won, t: s.bestPartner.total })}</span></div>
        </section>
      )}
    </main>
  );
}
