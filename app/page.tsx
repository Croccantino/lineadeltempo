"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { TimelineRow, TimelineEvent, TimelineData } from "./api/eventi/route";
import { subscribeToFirebase, isFirebaseActive } from "../lib/firebase";

const STORAGE_KEY = "timeline-proporzionale-nextjs-v1";
const W = 140;
const LH = 54;
const PAD = 14;

export default function ClientTimelinePage() {
  const [rows, setRows] = useState<TimelineRow[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [ppy, setPpy] = useState<number>(10);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [firebaseConnected, setFirebaseConnected] = useState<boolean>(false);
  const [rangeFrom, setRangeFrom] = useState<number | "">("");
  const [rangeTo, setRangeTo] = useState<number | "">("");

  // Inizializzazione: ascolto Realtime Firebase o fallback localStorage / API
  useEffect(() => {
    setFirebaseConnected(isFirebaseActive());

    // 1. Iscrizione Realtime a Firebase
    const unsubscribe = subscribeToFirebase((data) => {
      setRows(data.rows);
      setEvents(data.events);
      setFirebaseConnected(true);
    });

    // 2. Se Firebase non ha ancora inviato dati, carica da localStorage o API
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.rows && parsed.events) {
          setRows(parsed.rows);
          setEvents(parsed.events);
          if (parsed.ppy) setPpy(parsed.ppy);
        }
      } catch (e) {}
    } else {
      fetch("/api/eventi")
        .then((res) => res.json())
        .then((data: TimelineData) => {
          setRows(data.rows);
          setEvents(data.events);
        })
        .catch(console.error);
    }

    return () => unsubscribe();
  }, []);

  // Anno min e max (dai dati completi)
  const years = events.map((e) => e.y).filter(Number.isFinite);
  const dataMin = years.length ? Math.min(...years) : 1550;
  const dataMax = years.length ? Math.max(...years) : 1650;

  // Intervallo scelto dall'utente (vuoto = tutti gli anni)
  const rawFrom = rangeFrom === "" ? dataMin : rangeFrom;
  const rawTo = rangeTo === "" ? dataMax : rangeTo;
  const minYear = Math.min(rawFrom, rawTo);
  let maxYear = Math.max(rawFrom, rawTo);
  if (minYear === maxYear) maxYear = minYear + 1;

  // Eventi visibili nell'intervallo scelto
  const visibleEvents = events.filter(
    (e) => Number.isFinite(e.y) && e.y >= minYear && e.y <= maxYear
  );

  const step = (p: number) => {
    for (const s of [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]) {
      if (s * p >= 64) return s;
    }
    return 1000;
  };

  const st = step(ppy);
  const width = (maxYear - minYear) * ppy + PAD + W + 24;
  const X = (y: number) => (y - minYear) * ppy + PAD;

  const handleFit = () => {
    const newPpy = Math.max(4, Math.min(60, 640 / (maxYear - minYear)));
    setPpy(Math.round(newPpy * 10) / 10);
  };

  const ticks: Array<{ year: number; x: number }> = [];
  const startTick = Math.ceil(minYear / st) * st;
  for (let t = startTick; t <= maxYear; t += st) {
    ticks.push({ year: t, x: X(t) });
  }

  const selectedCountryName = rows.find((r) => r.id === selectedEvent?.r)?.name || "";

  return (
    <div id="app">
      <header>
        <div>
          <h1>Guerre di religione in Europa</h1>
          <div style={{ display: "flex", gap: "8px", marginTop: "4px", alignItems: "center" }}>
            <span className="badge-client">📖 Vista Client (Lettura)</span>
            {firebaseConnected ? (
              <span className="badge-firebase">🟢 Cloud Firebase Sincronizzato</span>
            ) : (
              <span className="badge-local">💾 Dati Locali</span>
            )}
          </div>
        </div>

        <div className="bar">
          <button onClick={() => setPpy((p) => Math.max(1, p / 1.4))} aria-label="Riduci scala">
            −
          </button>
          <button onClick={() => setPpy((p) => Math.min(200, p * 1.4))} aria-label="Ingrandisci scala">
            +
          </button>
          <button onClick={handleFit}>Adatta</button>

          <div className="range-group" title="Mostra solo gli eventi compresi tra questi due anni">
            <span className="range-label">Anni</span>
            <input
              type="number"
              inputMode="numeric"
              aria-label="Anno iniziale"
              placeholder={String(dataMin)}
              value={rangeFrom}
              onChange={(e) => setRangeFrom(e.target.value === "" ? "" : Number(e.target.value))}
            />
            <span className="range-sep">–</span>
            <input
              type="number"
              inputMode="numeric"
              aria-label="Anno finale"
              placeholder={String(dataMax)}
              value={rangeTo}
              onChange={(e) => setRangeTo(e.target.value === "" ? "" : Number(e.target.value))}
            />
            <button
              type="button"
              onClick={() => {
                setRangeFrom("");
                setRangeTo("");
              }}
            >
              Tutti
            </button>
          </div>

          {/* PULSANTE MODIFICA NELLA NAVBAR */}
          <Link href="/modifica" className="btn-edit-nav">
            ✏️ Modifica
          </Link>
        </div>
      </header>

      <p className="hint">
        💡 <strong>Modalità Lettura</strong>: Clicca su un evento per visualizzare la scheda di approfondimento storico e gli appunti. Usa il pulsante <strong>Modifica</strong> per gestire gli eventi.
      </p>

      <div className="wrap">
        <div className="tl" id="tl">
          {/* Asse del tempo */}
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
            const rowEvents = visibleEvents
              .filter((e) => e.r === row.id && Number.isFinite(e.y))
              .sort((a, b) => a.y - b.y);

            const lanes: number[] = [];
            const placements = rowEvents.map((e) => {
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
                  <span className="lab-title">{row.name}</span>
                </div>
                <div className="trk" style={{ width: `${width}px` }}>
                  {ticks.map((t) => (
                    <div key={t.year} className="tick" style={{ left: `${t.x}px` }} />
                  ))}

                  {placements.map(({ event: ev, x, lane }) => (
                    <button
                      key={ev.id}
                      className={`chip c-${ev.col}`}
                      style={{ left: `${x}px`, top: `${6 + lane * LH}px` }}
                      onClick={() => setSelectedEvent(ev)}
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

      {/* Scheda Informativa Evento (Modalità Lettura) */}
      {selectedEvent && (
        <dialog
          open
          className="info-dialog"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedEvent(null);
          }}
        >
          <div className="dialog-content">
            <div className="dialog-header">
              <span className={`event-badge c-${selectedEvent.col}`}>{selectedEvent.y}</span>
              <h2 style={{ margin: "6px 0 2px", fontSize: "20px", fontWeight: "700" }}>{selectedEvent.t}</h2>
              <p style={{ color: "var(--muted)", margin: 0, fontSize: "14px" }}>Paese: {selectedCountryName}</p>
            </div>

            <div className="dialog-body">
              <label style={{ fontWeight: "600", color: "var(--ink)" }}>Appunti e note storiche:</label>
              <div className="notes-box">
                {selectedEvent.n ? selectedEvent.n : "Nessun appunto registrato per questo evento."}
              </div>
            </div>

            <div className="dialog-footer">
              <Link href={`/modifica?event=${selectedEvent.id}`} className="btn-secondary" style={{ marginRight: "auto" }}>
                ✏️ Modifica questo evento
              </Link>
              <button type="button" onClick={() => setSelectedEvent(null)}>
                Chiudi
              </button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}
