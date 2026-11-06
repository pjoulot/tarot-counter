import { useState } from "react";
import { scoreFromSummary } from "../scoring";
import { useApp } from "../App";
import { contractScoreOf, formatPoints, hasMisere, isPlayed, playerCount, scoreOf, signed, type Game } from "../model";
import { CONTRACT_LOWER } from "../i18n";
import { Avatar, Header } from "../components/ui";

export function DealDetail({ game, dealId }: { game: Game; dealId: string }) {
  const { t, lang, back, go, deleteDeal, seats, opts } = useApp();
  const [confirm, setConfirm] = useState(false);
  const idx = game.deals.findIndex((d) => d.id === dealId);
  const deal = game.deals[idx];
  const players = seats(game);
  if (!deal) return null;
  const finished = game.finishedAt !== null;
  const dealer = players[deal.dealer];

  const bottom = !finished && (
    <div className="bottom">
      {confirm ? (
        <div className="col gap8">
          <p className="center strong">{t("confirmDelete")}</p>
          <div className="grid2">
            <button type="button" className="btn-secondary" onClick={() => setConfirm(false)}>{t("cancel")}</button>
            <button type="button" className="btn-danger" onClick={() => { deleteDeal(game.id, deal.id); back(); }}>{t("yesDelete")}</button>
          </div>
        </div>
      ) : isPlayed(deal) ? (
        <div className="grid2">
          <button type="button" className="btn-secondary danger-text" onClick={() => setConfirm(true)}>{t("delete")}</button>
          <button type="button" className="btn-primary" onClick={() => go({ name: "entry", gameId: game.id, dealId: deal.id })}>{t("edit")}</button>
        </div>
      ) : (
        <button type="button" className="btn-secondary danger-text" onClick={() => setConfirm(true)}>{t("delete")}</button>
      )}
    </div>
  );

  if (!isPlayed(deal)) {
    return (
      <main className="screen">
        <Header title={t("dealTitle", { n: idx + 1 })} onBack={back} backLabel={t("back")} />
        <section className="card passe-card">
          {dealer && <Avatar player={dealer} size={48} />}
          <span className="h3">{t("passeDetail")}</span>
          <span className="muted">{dealer && t("wasDealing", { name: dealer.name })} · {t("passeRow")}</span>
        </section>
        {bottom}
      </main>
    );
  }

  const r = scoreOf(game, deal, opts);
  const contract = contractScoreOf(game, deal, opts);
  const exactScores = scoreFromSummary({ ...deal.summary, players: playerCount(game) });
  if (!r) return null;
  const taker = players[r.taker];
  const partner = r.partner !== null ? players[r.partner] : undefined;
  if (!taker) return null;
  const margin = Math.ceil(Math.abs(r.takerHalfPoints - r.neededHalfPoints) / 2);
  const exact = formatPoints(Math.abs(r.takerHalfPoints - r.neededHalfPoints), lang);
  const pab = r.petitAuBout === 0 ? 0 : (r.won ? r.petitAuBout : -r.petitAuBout) * 10;
  // Rounding applies to the contract alone; a misère is added afterwards.
  const defender = r.scores.findIndex((_, i) => i !== r.taker && i !== r.partner);
  const exactUnit = Math.abs(exactScores.scores[defender] ?? 0);
  const roundedUnit = Math.abs(contract?.scores[defender] ?? 0);
  const m = deal.misere;
  const n = playerCount(game);
  const misereLines: [string, string][] = hasMisere(m)
    ? [...m.atout.map((i) => [t("misereAtout"), i] as const), ...m.tete.map((i) => [t("misereTete"), i] as const)]
      .map(([label, i]) => [label, `${players[i]?.name ?? "?"} +${m.value * (n - 1)}`])
    : [];

  const chelemText = r.chelem === "madeAnnounced" ? `${t("chelemMadeAnnounced")} · +400` : r.chelem === "made" ? `${t("chelemMade")} · +200` : r.chelem === "failedAnnounced" ? `${t("chelemFailed")} · −200` : null;
  const lines: [string, string][] = [
    [t("bouts"), t("boutsTo", { b: r.oudlers, n: r.neededHalfPoints / 2 })],
    [t("pointsMade"), formatPoints(r.takerHalfPoints, lang)],
    [t("gap"), `${r.won ? "+" : "−"}${exact} (${(r.won ? t("made") : t("failed")).toLowerCase()})`],
    [t("base"), `25 + ${margin} = ${r.base}`],
    ...(pab ? [[t("pab"), `${pab > 0 ? "+" : "−"}10 (${r.petitAuBout > 0 ? t("attack") : t("defence")})`] as [string, string]] : []),
    [t("contract"), `${r.base + pab} × ${r.multiplier} = ${(r.base + pab) * r.multiplier}`],
    ...(r.poigneeBonus ? [[t("poigneeLine"), `+${r.poigneeBonus}`] as [string, string]] : []),
    ...(chelemText ? [[t("chelemLine"), chelemText] as [string, string]] : []),
    ...(opts.round10 && exactUnit !== roundedUnit ? [[t("roundScores"), t("roundedTo", { a: exactUnit, b: roundedUnit })] as [string, string]] : []),
    ...misereLines,
  ];

  return (
    <main className="screen">
      <Header title={t("dealTitle", { n: idx + 1 })} onBack={back} backLabel={t("back")} />

      <section className="card row gap12 pad-card">
        <Avatar player={taker} size={48} />
        <div className="col grow gap2">
          <span className="strong">{t(partner || playerCount(game) !== 5 ? "tookContract" : "tookContractAlone", { name: taker.name, contract: CONTRACT_LOWER[r.contract] })}</span>
          <span className="row gap6 small muted wrap">
            {partner && <><Avatar player={partner} size={22} />{t("withPartner", { name: partner.name })} · </>}
            {dealer && t("wasDealing", { name: dealer.name })}
          </span>
        </div>
        <span className={r.won ? "pill good" : "pill bad"}>{r.takerHalfPoints === r.neededHalfPoints ? t("exactly") : (r.won ? t("madeBy", { n: exact }) : t("failedBy", { n: exact }))}</span>
      </section>

      <section className="card lines">
        {lines.map(([k, v], i) => <div key={i} className="line"><span className="muted">{k}</span><span className="strong right">{v}</span></div>)}
      </section>

      <section className="card pad-card-sm">
        {r.scores.map((s, i) => {
          const p = players[i];
          if (!p) return null;
          const role = i === r.taker ? t("taker_") : i === r.partner ? t("partner_") : t("defender");
          return (
            <div key={i} className="dist-row">
              <Avatar player={p} size={34} /><span className="strong">{p.name}</span><span className="small muted">{role}</span>
              <span className={s < 0 ? "score-sm neg push" : "score-sm push"}>{signed(s)}</span>
            </div>
          );
        })}
        <div className="small muted right pad-top">{t("sumZero")}</div>
      </section>
      {bottom}
    </main>
  );
}
