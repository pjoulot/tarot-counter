import type { ReactNode } from "react";
import { useApp } from "../App";
import { CONTRACT_LABEL } from "../i18n";
import { asset, Header } from "../components/ui";

function Card({ title, children }: { title: string; children: ReactNode }) {
  return <section className="card rule-card"><h2 className="h3">{title}</h2>{children}</section>;
}
function Tiles({ items, cols }: { items: [string, string][]; cols: number }) {
  return (
    <div className="tiles" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {items.map(([a, b]) => <div key={a} className="tile"><span className="small muted">{a}</span><span className="tile-num">{b}</span></div>)}
    </div>
  );
}
function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  const cols = `1.4fr repeat(${head.length - 1}, minmax(0, 1fr))`;
  return (
    <div className="rt">
      <div className="rt-row rt-head" style={{ gridTemplateColumns: cols }}>{head.map((h, i) => <span key={i}>{h}</span>)}</div>
      {rows.map((r, k) => <div key={k} className="rt-row" style={{ gridTemplateColumns: cols }}>{r.map((c, i) => <span key={i}>{c}</span>)}</div>)}
    </div>
  );
}

export function Rules() {
  const { t, lang, back } = useApp();
  const n = (x: number) => (lang === "fr" ? String(x).replace(".", ",") : String(x));
  return (
    <main className="screen">
      <Header title={t("rules")} onBack={back} backLabel={t("back")} />
      <div className="row gap14 pad4">
        <img src={asset("art/cartes21.webp")} alt="" width={96} height={96} />
        <p className="muted">{t("rulesIntro")}</p>
      </div>
      <Card title={t("rulesContracts")}>
        <Tiles cols={4} items={[[CONTRACT_LABEL.prise, "×1"], [CONTRACT_LABEL.garde, "×2"], [CONTRACT_LABEL.gardeSans, "×4"], [CONTRACT_LABEL.gardeContre, "×6"]]} />
      </Card>
      <Card title={t("rulesNeeded")}>
        <Tiles cols={4} items={[[t("boutsN", { n: 3 }), "36"], [t("boutsN", { n: 2 }), "41"], [t("boutN1"), "51"], [t("boutN0"), "56"]]} />
      </Card>
      <Card title={t("rulesValues")}>
        <Tiles cols={3} items={[[t("bout"), n(4.5)], [t("roi"), n(4.5)], [t("dame"), n(3.5)], [t("cavalier"), n(2.5)], [t("valet"), n(1.5)], [t("other"), n(0.5)]]} />
        <p className="small muted">{t("rulesValuesNote")}</p>
      </Card>
      <Card title={t("rulesCalc")}>
        <div className="formula">{t("rulesFormula")}</div>
        <p className="small muted">{t("rulesCalcNote")}</p>
      </Card>
      <Card title={t("rulesPoignees")}>
        <Table head={[t("trumps"), t("simple"), t("double"), t("triple")]} rows={[
          [t("nPlayers", { n: 3 }), "13", "15", "18"], [t("nPlayers", { n: 4 }), "10", "13", "15"], [t("nPlayers", { n: 5 }), "8", "10", "13"], [t("bonusPts"), "20", "30", "40"],
        ]} />
      </Card>
      <Card title={t("rulesChelem")}>
        <Table head={["", t("points")]} rows={[[t("chelemMadeAnnounced"), "+400"], [t("chelemMade"), "+200"], [t("chelemFailed"), "−200"]]} />
      </Card>
      <Card title={t("rulesSplit")}>
        <p className="small">{t("rulesSplitText")}</p>
      </Card>
    </main>
  );
}
