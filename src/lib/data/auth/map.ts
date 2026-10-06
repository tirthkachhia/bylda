/** Auth has no view-model mapping — actions only. Kept for the per-domain layout. */
export type AuthAction =
  | "signIn"
  | "signUp"
  | "sendReset"
  | "updatePassword"
  | "resendVerification";
