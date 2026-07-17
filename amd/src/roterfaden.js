// This file is part of Moodle - http://moodle.org/
//
// Roter Faden: der Seminarablauf als eine durchgehende Timeline.
//
// Datenquelle ist der veroeffentlichte Snapshot (mod_seminarplaner_get_roterfaden_state);
// Tage/Anker/Bloecke leitet roterfadenmodel daraus ab — dasselbe Modell, aus dem das
// Handout-PDF (handout.js) rechnet.
//
// Design: docs/design_handoff_seminarplaner/ROTER-FADEN.md
//
// @module mod_seminarplaner/roterfaden

define([
    'core/ajax',
    'core/notification',
    'mod_seminarplaner/roterfadenmodel',
    'mod_seminarplaner/handout'
], function(Ajax, Notification, Model, Handout) {
    const DAYS_ALL = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
    const DEFAULT_STYLE = 'modern'; // 'modern' | 'kompakt'
    const STYLE_STORAGE_KEY = 'kg_roterfaden_axis_theme';

    const bySel = (sel) => document.querySelector(sel);
    const asCall = (methodname, args) => Ajax.call([{methodname, args}])[0];

    const getTodayDayName = () => {
        const mondayBased = (new Date().getDay() + 6) % 7;
        return DAYS_ALL[mondayBased] || 'Montag';
    };

    const escapeHtml = (str) => String(str === null || str === undefined ? '' : str).replace(/[&<>"']/g, (ch) => {
        return ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[ch] || ch;
    });

    // Handoff: alle Glyphen sind gestrichene Inline-SVGs (24er-Viewbox,
    // stroke:currentColor) — so tragen sie die Farbe ihres Kontexts.
    const icon = (paths, size = 16, stroke = 1.8) => {
        return `<svg class="rf-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"`
            + ` stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"`
            + ` aria-hidden="true" focusable="false">${paths}</svg>`;
    };
    const ICONS = {
        calendar: () => icon('<rect x="3" y="4.5" width="18" height="16.5"/><path d="M8 2.5v4M16 2.5v4M3 10h18"/>', 15),
        sun: () => icon('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4'
            + 'M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>', 16),
        sunrise: () => icon('<path d="M12 9V2M4.9 11.9l1.4-1.4M2 19h20M17.7 10.5l1.4 1.4M22 15h-3M5 15H2'
            + 'M16 19a4 4 0 00-8 0"/>', 16),
        clock: () => icon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', 14),
        list: () => icon('<path d="M4 6h16M4 12h16M4 18h16"/>', 14, 2),
        chevron: () => icon('<path d="M6 9l6 6 6-6"/>', 14, 2.2),
    };

    class RoterFadenView {
        constructor(cmid, logo) {
            this.cmid = cmid;
            this.logo = logo || null;
            this.status = bySel('#kg-roterfaden-status');
            this.list = bySel('#kg-roterfaden-list');
            this.empty = bySel('#kg-roterfaden-empty');
            this.styleSelect = bySel('#kg-roterfaden-theme');
            this.handoutBtn = bySel('#kg-roterfaden-handout');
            this.days = [];
            this.emptyMessage = '';
            // Ansichtsdichte (Handoff): Modern = phasengetoente Kopfzeilen und
            // offene Themen, Kompakt = neutrale Kopfzeilen und zugeklappte Themen.
            this.rfStyle = DEFAULT_STYLE;
            // Pro Block gemerkte Abweichung vom Stil-Standard (Block-ID -> offen?).
            this.rfOpen = {};
            const stored = this.readStoredStyle();
            if (stored) {
                this.rfStyle = stored;
            }
            if (!this.list || !this.empty) {
                return;
            }
            this.bindStyleControl();
            this.bindToggles();
            this.bindHandout();
            this.init();
        }

        readStoredStyle() {
            if (typeof window === 'undefined' || !window.localStorage) {
                return '';
            }
            const stored = String(window.localStorage.getItem(STYLE_STORAGE_KEY) || '').toLowerCase().trim();
            // 'clean' war der frueher gespeicherte Name der kompakten Ansicht.
            if (stored === 'clean' || stored === 'kompakt') {
                return 'kompakt';
            }
            return stored === 'modern' ? 'modern' : '';
        }

        setStatus(text, isError = false) {
            if (!this.status) {
                return;
            }
            this.status.textContent = text || '';
            this.status.style.color = isError ? '#b91c1c' : '#166534';
        }

        // ---- Rendering -------------------------------------------------------

        isBlockOpen(block) {
            if (Object.prototype.hasOwnProperty.call(this.rfOpen, block.id)) {
                return !!this.rfOpen[block.id];
            }
            return this.rfStyle === 'modern';
        }

        renderTheme(theme) {
            const phase = theme.phase || '';
            const badge = phase
                ? `<span class="rf-badge rf-phase--${phase}">${escapeHtml(Model.PHASE_LABELS[phase])}</span>`
                : '';
            const dauer = theme.minutes
                ? `<span class="rf-theme__dur">${escapeHtml(Model.durationLabel(theme.minutes))}</span>`
                : '<span class="rf-theme__dur"></span>';
            return `
                <li class="rf-theme">
                    <span class="rf-dot${phase ? ` rf-phase--${phase}` : ''}" aria-hidden="true"></span>
                    <span class="rf-theme__title">${escapeHtml(theme.title)}</span>
                    ${badge}
                    ${dauer}
                </li>`;
        }

        renderBlock(block) {
            const open = this.isBlockOpen(block);
            const phaseclass = block.phase ? ` rf-phase--${block.phase}` : '';
            const continuation = block.continuation
                ? '<span class="rf-block__cont">Fortsetzung</span>'
                : '';
            return `
                <article class="rf-block${phaseclass}${open ? ' is-open' : ''}" data-rf-block="${escapeHtml(block.id)}">
                    <header class="rf-block__head">
                        <span class="rf-block__num">${block.num}.</span>
                        <h4 class="rf-block__title">${escapeHtml(block.title)}</h4>
                        ${continuation}
                    </header>
                    <div class="rf-block__body">
                        <div class="rf-block__meta">
                            <span class="rf-pill">${ICONS.clock()}<span>Uhrzeit: ${escapeHtml(Model.clockLabel(block.startMin))}</span></span>
                            <span class="rf-dur">${escapeHtml(Model.durationLabel(block.minutes))}</span>
                            <button type="button" class="rf-toggle" data-rf-toggle="${escapeHtml(block.id)}"
                                aria-expanded="${open ? 'true' : 'false'}" aria-controls="rf-themen-${escapeHtml(block.id)}">
                                ${ICONS.list()}<span>Themen (${block.themen.length})</span>${ICONS.chevron()}
                            </button>
                        </div>
                        <ul class="rf-themen" id="rf-themen-${escapeHtml(block.id)}">
                            ${block.themen.map((theme) => this.renderTheme(theme)).join('')}
                        </ul>
                    </div>
                </article>`;
        }

        renderAnchor(anchor) {
            const glyph = anchor.key === 'nachmittag' ? ICONS.sunrise() : ICONS.sun();
            const timespan = (anchor.start !== null && anchor.end !== null)
                ? `${Model.clockLabel(anchor.start)}–${Model.clockLabel(anchor.end)}`
                : '';
            return `
                <section class="rf-anchor">
                    <div class="rf-anchor__head">
                        <span class="rf-anchor__icon">${glyph}</span>
                        <span class="rf-anchor__name">${escapeHtml(anchor.name)}</span>
                        <span class="rf-anchor__time">${escapeHtml(timespan)}</span>
                    </div>
                    <div class="rf-blocks">
                        ${anchor.blocks.map((block) => this.renderBlock(block)).join('')}
                    </div>
                </section>`;
        }

        renderDay(day, isToday) {
            const countlabel = `${day.count} ${day.count === 1 ? 'Programmpunkt' : 'Programmpunkte'}`;
            return `
                <section class="rf-day${isToday ? ' is-today' : ''}">
                    <div class="rf-rail" aria-hidden="true"><span class="rf-node"></span></div>
                    <div class="rf-day__body">
                        <div class="rf-day__chiprow">
                            <span class="rf-daychip">${ICONS.calendar()}<span>${escapeHtml(day.name)}</span></span>
                            ${isToday ? '<span class="rf-today">Heute</span>' : ''}
                            <span class="rf-daycount">${escapeHtml(countlabel)}</span>
                        </div>
                        <div class="rf-daycard">
                            <span class="rf-dreieck" aria-hidden="true"></span>
                            ${day.anchors.map((anchor) => this.renderAnchor(anchor)).join('')}
                        </div>
                    </div>
                </section>`;
        }

        render() {
            if (!this.days.length) {
                this.list.innerHTML = '';
                this.empty.textContent = this.emptyMessage;
                this.empty.classList.remove('kg-hidden');
                return;
            }
            this.empty.classList.add('kg-hidden');
            this.empty.textContent = '';

            const today = getTodayDayName();
            this.list.innerHTML = `
                <div class="rf-timeline rf-timeline--${this.rfStyle}">
                    <span class="rf-thread" aria-hidden="true"></span>
                    ${this.days.map((day) => this.renderDay(day, day.name === today)).join('')}
                </div>`;
        }

        scrollToToday() {
            if (!this.list) {
                return;
            }
            const run = () => {
                const todayRow = this.list.querySelector('.rf-day.is-today');
                if (todayRow && typeof todayRow.scrollIntoView === 'function') {
                    todayRow.scrollIntoView({behavior: 'smooth', block: 'center', inline: 'nearest'});
                }
            };
            if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
                window.requestAnimationFrame(() => window.requestAnimationFrame(run));
                return;
            }
            setTimeout(run, 0);
        }

        bindStyleControl() {
            if (!this.styleSelect) {
                return;
            }
            this.styleSelect.value = this.rfStyle;
            this.styleSelect.addEventListener('change', () => {
                const next = String(this.styleSelect.value || '').toLowerCase().trim();
                if (next !== 'kompakt' && next !== 'modern') {
                    return;
                }
                this.rfStyle = next;
                // Stilwechsel setzt die Abweichungen einzelner Bloecke zurueck.
                this.rfOpen = {};
                if (typeof window !== 'undefined' && window.localStorage) {
                    window.localStorage.setItem(STYLE_STORAGE_KEY, this.rfStyle);
                }
                this.render();
            });
        }

        bindToggles() {
            this.list.addEventListener('click', (event) => {
                const button = event.target.closest('[data-rf-toggle]');
                if (!button || !this.list.contains(button)) {
                    return;
                }
                const id = button.getAttribute('data-rf-toggle');
                const block = this.list.querySelector(`[data-rf-block="${CSS.escape(id)}"]`);
                if (!block) {
                    return;
                }
                const open = !block.classList.contains('is-open');
                block.classList.toggle('is-open', open);
                button.setAttribute('aria-expanded', open ? 'true' : 'false');
                this.rfOpen[id] = open;
            });
        }

        // D64: Teilnehmende erzeugen das Handout hier selbst — der Roter-Faden-Tab
        // ist die einzige Seite, die sie sehen duerfen. Kein Umweg mehr ueber den
        // Import/Export-Tab (der ist Lehrenden vorbehalten).
        bindHandout() {
            if (!this.handoutBtn) {
                return;
            }
            this.handoutBtn.addEventListener('click', () => {
                if (this.handoutBtn.disabled) {
                    return;
                }
                this.handoutBtn.disabled = true;
                this.setStatus('Handout-PDF für Teilnehmende wird erstellt …', false);
                Handout.exportPdf(this.cmid, this.logo)
                    .then(() => this.setStatus('Handout-PDF erstellt.', false))
                    .catch((error) => {
                        this.setStatus(`Handout konnte nicht erstellt werden: ${error.message || error}`, true);
                    })
                    .then(() => {
                        this.handoutBtn.disabled = false;
                    });
            });
        }

        init() {
            this.emptyMessage = this.empty.getAttribute('data-empty-message') || '';
            asCall('mod_seminarplaner_get_roterfaden_state', {cmid: this.cmid}).then((roterfaden) => {
                let publishedstate = {};
                try {
                    publishedstate = roterfaden.statejson ? JSON.parse(roterfaden.statejson) : {};
                } catch (e) {
                    publishedstate = {};
                }
                if (!roterfaden.ispublished) {
                    this.days = [];
                    this.render();
                    this.setHandoutAvailable(false);
                    return;
                }
                this.days = Model.buildDays(publishedstate);
                this.render();
                this.setHandoutAvailable(this.days.length > 0);
                this.scrollToToday();
                const blocks = this.days.reduce((sum, day) => sum + day.count, 0);
                this.setStatus(`Roter Faden geladen (${blocks} Programmpunkte).`, false);
            }).catch((error) => {
                Notification.exception(error);
                this.days = [];
                this.render();
                this.setHandoutAvailable(false);
                this.setStatus('Roter Faden konnte nicht geladen werden.', true);
            });
        }

        // Ohne veroeffentlichten Ablauf gibt es nichts auszugeben.
        setHandoutAvailable(available) {
            if (!this.handoutBtn) {
                return;
            }
            this.handoutBtn.classList.toggle('kg-hidden', !available);
        }
    }

    return {
        init: function(cmid, logo) {
            return new RoterFadenView(cmid, logo);
        }
    };
});
