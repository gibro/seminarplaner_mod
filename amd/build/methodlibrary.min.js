define(['core/ajax', 'core/notification'], function(Ajax, Notification) {
    const bySel = (sel) => document.querySelector(sel);
    const asCall = (methodname, args) => Ajax.call([{methodname, args}])[0];
    const uid = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const escapeHtml = (str) => String(str || '').replace(/[&<>"']/g, (ch) => (
        {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch] || ch
    ));
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
        komplexitaet: '#kg-f-komplexitaet',
        vorbereitung: '#kg-f-vorbereitung',
        raum: '#kg-f-raum',
        sozialform: '#kg-f-sozialform',
        risiken: '#kg-f-risiken',
        debrief: '#kg-f-debrief',
        materialien: '#id_kg_materialiendraftitemid',
        materialtechnik: '#kg-f-materialtechnik',
        ablauf: '#kg-f-ablauf',
        tags: '#kg-f-tags',
        kognitive: '#kg-f-kognitive',
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
        cognitive: {
            root: '#ml-filter-cognitive-dropdown',
            toggle: '#ml-filter-cognitive-toggle',
            panel: '#ml-filter-cognitive-panel',
            all: '#ml-filter-cognitive-all',
            options: '#ml-filter-cognitive-options',
            labelAll: 'Alle Dimensionen',
            labelSome: 'Dimensionen'
        }
    };

    const EDIT_FIELD_SELECTORS = [
        '#ml-e-titel',
        '#ml-e-lernziele',
        '#ml-e-seminarphase',
        '#ml-e-tags',
        '#ml-e-zeitbedarf',
        '#ml-e-gruppengroesse',
        '#ml-e-kognitive',
        '#ml-e-kurzbeschreibung',
        '#ml-e-ablauf',
        '#ml-e-komplexitaet',
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
    let runtimeCmid = 0;
    let autosyncSetIds = new Set();
    let draggedMethodId = '';

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
            row.innerHTML = `<input type="checkbox" value="${escapeHtml(methodid)}" data-kg-form-multi-option="1"><span>${escapeHtml(title)}</span>`;
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
            komplexitaet: (bySel(FIELDS.komplexitaet)?.value || '').trim(),
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
            kognitive: readMulti(FIELDS.kognitive),
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
        const tags = new Set();
        methods.forEach((m) => {
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

    const loadAutosyncSetIds = (cmid) => {
        return asCall('mod_seminarplaner_get_methodset_sync_status', {cmid}).then((res) => {
            const links = Array.isArray(res && res.links) ? res.links : [];
            autosyncSetIds = new Set(
                links
                    .filter((link) => !!link && !!link.autosyncenabled)
                    .map((link) => Number(link.methodsetid) || 0)
                    .filter((id) => id > 0)
            );
        }).catch(() => {
            autosyncSetIds = new Set();
        });
    };

    const getSyncMethodsetId = (method) => {
        if (!method || !method._kgsync || typeof method._kgsync !== 'object') {
            return 0;
        }
        return Number(method._kgsync.setid || 0) || 0;
    };

    const shouldShowFreezeLock = (method) => {
        const setid = getSyncMethodsetId(method);
        return setid > 0 && autosyncSetIds.has(setid);
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
        const cognitive = getSelectedFilterValues('cognitive').map((v) => normalize(v.split(/[:\-–]/)[0]));

        const host = bySel('#ml-method-list');
        if (!host) {
            return;
        }

        const cards = Array.from(host.querySelectorAll('.kg-library-card'));
        let visible = 0;
        cards.forEach((card) => {
            const id = card.getAttribute('data-id');
            const method = methods.find((m) => String(m.id) === String(id));
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
            const methodcog = splitMulti(method.kognitive).map((t) => normalize(t.split(/[:\-–]/)[0]));

            const match = (!query || hay.includes(query))
                && (!tags.length || methodtags.some((t) => tags.includes(t)))
                && (!phases.length || methodphase.some((p) => phases.includes(p)))
                && (!groups.length || groups.includes(methodgroup))
                && (!durations.length || durations.includes(methodduration))
                && (!cognitive.length || methodcog.some((c) => cognitive.includes(c)));

            card.style.display = match ? '' : 'none';
            if (match) {
                visible++;
            }
        });

        const status = bySel('#ml-filter-status');
        if (status) {
            status.textContent = `${visible} von ${methods.length} Seminareinheiten angezeigt.`;
        }
    };

    const renderList = () => {
        const host = bySel('#ml-method-list');
        if (!host) {
            return;
        }
        host.innerHTML = '';

        methods.forEach((m, index) => {
            if (!m.id) {
                m.id = `legacy-${index}-${uid()}`;
            }
            const card = document.createElement('div');
            const cognitiveLevel = cognitiveLevelOf(m);
            card.className = 'kg-library-card sp-card' + (cognitiveLevel ? ` sp-level-${cognitiveLevel}` : '');
            card.setAttribute('data-id', String(m.id));
            card.draggable = true;
            const showlock = shouldShowFreezeLock(m);
            const frozen = showlock ? isFrozenState(m._kgsync, true) : false;
            const freezeaction = showlock
                ? `<button type="button" class="ml-card-menu-btn" data-act="freeze" title="Nur sichtbar bei aktivem Auto-Update für dieses Konzept.">${frozen ? '🔒 Fixierung lösen' : '🔓 Lokal fixieren'}</button>`
                : '';
            const phaseLabel = Array.isArray(m.seminarphase) ? m.seminarphase.filter(Boolean).join(', ') : String(m.seminarphase || '').trim();
            const tagChips = splitMulti(m.tags)
                .map((tag) => `<span class="ml-card-tag">${escapeHtml(tag)}</span>`)
                .join('');
            card.innerHTML = `
              <div class="ml-card-head">
                <span class="ml-card-drag-handle" title="Reihenfolge per Drag-and-drop ändern" aria-hidden="true">
                  <span class="ml-card-drag-handle__arrow ml-card-drag-handle__arrow--up">↑</span>
                  <span class="ml-card-drag-handle__arrow ml-card-drag-handle__arrow--right">→</span>
                  <span class="ml-card-drag-handle__arrow ml-card-drag-handle__arrow--down">↓</span>
                  <span class="ml-card-drag-handle__arrow ml-card-drag-handle__arrow--left">←</span>
                </span>
                <div class="sp-card-title ml-card-title"><strong>${escapeHtml(m.titel || '(ohne Titel)')}</strong></div>
                <div class="ml-card-head-actions">
                  <details class="ml-card-menu">
                    <summary class="ml-card-menu-toggle" aria-label="Aktionen">⋮</summary>
                    <div class="ml-card-menu-panel">
                      <button type="button" class="ml-card-menu-btn" data-act="edit">Bearbeiten</button>
                      <button type="button" class="ml-card-menu-btn" data-act="overwrite-import">Aus Datei ersetzen…</button>
                      ${freezeaction}
                      <button type="button" class="ml-card-menu-btn ml-card-menu-btn-delete" data-act="delete">Löschen</button>
                    </div>
                  </details>
                </div>
              </div>
              <div class="sp-card-compact">
                <div class="sp-card-meta">
                  <span class="sp-badge">⏱️ ${escapeHtml(m.zeitbedarf || '-')}</span>
                  <span class="sp-badge">👥 ${escapeHtml(m.gruppengroesse || '-')}</span>
                  ${phaseLabel ? `<span class="sp-badge sp-badge--phase">🚩 ${escapeHtml(phaseLabel)}</span>` : ''}
                </div>
                ${tagChips ? `<div class="ml-card-tags">${tagChips}</div>` : ''}
                <div class="sp-card-description">${sanitizeCardHtml(m.kurzbeschreibung || '')}</div>
              </div>
              <div class="ml-card-footer">
                <span class="ml-card-modified">Letzte Änderung: ${escapeHtml(formatRelativeModified(m.timemodified))}</span>
                <button type="button" class="ml-card-details" data-act="details">Details <span class="ml-card-details__chevron" aria-hidden="true">›</span></button>
              </div>
            `;

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

        populateTagOptions();
        applyFilters();
        if (currentEditId) {
            refreshEditAlternativeOptions(currentEditId);
        }
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

    const openEditor = (id) => {
        const method = methods.find((m) => String(m.id) === String(id));
        if (!method) {
            setStatus('Seminareinheit konnte nicht zum Bearbeiten geöffnet werden.', true);
            return;
        }
        currentEditId = String(id);
        const editsection = bySel('#ml-edit-section');
        if (editsection) {
            editsection.classList.remove('kg-hidden');
        }
        const materialssection = bySel('#ml-section-materials');
        if (materialssection && typeof materialssection.setAttribute === 'function') {
            materialssection.setAttribute('open', 'open');
        }

        setFieldValue('#ml-edit-id', method.id);
        setFieldValue('#ml-e-titel', method.titel);
        setFieldValue('#ml-e-zeitbedarf', method.zeitbedarf);
        setFieldValue('#ml-e-gruppengroesse', method.gruppengroesse);
        setFieldValue('#ml-e-kurzbeschreibung', method.kurzbeschreibung);
        setFieldValue('#ml-e-komplexitaet', method.komplexitaet);
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
                setStatus('Dateien konnten nicht zum Bearbeiten vorbereitet werden. Bitte Seminareinheit erneut über "Bearbeiten" öffnen.', true);
            }
        }
        if (materialcurrent) {
            const names = attachmentNames(method.materialien);
            materialcurrent.textContent = names.length ? `Aktuell: ${names.join(', ')}` : '';
        }

        setSelectMulti('#ml-e-seminarphase', method.seminarphase);
        setSelectMulti('#ml-e-kognitive', method.kognitive);
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

    const saveEditor = async (cmid) => {
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
            komplexitaet: (bySel('#ml-e-komplexitaet') ? bySel('#ml-e-komplexitaet').value : '').trim(),
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
            kognitive: getSelectMulti('#ml-e-kognitive'),
            alternativen: getSelectMulti('#ml-e-alternativen')
        });
        methods[idx].alternativen = (methods[idx].alternativen || []).filter((id) => String(id) !== String(methods[idx].id));
        touchMethod(methods[idx]);
        reconcileAlternativesForMethod(methods[idx].id, methods[idx].alternativen);
        normalizeMethodAlternatives();

        await persist(cmid);
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

        if (search) {
            search.addEventListener('input', applyFilters);
        }
        Object.keys(FILTER_DROPDOWNS).forEach((key) => bindFilterDropdown(key));

        if (reset) {
            reset.addEventListener('click', () => {
                if (search) {
                    search.value = '';
                }
                Object.keys(FILTER_DROPDOWNS).forEach((key) => clearFilterSelections(key));
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

    return {
        init: function(cmid) {
            runtimeCmid = cmid;
            disableEditFieldAutocomplete();
            bindFilters();
            bindFormMultiDropdowns();
            refreshEditAlternativeOptions('');

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
            const cancelbtn = bySel('#ml-cancel');
            if (cancelbtn) {
                cancelbtn.addEventListener('click', () => {
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
                    suppressLeavePrompt();
                });
            }

            Promise.all([loadMethods(cmid), loadAutosyncSetIds(cmid)]).then(() => {
                renderList();
                applyRequestedEditFromUrl();
            }).catch((e) => {
                Notification.exception(e);
                setStatus('Laden fehlgeschlagen.', true);
            });
        }
    };
});
