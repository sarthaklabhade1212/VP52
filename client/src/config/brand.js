// Single source of truth for the user-facing application brand/display name.
//
// IMPORTANT: This is the DISPLAY name shown in the UI only. It intentionally
// does NOT drive any of the following (which must stay stable):
//   - Android application / package id .......... com.sarthak.customerrewards
//   - custom_url_scheme / native namespaces
//   - API routes, environment variable names
//   - database identifiers, internal code identifiers
//
// To rebrand the visible app, change APP_NAME here and it propagates everywhere
// the UI reads it. Native app label lives in android strings.xml + capacitor
// config (kept in sync separately, since those are build-time native values).
export const APP_NAME = "VIP'S";
