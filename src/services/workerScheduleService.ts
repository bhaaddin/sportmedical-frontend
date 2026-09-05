// Worker Schedule Service
// Workers define their work schedule → system generates available slots for patients

export interface DaySchedule {
  dayOfWeek: number; // 0=Sunday, 6=Saturday
  isWorking: boolean;
  startTime: string; // "08:00"
  endTime: string;   // "18:00"
  breakStart?: string; // "12:00"
  breakEnd?: string;   // "13:00"
  slotDuration: number; // minutes per slot (15, 30, 45, 60)
}

export interface SpecialDay {
  date: string; // "2026-09-15"
  isWorking: boolean;
  startTime?: string;
  endTime?: string;
  reason?: string;
}

export interface WorkerSchedule {
  workerId: string;
  workerName: string;
  workerRole: string;
  services: string[]; // services this worker provides
  weeklySchedule: DaySchedule[];
  specialDays: SpecialDay[];
  maxPatientsPerDay: number;
  allowOnlineBooking: boolean;
  bufferMinutes: number; // minutes between appointments
  updatedAt: string;
}

export interface TimeSlot {
  time: string;
  endTime: string;
  available: boolean;
  workerId: string;
  serviceId?: string;
  reason?: string; // why unavailable
}

// Czech day names
export const DAY_NAMES = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];
export const DAY_NAMES_SHORT = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];

// Default schedule for a worker
export const DEFAULT_SCHEDULE: DaySchedule[] = [
  { dayOfWeek: 0, isWorking: false, startTime: '09:00', endTime: '13:00', slotDuration: 30 },
  { dayOfWeek: 1, isWorking: true, startTime: '08:00', endTime: '18:00', breakStart: '12:00', breakEnd: '13:00', slotDuration: 30 },
  { dayOfWeek: 2, isWorking: true, startTime: '08:00', endTime: '18:00', breakStart: '12:00', breakEnd: '13:00', slotDuration: 30 },
  { dayOfWeek: 3, isWorking: true, startTime: '08:00', endTime: '18:00', breakStart: '12:00', breakEnd: '13:00', slotDuration: 30 },
  { dayOfWeek: 4, isWorking: true, startTime: '08:00', endTime: '18:00', breakStart: '12:00', breakEnd: '13:00', slotDuration: 30 },
  { dayOfWeek: 5, isWorking: true, startTime: '08:00', endTime: '16:00', breakStart: '12:00', breakEnd: '13:00', slotDuration: 30 },
  { dayOfWeek: 6, isWorking: false, startTime: '09:00', endTime: '13:00', slotDuration: 30 },
];

// Generate time slots for a given date based on worker schedule
export function generateTimeSlots(schedule: WorkerSchedule, dateStr: string): TimeSlot[] {
  const date = new Date(dateStr);
  const dayOfWeek = date.getDay();
  const now = new Date();
  
  // Check special day first
  const specialDay = schedule.specialDays.find(sd => sd.date === dateStr);
  
  // Check if date is in the past
  const isToday = date.toDateString() === now.toDateString();
  
  let daySchedule: DaySchedule | undefined;
  
  if (specialDay) {
    if (!specialDay.isWorking) return [];
    // Use special day hours
    daySchedule = {
      dayOfWeek,
      isWorking: true,
      startTime: specialDay.startTime || '08:00',
      endTime: specialDay.endTime || '18:00',
      slotDuration: schedule.weeklySchedule[dayOfWeek]?.slotDuration || 30,
    };
  } else {
    daySchedule = schedule.weeklySchedule[dayOfWeek];
    if (!daySchedule || !daySchedule.isWorking) return [];
  }
  
  const slots: TimeSlot[] = [];
  const slotDuration = daySchedule.slotDuration || 30;
  const buffer = schedule.bufferMinutes || 0;
  
  let [startH, startM] = daySchedule.startTime.split(':').map(Number);
  const [endH, endM] = daySchedule.endTime.split(':').map(Number);
  const [breakStartH, breakStartM] = (daySchedule.breakStart || '99:99').split(':').map(Number);
  const [breakEndH, breakEndM] = (daySchedule.breakEnd || '99:99').split(':').map(Number);
  
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const breakStartMinutes = breakStartH * 60 + breakStartM;
  const breakEndMinutes = breakEndH * 60 + breakEndM;
  
  for (let mins = startMinutes; mins + slotDuration <= endMinutes; mins += slotDuration + buffer) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const endMins = mins + slotDuration;
    const eh = Math.floor(endMins / 60);
    const em = endMins % 60;
    
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const endTimeStr = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
    
    // Check break time
    if (mins >= breakStartMinutes && mins < breakEndMinutes) continue;
    
    // Check if slot is in the past
    const slotDate = new Date(dateStr + 'T' + timeStr);
    if (isToday && slotDate <= now) continue;
    
    slots.push({
      time: timeStr,
      endTime: endTimeStr,
      available: true,
      workerId: schedule.workerId,
    });
  }
  
  return slots;
}

// Generate available dates for the next N days based on worker schedule
export function getAvailableDates(schedule: WorkerSchedule, daysAhead: number = 14): string[] {
  const dates: string[] = [];
  const today = new Date();
  
  for (let i = 1; i <= daysAhead; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    
    const slots = generateTimeSlots(schedule, dateStr);
    if (slots.length > 0) {
      dates.push(dateStr);
    }
  }
  
  return dates;
}

// Check if a specific slot is still available (for real-time validation)
export function isSlotAvailable(schedule: WorkerSchedule, dateStr: string, time: string): boolean {
  const slots = generateTimeSlots(schedule, dateStr);
  return slots.some(s => s.time === time && s.available);
}
