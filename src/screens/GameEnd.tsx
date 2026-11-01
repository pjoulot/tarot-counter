import { useApp } from "../App";
import { APP_NAME, highlights, ranking, signed, type Game } from "../model";
import { formatDate, place } from "../i18n";
import { shareText as shareNative } from "../native";
import { Avatar, Header, Icon } from "../components/ui";

const PODIUM_TINT = ["#FFE9A8", "#E5ECF7", "#F3E3D3"];

export function GameEnd({ game }: { game: Game }) {
  const { t, lang, back, go, replace, toast, seats, opts } = useApp();
  const players = seats(game);
  const rank = ranking(game, opts);
  const h = highlights(game, opts);
  const [first, second, third] = rank;
  const rest = rank.slice(3);

  const shareText = () => {
    const lines = [t("shareTitle", { app: APP_NAME, date: formatDate(game.createdAt, lang) }), t("shareDeals", { n: h.deals, count: h.deals }), ""];
    for (const r of rank) lines.push(`${place(t, r.place)} ${players[r.seat]?.name ?? ""} : ${signed(r.total)}`);
    return lines.join("\n");
  };
  const share = async () => {
    const text = shareText();
    try {
      if (await shareNative(text)) return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // the person closed the share sheet
    }
    try { await navigator.clipboard.writeText(text); toast(t("copied")); } catch { /* nothing more we can do */ }
  };


  const podium = (r: typeof first, pos: 1 | 2 | 3, height: number) => {
    if (!r) return <div />;
    const p = players[r.seat];
    if (!p) return <div />;
    return (
      <div className="podium-col">
        {pos === 1 && Icon.crown}
        <Avatar player={p} size={pos === 1 ? 72 : 60} />
        <span className="strong">{p.name}</span>
        <div className="podium-step" style={{ height, background: PODIUM_TINT[pos - 1] }}>
          <span className={r.total < 0 ? "score neg" : "score"}>{signed(r.total)}</span>
          <span className="tiny strong muted">{place(t, r.place)}</span>
        </div>
      </div>
    );
  };

  return (
    <main className="screen">
      <Header title={t("gameOver")} onBack={back} backIcon="close" backLabel={t("close")} />
      <p className="muted sub-title">{formatDate(game.createdAt, lang)} · {t("playersCount", { n: game.players.length })}</p>

      <div className="podium">
        {podium(second, 2, 96)}
        {podium(first, 1, 132)}
        {podium(third, 3, 72)}
      </div>
      {rest.length > 0 && (
        <section className="card podium-rest">
          {rest.map((r) => {
            const p = players[r.seat];
            return p ? (
              <div key={r.seat} className="dist-row">
                <span className="rank-place">{place(t, r.place)}</span><Avatar player={p} size={36} /><span className="strong">{p.name}</span>
                <span className={r.total < 0 ? "score-sm neg push" : "score-sm push"}>{signed(r.total)}</span>
              </div>
            ) : null;
          })}
        </section>
      )}

      <div className="grid3">
        <div className="card fact"><span className="tiny muted">{t("biggest")}</span><span className="small strong">{h.biggest ? `${players[h.biggest.seat]?.name} · ${signed(h.biggest.score)}` : "—"}</span></div>
        <div className="card fact"><span className="tiny muted">{t("bestTaker")}</span><span className="small strong">{h.bestTaker ? `${players[h.bestTaker.seat]?.name} · ${h.bestTaker.won}/${h.bestTaker.taken}` : "—"}</span></div>
        <div className="card fact"><span className="tiny muted">{t("dealsPlayed")}</span><span className="small strong">{h.deals}</span></div>
      </div>

      <button type="button" className="link center-self" onClick={() => go({ name: "sheet", gameId: game.id })}>{t("seeSheet")}</button>

      <div className="bottom">
        <div className="grid2">
          <button type="button" className="btn-secondary with-icon" onClick={share}>{Icon.share}{t("share")}</button>
          <button type="button" className="btn-primary" onClick={() => replace({ name: "newGame", from: game.id })}>{t("playAgain")}</button>
        </div>
      </div>
    </main>
  );
}
