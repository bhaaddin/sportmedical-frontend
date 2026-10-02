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
  'patients.view_all': {
    label: 'Vidět všechny pacienty',
    detail: 'Bez tohoto práva vidí jen pacienty objednané v kalendářích, ke kterým má přístup.',
  },
  'patients.sensitive_identity.view': {
    label: 'Vidět rodné číslo a číslo pojištěnce',
    detail: 'Bez tohoto práva jsou tyto údaje skryté.',
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
  'billing.manage': {
    label: 'Pracovat s pokladnou a fakturami',
    detail: 'Přijímat platby, vystavovat a stornovat faktury, vracet peníze, vést číselné řady.',
  },
  'documents.view': {
    label: 'Vidět dokumenty pacienta',
    detail: 'Prohlížet a stahovat, co pacient doložil.',
  },
  'documents.manage': {
    label: 'Měnit dokumenty pacienta',
    detail: 'Nahrávat, podepisovat, zneplatňovat a přeřazovat. Jiná práce než jen se na ně podívat.',
  },
  'communication.manage': {
    label: 'Psát a odesílat za ordinaci',
    detail: 'Dnes nic neotvírá: žádná obrazovka ani rozhraní aplikace ho nevyžaduje.',
  },
  'questionnaires.manage': {
    label: 'Pracovat s dotazníky',
    detail: 'Číst odpovědi pacientů a nastavovat dotazníky.',
  },
  'settings.clinic.manage': {
    label: 'Měnit nastavení ordinace',
    detail: 'Kontakty, kalendáře, služby, svátky.',
  },
  'users.manage': {
    label: 'Spravovat účty',
    detail: 'Zakládat účty a měnit, co kdo smí.',
  },
  'roles.manage': {
    label: 'Spravovat role',
    detail: 'Přidělovat účtům role a spravovat účty vlastníka.',
  },
};

export const userPermissionsApi = {
  list: async (userId: string): Promise<UserPermissionState[]> => {
    const { data } = await client.get<UserPermissionState[]>(
      `/api/v1/users/${userId}/permissions`,
    );

    return data ?? [];
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
    const { data } = await client.put<UserPermissionState[]>(
      `/api/v1/users/${userId}/permissions/${encodeURIComponent(permission)}`,
      { granted },
    );

    return data ?? [];
  },
};
