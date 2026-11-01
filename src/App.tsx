import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { newId, nextDealer, type Deal, type Game, type Player, type PlayedDeal, type ScoreOptions } from "./model";
import { load, save, touchPlayers, type Settings, type StoreData } from "./storage";
import { translator, type T } from "./i18n";
import { Toast } from "./components/ui";
import { setSystemBars } from "./native";
import { Home } from "./screens/Home";
import { NewGame } from "./screens/NewGame";
import { Sheet } from "./screens/Sheet";
import { DealEntry } from "./screens/DealEntry";
import { DealDetail } from "./screens/DealDetail";
import { GameEnd } from "./screens/GameEnd";
import { SettingsScreen } from "./screens/Settings";
import { Rules } from "./screens/Rules";
import { About } from "./screens/About";
import { Players } from "./screens/Players";
import { EditPlayer } from "./screens/EditPlayer";
import { Stats, PlayerStatsScreen } from "./screens/Stats";

export type Route =
  | { name: "home" }
  | { name: "newGame"; from?: string | undefined; draftKey?: number }
  | { name: "sheet"; gameId: string }
  | { name: "entry"; gameId: string; dealId?: string | undefined }
  | { name: "detail"; gameId: string; dealId: string }
  | { name: "end"; gameId: string }
  | { name: "settings" }
  | { name: "rules" }
  | { name: "about" }
  | { name: "players" }
  | { name: "editPlayer"; playerId?: string | undefined }
  | { name: "stats" }
  | { name: "playerStats"; playerId: string };

/** The "Nouvelle partie" screen's unfinished setup, kept while the person edits a player and comes back. */
export interface NewGameDraft { key: number; count: 3 | 4 | 5; seats: (string | null)[]; dealerId: string | null; targetDeals: number | null; targetScore: number | null }

interface Ctx {
  draft: NewGameDraft | null;
  setDraft: (d: NewGameDraft | null) => void;
  data: StoreData;
  t: T;
  lang: "fr" | "en";
  opts: ScoreOptions;
  go: (r: Route) => void;
  replace: (r: Route) => void;
  back: () => void;
  toast: (text: string) => void;
  /** a seat's player, with the latest name, look and photo from the saved list */
  seat: (game: Game, i: number) => Player;
  seats: (game: Game) => Player[];
  player: (id: string) => Player | undefined;
  savePlayer: (p: Player) => void;
  archivePlayer: (id: string) => void;
  startGame: (playerIds: string[], firstDealer: number, target: { targetDeals: number | null; targetScore: number | null }) => string;
  saveDeal: (gameId: string, deal: { id?: string | undefined; summary: PlayedDeal["summary"]; input: PlayedDeal["input"] }) => void;
  savePasse: (gameId: string) => void;
  deleteDeal: (gameId: string, dealId: string) => void;
  undoLastDeal: (gameId: string) => void;
  setDealer: (gameId: string, seat: number) => void;
  finishGame: (gameId: string) => void;
  setSettings: (s: Partial<Settings>) => void;
  replaceAll: (d: StoreData) => void;
  clearHistory: () => void;
}

const AppCtx = createContext<Ctx | null>(null);
export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside provider");
  return c;
}

export function findGame(data: StoreData, id: string): Game | undefined {
  return data.games.find((g) => g.id === id);
}

function useSystemDark(): boolean {
  const q = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  const [dark, setDark] = useState(q?.matches ?? false);
  useEffect(() => {
    if (!q) return;
    const on = (e: MediaQueryListEvent) => setDark(e.matches);
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, [q]);
  return dark;
}

export function App() {
  const [data, setData] = useState<StoreData>(() => load());
  const [stack, setStack] = useState<Route[]>([{ name: "home" }]);
  const [toastText, setToastText] = useState<string | null>(null);
  const [draft, setDraft] = useState<NewGameDraft | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const warned = useRef(false);
  const t = useMemo(() => translator(data.settings.lang), [data.settings.lang]);
  const systemDark = useSystemDark();
  const dark = data.settings.theme === "dark" || (data.settings.theme === "auto" && systemDark);

  useEffect(() => {
    if (!save(data) && !warned.current) {
      warned.current = true;
      setToastText(t("storageWarning"));
    }
  }, [data, t]);

  useEffect(() => { document.documentElement.lang = data.settings.lang; }, [data.settings.lang]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#1C1611" : "#FFF6EA");
    setSystemBars(dark);
  }, [dark]);

  const toast = useCallback((text: string) => {
    setToastText(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastText(null), 2400);
  }, []);

  // Navigation is a stack mirrored in browser history, so the phone's back button works.
  const go = useCallback((r: Route) => {
    const stamped = r.name === "newGame" && r.draftKey === undefined ? { ...r, draftKey: Date.now() } : r;
    setStack((s) => [...s, stamped]);
    window.history.pushState({ depth: Date.now() }, "");
    window.scrollTo(0, 0);
  }, []);
  const replace = useCallback((r: Route) => {
    const stamped = r.name === "newGame" && r.draftKey === undefined ? { ...r, draftKey: Date.now() } : r;
    setStack((s) => [...s.slice(0, -1), stamped]);
    window.scrollTo(0, 0);
  }, []);
  const back = useCallback(() => {
    if (stack.length > 1) window.history.back();
  }, [stack.length]);
  useEffect(() => {
    const onPop = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const updateGame = useCallback((gameId: string, f: (g: Game) => Game) => {
    setData((d) => ({ ...d, games: d.games.map((g) => (g.id === gameId ? f(g) : g)) }));
  }, []);

  const player = (id: string) => data.players.find((p) => p.id === id);
  const seat = (game: Game, i: number): Player => {
    const snap = game.players[i] ?? { id: "?", name: "?", animal: "fox" as const, color: "#F08A4B" };
    const live = player(snap.id);
    return live ? { ...live } : snap;
  };
  const addDeal = (g: Game, make: (dealer: number) => Deal): Game => {
    const dealer = nextDealer(g, data.settings.passeRule);
    return { ...g, dealerOverride: null, deals: [...g.deals, make(dealer)] };
  };

  const ctx: Ctx = {
    draft, setDraft,
    data, t, lang: data.settings.lang, opts: { round10: data.settings.round10 },
    go, replace, back, toast,
    seat,
    seats: (game) => game.players.map((_, i) => seat(game, i)),
    player,
    savePlayer: (p) => setData((d) => ({
      ...d,
      players: d.players.some((x) => x.id === p.id) ? d.players.map((x) => (x.id === p.id ? p : x)) : [...d.players, p],
    })),
    archivePlayer: (id) => setData((d) => ({ ...d, players: d.players.map((x) => (x.id === id ? { ...x, archived: true } : x)) })),
    startGame: (playerIds, firstDealer, target) => {
      const id = newId();
      setData((d) => {
        const players = playerIds.map((pid) => {
          const p = d.players.find((x) => x.id === pid);
          return p ? { id: p.id, name: p.name, animal: p.animal, color: p.color } : { id: pid, name: "?", animal: "fox" as const, color: "#F08A4B" };
        });
        return {
          ...d,
          // An unfinished game is closed when a new one starts, so there is only ever one in progress; empty ones are dropped.
          games: [{ id, createdAt: Date.now(), players, firstDealer, deals: [], finishedAt: null, dealerOverride: null, ...target },
            ...d.games.filter((g) => g.finishedAt !== null || g.deals.length > 0).map((g) => (g.finishedAt === null ? { ...g, finishedAt: Date.now() } : g))],
          players: touchPlayers(d.players, playerIds),
        };
      });
      return id;
    },
    saveDeal: (gameId, deal) => updateGame(gameId, (g) => {
      if (deal.id) return { ...g, deals: g.deals.map((d) => (d.id === deal.id ? { id: d.id, at: d.at, dealer: d.dealer, summary: deal.summary, input: deal.input } : d)) };
      return addDeal(g, (dealer) => ({ id: newId(), at: Date.now(), dealer, summary: deal.summary, input: deal.input }));
    }),
    savePasse: (gameId) => updateGame(gameId, (g) => addDeal(g, (dealer) => ({ id: newId(), at: Date.now(), dealer, kind: "passe" }))),
    deleteDeal: (gameId, dealId) => updateGame(gameId, (g) => ({ ...g, deals: g.deals.filter((d) => d.id !== dealId) })),
    undoLastDeal: (gameId) => updateGame(gameId, (g) => ({ ...g, dealerOverride: null, deals: g.deals.slice(0, -1) })),
    setDealer: (gameId, s) => updateGame(gameId, (g) => ({ ...g, dealerOverride: s })),
    finishGame: (gameId) => updateGame(gameId, (g) => ({ ...g, finishedAt: g.finishedAt ?? Date.now() })),
    setSettings: (s) => setData((d) => ({ ...d, settings: { ...d.settings, ...s } })),
    replaceAll: (d) => setData(d),
    clearHistory: () => setData((d) => ({ ...d, games: [] })),
  };

  const route = stack[stack.length - 1] ?? { name: "home" };
  return (
    <AppCtx.Provider value={ctx}>
      <div className="app">
        <Screen route={route} />
      </div>
      <Toast text={toastText} />
    </AppCtx.Provider>
  );
}

function Screen({ route }: { route: Route }) {
  const { data } = useApp();
  switch (route.name) {
    case "home": return <Home />;
    case "newGame": return <NewGame fromGameId={route.from} draftKey={route.draftKey ?? 0} />;
    case "settings": return <SettingsScreen />;
    case "rules": return <Rules />;
    case "about": return <About />;
    case "players": return <Players />;
    case "editPlayer": return <EditPlayer key={route.playerId ?? "new"} playerId={route.playerId} />;
    case "stats": return <Stats />;
    case "playerStats": return <PlayerStatsScreen playerId={route.playerId} />;
    default: {
      const game = findGame(data, route.gameId);
      if (!game) return <Home />;
      if (route.name === "sheet") return <Sheet game={game} />;
      if (route.name === "entry") return <DealEntry key={route.dealId ?? "new"} game={game} dealId={route.dealId} />;
      if (route.name === "detail") return <DealDetail game={game} dealId={route.dealId} />;
      return <GameEnd game={game} />;
    }
  }
}
