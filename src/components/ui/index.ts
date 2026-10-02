/*
 * The board's building blocks, in one place. A screen that needs a status
 * pill, a page header, a bordered card, a filter row or a KPI number takes it
 * from here rather than drawing its own - so the fifth screen looks like the
 * first one.
 */
export { StatusChip, type ChipTone } from './StatusChip';
export { PageHeader } from './PageHeader';
export { SectionLabel } from './SectionLabel';
export { SoftCard } from './SoftCard';
export { FilterChips, type FilterOption } from './FilterChips';
export { KpiCard } from './KpiCard';
export { DESIGN } from '../../theme';
