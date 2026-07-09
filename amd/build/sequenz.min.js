// This file is part of Moodle - http://moodle.org/

/**
 * Sequence view (D3/D10/D11/D20) – ordered day view with editing.
 *
 * Renders the sequence section of a plan one day at a time: anchors
 * with a time budget bar, the midday break as a named divider, module
 * (Baustein) groupings with continuation detection and phase colours.
 *
 * Editing (workshop interactions, D42): reordering placements across
 * anchor and day boundaries, the guided overflow action (C1), module
 * variant pills (C2), unit alternative switching (C3), optional
 * headings (C7) and saving with a visible confirmation (C5).
 *
 * @module mod_seminarplaner/sequenz
 */
define(['core/ajax', 'core_user/repository'], function(Ajax, UserRepository) {
    const DEFAULT_BOUNDARY_MIN = 750; // 12:30 fallback, same rule as the PHP converter.
    const ANCHORS = ['vormittag', 'nachmittag'];

    const bySel = (sel) => document.querySelector(sel);
    const asCall = (methodname, args) => Ajax.call([{methodname, args}])[0];

    const escapeHtml = (str) => String(str || '').replace(/[&<>"']/g, (ch) => {
        return ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[ch] || ch;
    });

    const parseTimeToMinutes = (value) => {
        const parts = String(value || '').split(':');
        const hh = Number.parseInt(parts[0], 10);
        const mm = Number.parseInt(parts[1], 10);
        if (!Number.isFinite(hh) || !Number.isFinite(mm)) {
            return null;
        }
        return hh * 60 + mm;
    };

    const minutesToLabel = (min) => {
        const clean = Math.max(0, Math.round(min));
        return `${String(Math.floor(clean / 60)).padStart(2, '0')}:${String(clean % 60).padStart(2, '0')}`;
    };

    const cardTitle = (card) => String((card && (card.titel || card.title)) || '');

    // Themenplan topics arrive as HTML fragments; reduce them to plain lines.
    const htmlToLines = (html) => {
        const doc = document.createElement('div');
        doc.innerHTML = String(html || '')
            .replace(/<li[^>]*>/gi, '\n• ')
            .replace(/<br[^>]*>/gi, '\n')
            .replace(/<\/p>/gi, '\n');
        return doc.textContent.replace(/ /g, ' ').split('\n')
            .map((line) => line.trim()).filter(Boolean).join('\n');
    };

    const PHASE_KEYS = [
        {key: 'orientierung', match: ['orientierung', 'warm-up', 'einstieg']},
        {key: 'erfahrung', match: ['erfahrung', 'erwartungsabfrage', 'vorwissen']},
        {key: 'analyse', match: ['analyse']},
        {key: 'handlung', match: ['handlung', 'aktion', 'praxis']},
        {key: 'transfer', match: ['transfer', 'abschluss', 'auswertung']},
    ];

    const phaseKey = (phase) => {
        const clean = String(phase || '').trim().toLowerCase();
        if (!clean) {
            return '';
        }
        const found = PHASE_KEYS.find((candidate) => candidate.match.some((m) => clean.includes(m)));
        return found ? found.key : '';
    };

    const PHASE_LABELS = {
        orientierung: 'Orientierung',
        erfahrung: 'Erfahrungserhebung',
        analyse: 'Analyse',
        handlung: 'Handlungsteil',
        transfer: 'Transfer',
    };

    // D41: Bloom verb stems mapped to the seminar phase (Erfahrungserhebung
    // deliberately excluded - it is only found via keyword matching).
    const BLOOM_PHASES = [
        {phase: 'orientierung', stems: ['benenn', 'defini', 'nenn', 'aufzähl', 'wiedergeb']},
        {phase: 'analyse', stems: ['erklär', 'zusammenfass', 'vergleich', 'unterscheid', 'klassifizier', 'zerleg', 'analysier', 'einordn']},
        {phase: 'handlung', stems: ['anwend', 'ausführ', 'umsetz', 'durchführ', 'erprob', 'anleit']},
        {phase: 'transfer', stems: ['bewert', 'beurteil', 'einschätz', 'entwickel', 'gestalt', 'konzipier', 'reflektier', 'übertrag']},
    ];

    const STOPWORDS = ['eine', 'einer', 'eines', 'einem', 'einen', 'der', 'die', 'das', 'den', 'dem', 'des',
        'und', 'oder', 'für', 'nach', 'über', 'unter', 'beim', 'zum', 'zur', 'mit', 'ohne', 'sich', 'sind',
        'werden', 'wird', 'können', 'lernenden', 'teilnehmenden', 'sowie', 'auch', 'nicht', 'ist', 'als'];

    const tokenize = (text) => {
        return String(text || '').toLowerCase()
            .replace(/<[^>]+>/g, ' ')
            .split(/[^a-zäöüß]+/)
            .filter((word) => word.length > 3 && !STOPWORDS.includes(word));
    };

    class SequenzView {
        constructor(cmid) {
            this.cmid = cmid;
            this.gridid = 0;
            this.state = null;
            this.sequenz = null;
            this.versionhash = '';
            this.dirty = false;
            this.dayIndex = 0;
            this.legacyByUid = {};
            this.planningUnits = {};
            this.methodCards = {};
            this.methodCardList = [];
            this.openSwapPid = '';
            this.headingPid = '';
            this.idCounter = 0;
        }

        init() {
            const prev = bySel('#sq-prev-day');
            const next = bySel('#sq-next-day');
            if (prev) {
                prev.addEventListener('click', () => this.stepDay(-1));
            }
            if (next) {
                next.addEventListener('click', () => this.stepDay(1));
            }
            const select = bySel('#sq-grid-select');
            if (select) {
                select.addEventListener('change', () => {
                    const gridid = Number.parseInt(select.value, 10);
                    if (Number.isFinite(gridid) && gridid > 0) {
                        this.confirmDiscard() && this.loadState(gridid);
                    }
                });
            }
            const save = bySel('#sq-save');
            if (save) {
                save.addEventListener('click', () => this.save());
            }
            const container = bySel('#sq-day');
            if (container) {
                container.addEventListener('click', (event) => this.handleDayClick(event));
            }
            document.addEventListener('click', (event) => {
                if (!event.target.closest('.sq-swap') && this.openSwapPid) {
                    this.openSwapPid = '';
                    this.render();
                }
            });
            window.addEventListener('beforeunload', (event) => {
                if (this.dirty) {
                    event.preventDefault();
                    event.returnValue = '';
                }
            });
            this.initDramaToggle();
            this.loadGrids();
            this.loadEnrichment();
        }

        // D27: the toggle is a per-user setting across all plans.
        initDramaToggle() {
            this.dramaEnabled = true;
            const toggle = bySel('#sq-drama-toggle');
            if (!toggle) {
                return;
            }
            toggle.checked = true;
            UserRepository.getUserPreference('mod_seminarplaner_dramaturgie').then((value) => {
                this.dramaEnabled = !(value === '0' || value === 0 || value === false);
                toggle.checked = this.dramaEnabled;
                this.renderDrama();
            }).catch(() => null);
            toggle.addEventListener('change', () => {
                this.dramaEnabled = toggle.checked;
                this.renderDrama();
                UserRepository.setUserPreference('mod_seminarplaner_dramaturgie', this.dramaEnabled ? '1' : '0')
                    .catch(() => null);
            });
        }

        confirmDiscard() {
            return !this.dirty || window.confirm('Ungespeicherte Änderungen verwerfen?');
        }

        setStatus(text, isError = false) {
            const el = bySel('#sq-status');
            if (el) {
                el.textContent = text;
                el.style.color = isError ? '#b91c1c' : '#166534';
            }
        }

        toast(text) {
            const el = bySel('#sq-toast');
            if (!el) {
                return;
            }
            el.textContent = text;
            el.classList.add('show');
            window.clearTimeout(this.toastTimer);
            this.toastTimer = window.setTimeout(() => el.classList.remove('show'), 2600);
        }

        setDirty(dirty) {
            this.dirty = dirty;
            const save = bySel('#sq-save');
            if (save) {
                save.disabled = !dirty;
            }
        }

        loadGrids() {
            asCall('mod_seminarplaner_list_grids', {cmid: this.cmid}).then((res) => {
                const grids = (res.grids || []).filter((grid) => !Number(grid.isarchived));
                const select = bySel('#sq-grid-select');
                if (!select) {
                    return;
                }
                select.innerHTML = grids.map((grid) =>
                    `<option value="${Number(grid.id)}">${escapeHtml(grid.name)}</option>`).join('');
                if (!grids.length) {
                    this.setStatus('Noch kein Seminarplan vorhanden – lege zuerst im Überblick einen an.');
                    return;
                }
                this.loadState(Number(grids[0].id));
            }).catch(() => {
                this.setStatus('Seminarpläne konnten nicht geladen werden.', true);
            });
        }

        // Module master data (Unterthemen, contained units) still lives in the
        // planning state; unit details live in the method cards. Both are
        // resolved read-only for display until the sequence model carries them.
        loadEnrichment() {
            asCall('mod_seminarplaner_get_planning_state', {cmid: this.cmid}).then((res) => {
                let decoded = {};
                try {
                    decoded = JSON.parse(String(res.statejson || '{}')) || {};
                } catch (e) {
                    decoded = {};
                }
                (Array.isArray(decoded.units) ? decoded.units : []).forEach((unit) => {
                    if (unit && unit.id) {
                        this.planningUnits[String(unit.id)] = unit;
                    }
                });
                this.render();
            }).catch(() => null);
            asCall('mod_seminarplaner_get_method_cards', {cmid: this.cmid}).then((res) => {
                let decoded = [];
                try {
                    decoded = res.methodsjson ? JSON.parse(res.methodsjson) : [];
                } catch (e) {
                    decoded = [];
                }
                this.methodCardList = Array.isArray(decoded) ? decoded : [];
                this.methodCardList.forEach((card) => {
                    if (card && card.id !== undefined) {
                        this.methodCards[String(card.id)] = card;
                    }
                });
                this.render();
            }).catch(() => null);
        }

        loadState(gridid) {
            asCall('mod_seminarplaner_get_user_state', {cmid: this.cmid, gridid}).then((res) => {
                let state = {};
                try {
                    state = JSON.parse(String(res.statejson || '{}')) || {};
                } catch (e) {
                    state = {};
                }
                this.gridid = gridid;
                this.state = state;
                this.sequenz = (state && typeof state.sequenz === 'object' && state.sequenz) ? state.sequenz : null;
                this.ensureSequenzScaffold();
                this.versionhash = String(res.versionhash || '');
                this.dayIndex = 0;
                this.openSwapPid = '';
                this.headingPid = '';
                this.setDirty(false);
                this.indexLegacyEntries();
                this.render();
                this.maybeShowIntro();
            }).catch(() => {
                this.setStatus('Der Seminarplan konnte nicht geladen werden.', true);
            });
        }

        // D45: a plan freshly created via the setup templates has anchor
        // times but no sequence section yet - scaffold empty days from the
        // config so planning can start right away. Plans with legacy grid
        // entries are left to the server-side conversion (D43) instead.
        ensureSequenzScaffold() {
            if (this.sequenz || !this.state || typeof this.state !== 'object') {
                return;
            }
            const config = this.state.config || {};
            const days = Array.isArray(config.days) ? config.days.filter((d) => String(d || '') !== '') : [];
            if (!days.length) {
                return;
            }
            const plandays = (this.state.plan && this.state.plan.days) || {};
            const haslegacy = Object.keys(plandays).some((day) => {
                return (Array.isArray(plandays[day]) ? plandays[day] : []).some((entry) => {
                    return entry && (Number(entry.endMin) || 0) > (Number(entry.startMin) || 0);
                });
            });
            if (haslegacy) {
                return;
            }
            this.sequenz = {
                version: 1,
                tage: days.map((name, index) => ({
                    tag: index + 1,
                    bezeichnung: String(name),
                    anker: {
                        vormittag: {sequenz: []},
                        nachmittag: {sequenz: []},
                    },
                })),
                platzierungen: {},
                einheitenauswahlen: {},
                bausteine: {},
            };
            this.state.sequenz = this.sequenz;
        }

        // ---- One-time translation intro (D35) --------------------------------

        maybeShowIntro() {
            if (!this.sequenz || !this.dayCount()) {
                return;
            }
            const day = this.sequenz.tage[0];
            const legacyentries = this.legacyDayEntries(day.bezeichnung);
            const hasplacements = ANCHORS.some((a) => day.anker[a].sequenz.length > 0);
            if (!legacyentries.length || !hasplacements) {
                return;
            }
            const gridid = this.gridid;
            asCall('mod_seminarplaner_get_sequenz_intro', {cmid: this.cmid, gridid}).then((res) => {
                if (!res.seen && this.gridid === gridid) {
                    this.showIntro(day, legacyentries);
                }
            }).catch(() => null);
        }

        legacyDayEntries(dayname) {
            const days = (this.state && this.state.plan && this.state.plan.days) || {};
            const entries = (Array.isArray(days[dayname]) ? days[dayname] : [])
                .filter((entry) => entry && (Number(entry.endMin) || 0) > (Number(entry.startMin) || 0));
            entries.sort((a, b) => (Number(a.startMin) || 0) - (Number(b.startMin) || 0));
            return entries;
        }

        // "So war es": the old grid layout in miniature (D35) - a time
        // raster with proportionally placed blocks, like the Seminarplan tab.
        renderIntroGrid(legacyentries, frame) {
            const daystart = frame.start;
            const dayend = Math.max(frame.end, daystart + 60);
            const scale = 1.1; // Pixels per minute.
            const height = (dayend - daystart) * scale;

            const hours = [];
            for (let min = Math.ceil(daystart / 60) * 60; min <= dayend; min += 60) {
                hours.push(`
                    <div class="sq-intro__hour" style="top:${(min - daystart) * scale}px">
                      <span>${minutesToLabel(min)}</span>
                    </div>`);
            }

            const blocks = legacyentries.map((entry) => {
                const start = Math.max(daystart, Number(entry.startMin) || 0);
                const end = Math.min(dayend, Number(entry.endMin) || 0);
                if (end <= start) {
                    return '';
                }
                const isbreak = String(entry.kind || '') === 'break';
                const title = String(entry.title || (isbreak ? 'Pause' : 'Einheit'));
                return `
                    <div class="sq-intro__block${isbreak ? ' sq-intro__block--break' : ''}"
                      style="top:${(start - daystart) * scale}px; height:${Math.max(16, (end - start) * scale - 2)}px">
                      <span class="sq-intro__blocktime">${minutesToLabel(start)}–${minutesToLabel(end)}</span>
                      <span class="sq-intro__blocktitle">${escapeHtml(title)}</span>
                    </div>`;
            }).join('');

            return `<div class="sq-intro__grid" style="height:${height}px">${hours.join('')}${blocks}</div>`;
        }

        showIntro(day, legacyentries) {
            const root = this.modalRoot();
            const frame = this.dayFrame(0);
            const leftrows = this.renderIntroGrid(legacyentries, frame);
            const rightrows = ANCHORS.map((ankername) => {
                const isMorning = ankername === 'vormittag';
                let clock = isMorning ? frame.start : Math.max(frame.midday.end, frame.start);
                const rows = day.anker[ankername].sequenz.map((pid) => {
                    const placement = this.placement(pid);
                    if (!placement) {
                        return '';
                    }
                    const duration = Math.max(0, Number(placement.dauer) || 0);
                    const row = `
                        <div class="sq-intro__row">
                          <span class="sq-intro__time">${minutesToLabel(clock)}</span>
                          <span>${escapeHtml(placement.titel || 'Einheit')}</span>
                        </div>`;
                    clock += duration;
                    return row;
                }).join('');
                return `<div class="sq-intro__anchor">${isMorning ? 'Vormittag' : 'Nachmittag'}</div>${rows || '<div class="sq-intro__row sq-intro__row--empty">–</div>'}`;
            }).join('<div class="sq-intro__divider">Mittagspause</div>');

            root.innerHTML = `
                <div class="sq-modal sq-modal--intro">
                  <div class="sq-modal__head">
                    <h3>Dein Plan in der neuen Sequenzansicht</h3>
                  </div>
                  <div class="sq-modal__body">
                    <p class="sq-intro__lead">Dein Plan ist vollständig übernommen. Neu ist nur die Darstellung:
                      Statt fester Uhrzeiten bestimmt jetzt die <strong>Reihenfolge</strong> den Ablauf –
                      die Zeiten ergeben sich daraus von selbst. Hier dein erster Tag im Vergleich:</p>
                    <div class="sq-intro__columns">
                      <div class="sq-intro__col">
                        <h4>So war es (Tag ${Number(day.tag) || 1})</h4>
                        ${leftrows}
                      </div>
                      <div class="sq-intro__col sq-intro__col--new">
                        <h4>So ist es jetzt</h4>
                        ${rightrows}
                      </div>
                    </div>
                    <p class="sq-intro__note">Alle weiteren Tage sind nach demselben Muster übersetzt.
                      Es ist nichts verloren gegangen – du kannst direkt weiterplanen.</p>
                  </div>
                  <div class="sq-modal__footer">
                    <button type="button" class="kg-btn kg-btn-primary" data-sq-action="intro-done">Alles klar, weiter zur Planung</button>
                  </div>
                </div>`;
            root.classList.add('open');
        }

        finishIntro() {
            this.closeModal();
            asCall('mod_seminarplaner_mark_sequenz_intro_seen', {cmid: this.cmid, gridid: this.gridid}).catch(() => null);
        }

        save() {
            if (!this.state || !this.gridid) {
                return;
            }
            const payload = JSON.stringify(this.state);
            asCall('mod_seminarplaner_save_user_state', {
                cmid: this.cmid,
                gridid: this.gridid,
                statejson: payload,
                expectedhash: this.versionhash,
            }).then((res) => {
                this.versionhash = String(res.versionhash || res.newhash || this.versionhash);
                this.setDirty(false);
                this.toast('Gespeichert – Reihenfolge und Zeiten sind aktualisiert.');
            }).catch(() => {
                this.setStatus('Speichern hat nicht geklappt – bitte noch einmal versuchen.', true);
            });
        }

        indexLegacyEntries() {
            this.legacyByUid = {};
            const days = (this.state && this.state.plan && this.state.plan.days) || {};
            Object.keys(days).forEach((day) => {
                (Array.isArray(days[day]) ? days[day] : []).forEach((entry) => {
                    if (entry && entry.uid) {
                        this.legacyByUid[String(entry.uid)] = entry;
                    }
                });
            });
        }

        stepDay(delta) {
            const total = this.dayCount();
            if (!total) {
                return;
            }
            this.dayIndex = (this.dayIndex + delta + total) % total;
            this.openSwapPid = '';
            this.headingPid = '';
            this.render();
        }

        dayCount() {
            return this.sequenz && Array.isArray(this.sequenz.tage) ? this.sequenz.tage.length : 0;
        }

        // D45 migration rule for legacy configs: the longest configured
        // break counts as the midday break; without one, fallback 12:30.
        middayWindow(dayname) {
            const config = (this.state && this.state.config) || {};
            let best = null;
            (Array.isArray(config.breaks) ? config.breaks : []).forEach((brk) => {
                if (!brk || typeof brk !== 'object') {
                    return;
                }
                const applies = (Array.isArray(brk.days) ? brk.days : []).map(String);
                if (!applies.includes('all') && !applies.includes(String(dayname))) {
                    return;
                }
                const start = parseTimeToMinutes(brk.start);
                if (start === null) {
                    return;
                }
                const duration = Math.max(0, Number(brk.duration) || 0);
                const candidate = {start, end: start + duration, duration};
                if (!best || duration > best.duration
                    || (duration === best.duration
                        && Math.abs(start - DEFAULT_BOUNDARY_MIN) < Math.abs(best.start - DEFAULT_BOUNDARY_MIN))) {
                    best = candidate;
                }
            });
            return best || {start: DEFAULT_BOUNDARY_MIN, end: DEFAULT_BOUNDARY_MIN};
        }

        // D45: anchor times come from the setup templates (config.ankerzeiten);
        // legacy plans without them derive the frame from timeRange + breaks.
        // First/last day may drop one anchor (arrival/departure day).
        dayFrame(dayIdx) {
            const config = (this.state && this.state.config) || {};
            const tage = (this.sequenz && this.sequenz.tage) || [];
            const day = tage[dayIdx] || {};
            const az = config.ankerzeiten;
            const valid = az && az.vormittag && az.nachmittag
                && parseTimeToMinutes(az.vormittag.start) !== null && parseTimeToMinutes(az.vormittag.end) !== null
                && parseTimeToMinutes(az.nachmittag.start) !== null && parseTimeToMinutes(az.nachmittag.end) !== null;
            if (valid) {
                const vmStart = parseTimeToMinutes(az.vormittag.start);
                const vmEnd = parseTimeToMinutes(az.vormittag.end);
                const nmStart = parseTimeToMinutes(az.nachmittag.start);
                const nmEnd = parseTimeToMinutes(az.nachmittag.end);
                if (dayIdx === 0 && az.ersterTagNurNachmittag) {
                    return {start: nmStart, end: nmEnd, midday: {start: nmStart, end: nmStart}};
                }
                if (dayIdx === tage.length - 1 && az.letzterTagNurVormittag) {
                    return {start: vmStart, end: vmEnd, midday: {start: vmEnd, end: vmEnd}};
                }
                return {start: vmStart, end: nmEnd, midday: {start: vmEnd, end: nmStart}};
            }
            const range = config.timeRange || {};
            const start = parseTimeToMinutes(range.start);
            const end = parseTimeToMinutes(range.end);
            const midday = this.middayWindow(day.bezeichnung);
            return {
                start: start === null ? 510 : start,
                end: end === null ? 1050 : end,
                midday,
            };
        }

        placement(pid) {
            const all = (this.sequenz && this.sequenz.platzierungen) || {};
            return all[pid] || null;
        }

        baustein(bid) {
            const all = (this.sequenz && this.sequenz.bausteine) || {};
            return bid ? (all[bid] || null) : null;
        }

        auswahl(placement) {
            if (!placement || placement.typ !== 'einheit') {
                return null;
            }
            return ((this.sequenz && this.sequenz.einheitenauswahlen) || {})[placement.einheitenauswahl] || null;
        }

        isUnfilled(placement) {
            const auswahl = this.auswahl(placement);
            return placement.typ === 'einheit'
                && (!auswahl || !Array.isArray(auswahl.kandidaten) || !auswahl.kandidaten.length);
        }

        methodCardForRef(ref) {
            return this.methodCards[String(ref || '')] || null;
        }

        candidateLabel(ref) {
            const card = this.methodCardForRef(ref);
            if (card && cardTitle(card)) {
                return cardTitle(card);
            }
            return String(ref || '').replace(/^legacy:/, 'Eintrag ');
        }

        planningUnitForBaustein(baustein) {
            const unitid = baustein && baustein.quelle ? String(baustein.quelle.unitid || '') : '';
            return unitid ? (this.planningUnits[unitid] || null) : null;
        }

        placementPhase(placement) {
            const auswahl = this.auswahl(placement);
            if (auswahl && auswahl.aktiv !== null && auswahl.aktiv !== undefined) {
                const card = this.methodCardForRef(auswahl.aktiv);
                if (card && card.seminarphase) {
                    return phaseKey(card.seminarphase);
                }
            }
            const legacy = this.legacyEntryFor(placement);
            return legacy && legacy.phase ? phaseKey(legacy.phase) : '';
        }

        legacyEntryFor(placement) {
            const uids = (placement && placement.quelle && Array.isArray(placement.quelle.uids))
                ? placement.quelle.uids : [];
            for (const uid of uids) {
                const entry = this.legacyByUid[String(uid)];
                if (entry) {
                    return entry;
                }
            }
            return null;
        }

        // ---- Editing operations -------------------------------------------

        anchorList() {
            const list = [];
            (this.sequenz.tage || []).forEach((day, dayIdx) => {
                ANCHORS.forEach((ankername) => {
                    list.push({dayIdx, ankername, seq: day.anker[ankername].sequenz});
                });
            });
            return list;
        }

        locate(pid) {
            const anchors = this.anchorList();
            for (let i = 0; i < anchors.length; i++) {
                const pos = anchors[i].seq.indexOf(pid);
                if (pos >= 0) {
                    return {anchorIdx: i, pos, anchors};
                }
            }
            return null;
        }

        movePlacement(pid, delta) {
            const found = this.locate(pid);
            if (!found) {
                return;
            }
            const {anchorIdx, pos, anchors} = found;
            const seq = anchors[anchorIdx].seq;
            const target = pos + delta;
            if (target >= 0 && target < seq.length) {
                seq.splice(pos, 1);
                seq.splice(target, 0, pid);
            } else {
                const nextAnchorIdx = anchorIdx + delta;
                if (nextAnchorIdx < 0 || nextAnchorIdx >= anchors.length) {
                    return;
                }
                seq.splice(pos, 1);
                const nextSeq = anchors[nextAnchorIdx].seq;
                if (delta > 0) {
                    nextSeq.unshift(pid);
                } else {
                    nextSeq.push(pid);
                }
                const targetDay = this.sequenz.tage[anchors[nextAnchorIdx].dayIdx];
                this.setStatus(`Verschoben: jetzt am ${anchors[nextAnchorIdx].ankername === 'vormittag' ? 'Vormittag' : 'Nachmittag'} von Tag ${targetDay.tag}.`);
            }
            this.setDirty(true);
            this.render();
        }

        // C1: move trailing placements into the next anchor until the budget fits.
        resolveOverflow(ankername) {
            const frame = this.dayFrame(this.dayIndex);
            const anchors = this.anchorList();
            const anchorIdx = this.dayIndex * 2 + (ankername === 'vormittag' ? 0 : 1);
            const seq = anchors[anchorIdx].seq;
            if (anchorIdx + 1 >= anchors.length) {
                return;
            }
            const budget = this.anchorBudget(frame, ankername);
            const moved = [];
            while (seq.length && this.usedMinutes(seq) > budget) {
                moved.unshift(seq.pop());
            }
            if (!moved.length) {
                return;
            }
            const nextSeq = anchors[anchorIdx + 1].seq;
            nextSeq.unshift(...moved);
            const targetname = anchors[anchorIdx + 1].ankername === 'vormittag' ? 'Vormittag' : 'Nachmittag';
            const targetday = this.sequenz.tage[anchors[anchorIdx + 1].dayIdx];
            this.setStatus(`${moved.length === 1 ? 'Eine Einheit' : moved.length + ' Einheiten'} verschoben – läuft jetzt am ${targetname} von Tag ${targetday.tag} weiter.`);
            this.setDirty(true);
            this.render();
        }

        anchorBudget(frame, ankername) {
            const isMorning = ankername === 'vormittag';
            const start = isMorning ? frame.start : Math.max(frame.midday.end, frame.start);
            const end = isMorning ? Math.min(frame.midday.start, frame.end) : frame.end;
            return Math.max(0, end - start);
        }

        usedMinutes(seq) {
            return seq.reduce((sum, pid) => {
                const placement = this.placement(pid);
                return sum + (placement ? Math.max(0, Number(placement.dauer) || 0) : 0);
            }, 0);
        }

        // C3: switch the active candidate of a unit selection.
        chooseCandidate(pid, ref) {
            const placement = this.placement(pid);
            const auswahl = this.auswahl(placement);
            if (!auswahl || !auswahl.kandidaten.map(String).includes(String(ref))) {
                return;
            }
            auswahl.aktiv = ref;
            const card = this.methodCardForRef(ref);
            if (card) {
                if (cardTitle(card)) {
                    placement.titel = cardTitle(card);
                }
                const duration = Number.parseInt(String(card.zeitbedarf || '').replace(/\D+/g, ''), 10);
                if (Number.isFinite(duration) && duration > 0) {
                    placement.dauer = duration;
                }
            }
            this.openSwapPid = '';
            this.setDirty(true);
            this.render();
            this.toast('Alternative übernommen – Zeiten sind angepasst.');
        }

        // C2: activate a module variant and swap the contiguous run.
        chooseVariant(bid, vid) {
            const baustein = this.baustein(bid);
            const variante = baustein && baustein.varianten ? baustein.varianten[vid] : null;
            if (!baustein || !variante || baustein.aktivevariante === vid) {
                return;
            }
            const replacement = Array.isArray(variante.platzierungen) ? variante.platzierungen.slice() : [];
            const anchors = this.anchorList();
            for (const anchor of anchors) {
                const run = this.findRun(anchor.seq, bid);
                if (run) {
                    anchor.seq.splice(run.start, run.length, ...replacement);
                    baustein.aktivevariante = vid;
                    this.setDirty(true);
                    this.render();
                    this.toast(`Variante „${variante.titel || vid}" ist jetzt aktiv.`);
                    return;
                }
            }
        }

        findRun(seq, bid) {
            let start = -1;
            for (let i = 0; i < seq.length; i++) {
                const placement = this.placement(seq[i]);
                const matches = placement && placement.bausteinid === bid;
                if (matches && start < 0) {
                    start = i;
                }
                if (!matches && start >= 0) {
                    return {start, length: i - start};
                }
            }
            return start >= 0 ? {start, length: seq.length - start} : null;
        }

        // C7: give an unnamed placement a heading (creates a module, D10).
        createHeading(pid, titel) {
            const clean = String(titel || '').trim();
            const placement = this.placement(pid);
            if (!clean || !placement || placement.typ !== 'einheit') {
                return;
            }
            let counter = 1;
            while (this.sequenz.bausteine['bn' + counter]) {
                counter++;
            }
            const bid = 'bn' + counter;
            this.sequenz.bausteine[bid] = {
                titel: clean,
                unterthemen: '',
                themenplanreferenz: '',
                archiv: null,
                varianten: {},
                aktivevariante: null,
                quelle: {unitid: '', slotkey: ''},
            };
            placement.bausteinid = bid;
            this.headingPid = '';
            this.setDirty(true);
            this.render();
            this.toast(`Überschrift „${clean}" angelegt.`);
        }

        // ---- Removing and breaks --------------------------------------------

        removePlacement(pid) {
            const placement = this.placement(pid);
            const found = this.locate(pid);
            if (!placement || !found) {
                return;
            }
            const question = placement.typ === 'pause'
                ? 'Diese Pause aus dem Plan entfernen?'
                : 'Diese Einheit aus dem Plan entfernen? Der Bibliothekseintrag bleibt erhalten.';
            if (!window.confirm(question)) {
                return;
            }
            found.anchors[found.anchorIdx].seq.splice(found.pos, 1);
            const auswahlid = placement.einheitenauswahl;
            delete this.sequenz.platzierungen[pid];
            if (auswahlid && !this.auswahlInUse(auswahlid)) {
                delete this.sequenz.einheitenauswahlen[auswahlid];
            }
            this.setDirty(true);
            this.render();
            this.toast('Entfernt – die Zeiten sind nachgerückt.');
        }

        auswahlInUse(auswahlid) {
            return Object.keys(this.sequenz.platzierungen).some((pid) => {
                return String(this.sequenz.platzierungen[pid].einheitenauswahl || '') === String(auswahlid);
            });
        }

        addPause(ankername) {
            const day = this.sequenz.tage[this.dayIndex];
            if (!day) {
                return;
            }
            const pid = this.uniqueId('px', this.sequenz.platzierungen);
            this.sequenz.platzierungen[pid] = {
                typ: 'pause',
                titel: 'Pause',
                dauer: 15,
            };
            day.anker[ankername || 'vormittag'].sequenz.push(pid);
            this.setDirty(true);
            this.render();
            this.toast('Pause eingefügt (15 Min.) – über „Bearbeiten" anpassbar.');
        }

        // ---- Module membership (arrows keep position, this sets belonging) --

        adjacentBausteinId(pid) {
            const found = this.locate(pid);
            if (!found) {
                return null;
            }
            const seq = found.anchors[found.anchorIdx].seq;
            for (const neighborPos of [found.pos - 1, found.pos + 1]) {
                if (neighborPos < 0 || neighborPos >= seq.length) {
                    continue;
                }
                const neighbor = this.placement(seq[neighborPos]);
                if (neighbor && neighbor.typ === 'einheit' && neighbor.bausteinid) {
                    return neighbor.bausteinid;
                }
            }
            return null;
        }

        joinBaustein(pid) {
            const placement = this.placement(pid);
            const bid = this.adjacentBausteinId(pid);
            if (!placement || !bid) {
                return;
            }
            placement.bausteinid = bid;
            this.setDirty(true);
            this.render();
            this.toast(`In „${(this.baustein(bid) || {}).titel || 'Baustein'}" aufgenommen.`);
        }

        leaveBaustein(pid) {
            const placement = this.placement(pid);
            if (!placement || !placement.bausteinid) {
                return;
            }
            placement.bausteinid = null;
            this.setDirty(true);
            this.render();
            this.toast('Aus dem Baustein gelöst.');
        }

        // ---- Unit editor modal (D17/D21) ------------------------------------

        modalRoot() {
            let root = bySel('#sq-modal');
            if (!root) {
                root = document.createElement('div');
                root.id = 'sq-modal';
                root.className = 'sq-modal-overlay';
                document.body.appendChild(root);
                root.addEventListener('click', (event) => {
                    if (event.target === root) {
                        this.closeModal();
                        return;
                    }
                    const action = event.target.closest('[data-sq-action]');
                    if (!action) {
                        return;
                    }
                    const type = action.getAttribute('data-sq-action');
                    if (type === 'modal-close') {
                        this.closeModal();
                    } else if (type === 'editor-save') {
                        this.saveEditor();
                    } else if (type === 'picker-add') {
                        this.addUnitFromCard(action.getAttribute('data-cardid') || '');
                    } else if (type === 'intro-done') {
                        this.finishIntro();
                    } else if (type === 'baustein-save') {
                        this.saveBausteinEditor();
                    } else if (type === 'baustein-dissolve') {
                        this.dissolveBaustein(action.getAttribute('data-bid') || '');
                    } else if (type === 'quick-save') {
                        this.saveQuickCreate();
                    }
                });
            }
            return root;
        }

        closeModal() {
            const root = bySel('#sq-modal');
            if (root) {
                root.classList.remove('open');
                root.innerHTML = '';
            }
        }

        activeCardForPlacement(placement) {
            const auswahl = this.auswahl(placement);
            if (!auswahl || auswahl.aktiv === null || auswahl.aktiv === undefined) {
                return null;
            }
            return this.methodCardForRef(auswahl.aktiv);
        }

        fieldValue(card, key) {
            const value = card[key];
            if (Array.isArray(value)) {
                return value.map(String).join(', ');
            }
            return value === null || value === undefined ? '' : String(value);
        }

        openEditor(pid) {
            const placement = this.placement(pid);
            const card = placement ? this.activeCardForPlacement(placement) : null;
            if (!placement) {
                return;
            }
            this.editorPid = pid;
            const root = this.modalRoot();
            const text = (label, key, value, hint = '') => `
                <div class="sq-field">
                  <label class="kg-label">${label}</label>
                  <input type="text" class="kg-input" data-sq-field="${key}" value="${escapeHtml(value)}">
                  ${hint ? `<div class="sq-field__hint">${hint}</div>` : ''}
                </div>`;
            const area = (label, key, value, rows = 3) => `
                <div class="sq-field">
                  <label class="kg-label">${label}</label>
                  <textarea class="kg-input" rows="${rows}" data-sq-field="${key}">${escapeHtml(value)}</textarea>
                </div>`;

            let body;
            if (card) {
                body = `
                    ${text('Titel', 'titel', this.fieldValue(card, 'titel'))}
                    ${area('Lernziele (Ich kann …)', 'lernziele', this.fieldValue(card, 'lernziele'))}
                    ${area('Kurzbeschreibung', 'kurzbeschreibung', this.fieldValue(card, 'kurzbeschreibung'))}
                    ${text('Zeitbedarf (Minuten)', 'zeitbedarf', this.fieldValue(card, 'zeitbedarf'))}
                    ${text('Seminarphase', 'seminarphase', this.fieldValue(card, 'seminarphase'), 'Mehrere Phasen mit Komma trennen')}
                    ${text('Sozialform', 'sozialform', this.fieldValue(card, 'sozialform'))}
                    <details class="sq-section"><summary>Ablauf und Rahmen</summary><div class="sq-section__inner">
                      ${area('Ablauf', 'ablauf', this.fieldValue(card, 'ablauf'), 5)}
                      ${text('Raumanforderungen', 'raum', this.fieldValue(card, 'raum'))}
                      ${text('Gruppengröße', 'gruppengroesse', this.fieldValue(card, 'gruppengroesse'))}
                      ${area('Risiken/Tipps', 'risiken', this.fieldValue(card, 'risiken'))}
                      ${area('Debrief/Reflexionsfragen', 'debrief', this.fieldValue(card, 'debrief'))}
                      ${text('Tags/Schlüsselworte', 'tags', this.fieldValue(card, 'tags'), 'Hilft beim Wiederfinden und bei Vorschlägen')}
                      ${text('Autor*in / Kontakt', 'autor', this.fieldValue(card, 'autor'))}
                    </div></details>
                    <details class="sq-section"><summary>Materialien und Technik</summary><div class="sq-section__inner">
                      ${area('Material/Technik', 'materialtechnik', this.fieldValue(card, 'materialtechnik'))}
                      <div class="sq-field__hint">Datei-Anhänge verwaltest du weiterhin im Tab „Seminareinheiten".</div>
                    </div></details>`;
            } else {
                const ispause = placement.typ === 'pause';
                body = `
                    ${text('Titel', 'titel', placement.titel || '')}
                    ${text('Dauer (Minuten)', 'zeitbedarf', String(placement.dauer || ''))}
                    ${ispause ? '' : '<div class="sq-field__hint">Diese Einheit hat noch keinen Bibliothekseintrag – nur Titel und Dauer sind änderbar.</div>'}`;
            }

            root.innerHTML = `
                <div class="sq-modal">
                  <div class="sq-modal__head">
                    <h3>${placement.typ === 'pause' ? 'Pause bearbeiten' : 'Seminareinheit bearbeiten'}</h3>
                    <button type="button" class="sq-modal__close" data-sq-action="modal-close">✕</button>
                  </div>
                  <div class="sq-modal__body">${body}</div>
                  <div class="sq-modal__footer">
                    <button type="button" class="kg-btn" data-sq-action="modal-close">Abbrechen</button>
                    <button type="button" class="kg-btn kg-btn-primary" data-sq-action="editor-save">Übernehmen</button>
                  </div>
                </div>`;
            root.classList.add('open');
        }

        saveEditor() {
            const root = bySel('#sq-modal');
            const placement = this.placement(this.editorPid);
            if (!root || !placement) {
                return;
            }
            const values = {};
            root.querySelectorAll('[data-sq-field]').forEach((field) => {
                values[field.getAttribute('data-sq-field')] = field.value;
            });
            const card = this.activeCardForPlacement(placement);
            const duration = Number.parseInt(String(values.zeitbedarf || '').replace(/\D+/g, ''), 10);

            if (!card) {
                if (values.titel && values.titel.trim()) {
                    placement.titel = values.titel.trim();
                }
                if (Number.isFinite(duration) && duration > 0) {
                    placement.dauer = duration;
                }
                this.closeModal();
                this.setDirty(true);
                this.render();
                this.toast('Einheit angepasst – Zeiten sind aktualisiert.');
                return;
            }

            Object.keys(values).forEach((key) => {
                const incoming = values[key];
                if (Array.isArray(card[key])) {
                    card[key] = String(incoming).split(',').map((part) => part.trim()).filter(Boolean);
                } else {
                    card[key] = incoming;
                }
            });

            asCall('mod_seminarplaner_save_method_cards', {
                cmid: this.cmid,
                methodsjson: JSON.stringify(this.methodCardList),
            }).then(() => {
                // Live values flow back into every placement using this unit (D20).
                Object.keys(this.sequenz.platzierungen).forEach((pid) => {
                    const other = this.sequenz.platzierungen[pid];
                    const activecard = this.activeCardForPlacement(other);
                    if (activecard && String(activecard.id) === String(card.id)) {
                        other.titel = cardTitle(card) || other.titel;
                        if (Number.isFinite(duration) && duration > 0) {
                            other.dauer = duration;
                        }
                    }
                });
                this.closeModal();
                this.setDirty(true);
                this.render();
                this.toast('Gespeichert – Dauer geändert? Dann sind die Zeiten schon angepasst.');
            }).catch(() => {
                this.setStatus('Die Einheit konnte nicht gespeichert werden.', true);
            });
        }

        // ---- Module master data editor (owns the former Bausteine tab data) --

        openBausteinEditor(bid) {
            const baustein = this.baustein(bid);
            if (!baustein) {
                return;
            }
            this.editorBid = bid;
            const root = this.modalRoot();
            const referenz = htmlToLines(baustein.themenplanreferenz);
            root.innerHTML = `
                <div class="sq-modal">
                  <div class="sq-modal__head">
                    <h3>Baustein bearbeiten</h3>
                    <button type="button" class="sq-modal__close" data-sq-action="modal-close">✕</button>
                  </div>
                  <div class="sq-modal__body">
                    <div class="sq-field">
                      <label class="kg-label">Überschrift</label>
                      <input type="text" class="kg-input" data-sq-field="titel" value="${escapeHtml(baustein.titel || '')}">
                    </div>
                    <div class="sq-field">
                      <label class="kg-label">Unterthemen</label>
                      <textarea class="kg-input" rows="5" data-sq-field="unterthemen">${escapeHtml(htmlToLines(baustein.unterthemen))}</textarea>
                      <div class="sq-field__hint">Eine Zeile je Unterthema.</div>
                    </div>
                    ${referenz ? `
                    <div class="sq-field">
                      <label class="kg-label">Themenplan-Referenz (aus dem Import, nicht änderbar)</label>
                      <div class="sq-readonly">${escapeHtml(referenz)}</div>
                    </div>` : ''}
                  </div>
                  <div class="sq-modal__footer sq-modal__footer--split">
                    <button type="button" class="kg-btn sq-danger" data-sq-action="baustein-dissolve" data-bid="${escapeHtml(bid)}">Überschrift auflösen</button>
                    <span class="sq-modal__footer-gap"></span>
                    <button type="button" class="kg-btn" data-sq-action="modal-close">Abbrechen</button>
                    <button type="button" class="kg-btn kg-btn-primary" data-sq-action="baustein-save">Übernehmen</button>
                  </div>
                </div>`;
            root.classList.add('open');
        }

        saveBausteinEditor() {
            const root = bySel('#sq-modal');
            const baustein = this.baustein(this.editorBid);
            if (!root || !baustein) {
                return;
            }
            const titel = root.querySelector('[data-sq-field="titel"]');
            const unterthemen = root.querySelector('[data-sq-field="unterthemen"]');
            if (titel && titel.value.trim()) {
                baustein.titel = titel.value.trim();
            }
            if (unterthemen) {
                baustein.unterthemen = unterthemen.value.trim();
            }
            this.closeModal();
            this.setDirty(true);
            this.render();
            this.toast('Baustein aktualisiert.');
        }

        dissolveBaustein(bid) {
            const baustein = this.baustein(bid);
            if (!baustein) {
                return;
            }
            if (!window.confirm('Die Überschrift auflösen? Die Einheiten bleiben an ihrem Platz im Plan.')) {
                return;
            }
            Object.keys(this.sequenz.platzierungen).forEach((pid) => {
                if (String(this.sequenz.platzierungen[pid].bausteinid || '') === String(bid)) {
                    this.sequenz.platzierungen[pid].bausteinid = null;
                }
            });
            delete this.sequenz.bausteine[bid];
            this.closeModal();
            this.setDirty(true);
            this.render();
            this.toast('Überschrift aufgelöst – die Einheiten stehen weiter im Plan.');
        }

        // ---- Add unit from the library ---------------------------------------

        openPicker(ankername) {
            this.pickerAnker = ankername;
            const root = this.modalRoot();
            root.innerHTML = `
                <div class="sq-modal">
                  <div class="sq-modal__head">
                    <h3>Einheit hinzufügen</h3>
                    <button type="button" class="sq-modal__close" data-sq-action="modal-close">✕</button>
                  </div>
                  <div class="sq-modal__body">
                    <div class="sq-field">
                      <input type="text" class="kg-input" id="sq-picker-search" placeholder="Suchen …">
                    </div>
                    <div id="sq-picker-list" class="sq-picker"></div>
                  </div>
                </div>`;
            root.classList.add('open');
            const search = bySel('#sq-picker-search');
            if (search) {
                search.addEventListener('input', () => this.renderPickerList(search.value));
                search.focus();
            }
            this.renderPickerList('');
        }

        renderPickerList(filter) {
            const list = bySel('#sq-picker-list');
            if (!list) {
                return;
            }
            const needle = String(filter || '').trim().toLowerCase();
            const cards = this.methodCardList.filter((card) => {
                return !needle || cardTitle(card).toLowerCase().includes(needle);
            }).slice(0, 40);
            if (!cards.length) {
                list.innerHTML = '<div class="sq-empty">Keine passende Einheit gefunden.</div>';
                return;
            }
            list.innerHTML = cards.map((card) => {
                const duration = Number.parseInt(String(card.zeitbedarf || '').replace(/\D+/g, ''), 10);
                const phase = this.fieldValue(card, 'seminarphase');
                return `
                    <div class="sq-picker__row">
                      <div class="sq-unit__main">
                        <div class="sq-unit__title">${escapeHtml(cardTitle(card))}</div>
                        <div class="sq-unit__meta">
                          ${Number.isFinite(duration) && duration > 0 ? `<span class="sq-badge">${duration} Min.</span>` : ''}
                          ${phase ? `<span class="sq-badge">${escapeHtml(phase)}</span>` : ''}
                        </div>
                      </div>
                      <button type="button" class="kg-btn kg-btn-primary" data-sq-action="picker-add"
                        data-cardid="${escapeHtml(String(card.id))}">Übernehmen</button>
                    </div>`;
            }).join('');
        }

        uniqueId(prefix, collection) {
            let counter = this.idCounter + 1;
            while (collection[prefix + counter]) {
                counter++;
            }
            this.idCounter = counter;
            return prefix + counter;
        }

        addUnitFromCard(cardid) {
            const card = this.methodCardForRef(cardid);
            const day = this.sequenz.tage[this.dayIndex];
            if (!card || !day) {
                return;
            }
            const duration = Number.parseInt(String(card.zeitbedarf || '').replace(/\D+/g, ''), 10);
            const eaid = this.uniqueId('eax', this.sequenz.einheitenauswahlen);
            // D21: alternatives stored on the unit become preselected candidates.
            const alternativen = (Array.isArray(card.alternativen) ? card.alternativen : [])
                .map(String).filter((ref) => this.methodCards[ref]);
            this.sequenz.einheitenauswahlen[eaid] = {
                kandidaten: [String(card.id), ...alternativen],
                aktiv: String(card.id),
            };
            const pid = this.uniqueId('px', this.sequenz.platzierungen);
            this.sequenz.platzierungen[pid] = {
                typ: 'einheit',
                bausteinid: null,
                einheitenauswahl: eaid,
                titel: cardTitle(card),
                dauer: Number.isFinite(duration) && duration > 0 ? duration : 15,
            };
            day.anker[this.pickerAnker || 'vormittag'].sequenz.push(pid);
            this.closeModal();
            this.setDirty(true);
            this.render();
            this.toast(`„${cardTitle(card)}" hinzugefügt.`);
        }

        // ---- Dramaturgie-Blick (D15/D22/D23): hints only, silent gaps -------

        placementRawPhase(placement) {
            const card = this.activeCardForPlacement(placement);
            if (card && card.seminarphase) {
                return this.fieldValue(card, 'seminarphase');
            }
            const legacy = this.legacyEntryFor(placement);
            return legacy && legacy.phase ? String(legacy.phase) : '';
        }

        placementSozialform(placement) {
            const card = this.activeCardForPlacement(placement);
            return card ? this.fieldValue(card, 'sozialform') : '';
        }

        dayPlacements(day) {
            const list = [];
            ANCHORS.forEach((ankername) => {
                day.anker[ankername].sequenz.forEach((pid) => {
                    const placement = this.placement(pid);
                    if (placement) {
                        list.push({pid, ankername, data: placement});
                    }
                });
            });
            return list;
        }

        dramaFindings() {
            const findings = [];
            const day = this.sequenz.tage[this.dayIndex];
            if (!day) {
                return findings;
            }
            const daylabel = `Tag ${Number(day.tag) || this.dayIndex + 1}`;
            const dayitems = this.dayPlacements(day);
            const units = dayitems.filter((item) => item.data.typ === 'einheit' && !this.isUnfilled(item.data));

            // Regel 1 (Seminar): Phasenabdeckung - only speaks if phases exist.
            const allphases = {};
            let anyphase = false;
            this.sequenz.tage.forEach((tag) => {
                this.dayPlacements(tag).forEach((item) => {
                    const key = phaseKey(this.placementRawPhase(item.data));
                    if (key) {
                        allphases[key] = true;
                        anyphase = true;
                    }
                });
            });
            if (anyphase) {
                const missing = Object.keys(PHASE_LABELS).filter((key) => !allphases[key]);
                if (!missing.length) {
                    findings.push({ok: true, text: 'Alle fünf Phasen sind im Seminar vertreten.'});
                } else {
                    findings.push({ok: false, text: `Im Seminar ist noch Raum für: ${missing.map((k) => PHASE_LABELS[k]).join(', ')}.`});
                }
            }

            // Regel 6 (Tag): Einstieg am Morgen.
            const first = units[0];
            if (first) {
                const key = phaseKey(this.placementRawPhase(first.data));
                const title = String(first.data.titel || '').toLowerCase();
                const opener = ['orientierung', 'erfahrung'].includes(key)
                    || /ankomm|begrüß|einstieg|warm|kennenlern|orientier/.test(title);
                if (key || opener) {
                    findings.push(opener
                        ? {ok: true, text: `${daylabel} beginnt mit etwas Orientierendem oder Ankommendem.`}
                        : {ok: false, text: `${daylabel} könnte mit etwas Orientierendem oder Ankommendem starten.`});
                }
            }

            // Regel 2 (Tag): Aktivierung nach der Mittagspause.
            const afternoonfirst = units.find((item) => item.ankername === 'nachmittag');
            if (afternoonfirst) {
                const sozialform = this.placementSozialform(afternoonfirst.data).toLowerCase();
                if (sozialform) {
                    const inputlike = /vortrag|input|präsentation/.test(sozialform);
                    findings.push(inputlike
                        ? {ok: false, text: 'Nach der Mittagspause könnte etwas Aktivierendes guttun – die erste Einheit ist gerade eher Input.'}
                        : {ok: true, text: 'Nach der Mittagspause geht es aktivierend weiter.'});
                }
            }

            // Regel 4 (Tag): Tagesabschluss.
            const last = units[units.length - 1];
            if (last && units.length > 1) {
                const key = phaseKey(this.placementRawPhase(last.data));
                const title = String(last.data.titel || '').toLowerCase();
                const closing = key === 'transfer'
                    || /blitzlicht|feedback|abschluss|ausblick|auswertung|reflexion/.test(title);
                if (key || closing) {
                    findings.push(closing
                        ? {ok: true, text: `${daylabel} endet mit einer abschließenden Einheit.`}
                        : {ok: false, text: `${daylabel} könnte mit etwas Abschließendem enden (Blitzlicht, Feedback, Ausblick).`});
                }
            }

            // Regel 5 (Tag): Sozialform-Monotonie (> 120 Min. am Stück, D22).
            let runform = '';
            let runminutes = 0;
            let monotonie = '';
            dayitems.forEach((item) => {
                if (item.data.typ === 'pause') {
                    runform = '';
                    runminutes = 0;
                    return;
                }
                const sozialform = this.placementSozialform(item.data).toLowerCase();
                if (!sozialform) {
                    runform = '';
                    runminutes = 0;
                    return;
                }
                if (sozialform === runform) {
                    runminutes += Math.max(0, Number(item.data.dauer) || 0);
                } else {
                    runform = sozialform;
                    runminutes = Math.max(0, Number(item.data.dauer) || 0);
                }
                if (runminutes > 120 && !monotonie) {
                    monotonie = this.placementSozialform(item.data);
                }
            });
            if (monotonie) {
                findings.push({ok: false, text: `Mehr als zwei Stunden am Stück in derselben Sozialform (${monotonie}) – ein Wechsel könnte beleben.`});
            }

            // Regel 7 (Tag): Pausenhinweis - länger als 1,5 Std. ohne Pause (D23).
            ANCHORS.forEach((ankername) => {
                let streak = 0;
                let hinted = false;
                day.anker[ankername].sequenz.forEach((pid) => {
                    const placement = this.placement(pid);
                    if (!placement || hinted) {
                        return;
                    }
                    if (placement.typ === 'pause') {
                        streak = 0;
                        return;
                    }
                    streak += Math.max(0, Number(placement.dauer) || 0);
                    if (streak > 90) {
                        findings.push({ok: false, text: `Am ${ankername === 'vormittag' ? 'Vormittag' : 'Nachmittag'} läuft es länger als 1,5 Stunden ohne Pause – eine kurze Pause könnte guttun.`});
                        hinted = true;
                    }
                });
            });

            // Regel 3 (Seminar): Transfer am Ende.
            let lastunit = null;
            this.sequenz.tage.forEach((tag) => {
                this.dayPlacements(tag).forEach((item) => {
                    if (item.data.typ === 'einheit' && !this.isUnfilled(item.data)) {
                        lastunit = item;
                    }
                });
            });
            if (lastunit) {
                const key = phaseKey(this.placementRawPhase(lastunit.data));
                if (key) {
                    findings.push(key === 'transfer'
                        ? {ok: true, text: 'Das Seminar endet mit einer Transfer-Einheit.'}
                        : {ok: false, text: 'Zum Seminarende könnte eine Transfer-Einheit den Bogen in die Praxis schlagen.'});
                }
            }

            return findings;
        }

        renderDrama() {
            const panel = bySel('#sq-drama');
            if (!panel) {
                return;
            }
            if (!this.dramaEnabled || !this.sequenz || !this.dayCount()) {
                panel.innerHTML = '';
                panel.classList.remove('sq-drama--visible');
                return;
            }
            const findings = this.dramaFindings();
            if (!findings.length) {
                panel.innerHTML = '';
                panel.classList.remove('sq-drama--visible');
                return;
            }
            panel.classList.add('sq-drama--visible');
            panel.innerHTML = `
                <h4>Dramaturgie-Blick</h4>
                ${findings.map((finding) => `
                    <div class="sq-drama__item sq-drama__item--${finding.ok ? 'ok' : 'hint'}">
                      <span class="sq-drama__icon">${finding.ok ? '✓' : '💡'}</span>
                      <span>${escapeHtml(finding.text)}</span>
                    </div>`).join('')}`;
        }

        // ---- Vorschlagsmechanik (D14/D41) ------------------------------------

        contextKeywords(baustein) {
            if (!baustein) {
                return [];
            }
            return [...new Set([
                ...tokenize(baustein.titel),
                ...tokenize(baustein.unterthemen),
                ...tokenize(baustein.themenplanreferenz),
            ])];
        }

        bloomPhasesFor(text) {
            const clean = String(text || '').toLowerCase();
            const phases = [];
            BLOOM_PHASES.forEach((entry) => {
                if (entry.stems.some((stem) => clean.includes(stem))) {
                    phases.push(entry.phase);
                }
            });
            return phases;
        }

        cardDuration(card) {
            const duration = Number.parseInt(String(card.zeitbedarf || '').replace(/\D+/g, ''), 10);
            return Number.isFinite(duration) && duration > 0 ? duration : null;
        }

        // Hard filter: duration fits. Soft ranking: keywords + Bloom phase.
        suggestFor(gapminutes, keywords, bloomphases, excluderefs) {
            const scored = [];
            this.methodCardList.forEach((card) => {
                const duration = this.cardDuration(card);
                if (duration === null || duration > gapminutes) {
                    return;
                }
                if (excluderefs.includes(String(card.id))) {
                    return;
                }
                const haystack = (cardTitle(card) + ' ' + this.fieldValue(card, 'kurzbeschreibung') + ' '
                    + this.fieldValue(card, 'tags')).toLowerCase();
                const hits = keywords.filter((word) => haystack.includes(word));
                const cardphase = phaseKey(this.fieldValue(card, 'seminarphase'));
                const phasematch = cardphase && bloomphases.includes(cardphase);
                const reasons = [`${duration} Min.`];
                if (this.fieldValue(card, 'seminarphase')) {
                    reasons.push(this.fieldValue(card, 'seminarphase'));
                }
                if (hits.length) {
                    reasons.push(`Stichwort „${hits[0]}"`);
                }
                if (phasematch) {
                    reasons.push('passt zur erwarteten Phase');
                }
                scored.push({
                    card,
                    duration,
                    score: hits.length * 2 + (phasematch ? 3 : 0),
                    reason: reasons.join(' · '),
                });
            });
            scored.sort((a, b) => {
                if (a.score !== b.score) {
                    return b.score - a.score;
                }
                if (a.duration !== b.duration) {
                    return b.duration - a.duration;
                }
                return cardTitle(a.card).localeCompare(cardTitle(b.card));
            });
            return scored.slice(0, 4);
        }

        renderSuggestions(gapminutes, baustein, targetattrs) {
            const keywords = this.contextKeywords(baustein);
            const bloomphases = baustein ? this.bloomPhasesFor(baustein.themenplanreferenz) : [];
            const suggestions = this.suggestFor(gapminutes, keywords, bloomphases, []);
            const title = baustein
                ? `Hier ist noch Platz für ca. ${gapminutes} Min. – Vorschläge aus deiner Bibliothek:`
                : `In diesem Abschnitt sind noch ca. ${gapminutes} Min. frei – Vorschläge aus deiner Bibliothek:`;

            const cards = suggestions.map((entry) => `
                <div class="sq-suggest__card">
                  <div class="sq-unit__title">${escapeHtml(cardTitle(entry.card))}</div>
                  <div class="sq-suggest__why">${escapeHtml(entry.reason)}</div>
                  <button type="button" class="kg-btn" data-sq-action="suggest-add"
                    data-cardid="${escapeHtml(String(entry.card.id))}" ${targetattrs}>Übernehmen</button>
                </div>`).join('');

            const empty = suggestions.length ? '' : `
                <div class="sq-suggest__empty">In der Bibliothek passt gerade nichts in diese Lücke –
                  leg direkt eine neue Einheit an.</div>`;

            return `
                <div class="sq-gap">
                  <div class="sq-gap__title">${escapeHtml(title)}</div>
                  <div class="sq-suggest">${cards}</div>
                  ${empty}
                  <button type="button" class="kg-btn" data-sq-action="quick-create" ${targetattrs}>＋ Neue Einheit anlegen</button>
                </div>`;
        }

        // Insert a unit into a reserved module: the reservation shrinks.
        addCardToBaustein(cardid, placeholderpid) {
            const placeholder = this.placement(placeholderpid);
            const card = this.methodCardForRef(cardid);
            const found = this.locate(placeholderpid);
            if (!placeholder || !card || !found) {
                return;
            }
            const duration = this.cardDuration(card) || 15;
            const eaid = this.uniqueId('eax', this.sequenz.einheitenauswahlen);
            const alternativen = (Array.isArray(card.alternativen) ? card.alternativen : [])
                .map(String).filter((ref) => this.methodCards[ref]);
            this.sequenz.einheitenauswahlen[eaid] = {kandidaten: [String(card.id), ...alternativen], aktiv: String(card.id)};
            const pid = this.uniqueId('px', this.sequenz.platzierungen);
            this.sequenz.platzierungen[pid] = {
                typ: 'einheit',
                bausteinid: placeholder.bausteinid || null,
                einheitenauswahl: eaid,
                titel: cardTitle(card),
                dauer: duration,
            };
            const seq = found.anchors[found.anchorIdx].seq;
            seq.splice(found.pos, 0, pid);
            const rest = Math.max(0, (Number(placeholder.dauer) || 0) - duration);
            if (rest > 0) {
                placeholder.dauer = rest;
            } else {
                const newpos = seq.indexOf(placeholderpid);
                if (newpos >= 0) {
                    seq.splice(newpos, 1);
                }
                const auswahlid = placeholder.einheitenauswahl;
                delete this.sequenz.platzierungen[placeholderpid];
                if (auswahlid && !this.auswahlInUse(auswahlid)) {
                    delete this.sequenz.einheitenauswahlen[auswahlid];
                }
            }
            this.setDirty(true);
            this.render();
            this.toast(`„${cardTitle(card)}" übernommen.`);
        }

        openQuickCreate(targetattrs) {
            this.quickTarget = targetattrs;
            const root = this.modalRoot();
            root.innerHTML = `
                <div class="sq-modal">
                  <div class="sq-modal__head">
                    <h3>Neue Einheit anlegen</h3>
                    <button type="button" class="sq-modal__close" data-sq-action="modal-close">✕</button>
                  </div>
                  <div class="sq-modal__body">
                    <div class="sq-field">
                      <label class="kg-label">Titel</label>
                      <input type="text" class="kg-input" id="sq-quick-titel">
                    </div>
                    <div class="sq-field">
                      <label class="kg-label">Dauer (Minuten)</label>
                      <input type="text" class="kg-input" id="sq-quick-dauer" value="30">
                    </div>
                    <div class="sq-field__hint">Alles Weitere (Ablauf, Phase, Material …) kannst du später über „Bearbeiten" ergänzen.</div>
                  </div>
                  <div class="sq-modal__footer">
                    <button type="button" class="kg-btn" data-sq-action="modal-close">Abbrechen</button>
                    <button type="button" class="kg-btn kg-btn-primary" data-sq-action="quick-save">Anlegen und einplanen</button>
                  </div>
                </div>`;
            root.classList.add('open');
            const input = bySel('#sq-quick-titel');
            if (input) {
                input.focus();
            }
        }

        saveQuickCreate() {
            const titel = (bySel('#sq-quick-titel') || {value: ''}).value.trim();
            const dauer = Number.parseInt((bySel('#sq-quick-dauer') || {value: ''}).value.replace(/\D+/g, ''), 10);
            if (!titel) {
                return;
            }
            const card = {
                id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
                titel,
                seminarphase: [],
                zeitbedarf: String(Number.isFinite(dauer) && dauer > 0 ? dauer : 30),
                gruppengroesse: [],
                kurzbeschreibung: '',
                sozialform: [],
                tags: [],
                alternativen: [],
            };
            this.methodCardList.push(card);
            this.methodCards[String(card.id)] = card;
            asCall('mod_seminarplaner_save_method_cards', {
                cmid: this.cmid,
                methodsjson: JSON.stringify(this.methodCardList),
            }).then(() => {
                this.closeModal();
                this.applySuggestTarget(String(card.id), this.quickTarget || {});
            }).catch(() => {
                this.setStatus('Die neue Einheit konnte nicht angelegt werden.', true);
            });
        }

        applySuggestTarget(cardid, target) {
            if (target.pid) {
                this.addCardToBaustein(cardid, target.pid);
            } else {
                this.pickerAnker = target.anker || 'vormittag';
                this.addUnitFromCard(cardid);
            }
        }

        // ---- Event delegation ---------------------------------------------

        handleDayClick(event) {
            const action = event.target.closest('[data-sq-action]');
            if (!action) {
                return;
            }
            const type = action.getAttribute('data-sq-action');
            const pid = action.getAttribute('data-pid') || '';
            if (type === 'move-up') {
                this.movePlacement(pid, -1);
            } else if (type === 'move-down') {
                this.movePlacement(pid, 1);
            } else if (type === 'overflow') {
                this.resolveOverflow(action.getAttribute('data-anker') || 'vormittag');
            } else if (type === 'swap-toggle') {
                this.openSwapPid = this.openSwapPid === pid ? '' : pid;
                this.render();
            } else if (type === 'swap-choose') {
                this.chooseCandidate(pid, action.getAttribute('data-ref') || '');
            } else if (type === 'variant') {
                this.chooseVariant(action.getAttribute('data-bid') || '', action.getAttribute('data-vid') || '');
            } else if (type === 'heading-open') {
                this.headingPid = pid;
                this.render();
                const input = bySel('#sq-heading-input');
                if (input) {
                    input.focus();
                }
            } else if (type === 'heading-cancel') {
                this.headingPid = '';
                this.render();
            } else if (type === 'heading-save') {
                const input = bySel('#sq-heading-input');
                this.createHeading(pid, input ? input.value : '');
            } else if (type === 'edit') {
                this.openEditor(pid);
            } else if (type === 'add-unit') {
                this.openPicker(action.getAttribute('data-anker') || 'vormittag');
            } else if (type === 'join-baustein') {
                this.joinBaustein(pid);
            } else if (type === 'leave-baustein') {
                this.leaveBaustein(pid);
            } else if (type === 'remove') {
                this.removePlacement(pid);
            } else if (type === 'add-pause') {
                this.addPause(action.getAttribute('data-anker') || 'vormittag');
            } else if (type === 'edit-baustein') {
                this.openBausteinEditor(action.getAttribute('data-bid') || '');
            } else if (type === 'suggest-add') {
                this.applySuggestTarget(action.getAttribute('data-cardid') || '', {
                    pid: action.getAttribute('data-pid') || '',
                    anker: action.getAttribute('data-anker') || '',
                });
            } else if (type === 'quick-create') {
                this.openQuickCreate({
                    pid: action.getAttribute('data-pid') || '',
                    anker: action.getAttribute('data-anker') || '',
                });
            }
        }

        // ---- Rendering ----------------------------------------------------

        render() {
            const container = bySel('#sq-day');
            const label = bySel('#sq-day-label');
            if (!container) {
                return;
            }
            if (!this.sequenz || !this.dayCount()) {
                container.innerHTML = '';
                if (label) {
                    label.textContent = '—';
                }
                if (this.state) {
                    this.setStatus('Für diesen Seminarplan gibt es noch keine Sequenzdaten.');
                }
                return;
            }

            const day = this.sequenz.tage[this.dayIndex];
            if (label) {
                label.textContent = `Tag ${Number(day.tag) || this.dayIndex + 1} · ${day.bezeichnung || ''}`;
            }

            const seenBausteine = this.bausteineSeenBeforeCurrentDay();
            const frame = this.dayFrame(this.dayIndex);
            const morning = this.renderAnchor(day, 'vormittag', frame, seenBausteine);
            const divider = `
                <div class="sq-break-divider"><span>🕐 Mittagspause</span></div>`;
            const afternoon = this.renderAnchor(day, 'nachmittag', frame, seenBausteine);
            container.innerHTML = morning + divider + afternoon;
            this.renderDrama();
        }

        bausteineSeenBeforeCurrentDay() {
            const seen = {};
            for (let i = 0; i < this.dayIndex; i++) {
                const day = this.sequenz.tage[i];
                ANCHORS.forEach((ankername) => {
                    const seq = (((day.anker || {})[ankername] || {}).sequenz) || [];
                    seq.forEach((pid) => {
                        const placement = this.placement(pid);
                        if (placement && placement.bausteinid) {
                            seen[String(placement.bausteinid)] = true;
                        }
                    });
                });
            }
            return seen;
        }

        renderAnchor(day, ankername, frame, seenBausteine) {
            const seq = (((day.anker || {})[ankername] || {}).sequenz) || [];
            const isMorning = ankername === 'vormittag';
            const anchorStart = isMorning ? frame.start : Math.max(frame.midday.end, frame.start);
            const anchorEnd = isMorning ? Math.min(frame.midday.start, frame.end) : frame.end;
            const budget = Math.max(0, anchorEnd - anchorStart);

            const placements = seq.map((pid) => ({pid, data: this.placement(pid)})).filter((p) => p.data);
            const used = placements.reduce((sum, p) => sum + Math.max(0, Number(p.data.dauer) || 0), 0);
            const over = used - budget;
            const fillpct = budget > 0 ? Math.min(100, Math.round((used / budget) * 100)) : (used > 0 ? 100 : 0);

            const title = isMorning ? 'Vormittag' : 'Nachmittag';
            // D45: on arrival/departure days one anchor has no time span.
            const anchoroff = budget === 0 && anchorStart >= anchorEnd;
            const timespan = anchoroff
                ? `entfällt (${isMorning ? 'Anreisetag' : 'Abreisetag'})`
                : `${minutesToLabel(anchorStart)}–${minutesToLabel(anchorEnd)}`;
            const overtarget = isMorning ? 'der Mittagspause' : 'dem Tagesende';
            let budgetlabel = over > 0
                ? `+${over} Min. über ${overtarget}`
                : `${used} von ${budget} Min. belegt`;
            if (anchoroff) {
                budgetlabel = used > 0 ? `${used} Min. in einem entfallenden Abschnitt` : '';
            }

            let body = this.renderSequence(placements, anchorStart, seenBausteine);
            if (!placements.length) {
                body = anchoroff
                    ? '<div class="sq-empty">Dieser Abschnitt entfällt an diesem Tag.</div>'
                    : '<div class="sq-empty">Noch keine Einheiten in diesem Abschnitt.</div>';
            }

            const hasNext = this.dayIndex * 2 + (isMorning ? 0 : 1) + 1 < this.dayCount() * 2;
            const movetarget = isMorning ? 'auf den Nachmittag' : 'auf den nächsten Vormittag';
            const overrun = over > 0
                ? `<div class="sq-overrun">
                     <span><strong>+${over} Min. über ${overtarget}.</strong>
                       Die letzte Einheit könnte ${movetarget} verschoben werden.</span>
                     ${hasNext ? `<button type="button" class="kg-btn kg-btn-primary" data-sq-action="overflow" data-anker="${ankername}">
                       ${isMorning ? 'Auf den Nachmittag verschieben' : 'Auf den nächsten Tag verschieben'}</button>` : ''}
                   </div>`
                : '';

            // D14: a free gap in the anchor offers explained suggestions.
            const freegap = budget - used;
            const gapbox = (over <= 0 && freegap >= 15 && placements.length && this.methodCardList.length)
                ? this.renderSuggestions(freegap, null, `data-anker="${ankername}"`)
                : '';

            const addbutton = `
                <div class="sq-anchor__add">
                  <button type="button" class="kg-btn" data-sq-action="add-unit" data-anker="${ankername}">＋ Einheit hinzufügen</button>
                  <button type="button" class="kg-btn" data-sq-action="add-pause" data-anker="${ankername}">＋ Pause</button>
                </div>`;

            return `
                <div class="sq-anchor" data-anker="${ankername}">
                  <div class="sq-anchor__head">
                    <div class="sq-anchor__title">${title} <span class="sq-anchor__time">${timespan}</span></div>
                    <div class="sq-budget">
                      <div class="sq-budget__bar"><div class="sq-budget__fill${over > 0 ? ' sq-budget__fill--over' : ''}" style="width:${fillpct}%"></div></div>
                      <div class="sq-budget__label">${escapeHtml(budgetlabel)}</div>
                    </div>
                  </div>
                  <div class="sq-anchor__body">${body}${overrun}${gapbox}${addbutton}</div>
                </div>`;
        }

        renderSequence(placements, anchorStart, seenBausteine) {
            const groups = [];
            placements.forEach((p) => {
                const bid = p.data.typ === 'einheit' ? (p.data.bausteinid || null) : null;
                const previous = groups.length ? groups[groups.length - 1] : null;
                if (previous && bid && previous.bausteinid === bid) {
                    previous.items.push(p);
                    return;
                }
                groups.push({bausteinid: bid, items: [p]});
            });

            let clock = anchorStart;
            return groups.map((group) => {
                const start = clock;
                const duration = group.items.reduce((sum, p) => sum + Math.max(0, Number(p.data.dauer) || 0), 0);
                clock += duration;

                if (!group.bausteinid) {
                    return group.items.map((p, index) => {
                        const itemstart = start + group.items.slice(0, index)
                            .reduce((sum, prev) => sum + Math.max(0, Number(prev.data.dauer) || 0), 0);
                        return this.renderPlacement(p, itemstart, false) + this.renderHeadingAffordance(p);
                    }).join('');
                }

                const baustein = this.baustein(group.bausteinid) || {};
                const continuation = seenBausteine[group.bausteinid] === true;
                seenBausteine[group.bausteinid] = true;
                const unfilled = group.items.every((p) => this.isUnfilled(p.data));
                const units = group.items.map((p, index) => {
                    const itemstart = start + group.items.slice(0, index)
                        .reduce((sum, prev) => sum + Math.max(0, Number(prev.data.dauer) || 0), 0);
                    return this.renderPlacement(p, itemstart, true);
                }).join('');

                return `
                    <div class="sq-baustein${unfilled ? ' sq-baustein--empty' : ''}">
                      <div class="sq-baustein__head">
                        <div class="sq-baustein__title">${escapeHtml(baustein.titel || 'Baustein')}
                          ${continuation ? '<span class="sq-badge sq-badge--variant">Fortsetzung</span>' : ''}
                          <span class="sq-badge">${unfilled ? `${duration} Min. reserviert` : `${duration} Min.`}</span>
                        </div>
                        <div class="sq-baustein__tools">
                          ${this.renderVariantPills(group.bausteinid, baustein)}
                          <button type="button" class="kg-btn sq-membership" data-sq-action="edit-baustein"
                            data-bid="${escapeHtml(group.bausteinid)}">Bearbeiten</button>
                          ${unfilled ? this.renderMoveButtons(group.items[0].pid) : ''}
                        </div>
                      </div>
                      ${this.renderBausteinContent(group, units, unfilled, baustein)}
                    </div>`;
            }).join('');
        }

        renderBausteinContent(group, units, unfilled, baustein) {
            if (!unfilled) {
                // Partly filled module: suggestions continue for the residual
                // reservation until it is used up.
                const residual = group.items.filter((p) => this.isUnfilled(p.data));
                const restminutes = residual.reduce((sum, p) => sum + Math.max(0, Number(p.data.dauer) || 0), 0);
                const restsuggestions = (residual.length && restminutes >= 10 && this.methodCardList.length)
                    ? this.renderSuggestions(restminutes, baustein, `data-pid="${escapeHtml(residual[0].pid)}"`)
                    : '';
                return `<div class="sq-baustein__units">${units}${restsuggestions}</div>`;
            }
            // D14: the reserved duration is the classic suggestion gap - with
            // keywords and Bloom mapping from the module master data.
            const placeholderpid = group.items[0].pid;
            const gapminutes = group.items.reduce((sum, p) => sum + Math.max(0, Number(p.data.dauer) || 0), 0);
            const suggestions = (gapminutes >= 10 && this.methodCardList.length)
                ? this.renderSuggestions(gapminutes, baustein, `data-pid="${escapeHtml(placeholderpid)}"`)
                : '';
            // Reserved module: master data now lives on the module itself;
            // the planning state only remains as fallback for the unit list.
            const planningunit = this.planningUnitForBaustein(baustein);
            const owntopics = htmlToLines(baustein && baustein.unterthemen);
            const topics = owntopics || (planningunit ? htmlToLines(planningunit.topics) : '');
            if (!planningunit && !topics) {
                return suggestions ? `<div class="sq-baustein__units">${suggestions}</div>` : '';
            }
            const methods = (Array.isArray(planningunit.methods) ? planningunit.methods : [])
                .map((m) => this.methodCardForRef(m && m.methodid))
                .filter((card) => card);
            if (!topics && !methods.length) {
                return '';
            }
            const methodrows = methods.map((card) => {
                const duration = Number.parseInt(String(card.zeitbedarf || '').replace(/\D+/g, ''), 10);
                const pkey = phaseKey(card.seminarphase);
                return `
                    <div class="sq-unit sq-unit--planned">
                      <div class="sq-unit__phase${pkey ? ' sq-phase-bg--' + pkey : ''}"></div>
                      <div class="sq-unit__main">
                        <div class="sq-unit__title">${escapeHtml(cardTitle(card))}</div>
                        <div class="sq-unit__meta">
                          ${Number.isFinite(duration) && duration > 0 ? `<span class="sq-badge">${duration} Min.</span>` : ''}
                          ${card.seminarphase ? `<span class="sq-badge">${escapeHtml(String(card.seminarphase))}</span>` : ''}
                          <span class="sq-badge sq-badge--planned">geplant, noch nicht platziert</span>
                        </div>
                      </div>
                    </div>`;
            }).join('');
            return `
                <div class="sq-baustein__units">
                  ${topics ? `<div class="sq-baustein__topics">${escapeHtml(topics)}</div>` : ''}
                  ${methodrows}
                  ${suggestions}
                </div>`;
        }

        renderVariantPills(bid, baustein) {
            const varianten = baustein && baustein.varianten ? baustein.varianten : {};
            const keys = Object.keys(varianten);
            if (!keys.length) {
                return '';
            }
            const pills = keys.map((vid) => {
                const active = baustein.aktivevariante === vid;
                return `<button type="button" class="sq-pill${active ? ' active' : ''}"
                    data-sq-action="variant" data-bid="${escapeHtml(bid)}" data-vid="${escapeHtml(vid)}">
                    ${escapeHtml(varianten[vid].titel || vid)}</button>`;
            }).join('');
            return `<div class="sq-pills" role="group" aria-label="Baustein-Variante wählen">${pills}</div>`;
        }

        renderMoveButtons(pid) {
            return `
                <span class="sq-move">
                  <button type="button" class="kg-btn sq-move__btn" data-sq-action="move-up" data-pid="${escapeHtml(pid)}"
                    title="Nach vorne schieben" aria-label="Nach vorne schieben">↑</button>
                  <button type="button" class="kg-btn sq-move__btn" data-sq-action="move-down" data-pid="${escapeHtml(pid)}"
                    title="Nach hinten schieben" aria-label="Nach hinten schieben">↓</button>
                  <button type="button" class="kg-btn sq-move__btn sq-move__btn--remove" data-sq-action="remove" data-pid="${escapeHtml(pid)}"
                    title="Aus dem Plan entfernen" aria-label="Aus dem Plan entfernen">✕</button>
                </span>`;
        }

        renderSwap(p) {
            const auswahl = this.auswahl(p.data);
            if (!auswahl || !Array.isArray(auswahl.kandidaten) || auswahl.kandidaten.length < 2) {
                return '';
            }
            const open = this.openSwapPid === p.pid;
            const options = auswahl.kandidaten.map((ref) => {
                const active = String(auswahl.aktiv) === String(ref);
                return `<div class="sq-swap__option${active ? ' active' : ''}"
                    data-sq-action="swap-choose" data-pid="${escapeHtml(p.pid)}" data-ref="${escapeHtml(String(ref))}">
                    <span class="sq-swap__dot"></span>${escapeHtml(this.candidateLabel(ref))}</div>`;
            }).join('');
            return `
                <span class="sq-swap">
                  <button type="button" class="sq-swap__chip" data-sq-action="swap-toggle" data-pid="${escapeHtml(p.pid)}">⇄ Alternative</button>
                  <div class="sq-swap__panel${open ? ' open' : ''}">${options}</div>
                </span>`;
        }

        renderHeadingAffordance(p) {
            if (p.data.typ !== 'einheit' || p.data.bausteinid) {
                return '';
            }
            if (this.headingPid === p.pid) {
                return `
                    <div class="sq-heading-inline">
                      <input type="text" id="sq-heading-input" class="kg-input" placeholder="z. B. Ankommen und Einstieg">
                      <button type="button" class="kg-btn kg-btn-primary" data-sq-action="heading-save" data-pid="${escapeHtml(p.pid)}">Baustein anlegen</button>
                      <button type="button" class="kg-btn" data-sq-action="heading-cancel">Abbrechen</button>
                    </div>`;
            }
            return `
                <div class="sq-heading-affordance">
                  <button type="button" class="sq-heading-link" data-sq-action="heading-open" data-pid="${escapeHtml(p.pid)}">＋ Überschrift geben</button>
                </div>`;
        }

        renderPlacement(p, startMin, inBaustein) {
            const data = p.data;
            const duration = Math.max(0, Number(data.dauer) || 0);
            const timelabel = `${minutesToLabel(startMin)}–${minutesToLabel(startMin + duration)}`;

            if (data.typ === 'pause') {
                return `
                    <div class="sq-pause">
                      <span class="sq-pause__label">${escapeHtml(data.titel || 'Pause')}</span>
                      <span class="sq-badge">${duration} Min.</span>
                      <span class="sq-unit__time">${timelabel}</span>
                      <span class="sq-pause__spacer"></span>
                      <button type="button" class="kg-btn sq-membership" data-sq-action="edit" data-pid="${escapeHtml(p.pid)}">Bearbeiten</button>
                      ${this.renderMoveButtons(p.pid)}
                    </div>`;
            }

            if (this.isUnfilled(data) && data.bausteinid) {
                if (!inBaustein) {
                    return '';
                }
                // Residual reservation inside a partly filled module.
                return `
                    <div class="sq-unit sq-unit--planned">
                      <div class="sq-unit__phase"></div>
                      <div class="sq-unit__main">
                        <div class="sq-unit__title">Noch offen</div>
                        <div class="sq-unit__meta">
                          <span class="sq-badge">${duration} Min. reserviert</span>
                          <span class="sq-unit__time">${timelabel}</span>
                        </div>
                      </div>
                      <div class="sq-unit__actions">${this.renderMoveButtons(p.pid)}</div>
                    </div>`;
            }

            const phase = this.placementPhase(data);
            const legacy = this.legacyEntryFor(data);
            const phasetext = legacy && legacy.phase ? String(legacy.phase) : '';

            return `
                <div class="sq-unit${inBaustein ? '' : ' sq-unit--standalone'}">
                  <div class="sq-unit__phase${phase ? ' sq-phase-bg--' + phase : ''}"></div>
                  <div class="sq-unit__main">
                    <div class="sq-unit__title">${escapeHtml(data.titel || 'Seminareinheit')}</div>
                    <div class="sq-unit__meta">
                      <span class="sq-badge">${duration} Min.</span>
                      ${phasetext ? `<span class="sq-badge">${escapeHtml(phasetext)}</span>` : ''}
                      <span class="sq-unit__time">${timelabel}</span>
                    </div>
                  </div>
                  <div class="sq-unit__actions">
                    ${this.renderSwap(p)}
                    ${this.renderMembership(p, inBaustein)}
                    <button type="button" class="kg-btn" data-sq-action="edit" data-pid="${escapeHtml(p.pid)}">Bearbeiten</button>
                    ${this.renderMoveButtons(p.pid)}
                  </div>
                </div>`;
        }

        renderMembership(p, inBaustein) {
            if (p.data.typ !== 'einheit') {
                return '';
            }
            if (inBaustein) {
                return `<button type="button" class="kg-btn sq-membership" data-sq-action="leave-baustein"
                    data-pid="${escapeHtml(p.pid)}" title="Aus dem Baustein lösen">Lösen</button>`;
            }
            const bid = this.adjacentBausteinId(p.pid);
            if (!bid) {
                return '';
            }
            const titel = (this.baustein(bid) || {}).titel || 'Baustein';
            return `<button type="button" class="kg-btn sq-membership" data-sq-action="join-baustein"
                data-pid="${escapeHtml(p.pid)}" title="In „${escapeHtml(titel)}" aufnehmen">→ In „${escapeHtml(titel)}"</button>`;
        }
    }

    return {
        init: function(cmid) {
            new SequenzView(Number(cmid)).init();
        },
    };
});
