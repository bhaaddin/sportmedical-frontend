/*
 * ClubOverviewSections - everything the old club detail page offered, as the sections of the planner's order overview
 * dialog (`orderDetails`) on a club's screen. The stage plans one order; this is where the rest of the club is:
 *
 *   KLÍČOVÉ ÚDAJE           hráčů / míst, zapsáno, zbývá, k fakturaci, orders by status, the billing facts
 *   OBJEDNÁVKY KLUBU        one row per group with its actions: Upravit termíny (puts the group on the stage),
 *                           Přidat hráče / rozšířit, Odebrat hráče, Zrušit objednávku, Otevřít; Sloučit do jedné
 *                           objednávky; the cancelled orders
 *   ROZPIS PODLE SLUŽEB     služby with their subtotals, činnosti with price and progress
 *   NADCHÁZEJÍCÍ OKNA       the club's windows ahead
 *   VYBRANÁ OBJEDNÁVKA      the links of the club's portal and the order's history
 *   STARŠÍ REZERVACE        the club's older bulk reservation and window blocks without an order
 *   AKCE KLUBU              Nová objednávka klubu, Vytvořit rezervaci, Sportovci klubů, Upravit údaje, Deaktivovat
 *
 * No new logic: the numbers come from `clubOrdersApi.clubSummary` / the orders / the price list exactly as the old page
 * worked them out; every action opens the existing dialog through `ClubPlannerContext`. Drawn with the file's dialog
 * classes (`club-profile-*`, `activity-detail-*`, `capacity-bar`) plus `club.css`.
 */
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { activitiesApi } from '../../api/activities';
import { ORDER_STATUSES, ORDER_STATUS_LABEL, type ClubOrderView } from '../../api/clubOrders';
import { ClubBlockPanel } from '../../components/clubs/ClubBlockPanel';
import { blockTitle } from '../../components/clubs/blockLogic';
import { LegacyReservation } from '../../components/clubs/detail/LegacyReservation';
import { mergeableRoots } from '../../components/clubs/detail/orderGroups';
import { formatCzk, orderCode } from '../../components/clubs/order/orderFormat';
import { ClubSeatsCard } from '../../components/clubs/panel/ClubSeatsCard';
import { clubActivitySeats } from '../../components/clubs/panel/seats';
import { fetchBlockableActivities } from '../../api/clubBlocks';
import { ClubLinksBlock } from '../../components/clubs/orders/ClubLinksBlock';
import { useClubSummary } from '../../components/clubs/orders/ClubSummaryCard';
import { UncoveredNotice } from '../../components/clubs/orders/UncoveredNotice';
import { WindowPills } from '../../components/clubs/orders/WindowPills';
import { discountText, formatPricedSeats, lineValueCzk, liveOrdersTotalCzk, orderTotalCzk, priceText, sumMoney } from '../../components/clubs/orders/orderMoney';
import { rangeText, seatPercent, STATUS_TONE, termsSummary, seatsWithTotal } from '../../components/clubs/orders/orderLogic';
import { groupWindows, termsWord, windowLabel } from '../../components/clubs/orders/orderWindows';
import { formatPlayersTotal } from '../../components/clubs/panel/seats';
import { describeDiscount } from '../../pages/clubs/clubOrders';
import { canBeInvoiced } from '../../pages/clubs/payerForm';
import { formatPragueDateTime } from '../../utils/time';
import { usePlannerActions } from '../state/PlannerStoreProvider';
import { PAYMENT_METHOD_LABEL } from '../../api/clubOrders';
import type { ClubGroup } from './clubGroups';
import { useClubPlanner, type ClubPlannerValue } from './ClubPlannerContext';
import { useClubLegacy } from './useClubLegacy';
import './club.css';

const TONE_CLASS: Record<string, string> = { green: 'has-content', blue: 'has-content', beige: '', grey: '', red: 'is-red' };

function Cell({ label, children, warn = false }: { label: string; children: ReactNode; warn?: boolean }) {
  return (
    <div className="club-info-item">
      <span>{label}</span>
      <strong className={warn ? 'club-ov-warn' : undefined}>{children}</strong>
    </div>
  );
}

function Title({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="club-ov-title">
      <h3>{children}</h3>
      {aside ? <div className="club-ov-aside">{aside}</div> : null}
    </div>
  );
}

function Btn({ children, onClick, tone, testId, disabled }: { children: ReactNode; onClick: () => void; tone?: 'primary' | 'danger'; testId?: string; disabled?: boolean }) {
  return (
    <button type="button" className={`club-ov-btn${tone ? ` ${tone}` : ''}`} onClick={onClick} data-testid={testId} disabled={disabled}>{children}</button>
  );
}

/** "Základní 0/9 · 1 600 Kč · Komplexní 0/7 · 2 400 Kč (16 hráčů) · 14 400 Kč" - one služba line of a group row. */
function serviceText(o: ClubOrderView): string {
  const seats = o.activitySeats.length === 0 ? '—' : `${formatPricedSeats(o.activitySeats)} (${formatPlayersTotal(o.activitySeats)})`;
  return `${o.serviceName || 'Služba nevybrána'} · ${seats} · ${priceText(orderTotalCzk(o))}`;
}

function paymentText(root: ClubOrderView, group: readonly ClubOrderView[]): string {
  const money = sumMoney(group);
  const payment = `Platba: ${root.paymentMethod === null ? 'zatím neurčena' : PAYMENT_METHOD_LABEL[root.paymentMethod]}`;
  if (money === null) return `${payment} · ${priceText(null)}`;
  const discount = discountText(money);
  return `${payment} · Celkem ${formatCzk(money.totalCzk)}${discount !== '' ? ` · ${discount}` : ''}`;
}

function GroupRow({ g }: { g: ClubGroup }) {
  const ctx = useClubPlanner();
  const act = usePlannerActions();
  if (ctx === null) return null;
  const { root } = g;
  const live = root.status === 'Requested' || root.status === 'Confirmed';
  const grouped = g.addenda.length > 0;
  const shown = ctx.selected?.id === g.id && ctx.adhoc === null;
  const windows = groupWindows(g.orders);
  return (
    <div className={`club-order-row${shown ? ' is-shown' : ''}`} data-testid="club-order-row" data-order-id={root.id} data-status={root.status} data-addenda={g.addenda.length}>
      <div className="club-order-head">
        <strong>
          {`Objednávka ${g.code}`}
          {grouped ? null : <span>{` · ${root.serviceName || 'Služba nevybrána'}`}</span>}
        </strong>
        <span className="club-order-badges">
          {shown ? <span className="club-profile-badge has-content">NA PLÁNOVAČI</span> : null}
          <span className={`club-profile-badge ${TONE_CLASS[STATUS_TONE[root.status]] ?? ''}`}>{ORDER_STATUS_LABEL[root.status].toUpperCase()}</span>
        </span>
      </div>
      <div className="club-order-lines">
        {grouped
          ? g.orders.map((o) => <div key={o.id} data-testid="order-card-service" data-order-id={o.id}>{serviceText(o)}</div>)
          : <div data-testid="order-card-seats">{root.activitySeats.length === 0 ? '—' : `${formatPricedSeats(root.activitySeats)} (${formatPlayersTotal(root.activitySeats)})`} · {priceText(orderTotalCzk(root))}</div>}
        <div className="club-order-muted" data-testid="order-card-payment">{paymentText(root, g.orders)}</div>
      </div>
      <div className="club-order-windows">
        <small>{windows.length > 0 ? `Termíny (${windows.length} ${termsWord(windows.length)})` : 'Termíny'}</small>
        {windows.length > 0 ? (
          <WindowPills order={root} addenda={g.addenda} today={ctx.data.today} testId="order-card-windows" />
        ) : root.requestedRanges.length > 0 ? (
          <div data-testid="order-card-requested">{`Požadováno: ${root.requestedRanges.map((r) => rangeText(r, root)).join(' · ')}`}</div>
        ) : (
          <div className="club-order-muted">Zatím žádný termín.</div>
        )}
        {g.orders.map((o) => <UncoveredNotice key={o.id} order={o} compact />)}
      </div>
      <div className="club-order-actions" data-testid="order-card-actions">
        {root.status === 'Confirmed' ? (
          <Btn testId="order-card-edit-terms" onClick={() => { act.closeDialog(); ctx.editTerms(root); }}>{shown ? 'Upravit termíny (otevřeno)' : 'Upravit termíny'}</Btn>
        ) : null}
        {live ? <Btn testId="order-card-add-players" onClick={() => ctx.changePlayers(root, 'add')}>Přidat hráče / rozšířit</Btn> : null}
        {live ? <Btn testId="order-card-remove-players" onClick={() => ctx.changePlayers(root, 'remove')}>Odebrat hráče</Btn> : null}
        {root.status !== 'Cancelled' && root.status !== 'Completed' ? <Btn tone="danger" testId="order-card-cancel" onClick={() => ctx.cancelOrder(root)}>Zrušit objednávku</Btn> : null}
        <Btn tone="primary" testId="club-order-link" onClick={() => ctx.openOrder(root.id)}>Otevřít</Btn>
      </div>
    </div>
  );
}

function ProgressRow({ name, seats, registered, remaining, unitCzk, valueCzk }: {
  name: string; seats: number; registered: number; remaining: number; unitCzk?: number | null; valueCzk: number | null;
}) {
  const price = [unitCzk === undefined ? '' : `${priceText(unitCzk)}/místo`, `celkem ${priceText(valueCzk)}`].filter((p) => p !== '').join(' · ');
  return (
    <div className="club-ov-progress" data-testid="breakdown-row">
      <div className="club-ov-progress-head">
        <strong>{name}</strong>
        <span>{registered} / {seats} zapsáno · zbývá {remaining}</span>
      </div>
      <small data-testid="breakdown-price">{price}</small>
      <div className="capacity-bar" style={{ height: 5, marginTop: 7 }} aria-label={`Obsazenost: ${name}`}>
        <div style={{ width: `${seatPercent(registered, seats)}%` }} />
      </div>
    </div>
  );
}

/** Nothing off a club's screen. */
export function ClubOverviewSections() {
  const ctx = useClubPlanner();
  return ctx === null ? null : <Sections ctx={ctx} />;
}

function Sections({ ctx }: { ctx: ClubPlannerValue }) {
  const act = usePlannerActions();
  const navigate = useNavigate();
  const summary = useClubSummary(ctx.club.id);
  const activitiesQuery = useQuery({ queryKey: ['activities'], queryFn: activitiesApi.list, staleTime: 5 * 60 * 1000 });
  const legacy = useClubLegacy(ctx.club, ctx.data.today);
  const blockActivities = useQuery({ queryKey: ['club-block-activities'], queryFn: fetchBlockableActivities, staleTime: 5 * 60 * 1000 });

  const { club, data, groups } = ctx;
  const { today, orders } = data;
  const s = summary.data;
  const row = legacy.row;
  const activeBlocks = data.blocks.filter((b) => b.status === 'Active');
  const upcoming = activeBlocks.filter((b) => b.toDate >= today);
  const orderById = new Map(orders.map((o) => [o.id, o]));
  const upcomingByOrder = new Map<string, typeof upcoming>();
  for (const b of upcoming) if (b.clubOrderId) upcomingByOrder.set(b.clubOrderId, [...(upcomingByOrder.get(b.clubOrderId) ?? []), b]);
  const upcomingOrders = [...upcomingByOrder.entries()]
    .map(([id, bs]) => ({ id, blocks: [...bs].sort((a, b) => a.fromDate.localeCompare(b.fromDate)) }))
    .sort((a, b) => a.blocks[0].fromDate.localeCompare(b.blocks[0].fromDate));
  const upcomingLegacy = upcoming.filter((b) => !b.clubOrderId);
  const legacyBlocks = row.blocks.filter((b) => !b.clubOrderId);
  const cancelled = orders.filter((o) => o.status === 'Cancelled');
  const mergeable = mergeableRoots(groups);
  const billable = liveOrdersTotalCzk(orders);
  const bank = [club.bankAccount ? `${club.bankAccount}${club.bankCode ? `/${club.bankCode}` : ''}` : '', club.iban ?? ''].filter((p) => p !== '');

  const unitPriceOf = (activityId: string): number | null => {
    const listed = (activitiesQuery.data?.activities ?? []).find((a) => a.id === activityId)?.priceCzk ?? null;
    if (listed !== null) return listed;
    return orders.flatMap((o) => o.activitySeats).find((a) => a.activityId === activityId && a.unitPriceCzk !== null)?.unitPriceCzk ?? null;
  };
  const activityValueOf = (x: { activityId: string; seats: number }): number | null => lineValueCzk(x.seats, unitPriceOf(x.activityId));
  const serviceValueOf = (serviceName: string): number | null => {
    const own = (s?.byActivity ?? []).filter((a) => a.serviceName === serviceName);
    if (own.length === 0) return null;
    const values = own.map(activityValueOf);
    return values.some((v) => v === null) ? null : values.reduce<number>((sum, v) => sum + (v ?? 0), 0);
  };
  /* the older "Místa klubu" card: what the breakdown falls back to when the summary cannot be read */
  const blockSeatRows = clubActivitySeats(activeBlocks, (id) => (blockActivities.data ?? []).find((a) => a.id === id)?.name ?? '');
  const hasAnything = orders.length > 0 || data.blocks.length > 0 || row.order !== null;
  const selectedRoot = ctx.selected?.root ?? null;

  return (
    <div className="club-ov" data-testid="club-overview">
      {/* ── Klíčové údaje ── */}
      <div className="club-profile-grid" data-testid="club-figures">
        <section className="club-profile-section" aria-label="Klíčové údaje klubu">
          <h3>KLÍČOVÉ ÚDAJE</h3>
          {summary.isLoading ? <div className="club-ov-note">Načítám souhrn…</div> : summary.isError || s === undefined ? (
            <div className="club-ov-note">Souhrn klubu se nepodařilo načíst. <button type="button" className="plan-link-button" onClick={() => void summary.refetch()}>Zkusit znovu</button></div>
          ) : (
            <>
              <Cell label="Hráčů / míst">{s.totalSeats}</Cell>
              <Cell label="Zapsáno">{s.registered}</Cell>
              <Cell label="Zbývá">{s.remaining}</Cell>
              <div data-testid="club-figure-billable"><Cell label="K fakturaci">{billable === null ? '—' : formatCzk(billable)}</Cell></div>
            </>
          )}
        </section>
        <section className="club-profile-section" aria-label="Objednávky podle stavu" data-testid="summary-statuses">
          <h3>OBJEDNÁVKY PODLE STAVU</h3>
          {s === undefined ? <div className="club-ov-note">—</div> : ORDER_STATUSES.map((st) => (
            <Cell key={st} label={ORDER_STATUS_LABEL[st]}>{s.ordersByStatus[st]}</Cell>
          ))}
        </section>
        <section className="club-profile-section" aria-label="Fakturační údaje">
          <h3>FAKTURACE</h3>
          <Cell label="Stav klubu">{club.isActive ? 'Aktivní' : 'Neaktivní'}</Cell>
          <Cell label="Fakturace" warn={!canBeInvoiced(club)}>{canBeInvoiced(club) ? 'Na klub' : 'Chybí fakturační údaje'}</Cell>
          <Cell label="Bankovní spojení">{bank.length > 0 ? bank.join(' · ') : '—'}</Cell>
          <Cell label="Splatnost">{club.paymentTermsDays > 0 ? `${club.paymentTermsDays} dní` : '—'}</Cell>
          <Cell label="Sleva klubu">{describeDiscount(row.percent)}</Cell>
          <Cell label="Sportovců">{row.headcount ?? '—'}</Cell>
          {row.color !== null ? (
            <Cell label="Barva v kalendáři"><span className="club-ov-swatch" style={{ background: row.color }} /> {row.color.toUpperCase()}</Cell>
          ) : null}
        </section>
      </div>

      {!hasAnything ? (
        <div className="contact-card-info" data-testid="club-empty" style={{ marginTop: 12 }}>
          Tento klub zatím nemá hromadnou rezervaci. Založte klubu objednávku nebo mu vyhraďte termíny v kalendářích - sportovci se pak registrují přes odkaz.
        </div>
      ) : null}

      {/* ── Objednávky klubu ── */}
      <section className="club-ov-section" data-testid="club-orders-list" aria-label="Objednávky klubu">
        <Title aside={
          <>
            {mergeable.length >= 2 ? <Btn testId="merge-orders-button" onClick={ctx.mergeOrders}>Sloučit do jedné objednávky</Btn> : null}
            <Btn onClick={() => { act.closeDialog(); navigate(`/clubs/objednavky?clubId=${club.id}`); }}>Všechny objednávky</Btn>
          </>
        }>OBJEDNÁVKY KLUBU</Title>
        {ctx.data.ordersFailed ? (
          <div className="plan-dialog-error">Objednávky klubu se nepodařilo načíst. <button type="button" className="plan-link-button" onClick={data.refetch}>Zkusit znovu</button></div>
        ) : groups.length === 0 && cancelled.length === 0 ? (
          <div className="club-ov-note">Zatím žádná objednávka</div>
        ) : (
          <div className="club-order-list">
            {groups.map((g) => <GroupRow key={g.id} g={g} />)}
            {cancelled.length > 0 ? (
              <div data-testid="club-orders-cancelled" className="club-order-cancelled">
                <small>Zrušené objednávky</small>
                {cancelled.map((o) => (
                  <button key={o.id} type="button" className="club-order-cancelled-row" data-testid="club-order-cancelled" onClick={() => ctx.openOrder(o.id)}>
                    <span>{`${orderCode(o.id)} · ${o.serviceName || 'Služba nevybrána'} · ${seatsWithTotal(o) === '—' ? `${o.totalSeats} míst` : seatsWithTotal(o)} · ${termsSummary(o)}`}</span>
                    <span className="club-profile-badge">{ORDER_STATUS_LABEL[o.status].toUpperCase()}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </section>

      {/* ── Rozpis podle služeb a činností ── */}
      <section className="club-ov-section" data-testid="club-breakdown-wrap" aria-label="Rozpis podle služeb a činností">
        <Title>ROZPIS PODLE SLUŽEB A ČINNOSTÍ</Title>
        {s !== undefined && (s.byService.length > 0 || s.byActivity.length > 0) ? (
          <div className="club-ov-two" data-testid="club-breakdown">
            <div>
              <small className="club-ov-sub">Služby</small>
              {s.byService.map((x) => (
                <ProgressRow key={x.serviceId || x.serviceName} name={x.serviceName} seats={x.seats} registered={x.registered} remaining={Math.max(0, x.seats - x.registered)} valueCzk={serviceValueOf(x.serviceName)} />
              ))}
            </div>
            <div>
              <small className="club-ov-sub">Činnosti</small>
              {s.byActivity.map((x) => (
                <ProgressRow
                  key={x.activityId || x.activityName}
                  name={x.serviceName !== '' ? `${x.activityName} (${x.serviceName})` : x.activityName}
                  seats={x.seats} registered={x.registered} remaining={x.remaining}
                  unitCzk={unitPriceOf(x.activityId)} valueCzk={activityValueOf(x)}
                />
              ))}
            </div>
          </div>
        ) : summary.isError && blockSeatRows.length > 0 ? (
          <ClubSeatsCard rows={blockSeatRows} />
        ) : (
          <div className="club-ov-note" data-testid="club-breakdown-empty">{summary.isError ? 'Rozpis se nepodařilo načíst.' : 'Zatím nic k rozepsání - klub nemá žádná místa.'}</div>
        )}
      </section>

      {/* ── Nadcházející okna ── */}
      <section className="club-ov-section" data-testid="club-windows" aria-label="Nadcházející okna v kalendáři">
        <Title>NADCHÁZEJÍCÍ OKNA V KALENDÁŘI</Title>
        {upcoming.length === 0 ? <div className="club-ov-note">Klub nemá žádné nadcházející okno.</div> : (
          <div className="club-order-list">
            {upcomingOrders.map((g) => {
              const o = orderById.get(g.id);
              return (
                <div key={g.id} className="club-ov-window" data-testid="club-window" data-order-id={g.id}>
                  <div>
                    <strong>{`Objednávka ${orderCode(g.id)}${o?.serviceName ? ` · ${o.serviceName}` : ''}`}</strong>
                    <small>{g.blocks.map((b) => windowLabel(b, o)).join(' · ')}</small>
                  </div>
                  {o !== undefined ? <span className="club-profile-badge has-content">{o.registered} / {o.totalSeats}</span> : null}
                </div>
              );
            })}
            {upcomingLegacy.map((b) => (
              <div key={b.id} className="club-ov-window" data-testid="club-window">
                <div><strong>{blockTitle(b)}</strong><small>{windowLabel(b)}</small></div>
                <span className="club-profile-badge has-content">{b.registered} / {b.seats}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Vybraná objednávka: odkazy a historie ── */}
      {selectedRoot !== null ? (
        <section className="club-ov-section" data-testid="club-selected-order" aria-label="Vybraná objednávka">
          <Title>{`VYBRANÁ OBJEDNÁVKA ${orderCode(selectedRoot.id)}`}</Title>
          <details className="club-ov-details" open>
            <summary>Odkazy klubu a hráčů</summary>
            <ClubLinksBlock order={selectedRoot} />
          </details>
          <details className="club-ov-details">
            <summary>Historie objednávky</summary>
            {selectedRoot.history.length === 0 ? <div className="club-ov-note">Zatím bez záznamů.</div> : (
              <ol className="club-ov-history" data-testid="order-history">
                {selectedRoot.history.map((h, i) => (
                  <li key={i}>
                    <small>{h.atUtc !== '' ? formatPragueDateTime(h.atUtc) : ''}{h.user !== '' ? ` · ${h.user}` : ''}</small>
                    <span>{h.text}</span>
                  </li>
                ))}
              </ol>
            )}
          </details>
        </section>
      ) : null}

      {/* ── Starší rezervace ── */}
      {legacyBlocks.length > 0 || row.order !== null ? (
        <section className="club-ov-section" data-testid="club-legacy-blocks" aria-label="Starší rezervace (bez objednávky)">
          <Title>STARŠÍ REZERVACE (BEZ OBJEDNÁVKY)</Title>
          <div className="club-ov-legacy">
            {legacyBlocks.map((b) => (
              <ClubBlockPanel key={b.id} block={b} contactEmail={club.contactEmail} clubName={club.name} />
            ))}
            {row.order !== null ? (
              <LegacyReservation
                club={club}
                order={row.order}
                percent={row.percent}
                priceOf={(id) => (activitiesQuery.data?.activities ?? []).find((a) => a.id === id)?.priceCzk ?? null}
                pricesReady={activitiesQuery.isSuccess || activitiesQuery.isError}
                onInvoice={() => { act.closeDialog(); navigate('/billing', { state: { clubId: club.id, partnerOrderId: row.order?.id ?? null } }); }}
                onReload={ctx.reload}
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {/* ── Akce ── */}
      <section className="club-ov-section" data-testid="club-actions" aria-label="Akce klubu">
        <Title>AKCE KLUBU</Title>
        <div className="club-order-actions">
          <Btn tone="primary" onClick={() => { act.closeDialog(); ctx.newOrder(); }}>Nová objednávka klubu</Btn>
          <Btn onClick={() => { act.closeDialog(); ctx.newReservation(); }}>Vytvořit rezervaci</Btn>
          <Btn onClick={() => { act.closeDialog(); navigate('/clubs/hraci'); }}>Sportovci klubů</Btn>
          <Btn onClick={() => act.openDialog({ kind: 'clubEdit' })}>Upravit údaje klubu</Btn>
          {club.isActive ? <Btn tone="danger" onClick={() => void ctx.deactivate()}>{`Deaktivovat klub`}</Btn> : null}
        </div>
      </section>
    </div>
  );
}
