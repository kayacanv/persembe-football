// Match rules shared across the app. Keep in sync with the wa-bot
// (wa-bot/src/config.ts `maxPlayers`).

// A match caps at this many active players; sign-ups beyond it become `waitlist`
// (reserve). Canceling an active player auto-promotes the first reserve.
export const MAX_ACTIVE_PLAYERS = 16
