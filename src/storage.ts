import { freshLook, newId, type EntryMode, type Game, type PasseRule, type Player } from "./model";

export type Theme = "auto" | "light" | "dark";

export interface Settings {
  lang: "fr" | "en";
  defaultMode: EntryMode;
  showCalculation: boolean;
  passeRule: PasseRule;
  round10: boolean;
  theme: Theme;
}

export interface StoreData {
  v: 2;
  games: Game[];
  /** saved players, most recently used first */
  players: Player[];
  settings: Settings;
}

const KEY = "tarot-counter:v1";

export const DEFAULT_SETTINGS: Settings = {
  lang: typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("fr") === false ? "en" : "fr",
  defaultMode: "points",
  showCalculation: true,
  passeRule: "next",
  round10: false,
  theme: "auto",
};

export function emptyStore(): StoreData {
  return { v: 2, games: [], players: [], settings: { ...DEFAULT_SETTINGS } };
}

/** Reads the saved data. Any failure (private mode, corrupt data) falls back to an empty store. */
export function load(): StoreData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyStore();
    return parseBackup(raw) ?? emptyStore();
  } catch {
    return emptyStore();
  }
}

export function save(data: StoreData): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

type LegacyPlayer = Omit<Player, "id"> & { id?: string };

/** Accepts version 1 (players stored by name) and version 2. */
export function parseBackup(text: string): StoreData | null {
  try {
    const d = JSON.parse(text) as { v?: number; games?: unknown; players?: unknown; recentPlayers?: unknown; settings?: Partial<Settings> };
    if ((d.v !== 1 && d.v !== 2) || !Array.isArray(d.games)) return null;
    const settings = { ...DEFAULT_SETTINGS, ...(d.settings ?? {}) };
    if (d.v === 2 && Array.isArray(d.players)) return { v: 2, games: d.games as Game[], players: d.players as Player[], settings };
    return migrateV1(d.games as (Omit<Game, "players"> & { players: LegacyPlayer[] })[], Array.isArray(d.recentPlayers) ? (d.recentPlayers as LegacyPlayer[]) : [], settings);
  } catch {
    return null;
  }
}

/** Version 1 kept players by name only: give each distinct name an id and a saved record. */
function migrateV1(games: (Omit<Game, "players"> & { players: LegacyPlayer[] })[], recent: LegacyPlayer[], settings: Settings): StoreData {
  const byName = new Map<string, Player>();
  const register = (p: LegacyPlayer): Player => {
    const key = p.name.trim().toLowerCase();
    let r = byName.get(key);
    if (!r) { r = { id: p.id ?? newId(), name: p.name.trim(), animal: p.animal, color: p.color }; byName.set(key, r); }
    return r;
  };
  recent.forEach(register);
  const migrated: Game[] = games.map((g) => ({ ...g, players: g.players.map((p) => ({ ...register(p), animal: p.animal, color: p.color })) }));
  return { v: 2, games: migrated, players: [...byName.values()], settings };
}

/** Create a saved player for a typed name, with a look nobody else has. */
export function newPlayer(name: string, existing: readonly Player[]): Player {
  return { id: newId(), name: name.trim(), ...freshLook(existing.filter((p) => !p.archived), existing.length) };
}

/** Move the players of a new game to the front of the list, so "often with you" stays fresh. */
export function touchPlayers(players: readonly Player[], ids: readonly string[]): Player[] {
  const first = ids.map((id) => players.find((p) => p.id === id)).filter((p): p is Player => !!p);
  return [...first, ...players.filter((p) => !ids.includes(p.id))];
}
