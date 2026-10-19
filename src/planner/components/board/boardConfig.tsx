/*
 * How the page that draws the planner wants the board to behave. The lab and the shell tests give
 * nothing (the board then draws exactly the file from the data source); the real route
 * (`PlannerPage`) gives `realCalendar: true`, and the board reads the clinic's real calendar -
 * bookings, blocks, club windows, the calendars filter - on top.
 */
import { createContext, useContext, type ReactNode } from 'react';

export interface BoardConfig {
  /** Draw the clinic's real calendar (bookings, blocks) and allow booking / blocking / moving. */
  realCalendar: boolean;
  /** `club`: a club order is being planned (the club's own windows are the session cards). */
  mode: 'standard' | 'club';
  /** The club being planned: its windows from the calendar are not drawn twice. */
  excludeClubId: string | null;
  /** The club's own screen: only the windows of the order that is edited are drawn from the draft, the club's other windows stay on the board. */
  excludeClubBlockIds?: ReadonlySet<string>;
  /** The club order being processed right now: its inquiry days read "Klub žádá" instead of "Poptávka · club". */
  inquiryOrderId?: string | null;
  /** Fixed wall-clock minute for the now-line (tests); the real clock when undefined. */
  nowMinute?: number;
}

export const DEFAULT_BOARD_CONFIG: BoardConfig = { realCalendar: false, mode: 'club', excludeClubId: null };

const ConfigContext = createContext<BoardConfig>(DEFAULT_BOARD_CONFIG);

export function BoardConfigProvider({ value, children }: { value: BoardConfig; children: ReactNode }) {
  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export const useBoardConfig = (): BoardConfig => useContext(ConfigContext);
