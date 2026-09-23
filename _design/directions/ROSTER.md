# The day — the authoritative list. Do not derive it, copy it.

Three agents worked out the day's arithmetic independently and got three
different answers: one showed seventeen appointments, one added a nineteenth
with a double-booked 09:15, one moved an appointment to free up an hour. All
three were reasonable readings of a contract that gave counts but never gave
the list. That was my omission.

**Eighteen appointments. Sixteen patients — two come twice.**
At **09:40** this is five hotovo, two probíhá, one blokováno, ten čeká.
No double-booking. Every time below carries exactly one appointment.

| čas | pacient | výkon | místnost | personál | poj. | stav |
|------|---------|-------|----------|----------|------|------|
| 07:00 | Jana Kratochvílová | Odběr krve | Laboratoř | Bc. Dvořák | 111 | hotovo |
| 07:20 | Petr Doležal | Vstupní vyšetření | Ordinace 1 | MUDr. Havelka | 201 | hotovo |
| 07:40 | Tomáš Řehák | Spiroergometrie | Laboratoř | Bc. Dvořák | 205 | hotovo |
| 08:00 | Marie Nováková | Fyzioterapie | Rehabilitace | Mgr. Pilařová | 111 | hotovo |
| 08:30 | Ondřej Veselý | Kontrola po úrazu | Ordinace 2 | MUDr. Sýkorová | 207 | hotovo |
| 09:00 | Lucie Bartošová | Izokinetika kolene | Tělocvična | Bc. Dvořák | 111 | **probíhá** |
| 09:15 | **Martin Kolář** | Posudek pro klub | Ordinace 1 | MUDr. Havelka | 211 | **blokováno** |
| 09:45 | Eva Procházková | Rázová vlna | Rehabilitace | Mgr. Pilařová | 201 | **probíhá** |
| 10:00 | Filip Urban | Analýza chůze | Tělocvična | Bc. Dvořák | 213 | čeká |
| 10:30 | Kateřina Šimková | Kontrola po operaci | Ordinace 2 | MUDr. Sýkorová | 111 | čeká |
| 11:00 | Jakub Horák | Vstupní vyšetření | Ordinace 1 | MUDr. Havelka | 205 | čeká |
| 11:30 | Veronika Málková | Odběr krve | Laboratoř | Bc. Dvořák | 111 | čeká |
| 13:00 | Adam Beneš | Fyzioterapie | Rehabilitace | Mgr. Pilařová | 207 | čeká |
| 13:40 | Nikola Tichá | Spiroergometrie | Laboratoř | MUDr. Sýkorová | 201 | čeká |
| 14:20 | Radek Pospíšil | Kontrola po úrazu | Ordinace 2 | MUDr. Havelka | 111 | čeká |
| 15:00 | Simona Vrbová | Izokinetika kolene | Tělocvična | Mgr. Pilařová | 213 | čeká |
| 15:40 | Tomáš Řehák | Fyzioterapie | Rehabilitace | Mgr. Pilařová | 205 | čeká |
| 16:40 | Petr Doležal | Kontrola po operaci | Ordinace 1 | MUDr. Havelka | 201 | čeká |

## Why the counts work

Eight appointments are at or before 09:45 and eight distinct times carry them:
07:00, 07:20, 07:40, 08:00, 08:30 are finished; 09:00 is running; 09:15 is
blocked; **09:45 is running because it started early — Eva Procházková was
taken in at 09:30**, which is why an appointment timed after 09:40 is already
under way. Ten times from 10:00 to 16:40 are still to come.

Nothing needs to be double-booked and no hour needs to be left empty.

## The blocked one

**Martin Kolář, 09:15, Posudek pro klub, Ordinace 1, MUDr. Havelka, poj. 211.**
*Chybí: Souhlas se zpracováním zdravotních údajů.* He has been in the waiting
room **25 minutes**. Until it is signed the posudek cannot be issued, and
Ordinace 1 is standing idle with MUDr. Havelka waiting.

## One correction, and how it was found

The first version of this table had **Mgr. Pilařová in two rooms at once**:
Tělocvična from 09:00 and Rehabilitace from 09:30. An agent copying the table
into a template that shows staff beside the two running appointments noticed
it and reported it rather than quietly fixing it, which was the right call.

The 09:00 izokinetika now belongs to **Bc. Dvořák**, who is free between
08:00 and 10:00. Checked mechanically afterwards: no member of staff and no
room is double-booked anywhere in the eighteen.

## Repeat patients

Tomáš Řehák (07:40 spiroergometrie, then 15:40 fyzioterapie) and Petr Doležal
(07:20 vstupní vyšetření, then 16:40 kontrola po operaci). Both are ordinary —
a patient can be seen twice in a day — and they are what makes eighteen
appointments out of sixteen people.

## What you may vary

How much of this you show, and in what order, is your template's argument.
You may summarise the finished five into one line, hide the insurer, drop the
staff column, group by room or by state. What you may **not** do is change a
time, a name, a state or the totals: the twenty screens have to be the same
Tuesday or they cannot be compared.
