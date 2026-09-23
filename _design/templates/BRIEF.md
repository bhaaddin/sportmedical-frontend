# MEDISENSE template brief — read this before writing anything

You are writing **one screen template** per file for a Czech sports-medicine
clinic system. These are *design templates*, not working code. No React, no
build step, no data fetching.

## The absolute rules

1. **Markup only.** No `<style>`, no `<script>`, no `<link>`, no images, no
   SVG sprites, no emoji, no icon fonts. The design system already exists in
   `system.css` and you may not add to it or override it.
2. The **only** inline style attributes permitted are geometry for data
   graphics: `style="width:64%"` on `.meter > span`, and `style="height:72%"`
   on `.bar > i`. Nothing else, ever.
3. Each file contains **exactly one** element and nothing else:
   `<div class="canvas" id="scr-NN">` … `</div>`
   No wrapper, no comment above it, no trailing newline text.
4. Use **only** the classes listed below. If something you want is not in the
   kit, compose it from what is — do not invent a class name. An unknown class
   renders unstyled and ruins the screen.
5. **Real content, in Czech.** Never lorem, never "Item 1", never `TODO`.
   Real Czech names, real times, real amounts in Kč, real insurer codes.
6. **Accessibility:** every interactive element is a real `<button>` or
   `<input>`/`<select>` with a `<label>`. Toggles use
   `<button class="switch" role="switch" aria-checked="true"></button>`.
   Tabs use `aria-selected`. Nav uses `aria-current`.

## Domain facts — use these, they are real

- Insurers: `111` Všeobecná, `201` Vojenská, `205` Česká průmyslová,
  `207` Oborová, `209` Zaměstnanecká Škoda, `211` ZP MV ČR, `213` Revírní.
- Czech birth number looks like `900515/0011`; **always mask it** in lists as
  `900515/••••`. Insurance numbers likewise.
- Addresses come from the RÚIAN register, e.g. `Americká 31, 336 01 Blovice`.
- Phones: Czech shown without the code (`777 777 777`), foreign with it
  (`+421 908 123 456`).
- Roles in the clinic: Lékař, Fyzioterapeut, Recepční, Správce, Účetní,
  Externí trenér.
- Screens people use: Přehled, Dnes, Plánování, Pacienti, Diagnostika,
  Pokladna, Fakturace, Účetní export, Sklad, Tým, Nastavení.
- Activities (činnosti) sit inside services (služby); a service has calendars;
  a calendar has working hours. Appointments (termíny) hang off activities.
- Document rules: a template × a service = a rule; rules can be
  "vyžaduje se", "vyžaduje se jen při první návštěvě", "nevyžaduje se".

## The class kit — this is all of it

**Frame:** `canvas` `page-head` `grid`
`c3 c4 c5 c6 c7 c8 c9 c12` (12-column; `.c6` = half)

**Panel:** `panel` `panel--signal` `panel--warn` `panel--danger`
`panel-head` `panel-eyebrow` `panel-body` `panel-body--flush` `panel-foot`

**Text:** `num` `mono` `muted` `tiny` `stat` `stat-label` `stat-value`
`stat-unit` `stat-note` `delta delta--up|--down|--flat`

**Chips:** `chip` `chip--ok` `chip--data` `chip--warn` `chip--danger` `chip-dot`

**Buttons:** `btn` `btn--primary` `btn--ghost` `btn--danger` `btn-row` `kbd`

**Tables:** `tablewrap` + `<table class="t">` with `thead`/`tbody`;
`t-right` `t-strong` `t-sub`

**Forms:** `form` `form-row` (12-col) `field` `input` `hint` `hint--bad`
`hint--derived` `input--derived` `input--bad` `check` `switch`

**Tabs:** `tabs` `tab`

**People:** `person` `avatar` `avatar--signal|--data|--warn|--lg`
`person-name` `person-role`

**Permissions:** `matrix` + `<table class="mx">`; `mxcell` `mxcell--on`
`mxcell--inherit`

**Lists:** `list` `list-row` `list-main` `list-title` `list-sub`

**Data graphics:** `meter` (+`--warn --danger --data`) `barset` `bar` `bar--now`
`axis` `tickrail`

**Schedule:** `schedwrap` `sched` `sched-h` `slot` `slot--busy` `slot--hold`
`slot--done` `slot--free` `slot-time` `slot-who`

**Misc:** `divider` `empty` `note` `note--warn` `note--danger` `note--ok`
`kv` (a `<dl>`) `stack` `row` `spread` `grow`

## Shape of a screen

```html
<div class="canvas" id="scr-09">
  <div class="page-head">
    <div class="stack">
      <span class="panel-eyebrow">Klinika</span>
      <h1>Tým</h1>
      <p>Kdo u vás pracuje, co smí otevřít a kde má směny.</p>
    </div>
    <div class="btn-row">
      <button class="btn btn--ghost" type="button">Exportovat</button>
      <button class="btn btn--primary" type="button">Pozvat člověka</button>
    </div>
  </div>

  <div class="grid">
    <div class="panel c8"> … </div>
    <div class="panel c4"> … </div>
  </div>
</div>
```

## Quality bar

- **Open in a working state.** Every screen shows real rows, real numbers,
  a filled form — never an empty shell.
- **Density with air.** A clinic screen is scanned, not read. Lead with the
  summary, then the detail.
- **Spend colour by meaning.** `--signal` = live/ok, `--data` = derived or
  informational, `--warn` = needs a look, `--danger` = blocked. Do not decorate
  with them.
- Not everything is a panel. Group what belongs together; let a table breathe
  inside one `panel-body--flush`.
- Use `tickrail` at most once per screen, as a measurement flourish.
- 8–14 rows in a list is realistic; 3 is a mock-up.
