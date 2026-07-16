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
define(['core/ajax', 'core_user/repository', 'core/fragment', 'core/templates', 'mod_seminarplaner/lernzieleditor'],
function(Ajax, UserRepository, Fragment, Templates, LernzielEditor) {
    const DEFAULT_BOUNDARY_MIN = 750; // 12:30 fallback, same rule as the PHP converter.
    const ANCHORS = ['vormittag', 'nachmittag'];
    const DAYS_ALL = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

    // D45: plan creation and setup live in the sequence view; the six
    // templates carry fixed morning/afternoon spans as editable pre-fill.
    const DEFAULT_ANKERZEITEN = {
        vormittag: {start: '08:30', end: '12:30'},
        nachmittag: {start: '13:15', end: '17:30'},
        ersterTagNurNachmittag: false,
        letzterTagNurVormittag: false
    };
    const GRID_PRESETS = {
        'standard-week': {days: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'], granularity: 15, ankerzeiten: DEFAULT_ANKERZEITEN},
        'sunday-to-friday': {days: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'], granularity: 15, ankerzeiten: DEFAULT_ANKERZEITEN},
        'weekend-seminar': {days: ['Freitag', 'Samstag', 'Sonntag'], granularity: 15, ankerzeiten: Object.assign({}, DEFAULT_ANKERZEITEN, {ersterTagNurNachmittag: true, letzterTagNurVormittag: true})},
        'half-week-mo-mi': {days: ['Montag', 'Dienstag', 'Mittwoch'], granularity: 15, ankerzeiten: DEFAULT_ANKERZEITEN},
        'half-week-mi-fr': {days: ['Mittwoch', 'Donnerstag', 'Freitag'], granularity: 15, ankerzeiten: DEFAULT_ANKERZEITEN},
        'compact-day': {days: ['Montag'], granularity: 15, ankerzeiten: DEFAULT_ANKERZEITEN}
    };
    // Anzeige-Namen der Vorlagen (identisch zum Setup-Select in sequenz.php).
    const PRESET_LABELS = {
        'custom': 'Individuelle Konfiguration',
        'standard-week': 'Standard-Woche (Mo–Fr)',
        'sunday-to-friday': 'Seminarwoche (So–Fr)',
        'weekend-seminar': 'Wochenendseminar (Fr–So)',
        'half-week-mo-mi': 'Halbe Woche (Mo–Mi)',
        'half-week-mi-fr': 'Halbe Woche (Mi–Fr)',
        'compact-day': 'Kompakttag',
    };
    const DEFAULT_COLUMNS = {
        uhrzeit: true,
        title: true,
        description: false,
        flow: true,
        objectives: true,
        risks: false,
        materials: true,
        sonstiges: false
    };
    const cloneAnkerzeiten = (az) => ({
        vormittag: Object.assign({}, az.vormittag),
        nachmittag: Object.assign({}, az.nachmittag),
        ersterTagNurNachmittag: !!az.ersterTagNurNachmittag,
        letzterTagNurVormittag: !!az.letzterTagNurVormittag
    });
    const validAnkerzeiten = (az) => !!(az && az.vormittag && az.nachmittag
        && parseTimeToMinutes(az.vormittag.start) !== null && parseTimeToMinutes(az.vormittag.end) !== null
        && parseTimeToMinutes(az.nachmittag.start) !== null && parseTimeToMinutes(az.nachmittag.end) !== null);

    // Same D45 migration rule as in grid.js: legacy configs derive their
    // anchor times from timeRange + longest break, fallback cut 12:30.
    const deriveAnkerzeiten = (config) => {
        const cfg = config || {};
        if (validAnkerzeiten(cfg.ankerzeiten)) {
            return cloneAnkerzeiten(cfg.ankerzeiten);
        }
        const range = cfg.timeRange || {};
        const start = parseTimeToMinutes(range.start) === null ? '08:30' : range.start;
        const end = parseTimeToMinutes(range.end) === null ? '17:30' : range.end;
        let best = null;
        (Array.isArray(cfg.breaks) ? cfg.breaks : []).forEach((brk) => {
            if (!brk || parseTimeToMinutes(brk.start) === null) {
                return;
            }
            const duration = Math.max(0, Number(brk.duration) || 0);
            if (!duration) {
                return;
            }
            if (!best || duration > best.duration
                || (duration === best.duration
                    && Math.abs(parseTimeToMinutes(brk.start) - DEFAULT_BOUNDARY_MIN) < Math.abs(parseTimeToMinutes(best.start) - DEFAULT_BOUNDARY_MIN))) {
                best = {start: brk.start, duration};
            }
        });
        const vmEnd = best ? best.start : '12:30';
        const nmStart = best ? minutesToLabel(parseTimeToMinutes(best.start) + best.duration) : '12:30';
        return {
            vormittag: {start, end: vmEnd},
            nachmittag: {start: nmStart, end},
            ersterTagNurNachmittag: false,
            letzterTagNurVormittag: false
        };
    };

    // Legacy fields stay as derived values so the read-only overview and
    // old clients keep rendering (D34).
    const legacyFieldsFromAnkerzeiten = (az) => {
        const vmEnd = parseTimeToMinutes(az.vormittag.end);
        const nmStart = parseTimeToMinutes(az.nachmittag.start);
        const gap = (vmEnd !== null && nmStart !== null) ? nmStart - vmEnd : 0;
        return {
            timeRange: {start: az.vormittag.start, end: az.nachmittag.end},
            breaks: gap > 0 ? [{days: ['all'], start: az.vormittag.end, duration: gap}] : []
        };
    };

    const orderDaysFromStart = (days, firstday) => {
        const selected = new Set((Array.isArray(days) ? days : []).filter((day) => DAYS_ALL.includes(day)));
        const startindex = DAYS_ALL.indexOf(firstday);
        const orderedweek = startindex >= 0 ? DAYS_ALL.slice(startindex).concat(DAYS_ALL.slice(0, startindex)) : DAYS_ALL;
        return orderedweek.filter((day) => selected.has(day));
    };

    const legacyUid = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

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

    // ---- Statischer Einheiten-Editor (D17 + Rich-Text) --------------------
    // Feldliste des Modals in sequenz.php; die sechs Rich-Text-Felder tragen
    // den Moodle-Editor (Tiny), der beim Seitenladen an die festen IDs
    // sq-e-<key> gebunden wird. Lese-/Schreib-Helfer nach dem bewährten
    // Muster aus methodlibrary.js (Editor → Iframe → Textarea-Fallback).
    const UNIT_FIELD_KEYS = ['titel', 'lernziele', 'kurzbeschreibung', 'zeitbedarf', 'seminarphase',
        'sozialform', 'ablauf', 'raum', 'gruppengroesse', 'risiken', 'debrief', 'tags', 'autor', 'materialtechnik'];
    const UNIT_RICH_FIELDS = ['lernziele', 'kurzbeschreibung', 'ablauf', 'risiken', 'debrief', 'materialtechnik'];
    // Mehrfach-Auswahlen mit denselben Dropdown-Bedienelementen wie im
    // Bibliotheks-Editor (D17: ein Editor, drei Einstiege).
    const UNIT_MULTI_FIELDS = ['seminarphase', 'sozialform', 'raum'];

    const unitMultiDropdown = (selector) => document.querySelector(
        `[data-kg-form-multi-dropdown="1"][data-kg-field="${selector}"]`);

    const splitMultiValue = (value) => {
        if (Array.isArray(value)) {
            return value.map((v) => String(v).trim()).filter(Boolean);
        }
        return String(value || '').split(/##|,|;|\r?\n/).map((v) => v.trim()).filter(Boolean);
    };

    const setMultiDropdownValues = (selector, values) => {
        const dropdown = unitMultiDropdown(selector);
        const hidden = bySel(selector);
        let clean = splitMultiValue(values);
        if (dropdown) {
            // Werte case-insensitiv auf die Options-Schreibweise auflösen;
            // Unbekanntes fällt weg (gleiche Regel wie im Bibliotheks-Editor).
            const boxes = Array.from(dropdown.querySelectorAll('[data-kg-form-multi-option="1"]'));
            const bynorm = {};
            boxes.forEach((cb) => {
                bynorm[String(cb.value).trim().toLowerCase()] = String(cb.value);
            });
            const resolved = [];
            clean.forEach((value) => {
                const mapped = bynorm[value.toLowerCase()];
                if (mapped && !resolved.includes(mapped)) {
                    resolved.push(mapped);
                }
            });
            clean = resolved;
            const valueset = new Set(clean);
            boxes.forEach((cb) => {
                cb.checked = valueset.has(String(cb.value));
            });
            const toggle = dropdown.querySelector('[data-kg-form-multi-toggle="1"]');
            if (toggle) {
                const prefix = dropdown.getAttribute('data-kg-label-prefix') || 'Auswahl';
                const placeholder = dropdown.getAttribute('data-kg-placeholder') || `${prefix} wählen`;
                toggle.textContent = clean.length ? `${prefix} (${clean.length})` : placeholder;
            }
        }
        if (hidden) {
            hidden.value = clean.join('##');
        }
    };

    const readMultiDropdownValues = (selector) => {
        const hidden = bySel(selector);
        if (!hidden) {
            return [];
        }
        return String(hidden.value || '').split('##').map((v) => v.trim()).filter(Boolean);
    };

    // Auf/Zu-Verhalten und Häkchen → hidden-Feld (einmalig beim Seitenstart).
    // Bindet ein einzelnes Multi-Dropdown (Auf/Zu, Häkchen → hidden, Suche).
    const bindMultiDropdown = (dropdown) => {
        const selector = String(dropdown.getAttribute('data-kg-field') || '');
        const toggle = dropdown.querySelector('[data-kg-form-multi-toggle="1"]');
        const panel = dropdown.querySelector('[data-kg-form-multi-panel="1"]');
        if (toggle && panel) {
            toggle.addEventListener('click', () => {
                const opening = panel.classList.contains('kg-hidden');
                document.querySelectorAll('[data-kg-form-multi-dropdown="1"]').forEach((other) => {
                    const otherpanel = other.querySelector('[data-kg-form-multi-panel="1"]');
                    if (otherpanel) {
                        otherpanel.classList.add('kg-hidden');
                    }
                    other.classList.remove('kg-form-multi-open');
                });
                if (opening) {
                    panel.classList.remove('kg-hidden');
                    dropdown.classList.add('kg-form-multi-open');
                }
            });
            document.addEventListener('click', (event) => {
                if (!dropdown.contains(event.target)) {
                    panel.classList.add('kg-hidden');
                    dropdown.classList.remove('kg-form-multi-open');
                }
            });
        }
        dropdown.querySelectorAll('[data-kg-form-multi-option="1"]').forEach((checkbox) => {
            checkbox.addEventListener('change', () => {
                const selected = Array.from(dropdown.querySelectorAll('[data-kg-form-multi-option="1"]:checked'))
                    .map((cb) => String(cb.value || '').trim())
                    .filter(Boolean);
                setMultiDropdownValues(selector, selected);
            });
        });
        // Suchfeld (nur beim Alternativen-Dropdown): filtert die Optionen
        // live – greift auch für später dynamisch ergänzte Optionen.
        const searchinput = dropdown.querySelector('[data-kg-form-multi-search="1"]');
        if (searchinput) {
            searchinput.addEventListener('input', () => {
                const term = String(searchinput.value || '').trim().toLowerCase();
                dropdown.querySelectorAll('[data-kg-form-multi-option="1"]').forEach((checkbox) => {
                    const row = checkbox.closest('.kg-tag-option');
                    if (!row) {
                        return;
                    }
                    const label = String(row.textContent || '').toLowerCase();
                    row.style.display = !term || label.includes(term) ? '' : 'none';
                });
            });
        }
    };

    const bindUnitMultiDropdowns = () => {
        document.querySelectorAll('[data-kg-form-multi-dropdown="1"]').forEach(bindMultiDropdown);
    };

    const tinyEditorFor = (el) => {
        if (typeof window === 'undefined' || !window.tinyMCE || !el || !el.id) {
            return null;
        }
        return window.tinyMCE.get(el.id);
    };

    const setTinyIframeValue = (el, value) => {
        const iframe = el && el.id ? document.getElementById(`${el.id}_ifr`) : null;
        if (!iframe || !iframe.contentDocument || !iframe.contentDocument.body) {
            return false;
        }
        iframe.contentDocument.body.innerHTML = value;
        return true;
    };

    const getRichValue = (el) => {
        if (!el) {
            return '';
        }
        const editor = tinyEditorFor(el);
        if (editor) {
            return String(editor.getContent() || '').trim();
        }
        const iframe = el.id ? document.getElementById(`${el.id}_ifr`) : null;
        if (iframe && iframe.contentDocument && iframe.contentDocument.body) {
            return String(iframe.contentDocument.body.innerHTML || '').trim();
        }
        return String(el.value || '').trim();
    };

    const setRichValue = (el, value) => {
        if (!el) {
            return;
        }
        const normalized = value === null || value === undefined ? '' : String(value);
        el.value = normalized;
        const editor = tinyEditorFor(el);
        if (!editor || typeof editor.setContent !== 'function') {
            setTinyIframeValue(el, normalized);
            return;
        }
        const apply = () => {
            if (editor.destroyed) {
                return;
            }
            try {
                editor.setContent(normalized);
            } catch (error) {
                window.setTimeout(() => {
                    if (!editor.destroyed) {
                        try {
                            editor.setContent(normalized);
                        } catch (retryerror) {
                            // Textarea-Wert bleibt gesetzt; Tiny holt ihn beim nächsten Refresh.
                        }
                    }
                }, 100);
            }
        };
        if (editor.initialized === false && typeof editor.once === 'function') {
            editor.once('init', apply);
            return;
        }
        apply();
    };

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

    // `label` ist der kanonische Wert, der in die Karte geschrieben wird — er
    // muss mit seminarplaner_phase_options() (locallib.php) uebereinstimmen,
    // aus der Legende und das Editor-Dropdown gespeist werden. `match` bleibt
    // die lose Erkennung fuer Alt-Bestand („Warm-up" -> Orientierung).
    const PHASE_KEYS = [
        {key: 'orientierung', label: 'Orientierung', match: ['orientierung', 'warm-up', 'einstieg']},
        {key: 'erfahrung', label: 'Erfahrungserhebung', match: ['erfahrung', 'erwartungsabfrage', 'vorwissen']},
        {key: 'analyse', label: 'Analyse', match: ['analyse']},
        {key: 'handlung', label: 'Handlungsteil', match: ['handlung', 'aktion', 'praxis']},
        {key: 'transfer', label: 'Transfer', match: ['transfer', 'abschluss', 'auswertung']},
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

    // Glyphen des ⋮-Menüs: gestrichene Inline-SVGs (24er-Viewbox, currentColor)
    // wie im Design-Handoff — sie tragen damit auch die rote Farbe des
    // Entfernen-Eintrags mit.
    const menuIcon = (paths) => `<svg class="sq-menu__icon" width="15" height="15" viewBox="0 0 24 24" fill="none"`
        + ` stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"`
        + ` aria-hidden="true" focusable="false">${paths}</svg>`;
    const MENU_ICONS = {
        up: menuIcon('<path d="M12 19V5M5 12l7-7 7 7"/>'),
        down: menuIcon('<path d="M12 5v14M5 12l7 7 7-7"/>'),
        // Kette mit Bruch = aus der Klammer lösen; geschlossene Kette = aufnehmen.
        unlink: menuIcon('<path d="M9 17H7a5 5 0 010-10h2M15 7h2a5 5 0 014 8"/><path d="M3 3l18 18"/>'),
        link: menuIcon('<path d="M9 17H7a5 5 0 010-10h2M15 7h2a5 5 0 010 10h-2M8 12h8"/>'),
        heading: menuIcon('<path d="M6 4v16M18 4v16M6 12h12"/>'),
        remove: menuIcon('<path d="M6 6l12 12M18 6L6 18"/>'),
    };

    // Obergrenze der direkt editierbaren Dauer (Handoff: clamp 0–600). 600 Min.
    // sind zehn Stunden und damit laenger als jeder Anker – die Grenze faengt
    // Vertipper ab, ohne eine realistische Eingabe zu behindern.
    const MAX_UNIT_MINUTES = 600;

    // Handoff-SEQUENZ 4: Uhr-Glyph der Mittagspausen-Leiste. Ersetzt das
    // frühere 🕐-Emoji — als Line-SVG folgt es der Textfarbe und bleibt im
    // PDF-Export scharf.
    const CLOCK_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
        + ' stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'
        + '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

    // Kompakter Karten-Auszug fuer den veroeffentlichten Roten Faden: nur die
    // aktiven Einheiten der Sequenz, nur Titel und Seminarphase. Deckungsgleich
    // in grid.js — beide Ansichten koennen veroeffentlichen.
    const activeMethodCardSnapshot = (sequenz, cards) => {
        const auswahlen = (sequenz && sequenz.einheitenauswahlen && typeof sequenz.einheitenauswahlen === 'object')
            ? sequenz.einheitenauswahlen : {};
        const active = new Set();
        Object.keys(auswahlen).forEach((key) => {
            const auswahl = auswahlen[key] || {};
            if (auswahl.aktiv !== null && auswahl.aktiv !== undefined && String(auswahl.aktiv) !== '') {
                active.add(String(auswahl.aktiv));
            }
        });
        if (!active.size) {
            return [];
        }
        return (Array.isArray(cards) ? cards : [])
            .filter((card) => card && active.has(String(card.id)))
            .map((card) => ({
                id: String(card.id),
                titel: String(card.titel || ''),
                seminarphase: Array.isArray(card.seminarphase) ? card.seminarphase : String(card.seminarphase || ''),
            }));
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
            // D56/D59: Methoden aus globalen Methoden-Sammlungen (immer
            // durchsuchbar, D33). Fließen in die Vorschläge ein und sind über
            // das Suchfeld an der Lücke auffindbar; Übernehmen legt sofort eine
            // lokale Kopie an (adopt_global_method).
            this.globalMethods = [];
            this.openSwapPid = '';
            // Handoff-SEQUENZ: offenes Phasen-Dropdown (pid) — wie openSwapPid
            // immer nur eines gleichzeitig, geschlossen ueber denselben
            // Klick-daneben-Handler.
            this.openPhasePid = '';
            this.openBausteinSwapBid = '';
            this.openMenuPid = '';
            this.headingPid = '';
            this.idCounter = 0;
            this.planningStateRaw = {};
            this.setupMode = 'create';
            this.roterFadenState = {ispublished: false, gridid: 0};
            this.isUpdatingPublishControl = false;
            this.autosaveTimer = null;
            // Remembered open/closed state of the collapsible suggestion
            // boxes, keyed per day and target, across re-renders.
            this.openSuggest = {};
            // D61: Auf-/Zu-Zustand des Seminarziele-Panels und der einzelnen
            // Verknüpfungs-Checklisten (je Ziel), über Re-Renders gemerkt.
            this.goalsOpen = false;
            this.openGoalLinks = {};
            // Handoff-SEQUENZ 1: Auf-/Zu-Zustand des Kopfes „Seminarplan & Tag".
            // Default offen — wer die Ansicht das erste Mal sieht, soll Planwahl
            // und Tagesnavigation finden, ohne sie erst aufklappen zu muessen.
            this.headOpen = true;
            // D47: active drag (pid + optional module id) and the element
            // currently marked as drop target.
            this.drag = null;
            this.dropMarkerEl = null;
            // D49: requested plan/day from the overview click navigation
            // (?grid=<id>&tag=<n>), applied once on first load.
            const urlparams = new URLSearchParams(window.location.search);
            this.requestedTag = (() => {
                const tag = Number.parseInt(String(urlparams.get('tag') || ''), 10);
                return Number.isFinite(tag) && tag > 0 ? tag : 0;
            })();
            this.requestedGrid = (() => {
                const grid = Number.parseInt(String(urlparams.get('grid') || ''), 10);
                return Number.isFinite(grid) && grid > 0 ? grid : 0;
            })();
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
            const headtoggle = bySel('#sq-head-toggle');
            if (headtoggle) {
                headtoggle.addEventListener('click', () => {
                    this.headOpen = !this.headOpen;
                    this.renderHead();
                });
            }
            this.renderHead();
            // ⓘ-Popover in der Werkzeugleiste: Klick auf den Knopf öffnet die
            // Erklärung, jeder Klick woanders schließt alle offenen Popover.
            document.addEventListener('click', (event) => {
                const btn = event.target.closest('.sq-info__btn');
                document.querySelectorAll('.sq-info--open').forEach((wrap) => {
                    if (!btn || wrap !== btn.parentElement) {
                        wrap.classList.remove('sq-info--open');
                        const other = wrap.querySelector('.sq-info__btn');
                        if (other) {
                            other.setAttribute('aria-expanded', 'false');
                        }
                    }
                });
                if (btn) {
                    const wrap = btn.parentElement;
                    const open = wrap.classList.toggle('sq-info--open');
                    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
                }
            });
            // D50: Werkzeugleisten-Button öffnet den vollen Einheiten-Editor
            // (ohne Vorbelegung) und plant die neue Einheit in den ersten
            // aktiven Anker des aktuellen Tages ein.
            const newunit = bySel('#sq-new-unit');
            if (newunit) {
                newunit.addEventListener('click', () => {
                    if (!this.sequenz || !this.dayCount()) {
                        this.setStatus('Lade zuerst einen Seminarplan, dann kannst du Einheiten anlegen.', true);
                        return;
                    }
                    this.openCreateEditor({anker: this.firstActiveAnker()});
                });
            }
            // Statisches Einheiten-Modal (Rich-Text, D17/D50): Speichern,
            // Abbrechen/Schließen und Klick auf den Overlay-Hintergrund.
            bindUnitMultiDropdowns();
            // D62: geführter Lernziel-Editor am Lernziele-Feld des Einheiten-Modals.
            const lzopen = bySel('#sq-lz-open-lernziele');
            if (lzopen) {
                lzopen.addEventListener('click', () => {
                    LernzielEditor.open((sentence, phase) => {
                        const el = bySel('#sq-e-lernziele');
                        const current = getRichValue(el);
                        const addition = `<p>${escapeHtml(sentence)}</p>`;
                        setRichValue(el, current ? current + addition : addition);
                        this.suggestUnitPhase(phase);
                    });
                });
            }
            const unitsave = bySel('#sq-unit-save');
            if (unitsave) {
                unitsave.addEventListener('click', () => this.saveUnitModal());
            }
            ['#sq-unit-cancel', '#sq-unit-close'].forEach((sel) => {
                const btn = bySel(sel);
                if (btn) {
                    btn.addEventListener('click', () => this.closeUnitModal());
                }
            });
            const unitoverlay = bySel('#sq-unit-modal');
            if (unitoverlay) {
                unitoverlay.addEventListener('click', (event) => {
                    if (event.target === unitoverlay) {
                        this.closeUnitModal();
                    }
                });
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
            const container = bySel('#sq-day');
            if (container) {
                container.addEventListener('click', (event) => this.handleDayClick(event));
                // D59: manuelle Bibliothekssuche an der Lücke (delegiert, damit
                // der Listener Re-Renders des Tagesinhalts übersteht).
                container.addEventListener('input', (event) => {
                    const input = event.target;
                    if (input && input.classList && input.classList.contains('sq-gap-search')) {
                        this.renderGapSearchResults(input);
                    }
                });
                // Handoff-SEQUENZ „Dauer editieren": bewusst 'change' statt
                // 'input' — jede Aenderung rendert den Tag neu (Folgezeiten und
                // Budget haengen daran), das wuerde bei jedem Tastenanschlag den
                // Fokus aus dem Feld reissen. So wirkt sie beim Verlassen/Enter.
                container.addEventListener('change', (event) => {
                    const input = event.target;
                    if (input && input.hasAttribute && input.hasAttribute('data-sq-duration')) {
                        this.setPlacementDuration(input.getAttribute('data-sq-duration'), input.value);
                    }
                });
                this.initDragAndDrop(container);
                // Remember which suggestion boxes are open (toggle does not
                // bubble, so listen in the capture phase).
                container.addEventListener('toggle', (event) => {
                    const details = event.target;
                    if (!details || !details.hasAttribute || !details.hasAttribute('data-suggest-key')) {
                        return;
                    }
                    const key = details.getAttribute('data-suggest-key');
                    if (details.open) {
                        this.openSuggest[key] = true;
                    } else {
                        delete this.openSuggest[key];
                    }
                }, true);
            }
            document.addEventListener('click', (event) => {
                const insideSwap = !!event.target.closest('.sq-swap');
                const outsideSwap = !insideSwap && this.openSwapPid;
                const outsideBausteinSwap = !insideSwap && this.openBausteinSwapBid;
                const outsideMenu = !event.target.closest('.sq-menu') && this.openMenuPid;
                const outsidePhase = !event.target.closest('.sq-phase') && this.openPhasePid;
                if (outsideSwap || outsideBausteinSwap || outsideMenu || outsidePhase) {
                    if (outsideSwap) {
                        this.openSwapPid = '';
                    }
                    if (outsideBausteinSwap) {
                        this.openBausteinSwapBid = '';
                    }
                    if (outsideMenu) {
                        this.openMenuPid = '';
                    }
                    if (outsidePhase) {
                        this.openPhasePid = '';
                    }
                    this.render();
                }
            });
            window.addEventListener('beforeunload', (event) => {
                if (this.dirty) {
                    event.preventDefault();
                    event.returnValue = '';
                }
            });
            this.bindGoals();
            this.initDramaToggle();
            this.initSetupPanel();
            this.initPublishControl();
            this.loadGrids(this.requestedGrid || undefined);
            this.loadEnrichment();
        }

        // ---- Plan creation and setup (D45, moved here from the overview) ----

        initSetupPanel() {
            this.setupMode = 'create';
            const newbtn = bySel('#sq-new-plan');
            const editbtn = bySel('#sq-edit-setup');
            const deletebtn = bySel('#sq-delete-plan');
            const cancel = bySel('#sq-setup-cancel');
            const form = bySel('#sq-setup-form');
            const preset = bySel('#sp-config-preset');
            if (newbtn) {
                newbtn.addEventListener('click', () => this.openSetup('create'));
            }
            if (editbtn) {
                editbtn.addEventListener('click', () => this.openSetup('edit'));
            }
            if (deletebtn) {
                deletebtn.addEventListener('click', () => this.deletePlan());
            }
            if (cancel) {
                cancel.addEventListener('click', () => this.closeSetup());
            }
            if (preset) {
                preset.addEventListener('change', () => this.applyPresetToForm(preset.value));
            }
            if (form) {
                form.querySelectorAll('input[name="days"]').forEach((cb) => {
                    cb.addEventListener('change', () => this.syncFirstDayOptions());
                });
                form.addEventListener('submit', (event) => {
                    event.preventDefault();
                    this.submitSetup();
                });
            }
        }

        openSetup(mode) {
            const panel = bySel('#sq-setup-panel');
            if (!panel) {
                return;
            }
            if (mode === 'edit' && (!this.state || !this.gridid)) {
                this.setStatus('Bitte zuerst einen Seminarplan laden.', true);
                return;
            }
            this.setupMode = mode;
            const title = bySel('#sq-setup-title');
            const namesection = bySel('#sq-setup-name-section');
            const nameinput = bySel('#sq-setup-name');
            if (mode === 'create') {
                if (title) {
                    title.textContent = 'Neuen Seminarplan anlegen';
                }
                if (nameinput) {
                    nameinput.value = '';
                }
                this.fillSetupForm({preset: 'standard-week', days: GRID_PRESETS['standard-week'].days,
                    ankerzeiten: DEFAULT_ANKERZEITEN});
            } else {
                if (title) {
                    title.textContent = 'Einrichtung dieses Seminarplans';
                }
                const config = this.state.config || {};
                this.fillSetupForm({
                    preset: config.preset || 'custom',
                    days: Array.isArray(config.days) ? config.days : [],
                    ankerzeiten: deriveAnkerzeiten(config),
                });
            }
            if (namesection) {
                namesection.classList.toggle('kg-hidden', mode !== 'create');
            }
            panel.classList.remove('kg-hidden');
            panel.scrollIntoView({behavior: 'smooth', block: 'nearest'});
            if (mode === 'create' && nameinput) {
                nameinput.focus();
            }
        }

        closeSetup() {
            const panel = bySel('#sq-setup-panel');
            if (panel) {
                panel.classList.add('kg-hidden');
            }
        }

        fillSetupForm(values) {
            const form = bySel('#sq-setup-form');
            if (!form) {
                return;
            }
            const preset = bySel('#sp-config-preset');
            if (preset) {
                preset.value = values.preset || 'custom';
            }
            form.querySelectorAll('input[name="days"]').forEach((cb) => {
                cb.checked = values.days.includes(cb.value);
            });
            this.syncFirstDayOptions(values.days[0] || 'Montag');
            const az = values.ankerzeiten;
            form.querySelector('#sp-config-vm-start').value = az.vormittag.start;
            form.querySelector('#sp-config-vm-end').value = az.vormittag.end;
            form.querySelector('#sp-config-nm-start').value = az.nachmittag.start;
            form.querySelector('#sp-config-nm-end').value = az.nachmittag.end;
            form.querySelector('#sp-config-first-arrival').checked = !!az.ersterTagNurNachmittag;
            form.querySelector('#sp-config-last-departure').checked = !!az.letzterTagNurVormittag;
        }

        applyPresetToForm(key) {
            const preset = GRID_PRESETS[key];
            if (!preset) {
                return;
            }
            this.fillSetupForm({preset: key, days: preset.days, ankerzeiten: preset.ankerzeiten});
        }

        syncFirstDayOptions(preferredday) {
            const form = bySel('#sq-setup-form');
            const firstday = bySel('#sp-config-first-day');
            if (!form || !firstday) {
                return;
            }
            const selecteddays = Array.from(form.querySelectorAll('input[name="days"]:checked'))
                .map((el) => el.value).filter((day) => DAYS_ALL.includes(day));
            const current = preferredday || firstday.value || selecteddays[0] || 'Montag';
            firstday.innerHTML = selecteddays.map((day) =>
                `<option value="${escapeHtml(day)}">${escapeHtml(day)}</option>`).join('');
            firstday.disabled = !selecteddays.length;
            if (selecteddays.includes(current)) {
                firstday.value = current;
            } else if (selecteddays.length) {
                firstday.value = selecteddays[0];
            }
        }

        collectSetupConfig() {
            const form = bySel('#sq-setup-form');
            const selecteddays = Array.from(form.querySelectorAll('input[name="days"]:checked')).map((el) => el.value);
            const firstdayel = bySel('#sp-config-first-day');
            const days = orderDaysFromStart(selecteddays, (firstdayel && firstdayel.value) || selecteddays[0] || 'Montag');
            if (!days.length) {
                this.setStatus('Bitte mindestens einen Tag auswählen.', true);
                return null;
            }
            const ankerzeiten = {
                vormittag: {
                    start: form.querySelector('#sp-config-vm-start').value || '08:30',
                    end: form.querySelector('#sp-config-vm-end').value || '12:30'
                },
                nachmittag: {
                    start: form.querySelector('#sp-config-nm-start').value || '13:15',
                    end: form.querySelector('#sp-config-nm-end').value || '17:30'
                },
                ersterTagNurNachmittag: !!form.querySelector('#sp-config-first-arrival').checked,
                letzterTagNurVormittag: !!form.querySelector('#sp-config-last-departure').checked
            };
            const vmstart = parseTimeToMinutes(ankerzeiten.vormittag.start) || 0;
            const vmend = parseTimeToMinutes(ankerzeiten.vormittag.end) || 0;
            const nmstart = parseTimeToMinutes(ankerzeiten.nachmittag.start) || 0;
            const nmend = parseTimeToMinutes(ankerzeiten.nachmittag.end) || 0;
            if (vmend <= vmstart || nmend <= nmstart) {
                this.setStatus('Endzeit muss jeweils nach der Startzeit liegen.', true);
                return null;
            }
            if (nmstart < vmend) {
                this.setStatus('Der Nachmittag darf nicht vor dem Ende des Vormittags beginnen.', true);
                return null;
            }
            const presetel = bySel('#sp-config-preset');
            const previous = (this.setupMode === 'edit' && this.state && this.state.config) ? this.state.config : {};
            const legacyfields = legacyFieldsFromAnkerzeiten(ankerzeiten);
            return {
                preset: (presetel && presetel.value) || 'custom',
                days,
                ankerzeiten,
                timeRange: legacyfields.timeRange,
                granularity: previous.granularity || 15,
                breaks: legacyfields.breaks,
                tableColumns: Object.assign({}, DEFAULT_COLUMNS, previous.tableColumns || {})
            };
        }

        submitSetup() {
            const config = this.collectSetupConfig();
            if (!config) {
                return;
            }
            if (this.setupMode === 'create') {
                const nameinput = bySel('#sq-setup-name');
                const name = nameinput ? nameinput.value.trim() : '';
                if (!name) {
                    this.setStatus('Bitte einen Namen für den Seminarplan eingeben.', true);
                    return;
                }
                this.createPlan(name, config);
                return;
            }
            this.applySetupToCurrentPlan(config);
        }

        createPlan(name, config) {
            const plandays = {};
            const middaybreak = (config.breaks || [])[0] || null;
            config.days.forEach((day) => {
                plandays[day] = [];
                if (middaybreak) {
                    const startmin = parseTimeToMinutes(middaybreak.start);
                    plandays[day].push({
                        uid: legacyUid(),
                        title: 'Pause',
                        startMin: startmin,
                        endMin: startmin + middaybreak.duration,
                        kind: 'break',
                        details: {},
                    });
                }
            });
            const state = {
                meta: {title: '', date: '', number: '', contact: ''},
                config,
                view: {mode: 'week', day: config.days[0]},
                plan: {days: plandays},
                sourceMode: 'methods',
                sequenz: this.buildSequenzScaffold(config.days),
            };
            asCall('mod_seminarplaner_create_grid', {cmid: this.cmid, name, description: ''}).then((created) => {
                const gridid = Number(created.gridid || 0);
                return asCall('mod_seminarplaner_save_user_state', {
                    cmid: this.cmid,
                    gridid,
                    statejson: JSON.stringify(state),
                    expectedhash: '',
                }).then(() => gridid);
            }).then((gridid) => {
                this.closeSetup();
                this.setStatus(`Seminarplan „${name}" angelegt.`);
                return this.loadGrids(gridid);
            }).catch(() => {
                this.setStatus('Seminarplan anlegen hat nicht geklappt – bitte noch einmal versuchen.', true);
            });
        }

        // Setup changes on an existing plan: config is replaced, the day
        // list of the sequence follows (new days appear, removed days are
        // dropped only while empty - filled days stay with a hint).
        applySetupToCurrentPlan(config) {
            if (!this.state) {
                return;
            }
            this.state.config = config;
            if (!this.state.plan || typeof this.state.plan !== 'object') {
                this.state.plan = {days: {}};
            }
            if (!this.state.plan.days || typeof this.state.plan.days !== 'object') {
                this.state.plan.days = {};
            }
            config.days.forEach((day) => {
                if (!Array.isArray(this.state.plan.days[day])) {
                    this.state.plan.days[day] = [];
                }
            });
            const kept = this.syncSequenzDays(config.days);
            this.closeSetup();
            this.dayIndex = 0;
            this.setDirty(true);
            this.render();
            this.save().catch(() => null);
            if (kept.length) {
                this.toast(`Einrichtung übernommen. ${kept.join(' ')}`);
            } else {
                this.toast('Einrichtung übernommen – Tage und Zeiten sind angepasst.');
            }
        }

        buildSequenzScaffold(days) {
            return {
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
        }

        // Rebuild sequenz.tage along the configured day list. Existing days
        // are matched by name and keep their placements; days no longer
        // configured survive (at the end) as long as they hold content.
        syncSequenzDays(days) {
            if (!this.sequenz) {
                this.sequenz = this.buildSequenzScaffold(days);
                this.state.sequenz = this.sequenz;
                return [];
            }
            const remaining = (this.sequenz.tage || []).slice();
            const newtage = days.map((name) => {
                const index = remaining.findIndex((day) => day && String(day.bezeichnung) === String(name));
                if (index >= 0) {
                    return remaining.splice(index, 1)[0];
                }
                return {
                    tag: 0,
                    bezeichnung: String(name),
                    anker: {vormittag: {sequenz: []}, nachmittag: {sequenz: []}},
                };
            });
            const hints = [];
            remaining.forEach((day) => {
                const filled = ANCHORS.some((anker) => {
                    const seq = (((day.anker || {})[anker] || {}).sequenz) || [];
                    return seq.length > 0;
                });
                if (filled) {
                    newtage.push(day);
                    hints.push(`„${day.bezeichnung}" enthält noch Einheiten und bleibt deshalb erhalten.`);
                } else {
                    ANCHORS.forEach((anker) => {
                        const seq = (((day.anker || {})[anker] || {}).sequenz) || [];
                        seq.forEach((pid) => this.deletePlacementRecord(pid));
                    });
                }
            });
            newtage.forEach((day, index) => {
                day.tag = index + 1;
            });
            this.sequenz.tage = newtage;
            return hints;
        }

        deletePlacementRecord(pid) {
            const placement = this.sequenz.platzierungen[pid];
            if (!placement) {
                return;
            }
            const auswahlid = placement.typ === 'einheit' ? String(placement.einheitenauswahl || '') : '';
            delete this.sequenz.platzierungen[pid];
            if (auswahlid && !Object.keys(this.sequenz.platzierungen).some((other) => {
                return String(this.sequenz.platzierungen[other].einheitenauswahl || '') === auswahlid;
            })) {
                delete this.sequenz.einheitenauswahlen[auswahlid];
            }
        }

        // ---- Common Thread publishing (also available here, next to the
        // overview page - both roads lead to the Roter Faden) --------------

        initPublishControl() {
            this.roterFadenState = {ispublished: false, gridid: 0};
            this.isUpdatingPublishControl = false;
            const checkbox = bySel('#sq-publish-roterfaden');
            if (!checkbox) {
                return;
            }
            checkbox.addEventListener('change', () => {
                if (this.isUpdatingPublishControl) {
                    return;
                }
                const shouldpublish = !!checkbox.checked;
                const rollback = () => {
                    this.isUpdatingPublishControl = true;
                    checkbox.checked = !shouldpublish;
                    this.isUpdatingPublishControl = false;
                    this.syncPublishControl();
                };
                if (shouldpublish) {
                    const saved = this.dirty ? this.save() : Promise.resolve(true);
                    saved.then(() => this.publishCurrentPlan()).catch(() => rollback());
                    return;
                }
                asCall('mod_seminarplaner_unpublish_roterfaden', {cmid: this.cmid}).then((res) => {
                    if (!res || !res.success) {
                        throw new Error('Unpublish failed');
                    }
                    this.roterFadenState = Object.assign({}, this.roterFadenState, {ispublished: false});
                    this.syncPublishControl();
                    this.toast('Roter Faden ist nicht mehr sichtbar.');
                }).catch(() => rollback());
            });
            this.loadRoterFadenState();
        }

        loadRoterFadenState() {
            return asCall('mod_seminarplaner_get_roterfaden_state', {cmid: this.cmid}).then((res) => {
                this.roterFadenState = {
                    ispublished: !!(res && res.ispublished),
                    gridid: Number((res && res.gridid) || 0) || 0,
                };
                this.syncPublishControl();
            }).catch(() => {
                this.roterFadenState = {ispublished: false, gridid: 0};
                this.syncPublishControl();
            });
        }

        syncPublishControl() {
            const checkbox = bySel('#sq-publish-roterfaden');
            const status = bySel('#sq-publish-roterfaden-status');
            if (!checkbox) {
                return;
            }
            const currentpublished = this.roterFadenState.ispublished
                && Number(this.roterFadenState.gridid) === Number(this.gridid);
            this.isUpdatingPublishControl = true;
            checkbox.checked = !!currentpublished;
            checkbox.disabled = !this.gridid;
            this.isUpdatingPublishControl = false;
            if (!status) {
                return;
            }
            if (!this.gridid) {
                status.textContent = '';
            } else if (currentpublished) {
                status.textContent = 'Dieser Seminarplan ist als Roter Faden veröffentlicht.';
            } else if (this.roterFadenState.ispublished && this.roterFadenState.gridid > 0) {
                status.textContent = `Aktuell ist Seminarplan #${this.roterFadenState.gridid} veröffentlicht.`;
            } else {
                status.textContent = 'Aktuell ist kein Roter Faden veröffentlicht.';
            }
        }

        publishCurrentPlan() {
            if (!this.state || !this.gridid) {
                return Promise.resolve(false);
            }
            const planningstate = this.planningStateRaw || {};
            const payload = {
                config: this.state.config || {},
                view: this.state.view || {mode: 'week', day: ''},
                plan: this.state.plan || {days: {}},
                planningState: planningstate,
                units: Array.isArray(planningstate.units) ? planningstate.units : [],
                slotorder: Array.isArray(planningstate.slotorder) ? planningstate.slotorder : [],
                zoomIndex: this.state.zoomIndex || 0,
                sourceMode: this.state.sourceMode || 'methods',
                // Der Roter-Faden-Snapshot braucht die Sequenz (Bloecke, Dauern)
                // und zu den aktiven Einheiten Titel + Seminarphase; die
                // Methoden-Bibliothek selbst steht Lesenden dort nicht offen.
                sequenz: this.sequenz || null,
                methodcards: activeMethodCardSnapshot(this.sequenz, this.methodCardList),
            };
            return asCall('mod_seminarplaner_publish_roterfaden', {
                cmid: this.cmid,
                gridid: this.gridid,
                statejson: JSON.stringify(payload),
            }).then((res) => {
                if (!res || !res.success) {
                    throw new Error('Publish failed');
                }
                this.roterFadenState = {ispublished: true, gridid: Number(this.gridid)};
                this.syncPublishControl();
                this.toast('Roter Faden veröffentlicht.');
                return true;
            });
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

        // Passive save indicator - replaces the former Speichern button.
        setSaveState(text, tone = '') {
            const el = bySel('#sq-save-state');
            if (!el) {
                return;
            }
            el.textContent = text;
            el.className = 'sq-savestate' + (tone ? ' sq-savestate--' + tone : '');
        }

        setDirty(dirty) {
            this.dirty = dirty;
            // Background auto-save: changes persist ~2s after the last edit.
            window.clearTimeout(this.autosaveTimer);
            if (dirty) {
                this.setSaveState('Änderungen werden gleich gesichert …');
                this.autosaveTimer = window.setTimeout(() => {
                    if (this.dirty) {
                        this.save().catch(() => null);
                    }
                }, 2000);
            }
        }

        loadGrids(preferredid) {
            return asCall('mod_seminarplaner_list_grids', {cmid: this.cmid}).then((res) => {
                const grids = (res.grids || []).filter((grid) => !Number(grid.isarchived));
                const select = bySel('#sq-grid-select');
                if (!select) {
                    return;
                }
                select.innerHTML = grids.map((grid) =>
                    `<option value="${Number(grid.id)}">${escapeHtml(grid.name)}</option>`).join('');
                if (!grids.length) {
                    this.setStatus('Noch kein Seminarplan vorhanden – lege mit „＋ Neuer Seminarplan" los.');
                    this.syncPublishControl();
                    this.openSetup('create');
                    return;
                }
                const target = preferredid && grids.some((grid) => Number(grid.id) === Number(preferredid))
                    ? Number(preferredid)
                    : Number(grids[0].id);
                select.value = String(target);
                this.loadState(target);
            }).catch(() => {
                this.setStatus('Seminarpläne konnten nicht geladen werden.', true);
            });
        }

        deletePlan() {
            const select = bySel('#sq-grid-select');
            const gridid = this.gridid || (select ? Number(select.value) : 0);
            if (!gridid) {
                this.setStatus('Kein Seminarplan ausgewählt.', true);
                return;
            }
            const name = select && select.selectedOptions && select.selectedOptions[0]
                ? select.selectedOptions[0].textContent
                : `#${gridid}`;
            if (!window.confirm(`Soll der Seminarplan „${name}" wirklich gelöscht werden?`)) {
                return;
            }
            // Ungespeicherte Änderungen sind nach dem Löschen gegenstandslos –
            // dirty zurücksetzen, damit kein „verwerfen?"-Dialog dazwischenfunkt.
            this.setDirty(false);
            asCall('mod_seminarplaner_delete_grid', {cmid: this.cmid, gridid}).then(() => {
                this.gridid = 0;
                this.setStatus('Seminarplan gelöscht.');
                return this.loadGrids();
            }).catch(() => {
                this.setStatus('Seminarplan löschen fehlgeschlagen.', true);
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
                this.planningStateRaw = decoded;
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
            this.loadGlobalMethods();
        }

        // D56/D59: globale Methoden-Sammlungen laden (kein Vor-Import nötig).
        loadGlobalMethods() {
            asCall('mod_seminarplaner_browse_global_library', {cmid: this.cmid}).then((res) => {
                if (!res || res.available === false || !Array.isArray(res.methods)) {
                    this.globalMethods = [];
                    return;
                }
                this.globalMethods = res.methods.map((m) => ({
                    id: 'gl-' + m.methodid,
                    _globalid: Number(m.methodid) || 0,
                    _isglobal: true,
                    _setname: String(m.setname || ''),
                    titel: String(m.titel || ''),
                    zeitbedarf: String(m.zeitbedarf || ''),
                    kurzbeschreibung: String(m.kurzbeschreibung || ''),
                    tags: Array.isArray(m.tags) ? m.tags.join(', ') : String(m.tags || ''),
                    seminarphase: Array.isArray(m.seminarphase) ? m.seminarphase : [],
                }));
                this.render();
            }).catch(() => {
                this.globalMethods = [];
            });
        }

        // D56/D59: durchsuchbarer Gesamtbestand = lokale Einheiten + globale
        // Methoden-Sammlungen. Globale Treffer, deren Titel bereits lokal
        // existiert, werden ausgeblendet (Übernehmen erzeugt sonst Dubletten).
        suggestionPool() {
            const localtitles = new Set(this.methodCardList.map((c) => cardTitle(c).trim().toLowerCase()));
            const globals = this.globalMethods.filter((m) => !localtitles.has(String(m.titel).trim().toLowerCase()));
            return this.methodCardList.concat(globals);
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
                this.normalizeSequenz();
                this.ensureSequenzScaffold();
                this.versionhash = String(res.versionhash || '');
                this.dayIndex = 0;
                // D49: Klick-Navigation aus dem Ueberblick - ?tag=N oeffnet
                // direkt den passenden Tag (einmalig, nur fuers erste Laden).
                if (this.requestedTag > 0 && this.requestedTag <= this.dayCount()) {
                    this.dayIndex = this.requestedTag - 1;
                }
                this.requestedTag = 0;
                this.openSwapPid = '';
                this.openPhasePid = '';
                this.headingPid = '';
                this.setDirty(false);
                this.setSaveState('');
                this.indexLegacyEntries();
                this.syncPublishControl();
                this.render();
                this.maybeShowIntro();
            }).catch(() => {
                this.setStatus('Der Seminarplan konnte nicht geladen werden.', true);
            });
        }

        // The PHP round trip turns empty JSON objects into arrays. If the
        // map sections arrive as arrays, string-keyed entries added to them
        // would be dropped silently by JSON.stringify on save - placements
        // got lost that way while their ids stayed in the anchor sequences,
        // and re-used ids then rendered twice. Coerce the maps back to
        // plain objects and drop duplicate or dangling references.
        normalizeSequenz() {
            const seq = this.sequenz;
            if (!seq) {
                return;
            }
            const toMap = (value) => {
                if (Array.isArray(value)) {
                    return {};
                }
                return (value && typeof value === 'object') ? value : {};
            };
            seq.platzierungen = toMap(seq.platzierungen);
            seq.einheitenauswahlen = toMap(seq.einheitenauswahlen);
            seq.bausteine = toMap(seq.bausteine);
            // D61: Seminarziele des Gesamtplans – Liste einzelner Ziele, jedes
            // mit Freitext und den verknüpften Seminareinheiten (Karten-IDs).
            seq.seminarziele = (Array.isArray(seq.seminarziele) ? seq.seminarziele : [])
                .map((ziel) => ({
                    id: String((ziel && ziel.id) || this.uniqueId('zl', {})),
                    text: String((ziel && ziel.text) || ''),
                    einheiten: Array.isArray(ziel && ziel.einheiten) ? ziel.einheiten.map(String) : [],
                }))
                .filter((ziel) => ziel.id);
            Object.keys(seq.bausteine).forEach((bid) => {
                const baustein = seq.bausteine[bid];
                if (baustein && typeof baustein === 'object') {
                    baustein.varianten = toMap(baustein.varianten);
                    // Varianten-Form vereinheitlichen (übersteht den {}→[]-Roundtrip
                    // des Servers wie die übrigen Map-Strukturen).
                    Object.keys(baustein.varianten).forEach((vid) => {
                        const v = baustein.varianten[vid];
                        baustein.varianten[vid] = {
                            titel: String((v && v.titel) || ''),
                            platzierungen: Array.isArray(v && v.platzierungen) ? v.platzierungen.map(String) : [],
                        };
                    });
                    const vkeys = Object.keys(baustein.varianten);
                    if (!vkeys.length) {
                        baustein.aktivevariante = null;
                    } else if (!baustein.varianten[baustein.aktivevariante]) {
                        baustein.aktivevariante = vkeys[0];
                    }
                }
            });
            const seen = {};
            (Array.isArray(seq.tage) ? seq.tage : []).forEach((day) => {
                ANCHORS.forEach((ankername) => {
                    const anker = (day && day.anker) ? day.anker[ankername] : null;
                    if (!anker || !Array.isArray(anker.sequenz)) {
                        return;
                    }
                    anker.sequenz = anker.sequenz.filter((pid) => {
                        const key = String(pid);
                        if (seen[key] || !seq.platzierungen[key]) {
                            return false;
                        }
                        seen[key] = true;
                        return true;
                    });
                });
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
            // Breaks do not count as legacy content: the setup writes the
            // derived midday break into the plan for the overview, and in
            // the sequence it is the anchor divider anyway.
            const haslegacy = Object.keys(plandays).some((day) => {
                return (Array.isArray(plandays[day]) ? plandays[day] : []).some((entry) => {
                    return entry && String(entry.kind || '') !== 'break'
                        && (Number(entry.endMin) || 0) > (Number(entry.startMin) || 0);
                });
            });
            if (haslegacy) {
                return;
            }
            this.sequenz = this.buildSequenzScaffold(days);
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
            // Breaks alone are no legacy content: plans created in the
            // sequence view carry the derived midday break in plan.days,
            // but there is nothing to translate for them (D35).
            const haslegacycontent = legacyentries.some((entry) => String(entry.kind || '') !== 'break');
            if (!haslegacycontent || !hasplacements) {
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
            const scale = 1.35; // Pixels per minute (kurze Bloecke bleiben lesbar).
            const height = (dayend - daystart) * scale;

            const hours = [];
            for (let min = Math.ceil(daystart / 60) * 60; min <= dayend; min += 60) {
                hours.push(`
                    <div class="sq-intro__hour" style="top:${(min - daystart) * scale}px">
                      <span>${minutesToLabel(min)}</span>
                    </div>`);
            }

            // Optik des Überblicks: dauerechte Blöcke in voller Phasenfarbe,
            // Pausen schraffiert — so erkennt man den alten Plan wieder.
            const blocks = legacyentries.map((entry) => {
                const start = Math.max(daystart, Number(entry.startMin) || 0);
                const end = Math.min(dayend, Number(entry.endMin) || 0);
                if (end <= start) {
                    return '';
                }
                const isbreak = String(entry.kind || '') === 'break';
                const title = String(entry.title || (isbreak ? 'Pause' : 'Einheit'));
                const phase = isbreak ? '' : phaseKey(entry.phase);
                const classes = ['sq-intro__block'];
                if (isbreak) {
                    classes.push('sq-intro__block--break');
                } else if (phase) {
                    classes.push(`sq-intro__block--${phase}`);
                }
                const height = Math.max(16, ((end - start) * scale) - 2);
                // Sehr flache Blöcke tragen nur den Titel — sonst schneidet die
                // zweite Zeile ab.
                const timeline = height >= 28
                    ? `<span class="sq-intro__blocktime">${minutesToLabel(start)}–${minutesToLabel(end)}</span>`
                    : '';
                return `
                    <div class="${classes.join(' ')}" title="${escapeHtml(`${minutesToLabel(start)}–${minutesToLabel(end)} ${title}`)}"
                      style="top:${(start - daystart) * scale}px; height:${height}px">
                      ${timeline}
                      <span class="sq-intro__blocktitle">${escapeHtml(title)}</span>
                    </div>`;
            }).join('');

            return `<div class="sq-intro__grid" style="height:${height}px">${hours.join('')}${blocks}</div>`;
        }

        // Rechte Spalte der Übersetzungs-Anzeige (D35): dieselben Bausteine wie
        // die echte Sequenzansicht — Anker-Karte mit Budget, Einheiten-Zeilen mit
        // Phasen-Streifen und Badges, Baustein-Klammer, Mittagspausen-Trenner.
        // Nur die Bedienelemente fehlen (Vorschau, nichts ist hier bedienbar).
        renderIntroSequence(day, frame) {
            const anchors = ANCHORS.map((ankername) => {
                const isMorning = ankername === 'vormittag';
                const anchorStart = isMorning ? frame.start : Math.max(frame.midday.end, frame.start);
                const anchorEnd = isMorning ? Math.min(frame.midday.start, frame.end) : frame.end;
                const budget = Math.max(0, anchorEnd - anchorStart);
                const placements = (day.anker[ankername].sequenz || [])
                    .map((pid) => ({pid, data: this.placement(pid)}))
                    .filter((p) => p.data);
                const used = placements.reduce((sum, p) => sum + Math.max(0, Number(p.data.dauer) || 0), 0);
                const over = used - budget;
                const fillpct = budget > 0 ? Math.min(100, Math.round((used / budget) * 100)) : (used > 0 ? 100 : 0);
                const body = this.renderIntroPlacements(placements, anchorStart)
                    || '<div class="sq-empty">Keine Einheiten in diesem Abschnitt.</div>';

                return `
                    <div class="sq-anchor">
                      <div class="sq-anchor__head">
                        <div class="sq-anchor__title">${isMorning ? 'Vormittag' : 'Nachmittag'}
                          <span class="sq-anchor__time">${minutesToLabel(anchorStart)}–${minutesToLabel(anchorEnd)}</span>
                        </div>
                        <div class="sq-budget">
                          <div class="sq-budget__bar">
                            <div class="sq-budget__fill${over > 0 ? ' sq-budget__fill--over' : ''}" style="width:${fillpct}%"></div>
                          </div>
                          <div class="sq-budget__label">${used} von ${budget} Min. belegt</div>
                        </div>
                      </div>
                      <div class="sq-anchor__body">${body}</div>
                    </div>`;
            });

            const middaytimes = frame.midday.end > frame.midday.start
                ? ` · ${minutesToLabel(frame.midday.start)}–${minutesToLabel(frame.midday.end)}`
                : '';
            const divider = `
                <div class="sq-break-divider">
                  ${CLOCK_ICON}
                  <span>Mittagspause</span>
                  ${middaytimes ? `<span class="sq-break-divider__time">${minutesToLabel(frame.midday.start)}–${minutesToLabel(frame.midday.end)}</span>` : ''}
                </div>`;
            return `<div class="sq-intro__preview">${anchors[0]}${divider}${anchors[1]}</div>`;
        }

        renderIntroPlacements(placements, anchorStart) {
            // Bündelung wie in der Sequenz: aufeinanderfolgende Platzierungen
            // desselben Bausteins bilden eine Klammer.
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
                const rows = group.items.map((p, index) => {
                    const itemstart = start + group.items.slice(0, index)
                        .reduce((sum, prev) => sum + Math.max(0, Number(prev.data.dauer) || 0), 0);
                    return this.renderIntroRow(p, itemstart);
                }).join('');

                if (!group.bausteinid) {
                    return rows;
                }
                const baustein = this.baustein(group.bausteinid) || {};
                return `
                    <div class="sq-baustein">
                      <div class="sq-baustein__head">
                        <div class="sq-baustein__title">${escapeHtml(baustein.titel || 'Baustein')}
                          <span class="sq-badge">${duration} Min.</span>
                        </div>
                      </div>
                      <div class="sq-baustein__body">${rows}</div>
                    </div>`;
            }).join('');
        }

        renderIntroRow(p, startMin) {
            const data = p.data;
            const duration = Math.max(0, Number(data.dauer) || 0);
            const timelabel = `${minutesToLabel(startMin)}–${minutesToLabel(startMin + duration)}`;

            if (data.typ === 'pause') {
                return `
                    <div class="sq-pause">
                      <span class="sq-pause__label">${escapeHtml(data.titel || 'Pause')}</span>
                      <span class="sq-badge">${duration} Min.</span>
                      <span class="sq-unit__time">${timelabel}</span>
                    </div>`;
            }

            const phase = this.placementPhase(data);
            const phasetext = this.placementRawPhase(data);
            const title = String(data.titel || '').trim() || 'Noch offen';
            return `
                <div class="sq-unit">
                  <div class="sq-unit__phase${phase ? ' sq-phase-bg--' + phase : ''}"></div>
                  <div class="sq-unit__main">
                    <div class="sq-unit__title">${escapeHtml(title)}</div>
                    <div class="sq-unit__meta">
                      <span class="sq-badge">${duration} Min.</span>
                      ${phasetext ? `<span class="sq-badge${phase ? ' sq-badge--phase-' + phase : ''}">${escapeHtml(phasetext)}</span>` : ''}
                      <span class="sq-unit__time">${timelabel}</span>
                    </div>
                  </div>
                </div>`;
        }

        showIntro(day, legacyentries) {
            const root = this.modalRoot();
            const frame = this.dayFrame(0);
            const leftrows = this.renderIntroGrid(legacyentries, frame);
            const rightrows = this.renderIntroSequence(day, frame);

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
                return Promise.resolve(false);
            }
            window.clearTimeout(this.autosaveTimer);
            this.setSaveState('Speichert …');
            const payload = JSON.stringify(this.state);
            return asCall('mod_seminarplaner_save_user_state', {
                cmid: this.cmid,
                gridid: this.gridid,
                statejson: payload,
                expectedhash: this.versionhash,
            }).then((res) => {
                this.versionhash = String(res.versionhash || res.newhash || this.versionhash);
                this.setDirty(false);
                const now = new Date();
                const pad = (n) => String(n).padStart(2, '0');
                this.setSaveState(`✓ Gespeichert ${pad(now.getHours())}:${pad(now.getMinutes())} Uhr`, 'ok');
                return true;
            }).catch((error) => {
                // Keep the changes and retry automatically; the indicator
                // says what is happening instead of asking for a click.
                this.setSaveState('Speichern hat nicht geklappt – neuer Versuch gleich …', 'error');
                window.clearTimeout(this.autosaveTimer);
                this.autosaveTimer = window.setTimeout(() => {
                    if (this.dirty) {
                        this.save().catch(() => null);
                    }
                }, 8000);
                throw error;
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
            this.openMenuPid = '';
            this.openPhasePid = '';
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

        // Erster Anker des aktuellen Tages, der nicht entfällt (D45:
        // am Anreisetag hat der Vormittag kein Zeitfenster).
        firstActiveAnker() {
            const frame = this.dayFrame(this.dayIndex);
            const vmbudget = Math.max(0, Math.min(frame.midday.start, frame.end) - frame.start);
            return vmbudget > 0 ? 'vormittag' : 'nachmittag';
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

        // ---- D47: drag & drop as the second way to reorder (besides ↑/↓) --
        // Draggable are the top-level rows of the current day: standalone
        // units, breaks and whole modules. Units inside a module are not
        // draggable (membership stays a deliberate action); the arrows
        // still cover fine-grained moves and cross-day moves.

        initDragAndDrop(container) {
            container.addEventListener('dragstart', (event) => {
                const row = event.target.closest('[data-sq-drag]');
                if (!row) {
                    return;
                }
                this.drag = {
                    pid: row.getAttribute('data-sq-drag'),
                    bid: row.getAttribute('data-sq-group') || '',
                };
                event.dataTransfer.effectAllowed = 'move';
                // Firefox only starts the drag once data is set.
                event.dataTransfer.setData('text/plain', this.drag.pid);
                row.classList.add('sq-dragging');
            });
            container.addEventListener('dragover', (event) => {
                if (!this.drag) {
                    return;
                }
                const target = this.dropTarget(event);
                this.markDropTarget(target);
                if (target) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                }
            });
            container.addEventListener('drop', (event) => {
                if (!this.drag) {
                    return;
                }
                const target = this.dropTarget(event);
                this.clearDropMarkers();
                if (!target) {
                    return;
                }
                event.preventDefault();
                this.dropMove(target);
            });
            container.addEventListener('dragend', () => {
                this.drag = null;
                this.clearDropMarkers();
                document.querySelectorAll('.sq-dragging').forEach((el) => el.classList.remove('sq-dragging'));
            });
        }

        // Drop on a row = insert before it, drop on the anchor body = append
        // at the end. Anchors that do not take place (arrival/departure day)
        // accept no drops, mirroring their disabled add buttons.
        dropTarget(event) {
            const anchorEl = event.target.closest('.sq-anchor');
            if (!anchorEl || anchorEl.hasAttribute('data-off')) {
                return null;
            }
            const ankername = anchorEl.getAttribute('data-anker') || 'vormittag';
            const row = event.target.closest('[data-sq-drag]');
            if (row) {
                return row.classList.contains('sq-dragging')
                    ? null
                    : {ankername, beforePid: row.getAttribute('data-sq-drag'), el: row};
            }
            const body = event.target.closest('.sq-anchor__body');
            return body ? {ankername, beforePid: '', el: body} : null;
        }

        markDropTarget(target) {
            const el = target ? target.el : null;
            if (this.dropMarkerEl === el) {
                return;
            }
            this.clearDropMarkers();
            if (el) {
                el.classList.add(target.beforePid ? 'sq-drop-before' : 'sq-drop-append');
                this.dropMarkerEl = el;
            }
        }

        clearDropMarkers() {
            document.querySelectorAll('.sq-drop-before, .sq-drop-append').forEach((el) => {
                el.classList.remove('sq-drop-before', 'sq-drop-append');
            });
            this.dropMarkerEl = null;
        }

        // The dragged pids: a single placement, or - for a module drag - the
        // contiguous run of unit placements of that module (same grouping as
        // renderSequence uses).
        draggedPids() {
            const found = this.locate(this.drag.pid);
            if (!found) {
                return null;
            }
            if (!this.drag.bid) {
                return {found, pids: [this.drag.pid]};
            }
            const seq = found.anchors[found.anchorIdx].seq;
            const pids = [];
            for (let i = found.pos; i < seq.length; i++) {
                const placement = this.placement(seq[i]);
                if (!placement || placement.typ !== 'einheit'
                        || String(placement.bausteinid || '') !== String(this.drag.bid)) {
                    break;
                }
                pids.push(seq[i]);
            }
            return {found, pids};
        }

        dropMove(target) {
            const dragged = this.draggedPids();
            if (!dragged || !dragged.pids.length) {
                return;
            }
            const {found, pids} = dragged;
            const anchors = found.anchors;
            const srcSeq = anchors[found.anchorIdx].seq;
            const dstAnchorIdx = this.dayIndex * 2 + (target.ankername === 'vormittag' ? 0 : 1);
            if (dstAnchorIdx < 0 || dstAnchorIdx >= anchors.length
                    || (target.beforePid && pids.indexOf(target.beforePid) >= 0)) {
                return;
            }
            const dstSeq = anchors[dstAnchorIdx].seq;
            if (srcSeq === dstSeq) {
                const refIdx = target.beforePid ? srcSeq.indexOf(target.beforePid) : srcSeq.length;
                if (refIdx === found.pos || refIdx === found.pos + pids.length) {
                    return;
                }
            }
            srcSeq.splice(found.pos, pids.length);
            let insertAt = target.beforePid ? dstSeq.indexOf(target.beforePid) : dstSeq.length;
            if (insertAt < 0) {
                insertAt = dstSeq.length;
            }
            dstSeq.splice(insertAt, 0, ...pids);
            if (found.anchorIdx !== dstAnchorIdx) {
                const targetDay = this.sequenz.tage[anchors[dstAnchorIdx].dayIdx];
                this.setStatus(`Verschoben: jetzt am ${target.ankername === 'vormittag' ? 'Vormittag' : 'Nachmittag'} von Tag ${targetDay.tag}.`);
            }
            this.setDirty(true);
            this.render();
        }

        // C1: resolve an anchor overflow. Trailing placements move into the
        // next anchor until the budget fits. A single filled unit straddling
        // the boundary is split when both parts stay didactically sensible
        // (see canSplit); the part that still fits stays, the remainder
        // continues in the next anchor as "Fortsetzung". Otherwise the unit
        // moves as a whole (the old behaviour) - starting a tiny stub before
        // the break or day end is not worth it.
        resolveOverflow(ankername) {
            const frame = this.dayFrame(this.dayIndex);
            const anchors = this.anchorList();
            const anchorIdx = this.dayIndex * 2 + (ankername === 'vormittag' ? 0 : 1);
            if (anchorIdx + 1 >= anchors.length) {
                return;
            }
            const seq = anchors[anchorIdx].seq;
            const nextSeq = anchors[anchorIdx + 1].seq;
            const budget = this.anchorBudget(frame, ankername);

            let movedwhole = 0;
            let didsplit = false;
            let safety = seq.length + 2;
            while (seq.length && this.usedMinutes(seq) > budget && safety-- > 0) {
                const lastpid = seq[seq.length - 1];
                const last = this.placement(lastpid);
                const dur = last ? Math.max(0, Number(last.dauer) || 0) : 0;
                const over = this.usedMinutes(seq) - budget;
                // A filled unit sitting across the boundary: split it when both
                // parts remain sensible, then the anchor fits exactly.
                if (last && last.typ === 'einheit' && !this.isUnfilled(last)
                        && over > 0 && over < dur && this.canSplit(dur, over)) {
                    this.splitPlacement(lastpid, dur - over, over, nextSeq);
                    didsplit = true;
                    break;
                }
                // Otherwise move the whole trailing placement (pause, reserved
                // placeholder, short unit, or a unit past the boundary as a whole).
                seq.pop();
                nextSeq.unshift(lastpid);
                movedwhole++;
            }

            if (!movedwhole && !didsplit) {
                return;
            }
            const targetname = anchors[anchorIdx + 1].ankername === 'vormittag' ? 'Vormittag' : 'Nachmittag';
            const targetday = this.sequenz.tage[anchors[anchorIdx + 1].dayIdx];
            let msg;
            if (didsplit && !movedwhole) {
                msg = `Einheit geteilt – der Rest läuft am ${targetname} von Tag ${targetday.tag} als Fortsetzung weiter.`;
            } else if (didsplit) {
                msg = `${movedwhole === 1 ? 'Eine Einheit' : movedwhole + ' Einheiten'} verschoben und eine geteilt – Fortsetzung am ${targetname} von Tag ${targetday.tag}.`;
            } else {
                msg = `${movedwhole === 1 ? 'Eine Einheit' : movedwhole + ' Einheiten'} verschoben – läuft jetzt am ${targetname} von Tag ${targetday.tag} weiter.`;
            }
            this.setStatus(msg);
            this.setDirty(true);
            this.render();
        }

        // Split rule (didaktische Festlegung des Auftraggebers): keep the part
        // that still fits, continue the rest - as long as BOTH pieces stay at
        // least 15 minutes. A fixed minimum (no fraction of the total), so a
        // 90-min unit overhanging by 25 splits into 65/25, but a 10-min stub
        // before the break is still refused (then the whole unit moves).
        canSplit(dur, over) {
            const part1 = dur - over;
            const part2 = over;
            const minpiece = 15;
            return part1 >= minpiece && part2 >= minpiece;
        }

        // Turn placement `pid` into its staying part (dauer = keepmin) and add
        // a continuation placement (dauer = contmin) at the front of `nextSeq`.
        // Both parts carry the same splitgroup marker; the continuation is
        // flagged so the view labels it "Fortsetzung" and locks the alternative
        // swap on both parts (as for a Baustein that runs across the break).
        splitPlacement(pid, keepmin, contmin, nextSeq) {
            const origin = this.placement(pid);
            if (!origin) {
                return;
            }
            const contpid = this.uniqueId('px', this.sequenz.platzierungen);
            const splitid = contpid;
            origin.dauer = keepmin;
            origin.splitgroup = splitid;

            const cont = {
                typ: 'einheit',
                titel: origin.titel,
                dauer: contmin,
                bausteinid: origin.bausteinid || null,
                splitgroup: splitid,
                fortsetzung: true,
            };
            // The continuation gets its own copy of the unit selection so the
            // two parts clean up independently; alternatives are locked on both
            // parts, so the copy never diverges from the origin.
            const auswahl = this.auswahl(origin);
            if (auswahl) {
                const copyid = this.uniqueId('ea', this.sequenz.einheitenauswahlen);
                this.sequenz.einheitenauswahlen[copyid] = {
                    kandidaten: Array.isArray(auswahl.kandidaten) ? auswahl.kandidaten.slice() : [],
                    aktiv: auswahl.aktiv !== undefined ? auswahl.aktiv : null,
                };
                cont.einheitenauswahl = copyid;
            }
            if (origin.quelle) {
                cont.quelle = origin.quelle;
            }
            this.sequenz.platzierungen[contpid] = cont;
            nextSeq.unshift(contpid);
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

        // Handoff-SEQUENZ: Seminarphase aus der Zeile heraus setzen.
        //
        // Anders als Dauer oder Titel-Auswahl haengt die Phase an der
        // Bibliotheks-Karte, nicht an der Platzierung — sie beschreibt die
        // Methode selbst. Die Aenderung wirkt deshalb in jedem Seminarplan,
        // der diese Einheit nutzt (bewusste Entscheidung; das Menue sagt es an).
        // Gespeichert wird sofort ueber save_method_cards, nicht ueber den
        // Sequenz-Autosave: die Karten sind ein eigener Bestand.
        choosePhase(pid, label) {
            const placement = this.placement(pid);
            const card = placement ? this.activeCardForPlacement(placement) : null;
            const known = PHASE_KEYS.some((ph) => ph.label === label);
            if (!card || !known) {
                return;
            }
            const previous = card.seminarphase;
            if (this.fieldValue(card, 'seminarphase') === label) {
                this.openPhasePid = '';
                this.render();
                return;
            }
            // seminarphase ist ein Mehrfach-Feld; die Array-Form bleibt erhalten,
            // damit Editor und Export unveraendert damit umgehen.
            card.seminarphase = [label];
            this.openPhasePid = '';
            this.render();
            asCall('mod_seminarplaner_save_method_cards', {
                cmid: this.cmid,
                methodsjson: JSON.stringify(this.methodCardList),
            }).then(() => {
                this.toast(`Seminarphase: ${label} – gilt in allen Seminarplänen.`);
            }).catch(() => {
                // Zuruecksetzen, damit die Ansicht nicht eine Phase zeigt, die
                // serverseitig nie angekommen ist.
                card.seminarphase = previous;
                this.render();
                this.setStatus('Die Seminarphase konnte nicht gespeichert werden.', true);
            });
        }

        // C2/D8: eine Baustein-Variante aktivieren und den zusammenhängenden
        // Lauf tauschen. Vor dem Tausch wird der aktuelle Live-Stand in die
        // abgehende Variante zurückgeschrieben, damit Bearbeitungen an der
        // gerade aktiven Variante nicht verloren gehen.
        chooseVariant(bid, vid) {
            const baustein = this.baustein(bid);
            const variante = baustein && baustein.varianten ? baustein.varianten[vid] : null;
            if (!baustein || !variante || baustein.aktivevariante === vid) {
                return;
            }
            // Mehr-Anker-sicher: ALLE Läufe des Bausteins herausnehmen (nicht nur
            // den ersten), den abgehenden Stand als Variante sichern und die neue
            // Variante als einen Block an der Stelle des ersten Laufs einsetzen.
            const removed = this.collectAndRemoveRuns(bid);
            if (!removed) {
                return;
            }
            if (baustein.aktivevariante && baustein.varianten[baustein.aktivevariante]) {
                baustein.varianten[baustein.aktivevariante].platzierungen = removed.pids.slice();
            }
            const replacement = Array.isArray(variante.platzierungen) ? variante.platzierungen.slice() : [];
            replacement.forEach((pid) => {
                const p = this.placement(pid);
                if (p) {
                    p.bausteinid = bid;
                }
            });
            removed.seq.splice(removed.start, 0, ...replacement);
            baustein.aktivevariante = vid;
            this.openBausteinSwapBid = '';
            this.setDirty(true);
            this.render();
            this.toast(`Variante „${variante.titel || vid}" ist jetzt aktiv.`);
        }

        // Der zusammenhängende Lauf eines Bausteins in der Zeitleiste (ein Anker).
        locateBausteinRun(bid) {
            const anchors = this.anchorList();
            for (const anchor of anchors) {
                const run = this.findRun(anchor.seq, bid);
                if (run) {
                    return {
                        seq: anchor.seq,
                        start: run.start,
                        length: run.length,
                        pids: anchor.seq.slice(run.start, run.start + run.length),
                    };
                }
            }
            return null;
        }

        // Alle zusammenhängenden Läufe eines Bausteins über alle Anker-Abschnitte.
        // Ein über die Mittagspause laufender Baustein (D3-Fortsetzung) hat mehr
        // als einen Lauf – die Alternativen-Mechanik (ein Block, ein Tausch)
        // deckt bewusst nur Bausteine mit genau einem Lauf ab.
        bausteinRuns(bid) {
            const runs = [];
            this.anchorList().forEach((anchor) => {
                const seq = anchor.seq;
                let i = 0;
                while (i < seq.length) {
                    const p = this.placement(seq[i]);
                    if (p && p.bausteinid === bid) {
                        const start = i;
                        while (i < seq.length) {
                            const q = this.placement(seq[i]);
                            if (q && q.bausteinid === bid) {
                                i++;
                            } else {
                                break;
                            }
                        }
                        runs.push({seq, start, length: i - start, pids: seq.slice(start, i)});
                    } else {
                        i++;
                    }
                }
            });
            return runs;
        }

        // Ein Baustein taugt für Alternativen nur, wenn er genau einen
        // zusammenhängenden Lauf hat (nicht über die Mittagspause/mehrere Tage).
        isSingleRunBaustein(bid) {
            return this.bausteinRuns(bid).length === 1;
        }

        // Alle Läufe eines Bausteins aus der Zeitleiste nehmen und die pids (in
        // Reihenfolge) plus die Einfügestelle des ersten Laufs zurückgeben.
        // Grundlage für den Mehr-Anker-sicheren Varianten-Tausch: eine Alternative
        // kommt als ein zusammenhängender Block an der Stelle des ersten Laufs
        // zurück; läuft sie über den Anker, greift die normale Überlauf-Aktion.
        collectAndRemoveRuns(bid) {
            const runs = this.bausteinRuns(bid);
            if (!runs.length) {
                return null;
            }
            const seq = runs[0].seq;
            const start = runs[0].start;
            const pids = [];
            runs.forEach((r) => r.pids.forEach((pid) => pids.push(pid)));
            // Von hinten entfernen, damit die Indizes gültig bleiben (auch bei
            // mehreren Läufen im selben Anker).
            for (let i = runs.length - 1; i >= 0; i--) {
                runs[i].seq.splice(runs[i].start, runs[i].length);
            }
            return {pids, seq, start};
        }

        // Titel für den Baustein-Kopf: bei Alternativen der Titel der aktiven
        // Variante, sonst der Baustein-Titel.
        bausteinTitle(bid, baustein) {
            baustein = baustein || this.baustein(bid);
            const vid = baustein && baustein.aktivevariante;
            if (vid && baustein.varianten && baustein.varianten[vid]) {
                return baustein.varianten[vid].titel || baustein.titel || 'Baustein';
            }
            return (baustein && baustein.titel) || 'Baustein';
        }

        // Stellt sicher, dass der Baustein seinen aktuellen Lauf als (aktive)
        // Variante führt – Grundlage, bevor eine zweite Alternative dazukommt.
        ensureVariant(bid) {
            const baustein = this.baustein(bid);
            if (!baustein) {
                return null;
            }
            if (!baustein.varianten || typeof baustein.varianten !== 'object') {
                baustein.varianten = {};
            }
            const allpids = this.bausteinRuns(bid).reduce((acc, r) => acc.concat(r.pids), []);
            const activevid = baustein.aktivevariante;
            if (Object.keys(baustein.varianten).length && activevid && baustein.varianten[activevid]) {
                baustein.varianten[activevid].platzierungen = allpids.slice();
                return activevid;
            }
            const vid = this.uniqueId('vr', baustein.varianten);
            baustein.varianten[vid] = {
                titel: baustein.titel || 'Baustein',
                platzierungen: allpids.slice(),
            };
            baustein.aktivevariante = vid;
            return vid;
        }

        // C2/D8: einen anderen Baustein des Plans als Alternative anhängen.
        // Der gewählte Baustein wird aus der Zeitleiste geparkt und als weitere
        // Variante geführt; der Host-Baustein bleibt sichtbar/aktiv. Kein
        // Rendern/Toast – wird gebündelt aus saveBausteinEditor aufgerufen.
        // Rückgabe: true, wenn verknüpft.
        linkAlternative(hostbid, otherbid) {
            const host = this.baustein(hostbid);
            const other = this.baustein(otherbid);
            if (!host || !other || hostbid === otherbid) {
                return false;
            }
            this.ensureVariant(hostbid);
            // Mehr-Anker-sicher: alle Läufe des anderen Bausteins parken (nicht nur
            // den ersten), damit über die Mittagspause laufende Bausteine als
            // Alternative nutzbar sind, ohne ihre Fortsetzung zu verlieren.
            const removed = this.collectAndRemoveRuns(otherbid);
            if (!removed) {
                return false;
            }
            removed.pids.forEach((pid) => {
                const p = this.placement(pid);
                if (p) {
                    p.bausteinid = hostbid;
                }
            });
            const vid = this.uniqueId('vr', host.varianten);
            host.varianten[vid] = {
                titel: other.titel || 'Alternative',
                platzierungen: removed.pids.slice(),
            };
            delete this.sequenz.bausteine[otherbid];
            return true;
        }

        // Eine Alternative wieder lösen: die Variante kehrt als eigenständiger
        // Baustein in den Plan zurück, direkt hinter dem Host-Lauf. Die aktive
        // Variante lässt sich nicht lösen. Kein Rendern/Toast (siehe oben).
        // Rückgabe: true, wenn gelöst.
        unlinkAlternative(hostbid, vid) {
            const host = this.baustein(hostbid);
            if (!host || !host.varianten || !host.varianten[vid] || host.aktivevariante === vid) {
                return false;
            }
            const variante = host.varianten[vid];
            const pids = Array.isArray(variante.platzierungen) ? variante.platzierungen.slice() : [];
            const newbid = this.uniqueId('ba', this.sequenz.bausteine);
            this.sequenz.bausteine[newbid] = {
                titel: variante.titel || 'Baustein',
                unterthemen: '',
                themenplanreferenz: '',
                archiv: null,
                varianten: {},
                aktivevariante: null,
                quelle: {unitid: '', slotkey: ''},
            };
            pids.forEach((pid) => {
                const p = this.placement(pid);
                if (p) {
                    p.bausteinid = newbid;
                }
            });
            const run = this.locateBausteinRun(hostbid);
            if (run) {
                run.seq.splice(run.start + run.length, 0, ...pids);
            } else if (this.anchorList().length) {
                this.anchorList()[0].seq.push(...pids);
            }
            delete host.varianten[vid];
            // Bleibt nur noch eine Variante übrig, den Baustein wieder als
            // schlichten Baustein ohne Pillen führen.
            const rest = Object.keys(host.varianten);
            if (rest.length === 1) {
                const only = host.varianten[rest[0]];
                host.titel = only.titel || host.titel;
                host.varianten = {};
                host.aktivevariante = null;
            }
            return true;
        }

        // Kandidaten-Bausteine, die als Alternative eines Hosts taugen: andere
        // Bausteine des Plans mit genau einem Lauf und ohne eigene Varianten.
        alternativeCandidateBausteine(hostbid) {
            return Object.keys(this.sequenz.bausteine)
                .filter((bid) => bid !== hostbid)
                .map((bid) => this.baustein(bid) ? {bid, baustein: this.baustein(bid)} : null)
                .filter((c) => c
                    && Object.keys(c.baustein.varianten || {}).length === 0);
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

        // Leeren Baustein am Ende eines Ankers anlegen: nur Überschrift, keine
        // reservierte Dauer. Damit er im Sequenzmodell eine Position hat, trägt
        // er einen ungefüllten Platzhalter (leere Auswahl, Dauer 0, wie ein
        // migrierter Reservierungs-Platzhalter, D1). Beim Platzieren der ersten
        // Einheit verbraucht addCardToBaustein den Platzhalter automatisch.
        createEmptyBaustein(ankername) {
            const day = this.sequenz.tage[this.dayIndex];
            if (!day || !day.anker[ankername]) {
                return;
            }
            let counter = 1;
            while (this.sequenz.bausteine['bn' + counter]) {
                counter++;
            }
            const bid = 'bn' + counter;
            this.sequenz.bausteine[bid] = {
                titel: 'Neuer Baustein',
                unterthemen: '',
                themenplanreferenz: '',
                archiv: null,
                varianten: {},
                aktivevariante: null,
                quelle: {unitid: '', slotkey: ''},
            };
            const eaid = this.uniqueId('eax', this.sequenz.einheitenauswahlen);
            this.sequenz.einheitenauswahlen[eaid] = {kandidaten: [], aktiv: null};
            const pid = this.uniqueId('px', this.sequenz.platzierungen);
            this.sequenz.platzierungen[pid] = {
                typ: 'einheit',
                bausteinid: bid,
                einheitenauswahl: eaid,
                titel: '',
                dauer: 0,
            };
            day.anker[ankername].sequenz.push(pid);
            this.setDirty(true);
            this.render();
            this.toast('Leerer Baustein angelegt – Titel über „Bearbeiten", Einheiten über „＋ Einheit hinzufügen".');
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
            // If this was one half of a split unit, drop the split marker from
            // the lone survivor so it becomes an ordinary unit again (no stray
            // "Fortsetzung" badge, alternative swap re-enabled).
            if (placement.splitgroup) {
                this.cleanupSplitGroup(placement.splitgroup);
            }
            this.setDirty(true);
            this.render();
            this.toast('Entfernt – die Zeiten sind nachgerückt.');
        }

        cleanupSplitGroup(splitid) {
            const members = Object.keys(this.sequenz.platzierungen).filter((pid) => {
                return String(this.sequenz.platzierungen[pid].splitgroup || '') === String(splitid);
            });
            if (members.length <= 1) {
                members.forEach((pid) => {
                    delete this.sequenz.platzierungen[pid].splitgroup;
                    delete this.sequenz.platzierungen[pid].fortsetzung;
                });
            }
        }

        // Zwei direkt aufeinanderfolgende Teile derselben zerteilten Einheit
        // (gleiche splitgroup, gleicher Anker) gehören wieder zusammen - z. B.
        // wenn zwischen ihnen nichts (mehr) liegt oder eine weitere Teilung sie
        // benachbart gemacht hat. Sie werden zu einer Platzierung verschmolzen
        // (Dauern summiert); bleibt danach nur ein Teil der Gruppe, fällt die
        // Split-Markierung weg (wieder eine ganze Einheit). Rückgabe: true, wenn
        // etwas verschmolzen wurde. Über die Mittagspause getrennte Teile liegen
        // in verschiedenen Ankern und bleiben dadurch getrennt.
        mergeAdjacentSplitParts() {
            let changed = false;
            this.anchorList().forEach((anchor) => {
                const seq = anchor.seq;
                for (let i = 0; i < seq.length - 1; i++) {
                    const a = this.placement(seq[i]);
                    const b = this.placement(seq[i + 1]);
                    if (a && b && a.typ === 'einheit' && b.typ === 'einheit'
                            && a.splitgroup && String(a.splitgroup) === String(b.splitgroup)) {
                        a.dauer = (Number(a.dauer) || 0) + (Number(b.dauer) || 0);
                        const bpid = seq[i + 1];
                        const bauswahl = b.einheitenauswahl;
                        seq.splice(i + 1, 1);
                        delete this.sequenz.platzierungen[bpid];
                        if (bauswahl && !this.auswahlInUse(bauswahl)) {
                            delete this.sequenz.einheitenauswahlen[bauswahl];
                        }
                        changed = true;
                        i--; // dieselbe Stelle erneut prüfen (weitere Teile).
                    }
                }
            });
            if (changed) {
                const groups = {};
                Object.keys(this.sequenz.platzierungen).forEach((pid) => {
                    const sg = this.sequenz.platzierungen[pid].splitgroup;
                    if (sg) {
                        groups[sg] = (groups[sg] || 0) + 1;
                    }
                });
                Object.keys(groups).forEach((sg) => {
                    if (groups[sg] <= 1) {
                        this.cleanupSplitGroup(sg);
                    }
                });
            }
            return changed;
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
                    } else if (type === 'picker-tab') {
                        this.pickerTab = action.getAttribute('data-tab') || 'lokal';
                        root.querySelectorAll('.sq-picker__tab').forEach((t) => {
                            t.classList.toggle('active', t.getAttribute('data-tab') === this.pickerTab);
                        });
                        const s = bySel('#sq-picker-search');
                        this.renderPickerList(s ? s.value : '');
                    } else if (type === 'picker-add') {
                        const target = this.pickerTarget || {anker: this.pickerAnker || 'vormittag'};
                        const globalid = Number.parseInt(action.getAttribute('data-global-methodid') || '0', 10);
                        this.closeModal();
                        if (globalid > 0) {
                            // Methodensammlung: erst lokale Kopie übernehmen (D33), dann platzieren.
                            this.adoptAndPlace(globalid, target);
                        } else {
                            this.applySuggestTarget(action.getAttribute('data-cardid') || '', target);
                        }
                    } else if (type === 'intro-done') {
                        this.finishIntro();
                    } else if (type === 'baustein-save') {
                        this.saveBausteinEditor();
                    } else if (type === 'baustein-dissolve') {
                        this.dissolveBaustein(action.getAttribute('data-bid') || '');
                    } else if (type === 'quick-save') {
                        this.saveQuickCreate();
                    } else if (type === 'picker-create') {
                        // D50: aus dem Picker in den vollen Editor wechseln -
                        // dabei das Picker-Ziel (Anker oder Baustein) übernehmen.
                        this.openCreateEditor(this.pickerTarget || {anker: this.pickerAnker || 'vormittag'});
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

        // ---- Statisches Einheiten-Modal (sequenz.php, mit Tiny) ------------

        setUnitField(key, value) {
            if (UNIT_MULTI_FIELDS.includes(key)) {
                setMultiDropdownValues('#sq-e-' + key, value);
                return;
            }
            const el = bySel('#sq-e-' + key);
            if (!el) {
                return;
            }
            if (UNIT_RICH_FIELDS.includes(key)) {
                setRichValue(el, value);
                return;
            }
            el.value = value === null || value === undefined ? '' : String(value);
        }

        getUnitField(key) {
            if (UNIT_MULTI_FIELDS.includes(key)) {
                return readMultiDropdownValues('#sq-e-' + key);
            }
            const el = bySel('#sq-e-' + key);
            if (!el) {
                return '';
            }
            if (UNIT_RICH_FIELDS.includes(key)) {
                return getRichValue(el);
            }
            return String(el.value || '').trim();
        }

        // Alternative Seminareinheiten (D8/D21): Optionen sind alle anderen
        // Einheiten des Bestands; daher dynamisch beim Öffnen des Modals
        // gefüllt (wie refreshEditAlternativeOptions im Bibliotheks-Editor).
        // preselected = Liste von Karten-IDs, currentid = die bearbeitete
        // Einheit (schließt sich selbst aus).
        refreshUnitAlternativeOptions(preselected, currentid) {
            const host = bySel('#sq-e-alternativen-options');
            const hidden = bySel('#sq-e-alternativen');
            if (!host || !hidden) {
                return;
            }
            const selected = (Array.isArray(preselected) ? preselected : [])
                .map((v) => String(v).trim()).filter(Boolean);
            hidden.value = selected.join('##');
            host.innerHTML = '';
            this.methodCardList.forEach((card) => {
                const id = String(card.id || '').trim();
                const title = cardTitle(card).trim();
                if (!id || !title || id === String(currentid || '')) {
                    return;
                }
                const row = document.createElement('label');
                row.className = 'kg-tag-option';
                row.innerHTML = `<input type="checkbox" value="${escapeHtml(id)}" data-kg-form-multi-option="1">`
                    + `<span>${escapeHtml(title)}</span>`;
                host.appendChild(row);
            });
            host.querySelectorAll('[data-kg-form-multi-option="1"]').forEach((checkbox) => {
                checkbox.checked = selected.includes(String(checkbox.value || '').trim());
                checkbox.addEventListener('change', () => {
                    const values = Array.from(host.querySelectorAll('[data-kg-form-multi-option="1"]:checked'))
                        .map((cb) => String(cb.value || '').trim())
                        .filter(Boolean);
                    setMultiDropdownValues('#sq-e-alternativen', values);
                });
            });
            setMultiDropdownValues('#sq-e-alternativen', selected);
        }

        // Datei-Anhänge: Filemanager-Formular je Einheit über die Fragment-API
        // nachladen (leere methodid = Anlegen-Modus, leerer Entwurfsbereich).
        loadUnitMaterials(methodid) {
            const host = bySel('#sq-e-materialien-host');
            if (!host) {
                return;
            }
            host.innerHTML = '<div class="sq-field__hint">Datei-Anhänge werden geladen …</div>';
            Fragment.loadFragment('mod_seminarplaner', 'unitmaterials', M.cfg.contextid, {methodid: methodid || ''})
                .done((html, js) => {
                    Templates.replaceNodeContents(host, html, js);
                })
                .fail(() => {
                    host.innerHTML = '<div class="sq-field__hint">Datei-Anhänge konnten nicht geladen werden – '
                        + 'du kannst sie weiterhin im Tab „Bibliothek" verwalten.</div>';
                });
        }

        unitMaterialDraftItemId() {
            const el = bySel('#id_sq_materialiendraftitemid');
            if (!el) {
                return 0;
            }
            return Number.parseInt(String(el.value || '0'), 10) || 0;
        }

        // mode: 'edit' (bestehende Karte) oder 'create' (D50, leer).
        openUnitModal(mode, card) {
            this.unitModalMode = mode;
            // Ein evtl. offenes dynamisches Modal (z. B. der Picker) schließt.
            this.closeModal();
            UNIT_FIELD_KEYS.forEach((key) => {
                // Multi-Felder bekommen den Rohwert (Array), sonst würden
                // Werte mit Komma beim Rück-Splitten zerfallen.
                const raw = UNIT_MULTI_FIELDS.includes(key) ? card[key] : this.fieldValue(card, key);
                this.setUnitField(key, raw);
            });
            const currentid = mode === 'edit' && card && card.id ? String(card.id) : '';
            this.refreshUnitAlternativeOptions(card && Array.isArray(card.alternativen) ? card.alternativen : [], currentid);
            this.loadUnitMaterials(currentid);
            const title = bySel('#sq-unit-modal-title');
            if (title) {
                title.textContent = mode === 'create' ? 'Neue Seminareinheit anlegen' : 'Seminareinheit bearbeiten';
            }
            const save = bySel('#sq-unit-save');
            if (save) {
                save.textContent = mode === 'create' ? 'Anlegen und einplanen' : 'Übernehmen';
            }
            const overlay = bySel('#sq-unit-modal');
            if (overlay) {
                overlay.classList.add('open');
                overlay.scrollTop = 0;
            }
            const titlefield = bySel('#sq-e-titel');
            if (titlefield) {
                titlefield.focus();
            }
        }

        closeUnitModal() {
            const overlay = bySel('#sq-unit-modal');
            if (overlay) {
                overlay.classList.remove('open');
            }
        }

        saveUnitModal() {
            if (this.unitModalMode === 'create') {
                this.saveCreateEditor();
                return;
            }
            const placement = this.placement(this.editorPid);
            const card = placement ? this.activeCardForPlacement(placement) : null;
            if (!placement || !card) {
                this.closeUnitModal();
                return;
            }
            const values = {};
            UNIT_FIELD_KEYS.forEach((key) => {
                values[key] = this.getUnitField(key);
            });
            const duration = Number.parseInt(String(values.zeitbedarf || '').replace(/\D+/g, ''), 10);
            Object.keys(values).forEach((key) => {
                const incoming = values[key];
                if (UNIT_MULTI_FIELDS.includes(key)) {
                    // Kommt bereits als Liste aus dem Dropdown.
                    card[key] = Array.isArray(incoming) ? incoming : splitMultiValue(incoming);
                } else if (Array.isArray(card[key])) {
                    card[key] = String(incoming).split(',').map((part) => part.trim()).filter(Boolean);
                } else {
                    card[key] = incoming;
                }
            });
            // Alternative Seminareinheiten (dynamische IDs, eigene Behandlung):
            // sich selbst nie als Alternative speichern.
            card.alternativen = readMultiDropdownValues('#sq-e-alternativen')
                .filter((id) => String(id) !== String(card.id));
            // Datei-Anhänge: Der Entwurfsbereich (Fragment) wird beim Speichern
            // serverseitig in den Dateibestand der Einheit übernommen.
            const draftid = this.unitMaterialDraftItemId();
            if (draftid > 0) {
                if (!Array.isArray(card.materialien)) {
                    card.materialien = [];
                }
                card.materialiendraftitemid = draftid;
            }

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
                this.closeUnitModal();
                this.setDirty(true);
                this.render();
                this.toast('Gespeichert – Dauer geändert? Dann sind die Zeiten schon angepasst.');
            }).catch(() => {
                this.setStatus('Die Einheit konnte nicht gespeichert werden.', true);
            });
        }

        openEditor(pid) {
            const placement = this.placement(pid);
            const card = placement ? this.activeCardForPlacement(placement) : null;
            if (!placement) {
                return;
            }
            this.editorPid = pid;
            if (card) {
                // Karten-Editor mit Rich-Text: statisches Modal.
                this.openUnitModal('edit', card);
                return;
            }
            // Pausen und Einheiten ohne Bibliothekseintrag: schlanker
            // dynamischer Dialog (nur Titel und Dauer, kein Rich-Text).
            const root = this.modalRoot();
            const text = (label, key, value, hint = '') => `
                <div class="sq-field">
                  <label class="kg-label">${label}</label>
                  <input type="text" class="kg-input" data-sq-field="${key}" value="${escapeHtml(value)}">
                  ${hint ? `<div class="sq-field__hint">${hint}</div>` : ''}
                </div>`;
            const ispause = placement.typ === 'pause';
            const body = `
                ${text('Titel', 'titel', placement.titel || '')}
                ${text('Dauer (Minuten)', 'zeitbedarf', String(placement.dauer || ''))}
                ${ispause ? '' : '<div class="sq-field__hint">Diese Einheit hat noch keinen Bibliothekseintrag – nur Titel und Dauer sind änderbar.</div>'}`;

            root.innerHTML = `
                <div class="sq-modal">
                  <div class="sq-modal__head">
                    <h3>${ispause ? 'Pause bearbeiten' : 'Seminareinheit bearbeiten'}</h3>
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

        // Speichern des schlanken dynamischen Dialogs (Pause / Einheit ohne
        // Bibliothekseintrag); der Karten-Editor speichert über saveUnitModal.
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
            const duration = Number.parseInt(String(values.zeitbedarf || '').replace(/\D+/g, ''), 10);
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
        }

        // Handoff-SEQUENZ „Dauer editieren": Dauer direkt in der Zeit-Spalte.
        // Die Dauer haengt an der Platzierung, nicht an der Bibliotheks-Karte —
        // dieselbe Einheit darf in einem anderen Plan anders lang sein. Alle
        // Folgezeiten und das Budget leiten sich daraus ab und aktualisieren
        // sich mit dem Re-Render von selbst (nichts davon ist gespeichert).
        setPlacementDuration(pid, raw) {
            const placement = this.placement(pid);
            if (!placement) {
                return;
            }
            const parsed = Number.parseInt(String(raw).replace(/\D+/g, ''), 10);
            const previous = Math.max(0, Number(placement.dauer) || 0);
            // Leeres oder unlesbares Feld heisst „nichts aendern", nicht „0" —
            // eine Einheit auf 0 zu setzen waere fast immer ein Vertipper.
            if (!Number.isFinite(parsed)) {
                this.render();
                return;
            }
            const duration = Math.min(MAX_UNIT_MINUTES, Math.max(0, parsed));
            if (duration === previous) {
                // Nur das Feld normalisieren (z. B. „0060" -> „60").
                this.render();
                return;
            }
            placement.dauer = duration;
            this.setDirty(true);
            this.render();
        }

        // ---- Neue Seminareinheit anlegen (D50) -------------------------------
        // Vierter D17-Einstieg: voller Editor ohne Vorbelegung, erreichbar aus
        // dem Einheiten-Picker und über den Werkzeugleisten-Button. Legt die
        // Karte in der Bibliothek an und plant sie sofort ein.

        openCreateEditor(target) {
            this.createTarget = target || {};
            this.openUnitModal('create', {zeitbedarf: '30'});
        }

        saveCreateEditor() {
            const values = {};
            UNIT_FIELD_KEYS.forEach((key) => {
                values[key] = this.getUnitField(key);
            });
            const titel = String(values.titel || '').trim();
            if (!titel) {
                const title = bySel('#sq-e-titel');
                if (title) {
                    title.focus();
                }
                return;
            }
            const duration = Number.parseInt(String(values.zeitbedarf || '').replace(/\D+/g, ''), 10);
            // Feldform wie beim Anlegen in der Bibliothek (methods-Karten):
            // seminarphase/sozialform/raum sind Arrays (kommen so aus den
            // Multi-Dropdowns), der Rest Strings.
            const card = {
                id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
                titel,
                seminarphase: splitMultiValue(values.seminarphase),
                zeitbedarf: String(Number.isFinite(duration) && duration > 0 ? duration : 30),
                gruppengroesse: String(values.gruppengroesse || '').trim(),
                kurzbeschreibung: String(values.kurzbeschreibung || ''),
                autor: String(values.autor || '').trim(),
                lernziele: String(values.lernziele || ''),
                raum: splitMultiValue(values.raum),
                sozialform: splitMultiValue(values.sozialform),
                risiken: String(values.risiken || ''),
                debrief: String(values.debrief || ''),
                materialien: [],
                materialiendraftitemid: this.unitMaterialDraftItemId() || 0,
                materialtechnik: String(values.materialtechnik || ''),
                ablauf: String(values.ablauf || ''),
                tags: String(values.tags || '').trim(),
                alternativen: readMultiDropdownValues('#sq-e-alternativen'),
                timemodified: Date.now(),
            };
            this.methodCardList.push(card);
            this.methodCards[String(card.id)] = card;
            asCall('mod_seminarplaner_save_method_cards', {
                cmid: this.cmid,
                methodsjson: JSON.stringify(this.methodCardList),
            }).then(() => {
                this.closeUnitModal();
                this.applySuggestTarget(String(card.id), this.createTarget || {});
            }).catch(() => {
                this.setStatus('Die neue Einheit konnte nicht angelegt werden.', true);
            });
        }

        // ---- Module master data editor (owns the former Bausteine tab data) --

        // Feld „Alternative Bausteine" (Multi-Dropdown, wie „Alternative
        // Seminareinheiten" beim Einheiten-Editor). Gilt für alle Bausteine -
        // auch für über die Mittagspause laufende (Mehr-Anker-sicherer Tausch).
        renderBausteinAltField(hostbid, baustein) {
            const varianten = baustein.varianten || {};
            const active = baustein.aktivevariante;
            const options = [];
            // Bereits verknüpfte Alternativen (nicht-aktive Varianten) – kommen
            // beim Öffnen vorausgewählt zurück.
            Object.keys(varianten).forEach((vid) => {
                if (vid === active) {
                    return;
                }
                options.push({value: 'v:' + vid, label: varianten[vid].titel || 'Alternative'});
            });
            // Andere, geeignete Bausteine des Plans.
            this.alternativeCandidateBausteine(hostbid).forEach((c) => {
                options.push({value: 'b:' + c.bid, label: this.bausteinTitle(c.bid, c.baustein)});
            });
            if (!options.length) {
                return `
                    <div class="sq-field">
                      <label class="kg-label">Alternative Bausteine</label>
                      <div class="sq-field__hint">Es gibt keinen weiteren geeigneten Baustein in diesem Plan.</div>
                    </div>`;
            }
            const opts = options.map((o) =>
                `<label class="kg-tag-option"><input type="checkbox" value="${escapeHtml(o.value)}" data-kg-form-multi-option="1"><span>${escapeHtml(o.label)}</span></label>`
            ).join('');
            return `
                <div class="sq-field">
                  <label class="kg-label" for="sq-b-alternativen">Alternative Bausteine</label>
                  <div class="kg-tag-dropdown" id="sq-b-alternativen-dropdown" data-kg-form-multi-dropdown="1"
                    data-kg-field="#sq-b-alternativen" data-kg-label-prefix="Alternativen" data-kg-placeholder="Alternative Bausteine wählen">
                    <button type="button" class="kg-input kg-tag-dropdown-toggle" id="sq-b-alternativen-toggle" data-kg-form-multi-toggle="1">Alternative Bausteine wählen</button>
                    <div class="kg-tag-dropdown-panel kg-hidden" id="sq-b-alternativen-panel" data-kg-form-multi-panel="1">${opts}</div>
                  </div>
                  <input type="hidden" id="sq-b-alternativen" value="">
                  <div class="sq-field__hint">Gewählte Bausteine werden geparkt und über den „⇄ Alternative"-Schalter am Baustein umgeschaltet.</div>
                </div>`;
        }

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
                      <input type="text" class="kg-input" data-sq-field="titel" value="${escapeHtml(this.bausteinTitle(bid, baustein))}">
                    </div>
                    <div class="sq-field">
                      <label class="kg-label">Unterthemen</label>
                      <textarea class="kg-input" rows="5" data-sq-field="unterthemen">${escapeHtml(htmlToLines(baustein.unterthemen))}</textarea>
                      <div class="sq-field__hint">Eine Zeile je Unterthema.</div>
                    </div>
                    ${this.renderBausteinAltField(bid, baustein)}
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
            // Multi-Dropdown binden + bereits verknüpfte Alternativen vorbelegen.
            const dd = root.querySelector('#sq-b-alternativen-dropdown');
            if (dd) {
                bindMultiDropdown(dd);
                const preselected = Object.keys(baustein.varianten || {})
                    .filter((vid) => vid !== baustein.aktivevariante)
                    .map((vid) => 'v:' + vid);
                setMultiDropdownValues('#sq-b-alternativen', preselected);
            }
        }

        saveBausteinEditor() {
            const root = bySel('#sq-modal');
            const host = this.baustein(this.editorBid);
            if (!root || !host) {
                return;
            }
            const hostbid = this.editorBid;
            const titel = root.querySelector('[data-sq-field="titel"]');
            const unterthemen = root.querySelector('[data-sq-field="unterthemen"]');
            const newtitel = titel && titel.value.trim() ? titel.value.trim() : '';
            if (newtitel) {
                // Der Titel gilt für die aktuell gezeigte (aktive) Variante,
                // sonst für den schlichten Baustein.
                const active = host.aktivevariante;
                if (active && host.varianten && host.varianten[active]) {
                    host.varianten[active].titel = newtitel;
                } else {
                    host.titel = newtitel;
                }
            }
            if (unterthemen) {
                host.unterthemen = unterthemen.value.trim();
            }
            // Alternativen abgleichen (nur wenn das Dropdown vorhanden war = Ein-Lauf-Host).
            let changedAlt = false;
            if (root.querySelector('#sq-b-alternativen')) {
                const selected = readMultiDropdownValues('#sq-b-alternativen');
                const keepVariants = new Set(selected.filter((v) => v.indexOf('v:') === 0).map((v) => v.slice(2)));
                const addBausteine = selected.filter((v) => v.indexOf('b:') === 0).map((v) => v.slice(2));
                // Abgewählte bestehende Alternativen lösen (aktive nie).
                Object.keys(host.varianten || {}).forEach((vid) => {
                    if (vid !== host.aktivevariante && !keepVariants.has(vid)) {
                        if (this.unlinkAlternative(hostbid, vid)) {
                            changedAlt = true;
                        }
                    }
                });
                // Neu gewählte Bausteine verknüpfen.
                addBausteine.forEach((bid) => {
                    if (this.linkAlternative(hostbid, bid)) {
                        changedAlt = true;
                    }
                });
            }
            this.closeModal();
            this.setDirty(true);
            this.render();
            this.toast(changedAlt ? 'Baustein aktualisiert – Alternativen angepasst.' : 'Baustein aktualisiert.');
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

        openPicker(ankername, targetPid) {
            this.pickerAnker = ankername;
            // Ziel: entweder ein Anker (freistehende Einheit) oder ein Baustein-
            // Platzhalter (Einheit landet im Baustein, addCardToBaustein).
            this.pickerTarget = targetPid ? {pid: targetPid} : {anker: ankername};
            this.pickerTab = 'lokal';
            // Dritter Tab nur, wenn ein Seminarkonzept in diese Aktivität
            // importiert wurde - dessen Einheiten tragen das ID-Präfix "konzept-".
            const hasKonzept = this.methodCardList.some((c) => String((c && c.id) || '').indexOf('konzept-') === 0);
            const tab = (id, label) => `<button type="button" class="sq-picker__tab${this.pickerTab === id ? ' active' : ''}" data-sq-action="picker-tab" data-tab="${id}">${label}</button>`;
            const root = this.modalRoot();
            root.innerHTML = `
                <div class="sq-modal">
                  <div class="sq-modal__head">
                    <h3>Einheit hinzufügen</h3>
                    <button type="button" class="sq-modal__close" data-sq-action="modal-close">✕</button>
                  </div>
                  <div class="sq-modal__body">
                    <div class="sq-picker__tabs" role="tablist">
                      ${tab('lokal', 'Lokale Bibliothek')}
                      ${tab('global', 'Methodensammlung')}
                      ${hasKonzept ? tab('konzept', 'Importiertes Konzept') : ''}
                    </div>
                    <div class="sq-field">
                      <input type="text" class="kg-input" id="sq-picker-search" placeholder="Suchen …">
                    </div>
                    <label class="sq-picker__filter">
                      <input type="checkbox" id="sq-picker-unused"${this.pickerUnusedOnly ? ' checked' : ''}>
                      <span>Nur noch nicht verwendete Einheiten anzeigen</span>
                    </label>
                    <div id="sq-picker-list" class="sq-picker"></div>
                    <div class="sq-picker__createrow">
                      <button type="button" class="kg-btn" data-sq-action="picker-create">＋ Neue Einheit anlegen</button>
                    </div>
                  </div>
                </div>`;
            root.classList.add('open');
            const search = bySel('#sq-picker-search');
            if (search) {
                search.addEventListener('input', () => this.renderPickerList(search.value));
                search.focus();
            }
            const unusedCb = bySel('#sq-picker-unused');
            if (unusedCb) {
                unusedCb.addEventListener('change', () => {
                    this.pickerUnusedOnly = unusedCb.checked;
                    this.renderPickerList(search ? search.value : '');
                });
            }
            this.renderPickerList('');
        }

        renderPickerList(filter) {
            const list = bySel('#sq-picker-list');
            if (!list) {
                return;
            }
            const needle = String(filter || '').trim().toLowerCase();
            const tab = this.pickerTab || 'lokal';
            const isKonzept = (c) => String((c && c.id) || '').indexOf('konzept-') === 0;
            let source;
            if (tab === 'global') {
                source = this.globalMethods || [];
            } else if (tab === 'konzept') {
                source = this.methodCardList.filter(isKonzept);
            } else {
                // Lokale Bibliothek ohne die Konzept-Import-Karten (eigener Tab).
                source = this.methodCardList.filter((c) => !isKonzept(c));
            }
            const placedRefs = this.placedCardRefs();
            const unusedOnly = !!this.pickerUnusedOnly;
            const cards = source.filter((card) => {
                if (unusedOnly && placedRefs.has(String(card.id))) {
                    return false;
                }
                return !needle || cardTitle(card).toLowerCase().includes(needle);
            }).slice(0, 60);
            if (!cards.length) {
                const empty = unusedOnly
                    ? 'Keine noch nicht verwendete Einheit gefunden.'
                    : (tab === 'global'
                        ? 'Keine globale Methode gefunden (oder Methodensammlung nicht verfügbar).'
                        : 'Keine passende Einheit gefunden.');
                list.innerHTML = `<div class="sq-empty">${empty}</div>`;
                return;
            }
            list.innerHTML = cards.map((card) => {
                const duration = Number.parseInt(String(card.zeitbedarf || '').replace(/\D+/g, ''), 10);
                const phase = this.fieldValue(card, 'seminarphase');
                const used = placedRefs.has(String(card.id));
                const globalid = card._isglobal ? (Number(card._globalid) || 0) : 0;
                const setname = card._isglobal ? String(card._setname || '') : '';
                return `
                    <div class="sq-picker__row${used ? ' sq-picker__row--used' : ''}">
                      <div class="sq-unit__main">
                        <div class="sq-unit__title">${escapeHtml(cardTitle(card))}</div>
                        <div class="sq-unit__meta">
                          ${Number.isFinite(duration) && duration > 0 ? `<span class="sq-badge">${duration} Min.</span>` : ''}
                          ${phase ? `<span class="sq-badge">${escapeHtml(phase)}</span>` : ''}
                          ${setname ? `<span class="sq-badge">${escapeHtml(setname)}</span>` : ''}
                          ${used ? '<span class="sq-badge sq-badge--used">bereits verwendet</span>' : ''}
                        </div>
                      </div>
                      <button type="button" class="kg-btn kg-btn-primary" data-sq-action="picker-add"
                        data-cardid="${escapeHtml(String(card.id))}"${globalid ? ` data-global-methodid="${globalid}"` : ''}>Übernehmen</button>
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

        // Handoff-SeqUnit: die Zeile trägt Dauer, Phase und Gruppengröße als Badges.
        placementGroupSize(placement) {
            const card = this.activeCardForPlacement(placement);
            return card ? this.fieldValue(card, 'gruppengroesse').trim() : '';
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

            // Regel 8 (Seminar): Zeitrahmen-Hinweis (D53). Summe aller
            // Platzierungen (Einheiten + Pausen) gegen die verfügbaren
            // Anker-Fenster über alle Tage (D45-An-/Abreise-Anker = 0).
            let framecapacity = 0;
            let frameused = 0;
            this.sequenz.tage.forEach((tag, idx) => {
                const dframe = this.dayFrame(idx);
                ANCHORS.forEach((ankername) => {
                    framecapacity += this.anchorBudget(dframe, ankername);
                    const seq = (tag.anker && tag.anker[ankername] && tag.anker[ankername].sequenz) || [];
                    frameused += this.usedMinutes(seq);
                });
            });
            if (framecapacity > 0 && frameused > 0) {
                const fmtDuration = (min) => {
                    const total = Math.max(0, Math.round(min));
                    const hours = Math.floor(total / 60);
                    const rest = total % 60;
                    if (hours && rest) {
                        return `${hours} Std. ${rest} Min.`;
                    }
                    if (hours) {
                        return `${hours} Std.`;
                    }
                    return `${rest} Min.`;
                };
                const usedlabel = fmtDuration(frameused);
                const capacitylabel = fmtDuration(framecapacity);
                if (frameused > framecapacity + 10) {
                    findings.push({ok: false, text: `Insgesamt ist etwas mehr geplant, als der Zeitrahmen hergibt (${usedlabel} von ${capacitylabel}) – vielleicht lässt sich etwas kürzen oder auf einen anderen Tag legen.`});
                } else if (framecapacity - frameused > 60 && frameused < framecapacity * 0.75) {
                    findings.push({ok: false, text: `Im Zeitrahmen ist noch reichlich Platz (${usedlabel} von ${capacitylabel} verplant) – hier ist Raum für weitere Einheiten oder großzügigere Zeitfenster.`});
                } else {
                    findings.push({ok: true, text: `Die geplanten Einheiten passen gut in den Zeitrahmen (${usedlabel} von ${capacitylabel}).`});
                }
            }

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

            // Regel 9 (Seminar): Zielabdeckung (D61). Hinweis, wenn ein
            // Seminarziel noch mit keiner Seminareinheit verknüpft ist. Still,
            // solange keine Seminarziele eingetragen sind.
            const ziele = (this.sequenz && Array.isArray(this.sequenz.seminarziele)) ? this.sequenz.seminarziele : [];
            const namedziele = ziele.filter((ziel) => String(ziel.text || '').trim());
            if (namedziele.length) {
                const offen = namedziele.filter((ziel) => !(Array.isArray(ziel.einheiten) && ziel.einheiten.length));
                if (!offen.length) {
                    findings.push({ok: true, text: 'Alle Seminarziele sind mit mindestens einer Seminareinheit verknüpft.'});
                } else if (offen.length === 1) {
                    findings.push({ok: false, text: `Das Seminarziel „${offen[0].text.trim()}" ist noch mit keiner Seminareinheit verknüpft.`});
                } else {
                    findings.push({ok: false, text: `${offen.length} Seminarziele sind noch mit keiner Seminareinheit verknüpft.`});
                }
            }

            return findings;
        }

        // ---- D61: Seminarziele ------------------------------------------------

        // Alle im Plan platzierten (gefüllten) Seminareinheiten, dedupliziert
        // nach Karten-ID – Grundlage der Verknüpfungs-Checkliste je Ziel.
        allPlacedUnits() {
            const seen = {};
            const list = [];
            (this.sequenz && Array.isArray(this.sequenz.tage) ? this.sequenz.tage : []).forEach((day) => {
                ANCHORS.forEach((ankername) => {
                    const seq = (day && day.anker && day.anker[ankername] && day.anker[ankername].sequenz) || [];
                    seq.forEach((pid) => {
                        const placement = this.placement(pid);
                        if (!placement || placement.typ !== 'einheit' || this.isUnfilled(placement)) {
                            return;
                        }
                        const auswahl = this.auswahl(placement);
                        const cardid = auswahl && auswahl.aktiv ? String(auswahl.aktiv) : '';
                        if (!cardid || seen[cardid]) {
                            return;
                        }
                        seen[cardid] = true;
                        const card = this.methodCardForRef(cardid);
                        list.push({cardid, titel: (card && cardTitle(card)) || placement.titel || 'Einheit'});
                    });
                });
            });
            return list;
        }

        goalMap() {
            const map = {};
            ((this.sequenz && this.sequenz.seminarziele) || []).forEach((ziel) => {
                map[ziel.id] = true;
            });
            return map;
        }

        goalById(id) {
            return ((this.sequenz && this.sequenz.seminarziele) || []).find((ziel) => String(ziel.id) === String(id)) || null;
        }

        addGoal(text) {
            if (!this.sequenz) {
                return;
            }
            if (!Array.isArray(this.sequenz.seminarziele)) {
                this.sequenz.seminarziele = [];
            }
            const id = this.uniqueId('zl', this.goalMap());
            this.sequenz.seminarziele.push({id, text: String(text || ''), einheiten: []});
            this.goalsOpen = true;
            this.setDirty(true);
            this.renderGoals();
            this.renderDrama();
        }

        deleteGoal(id) {
            if (!this.sequenz || !id) {
                return;
            }
            this.sequenz.seminarziele = ((this.sequenz.seminarziele) || []).filter((ziel) => String(ziel.id) !== String(id));
            delete this.openGoalLinks[id];
            this.setDirty(true);
            this.renderGoals();
            this.renderDrama();
        }

        setGoalText(id, text) {
            const ziel = this.goalById(id);
            if (!ziel) {
                return;
            }
            ziel.text = String(text || '');
            this.setDirty(true);
            // Kein renderGoals() (Fokus im Eingabefeld erhalten); die
            // Zielabdeckungs-Regel arbeitet ohnehin mit den Verknüpfungen.
            this.renderDrama();
        }

        toggleGoalLink(id, cardid, checked) {
            const ziel = this.goalById(id);
            if (!ziel || !cardid) {
                return;
            }
            const set = {};
            (ziel.einheiten || []).forEach((ref) => {
                set[String(ref)] = true;
            });
            if (checked) {
                set[String(cardid)] = true;
            } else {
                delete set[String(cardid)];
            }
            ziel.einheiten = Object.keys(set);
            this.openGoalLinks[id] = true;
            this.setDirty(true);
            this.renderGoals();
            this.renderDrama();
        }

        renderGoalRow(ziel, units) {
            const linked = {};
            (ziel.einheiten || []).forEach((ref) => {
                linked[String(ref)] = true;
            });
            const linkedcount = units.filter((unit) => linked[unit.cardid]).length;
            const options = units.map((unit) => `
                <label class="sq-goal-link">
                  <input type="checkbox" class="sq-goal-link__cb" data-goalid="${escapeHtml(ziel.id)}" data-cardid="${escapeHtml(unit.cardid)}"${linked[unit.cardid] ? ' checked' : ''}>
                  <span>${escapeHtml(unit.titel)}</span>
                </label>`).join('');
            const emptyunits = units.length ? '' : '<div class="sq-field__hint">Noch keine Einheiten im Plan platziert.</div>';
            const linksopen = this.openGoalLinks[ziel.id] ? ' open' : '';
            return `
                <div class="sq-goal" data-goalid="${escapeHtml(ziel.id)}">
                  <div class="sq-goal__head">
                    <input type="text" class="kg-input sq-goal-text" data-goalid="${escapeHtml(ziel.id)}" value="${escapeHtml(ziel.text)}" placeholder="Seminarziel …">
                    <button type="button" class="kg-btn sq-goal__del" data-sq-goal="delete" data-goalid="${escapeHtml(ziel.id)}" title="Ziel löschen">✕</button>
                  </div>
                  <details class="sq-goal-links" data-goalid="${escapeHtml(ziel.id)}"${linksopen}>
                    <summary><span class="sq-tri" aria-hidden="true">▸</span> Verknüpfte Einheiten (${linkedcount}${units.length ? '/' + units.length : ''})</summary>
                    <div class="sq-goal-links__list">${options || emptyunits}</div>
                  </details>
                </div>`;
        }

        renderGoals() {
            const host = bySel('#sq-goals');
            if (!host) {
                return;
            }
            if (!this.sequenz) {
                host.innerHTML = '';
                return;
            }
            const ziele = Array.isArray(this.sequenz.seminarziele) ? this.sequenz.seminarziele : [];
            const units = this.allPlacedUnits();
            const rows = ziele.map((ziel) => this.renderGoalRow(ziel, units)).join('');
            const open = this.goalsOpen ? ' open' : '';
            host.innerHTML = `
                <details class="sq-goals__box"${open}>
                  <summary class="sq-goals__summary"><span class="sq-tri" aria-hidden="true">▸</span> 🎯 Seminarziele${ziele.length ? ` (${ziele.length})` : ''}</summary>
                  <div class="sq-goals__body">
                    <p class="sq-goals__hint">Formuliere die übergeordneten Ziele des Seminars und hake je Ziel ab, welche Einheiten es adressieren.</p>
                    <div class="sq-goals__list">${rows}</div>
                    <div class="sq-goals__add">
                      <input type="text" class="kg-input" id="sq-goal-new" placeholder="Neues Seminarziel …">
                      <button type="button" class="kg-btn sq-lz-trigger" data-sq-goal="editor" title="Geführt formulieren">✎ Formulieren</button>
                      <button type="button" class="kg-btn kg-btn-primary" data-sq-goal="add">＋ Ziel hinzufügen</button>
                    </div>
                  </div>
                </details>`;
        }

        bindGoals() {
            const host = bySel('#sq-goals');
            if (!host) {
                return;
            }
            host.addEventListener('click', (event) => {
                const action = event.target.closest('[data-sq-goal]');
                if (!action) {
                    return;
                }
                const type = action.getAttribute('data-sq-goal');
                if (type === 'add') {
                    const input = bySel('#sq-goal-new');
                    const text = input ? input.value.trim() : '';
                    if (!text) {
                        return;
                    }
                    this.addGoal(text);
                } else if (type === 'editor') {
                    // D62: geführt ein Seminarziel formulieren.
                    LernzielEditor.open((sentence) => this.addGoal(sentence));
                } else if (type === 'delete') {
                    this.deleteGoal(action.getAttribute('data-goalid') || '');
                }
            });
            host.addEventListener('change', (event) => {
                const checkbox = event.target.closest('.sq-goal-link__cb');
                if (checkbox) {
                    this.toggleGoalLink(checkbox.getAttribute('data-goalid') || '', checkbox.getAttribute('data-cardid') || '', checkbox.checked);
                    return;
                }
                const textinput = event.target.closest('.sq-goal-text');
                if (textinput) {
                    this.setGoalText(textinput.getAttribute('data-goalid') || '', textinput.value);
                }
            });
            // Auf-/Zu-Zustand merken (toggle bubbelt nicht → Capture-Phase).
            host.addEventListener('toggle', (event) => {
                const target = event.target;
                if (!target || !target.classList) {
                    return;
                }
                if (target.classList.contains('sq-goals__box')) {
                    this.goalsOpen = target.open;
                } else if (target.classList.contains('sq-goal-links')) {
                    const goalid = target.getAttribute('data-goalid') || '';
                    if (goalid) {
                        if (target.open) {
                            this.openGoalLinks[goalid] = true;
                        } else {
                            delete this.openGoalLinks[goalid];
                        }
                    }
                }
            }, true);
        }

        // ---- D62: Geführter Lernziel-Editor (Modul lernzieleditor) ------------

        // D62/D41: das gewählte Verb schlägt die passende Seminarphase vor –
        // als Vorbelegung im Modal, ohne bereits Gewähltes zu entfernen.
        suggestUnitPhase(phaseKey) {
            const label = PHASE_LABELS[phaseKey];
            if (!label) {
                return;
            }
            const current = (readMultiDropdownValues('#sq-e-seminarphase') || []).map(String);
            if (!current.includes(label)) {
                setMultiDropdownValues('#sq-e-seminarphase', current.concat([label]));
            }
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
                <h4>Didaktische Empfehlungen</h4>
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

        // Stichwörter allein aus Unterthemen + Themenplan-Referenz - Treffer
        // hierauf zählen im Score zusätzlich (Kontext stärker gewichten).
        topicKeywords(baustein) {
            if (!baustein) {
                return [];
            }
            return [...new Set([
                ...tokenize(baustein.unterthemen),
                ...tokenize(baustein.themenplanreferenz),
            ])];
        }

        // IDs aller im ganzen Plan aktuell platzierten (aktiven) Einheiten-
        // Karten - für „schon verwendet"-Kennzeichnung und -Abwertung.
        placedCardRefs() {
            const refs = new Set();
            const placements = (this.sequenz && this.sequenz.platzierungen) || {};
            Object.keys(placements).forEach((pid) => {
                const p = placements[pid];
                if (!p || p.typ !== 'einheit') {
                    return;
                }
                const auswahl = this.auswahl(p);
                if (auswahl && auswahl.aktiv !== null && auswahl.aktiv !== undefined && auswahl.aktiv !== '') {
                    refs.add(String(auswahl.aktiv));
                }
            });
            return refs;
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
        suggestFor(gapminutes, keywords, topicwords, bloomphases, excluderefs) {
            const placedRefs = this.placedCardRefs();
            const scored = [];
            this.suggestionPool().forEach((card) => {
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
                const topichits = (topicwords || []).filter((word) => haystack.includes(word));
                const cardphase = phaseKey(this.fieldValue(card, 'seminarphase'));
                const phasematch = cardphase && bloomphases.includes(cardphase);
                const used = placedRefs.has(String(card.id));
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
                if (card._isglobal) {
                    reasons.push('aus globaler Sammlung');
                }
                if (used) {
                    reasons.push('bereits im Plan');
                }
                scored.push({
                    card,
                    duration,
                    used,
                    // Themen-Treffer (Unterthemen/Themenplan) zählen zusätzlich zu
                    // den allgemeinen Stichwort-Treffern - Kontext stärker gewichtet.
                    score: hits.length * 2 + topichits.length * 3 + (phasematch ? 3 : 0),
                    reason: reasons.join(' · '),
                });
            });
            scored.sort((a, b) => {
                // Schon verwendete Einheiten nach unten (bleiben wählbar, nur abgewertet).
                if (a.used !== b.used) {
                    return a.used ? 1 : -1;
                }
                if (a.score !== b.score) {
                    return b.score - a.score;
                }
                if (a.duration !== b.duration) {
                    return b.duration - a.duration;
                }
                return cardTitle(a.card).localeCompare(cardTitle(b.card));
            });
            return scored.slice(0, 6);
        }

        // Übernehmen-Button für einen Vorschlag/Treffer. Globale Methoden tragen
        // data-global-methodid: Übernehmen legt erst eine lokale Kopie an (D33).
        suggestButton(card, targetattrs) {
            const globalattr = card._isglobal
                ? `data-global-methodid="${escapeHtml(String(card._globalid))}"`
                : '';
            return `<button type="button" class="kg-btn kg-btn-primary" data-sq-action="suggest-add"
                data-cardid="${escapeHtml(String(card.id))}" ${globalattr} ${targetattrs}>Übernehmen</button>`;
        }

        // Kartenrefs der Baustein-eigenen geplanten Einheiten – die stehen schon
        // als „geplant, noch nicht platziert" oben und sollen in den generischen
        // Vorschlägen nicht doppelt erscheinen.
        plannedRefsForBaustein(baustein) {
            const planningunit = this.planningUnitForBaustein(baustein);
            if (!planningunit || !Array.isArray(planningunit.methods)) {
                return [];
            }
            return planningunit.methods
                .map((m) => String((m && m.methodid) || ''))
                .filter((ref) => ref && this.methodCardForRef(ref));
        }

        renderSuggestions(gapminutes, baustein, targetattrs) {
            const keywords = this.contextKeywords(baustein);
            const topicwords = this.topicKeywords(baustein);
            const bloomphases = baustein ? this.bloomPhasesFor(baustein.themenplanreferenz) : [];
            const suggestions = this.suggestFor(gapminutes, keywords, topicwords, bloomphases, this.plannedRefsForBaustein(baustein));

            const cards = suggestions.map((entry) => {
                const pkey = phaseKey(entry.card.seminarphase);
                return `
                <div class="sq-suggest__card${pkey ? ' sq-suggest__card--' + pkey : ''}${entry.used ? ' sq-suggest__card--used' : ''}">
                  <div class="sq-unit__title">${escapeHtml(cardTitle(entry.card))}</div>
                  <div class="sq-suggest__why">${escapeHtml(entry.reason)}</div>
                  ${this.suggestButton(entry.card, targetattrs)}
                </div>`;
            }).join('');

            const empty = suggestions.length ? '' : `
                <div class="sq-suggest__empty">Für diese Lücke passt automatisch gerade nichts –
                  such gezielt in der Bibliothek oder leg direkt eine neue Einheit an.</div>`;

            // Collapsed by default but visibly inviting; open state is
            // remembered per day and target across re-renders.
            const key = `${this.dayIndex}|${targetattrs}`;
            const open = !!this.openSuggest[key];
            const counter = suggestions.length ? ` (${suggestions.length})` : '';
            // D59: Suchen-und-Ablegen direkt an der Lücke - manuelle Suche in der
            // kompletten Bibliothek (lokale Einheiten + globale Sammlungen).
            return `
                <details class="sq-gap" data-suggest-key="${escapeHtml(key)}"${open ? ' open' : ''}>
                  <summary class="sq-gap__summary">
                    <span class="sq-tri" aria-hidden="true">▸</span>
                    <span class="sq-gap__label">💡 Vorschläge aus deiner Bibliothek${counter}</span>
                    <span class="sq-gap__free">– hier ist noch Platz für ca. ${gapminutes} Min.</span>
                  </summary>
                  <div class="sq-gap__body">
                    <div class="sq-suggest">${cards}</div>
                    ${empty}
                    <div class="sq-gap__search">
                      <input type="search" class="kg-input sq-gap-search"
                        placeholder="🔎 In der ganzen Bibliothek suchen …" ${targetattrs}>
                      <div class="sq-gap-results"></div>
                    </div>
                    <button type="button" class="kg-btn" data-sq-action="quick-create" ${targetattrs}>＋ Neue Einheit anlegen</button>
                  </div>
                </details>`;
        }

        // D59: Treffer der manuellen Bibliothekssuche an einer Lücke rendern.
        renderGapSearchResults(input) {
            const box = input.closest('.sq-gap__search');
            const results = box ? box.querySelector('.sq-gap-results') : null;
            if (!results) {
                return;
            }
            const needle = String(input.value || '').trim().toLowerCase();
            if (needle.length < 2) {
                results.innerHTML = '';
                return;
            }
            const targetattrs = (input.dataset.pid ? `data-pid="${escapeHtml(input.dataset.pid)}"` : '')
                + (input.dataset.anker ? ` data-anker="${escapeHtml(input.dataset.anker)}"` : '');
            const matches = this.suggestionPool().filter((card) => {
                const hay = (cardTitle(card) + ' ' + this.fieldValue(card, 'kurzbeschreibung') + ' '
                    + this.fieldValue(card, 'tags')).toLowerCase();
                return hay.includes(needle);
            }).slice(0, 8);
            if (!matches.length) {
                results.innerHTML = '<div class="sq-suggest__empty">Nichts gefunden.</div>';
                return;
            }
            results.innerHTML = matches.map((card) => {
                const duration = this.cardDuration(card);
                const phase = this.fieldValue(card, 'seminarphase');
                const meta = [duration ? duration + ' Min.' : '', phase, card._isglobal ? 'aus globaler Sammlung' : '']
                    .filter(Boolean).join(' · ');
                const pkey = phaseKey(card.seminarphase);
                return `
                <div class="sq-suggest__card${pkey ? ' sq-suggest__card--' + pkey : ''}">
                  <div class="sq-unit__title">${escapeHtml(cardTitle(card))}</div>
                  <div class="sq-suggest__why">${escapeHtml(meta)}</div>
                  ${this.suggestButton(card, targetattrs)}
                </div>`;
            }).join('');
        }

        // D56/D59: globale Methode übernehmen (lokale Kopie, D33) und platzieren.
        adoptAndPlace(globalid, target) {
            this.setStatus('Aus der globalen Sammlung wird übernommen …');
            asCall('mod_seminarplaner_adopt_global_method', {cmid: this.cmid, methodid: globalid}).then((res) => {
                if (!res || !res.localid) {
                    throw new Error('no localid');
                }
                const newid = String(res.localid);
                return asCall('mod_seminarplaner_get_method_cards', {cmid: this.cmid}).then((cardres) => {
                    let decoded = [];
                    try {
                        decoded = cardres.methodsjson ? JSON.parse(cardres.methodsjson) : [];
                    } catch (e) {
                        decoded = [];
                    }
                    this.methodCardList = Array.isArray(decoded) ? decoded : [];
                    this.methodCards = {};
                    this.methodCardList.forEach((card) => {
                        if (card && card.id !== undefined) {
                            this.methodCards[String(card.id)] = card;
                        }
                    });
                    this.applySuggestTarget(newid, target);
                    this.setStatus('Übernommen und eingeplant.');
                });
            }).catch(() => {
                this.setStatus('Übernehmen aus der globalen Sammlung ist fehlgeschlagen.', true);
            });
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
                gruppengroesse: '',
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
            // Jede Auswahl im ⋮-Menü schließt es (die Aktionen rendern ohnehin neu).
            if (type !== 'menu-toggle' && this.openMenuPid) {
                this.openMenuPid = '';
            }
            if (type === 'menu-toggle') {
                this.openMenuPid = this.openMenuPid === pid ? '' : pid;
                this.render();
            } else if (type === 'move-up') {
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
            } else if (type === 'phase-toggle') {
                this.openPhasePid = this.openPhasePid === pid ? '' : pid;
                this.render();
            } else if (type === 'phase-choose') {
                this.choosePhase(pid, action.getAttribute('data-phase') || '');
            } else if (type === 'variant') {
                this.chooseVariant(action.getAttribute('data-bid') || '', action.getAttribute('data-vid') || '');
            } else if (type === 'bswap-toggle') {
                const bid = action.getAttribute('data-bid') || '';
                this.openBausteinSwapBid = this.openBausteinSwapBid === bid ? '' : bid;
                this.render();
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
            } else if (type === 'add-baustein') {
                this.createEmptyBaustein(action.getAttribute('data-anker') || 'vormittag');
            } else if (type === 'baustein-add-unit') {
                const target = action.getAttribute('data-pid') || '';
                const loc = this.locate(target);
                const anker = loc ? loc.anchors[loc.anchorIdx].ankername : 'vormittag';
                this.openPicker(anker, target);
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
                const suggesttarget = {
                    pid: action.getAttribute('data-pid') || '',
                    anker: action.getAttribute('data-anker') || '',
                };
                const globalid = Number.parseInt(action.getAttribute('data-global-methodid') || '0', 10);
                if (globalid > 0) {
                    this.adoptAndPlace(globalid, suggesttarget);
                } else {
                    this.applySuggestTarget(action.getAttribute('data-cardid') || '', suggesttarget);
                }
            } else if (type === 'quick-create') {
                this.openQuickCreate({
                    pid: action.getAttribute('data-pid') || '',
                    anker: action.getAttribute('data-anker') || '',
                });
            }
        }

        // ---- Rendering ----------------------------------------------------

        // Handoff-SEQUENZ 1: Klapp-Zustand des Kopfes plus die Kurzinfo, die im
        // zugeklappten Zustand die einzige Auskunft darueber ist, welcher Plan
        // gerade bearbeitet wird — deshalb steht sie in der Kopfzeile und nicht
        // nur im Panel darunter.
        renderHead() {
            const head = bySel('#sq-head');
            const toggle = bySel('#sq-head-toggle');
            const info = bySel('#sq-head-info');
            if (head) {
                head.setAttribute('data-open', this.headOpen ? '1' : '0');
            }
            if (toggle) {
                toggle.setAttribute('aria-expanded', this.headOpen ? 'true' : 'false');
            }
            if (info) {
                const select = bySel('#sq-grid-select');
                const title = select && select.selectedOptions.length
                    ? String(select.selectedOptions[0].textContent || '').trim()
                    : '';
                info.textContent = title ? `· ${title}` : '';
            }
        }

        // Werkzeugleisten-Fußzeile: welche Vorlage der geladene Plan nutzt,
        // plus D45-Hinweise zu An-/Abreisetag.
        renderPlanInfo() {
            const el = bySel('#sq-plan-info');
            if (!el) {
                return;
            }
            if (!this.state || !this.state.config || !this.dayCount()) {
                el.textContent = '';
                return;
            }
            const config = this.state.config;
            const az = deriveAnkerzeiten(config);
            const presetlabel = PRESET_LABELS[config.preset] || PRESET_LABELS.custom;
            const parts = [`Vorlage: ${presetlabel}`];
            if (az.ersterTagNurNachmittag) {
                parts.push('erster Seminartag beginnt am Nachmittag');
            }
            if (az.letzterTagNurVormittag) {
                parts.push('letzter Seminartag endet nach dem Vormittag');
            }
            el.textContent = parts.join(' · ');
        }

        render() {
            const container = bySel('#sq-day');
            const label = bySel('#sq-day-label');
            if (!container) {
                return;
            }
            this.renderHead();
            this.renderPlanInfo();
            this.renderGoals();
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

            // Aufeinanderfolgende Teile derselben zerteilten Einheit vor dem
            // Rendern wieder zusammenführen (heilt auch bestehende Pläne).
            if (this.mergeAdjacentSplitParts()) {
                this.setDirty(true);
            }

            const day = this.sequenz.tage[this.dayIndex];
            if (label) {
                label.textContent = `Tag ${Number(day.tag) || this.dayIndex + 1} · ${day.bezeichnung || ''}`;
            }

            const seenBausteine = this.bausteineSeenBeforeCurrentDay();
            const frame = this.dayFrame(this.dayIndex);
            const morning = this.renderAnchor(day, 'vormittag', frame, seenBausteine);
            const middaytimes = frame.midday.end > frame.midday.start
                ? ` · ${minutesToLabel(frame.midday.start)}–${minutesToLabel(frame.midday.end)}`
                : '';
            const breakminutes = Math.max(0, frame.midday.end - frame.midday.start);
            const divider = `
                <div class="sq-break-divider">
                  ${CLOCK_ICON}
                  <span>Mittagspause</span>
                  ${middaytimes ? `<span class="sq-break-divider__time">${minutesToLabel(frame.midday.start)}–${minutesToLabel(frame.midday.end)} · ${breakminutes} Min.</span>` : ''}
                  <span class="sq-break-divider__next">Nachmittag ↓</span>
                </div>`;
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
                       Die letzte Einheit wird ${movetarget} verschoben – oder geteilt und als Fortsetzung weitergeführt, wenn beide Teile sinnvoll bleiben.</span>
                     ${hasNext ? `<button type="button" class="kg-btn kg-btn-primary" data-sq-action="overflow" data-anker="${ankername}">
                       ${isMorning ? 'Auf den Nachmittag verschieben' : 'Auf den nächsten Tag verschieben'}</button>` : ''}
                   </div>`
                : '';

            // D14: a free gap in the anchor offers explained suggestions.
            const freegap = budget - used;
            const gapbox = (over <= 0 && freegap >= 15 && placements.length && this.methodCardList.length)
                ? this.renderSuggestions(freegap, null, `data-anker="${ankername}"`)
                : '';

            // In an off anchor (arrival/departure day) all editing controls
            // are disabled so nobody plans into a section that does not
            // take place; existing placements keep their controls so they
            // can still be moved out.
            const offattrs = anchoroff
                ? ' disabled title="Dieser Abschnitt entfällt an diesem Tag."'
                : '';
            const addbutton = `
                <div class="sq-anchor__add">
                  <button type="button" class="kg-btn" data-sq-action="add-baustein" data-anker="${ankername}"${offattrs}>＋ Baustein</button>
                  <button type="button" class="kg-btn" data-sq-action="add-unit" data-anker="${ankername}"${offattrs}>＋ Einheit hinzufügen</button>
                  <button type="button" class="kg-btn" data-sq-action="add-pause" data-anker="${ankername}"${offattrs}>＋ Pause</button>
                </div>`;

            return `
                <div class="sq-anchor${anchoroff ? ' sq-anchor--off' : ''}" data-anker="${ankername}"${anchoroff ? ' data-off="1"' : ''}>
                  <div class="sq-anchor__head">
                    <div class="sq-anchor__title">${title} <span class="sq-anchor__time">${timespan}</span></div>
                    <div class="sq-budget">
                      <div class="sq-budget__bar"><div class="sq-budget__fill${over > 0 ? ' sq-budget__fill--over' : ''}" style="width:${fillpct}%"></div></div>
                      <div class="sq-budget__label${over > 0 ? ' sq-budget__label--over' : ''}">${escapeHtml(budgetlabel)}</div>
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

                // Der Baustein traegt seine Gesamtdauer in der Zeit-Spalte —
                // anders als bei der Einheit als Text, denn sie ist die Summe
                // der enthaltenen Einheiten und nur ueber diese aenderbar. Ein
                // leerer Baustein zeigt stattdessen seine Reservierung.
                return `
                    <div class="sq-row sq-row--baustein" draggable="true"
                      data-sq-drag="${escapeHtml(group.items[0].pid)}" data-sq-group="${escapeHtml(group.bausteinid)}">
                      ${this.renderTimeColumn(start, duration)}
                      <div class="sq-baustein${unfilled ? ' sq-baustein--empty' : ''}">
                        <div class="sq-baustein__head">
                          <div class="sq-baustein__title">${this.renderGrip()}${escapeHtml(this.bausteinTitle(group.bausteinid, baustein))}
                            ${continuation ? '<span class="sq-badge sq-badge--variant">Fortsetzung</span>' : ''}
                            ${(unfilled && duration > 0) ? '<span class="sq-badge">reserviert</span>' : ''}
                          </div>
                          <div class="sq-baustein__tools">
                            ${this.renderBausteinSwap(group.bausteinid, baustein)}
                            <button type="button" class="kg-btn sq-membership" data-sq-action="edit-baustein"
                              data-bid="${escapeHtml(group.bausteinid)}">Bearbeiten</button>
                            ${unfilled ? this.renderRowMenu(group.items[0], false) : ''}
                          </div>
                        </div>
                        ${this.renderBausteinContent(group, units, unfilled, baustein)}
                      </div>
                    </div>`;
            }).join('');
        }

        // D14/D6: die Einheiten, die laut Themenplan zu diesem Baustein gehören,
        // aber noch nicht platziert sind – jeweils direkt platzierbar (Nutzer-
        // Wunsch: nicht erst in der Bibliothek suchen). Bleibt sichtbar, solange
        // eine Reservierung offen ist, und schrumpft mit jedem Platzieren.
        renderPlannedRows(baustein, group, placeholderpid) {
            // Ohne offene Reservierung gibt es kein Ziel zum Platzieren – dann
            // die Liste nicht button-los stehenlassen.
            if (!placeholderpid) {
                return '';
            }
            const planningunit = this.planningUnitForBaustein(baustein);
            const methods = (planningunit && Array.isArray(planningunit.methods) ? planningunit.methods : [])
                .map((m) => this.methodCardForRef(m && m.methodid))
                .filter((card) => card);
            if (!methods.length) {
                return '';
            }
            // Schon in diesem Baustein platzierte Karten herausfiltern.
            const placed = {};
            group.items.forEach((item) => {
                if (this.isUnfilled(item.data)) {
                    return;
                }
                const auswahl = this.auswahl(item.data);
                if (auswahl && auswahl.aktiv) {
                    placed[String(auswahl.aktiv)] = true;
                }
            });
            const open = methods.filter((card) => !placed[String(card.id)]);
            if (!open.length) {
                return '';
            }
            return open.map((card) => {
                const duration = Number.parseInt(String(card.zeitbedarf || '').replace(/\D+/g, ''), 10);
                const pkey = phaseKey(card.seminarphase);
                const placebtn = placeholderpid
                    ? `<button type="button" class="kg-btn kg-btn-primary sq-unit__place" data-sq-action="suggest-add" data-cardid="${escapeHtml(String(card.id))}" data-pid="${escapeHtml(placeholderpid)}">＋ Platzieren</button>`
                    : '';
                // Noch nicht platziert, also gibt es keine Startzeit: die
                // Zeit-Spalte bleibt leer und haelt nur die gemeinsame Kante.
                return `
                    <div class="sq-row">
                      <div class="sq-time" aria-hidden="true"></div>
                      <div class="sq-unit sq-unit--planned">
                        <div class="sq-unit__phase${pkey ? ' sq-phase-bg--' + pkey : ''}"></div>
                        <div class="sq-unit__main">
                          <div class="sq-unit__title">${escapeHtml(cardTitle(card))}</div>
                          <div class="sq-unit__meta">
                            ${Number.isFinite(duration) && duration > 0 ? `<span class="sq-badge">${duration} Min.</span>` : ''}
                            ${card.seminarphase ? `<span class="sq-badge${pkey ? ' sq-badge--phase-' + pkey : ''}">${escapeHtml(String(card.seminarphase))}</span>` : ''}
                            <span class="sq-badge sq-badge--planned">geplant, noch nicht platziert</span>
                          </div>
                        </div>
                        <div class="sq-unit__actions">${placebtn}</div>
                      </div>
                    </div>`;
            }).join('');
        }

        renderBausteinContent(group, units, unfilled, baustein) {
            const residual = group.items.filter((p) => this.isUnfilled(p.data));
            const restminutes = residual.reduce((sum, p) => sum + Math.max(0, Number(p.data.dauer) || 0), 0);
            const placeholderpid = residual.length ? residual[0].pid : '';
            const plannedrows = this.renderPlannedRows(baustein, group, placeholderpid);

            if (!unfilled) {
                // Partly filled module: the planned list continues to show the
                // still-unplaced units, and suggestions fill the residual
                // reservation until it is used up.
                const restsuggestions = (residual.length && restminutes >= 10 && this.methodCardList.length)
                    ? this.renderSuggestions(restminutes, baustein, `data-pid="${escapeHtml(residual[0].pid)}"`)
                    : '';
                return `<div class="sq-baustein__units">${units}${plannedrows}${restsuggestions}</div>`;
            }
            // D14: the reserved duration is the classic suggestion gap - with
            // keywords and Bloom mapping from the module master data.
            const gapminutes = group.items.reduce((sum, p) => sum + Math.max(0, Number(p.data.dauer) || 0), 0);
            // Frisch angelegter leerer Baustein (keine reservierte Zeit, kein
            // Pool/Themen): direkte Einladung, die erste Einheit hinzuzufügen.
            if (gapminutes <= 0) {
                const target = placeholderpid || group.items[0].pid;
                return `
                    <div class="sq-baustein__units">
                      <div class="sq-baustein__empty">
                        <span class="sq-baustein__emptyhint">Noch keine Einheit in diesem Baustein.</span>
                        <button type="button" class="kg-btn kg-btn-primary" data-sq-action="baustein-add-unit" data-pid="${escapeHtml(target)}">＋ Einheit hinzufügen</button>
                      </div>
                    </div>`;
            }
            const suggestions = (gapminutes >= 10 && this.methodCardList.length)
                ? this.renderSuggestions(gapminutes, baustein, `data-pid="${escapeHtml(placeholderpid || group.items[0].pid)}"`)
                : '';
            // Reserved module: master data now lives on the module itself;
            // the planning state only remains as fallback for the topic list.
            const planningunit = this.planningUnitForBaustein(baustein);
            const owntopics = htmlToLines(baustein && baustein.unterthemen);
            const topics = owntopics || (planningunit ? htmlToLines(planningunit.topics) : '');
            if (!topics && !plannedrows) {
                return suggestions ? `<div class="sq-baustein__units">${suggestions}</div>` : '';
            }
            return `
                <div class="sq-baustein__units">
                  ${topics ? `<div class="sq-baustein__topics">${escapeHtml(topics)}</div>` : ''}
                  ${plannedrows}
                  ${suggestions}
                </div>`;
        }

        // ⇄-Alternative-Chip am Baustein – gleiche Darstellung wie bei den
        // Seminareinheiten (renderSwap). Erscheint nur, wenn Alternativen
        // vorhanden sind (≥ 2 Varianten); das Popover listet die Titel.
        renderBausteinSwap(bid, baustein) {
            const varianten = baustein && baustein.varianten ? baustein.varianten : {};
            const keys = Object.keys(varianten);
            if (keys.length < 2) {
                return '';
            }
            const open = this.openBausteinSwapBid === bid;
            const options = keys.map((vid) => {
                const active = baustein.aktivevariante === vid;
                return `<div class="sq-swap__option${active ? ' active' : ''}"
                    data-sq-action="variant" data-bid="${escapeHtml(bid)}" data-vid="${escapeHtml(vid)}">
                    <span class="sq-swap__dot"></span>${escapeHtml(varianten[vid].titel || vid)}</div>`;
            }).join('');
            return `
                <span class="sq-swap sq-swap--baustein">
                  <button type="button" class="sq-swap__chip" data-sq-action="bswap-toggle" data-bid="${escapeHtml(bid)}">⇄ Alternative</button>
                  <div class="sq-swap__panel${open ? ' open' : ''}">${options}</div>
                </span>`;
        }

        // D47: six-dot grip as drag affordance (visual handle from the
        // design handoff; the whole row is draggable).
        renderGrip() {
            return `<span class="sq-grip" title="Ziehen, um zu verschieben" aria-hidden="true">
                <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor"><circle cx="2.5" cy="3" r="1.4"/><circle cx="7.5" cy="3" r="1.4"/><circle cx="2.5" cy="8" r="1.4"/><circle cx="7.5" cy="8" r="1.4"/><circle cx="2.5" cy="13" r="1.4"/><circle cx="7.5" cy="13" r="1.4"/></svg></span>`;
        }

        // Handoff: sichtbar bleiben nur „⇄ Alternative" und „Bearbeiten". Alle
        // Nebenaktionen (Reihenfolge, Zugehörigkeit, Entfernen) stecken im ⋮-Menü
        // am Zeilenende — Drag & Drop (D47) bleibt der schnelle Weg, das Menü der
        // erklärte.
        renderRowMenu(p, inBaustein) {
            const pid = p.pid;
            const isunit = p.data.typ === 'einheit';
            const open = this.openMenuPid === pid;
            const item = (action, glyph, label) => `
                <button type="button" role="menuitem" class="sq-menu__item${action === 'remove' ? ' sq-menu__item--danger' : ''}"
                  data-sq-action="${action}" data-pid="${escapeHtml(pid)}">${MENU_ICONS[glyph]}<span>${label}</span></button>`;

            const items = [];
            items.push(item('move-up', 'up', 'Nach vorne schieben'));
            items.push(item('move-down', 'down', 'Nach hinten schieben'));

            if (isunit && inBaustein) {
                items.push(item('leave-baustein', 'unlink', 'Aus der Überschrift lösen'));
            } else if (isunit) {
                const bid = this.adjacentBausteinId(pid);
                if (bid) {
                    const titel = (this.baustein(bid) || {}).titel || 'Baustein';
                    items.push(item('join-baustein', 'link', `In „${escapeHtml(titel)}" aufnehmen`));
                }
                if (!p.data.bausteinid) {
                    items.push(item('heading-open', 'heading', 'Überschrift geben'));
                }
            }

            items.push(item('remove', 'remove', 'Aus dem Plan entfernen'));

            return `
                <span class="sq-menu">
                  <button type="button" class="sq-menu__btn" data-sq-action="menu-toggle" data-pid="${escapeHtml(pid)}"
                    aria-haspopup="true" aria-expanded="${open ? 'true' : 'false'}"
                    title="Weitere Aktionen" aria-label="Weitere Aktionen">⋮</button>
                  <div class="sq-menu__panel${open ? ' open' : ''}" role="menu">${items.join('')}</div>
                </span>`;
        }

        renderSwap(p) {
            // A split part must not swap its candidate: the two pieces share
            // one unit identity but keep manual durations, so a swap would
            // desync them (same reasoning as a Baustein continuation).
            if (p.data && p.data.splitgroup) {
                return '';
            }
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

        // Handoff-SEQUENZ: Seminarphase direkt an der Zeile setzen, statt dafuer
        // den Editor zu oeffnen. Geschrieben wird in die Bibliotheks-Karte —
        // die Phase beschreibt die Methode selbst, nicht ihre Platzierung, also
        // gilt die Korrektur ueberall. Weil das ueber diesen Plan hinausreicht,
        // sagt das Menue es im Moment der Auswahl (sq-phase__note) an.
        renderPhaseSelect(p) {
            const card = this.activeCardForPlacement(p.data);
            const current = this.placementRawPhase(p.data);
            const activekey = phaseKey(current);
            // Ohne Karte gibt es nichts zu schreiben (reine Legacy-Zeile): dann
            // bleibt die Phase eine Anzeige wie bisher.
            if (!card) {
                return current
                    ? `<span class="sq-badge${activekey ? ' sq-badge--phase-' + activekey : ''}">${escapeHtml(current)}</span>`
                    : '';
            }
            const open = this.openPhasePid === p.pid;
            const label = current || 'Phase wählen';
            const options = PHASE_KEYS.map((ph) => `
                <div class="sq-phase__option${ph.key === activekey ? ' active' : ''}" role="menuitem"
                  data-sq-action="phase-choose" data-pid="${escapeHtml(p.pid)}" data-phase="${escapeHtml(ph.label)}">
                  <span class="sq-phase__dot sq-phase-bg--${ph.key}"></span>${escapeHtml(ph.label)}
                </div>`).join('');
            return `
                <span class="sq-phase">
                  <button type="button" class="sq-phase__btn" data-sq-action="phase-toggle" data-pid="${escapeHtml(p.pid)}"
                    aria-haspopup="true" aria-expanded="${open ? 'true' : 'false'}"
                    title="Seminarphase dieser Einheit ändern">
                    <span class="sq-phase__dot ${activekey ? 'sq-phase-bg--' + activekey : 'sq-phase__dot--none'}"></span>
                    <span class="sq-phase__label">${escapeHtml(label)}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      stroke-width="2.4" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
                  </button>
                  <div class="sq-phase__panel${open ? ' open' : ''}" role="menu">
                    <div class="sq-phase__head">Didaktische Phase</div>
                    ${options}
                    <div class="sq-phase__note">Gilt für diese Einheit in allen Seminarplänen.</div>
                  </div>
                </span>`;
        }

        // Nur noch das Eingabefeld: „Überschrift geben" ruft man jetzt im ⋮-Menü
        // der Zeile auf, damit unter jeder Einheit kein Dauer-Link mehr steht.
        renderHeadingAffordance(p) {
            if (p.data.typ !== 'einheit' || p.data.bausteinid || this.headingPid !== p.pid) {
                return '';
            }
            return `
                <div class="sq-heading-inline">
                  <input type="text" id="sq-heading-input" class="kg-input" placeholder="z. B. Ankommen und Einstieg">
                  <button type="button" class="kg-btn kg-btn-primary" data-sq-action="heading-save" data-pid="${escapeHtml(p.pid)}">Baustein anlegen</button>
                  <button type="button" class="kg-btn" data-sq-action="heading-cancel">Abbrechen</button>
                </div>`;
        }

        // Handoff-SEQUENZ 3: die Zeit-Spalte vor jeder Zeile.
        // Mit `pid` wird die Dauer direkt editierbar; ohne bleibt sie Text.
        // Der Baustein bekommt bewusst kein Feld: seine Dauer ist die Summe
        // der enthaltenen Einheiten und nur ueber diese zu aendern.
        renderTimeColumn(startMin, duration, pid) {
            const dur = pid
                ? `<input type="number" class="sq-time__input" value="${duration}" min="0" max="${MAX_UNIT_MINUTES}"
                     step="5" data-sq-duration="${escapeHtml(pid)}"
                     aria-label="Dauer in Minuten" title="Dauer in Minuten – aendert alle Folgezeiten">`
                : `<div class="sq-time__dur">${duration}</div>`;
            return `
                <div class="sq-time">
                  <div class="sq-time__start">${minutesToLabel(startMin)}</div>
                  <div class="sq-time__durwrap">${dur}</div>
                  <div class="sq-time__unit">Min.</div>
                </div>`;
        }

        renderPlacement(p, startMin, inBaustein) {
            const data = p.data;
            const duration = Math.max(0, Number(data.dauer) || 0);
            const timelabel = `${minutesToLabel(startMin)}–${minutesToLabel(startMin + duration)}`;

            if (data.typ === 'pause') {
                return `
                    <div class="sq-row" draggable="true" data-sq-drag="${escapeHtml(p.pid)}">
                      ${this.renderTimeColumn(startMin, duration, p.pid)}
                      <div class="sq-pause" title="${escapeHtml(timelabel)}">
                        ${this.renderGrip()}
                        <span class="sq-pause__label">${escapeHtml(data.titel || 'Pause')}</span>
                        <span class="sq-pause__spacer"></span>
                        <button type="button" class="kg-btn sq-membership" data-sq-action="edit" data-pid="${escapeHtml(p.pid)}">Bearbeiten</button>
                        ${this.renderRowMenu(p, false)}
                      </div>
                    </div>`;
            }

            if (this.isUnfilled(data) && data.bausteinid) {
                if (!inBaustein) {
                    return '';
                }
                // Residual reservation inside a partly filled module.
                return `
                    <div class="sq-row">
                      ${this.renderTimeColumn(startMin, duration, p.pid)}
                      <div class="sq-unit sq-unit--planned" title="${escapeHtml(timelabel)}">
                        <div class="sq-unit__phase"></div>
                        <div class="sq-unit__main">
                          <div class="sq-unit__title">Noch offen</div>
                          <div class="sq-unit__meta">
                            <span class="sq-badge">reserviert</span>
                          </div>
                        </div>
                        <div class="sq-unit__actions">${this.renderRowMenu(p, true)}</div>
                      </div>
                    </div>`;
            }

            const phase = this.placementPhase(data);
            const groupsize = this.placementGroupSize(data);

            // Dauer und Startzeit stehen jetzt in der Zeit-Spalte links, nicht
            // mehr als Badges hinter dem Titel. Zurueck bleibt in der Meta-Zeile
            // nur, was die Einheit inhaltlich beschreibt.
            const meta = [
                (!inBaustein && data.fortsetzung) ? '<span class="sq-badge sq-badge--variant">Fortsetzung</span>' : '',
                groupsize ? `<span class="sq-badge">${escapeHtml(groupsize)}</span>` : '',
            ].filter((m) => m).join('');

            return `
                <div class="sq-row"${inBaustein ? '' : ` draggable="true" data-sq-drag="${escapeHtml(p.pid)}"`}>
                  ${this.renderTimeColumn(startMin, duration, p.pid)}
                  <div class="sq-unit${inBaustein ? '' : ' sq-unit--standalone'}" title="${escapeHtml(timelabel)}">
                    <div class="sq-unit__phase${phase ? ' sq-phase-bg--' + phase : ''}"></div>
                    ${inBaustein ? '' : this.renderGrip()}
                    <div class="sq-unit__main">
                      <div class="sq-unit__title">${escapeHtml(data.titel || 'Seminareinheit')}</div>
                      ${meta ? `<div class="sq-unit__meta">${meta}</div>` : ''}
                    </div>
                    <div class="sq-unit__actions">
                      ${this.renderSwap(p)}
                      ${this.renderPhaseSelect(p)}
                      <button type="button" class="kg-btn" data-sq-action="edit" data-pid="${escapeHtml(p.pid)}">Bearbeiten</button>
                      ${this.renderRowMenu(p, inBaustein)}
                    </div>
                  </div>
                </div>`;
        }
    }

    return {
        init: function(cmid) {
            new SequenzView(Number(cmid)).init();
        },
    };
});
