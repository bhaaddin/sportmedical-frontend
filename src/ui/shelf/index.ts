/*
 * The shelf design system (docs/ui-shelf-system.md). A staff page is a PageFrame of Shelves; things that belong together are
 * connected with EntityChips; everything that needs a person is on the attention shelf; Ctrl/Cmd+K finds all of it.
 *
 * The command palette is deliberately NOT exported here: it is a lazy chunk, reached only through `components/UniversalSearch`.
 */
export { PageFrame, PaletteTrigger, type PageFrameProps, type Crumb } from './PageFrame';
export { Shelf, type ShelfProps, type ShelfAction } from './Shelf';
export { EntityCard, MetricCard, ActionCard, AttentionCard, ABOVE_LINK } from './ShelfCard';
export { EntityChip, EntityLink } from './EntityLink';
export { EntityBadge, ENTITY_ICON, ENTITY_TONE } from './entityMeta';
export { RelatedShelf, RelatedCard, PatientRelatedShelf } from './RelatedShelf';
export { RecentAndPinned, PinButton, useShelfMemory, whenWords } from './RecentAndPinned';
export { AttentionShelf, useAttention, type AttentionState } from './AttentionShelf';
export {
  ENTITY_KINDS, ENTITY_LABEL, ENTITY_PLURAL, entityTarget, entityListPath, mayOpen, readRef, safeLabel, looksLikeIdentifier,
  type EntityKind, type EntityRef, type EntityTarget,
} from './entities';
export { rememberOpened, togglePinned, clearRecents } from './memory';
export { attentionGroups, attentionTotal, type AttentionGroup, type AttentionItem, type AttentionInput } from './attention';
export { patientRelatedGroups, invoiceRelatedGroups, type RelatedGroup, type Source } from './related';
export { cardSurface, railSx, toneOf, CARD_RADIUS, TARGET_SX, MUTED_SX, type ShelfTone } from './shelfStyle';
