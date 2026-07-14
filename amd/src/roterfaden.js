// This file is part of Moodle - http://moodle.org/
//
// Roter Faden: der Seminarablauf als eine durchgehende Timeline.
//
// Datenquelle ist der veroeffentlichte Snapshot (mod_seminarplaner_get_roterfaden_state).
// Seit D20 ist die Sequenz die massgebliche Struktur; der Snapshot traegt sie als
// `sequenz` samt kompaktem Karten-Auszug (`methodcards`) fuer Phase und Titel.
// Aeltere Snapshots ohne Sequenz fallen auf `plan.days` (Legacy-Grid) zurueck und
// zeigen dann keine Phasen-Badges — ein erneutes Veroeffentlichen behebt das.
//
// Design: docs/design_handoff_seminarplaner/ROTER-FADEN.md
//
// @module mod_seminarplaner/roterfaden

define(['core/ajax', 'core/notification'], function(Ajax, Notification) {
    const DAYS_ALL = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
    const ANCHORS = ['vormittag', 'nachmittag'];
    const ANCHOR_LABELS = {vormittag: 'Vormittag', nachmittag: 'Nachmittag'};
    const DEFAULT_STYLE = 'modern'; // 'modern' | 'kompakt'
    const STYLE_STORAGE_KEY = 'kg_roterfaden_axis_theme';

    // Seminarphasen wie in sequenz.js/grid.js (gleiche Zuordnung, gleiche Palette).
    const PHASE_KEYS = [
        {key: 'orientierung', match: ['orientierung', 'warm-up', 'einstieg']},
        {key: 'erfahrung', match: ['erfahrung', 'erwartungsabfrage', 'vorwissen']},
        {key: 'analyse', match: ['analyse']},
        {key: 'handlung', match: ['handlung', 'aktion', 'praxis']},
        {key: 'transfer', match: ['transfer', 'abschluss', 'auswertung']},
    ];
    const PHASE_LABELS = {
        orientierung: 'Orientierung',
        erfahrung: 'Erfahrungserhebung',
        analyse: 'Analyse',
        handlung: 'Handlungsteil',
        transfer: 'Transfer',
    };

    const bySel = (sel) => document.querySelector(sel);
    const asCall = (methodname, args) => Ajax.call([{methodname, args}])[0];

    const phaseKey = (phase) => {
        const raw = Array.isArray(phase) ? phase.filter(Boolean).join(', ') : phase;
        const clean = String(raw || '').trim().toLowerCase();
        if (!clean) {
            return '';
        }
        const found = PHASE_KEYS.find((candidate) => candidate.match.some((m) => clean.includes(m)));
        return found ? found.key : '';
    };

    const parseClock = (value) => {
        if (!value) {
            return null;
        }
        const parts = String(value).split(':');
        const hh = Number.parseInt(parts[0], 10);
        const mm = Number.parseInt(parts[1], 10);
        return (Number.isFinite(hh) && Number.isFinite(mm)) ? ((hh * 60) + mm) : null;
    };
    const clockLabel = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

    // "20 Min" / "2 Std" / "1 Std 30 Min".
    const durationLabel = (minutes) => {
        const total = Math.max(0, Number(minutes) || 0);
        const h = Math.floor(total / 60);
        const m = total % 60;
        if (!h) {
            return `${m} Min`;
        }
        return m ? `${h} Std ${m} Min` : `${h} Std`;
    };

    // Deckungsgleich mit grid.js (deriveAnkerzeiten) und importexport.js: ohne
    // konfigurierte Ankerzeiten schneidet die laengste Pause den Tag.
    const deriveAnkerzeiten = (config) => {
        const cfg = config || {};
        const az = cfg.ankerzeiten;
        if (az && az.vormittag && az.nachmittag
                && parseClock(az.vormittag.start) !== null && parseClock(az.nachmittag.start) !== null) {
            return az;
        }
        const range = cfg.timeRange || {};
        const start = parseClock(range.start) === null ? '08:30' : range.start;
        const end = parseClock(range.end) === null ? '17:30' : range.end;
        let best = null;
        (Array.isArray(cfg.breaks) ? cfg.breaks : []).forEach((brk) => {
            if (!brk || parseClock(brk.start) === null) {
                return;
            }
            const duration = Math.max(0, Number(brk.duration) || 0);
            if (duration && (!best || duration > best.duration)) {
                best = {start: brk.start, duration};
            }
        });
        return {
            vormittag: {start: start, end: best ? best.start : '12:30'},
            nachmittag: {start: best ? clockLabel(parseClock(best.start) + best.duration) : '12:30', end: end},
            ersterTagNurNachmittag: false,
            letzterTagNurVormittag: false,
        };
    };

    const getTodayDayName = () => {
        const mondayBased = (new Date().getDay() + 6) % 7;
        return DAYS_ALL[mondayBased] || 'Montag';
    };

    const escapeHtml = (str) => String(str === null || str === undefined ? '' : str).replace(/[&<>"']/g, (ch) => {
        return ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[ch] || ch;
    });

    // Rich-Text-Unterthemen (Legacy-Bausteine) in einzelne Themen-Zeilen zerlegen.
    const splitTopics = (html) => {
        const withBreaks = String(html || '')
            .replace(/<\s*br\s*\/?\s*>/gi, '\n')
            .replace(/<\/\s*(?:p|div|li|tr|h[1-6])\s*>/gi, '\n')
            .replace(/<[^>]*>/g, ' ');
        const decoder = document.createElement('textarea');
        decoder.innerHTML = withBreaks;
        return (decoder.value || '')
            .split(/\r?\n/)
            .map((line) => line.replace(/^[\s\-–—*·•]+/, '').replace(/\s+/g, ' ').trim())
            .filter(Boolean);
    };

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
        constructor(cmid) {
            this.cmid = cmid;
            this.status = bySel('#kg-roterfaden-status');
            this.list = bySel('#kg-roterfaden-list');
            this.empty = bySel('#kg-roterfaden-empty');
            this.styleSelect = bySel('#kg-roterfaden-theme');
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

        // ---- Ableitung: Snapshot -> Tage/Anker/Bloecke -----------------------

        // Eine Platzierungs-Gruppe (aufeinanderfolgende Platzierungen desselben
        // Bausteins) ist ein Block — genau wie in der Sequenzansicht.
        buildFromSequence(state) {
            const seq = state.sequenz || {};
            const config = state.config || {};
            const placements = (seq.platzierungen && typeof seq.platzierungen === 'object') ? seq.platzierungen : {};
            const bausteine = (seq.bausteine && typeof seq.bausteine === 'object') ? seq.bausteine : {};
            const auswahlen = (seq.einheitenauswahlen && typeof seq.einheitenauswahlen === 'object')
                ? seq.einheitenauswahlen : {};
            const cards = new Map((Array.isArray(state.methodcards) ? state.methodcards : [])
                .map((card) => [String(card.id), card]));

            const az = deriveAnkerzeiten(config);
            const anchorFrame = {
                vormittag: {start: parseClock(az.vormittag.start), end: parseClock(az.vormittag.end)},
                nachmittag: {start: parseClock(az.nachmittag.start), end: parseClock(az.nachmittag.end)},
            };
            const tage = Array.isArray(seq.tage) ? seq.tage : [];
            const seenBausteine = {};
            const days = [];
            let num = 0;

            tage.forEach((tag, idx) => {
                const dayname = (tag && tag.bezeichnung && (config.days || []).includes(tag.bezeichnung))
                    ? tag.bezeichnung
                    : (config.days || [])[idx];
                if (!dayname) {
                    return;
                }
                // D45: An Anreise-/Abreisetagen entfaellt ein Anker vollstaendig.
                const off = {
                    vormittag: idx === 0 && !!az.ersterTagNurNachmittag,
                    nachmittag: idx === (tage.length - 1) && !!az.letzterTagNurVormittag,
                };
                const anchors = [];

                ANCHORS.forEach((ankername) => {
                    if (off[ankername]) {
                        return;
                    }
                    const frame = anchorFrame[ankername];
                    const pids = (((tag.anker || {})[ankername] || {}).sequenz) || [];
                    const items = pids
                        .map((pid) => ({pid: String(pid), data: placements[pid]}))
                        .filter((entry) => entry.data);

                    // Aufeinanderfolgende Platzierungen desselben Bausteins buendeln.
                    const groups = [];
                    items.forEach((entry) => {
                        const bid = entry.data.typ === 'einheit' ? (entry.data.bausteinid || null) : null;
                        const previous = groups.length ? groups[groups.length - 1] : null;
                        if (previous && bid && previous.bausteinid === bid) {
                            previous.items.push(entry);
                            return;
                        }
                        groups.push({bausteinid: bid, items: [entry]});
                    });

                    let clock = Number.isFinite(frame.start) ? frame.start : 0;
                    const blocks = [];
                    groups.forEach((group) => {
                        const groupminutes = group.items.reduce((sum, entry) => {
                            return sum + Math.max(0, Number(entry.data.dauer) || 0);
                        }, 0);
                        // Pausen sind keine Programmpunkte — sie ruecken die Uhr
                        // weiter, erscheinen aber nicht als Block.
                        if (group.items[0].data.typ === 'pause') {
                            clock += groupminutes;
                            return;
                        }

                        const baustein = group.bausteinid ? (bausteine[group.bausteinid] || null) : null;
                        const themen = group.items.map((entry) => {
                            const placement = entry.data;
                            const auswahl = placement.einheitenauswahl
                                ? (auswahlen[placement.einheitenauswahl] || null)
                                : null;
                            const aktiv = (auswahl && auswahl.aktiv !== null && auswahl.aktiv !== undefined)
                                ? String(auswahl.aktiv) : '';
                            const card = aktiv ? (cards.get(aktiv) || null) : null;
                            const title = String(placement.titel || '').trim()
                                || String((card && card.titel) || '').trim()
                                || String((baustein && baustein.titel) || '').trim()
                                || 'Seminareinheit';
                            return {
                                title: title,
                                phase: phaseKey(card ? card.seminarphase : ''),
                                minutes: Math.max(0, Number(placement.dauer) || 0),
                            };
                        });

                        const continuation = !!(group.bausteinid && seenBausteine[group.bausteinid]);
                        if (group.bausteinid) {
                            seenBausteine[group.bausteinid] = true;
                        }
                        num += 1;
                        blocks.push({
                            id: `${dayname}-${ankername}-${group.items[0].pid}`,
                            num: num,
                            title: (baustein && baustein.titel) ? String(baustein.titel) : themen[0].title,
                            continuation: continuation,
                            startMin: clock,
                            minutes: groupminutes,
                            phase: themen.find((theme) => theme.phase) ? themen[0].phase : '',
                            themen: themen,
                        });
                        clock += groupminutes;
                    });

                    if (blocks.length) {
                        anchors.push({
                            key: ankername,
                            name: ANCHOR_LABELS[ankername],
                            start: frame.start,
                            end: frame.end,
                            blocks: blocks,
                        });
                    }
                });

                if (anchors.length) {
                    days.push({
                        name: String(dayname),
                        anchors: anchors,
                        count: anchors.reduce((sum, anchor) => sum + anchor.blocks.length, 0),
                    });
                }
            });

            return days;
        }

        // Fallback fuer Snapshots aus der Zeit vor der Sequenz: jeder Grid-Eintrag
        // ist ein Block, seine Unterthemen werden zu Themen-Zeilen.
        buildFromPlan(state) {
            const plandays = ((state || {}).plan || {}).days || {};
            const config = (state || {}).config || {};
            const units = Array.isArray(((state || {}).planningState || {}).units)
                ? state.planningState.units : [];
            const daynames = Array.isArray(config.days) && config.days.length ? config.days : DAYS_ALL;
            const az = deriveAnkerzeiten(config);
            const middayCut = parseClock(az.nachmittag.start);
            const frames = {
                vormittag: {start: parseClock(az.vormittag.start), end: parseClock(az.vormittag.end)},
                nachmittag: {start: parseClock(az.nachmittag.start), end: parseClock(az.nachmittag.end)},
            };

            const resolveUnit = (entry) => {
                const slotkey = String(entry.slotkey || '').trim();
                if (slotkey) {
                    const variants = units.filter((unit) => String(unit.slotkey || '').trim() === slotkey);
                    if (variants.length) {
                        return variants.find((unit) => unit.active !== false) || variants[0];
                    }
                }
                const unitid = String(entry.unitid || '');
                return unitid ? (units.find((unit) => String(unit.id) === unitid) || null) : null;
            };

            const days = [];
            let num = 0;
            daynames.forEach((dayname) => {
                const list = (Array.isArray(plandays[dayname]) ? plandays[dayname] : [])
                    .filter((entry) => entry && entry.kind !== 'break')
                    .slice()
                    .sort((a, b) => (Number(a.startMin) || 0) - (Number(b.startMin) || 0));
                const buckets = {vormittag: [], nachmittag: []};

                list.forEach((entry) => {
                    const startMin = Number(entry.startMin) || 0;
                    const endMin = Number(entry.endMin) || startMin;
                    const unit = entry.kind === 'unit' ? resolveUnit(entry) : null;
                    const title = String((unit && unit.title) || entry.title || 'Seminareinheit');
                    const phase = phaseKey(entry.sqPhase || entry.phase || '');
                    const minutes = Math.max(0, endMin - startMin);
                    const topics = splitTopics((unit && unit.topics) || entry.topics || '');
                    const themen = topics.length
                        ? topics.map((topic) => ({title: topic, phase: phase, minutes: 0}))
                        : [{title: title, phase: phase, minutes: minutes}];
                    num += 1;
                    const anchorkey = (middayCut !== null && startMin >= middayCut) ? 'nachmittag' : 'vormittag';
                    buckets[anchorkey].push({
                        id: `${dayname}-${anchorkey}-${entry.uid || num}`,
                        num: num,
                        title: title,
                        continuation: false,
                        startMin: startMin,
                        minutes: minutes,
                        phase: phase,
                        themen: themen,
                    });
                });

                const anchors = ANCHORS
                    .filter((ankername) => buckets[ankername].length)
                    .map((ankername) => ({
                        key: ankername,
                        name: ANCHOR_LABELS[ankername],
                        start: frames[ankername].start,
                        end: frames[ankername].end,
                        blocks: buckets[ankername],
                    }));
                if (anchors.length) {
                    days.push({
                        name: String(dayname),
                        anchors: anchors,
                        count: anchors.reduce((sum, anchor) => sum + anchor.blocks.length, 0),
                    });
                }
            });

            return days;
        }

        buildDays(state) {
            const seq = (state || {}).sequenz;
            if (seq && Array.isArray(seq.tage) && seq.tage.length) {
                return this.buildFromSequence(state);
            }
            return this.buildFromPlan(state);
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
                ? `<span class="rf-badge rf-phase--${phase}">${escapeHtml(PHASE_LABELS[phase])}</span>`
                : '';
            const dauer = theme.minutes
                ? `<span class="rf-theme__dur">${escapeHtml(durationLabel(theme.minutes))}</span>`
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
                            <span class="rf-pill">${ICONS.clock()}<span>Uhrzeit: ${escapeHtml(clockLabel(block.startMin))}</span></span>
                            <span class="rf-dur">${escapeHtml(durationLabel(block.minutes))}</span>
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
                ? `${clockLabel(anchor.start)}–${clockLabel(anchor.end)}`
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
                    return;
                }
                this.days = this.buildDays(publishedstate);
                this.render();
                this.scrollToToday();
                const blocks = this.days.reduce((sum, day) => sum + day.count, 0);
                this.setStatus(`Roter Faden geladen (${blocks} Programmpunkte).`, false);
            }).catch((error) => {
                Notification.exception(error);
                this.days = [];
                this.render();
                this.setStatus('Roter Faden konnte nicht geladen werden.', true);
            });
        }
    }

    return {
        init: function(cmid) {
            return new RoterFadenView(cmid);
        }
    };
});
