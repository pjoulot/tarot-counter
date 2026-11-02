import { useMemo, useState } from "react";
import {
  cardsWonByTakerSide, halfPointsFromCounts, halfPointsFromMargin, NEEDED_HALF_POINTS, RuleError, scoreFromSummary,
  variant, type Bid, type DealResult, type DealSummary, type PoigneeLevel,
} from "../scoring";
import { useApp } from "../App";
import { applyRounding, CONTRACTS, formatPoints, hasMisere, isPlayed, misereScores, nextDealer, playerCount, POIGNEES, signed, type DealInput, type EntryMode, type Game, type Misere, type Player, type ScoreOptions } from "../model";
import { CONTRACT_LABEL, type T } from "../i18n";
import { Avatar, Header, Icon, MoreIcon, Seg, Sheet } from "../components/ui";

type Partner = number | "seul" | null;
type Chelem = NonNullable<DealSummary["chelem"]>;

interface State {
  mode: EntryMode;
  taker: number | null;
  contract: Bid | null;
  partner: Partner;
  oudlers: 0 | 1 | 2 | 3 | null;
  quick: boolean;
  won: boolean;
  /** typed number as text: "47", "40.5" */
  text: string;
  bouts: { petit: boolean; vingtEtUn: boolean; excuse: boolean };
  rois: number; dames: number; cavaliers: number; valets: number;
  /** the taker side's other cards (trumps and low cards), as typed */
  autres: string;
  petitAuBout: -1 | 0 | 1;
  poignees: PoigneeLevel[];
  chelem: Chelem;
  /** seats with a misère d'atout / de tête (house rule) */
  misereAtout: number[];
  misereTete: number[];
}

function initial(game: Game, dealId: string | undefined, defaultMode: EntryMode): State {
  const found = dealId ? game.deals.find((x) => x.id === dealId) : undefined;
  const m = found && isPlayed(found) ? found.misere : null;
  return { ...initialDeal(game, dealId, defaultMode), misereAtout: m ? [...m.atout] : [], misereTete: m ? [...m.tete] : [] };
}

function initialDeal(game: Game, dealId: string | undefined, defaultMode: EntryMode): State {
  const d = dealId ? game.deals.find((x) => x.id === dealId) : undefined;
  const base: State = {
    mode: defaultMode, taker: null, contract: null, partner: null, oudlers: null, quick: false, won: true, text: "",
    bouts: { petit: false, vingtEtUn: false, excuse: false }, rois: 0, dames: 0, cavaliers: 0, valets: 0, autres: "",
    petitAuBout: 0, poignees: [], chelem: "none", misereAtout: [], misereTete: [],
  };
  if (!d || !isPlayed(d)) return base;
  const s = d.summary;
  const st: State = {
    ...base, mode: d.input.mode, taker: s.taker, contract: s.contract,
    partner: playerCount(game) === 5 ? (s.partner === null || s.partner === s.taker ? "seul" : s.partner) : null,
    oudlers: s.oudlers, petitAuBout: s.petitAuBout ?? 0, poignees: [...(s.poignees ?? [])], chelem: s.chelem ?? "none",
  };
  const inp = d.input;
  if (inp.mode === "points" && inp.quick) return { ...st, quick: true, won: inp.won, text: String(inp.marginHalf / 2) };
  if (inp.mode === "points") return { ...st, text: String(inp.halfPoints / 2) };
  const honours = Number(inp.bouts.petit) + Number(inp.bouts.vingtEtUn) + Number(inp.bouts.excuse) + inp.rois + inp.dames + inp.cavaliers + inp.valets;
  // Deals saved by version 1.1 counted tricks: turn them into the other cards they stood for.
  const autres = inp.autres ?? Math.max(0, cardsWonByTakerSide(playerCount(game), inp.tricks ?? 0, s.contract) - honours);
  return { ...st, bouts: inp.bouts, rois: inp.rois, dames: inp.dames, cavaliers: inp.cavaliers, valets: inp.valets, autres: String(autres) };
}

function parseHalf(text: string): number | null {
  if (text === "" || text === ".") return null;
  const v = Number(text);
  return Number.isFinite(v) ? Math.round(v * 2) : null;
}

/** Everything the engine needs, or a reason why not yet. */
function build(game: Game, s: State): { summary: Omit<DealSummary, "players">; input: DealInput; extra?: { h: number; b: number; c: number; small: number; total: number } } | null {
  const n = playerCount(game);
  if (s.taker === null || s.contract === null) return null;
  if (n === 5 && s.partner === null) return null;
  const partner = n === 5 && typeof s.partner === "number" ? s.partner : null;
  const common = { taker: s.taker, partner, contract: s.contract, petitAuBout: s.petitAuBout, poignees: s.poignees, chelem: s.chelem };
  try {
    if (s.mode === "points") {
      if (s.oudlers === null) return null;
      const typed = parseHalf(s.text);
      if (typed === null) return null;
      if (s.quick) {
        const half = halfPointsFromMargin(s.oudlers, s.won, typed);
        return { summary: { ...common, oudlers: s.oudlers, takerHalfPoints: half }, input: { mode: "points", quick: true, won: s.won, marginHalf: typed } };
      }
      if (typed > 182) return null;
      return { summary: { ...common, oudlers: s.oudlers, takerHalfPoints: typed }, input: { mode: "points", quick: false, halfPoints: typed } };
    }
    const oudlers = (Number(s.bouts.petit) + Number(s.bouts.vingtEtUn) + Number(s.bouts.excuse)) as 0 | 1 | 2 | 3;
    if (s.autres === "") return null;
    const autres = Number(s.autres);
    const honoursCount = oudlers + s.rois + s.dames + s.cavaliers + s.valets;
    const half = halfPointsFromCounts({ oudlers, rois: s.rois, dames: s.dames, cavaliers: s.cavaliers, valets: s.valets, cards: honoursCount + autres });
    const h = s.rois * 9 + s.dames * 7 + s.cavaliers * 5 + s.valets * 3;
    return {
      summary: { ...common, oudlers, takerHalfPoints: half },
      input: { mode: "cartes", bouts: s.bouts, rois: s.rois, dames: s.dames, cavaliers: s.cavaliers, valets: s.valets, autres },
      extra: { h, b: oudlers * 9, c: autres, small: autres, total: half },
    };
  } catch (e) {
    if (e instanceof RuleError) return null;
    throw e;
  }
}

export function DealEntry({ game, dealId }: { game: Game; dealId?: string | undefined }) {
  const { data, t, lang, back, saveDeal, savePasse, seats, opts } = useApp();
  const players = seats(game);
  const [passe, setPasse] = useState(false);
  const [s, setS] = useState<State>(() => initial(game, dealId, data.settings.defaultMode));
  const [bonusOpen, setBonusOpen] = useState(false);
  const set = (patch: Partial<State>) => setS((x) => ({ ...x, ...patch }));
  const n = playerCount(game);
  const v = variant(n);
  const built = useMemo(() => build(game, s), [game, s]);
  // The misère value is the one the deal was saved with, else the table's setting (0 = not played).
  const editing = dealId ? game.deals.find((d) => d.id === dealId) : undefined;
  const misereValue = (editing && isPlayed(editing) && editing.misere?.value) || data.settings.misere;
  const misere: Misere | null = misereValue > 0 && s.misereAtout.length + s.misereTete.length > 0
    ? { atout: s.misereAtout, tete: s.misereTete, value: misereValue } : null;
  const result: DealResult | null = useMemo(() => {
    if (!built) return null;
    const r = applyRounding(scoreFromSummary({ ...built.summary, players: n }), opts);
    if (!hasMisere(misere)) return r;
    const extra = misereScores(n, misere);
    return { ...r, scores: r.scores.map((x, i) => x + (extra[i] ?? 0)) };
  }, [built, n, opts, misere?.value, s.misereAtout, s.misereTete]); // eslint-disable-line react-hooks/exhaustive-deps
  const dealNo = dealId ? game.deals.findIndex((d) => d.id === dealId) + 1 : game.deals.length + 1;
  const taker = s.taker !== null ? players[s.taker] : undefined;

  const pickTaker = (i: number) => { setPasse(false); set({ taker: i, partner: s.partner === i ? null : s.partner }); };
  const typeKey = (k: string) => {
    let text = s.text;
    if (k === "⌫") text = text.includes(".") ? text.slice(0, text.indexOf(".")) : text.slice(0, -1);
    else if (k === "½") { if (text && !text.includes(".")) text += ".5"; }
    else if (!text.includes(".")) text = text === "0" ? k : text + k;
    const hv = parseHalf(text);
    if (hv !== null && hv > 182) return;
    set({ text });
  };

  const save = () => {
    if (!built) return;
    saveDeal(game.id, { ...(dealId ? { id: dealId } : {}), summary: built.summary, input: built.input, misere });
    back();
  };

  const bonusCount = (s.petitAuBout !== 0 ? 1 : 0) + s.poignees.length + (s.chelem !== "none" ? 1 : 0) + (misere ? 1 : 0);

  return (
    <main className="screen entry">
      <Header onBack={back} backIcon="close" backLabel={t("close")} title={
        <span className="mode-switch" role="group" aria-label={t("dealTitle", { n: dealNo })}>
          {(["points", "cartes"] as const).map((m) => (
            <button type="button" key={m} className={s.mode === m ? "on" : ""} aria-pressed={s.mode === m} onClick={() => set({ mode: m })}>
              {m === "points" ? t("modePoints") : t("modeCards")}
            </button>
          ))}
        </span>
      } />

      <section className="col gap4">
        <span className="label">{t("whoTook")}</span>
        <div className="people" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {players.map((p, i) => (
            <button type="button" key={i} className={s.taker === i ? "person on" : "person"} aria-pressed={s.taker === i} onClick={() => pickTaker(i)}>
              <Avatar player={p} size={46} /><span>{p.name}</span>
            </button>
          ))}
        </div>
      </section>

      {!dealId && (
        <button type="button" className={passe ? "passe-btn on" : "passe-btn"} aria-pressed={passe} onClick={() => { setPasse(!passe); set({ taker: null }); }}>
          {MoreIcon.minus}{t("everyonePasses")}
        </button>
      )}

      {passe ? <PasseInfo game={game} /> : <>
      <section className="col gap6">
        <span className="label">{t("contract")}</span>
        <Seg label={t("contract")} value={s.contract} onChange={(c) => set({ contract: c })} small
          options={CONTRACTS.map((c) => ({ value: c, label: CONTRACT_LABEL[c] }))} />
      </section>

      {n === 5 && (
        <section className="col gap4">
          <span className="label">{t("withWhom")} <span className="muted normal">{t("calledKing")}</span></span>
          <div className="people" style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}>
            {players.map((p, i) => (
              <button type="button" key={i} disabled={s.taker === i} className={s.partner === i ? "person sm on" : "person sm"} aria-pressed={s.partner === i} onClick={() => set({ partner: i })}>
                <Avatar player={p} size={40} /><span>{p.name}</span>
              </button>
            ))}
            <button type="button" className={s.partner === "seul" ? "person sm on" : "person sm"} aria-pressed={s.partner === "seul"} onClick={() => set({ partner: "seul" })}>
              <span className="alone-dot">{t("alone")}</span><span>{t("nobody")}</span>
            </button>
          </div>
        </section>
      )}

      {s.mode === "points" ? (
        <>
          <section className="col gap6">
            <div className="row-between"><span className="label">{t("bouts")}</span>
              {s.oudlers !== null && <span className="small muted">{t("pointsNeeded", { n: (NEEDED_HALF_POINTS[s.oudlers] ?? 0) / 2 })}</span>}</div>
            <Seg label={t("bouts")} value={s.oudlers} onChange={(o) => set({ oudlers: o })}
              options={([0, 1, 2, 3] as const).map((o) => ({ value: o, label: <span className="num">{o}</span> }))} />
          </section>

          <section className="col">
            <div className="row-between">
              <span className="label">{s.quick ? "" : t("points")}</span>
              <button type="button" className="link" onClick={() => set({ quick: !s.quick, text: "" })}>{s.quick ? t("typePoints") : t("quickEntry")}</button>
            </div>
            {s.quick && (
              <Seg label={t("quickEntry")} value={s.won ? "made" : "failed"} onChange={(x) => set({ won: x === "made" })}
                options={[{ value: "made", label: t("made") }, { value: "failed", label: t("failed") }]} />
            )}
            <div className="points-display">
              {s.quick && <span className="muted">{t("by")}</span>}
              <span className="big-num">{s.text === "" ? "—" : formatPoints(parseHalf(s.text) ?? 0, lang)}</span>
              {!s.quick && <span className="muted">/ 91</span>}
              {!s.quick && s.text !== "" && <span className="small muted push">{t("defence")} {formatPoints(182 - (parseHalf(s.text) ?? 0), lang)}</span>}
            </div>
          </section>

          <div className="numpad">
            {["1", "2", "3", "½", "4", "5", "6", "0", "7", "8", "9", "⌫"].map((k) => (
              <button type="button" key={k} className={k === "½" || k === "⌫" ? "key alt" : "key"} aria-label={k === "⌫" ? t("erase") : k} onClick={() => typeKey(k)}>
                {k === "⌫" ? Icon.backspace : k}
              </button>
            ))}
          </div>
        </>
      ) : (
        <CardCount s={s} set={set} t={t} takerName={taker?.name} chien={v.chienSize} />
      )}

      <button type="button" className="bonus-btn" onClick={() => setBonusOpen(true)}>
        {Icon.plus}<span className="strong">{t("bonus")}</span>
        <span className="small muted grow left">{bonusCount ? bonusSummary(s, t, players) : misereValue > 0 ? t("bonusHintMisere") : t("bonusHint")}</span>
      </button>

      </>}

      <div className="bottom col gap10">
        {passe ? (
          <button type="button" className="btn-primary" onClick={() => { savePasse(game.id); back(); }}>{t("validatePasse")}</button>
        ) : (
          <>
            {result && built && <Preview players={players} r={result} t={t} lang={lang} showCalc={data.settings.showCalculation} extra={built.extra} opts={opts} />}
            <button type="button" className="btn-primary" disabled={!built} onClick={save}>{dealId ? t("saveChanges") : t("validate")}</button>
          </>
        )}
      </div>

      {bonusOpen && <BonusSheet s={s} t={t} players={players} misereValue={misereValue} onClose={() => setBonusOpen(false)} onApply={(p) => { set(p); setBonusOpen(false); }} />}
    </main>
  );
}

function bonusSummary(s: State, t: T, players: Player[]): string {
  const parts: string[] = [];
  const names = [...s.misereAtout, ...s.misereTete].map((i) => players[i]?.name).filter(Boolean);
  if (names.length) parts.push(`${t("misere")} (${names.join(", ")})`);
  if (s.petitAuBout !== 0) parts.push(`${t("petitAuBout")} (${s.petitAuBout > 0 ? t("attack") : t("defence")})`);
  for (const p of s.poignees) parts.push(`${t("poignee")} ${t(p).toLowerCase()}`);
  if (s.chelem !== "none") parts.push(t("chelem"));
  return parts.join(" · ");
}

function Counter({ letter, name, hint, value, max, onChange, t }: { letter: string; name: string; hint: string; value: number; max: number; onChange: (n: number) => void; t: T }) {
  return (
    <div className="counter-row">
      <span className="mini-card">{letter}</span>
      <div className="col grow"><span className="strong">{name}</span><span className="tiny muted">{hint}</span></div>
      <button type="button" className="round-btn" aria-label={t("lessOf", { what: name })} disabled={value <= 0} onClick={() => onChange(value - 1)}>−</button>
      <span className="count" aria-live="polite">{value}</span>
      <button type="button" className="round-btn dark" aria-label={t("moreOf", { what: name })} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
    </div>
  );
}

function CardCount({ s, set, t, takerName, chien }: {
  s: State; set: (p: Partial<State>) => void; t: T; takerName: string | undefined; chien: number;
}) {
  const honours = Number(s.bouts.petit) + Number(s.bouts.vingtEtUn) + Number(s.bouts.excuse) + s.rois + s.dames + s.cavaliers + s.valets;
  const max = 78 - honours;
  const autres = s.autres === "" ? 0 : Number(s.autres);
  const setAutres = (x: number) => set({ autres: String(Math.max(0, Math.min(max, x))) });
  const chienNote = s.contract === "gardeContre" ? t("chienNotCounted") : s.contract === "gardeSans" ? t("chienAddIt", { n: chien }) : t("ecartIncluded");
  const bout = (k: keyof State["bouts"], label: string, face: string) => (
    <button type="button" className={s.bouts[k] ? "bout on" : "bout"} aria-pressed={s.bouts[k]} onClick={() => set({ bouts: { ...s.bouts, [k]: !s.bouts[k] } })}>
      <span className="bout-face">{face}</span><span className="strong small">{label}</span>
    </button>
  );
  return (
    <>
      <p className="small muted">{takerName ? t("countTakerSide", { name: takerName }) : t("countTakerSideNoName")}</p>
      <section className="col gap6">
        <span className="label">{t("bouts")}</span>
        <div className="grid3">
          {bout("petit", t("petit"), "1")}
          {bout("vingtEtUn", t("vingtEtUn"), "21")}
          {bout("excuse", t("excuse"), "★")}
        </div>
      </section>
      <section className="card counters">
        <Counter letter="R" name={t("rois")} hint={t("each45")} value={s.rois} max={4} onChange={(x) => set({ rois: x })} t={t} />
        <Counter letter="D" name={t("dames")} hint={t("each35")} value={s.dames} max={4} onChange={(x) => set({ dames: x })} t={t} />
        <Counter letter="C" name={t("cavaliers")} hint={t("each25")} value={s.cavaliers} max={4} onChange={(x) => set({ cavaliers: x })} t={t} />
        <Counter letter="V" name={t("valets")} hint={t("each15")} value={s.valets} max={4} onChange={(x) => set({ valets: x })} t={t} />
        <div className="counter-row">
          <span className="mini-card stack" aria-hidden="true">{MoreIcon.cards}</span>
          <label className="col grow" htmlFor="autres"><span className="strong">{t("autres")}</span><span className="tiny muted">{t("autresHint")}</span></label>
          <button type="button" className="round-btn" aria-label={t("lessOf", { what: t("autres") })} disabled={autres <= 0} onClick={() => setAutres(autres - 1)}>−</button>
          <input id="autres" className={s.autres === "" ? "count-input empty" : "count-input"} inputMode="numeric" pattern="[0-9]*" placeholder="0" value={s.autres}
            onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 2); set({ autres: d === "" ? "" : String(Math.min(max, Number(d))) }); }}
            onFocus={(e) => e.target.select()} />
          <button type="button" className="round-btn dark" aria-label={t("moreOf", { what: t("autres") })} disabled={autres >= max} onClick={() => setAutres(autres + 1)}>+</button>
        </div>
      </section>
      <p className="tiny muted center">{s.contract ? chienNote : t("ecartIncluded")} · {t("totalCards", { n: honours + autres, count: honours + autres })}</p>
    </>
  );
}

function Preview({ players, r, t, lang, showCalc, extra, opts }: {
  players: Player[]; r: DealResult; t: T; lang: "fr" | "en"; showCalc: boolean; extra: { h: number; b: number; c: number; small: number; total: number } | undefined; opts: ScoreOptions;
}) {
  const margin = Math.ceil(Math.abs(r.takerHalfPoints - r.neededHalfPoints) / 2);
  const exact = formatPoints(Math.abs(r.takerHalfPoints - r.neededHalfPoints), lang);
  const verdict = r.takerHalfPoints === r.neededHalfPoints ? t("exactly") : r.won ? t("madeBy", { n: exact }) : t("failedBy", { n: exact });
  const pab = r.petitAuBout === 0 ? 0 : (r.won ? r.petitAuBout : -r.petitAuBout) * 10;
  const calcExact = `(25 + ${margin}${pab ? ` ${pab > 0 ? "+" : "−"} ${Math.abs(pab)}` : ""}) × ${r.multiplier} = ${(r.base + pab) * r.multiplier}${r.poigneeBonus ? ` + ${r.poigneeBonus}` : ""}`;
  const defenders = r.scores.map((s, i) => ({ s, i })).filter(({ i }) => i !== r.taker && i !== r.partner);
  const sameDef = defenders.every((d) => d.s === defenders[0]?.s);
  const calc = opts.round10 ? `${calcExact} → ${Math.abs(defenders[0]?.s ?? 0)}` : calcExact;
  return (
    <section className={extra ? "preview dark" : "preview"} aria-live="polite">
      {extra && (
        <div className="row gap10 wrap">
          <span className="big-pts">{t("pointsCount", { n: formatPoints(extra.total, lang) })}</span>
          <span className={r.won ? "pill good" : "pill bad"}>{verdict.toLowerCase()}</span>
        </div>
      )}
      {extra && <span className="tiny on-dark-muted">{t("countBreakdown", { h: formatPoints(extra.h, lang), b: formatPoints(extra.b, lang), c: extra.c, s: formatPoints(extra.small, lang) })}</span>}
      {!extra && (
        <div className="row-between">
          <span className={r.won ? "strong good-text" : "strong bad-text"}>{verdict}</span>
          {showCalc && <span className="small muted calc">{calc}</span>}
        </div>
      )}
      {extra && showCalc && <span className="tiny on-dark-muted calc">{calc}</span>}
      <div className="preview-scores">
        {[r.taker, ...(r.partner !== null ? [r.partner] : [])].map((i) => (
          <span key={i}>{players[i]?.name} {signed(r.scores[i] ?? 0)}</span>
        ))}
        {sameDef && defenders[0] ? (
          <span className={(defenders[0].s < 0) ? "neg-soft" : ""}>{t("others")} {signed(defenders[0].s)}</span>
        ) : defenders.map((d) => <span key={d.i}>{players[d.i]?.name} {signed(d.s)}</span>)}
      </div>
    </section>
  );
}

function PasseInfo({ game }: { game: Game }) {
  const { data, t, seats } = useApp();
  const players = seats(game);
  const now = nextDealer(game, data.settings.passeRule);
  const after = nextDealer({ ...game, dealerOverride: null, deals: [...game.deals, { id: "x", at: 0, dealer: now, kind: "passe" }] }, data.settings.passeRule);
  const a = players[now], b = players[after];
  if (!a || !b) return null;
  return (
    <>
      <section className="card passe-card">
        <div className="row gap8 center-x">
          <Avatar player={a} size={40} />
          {now !== after && <>{MoreIcon.arrow}<Avatar player={b} size={40} /></>}
        </div>
        <span className="h3">{t("noPoints")}</span>
        <span className="muted">{now === after ? t("passeSame", { a: a.name }) : t("passeNext", { a: a.name, b: b.name })}</span>
        <span className="small muted">{t("passeChange")}</span>
      </section>
      <p className="small muted center">{t("misdealNote")}</p>
    </>
  );
}

function MiserePicker({ label, hint, players, value, onChange }: { label: string; hint: string; players: Player[]; value: number[]; onChange: (v: number[]) => void }) {
  return (
    <div className="col gap4">
      <span className="small"><span className="strong">{label}</span> <span className="muted">{hint}</span></span>
      <div className="people" role="group" aria-label={label} style={{ gridTemplateColumns: `repeat(${players.length}, minmax(0, 1fr))` }}>
        {players.map((p, i) => {
          const on = value.includes(i);
          return (
            <button type="button" key={i} className={on ? "person sm on" : "person sm"} aria-pressed={on}
              onClick={() => onChange(on ? value.filter((x) => x !== i) : [...value, i].sort((a, b) => a - b))}>
              <Avatar player={p} size={38} /><span>{p.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BonusSheet({ s, t, players, misereValue, onClose, onApply }: {
  s: State; t: T; players: Player[]; misereValue: number; onClose: () => void; onApply: (p: Partial<State>) => void;
}) {
  const [atout, setAtout] = useState<number[]>(s.misereAtout);
  const [tete, setTete] = useState<number[]>(s.misereTete);
  const [pab, setPab] = useState(s.petitAuBout);
  const [poignees, setPoignees] = useState<(PoigneeLevel | null)[]>(s.poignees.length ? s.poignees : [null]);
  const [chelem, setChelem] = useState<Chelem>(s.chelem);
  return (
    <Sheet title={t("bonus")} onClose={onClose} closeLabel={t("close")}>
      <section className="col gap6">
        <div className="row-between"><span className="label">{t("petitAuBout")}</span><span className="small muted">{t("tenTimes")}</span></div>
        <Seg label={t("petitAuBout")} value={pab} onChange={setPab}
          options={[{ value: 0 as const, label: t("nobody") }, { value: 1 as const, label: t("attack") }, { value: -1 as const, label: t("defence") }]} />
      </section>
      <section className="col gap6">
        <div className="row-between"><span className="label">{t("poignee")}</span><span className="small muted">{t("toWinningSide")}</span></div>
        {poignees.map((p, k) => (
          <div key={k} className="col gap4">
            <Seg label={t("poignee")} value={p ?? "none"} small onChange={(x) => setPoignees((ps) => ps.map((q, j) => (j === k ? (x === "none" ? null : x) : q)))}
              options={[{ value: "none" as const, label: t("none") }, ...POIGNEES.map((q) => ({ value: q, label: <>{t(q)}<br /><span className="tiny">{q === "simple" ? 20 : q === "double" ? 30 : 40}</span></> }))]} />
            {k > 0 && <button type="button" className="link small left" onClick={() => setPoignees((ps) => ps.filter((_, j) => j !== k))}>{t("removePoignee")}</button>}
          </div>
        ))}
        {poignees.length < 3 && <button type="button" className="link left" onClick={() => setPoignees((ps) => [...ps, null])}>{t("addPoignee")}</button>}
      </section>
      <section className="col gap6">
        <span className="label">{t("chelem")}</span>
        <Seg label={t("chelem")} value={chelem} onChange={setChelem} cols={2} small
          options={[
            { value: "none" as const, label: t("noneM") },
            { value: "madeAnnounced" as const, label: `${t("chelemMadeAnnounced")} · +400` },
            { value: "made" as const, label: `${t("chelemMade")} · +200` },
            { value: "failedAnnounced" as const, label: `${t("chelemFailed")} · −200` },
          ]} />
      </section>
      {misereValue > 0 && (
        <section className="col gap8">
          <div className="row-between"><span className="label">{t("misere")}</span><span className="small muted">{t("misereGain", { v: misereValue })}</span></div>
          <MiserePicker label={t("misereAtout")} hint={t("misereAtoutHint")} players={players} value={atout} onChange={setAtout} />
          <MiserePicker label={t("misereTete")} hint={t("misereTeteHint")} players={players} value={tete} onChange={setTete} />
        </section>
      )}
      <button type="button" className="btn-primary" onClick={() => onApply({ petitAuBout: pab, poignees: poignees.filter((p): p is PoigneeLevel => p !== null), chelem, misereAtout: atout, misereTete: tete })}>{t("apply")}</button>
    </Sheet>
  );
}
