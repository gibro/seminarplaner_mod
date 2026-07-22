// This file is part of Moodle - http://moodle.org/
//
// Live-Ansicht: der Souffleur fuer die Durchfuehrung (D69/D70/D72).
//
// Bedienlogik nach dem PowerPoint-Moderationsmodus: ein bewusster Start, danach
// ausschliesslich manuelles Vor/Zurueck. Es gibt keinen Abgleich mit der echten
// Uhrzeit und keinen automatischen Fortschritt aus den geplanten Dauern — die
// Uhrzeit ist reine Information und laesst sich ausblenden.
//
// Die Ansicht ist rein lesend. Wer waehrend der Durchfuehrung abweichen will,
// kopiert den Plan vorab (D67) und aendert die Kopie im Sequenz-Editor (D71).
//
// @module mod_seminarplaner/live

define([
    'core/ajax',
    'core/notification',
    'mod_seminarplaner/livemodel',
    'mod_seminarplaner/roterfadenmodel'
], function(Ajax, Notification, LiveModel, Model) {
    const DAYS_ALL = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
    const CLOCK_STORAGE_KEY = 'kg_live_showclock';

    const bySel = (sel) => document.querySelector(sel);
    const asCall = (methodname, args) => Ajax.call([{methodname, args}])[0];
    const esc = LiveModel.escapeHtml;

    const todayName = () => DAYS_ALL[(new Date().getDay() + 6) % 7] || '';

    const wallClock = () => {
        const now = new Date();
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    };

    // Dateigroessen kurz halten: im Souffleur zaehlt der Blick, nicht das Byte.
    const fileSize = (bytes) => {
        const size = Math.max(0, Number(bytes) || 0);
        if (!size) {
            return '';
        }
        if (size < 1024) {
            return `${size} B`;
        }
        if (size < 1024 * 1024) {
            return `${Math.round(size / 1024)} KB`;
        }
        return `${(size / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
    };

    const icon = (paths, size = 16) => `<svg class="live-icon" width="${size}" height="${size}" viewBox="0 0 24 24"`
        + ` fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"`
        + ` aria-hidden="true" focusable="false">${paths}</svg>`;
    const ICONS = {
        clip: () => icon('<path d="M21.4 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.2-9.19a4 4 0 015.65 5.66l-9.2 9.19'
            + 'a2 2 0 01-2.83-2.83l8.49-8.48"/>'),
        wrench: () => icon('<path d="M14.7 6.3a4 4 0 005.3 5.3l-8 8a2.8 2.8 0 01-4-4l8-8z"/><path d="M14.7 6.3'
            + 'l-2-2a4 4 0 00-5.4 5.4l2 2"/>'),
        pause: () => icon('<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'),
    };

    class LiveView {
        constructor(cmid) {
            this.cmid = cmid;
            this.gridid = 0;
            this.grids = [];
            this.units = [];
            this.steps = [];
            this.step = 0;
            // Abgehakte Checklisten-Punkte, nur fuer diese Sitzung im Speicher —
            // die Ansicht schreibt nichts in den Plan zurueck (D69).
            this.ticks = {};
            this.clockTimer = null;

            this.shell = bySel('#live-shell');
            this.status = bySel('#live-status');
            this.startPanel = bySel('#live-start');
            this.stage = bySel('#live-stage');
            this.gridSelect = bySel('#live-grid-select');
            this.startSelect = bySel('#live-start-select');
            this.startPreview = bySel('#live-start-preview');
            this.startButton = bySel('#live-start-button');
            this.emptyBox = bySel('#live-empty');
            this.nowBox = bySel('#live-now');
            this.nextBox = bySel('#live-next');
            this.whereBox = bySel('#live-where');
            this.countBox = bySel('#live-count');
            this.clockBox = bySel('#live-clock');
            this.clockToggle = bySel('#live-clock-toggle');
            if (!this.shell || !this.nowBox) {
                return;
            }

            this.bindControls();
            this.applyClockVisibility(this.readStoredClock());
            this.load(0);
        }

        setStatus(text, isError = false) {
            if (!this.status) {
                return;
            }
            this.status.textContent = text || '';
            this.status.style.color = isError ? '#b91c1c' : '#166534';
        }

        // ---- Daten ----------------------------------------------------------

        load(gridid) {
            this.setStatus('Seminarplan wird geladen …');
            return asCall('mod_seminarplaner_get_live_state', {cmid: this.cmid, gridid: gridid || 0})
                .then((res) => {
                    this.gridid = Number(res.gridid) || 0;
                    this.grids = Array.isArray(res.grids) ? res.grids : [];
                    let state = {};
                    let cards = [];
                    try {
                        state = res.statejson ? JSON.parse(res.statejson) : {};
                    } catch (e) {
                        state = {};
                    }
                    try {
                        cards = res.cardsjson ? JSON.parse(res.cardsjson) : [];
                    } catch (e) {
                        cards = [];
                    }
                    this.units = LiveModel.buildUnits(state, cards);
                    this.steps = LiveModel.buildSteps(this.units);
                    this.step = 0;
                    this.ticks = {};
                    this.setStatus('');
                    this.renderStartScreen();
                    return null;
                })
                .catch((error) => {
                    this.setStatus('Der Seminarplan konnte nicht geladen werden.', true);
                    Notification.exception(error);
                });
        }

        // ---- Startbildschirm (D72) ------------------------------------------

        renderStartScreen() {
            if (this.gridSelect) {
                this.gridSelect.innerHTML = this.grids
                    .map((grid) => `<option value="${esc(grid.id)}">${esc(grid.name)}</option>`)
                    .join('');
                this.gridSelect.value = String(this.gridid);
            }

            // Einstiegspunkte sind die Tage des Plans: an Tag drei will niemand
            // erst durch Tag eins blaettern.
            const entries = [];
            let lastday = null;
            this.units.forEach((unit, index) => {
                if (unit.dayName !== lastday) {
                    entries.push({label: unit.dayName, unitIndex: index});
                    lastday = unit.dayName;
                }
            });
            if (this.startSelect) {
                this.startSelect.innerHTML = entries
                    .map((entry) => `<option value="${esc(entry.unitIndex)}">${esc(entry.label)}</option>`)
                    .join('');
                const today = entries.find((entry) => entry.label === todayName());
                if (today) {
                    this.startSelect.value = String(today.unitIndex);
                }
            }

            const hasplan = this.units.length > 0;
            if (this.emptyBox) {
                this.emptyBox.classList.toggle('kg-hidden', hasplan);
            }
            if (this.startButton) {
                this.startButton.classList.toggle('kg-hidden', !hasplan);
            }
            if (this.startSelect) {
                this.startSelect.closest('.live-field').classList.toggle('kg-hidden', !hasplan);
            }
            this.renderStartPreview();
        }

        renderStartPreview() {
            if (!this.startPreview) {
                return;
            }
            const from = Number(this.startSelect && this.startSelect.value) || 0;
            const unit = this.units[from];
            if (!unit) {
                this.startPreview.innerHTML = '';
                return;
            }
            const sameday = this.units.filter((entry) => entry.dayName === unit.dayName);
            const last = sameday[sameday.length - 1];
            const einheiten = sameday.filter((entry) => entry.kind === 'einheit');
            this.startPreview.innerHTML = `
                <div class="live-preview">
                    <div class="live-preview__head">${esc(unit.dayName)}
                        <span class="live-time">· ${esc(Model.clockLabel(unit.startMin))}
                            bis ${esc(Model.clockLabel(last.endMin))}</span>
                    </div>
                    <ol class="live-preview__list">
                        ${einheiten.slice(0, 8).map((entry) => `
                            <li><span class="live-preview__dot rf-phase--${esc(entry.phase)}"></span>
                                ${esc(entry.title)}
                                <span class="live-preview__dur">${esc(Model.durationLabel(entry.minutes))}</span></li>
                        `).join('')}
                        ${einheiten.length > 8
                            ? `<li class="live-preview__more">… und ${einheiten.length - 8} weitere</li>` : ''}
                    </ol>
                </div>`;
        }

        start() {
            const from = Number(this.startSelect && this.startSelect.value) || 0;
            const step = this.steps.findIndex((entry) => entry.unitIndex === from);
            this.step = step < 0 ? 0 : step;
            this.startPanel.classList.add('kg-hidden');
            this.stage.classList.remove('kg-hidden');
            this.startClock();
            this.render();
            const next = bySel('#live-next-button');
            if (next) {
                next.focus();
            }
        }

        quit() {
            this.stopClock();
            this.stage.classList.add('kg-hidden');
            this.startPanel.classList.remove('kg-hidden');
            this.renderStartScreen();
        }

        // ---- Navigation (D72: ausschliesslich manuell) -----------------------

        go(delta) {
            const target = this.step + delta;
            if (target < 0 || target >= this.steps.length) {
                return;
            }
            this.step = target;
            this.render();
        }

        // ---- Darstellung -----------------------------------------------------

        renderMaterialien(materialien) {
            const list = Array.isArray(materialien) ? materialien.filter((file) => file && file.fileurl) : [];
            if (!list.length) {
                return '';
            }
            return `
                <div class="live-panel">
                    <div class="live-panel__head">${ICONS.clip()}<span>Materialien</span></div>
                    <ul class="live-files">
                        ${list.map((file) => `
                            <li><a href="${esc(file.fileurl)}" target="_blank" rel="noopener noreferrer">
                                ${esc(file.name)}</a>
                                <span class="live-files__size">${esc(fileSize(file.filesize))}</span></li>
                        `).join('')}
                    </ul>
                </div>`;
        }

        renderChecklist(unit) {
            const check = unit.checklist || {items: [], html: ''};
            if (!check.items.length && !check.html) {
                return '';
            }
            const ticked = this.ticks[unit.id] || {};
            const body = check.items.length
                ? `<ul class="live-check">
                        ${check.items.map((item, index) => `
                            <li class="live-check__item${ticked[index] ? ' is-done' : ''}">
                                <label>
                                    <input type="checkbox" data-tick="${esc(index)}"
                                        ${ticked[index] ? 'checked' : ''}>
                                    <span>${item}</span>
                                </label>
                            </li>
                        `).join('')}
                   </ul>`
                : `<div class="live-panel__text">${check.html}</div>`;
            return `
                <div class="live-panel">
                    <div class="live-panel__head">${ICONS.wrench()}<span>Material und Technik</span></div>
                    ${body}
                </div>`;
        }

        renderSections(unit, activeindex) {
            if (!unit.sections.length) {
                return `<div class="live-empty-hint">Für diese Seminareinheit ist kein Ablauf hinterlegt.</div>`;
            }
            // D70: die Abschnitte stammen aus den Überschriften des Ablauf-Felds.
            // Nur einer davon ist ausgeklappt — die übrigen bleiben als Fahrplan
            // sichtbar, damit klar ist, was noch kommt.
            const titled = unit.sections.some((section) => section.title !== '');
            if (!titled && unit.sections.length === 1) {
                return `<div class="live-flow">${unit.sections[0].html}</div>`;
            }
            return `
                <ol class="live-steps">
                    ${unit.sections.map((section, index) => {
                        const state = index === activeindex ? ' is-active'
                            : (index < activeindex ? ' is-done' : '');
                        return `
                            <li class="live-step${state}">
                                <button type="button" class="live-step__head" data-section="${esc(index)}">
                                    <span class="live-step__num">${index + 1}</span>
                                    <span class="live-step__title">${esc(section.title || 'Ablauf')}</span>
                                </button>
                                ${index === activeindex
                                    ? `<div class="live-step__body live-flow">${section.html}</div>` : ''}
                            </li>`;
                    }).join('')}
                </ol>`;
        }

        renderNow(unit, step) {
            if (unit.kind === 'pause') {
                this.nowBox.innerHTML = `
                    <div class="live-card live-card--pause">
                        <div class="live-card__head">
                            ${ICONS.pause()}
                            <span class="live-card__time live-time">${esc(Model.clockLabel(unit.startMin))}–${
                                esc(Model.clockLabel(unit.endMin))}</span>
                            <span class="live-card__dur">${esc(Model.durationLabel(unit.minutes))}</span>
                        </div>
                        <h2 class="live-card__title">${esc(unit.title)}</h2>
                    </div>`;
                return;
            }
            const crumbs = [];
            if (unit.bausteinTitel && unit.bausteinTitel !== unit.title) {
                crumbs.push(esc(unit.bausteinTitel));
            }
            if (unit.continuation) {
                crumbs.push('Fortsetzung');
            }
            this.nowBox.innerHTML = `
                <div class="live-card live-card--now${unit.phase ? ` rf-phase--${esc(unit.phase)}` : ''}">
                    <div class="live-card__head">
                        ${unit.phaseLabel ? `<span class="live-badge">${esc(unit.phaseLabel)}</span>` : ''}
                        <span class="live-card__time live-time">${esc(Model.clockLabel(unit.startMin))}–${
                            esc(Model.clockLabel(unit.endMin))}</span>
                        <span class="live-card__dur">${esc(Model.durationLabel(unit.minutes))}</span>
                    </div>
                    <h2 class="live-card__title">${esc(unit.title)}</h2>
                    ${crumbs.length ? `<div class="live-card__crumb">${crumbs.join(' · ')}</div>` : ''}
                    ${this.renderSections(unit, step.sectionIndex)}
                    <div class="live-panels">
                        ${this.renderChecklist(unit)}
                        ${this.renderMaterialien(unit.materialien)}
                    </div>
                </div>`;
        }

        renderNext(unit) {
            if (!unit) {
                this.nextBox.innerHTML = `
                    <div class="live-next__label">Als Nächstes</div>
                    <div class="live-empty-hint">Das ist der letzte Programmpunkt.</div>`;
                return;
            }
            const daychange = unit.isNewDay
                ? `<div class="live-next__day">${esc(unit.dayName)} · ${esc(unit.anchorLabel)}</div>` : '';
            this.nextBox.innerHTML = `
                <div class="live-next__label">Als Nächstes</div>
                <div class="live-card live-card--next${unit.phase ? ` rf-phase--${esc(unit.phase)}` : ''}">
                    ${daychange}
                    <div class="live-card__head">
                        ${unit.phaseLabel ? `<span class="live-badge">${esc(unit.phaseLabel)}</span>` : ''}
                        <span class="live-card__time live-time">${esc(Model.clockLabel(unit.startMin))}</span>
                        <span class="live-card__dur">${esc(Model.durationLabel(unit.minutes))}</span>
                    </div>
                    <h3 class="live-card__title">${esc(unit.title)}</h3>
                    <div class="live-panels">
                        ${this.renderChecklist(unit)}
                        ${this.renderMaterialien(unit.materialien)}
                    </div>
                </div>`;
        }

        render() {
            const step = this.steps[this.step];
            if (!step) {
                return;
            }
            const unit = this.units[step.unitIndex];
            // D72: die naechste EINHEIT bleibt sichtbar, nicht der naechste
            // Ablauf-Abschnitt — damit sich ihr Material vorbereiten laesst.
            const next = this.units[step.unitIndex + 1] || null;
            if (next) {
                next.isNewDay = next.dayName !== unit.dayName || next.anchorKey !== unit.anchorKey;
            }

            this.whereBox.textContent = `${unit.dayName} · ${unit.anchorLabel}`;
            this.countBox.textContent = `Schritt ${this.step + 1} von ${this.steps.length}`;
            this.renderNow(unit, step);
            this.renderNext(next);

            const prev = bySel('#live-prev');
            const forward = bySel('#live-next-button');
            if (prev) {
                prev.disabled = this.step === 0;
            }
            if (forward) {
                forward.disabled = this.step >= this.steps.length - 1;
            }
            this.showStepFromTop();
        }

        /**
         * Nach dem Blaettern oben am neuen Schritt anfangen.
         *
         * Ohne das liest man bei einer langen Einheit weiter, wohin man vorher
         * gescrollt hatte - und landet mitten im naechsten Text.
         */
        showStepFromTop() {
            this.nowBox.scrollTop = 0;
            this.nextBox.scrollTop = 0;
            if (this.isFullscreen() || typeof this.nowBox.scrollIntoView !== 'function') {
                return;
            }
            // Ausserhalb des Vollbilds scrollt die Seite. Nur zurueckholen, wenn
            // der Kartenkopf tatsaechlich ueber den Rand gerutscht ist.
            const box = this.nowBox.getBoundingClientRect();
            if (box && box.top < 0) {
                this.nowBox.scrollIntoView({block: 'start'});
            }
        }

        // ---- Uhrzeit (D72: rein informativ, ausblendbar) ---------------------

        readStoredClock() {
            if (typeof window === 'undefined' || !window.localStorage) {
                return true;
            }
            return window.localStorage.getItem(CLOCK_STORAGE_KEY) !== '0';
        }

        applyClockVisibility(show) {
            this.shell.classList.toggle('live-shell--noclock', !show);
            if (this.clockToggle) {
                this.clockToggle.checked = !!show;
            }
            if (window.localStorage) {
                window.localStorage.setItem(CLOCK_STORAGE_KEY, show ? '1' : '0');
            }
        }

        startClock() {
            const tick = () => {
                if (this.clockBox) {
                    this.clockBox.textContent = wallClock();
                }
            };
            tick();
            this.stopClock();
            this.clockTimer = window.setInterval(tick, 15000);
        }

        stopClock() {
            if (this.clockTimer) {
                window.clearInterval(this.clockTimer);
                this.clockTimer = null;
            }
        }

        // ---- Bedienung -------------------------------------------------------

        bindControls() {
            if (this.gridSelect) {
                this.gridSelect.addEventListener('change', () => this.load(Number(this.gridSelect.value) || 0));
            }
            if (this.startSelect) {
                this.startSelect.addEventListener('change', () => this.renderStartPreview());
            }
            if (this.startButton) {
                this.startButton.addEventListener('click', () => this.start());
            }
            const quit = bySel('#live-quit');
            if (quit) {
                quit.addEventListener('click', () => this.quit());
            }
            const prev = bySel('#live-prev');
            if (prev) {
                prev.addEventListener('click', () => this.go(-1));
            }
            const forward = bySel('#live-next-button');
            if (forward) {
                forward.addEventListener('click', () => this.go(1));
            }
            if (this.clockToggle) {
                this.clockToggle.addEventListener('change', () => this.applyClockVisibility(this.clockToggle.checked));
            }
            const fullscreen = bySel('#live-fullscreen');
            if (fullscreen) {
                fullscreen.addEventListener('click', () => this.toggleFullscreen());
            }
            // Das Vollbild-Layout haengt an einer eigenen Klasse statt an
            // :fullscreen: die Pseudoklasse braeuchte fuer Safari eine zweite,
            // wortgleiche Regel (ein unbekannter Selektor kippt die ganze
            // Gruppe) - eine Doppelpflege, die sich hier vermeiden laesst.
            ['fullscreenchange', 'webkitfullscreenchange'].forEach((name) => {
                document.addEventListener(name, () => this.syncFullscreenClass());
            });

            // Abhaken und Abschnitt-Direktwahl laufen ueber Delegation, weil die
            // Karte bei jedem Schritt neu gezeichnet wird.
            this.nowBox.addEventListener('change', (event) => {
                const box = event.target.closest('[data-tick]');
                if (!box) {
                    return;
                }
                const step = this.steps[this.step];
                const unit = this.units[step.unitIndex];
                this.ticks[unit.id] = this.ticks[unit.id] || {};
                this.ticks[unit.id][box.getAttribute('data-tick')] = box.checked;
                box.closest('.live-check__item').classList.toggle('is-done', box.checked);
            });
            this.nowBox.addEventListener('click', (event) => {
                const head = event.target.closest('[data-section]');
                if (!head) {
                    return;
                }
                const wanted = Number(head.getAttribute('data-section'));
                const current = this.steps[this.step];
                const target = this.steps.findIndex((entry) => entry.unitIndex === current.unitIndex
                    && entry.sectionIndex === wanted);
                if (target >= 0) {
                    this.step = target;
                    this.render();
                }
            });

            document.addEventListener('keydown', (event) => this.onKey(event));
        }

        onKey(event) {
            if (this.stage.classList.contains('kg-hidden')) {
                return;
            }
            const tag = String((event.target && event.target.tagName) || '').toLowerCase();
            if (['input', 'textarea', 'select'].includes(tag) || event.metaKey || event.ctrlKey || event.altKey) {
                return;
            }
            if (['ArrowRight', 'PageDown', ' ', 'Spacebar'].includes(event.key)) {
                event.preventDefault();
                this.go(1);
            } else if (['ArrowLeft', 'PageUp'].includes(event.key)) {
                event.preventDefault();
                this.go(-1);
            }
        }

        isFullscreen() {
            return (document.fullscreenElement || document.webkitFullscreenElement) === this.shell;
        }

        syncFullscreenClass() {
            this.shell.classList.toggle('live-shell--fullscreen', this.isFullscreen());
        }

        toggleFullscreen() {
            // Vollbild auf der Huelle statt auf dem Dokument: so verschwinden
            // Kursnavigation und Tab-Leiste, die waehrend des Seminars stoeren.
            if (this.isFullscreen()) {
                const exit = document.exitFullscreen || document.webkitExitFullscreen;
                if (exit) {
                    exit.call(document);
                }
                return;
            }
            const request = this.shell.requestFullscreen || this.shell.webkitRequestFullscreen;
            if (!request) {
                this.setStatus('Dieser Browser kennt keinen Vollbildmodus.', true);
                return;
            }
            const started = request.call(this.shell);
            if (started && started.catch) {
                started.catch(() => {
                    this.setStatus('Der Vollbildmodus wurde vom Browser abgelehnt.', true);
                });
            }
        }
    }

    return {
        /**
         * Live-Ansicht starten.
         *
         * @param {Number} cmid Kursmodul-ID der Seminarplaner-Aktivitaet.
         */
        init: function(cmid) {
            new LiveView(Number(cmid) || 0);
        }
    };
});
