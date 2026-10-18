# Load-speed harness (how the numbers in `frontend-before.md` / `frontend-after.md` were taken)

Not part of the build or the test run. Needs `playwright-core` (`PLAYWRIGHT_CORE=<folder>`), a Chromium (`CHROME=<chrome.exe>`, or the ms-playwright cache),
the dev API on :5092 and a dev login (`SM_PW=<password from the dev login file>`, optional `SM_EMAIL`).

```bash
# once: a self-signed certificate next to serve-dist.mjs (HTTP/2 needs TLS; Vercel serves HTTP/2, so HTTP/1.1 would distort the numbers)
MSYS_NO_PATHCONV=1 openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out cert.pem -days 30 -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost"

PRERENDER_API_URL=off npm run build && cp -r dist /tmp/dist-a            # keep a copy: other work rebuilds dist/
node serve-dist.mjs /tmp/dist-a 4601 ../../../vercel.json &              # static + SPA fallback + vercel.json headers + brotli + /api,/hubs proxy to :5092
export NODE_TLS_REJECT_UNAUTHORIZED=0
node measure.mjs https://localhost:4601 a-throttled.json throttled 5 login,prehled,planovani   # CDP Fast 4G (9 Mbit/s, 170 ms) + CPU 4x
node measure.mjs https://localhost:4601 a-unthrottled.json unthrottled 5
node report.mjs LABEL a-unthrottled.json a-throttled.json                                    # markdown tables
node compare.mjs before-throttled.json after-throttled.json before-unthrottled.json after-unthrottled.json
```
Scenarios and the "usable" marker of each are at the top of `measure.mjs` (greeting heading of the overview: `h1|Dobr`, the greeting changes with the hour).
Take before and after measurements alternately, minutes apart: other load on the machine moves single runs by 10-15 %.
