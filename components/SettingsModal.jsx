"use client";
import React, { useState, useEffect } from "react";
import {
    getTechSettings,
    saveTechSettings,
    resetTechSettings,
    getStorageStats,
    clearChannelsCache,
    DEFAULT_TECH_SETTINGS
} from "@/lib/settings";

export default function SettingsModal({ onClose }) {
    const [activeTab, setActiveTab] = useState("tab-stream");
    const [settings, setSettings] = useState(DEFAULT_TECH_SETTINGS);
    const [stats, setStats] = useState({ localKb: 0, sessionKb: 0, totalKb: 0, channelCount: 0 });
    const [savedToast, setSavedToast] = useState(false);
    const [cacheClearedToast, setCacheClearedToast] = useState(false);
    const [networkLatency, setNetworkLatency] = useState(null);
    const [testingPing, setTestingPing] = useState(false);

    // Carica le impostazioni salvate e statistiche all'apertura del modale
    useEffect(() => {
        setSettings(getTechSettings());
        setStats(getStorageStats());
    }, []);

    const handleChange = (key, value) => {
        setSettings(prev => {
            const updated = { ...prev, [key]: value };
            saveTechSettings(updated);
            return updated;
        });
        showSavedToast();
    };

    const showSavedToast = () => {
        setSavedToast(true);
        setTimeout(() => setSavedToast(false), 2000);
    };

    const handleClearCache = () => {
        clearChannelsCache(true);
        setStats(getStorageStats());
        setCacheClearedToast(true);
        setTimeout(() => setCacheClearedToast(false), 2500);
    };

    const handleResetAll = () => {
        if (confirm("Vuoi ripristinare tutti i parametri tecnici alle impostazioni predefinite?")) {
            const res = resetTechSettings();
            if (res) setSettings(res);
            setStats(getStorageStats());
            showSavedToast();
        }
    };

    const testLatency = async () => {
        setTestingPing(true);
        const start = performance.now();
        try {
            const res = await fetch(`/api/canali?source=ping&t=${Date.now()}`, { cache: "no-store", method: "HEAD" });
            const end = performance.now();
            setNetworkLatency(Math.round(end - start));
        } catch(e) {
            setNetworkLatency("Errore");
        } finally {
            setTestingPing(false);
        }
    };

    return (
        <div
            id="settings-modal-overlay"
            className="active"
            style={{ display: "flex", opacity: 1, pointerEvents: "auto" }}
            onClick={(e) => { if (e.target.id === "settings-modal-overlay") onClose(); }}
        >
            <div className="settings-modal-card">
                {/* Header */}
                <div className="settings-modal-header">
                    <div className="settings-modal-header-title">
                        <div className="settings-header-icon">
                            <i className="fas fa-sliders"></i>
                        </div>
                        <div>
                            <h2>Impostazioni di Sistema</h2>
                            <p>Configurazione runtime flussi, proxy, caching e sicurezza</p>
                        </div>
                    </div>
                    <button className="settings-modal-close" onClick={onClose} aria-label="Chiudi" title="Chiudi">
                        <i className="fas fa-xmark"></i>
                    </button>
                </div>

                {/* Body */}
                <div className="settings-modal-body">
                    {/* Sidebar Tabs */}
                    <div className="settings-sidebar">
                        <button
                            type="button"
                            className={`settings-tab-btn ${activeTab === "tab-stream" ? "active" : ""}`}
                            onClick={() => setActiveTab("tab-stream")}
                        >
                            <i className="fas fa-sliders"></i>
                            <span>Stream & Extension</span>
                        </button>
                        <button
                            type="button"
                            className={`settings-tab-btn ${activeTab === "tab-network" ? "active" : ""}`}
                            onClick={() => setActiveTab("tab-network")}
                        >
                            <i className="fas fa-network-wired"></i>
                            <span>Network & Polling</span>
                        </button>
                        <button
                            type="button"
                            className={`settings-tab-btn ${activeTab === "tab-cache" ? "active" : ""}`}
                            onClick={() => setActiveTab("tab-cache")}
                        >
                            <i className="fas fa-hard-drive"></i>
                            <span>Cache & Memoria</span>
                        </button>
                        <button
                            type="button"
                            className={`settings-tab-btn ${activeTab === "tab-security" ? "active" : ""}`}
                            onClick={() => setActiveTab("tab-security")}
                        >
                            <i className="fas fa-shield-halved"></i>
                            <span>Sicurezza & Sessione</span>
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="settings-content-area">
                        {/* TAB 1: STREAM & EXTENSION */}
                        {activeTab === "tab-stream" && (
                            <div className="settings-pane active">
                                <div className="settings-group-title">Player & Bridge Chrome Extension</div>

                                <div className="setting-item">
                                    <div className="setting-info">
                                        <label htmlFor="tech-ext-id">ID Estensione Shaka Player</label>
                                        <span>Identificatore del bridge player locale per decifratura ClearKey</span>
                                    </div>
                                    <input
                                        id="tech-ext-id"
                                        type="text"
                                        className="setting-select"
                                        style={{ maxWidth: "260px", fontFamily: "monospace", fontSize: "0.78rem" }}
                                        value={settings.extensionId}
                                        onChange={(e) => handleChange("extensionId", e.target.value.trim())}
                                        placeholder="opmeopcambhfimffbomjgemehjkbbmji"
                                    />
                                </div>

                                <div className="setting-item">
                                    <div className="setting-info">
                                        <label htmlFor="tech-pref-qual">Qualità Preferita Flusso</label>
                                        <span>Risoluzione di rendering inviata al player video</span>
                                    </div>
                                    <select
                                        id="tech-pref-qual"
                                        className="setting-select"
                                        value={settings.preferredQuality}
                                        onChange={(e) => handleChange("preferredQuality", e.target.value)}
                                    >
                                        <option value="auto">Auto ABR (Adattiva Shaka)</option>
                                        <option value="1080">1080p FHD (1920x1080)</option>
                                        <option value="720">720p HD (1280x720)</option>
                                        <option value="480">480p SD (Risparmio Banda)</option>
                                    </select>
                                </div>

                                <div className="setting-item">
                                    <div className="setting-info">
                                        <label htmlFor="tech-sky-src">Sorgente Primaria Sky TV</label>
                                        <span>Sorgente di default caricata nella sezione Sky Glass</span>
                                    </div>
                                    <select
                                        id="tech-sky-src"
                                        className="setting-select"
                                        value={settings.defaultSkySource}
                                        onChange={(e) => handleChange("defaultSkySource", e.target.value)}
                                    >
                                        <option value="sky.json">Sky 1 (Sport & Intrattenimento)</option>
                                        <option value="sky2.json">Sky 2 (Multicanale Completo)</option>
                                    </select>
                                </div>

                                <div className="setting-item">
                                    <div className="setting-info">
                                        <label>User-Agent HTTP Injector</label>
                                        <span>Header spoofing inviato nell'hash iframe verso i server CDN protetti</span>
                                    </div>
                                    <button
                                        type="button"
                                        className="setting-action-btn"
                                        onClick={() => {
                                            const newUa = prompt("Inserisci User-Agent personalizzato per lo streaming:", settings.customUserAgent);
                                            if (newUa) handleChange("customUserAgent", newUa.trim());
                                        }}
                                    >
                                        <i className="fas fa-pen-to-square"></i>
                                        <span>Personalizza UA</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* TAB 2: NETWORK & POLLING */}
                        {activeTab === "tab-network" && (
                            <div className="settings-pane active">
                                <div className="settings-group-title">Sincronizzazione Dati & Latenza</div>

                                <div className="setting-item">
                                    <div className="setting-info">
                                        <label htmlFor="tech-poll-rate">Frequenza Polling Background EPG / Canali</label>
                                        <span>Intervallo di aggiornamento orari eventi e programmi in diretta</span>
                                    </div>
                                    <select
                                        id="tech-poll-rate"
                                        className="setting-select"
                                        value={settings.pollIntervalSec}
                                        onChange={(e) => handleChange("pollIntervalSec", parseInt(e.target.value, 10))}
                                    >
                                        <option value="10">10 Secondi (Reattivo)</option>
                                        <option value="15">15 Secondi (Consigliato - Ottimizzato)</option>
                                        <option value="30">30 Secondi (Fluido & Risparmio Rete)</option>
                                        <option value="60">60 Secondi (Massima Efficienza)</option>
                                    </select>
                                </div>

                                <div className="setting-item">
                                    <div className="setting-info">
                                        <label>Test Latenza API Server</label>
                                        <span>Misura il tempo di round-trip verso l'endpoint `/api/canali`</span>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                        {networkLatency !== null && (
                                            <span style={{
                                                 fontSize: "0.85rem",
                                                 fontWeight: "bold",
                                                 color: typeof networkLatency === "number" && networkLatency < 250 ? "#30d158" : "#ff9f0a"
                                             }}>
                                                {networkLatency} {typeof networkLatency === "number" ? "ms" : ""}
                                            </span>
                                        )}
                                        <button
                                            type="button"
                                            className="setting-action-btn"
                                            disabled={testingPing}
                                            onClick={testLatency}
                                        >
                                            <i className="fas fa-gauge-high"></i>
                                            <span>{testingPing ? "Pinging..." : "Test Ping"}</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="setting-item">
                                    <div className="setting-info">
                                        <label htmlFor="tech-doh">DNS-over-HTTPS (DoH Proxy Hint)</label>
                                        <span>Risoluzione DNS anti-blocco per flussi CDN reindirizzati</span>
                                    </div>
                                    <select
                                        id="tech-doh"
                                        className="setting-select"
                                        value={settings.dnsOverHttps}
                                        onChange={(e) => handleChange("dnsOverHttps", e.target.value)}
                                    >
                                        <option value="cloudflare">Cloudflare (1.1.1.1 / WARP)</option>
                                        <option value="google">Google DNS (8.8.8.8)</option>
                                        <option value="quad9">Quad9 Secure (9.9.9.9)</option>
                                        <option value="disabled">Disattivato (Default Browser)</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* TAB 3: CACHE & MEMORIA */}
                        {activeTab === "tab-cache" && (
                            <div className="settings-pane active">
                                <div className="settings-group-title">Storage Locale & Persistenza</div>

                                <div className="security-status-card">
                                    <div className="sec-status-icon">
                                        <i className="fas fa-database"></i>
                                    </div>
                                    <div className="sec-status-info">
                                        <h4>Stato Cache Dispositivo</h4>
                                        <p>
                                            {stats.channelCount > 0 ? `${stats.channelCount} canali memorizzati` : "Nessun canale in cache"} &bull; Spazio occupato: ~{stats.totalKb} KB
                                        </p>
                                    </div>
                                    <span className="sec-status-badge">ATTIVA</span>
                                </div>

                                <div className="setting-item">
                                    <div className="setting-info">
                                        <label>Svuota Cache Canali & Sessione</label>
                                        <span>Elimina i dati locali forzando il download immediato da Redis/Backend</span>
                                    </div>
                                    <button
                                        type="button"
                                        className="setting-action-btn"
                                        onClick={handleClearCache}
                                    >
                                        <i className="fas fa-trash-can"></i>
                                        <span>Svuota Cache</span>
                                    </button>
                                </div>

                                <div className="setting-item">
                                    <div className="setting-info">
                                        <label>Cancella Cache alla Chiusura Scheda</label>
                                        <span>Pulisce automaticamente la lista canali quando chiudi il browser</span>
                                    </div>
                                    <label className="setting-switch">
                                        <input
                                            type="checkbox"
                                            checked={settings.wipeCacheOnExit}
                                            onChange={(e) => handleChange("wipeCacheOnExit", e.target.checked)}
                                        />
                                        <span className="slider"></span>
                                    </label>
                                </div>

                                <div className="setting-item">
                                    <div className="setting-info">
                                        <label>Ripristina Parametri Predefiniti</label>
                                        <span>Reimposta tutti i valori tecnici a quelli di fabbrica</span>
                                    </div>
                                    <button
                                        type="button"
                                        className="setting-action-btn secondary"
                                        onClick={handleResetAll}
                                    >
                                        <i className="fas fa-arrow-rotate-left"></i>
                                        <span>Ripristina Tutto</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* TAB 4: SICUREZZA & SESSIONE */}
                        {activeTab === "tab-security" && (
                            <div className="settings-pane active">
                                <div className="settings-group-title">Crittografia WebCrypto & Sessione</div>

                                <div className="security-status-card">
                                    <div className="sec-status-icon">
                                        <i className="fas fa-shield-halved"></i>
                                    </div>
                                    <div className="sec-status-info">
                                        <h4>Cifratura AES-256-GCM + PBKDF2</h4>
                                        <p>100.000 iterazioni SHA-256 &bull; Decifratura ClearKey hardware-level</p>
                                    </div>
                                    <span className="sec-status-badge">SICURO</span>
                                </div>

                                <div className="setting-item">
                                    <div className="setting-info">
                                        <label htmlFor="tech-autolock">Auto-Lock Inattività</label>
                                        <span>Richiedi sblocco sessione dopo un periodo di assenza attività</span>
                                    </div>
                                    <select
                                        id="tech-autolock"
                                        className="setting-select"
                                        value={settings.autoLockMinutes}
                                        onChange={(e) => handleChange("autoLockMinutes", parseInt(e.target.value, 10))}
                                    >
                                        <option value="0">Disattivato (Sessione Continua)</option>
                                        <option value="5">Dopo 5 minuti</option>
                                        <option value="15">Dopo 15 minuti</option>
                                        <option value="30">Dopo 30 minuti</option>
                                        <option value="60">Dopo 1 ora</option>
                                    </select>
                                </div>

                                <div className="setting-item">
                                    <div className="setting-info">
                                        <label>Debug Decifratura ClearKey</label>
                                        <span>Mostra informazioni diagnostiche in console per le chiavi MPD</span>
                                    </div>
                                    <label className="setting-switch">
                                        <input
                                            type="checkbox"
                                            checked={settings.clearkeyDebug}
                                            onChange={(e) => handleChange("clearkeyDebug", e.target.checked)}
                                        />
                                        <span className="slider"></span>
                                    </label>
                                </div>

                                <div className="setting-item">
                                    <div className="setting-info">
                                        <label>Termina e Blocca Sessione Immediatamente</label>
                                        <span>Elimina token di decifratura in memoria e ricarica il portale</span>
                                    </div>
                                    <button
                                        type="button"
                                        className="setting-action-btn danger"
                                        onClick={() => {
                                            if (confirm("Vuoi bloccare e azzerare immediatamente la sessione corrente?")) {
                                                sessionStorage.clear();
                                                window.location.reload();
                                            }
                                        }}
                                    >
                                        <i className="fas fa-lock"></i>
                                        <span>Blocca Sessione</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="settings-modal-footer">
                    <div>
                        {savedToast && (
                            <span className="settings-saved-toast show">
                                <i className="fas fa-circle-check" style={{ fontSize: "14px" }}></i>
                                Impostazione salvata
                            </span>
                        )}
                        {cacheClearedToast && (
                            <span className="settings-saved-toast show">
                                <i className="fas fa-circle-check" style={{ fontSize: "14px" }}></i>
                                Cache svuotata con successo
                            </span>
                        )}
                    </div>
                    <button type="button" className="settings-btn-save" onClick={onClose}>
                        Chiudi e Salva
                    </button>
                </div>
            </div>
        </div>
    );
}
