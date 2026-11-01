import type { CSSProperties, ReactNode } from "react";
import { tint, type Player } from "../model";

export function Avatar({ player, size, ring = false }: { player: Pick<Player, "animal" | "color" | "photo">; size: number; ring?: boolean }) {
  const style = { width: size, height: size, background: tint(player.color), "--c": player.color } as CSSProperties;
  return (
    <span className={`avatar${ring ? " avatar-ring" : ""}${player.photo ? " photo" : ""}`} style={style} aria-hidden="true">
      {player.photo
        ? <img src={player.photo} alt="" width={size} height={size} />
        : <img src={`${import.meta.env.BASE_URL}avatars/${player.animal}.webp`} alt="" width={Math.round(size * 0.86)} height={Math.round(size * 0.86)} />}
    </span>
  );
}

export function AvatarStack({ players, size }: { players: readonly Player[]; size: number }) {
  return (
    <span className="avatar-stack" aria-hidden="true">
      {players.map((p, i) => (
        <span key={i} style={{ marginLeft: i === 0 ? 0 : -Math.round(size * 0.3) }}>
          <Avatar player={p} size={size} ring />
        </span>
      ))}
    </span>
  );
}

export const Icon = {
  back: <svg width="24" height="24" viewBox="0 0 24 24" className="stroke"><path d="M15 18l-6-6 6-6" /></svg>,
  close: <svg width="24" height="24" viewBox="0 0 24 24" className="stroke"><path d="M6 6l12 12M18 6L6 18" /></svg>,
  plus: <svg width="22" height="22" viewBox="0 0 24 24" className="stroke thick"><path d="M12 5v14M5 12h14" /></svg>,
  chev: <svg width="18" height="18" viewBox="0 0 24 24" className="stroke muted"><path d="M9 6l6 6-6 6" /></svg>,
  dots: <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>,
  backspace: <svg width="24" height="24" viewBox="0 0 24 24" className="stroke"><path d="M21 5H9l-6 7 6 7h12z" /><path d="M12 9l6 6M18 9l-6 6" /></svg>,
  gear: (
    <svg width="24" height="24" viewBox="0 0 24 24" className="stroke">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  ),
  book: <svg width="24" height="24" viewBox="0 0 24 24" className="stroke"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z" /><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" /></svg>,
  share: <svg width="20" height="20" viewBox="0 0 24 24" className="stroke thick"><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" /><path d="M16 6l-4-4-4 4" /><path d="M12 2v13" /></svg>,
  crown: <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><polygon points="3,8 7.5,12 12,5 16.5,12 21,8 19,19 5,19" fill="#E0A100" /></svg>,
};

export function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="icon-btn" aria-label={label} onClick={onClick}>
      {children}
    </button>
  );
}

export function Header({ title, onBack, backIcon = "back", backLabel, right }: {
  title: ReactNode; onBack?: () => void; backIcon?: "back" | "close"; backLabel: string; right?: ReactNode;
}) {
  return (
    <header className="header">
      {onBack && <IconButton label={backLabel} onClick={onBack}>{Icon[backIcon]}</IconButton>}
      <h1 className="header-title">{title}</h1>
      {right}
    </header>
  );
}

export function Seg<V extends string | number>({ options, value, onChange, cols, small, label }: {
  options: readonly { value: V; label: ReactNode; disabled?: boolean }[];
  value: V | null;
  onChange: (v: V) => void;
  cols?: number;
  small?: boolean;
  label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label} style={{ gridTemplateColumns: `repeat(${cols ?? options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          type="button"
          key={String(o.value)}
          className={`seg-btn${small ? " small" : ""}${o.value === value ? " on" : ""}`}
          aria-pressed={o.value === value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Sheet({ title, onClose, closeLabel, children, aside }: { title: string; onClose: () => void; closeLabel: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="row-between">
          <h2 className="h2 grow">{title}</h2>
          {aside}
          <IconButton label={closeLabel} onClick={onClose}>{Icon.close}</IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toggle({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button type="button" className="toggle" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}>
      <span className={on ? "toggle-track on" : "toggle-track"}><span className="toggle-knob" /></span>
    </button>
  );
}

export function Toast({ text }: { text: string | null }) {
  return <div className={text ? "toast show" : "toast"} role="status" aria-live="polite">{text}</div>;
}

/** Public assets, relative to wherever the app is served (web root, a sub-folder, or the Android app). */
export function asset(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}

export const MoreIcon = {
  grip: <svg width="18" height="18" viewBox="0 0 24 24" fill="#B7A68F" aria-hidden="true"><circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" /></svg>,
  x: <svg width="16" height="16" viewBox="0 0 24 24" className="stroke thick"><path d="M6 6l12 12M18 6L6 18" /></svg>,
  pencil: <svg width="18" height="18" viewBox="0 0 24 24" className="stroke"><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></svg>,
  camera: <svg width="22" height="22" viewBox="0 0 24 24" className="stroke"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>,
  search: <svg width="18" height="18" viewBox="0 0 24 24" className="stroke muted-stroke"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>,
  check: <svg width="16" height="16" viewBox="0 0 24 24" className="stroke thick"><path d="M5 12l5 5 9-10" /></svg>,
  chart: <svg width="18" height="18" viewBox="0 0 24 24" className="stroke"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>,
  undo: <svg width="20" height="20" viewBox="0 0 24 24" className="stroke"><path d="M4 12a8 8 0 1 0 3-6.2" /><path d="M4 4v5h5" /></svg>,
  swap: <svg width="20" height="20" viewBox="0 0 24 24" className="stroke"><path d="M4 7h11M4 17h16M15 3l4 4-4 4" /></svg>,
  people: <svg width="20" height="20" viewBox="0 0 24 24" className="stroke"><circle cx="9" cy="8" r="3.5" /><path d="M3 20c.8-3.6 3.2-5.5 6-5.5s5.2 1.9 6 5.5" /><path d="M18 8v6M15 11h6" /></svg>,
  flag: <svg width="20" height="20" viewBox="0 0 24 24" className="stroke"><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></svg>,
  minus: <svg width="20" height="20" viewBox="0 0 24 24" className="stroke"><path d="M5 12h14" /></svg>,
  arrow: <svg width="28" height="16" viewBox="0 0 28 16" className="stroke muted-stroke"><path d="M2 8h22M18 2l6 6-6 6" /></svg>,
  grid: <svg width="17" height="17" viewBox="0 0 24 24" className="stroke" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M3 10h18M3 15h18M9 4v16" /></svg>,
  curve: <svg width="17" height="17" viewBox="0 0 24 24" className="stroke" aria-hidden="true"><path d="M3 20h18" /><path d="M4 16l5-6 4 3 7-8" /><circle cx="20" cy="5" r="0.6" /></svg>,
  cards: <svg width="18" height="18" viewBox="0 0 24 24" className="stroke" aria-hidden="true"><rect x="3" y="6" width="11" height="15" rx="2" /><path d="M8 3.5l9.5-.5a2 2 0 0 1 2.1 1.9l.6 11.6a2 2 0 0 1-1.9 2.1l-2.3.1" /></svg>,
  heart: <svg width="20" height="20" viewBox="0 0 24 24" className="stroke" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>,
  chevDown: <svg width="12" height="12" viewBox="0 0 24 24" className="stroke thick"><path d="M6 9l6 6 6-6" /></svg>,
};
