export interface TimelineRow {
  id: string;
  name: string;
}

export interface TimelineEvent {
  id: string;
  r: string; // row id
  y: number; // start year
  y2?: number; // end year (optional): if > y the event spans a period
  t: string; // title
  n: string; // notes
  col: "blue" | "green" | "red" | "yellow";
  img?: string; // photo URL or data URL (base64)
  link?: string; // external reference link
}

export interface TimelineData {
  rows: TimelineRow[];
  events: TimelineEvent[];
}

export const INITIAL_DATA: TimelineData = {
  rows: [
    { id: "r-fr", name: "Francia" },
    { id: "r-de", name: "Germania / SRI" },
    { id: "r-uk", name: "Inghilterra" },
    { id: "r-es", name: "Spagna / Paesi Bassi" },
  ],
  events: [
    {
      id: "e-1",
      r: "r-de",
      y: 1555,
      t: "Pace di Augusta",
      n: "Principio del 'Cuius regio, eius religio': i principi scelgono la religione del loro territorio.",
      col: "blue",
    },
    {
      id: "e-2",
      r: "r-fr",
      y: 1562,
      t: "Massacro di Vassy",
      n: "Attacco agli ugonotti guidato dal duca di Guisa. Inizio ufficiale delle guerre di religione francesi.",
      col: "red",
    },
    {
      id: "e-3",
      r: "r-es",
      y: 1568,
      t: "Rivolta dei Paesi Bassi",
      n: "Inizio della guerra degli ottant'anni contro il dominio spagnolo di Filippo II.",
      col: "yellow",
    },
    {
      id: "e-4",
      r: "r-fr",
      y: 1572,
      t: "San Bartolomeo",
      n: "Strage notturna di migliaia di ugonotti a Parigi in occasione delle nozze di Enrico di Navarra.",
      col: "red",
    },
    {
      id: "e-5",
      r: "r-uk",
      y: 1588,
      t: "Invincibile Armata",
      n: "Filippo II di Spagna tenta di invadere l'Inghilterra elisabettiana ma la sua flotta viene distrutta.",
      col: "green",
    },
    {
      id: "e-6",
      r: "r-fr",
      y: 1598,
      t: "Editto di Nantes",
      n: "Enrico IV concede agli ugonotti la libertà di coscienza e parziali diritti di culto e piazzeforti.",
      col: "blue",
    },
    {
      id: "e-7",
      r: "r-uk",
      y: 1605,
      t: "Congiura delle Polveri",
      n: "Complotto cattolico guidato da Guy Fawkes per far saltare il Parlamento inglese.",
      col: "yellow",
    },
    {
      id: "e-8",
      r: "r-de",
      y: 1618,
      t: "Defenestrazione di Praga",
      n: "Rappresentanti imperiali gettati dal castello di Praga. Scintilla della Guerra dei Trent'anni.",
      col: "red",
    },
    {
      id: "e-9",
      r: "r-de",
      y: 1648,
      t: "Pace di Vestfalia",
      n: "Fine della Guerra dei Trent'anni. Riconoscimento del calvinismo e nuovo equilibrio europeo.",
      col: "green",
    },
  ],
};
