import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { findGame, useApp } from "../App";
import { GAME_LENGTHS, nextDealer, TARGET_SCORES } from "../model";
import { newPlayer } from "../storage";
import { Avatar, Header, Icon, MoreIcon, Seg, Sheet } from "../components/ui";

const ROW_H = 64;

export function NewGame({ fromGameId, draftKey }: { fromGameId?: string | undefined; draftKey: number }) {
  const { data, t, back, go, startGame, replace, player, savePlayer, toast, draft, setDraft } = useApp();
  const from = fromGameId ? findGame(data, fromGameId) : undefined;
  const saved = draft && draft.key === draftKey ? draft : null;
  const [count, setCount] = useState<3 | 4 | 5>(saved?.count ?? (from?.players.length as 3 | 4 | 5 | undefined) ?? 5);
  const [seats, setSeats] = useState<(string | null)[]>(() => {
    if (saved) return saved.seats;
    const ids: (string | null)[] = from ? from.players.map((p) => p.id) : [];
    while (ids.length < 5) ids.push(null);
    return ids;
  });
  const [dealerId, setDealerId] = useState<string | null>(() => (saved ? saved.dealerId : from ? from.players[nextDealer(from, data.settings.passeRule)]?.id ?? null : null));
  // Game length: as last time, since tables tend to keep their habit.
  const last = from ?? data.games[0];
  const [targetDeals, setTargetDeals] = useState<number | null>(() => (saved ? saved.targetDeals : last?.targetDeals ?? null));
  const [targetScore, setTargetScore] = useState<number | null>(() => (saved ? saved.targetScore : last?.targetScore ?? null));
  // How the game ends: when the players decide, after a number of deals, or when someone reaches a score.
  const [endBy, setEndBy] = useState<"free" | "deals" | "score">(targetScore ? "score" : targetDeals ? "deals" : "free");
  useEffect(() => { setDraft({ key: draftKey, count, seats, dealerId, targetDeals, targetScore }); }, [draftKey, count, seats, dealerId, targetDeals, targetScore, setDraft]);
  const pickEnd = (e: "free" | "deals" | "score") => {
    setEndBy(e);
    setTargetDeals(e === "deals" ? targetDeals ?? 10 : null);
    setTargetScore(e === "score" ? targetScore ?? 1000 : null);
  };
  const [picker, setPicker] = useState(false);
  const [drag, setDrag] = useState<{ from: number; dy: number } | null>(null);
  const dragStart = useRef(0);

  const seated = seats.slice(0, count).map((s) => (s && player(s) && !player(s)?.archived ? s : null));
  const filled = seated.filter((s): s is string => s !== null);
  const missing = count - filled.length;
  const dealerIndex = Math.max(0, dealerId ? seated.indexOf(dealerId) : seated.findIndex((s) => s !== null));
  const regulars = data.players.filter((p) => !p.archived && !filled.includes(p.id)).slice(0, 4);

  const changeCount = (n: 3 | 4 | 5) => {
    setCount(n);
    // Keep who is seated: pack players into the remaining seats.
    setSeats((s) => {
      const people = s.filter((x): x is string => x !== null).slice(0, n);
      const out: (string | null)[] = [...people];
      while (out.length < 5) out.push(null);
      return out;
    });
  };
  const seatPlayer = (id: string): boolean => {
    const i = seated.findIndex((s) => s === null);
    if (i < 0) { toast(t("full")); return false; }
    setSeats((s) => s.map((x, j) => (j === i ? id : x)));
    return true;
  };
  const unseat = (id: string) => {
    setSeats((s) => {
      const rest = s.slice(0, count).filter((x) => x !== id);
      const out: (string | null)[] = [...rest, null];
      while (out.length < 5) out.push(null);
      return out;
    });
    if (dealerId === id) setDealerId(null);
  };

  // Drag to reorder: move a row by whole rows as the finger moves.
  const target = drag ? Math.min(count - 1, Math.max(0, drag.from + Math.round(drag.dy / ROW_H))) : -1;
  const onGripDown = (i: number) => (e: RPointerEvent) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    dragStart.current = e.clientY;
    setDrag({ from: i, dy: 0 });
  };
  const onGripMove = (e: RPointerEvent) => { if (drag) setDrag({ ...drag, dy: e.clientY - dragStart.current }); };
  const onGripUp = () => {
    if (drag && target !== drag.from) {
      setSeats((s) => {
        const list = s.slice(0, count);
        const [moved] = list.splice(drag.from, 1);
        list.splice(target, 0, moved ?? null);
        return [...list, ...s.slice(count)];
      });
    }
    setDrag(null);
  };
  const shiftFor = (i: number): number => {
    if (!drag) return 0;
    if (i === drag.from) return drag.dy;
    if (drag.from < target && i > drag.from && i <= target) return -ROW_H;
    if (drag.from > target && i < drag.from && i >= target) return ROW_H;
    return 0;
  };

  const start = () => {
    if (missing > 0) return;
    const id = startGame(filled, dealerIndex, { targetDeals, targetScore });
    setDraft(null);
    replace({ name: "sheet", gameId: id });
  };

  return (
    <main className="screen">
      <Header title={t("newGame")} onBack={back} backLabel={t("back")} />

      <section className="col gap8">
        <span className="label">{t("playerCount")}</span>
        <Seg label={t("playerCount")} value={count} onChange={changeCount}
          options={[3, 4, 5].map((n) => ({ value: n as 3 | 4 | 5, label: <span className="num">{n}</span> }))} />
      </section>

      <section className="col gap6">
        <div className="row-between pad4"><span className="label">{t("atTable")}</span><span className="small muted">{t("dragOrder")}</span></div>
        <div className="card seats" onPointerMove={onGripMove} onPointerUp={onGripUp} onPointerCancel={onGripUp}>
          {seated.map((id, i) => {
            const p = id ? player(id) : undefined;
            const style = { transform: `translateY(${shiftFor(i)}px)`, transition: drag && i === drag.from ? "none" : "transform 0.15s", zIndex: drag && i === drag.from ? 2 : 1 };
            if (!p) {
              return (
                <button type="button" key={`empty-${i}`} className="seat-row empty" style={style} onClick={() => setPicker(true)}>
                  <span className="grip-space" />
                  <span className="add-dot">{Icon.plus}</span>
                  <span className="grow left">{t("playerN", { n: i + 1 })}</span>
                  <span className="strong accent">{t("choose")}</span>
                </button>
              );
            }
            return (
              <div key={p.id} className={drag && i === drag.from ? "seat-row dragging" : "seat-row"} style={style}>
                <span className="grip" aria-label={t("move", { name: p.name })} onPointerDown={onGripDown(i)}>{MoreIcon.grip}</span>
                <button type="button" className="avatar-btn" aria-label={t("changeLook", { name: p.name })} onClick={() => go({ name: "editPlayer", playerId: p.id })}>
                  <Avatar player={p} size={44} />
                </button>
                <span className="strong grow name-17">{p.name}</span>
                <button type="button" className={dealerIndex === i ? "dealer-chip on" : "dealer-chip"} aria-pressed={dealerIndex === i} onClick={() => setDealerId(p.id)}>{t("deals")}</button>
                <button type="button" className="icon-btn narrow muted" aria-label={t("remove", { name: p.name })} onClick={() => unseat(p.id)}>{MoreIcon.x}</button>
              </div>
            );
          })}
        </div>
      </section>

      {(regulars.length > 0 || data.players.length > 0) && (
        <section className="col gap8">
          <span className="small strong muted pad4">{t("oftenWith")}</span>
          <div className="chips">
            {regulars.map((r) => (
              <button type="button" key={r.id} className="chip" onClick={() => seatPlayer(r.id)}>
                <Avatar player={r} size={28} /> {r.name}
              </button>
            ))}
            <button type="button" className="chip dashed" onClick={() => setPicker(true)}>{t("allMyPlayers")}</button>
          </div>
        </section>
      )}

      <section className="col gap6">
        <span className="label pad4">{t("gameEnds")}</span>
        <Seg label={t("gameEnds")} value={endBy} small onChange={pickEnd}
          options={[{ value: "free" as const, label: t("free") }, { value: "deals" as const, label: t("endDeals") }, { value: "score" as const, label: t("endScore") }]} />
        {endBy === "deals" && (
          <Seg label={t("endDeals")} value={targetDeals} small onChange={setTargetDeals}
            options={GAME_LENGTHS.map((d) => ({ value: d, label: <span className="num">{d}</span> }))} />
        )}
        {endBy === "score" && (
          <Seg label={t("endScore")} value={targetScore} small onChange={setTargetScore}
            options={TARGET_SCORES.map((d) => ({ value: d, label: <span className="num">{d}</span> }))} />
        )}
        <span className="small muted pad4">{endBy === "deals" ? t("lengthHint", { n: targetDeals ?? 0 }) : endBy === "score" ? t("scoreHint", { n: targetScore ?? 0 }) : t("lengthFree")}</span>
      </section>

      <div className="bottom col gap6">
        <button type="button" className="btn-primary" disabled={missing > 0} onClick={start}>{t("startGame")}</button>
        {missing > 0 && <span className="small muted center">{t(missing === 1 ? "missing1" : "missingN", { n: missing })}</span>}
      </div>

      {picker && (
        <PlayerPicker
          count={count}
          seated={filled}
          onToggle={(id) => (filled.includes(id) ? (unseat(id), true) : seatPlayer(id))}
          onCreate={(name) => {
            const p = newPlayer(name, data.players);
            savePlayer(p);
            seatPlayer(p.id);
          }}
          onClose={() => setPicker(false)}
        />
      )}
    </main>
  );
}

function PlayerPicker({ count, seated, onToggle, onCreate, onClose }: {
  count: number; seated: string[]; onToggle: (id: string) => boolean; onCreate: (name: string) => void; onClose: () => void;
}) {
  const { data, t } = useApp();
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const gamesBy = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of data.games) for (const p of g.players) m.set(p.id, (m.get(p.id) ?? 0) + 1);
    return m;
  }, [data.games]);
  const list = data.players.filter((p) => !p.archived && p.name.toLowerCase().includes(q.trim().toLowerCase()));
  const exact = data.players.some((p) => !p.archived && p.name.trim().toLowerCase() === q.trim().toLowerCase());
  const create = () => { if (q.trim() && !exact) { onCreate(q.trim()); setQ(""); } };

  return (
    <Sheet title={t("whoPlays")} onClose={onClose} closeLabel={t("close")} aside={<span className="strong muted small">{t("nOfM", { n: seated.length, m: count })}</span>}>
      <label className="search">
        {MoreIcon.search}
        <input ref={input} value={q} placeholder={t("searchPlayer")} aria-label={t("searchPlayer")} maxLength={16}
          onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") create(); }} />
      </label>
      {list.length > 0 && (
        <div className="card list picker-list">
          {list.map((p) => {
            const on = seated.includes(p.id);
            return (
              <button type="button" key={p.id} className="list-row" aria-pressed={on} onClick={() => onToggle(p.id)}>
                <Avatar player={p} size={44} />
                <span className="col grow">
                  <span className="strong">{p.name}</span>
                  <span className="small muted">{t("gamesCount", { n: gamesBy.get(p.id) ?? 0, count: gamesBy.get(p.id) ?? 0 })}{on ? t("atTableTag") : ""}</span>
                </span>
                <span className={on ? "tick on" : "tick"}>{on && MoreIcon.check}</span>
              </button>
            );
          })}
        </div>
      )}
      {q.trim() && !exact ? (
        <button type="button" className="bonus-btn center-content" onClick={create}>{Icon.plus}<span className="strong">{t("createNamed", { name: q.trim() })}</span></button>
      ) : (
        <button type="button" className="bonus-btn center-content" onClick={() => input.current?.focus()}>{Icon.plus}<span className="strong">{t("newPlayer")}</span></button>
      )}
      <button type="button" className="btn-primary" onClick={onClose}>{t("done")}</button>
    </Sheet>
  );
}
