/*
 * Čekací listina — fáze 3.
 *
 * Byla tu obrazovka nad `/api/waitlist`; server tu cestu nemá, měřeno proti
 * živému OpenAPI. Stav `Waitlisted` v doméně ale existuje a zůstává.
 *
 * Plán §13 ji řadí do fáze 3, ne do druhé: až bude plno, pacient se zapíše a
 * při zrušení dostane nabídku první v pořadí. Je to tedy nejvzdálenější z
 * odložených věcí - a právě proto tu ta věta je. Za dvě fáze už nikdo nebude
 * pamatovat, že tu jednou něco stálo.
 */
export default function WaitlistManager() {
  return null;
}
