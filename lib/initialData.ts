export type TimelineColor = "blue" | "green" | "red" | "yellow";

export const TIMELINE_COLORS: TimelineColor[] = ["blue", "green", "red", "yellow"];

export interface TimelineRow {
  id: string;
  name: string;
  col: TimelineColor;
}

export interface TimelineEvent {
  id: string;
  r: string; // row id
  y: number; // start year
  y2?: number; // end year (optional): if > y the event spans a period
  t: string; // title
  n: string; // notes
  img?: string; // photo URL or data URL (base64)
  link?: string; // external reference link
  video?: string; // YouTube video URL
  rs?: string[]; // additional row ids beyond the primary r
}

export function getEventRowIds(event: TimelineEvent): string[] {
  const extras = Array.isArray(event.rs) ? event.rs : [];
  const ids = [event.r, ...extras].filter(
    (id): id is string => typeof id === "string" && id.length > 0
  );
  return Array.from(new Set(ids));
}

export interface TimelineData {
  rows: TimelineRow[];
  events: TimelineEvent[];
}

export function isTimelineColor(value: unknown): value is TimelineColor {
  return typeof value === "string" && TIMELINE_COLORS.includes(value as TimelineColor);
}

type LegacyEvent = TimelineEvent & { col?: unknown };

const MIN_VALID_YEAR = -10000;
const MAX_VALID_YEAR = 10000;

export function normalizeTimelineData(data: TimelineData): TimelineData {
  const legacyEvents = Array.isArray(data?.events) ? (data.events as LegacyEvent[]) : [];

  const events = legacyEvents
    .filter((event) => {
      if (typeof event !== "object" || event === null) return false;
      if (typeof event.r !== "string" || !event.r) return false;
      if (!Number.isFinite(event.y)) return false;
      if (event.y < MIN_VALID_YEAR || event.y > MAX_VALID_YEAR) return false;
      if (event.y2 !== undefined && event.y2 !== null) {
        if (!Number.isFinite(event.y2)) return false;
        if (event.y2 < MIN_VALID_YEAR || event.y2 > MAX_VALID_YEAR) return false;
      }
      if (typeof event.t !== "string") return false;
      return true;
    })
    .map((event) => {
      const copy: LegacyEvent = { ...event };
      delete copy.col;
      return copy;
    });

  const rows = (Array.isArray(data?.rows) ? data.rows : []).map((row, index) => {
    const legacyColor = legacyEvents.find(
      (event) => event.r === row.id && isTimelineColor(event.col)
    )?.col;

    return {
      ...row,
      col: isTimelineColor(row.col)
        ? row.col
        : isTimelineColor(legacyColor)
          ? legacyColor
          : TIMELINE_COLORS[index % TIMELINE_COLORS.length],
    };
  });

  return { rows, events };
}

export const INITIAL_DATA: TimelineData = {
  rows: [
    { id: "r-fr", name: "Francia", col: "blue" },
    { id: "r-de", name: "Germania / SRI", col: "red" },
    { id: "r-uk", name: "Inghilterra", col: "green" },
    { id: "r-es", name: "Spagna / Paesi Bassi", col: "yellow" },
  ],
  events: [
    {
      id: "e-1",
      r: "r-de",
      y: 1555,
      t: "Pace di Augusta",
      n: "Principio del 'Cuius regio, eius religio': i principi scelgono la religione del loro territorio.",
    },
    {
      id: "e-2",
      r: "r-fr",
      y: 1562,
      t: "Massacro di Vassy",
      n: "Attacco agli ugonotti guidato dal duca di Guisa. Inizio ufficiale delle guerre di religione francesi.",
    },
    {
      id: "e-3",
      r: "r-es",
      y: 1568,
      t: "Rivolta dei Paesi Bassi",
      n: "Inizio della guerra degli ottant'anni contro il dominio spagnolo di Filippo II.",
    },
    {
      id: "e-4",
      r: "r-fr",
      y: 1572,
      t: "San Bartolomeo",
      n: "Strage notturna di migliaia di ugonotti a Parigi in occasione delle nozze di Enrico di Navarra.",
    },
    {
      id: "e-5",
      r: "r-uk",
      y: 1588,
      t: "Invincibile Armata",
      n: "Filippo II di Spagna tenta di invadere l'Inghilterra elisabettiana ma la sua flotta viene distrutta.",
    },
    {
      id: "e-6",
      r: "r-fr",
      y: 1598,
      t: "Editto di Nantes",
      n: "Enrico IV concede agli ugonotti la libertà di coscienza e parziali diritti di culto e piazzeforti.",
    },
    {
      id: "e-7",
      r: "r-uk",
      y: 1605,
      t: "Congiura delle Polveri",
      n: "Complotto cattolico guidato da Guy Fawkes per far saltare il Parlamento inglese.",
    },
    {
      id: "e-8",
      r: "r-de",
      y: 1618,
      t: "Defenestrazione di Praga",
      n: "Rappresentanti imperiali gettati dal castello di Praga. Scintilla della Guerra dei Trent'anni.",
    },
    {
      id: "e-9",
      r: "r-de",
      y: 1648,
      t: "Pace di Vestfalia",
      n: "Fine della Guerra dei Trent'anni. Riconoscimento del calvinismo e nuovo equilibrio europeo.",
    },
  ],
};
