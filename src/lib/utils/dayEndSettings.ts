/**
 * Gün sonu ayarları: Açılış ve kapanış saatine göre "1 gün" aralığı.
 * Örn: 09:00 - 03:00 = bir gün (09:00'dan ertesi gün 03:00'a kadar).
 */

const STORAGE_KEY = "dayEndSettings";

export interface DayEndSettings {
  openingTime: string; // "HH:mm" örn. "09:00"
  closingTime: string; // "HH:mm" örn. "03:00"
}

const DEFAULT: DayEndSettings = {
  openingTime: "09:00",
  closingTime: "03:00",
};

function parseTimeToMinutes(str: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(str.trim());
  if (!match) return 0;
  const h = Math.min(23, Math.max(0, parseInt(match[1], 10)));
  const m = Math.min(59, Math.max(0, parseInt(match[2], 10)));
  return h * 60 + m;
}

/**
 * Ayarları localStorage'dan oku.
 */
export function getDayEndSettings(): DayEndSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw) as Partial<DayEndSettings>;
    return {
      openingTime: typeof parsed.openingTime === "string" ? parsed.openingTime : DEFAULT.openingTime,
      closingTime: typeof parsed.closingTime === "string" ? parsed.closingTime : DEFAULT.closingTime,
    };
  } catch {
    return { ...DEFAULT };
  }
}

/**
 * Ayarları kaydet.
 */
export function setDayEndSettings(settings: DayEndSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/**
 * Verilen tarihin içinde bulunduğu "iş günü" aralığını döndürür.
 * Örn: açılış 09:00, kapanış 03:00 ise;
 * - 10:00 bugün -> [bugün 09:00, yarın 03:00)
 * - 02:00 bugün -> [dün 09:00, bugün 03:00)
 */
export function getDayBoundariesForDate(
  forDate: Date,
  settings?: DayEndSettings | null
): { start: Date; end: Date } {
  const s = settings ?? getDayEndSettings();
  const openM = parseTimeToMinutes(s.openingTime);
  const closeM = parseTimeToMinutes(s.closingTime);

  const d = new Date(forDate);
  d.setHours(0, 0, 0, 0);

  const periodStart = new Date(d);
  periodStart.setHours(Math.floor(openM / 60), openM % 60, 0, 0);
  const periodEnd = new Date(d);
  periodEnd.setDate(periodEnd.getDate() + 1);
  periodEnd.setHours(Math.floor(closeM / 60), closeM % 60, 0, 0);

  if (closeM <= openM) {
    // Gün gece yarısını geçiyor (örn. 09:00 -> 03:00)
    if (forDate < periodStart) {
      periodStart.setDate(periodStart.getDate() - 1);
      periodEnd.setDate(periodEnd.getDate() - 1);
    } else if (forDate >= periodEnd) {
      periodStart.setDate(periodStart.getDate() + 1);
      periodEnd.setDate(periodEnd.getDate() + 1);
    }
  } else {
    // Aynı gün içinde (örn. 09:00 -> 18:00); kapanış saati dahil
    periodEnd.setDate(periodEnd.getDate() - 1);
    periodEnd.setHours(Math.floor(closeM / 60), closeM % 60, 59, 999);
    if (forDate < periodStart) {
      periodStart.setDate(periodStart.getDate() - 1);
      periodEnd.setDate(periodEnd.getDate() - 1);
    } else if (forDate > periodEnd) {
      periodStart.setDate(periodStart.getDate() + 1);
      periodEnd.setDate(periodEnd.getDate() + 1);
    }
  }

  return { start: periodStart, end: periodEnd };
}

/**
 * Şu anki "iş günü" aralığını döndürür (günlük istatistik için).
 */
export function getDayBoundariesNow(
  settings?: DayEndSettings | null
): { start: Date; end: Date } {
  return getDayBoundariesForDate(new Date(), settings);
}
