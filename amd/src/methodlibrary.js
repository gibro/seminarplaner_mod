define(['core/ajax', 'core/notification', 'mod_seminarplaner/lernzieleditor'],
function(Ajax, Notification, LernzielEditor) {
    const bySel = (sel) => document.querySelector(sel);
    const asCall = (methodname, args) => Ajax.call([{methodname, args}])[0];
    const uid = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const escapeHtml = (str) => String(str || '').replace(/[&<>"']/g, (ch) => (
        {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch] || ch
    ));
    // Menü-Icon identisch zum Sequenz-Zeilenmenü (sq-menu__icon), damit das
    // Karten-Menü der Bibliothek exakt so aussieht wie in der Sequenz.
    const mlMenuIcon = (paths) => `<svg class="sq-menu__icon" width="15" height="15" viewBox="0 0 24 24" fill="none"`
        + ` stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"`
        + ` aria-hidden="true" focusable="false">${paths}</svg>`;
    const ML_MENU_ICONS = {
        edit: mlMenuIcon('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>'),
        replace: mlMenuIcon('<path d="M12 15V3"/><path d="M7 8l5-5 5 5"/><path d="M5 21h14"/>'),
        lock: mlMenuIcon('<rect x="5" y="11" width="14" height="9" rx="1"/><path d="M8 11V7a4 4 0 018 0v4"/>'),
        remove: mlMenuIcon('<path d="M6 6l12 12M18 6L6 18"/>'),
    };
    // Setzt den Änderungszeitstempel (ms) einer Seminareinheit auf "jetzt".
    const touchMethod = (method) => {
        if (method && typeof method === 'object') {
            method.timemodified = Date.now();
        }
        return method;
    };
    // Formatiert den letzten Änderungsstand einer Seminareinheit relativ (z. B. "Gestern", "Vor 3 Tagen").
    const formatRelativeModified = (ts) => {
        const ms = Number(ts);
        if (!ms || !isFinite(ms)) {
            return 'unbekannt';
        }
        const then = new Date(ms);
        const now = new Date();
        if (now.getTime() - then.getTime() < 60 * 1000) {
            return 'gerade eben';
        }
        const dayMs = 24 * 60 * 60 * 1000;
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfThen = new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime();
        const dayDiff = Math.round((startOfToday - startOfThen) / dayMs);
        if (dayDiff <= 0) {
            return 'Heute';
        }
        if (dayDiff === 1) {
            return 'Gestern';
        }
        if (dayDiff < 7) {
            return `Vor ${dayDiff} Tagen`;
        }
        return then.toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit', year: 'numeric'});
    };
    const sanitizeCardHtml = (value) => {
        const root = document.createElement('div');
        root.innerHTML = String(value || '');
        root.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach((node) => node.remove());
        root.querySelectorAll('*').forEach((el) => {
            Array.from(el.attributes).forEach((attr) => {
                const name = String(attr.name || '').toLowerCase();
                const val = String(attr.value || '');
                if (name.startsWith('on')) {
                    el.removeAttribute(attr.name);
                    return;
                }
                if ((name === 'href' || name === 'src') && /^\s*javascript:/i.test(val)) {
                    el.removeAttribute(attr.name);
                    return;
                }
                if (name === 'style') {
                    el.removeAttribute(attr.name);
                }
            });
        });
        return root.innerHTML;
    };

    const FIELDS = {
        titel: '#kg-f-titel',
        seminarphase: '#kg-f-seminarphase',
        zeitbedarf: '#kg-f-zeitbedarf',
        gruppengroesse: '#kg-f-gruppengroesse',
        kurzbeschreibung: '#kg-f-kurzbeschreibung',
        autor: '#kg-f-autor',
        lernziele: '#kg-f-lernziele',
        vorbereitung: '#kg-f-vorbereitung',
        raum: '#kg-f-raum',
        sozialform: '#kg-f-sozialform',
        risiken: '#kg-f-risiken',
        debrief: '#kg-f-debrief',
        materialien: '#id_kg_materialiendraftitemid',
        materialtechnik: '#kg-f-materialtechnik',
        ablauf: '#kg-f-ablauf',
        tags: '#kg-f-tags',
        alternativen: '#kg-f-alternativen'
    };

    const FILTER_DROPDOWNS = {
        tags: {
            root: '#ml-filter-tags-dropdown',
            toggle: '#ml-filter-tags-toggle',
            panel: '#ml-filter-tags-panel',
            all: '#ml-filter-tags-all',
            options: '#ml-filter-tags-options',
            labelAll: 'Alle Tags',
            labelSome: 'Tags'
        },
        phase: {
            root: '#ml-filter-phase-dropdown',
            toggle: '#ml-filter-phase-toggle',
            panel: '#ml-filter-phase-panel',
            all: '#ml-filter-phase-all',
            options: '#ml-filter-phase-options',
            labelAll: 'Alle Seminarphasen',
            labelSome: 'Seminarphasen'
        },
        group: {
            root: '#ml-filter-group-dropdown',
            toggle: '#ml-filter-group-toggle',
            panel: '#ml-filter-group-panel',
            all: '#ml-filter-group-all',
            options: '#ml-filter-group-options',
            labelAll: 'Alle Gruppengrößen',
            labelSome: 'Gruppengrößen'
        },
        duration: {
            root: '#ml-filter-duration-dropdown',
            toggle: '#ml-filter-duration-toggle',
            panel: '#ml-filter-duration-panel',
            all: '#ml-filter-duration-all',
            options: '#ml-filter-duration-options',
            labelAll: 'Alle Zeiten',
            labelSome: 'Zeiten'
        },
    };

    const EDIT_FIELD_SELECTORS = [
        '#ml-e-titel',
        '#ml-e-lernziele',
        '#ml-e-seminarphase',
        '#ml-e-tags',
        '#ml-e-zeitbedarf',
        '#ml-e-gruppengroesse',
        '#ml-e-kurzbeschreibung',
        '#ml-e-ablauf',
        '#ml-e-autor',
        '#ml-e-raum',
        '#ml-e-sozialform',
        '#ml-e-vorbereitung',
        '#ml-e-risiken',
        '#ml-e-debrief',
        '#ml-e-materialtechnik',
        '#ml-e-alternativen'
    ];

    let methods = [];
    let currentEditId = '';
    // D50: Anlegen läuft über denselben Editor wie Bearbeiten, nur leer.
    let creatingNew = false;
    let runtimeCmid = 0;
    // D54: Sets, für die eine aktualisierte globale Version verfügbar ist (kein
    // Auto-Update mehr - stattdessen ein Hinweis an der betroffenen Karte).
    let pendingUpdateSetIds = new Set();
    let draggedMethodId = '';
    let selectionMode = false;
    let selectedIds = new Set();

    const setStatus = (text, isError) => {
        const el = bySel('#ml-status');
        if (!el) {
            return;
        }
        el.textContent = text;
        el.style.color = isError ? '#b91c1c' : '#166534';
    };

    const normalize = (v) => String(v || '').trim().toLowerCase();

    const splitMulti = (value) => {
        if (Array.isArray(value)) {
            return value.map((v) => String(v).trim()).filter(Boolean);
        }
        return String(value || '')
            .split(/##|,|;|\r?\n/)
            .map((v) => String(v).trim())
            .filter(Boolean);
    };

    const normalizeMultiToken = (value) => {
        return normalize(String(value || '').split(/[:\-–]/)[0]);
    };
    // Bloomsche kognitive Dimensionen -> Stufe 1-6 (für die Farbcodierung der Karten).
    const COGNITIVE_LEVELS = {
        erinnern: 1,
        verstehen: 2,
        anwenden: 3,
        analysieren: 4,
        bewerten: 5,
        erschaffen: 6
    };
    // Höchste kognitive Stufe einer Seminareinheit (0, wenn keine zugeordnet).
    const cognitiveLevelOf = (method) => {
        const levels = splitMulti(method && method.kognitive)
            .map((entry) => COGNITIVE_LEVELS[normalizeMultiToken(entry)] || 0)
            .filter((level) => level > 0);
        return levels.length ? Math.max.apply(null, levels) : 0;
    };
    const normalizePhase = (phase) => {
        const clean = String(phase || '').trim();
        const aliases = {
            'warm-up': 'Orientierung',
            'einstieg': 'Orientierung',
            'erwartungsabfrage': 'Erfahrungserhebung',
            'vorwissen aktivieren': 'Erfahrungserhebung',
            'wissen vermitteln': 'Analyse',
            'reflexion': 'Handlungsteil',
            'evaluation/feedback': 'Transfer',
            'evaluation / feedback': 'Transfer',
            'abschluss': 'Transfer'
        };
        return aliases[clean.toLowerCase()] || clean;
    };
    const normalizePhases = (phases) => {
        const seen = {};
        return (Array.isArray(phases) ? phases : [])
            .map(normalizePhase)
            .filter((phase) => {
                if (!phase) {
                    return false;
                }
                const key = phase.toLowerCase();
                if (seen[key]) {
                    return false;
                }
                seen[key] = true;
                return true;
            });
    };

    const joinMulti = (arr) => (Array.isArray(arr) ? arr.join(', ') : '');

    // CD-Handoff: Karten tragen eine 3px-Top-Rule in der Farbe ihrer ersten
    // Seminarphase (Palette wie in der Sequenzansicht).
    const PHASE_CLASS_KEYS = [
        {key: 'orientierung', match: ['orientierung', 'warm-up', 'einstieg']},
        {key: 'erfahrung', match: ['erfahrung', 'erwartungsabfrage', 'vorwissen']},
        {key: 'analyse', match: ['analyse']},
        {key: 'handlung', match: ['handlung', 'aktion', 'praxis']},
        {key: 'transfer', match: ['transfer', 'abschluss', 'auswertung']},
    ];

    const phaseKeyOf = (phases) => {
        const raw = Array.isArray(phases) ? phases.filter(Boolean).join(', ') : String(phases || '');
        const clean = normalizePhase(raw.split(',')[0] || '').toLowerCase();
        if (!clean) {
            return '';
        }
        const found = PHASE_CLASS_KEYS.find((candidate) => candidate.match.some((m) => clean.includes(m)));
        return found ? found.key : '';
    };

    const phaseClassOf = (phases) => {
        const key = phaseKeyOf(phases);
        return key ? ` ml-phase--${key}` : '';
    };

    // Handoff: neutrale Badges für Dauer und Gruppengröße, das Phasen-Badge
    // getönt in seiner Phasenfarbe (keine Emojis).
    const renderCardBadges = (method) => {
        const phaselabel = Array.isArray(method.seminarphase)
            ? method.seminarphase.filter(Boolean).join(', ')
            : String(method.seminarphase || '').trim();
        const key = phaseKeyOf(method.seminarphase);
        const badges = [];
        if (method.zeitbedarf) {
            badges.push(`<span class="sp-badge">${escapeHtml(method.zeitbedarf)}</span>`);
        }
        if (method.gruppengroesse) {
            badges.push(`<span class="sp-badge">${escapeHtml(method.gruppengroesse)}</span>`);
        }
        if (phaselabel) {
            badges.push(`<span class="sp-badge sp-badge--phase${key ? ` sp-badge--phase-${key}` : ''}">`
                + `${escapeHtml(phaselabel)}</span>`);
        }
        return badges.join('');
    };

    const readMulti = (selector) => {
        const el = bySel(selector);
        if (!el) {
            return [];
        }
        if (el.tagName !== 'SELECT') {
            return String(el.value || '')
                .split('##')
                .map((v) => String(v).trim())
                .filter(Boolean);
        }
        return Array.from(el.selectedOptions).map((o) => o.value);
    };

    const getFormMultiDropdown = (selector) => document.querySelector(
        `[data-kg-form-multi-dropdown="1"][data-kg-field="${selector}"]`
    );

    const setFormMultiDropdownValues = (selector, values) => {
        const dropdown = getFormMultiDropdown(selector);
        const hidden = bySel(selector);
        let cleanvalues = Array.isArray(values)
            ? values.map((v) => String(v).trim()).filter(Boolean)
            : [];
        if (selector === FIELDS.seminarphase || selector === '#ml-e-seminarphase') {
            cleanvalues = normalizePhases(cleanvalues);
        }
        if (dropdown) {
            const options = Array.from(dropdown.querySelectorAll('[data-kg-form-multi-option="1"]'))
                .map((checkbox) => String(checkbox.value || '').trim())
                .filter(Boolean);
            if (options.length) {
                const optionSet = new Set(options);
                const normalizedMap = {};
                options.forEach((value) => {
                    const key = normalizeMultiToken(value);
                    if (key && !normalizedMap[key]) {
                        normalizedMap[key] = value;
                    }
                });
                const resolved = [];
                cleanvalues.forEach((value) => {
                    if (optionSet.has(value)) {
                        if (!resolved.includes(value)) {
                            resolved.push(value);
                        }
                        return;
                    }
                    const mapped = normalizedMap[normalizeMultiToken(value)];
                    if (mapped && !resolved.includes(mapped)) {
                        resolved.push(mapped);
                    }
                });
                cleanvalues = resolved;
            }
        }
        if (hidden) {
            hidden.value = cleanvalues.join('##');
        }
        if (!dropdown) {
            return;
        }
        const valueSet = {};
        cleanvalues.forEach((value) => {
            valueSet[value] = true;
        });
        dropdown.querySelectorAll('[data-kg-form-multi-option="1"]').forEach((checkbox) => {
            checkbox.checked = !!valueSet[String(checkbox.value || '')];
        });
        const toggle = dropdown.querySelector('[data-kg-form-multi-toggle="1"]');
        if (!toggle) {
            return;
        }
        const prefix = String(dropdown.getAttribute('data-kg-label-prefix') || 'Auswahl');
        const placeholder = String(dropdown.getAttribute('data-kg-placeholder') || `${prefix} wählen`);
        toggle.textContent = cleanvalues.length ? `${prefix} (${cleanvalues.length})` : placeholder;
    };

    // D62/D41: der Lernziel-Editor liefert eine Seminarphase (aus der
    // Bloom-Gruppe des Verbs). Sie wird im Editor-Formular vorbelegt, ohne
    // bereits Gewähltes zu entfernen.
    const LZ_PHASE_LABELS = {
        orientierung: 'Orientierung',
        erfahrung: 'Erfahrungserhebung',
        analyse: 'Analyse',
        handlung: 'Handlungsteil',
        transfer: 'Transfer',
    };
    const suggestEditorPhase = (phasekey) => {
        const label = LZ_PHASE_LABELS[phasekey];
        if (!label) {
            return;
        }
        const current = readMulti('#ml-e-seminarphase');
        if (current.indexOf(label) === -1) {
            setFormMultiDropdownValues('#ml-e-seminarphase', current.concat([label]));
        }
    };

    const bindFormMultiDropdowns = () => {
        document.querySelectorAll('[data-kg-form-multi-dropdown="1"]').forEach((dropdown) => {
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
                    panel.classList.toggle('kg-hidden');
                    if (opening) {
                        dropdown.classList.add('kg-form-multi-open');
                    } else {
                        dropdown.classList.remove('kg-form-multi-open');
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
                    setFormMultiDropdownValues(selector, selected);
                });
            });
            const searchinput = dropdown.querySelector('[data-kg-form-multi-search="1"]');
            if (searchinput) {
                searchinput.addEventListener('input', () => {
                    const term = String(searchinput.value || '').trim().toLowerCase();
                    dropdown.querySelectorAll('[data-kg-form-multi-option="1"]').forEach((checkbox) => {
                        const row = checkbox.closest('.kg-tag-option');
                        const label = row ? String(row.textContent || '').toLowerCase() : '';
                        if (!row) {
                            return;
                        }
                        row.style.display = !term || label.includes(term) ? '' : 'none';
                    });
                });
            }
            setFormMultiDropdownValues(selector, readMulti(selector));
        });
    };

    const refreshEditAlternativeOptions = (currentid = '') => {
        const host = bySel('#ml-e-alternativen-options');
        if (!host) {
            return;
        }
        const selected = readMulti('#ml-e-alternativen');
        host.innerHTML = '';
        methods.forEach((method) => {
            const methodid = String(method.id || '').trim();
            const title = String(method.titel || '').trim();
            if (!methodid || !title || methodid === String(currentid || '')) {
                return;
            }
            const row = document.createElement('label');
            row.className = 'kg-tag-option';
            row.innerHTML = `<input type="checkbox" value="${escapeHtml(methodid)}"
                data-kg-form-multi-option="1"><span>${escapeHtml(title)}</span>`;
            host.appendChild(row);
        });
        host.querySelectorAll('[data-kg-form-multi-option="1"]').forEach((checkbox) => {
            checkbox.checked = selected.includes(String(checkbox.value || '').trim());
            checkbox.addEventListener('change', () => {
                const values = Array.from(host.querySelectorAll('[data-kg-form-multi-option="1"]:checked'))
                    .map((cb) => String(cb.value || '').trim())
                    .filter(Boolean);
                setFormMultiDropdownValues('#ml-e-alternativen', values);
            });
        });
        setFormMultiDropdownValues('#ml-e-alternativen', selected);
    };

    const getFieldValue = (selector) => {
        const el = bySel(selector);
        if (!el) {
            return '';
        }
        const editor = (typeof window !== 'undefined' && window.tinyMCE && el.id) ? window.tinyMCE.get(el.id) : null;
        if (editor) {
            return String(editor.getContent() || '').trim();
        }
        const iframe = el.id ? document.getElementById(`${el.id}_ifr`) : null;
        if (iframe && iframe.contentDocument && iframe.contentDocument.body) {
            return String(iframe.contentDocument.body.innerHTML || '').trim();
        }
        return String(el.value || '').trim();
    };

    const setEditorIframeValue = (el, value) => {
        const iframe = el && el.id ? document.getElementById(`${el.id}_ifr`) : null;
        if (!iframe || !iframe.contentDocument || !iframe.contentDocument.body) {
            return false;
        }
        iframe.contentDocument.body.innerHTML = value;
        iframe.contentDocument.dispatchEvent(new Event('input', {bubbles: true}));
        iframe.contentDocument.body.dispatchEvent(new Event('input', {bubbles: true}));
        return true;
    };

    const setFieldValue = (selector, value) => {
        const el = bySel(selector);
        if (!el) {
            return;
        }
        const normalized = value === null || value === undefined ? '' : String(value);
        el.value = normalized;
        const editor = (typeof window !== 'undefined' && window.tinyMCE && el.id) ? window.tinyMCE.get(el.id) : null;
        if (!editor || typeof editor.setContent !== 'function') {
            setEditorIframeValue(el, normalized);
            return;
        }
        const applyEditorValue = () => {
            if (editor.destroyed) {
                return;
            }
            try {
                editor.setContent(normalized);
                setEditorIframeValue(el, normalized);
            } catch (error) {
                window.setTimeout(() => {
                    if (editor.destroyed) {
                        return;
                    }
                    try {
                        editor.setContent(normalized);
                        setEditorIframeValue(el, normalized);
                    } catch (retryerror) {
                        // Keep the textarea value; Tiny can pick it up on the next editor refresh.
                    }
                }, 100);
            }
        };
        if (editor.initialized === false && typeof editor.once === 'function') {
            editor.once('init', applyEditorValue);
            return;
        }
        applyEditorValue();
        window.setTimeout(() => setEditorIframeValue(el, normalized), 100);
    };

    const disableEditFieldAutocomplete = () => {
        EDIT_FIELD_SELECTORS.forEach((selector) => {
            const el = bySel(selector);
            if (el && typeof el.setAttribute === 'function') {
                el.setAttribute('autocomplete', 'off');
            }
        });
    };

    const attachmentName = (entry) => {
        if (!entry) {
            return '';
        }
        if (typeof entry === 'string') {
            return entry.trim();
        }
        if (typeof entry === 'object') {
            return String(entry.name || '').trim();
        }
        return '';
    };

    const attachmentNames = (value) => {
        if (!Array.isArray(value)) {
            return [];
        }
        return value.map((entry) => attachmentName(entry)).filter(Boolean);
    };

    const suppressLeavePrompt = () => {
        if (typeof window !== 'undefined') {
            window.onbeforeunload = null;
        }
        if (typeof M !== 'undefined'
            && M.core_formchangechecker
            && typeof M.core_formchangechecker.set_form_submitted === 'function') {
            M.core_formchangechecker.set_form_submitted();
        }
    };

    // Der Datei-Entwurfsbereich dieser Seite (ml_materialiendraftitemid) gehört
    // immer GENAU EINER Seminareinheit: Er wird beim Seitenaufbau serverseitig
    // vorbereitet - leer, oder mit den Dateien der über „Bearbeiten" geöffneten
    // Einheit - und beim Speichern übernommen. Die Dateien bleiben danach im
    // Bereich liegen. Wer ohne Neuaufbau der Seite die nächste Einheit anlegt,
    // hängt sie deshalb unbemerkt an die neue Einheit (genau so bekam eine frisch
    // angelegte Einheit die Datei ihrer Vorgängerin). Der Anlegen-Weg muss den
    // Bereich also frisch holen, sobald er benutzt wurde.
    let materialDraftUsed = false;

    // Dateien, die der Dateimanager gerade anzeigt. Die leeren Namensfelder der
    // JS-Vorlagen des Dateimanagers stehen ebenfalls im DOM - deshalb zählt nur,
    // was auch Text trägt.
    const materialFilesShown = () => Array
        .from(document.querySelectorAll('#ml-edit-form .filemanager .fp-filename'))
        .filter((el) => String(el.textContent || '').trim() !== '')
        .length;

    // Ist der Entwurfsbereich verbraucht (schon gespeichert) oder trägt er
    // Dateien, gehören sie nicht in eine neue Einheit.
    const materialDraftNeedsReset = () => materialDraftUsed || materialFilesShown() > 0;

    const readMaterialDraftItemId = () => {
        const candidates = [
            bySel('#id_ml_materialiendraftitemid'),
            bySel('input[name="ml_materialiendraftitemid"]'),
            bySel('input[type="hidden"][id^="id_ml_materialiendraftitemid"]')
        ].filter(Boolean);
        for (const el of candidates) {
            const value = Number(el.value || 0);
            if (Number.isFinite(value) && value > 0) {
                return value;
            }
        }
        return 0;
    };


    const clearAddForm = () => {
        Object.values(FIELDS).forEach((selector) => {
            const el = bySel(selector);
            if (!el) {
                return;
            }
            if (el.tagName === 'SELECT') {
                Array.from(el.options).forEach((opt) => {
                    opt.selected = false;
                });
                if (!el.multiple && el.options.length) {
                    el.selectedIndex = 0;
                }
                return;
            }
            if (getFormMultiDropdown(selector)) {
                setFormMultiDropdownValues(selector, []);
                return;
            }
            el.value = '';
        });
    };

    const normalizeMethodAlternatives = () => {
        const order = [];
        const byid = new Map();
        methods.forEach((method) => {
            const normalized = Object.assign({}, method);
            const id = String(normalized.id || '').trim();
            if (!id) {
                return;
            }
            normalized.id = id;
            const rawalts = normalized.alternativen;
            const values = Array.isArray(rawalts)
                ? rawalts
                : (typeof rawalts === 'string' ? rawalts.split(/##|[\r\n,;]+/u) : []);
            normalized.alternativen = values.map((value) => String(value || '').trim()).filter(Boolean);
            byid.set(id, normalized);
            order.push(id);
        });

        const links = new Map();
        order.forEach((id) => links.set(id, new Set()));
        order.forEach((id) => {
            const method = byid.get(id);
            method.alternativen.forEach((altid) => {
                if (!altid || altid === id || !byid.has(altid)) {
                    return;
                }
                links.get(id).add(altid);
                links.get(altid).add(id);
            });
        });

        methods = order.map((id) => {
            const method = byid.get(id);
            method.alternativen = order.filter((otherid) => otherid !== id && links.get(id).has(otherid));
            return method;
        });
    };

    const reconcileAlternativesForMethod = (methodid, selectedalternatives) => {
        const currentid = String(methodid || '').trim();
        if (!currentid) {
            return;
        }
        const selected = new Set(
            (Array.isArray(selectedalternatives) ? selectedalternatives : [])
                .map((id) => String(id || '').trim())
                .filter((id) => id && id !== currentid)
        );

        methods = methods.map((method) => {
            const id = String(method.id || '').trim();
            if (!id) {
                return method;
            }
            if (id === currentid) {
                return Object.assign({}, method, {alternativen: Array.from(selected)});
            }
            const existing = Array.isArray(method.alternativen)
                ? method.alternativen.map((altid) => String(altid || '').trim()).filter(Boolean)
                : [];
            const withoutcurrent = existing.filter((altid) => altid !== currentid);
            if (selected.has(id)) {
                withoutcurrent.push(currentid);
            }
            return Object.assign({}, method, {alternativen: Array.from(new Set(withoutcurrent))});
        });
    };

    const buildMethod = async () => {
        const title = (bySel(FIELDS.titel)?.value || '').trim();
        if (!title) {
            return null;
        }
        const draftitemid = Number(bySel(FIELDS.materialien)?.value || 0);

        return {
            id: uid(),
            titel: title,
            seminarphase: readMulti(FIELDS.seminarphase),
            zeitbedarf: (bySel(FIELDS.zeitbedarf)?.value || '').trim(),
            gruppengroesse: (bySel(FIELDS.gruppengroesse)?.value || '').trim(),
            kurzbeschreibung: (bySel(FIELDS.kurzbeschreibung)?.value || '').trim(),
            autor: (bySel(FIELDS.autor)?.value || '').trim(),
            lernziele: (bySel(FIELDS.lernziele)?.value || '').trim(),
            vorbereitung: (bySel(FIELDS.vorbereitung)?.value || '').trim(),
            raum: readMulti(FIELDS.raum),
            sozialform: readMulti(FIELDS.sozialform),
            risiken: (bySel(FIELDS.risiken)?.value || '').trim(),
            debrief: (bySel(FIELDS.debrief)?.value || '').trim(),
            materialien: [],
            materialiendraftitemid: draftitemid || 0,
            materialtechnik: (bySel(FIELDS.materialtechnik)?.value || '').trim(),
            ablauf: (bySel(FIELDS.ablauf)?.value || '').trim(),
            tags: (bySel(FIELDS.tags)?.value || '').trim(),
            alternativen: readMulti(FIELDS.alternativen)
        };
    };

    const getSelectedFilterValues = (key) => {
        const cfg = FILTER_DROPDOWNS[key];
        if (!cfg) {
            return [];
        }
        const all = bySel(cfg.all);
        const host = bySel(cfg.options);
        if (!host) {
            return [];
        }
        if (all && all.checked) {
            return [];
        }
        return Array.from(host.querySelectorAll('input[type="checkbox"]:checked'))
            .map((el) => String(el.value || '').trim().toLowerCase())
            .filter(Boolean);
    };

    const updateFilterToggleLabel = (key) => {
        const cfg = FILTER_DROPDOWNS[key];
        if (!cfg) {
            return;
        }
        const btn = bySel(cfg.toggle);
        if (!btn) {
            return;
        }
        const count = getSelectedFilterValues(key).length;
        btn.textContent = count ? `${cfg.labelSome} (${count})` : cfg.labelAll;
    };

    const clearFilterSelections = (key) => {
        const cfg = FILTER_DROPDOWNS[key];
        if (!cfg) {
            return;
        }
        const all = bySel(cfg.all);
        const options = bySel(cfg.options);
        if (all) {
            all.checked = true;
        }
        if (options) {
            options.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
                cb.checked = false;
            });
        }
        updateFilterToggleLabel(key);
    };

    const bindFilterDropdown = (key) => {
        const cfg = FILTER_DROPDOWNS[key];
        if (!cfg) {
            return;
        }
        const root = bySel(cfg.root);
        const toggle = bySel(cfg.toggle);
        const panel = bySel(cfg.panel);
        const all = bySel(cfg.all);
        const options = bySel(cfg.options);

        if (toggle && panel) {
            toggle.addEventListener('click', () => panel.classList.toggle('kg-hidden'));
            document.addEventListener('click', (event) => {
                if (root && !root.contains(event.target)) {
                    panel.classList.add('kg-hidden');
                }
            });
        }

        if (all) {
            all.addEventListener('change', () => {
                if (all.checked && options) {
                    options.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
                        cb.checked = false;
                    });
                }
                updateFilterToggleLabel(key);
                applyFilters();
            });
        }

        if (options) {
            options.addEventListener('change', (event) => {
                const target = event.target;
                if (!target || target.type !== 'checkbox') {
                    return;
                }
                if (all) {
                    all.checked = false;
                }
                updateFilterToggleLabel(key);
                applyFilters();
            });
        }

        updateFilterToggleLabel(key);
    };

    const populateTagOptions = () => {
        const key = 'tags';
        const cfg = FILTER_DROPDOWNS[key];
        const host = bySel(cfg.options);
        if (!host) {
            return;
        }
        const previous = getSelectedFilterValues(key);
        const origin = bySel('#ml-filter-origin') ? bySel('#ml-filter-origin').value : '';
        // Die anwählbaren Werte kommen aus dem, was der aktive Tab überhaupt
        // zeigt - sonst stünden im Konzept-Tab Tags zur Wahl, die dort nie
        // einen Treffer ergeben.
        const relevant = origin
            ? scopedMethods().filter((m) => konzeptSetIdOf(m) === Number(origin))
            : scopedMethods();
        const tags = new Set();
        relevant.forEach((m) => {
            splitMulti(m.tags).forEach((t) => tags.add(t));
        });

        host.innerHTML = '';
        Array.from(tags).sort((a, b) => a.localeCompare(b, 'de')).forEach((tag) => {
            const row = document.createElement('label');
            row.className = 'kg-tag-option';
            const checked = previous.includes(tag.toLowerCase()) ? 'checked' : '';
            row.innerHTML = `<input type="checkbox" value="${tag}" ${checked}><span>${tag}</span>`;
            host.appendChild(row);
        });
        updateFilterToggleLabel(key);
    };

    const loadMethodsetSyncStatus = (cmid) => {
        return asCall('mod_seminarplaner_get_methodset_sync_status', {cmid}).then((res) => {
            const links = Array.isArray(res && res.links) ? res.links : [];
            // D54: ein Set gilt als "aktualisierbar", wenn eine neuere globale
            // Version vorliegt (haspending oder currentversion > verknüpfte Version).
            pendingUpdateSetIds = new Set(
                links
                    .filter((link) => !!link
                        && (!!link.haspending
                            || (Number(link.currentversionid) || 0) > (Number(link.linkedversionid) || 0)))
                    .map((link) => Number(link.methodsetid) || 0)
                    .filter((id) => id > 0)
            );
        }).catch(() => {
            pendingUpdateSetIds = new Set();
        });
    };

    const getSyncMethodsetId = (method) => {
        if (!method || !method._kgsync || typeof method._kgsync !== 'object') {
            return 0;
        }
        return Number(method._kgsync.setid || 0) || 0;
    };

    // D54: Für diese Karte ist eine aktualisierte Version aus ihrer globalen
    // Sammlung verfügbar. Reiner Hinweis - übernommen wird nur bewusst über
    // "Ausstehende Updates übernehmen" im Import/Export-Tab.
    const hasPendingUpdate = (method) => {
        const setid = getSyncMethodsetId(method);
        return setid > 0 && pendingUpdateSetIds.has(setid);
    };

    // Die manuelle Voll-Fixierung ("Lokal fixieren") ist genau dann sinnvoll,
    // wenn eine Aktualisierung ansteht - so lässt sich eine Karte vor dem
    // Übernehmen gegen Überschreiben schützen (D54: lokale Änderung hat Vorrang).
    const shouldShowFreezeLock = (method) => hasPendingUpdate(method);

    // Welcher Bibliothek-Tab die geteilte Liste (#ml-browse) gerade zeigt:
    // 'local' = eigene Seminareinheiten, 'concepts' = die aus importierten
    // Seminarkonzepten. Beide sind lokale Kopien und teilen sich Filterleiste,
    // Liste und Editor - getrennt wird nur, welche Einheiten drin sind.
    let libraryScope = 'local';

    // Eine Einheit stammt aus einem Konzept, wenn sie dessen Herkunft trägt.
    // Fallback aufs konzept--Präfix: Karten, die vor der Herkunfts-Ergänzung
    // importiert wurden, haben nur das Präfix.
    const isKonzeptCard = (m) => !!(m && (m._kgkonzept || String(m.id || '').indexOf('konzept-') === 0));

    // Aus welchem Konzept eine Einheit stammt. 0, wenn sie es nicht sagt -
    // dann sammelt der Herkunftsfilter sie unter "Unbekanntes Konzept".
    const konzeptSetIdOf = (m) => (m && m._kgkonzept ? Number(m._kgkonzept.setid) || 0 : 0);

    // Name des Konzepts, aus dem eine Einheit stammt. Er reist an der Karte
    // mit, damit die Bibliothek ihn ohne Server-Abfrage zeigen kann.
    const konzeptNameFor = (setid) => {
        if (!setid) {
            return 'Unbekanntes Konzept';
        }
        const card = methods.find((m) => konzeptSetIdOf(m) === setid && m._kgkonzept && m._kgkonzept.setname);
        return card ? String(card._kgkonzept.setname) : `Seminarkonzept #${setid}`;
    };

    const scopedMethods = () => methods.filter((m) => (libraryScope === 'concepts' ? isKonzeptCard(m) : !isKonzeptCard(m)));

    // Herkunft = aus welchem Seminarkonzept. Nur im Konzept-Tab, und erst ab
    // dem zweiten Konzept - bei einem einzigen gäbe es nichts zu unterscheiden.
    const updateOriginFilterVisibility = () => {
        const wrap = bySel('#ml-filter-origin-wrap');
        const select = bySel('#ml-filter-origin');
        if (!wrap) {
            return;
        }
        const setids = new Set();
        scopedMethods().forEach((m) => {
            setids.add(konzeptSetIdOf(m));
        });
        wrap.classList.toggle('kg-hidden', libraryScope !== 'concepts' || setids.size < 2);
        if (!select) {
            return;
        }
        const previous = select.value;
        const concepts = Array.from(setids)
            .map((setid) => ({setid, name: konzeptNameFor(setid)}))
            .sort((a, b) => a.name.localeCompare(b.name, 'de'));

        select.innerHTML = '';
        const allOption = document.createElement('option');
        allOption.value = '';
        allOption.textContent = 'Alle Seminarkonzepte';
        select.appendChild(allOption);
        concepts.forEach(({setid, name}) => {
            const option = document.createElement('option');
            option.value = String(setid);
            option.textContent = name;
            select.appendChild(option);
        });

        const validValues = new Set(['', ...concepts.map((c) => String(c.setid))]);
        select.value = validValues.has(previous) ? previous : '';
    };

    const isFrozenState = (syncmeta, defaultfrozen) => {
        if (!syncmeta || typeof syncmeta !== 'object') {
            return !!defaultfrozen;
        }
        if (syncmeta.frozen === undefined || syncmeta.frozen === null || syncmeta.frozen === '') {
            return !!defaultfrozen;
        }
        return Number(syncmeta.frozen) !== 0;
    };

    const applyFilters = () => {
        const query = normalize(bySel('#ml-filter-search') ? bySel('#ml-filter-search').value : '');
        const tags = getSelectedFilterValues('tags');
        const phases = getSelectedFilterValues('phase');
        const groups = getSelectedFilterValues('group');
        const durations = getSelectedFilterValues('duration');
        const origin = bySel('#ml-filter-origin') ? bySel('#ml-filter-origin').value : '';

        const host = bySel('#ml-method-list');
        if (!host) {
            return;
        }

        const inscope = scopedMethods();
        const cards = Array.from(host.querySelectorAll('.kg-library-card'));
        let visible = 0;
        cards.forEach((card) => {
            const id = card.getAttribute('data-id');
            const method = inscope.find((m) => String(m.id) === String(id));
            if (!method) {
                card.style.display = 'none';
                return;
            }

            const hay = [
                method.titel,
                method.kurzbeschreibung,
                method.tags,
                joinMulti(method.seminarphase),
                method.gruppengroesse,
                method.zeitbedarf,
                joinMulti(method.kognitive)
            ].join(' ').toLowerCase();

            const methodtags = splitMulti(method.tags).map((t) => t.toLowerCase());
            const methodphase = splitMulti(method.seminarphase).map((t) => t.toLowerCase());
            const methodgroup = normalize(method.gruppengroesse);
            const methodduration = normalize(method.zeitbedarf);

            const match = (!query || hay.includes(query))
                && (!tags.length || tags.every((t) => methodtags.includes(t)))
                && (!phases.length || methodphase.some((p) => phases.includes(p)))
                && (!groups.length || groups.includes(methodgroup))
                && (!durations.length || durations.includes(methodduration))
                && (!origin || konzeptSetIdOf(method) === Number(origin));

            card.style.display = match ? '' : 'none';
            if (match) {
                visible++;
            }
        });

        const status = bySel('#ml-filter-status');
        if (status) {
            status.textContent = `${visible} von ${inscope.length} Seminareinheiten angezeigt.`;
        }
    };

    const renderList = () => {
        const host = bySel('#ml-method-list');
        if (!host) {
            return;
        }
        const existingIds = new Set(methods.map((m) => String(m.id)));
        Array.from(selectedIds).forEach((id) => {
            if (!existingIds.has(id)) {
                selectedIds.delete(id);
            }
        });
        host.classList.toggle('kg-library-list--selecting', selectionMode);
        host.innerHTML = '';

        scopedMethods().forEach((m, index) => {
            if (!m.id) {
                m.id = `legacy-${index}-${uid()}`;
            }
            const card = document.createElement('div');
            const cognitiveLevel = cognitiveLevelOf(m);
            card.className = 'kg-library-card sp-card'
                + (cognitiveLevel ? ` sp-level-${cognitiveLevel}` : '')
                + phaseClassOf(m.seminarphase);
            card.setAttribute('data-id', String(m.id));
            card.draggable = true;
            const pendingUpdate = hasPendingUpdate(m);
            const showlock = shouldShowFreezeLock(m);
            const frozen = showlock ? isFrozenState(m._kgsync, true) : false;
            const freezeaction = showlock
                ? `<button type="button" class="sq-menu__item" data-act="freeze"
                    title="Schützt diese Karte beim Übernehmen von Updates vor dem Überschreiben.">\
${ML_MENU_ICONS.lock}<span>${frozen ? 'Fixierung lösen' : 'Lokal fixieren'}</span></button>`
                : '';
            const updatehint = pendingUpdate
                ? `<div class="ml-card-updatehint"
                    title="Übernehmen über &bdquo;Ausstehende Updates übernehmen&ldquo; im Tab Import/Export. \
Deine lokalen Änderungen bleiben erhalten.">↻ Aktualisierte Version verfügbar</div>`
                : '';
            const tagChips = splitMulti(m.tags)
                .map((tag) => `<span class="ml-card-tag">${escapeHtml(tag)}</span>`)
                .join('');
            if (selectedIds.has(String(m.id))) {
                card.classList.add('kg-library-card--selected');
            }
            card.innerHTML = `
              <label class="ml-card-select">
                <input type="checkbox" class="ml-card-select-input"
                  ${selectedIds.has(String(m.id)) ? 'checked' : ''} aria-label="Seminareinheit auswählen">
              </label>
              <div class="ml-card-head">
                <span class="ml-card-drag-handle" title="Reihenfolge per Drag-and-drop ändern" aria-hidden="true">
                  <span class="ml-card-drag-handle__arrow ml-card-drag-handle__arrow--up">↑</span>
                  <span class="ml-card-drag-handle__arrow ml-card-drag-handle__arrow--right">→</span>
                  <span class="ml-card-drag-handle__arrow ml-card-drag-handle__arrow--down">↓</span>
                  <span class="ml-card-drag-handle__arrow ml-card-drag-handle__arrow--left">←</span>
                </span>
                <div class="sp-card-title ml-card-title"><strong>${escapeHtml(m.titel || '(ohne Titel)')}</strong></div>
                <div class="ml-card-head-actions">
                  <details class="ml-card-menu sq-menu">
                    <summary class="sq-menu__btn" aria-label="Aktionen" title="Weitere Aktionen">⋮</summary>
                    <div class="sq-menu__panel" role="menu">
                      <button type="button" class="sq-menu__item"
                        data-act="edit">${ML_MENU_ICONS.edit}<span>Bearbeiten</span></button>
                      <button type="button" class="sq-menu__item"
                        data-act="overwrite-import">${ML_MENU_ICONS.replace}<span>Aus Datei ersetzen…</span></button>
                      ${freezeaction}
                      <button type="button" class="sq-menu__item sq-menu__item--danger"
                        data-act="delete">${ML_MENU_ICONS.remove}<span>Löschen</span></button>
                    </div>
                  </details>
                </div>
              </div>
              ${updatehint}
              <div class="sp-card-compact">
                <div class="sp-card-meta">
                  ${renderCardBadges(m)}
                </div>
                ${tagChips ? `<div class="ml-card-tags">${tagChips}</div>` : ''}
                <div class="sp-card-description">${sanitizeCardHtml(m.kurzbeschreibung || '')}</div>
              </div>
              <div class="ml-card-footer">
                <span class="ml-card-modified">Letzte Änderung: ${escapeHtml(formatRelativeModified(m.timemodified))}</span>
                <button type="button" class="ml-card-details" data-act="details">Details <span
                  class="ml-card-details__chevron" aria-hidden="true">›</span></button>
              </div>
            `;

            const selectinput = card.querySelector('.ml-card-select-input');
            if (selectinput) {
                selectinput.addEventListener('click', (event) => event.stopPropagation());
                selectinput.addEventListener('change', () => {
                    if (selectinput.checked) {
                        selectedIds.add(String(m.id));
                    } else {
                        selectedIds.delete(String(m.id));
                    }
                    card.classList.toggle('kg-library-card--selected', selectinput.checked);
                    updateBulkToolbar();
                });
            }
            const editbtn = card.querySelector('[data-act="edit"]');
            const freezebtn = card.querySelector('[data-act="freeze"]');
            const deletebtn = card.querySelector('[data-act="delete"]');
            const overwritebtn = card.querySelector('[data-act="overwrite-import"]');
            card.addEventListener('dragstart', (event) => {
                if (event.target.closest('.ml-card-menu, button, input, select, textarea, a')) {
                    event.preventDefault();
                    return;
                }
                draggedMethodId = String(m.id);
                card.classList.add('kg-library-card--dragging');
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', draggedMethodId);
                event.dataTransfer.setData('application/x-seminarplaner-method-id', draggedMethodId);
            });
            card.addEventListener('dragend', () => {
                draggedMethodId = '';
                clearDropIndicators();
                card.classList.remove('kg-library-card--dragging');
            });
            card.addEventListener('dragover', (event) => {
                if (!draggedMethodId || draggedMethodId === String(m.id)) {
                    return;
                }
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                markDropTarget(card, getDropPlacement(card, event));
            });
            card.addEventListener('dragleave', (event) => {
                if (!card.contains(event.relatedTarget)) {
                    card.classList.remove('kg-library-card--drop-before', 'kg-library-card--drop-after');
                }
            });
            card.addEventListener('drop', (event) => {
                const sourceid = String(
                    event.dataTransfer.getData('application/x-seminarplaner-method-id')
                        || event.dataTransfer.getData('text/plain')
                        || draggedMethodId
                        || ''
                );
                if (!sourceid || sourceid === String(m.id)) {
                    clearDropIndicators();
                    return;
                }
                event.preventDefault();
                const placement = getDropPlacement(card, event);
                reorderMethods(sourceid, String(m.id), placement.position).catch((e) => {
                    Notification.exception(e);
                    setStatus('Reihenfolge konnte nicht gespeichert werden.', true);
                });
            });
            const closeMenu = (button) => {
                const menu = button ? button.closest('.ml-card-menu') : null;
                if (menu) {
                    menu.open = false;
                }
            };
            if (editbtn) {
                editbtn.addEventListener('click', () => {
                    closeMenu(editbtn);
                    if (typeof window !== 'undefined' && window.location) {
                        suppressLeavePrompt();
                        const url = new URL(window.location.href);
                        const materialitemid = Array.isArray(m.materialien)
                            ? Number(
                                ((m.materialien.find((entry) => entry && typeof entry === 'object'
                                    && Number(entry.itemid || 0) > 0) || {}).itemid) || 0
                            )
                            : 0;
                        url.searchParams.set('editmethodid', String(m.id));
                        if (materialitemid > 0) {
                            url.searchParams.set('editmaterialitemid', String(materialitemid));
                        } else {
                            url.searchParams.delete('editmaterialitemid');
                        }
                        url.searchParams.set('_mlts', String(Date.now()));
                        window.location.assign(url.toString());
                        return;
                    }
                    openEditor(m.id);
                });
            }
            const detailsbtn = card.querySelector('[data-act="details"]');
            if (detailsbtn) {
                detailsbtn.addEventListener('click', (event) => {
                    event.preventDefault();
                    if (editbtn) {
                        editbtn.click();
                    } else {
                        openEditor(m.id);
                    }
                });
            }
            if (freezebtn) {
                freezebtn.addEventListener('click', () => {
                    closeMenu(freezebtn);
                    toggleMethodFreeze(m.id).catch((e) => {
                        Notification.exception(e);
                        setStatus('Fixieren fehlgeschlagen.', true);
                    });
                });
            }
            if (deletebtn) {
                deletebtn.addEventListener('click', () => {
                    closeMenu(deletebtn);
                    deleteMethod(m.id).catch((e) => {
                        Notification.exception(e);
                        setStatus('Löschen fehlgeschlagen.', true);
                    });
                });
            }
            if (overwritebtn) {
                overwritebtn.addEventListener('click', () => {
                    closeMenu(overwritebtn);
                    overwriteMethodFromImport(m.id);
                });
            }
            host.appendChild(card);
        });

        updateOriginFilterVisibility();
        populateTagOptions();
        applyFilters();
        if (currentEditId) {
            refreshEditAlternativeOptions(currentEditId);
        }
        updateBulkToolbar();
    };

    const clearDropIndicators = () => {
        document.querySelectorAll(
            '.kg-library-card--drop-before-x, .kg-library-card--drop-after-x, '
                + '.kg-library-card--drop-before-y, .kg-library-card--drop-after-y'
        ).forEach((card) => {
            card.classList.remove(
                'kg-library-card--drop-before-x',
                'kg-library-card--drop-after-x',
                'kg-library-card--drop-before-y',
                'kg-library-card--drop-after-y'
            );
        });
    };

    const getDropPlacement = (card, event) => {
        const rect = card.getBoundingClientRect();
        const dx = event.clientX - (rect.left + rect.width / 2);
        const dy = event.clientY - (rect.top + rect.height / 2);
        const axis = Math.abs(dx / Math.max(rect.width, 1)) > Math.abs(dy / Math.max(rect.height, 1)) ? 'x' : 'y';
        return {
            axis,
            position: (axis === 'x' ? dx : dy) < 0 ? 'before' : 'after'
        };
    };

    const markDropTarget = (card, placement) => {
        clearDropIndicators();
        const axis = placement.axis === 'x' ? 'x' : 'y';
        const position = placement.position === 'before' ? 'before' : 'after';
        card.classList.add(`kg-library-card--drop-${position}-${axis}`);
    };

    const reorderMethods = async (sourceid, targetid, position) => {
        const from = methods.findIndex((method) => String(method.id) === String(sourceid));
        const target = methods.findIndex((method) => String(method.id) === String(targetid));
        if (from < 0 || target < 0 || from === target) {
            clearDropIndicators();
            return;
        }

        const previousMethods = methods.slice();
        const [moved] = methods.splice(from, 1);
        let to = methods.findIndex((method) => String(method.id) === String(targetid));
        if (to < 0) {
            methods = previousMethods;
            clearDropIndicators();
            return;
        }
        if (position === 'after') {
            to++;
        }
        methods.splice(to, 0, moved);
        renderList();
        setStatus('Neue Reihenfolge wird gespeichert ...', false);
        try {
            await persist(runtimeCmid);
            setStatus('Reihenfolge gespeichert.', false);
        } catch (error) {
            methods = previousMethods;
            renderList();
            throw error;
        } finally {
            draggedMethodId = '';
            clearDropIndicators();
        }
    };

    const setSelectMulti = (selector, values) => {
        const el = bySel(selector);
        if (!el) {
            return;
        }
        const list = splitMulti(values);
        if (el.tagName !== 'SELECT') {
            setFormMultiDropdownValues(selector, list);
            return;
        }
        Array.from(el.options).forEach((opt) => {
            opt.selected = list.includes(opt.value);
        });
    };

    const getSelectMulti = (selector) => {
        const el = bySel(selector);
        if (!el) {
            return [];
        }
        if (el.tagName !== 'SELECT') {
            return readMulti(selector);
        }
        return Array.from(el.selectedOptions).map((o) => o.value);
    };

    const setEditHeading = (text) => {
        const heading = bySel('#ml-edit-heading');
        if (heading) {
            heading.textContent = text;
        }
    };

    const resetEditForm = () => {
        const form = bySel('#ml-edit-form');
        if (form && typeof form.reset === 'function') {
            form.reset();
        }
        setFieldValue('#ml-edit-id', '');
        ['#ml-e-kurzbeschreibung', '#ml-e-ablauf', '#ml-e-lernziele',
            '#ml-e-risiken', '#ml-e-debrief', '#ml-e-materialtechnik'].forEach((selector) => {
            setFieldValue(selector, '');
        });
        const materialcurrent = bySel('#ml-e-materialien-current');
        if (materialcurrent) {
            materialcurrent.textContent = '';
        }
    };

    // D50: "Neue Seminareinheit anlegen" öffnet den Bearbeiten-Editor leer –
    // kein eigener Anlegen-Bereich mehr.
    const openCreateEditor = () => {
        creatingNew = true;
        currentEditId = '';
        setEditHeading('Neue Seminareinheit anlegen');
        resetEditForm();
        setFieldValue('#ml-e-titel', '');
        setFieldValue('#ml-e-tags', '');
        setFieldValue('#ml-e-autor', '');
        // Ohne <form> greift kein reset(); diese drei Felder behielten sonst
        // die Werte der zuletzt bearbeiteten Einheit.
        setFieldValue('#ml-e-zeitbedarf', '');
        setFieldValue('#ml-e-gruppengroesse', '');
        setFieldValue('#ml-e-vorbereitung', '');
        setSelectMulti('#ml-e-seminarphase', []);
        setSelectMulti('#ml-e-raum', []);
        setSelectMulti('#ml-e-sozialform', []);
        refreshEditAlternativeOptions('');
        setSelectMulti('#ml-e-alternativen', []);
        const editsection = bySel('#ml-edit-section');
        if (editsection) {
            editsection.classList.remove('kg-hidden');
            editsection.scrollIntoView({behavior: 'auto', block: 'start'});
            window.setTimeout(() => {
                const top = editsection.getBoundingClientRect().top + window.scrollY;
                window.scrollTo({top: Math.max(0, top - 80), behavior: 'auto'});
            }, 0);
        }
        const titlefield = bySel('#ml-e-titel');
        if (titlefield) {
            titlefield.focus();
        }
        setStatus('Neue Seminareinheit – nur der Titel ist Pflicht, alles Weitere kannst du später ergänzen.', false);
    };

    const openEditor = (id) => {
        const method = methods.find((m) => String(m.id) === String(id));
        if (!method) {
            setStatus('Seminareinheit konnte nicht zum Bearbeiten geöffnet werden.', true);
            return;
        }
        currentEditId = String(id);
        creatingNew = false;
        setEditHeading('Seminareinheit bearbeiten');
        const editsection = bySel('#ml-edit-section');
        if (editsection) {
            editsection.classList.remove('kg-hidden');
        }

        setFieldValue('#ml-edit-id', method.id);
        setFieldValue('#ml-e-titel', method.titel);
        setFieldValue('#ml-e-zeitbedarf', method.zeitbedarf);
        setFieldValue('#ml-e-gruppengroesse', method.gruppengroesse);
        setFieldValue('#ml-e-kurzbeschreibung', method.kurzbeschreibung);
        setFieldValue('#ml-e-vorbereitung', method.vorbereitung);
        setFieldValue('#ml-e-materialtechnik', method.materialtechnik);
        setFieldValue('#ml-e-ablauf', method.ablauf);
        setFieldValue('#ml-e-lernziele', method.lernziele);
        setFieldValue('#ml-e-risiken', method.risiken);
        setFieldValue('#ml-e-debrief', method.debrief);
        setFieldValue('#ml-e-tags', method.tags);
        setFieldValue('#ml-e-autor', method.autor);
        const materialcurrent = bySel('#ml-e-materialien-current');
        const materialdraft = bySel('#id_ml_materialiendraftitemid');
        if (materialdraft) {
            const prepareddraft = Number(materialdraft.value || 0);
            materialdraft.value = String(prepareddraft || 0);
            if (!prepareddraft) {
                setStatus('Dateien konnten nicht zum Bearbeiten vorbereitet werden. '
                    + 'Bitte Seminareinheit erneut über "Bearbeiten" öffnen.', true);
            }
        }
        if (materialcurrent) {
            const names = attachmentNames(method.materialien);
            materialcurrent.textContent = names.length ? `Aktuell: ${names.join(', ')}` : '';
        }

        setSelectMulti('#ml-e-seminarphase', method.seminarphase);
        setSelectMulti('#ml-e-raum', method.raum);
        setSelectMulti('#ml-e-sozialform', method.sozialform);
        refreshEditAlternativeOptions(method.id);
        setSelectMulti('#ml-e-alternativen', method.alternativen || []);
        if (editsection) {
            editsection.scrollIntoView({behavior: 'auto', block: 'start'});
            window.setTimeout(() => {
                const top = editsection.getBoundingClientRect().top + window.scrollY;
                window.scrollTo({top: Math.max(0, top - 80), behavior: 'auto'});
            }, 0);
        }
        setStatus(`Seminareinheit "${method.titel || ''}" zum Bearbeiten geladen.`, false);
    };

    const serializeMethodsForSave = () => methods.map((method) => {
        const payload = Object.assign({}, method);
        if (Array.isArray(payload.materialien)) {
            payload.materialien = payload.materialien.map((entry) => {
                if (entry && typeof entry === 'object' && entry.name) {
                    return {name: String(entry.name)};
                }
                return entry;
            });
        }
        if (Array.isArray(payload.h5p)) {
            payload.h5p = payload.h5p.map((entry) => {
                if (entry && typeof entry === 'object' && entry.name) {
                    return {name: String(entry.name)};
                }
                return entry;
            });
        }
        return payload;
    });

    const persist = (cmid) => {
        normalizeMethodAlternatives();
        return asCall('mod_seminarplaner_save_method_cards', {
            cmid,
            methodsjson: JSON.stringify(serializeMethodsForSave())
        });
    };

    const BULK_MULTI_FIELDS = ['seminarphase', 'raum', 'sozialform'];
    const BULK_SELECT_FIELDS = ['zeitbedarf', 'gruppengroesse', 'vorbereitung'];

    const updateBulkToolbar = () => {
        const toolbar = bySel('#ml-bulk-toolbar');
        if (!toolbar) {
            return;
        }
        const count = selectedIds.size;
        toolbar.classList.toggle('kg-hidden', !selectionMode);
        const countel = bySel('#ml-bulk-toolbar-count');
        if (countel) {
            countel.textContent = count
                ? `${count} Seminareinheit${count === 1 ? '' : 'en'} ausgewählt`
                : 'Keine Seminareinheit ausgewählt';
        }
        const editopenbtn = bySel('#ml-bulk-edit-open');
        if (editopenbtn) {
            editopenbtn.disabled = count === 0;
        }
    };

    const resetBulkForm = () => {
        BULK_MULTI_FIELDS.concat(BULK_SELECT_FIELDS).concat(['tags']).forEach((field) => {
            const modeselect = bySel(`#ml-bulk-mode-${field}`);
            if (modeselect) {
                modeselect.value = 'none';
                modeselect.dispatchEvent(new Event('change'));
            }
        });
    };

    const closeBulkPanel = () => {
        bySel('#ml-bulk-section')?.classList.add('kg-hidden');
        resetBulkForm();
    };

    const bindBulkSelectionUI = (cmid) => {
        const selecttoggle = bySel('#ml-bulk-select-toggle');
        if (selecttoggle) {
            selecttoggle.addEventListener('click', () => {
                selectionMode = !selectionMode;
                selecttoggle.textContent = selectionMode ? 'Auswahl beenden' : 'Mehrere auswählen';
                if (!selectionMode) {
                    selectedIds.clear();
                    closeBulkPanel();
                }
                renderList();
            });
        }
        const selectallbtn = bySel('#ml-bulk-selectall');
        if (selectallbtn) {
            selectallbtn.addEventListener('click', () => {
                document.querySelectorAll('#ml-method-list .kg-library-card').forEach((card) => {
                    if (card.style.display === 'none') {
                        return;
                    }
                    const id = card.getAttribute('data-id');
                    if (id) {
                        selectedIds.add(String(id));
                    }
                });
                renderList();
            });
        }
        const selectnonebtn = bySel('#ml-bulk-selectnone');
        if (selectnonebtn) {
            selectnonebtn.addEventListener('click', () => {
                selectedIds.clear();
                renderList();
            });
        }
        const bulkeditopenbtn = bySel('#ml-bulk-edit-open');
        if (bulkeditopenbtn) {
            bulkeditopenbtn.addEventListener('click', () => {
                if (!selectedIds.size) {
                    setStatus('Bitte zuerst Seminareinheiten auswählen.', true);
                    return;
                }
                resetBulkForm();
                const section = bySel('#ml-bulk-section');
                if (section) {
                    section.classList.remove('kg-hidden');
                    section.scrollIntoView({behavior: 'auto', block: 'start'});
                }
            });
        }
        document.querySelectorAll('.kg-bulk-mode-select').forEach((modeselect) => {
            const targetselector = modeselect.getAttribute('data-bulk-value-target');
            const target = targetselector ? bySel(targetselector) : null;
            const applyDisabledState = () => {
                const disabled = modeselect.value === 'none';
                if (target) {
                    target.classList.toggle('kg-bulk-value--disabled', disabled);
                    target.querySelectorAll('input, select, button').forEach((input) => {
                        input.disabled = disabled;
                    });
                }
            };
            modeselect.addEventListener('change', applyDisabledState);
            applyDisabledState();
        });
        const bulksavebtn = bySel('#ml-bulk-save');
        if (bulksavebtn) {
            bulksavebtn.addEventListener('click', () => {
                applyBulkEdit(cmid).catch((e) => {
                    Notification.exception(e);
                    setStatus('Stapel-Bearbeitung fehlgeschlagen.', true);
                });
            });
        }
        const bulkcancelbtn = bySel('#ml-bulk-cancel');
        if (bulkcancelbtn) {
            bulkcancelbtn.addEventListener('click', closeBulkPanel);
        }
    };

    const applyBulkEdit = async (cmid) => {
        if (!selectedIds.size) {
            setStatus('Keine Seminareinheiten ausgewählt.', true);
            return;
        }

        const ops = {};
        BULK_MULTI_FIELDS.forEach((field) => {
            const modeselect = bySel(`#ml-bulk-mode-${field}`);
            const mode = modeselect ? modeselect.value : 'none';
            if (mode !== 'none') {
                ops[field] = {mode, kind: 'multi', values: getSelectMulti(`#ml-bulk-${field}`)};
            }
        });
        BULK_SELECT_FIELDS.forEach((field) => {
            const modeselect = bySel(`#ml-bulk-mode-${field}`);
            const mode = modeselect ? modeselect.value : 'none';
            if (mode === 'replace') {
                const valueel = bySel(`#ml-bulk-${field}`);
                ops[field] = {mode, kind: 'single', value: valueel ? valueel.value : ''};
            }
        });
        const tagsmodeselect = bySel('#ml-bulk-mode-tags');
        const tagsmode = tagsmodeselect ? tagsmodeselect.value : 'none';
        if (tagsmode !== 'none') {
            const tagsvalueel = bySel('#ml-bulk-tags');
            ops.tags = {mode: tagsmode, kind: 'taglist', values: splitMulti(tagsvalueel ? tagsvalueel.value : '')};
        }

        if (!Object.keys(ops).length) {
            setStatus('Bitte mindestens ein Feld zur Änderung auswählen.', true);
            return;
        }

        const count = selectedIds.size;
        const yes = window.confirm(`Änderungen auf ${count} Seminareinheit${count === 1 ? '' : 'en'} anwenden?`);
        if (!yes) {
            return;
        }

        const previousMethods = methods.slice();
        methods = methods.map((m) => {
            if (!selectedIds.has(String(m.id))) {
                return m;
            }
            const updated = Object.assign({}, m);
            Object.keys(ops).forEach((field) => {
                const op = ops[field];
                if (op.kind === 'multi') {
                    const current = splitMulti(updated[field]);
                    if (op.mode === 'replace') {
                        updated[field] = op.values.slice();
                    } else if (op.mode === 'add') {
                        updated[field] = Array.from(new Set(current.concat(op.values)));
                    } else if (op.mode === 'remove') {
                        updated[field] = current.filter((v) => !op.values.includes(v));
                    }
                } else if (op.kind === 'single') {
                    updated[field] = op.value;
                } else if (op.kind === 'taglist') {
                    const current = splitMulti(updated.tags);
                    let next;
                    if (op.mode === 'replace') {
                        next = op.values.slice();
                    } else if (op.mode === 'add') {
                        next = Array.from(new Set(current.concat(op.values)));
                    } else {
                        next = current.filter((v) => !op.values.includes(v));
                    }
                    updated.tags = next.join(', ');
                }
            });
            touchMethod(updated);
            return updated;
        });

        renderList();
        setStatus('Änderungen werden gespeichert ...', false);
        try {
            await persist(cmid);
            setStatus(`Änderungen auf ${count} Seminareinheit${count === 1 ? '' : 'en'} gespeichert.`, false);
            selectedIds.clear();
            closeBulkPanel();
            renderList();
        } catch (error) {
            methods = previousMethods;
            renderList();
            throw error;
        }
    };

    const addMethod = async (cmid) => {
        const method = await buildMethod();
        if (!method) {
            setStatus('Titel ist Pflichtfeld.', true);
            return;
        }
        touchMethod(method);
        methods.push(method);
        reconcileAlternativesForMethod(method.id, method.alternativen || []);
        normalizeMethodAlternatives();
        await persist(cmid);
        clearAddForm();
        renderList();
        setStatus('Seminareinheit hinzugefügt und gespeichert.', false);
    };

    const stripHtml = (value) => {
        if (!value) {
            return '';
        }
        const div = document.createElement('div');
        div.innerHTML = String(value);
        return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
    };

    const parseCsvTable = (csvText) => {
        const text = String(csvText || '').replace(/^\uFEFF/, '');
        const firstLine = text.split(/\r?\n/, 1)[0] || '';
        const delimiterCandidates = [',', ';', '\t'];
        let delimiter = ',';
        let bestCount = -1;
        delimiterCandidates.forEach((cand) => {
            const esc = cand === '\t' ? '\\t' : `\\${cand}`;
            const count = (firstLine.match(new RegExp(esc, 'g')) || []).length;
            if (count > bestCount) {
                bestCount = count;
                delimiter = cand;
            }
        });

        const rows = [];
        let row = [];
        let cell = '';
        let i = 0;
        let inQuotes = false;

        while (i < text.length) {
            const ch = text[i];
            if (inQuotes) {
                if (ch === '"') {
                    if (text[i + 1] === '"') {
                        cell += '"';
                        i += 2;
                        continue;
                    }
                    inQuotes = false;
                    i += 1;
                    continue;
                }
                cell += ch;
                i += 1;
                continue;
            }

            if (ch === '"') {
                inQuotes = true;
                i += 1;
                continue;
            }

            if (ch === delimiter) {
                row.push(cell);
                cell = '';
                i += 1;
                continue;
            }

            if (ch === '\n') {
                row.push(cell);
                rows.push(row);
                row = [];
                cell = '';
                i += 1;
                continue;
            }

            if (ch === '\r') {
                i += 1;
                continue;
            }

            cell += ch;
            i += 1;
        }

        if (cell !== '' || row.length > 0) {
            row.push(cell);
            rows.push(row);
        }

        if (!rows.length) {
            return [];
        }

        const headers = rows[0].map((h) => String(h || '').trim().replace(/^\uFEFF/, ''));
        const out = [];
        for (let r = 1; r < rows.length; r++) {
            const values = rows[r];
            if (!values || !values.length) {
                continue;
            }
            const obj = {};
            headers.forEach((h, idx) => {
                obj[h] = values[idx] !== undefined ? String(values[idx]) : '';
            });
            if (Object.values(obj).join('').trim() !== '') {
                out.push(obj);
            }
        }
        return out;
    };

    const readFirst = (row, keys) => {
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
                return String(row[key]);
            }
        }
        return '';
    };

    const readRichTextField = (row, keys) => String(readFirst(row, keys) || '').trim();

    const mapLegacyRowToMethod = (row) => {
        const titel = stripHtml(readFirst(row, ['Titel', 'title', 'Name']));
        if (!titel) {
            return null;
        }

        return {
            id: uid(),
            titel,
            seminarphase: normalizePhases(splitMulti(readFirst(row, ['Seminarphase', 'seminarphase']))),
            zeitbedarf: stripHtml(readFirst(row, ['Zeitbedarf', 'zeitbedarf'])),
            gruppengroesse: stripHtml(readFirst(row, ['Gruppengröße', 'Gruppengroesse', 'gruppengroesse'])),
            kurzbeschreibung: readRichTextField(row, ['Kurzbeschreibung', 'kurzbeschreibung']),
            autor: stripHtml(readFirst(row, ['Autor*in / Kontakt', 'Autor/in / Kontakt', 'autor_kontakt', 'autor'])),
            lernziele: readRichTextField(row, ['Lernziele (Ich-kann ...)', 'lernziele']),
            komplexitaet: stripHtml(readFirst(row, ['Komplexitätsgrad', 'Komplexitaetsgrad', 'komplexitaet'])),
            vorbereitung: stripHtml(readFirst(row, ['Vorbereitung nötig', 'Vorbereitung noetig', 'vorbereitung'])),
            raum: splitMulti(readFirst(row, ['Raumanforderungen', 'raumanforderungen'])),
            sozialform: splitMulti(readFirst(row, ['Sozialform', 'sozialform'])),
            risiken: readRichTextField(row, ['Risiken/Tipps', 'risiken_tipps', 'risiken']),
            debrief: readRichTextField(row, ['Debrief/Reflexionsfragen', 'debrief']),
            materialien: splitMulti(readFirst(row, ['Materialien', 'materialien'])),
            materialtechnik: readRichTextField(row, ['Material/Technik', 'material_technik', 'materialtechnik']),
            ablauf: readRichTextField(row, ['Ablauf', 'ablauf']),
            tags: stripHtml(readFirst(row, ['Tags / Schlüsselworte', 'Tags / Schluesselworte', 'tags', 'Tags'])),
            kognitive: splitMulti(readFirst(row, ['Kognitive Dimension', 'kognitive_dimension', 'kognitive']))
        };
    };

    const extractImportedMethods = (parsed) => {
        if (Array.isArray(parsed)) {
            return parsed;
        }
        if (parsed && typeof parsed === 'object') {
            if (Array.isArray(parsed.methods)) {
                return parsed.methods;
            }
            if (Array.isArray(parsed.seminareinheiten)) {
                return parsed.seminareinheiten;
            }
            if (parsed.titel || parsed.title) {
                return [parsed];
            }
        }
        return [];
    };

    const normalizeImportedMethod = (raw, keepid) => {
        const normalized = Object.assign({}, raw, {id: keepid});
        const rawalternatives = raw.alternativen;
        normalized.alternativen = Array.isArray(rawalternatives)
            ? rawalternatives
            : (typeof rawalternatives === 'string'
                ? rawalternatives.split(/##|[\r\n,;]+/u).map((s) => s.trim()).filter(Boolean)
                : []);
        delete normalized.materialiendraftitemid;
        delete normalized.h5pdraftitemid;
        return normalized;
    };

    const pickImportedMethod = (candidates, targetTitle) => new Promise((resolve) => {
        if (candidates.length === 1) {
            resolve(candidates[0]);
            return;
        }
        const overlay = document.createElement('div');
        overlay.className = 'ml-import-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);'
            + 'display:flex;align-items:center;justify-content:center;z-index:1050;';
        const panel = document.createElement('div');
        panel.className = 'sp-card';
        panel.style.cssText = 'background:#fff;max-width:520px;width:90%;padding:1.25rem;'
            + 'border-radius:8px;box-shadow:0 10px 40px rgba(0,0,0,0.3);';
        const options = candidates
            .map((m, i) => `<option value="${i}">${escapeHtml(m.titel || m.title || '(ohne Titel)')}</option>`)
            .join('');
        panel.innerHTML = `
            <h4 style="margin-top:0;">Seminareinheit ersetzen</h4>
            <p>Welche importierte Seminareinheit soll „${escapeHtml(targetTitle || '')}" ersetzen?</p>
            <select class="kg-input" data-ml-import-pick="1" style="width:100%;margin-bottom:1rem;">${options}</select>
            <div class="kg-row" style="display:flex;gap:.5rem;justify-content:flex-end;">
                <button type="button" class="kg-btn" data-ml-import-cancel="1">Abbrechen</button>
                <button type="button" class="kg-btn kg-btn-primary" data-ml-import-confirm="1">Ersetzen</button>
            </div>
        `;
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
        const cleanup = (result) => {
            overlay.remove();
            resolve(result);
        };
        panel.querySelector('[data-ml-import-cancel]').addEventListener('click', () => cleanup(null));
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
                cleanup(null);
            }
        });
        panel.querySelector('[data-ml-import-confirm]').addEventListener('click', () => {
            const sel = panel.querySelector('[data-ml-import-pick]');
            const idx = Number.parseInt(sel.value, 10);
            cleanup(candidates[idx] || null);
        });
    });

    const overwriteMethodFromImport = (id) => {
        const idx = methods.findIndex((m) => String(m.id) === String(id));
        if (idx < 0) {
            return;
        }
        const target = methods[idx];
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.csv,application/json,text/csv';
        input.style.display = 'none';
        document.body.appendChild(input);
        input.addEventListener('change', async () => {
            const file = input.files && input.files[0];
            input.remove();
            if (!file) {
                return;
            }
            let candidates = [];
            try {
                const text = await file.text();
                const isCsv = /\.csv$/i.test(file.name || '');
                const parsed = isCsv
                    ? parseCsvTable(text).map(mapLegacyRowToMethod).filter(Boolean)
                    : extractImportedMethods(JSON.parse(text));
                candidates = parsed
                    .filter((m) => m && typeof m === 'object' && String(m.titel || m.title || '').trim());
            } catch (e) {
                setStatus('Datei konnte nicht gelesen werden (erwartet wird eine JSON- oder CSV-Datei).', true);
                return;
            }
            if (!candidates.length) {
                setStatus('Keine Seminareinheit in der Datei gefunden.', true);
                return;
            }
            const chosen = await pickImportedMethod(candidates, target.titel);
            if (!chosen) {
                return;
            }
            const sourcetitle = String(chosen.titel || chosen.title || '').trim();
            const confirmed = window.confirm(
                `Seminareinheit "${target.titel || ''}" mit den Daten aus "${sourcetitle}" überschreiben? `
                + 'Die bisherigen Inhalte dieser Seminareinheit gehen verloren.'
            );
            if (!confirmed) {
                return;
            }
            const previousMethods = methods.slice();
            methods = methods.slice();
            methods[idx] = normalizeImportedMethod(chosen, target.id);
            touchMethod(methods[idx]);
            normalizeMethodAlternatives();
            renderList();
            try {
                await persist(runtimeCmid);
                setStatus(`Seminareinheit "${methods[idx].titel || ''}" durch Import überschrieben und gespeichert.`, false);
            } catch (error) {
                methods = previousMethods;
                renderList();
                Notification.exception(error);
                setStatus('Überschreiben fehlgeschlagen.', true);
            }
        });
        input.click();
    };

    const deleteMethod = async (id) => {
        const method = methods.find((m) => String(m.id) === String(id));
        if (!method) {
            return;
        }
        const yes = window.confirm(`Seminareinheit "${method.titel || ''}" wirklich löschen?`);
        if (!yes) {
            return;
        }
        const previousMethods = methods.slice();
        const wasEditingDeletedMethod = String(currentEditId) === String(id);
        methods = methods
            .filter((m) => String(m.id) !== String(id))
            .map((m) => Object.assign({}, m, {
                alternativen: (Array.isArray(m.alternativen) ? m.alternativen : [])
                    .filter((altid) => String(altid) !== String(id))
            }));
        normalizeMethodAlternatives();
        if (wasEditingDeletedMethod) {
            currentEditId = '';
            bySel('#ml-edit-section')?.classList.add('kg-hidden');
            const form = bySel('#ml-edit-form');
            if (form && typeof form.reset === 'function') {
                form.reset();
            }
        }
        renderList();
        try {
            await persist(runtimeCmid);
            setStatus('Seminareinheit gelöscht und gespeichert.', false);
        } catch (error) {
            methods = previousMethods;
            renderList();
            if (wasEditingDeletedMethod) {
                openEditor(id);
            }
            throw error;
        }
    };

    const toggleMethodFreeze = async (id) => {
        const idx = methods.findIndex((m) => String(m.id) === String(id));
        if (idx < 0) {
            return;
        }
        if (!shouldShowFreezeLock(methods[idx])) {
            setStatus('Fixierung nur bei Seminareinheiten mit aktivem Auto-Update verfügbar.', true);
            return;
        }
        if (!methods[idx]._kgsync || typeof methods[idx]._kgsync !== 'object') {
            methods[idx]._kgsync = {};
        }
        const currentlyfrozen = isFrozenState(methods[idx]._kgsync, true);
        methods[idx]._kgsync.frozen = currentlyfrozen ? 0 : 1;
        renderList();
        await persist(runtimeCmid);
        setStatus(methods[idx]._kgsync.frozen ? 'Seminareinheit lokal fixiert (kein automatisches Überschreiben).' :
            'Seminareinheit wieder für globale Aktualisierung freigegeben.', false);
    };

    // D50: Anlegen-Zweig des Editors – baut eine neue Karte in derselben
    // Feldform wie methods.js/buildMethod und hängt sie an den Bestand an.
    const saveNewMethod = async (cmid) => {
        const title = (bySel('#ml-e-titel') ? bySel('#ml-e-titel').value : '').trim();
        if (!title) {
            setStatus('Titel ist erforderlich.', true);
            return;
        }
        const currentdraftitemid = readMaterialDraftItemId();
        const method = touchMethod({
            id: uid(),
            titel: title,
            seminarphase: getSelectMulti('#ml-e-seminarphase'),
            zeitbedarf: (bySel('#ml-e-zeitbedarf') ? bySel('#ml-e-zeitbedarf').value : '').trim(),
            gruppengroesse: (bySel('#ml-e-gruppengroesse') ? bySel('#ml-e-gruppengroesse').value : '').trim(),
            kurzbeschreibung: getFieldValue('#ml-e-kurzbeschreibung'),
            autor: (bySel('#ml-e-autor') ? bySel('#ml-e-autor').value : '').trim(),
            lernziele: getFieldValue('#ml-e-lernziele'),
            vorbereitung: (bySel('#ml-e-vorbereitung') ? bySel('#ml-e-vorbereitung').value : '').trim(),
            raum: getSelectMulti('#ml-e-raum'),
            sozialform: getSelectMulti('#ml-e-sozialform'),
            risiken: getFieldValue('#ml-e-risiken'),
            debrief: getFieldValue('#ml-e-debrief'),
            materialien: [],
            materialiendraftitemid: currentdraftitemid || 0,
            materialtechnik: getFieldValue('#ml-e-materialtechnik'),
            ablauf: getFieldValue('#ml-e-ablauf'),
            tags: (bySel('#ml-e-tags') ? bySel('#ml-e-tags').value : '').trim(),
            alternativen: getSelectMulti('#ml-e-alternativen')
        });
        methods.push(method);
        reconcileAlternativesForMethod(method.id, method.alternativen || []);
        normalizeMethodAlternatives();

        await persist(cmid);
        // Der Entwurfsbereich ist jetzt an diese Einheit vergeben.
        materialDraftUsed = true;
        await loadMethods(cmid);
        creatingNew = false;
        setEditHeading('Seminareinheit bearbeiten');
        resetEditForm();
        bySel('#ml-edit-section')?.classList.add('kg-hidden');
        if (typeof window !== 'undefined' && window.history && window.location) {
            const url = new URL(window.location.href);
            url.searchParams.delete('create');
            window.history.replaceState({}, '', url.toString());
        }
        suppressLeavePrompt();
        setStatus(`Seminareinheit "${title}" angelegt und gespeichert.`, false);
    };

    const saveEditor = async (cmid) => {
        if (creatingNew) {
            await saveNewMethod(cmid);
            return;
        }
        if (!currentEditId) {
            setStatus('Bitte zuerst eine Seminareinheit auswählen.', true);
            return;
        }
        const idx = methods.findIndex((m) => String(m.id) === String(currentEditId));
        if (idx < 0) {
            setStatus('Ausgewählte Seminareinheit wurde nicht gefunden.', true);
            return;
        }

        const title = (bySel('#ml-e-titel') ? bySel('#ml-e-titel').value : '').trim();
        if (!title) {
            setStatus('Titel ist erforderlich.', true);
            return;
        }

        const currentdraftitemid = readMaterialDraftItemId();
        methods[idx] = Object.assign({}, methods[idx], {
            titel: title,
            seminarphase: getSelectMulti('#ml-e-seminarphase'),
            zeitbedarf: (bySel('#ml-e-zeitbedarf') ? bySel('#ml-e-zeitbedarf').value : '').trim(),
            gruppengroesse: (bySel('#ml-e-gruppengroesse') ? bySel('#ml-e-gruppengroesse').value : '').trim(),
            kurzbeschreibung: getFieldValue('#ml-e-kurzbeschreibung'),
            vorbereitung: (bySel('#ml-e-vorbereitung') ? bySel('#ml-e-vorbereitung').value : '').trim(),
            raum: getSelectMulti('#ml-e-raum'),
            sozialform: getSelectMulti('#ml-e-sozialform'),
            ablauf: getFieldValue('#ml-e-ablauf'),
            lernziele: getFieldValue('#ml-e-lernziele'),
            risiken: getFieldValue('#ml-e-risiken'),
            debrief: getFieldValue('#ml-e-debrief'),
            materialien: Array.isArray(methods[idx].materialien) ? methods[idx].materialien : [],
            materialiendraftitemid: currentdraftitemid || 0,
            materialtechnik: getFieldValue('#ml-e-materialtechnik'),
            tags: (bySel('#ml-e-tags') ? bySel('#ml-e-tags').value : '').trim(),
            autor: (bySel('#ml-e-autor') ? bySel('#ml-e-autor').value : '').trim(),
            alternativen: getSelectMulti('#ml-e-alternativen')
        });
        methods[idx].alternativen = (methods[idx].alternativen || []).filter((id) => String(id) !== String(methods[idx].id));
        touchMethod(methods[idx]);
        reconcileAlternativesForMethod(methods[idx].id, methods[idx].alternativen);
        normalizeMethodAlternatives();

        await persist(cmid);
        // Der Entwurfsbereich ist jetzt an diese Einheit vergeben.
        materialDraftUsed = true;
        await loadMethods(cmid);
        currentEditId = '';
        const form = bySel('#ml-edit-form');
        if (form && typeof form.reset === 'function') {
            form.reset();
        }
        ['#ml-e-kurzbeschreibung', '#ml-e-ablauf', '#ml-e-lernziele',
            '#ml-e-risiken', '#ml-e-debrief', '#ml-e-materialtechnik'].forEach((selector) => {
            setFieldValue(selector, '');
        });
        const materialcurrent = bySel('#ml-e-materialien-current');
        if (materialcurrent) {
            materialcurrent.textContent = '';
        }
        bySel('#ml-edit-section')?.classList.add('kg-hidden');
        if (typeof window !== 'undefined' && window.history && window.location) {
            const url = new URL(window.location.href);
            url.searchParams.delete('editmethodid');
            url.searchParams.delete('editmaterialitemid');
            url.searchParams.delete('_mlts');
            window.history.replaceState({}, '', url.toString());
        }
        suppressLeavePrompt();
        setStatus('Seminareinheit gespeichert.', false);
    };

    const loadMethods = (cmid) => {
        return asCall('mod_seminarplaner_get_method_cards', {cmid}).then((res) => {
            let parsed = [];
            try {
                parsed = res.methodsjson ? JSON.parse(res.methodsjson) : [];
            } catch (e) {
                parsed = [];
            }
            methods = Array.isArray(parsed) ? parsed : [];
            methods = methods.map((method) => {
                const normalized = Object.assign({}, method);
                const rawalternatives = method.alternativen;
                normalized.alternativen = Array.isArray(rawalternatives)
                    ? rawalternatives
                    : (typeof rawalternatives === 'string' ? rawalternatives.split(/##|[\r\n,;]+/u) : []);
                delete normalized.materialiendraftitemid;
                delete normalized.h5pdraftitemid;
                return normalized;
            });
            normalizeMethodAlternatives();
            renderList();
            setStatus(`Seminareinheiten geladen (${methods.length}).`, false);
        });
    };

    const bindFilters = () => {
        const search = bySel('#ml-filter-search');
        const reset = bySel('#ml-filter-reset');
        const origin = bySel('#ml-filter-origin');

        if (search) {
            search.addEventListener('input', applyFilters);
        }
        if (origin) {
            origin.addEventListener('change', () => {
                populateTagOptions();
                applyFilters();
            });
        }
        Object.keys(FILTER_DROPDOWNS).forEach((key) => bindFilterDropdown(key));

        if (reset) {
            reset.addEventListener('click', () => {
                if (search) {
                    search.value = '';
                }
                if (origin) {
                    origin.value = '';
                }
                Object.keys(FILTER_DROPDOWNS).forEach((key) => clearFilterSelections(key));
                populateTagOptions();
                applyFilters();
            });
        }
    };

    const applyRequestedEditFromUrl = () => {
        if (typeof window === 'undefined' || !window.location) {
            return;
        }
        const params = new URLSearchParams(window.location.search || '');
        const requested = String(params.get('editmethodid') || '').trim();
        if (!requested) {
            // D50: Link-Einstieg "Neue Seminareinheit anlegen" (create=1).
            if (String(params.get('create') || '') === '1') {
                openCreateEditor();
            }
            return;
        }
        const exists = methods.some((m) => String(m.id) === requested);
        if (!exists) {
            setStatus('Seminareinheit aus Link wurde nicht gefunden.', true);
            return;
        }
        openEditor(requested);
        if (typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(() => openEditor(requested));
        }
        if (document.readyState !== 'complete') {
            window.addEventListener('load', () => openEditor(requested), {once: true});
        }
        window.addEventListener('pageshow', () => openEditor(requested), {once: true});
        window.setTimeout(() => {
            if (String(currentEditId) === requested) {
                openEditor(requested);
            }
        }, 250);
        const section = bySel('#ml-edit-section');
        if (section) {
            section.scrollIntoView({behavior: 'smooth', block: 'start'});
        }
    };

    // ---- D29/D33: Globale Bibliothek (immer durchsuchbar, ohne Vor-Import) ----
    // Facetten entstehen dynamisch aus dem freien Tags-Feld (D29); die
    // endgueltige Facetten-Struktur folgt erst mit weiteren realen Bestaenden.
    let globalMethods = [];
    const globalFilter = {query: '', tags: new Set()};
    const GLOBAL_FACET_LIMIT = 24;

    const setGlobalStatus = (text, iserror) => {
        const el = bySel('#gl-status');
        if (el) {
            el.textContent = text || '';
            el.classList.toggle('kg-status-error', !!iserror);
        }
    };

    // D55: Statuszeile des "Globale Seminarkonzepte"-Tabs.
    const setKonzepteStatus = (text, iserror) => {
        const el = bySel('#ml-konzepte-status');
        if (el) {
            el.textContent = text || '';
            el.classList.toggle('kg-status-error', !!iserror);
        }
    };

    const matchesGlobalFilter = (m) => {
        for (const tag of globalFilter.tags) {
            if (!m.tags.some((t) => t.toLowerCase() === tag)) {
                return false;
            }
        }
        const q = globalFilter.query.trim().toLowerCase();
        if (!q) {
            return true;
        }
        const haystack = [m.titel, m.kurzbeschreibung, m.setname, m.tags.join(' ')]
            .join(' ').toLowerCase();
        return q.split(/\s+/).every((part) => haystack.includes(part));
    };

    const renderGlobalFacets = () => {
        const host = bySel('#gl-facets');
        if (!host) {
            return;
        }
        const counts = new Map();
        const labels = new Map();
        globalMethods.forEach((m) => {
            m.tags.forEach((tag) => {
                const key = tag.toLowerCase();
                counts.set(key, (counts.get(key) || 0) + 1);
                if (!labels.has(key)) {
                    labels.set(key, tag);
                }
            });
        });
        const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de'));
        // Meistgenutzte Tags zeigen; aktive Tags bleiben immer sichtbar.
        const shown = sorted.filter(([key], index) => index < GLOBAL_FACET_LIMIT || globalFilter.tags.has(key));
        host.innerHTML = shown.map(([key, count]) => {
            const active = globalFilter.tags.has(key);
            return `<button type="button" class="gl-facet${active ? ' gl-facet--active' : ''}" data-gl-tag="${escapeHtml(key)}">
                ${escapeHtml(labels.get(key) || key)} <span class="gl-facet__count">${count}</span></button>`;
        }).join('');
    };

    const renderGlobalList = () => {
        const host = bySel('#gl-list');
        if (!host) {
            return;
        }
        const visible = globalMethods.filter(matchesGlobalFilter);
        if (!globalMethods.length) {
            host.innerHTML = '';
            return;
        }
        setGlobalStatus(`${visible.length} von ${globalMethods.length} Methoden`);
        host.innerHTML = visible.map((m) => {
            const tagChips = m.tags.map((tag) => `<span class="ml-card-tag">${escapeHtml(tag)}</span>`).join('');
            return `
              <div class="kg-library-card sp-card gl-card${phaseClassOf(m.seminarphase)}" data-gl-methodid="${m.methodid}">
                <div class="ml-card-head">
                  <div class="sp-card-title ml-card-title"><strong>${escapeHtml(m.titel)}</strong></div>
                </div>
                <div class="sp-card-compact">
                  <div class="sp-card-meta">
                    ${renderCardBadges(m)}
                    ${m.vorbereitung ? `<span class="sp-badge">Vorbereitung: ${escapeHtml(m.vorbereitung)}</span>` : ''}
                  </div>
                  ${tagChips ? `<div class="ml-card-tags">${tagChips}</div>` : ''}
                  ${m.kurzbeschreibung ? `<div class="sp-card-description">${escapeHtml(m.kurzbeschreibung)}</div>` : ''}
                </div>
                <div class="ml-card-footer">
                  <span class="gl-card__source">Aus „${escapeHtml(m.setname)}"</span>
                  <button type="button" class="kg-btn kg-btn-primary gl-card__adopt" data-gl-adopt="${m.methodid}">
                    Übernehmen</button>
                </div>
              </div>`;
        }).join('');
        if (!visible.length) {
            host.innerHTML = '<div class="sp-filter-status">Keine Methode passt zu Suche und Tags – '
                + 'setz einen Filter zurück oder such mit anderen Begriffen.</div>';
        }
    };

    const adoptGlobalMethod = (cmid, methodid, button) => {
        if (button) {
            button.disabled = true;
            button.textContent = 'Übernehme …';
        }
        asCall('mod_seminarplaner_adopt_global_method', {cmid, methodid}).then((result) => {
            setGlobalStatus(`„${result.titel}" ist jetzt als eigene Kopie in deinem Bestand.`);
            if (button) {
                button.textContent = '✓ Übernommen';
            }
            // Den lokalen Bestand oben direkt auffrischen, damit die Kopie sichtbar ist.
            return loadMethods(cmid).then(() => renderList());
        }).catch((e) => {
            Notification.exception(e);
            setGlobalStatus('Übernehmen fehlgeschlagen.', true);
            if (button) {
                button.disabled = false;
                button.textContent = 'Übernehmen';
            }
        });
    };

    // --- Bereichsübergreifende Suche -------------------------------------
    // Die Suche in der Filterleiste bleibt auf den aktiven Tab beschränkt.
    // Diese hier sucht in allen drei Bereichen gleichzeitig und zeigt die
    // Treffer in einer gemeinsamen Liste, jeder mit seinem Herkunfts-Badge.

    const ALLSEARCH_HIDDEN_WHILE_SEARCHING = [
        '.ml-subtabs', '#ml-filter-block', '#ml-list-block', '#ml-bulk-toolbar', '#ml-konzepte-block',
    ];

    // Kurzbeschreibungen enthalten Markup (<p>…</p>). In der Trefferzeile steht
    // nur eine Vorschauzeile, deshalb per stripHtml (oben) die Tags entfernen
    // statt sie zu escapen - sonst liest man "<p>Die TN ordnen sich…" im
    // Klartext.

    const allSearchHaystack = (m, extra) => [
        m.titel, m.kurzbeschreibung,
        Array.isArray(m.tags) ? m.tags.join(' ') : m.tags,
        joinMulti(m.seminarphase), m.gruppengroesse, m.zeitbedarf, extra || ''
    ].join(' ').toLowerCase();

    const collectAllSearchHits = (needle) => {
        const hits = [];
        methods.forEach((m) => {
            if (allSearchHaystack(m).includes(needle)) {
                hits.push({
                    kind: isKonzeptCard(m) ? 'konzept' : 'lokal',
                    badge: isKonzeptCard(m) ? konzeptNameFor(konzeptSetIdOf(m)) : 'Lokale Seminareinheit',
                    id: String(m.id),
                    titel: String(m.titel || ''),
                    kurz: stripHtml(m.kurzbeschreibung),
                });
            }
        });
        globalMethods.forEach((g) => {
            if (allSearchHaystack(g, g.setname).includes(needle)) {
                hits.push({
                    kind: 'sammlung',
                    badge: g.setname ? `Methodensammlung: ${g.setname}` : 'Methodensammlung',
                    id: String(g.methodid),
                    titel: String(g.titel || ''),
                    kurz: stripHtml(g.kurzbeschreibung),
                });
            }
        });

        return hits;
    };

    const renderAllSearch = () => {
        const input = bySel('#ml-allsearch');
        const block = bySel('#ml-allsearch-block');
        const host = bySel('#ml-allsearch-list');
        if (!input || !block || !host) {
            return;
        }
        const needle = normalize(input.value);
        const searching = needle.length > 0;

        block.classList.toggle('kg-hidden', !searching);
        ALLSEARCH_HIDDEN_WHILE_SEARCHING.forEach((sel) => {
            const node = bySel(sel);
            if (node) {
                node.classList.toggle('kg-hidden', searching);
            }
        });
        if (!searching) {
            host.innerHTML = '';
            return;
        }

        const hits = collectAllSearchHits(needle);
        const status = bySel('#ml-allsearch-status');
        if (status) {
            status.textContent = hits.length
                ? `${hits.length} ${hits.length === 1 ? 'Treffer' : 'Treffer'} in allen Bereichen.`
                : 'Keine Seminareinheit gefunden.';
        }
        host.innerHTML = hits.map((hit) => {
            // Methodensammlungen sind noch nicht im eigenen Bestand - sie
            // werden übernommen, nicht bearbeitet.
            const action = hit.kind === 'sammlung'
                ? `<button type="button" class="kg-btn" data-allsearch-adopt="${escapeHtml(hit.id)}">Übernehmen</button>`
                : `<button type="button" class="kg-btn" data-allsearch-edit="${escapeHtml(hit.id)}">Bearbeiten</button>`;
            return `<div class="ml-allsearch-row">
                <div class="ml-allsearch-row__main">
                  <div class="ml-allsearch-row__title">${escapeHtml(hit.titel)}</div>
                  ${hit.kurz ? `<div class="ml-allsearch-row__sub">${escapeHtml(hit.kurz)}</div>` : ''}
                  <span class="ml-allsearch-row__badge ml-allsearch-row__badge--${hit.kind}">${escapeHtml(hit.badge)}</span>
                </div>
                ${action}
              </div>`;
        }).join('');
    };

    const bindAllSearch = (cmid) => {
        const input = bySel('#ml-allsearch');
        const host = bySel('#ml-allsearch-list');
        if (input) {
            input.addEventListener('input', () => renderAllSearch());
        }
        if (host) {
            host.addEventListener('click', (event) => {
                const edit = event.target.closest('[data-allsearch-edit]');
                if (edit) {
                    openEditor(edit.getAttribute('data-allsearch-edit'));
                    return;
                }
                const adopt = event.target.closest('[data-allsearch-adopt]');
                if (adopt) {
                    adoptGlobalMethod(cmid, Number.parseInt(adopt.getAttribute('data-allsearch-adopt'), 10), adopt);
                }
            });
        }
    };

    const initGlobalLibrary = (cmid) => {
        const section = bySel('#gl-section');
        if (!section) {
            return;
        }
        const search = bySel('#gl-search');
        if (search) {
            search.addEventListener('input', () => {
                globalFilter.query = search.value || '';
                renderGlobalList();
            });
        }
        const facets = bySel('#gl-facets');
        if (facets) {
            facets.addEventListener('click', (event) => {
                const chip = event.target.closest('[data-gl-tag]');
                if (!chip) {
                    return;
                }
                const tag = chip.getAttribute('data-gl-tag');
                if (globalFilter.tags.has(tag)) {
                    globalFilter.tags.delete(tag);
                } else {
                    globalFilter.tags.add(tag);
                }
                renderGlobalFacets();
                renderGlobalList();
            });
        }
        const list = bySel('#gl-list');
        if (list) {
            list.addEventListener('click', (event) => {
                const adopt = event.target.closest('[data-gl-adopt]');
                if (adopt) {
                    adoptGlobalMethod(cmid, Number.parseInt(adopt.getAttribute('data-gl-adopt'), 10), adopt);
                }
            });
        }

        setGlobalStatus('Globale Bibliothek wird geladen …');
        asCall('mod_seminarplaner_browse_global_library', {cmid}).then((result) => {
            if (!result.available) {
                section.classList.add('kg-hidden');
                return;
            }
            if (result.message) {
                setGlobalStatus(result.message);
                return;
            }
            globalMethods = (result.methods || []).map((m) => ({
                methodid: Number(m.methodid),
                setid: Number(m.setid),
                setname: String(m.setname || ''),
                titel: String(m.titel || ''),
                seminarphase: Array.isArray(m.seminarphase) ? m.seminarphase.map(String) : [],
                zeitbedarf: String(m.zeitbedarf || ''),
                gruppengroesse: String(m.gruppengroesse || ''),
                sozialform: Array.isArray(m.sozialform) ? m.sozialform.map(String) : [],
                vorbereitung: String(m.vorbereitung || ''),
                kurzbeschreibung: String(m.kurzbeschreibung || ''),
                tags: Array.isArray(m.tags) ? m.tags.map(String) : [],
            }));
            if (!globalMethods.length) {
                setGlobalStatus('Noch keine veröffentlichten Methoden-Sammlungen vorhanden.');
                return;
            }
            renderGlobalFacets();
            renderGlobalList();
        }).catch((e) => {
            Notification.exception(e);
            setGlobalStatus('Die globale Bibliothek konnte nicht geladen werden.', true);
        });
    };

    // D55: Bibliothek-Untertabs (lokale Einheiten / Methodensammlungen /
    // globale Seminarkonzepte). Der Konzept-Tab lädt seine Liste erst beim
    // ersten Öffnen (lazy).
    let konzepteLoaded = false;

    const renderKonzepteList = (konzepte) => {
        const host = bySel('#ml-konzepte-list');
        if (!host) {
            return;
        }
        if (!konzepte.length) {
            host.innerHTML = '';
            // War das letzte Konzept, verschwindet der Tab wieder - er wird
            // serverseitig nur bei vorhandenen Konzepten ausgegeben, nach einem
            // Entfernen ohne Reload steht er aber noch da und zeigte ins Leere.
            const tabbtn = bySel('.ml-subtab[data-ml-tab="concepts"]');
            if (tabbtn) {
                tabbtn.classList.add('kg-hidden');
                if (libraryScope === 'concepts') {
                    activateSubtab('local', runtimeCmid);
                }
            }
            setKonzepteStatus('Noch keine globalen Seminarkonzepte importiert. '
                + 'Konzepte holst du über den Tab „Import/Export".');
            return;
        }
        setKonzepteStatus('');
        host.innerHTML = konzepte.map((k) => {
            // timeimported kommt als Unix-Sekunden vom Server, der Formatierer
            // rechnet in Millisekunden - ohne die Umrechnung landet jeder
            // Import im Januar 1970.
            const meta = `${k.unitcount} ${k.unitcount === 1 ? 'Seminareinheit' : 'Seminareinheiten'}`
                + ` · übernommen ${escapeHtml(formatRelativeModified(k.timeimported * 1000))}`;
            // Drei Zustände, nicht zwei: ein Konzept kann einen Plan haben, es
            // kann einen gehabt haben (dann ist er gelöscht), oder es hat nie
            // einen mitgebracht - dann fehlt hier schlicht nichts.
            let action = '';
            if (k.planexists) {
                action = `<a class="kg-btn" href="${escapeHtml(sequenzUrlFor(k.gridid))}">Plan öffnen</a>`;
            } else if (k.hadplan) {
                action = `<span class="ml-konzept-card__gone">Zugehöriger Seminarplan wurde gelöscht.</span>`;
            } else {
                action = `<span class="ml-konzept-card__gone">Dieses Konzept enthält keinen Seminarplan.</span>`;
            }
            // Ohne Plan ist der Titel bereits der Konzeptname - dann waere
            // "aus X" unter einer Ueberschrift X nur eine Dopplung.
            const title = k.planname || k.setname || 'Seminarkonzept';
            const source = (k.setname && k.setname !== title)
                ? `<span class="ml-konzept-card__source">aus &bdquo;${escapeHtml(k.setname)}&ldquo;</span>`
                : '';
            return `<div class="ml-konzept-card">
                <div class="ml-konzept-card__head">
                  <strong class="ml-konzept-card__title">${escapeHtml(title)}</strong>
                  ${source}
                </div>
                <div class="ml-konzept-card__meta">${meta}</div>
                <div class="ml-konzept-card__actions">
                  ${action}
                  <button type="button" class="kg-btn" data-konzept-delete="${Number(k.setid)}">Konzept entfernen</button>
                </div>
                <div class="ml-konzept-card__warn kg-hidden" data-konzept-warn="${Number(k.setid)}" role="alert"></div>
              </div>`;
        }).join('');
    };

    const sequenzUrlFor = (gridid) => {
        try {
            const url = new URL('sequenz.php', window.location.href);
            url.searchParams.set('id', String(runtimeCmid));
            url.searchParams.set('grid', String(gridid));
            return url.toString();
        } catch (e) {
            return `sequenz.php?id=${runtimeCmid}&grid=${gridid}`;
        }
    };

    // Ein Konzept laesst sich nur entfernen, solange keine seiner Einheiten in
    // einem Plan liegt - sonst zeigte der Plan auf Einheiten, die es nicht mehr
    // gibt. Der Server nennt die konkreten Stellen; sie stehen an der Karte,
    // nicht in einem Dialog, damit man sie beim Aufraeumen ablesen kann.
    const renderKonzeptBlocked = (setid, usages) => {
        const warn = bySel(`[data-konzept-warn="${setid}"]`);
        if (!warn) {
            return;
        }
        const places = usages.map((u) => {
            const tag = u.tagbezeichnung
                ? `Tag ${u.tag} (${escapeHtml(u.tagbezeichnung)})`
                : `Tag ${u.tag}`;
            return `<li>&bdquo;${escapeHtml(u.einheit)}&ldquo; – Sequenz &bdquo;${escapeHtml(u.planname)}&ldquo;, ${tag}</li>`;
        }).join('');
        warn.innerHTML = `<strong>Dieses Seminarkonzept kann nicht entfernt werden</strong>, solange seine `
            + `Seminareinheiten in einem Seminarplan verwendet werden:<ul>${places}</ul>`
            + `Nimm die Einheiten dort zuerst aus dem Plan.`;
        warn.classList.remove('kg-hidden');
    };

    const deleteImportedKonzept = (cmid, setid, button) => {
        const warn = bySel(`[data-konzept-warn="${setid}"]`);
        if (warn) {
            warn.classList.add('kg-hidden');
            warn.innerHTML = '';
        }
        button.disabled = true;
        asCall('mod_seminarplaner_delete_imported_konzept', {cmid, setid}).then((res) => {
            if (!res.deleted) {
                renderKonzeptBlocked(setid, Array.isArray(res.usages) ? res.usages : []);
                button.disabled = false;

                return null;
            }
            setKonzepteStatus(`Seminarkonzept entfernt, ${res.removedcount} `
                + `${res.removedcount === 1 ? 'Seminareinheit' : 'Seminareinheiten'} aus dem Bestand genommen.`);

            // Bestand und Liste neu holen: die Einheiten sind weg.
            return loadMethods(cmid).then(() => {
                updateOriginFilterVisibility();
                applyFilters();

                return loadImportedKonzepte(cmid);
            });
        }).catch((e) => {
            Notification.exception(e);
            button.disabled = false;
            setKonzepteStatus('Das Seminarkonzept konnte nicht entfernt werden.', true);
        });
    };

    const loadImportedKonzepte = (cmid) => {
        setKonzepteStatus('Seminarkonzepte werden geladen …');
        return asCall('mod_seminarplaner_list_imported_konzepte', {cmid}).then((res) => {
            renderKonzepteList(Array.isArray(res && res.konzepte) ? res.konzepte : []);
        }).catch((e) => {
            Notification.exception(e);
            setKonzepteStatus('Die importierten Seminarkonzepte konnten nicht geladen werden.', true);
        });
    };

    const activateSubtab = (name, cmid) => {
        const tabs = document.querySelectorAll('.ml-subtab');
        tabs.forEach((btn) => {
            const active = btn.getAttribute('data-ml-tab') === name;
            btn.classList.toggle('ml-subtab--active', active);
            btn.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        [['local', '#ml-tab-local'], ['collections', '#ml-tab-collections'], ['concepts', '#ml-tab-concepts']]
            .forEach(([key, sel]) => {
                const panel = bySel(sel);
                if (panel) {
                    panel.classList.toggle('kg-hidden', key !== name);
                }
            });

        // Filterleiste, Liste und Editor gibt es nur einmal - sie wandern in
        // den aktiven Tab. Bei "collections" bleiben sie stehen, wo sie sind:
        // das Panel dort bringt seine eigene Oberfläche mit und der Block ist
        // mit seinem Panel ohnehin ausgeblendet.
        const browse = bySel('#ml-browse');
        if (browse && (name === 'local' || name === 'concepts')) {
            const panel = bySel(name === 'concepts' ? '#ml-tab-concepts' : '#ml-tab-local');
            if (panel && browse.parentElement !== panel) {
                panel.appendChild(browse);
            }
            libraryScope = name;
            // Eine hier angelegte Einheit gehörte zu keinem Konzept - der
            // Anlegen-Button bleibt deshalb dem lokalen Tab vorbehalten. Die
            // Suche daneben gilt für alle Bereiche und bleibt stehen.
            const createbtn = bySel('#ml-create-open');
            if (createbtn) {
                createbtn.classList.toggle('kg-hidden', name === 'concepts');
            }
            // Der Herkunftsfilter zählt nur im Konzept-Tab; beim Verlassen
            // zurücksetzen, sonst filtert er unsichtbar weiter.
            const origin = bySel('#ml-filter-origin');
            if (origin && name !== 'concepts') {
                origin.value = '';
            }
            renderList();
            updateOriginFilterVisibility();
            applyFilters();
        }

        if (name === 'concepts' && !konzepteLoaded) {
            konzepteLoaded = true;
            loadImportedKonzepte(cmid);
        }
    };

    const bindSubtabs = (cmid) => {
        document.querySelectorAll('.ml-subtab').forEach((btn) => {
            btn.addEventListener('click', () => {
                activateSubtab(btn.getAttribute('data-ml-tab') || 'local', cmid);
            });
        });
        // Die Konzept-Karten werden neu gerendert, deshalb delegiert am Host.
        const konzepte = bySel('#ml-konzepte-list');
        if (konzepte) {
            konzepte.addEventListener('click', (event) => {
                const del = event.target.closest('[data-konzept-delete]');
                if (del) {
                    deleteImportedKonzept(cmid, Number.parseInt(del.getAttribute('data-konzept-delete'), 10), del);
                }
            });
        }
    };

    return {
        init: function(cmid) {
            runtimeCmid = cmid;
            disableEditFieldAutocomplete();
            bindFilters();
            bindFormMultiDropdowns();
            bindBulkSelectionUI(cmid);
            refreshEditAlternativeOptions('');
            initGlobalLibrary(cmid);
            bindAllSearch(cmid);
            bindSubtabs(cmid);

            const addbtn = bySel('#kg-add-method');
            if (addbtn) {
                addbtn.addEventListener('click', () => {
                    addMethod(cmid).catch((e) => {
                        Notification.exception(e);
                        setStatus('Speichern fehlgeschlagen.', true);
                    });
                });
            }
            const clearbtn = bySel('#kg-clear-form');
            if (clearbtn) {
                clearbtn.addEventListener('click', clearAddForm);
            }
            const saveallbtn = bySel('#kg-save-methods');
            if (saveallbtn) {
                saveallbtn.addEventListener('click', () => {
                    persist(cmid).then(() => {
                        setStatus('Seminareinheiten gespeichert.', false);
                    }).catch((e) => {
                        Notification.exception(e);
                        setStatus('Speichern fehlgeschlagen.', true);
                    });
                });
            }

            const savebtn = bySel('#ml-save');
            if (savebtn) {
                savebtn.addEventListener('click', () => {
                    saveEditor(cmid).catch((e) => {
                        Notification.exception(e);
                        setStatus('Speichern fehlgeschlagen.', true);
                    });
                });
            }
            // D62: geführter Lernziel-Editor am Lernziele-Feld des Editors –
            // Satz anhängen und die abgeleitete Seminarphase vorbelegen.
            const lzopen = bySel('#ml-lz-open-lernziele');
            if (lzopen) {
                lzopen.addEventListener('click', () => {
                    LernzielEditor.open((sentence, phase) => {
                        const current = getFieldValue('#ml-e-lernziele');
                        const addition = `<p>${escapeHtml(sentence)}</p>`;
                        setFieldValue('#ml-e-lernziele', current ? current + addition : addition);
                        suggestEditorPhase(phase);
                    });
                });
            }
            const cancelbtn = bySel('#ml-cancel');
            if (cancelbtn) {
                cancelbtn.addEventListener('click', () => {
                    currentEditId = '';
                    creatingNew = false;
                    setEditHeading('Seminareinheit bearbeiten');
                    resetEditForm();
                    bySel('#ml-edit-section')?.classList.add('kg-hidden');
                    if (typeof window !== 'undefined' && window.history && window.location) {
                        const url = new URL(window.location.href);
                        url.searchParams.delete('create');
                        window.history.replaceState({}, '', url.toString());
                    }
                    suppressLeavePrompt();
                });
            }

            // D50: Anlegen-Button in der Bibliothek. Der vorbereitete
            // Datei-Entwurfsbereich gehört entweder einer über „Bearbeiten"
            // geöffneten Einheit (editmethodid) oder ist schon verbraucht
            // (materialDraftNeedsReset) – in beiden Fällen sauber neu laden,
            // damit ein leerer Entwurfsbereich entsteht. Die URL allein reicht
            // dafür nicht: saveEditor räumt editmethodid nach dem Speichern weg.
            const createbtn = bySel('#ml-create-open');
            if (createbtn) {
                createbtn.addEventListener('click', () => {
                    const params = new URLSearchParams(window.location.search || '');
                    if (params.get('editmethodid') || materialDraftNeedsReset()) {
                        suppressLeavePrompt();
                        const url = new URL(window.location.href);
                        url.searchParams.delete('editmethodid');
                        url.searchParams.delete('editmaterialitemid');
                        url.searchParams.delete('_mlts');
                        url.searchParams.set('create', '1');
                        window.location.assign(url.toString());
                        return;
                    }
                    openCreateEditor();
                });
            }

            Promise.all([loadMethods(cmid), loadMethodsetSyncStatus(cmid)]).then(() => {
                renderList();
                applyRequestedEditFromUrl();
            }).catch((e) => {
                Notification.exception(e);
                setStatus('Laden fehlgeschlagen.', true);
            });
        }
    };
});
