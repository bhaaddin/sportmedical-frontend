/*
 * The writes of the planner as stable functions.
 *
 * Each call goes to the data source, then invalidates the planner queries so
 * every panel re-reads. A rejection is a `PlannerWriteError` (code + Czech
 * message): the caller turns it into a toast. Undo goes through the token the
 * write returned.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { ClubProfile, IntervalInput, IsoDate, SessionId } from '../model';
import { usePlannerData } from './PlannerDataProvider';
import {
  plannerKeys,
  type MoveIntervalInput,
  type PlannerDataSource,
  type ResizeIntervalInput,
  type UpdateIntervalInput,
} from './PlannerDataSource';

export interface PlannerCommands {
  createInterval: PlannerDataSource['createInterval'];
  createIntervals: (inputs: readonly IntervalInput[]) => Promise<{ created: number; complete: boolean; mergedCount: number; undoToken: string | null }>;
  createTerm: PlannerDataSource['createTerm'];
  moveInterval: (input: MoveIntervalInput) => ReturnType<PlannerDataSource['moveInterval']>;
  resizeInterval: (input: ResizeIntervalInput) => ReturnType<PlannerDataSource['resizeInterval']>;
  updateInterval: (input: UpdateIntervalInput) => ReturnType<PlannerDataSource['updateInterval']>;
  deleteInterval: (id: SessionId) => ReturnType<PlannerDataSource['deleteInterval']>;
  undo: (token: string) => Promise<void>;
  finishPlan: PlannerDataSource['finishPlan'];
  publishForm: PlannerDataSource['publishForm'];
  saveClubProfile: (patch: Partial<Omit<ClubProfile, 'logoUrl'>>) => Promise<ClubProfile>;
  saveLogo: (file: Blob) => Promise<ClubProfile>;
  saveDayBudget: PlannerDataSource['saveDayBudget'];
  /** Demo simulation; undefined when the source cannot simulate. */
  addBooking?: (id: SessionId, kind: 'club' | 'public') => Promise<{ message: string }>;
  releaseDay?: (date: IsoDate) => Promise<{ message: string }>;
}

export function usePlannerCommands(): PlannerCommands {
  const { source } = usePlannerData();
  const client = useQueryClient();
  return useMemo(() => {
    const after = async <T,>(promise: Promise<T>): Promise<T> => {
      const result = await promise;
      await client.invalidateQueries({ queryKey: plannerKeys.all(source.id) });
      return result;
    };
    const commands: PlannerCommands = {
      createInterval: (input: IntervalInput) => after(source.createInterval(input)),
      createIntervals: (inputs) =>
        after(
          source.createIntervals
            ? source.createIntervals(inputs)
            : (async () => {
                let last: string | null = null;
                let merged = 0;
                let complete = false;
                for (const input of inputs) {
                  const r = await source.createInterval(input);
                  last = r.undoToken ?? last;
                  merged += r.mergedCount;
                  complete = r.complete;
                }
                return { created: inputs.length, complete, mergedCount: merged, undoToken: last };
              })(),
        ),
      createTerm: (input) => after(source.createTerm(input)),
      moveInterval: (input) => after(source.moveInterval(input)),
      resizeInterval: (input) => after(source.resizeInterval(input)),
      updateInterval: (input) => after(source.updateInterval(input)),
      deleteInterval: (id) => after(source.deleteInterval(id)),
      undo: (token) => after(source.undo(token)),
      finishPlan: (options) => after(source.finishPlan(options)),
      publishForm: () => after(source.publishForm()),
      saveClubProfile: (patch) => after(source.saveClubProfile(patch)),
      saveLogo: (file) => after(source.saveLogo(file)),
      saveDayBudget: (minutes) => after(source.saveDayBudget(minutes)),
    };
    if (source.addBooking) commands.addBooking = (id, kind) => after(source.addBooking!(id, kind));
    if (source.releaseDay) commands.releaseDay = (date) => after(source.releaseDay!(date));
    return commands;
  }, [client, source]);
}
