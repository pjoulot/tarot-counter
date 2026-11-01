/**
 * Tarot scoring, copied from the tarot game's engine so the counter and the game always agree.
 * summary.ts is the game's packages/engine/src/summary.ts unchanged except for its imports;
 * rules.ts holds the constants and types it needs. If a scoring rule changes, change it in the
 * game first (it has the tests for the whole rules engine), then copy summary.ts here.
 */
export * from "./rules.js";
export * from "./summary.js";
