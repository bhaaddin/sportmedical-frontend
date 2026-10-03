import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { patientPreRegistrationApi } from "../../../api/patientPreRegistration";
import { completionUrl } from "./quickBooking";

export interface IssuedCompletionLink {
  url: string;
  /** When the link stops working - the server's answer, never a number written on a screen. */
  expiresAtUtc: string | null;
}

/**
 * Issues (or re-issues) the patient's completion link through the existing
 * registration-link endpoint and puts it on the clipboard. Re-issuing makes
 * the previous link stop working, which the screen says out loud.
 */
export function useCompletionLink(patientId: string) {
  const [copied, setCopied] = useState(false);
  const [clipboardFailed, setClipboardFailed] = useState(false);

  const issue = useMutation({
    mutationFn: async (): Promise<IssuedCompletionLink> => {
      const issued = await patientPreRegistrationApi.issueLink(patientId);
      const origin = window.location.origin;
      const url =
        issued.url ??
        (issued.path
          ? `${origin}${issued.path}`
          : completionUrl({ url: null, token: issued.token ?? "" }, origin));
      return { url, expiresAtUtc: issued.expiresAtUtc ?? null };
    },
  });

  /** The link, issued if it was not yet. */
  const ensure = async (): Promise<IssuedCompletionLink | null> =>
    issue.data ?? (await issue.mutateAsync().catch(() => null));

  const copy = async (): Promise<void> => {
    setClipboardFailed(false);
    const done = await ensure();
    if (!done) return;
    try {
      await navigator.clipboard.writeText(done.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked; the address is on screen to copy by hand */
      setClipboardFailed(true);
    }
  };

  return {
    link: issue.data?.url ?? null,
    expiresAtUtc: issue.data?.expiresAtUtc ?? null,
    copied,
    clipboardFailed,
    pending: issue.isPending,
    failed: issue.isError,
    copy,
    ensure,
  };
}
