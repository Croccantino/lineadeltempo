"use client";

import React, { useState, useEffect, useRef } from "react";
import { TimelineRow, TimelineEvent, TimelineData } from "./api/eventi/route";

const STORAGE_KEY = "timeline-proporzionale-nextjs-v1";
const W = 140; // Larghezza chip evento
const LH = 54; // Altezza corsia
const PAD = 14;

const COLORS: Array<["blue" | "green" | "red" | "yellow", string]> = [
  ["blue", "Blu"],
  ["green", "Verde"],
  ["red", "Rosso"],
  ["yellow", "Giallo"],
];

export default function TimelinePage() {
  const [rows, setRows] = useState<TimelineRow[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [ppy, setPpy] = useState<number>(10);
  const [mounted, setMounted] = useState<boolean>(false);

  // Stato Modale
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);
  const [formRow, setFormRow] = useState("");
  const [formYear, setFormYear] = useState<number | string>("");
  const [formTitle, setFormTitle] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formColor, setFormColor] = useState<"blue" | "green" | "red" | "yellow">("blue");

  const dialogRef = useRef<HTMLDialogElement>(null);

  // Inizializzazione: Caricamento da localStorage o API Next.js
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.rows && parsed.events) {
          setRows(parsed.rows);
          setEvents(parsed.events);
          if (parsed.ppy) setPpy(parsed.ppy);
          return;
        }
      } catch (err) {
        console.error("Errore nel recupero da localStorage", err);
      }
    }

    // Se non ci sono dati in locale, carichiamo i dati iniziali dall'API Route di Next.js!
    fetch("/api/eventi")
      .then((res) => res.json())
      .then((data: TimelineData) => {
        setRows(data.rows);
        setEvents(data.events);
      })
      .catch((err) => console.error("Errore fetch API:", err));
  }, []);

  // Salvataggio automatico in localStorage
  useEffect(() => {
    if (!mounted || rows.length === 0) return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ rows, events, ppy })
    );
  }, [rows, events, ppy, mounted]);

  // Gestione apertura e chiusura del dialog nativo
  useEffect(() => {
    if (modalOpen) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [modalOpen]);

  // Calcolo intervallo temporale
  const years = events.map((e) => e.y).filter(Number.isFinite);
  const minYear = years.length ? Math.min(...years) : 1550;
  let maxYear = years.length ? Math.max(...years) : 1650;
  if (minYear === maxYear) maxYear = minYear + 1;

  // Calcolo passo ideale per i tick
  const step = (p: number) => {
    for (const s of [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]) {
      if (s * p >= 64) return s;
    }
    return 1000;
  };

  const st = step(ppy);
  const width = (maxYear - minYear) * ppy + PAD + W + 24;
  const X = (y: number) => (y - minYear) * ppy + PAD;

  // Auto-adatta lo zoom alla finestra
  const handleFit = () => {
    const newPpy = Math.max(4, Math.min(60, 640 / (maxYear - minYear)));
    setPpy(Math.round(newPpy * 10) / 10);
  };

  // Creazione / Modifica evento
  const openModalForNew = (defaultRow?: string, defaultYear?: number) => {
    setEditingEvent(null);
    setFormRow(defaultRow || rows[0]?.id || "");
    setFormYear(defaultYear ?? "");
    setFormTitle("");
    setFormNotes("");
    setFormColor("blue");
    setModalOpen(true);
  };

  const openModalForEdit = (ev: TimelineEvent) => {
    setEditingEvent(ev);
    setFormRow(ev.r);
    setFormYear(ev.y);
    setFormTitle(ev.t);
    setFormNotes(ev.n || "");
    setFormColor(ev.col);
    setModalOpen(true);
  };

  const handleSaveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    const yNum = parseInt(String(formYear), 10);
    if (isNaN(yNum) || !formTitle.trim()) return;

    if (editingEvent) {
      // Aggiorna
      setEvents((prev) =>
        prev.map((item) =>
          item.id === editingEvent.id
            ? { ...item, r: formRow, y: yNum, t: formTitle.trim(), n: formNotes.trim(), col: formColor }
            : item
        )
      );
    } else {
      // Crea nuovo
      const newEv: TimelineEvent = {
        id: "e-" + Math.random().toString(36).slice(2, 8),
        r: formRow,
        y: yNum,
        t: formTitle.trim(),
        n: formNotes.trim(),
        col: formColor,
      };
      setEvents((prev) => [...prev, newEv]);
    }
    setModalOpen(false);
  };

  const handleDeleteEvent = () => {
    if (!editingEvent) return;
    setEvents((prev) => prev.filter((item) => item.id !== editingEvent.id));
    setModalOpen(false);
  };

  const handleAddCountry = () => {
    const name = window.prompt("Nome del paese / categoria:");
    if (name?.trim()) {
      setRows((prev) => [...prev, { id: "r-" + Math.random().toString(36).slice(2, 8), name: name.trim() }]);
    }
  };

  const handleEditCountry = (r: TimelineRow) => {
    const newName = window.prompt("Modifica nome del paese:", r.name);
    if (newName && newName.trim()) {
      setRows((prev) => prev.map((row) => (row.id === r.id ? { ...row, name: newName.trim() } : row)));
    }
  };

  // Generazione tacche asse del tempo
  const ticks: Array<{ year: number; x: number }> = [];
  const startTick = Math.ceil(minYear / st) * st;
  for (let t = startTick; t <= maxYear; t += st) {
    ticks.push({ year: t, x: X(t) });
  }

  return (
    <div>
      <div id="app">
        <header>
          <h1>
            Guerre di religione in Europa
            <span className="badge-next">Next.js App Router</span>
          </h1>
          <div className="bar">
            <button onClick={() => openModalForNew()}>+ Evento</button>
            <button onClick={() => setPpy((p) => Math.max(1, p / 1.4))} aria-label="Riduci scala">
              −
            </button>
            <button onClick={() => setPpy((p) => Math.min(200, p * 1.4))} aria-label="Ingrandisci scala">
              +
            </button>
            <button onClick={handleFit}>Adatta</button>
            <button onClick={handleAddCountry}>+ Paese</button>
          </div>
        </header>

        <p className="hint">
          ⚡ <strong>Next.js + React</strong>: Gli eventi si posizionano proporzionalmente in base all&apos;anno. Clicca su uno spazio vuoto di una riga per aggiungere un evento in quel punto preciso.
        </p>

        <div className="wrap">
          <div className="tl" id="tl">
            {/* Riga dell'Asse del Tempo */}
            <div className="line">
              <div className="lab" />
              <div className="trk axis" style={{ width: `${width}px` }}>
                {ticks.map((t) => (
                  <div key={t.year} className="tick" style={{ left: `${t.x}px` }}>
                    <i>{t.year}</i>
                  </div>
                ))}
              </div>
            </div>

            {/* Righe dei Paesi */}
            {rows.map((row) => {
              const rowEvents = events
                .filter((e) => e.r === row.id && Number.isFinite(e.y))
                .sort((a, b) => a.y - b.y);

              // Algoritmo corsie (Lanes) per evitare sovrapposizioni visive
              const lanes: number[] = [];
              const eventPlacements = rowEvents.map((e) => {
                const x = X(e.y);
                let l = lanes.findIndex((end) => end <= x);
                if (l < 0) {
                  l = lanes.length;
                  lanes.push(0);
                }
                lanes[l] = x + W + 6;
                return { event: e, x, lane: l };
              });

              const rowHeight = Math.max(1, lanes.length) * LH + 10;

              return (
                <div key={row.id} className="line" style={{ height: `${rowHeight}px` }}>
                  <div className="lab">
                    <button
                      className="lab-btn"
                      title="Clicca per rinominare"
                      onClick={() => handleEditCountry(row)}
                    >
                      {row.name}
                    </button>
                  </div>
                  <div
                    className="trk"
                    style={{ width: `${width}px` }}
                    onClick={(e) => {
                      // Se l'utente clicca direttamente sul tracciato vuoto (non sul chip)
                      if ((e.target as HTMLElement).classList.contains("trk")) {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const clickedYear = Math.round(minYear + (clickX - PAD) / ppy);
                        openModalForNew(row.id, clickedYear);
                      }
                    }}
                  >
                    {/* Tacche verticali tratteggiate */}
                    {ticks.map((t) => (
                      <div key={t.year} className="tick" style={{ left: `${t.x}px` }} />
                    ))}

                    {/* Chip degli Eventi */}
                    {eventPlacements.map(({ event: ev, x, lane }) => (
                      <button
                        key={ev.id}
                        className={`chip c-${ev.col}`}
                        style={{ left: `${x}px`, top: `${6 + lane * LH}px` }}
                        onClick={(e) => {
                          e.stopPropagation();
                          openModalForEdit(ev);
                        }}
                        title={ev.n ? `Note: ${ev.n}` : ev.t}
                      >
                        <b>{ev.y}</b>
                        <span>{ev.t}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dialog Modale */}
      <dialog ref={dialogRef} id="dlg" onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSaveEvent} id="f">
          <h2 style={{ margin: 0, font: "600 22px var(--font-inter), 'Inter', sans-serif" }}>
            {editingEvent ? "Modifica Evento" : "Nuovo Evento"}
          </h2>

          <label htmlFor="p">Paese</label>
          <select id="p" value={formRow} onChange={(e) => setFormRow(e.target.value)} required>
            {rows.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          <label htmlFor="y">Anno</label>
          <input
            id="y"
            type="number"
            inputMode="numeric"
            required
            placeholder="Es. 1598"
            value={formYear}
            onChange={(e) => setFormYear(e.target.value)}
          />

          <label htmlFor="t">Nome Evento</label>
          <input
            id="t"
            type="text"
            required
            placeholder="Es. Editto di Nantes"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
          />

          <label htmlFor="n">Appunti / Note storiche</label>
          <textarea
            id="n"
            placeholder="Cause, protagonisti, conseguenze..."
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
          />

          <label>Colore evidenziatore</label>
          <div className="swatches">
            {COLORS.map(([colorKey, colorLabel]) => (
              <label key={colorKey}>
                <input
                  type="radio"
                  name="col"
                  value={colorKey}
                  checked={formColor === colorKey}
                  onChange={() => setFormColor(colorKey)}
                />
                {colorLabel}
              </label>
            ))}
          </div>

          <div className="row">
            <button type="submit" className="grow">
              Salva
            </button>
            {editingEvent && (
              <button type="button" className="danger" onClick={handleDeleteEvent}>
                Elimina
              </button>
            )}
            <button type="button" onClick={() => setModalOpen(false)}>
              Chiudi
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
