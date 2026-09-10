import { useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Stack,
  Typography,
} from "@mui/material";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { partnerOrdersApi } from "../../api/partnerOrders";
import type { PartnerOrder, PartnerWindow } from "../../api/bookingContracts";
import { formatDateOnly } from "../../utils/time";
import { errorText } from "./errorText";

/**
 * Releasing a held window — contract 5.11.
 *
 * 4.7 makes the distinction this dialog exists to preserve: **"released" is not
 * "public".** A window released to one club stays invisible to everybody else,
 * so the audience is always a choice and never implied by the act of
 * releasing. Ticking nothing is allowed and means the time goes back to nobody
 * in particular - the dialog says as much rather than silently doing something
 * else with it.
 */

export function ReleaseWindowDialog({
  open,
  order,
  window: held,
  otherOrders,
  onClose,
  onReleased,
}: {
  open: boolean;
  order: PartnerOrder;
  window: PartnerWindow;
  otherOrders: PartnerOrder[];
  onClose: () => void;
  onReleased: () => void;
}) {
  const { t } = useTranslation();
  const [toPublic, setToPublic] = useState(false);
  const [toPartners, setToPartners] = useState<Set<string>>(new Set());

  const release = useMutation({
    mutationFn: () =>
      partnerOrdersApi.releaseWindow(order.calendarId, order.id, held.id, {
        toPublic,
        partnerOrderIds: [...toPartners],
      }),
    onSuccess: () => {
      onReleased();
      onClose();
    },
  });

  const toggle = (id: string) =>
    setToPartners((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("booking.partner.releaseTitle")}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography>
            {t("booking.partner.releaseWhat", {
              partner: order.partnerName,
              day: formatDateOnly(held.date),
              from: held.startTime.slice(0, 5),
              to: held.endTime.slice(0, 5),
            })}
          </Typography>

          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {t("booking.partner.releaseExplain")}
          </Typography>

          <Divider />

          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {t("booking.partner.audience")}
          </Typography>

          <FormControlLabel
            control={
              <Checkbox
                checked={toPublic}
                onChange={(e) => setToPublic(e.target.checked)}
              />
            }
            label={t("booking.partner.audiencePublic")}
          />

          {otherOrders.length === 0 ? (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {t("booking.partner.noOtherPartners")}
            </Typography>
          ) : (
            otherOrders.map((o) => (
              <FormControlLabel
                key={o.id}
                control={
                  <Checkbox
                    checked={toPartners.has(o.id)}
                    onChange={() => toggle(o.id)}
                  />
                }
                label={o.partnerName}
              />
            ))
          )}

          {/* Ticking nothing is a real choice, so it is spelled out. */}
          {!toPublic && toPartners.size === 0 ? (
            <Alert severity="info">{t("booking.partner.audienceNobody")}</Alert>
          ) : null}

          {release.error ? (
            <Alert severity="error">{errorText(release.error, t)}</Alert>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("booking.common.cancel")}</Button>
        <Button
          variant="contained"
          disabled={release.isPending}
          onClick={() => release.mutate()}
        >
          {t("booking.partner.release")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ReleaseWindowDialog;
