import { dateOf, printable, weekNames, weekdayIndex } from '../../model';

/** "Po", "Út" … of a `yyyy-MM-dd`. */
export const dayOfWeekShort = (date: string): string => weekNames[weekdayIndex(dateOf(date))] ?? '';

/** "26. 11." */
export const formatShortDate = (date: string): string => printable(dateOf(date));
