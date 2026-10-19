define(['core/ajax', 'core/notification', 'mod_seminarplaner/handout', 'mod_seminarplaner/planmemory'],
function(Ajax, Notification, Handout, PlanMemory) {
    const bySel = (sel) => document.querySelector(sel);
    const asCall = (methodname, args) => Ajax.call([{methodname, args}])[0];
    const uid = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const escapeHtml = (str) => String(str || '').replace(/[&<>"']/g,
        (ch) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch] || ch));

    let methods = [];
    let previewRows = [];
    let previewUnits = [];
    let previewGrids = [];
    let grids = [];
    let currentGridState = null;
    let planningUnitsById = {};
    let planningState = {};
    let planningVersionHash = '';
    let currentImportPayload = null;
    let globalMethodsets = [];
    let globalSyncLinks = [];
    // D52: dauerhaftes Logo für den Seitenkopf aller PDF-Exporte.
    let pdfLogo = null;
    // Rohform (dataurl/position) wie aus PHP — das Handout-Modul bereitet sie selbst auf.
    let pdfLogoRaw = null;
    // D63: pro Aktivität gespeicherte Spaltenauswahl/-reihenfolge des ZIM-Exports.
    let pdfColumnsSetting = null;
    // Exporte mit eigener Hoch/Quer-Wahl neben dem ZIM-Papier.
    const PDF_ORIENTATION_EXPORTS = ['flow', 'materials', 'handout'];
    let pdfColumnsSaveTimer = null;
    // D84: Referent*innen der Aktivität als Nutzer-Id -> {id, fullname, avatarurl}.
    const referentenById = new Map();
    const PDF_COLUMN_ORDER = [
        'uhrzeit', 'titel', 'referent', 'seminarphase', 'kurzbeschreibung', 'debrief',
        'ablauf', 'lernziele', 'risiken', 'materialtechnik', 'sonstiges'
    ];
    const PDF_COLUMN_LABELS = {
        uhrzeit: 'Uhrzeit',
        titel: 'Titel',
        referent: 'Referent*in',
        seminarphase: 'Seminarphase',
        kurzbeschreibung: 'Kurzbeschreibung',
        debrief: 'Debrief-/Reflexionsfragen',
        ablauf: 'Ablauf',
        lernziele: 'Lernziele',
        risiken: 'Risiken/Tipps',
        materialtechnik: 'Material/Technik',
        sonstiges: 'Sonstiges'
    };

    const setStatus = (text, isError) => {
        const el = bySel('#kg-ie-status');
        if (!el) {
            return;
        }
        el.textContent = text;
        el.style.color = isError ? '#b91c1c' : '#166534';
    };

    const setImportStatus = (text, isError) => {
        const el = bySel('#kg-ie-import-status');
        if (!el) {
            return;
        }
        el.textContent = text;
        el.style.color = isError ? '#b91c1c' : '#166534';
    };

    const setGlobalStatus = (text, isError) => {
        const el = bySel('#kg-global-set-status');
        if (!el) {
            return;
        }
        el.textContent = text;
        el.style.color = isError ? '#b91c1c' : '#166534';
    };

    const setGlobalSyncInfo = (text, isError) => {
        const el = bySel('#kg-global-set-syncinfo');
        if (!el) {
            return;
        }
        el.textContent = text;
        el.style.color = isError ? '#b91c1c' : '#166534';
    };

    const getComponentSelection = (prefix) => {
        const methodsel = bySel(`#kg-ie-${prefix}-methods`);
        const unitsel = bySel(`#kg-ie-${prefix}-units`);
        const gridsel = bySel(`#kg-ie-${prefix}-grids`);
        return {
            methods: !methodsel || !!methodsel.checked,
            units: !!unitsel && !!unitsel.checked,
            grids: !!gridsel && !!gridsel.checked
        };
    };

    const selectedComponentCount = (selection) => {
        return (selection.methods ? 1 : 0) + (selection.units ? 1 : 0) + (selection.grids ? 1 : 0);
    };

    let externalLibrariesPromise = null;

    const getVendorBaseUrl = () => {
        const root = window.M && window.M.cfg && window.M.cfg.wwwroot ? String(window.M.cfg.wwwroot) : '';
        return `${root.replace(/\/$/, '')}/mod/seminarplaner/thirdparty`;
    };

    const loadScriptWithoutAmd = (url) => new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.async = false;

        const previousDefine = window.define;
        const hadOwnDefine = Object.prototype.hasOwnProperty.call(window, 'define');
        try {
            // Force UMD bundles to register globals instead of anonymous AMD modules.
            window.define = undefined;
        } catch (e) {
            // Ignore and continue; some runtimes may protect globals.
        }

        const restoreDefine = () => {
            try {
                if (hadOwnDefine) {
                    window.define = previousDefine;
                } else {
                    delete window.define;
                }
            } catch (e) {
                // Best-effort restore only.
            }
        };

        script.onload = () => {
            restoreDefine();
            resolve();
        };
        script.onerror = () => {
            restoreDefine();
            reject(new Error(`Script konnte nicht geladen werden: ${url}`));
        };

        document.head.appendChild(script);
    });

    const ensureExternalLibraries = () => {
        if (externalLibrariesPromise) {
            return externalLibrariesPromise;
        }
        const base = getVendorBaseUrl();
        externalLibrariesPromise = Promise.resolve()
            .then(() => {
                if (window.JSZip) {
                    return null;
                }
                return loadScriptWithoutAmd(`${base}/jszip/jszip.min.js`);
            })
            .then(() => {
                if (window.jspdf && typeof window.jspdf.jsPDF === 'function') {
                    return null;
                }
                return loadScriptWithoutAmd(`${base}/jspdf/jspdf.umd.min.js`);
            })
            .then(() => {
                const jsPDF = window.jspdf && window.jspdf.jsPDF;
                const hasAutoTable = jsPDF && jsPDF.API && typeof jsPDF.API.autoTable === 'function';
                if (hasAutoTable) {
                    return null;
                }
                return loadScriptWithoutAmd(`${base}/jspdf-autotable/jspdf.plugin.autotable.min.js`);
            })
            .then(() => {
                if (!window.JSZip) {
                    throw new Error('JSZip konnte nicht initialisiert werden.');
                }
                if (!window.jspdf || typeof window.jspdf.jsPDF !== 'function') {
                    throw new Error('jsPDF konnte nicht initialisiert werden.');
                }
            });

        return externalLibrariesPromise;
    };


    const step = (n) => {
        ['1', '2'].forEach((v) => {
            const s = bySel(`#kg-step-${v}`);
            const p = bySel(`#kg-ie-panel-${v}`);
            if (s) {
                s.classList.toggle('kg-step-active', v === String(n));
            }
            if (p) {
                p.classList.toggle('kg-hidden', v !== String(n));
            }
        });
    };

    const stripHtml = (value) => {
        if (!value) {
            return '';
        }
        const div = document.createElement('div');
        div.innerHTML = String(value);
        return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
    };

    const splitMultiString = (value) => {
        if (!value) {
            return [];
        }
        return String(value)
            .split(/##|\r?\n|,|;/)
            .map((v) => stripHtml(v))
            .filter(Boolean);
    };
    const normalizePhase = (phase) => {
        const clean = stripHtml(phase);
        const aliases = {
            'warm-up': 'Warmup/Aktivierung',
            'warmup': 'Warmup/Aktivierung',
            'warm up': 'Warmup/Aktivierung',
            'aktivierung': 'Warmup/Aktivierung',
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
    const normalizePhaseText = (value) => normalizePhases(splitMultiString(value)).join(', ');

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
            seminarphase: normalizePhases(splitMultiString(readFirst(row, ['Seminarphase', 'seminarphase']))),
            zeitbedarf: stripHtml(readFirst(row, ['Zeitbedarf', 'zeitbedarf'])),
            gruppengroesse: stripHtml(readFirst(row, ['Gruppengröße', 'Gruppengroesse', 'gruppengroesse'])),
            kurzbeschreibung: readRichTextField(row, ['Kurzbeschreibung', 'kurzbeschreibung']),
            autor: stripHtml(readFirst(row, ['Autor*in / Kontakt', 'Autor/in / Kontakt', 'autor_kontakt', 'autor'])),
            lernziele: readRichTextField(row, ['Lernziele (Ich-kann ...)', 'lernziele']),
            komplexitaet: stripHtml(readFirst(row, ['Komplexitätsgrad', 'Komplexitaetsgrad', 'komplexitaet'])),
            vorbereitung: stripHtml(readFirst(row, ['Vorbereitung nötig', 'Vorbereitung noetig', 'vorbereitung'])),
            raum: splitMultiString(readFirst(row, ['Raumanforderungen', 'raumanforderungen'])),
            sozialform: splitMultiString(readFirst(row, ['Sozialform', 'sozialform'])),
            risiken: readRichTextField(row, ['Risiken/Tipps', 'risiken_tipps', 'risiken']),
            debrief: readRichTextField(row, ['Debrief/Reflexionsfragen', 'debrief']),
            materialien: splitMultiString(readFirst(row, ['Materialien', 'materialien'])),
            materialtechnik: readRichTextField(row, ['Material/Technik', 'material_technik', 'materialtechnik']),
            ablauf: readRichTextField(row, ['Ablauf', 'ablauf']),
            tags: stripHtml(readFirst(row, ['Tags / Schlüsselworte', 'Tags / Schluesselworte', 'tags', 'Tags'])),
            kognitive: splitMultiString(readFirst(row, ['Kognitive Dimension', 'kognitive_dimension', 'kognitive']))
        };
    };

    const countMethodsInGridState = (state) => {
        if (!state || !state.plan || !state.plan.days || typeof state.plan.days !== 'object') {
            return 0;
        }
        let count = 0;
        Object.keys(state.plan.days).forEach((day) => {
            const entries = Array.isArray(state.plan.days[day]) ? state.plan.days[day] : [];
            entries.forEach((entry) => {
                if (entry && entry.kind === 'method') {
                    count++;
                }
            });
        });
        return count;
    };

    const renderPreview = () => {
        const host = bySel('#kg-ie-preview');
        if (!host) {
            return;
        }
        host.innerHTML = '';

        if (previewRows.length) {
            const title = document.createElement('h5');
            title.textContent = 'Seminareinheiten';
            host.appendChild(title);
        }

        previewRows.forEach((row, idx) => {
            const box = document.createElement('label');
            box.className = 'kg-ie-item';
            const conflictUi = row.duplicate ? `
                <div class="kg-ie-meta">Doppelter Titel erkannt</div>
                <select class="kg-input kg-ie-resolution" data-idx="${idx}">
                    <option value="replace" ${row.resolution === 'replace' ? 'selected' : ''}>Ersetzen</option>
                    <option value="copy" ${row.resolution === 'copy' ? 'selected' : ''}>Als Duplikat hinzufügen</option>
                    <option value="skip" ${row.resolution === 'skip' ? 'selected' : ''}>Nicht hinzufügen</option>
                </select>
            ` : '<div class="kg-ie-meta">Neu</div>';
            box.innerHTML = `
                <input type="checkbox" class="kg-ie-check" data-idx="${idx}" ${row.selected ? 'checked' : ''}>
                <span class="kg-ie-title">${escapeHtml(row.method.titel || '(ohne Titel)')}</span>
                <span class="kg-ie-meta">⏱️ ${escapeHtml(row.method.zeitbedarf || '-')} · \
👥 ${escapeHtml(row.method.gruppengroesse || '-')}</span>
                ${conflictUi}
            `;
            host.appendChild(box);
        });

        if (previewUnits.length) {
            const title = document.createElement('h5');
            title.textContent = 'Bausteine';
            host.appendChild(title);
            previewUnits.forEach((item, idx) => {
                const box = document.createElement('label');
                box.className = 'kg-ie-item';
                box.innerHTML = `
                    <input type="checkbox" class="kg-ie-check-unit" data-idx="${idx}" ${item.selected ? 'checked' : ''}>
                    <span class="kg-ie-title">${escapeHtml(item.unit.title || '(ohne Titel)')}</span>
                    <span class="kg-ie-meta">ID: ${escapeHtml(item.unit.id || '-')}</span>
                `;
                host.appendChild(box);
            });
        }

        if (previewGrids.length) {
            const title = document.createElement('h5');
            title.textContent = 'Seminarpläne';
            host.appendChild(title);
            previewGrids.forEach((item, idx) => {
                const methodcount = countMethodsInGridState(item.plan.state);
                const box = document.createElement('label');
                box.className = 'kg-ie-item';
                box.innerHTML = `
                    <input type="checkbox" class="kg-ie-check-grid" data-idx="${idx}" ${item.selected ? 'checked' : ''}>
                    <span class="kg-ie-title">${escapeHtml(item.plan.name || '(ohne Namen)')}</span>
                    <span class="kg-ie-meta">${methodcount} Seminareinheiten im Plan</span>
                `;
                host.appendChild(box);
            });
        }

        host.querySelectorAll('.kg-ie-check').forEach((cb) => {
            cb.addEventListener('change', () => {
                const idx = Number.parseInt(cb.getAttribute('data-idx'), 10);
                if (Number.isInteger(idx) && previewRows[idx]) {
                    previewRows[idx].selected = !!cb.checked;
                }
            });
        });
        host.querySelectorAll('.kg-ie-resolution').forEach((sel) => {
            sel.addEventListener('change', () => {
                const idx = Number.parseInt(sel.getAttribute('data-idx'), 10);
                if (Number.isInteger(idx) && previewRows[idx]) {
                    previewRows[idx].resolution = String(sel.value || 'replace');
                }
            });
        });
        host.querySelectorAll('.kg-ie-check-unit').forEach((cb) => {
            cb.addEventListener('change', () => {
                const idx = Number.parseInt(cb.getAttribute('data-idx'), 10);
                if (Number.isInteger(idx) && previewUnits[idx]) {
                    previewUnits[idx].selected = !!cb.checked;
                }
            });
        });
        host.querySelectorAll('.kg-ie-check-grid').forEach((cb) => {
            cb.addEventListener('change', () => {
                const idx = Number.parseInt(cb.getAttribute('data-idx'), 10);
                if (Number.isInteger(idx) && previewGrids[idx]) {
                    previewGrids[idx].selected = !!cb.checked;
                }
            });
        });
    };

    const collectSeminarplaeneForExport = async (cmid) => {
        const out = [];
        const visibleGrids = Array.isArray(grids)
            ? grids.filter((grid) => Number(grid && grid.isarchived ? grid.isarchived : 0) === 0)
            : [];
        for (const grid of visibleGrids) {
            const gridid = Number(grid && grid.id ? grid.id : 0);
            if (!gridid) {
                continue;
            }
            let state = {};
            try {
                const res = await asCall('mod_seminarplaner_get_user_state', {cmid, gridid});
                state = res && res.statejson ? JSON.parse(res.statejson) : {};
            } catch (e) {
                state = {};
            }
            out.push({
                name: String(grid.name || ''),
                description: String(grid.description || ''),
                state
            });
        }
        return out;
    };

    const blobToBase64 = (blob) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = String(reader.result || '');
            const comma = result.indexOf(',');
            resolve(comma >= 0 ? result.slice(comma + 1) : result);
        };
        reader.onerror = () => reject(reader.error || new Error('Datei konnte nicht gelesen werden.'));
        reader.readAsDataURL(blob);
    });

    // Stored attachment descriptors (from get_method_cards) only carry a fileurl, not the file
    // content. For a portable export we fetch the file and embed it as contentbase64 so the
    // attachments survive a re-import into another activity.
    // A file that cannot be fetched is exported without its content. That used to pass
    // unnoticed, so the tally is collected here and reported after the export.
    const embedFileContent = async (entry, tally) => {
        if (!entry || typeof entry !== 'object') {
            return entry;
        }
        if (entry.contentbase64) {
            tally.embedded++;
            return entry;
        }
        const url = entry.fileurl || '';
        if (!url) {
            tally.failed.push(String(entry.name || '?'));
            return entry;
        }
        try {
            const resp = await fetch(url, {credentials: 'same-origin'});
            if (!resp.ok) {
                tally.failed.push(String(entry.name || '?'));
                return entry;
            }
            const blob = await resp.blob();
            tally.embedded++;
            return {
                name: String(entry.name || ''),
                mimetype: String(entry.mimetype || blob.type || 'application/octet-stream'),
                contentbase64: await blobToBase64(blob)
            };
        } catch (e) {
            tally.failed.push(String(entry.name || '?'));
            return entry;
        }
    };

    const embedMethodFileContents = async (methodList, tally) => {
        const list = Array.isArray(methodList) ? methodList : [];
        return Promise.all(list.map(async (method) => {
            if (!method || typeof method !== 'object') {
                return method;
            }
            const copy = Object.assign({}, method);
            if (Array.isArray(method.materialien)) {
                copy.materialien = await Promise.all(method.materialien.map((e) => embedFileContent(e, tally)));
            }
            if (Array.isArray(method.h5p)) {
                copy.h5p = await Promise.all(method.h5p.map((e) => embedFileContent(e, tally)));
            }
            return copy;
        }));
    };

    // Bausteine leben seit dem Sequenz-Umbau (D20) im Plan-JSON unter
    // `sequenz.bausteine`; der aktivitätsweite Planungszustand ist nur noch
    // Altbestand und bleibt in neu gebauten Seminaren leer. Der Export sammelt
    // deshalb aus beiden Quellen - sonst meldet er „0 Bausteine", obwohl in der
    // Sequenz welche stehen.
    // Bausteine aus den `sequenz.bausteine`-Abschnitten einer Plan-Liste
    // einsammeln (Export wie Import lesen dieselbe Struktur).
    const bausteineFromPlans = (seminarplaene) => {
        const out = [];
        (Array.isArray(seminarplaene) ? seminarplaene : []).forEach((plan) => {
            const state = plan && plan.state && typeof plan.state === 'object' ? plan.state : {};
            const seq = state.sequenz && typeof state.sequenz === 'object' ? state.sequenz : {};
            const bausteine = seq.bausteine && typeof seq.bausteine === 'object' ? seq.bausteine : {};
            Object.entries(bausteine).forEach(([id, baustein]) => {
                out.push({
                    id: String(id || ''),
                    title: String(baustein && baustein.titel ? baustein.titel : ''),
                    topics: String(baustein && baustein.unterthemen ? baustein.unterthemen : ''),
                    objectives: String(baustein && baustein.themenplanreferenz ? baustein.themenplanreferenz : '')
                });
            });
        });
        return out;
    };

    const collectBausteineForExport = (seminarplaene) => {
        const fromplanning = Object.entries(planningUnitsById || {}).map(([id, unit]) => ({
            id: String(id),
            title: String(unit && unit.title ? unit.title : ''),
            topics: String(unit && unit.topics ? unit.topics : ''),
            objectives: String(unit && unit.objectives ? unit.objectives : '')
        }));
        const out = [];
        const seen = new Set();
        fromplanning.concat(bausteineFromPlans(seminarplaene)).forEach((baustein) => {
            if (!baustein.id || seen.has(baustein.id)) {
                return;
            }
            seen.add(baustein.id);
            out.push(baustein);
        });
        return out;
    };

    const exportJsonFull = async (cmid) => {
        const selection = getComponentSelection('export');
        if (selectedComponentCount(selection) === 0) {
            throw new Error('Bitte mindestens eine Komponente auswählen (Seminareinheiten, Bausteine oder Seminarpläne).');
        }
        // Die Planzustände werden auch für die Bausteine gebraucht, nicht nur
        // für den Seminarplan-Teil des Exports.
        const seminarplaene = (selection.grids || selection.units)
            ? await collectSeminarplaeneForExport(cmid)
            : [];
        const bausteine = collectBausteineForExport(seminarplaene);
        const payload = {
            format: 'seminarplaner-component-export',
            version: 3,
            exportedat: (new Date()).toISOString(),
            components: {
                methods: !!selection.methods,
                bausteine: !!selection.units,
                seminarplaene: !!selection.grids
            }
        };
        const fileTally = {embedded: 0, failed: []};
        if (selection.methods) {
            payload.methods = await embedMethodFileContents(Array.isArray(methods) ? methods : [], fileTally);
        }
        if (selection.units) {
            payload.bausteine = bausteine;
            // Der Planungszustand ist bei Aktivitäten ohne Altbestand ein
            // leeres Array - dann trägt nur die Baustein-Liste die Daten.
            const basestate = planningState && typeof planningState === 'object' && !Array.isArray(planningState)
                ? Object.assign({}, planningState)
                : {};
            const stateunits = Array.isArray(basestate.units) ? basestate.units : [];
            const knownids = new Set(stateunits
                .map((unit) => String(unit && unit.id ? unit.id : '').trim())
                .filter(Boolean));
            basestate.units = stateunits.concat(bausteine.filter((unit) => !knownids.has(unit.id)));
            payload.planningstate = basestate;
        }
        if (selection.grids) {
            payload.seminarplaene = seminarplaene;
        }
        const blob = new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'seminarplaner-full-export.json';
        a.click();
        URL.revokeObjectURL(url);
        const exportedMethods = Array.isArray(payload.methods) ? payload.methods.length : 0;
        const exportedUnits = Array.isArray(payload.bausteine) ? payload.bausteine.length : 0;
        const exportedGrids = Array.isArray(payload.seminarplaene) ? payload.seminarplaene.length : 0;
        let summary = `Seminarplaner-JSON exportiert (${exportedMethods} Seminareinheiten, `
            + `${exportedUnits} Bausteine, ${exportedGrids} Seminarpläne`;
        summary += fileTally.embedded ? `, ${fileTally.embedded} Anhänge eingebettet).` : ').';
        if (fileTally.failed.length) {
            setStatus(`${summary} ACHTUNG: ${fileTally.failed.length} Anhänge konnten nicht gelesen werden und `
                + `fehlen in der Datei: ${fileTally.failed.join(', ')}.`, true);
            return;
        }
        setStatus(summary, false);
    };

    const loadMethods = (cmid) => {
        return asCall('mod_seminarplaner_get_method_cards', {cmid}).then((res) => {
            try {
                methods = res.methodsjson ? JSON.parse(res.methodsjson) : [];
            } catch (e) {
                methods = [];
            }
            if (!Array.isArray(methods)) {
                methods = [];
            }
        });
    };

    const loadGrids = (cmid) => {
        return asCall('mod_seminarplaner_list_grids', {cmid}).then((res) => {
            grids = Array.isArray(res.grids) ? res.grids : [];
            const select = bySel('#kg-pdf-grid');
            if (!select) {
                return;
            }
            select.innerHTML = '<option value=\"\">Bitte wählen</option>';
            grids.forEach((grid) => {
                const opt = document.createElement('option');
                opt.value = String(grid.id);
                opt.textContent = `${grid.name} (#${grid.id})`;
                select.appendChild(opt);
            });
            // Den in einem anderen Reiter gewaehlten Plan vorauswaehlen; geladen
            // wird er ueber das change-Ereignis, sobald bind() gelaufen ist.
            const remembered = PlanMemory.read(cmid);
            if (remembered && grids.some((grid) => Number(grid.id) === remembered)) {
                select.value = String(remembered);
                select.setAttribute('data-preselected', '1');
            }
        });
    };

    const loadGlobalMethodsets = (cmid) => {
        const select = bySel('#kg-global-set-select');
        if (!select) {
            return Promise.resolve();
        }
        // Schon importierte Konzepte gehören nicht mehr in die Auswahl - sonst
        // holt ein zweiter Klick dieselben Einheiten ein zweites Mal in den
        // Bestand. Entfernt man ein Konzept in der Bibliothek wieder, steht es
        // hier automatisch erneut bereit.
        return Promise.all([
            asCall('mod_seminarplaner_list_global_methodsets', {cmid}),
            asCall('mod_seminarplaner_list_imported_konzepte', {cmid}).catch(() => ({konzepte: []})),
        ]).then(([res, imported]) => {
            const all = Array.isArray(res.methodsets) ? res.methodsets : [];
            const importedids = new Set(
                (Array.isArray(imported && imported.konzepte) ? imported.konzepte : [])
                    .map((k) => Number(k.setid) || 0)
            );
            // D55: Hier werden nur globale Seminarkonzepte importiert. Methoden-
            // Sammlungen sind ohne Import jederzeit in der Bibliothek durchsuchbar.
            const konzepte = all.filter((set) => String(set.typ) === 'seminarkonzept');
            globalMethodsets = konzepte.filter((set) => !importedids.has(Number(set.id)));
            select.innerHTML = '<option value="">Bitte wählen</option>';
            globalMethodsets.forEach((set) => {
                const opt = document.createElement('option');
                opt.value = String(set.id);
                opt.textContent = String(set.displayname);
                select.appendChild(opt);
            });
            const alreadycount = konzepte.length - globalMethodsets.length;
            const alreadynote = alreadycount
                ? ` ${alreadycount} bereits übernommene ${alreadycount === 1 ? 'ist' : 'sind'} ausgeblendet – `
                    + `entfernen kannst du sie im Tab „Bibliothek" unter „Globale Seminarkonzepte".`
                : '';
            if (res.available === false) {
                setGlobalStatus(res.message || 'Local-Plugin nicht verfügbar.', true);
            } else if (res.message) {
                setGlobalStatus(res.message, true);
            } else if (!globalMethodsets.length) {
                setGlobalStatus(alreadycount
                    ? `Alle verfügbaren globalen Seminarkonzepte sind bereits übernommen.${alreadynote}`
                    : 'Keine veröffentlichten globalen Seminarkonzepte gefunden.', false);
            } else {
                setGlobalStatus(`${globalMethodsets.length} globale Seminarkonzepte verfügbar.${alreadynote}`, false);
            }
        }).catch((e) => {
            setGlobalStatus(`Globale Seminarkonzepte konnten nicht geladen werden: ${e.message || e}`, true);
        });
    };

    const loadGlobalSyncStatus = (cmid) => {
        return asCall('mod_seminarplaner_get_methodset_sync_status', {cmid}).then((res) => {
            globalSyncLinks = Array.isArray(res.links) ? res.links : [];
        }).catch(() => {
            globalSyncLinks = [];
        });
    };

    const getSelectedSyncLink = () => {
        const select = bySel('#kg-global-set-select');
        const setid = Number.parseInt(select ? (select.value || '0') : '0', 10) || 0;
        if (!setid) {
            return null;
        }
        return globalSyncLinks.find((link) => Number(link.methodsetid) === setid) || null;
    };

    // D54: kein Auto-Update-Schalter mehr - nur noch der bewusste "Ausstehende
    // Updates übernehmen"-Button plus ein Info-Text. Der Hinweis auf verfügbare
    // Aktualisierungen erscheint zusätzlich an der betroffenen Karte in der
    // Bibliothek (methodlibrary.js).
    const refreshGlobalSyncUi = () => {
        const select = bySel('#kg-global-set-select');
        const applybtn = bySel('#kg-global-set-apply');
        const selected = getSelectedSyncLink();
        if (!applybtn) {
            return;
        }
        const setid = Number.parseInt(select ? (select.value || '0') : '0', 10) || 0;
        if (!setid) {
            applybtn.disabled = true;
            setGlobalSyncInfo('Bitte zuerst eine Methoden-Sammlung auswählen.', false);
            return;
        }
        if (!selected) {
            applybtn.disabled = true;
            setGlobalSyncInfo(
                'Diese Sammlung ist noch nicht in deinen Bestand übernommen.',
                false
            );
            return;
        }
        const hasPending = !!selected.haspending || (Number(selected.currentversionid) > Number(selected.linkedversionid));
        applybtn.disabled = !hasPending;
        if (hasPending) {
            setGlobalSyncInfo(
                'Eine aktualisierte Version dieser Sammlung ist verfügbar. ' +
                'Mit "Ausstehende Updates übernehmen" holst du sie in deinen Bestand - ' +
                'lokal geänderte Einheiten bleiben dabei unangetastet.',
                false
            );
        } else {
            setGlobalSyncInfo('Dein Bestand ist auf dem aktuellen Stand dieser Sammlung.', false);
        }
    };


    const loadGridState = (cmid, gridid) => {
        if (!gridid) {
            currentGridState = null;
            return Promise.resolve(null);
        }
        return asCall('mod_seminarplaner_get_user_state', {cmid, gridid}).then((res) => {
            let parsed = {};
            try {
                parsed = res.statejson ? JSON.parse(res.statejson) : {};
            } catch (e) {
                parsed = {};
            }
            currentGridState = parsed || {};
            return currentGridState;
        });
    };

    // D84: Namen für die ZIM-Spalte „Referent*in". Schlägt der Aufruf fehl,
    // bleibt die Spalte leer — der Export selbst darf daran nicht scheitern.
    const loadReferenten = (cmid) => {
        referentenById.clear();
        return asCall('mod_seminarplaner_get_referenten', {cmid}).then((res) => {
            (Array.isArray(res && res.referenten) ? res.referenten : []).forEach((person) => {
                referentenById.set(String(person.id), person);
            });
            return true;
        }).catch(() => {
            return false;
        });
    };

    const loadPlanningState = (cmid) => {
        planningUnitsById = {};
        planningState = {};
        planningVersionHash = '';
        return asCall('mod_seminarplaner_get_planning_state', {cmid}).then((res) => {
            let parsed = {};
            try {
                parsed = res.statejson ? JSON.parse(res.statejson) : {};
            } catch (e) {
                parsed = {};
            }
            planningState = parsed || {};
            planningVersionHash = String(res && res.versionhash ? res.versionhash : '');
            const units = Array.isArray(parsed.units) ? parsed.units : [];
            units.forEach((unit) => {
                const id = String(unit && unit.id ? unit.id : '').trim();
                if (!id) {
                    return;
                }
                planningUnitsById[id] = {
                    title: String(unit.title || '').trim(),
                    topics: String(unit.topics || ''),
                    objectives: String(unit.objectives || ''),
                    methods: Array.isArray(unit.methods) ? unit.methods : []
                };
            });
        }).catch(() => {
            planningUnitsById = {};
            planningState = {};
            planningVersionHash = '';
        });
    };

    // ---- Infofeld je Seminarplan (Tiny-Editor #kg-pdf-info) ----
    let pdfInfoGridId = 0;
    let pdfInfoTimer = null;
    let pdfInfoLoading = false;
    const pdfInfoEditor = () => (window.tinyMCE && window.tinyMCE.get('kg-pdf-info')) || null;
    const getPdfInfoHtml = () => {
        const editor = pdfInfoEditor();
        if (editor) {
            return String(editor.getContent() || '').trim();
        }
        const el = bySel('#kg-pdf-info');
        return el ? String(el.value || '').trim() : '';
    };
    const setPdfInfoHtml = (html) => {
        const el = bySel('#kg-pdf-info');
        if (el) {
            el.value = html;
        }
        const editor = pdfInfoEditor();
        if (editor && typeof editor.setContent === 'function') {
            editor.setContent(html);
        }
    };
    const setPdfInfoStatus = (text) => {
        const el = bySel('#kg-pdf-info-status');
        if (el) {
            el.textContent = text;
        }
    };
    // Sofort speichern (vor einem Planwechsel) oder verzögert beim Tippen.
    const savePdfInfo = (cmid, immediate = false) => {
        if (pdfInfoTimer) {
            window.clearTimeout(pdfInfoTimer);
            pdfInfoTimer = null;
        }
        if (pdfInfoLoading) {
            return Promise.resolve();
        }
        if (!pdfInfoGridId) {
            setPdfInfoStatus('Bitte zuerst oben einen Seminarplan wählen – das Feld wird je Plan gespeichert.');
            return Promise.resolve();
        }
        const gridid = pdfInfoGridId;
        const run = () => asCall('mod_seminarplaner_set_pdf_info', {cmid, gridid, infohtml: getPdfInfoHtml()})
            .then(() => setPdfInfoStatus('Gespeichert.'))
            .catch(() => setPdfInfoStatus('Speichern fehlgeschlagen.'));
        if (immediate) {
            return run();
        }
        setPdfInfoStatus('');
        pdfInfoTimer = window.setTimeout(run, 800);
        return Promise.resolve();
    };
    const loadPdfInfo = (cmid, gridid) => {
        pdfInfoGridId = gridid;
        if (!gridid) {
            pdfInfoLoading = true;
            setPdfInfoHtml('');
            pdfInfoLoading = false;
            return Promise.resolve();
        }
        pdfInfoLoading = true;
        return asCall('mod_seminarplaner_get_pdf_info', {cmid, gridid}).then((res) => {
            setPdfInfoHtml(String((res && res.infohtml) || ''));
            setPdfInfoStatus('');
        }).catch(() => {
            setPdfInfoStatus('Das Infofeld konnte nicht geladen werden.');
        }).then(() => {
            pdfInfoLoading = false;
        });
    };
    // Tiny entsteht erst nach dem Seitenaufbau - Änderungen dort abonnieren,
    // sobald es da ist (sonst bleibt das Textfeld die Quelle).
    const bindPdfInfo = (cmid) => {
        const el = bySel('#kg-pdf-info');
        if (!el) {
            return;
        }
        el.addEventListener('input', () => savePdfInfo(cmid));
        let tries = 0;
        const attach = () => {
            const editor = pdfInfoEditor();
            if (editor && typeof editor.on === 'function') {
                editor.on('input change undo redo', () => savePdfInfo(cmid));
                if (pdfInfoGridId) {
                    loadPdfInfo(cmid, pdfInfoGridId);
                }
                return;
            }
            if (tries++ < 50) {
                window.setTimeout(attach, 200);
            }
        };
        attach();
    };

    const getPdfMeta = () => {
        const titleel = bySel('#kg-pdf-title');
        const dateel = bySel('#kg-pdf-date');
        const numberel = bySel('#kg-pdf-number');
        const contactel = bySel('#kg-pdf-contact');
        return {
            title: (titleel ? titleel.value : '').trim(),
            date: (dateel ? dateel.value : '').trim(),
            number: (numberel ? numberel.value : '').trim(),
            contact: (contactel ? contactel.value : '').trim()
        };
    };

    // Anker-Zeiten aus der Config ableiten — deckungsgleich mit grid.js
    // (deriveAnkerzeiten), damit die Export-Zeiten exakt dem Überblick entsprechen.
    const pdfParseClock = (value) => {
        if (!value) {
            return null;
        }
        const parts = String(value).split(':');
        const hh = Number.parseInt(parts[0], 10);
        const mm = Number.parseInt(parts[1], 10);
        return (Number.isFinite(hh) && Number.isFinite(mm)) ? (hh * 60 + mm) : null;
    };
    const pdfClockLabel = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
    const pdfDeriveAnkerzeiten = (config) => {
        const cfg = config || {};
        const az = cfg.ankerzeiten;
        if (az && az.vormittag && az.nachmittag
                && pdfParseClock(az.vormittag.start) !== null && pdfParseClock(az.nachmittag.start) !== null) {
            return az;
        }
        const range = cfg.timeRange || {};
        const start = pdfParseClock(range.start) === null ? '08:30' : range.start;
        const end = pdfParseClock(range.end) === null ? '17:30' : range.end;
        let best = null;
        (Array.isArray(cfg.breaks) ? cfg.breaks : []).forEach((brk) => {
            if (!brk || pdfParseClock(brk.start) === null) {
                return;
            }
            const duration = Math.max(0, Number(brk.duration) || 0);
            if (duration && (!best || duration > best.duration)) {
                best = {start: brk.start, duration};
            }
        });
        const vmEnd = best ? best.start : '12:30';
        const nmStart = best ? pdfClockLabel(pdfParseClock(best.start) + best.duration) : '12:30';
        return {
            vormittag: {start, end: vmEnd},
            nachmittag: {start: nmStart, end},
            ersterTagNurNachmittag: false,
            letzterTagNurVormittag: false
        };
    };

    // Projiziert den Sequenz-Abschnitt (aktuelle Bearbeitungsquelle) in
    // tagesbasierte Export-Einträge mit vollen Karten-Details. Jede Platzierung
    // (typ 'einheit') wird zu genau einer Zeile; eine aktive Einheiten-Karte
    // liefert die Detailfelder, sonst bleibt es Titel + Zeit.
    const getSequencePlanByDay = (state) => {
        const seq = state.sequenz || {};
        const config = state.config || {};
        const placements = (seq.platzierungen && typeof seq.platzierungen === 'object') ? seq.platzierungen : {};
        const bausteine = (seq.bausteine && typeof seq.bausteine === 'object') ? seq.bausteine : {};
        const auswahlen = (seq.einheitenauswahlen && typeof seq.einheitenauswahlen === 'object') ? seq.einheitenauswahlen : {};
        const methodById = new Map(methods.map((m) => [String(m.id), m]));
        const az = pdfDeriveAnkerzeiten(config);
        const vmStart = pdfParseClock(az.vormittag.start);
        const nmStart = pdfParseClock(az.nachmittag.start);
        const days = {};
        const tage = Array.isArray(seq.tage) ? seq.tage : [];
        tage.forEach((tag, idx) => {
            const dayname = (tag && tag.bezeichnung && (config.days || []).includes(tag.bezeichnung))
                ? tag.bezeichnung
                : (config.days || [])[idx];
            if (!dayname) {
                return;
            }
            const isFirst = idx === 0;
            const isLast = idx === (tage.length - 1);
            const anchorStarts = {
                vormittag: (isFirst && az.ersterTagNurNachmittag) ? nmStart : vmStart,
                nachmittag: (isLast && az.letzterTagNurVormittag) ? vmStart : nmStart
            };
            const items = [];
            ['vormittag', 'nachmittag'].forEach((ankername) => {
                let clock = Number.isFinite(anchorStarts[ankername]) ? anchorStarts[ankername] : 0;
                const pids = (((tag.anker || {})[ankername] || {}).sequenz) || [];
                pids.forEach((pid) => {
                    const p = placements[pid];
                    if (!p) {
                        return;
                    }
                    const duration = Math.max(0, Number(p.dauer) || 0);
                    if (p.typ === 'pause') {
                        items.push({
                            kind: 'break',
                            title: String(p.titel || 'Pause'),
                            startMin: clock,
                            endMin: clock + duration,
                            details: {}
                        });
                        clock += duration;
                        return;
                    }
                    let card = null;
                    if (p.einheitenauswahl) {
                        const auswahl = auswahlen[p.einheitenauswahl];
                        const aktiv = auswahl && auswahl.aktiv !== null && auswahl.aktiv !== undefined ? String(auswahl.aktiv) : '';
                        card = aktiv ? methodById.get(aktiv) : null;
                    }
                    // D84: Referent*innen hängen an der Platzierung, nicht an
                    // der Bibliothekskarte — sie reisen deshalb hier mit.
                    const referenten = Array.isArray(p.referenten) ? p.referenten : [];
                    if (card) {
                        const normalized = normalizeMethodForPdf(card);
                        items.push(Object.assign({}, normalized, {
                            kind: 'method',
                            title: String(p.titel || '').trim() || normalized.title,
                            startMin: clock,
                            endMin: clock + duration,
                            referenten
                        }));
                    } else {
                        const baustein = p.bausteinid ? bausteine[p.bausteinid] : null;
                        const title = String(p.titel || '').trim()
                            || (baustein && baustein.titel ? String(baustein.titel) : 'Seminareinheit');
                        items.push({
                            kind: 'method', title, phase: '', startMin: clock, endMin: clock + duration,
                            details: {}, referenten
                        });
                    }
                    clock += duration;
                });
            });
            days[dayname] = items;
        });
        (config.days || []).forEach((day) => {
            if (!days[day]) {
                days[day] = [];
            }
        });
        return days;
    };

    // Aktuelle Bearbeitungsquelle ist die Sequenz; plan.days (Legacy-Grid) wird
    // beim Sequenz-Editieren NICHT mehr nachgezogen. Der Export muss deshalb aus
    // der Sequenz projizieren (wie der Überblick), sonst zeigt das PDF Altdaten.
    const getPlanByDay = () => {
        const state = currentGridState;
        if (!state) {
            return {};
        }
        const seq = state.sequenz;
        if (seq && Array.isArray(seq.tage) && seq.tage.length) {
            return getSequencePlanByDay(state);
        }
        return (state.plan && state.plan.days) ? state.plan.days : {};
    };

    const getOrderedDays = () => {
        const configdays = currentGridState && currentGridState.config ? currentGridState.config.days : null;
        if (Array.isArray(configdays) && configdays.length) {
            return configdays;
        }
        return ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
    };

    const formatTimeForPdf = (minutes) => {
        const total = Number(minutes) || 0;
        const h = Math.floor(total / 60);
        const m = total % 60;
        return `${h}:${String(m).padStart(2, '0')}`;
    };

    const normalizePdfText = (value, collapseSpaces = true) => {
        const letterClass = 'A-Za-zÀ-ÖØ-öø-ÿ0-9';
        const tightenSpacedLetters = (input) => {
            const pattern = new RegExp(`\\b[${letterClass}](?:\\s+[${letterClass}]){3,}\\b`, 'g');
            return input.replace(pattern, (match) => match.replace(/\s+/g, ''));
        };
        let text = String(value || '');
        if (typeof text.normalize === 'function') {
            text = text.normalize('NFC');
        }
        text = text
            .replace(/\u00A0/g, ' ')
            .replace(/[\u2000-\u200A\u202F]/g, ' ')
            .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
            .replace(/\u00AD/g, '')
            .replace(/\u2011/g, '-')
            .replace(/[\u2013\u2014]/g, '-')
            .replace(/[„“”]/g, '"')
            .replace(/[‚‘’]/g, '\'')
            .replace(/…/g, '...')
            .replace(/\s+([,.;:!?])/g, '$1')
            .replace(/([([{])\s+/g, '$1')
            .replace(/\s+([)\]}])/g, '$1');
        text = tightenSpacedLetters(text);
        text = text.replace(/\b([A-Za-zÀ-ÖØ-öø-ÿ])\.\s+([A-Za-zÀ-ÖØ-öø-ÿ])\./g, '$1.$2.');
        text = text.replace(/\s+\/\s+/g, '/');
        if (!collapseSpaces) {
            return text;
        }
        return text.replace(/\s+/g, ' ').trim();
    };

    const escapeTextForPdf = (text) => {
        if (!text) {
            return '';
        }
        const div = document.createElement('div');
        div.innerHTML = String(text);
        const plain = (div.textContent || div.innerText || '').replace(/\r?\n/g, ' ');
        return normalizePdfText(plain, true);
    };

    // Rich-Text der Bibliothek (TinyMCE: h3-Überschriften, Absätze, Listen,
    // fett/kursiv im Satz, Links, vereinzelt Tabellen) ins PDF - so, wie es im
    // Editor aussieht. Zweistufig: erst das HTML in Blöcke mit Textläufen
    // zerlegen, dann Wort für Wort umbrechen. Früher begann jeder Textknoten
    // eine neue Zeile (ein fettes Wort riss den Satz auseinander), und
    // Überschriften kamen als normaler Text heraus.
    const renderHtmlToPdf = (doc, html, x, y, maxWidth) => {
        if (!html) {
            return y;
        }
        const div = document.createElement('div');
        const source = String(html);
        if (/<[a-z][^>]*>/i.test(source)) {
            div.innerHTML = source;
        } else {
            // Reiner Text (z. B. Themen eines Bausteins): Zeilen bleiben Zeilen.
            div.textContent = source;
            div.innerHTML = div.innerHTML.replace(/\r?\n/g, '<br>');
        }

        // Abschnittstitel („Ablauf:") stehen in 11 pt fett - Überschriften im
        // Text liegen darunter, damit beides unterscheidbar bleibt.
        const BODY_SIZE = 10;
        const HEADING_SIZE = {h1: 11.5, h2: 11, h3: 10.5, h4: 10, h5: 10, h6: 10};
        // Seitenende aus der echten Seitenhöhe (A4 hoch 297 mm, quer 210 mm).
        const PAGE_BOTTOM = doc.internal.pageSize.getHeight() - 17;
        const listIndent = 6;
        const blocks = [];
        let current = null;

        // Ein Block sammelt Textläufe {text, bold, italic, link}.
        const openBlock = (props) => {
            current = Object.assign({runs: [], indent: 0, bullet: '', heading: ''}, props);
            blocks.push(current);
            return current;
        };
        const closeBlock = () => {
            current = null;
        };
        const addText = (text, style) => {
            if (!current) {
                openBlock({indent: style.indent || 0});
            }
            current.runs.push({text, bold: style.bold, italic: style.italic, link: style.link});
        };

        const BLOCK_TAGS = ['p', 'div', 'section', 'article', 'blockquote', 'pre', 'figure', 'header', 'footer'];
        const walk = (node, style) => {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = String(node.textContent || '').replace(/[\r\n\t]+/g, ' ');
                if (text.trim() || (current && current.runs.length)) {
                    addText(text, style);
                }
                return;
            }
            if (node.nodeType !== Node.ELEMENT_NODE) {
                return;
            }
            const tag = node.tagName.toLowerCase();
            const children = () => Array.from(node.childNodes).forEach((child) => walk(child, style));
            const inline = (extra) => Array.from(node.childNodes)
                .forEach((child) => walk(child, Object.assign({}, style, extra)));

            if (tag === 'strong' || tag === 'b') {
                inline({bold: true});
                return;
            }
            if (tag === 'em' || tag === 'i') {
                inline({italic: true});
                return;
            }
            if (tag === 'a') {
                const hrefRaw = String(node.getAttribute('href') || '').trim();
                const href = /^(https?:\/\/|mailto:)/i.test(hrefRaw) ? hrefRaw : '';
                inline({link: href || style.link});
                return;
            }
            if (tag === 'br') {
                // Harter Umbruch: neuer Block ohne Absatzabstand.
                const indent = current ? current.indent : (style.indent || 0);
                openBlock({indent, tight: true});
                return;
            }
            if (/^h[1-6]$/.test(tag)) {
                closeBlock();
                openBlock({heading: tag, indent: style.indent || 0});
                inline({bold: true});
                closeBlock();
                return;
            }
            if (tag === 'ul' || tag === 'ol') {
                closeBlock();
                let n = 0;
                Array.from(node.children).forEach((li) => {
                    if (li.tagName.toLowerCase() !== 'li') {
                        return;
                    }
                    n++;
                    const indent = (style.indent || 0) + listIndent;
                    openBlock({indent, bullet: tag === 'ol' ? `${n}.` : '•', listitem: true});
                    Array.from(li.childNodes).forEach((child) => {
                        const ctag = child.nodeType === Node.ELEMENT_NODE ? child.tagName.toLowerCase() : '';
                        if (ctag === 'ul' || ctag === 'ol') {
                            walk(child, Object.assign({}, style, {indent}));
                        } else if (ctag === 'p') {
                            // TinyMCE legt Absätze gern in <li> - ohne neuen Block.
                            if (!current || current.indent !== indent) {
                                openBlock({indent, listitem: true});
                            }
                            Array.from(child.childNodes).forEach((c) => walk(c, Object.assign({}, style, {indent})));
                        } else {
                            if (!current) {
                                openBlock({indent, listitem: true});
                            }
                            walk(child, Object.assign({}, style, {indent}));
                        }
                    });
                    closeBlock();
                });
                return;
            }
            if (tag === 'tr') {
                // Tabellen: eine Zeile je Tabellenzeile, Zellen mit „ · ".
                closeBlock();
                openBlock({indent: style.indent || 0, listitem: true});
                Array.from(node.children).forEach((cell, idx) => {
                    if (idx > 0) {
                        addText(' · ', style);
                    }
                    Array.from(cell.childNodes).forEach((c) => walk(c, Object.assign({}, style,
                        cell.tagName.toLowerCase() === 'th' ? {bold: true} : {})));
                });
                closeBlock();
                return;
            }
            if (BLOCK_TAGS.includes(tag)) {
                closeBlock();
                children();
                closeBlock();
                return;
            }
            // span, table/tbody, font … : Inhalt übernehmen, Zeilenfluss bleibt.
            children();
        };
        Array.from(div.childNodes).forEach((child) => walk(child, {bold: false, italic: false, link: '', indent: 0}));

        // ---- Satz ----
        let currentY = y;
        const fontFor = (run) => (run.bold && run.italic ? 'bolditalic' : run.bold ? 'bold' : run.italic ? 'italic' : 'normal');
        const ensureSpace = (needed) => {
            if (currentY + needed > PAGE_BOTTOM) {
                doc.addPage();
                stampPdfLogo(doc);
                currentY = 20;
            }
        };
        const savedColor = doc.getTextColor();
        let first = true;

        blocks.forEach((block) => {
            // Läufe säubern; ein Block ohne Text fällt weg.
            const runs = block.runs
                .map((run) => Object.assign({}, run, {text: normalizePdfText(run.text, false).replace(/\s+/g, ' ')}))
                .filter((run) => run.text !== '');
            if (runs.length && !runs.some((run) => run.text.trim())) {
                return;
            }
            if (!runs.length) {
                return;
            }
            runs[0].text = runs[0].text.replace(/^\s+/, '');
            runs[runs.length - 1].text = runs[runs.length - 1].text.replace(/\s+$/, '');

            const size = block.heading ? HEADING_SIZE[block.heading] : BODY_SIZE;
            const lineHeight = size * 0.42;
            if (!first) {
                if (block.heading) {
                    currentY += 3;
                } else if (!block.tight && !block.listitem) {
                    currentY += 1.6;
                } else if (block.listitem) {
                    currentY += 0.4;
                }
            }
            first = false;
            // Eine Überschrift nie allein unten auf der Seite.
            ensureSpace(block.heading ? lineHeight * 3 : lineHeight);
            doc.setFontSize(size);

            const left = x + block.indent;
            const width = Math.max(20, maxWidth - block.indent);
            if (block.bullet) {
                doc.setFont(undefined, 'normal');
                doc.text(block.bullet, left - (block.bullet === '•' ? 4 : 5), currentY);
            }

            // Wort für Wort setzen; Leerzeichen hängen am Wort davor.
            const tokens = [];
            runs.forEach((run) => {
                run.text.split(/(\s+)/).forEach((part) => {
                    if (part === '') {
                        return;
                    }
                    if (/^\s+$/.test(part)) {
                        if (tokens.length) {
                            tokens[tokens.length - 1].space = true;
                        }
                        return;
                    }
                    tokens.push({text: part, run, space: false});
                });
            });
            // Wörter gleicher Schrift gehen als EIN String ins PDF: jsPDF
            // bettet für Standardschriften keine Zeichenbreiten ein, der
            // Betrachter setzt mit seiner eigenen Helvetica. Einzeln platzierte
            // Wörter ergäben dadurch ungleiche Wortabstände; so setzt der
            // Betrachter die Leerzeichen selbst. Nur an Schriftwechseln wird
            // neu positioniert.
            let cursor = 0;
            let segment = null;
            const flush = () => {
                if (!segment) {
                    return;
                }
                doc.setFont(undefined, fontFor(segment.run));
                if (segment.run.link && typeof doc.textWithLink === 'function') {
                    doc.setTextColor(25, 92, 179);
                    doc.textWithLink(segment.text, segment.x, currentY, {url: segment.run.link});
                    doc.setTextColor(savedColor);
                } else {
                    doc.text(segment.text, segment.x, currentY);
                }
                segment = null;
            };
            const sameStyle = (a, b) => fontFor(a) === fontFor(b) && (a.link || '') === (b.link || '');
            tokens.forEach((token, idx) => {
                doc.setFont(undefined, fontFor(token.run));
                const w = doc.getTextWidth(token.text);
                const prev = idx > 0 ? tokens[idx - 1] : null;
                const gap = prev && prev.space ? doc.getTextWidth(' ') : 0;
                if (cursor > 0 && cursor + gap + w > width) {
                    flush();
                    currentY += lineHeight;
                    ensureSpace(lineHeight);
                    cursor = 0;
                } else {
                    cursor += gap;
                }
                if (segment && sameStyle(segment.run, token.run)) {
                    segment.text += (gap ? ' ' : '') + token.text;
                } else {
                    flush();
                    segment = {run: token.run, text: token.text, x: left + cursor};
                }
                cursor += w;
            });
            flush();
            currentY += lineHeight;
        });

        // Aufrufer erwarten Grundschrift.
        doc.setFontSize(BODY_SIZE);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(savedColor);
        return currentY;
    };

    const getCognitiveLabel = (item) => {
        if (item && item.cognitive) {
            return String(item.cognitive);
        }
        const level = Number(item && item.cognitiveLevel ? item.cognitiveLevel : 0);
        if (!level) {
            return '';
        }
        const map = {1: 'Erinnern', 2: 'Verstehen', 3: 'Anwenden', 4: 'Analysieren', 5: 'Bewerten', 6: 'Erschaffen'};
        return map[level] || '';
    };

    const normalizeMethodForPdf = (method) => {
        const source = method || {};
        const cognitive = Array.isArray(source.kognitive) ? source.kognitive.join(', ') : (source.kognitive || '');
        const duration = Math.max(5, Number.parseInt(source.zeitbedarf || source.duration || '0', 10) || 0);
        return {
            id: source.id || '',
            title: String(source.titel || source.title || '').trim(),
            duration,
            phase: Array.isArray(source.seminarphase)
                ? source.seminarphase.join(', ')
                : (source.seminarphase || source.phase || ''),
            cognitive,
            group: source.gruppengroesse || source.group || '',
            tags: source.tags || '',
            details: {
                description: source.kurzbeschreibung || '',
                reflection: source.debrief || '',
                requirements: Array.isArray(source.raum) ? source.raum.join(', ') : (source.raum || ''),
                socialform: Array.isArray(source.sozialform) ? source.sozialform.join(', ') : (source.sozialform || ''),
                preparation: source.vorbereitung || '',
                materials: source.materialtechnik || '',
                flow: source.ablauf || '',
                risks: source.risiken || '',
                resources: Array.isArray(source.materialien) ? source.materialien.join(', ') : (source.materialien || ''),
                objectives: source.lernziele || '',
                contact: source.autor || ''
            }
        };
    };

    const getUnitMethodItemsForPdf = (unit, startMin = 0) => {
        const refs = Array.isArray(unit && unit.methods) ? unit.methods : [];
        let cursor = Number(startMin) || 0;
        return refs.map((entry) => {
            const methodid = String((entry && (entry.methodid || entry.id)) || '').trim();
            if (!methodid) {
                return null;
            }
            const method = methods.find((candidate) => String(candidate.id || '') === methodid);
            if (!method) {
                return null;
            }
            const normalized = normalizeMethodForPdf(method);
            const duration = normalized.duration || 5;
            const item = Object.assign({}, normalized, {
                startMin: cursor,
                endMin: cursor + duration
            });
            cursor += duration;
            return item;
        }).filter(Boolean);
    };

    const getUnitForPdf = (item) => {
        if (!item || item.kind !== 'unit') {
            return null;
        }
        const unitid = String(item.unitid || '').trim();
        const unit = unitid && planningUnitsById[unitid] ? planningUnitsById[unitid] : {};
        return {
            title: unit.title || item.title || 'Baustein',
            topics: unit.topics || '',
            objectives: unit.objectives || '',
            methods: getUnitMethodItemsForPdf(unit, item.startMin)
        };
    };

    // D84: Nutzer-Id -> Anzeigename. Der Plan speichert nur Ids; für die
    // ZIM-Spalte braucht das PDF die Namen.
    const referentNames = (ids) => {
        return (Array.isArray(ids) ? ids : [])
            .map((id) => referentenById.get(String(id)))
            .filter((person) => !!person)
            .map((person) => person.fullname);
    };

    const joinUniquePdfValues = (values) => {
        const seen = {};
        return values
            .map((value) => escapeTextForPdf(value || ''))
            .filter(Boolean)
            .filter((value) => {
                const key = value.toLowerCase();
                if (seen[key]) {
                    return false;
                }
                seen[key] = true;
                return true;
            })
            .join('\n');
    };

    const joinMethodPdfValues = (unit, label, picker) => {
        if (!unit || !Array.isArray(unit.methods) || !unit.methods.length) {
            return '';
        }
        return unit.methods
            .map((method) => {
                const value = escapeTextForPdf(picker(method) || '');
                if (!value) {
                    return '';
                }
                const title = escapeTextForPdf(method.title || '');
                return title ? `${title}: ${value}` : value;
            })
            .filter(Boolean)
            .join('\n');
    };

    const getSelectedPdfColumns = () => {
        const all = bySel('#kg-pdf-columns-all');
        const host = bySel('#kg-pdf-columns-options');
        if (!host) {
            return PDF_COLUMN_ORDER.slice();
        }
        // D63: Reihenfolge folgt der (per ◄/► editierten) DOM-Reihenfolge der Zeilen.
        const orderedKeys = Array.from(host.querySelectorAll('.kg-pdf-col-row'))
            .map((row) => String(row.getAttribute('data-col') || '').trim())
            .filter((key) => PDF_COLUMN_ORDER.includes(key));
        const domOrder = orderedKeys.length ? orderedKeys : PDF_COLUMN_ORDER.slice();
        if (all && all.checked) {
            return domOrder;
        }
        const selected = Array.from(host.querySelectorAll('input[type="checkbox"]:checked'))
            .map((el) => String(el.value || '').trim())
            .filter((key) => PDF_COLUMN_ORDER.includes(key));
        // In editierter Reihenfolge zurückgeben, nicht in Klick-Reihenfolge.
        const ordered = domOrder.filter((key) => selected.includes(key));
        return ordered.length ? ordered : domOrder;
    };

    const updatePdfColumnsToggleLabel = () => {
        const toggle = bySel('#kg-pdf-columns-toggle');
        if (!toggle) {
            return;
        }
        const all = bySel('#kg-pdf-columns-all');
        if (all && all.checked) {
            toggle.textContent = 'Alle Spalten';
            return;
        }
        const count = getSelectedPdfColumns().length;
        toggle.textContent = count ? `Spalten (${count})` : 'Spalten wählen';
    };

    // D63: gespeicherte Reihenfolge/Auswahl auf das Panel anwenden.
    const applyPdfColumnsSetting = () => {
        const all = bySel('#kg-pdf-columns-all');
        const options = bySel('#kg-pdf-columns-options');
        if (!all || !options || !pdfColumnsSetting) {
            return;
        }
        const order = Array.isArray(pdfColumnsSetting.order) ? pdfColumnsSetting.order : [];
        // Zeilen entlang der gespeicherten Reihenfolge neu einhängen.
        order.forEach((key) => {
            const row = options.querySelector(`.kg-pdf-col-row[data-col="${key}"]`);
            if (row) {
                options.appendChild(row);
            }
        });
        const orientation = pdfColumnsSetting.orientation === 'portrait' ? 'portrait' : 'landscape';
        document.querySelectorAll('input[name="kg-pdf-orientation"]').forEach((radio) => {
            radio.checked = radio.value === orientation;
        });
        const orientations = pdfColumnsSetting.orientations || {};
        PDF_ORIENTATION_EXPORTS.forEach((kind) => {
            const value = orientations[kind] === 'landscape' ? 'landscape' : 'portrait';
            document.querySelectorAll(`input[name="kg-pdf-orientation-${kind}"]`).forEach((radio) => {
                radio.checked = radio.value === value;
            });
        });
        const useAll = !!pdfColumnsSetting.all;
        all.checked = useAll;
        const selected = Array.isArray(pdfColumnsSetting.selected) ? pdfColumnsSetting.selected : [];
        options.querySelectorAll('.kg-pdf-col-row input[type="checkbox"]').forEach((cb) => {
            cb.checked = !useAll && selected.includes(String(cb.value || ''));
        });
        updatePdfColumnsToggleLabel();
    };

    const getPdfColumnsState = () => {
        const all = bySel('#kg-pdf-columns-all');
        const options = bySel('#kg-pdf-columns-options');
        const order = [];
        const selected = [];
        if (options) {
            options.querySelectorAll('.kg-pdf-col-row').forEach((row) => {
                const key = String(row.getAttribute('data-col') || '');
                if (!key) {
                    return;
                }
                order.push(key);
                const cb = row.querySelector('input[type="checkbox"]');
                if (cb && cb.checked) {
                    selected.push(key);
                }
            });
        }
        const orientations = {};
        PDF_ORIENTATION_EXPORTS.forEach((kind) => {
            orientations[kind] = getPdfOrientation(kind);
        });
        return {all: !!(all && all.checked), order, selected, orientation: getPdfOrientation(), orientations};
    };

    // Papierformat je Export: ZIM-Papier startet im Querformat, Konzeptsammlung,
    // Materialliste und Handout im Hochformat (so sahen sie vor der Wahl aus).
    const getPdfOrientation = (kind = 'zim') => {
        const name = kind === 'zim' ? 'kg-pdf-orientation' : `kg-pdf-orientation-${kind}`;
        const checked = document.querySelector(`input[name="${name}"]:checked`);
        if (!checked) {
            return kind === 'zim' ? 'landscape' : 'portrait';
        }
        return checked.value === 'portrait' ? 'portrait' : 'landscape';
    };

    const savePdfColumns = (cmid) => {
        if (pdfColumnsSaveTimer) {
            window.clearTimeout(pdfColumnsSaveTimer);
        }
        pdfColumnsSaveTimer = window.setTimeout(() => {
            const state = getPdfColumnsState();
            pdfColumnsSetting = state;
            asCall('mod_seminarplaner_set_pdf_columns', {
                cmid,
                columnsjson: JSON.stringify(state)
            }).catch(() => {
                // Speichern des Settings darf den Export nie blockieren.
            });
        }, 500);
    };

    const bindPdfColumnsDropdown = (cmid) => {
        const root = bySel('#kg-pdf-columns-dropdown');
        const toggle = bySel('#kg-pdf-columns-toggle');
        const panel = bySel('#kg-pdf-columns-panel');
        const all = bySel('#kg-pdf-columns-all');
        const options = bySel('#kg-pdf-columns-options');
        if (!toggle || !panel || !all || !options) {
            return;
        }
        applyPdfColumnsSetting();
        toggle.addEventListener('click', () => panel.classList.toggle('kg-hidden'));
        document.addEventListener('click', (event) => {
            if (root && !root.contains(event.target)) {
                panel.classList.add('kg-hidden');
            }
        });
        all.addEventListener('change', () => {
            if (all.checked) {
                options.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
                    cb.checked = false;
                });
            }
            updatePdfColumnsToggleLabel();
            savePdfColumns(cmid);
        });
        options.addEventListener('change', (event) => {
            const target = event.target;
            if (!target || target.type !== 'checkbox') {
                return;
            }
            if (all) {
                all.checked = false;
            }
            updatePdfColumnsToggleLabel();
            savePdfColumns(cmid);
        });
        // D63: ◄/► verschieben eine Spalte in der Export-Reihenfolge.
        options.addEventListener('click', (event) => {
            const btn = event.target.closest ? event.target.closest('.kg-pdf-col-btn') : null;
            if (!btn) {
                return;
            }
            const row = btn.closest('.kg-pdf-col-row');
            if (!row) {
                return;
            }
            const dir = btn.getAttribute('data-move');
            if (dir === 'left' && row.previousElementSibling) {
                options.insertBefore(row, row.previousElementSibling);
            } else if (dir === 'right' && row.nextElementSibling) {
                options.insertBefore(row.nextElementSibling, row);
            } else {
                return;
            }
            savePdfColumns(cmid);
        });
        updatePdfColumnsToggleLabel();
    };

    const getPdfColumnValue = (item, key) => {
        const details = item && item.details ? item.details : {};
        const unit = getUnitForPdf(item);
        if (unit) {
            switch (key) {
                case 'uhrzeit':
                    return `${formatTimeForPdf(item.startMin)} – ${formatTimeForPdf(item.endMin)}`;
                case 'titel':
                    return escapeTextForPdf(unit.title || item.title || '');
                case 'referent':
                    return joinUniquePdfValues(
                        unit.methods.reduce((names, method) => names.concat(referentNames(method.referenten)), [])
                    );
                case 'seminarphase':
                    return joinUniquePdfValues(unit.methods.map((method) => normalizePhaseText(method.phase || '')));
                case 'kurzbeschreibung': {
                    const parts = [];
                    const topics = escapeTextForPdf(unit.topics || '');
                    if (topics) {
                        parts.push(`Bausteininhalt: ${topics}`);
                    }
                    const methodDescriptions = joinMethodPdfValues(unit, 'Kurzbeschreibung',
                        (method) => method.details.description);
                    if (methodDescriptions) {
                        parts.push(methodDescriptions);
                    }
                    return parts.join('\n');
                }
                case 'ablauf':
                    return joinMethodPdfValues(unit, 'Ablauf', (method) => method.details.flow);
                case 'debrief':
                    return joinMethodPdfValues(unit, 'Debrief', (method) => method.details.reflection);
                case 'lernziele': {
                    const parts = [];
                    const objectives = escapeTextForPdf(unit.objectives || '');
                    if (objectives) {
                        parts.push(`Bausteinziele: ${objectives}`);
                    }
                    const methodObjectives = joinMethodPdfValues(unit, 'Lernziele', (method) => method.details.objectives);
                    if (methodObjectives) {
                        parts.push(methodObjectives);
                    }
                    return parts.join('\n');
                }
                case 'risiken':
                    return joinMethodPdfValues(unit, 'Risiken', (method) => method.details.risks);
                case 'materialtechnik':
                    return joinMethodPdfValues(unit, 'Material/Technik', (method) => method.details.materials);
                case 'sonstiges':
                    return '';
                default:
                    return '';
            }
        }
        switch (key) {
            case 'uhrzeit':
                return `${formatTimeForPdf(item.startMin)} – ${formatTimeForPdf(item.endMin)}`;
            case 'titel':
                return escapeTextForPdf(item.title || '');
            case 'referent':
                return escapeTextForPdf(referentNames(item.referenten).join(', '));
            case 'seminarphase':
                return escapeTextForPdf(normalizePhaseText(item.phase || details.phase || ''));
            case 'kurzbeschreibung':
                return escapeTextForPdf(details.description || '');
            case 'ablauf':
                return escapeTextForPdf(details.flow || '');
            case 'debrief':
                return escapeTextForPdf(details.reflection || '');
            case 'lernziele':
                return escapeTextForPdf(details.objectives || '');
            case 'risiken':
                return escapeTextForPdf(details.risks || '');
            case 'materialtechnik':
                return escapeTextForPdf(details.materials || '');
            case 'sonstiges':
                return '';
            default:
                return '';
        }
    };

    // D52: Logo-Format aus der Data-URL ableiten (jsPDF erwartet PNG/JPEG/GIF/WEBP).
    const detectPdfLogoFormat = (dataurl) => {
        const match = /^data:image\/([a-z0-9.+-]+)/i.exec(String(dataurl || ''));
        const mime = match ? match[1].toLowerCase() : 'png';
        if (mime === 'jpg' || mime === 'jpeg') {
            return 'JPEG';
        }
        if (mime === 'gif') {
            return 'GIF';
        }
        if (mime === 'webp') {
            return 'WEBP';
        }
        return 'PNG';
    };

    // D52: Logo aus PHP übernehmen und die Bildmaße vorab bestimmen, damit das
    // Stempeln beim Export synchron ohne Ladeverzögerung erfolgen kann.
    const preparePdfLogo = (logo) => {
        pdfLogoRaw = (logo && logo.dataurl) ? logo : null;
        if (!logo || !logo.dataurl) {
            pdfLogo = null;
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                pdfLogo = {
                    dataurl: logo.dataurl,
                    position: logo.position === 'left' ? 'left' : 'right',
                    format: detectPdfLogoFormat(logo.dataurl),
                    w: img.naturalWidth || img.width || 1,
                    h: img.naturalHeight || img.height || 1
                };
                resolve();
            };
            img.onerror = () => {
                pdfLogo = null;
                resolve();
            };
            img.src = logo.dataurl;
        });
    };

    // D52: Logo oben links/rechts in den Seitenkopf der aktuellen Seite stempeln.
    const stampPdfLogo = (doc) => {
        if (!pdfLogo || !pdfLogo.dataurl) {
            return;
        }
        try {
            const pageWidth = doc.internal.pageSize.getWidth();
            const maxH = 14;
            const maxW = 45;
            const scale = Math.min(maxH / pdfLogo.h, maxW / pdfLogo.w, 1);
            const w = pdfLogo.w * scale;
            const h = pdfLogo.h * scale;
            const x = pdfLogo.position === 'left' ? 14 : (pageWidth - 14 - w);
            doc.addImage(pdfLogo.dataurl, pdfLogo.format, x, 8, w, h);
        } catch (e) {
            // Logo-Fehler dürfen den PDF-Export nie blockieren.
            pdfLogo = null;
        }
    };

    // Seminarziele des geladenen Plans (Sequenz, D-Seminarziele): nur Ziele mit Text.
    const getSeminarGoalsForPdf = () => {
        const seq = (currentGridState && currentGridState.sequenz) || {};
        return (Array.isArray(seq.seminarziele) ? seq.seminarziele : [])
            .map((ziel) => String((ziel && ziel.text) || '').trim())
            .filter(Boolean);
    };

    const drawPdfTitlePage = (doc, title, meta, subtitle = '', options = {}) => {
        stampPdfLogo(doc);
        const pageHeight = doc.internal.pageSize.getHeight();
        let y = 48;
        doc.setFont(undefined, 'bold');
        doc.setFontSize(26);
        doc.text(escapeTextForPdf(title), 14, y);
        y += 12;
        if (subtitle) {
            doc.setFont(undefined, 'normal');
            doc.setFontSize(14);
            doc.text(escapeTextForPdf(subtitle), 14, y);
            y += 16;
        } else {
            y += 4;
        }

        const metaRows = [
            ['Titel', meta.title || ''],
            ['Datum', meta.date || ''],
            ['Seminarnummer', meta.number || ''],
            ['Kontakt', meta.contact || '']
        ];

        doc.setDrawColor(220, 224, 233);
        doc.setLineWidth(0.3);
        // Trennlinie über die volle Seitenbreite ziehen (zieht im Querformat mit).
        doc.line(14, y, doc.internal.pageSize.getWidth() - 14, y);
        y += 10;

        doc.setFontSize(11);
        metaRows.forEach(([label, value]) => {
            doc.setFont(undefined, 'bold');
            doc.text(`${label}:`, 14, y);
            doc.setFont(undefined, 'normal');
            doc.text(escapeTextForPdf(value) || '—', 52, y);
            y += 9;
        });

        // Seminarziele auf dem Deckblatt (ZIM-Papier, Konzeptsammlung) - nur,
        // wenn der Plan welche hat.
        const goals = options.goals ? getSeminarGoalsForPdf() : [];
        if (goals.length) {
            y += 6;
            doc.setFont(undefined, 'bold');
            doc.setFontSize(13);
            doc.text('Seminarziele', 14, y);
            y += 7;
            doc.setFont(undefined, 'normal');
            doc.setFontSize(10);
            const escape = (text) => text.replace(/[&<>]/g, (ch) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[ch]));
            renderHtmlToPdf(doc, `<ul>${goals.map((goal) => `<li>${escape(goal)}</li>`).join('')}</ul>`,
                14, y, doc.internal.pageSize.getWidth() - 28);
        }

        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        // Fußzeile auf der ersten Seite (bei sehr vielen Zielen kann das
        // Deckblatt umbrechen).
        doc.setPage(1);
        doc.text('Seminarplaner', 14, pageHeight - 14);
        doc.setPage(doc.getNumberOfPages());
    };

    const addBausteinCoverPage = (doc, day, unit, methodCount) => {
        doc.addPage();
        stampPdfLogo(doc);
        let y = 24;
        doc.setFont(undefined, 'bold');
        doc.setFontSize(20);
        doc.text('Baustein', 14, y);
        y += 10;

        doc.setFontSize(14);
        doc.text(escapeTextForPdf(unit.title || 'Baustein'), 14, y);
        y += 10;

        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        doc.text(`${escapeTextForPdf(day)} · ${methodCount} Seminareinheit(en)`, 14, y);
        y += 12;

        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text('Bausteininhalt:', 14, y);
        y += 6;
        doc.setFont(undefined, 'normal');
        const textWidth = doc.internal.pageSize.getWidth() - 30;
        y = renderHtmlToPdf(doc, unit.topics || '', 14, y, textWidth);
        if (y === 24 + 10 + 10 + 12 + 6) {
            doc.text('Keine Angaben.', 14, y);
            y += 6;
        }
        y += 6;

        doc.setFont(undefined, 'bold');
        doc.text('Bausteinziele:', 14, y);
        y += 6;
        doc.setFont(undefined, 'normal');
        const beforeObjectives = y;
        y = renderHtmlToPdf(doc, unit.objectives || '', 14, y, textWidth);
        if (y === beforeObjectives) {
            doc.text('Keine Angaben.', 14, y);
        }
    };

    const renderFlowMethodPage = (doc, day, item) => {
        stampPdfLogo(doc);
        let y = 20;
        const details = item && item.details ? item.details : {};
        const duration = Math.max(5, (Number(item.endMin) || 0) - (Number(item.startMin) || 0));

        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text(day, 14, y);
        y += 10;
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text(escapeTextForPdf(item.title || ''), 14, y);
        y += 8;

        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(`${formatTimeForPdf(item.startMin)}–${formatTimeForPdf(item.endMin)} · ${duration} Min`, 14, y);
        y += 8;

        const sections = [
            {label: 'Seminarphase', content: normalizePhaseText(item.phase || details.phase || '')},
            {label: 'Kognitive Dimension', content: getCognitiveLabel(item)},
            {label: 'Gruppengröße', content: item.group || details.group || ''},
            {label: 'Tags', content: item.tags || details.tags || ''},
            {label: 'Kurzbeschreibung', content: details.description || ''},
            {label: 'Raumanforderungen', content: details.requirements || ''},
            {label: 'Sozialform', content: details.socialform || ''},
            {label: 'Vorbereitungszeit', content: details.preparation || ''},
            {label: 'Ablauf', content: details.flow || ''},
            {label: 'Lernziele', content: details.objectives || ''},
            {label: 'Risiken/Tipps', content: details.risks || ''},
            {label: 'Debrief-/Reflexionsfragen', content: details.reflection || ''},
            {label: 'Material/Technik', content: details.materials || ''},
            {label: 'Zusätzliche Materialien', content: details.resources || ''},
            {label: 'Kontakt', content: details.contact || ''}
        ];

        sections.forEach((section) => {
            if (!escapeTextForPdf(section.content)) {
                return;
            }
            if (y > doc.internal.pageSize.getHeight() - 45) {
                doc.addPage();
                stampPdfLogo(doc);
                y = 20;
            }
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.text(`${section.label}:`, 14, y);
            y += 6;
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            y = renderHtmlToPdf(doc, section.content, 14, y, doc.internal.pageSize.getWidth() - 30);
            y += 5;
        });
    };

    const buildFlowUnitGroups = (day, entries) => {
        const sorted = entries.slice().sort((a, b) => (a.startMin || 0) - (b.startMin || 0));
        const unitsInOrder = [];
        const seenUnitIds = new Set();
        const methods = [];
        const addMethodToUnit = (unit, method) => {
            if (!unit || !method) {
                return;
            }
            const methodid = String(method.id || method.entryId || '').trim();
            const alreadyAdded = methodid && unit.methods.some((entry) => String(entry.id || entry.entryId || '') === methodid);
            if (!alreadyAdded) {
                unit.methods.push(method);
            }
        };
        sorted.forEach((entry) => {
            if (!entry || entry.kind === 'break') {
                return;
            }
            if (entry.kind === 'unit') {
                const unitid = String(entry.unitid || '').trim();
                const marker = unitid || `unit-title:${String(entry.title || '').trim().toLowerCase()}:${unitsInOrder.length}`;
                if (seenUnitIds.has(marker)) {
                    return;
                }
                seenUnitIds.add(marker);
                const planningUnit = unitid && planningUnitsById[unitid] ? planningUnitsById[unitid] : {};
                unitsInOrder.push({
                    unitId: unitid,
                    title: planningUnit.title || String(entry.title || 'Baustein'),
                    topics: planningUnit.topics || '',
                    objectives: planningUnit.objectives || '',
                    methods: getUnitMethodItemsForPdf(planningUnit, entry.startMin)
                });
                return;
            }
            if (entry.kind === 'method') {
                methods.push(entry);
            }
        });

        methods.forEach((method) => {
            const parentunit = String(method.parentunit || '').trim();
            if (!parentunit) {
                return;
            }
            let target = unitsInOrder.find((unit) => unit.unitId === parentunit);
            if (!target) {
                const fallback = planningUnitsById[parentunit] || {};
                target = {
                    unitId: parentunit,
                    title: fallback.title || 'Baustein',
                    topics: fallback.topics || '',
                    objectives: fallback.objectives || '',
                    methods: getUnitMethodItemsForPdf(fallback, method.startMin)
                };
                unitsInOrder.push(target);
            }
            addMethodToUnit(target, method);
        });

        const methodsWithoutUnit = methods.filter((method) => !String(method.parentunit || '').trim());
        return {day, units: unitsInOrder, methodsWithoutUnit};
    };

    const ensurePdfReady = () => {
        if (!window.jspdf || typeof window.jspdf.jsPDF !== 'function') {
            throw new Error('PDF-Library ist nicht geladen');
        }
        if (!currentGridState || !currentGridState.plan || !currentGridState.plan.days) {
            throw new Error('Bitte zuerst einen Seminarplan auswählen');
        }
        return window.jspdf.jsPDF;
    };

    // Infofeld je Seminarplan (Seminarzeiten, allgemeine Infos,
    // Vorbereitungstreffen …) als eigene Seite nach dem Deckblatt - nur, wenn
    // etwas drinsteht.
    const drawPdfInfoPage = (doc) => {
        const html = getPdfInfoHtml();
        if (!escapeTextForPdf(html)) {
            return;
        }
        doc.addPage();
        stampPdfLogo(doc);
        const right = doc.internal.pageSize.getWidth() - 14;
        let y = 26;
        doc.setFont(undefined, 'bold');
        doc.setFontSize(16);
        doc.text('Allgemeine Informationen', 14, y);
        y += 4;
        doc.setDrawColor(220, 224, 233);
        doc.setLineWidth(0.3);
        doc.line(14, y, right, y);
        y += 10;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        renderHtmlToPdf(doc, html, 14, y, right - 14);
    };

    const exportPdfZim = () => {
        const jsPDF = ensurePdfReady();
        const meta = getPdfMeta();
        const days = getOrderedDays();
        const plan = getPlanByDay();
        const selectedcols = getSelectedPdfColumns();
        // Querformat bietet mehr Platz für die nebeneinander stehenden Spalten,
        // Hochformat passt besser zu wenigen Spalten oder zum Abheften.
        const doc = new jsPDF({orientation: getPdfOrientation()});
        if (typeof doc.autoTable !== 'function') {
            throw new Error('PDF-Tabellenbibliothek nicht geladen');
        }

        drawPdfTitlePage(doc, 'ZIM', meta, 'Deckblatt', {goals: true});
        drawPdfInfoPage(doc);
        doc.addPage();
        let header = 'ZIM-Papier';
        if (meta.title) {
            header += ` - ${meta.title}`;
        }
        if (meta.date) {
            header += ` (${meta.date})`;
        }
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text(header, 14, 20);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        const line2 = [meta.number ? `Nr. ${meta.number}` : '', meta.contact].filter(Boolean).join(' · ');
        if (line2) {
            doc.text(line2, 14, 26);
        }

        const items = [];
        days.forEach((day) => {
            ((plan[day] || []).filter((entry) => entry && entry.kind !== 'break'))
                .slice()
                .sort((a, b) => (a.startMin || 0) - (b.startMin || 0))
                .forEach((entry) => {
                    items.push(entry);
                });
        });

        const headers = selectedcols.map((key) => PDF_COLUMN_LABELS[key] || key);
        const rows = items.map((item) => selectedcols.map((key) => getPdfColumnValue(item, key) || '—'));

        const widthMap = {
            uhrzeit: 25,
            titel: 35,
            referent: 28,
            seminarphase: 28,
            kurzbeschreibung: 40,
            debrief: 35,
            ablauf: 60,
            lernziele: 30,
            risiken: 35,
            materialtechnik: 35,
            sonstiges: 20
        };
        const pageWidth = doc.internal.pageSize.getWidth() - 28;
        let total = 0;
        selectedcols.forEach((key) => {
            total += widthMap[key] || 30;
        });
        const columnStyles = {};
        selectedcols.forEach((key, index) => {
            const base = widthMap[key] || 30;
            columnStyles[index] = {
                cellWidth: (base / total) * pageWidth,
                overflow: 'linebreak',
                cellPadding: 2
            };
        });

        doc.autoTable({
            head: [headers],
            body: rows,
            startY: line2 ? 32 : 30,
            styles: {fontSize: 8, cellPadding: 2},
            headStyles: {fillColor: [43, 104, 197], textColor: 255, fontStyle: 'bold'},
            alternateRowStyles: {fillColor: [245, 247, 250]},
            margin: {top: 30},
            columnStyles,
            didDrawPage: () => stampPdfLogo(doc)
        });

        const filename = meta.title ? `ZIM-${meta.title}.pdf` : 'ZIM-Papier.pdf';
        doc.save(filename);
    };

    const exportPdfFlow = () => {
        const jsPDF = ensurePdfReady();
        const meta = getPdfMeta();
        const days = getOrderedDays();
        const plan = getPlanByDay();
        const doc = new jsPDF({orientation: getPdfOrientation('flow')});

        drawPdfTitlePage(doc, 'ZIM', meta, 'Konzeptsammlung', {goals: true});
        drawPdfInfoPage(doc);

        days.forEach((day) => {
            const allItems = (plan[day] || []).filter((item) => !!item);
            if (!allItems.length) {
                return;
            }
            const grouped = buildFlowUnitGroups(day, allItems);
            grouped.units.forEach((unit) => {
                addBausteinCoverPage(doc, day, unit, unit.methods.length);
                unit.methods
                    .slice()
                    .sort((a, b) => (a.startMin || 0) - (b.startMin || 0))
                    .forEach((method) => {
                        doc.addPage();
                        renderFlowMethodPage(doc, day, method);
                    });
            });
            grouped.methodsWithoutUnit
                .slice()
                .sort((a, b) => (a.startMin || 0) - (b.startMin || 0))
                .forEach((method) => {
                    doc.addPage();
                    renderFlowMethodPage(doc, day, method);
                });
        });
        const filename = meta.title ? `Konzeptsammlung-${meta.title}.pdf` : 'Konzeptsammlung.pdf';
        doc.save(filename);
    };

    // D52: Freitext-Materialfeld in einzelne Abhak-Einträge zerlegen. Block- und
    // Zeilenumbrüche werden als Trenner erhalten, restliche Tags entfernt.
    const splitMaterialEntries = (text) => {
        const withBreaks = String(text || '')
            .replace(/<\s*br\s*\/?\s*>/gi, '\n')
            .replace(/<\/\s*(?:p|div|li|tr)\s*>/gi, '\n')
            .replace(/<[^>]*>/g, ' ');
        const decoder = document.createElement('textarea');
        decoder.innerHTML = withBreaks;
        return (decoder.value || '')
            .split(/\r?\n|;|•|·|,/)
            .map((entry) => entry.replace(/^[\s\-–—*·•]+/, '').replace(/\s+/g, ' ').trim())
            .filter(Boolean);
    };

    // D52: Alle Materialeinträge eines Plan-Eintrags (Baustein oder Einzelmethode).
    const getMaterialEntriesForItem = (item) => {
        const unit = getUnitForPdf(item);
        const texts = [];
        if (unit) {
            unit.methods.forEach((method) => texts.push(method.details.materials || ''));
        } else {
            const details = item && item.details ? item.details : {};
            texts.push(details.materials || '');
        }
        const entries = [];
        texts.forEach((text) => splitMaterialEntries(text).forEach((entry) => entries.push(entry)));
        return entries;
    };

    // D52: Eigenständige Materialliste als Abgabeliste (pro Tag dedupliziert, zum Abhaken).
    const exportPdfMaterials = () => {
        const jsPDF = ensurePdfReady();
        const meta = getPdfMeta();
        const days = getOrderedDays();
        const plan = getPlanByDay();
        const doc = new jsPDF({orientation: getPdfOrientation('materials')});
        const pageHeight = doc.internal.pageSize.getHeight();
        const pageWidth = doc.internal.pageSize.getWidth();

        drawPdfTitlePage(doc, 'Materialliste', meta, 'Abgabeliste');
        drawPdfInfoPage(doc);

        let anyMaterial = false;
        days.forEach((day) => {
            const entries = (plan[day] || []).filter((entry) => entry && entry.kind !== 'break');
            const seen = {};
            const materials = [];
            entries.forEach((item) => {
                getMaterialEntriesForItem(item).forEach((material) => {
                    const key = material.toLowerCase();
                    if (!seen[key]) {
                        seen[key] = true;
                        materials.push(material);
                    }
                });
            });
            if (!materials.length) {
                return;
            }
            anyMaterial = true;

            doc.addPage();
            stampPdfLogo(doc);
            let y = 26;
            doc.setFont(undefined, 'bold');
            doc.setFontSize(16);
            doc.text(escapeTextForPdf(day), 14, y);
            y += 4;
            doc.setDrawColor(220, 224, 233);
            doc.setLineWidth(0.3);
            doc.line(14, y, pageWidth - 14, y);
            y += 10;

            doc.setFont(undefined, 'normal');
            doc.setFontSize(11);
            materials.forEach((material) => {
                const lines = doc.splitTextToSize(escapeTextForPdf(material), pageWidth - 42);
                const blockHeight = Math.max(8, lines.length * 6);
                if (y + blockHeight > pageHeight - 16) {
                    doc.addPage();
                    stampPdfLogo(doc);
                    y = 26;
                }
                doc.setDrawColor(120, 120, 120);
                doc.setLineWidth(0.4);
                doc.rect(14, y - 4, 5, 5);
                doc.text(lines, 24, y);
                y += blockHeight;
            });
        });

        if (!anyMaterial) {
            doc.addPage();
            stampPdfLogo(doc);
            doc.setFont(undefined, 'normal');
            doc.setFontSize(12);
            doc.text('Für diesen Seminarplan sind keine Materialien hinterlegt.', 14, 30);
        }

        const filename = meta.title ? `Materialliste-${meta.title}.pdf` : 'Materialliste.pdf';
        doc.save(filename);
    };

    // D64: Handout für Teilnehmende — PDF-Export des veröffentlichten Roten Fadens.
    // D64: Das Handout-PDF erzeugt das gemeinsame Modul mod_seminarplaner/handout —
    // derselbe Generator, den der Roter-Faden-Tab benutzt (Teilnehmende erzeugen es
    // dort selbst). Hier bleibt nur der Aufruf, damit beide Wege dasselbe Dokument
    // liefern.
    const exportPdfHandout = (cmid) => Handout.exportPdf(cmid, pdfLogoRaw, getPdfOrientation('handout'));

    const saveMethods = (cmid, newMethods) => {
        return asCall('mod_seminarplaner_save_method_cards', {
            cmid,
            methodsjson: JSON.stringify(newMethods)
        });
    };

    // Anhänge reisen als base64 im selben Speicheraufruf mit. Eine importierte
    // Bibliothek mit vielen Materialien wird damit zweistellig megabytegroß und
    // läuft in die POST-Grenze des Servers - die Antwort kommt dann ohne
    // Fehlertext zurück (leerer Fehlerdialog). Deshalb wird der Import
    // gestückelt: erst alle Einheiten ohne Dateiinhalte, danach die Inhalte in
    // Paketen. `save_method_cards` behält vorhandene Dateien, wenn ein Anhang
    // nur mit Namen (ohne contentbase64) übergeben wird - so ergänzt jedes
    // Paket den Bestand, statt ihn zu ersetzen.
    const SAVE_PAYLOAD_BUDGET_BYTES = 2 * 1024 * 1024;
    const ATTACHMENT_AREAS = ['materialien', 'h5p'];

    const withoutAttachmentContent = (method) => {
        if (!method || typeof method !== 'object') {
            return method;
        }
        const copy = Object.assign({}, method);
        ATTACHMENT_AREAS.forEach((area) => {
            if (!Array.isArray(copy[area])) {
                return;
            }
            copy[area] = copy[area].map((entry) => {
                if (!entry || typeof entry !== 'object' || !entry.contentbase64) {
                    return entry;
                }
                const stripped = Object.assign({}, entry);
                delete stripped.contentbase64;
                return stripped;
            });
        });
        return copy;
    };

    const collectAttachmentJobs = (methodList) => {
        const jobs = [];
        (Array.isArray(methodList) ? methodList : []).forEach((method, mi) => {
            if (!method || typeof method !== 'object') {
                return;
            }
            ATTACHMENT_AREAS.forEach((area) => {
                if (!Array.isArray(method[area])) {
                    return;
                }
                method[area].forEach((entry, ei) => {
                    if (entry && typeof entry === 'object' && entry.contentbase64) {
                        jobs.push({mi, area, ei, size: String(entry.contentbase64).length});
                    }
                });
            });
        });
        return jobs;
    };

    // Baut die Sendeliste eines Pakets: alle Einheiten ohne Dateiinhalte, nur
    // die Anhänge dieses Pakets mit Inhalt.
    const buildChunkPayload = (lightMethods, fullMethods, chunk) => {
        const payload = lightMethods.slice();
        const touched = new Map();
        chunk.forEach((job) => {
            if (!touched.has(job.mi)) {
                const copy = Object.assign({}, lightMethods[job.mi]);
                ATTACHMENT_AREAS.forEach((area) => {
                    if (Array.isArray(copy[area])) {
                        copy[area] = copy[area].slice();
                    }
                });
                touched.set(job.mi, copy);
                payload[job.mi] = copy;
            }
            const target = touched.get(job.mi);
            const source = fullMethods[job.mi];
            if (Array.isArray(target[job.area]) && source && Array.isArray(source[job.area])) {
                target[job.area][job.ei] = source[job.area][job.ei];
            }
        });
        return payload;
    };

    const saveMethodsChunked = async (cmid, newMethods, onProgress) => {
        const full = Array.isArray(newMethods) ? newMethods : [];
        const light = full.map(withoutAttachmentContent);
        const chunks = [];
        let current = [];
        let currentsize = 0;
        collectAttachmentJobs(full).forEach((job) => {
            if (current.length && (currentsize + job.size) > SAVE_PAYLOAD_BUDGET_BYTES) {
                chunks.push(current);
                current = [];
                currentsize = 0;
            }
            current.push(job);
            currentsize += job.size;
        });
        if (current.length) {
            chunks.push(current);
        }

        const total = chunks.length + 1;
        const report = (stepnr) => {
            if (typeof onProgress === 'function' && total > 1) {
                onProgress(stepnr, total);
            }
        };

        report(1);
        let result = await saveMethods(cmid, light);
        for (let i = 0; i < chunks.length; i++) {
            report(i + 2);
            result = await saveMethods(cmid, buildChunkPayload(light, full, chunks[i]));
        }
        return result;
    };

    // Fehler aus core/ajax haben nicht immer eine Nachricht: bricht die
    // Anfrage unterhalb von Moodle ab (zu große Nutzlast, 500er, Timeout),
    // kommt der reine jQuery-Fehler an - ohne message zeigte der
    // Fehlerdialog dann eine leere Fläche.
    const describeError = (e) => {
        if (!e) {
            return 'Unbekannter Fehler.';
        }
        if (typeof e === 'string') {
            return e;
        }
        const message = String(e.message || e.error || e.errorcode || '').trim();
        if (message) {
            return message;
        }
        const status = Number(e.status || 0);
        if (status === 413 || status === 0) {
            return 'Der Server hat die Anfrage ohne Fehlermeldung abgewiesen - vermutlich ist die Datei '
                + 'bzw. ein einzelner Anhang größer, als der Server annimmt.';
        }
        if (status) {
            return `Der Server antwortete mit HTTP ${status} ohne Fehlermeldung.`;
        }
        return 'Der Server hat die Anfrage ohne Fehlermeldung abgewiesen.';
    };

    const normalizeTitle = (title) => String(title || '').trim().toLowerCase();

    const mergeImportedMethods = (existingMethods, importedRows) => {
        const merged = Array.isArray(existingMethods) ? existingMethods.slice() : [];
        const stats = {
            added: 0,
            overwritten: 0,
            copied: 0,
            skipped: 0
        };

        importedRows.forEach((row) => {
            const incoming = row.method;
            const title = String(incoming.titel || '').trim();
            if (!title) {
                return;
            }

            const key = normalizeTitle(title);
            const existingIndex = merged.findIndex((m) => normalizeTitle(m.titel) === key);
            const resolution = row.duplicate ? String(row.resolution || 'replace') : 'add';

            if (existingIndex === -1) {
                merged.push(Object.assign({}, incoming, {id: incoming.id || uid()}));
                stats.added++;
                return;
            }
            if (resolution === 'skip') {
                stats.skipped++;
                return;
            }
            if (resolution === 'copy') {
                merged.push(Object.assign({}, incoming, {id: uid()}));
                stats.copied++;
                return;
            }
            if (resolution === 'replace') {
                const keepid = merged[existingIndex].id || uid();
                merged[existingIndex] = Object.assign({}, incoming, {id: keepid});
                stats.overwritten++;
            }
        });

        return {merged, stats};
    };

    const normalizeImportedPlanningUnits = (units) => {
        if (!Array.isArray(units)) {
            return [];
        }
        return units.map((unit) => {
            const baseid = String(unit && unit.id ? unit.id : '').trim();
            return {
                id: baseid || uid(),
                title: String(unit && unit.title ? unit.title : '').trim(),
                topics: String(unit && unit.topics ? unit.topics : ''),
                objectives: String(unit && unit.objectives ? unit.objectives : ''),
                methods: Array.isArray(unit && unit.methods) ? unit.methods : []
            };
        }).filter((unit) => !!unit.id);
    };

    const buildPayloadFromParsedObject = (parsed) => {
        const object = parsed && typeof parsed === 'object' ? parsed : {};
        const methodsArr = Array.isArray(object.methods) ? object.methods : [];
        const planningstate = object.planningstate && typeof object.planningstate === 'object' ? object.planningstate : null;
        const bausteineFromObject = Array.isArray(object.bausteine) ? object.bausteine : [];
        const bausteineFromState = planningstate && Array.isArray(planningstate.units) ? planningstate.units : [];
        const seminarplaene = Array.isArray(object.seminarplaene) ? object.seminarplaene : [];
        // Ältere Exportdateien führen die Bausteine nur im sequenz-Abschnitt der
        // Seminarpläne mit, weil der Export sie damals aus dem (leeren)
        // Planungszustand gezogen hat. Dann von dort lesen, sonst zeigt die
        // Vorschau „0 Bausteine", obwohl welche in der Datei stehen.
        const bausteinequelle = bausteineFromObject.length
            ? bausteineFromObject
            : (bausteineFromState.length ? bausteineFromState : bausteineFromPlans(seminarplaene));
        const bausteineArr = normalizeImportedPlanningUnits(bausteinequelle);
        const explicitComponents = object.components && typeof object.components === 'object' ? object.components : {};

        const hasMethods = !!(explicitComponents.methods || methodsArr.length);
        const hasUnits = !!(explicitComponents.bausteine || explicitComponents.units || bausteineArr.length || planningstate);
        const hasGrids = !!(explicitComponents.seminarplaene || explicitComponents.grids || seminarplaene.length);

        return {
            sourceformat: 'json',
            components: {
                methods: hasMethods,
                units: hasUnits,
                grids: hasGrids
            },
            methods: methodsArr,
            bausteine: bausteineArr,
            planningstate: planningstate || (bausteineArr.length ? {units: bausteineArr} : null),
            seminarplaene
        };
    };

    const buildMethodPreviewRows = (importMethods) => {
        const incoming = Array.isArray(importMethods) ? importMethods : [];
        const existingTitles = new Set(methods.map((m) => normalizeTitle(m.titel)));
        return incoming.map((m) => {
            const duplicate = existingTitles.has(normalizeTitle(m.titel));
            return {
                method: m,
                selected: true,
                duplicate,
                resolution: duplicate ? 'replace' : 'add'
            };
        });
    };

    const parseFile = async (file) => {
        const name = (file.name || '').toLowerCase();

        if (name.endsWith('.json')) {
            const text = await file.text();
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) {
                return {
                    sourceformat: 'json',
                    components: {methods: true, units: false, grids: false},
                    methods: parsed,
                    bausteine: [],
                    planningstate: null,
                    seminarplaene: []
                };
            }
            if (parsed && typeof parsed === 'object') {
                return buildPayloadFromParsedObject(parsed);
            }
            throw new Error('JSON muss ein Array oder ein gültiges Exportobjekt sein');
        }

        if (name.endsWith('.csv')) {
            const text = await file.text();
            const rows = parseCsvTable(text);
            const parsedMethods = rows.map(mapLegacyRowToMethod).filter((m) => m !== null);
            return {
                sourceformat: 'csv',
                components: {methods: true, units: false, grids: false},
                methods: parsedMethods,
                bausteine: [],
                planningstate: null,
                seminarplaene: []
            };
        }

        if (name.endsWith('.zip')) {
            if (!window.JSZip) {
                throw new Error('ZIP-Import benötigt JSZip');
            }
            const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
            const csvNames = Object.keys(zip.files).filter((n) => !zip.files[n].dir && n.toLowerCase().endsWith('.csv'));
            if (!csvNames.length) {
                throw new Error('Keine CSV im ZIP gefunden');
            }
            let best = csvNames[0];
            const preferred = csvNames.find((n) => /records/i.test(n));
            if (preferred) {
                best = preferred;
            }
            const text = await zip.files[best].async('string');
            const rows = parseCsvTable(text);
            const parsedMethods = rows.map(mapLegacyRowToMethod).filter((m) => m !== null);

            const zipfiles = Object.keys(zip.files)
                .filter((n) => !zip.files[n].dir && n.toLowerCase().startsWith('files/'))
                .reduce((acc, filename) => {
                    const base = filename.split('/').pop();
                    if (base) {
                        acc[base] = zip.files[filename];
                    }
                    return acc;
                }, {});

            for (const method of parsedMethods) {
                method.materialien = await Promise.all((method.materialien || []).map(async (name) => {
                    const f = zipfiles[name];
                    if (!f) {
                        return name;
                    }
                    return {
                        name,
                        contentbase64: await f.async('base64'),
                        mimetype: 'application/octet-stream'
                    };
                }));
            }

            return {
                sourceformat: 'zip',
                components: {methods: true, units: false, grids: false},
                methods: parsedMethods,
                bausteine: [],
                planningstate: null,
                seminarplaene: []
            };
        }

        throw new Error('Dateityp nicht unterstützt');
    };

    const bind = (cmid) => {
        const parsebtn = bySel('#kg-ie-parse');
        const fileinput = bySel('#kg-ie-file');
        const selectall = bySel('#kg-ie-select-all');
        const selectnone = bySel('#kg-ie-select-none');
        const importNow = bySel('#kg-ie-import-now');
        const exportJsonFullBtn = bySel('#kg-ie-export-json-full');
        const pdfGrid = bySel('#kg-pdf-grid');
        const pdfZimBtn = bySel('#kg-pdf-zim');
        const pdfFlowBtn = bySel('#kg-pdf-flow');
        const pdfMaterialsBtn = bySel('#kg-pdf-materials');
        const pdfHandoutBtn = bySel('#kg-pdf-handout');
        const globalSetSelect = bySel('#kg-global-set-select');
        const globalSetImportBtn = bySel('#kg-global-set-import');
        const globalSetApplyBtn = bySel('#kg-global-set-apply');
        bindPdfColumnsDropdown(cmid);
        bindPdfInfo(cmid);
        document.querySelectorAll('input[name^="kg-pdf-orientation"]').forEach((radio) => {
            radio.addEventListener('change', () => savePdfColumns(cmid));
        });

        if (parsebtn && fileinput) {
            fileinput.addEventListener('change', () => {
                const nameEl = bySel('#kg-ie-filename');
                if (nameEl) {
                    nameEl.textContent = (fileinput.files && fileinput.files[0])
                        ? fileinput.files[0].name
                        : 'Keine Datei ausgewählt';
                }
                currentImportPayload = null;
                previewRows = [];
                previewUnits = [];
                previewGrids = [];
                renderPreview();
                step(1);
                setImportStatus('', false);
            });
            parsebtn.addEventListener('click', async () => {
                setImportStatus('', false);
                if (!fileinput.files || !fileinput.files[0]) {
                    setStatus('Bitte zuerst eine Datei auswählen.', true);
                    return;
                }
                try {
                    currentImportPayload = await parseFile(fileinput.files[0]);
                    previewRows = buildMethodPreviewRows(currentImportPayload.methods);
                    previewUnits = (Array.isArray(currentImportPayload.bausteine)
                        ? currentImportPayload.bausteine
                        : []).map((unit) => ({
                            unit,
                            selected: true
                        }));
                    previewGrids = (Array.isArray(currentImportPayload.seminarplaene)
                        ? currentImportPayload.seminarplaene
                        : []).map((plan) => ({
                            plan,
                            selected: true
                        }));
                    renderPreview();
                    step(2);
                    const found = currentImportPayload.components || {};
                    const foundSummary = [
                        found.methods ? `${previewRows.length} Seminareinheiten` : 'keine Seminareinheiten',
                        found.units ? `${previewUnits.length} Bausteine` : 'keine Bausteine',
                        found.grids ? `${previewGrids.length} Seminarpläne` : 'keine Seminarpläne'
                    ].join(', ');
                    const msg = previewRows.length
                        ? `Datei analysiert: ${foundSummary}.`
                        : `Datei analysiert: ${foundSummary}. Es wurden keine Seminareinheiten zur Vorschau gefunden.`;
                    setStatus(msg, false);
                } catch (e) {
                    currentImportPayload = null;
                    previewRows = [];
                    previewUnits = [];
                    previewGrids = [];
                    renderPreview();
                    setStatus(`Analyse fehlgeschlagen: ${describeError(e)}`, true);
                }
            });
        }

        if (selectall) {
            selectall.addEventListener('click', () => {
                previewRows.forEach((r) => {
                    r.selected = true;
                });
                previewUnits.forEach((r) => {
                    r.selected = true;
                });
                previewGrids.forEach((r) => {
                    r.selected = true;
                });
                renderPreview();
            });
        }

        if (selectnone) {
            selectnone.addEventListener('click', () => {
                previewRows.forEach((r) => {
                    r.selected = false;
                });
                previewUnits.forEach((r) => {
                    r.selected = false;
                });
                previewGrids.forEach((r) => {
                    r.selected = false;
                });
                renderPreview();
            });
        }

        if (importNow) {
            importNow.addEventListener('click', async () => {
                if (!currentImportPayload) {
                    setImportStatus('Bitte zuerst eine Datei analysieren.', true);
                    return;
                }
                const successParts = [];
                const postLoads = [];
                try {
                    const selectedRows = previewRows.filter((r) => r.selected);
                    const selectedUnits = previewUnits.filter((row) => row.selected).map((row) => row.unit);
                    const seminarplaene = previewGrids.filter((row) => row.selected).map((row) => row.plan);

                    if (!selectedRows.length && !selectedUnits.length && !seminarplaene.length) {
                        setImportStatus('Keine Einträge ausgewählt.', true);
                        return;
                    }

                    if (selectedRows.length) {
                        const result = mergeImportedMethods(methods, selectedRows);
                        const saveres = await saveMethodsChunked(cmid, result.merged, (stepnr, total) => {
                            setImportStatus(`Import läuft … Paket ${stepnr} von ${total} wird übertragen.`, false);
                        });
                        methods = result.merged;
                        successParts.push(
                            `Seminareinheiten: ${selectedRows.length} verarbeitet (+${result.stats.added}, `
                                + `überschrieben ${result.stats.overwritten}, Kopien ${result.stats.copied}, `
                                + `nicht hinzugefügt ${result.stats.skipped}; gesamt ${saveres.count})`
                        );
                        postLoads.push(loadMethods(cmid));
                    }

                    if (selectedUnits.length) {
                        const importedstate = currentImportPayload.planningstate
                            && typeof currentImportPayload.planningstate === 'object'
                            ? Object.assign({}, currentImportPayload.planningstate)
                            : {units: selectedUnits};
                        const selectedUnitIds = new Set(selectedUnits
                            .map((unit) => String(unit && unit.id ? unit.id : '').trim())
                            .filter(Boolean));
                        if (!Array.isArray(importedstate.units)) {
                            importedstate.units = selectedUnits;
                        } else {
                            importedstate.units = importedstate.units.filter((unit) => {
                                const id = String(unit && unit.id ? unit.id : '').trim();
                                return id && selectedUnitIds.has(id);
                            });
                        }
                        const saveres = await asCall('mod_seminarplaner_save_planning_state', {
                            cmid,
                            statejson: JSON.stringify(importedstate),
                            expectedhash: planningVersionHash || ''
                        });
                        planningVersionHash = String(saveres && saveres.versionhash ? saveres.versionhash : planningVersionHash);
                        successParts.push(`Bausteine: ${(importedstate.units || []).length} importiert`);
                        postLoads.push(loadPlanningState(cmid));
                    }

                    if (seminarplaene.length) {
                        let importedCount = 0;
                        for (const plan of seminarplaene) {
                            const name = String(plan && plan.name ? plan.name : '').trim() || `Seminarplan ${importedCount + 1}`;
                            const description = String(plan && plan.description ? plan.description : '');
                            const state = plan && typeof plan.state === 'object' ? plan.state : {};
                            const created = await asCall('mod_seminarplaner_create_grid', {cmid, name, description});
                            const gridid = Number(created && created.gridid ? created.gridid : 0);
                            if (!gridid) {
                                continue;
                            }
                            await asCall('mod_seminarplaner_save_user_state', {
                                cmid,
                                gridid,
                                statejson: JSON.stringify(state),
                                expectedhash: ''
                            });
                            importedCount++;
                        }
                        successParts.push(`Seminarpläne: ${importedCount} importiert`);
                        postLoads.push(loadGrids(cmid));
                    }

                    await Promise.all(postLoads);
                    previewRows = [];
                    previewUnits = [];
                    previewGrids = [];
                    currentImportPayload = null;
                    const host = bySel('#kg-ie-preview');
                    if (host) {
                        host.innerHTML = '';
                    }
                    if (fileinput) {
                        fileinput.value = '';
                    }
                    step(1);
                    setImportStatus(`Import erfolgreich: ${successParts.join(' | ')}`, false);
                } catch (e) {
                    const message = describeError(e);
                    if (e && e.message) {
                        Notification.exception(e);
                    }
                    setImportStatus(`Import fehlgeschlagen: ${message}`, true);
                }
            });
        }

        if (exportJsonFullBtn) {
            exportJsonFullBtn.addEventListener('click', async () => {
                try {
                    await exportJsonFull(cmid);
                } catch (e) {
                    setStatus(`JSON-Export fehlgeschlagen: ${e.message || e}`, true);
                }
            });
        }
        if (pdfGrid) {
            pdfGrid.addEventListener('change', () => {
                const gridid = Number.parseInt(pdfGrid.value || '0', 10) || 0;
                PlanMemory.remember(cmid, gridid);
                // Offenes Infofeld des bisherigen Plans erst sichern, dann umschalten.
                (pdfInfoTimer ? savePdfInfo(cmid, true) : Promise.resolve()).then(() => loadPdfInfo(cmid, gridid));
                loadGridState(cmid, gridid).then(() => {
                    if (currentGridState && currentGridState.meta) {
                        if (bySel('#kg-pdf-title') && !bySel('#kg-pdf-title').value) {
                            bySel('#kg-pdf-title').value = currentGridState.meta.title || '';
                        }
                        if (bySel('#kg-pdf-date') && !bySel('#kg-pdf-date').value) {
                            bySel('#kg-pdf-date').value = currentGridState.meta.date || '';
                        }
                        if (bySel('#kg-pdf-number') && !bySel('#kg-pdf-number').value) {
                            bySel('#kg-pdf-number').value = currentGridState.meta.number || '';
                        }
                        if (bySel('#kg-pdf-contact') && !bySel('#kg-pdf-contact').value) {
                            bySel('#kg-pdf-contact').value = currentGridState.meta.contact || '';
                        }
                    }
                    setStatus('Seminarplan für PDF geladen.', false);
                }).catch((e) => {
                    Notification.exception(e);
                    setStatus('Seminarplan konnte nicht geladen werden.', true);
                });
            });
        }
        if (pdfZimBtn) {
            pdfZimBtn.addEventListener('click', () => {
                try {
                    exportPdfZim();
                    setStatus('ZIM-PDF erstellt.', false);
                } catch (e) {
                    setStatus(`PDF-Export fehlgeschlagen: ${e.message || e}`, true);
                }
            });
        }
        if (pdfFlowBtn) {
            pdfFlowBtn.addEventListener('click', () => {
                try {
                    exportPdfFlow();
                    setStatus('Konzeptsammlungs-PDF erstellt.', false);
                } catch (e) {
                    setStatus(`PDF-Export fehlgeschlagen: ${e.message || e}`, true);
                }
            });
        }
        if (pdfMaterialsBtn) {
            pdfMaterialsBtn.addEventListener('click', () => {
                try {
                    exportPdfMaterials();
                    setStatus('Materiallisten-PDF erstellt.', false);
                } catch (e) {
                    setStatus(`PDF-Export fehlgeschlagen: ${e.message || e}`, true);
                }
            });
        }
        if (pdfHandoutBtn) {
            // D64: Handout aus dem veröffentlichten Roten Faden.
            pdfHandoutBtn.addEventListener('click', () => {
                setStatus('Handout wird erstellt …', false);
                exportPdfHandout(cmid)
                    .then(() => setStatus('Handout-PDF erstellt.', false))
                    .catch((e) => setStatus(`Handout-Export fehlgeschlagen: ${e.message || e}`, true));
            });
        }
        if (globalSetImportBtn) {
            globalSetImportBtn.addEventListener('click', () => {
                const setid = Number.parseInt(globalSetSelect ? (globalSetSelect.value || '0') : '0', 10) || 0;
                if (!setid) {
                    setGlobalStatus('Bitte zuerst ein Seminarkonzept auswählen.', true);
                    return;
                }
                asCall('mod_seminarplaner_import_global_methodset', {cmid, methodsetid: setid})
                    .then((res) => {
                        // loadGlobalMethodsets neu: das eben uebernommene
                        // Konzept faellt damit aus der Auswahl.
                        return Promise.all([
                            loadMethods(cmid),
                            loadGlobalSyncStatus(cmid),
                            loadGlobalMethodsets(cmid),
                        ]).then(() => res);
                    })
                    .then((res) => {
                        refreshGlobalSyncUi();
                        // D32: beim Seminarkonzept entsteht zusätzlich ein
                        // neuer Plan (nie überschreibend).
                        setGlobalStatus(res.plancreated
                            ? `Import erfolgreich: Seminarkonzept "${res.setname}" als neuer Plan „${res.planname}" angelegt, `
                                + `${res.importedcount} Seminareinheiten übernommen (insgesamt ${res.totalcount}).`
                            : `Import erfolgreich: ${res.importedcount} Seminareinheiten aus "${res.setname}" in die Bibliothek `
                                + `übernommen (insgesamt ${res.totalcount}). Dieses Konzept enthält keinen Seminarplan, `
                                + `deshalb wurde kein Plan angelegt.`,
                            false
                        );
                    })
                    .catch((e) => {
                        Notification.exception(e);
                        setGlobalStatus('Übernehmen fehlgeschlagen.', true);
                    });
            });
        }
        if (globalSetSelect) {
            globalSetSelect.addEventListener('change', refreshGlobalSyncUi);
        }
        if (globalSetApplyBtn) {
            globalSetApplyBtn.addEventListener('click', () => {
                const selected = getSelectedSyncLink();
                if (!selected) {
                    setGlobalStatus('Bitte zuerst eine verknüpfte Methoden-Sammlung auswählen.', true);
                    return;
                }
                asCall('mod_seminarplaner_apply_methodset_updates', {
                    cmid,
                    methodsetid: Number(selected.methodsetid)
                }).then((res) => {
                    if (!res || !res.updated) {
                        setGlobalStatus('Keine ausstehenden Updates zu übernehmen.', false);
                        return Promise.resolve();
                    }
                    return Promise.all([loadMethods(cmid), loadGlobalSyncStatus(cmid)]).then(() => {
                        setGlobalStatus('Ausstehende Updates wurden übernommen.', false);
                    });
                }).then(() => {
                    refreshGlobalSyncUi();
                }).catch((e) => {
                    Notification.exception(e);
                    setGlobalStatus('Übernehmen der Updates fehlgeschlagen.', true);
                });
            });
        }

    };

    // D63b/D64: Deep-Link aus dem Überblick (ZIM) bzw. Roten Faden (Handout) —
    // denselben Export-Flow ohne zweiten Mechanismus auslösen.
    const runDeepLinkExport = (cmid) => {
        let params;
        try {
            params = new URLSearchParams(window.location.search);
        } catch (e) {
            return;
        }
        const action = params.get('pdfaction');
        if (!action) {
            return;
        }
        const pdfCard = bySel('#kg-pdf-grid') ? bySel('#kg-pdf-grid').closest('.kg-ie-card') : null;
        if (pdfCard && pdfCard.scrollIntoView) {
            pdfCard.scrollIntoView({behavior: 'smooth', block: 'start'});
        }
        if (action === 'handout') {
            setStatus('Handout wird erstellt …', false);
            exportPdfHandout(cmid)
                .then(() => setStatus('Handout-PDF erstellt.', false))
                .catch((e) => setStatus(`Handout-Export fehlgeschlagen: ${e.message || e}`, true));
            return;
        }
        // Plan-gebundene Exporte (ZIM, Konzeptsammlung, Materialliste): erst den
        // übergebenen Plan laden, dann denselben Export wie im Tab auslösen.
        const gridExports = {
            zim: {fn: exportPdfZim, label: 'ZIM-PDF'},
            flow: {fn: exportPdfFlow, label: 'Konzeptsammlungs-PDF'},
            materials: {fn: exportPdfMaterials, label: 'Materiallisten-PDF'}
        };
        const target = gridExports[action];
        if (!target) {
            return;
        }
        const gridid = Number.parseInt(params.get('pdfgrid') || '0', 10) || 0;
        if (!gridid) {
            setStatus('Kein Seminarplan für den Export übergeben.', true);
            return;
        }
        const select = bySel('#kg-pdf-grid');
        if (select) {
            select.value = String(gridid);
        }
        setStatus('Seminarplan wird geladen …', false);
        loadGridState(cmid, gridid).then(() => {
            if (currentGridState && currentGridState.meta) {
                ['title', 'date', 'number', 'contact'].forEach((key) => {
                    const el = bySel(`#kg-pdf-${key}`);
                    if (el && !el.value) {
                        el.value = currentGridState.meta[key] || '';
                    }
                });
            }
            target.fn();
            setStatus(`${target.label} erstellt.`, false);
        }).catch((e) => {
            setStatus(`Export fehlgeschlagen: ${e.message || e}`, true);
        });
    };

    return {
        init: function(cmid, logo, columns) {
            pdfColumnsSetting = columns && typeof columns === 'object' ? columns : null;
            ensureExternalLibraries().then(() => {
                return Promise.all([
                    loadMethods(cmid),
                    loadGrids(cmid),
                    loadPlanningState(cmid),
                    loadGlobalMethodsets(cmid),
                    loadGlobalSyncStatus(cmid),
                    loadReferenten(cmid),
                    preparePdfLogo(logo)
                ]);
            }).then(() => {
                    bind(cmid);
                    const pdfselect = bySel('#kg-pdf-grid');
                    if (pdfselect && pdfselect.getAttribute('data-preselected') === '1') {
                        pdfselect.removeAttribute('data-preselected');
                        pdfselect.dispatchEvent(new Event('change'));
                    }
                    step(1);
                    refreshGlobalSyncUi();
                    runDeepLinkExport(cmid);
                }).catch((e) => {
                    Notification.exception(e);
                    setStatus('Initialisierung fehlgeschlagen.', true);
                });
        }
    };
});
