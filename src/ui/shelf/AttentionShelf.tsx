/*
 * "Vyžaduje pozornost" - the shelf at the top of the plocha. It reads the lists the application already loads (invoices,
 * today's bookings, club orders, the registration queue, the outgoing-queue health, the paperwork of today's patients),
 * hands them to the pure rules in `attention.ts` and draws one card per rule that has something in it. Every case on a card
 * is a link to the place that fixes it.
 *
 * A source the person may not see is not asked (no `billing.manage`, no invoices); a source that fails contributes nothing
 * and is SAID: an all-clear is never claimed for something that could not be looked at.
 */
import { useAttention, type AttentionState } from './useAttention';
import { AttentionCard } from './ShelfCard';
import { Shelf } from './Shelf';

export { useAttention, type AttentionState };

export function AttentionShelf({ state }: { state: AttentionState }) {
  const { groups, total, loading, failed, retry } = state;
  const clear = groups.length === 0 && !loading;
  return (
    <Shelf
      id="attention"
      title="Vyžaduje pozornost"
      hint={failed > 0 && groups.length > 0 ? `Část údajů se nenačetla (${failed})` : total > 0 ? 'Každý případ vede tam, kde se vyřeší' : undefined}
      count={total}
      countTone="red"
      layout="row"
      minCardWidth={320}
      cardHeight={188}
      skeletons={3}
      loading={loading}
      error={clear && failed > 0 ? 'Některé údaje se nepodařilo načíst, takže nevíme, jestli něco nečeká.' : false}
      onRetry={retry}
      empty={clear}
      emptyState={{ text: 'Vše vyřízeno. Nic nečeká na vaši pozornost.', action: { label: 'Dnešní přehled', to: '/dnes' } }}
    >
      {groups.map((g) => <AttentionCard key={g.id} group={g} />)}
    </Shelf>
  );
}
