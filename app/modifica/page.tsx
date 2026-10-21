"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { TimelineRow, TimelineEvent, TimelineData } from "../api/eventi/route";
import {
  syncToFirebase,
  subscribeToFirebase,
  isFirebaseActive,
  getFirebaseConfig,
} from "../../lib/firebase";

const STORAGE_KEY = "timeline-proporzionale-nextjs-v1";
const W = 140;
const LH = 54;
const PAD = 14;

const COLORS: Array<["blue" | "green" | "red" | "yellow", string]> = [
  ["blue", "Blu"],
  ["green", "Verde"],
  ["red", "Rosso"],
  ["yellow", "Giallo"],
];

export default function EditTimelinePage() {
  const [rows, setRows] = useState<TimelineRow[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [ppy, setPpy] = useState<number>(10);
  const [firebaseConnected, setFirebaseConnected] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string>("");

  // Stato Modale Evento
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);
  const [formRow, setFormRow] = useState("");
  const [formYear, setFormYear] = useState<number | string>("");
  const [formTitle, setFormTitle] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formColor, setFormColor] = useState<"blue" | "green" | "red" | "yellow">("blue");

  // Stato Modale Configurazione Firebase
  const [configOpen, setConfigOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [projectId, setProjectId] = useState("");
  const [authDomain, setAuthDomain] = useState("");
  const [appId, setAppId] = useState("");

  const dialogRef = useRef<HTMLDialogElement>(null);

  // Inizializzazione
  useEffect(() => {
    const active = isFirebaseActive();
    setFirebaseConnected(active);

    const currentConf = getFirebaseConfig();
    setApiKey(currentConf.apiKey || "");
    setProjectId(currentConf.projectId || "");
    setAuthDomain(currentConf.authDomain || "");
    setAppId(currentConf.appId || "");

    const unsubscribe = subscribeToFirebase((data) => {
      setRows(data.rows);
      setEvents(data.events);
      setFirebaseConnected(true);
    });

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

  // Salvataggio sincronizzato
  const persistChanges = async (newRows: TimelineRow[], newEvents: TimelineEvent[]) => {
    setRows(newRows);
    setEvents(newEvents);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ rows: newRows, events: newEvents, ppy }));

    setSaveStatus("Salvataggio in corso...");
    const synced = await syncToFirebase(newRows, newEvents);
    if (synced) {
      setSaveStatus("✅ Sincronizzato su Firebase Cloud");
    } else {
      setSaveStatus("💾 Salvato localmente");
    }
    setTimeout(() => setSaveStatus(""), 3500);
  };

  useEffect(() => {
    if (modalOpen) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [modalOpen]);

  // Calcolo intervalli
  const years = events.map((e) => e.y).filter(Number.isFinite);
  const minYear = years.length ? Math.min(...years) : 1550;
  let maxYear = years.length ? Math.max(...years) : 1650;
  if (minYear === maxYear) maxYear = minYear + 1;

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

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    const yNum = parseInt(String(formYear), 10);
    if (isNaN(yNum) || !formTitle.trim()) return;

    let updated: TimelineEvent[];
    if (editingEvent) {
      updated = events.map((item) =>
        item.id === editingEvent.id
          ? { ...item, r: formRow, y: yNum, t: formTitle.trim(), n: formNotes.trim(), col: formColor }
          : item
      );
    } else {
      const newEv: TimelineEvent = {
        id: "e-" + Math.random().toString(36).slice(2, 8),
        r: formRow,
        y: yNum,
        t: formTitle.trim(),
        n: formNotes.trim(),
        col: formColor,
      };
      updated = [...events, newEv];
    }
    await persistChanges(rows, updated);
    setModalOpen(false);
  };

  const handleDeleteEvent = async () => {
    if (!editingEvent) return;
    const updated = events.filter((item) => item.id !== editingEvent.id);
    await persistChanges(rows, updated);
    setModalOpen(false);
  };

  const handleAddCountry = async () => {
    const name = window.prompt("Nome del paese / categoria:");
    if (name?.trim()) {
      const updatedRows = [...rows, { id: "r-" + Math.random().toString(36).slice(2, 8), name: name.trim() }];
      await persistChanges(updatedRows, events);
    }
  };

  const handleEditCountry = async (r: TimelineRow) => {
    const action = window.prompt(
      `Modifica "${r.name}".\nInserisci il nuovo nome oppure lascia vuoto e premi OK per eliminare il paese:`,
      r.name
    );
    if (action === null) return;
    if (action.trim() === "") {
      if (window.confirm(`Sei sicuro di voler eliminare il paese "${r.name}" e tutti i suoi eventi?`)) {
        const updatedRows = rows.filter((row) => row.id !== r.id);
        const updatedEvents = events.filter((e) => e.r !== r.id);
        await persistChanges(updatedRows, updatedEvents);
      }
    } else {
      const updatedRows = rows.map((row) => (row.id === r.id ? { ...row, name: action.trim() } : row));
      await persistChanges(updatedRows, events);
    }
  };

  const handleSaveFirebaseConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || !projectId.trim()) {
      alert("Inserisci almeno API Key e Project ID di Firebase.");
      return;
    }
    const conf = {
      apiKey: apiKey.trim(),
      projectId: projectId.trim(),
      authDomain: authDomain.trim(),
      appId: appId.trim(),
    };
    localStorage.setItem("firebase_custom_config", JSON.stringify(conf));
    setConfigOpen(false);
    window.location.reload();
  };

  const ticks: Array<{ year: number; x: number }> = [];
  const startTick = Math.ceil(minYear / st) * st;
  for (let t = startTick; t <= maxYear; t += st) {
    ticks.push({ year: t, x: X(t) });
  }

  return (
    <div id="app">
      <header>
        <div>
          <h1>Gestione Linea del Tempo</h1>
          <div style={{ display: "flex", gap: "8px", marginTop: "4px", alignItems: "center" }}>
            <span className="badge-edit">✏️ Modalità Modifica</span>
            {saveStatus && <span className="save-status">{saveStatus}</span>}
          </div>
        </div>

        <div className="bar">
          <Link href="/" className="btn-back-nav">
            ← Torna alla Vista Client
          </Link>
          <button onClick={() => openModalForNew()}>+ Evento</button>
          <button onClick={handleAddCountry}>+ Paese</button>
          <button onClick={() => setPpy((p) => Math.max(1, p / 1.4))} aria-label="Riduci scala">−</button>
          <button onClick={() => setPpy((p) => Math.min(200, p * 1.4))} aria-label="Ingrandisci scala">+</button>
          <button onClick={handleFit}>Adatta</button>
          <button onClick={() => setConfigOpen(true)} className="btn-cfg">
            ⚙️ Database Firebase
          </button>
        </div>
      </header>

      {/* Banner informativo Firebase */}
      <div className="firebase-banner">
        {firebaseConnected ? (
          <span>🟢 <strong>Firebase Database Connesso:</strong> Le modifiche che salvi qui si sincronizzano all&apos;istante per tutti i visitatori.</span>
        ) : (
          <span>
            🟡 <strong>Database Firebase non ancora configurato:</strong> Le modifiche vengono salvate nella memoria locale del tuo browser.{" "}
            <button className="link-button" onClick={() => setConfigOpen(true)}>
              Clicca qui per collegare il tuo progetto Firebase
            </button>
          </span>
        )}
      </div>

      <p className="hint">
        💡 <strong>Istruzioni Modifica</strong>: Clicca su uno spazio vuoto di una riga per inserire un evento in quel punto esatto. Clicca su un evento esistente per modificarlo o eliminarlo. Clicca sul nome di un paese per rinominarlo o cancellarlo.
      </p>

      <div className="wrap">
        <div className="tl" id="tl">
          {/* Asse del Tempo */}
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
                  <button
                    className="lab-btn"
                    title="Clicca per rinominare o eliminare"
                    onClick={() => handleEditCountry(row)}
                  >
                    {row.name} ✏️
                  </button>
                </div>
                <div
                  className="trk"
                  style={{ width: `${width}px` }}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).classList.contains("trk")) {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      const clickX = e.clientX - rect.left;
                      const clickedYear = Math.round(minYear + (clickX - PAD) / ppy);
                      openModalForNew(row.id, clickedYear);
                    }
                  }}
                >
                  {ticks.map((t) => (
                    <div key={t.year} className="tick" style={{ left: `${t.x}px` }} />
                  ))}

                  {placements.map(({ event: ev, x, lane }) => (
                    <button
                      key={ev.id}
                      className={`chip c-${ev.col}`}
                      style={{ left: `${x}px`, top: `${6 + lane * LH}px` }}
                      onClick={(e) => {
                        e.stopPropagation();
                        openModalForEdit(ev);
                      }}
                      title="Clicca per modificare o eliminare"
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

      {/* Dialog Modale Evento */}
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
              Salva su Cloud
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

      {/* Dialog Configurazione Firebase */}
      {configOpen && (
        <dialog open className="info-dialog">
          <form onSubmit={handleSaveFirebaseConfig} className="dialog-content">
            <h2 style={{ margin: "0 0 8px", fontSize: "20px" }}>Configurazione Database Firebase</h2>
            <p style={{ fontSize: "13px", color: "var(--muted)", margin: "0 0 12px" }}>
              Incolla le chiavi del tuo progetto Firebase (disponibili nella console di Firebase in <em>Project Settings</em> → <em>General</em> → <em>Your apps</em>):
            </p>

            <label>Firebase API Key</label>
            <input
              type="text"
              required
              placeholder="AIzaSy..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />

            <label>Project ID</label>
            <input
              type="text"
              required
              placeholder="il-tuo-progetto"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            />

            <label>Auth Domain (opzionale)</label>
            <input
              type="text"
              placeholder="il-tuo-progetto.firebaseapp.com"
              value={authDomain}
              onChange={(e) => setAuthDomain(e.target.value)}
            />

            <label>App ID (opzionale)</label>
            <input
              type="text"
              placeholder="1:123456789:web:abcdef..."
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
            />

            <div className="row" style={{ marginTop: "16px" }}>
              <button type="submit" className="grow">
                Salva e Connetti
              </button>
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem("firebase_custom_config");
                  window.location.reload();
                }}
                className="danger"
              >
                Reset
              </button>
              <button type="button" onClick={() => setConfigOpen(false)}>
                Annulla
              </button>
            </div>
          </form>
        </dialog>
      )}
    </div>
  );
}
