/*
 * A populated Přehled without touching the dev database: the two lists the screen reads (GET /api/day for the Prague week,
 * GET /api/v1/club-orders?status=Requested) are answered inside the page. Everything else is the real API.
 * `mode`: 'full' (a busy week, people waiting), 'quiet' (nothing booked), 'fail' (the week and the clubs fail with 500).
 */
const pad = (n) => String(n).padStart(2, '0');

export function mondayOfToday() {
  const d = new Date();
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return d;
}

const iso = (d, h, m) => {
  const x = new Date(d);
  x.setHours(h, m, 0, 0);
  return x.toISOString();
};

export function weekRows(patients) {
  const mon = mondayOfToday();
  const perDay = [6, 9, 7, 12, 8, 3, 0];
  const todayIdx = (new Date().getDay() + 6) % 7;
  const rows = [];
  let n = 0;
  perDay.forEach((count, di) => {
    const day = new Date(mon);
    day.setDate(mon.getDate() + di);
    for (let i = 0; i < count; i++) {
      const hour = 8 + Math.floor((i * 9) / Math.max(count, 1));
      const start = iso(day, hour, i % 2 ? 30 : 0);
      const end = iso(day, hour, i % 2 ? 59 : 29);
      const p = patients[n % patients.length];
      /* today: the first two have arrived, the rest are still booked; one is cancelled */
      let status = 0;
      if (di === todayIdx) status = i < 2 ? 2 : i === 3 ? 4 : 1;
      else if (di < todayIdx) status = 3;
      rows.push({
        id: `mock-${di}-${i}`, calendarId: 'mock-cal', patientId: p.id, patientName: `${p.firstName} ${p.lastName}`,
        activityId: 'mock-act', activityName: 'Kontrola', startUtc: start, endUtc: end, status,
        isRunningLate: false, checkedInUtc: null, paperwork: { ready: true, missing: [] },
      });
      n++;
    }
  });
  return rows;
}

export async function mockOverview(page, patients, mode = 'full') {
  await page.route('**/api/day?**', (route) => {
    if (mode === 'fail') return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"x"}' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mode === 'quiet' ? [] : weekRows(patients)) });
  });
  await page.route('**/api/v1/club-orders?**', (route) => {
    if (mode === 'fail') return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"x"}' });
    if (mode === 'quiet') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    const now = Date.now();
    const o = (i, club, seats, days) => ({ id: `mock-order-${i}`, clubId: `mock-club-${i}`, clubName: club, status: 'Requested', totalSeats: seats, submittedAtUtc: new Date(now - days * 86400000).toISOString() });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([o(1, 'FK Slaný', 14, 3), o(2, 'TJ Sokol Kladno', 22, 2), o(3, 'SK Buštěhrad', 9, 1), o(4, 'FC Unhošť', 12, 1)]) });
  });
}
