"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  INITIAL_DATA,
  TimelineRow,
  TimelineEvent,
  TIMELINE_COLORS,
} from "../../lib/initialData";
import {
  syncToFirebase,
  subscribeToFirebase,
  isFirebaseActive,
  saveImageToFirebase,
} from "../../lib/firebase";
import {
  prepareImageFile,
  sanitizeImageUrl,
  sanitizeLink,
  isRtdbImageUrl,
} from "../../lib/media";
import { useResolvedImage } from "../../lib/useResolvedImage";

const W = 140;
const LH = 54;
const PAD = 14;

export default function EditTimelinePage() {
  const [rows, setRows] = useState<TimelineRow[]>(INITIAL_DATA.rows);
  const [events, setEvents] = useState<TimelineEvent[]>(INITIAL_DATA.events);
  const [ppy, setPpy] = useState<number>(10);
  const [firebaseConnected, setFirebaseConnected] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string>("");
  const [rangeFrom, setRangeFrom] = useState<number | "">("");
  const [rangeTo, setRangeTo] = useState<number | "">("");
  const [pendingEventId, setPendingEventId] = useState<string | null>(null);

  // Stato Modale Evento
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);
  const [formRow, setFormRow] = useState("");
  const [formYear, setFormYear] = useState<number | string>("");
  const [formYearEnd, setFormYearEnd] = useState<number | string>("");
  const [formTitle, setFormTitle] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formImg, setFormImg] = useState("");
  const [formLink, setFormLink] = useState("");
  const [imgError, setImgError] = useState("");
  const [pendingImage, setPendingImage] = useState<{ blob: Blob; previewUrl: string } | null>(null);

  const { src: resolvedFormImg } = useResolvedImage(formImg);
  const previewSrc = pendingImage?.previewUrl || resolvedFormImg;

  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    return () => {
      if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
    };
  }, [pendingImage]);

  const clearPendingImage = () => setPendingImage(null);

  // Inizializzazione
  useEffect(() => {
    setFirebaseConnected(isFirebaseActive());

    const unsubscribe = subscribeToFirebase((data) => {
      setRows(data.rows);
      setEvents(data.events);
      setFirebaseConnected(true);
    });

    return () => unsubscribe();
  }, []);

  // Se si arriva dalla vista lettura con ?event=ID, apri subito quell'evento in modifica
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("event");
    if (id) setPendingEventId(id);
  }, []);

  useEffect(() => {
    if (!pendingEventId) return;
    const ev = events.find((e) => e.id === pendingEventId);
    if (!ev) return;
    clearPendingImage();
    setEditingEvent(ev);
    setFormRow(ev.r);
    setFormYear(ev.y);
    setFormYearEnd(ev.y2 ?? "");
    setFormTitle(ev.t);
    setFormNotes(ev.n || "");
    setFormImg(ev.img || "");
    setFormLink(ev.link || "");
    setImgError("");
    setModalOpen(true);
    setPendingEventId(null);
  }, [events, pendingEventId]);

  // Salvataggio sincronizzato
  const persistChanges = async (newRows: TimelineRow[], newEvents: TimelineEvent[]) => {
    setRows(newRows);
    setEvents(newEvents);

    setSaveStatus("Salvataggio in corso...");
    const synced = await syncToFirebase(newRows, newEvents);
    if (synced) {
      setSaveStatus("✅ Sincronizzato su Firebase Cloud");
    } else {
      setSaveStatus("❌ Salvataggio non riuscito: controlla Firebase");
    }
    setTimeout(() => setSaveStatus(""), 3500);
    return synced;
  };

  useEffect(() => {
    if (modalOpen) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [modalOpen]);

  const closeModal = () => {
    setModalOpen(false);
    clearPendingImage();
  };

  // Un evento è un periodo se ha un anno finale maggiore di quello iniziale
  const endYear = (e: TimelineEvent) =>
    Number.isFinite(e.y2) && Number(e.y2) > e.y ? Number(e.y2) : e.y;

  // Calcolo intervalli (dai dati completi, includendo la fine dei periodi)
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

  const openModalForNew = (defaultRow?: string, defaultYear?: number) => {
    clearPendingImage();
    setEditingEvent(null);
    setFormRow(defaultRow || rows[0]?.id || "");
    setFormYear(defaultYear ?? "");
    setFormYearEnd("");
    setFormTitle("");
    setFormNotes("");
    setFormImg("");
    setFormLink("");
    setImgError("");
    setModalOpen(true);
  };

  const openModalForEdit = (ev: TimelineEvent) => {
    clearPendingImage();
    setEditingEvent(ev);
    setFormRow(ev.r);
    setFormYear(ev.y);
    setFormYearEnd(ev.y2 ?? "");
    setFormTitle(ev.t);
    setFormNotes(ev.n || "");
    setFormImg(ev.img || "");
    setFormLink(ev.link || "");
    setImgError("");
    setModalOpen(true);
  };



  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgError("");
    try {
      const prepared = await prepareImageFile(file);
      setPendingImage(prepared);
      setFormImg("");
    } catch (err) {
      setImgError(err instanceof Error ? err.message : "Caricamento immagine non riuscito.");
    }
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setImgError("");
    const yNum = parseInt(String(formYear), 10);
    const yEndNum = parseInt(String(formYearEnd), 10);
    if (isNaN(yNum) || !formTitle.trim()) return;
    const hasEnd = Number.isFinite(yEndNum) && yEndNum > yNum;

    let imgValue = formImg;
    try {
      if (pendingImage) {
        const id = await saveImageToFirebase(pendingImage.blob);
        imgValue = `rtdb:${id}`;
        clearPendingImage();
        setFormImg(imgValue);
      } else if (formImg.startsWith("data:")) {
        const blob = await (await fetch(formImg)).blob();
        const id = await saveImageToFirebase(blob);
        imgValue = `rtdb:${id}`;
        setFormImg(imgValue);
      }
    } catch (err) {
      setImgError(err instanceof Error ? err.message : "Caricamento immagine non riuscito.");
      return;
    }

    const img = sanitizeImageUrl(imgValue);
    const link = sanitizeLink(formLink);
    const media = {
      ...(img ? { img } : {}),
      ...(link ? { link } : {}),
    };

    let updated: TimelineEvent[];
    if (editingEvent) {
      updated = events.map((item) => {
        if (item.id !== editingEvent.id) return item;
        const next: TimelineEvent = {
          ...item,
          r: formRow,
          y: yNum,
          t: formTitle.trim(),
          n: formNotes.trim(),
          ...media,
        };
        if (hasEnd) next.y2 = yEndNum;
        else delete next.y2;
        if (!img) delete next.img;
        if (!link) delete next.link;
        return next;
      });
    } else {
      const newEv: TimelineEvent = {
        id: "e-" + Math.random().toString(36).slice(2, 8),
        r: formRow,
        y: yNum,
        ...(hasEnd ? { y2: yEndNum } : {}),
        t: formTitle.trim(),
        n: formNotes.trim(),
        ...media,
      };
      updated = [...events, newEv];
    }
    const saved = await persistChanges(rows, updated);
    if (saved) closeModal();
  };

  const handleDeleteEvent = async () => {
    if (!editingEvent) return;
    const updated = events.filter((item) => item.id !== editingEvent.id);
    const saved = await persistChanges(rows, updated);
    if (saved) closeModal();
  };

  const handleAddCountry = async () => {
    const name = window.prompt("Nome del paese / categoria:");
    if (name?.trim()) {
      const updatedRows = [
        ...rows,
        {
          id: "r-" + Math.random().toString(36).slice(2, 8),
          name: name.trim(),
          col: TIMELINE_COLORS[rows.length % TIMELINE_COLORS.length],
        },
      ];
      await persistChanges(updatedRows, events);
    }
  };

  const handleShuffleColors = async () => {
    if (rows.length === 0) return;

    const colors = [...TIMELINE_COLORS];
    for (let i = colors.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [colors[i], colors[j]] = [colors[j], colors[i]];
    }

    const updatedRows = rows.map((row, index) => ({
      ...row,
      col: colors[index % colors.length],
    }));
    await persistChanges(updatedRows, events);
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
          <div className="header-badges">
            <span className="badge-edit">✏️ Modalità Modifica</span>
            {saveStatus && <span className="save-status">{saveStatus}</span>}
          </div>
        </div>
      </header>

      {/* Banner informativo Firebase */}
      <div className="firebase-banner">
        {firebaseConnected ? (
          <span>🟢 <strong>Firebase Database Connesso:</strong> Le modifiche che salvi qui si sincronizzano all&apos;istante per tutti i visitatori.</span>
        ) : (
          <span>
            🟡 <strong>Database Firebase non configurato:</strong> controlla le variabili
            d&apos;ambiente in <code>.env.local</code> prima di salvare.
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

                  {placements.map(({ event: ev, x, lane, barWidth }) => {
                    const end = endYear(ev);
                    return (
                      <button
                        key={ev.id}
                        className={`chip c-${row.col}`}
                        style={{
                          left: `${x}px`,
                          top: `${6 + lane * LH}px`,
                          width: `${barWidth}px`,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          openModalForEdit(ev);
                        }}
                        title="Clicca per modificare o eliminare"
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
          <Link href="/" className="btn-back-nav">
            ← Torna alla Vista Client
          </Link>
          <button onClick={() => openModalForNew()}>+ Evento</button>
          <button onClick={handleAddCountry}>+ Paese</button>
          <button
            onClick={handleShuffleColors}
            title="Assegna casualmente i colori ai paesi"
          >
            Rimescola colori
          </button>

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

          <button onClick={() => setPpy((p) => Math.max(1, p / 1.4))} aria-label="Riduci scala">−</button>
          <button onClick={() => setPpy((p) => Math.min(200, p * 1.4))} aria-label="Ingrandisci scala">+</button>
          <button onClick={handleFit}>Adatta</button>
        </div>
      </div>

      {/* Dialog Modale Evento */}
      <dialog ref={dialogRef} id="dlg" onClose={closeModal}>
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

          <label htmlFor="y2">Anno fine (opzionale)</label>
          <input
            id="y2"
            type="number"
            inputMode="numeric"
            placeholder="Compila solo se è un periodo"
            value={formYearEnd}
            onChange={(e) => setFormYearEnd(e.target.value)}
          />
          <p className="hint">Lascia vuoto per un evento puntuale.</p>

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

          <label htmlFor="imgFile">Immagine (carica un file)</label>
          <input id="imgFile" type="file" accept="image/*" onChange={handleImageFile} />
          <input
            type="text"
            inputMode="url"
            placeholder="…oppure incolla l'URL di un'immagine (https://)"
            value={formImg.startsWith("data:") || isRtdbImageUrl(formImg) ? "" : formImg}
            onChange={(e) => {
              setFormImg(e.target.value);
              clearPendingImage();
            }}
          />
          <p className="img-hint">
            Immagini fino a 2 MB, compresse automaticamente. Verranno copiate nel repository
            al prossimo sync automatico.
          </p>
          {isRtdbImageUrl(formImg) && !pendingImage && (
            <p className="img-hint">Immagine caricata: in attesa di sincronizzazione.</p>
          )}
          {imgError && <p className="img-error">{imgError}</p>}
          {previewSrc && (
            <div className="img-preview">
              <img src={previewSrc} alt="Anteprima immagine" />
              <button
                type="button"
                onClick={() => {
                  setFormImg("");
                  clearPendingImage();
                }}
              >
                Rimuovi immagine
              </button>
            </div>
          )}

          <label htmlFor="lnk">Link di approfondimento</label>
          <input
            id="lnk"
            type="text"
            inputMode="url"
            placeholder="https://…"
            value={formLink}
            onChange={(e) => setFormLink(e.target.value)}
          />

          <div className="row">
            <button type="submit" className="grow">
              Salva su Cloud
            </button>
            {editingEvent && (
              <button type="button" className="danger" onClick={handleDeleteEvent}>
                Elimina
              </button>
            )}
            <button type="button" onClick={closeModal}>
              Chiudi
            </button>
          </div>
        </form>
      </dialog>

    </div>
  );
}
