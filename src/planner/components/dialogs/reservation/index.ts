/*
 * The reservation dialogs: the club occupancy overview ("Rezervace klubu"). Importing this module registers
 * it in `dialogRegistry`. (The reservation DRAWER itself is the layer `components/ReservationDrawer.tsx`.)
 */
import { dialogRegistry } from '../../dialogRegistry';
import { clubOccupancyDialog } from './ClubOccupancyDialog';

dialogRegistry.clubOccupancy = clubOccupancyDialog;

export { clubOccupancyDialog };
