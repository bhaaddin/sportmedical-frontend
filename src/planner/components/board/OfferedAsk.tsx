/* R22 - a day only OFFERED to a club does not refuse a booking; this asks first. Lazy. */
import { Button, Popover } from '@mui/material';
import { DESIGN } from '../../../theme';
import { HOLD_TEXT } from './clubHold';

export interface OfferedAskState {
  club: string;
  orderId: string | null;
  x: number;
  y: number;
  go: () => void;
}

export default function OfferedAsk({ ask, onClose, onOrder }: { ask: OfferedAskState; onClose: () => void; onOrder: (orderId: string) => void }) {
  return (
    <Popover
      open
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={{ top: ask.y, left: ask.x }}
      slotProps={{ paper: { sx: { width: 300, maxWidth: 'calc(100vw - 24px)', p: 1.5, borderRadius: '10px', boxShadow: DESIGN.shadow.menu } } }}
    >
      <div data-testid="offered-ask" role="group" aria-label={HOLD_TEXT.offeredWarn(ask.club)} className="offered-ask">
        <strong>{HOLD_TEXT.offeredWarn(ask.club)}</strong>
        <p>Tento čas jsme klubu jen nabídli, klub může nabídku odmítnout. Rezervovat sem přesto?</p>
        <div className="offered-ask-actions">
          <Button
            variant="contained"
            data-testid="offered-ask-go"
            sx={{ minHeight: 44 }}
            onClick={() => {
              const go = ask.go;
              onClose();
              go();
            }}
          >
            Přesto rezervovat
          </Button>
          {ask.orderId ? (
            <Button data-testid="offered-ask-order" sx={{ minHeight: 44 }} onClick={() => onOrder(ask.orderId!)}>Otevřít objednávku</Button>
          ) : null}
          <Button data-testid="offered-ask-cancel" sx={{ minHeight: 44 }} onClick={onClose}>Zrušit</Button>
        </div>
      </div>
    </Popover>
  );
}
