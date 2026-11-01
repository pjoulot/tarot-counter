import { useApp } from "../App";
import { APP_NAME } from "../model";
import { isNative } from "../native";
import { asset, Header, MoreIcon } from "../components/ui";
import { VERSION } from "./Settings";

/**
 * Where the "Faire un don" button leads. Empty until the donation page exists: the button then shows as unavailable.
 * Google Play expects payments made inside an Android app to go through its own billing, so the Android app
 * hides the button unless DONATE_IN_ANDROID is turned on (see the README before doing that).
 */
export const DONATE_URL = "";
const DONATE_IN_ANDROID = false;

export function About() {
  const { t, back } = useApp();
  const showDonate = !isNative || DONATE_IN_ANDROID;
  return (
    <main className="screen">
      <Header title={t("aboutUs")} onBack={back} backLabel={t("back")} />
      <div className="col center-x gap6 about-hero">
        <img src={asset("art/renard.webp")} alt="" width={112} height={112} />
        <span className="h2">{APP_NAME}</span>
        <span className="small muted">{t("versionN", { v: VERSION })}</span>
      </div>
      <section className="card rule-card">
        <h2 className="h3">{t("aboutWho")}</h2>
        <p>{t("aboutText1")}</p>
        <p>{t("aboutText2")}</p>
      </section>
      {showDonate && (
        <section className="card rule-card">
          <h2 className="h3">{t("supportTitle")}</h2>
          <p>{t("supportText")}</p>
          {DONATE_URL ? (
            <a className="btn-primary with-icon" href={DONATE_URL} target="_blank" rel="noopener noreferrer">{MoreIcon.heart}{t("donate")}</a>
          ) : (
            <button type="button" className="btn-primary with-icon" disabled>{MoreIcon.heart}{t("donate")}</button>
          )}
          <p className="tiny muted center">{t("supportNote")}</p>
        </section>
      )}
      <p className="small muted center pad4 bottom-space">{t("aboutPrivacy")}</p>
    </main>
  );
}
