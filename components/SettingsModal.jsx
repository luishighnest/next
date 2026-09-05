"use client";
import React, { useState } from "react";

export default function SettingsModal({ onClose }) {
    const [activeTab, setActiveTab] = useState("tab-player");

    return (
        <div
            id="settings-modal-overlay"
            className="active"
            style={{ display: "flex", opacity: 1, pointerEvents: "auto" }}
            onClick={(e) => { if (e.target.id === "settings-modal-overlay") onClose(); }}
        >
            <div className="settings-modal-card">
                <div className="settings-modal-header">
                    <div className="settings-modal-header-title">
                        <div className="settings-header-icon">
                            <span className="material-symbols-rounded">settings</span>
                        </div>
                        <div>
                            <h2>Impostazioni</h2>
                            <p>Configura lo streaming, la grafica e la sicurezza del player</p>
                        </div>
                    </div>
                    <button className="settings-modal-close" onClick={onClose} aria-label="Chiudi">
                        <span className="material-symbols-rounded">close</span>
                    </button>
                </div>

                <div className="settings-modal-body">
                    <div className="settings-sidebar">
                        <button
                            type="button"
                            className={`settings-tab-btn ${activeTab === "tab-player" ? "active" : ""}`}
                            onClick={() => setActiveTab("tab-player")}
                        >
                            <span className="material-symbols-rounded">play_circle</span>
                            <span>Player & Video</span>
                        </button>
                        <button
                            type="button"
                            className={`settings-tab-btn ${activeTab === "tab-appearance" ? "active" : ""}`}
                            onClick={() => setActiveTab("tab-appearance")}
                        >
                            <span className="material-symbols-rounded">palette</span>
                            <span>Aspetto & UI</span>
                        </button>
                        <button
                            type="button"
                            className={`settings-tab-btn ${activeTab === "tab-security" ? "active" : ""}`}
                            onClick={() => setActiveTab("tab-security")}
                        >
                            <span className="material-symbols-rounded">shield</span>
                            <span>Sicurezza & PIN</span>
                        </button>
                    </div>

                    <div className="settings-content-area">
                        {activeTab === "tab-player" && (
                            <div className="settings-pane active">
                                <div className="settings-group-title">Qualità e Riproduzione</div>
                                <div className="setting-item">
                                    <div className="setting-info">
                                        <label>Qualità Streaming Preferita</label>
                                        <span>Risoluzione massima predefinita</span>
                                    </div>
                                    <select className="setting-select" defaultValue="auto">
                                        <option value="auto">Auto (Ottimale)</option>
                                        <option value="1080">1080p FHD (Alta Fedeltà)</option>
                                        <option value="720">720p HD</option>
                                    </select>
                                </div>
                                <div className="setting-item">
                                    <div className="setting-info">
                                        <label>Dimensione Buffer Anti-Lag</label>
                                        <span>Secondi di pre-caricamento per prevenire blocchi</span>
                                    </div>
                                    <select className="setting-select" defaultValue="normal">
                                        <option value="low">Bassa Latenza (5 sec)</option>
                                        <option value="normal">Standard (15 sec - Consigliato)</option>
                                        <option value="high">Alto Buffer (30 sec)</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {activeTab === "tab-appearance" && (
                            <div className="settings-pane active">
                                <div className="settings-group-title">Personalizzazione Grafica</div>
                                <div className="setting-item">
                                    <div className="setting-info">
                                        <label>Tema Interfaccia</label>
                                        <span>Stile visivo dei pannelli e dello sfondo</span>
                                    </div>
                                    <select className="setting-select" defaultValue="oled">
                                        <option value="oled">Dark OLED Obsidian (Consigliato)</option>
                                        <option value="slate">Deep Slate Glass</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {activeTab === "tab-security" && (
                            <div className="settings-pane active">
                                <div className="settings-group-title">Protezione Crittografica</div>
                                <div className="security-status-card" style={{ display: "flex", gap: "12px", alignItems: "center", padding: "14px", background: "rgba(0, 255, 102, 0.08)", borderRadius: "14px", border: "1px solid rgba(0, 255, 102, 0.25)", marginBottom: "16px" }}>
                                    <span className="material-symbols-rounded" style={{ color: "#00ff66", fontSize: "28px" }}>verified_user</span>
                                    <div>
                                        <h4 style={{ margin: 0, fontSize: "0.95rem" }}>Protezione Attiva: AES-256-GCM</h4>
                                        <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "rgba(255,255,255,0.6)" }}>Tutti i flussi e le chiavi ClearKey sono decifrati al volo in memoria.</p>
                                    </div>
                                </div>
                                <div className="setting-item">
                                    <div className="setting-info">
                                        <label>Blocca e Termina Sessione</label>
                                        <span>Termina l'accesso sessione</span>
                                    </div>
                                    <button
                                        type="button"
                                        className="setting-action-btn danger"
                                        onClick={() => { sessionStorage.clear(); window.location.reload(); }}
                                    >
                                        <span className="material-symbols-rounded">lock</span>
                                        <span>Blocca Ora</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="settings-modal-footer">
                    <button type="button" className="settings-btn-save" onClick={onClose}>
                        Chiudi e Applica
                    </button>
                </div>
            </div>
        </div>
    );
}
