import { launch, newPage, login, api, shot, waitPlanner, buttons } from './lib.mjs';
const b = await launch();
const p = await newPage(b, 'desktop');
await login(p);
let clubs = (await api(p, 'GET', '/api/clubs')).json;
let club = clubs.find((c) => c.name === 'ZZ test plánování');
if (!club) {
  const r = await api(p, 'POST', '/api/clubs', { name: 'ZZ test plánování', ico: '27082440', paymentTermsDays: 14, contactPerson: 'Test Test', contactEmail: 'zz-test@example.invalid', contactPhone: '+420777000111' });
  console.log('create', r.status, JSON.stringify(r.json).slice(0, 200));
  clubs = (await api(p, 'GET', '/api/clubs')).json;
  club = clubs.find((c) => c.name === 'ZZ test plánování');
}
console.log('club', club?.id);
await p.goto(`${'http://localhost:3000'}/clubs/${club.id}`);
await waitPlanner(p);
await shot(p, 'x-club-empty');
const btns = await buttons(p);
console.log(btns.join('\n'));
await b.close();
