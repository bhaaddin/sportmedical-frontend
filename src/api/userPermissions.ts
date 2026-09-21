import { client } from './client';

/**
 * One permission, and where this person's answer to it comes from.
 *
 * `fromRole` and `isOverridden` are not decoration: a permission that is on
 * because the role gives it and one that is on because an administrator
 * switched it on are identical to the server and completely different to the
 * person reading the list — only the second is a decision somebody made.
 */
export interface UserPermissionState {
  permission: string;
  fromRole: boolean;
  effective: boolean;
  isOverridden: boolean;
}

interface ApiResult<T> {
  success: boolean;
  message: string;
  data: T;
}

/**
 * The Czech for each permission, so the screen is not a list of dotted
 * identifiers.
 *
 * Deliberately a lookup rather than a generated label: "patients.sensitive_
 * identity.view" turned into "Patients sensitive identity view" reads like a
 * machine talking, and this list is somebody deciding what a colleague may see.
 */
export const PERMISSION_LABELS: Record<string, { label: string; detail: string }> = {
  'patients.view': {
    label: 'Vidět pacienty',
    detail: 'Seznam pacientů a jejich karty.',
  },
  'patients.register': {
    label: 'Zakládat pacienty',
    detail: 'Registrovat nového pacienta.',
  },
  'patients.edit': {
    label: 'Upravovat pacienty',
    detail: 'Měnit údaje na kartě pacienta.',
  },
  'patients.sensitive_identity.view': {
    label: 'Vidět rodné číslo a číslo pojištěnce',
    detail: 'Bez tohoto práva jsou tyto údaje skryté.',
  },
  'reports.view': {
    label: 'Vidět zprávy a výsledky',
    detail: 'Lékařské zprávy a výstupy z měření.',
  },
  'bookings.create': {
    label: 'Vytvářet rezervace',
    detail: 'Objednat pacienta do kalendáře.',
  },
  'bookings.edit': {
    label: 'Upravovat rezervace',
    detail: 'Přesouvat termíny a měnit jejich obsah.',
  },
  'bookings.cancel': {
    label: 'Rušit rezervace',
    detail: 'Zrušit už objednaný termín.',
  },
  'questionnaires.manage': {
    label: 'Pracovat s dotazníky',
    detail: 'Číst odpovědi pacientů a nastavovat dotazníky.',
  },
  'settings.clinic.manage': {
    label: 'Měnit nastavení ordinace',
    detail: 'Kontakty, kalendáře, služby, svátky.',
  },
  'settings.appearance.manage': {
    label: 'Měnit vzhled',
    detail: 'Barvy a vizuální nastavení.',
  },
  'users.manage': {
    label: 'Spravovat účty',
    detail: 'Zakládat účty a měnit, co kdo smí.',
  },
  'roles.manage': {
    label: 'Spravovat role',
    detail: 'Měnit, co dává která role.',
  },
};

export const userPermissionsApi = {
  list: async (userId: string): Promise<UserPermissionState[]> => {
    const { data } = await client.get<ApiResult<UserPermissionState[]>>(
      `/api/v1/users/${userId}/permissions`,
    );

    return data.data ?? [];
  },

  /**
   * `granted: null` is the third answer: back on the role. Not the same as
   * revoking — it means this person follows the role again, including when the
   * role's defaults change later.
   */
  set: async (
    userId: string,
    permission: string,
    granted: boolean | null,
  ): Promise<UserPermissionState[]> => {
    const { data } = await client.put<ApiResult<UserPermissionState[]>>(
      `/api/v1/users/${userId}/permissions/${encodeURIComponent(permission)}`,
      { granted },
    );

    return data.data ?? [];
  },
};
