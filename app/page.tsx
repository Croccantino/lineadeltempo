"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { INITIAL_DATA, TimelineRow, TimelineEvent } from "../lib/initialData";
import { subscribeToFirebase, isFirebaseActive } from "../lib/firebase";
import { sanitizeLink } from "../lib/media";
import { useResolvedImage } from "../lib/useResolvedImage";
import AuthBar from "./components/AuthBar";

const W = 140;
const LH = 54;
const PAD = 14;

export default function ClientTimelinePage() {
  const [rows, setRows] = useState<TimelineRow[]>(INITIAL_DATA.rows);
  const [events, setEvents] = useState<TimelineEvent[]>(INITIAL_DATA.events);
  const [ppy, setPpy] = useState<number>(10);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [firebaseConnected, setFirebaseConnected] = useState<boolean>(false);
  const selectedEvent = selectedEventId
    ? events.find((event) => event.id === selectedEventId) ?? null
    : null;
  const [rangeFrom, setRangeFrom] = useState<number | "">("");
  const [rangeTo, setRangeTo] = useState<number | "">("");
  const [photoZoom, setPhotoZoom] = useState(false);
  const infoDialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = infoDialogRef.current;
    if (!dialog) return;
    if (selectedEvent && !dialog.open) dialog.showModal();
    if (!selectedEvent && dialog.open) dialog.close();
  }, [selectedEvent]);

  useEffect(() => {
    setPhotoZoom(false);
  }, [selectedEvent]);

  useEffect(() => {
    setFirebaseConnected(isFirebaseActive());

    const unsubscribe = subscribeToFirebase((data) => {
      setRows(data.rows);
      setEvents(data.events);
      setFirebaseConnected(true);
    });

    return () => unsubscribe();
  }, []);

  // Un evento è un periodo se ha un anno finale maggiore di quello iniziale
  const endYear = (e: TimelineEvent) =>
    Number.isFinite(e.y2) && Number(e.y2) > e.y ? Number(e.y2) : e.y;

  // Anno min e max (dai dati completi, includendo la fine dei periodi)
  const years = events.flatMap((e) => [e.y, endYear(e)]).filter(Number.isFinite);
  const dataMin = years.length ? Math.min(...years) : 1550;
  const dataMax = years.length ? Math.max(...years) : 1650;

  // Intervallo scelto dall'utente (vuoto = tutti gli anni)
  const rawFrom = rangeFrom === "" ? dataMin : rangeFrom;
  const rawTo = rangeTo === "" ? dataMax : rangeTo;
  const minYear = Math.min(rawFrom, rawTo);
  let maxYear = Math.max(rawFrom, rawTo);
  if (minYear === maxYear) maxYear = minYear + 1;

  // Eventi visibili nell'intervallo scelto (un periodo è visibile se lo interseca)
  const visibleEvents = events.filter(
    (e) => Number.isFinite(e.y) && e.y <= maxYear && endYear(e) >= minYear
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

  const selectedRow = rows.find((r) => r.id === selectedEvent?.r);
  const selectedCountryName = selectedRow?.name || "";
  const selectedNoteColor = selectedRow?.col || "blue";
  const { src: selectedImg } = useResolvedImage(selectedEvent?.img);
  const selectedLink = selectedEvent ? sanitizeLink(selectedEvent.link || "") : "";

  return (
    <div id="app">
      <header>
        <div>
          <h1>Guerre di religione in Europa</h1>
          <div className="header-badges">
            <span className="badge-client">📖 Vista Client (Lettura)</span>
            {firebaseConnected ? (
              <span className="badge-firebase">🟢 Cloud Firebase Sincronizzato</span>
            ) : (
              <span className="badge-local">💾 Dati Locali</span>
            )}
          </div>
        </div>
      </header>

      <p className="hint">
        💡 <strong>Modalità Lettura</strong>: Clicca su un evento per visualizzare la scheda di approfondimento storico e gli appunti.
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
              const barWidth = Math.max(W, X(endYear(e)) - x);
              let l = lanes.findIndex((end) => end <= x);
              if (l < 0) {
                l = lanes.length;
                lanes.push(0);
              }
              lanes[l] = x + barWidth + 6;
              return { event: e, x, lane: l, barWidth };
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

                  {placements.map(({ event: ev, x, lane, barWidth }) => {
                    const end = endYear(ev);
                    return (
                      <button
                        key={ev.id}
                        className={`chip c-${row.col}`}
                        style={{ left: `${x}px`, top: `${6 + lane * LH}px`, width: `${barWidth}px` }}
                        onClick={() => setSelectedEventId(ev.id)}
                      >
                        <b>
                          {ev.y}
                          {end > ev.y ? `–${end}` : ""}
                        </b>
                        <span>{ev.t}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="actions">
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

          <Link href="/modifica" className="btn-edit-nav">
            ✏️ Modifica
          </Link>
        </div>
        <AuthBar />
      </div>

      {/* Scheda evento stile nota (modalità lettura) */}
      {selectedEvent && (
        <dialog
          ref={infoDialogRef}
          className="note-dialog"
          onClose={() => setSelectedEventId(null)}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedEventId(null);
          }}
        >
          <article className={`note c-${selectedNoteColor}`}>
            <span className="note-tape" aria-hidden="true" />

            <div className="note-head">
              <span className="note-year">
                {selectedEvent.y}
                {endYear(selectedEvent) > selectedEvent.y ? `–${endYear(selectedEvent)}` : ""}
              </span>
              <h2 className="note-title">{selectedEvent.t}</h2>
              <p className="note-country">Paese: {selectedCountryName}</p>
            </div>

            <div className="note-body">
              <p className="note-notes">
                {selectedEvent.n ? selectedEvent.n : "Nessun appunto registrato per questo evento."}
              </p>

              {selectedImg && (
                <button
                  type="button"
                  className={`note-photo${photoZoom ? " zoomed" : ""}`}
                  data-zoom={selectedImg.startsWith("data:") ? "1" : undefined}
                  aria-label={selectedImg.startsWith("data:") ? "Ingrandisci o riduci la foto" : "Apri la foto in una nuova scheda"}
                  onClick={() => {
                    if (selectedImg.startsWith("data:")) {
                      setPhotoZoom((value) => !value);
                    } else {
                      window.open(selectedImg, "_blank", "noopener,noreferrer");
                    }
                  }}
                >
                  <img
                    src={selectedImg}
                    alt={selectedEvent.t}
                    onError={(e) => {
                      const wrap = e.currentTarget.closest(".note-photo");
                      if (wrap instanceof HTMLElement) wrap.style.display = "none";
                    }}
                  />
                </button>
              )}

              {selectedLink && (
                <a
                  className="note-link"
                  href={selectedLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Apri link ↗
                </a>
              )}
            </div>

            <footer className="note-foot">
              <button type="button" onClick={() => setSelectedEventId(null)}>
                Chiudi
              </button>
            </footer>
          </article>
        </dialog>
      )}
    </div>
  );
}
