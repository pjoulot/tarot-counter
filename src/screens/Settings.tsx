import { Fragment, useRef, useState, type ReactNode } from "react";
import { MISERE_VALUES } from "../model";
import { useApp } from "../App";
import { parseBackup, type Settings } from "../storage";
import { toCsv } from "../stats";
import { saveFile } from "../native";
import { Header, Icon, Seg, Sheet, Toggle } from "../components/ui";

export const VERSION = "1.0";

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="col gap6">
      <span className="group-title">{title}</span>
      <div className="card settings-group">{children}</div>
    </section>
  );
}

function Row({ label, value, onClick, danger }: { label: string; value?: string | undefined; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" className="set-row btn-row" onClick={onClick}>
      <span className={danger ? "set-label grow left danger-text" : "set-label grow left"}>{label}</span>
      {value && <span className="set-value">{value}</span>}
      {!danger && Icon.chev}
    </button>
  );
}

function download(name: string, text: string, type: string) {
  void saveFile(name, text, type).catch(() => { /* the person closed the share sheet */ });
}

type Choice = "passe" | "round" | "misere" | null;

export function SettingsScreen() {
  const { data, t, back, go, setSettings, replaceAll, clearHistory, toast, opts } = useApp();
  const [confirmClear, setConfirmClear] = useState(false);
  const [choice, setChoice] = useState<Choice>(null);
  const file = useRef<HTMLInputElement>(null);
  const s = data.settings;
  const day = new Date().toISOString().slice(0, 10);
  const activePlayers = data.players.filter((p) => !p.archived).length;

  const importBackup = async (f: File | undefined) => {
    if (!f) return;
    const parsed = parseBackup(await f.text());
    if (!parsed) { toast(t("importBad")); return; }
    replaceAll(parsed);
    toast(t("importDone"));
  };

  const option = (on: boolean, title: string, sub: string, pick: () => void) => (
    <button type="button" className={on ? "option on" : "option"} aria-pressed={on} onClick={pick}>
      <span className="radio">{on && <span />}</span>
      <span className="col gap2 left"><span className="strong">{title}</span><span className="small muted">{sub}</span></span>
    </button>
  );
  const pick = (patch: Partial<Settings>) => { setSettings(patch); setChoice(null); };

  return (
    <main className="screen">
      <Header title={t("settings")} onBack={back} backLabel={t("back")} />

      <Group title={t("game")}>
        <div className="set-row col gap8 pad-v">
          <span className="set-label">{t("defaultEntry")}</span>
          <Seg label={t("defaultEntry")} value={s.defaultMode} onChange={(m) => setSettings({ defaultMode: m })}
            options={[{ value: "points" as const, label: t("modePoints") }, { value: "cartes" as const, label: t("modeCards") }]} />
        </div>
        <Row label={t("afterPasse")} value={s.passeRule === "next" ? t("nextShort") : t("sameShort")} onClick={() => setChoice("passe")} />
        <Row label={t("roundScores")} value={s.round10 ? t("toTen") : t("no")} onClick={() => setChoice("round")} />
        <Row label={t("misereSetting")} value={s.misere ? t("miserePts", { v: s.misere }) : t("misereOff")} onClick={() => setChoice("misere")} />
        <div className="set-row"><span className="set-label grow">{t("showCalc")}</span><Toggle on={s.showCalculation} label={t("showCalc")} onChange={(v) => setSettings({ showCalculation: v })} /></div>
      </Group>

      <Group title={t("display")}>
        <div className="set-row col gap8 pad-v">
          <span className="set-label">{t("language")}</span>
          <Seg label={t("language")} value={s.lang} onChange={(l) => setSettings({ lang: l })}
            options={[{ value: "fr" as const, label: "Français" }, { value: "en" as const, label: "English" }]} />
        </div>
        <div className="set-row col gap8 pad-v">
          <span className="set-label">{t("theme")}</span>
          <Seg label={t("theme")} value={s.theme} onChange={(th) => setSettings({ theme: th })}
            options={[{ value: "auto" as const, label: t("themeAuto") }, { value: "light" as const, label: t("themeLight") }, { value: "dark" as const, label: t("themeDark") }]} />
        </div>
      </Group>

      <Group title={t("myData")}>
        <Row label={t("myPlayers")} value={String(activePlayers)} onClick={() => go({ name: "players" })} />
        <Row label={t("exportBackup")} onClick={() => download(`tarot-sauvegarde-${day}.json`, JSON.stringify(data, null, 2), "application/json")} />
        <Row label={t("importBackup")} onClick={() => file.current?.click()} />
        <Row label={t("exportCsv")} onClick={() => download(`tarot-parties-${day}.csv`, toCsv(data.games, data.players, opts), "text/csv")} />
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { void importBackup(e.target.files?.[0]); e.target.value = ""; }} />
        {confirmClear ? (
          <div className="set-row col gap8 pad-v">
            <span className="set-label">{t("confirmClear")}</span>
            <div className="grid2">
              <button type="button" className="btn-secondary small-btn" onClick={() => setConfirmClear(false)}>{t("cancel")}</button>
              <button type="button" className="btn-danger small-btn" onClick={() => { clearHistory(); setConfirmClear(false); }}>{t("yesClear")}</button>
            </div>
          </div>
        ) : (
          <Row label={t("clearHistory")} onClick={() => setConfirmClear(true)} danger />
        )}
      </Group>

      <Group title={t("about")}>
        <Row label={t("rules")} onClick={() => go({ name: "rules" })} />
        <Row label={t("aboutUs")} onClick={() => go({ name: "about" })} />
      </Group>

      <p className="small muted center pad4 bottom-space">{t("privacy", { v: VERSION })}</p>

      {choice === "passe" && (
        <Sheet title={t("afterPasse")} onClose={() => setChoice(null)} closeLabel={t("close")}>
          {option(s.passeRule === "next", t("nextDeals"), t("nextDealsSub"), () => pick({ passeRule: "next" }))}
          {option(s.passeRule === "same", t("sameDeals"), t("sameDealsSub"), () => pick({ passeRule: "same" }))}
          <p className="small muted">{t("misdealNote")}</p>
        </Sheet>
      )}
      {choice === "round" && (
        <Sheet title={t("roundScores")} onClose={() => setChoice(null)} closeLabel={t("close")}>
          {option(!s.round10, t("no"), t("exact"), () => pick({ round10: false }))}
          {option(s.round10, t("toTen"), t("toTenSub"), () => pick({ round10: true }))}
          <p className="small muted">{t("roundNote")}</p>
        </Sheet>
      )}
      {choice === "misere" && (
        <Sheet title={t("misereSetting")} onClose={() => setChoice(null)} closeLabel={t("close")}>
          {option(s.misere === 0, t("misereOff"), t("misereOffSub"), () => pick({ misere: 0 }))}
          {MISERE_VALUES.map((v) => <Fragment key={v}>{option(s.misere === v, t("miserePts", { v }), t("miserePtsSub", { v }), () => pick({ misere: v }))}</Fragment>)}
          <p className="small muted">{t("misereNote")}</p>
        </Sheet>
      )}
    </main>
  );
}
