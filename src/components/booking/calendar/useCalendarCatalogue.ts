import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { activitiesApi } from "../../../api/activities";
import client from "../../../api/client";
import type { ClinicService } from "../../../api/clinicServices";
import { activityInfoOf, cleanHex, type ActivityInfo, type Catalogue, type ServiceInfo } from "./model";

/*
 * The calendar's view of činnosti and služby with their colours (contract C1).
 *
 * Činnosti come from the shared `["activities"]` query - the same cache the
 * hover card and the booking drawer read, so it costs nothing extra. The
 * service's own colour is not in the shared `ClinicService` type yet, so it is
 * read from the same `GET /api/clinic-services` answer here, tolerantly: a
 * server that does not send `colorHex` simply leaves the legend square on the
 * činnost colours / the calendar colour.
 */

const record = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

async function readServiceColours(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  try {
    const res = await client.get("/api/clinic-services");
    const payload = res.data;
    const list = Array.isArray(payload)
      ? payload
      : record(payload) && Array.isArray(payload.data)
        ? payload.data
        : [];
    for (const item of list) {
      if (!record(item) || typeof item.id !== "string") continue;
      const hex = cleanHex(typeof item.colorHex === "string" ? item.colorHex : null);
      if (hex) out.set(item.id, hex);
    }
  } catch {
    /* No colours is a quieter calendar, not a broken one. */
  }
  return out;
}

export function useCalendarCatalogue(services: readonly ClinicService[] | undefined): {
  catalogue: Catalogue;
  /** The činnosti have been read; until then the grid stays on one column per calendar. */
  ready: boolean;
} {
  const activitiesQuery = useQuery({
    queryKey: ["activities"],
    queryFn: () => activitiesApi.list(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const carried = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of services ?? []) {
      const hex = cleanHex((s as { colorHex?: string | null }).colorHex);
      if (hex) map.set(s.id, hex);
    }
    return map;
  }, [services]);
  const needsRaw = (services?.length ?? 0) > 0 && carried.size < (services?.length ?? 0);

  const coloursQuery = useQuery({
    queryKey: ["clinic-services", "colours"],
    queryFn: readServiceColours,
    enabled: needsRaw,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const catalogue = useMemo<Catalogue>(() => {
    const activities = new Map<string, ActivityInfo>();
    for (const a of activitiesQuery.data?.activities ?? []) activities.set(a.id, activityInfoOf(a));
    const raw = coloursQuery.data;
    const serviceMap = new Map<string, ServiceInfo>();
    for (const s of services ?? []) {
      serviceMap.set(s.id, {
        id: s.id,
        name: s.name,
        colorHex: carried.get(s.id) ?? raw?.get(s.id) ?? null,
        sortOrder: s.sortOrder,
        isActive: s.isActive,
      });
    }
    return { activities, services: serviceMap };
  }, [activitiesQuery.data, coloursQuery.data, services, carried]);

  return { catalogue, ready: activitiesQuery.isSuccess };
}
