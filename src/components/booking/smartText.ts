/* The words of the smart confirmations, in Czech, in one place. */
import { PaymentMethod } from '../../services/cashierApi';

export const SMART_TEXT = {
  arrived: 'Přišel',
  noShow: 'Nepřišel',
  undo: 'Vrátit na objednán',
  probablyAbsent: 'asi nepřišel',
  probablyAbsentWhy: (minutes: number) =>
    `Od začátku termínu uplynulo víc než ${minutes} min a pacient nebyl označen jako přítomný. Stav se nemění sám - klikněte Nepřišel nebo Přišel.`,
  paid: 'Zaplaceno',
  payNow: 'Zaplaceno',
  payTitle: 'Přijmout platbu za tento termín',
  payHelp: 'Pokladna vyplněná z termínu: pacient, služba a cena. Hotovost a karta se uzavřou hned; převod a platba na klub zůstanou otevřené, dokud nepřijdou.',
  noPrice: 'Činnost nemá v ceníku položku, takže cenu není z čeho vzít. Doplňte ji v Nastavení → Činnosti.',
  price: 'Cena (Kč)',
  method: 'Způsob platby',
  discount: 'Sleva (Kč)',
  discountReason: 'Důvod slevy',
  record: 'Zaevidovat platbu',
  recording: 'Ukládám…',
  close: 'Zavřít',
  failed: 'Platbu se nepodařilo uložit.',
  paidLine: (amount: string, method: string, at: string) => `${SMART_TEXT.paid} ${amount} (${method}) ${at}`,
  openLine: (amount: string, method: string) => `Čeká na zaplacení ${amount} (${method})`,
} as const;

export const METHOD_LABELS: Record<number, string> = {
  [PaymentMethod.Cash]: 'hotovost',
  [PaymentMethod.Card]: 'karta',
  [PaymentMethod.Transfer]: 'převod',
  [PaymentMethod.ClubBilling]: 'na klub',
};
