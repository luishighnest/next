"use client";

import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/Navbar";
import {
    caricaCalendario,
    categorieConConteggio,
    contaLive,
    eventoLive,
    iconaCategoria,
    raggruppaPerSottocartella,
    totaleAttivi
} from "@/lib/calendario";

const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

function formattaGiorno(ev) {
    const t = Date.parse(ev.inizio);
    if (Number.isNaN(t)) return ev.data || "";
    const d = new Date(t);
    return `${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`;
}

function formattaOra(ev) {
    if (ev.ora) return ev.ora;
    const t = Date.parse(ev.inizio);
    if (Number.isNaN(t)) return "";
    return new Date(t).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

function Canali({ canali }) {
    if (!canali || canali.length === 0) return null;
    return (
        <div className="cal-canali">
            {canali.map((c, i) => (
                <span key={`${c.nome}-${c.numero}-${i}`} className={`cal-canale cal-canale-${c.tipo || "diretta"}`}>
                    {c.numero ? <span className="cal-canale-numero">{c.numero}</span> : null}
                    {c.nome}
                </span>
            ))}
        </div>
    );
}

function Evento({ ev, adesso }) {
    const live = eventoLive(ev, adesso);
    return (
        <li className={`cal-evento${live ? " is-live" : ""}`}>
            <div className="cal-evento-ora">
                <span className="cal-evento-ora-txt">{formattaOra(ev)}</span>
                {live ? <span className="cal-live-dot" title="In diretta" aria-label="In diretta" /> : null}
            </div>
            <div className="cal-evento-corpo">
                <div className="cal-evento-titolo">{ev.titolo}</div>
                <div className="cal-evento-meta">
                    {ev.competizione ? <span className="cal-tag">{ev.competizione}</span> : null}
                    {ev.sessione ? <span className="cal-sessione">{ev.sessione}</span> : null}
                    <span className="cal-data">{formattaGiorno(ev)}</span>
                </div>
                <Canali canali={ev.canali} />
            </div>
        </li>
    );
}

export default function CalendarioPage() {
    const [json, setJson] = useState(null);
    const [errore, setErrore] = useState(null);
    const [attiva, setAttiva] = useState("Oggi");
    const [adesso, setAdesso] = useState(null);

    useEffect(() => {
        let vivo = true;
        caricaCalendario()
            .then((d) => {
                if (vivo) {
                    setAdesso(new Date());
                    setJson(d);
                }
            })
            .catch((e) => {
                if (vivo) setErrore(e.message || "Errore nel caricamento");
            });
        const t = setInterval(() => {
            if (document.visibilityState === "visible") setAdesso(new Date());
        }, 60000);
        return () => {
            vivo = false;
            clearInterval(t);
        };
    }, []);

    const categorie = useMemo(() => (json && adesso ? categorieConConteggio(json, adesso) : []), [json, adesso]);
    const live = json && adesso ? contaLive(json, adesso) : 0;
    const attivi = json && adesso ? totaleAttivi(json, adesso) : 0;
    const cartella = json && attiva ? json.cartelle.find((c) => c.nome === attiva) : null;
    const gruppi = cartella && adesso ? raggruppaPerSottocartella(cartella, adesso) : [];

    return (
        <div className="cal-page">
            <Navbar />

            <div className="cal-container">
                <header className="cal-header">
                    <h1 className="cal-titolo">Calendario eventi</h1>
                    <div className="cal-badges">
                        <span className="cal-badge">
                            <span className="cal-badge-dot" aria-hidden="true" />
                            {attivi} eventi nel calendario
                        </span>
                        <span className="cal-badge cal-badge-live">
                            <span className="cal-badge-dot" aria-hidden="true" />
                            Live {live}
                        </span>
                        {json && json.aggiornato ? (
                            <span className="cal-aggiornato">
                                Aggiornato {new Date(json.aggiornato).toLocaleString("it-IT")}
                            </span>
                        ) : null}
                    </div>
                </header>

                {errore ? (
                    <p className="cal-stato cal-stato-errore">Calendario non disponibile: {errore}</p>
                ) : null}

                {!json && !errore ? <p className="cal-stato">Caricamento eventi...</p> : null}

                {json ? (
                    <>
                        <nav className="cal-tabs" aria-label="Categorie">
                            {categorie.map((c) => (
                                <button
                                    key={c.nome}
                                    type="button"
                                    className={`cal-tab${attiva === c.nome ? " is-active" : ""}`}
                                    onClick={() => setAttiva(c.nome)}
                                    aria-current={attiva === c.nome ? "page" : undefined}
                                >
                                    <span aria-hidden="true">{iconaCategoria(c.nome)}</span>
                                    {c.nome}
                                    <span className="cal-tab-count">{c.attivi}</span>
                                </button>
                            ))}
                        </nav>

                        {gruppi.length === 0 ? (
                            <p className="cal-stato">Nessun evento in questa categoria.</p>
                        ) : (
                            gruppi.map((g) => (
                                <section key={g.nome} className="cal-gruppo">
                                    <h2 className="cal-gruppo-titolo">
                                        {g.nome} <span className="cal-gruppo-count">{g.eventi.length}</span>
                                    </h2>
                                    <ul className="cal-lista">
                                        {g.eventi.map((ev, i) => (
                                            <Evento key={`${ev.inizio}-${ev.titolo}-${i}`} ev={ev} adesso={adesso} />
                                        ))}
                                    </ul>
                                </section>
                            ))
                        )}

                        {json.fonti ? (
                            <footer className="cal-fonti">
                                <p>
                                    Dati da campipaolo/Livesoccer, rigenerati ogni 3 ore. Fonti:{" "}
                                    {Object.entries(json.fonti).map(([k, v]) => (
                                        <span key={k} className="cal-fonte">
                                            {k}: {v}
                                        </span>
                                    ))}
                                </p>
                            </footer>
                        ) : null}
                    </>
                ) : null}
            </div>
        </div>
    );
}
