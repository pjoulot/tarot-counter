import { useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from "react";
import { useApp } from "../App";
import { ANIMALS, COLORS, freshLook, newId, tint, type Player } from "../model";
import { ANIMAL_LABEL } from "../i18n";
import { asset, Avatar, Header, MoreIcon } from "../components/ui";

export function EditPlayer({ playerId }: { playerId?: string | undefined }) {
  const { data, t, lang, back, player, savePlayer, archivePlayer } = useApp();
  const existing = playerId ? player(playerId) : undefined;
  const [p, setP] = useState<Player>(() => existing ?? { id: newId(), name: "", ...freshLook(data.players.filter((x) => !x.archived), data.players.length) });
  const [crop, setCrop] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [tried, setTried] = useState(false);
  const set = (patch: Partial<Player>) => setP((x) => ({ ...x, ...patch }));

  const name = p.name.trim();
  const taken = data.players.some((x) => !x.archived && x.id !== p.id && x.name.trim().toLowerCase() === name.toLowerCase());
  const valid = name.length > 0 && !taken;

  const saveIt = () => {
    setTried(true);
    if (!valid) return;
    savePlayer({ ...p, name });
    back();
  };

  return (
    <main className="screen">
      <Header title={existing ? existing.name : t("addPlayer")} onBack={back} backIcon="close" backLabel={t("close")} />
      <div className="col center-x gap8">
        <span className="big-avatar" style={{ boxShadow: `0 0 0 4px var(--bg), 0 0 0 7px ${p.color}` }}><Avatar player={p} size={96} /></span>
        <span className="small muted">{t("colorUse")}</span>
      </div>

      <label className="col gap6">
        <span className="label">{t("name")}</span>
        <input className={tried && !valid ? "text-input invalid" : "text-input"} value={p.name} maxLength={16} onChange={(e) => set({ name: e.target.value })} />
        {tried && taken && <span className="small error">{t("nameTaken")}</span>}
      </label>

      <section className="col gap8">
        <div className="row-between"><span className="label">{t("icon")}</span><span className="small muted">{t("orPhoto")}</span></div>
        <div className="grid6">
          {p.photo && (
            <button type="button" className="pick-animal on" aria-label={t("yourPhoto")} aria-pressed="true" onClick={() => setCrop(true)}>
              <Avatar player={p} size={48} />
            </button>
          )}
          <button type="button" className="pick-animal camera" aria-label={t("takePhoto")} onClick={() => setCrop(true)}>{MoreIcon.camera}</button>
          {ANIMALS.map((a) => {
            const on = !p.photo && p.animal === a;
            return (
              <button type="button" key={a} aria-label={ANIMAL_LABEL[lang][a]} aria-pressed={on} className={on ? "pick-animal on" : "pick-animal"}
                style={{ background: on ? tint(p.color) : undefined, "--c": p.color } as CSSProperties} onClick={() => set({ animal: a, photo: null })}>
                <img src={asset(`avatars/${a}.webp`)} alt="" width={40} height={40} />
              </button>
            );
          })}
        </div>
        {p.photo && <button type="button" className="link left" onClick={() => set({ photo: null })}>{t("removePhoto")}</button>}
      </section>

      <section className="col gap8">
        <span className="label">{t("color")}</span>
        <div className="grid8">
          {COLORS.map((c) => (
            <button type="button" key={c} aria-label={c} aria-pressed={p.color === c} className={p.color === c ? "pick-color on" : "pick-color"} style={{ background: c }} onClick={() => set({ color: c })} />
          ))}
        </div>
      </section>
      <p className="small muted pad4">{t("photoPrivate")}</p>

      <div className="bottom">
        {confirm && existing ? (
          <div className="col gap8">
            <p className="center strong">{t("deletePlayerQ", { name: existing.name })}</p>
            <div className="grid2">
              <button type="button" className="btn-secondary" onClick={() => setConfirm(false)}>{t("cancel")}</button>
              <button type="button" className="btn-danger" onClick={() => { archivePlayer(existing.id); back(); }}>{t("yesDelete")}</button>
            </div>
          </div>
        ) : existing ? (
          <div className="grid2">
            <button type="button" className="btn-secondary danger-text" onClick={() => setConfirm(true)}>{t("delete")}</button>
            <button type="button" className="btn-primary" onClick={saveIt}>{t("save")}</button>
          </div>
        ) : (
          <button type="button" className="btn-primary" onClick={saveIt}>{t("save")}</button>
        )}
      </div>

      {crop && <PhotoCrop onCancel={() => setCrop(false)} onUse={(url) => { set({ photo: url }); setCrop(false); }} />}
    </main>
  );
}

/** Full-screen crop: pick or take a picture, then move and pinch it inside a circle. Saved as a 256px JPEG. */
function PhotoCrop({ onCancel, onUse }: { onCancel: () => void; onUse: (dataUrl: string) => void }) {
  const { t } = useApp();
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; scale: number } | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const R = 130; // circle radius on screen

  const load = (f: File | undefined) => {
    if (!f) return;
    const url = URL.createObjectURL(f);
    const im = new Image();
    im.onload = () => {
      const fit = (2 * R) / Math.min(im.naturalWidth, im.naturalHeight); // cover the circle
      setView({ x: 0, y: 0, scale: fit });
      setImg(im);
    };
    im.src = url;
  };

  const minScale = img ? (2 * R) / Math.min(img.naturalWidth, img.naturalHeight) : 1;
  const clamp = (v: { x: number; y: number; scale: number }) => {
    if (!img) return v;
    const scale = Math.min(Math.max(v.scale, minScale), minScale * 6);
    const maxX = (img.naturalWidth * scale) / 2 - R, maxY = (img.naturalHeight * scale) / 2 - R;
    return { scale, x: Math.min(maxX, Math.max(-maxX, v.x)), y: Math.min(maxY, Math.max(-maxY, v.y)) };
  };

  const down = (e: RPointerEvent) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      if (a && b) pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: view.scale };
    }
  };
  const move = (e: RPointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      if (a && b) { const p = pinch.current; setView((v) => clamp({ ...v, scale: p.scale * (Math.hypot(a.x - b.x, a.y - b.y) / p.dist) })); }
    } else {
      setView((v) => clamp({ ...v, x: v.x + e.clientX - prev.x, y: v.y + e.clientY - prev.y }));
    }
  };
  const up = (e: RPointerEvent) => { pointers.current.delete(e.pointerId); if (pointers.current.size < 2) pinch.current = null; };

  const use = () => {
    if (!img) return;
    const size = 256, k = size / (2 * R);
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const w = img.naturalWidth * view.scale * k, h = img.naturalHeight * view.scale * k;
    ctx.drawImage(img, size / 2 + view.x * k - w / 2, size / 2 + view.y * k - h / 2, w, h);
    onUse(c.toDataURL("image/jpeg", 0.85));
  };

  return (
    <div className="crop" role="dialog" aria-modal="true" aria-label={t("crop")}>
      <div className="row-between crop-bar">
        <button type="button" className="crop-text" onClick={onCancel}>{t("cancel")}</button>
        <span className="h-title-sm">{t("crop")}</span>
        <button type="button" className="crop-text strong accent-light" disabled={!img} onClick={use}>{t("use")}</button>
      </div>
      <div className="crop-stage" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onWheel={(e) => setView((v) => clamp({ ...v, scale: v.scale * (e.deltaY < 0 ? 1.08 : 0.92) }))}>
        {img && (
          <img src={img.src} alt="" draggable={false} className="crop-img"
            style={{ width: img.naturalWidth * view.scale, height: img.naturalHeight * view.scale, transform: `translate(calc(-50% + ${view.x}px), calc(-50% + ${view.y}px))` }} />
        )}
        {!img && <div className="crop-empty">{MoreIcon.camera}</div>}
        <div className="crop-mask" />
        <div className="crop-ring" />
      </div>
      {img && (
        <label className="row gap10 crop-zoom">
          <span className="small">{t("zoom")}</span>
          <input type="range" min={1} max={6} step={0.01} value={view.scale / minScale} onChange={(e) => setView((v) => clamp({ ...v, scale: minScale * Number(e.target.value) }))} />
        </label>
      )}
      <p className="small center crop-hint">{t("cropHint")}</p>
      <div className="grid2">
        <button type="button" className="crop-btn" onClick={() => camera.current?.click()}>{MoreIcon.camera}{t("camera")}</button>
        <button type="button" className="crop-btn" onClick={() => gallery.current?.click()}>{t("gallery")}</button>
      </div>
      <input ref={camera} type="file" accept="image/*" capture="user" hidden onChange={(e) => { load(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={gallery} type="file" accept="image/*" hidden onChange={(e) => { load(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}
