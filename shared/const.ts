export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;

// The server is authoritative for the online draft timeout. The client imports
// this same value so the visible countdown cannot drift from auto-pick.
export const DRAFT_TURN_SECONDS = 30;
