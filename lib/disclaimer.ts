/**
 * The service disclaimer a user acknowledges once; acknowledging it is what
 * stamps `consentGivenAt` on the server (auth.recordConsent, default scope).
 * Shown in the signup wizard and, for accounts created elsewhere (the web
 * signup form, admin), on app/consent.tsx. One copy so the two can't drift.
 */
export const SERVICE_DISCLAIMER =
  "TattleTow monitors parking complaints filed with the City of Milwaukee — not parking enforcement activity. A notification means a complaint has been filed near your registered zone. It does not mean a parking ticket has been issued, is being issued, or will be issued. TattleTow makes no guarantee that a complaint will result in enforcement action, nor that all complaints filed in your zone will be captured. Use of this service does not constitute legal advice. TattleTow is not affiliated with the City of Milwaukee or any municipal authority.";
