import { useApp } from "../App";
import { APP_NAME, ranking, signed, totals } from "../model";
import { formatDate } from "../i18n";
import { asset, Avatar, AvatarStack, Icon, IconButton, MoreIcon } from "../components/ui";

export function Home() {
  const { data, t, lang, go, seats, seat, opts } = useApp();
  const current = data.games.find((g) => g.finishedAt === null);
  const past = data.games.filter((g) => g.finishedAt !== null && g.deals.length > 0);
  const firstLaunch = data.games.length === 0 && data.players.length === 0;

  const topBar = (
    <div className="row-end">
      <IconButton label={t("rules")} onClick={() => go({ name: "rules" })}>{Icon.book}</IconButton>
      <IconButton label={t("settings")} onClick={() => go({ name: "settings" })}>{Icon.gear}</IconButton>
    </div>
  );

  if (firstLaunch) {
    const points: [string, string][] = [[t("welcome1"), t("welcome1b")], [t("welcome2"), t("welcome2b")], [t("welcome3"), t("welcome3b")]];
    return (
      <main className="screen">
        {topBar}
        <div className="hero pad-top-12">
          <img src={asset("art/renard.webp")} alt="" width={150} height={150} />
          <h1 className="hero-title">{APP_NAME}</h1>
          <p className="muted center">{t("tagline")}</p>
        </div>
        <section className="card welcome">
          {points.map(([a, b], k) => (
            <div key={a} className="row gap12 top">
              <span className="step-dot">{k + 1}</span>
              <div className="col gap2"><span className="strong">{a}</span><span className="small muted">{b}</span></div>
            </div>
          ))}
        </section>
        <div className="bottom">
          <button type="button" className="btn-primary" onClick={() => go({ name: "newGame" })}>{t("startAGame")}</button>
        </div>
      </main>
    );
  }

  return (
    <main className="screen">
      {topBar}
      <div className="hero">
        <img src={asset("art/renard.webp")} alt="" width={124} height={124} />
        <h1 className="hero-title">{APP_NAME}</h1>
        <p className="muted center">{t("tagline")}</p>
      </div>

      {current && (() => {
        const lead = ranking(current, opts)[0];
        const leader = lead ? seat(current, lead.seat) : undefined;
        return (
          <section className="card card-gold">
            <div className="row-between">
              <span className="eyebrow">{t("gameInProgress")}</span>
              <span className="eyebrow-light">{t("dealN", { n: current.deals.length + 1 })}</span>
            </div>
            <div className="row gap12">
              <AvatarStack players={seats(current)} size={34} />
              <div className="col">
                <span className="strong">{formatDate(current.createdAt, lang)}</span>
                <span className="small brown">
                  {current.deals.length && leader && lead ? t("leads", { name: leader.name, score: lead.total }) : t("noDealYet")}
                </span>
              </div>
            </div>
            <button type="button" className="btn-dark" onClick={() => go({ name: "sheet", gameId: current.id })}>{t("resume")}</button>
          </section>
        );
      })()}

      <section className="col gap8">
        <div className="row-between">
          <h2 className="h2 small-h">{t("previousGames")}</h2>
          <button type="button" className="link row gap6" onClick={() => go({ name: "stats" })}>{MoreIcon.chart}{t("statistics")}</button>
        </div>
        {past.length === 0 ? (
          <p className="muted small pad4">{t("noGames")}</p>
        ) : (
          <div className="card list">
            {past.map((g) => {
              const top = ranking(g, opts)[0];
              const w = top ? seat(g, top.seat) : undefined;
              return (
                <button type="button" key={g.id} className="list-row" onClick={() => go({ name: "end", gameId: g.id })}>
                  <div className="col grow gap6">
                    <div className="row-between">
                      <span className="strong">{formatDate(g.createdAt, lang)}</span>
                      <span className="small muted">{t("playersDeals", { p: g.players.length, d: g.deals.length, count: g.deals.length })}</span>
                    </div>
                    <div className="row gap10">
                      <AvatarStack players={seats(g)} size={28} />
                      {w && top && (
                        <>
                          <span className="small muted">{t("winner")}</span>
                          <Avatar player={w} size={24} />
                          <span className="small strong">{w.name} {signed(totals(g, opts)[top.seat] ?? 0)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {Icon.chev}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <div className="bottom">
        <button type="button" className="btn-primary" onClick={() => go({ name: "newGame" })}>{t("newGame")}</button>
      </div>
    </main>
  );
}
