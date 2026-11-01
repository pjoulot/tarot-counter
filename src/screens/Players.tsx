import { useMemo } from "react";
import { useApp } from "../App";
import { Avatar, Header, Icon, MoreIcon } from "../components/ui";

export function Players() {
  const { data, t, back, go } = useApp();
  const gamesBy = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of data.games) if (g.deals.length) for (const p of g.players) m.set(p.id, (m.get(p.id) ?? 0) + 1);
    return m;
  }, [data.games]);
  const list = data.players.filter((p) => !p.archived);

  return (
    <main className="screen">
      <Header title={t("myPlayers")} onBack={back} backLabel={t("back")} />
      <p className="small muted pad4">{t("myPlayersIntro")}</p>
      {list.length > 0 && (
        <div className="card list">
          {list.map((p) => (
            <div key={p.id} className="list-row static">
              <button type="button" className="row gap12 grow plain left" onClick={() => go({ name: "playerStats", playerId: p.id })}>
                <Avatar player={p} size={48} />
                <span className="col"><span className="strong">{p.name}</span><span className="small muted">{t("seeStats", { n: gamesBy.get(p.id) ?? 0, count: gamesBy.get(p.id) ?? 0 })}</span></span>
              </button>
              <button type="button" className="icon-btn muted" aria-label={t("editX", { name: p.name })} onClick={() => go({ name: "editPlayer", playerId: p.id })}>{MoreIcon.pencil}</button>
            </div>
          ))}
        </div>
      )}
      <div className="bottom">
        <button type="button" className="btn-primary with-icon" onClick={() => go({ name: "editPlayer" })}>{Icon.plus}{t("addPlayer")}</button>
      </div>
    </main>
  );
}
