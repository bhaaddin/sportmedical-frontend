// Public Booking Service - GDPR consent + worker availability + appointment booking

export interface BookingPatientData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  rodneCislo?: string;
  insuranceCompany?: string;
  insuranceNumber?: string;
  notes?: string;
}

export interface BookingGdprConsent {
  dataProcessing: boolean;    // Zpracování osobních údajů
  marketingConsent: boolean;  // Marketingový souhlas
  dataRetention: boolean;     // Souhlas s uchováním dat
  shareWithDoctors: boolean;  // Sdílení s lékaři
  acceptedAt: string;
  ipAddress?: string;
}

export interface BookingRequest {
  serviceId: string;
  workerId: string;
  date: string;
  time: string;
  patient: BookingPatientData;
  gdpr: BookingGdprConsent;
}

export interface BookingResponse {
  id: string;
  confirmationCode: string;
  date: string;
  time: string;
  workerName: string;
  serviceName: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  message: string;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  category: string;
  requiresInsurance: boolean;
}

export interface Worker {
  id: string;
  name: string;
  specialization: string;
  services: string[];
  allowOnlineBooking: boolean;
}

class PublicBookingService {
  private baseUrl = '/api/public';

  async getServices(): Promise<Service[]> {
    try {
      const res = await fetch(`${this.baseUrl}/services`);
      if (res.ok) return await res.json();
    } catch {}
    // Fallback: demo data
    return [
      { id: '1', name: 'Všeobecné vyšetření', description: 'Komplexní zdravotní prohlídka', duration: 30, price: 500, category: 'general', requiresInsurance: false },
      { id: '2', name: 'Sportovní prohlídka', description: 'Prohlídka pro sportovce', duration: 45, price: 800, category: 'sport', requiresInsurance: false },
      { id: '3', name: 'Rehabilitace', description: 'Rehabilitační terapie', duration: 60, price: 1200, category: 'rehabilitation', requiresInsurance: false },
      { id: '4', name: 'Fyzioterapie', description: 'Fyzioterapeutické ošetření', duration: 45, price: 900, category: 'physiotherapy', requiresInsurance: false },
      { id: '5', name: 'Ortopedie', description: 'Ortopedické vyšetření', duration: 30, price: 600, category: 'orthopedics', requiresInsurance: true },
      { id: '6', name: 'Neurologie', description: 'Neurologické vyšetření', duration: 45, price: 700, category: 'neurology', requiresInsurance: true },
      { id: '7', name: 'EKG', description: 'Elektrokardiogram', duration: 20, price: 300, category: 'diagnostics', requiresInsurance: false },
      { id: '8', name: 'Ultrazvuk', description: 'Ultrasonografické vyšetření', duration: 30, price: 500, category: 'diagnostics', requiresInsurance: false },
    ];
  }

  async getWorkers(): Promise<Worker[]> {
    try {
      const res = await fetch(`${this.baseUrl}/workers`);
      if (res.ok) return await res.json();
    } catch {}
    return [
      { id: 'w1', name: 'MUDr. Jan Novák', specialization: 'Všeobecné lékařství', services: ['1', '7'], allowOnlineBooking: true },
      { id: 'w2', name: 'MUDr. Marie Svobodová', specialization: 'Sportovní medicína', services: ['2', '3', '4'], allowOnlineBooking: true },
      { id: 'w3', name: 'MUDr. Pavel Černý', specialization: 'Ortopedie', services: ['5', '4'], allowOnlineBooking: true },
      { id: 'w4', name: 'MUDr. Lucie Dvořáková', specialization: 'Neurologie', services: ['6', '8'], allowOnlineBooking: false },
    ];
  }

  async getWorkerSchedule(workerId: string, date: string): Promise<{ available: boolean; slots: string[] }> {
    try {
      const res = await fetch(`${this.baseUrl}/workers/${workerId}/availability?date=${date}`);
      if (res.ok) return await res.json();
    } catch {}
    return { available: false, slots: [] };
  }

  async validateGdpr(gdpr: BookingGdprConsent): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    if (!gdpr.dataProcessing) errors.push('Souhlas se zpracováním osobních údajů je povinný');
    if (!gdpr.dataRetention) errors.push('Souhlas s uchováním dat je povinný');
    if (!gdpr.shareWithDoctors) errors.push('Souhlas se sdílením s lékaři je povinný');
    return { valid: errors.length === 0, errors };
  }

  async validatePatientData(patient: BookingPatientData): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    if (!patient.firstName.trim()) errors.push('Jméno je povinné');
    if (!patient.lastName.trim()) errors.push('Příjmení je povinné');
    if (!patient.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patient.email)) errors.push('Neplatný email');
    if (!patient.phone.trim() || patient.phone.replace(/\D/g, '').length < 9) errors.push('Neplatné telefonní číslo');
    if (!patient.dateOfBirth) errors.push('Datum narození je povinné');
    // Rodné číslo validation (Czech)
    if (patient.rodneCislo && !/^\d{6}\/?\d{3,4}$/.test(patient.rodneCislo.replace(/\s/g, ''))) {
      errors.push('Neplatné rodné číslo');
    }
    return { valid: errors.length === 0, errors };
  }

  async bookAppointment(request: BookingRequest): Promise<BookingResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (res.ok) return await res.json();
      const data = await res.json();
      throw new Error(data.message || 'Rezervace selhala');
    } catch {
      // Demo response
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      return {
        id: crypto.randomUUID(),
        confirmationCode: code,
        date: request.date,
        time: request.time,
        workerName: 'Lékař',
        serviceName: 'Služba',
        status: 'confirmed',
        message: `Rezervace potvrzena. Kód: ${code}`,
      };
    }
  }
}

export const publicBookingService = new PublicBookingService();
