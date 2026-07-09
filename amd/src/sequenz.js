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
define(['core/ajax'], function(Ajax) {
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
            this.loadGrids();
            this.loadEnrichment();
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
                this.versionhash = String(res.versionhash || '');
                this.dayIndex = 0;
                this.openSwapPid = '';
                this.headingPid = '';
                this.setDirty(false);
                this.indexLegacyEntries();
                this.render();
            }).catch(() => {
                this.setStatus('Der Seminarplan konnte nicht geladen werden.', true);
            });
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
                const candidate = {start, end: start + Math.max(0, Number(brk.duration) || 0)};
                if (!best || Math.abs(start - DEFAULT_BOUNDARY_MIN) < Math.abs(best.start - DEFAULT_BOUNDARY_MIN)) {
                    best = candidate;
                }
            });
            return best || {start: DEFAULT_BOUNDARY_MIN, end: DEFAULT_BOUNDARY_MIN};
        }

        dayFrame(dayname) {
            const config = (this.state && this.state.config) || {};
            const range = config.timeRange || {};
            const start = parseTimeToMinutes(range.start);
            const end = parseTimeToMinutes(range.end);
            const midday = this.middayWindow(dayname);
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
            const day = this.sequenz.tage[this.dayIndex];
            const frame = this.dayFrame(day.bezeichnung);
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
                body = `
                    ${text('Titel', 'titel', placement.titel || '')}
                    ${text('Dauer (Minuten)', 'zeitbedarf', String(placement.dauer || ''))}
                    <div class="sq-field__hint">Diese Einheit hat noch keinen Bibliothekseintrag – nur Titel und Dauer sind änderbar.</div>`;
            }

            root.innerHTML = `
                <div class="sq-modal">
                  <div class="sq-modal__head">
                    <h3>Seminareinheit bearbeiten</h3>
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
            const frame = this.dayFrame(day.bezeichnung);
            const morning = this.renderAnchor(day, 'vormittag', frame, seenBausteine);
            const divider = `
                <div class="sq-break-divider"><span>🕐 Mittagspause</span></div>`;
            const afternoon = this.renderAnchor(day, 'nachmittag', frame, seenBausteine);
            container.innerHTML = morning + divider + afternoon;
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
            const timespan = `${minutesToLabel(anchorStart)}–${minutesToLabel(anchorEnd)}`;
            const overtarget = isMorning ? 'der Mittagspause' : 'dem Tagesende';
            const budgetlabel = over > 0
                ? `+${over} Min. über ${overtarget}`
                : `${used} von ${budget} Min. belegt`;

            let body = this.renderSequence(placements, anchorStart, seenBausteine);
            if (!placements.length) {
                body = '<div class="sq-empty">Noch keine Einheiten in diesem Abschnitt.</div>';
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

            const addbutton = `
                <div class="sq-anchor__add">
                  <button type="button" class="kg-btn" data-sq-action="add-unit" data-anker="${ankername}">＋ Einheit hinzufügen</button>
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
                  <div class="sq-anchor__body">${body}${overrun}${addbutton}</div>
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
                          ${unfilled ? this.renderMoveButtons(group.items[0].pid) : ''}
                        </div>
                      </div>
                      ${this.renderBausteinContent(group, units, unfilled, baustein)}
                    </div>`;
            }).join('');
        }

        renderBausteinContent(group, units, unfilled, baustein) {
            if (!unfilled) {
                return `<div class="sq-baustein__units">${units}</div>`;
            }
            // Reserved module: show master data from the planning state so the
            // planned content is visible even before individual placement.
            const planningunit = this.planningUnitForBaustein(baustein);
            if (!planningunit) {
                return '';
            }
            const topics = htmlToLines(planningunit.topics);
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
                      ${this.renderMoveButtons(p.pid)}
                    </div>`;
            }

            if (this.isUnfilled(data) && data.bausteinid) {
                // Reserved module placeholder rows are rendered by the group card.
                return '';
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
