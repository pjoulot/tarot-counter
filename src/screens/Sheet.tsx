import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useApp } from "../App";
import { cumulative, formatPoints, isPlayed, nextDealer, plannedDeals, playedDeals, ranking, scoreReached, scoreOf, signed, tint, totals, type Game } from "../model";
import { CONTRACT_LABEL, formatDate } from "../i18n";
import { Avatar, Header, Icon, IconButton, MoreIcon, Seg, Sheet as BottomSheet } from "../components/ui";

export function Sheet({ game }: { game: Game }) {
  const { data, t, lang, go, back, undoLastDeal, finishGame, replace, seats, setDealer, opts } = useApp();
  const [view, setView] = useState<"table" | "curve">("table");
  const [menu, setMenu] = useState(false);
  const [dealerSheet, setDealerSheet] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const finished = game.finishedAt !== null;
  const players = seats(game);
  const rank = ranking(game, opts);
  const played = game.deals.filter(isPlayed).length;
  const maxAbs = Math.max(1, ...rank.map((r) => Math.abs(r.total)));
  const dealerSeat = nextDealer(game, data.settings.passeRule);
  const dealer = players[dealerSeat];
  const lead = rank[0] && rank[1] ? rank[0].total - rank[1].total : 0;
  const n = players.length;
  const cols = `76px repeat(${n}, minmax(0, 1fr))`;
  const tot = totals(game, opts);
  const planned = plannedDeals(game);
  const done = playedDeals(game);
  const winnerSeat = scoreReached(game, opts);
  const reached = !finished && ((planned !== null && done >= planned) || winnerSeat !== null);
  const end = () => { finishGame(game.id); replace({ name: "end", gameId: game.id }); };
  // The totals row sticks just above the bottom buttons, whose height changes with what they show.
  const mainRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const bar = barRef.current, main = mainRef.current;
    if (!bar || !main) return;
    const ro = new ResizeObserver(() => main.style.setProperty("--bar-h", `${bar.offsetHeight - 12}px`));
    ro.observe(bar);
    return () => ro.disconnect();
  }, []);

  return (
    <main className="screen" ref={mainRef}>
      <Header
        onBack={back}
        backLabel={t("back")}
        title={
          <span className="col center-x">
            <span className="h-title-sm">{t("gameOf", { date: formatDate(game.createdAt, lang) })}</span>
            {!finished && dealer && (
              <button type="button" className="dealer-pill" onClick={() => setDealerSheet(true)} aria-label={t("changeDealer")}>
                {planned !== null && done < planned ? t("dealOf", { n: done + 1, m: planned }) : t("dealN", { n: game.deals.length + 1 })} · <Avatar player={dealer} size={20} /> {t("dealerIs", { name: dealer.name })} {MoreIcon.chevDown}
              </button>
            )}
          </span>
        }
        right={!finished ? <IconButton label={t("options")} onClick={() => setMenu(!menu)}>{Icon.dots}</IconButton> : <span className="icon-spacer" />}
      />
      {menu && (
        <>
          <div className="menu-backdrop" onClick={() => setMenu(false)} />
          <div className="menu" role="menu">
            <button type="button" role="menuitem" disabled={game.deals.length === 0} onClick={() => { undoLastDeal(game.id); setMenu(false); }}>{MoreIcon.undo}{t("undoLast")}</button>
            <button type="button" role="menuitem" onClick={() => { setMenu(false); setDealerSheet(true); }}>{MoreIcon.swap}{t("changeDealer")}</button>
            <button type="button" role="menuitem" onClick={() => { setMenu(false); go({ name: "players" }); }}>{MoreIcon.people}{t("editPlayers")}</button>
          </div>
        </>
      )}

      <section className="card ranking" aria-label="Classement">
        {rank.map((r, i) => {
          const p = players[r.seat];
          if (!p) return null;
          const first = i === 0 && played > 0 && r.total > (rank[1]?.total ?? r.total - 1);
          const w = (Math.abs(r.total) / maxAbs) * 50;
          return (
            <div key={r.seat} className={first ? "rank-row lead" : "rank-row"}>
              <span className={first ? "rank-place gold" : "rank-place"}>{r.place}</span>
              <Avatar player={p} size={42} />
              <div className="col grow gap6">
                <span className="row gap6"><span className="strong">{p.name}</span>{first && Icon.crown}</span>
                <div className="bar" aria-hidden="true">
                  <div className="bar-fill" style={r.total >= 0 ? { left: "50%", width: `${w}%`, background: p.color, borderRadius: "0 4px 4px 0" } : { right: "50%", width: `${w}%`, background: p.color, borderRadius: "4px 0 0 4px" }} />
                  <div className="bar-zero" />
                </div>
              </div>
              <div className="col end-x min64">
                <span className={r.total < 0 ? "score neg" : "score"}>{signed(r.total).replace("+", "")}</span>
                {first && lead > 0 && <span className="tiny strong brown">{t("ahead", { n: lead })}</span>}
              </div>
            </div>
          );
        })}
        {game.targetScore && winnerSeat === null && rank[0] && (
          <p className="tiny muted center target-line">{t("targetLine", { n: game.targetScore, name: players[rank[0].seat]?.name ?? "", m: game.targetScore - rank[0].total })}</p>
        )}
      </section>

      {game.deals.length > 0 && (
        <>
          <div className="row-between">
            <h2 className="h2 small-h">{t("dealDetails")}</h2>
            <div className="mini-seg">
              <Seg label={t("dealDetails")} value={view} onChange={setView} small options={[
                { value: "table" as const, label: <span className="seg-ico">{MoreIcon.grid}{t("table")}</span> },
                { value: "curve" as const, label: <span className="seg-ico">{MoreIcon.curve}{t("curve")}</span> },
              ]} />
            </div>
          </div>
          {view === "table" ? (
            <>
              <section className="card table">
                <div className="t-row t-head" style={{ gridTemplateColumns: cols }}>
                  <span />
                  {players.map((p, i) => <span key={i} className="center-x"><Avatar player={p} size={28} /></span>)}
                </div>
                {game.deals.map((d, k) => {
                  const r = scoreOf(game, d, opts);
                  if (!r) {
                    return (
                      <button type="button" key={d.id} className="t-row passe" style={{ gridTemplateColumns: "76px 1fr" }}
                        onClick={() => go({ name: "detail", gameId: game.id, dealId: d.id })} aria-label={t("dealTitle", { n: k + 1 })}>
                        <span className="col left"><span className="t-contract muted">{t("passe")}</span><span className="tiny muted">{t("wasDealing", { name: players[d.dealer]?.name ?? "" })}</span></span>
                        <span className="small muted italic">{t("passeRow")}</span>
                      </button>
                    );
                  }
                  const margin = formatPoints(Math.abs(r.takerHalfPoints - r.neededHalfPoints), lang);
                  return (
                    <button type="button" key={d.id} className="t-row" style={{ gridTemplateColumns: cols }}
                      onClick={() => go({ name: "detail", gameId: game.id, dealId: d.id })} aria-label={t("dealTitle", { n: k + 1 })}>
                      <span className="col left">
                        <span className="t-contract">{CONTRACT_LABEL[r.contract]}</span>
                        <span className="tiny muted">{(r.won ? t("madeBy", { n: margin }) : t("failedBy", { n: margin })).toLowerCase()}</span>
                      </span>
                      {r.scores.map((s, i) => {
                        const role = i === r.taker ? "cell taker" : i === r.partner ? "cell partner" : "cell";
                        return <span key={i} className={s < 0 ? `${role} neg` : role} style={i === r.taker && players[i] ? { background: tint(players[i]?.color ?? "#F08A4B", 0.3), "--c": players[i]?.color } as CSSProperties : undefined}>{signed(s)}</span>;
                      })}
                    </button>
                  );
                })}
                <div className="t-row t-total" style={{ gridTemplateColumns: cols }}>
                  <span className="t-contract">{t("total")}</span>
                  {tot.map((v, i) => <span key={i} className={v < 0 ? "cell total neg" : "cell total"}>{signed(v).replace("+", "")}</span>)}
                </div>
              </section>
              <div className="legend">
                <span className="row gap6"><span className="lg-taker" />{t("taker")}</span>
                <span className="row gap6"><span className="lg-partner" />{t("partner")}</span>
              </div>
            </>
          ) : (
            <Curve game={game} />
          )}
        </>
      )}

      <div className="bottom col gap8" ref={barRef}>
        {finished ? (
          <button type="button" className="btn-primary" onClick={back}>{t("back")}</button>
        ) : confirmEnd ? (
          <>
            <p className="center small"><span className="strong">{t("endConfirm")}</span><br /><span className="muted">{t("endKept")}</span></p>
            <div className="grid2">
              <button type="button" className="btn-secondary" onClick={() => setConfirmEnd(false)}>{t("keepPlaying")}</button>
              <button type="button" className="btn-primary with-icon" onClick={end}>{MoreIcon.flag}{t("end")}</button>
            </div>
          </>
        ) : reached ? (
          <>
            <p className="center small strong">{winnerSeat !== null ? t("scoreDone", { name: players[winnerSeat]?.name ?? "", n: game.targetScore ?? 0 }) : t("plannedDone", { n: planned ?? 0 })}</p>
            <div className="grid-end">
              <button type="button" className="btn-secondary with-icon" onClick={() => go({ name: "entry", gameId: game.id })}>{Icon.plus}{t("oneMore")}</button>
              <button type="button" className="btn-primary with-icon" onClick={end}>{MoreIcon.flag}{t("seeResults")}</button>
            </div>
          </>
        ) : (
          <div className="grid-end">
            <button type="button" className="btn-secondary with-icon" disabled={played === 0} onClick={() => setConfirmEnd(true)}>{MoreIcon.flag}{t("end")}</button>
            <button type="button" className="btn-primary with-icon" onClick={() => go({ name: "entry", gameId: game.id })}>{Icon.plus}{t("newDeal")}</button>
          </div>
        )}
      </div>

      {dealerSheet && (
        <BottomSheet title={t("whoDeals", { n: game.deals.length + 1 })} onClose={() => setDealerSheet(false)} closeLabel={t("close")}>
          <DealerPicker game={game} onPick={(s) => { setDealer(game.id, s); setDealerSheet(false); }} />
        </BottomSheet>
      )}
    </main>
  );
}

function DealerPicker({ game, onPick }: { game: Game; onPick: (seat: number) => void }) {
  const { data, t, seats } = useApp();
  const planned = nextDealer({ ...game, dealerOverride: null }, data.settings.passeRule);
  const current = nextDealer(game, data.settings.passeRule);
  const [sel, setSel] = useState(current);
  const players = seats(game);
  return (
    <>
      <div className="people" style={{ gridTemplateColumns: `repeat(${players.length}, minmax(0, 1fr))` }}>
        {players.map((p, i) => (
          <button type="button" key={i} className={sel === i ? "person on" : "person"} aria-pressed={sel === i} onClick={() => setSel(i)}>
            <Avatar player={p} size={50} /><span>{p.name}</span>
            {i === planned ? <span className="tag-gold">{t("planned")}</span> : <span className="tag-space" />}
          </button>
        ))}
      </div>
      <p className="small muted center">{t("dealerNote")}</p>
      <button type="button" className="btn-primary" onClick={() => onPick(sel)}>{t("xDeals", { name: players[sel]?.name ?? "" })}</button>
    </>
  );
}

/** Running total per player, one line each in their colour, deal by deal. */
function Curve({ game }: { game: Game }) {
  const { t, seats, opts, go } = useApp();
  const players = seats(game);
  const lines = cumulative(game, opts);
  const W = 358, H = 300, l = 42, r = 58, top = 16, b = 30;
  const iw = W - l - r, ih = H - top - b;
  const all = lines.flat();
  const step = niceStep(Math.max(1, Math.max(...all) - Math.min(...all)));
  const lo = Math.floor(Math.min(0, ...all) / step) * step, hi = Math.ceil(Math.max(0, ...all) / step) * step || step;
  const nDeals = game.deals.length;
  const X = (k: number) => l + (k * iw) / Math.max(1, nDeals);
  const Y = (v: number) => top + ((hi - v) * ih) / (hi - lo || 1);
  const ticks: number[] = [];
  for (let v = lo; v <= hi; v += step) ticks.push(v);
  const finals = lines.map((ln) => ln[ln.length - 1] ?? 0);
  const order = finals.map((_, i) => i).sort((a, c) => (finals[a] ?? 0) - (finals[c] ?? 0));
  // End labels, nudged apart so they don't overlap.
  const labelY: number[] = [];
  const byY = players.map((_, i) => i).sort((a, c) => Y(finals[a] ?? 0) - Y(finals[c] ?? 0));
  let prev = -Infinity;
  for (const i of byY) { const y = Math.max(Y(finals[i] ?? 0), prev + 22); labelY[i] = y; prev = y; }
  const xStep = nDeals > 12 ? Math.ceil(nDeals / 8) : 1;

  return (
    <section className="card curve">
      <div className="row-between curve-head small muted"><span>{t("cumulative")}</span><span>{t("dealsAxis")}</span></div>
      <svg width="100%" viewBox={`0 0 ${W} ${Math.max(H, prev + 16)}`} role="img" aria-label={t("cumulative")}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={l} x2={l + iw} y1={Y(v)} y2={Y(v)} stroke={v === 0 ? "var(--rule)" : "var(--line)"} strokeWidth={v === 0 ? 1.5 : 1} />
            <text x={l - 8} y={Y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{signed(v).replace("+", "")}</text>
          </g>
        ))}
        {game.deals.map((d, k) => (
          <g key={d.id}>
            <rect x={X(k)} y={top} width={X(k + 1) - X(k)} height={ih} fill="transparent" style={{ cursor: "pointer" }} onClick={() => go({ name: "detail", gameId: game.id, dealId: d.id })} />
            {(k + 1) % xStep === 0 && <text x={X(k + 1)} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--muted)">{k + 1}</text>}
          </g>
        ))}
        <text x={X(0)} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--muted)">0</text>
        {order.map((i) => {
          const p = players[i];
          const ln = lines[i];
          if (!p || !ln) return null;
          return (
            <g key={i} style={{ pointerEvents: "none" }}>
              <polyline points={ln.map((v, k) => `${X(k)},${Y(v)}`).join(" ")} fill="none" stroke={p.color} strokeWidth={i === order[order.length - 1] ? 3 : 2.25} strokeLinejoin="round" strokeLinecap="round" />
              {ln.slice(1).map((v, k) => <circle key={k} cx={X(k + 1)} cy={Y(v)} r={2.6} fill={p.color} />)}
            </g>
          );
        })}
        {players.map((p, i) => (
          <g key={i} style={{ pointerEvents: "none" }}>
            <foreignObject x={l + iw + 5} y={(labelY[i] ?? 0) - 11} width={22} height={22}><Avatar player={p} size={22} /></foreignObject>
            <text x={l + iw + 31} y={(labelY[i] ?? 0) + 4} fontSize="11.5" fontWeight="800" fill={(finals[i] ?? 0) < 0 ? "var(--neg)" : "var(--ink)"}>{signed(finals[i] ?? 0).replace("+", "")}</text>
          </g>
        ))}
      </svg>
    </section>
  );
}

function niceStep(range: number): number {
  const raw = range / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}
