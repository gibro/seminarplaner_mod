define(['core/ajax', 'core/notification'], function(Ajax, Notification) {
    const bySel = (sel) => document.querySelector(sel);
    const asCall = (methodname, args) => Ajax.call([{methodname, args}])[0];
    const uid = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const escapeHtml = (str) => String(str || '').replace(/[&<>"']/g, (ch) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch] || ch));

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
    let pendingAutosyncPrefs = {};
    const PDF_COLUMN_ORDER = ['uhrzeit', 'titel', 'seminarphase', 'kognitive', 'kurzbeschreibung', 'debrief', 'ablauf', 'lernziele', 'risiken', 'materialtechnik', 'sonstiges'];
    const PDF_COLUMN_LABELS = {
        uhrzeit: 'Uhrzeit',
        titel: 'Titel',
        seminarphase: 'Seminarphase',
        kognitive: 'Kognitive Dimension',
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
            seminarphase: splitMultiString(readFirst(row, ['Seminarphase', 'seminarphase'])),
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
                <span class="kg-ie-meta">⏱️ ${escapeHtml(row.method.zeitbedarf || '-')} · 👥 ${escapeHtml(row.method.gruppengroesse || '-')}</span>
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
        const visibleGrids = Array.isArray(grids) ? grids.filter((grid) => Number(grid && grid.isarchived ? grid.isarchived : 0) === 0) : [];
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

    const exportJsonFull = async (cmid) => {
        const selection = getComponentSelection('export');
        if (selectedComponentCount(selection) === 0) {
            throw new Error('Bitte mindestens eine Komponente auswählen (Seminareinheiten, Bausteine oder Seminarpläne).');
        }
        const bausteine = Object.entries(planningUnitsById || {}).map(([id, unit]) => ({
            id: String(id),
            title: String(unit && unit.title ? unit.title : ''),
            topics: String(unit && unit.topics ? unit.topics : ''),
            objectives: String(unit && unit.objectives ? unit.objectives : '')
        }));
        const seminarplaene = selection.grids ? await collectSeminarplaeneForExport(cmid) : [];
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
        if (selection.methods) {
            payload.methods = Array.isArray(methods) ? methods : [];
        }
        if (selection.units) {
            payload.bausteine = bausteine;
            payload.planningstate = planningState && typeof planningState === 'object' ? planningState : {units: bausteine};
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
        setStatus(`Seminarplaner-JSON exportiert (${exportedMethods} Seminareinheiten, ${exportedUnits} Bausteine, ${exportedGrids} Seminarpläne).`, false);
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
        });
    };

    const loadGlobalMethodsets = (cmid) => {
        const select = bySel('#kg-global-set-select');
        if (!select) {
            return Promise.resolve();
        }
        return asCall('mod_seminarplaner_list_global_methodsets', {cmid}).then((res) => {
            globalMethodsets = Array.isArray(res.methodsets) ? res.methodsets : [];
            select.innerHTML = '<option value="">Bitte wählen</option>';
            globalMethodsets.forEach((set) => {
                const opt = document.createElement('option');
                opt.value = String(set.id);
                opt.textContent = `${set.displayname}`;
                select.appendChild(opt);
            });
            if (res.available === false) {
                setGlobalStatus(res.message || 'Local-Plugin nicht verfügbar.', true);
            } else if (res.message) {
                setGlobalStatus(res.message, true);
            } else if (!globalMethodsets.length) {
                setGlobalStatus('Keine veröffentlichten globalen Konzepte gefunden.', false);
            } else {
                setGlobalStatus(`${globalMethodsets.length} globale Konzepte verfügbar.`, false);
            }
        }).catch((e) => {
            setGlobalStatus(`Globale Konzepte konnten nicht geladen werden: ${e.message || e}`, true);
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

    const refreshGlobalSyncUi = () => {
        const autoswitch = bySel('#kg-global-set-autosync');
        const select = bySel('#kg-global-set-select');
        const applybtn = bySel('#kg-global-set-apply');
        const selected = getSelectedSyncLink();
        if (!autoswitch || !applybtn) {
            return;
        }
        const setid = Number.parseInt(select ? (select.value || '0') : '0', 10) || 0;
        if (!setid) {
            autoswitch.checked = false;
            autoswitch.disabled = true;
            applybtn.disabled = true;
            setGlobalSyncInfo('Bitte zuerst ein globales Konzept auswählen.', false);
            return;
        }
        if (!selected) {
            autoswitch.disabled = false;
            autoswitch.checked = !!pendingAutosyncPrefs[setid];
            applybtn.disabled = true;
            setGlobalSyncInfo(
                'Dieses Konzept ist noch nicht verknüpft. Auto-Update wird nach dem Import angewendet.',
                false
            );
            return;
        }
        autoswitch.disabled = false;
        autoswitch.checked = !!selected.autosyncenabled;
        const hasPending = !!selected.haspending || (Number(selected.currentversionid) > Number(selected.linkedversionid));
        applybtn.disabled = !hasPending;
        if (hasPending) {
            setGlobalSyncInfo(
                `Update verfügbar (aktuell ${selected.linkedversionid}, global ${selected.currentversionid}). ` +
                `Mit "Ausstehende Updates übernehmen" lokal anwenden.`,
                false
            );
        } else {
            setGlobalSyncInfo('Aktivität ist auf dem aktuellen Stand dieses Konzepts.', false);
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
                    objectives: String(unit.objectives || '')
                };
            });
        }).catch(() => {
            planningUnitsById = {};
            planningState = {};
            planningVersionHash = '';
        });
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

    const getPlanByDay = () => {
        if (!currentGridState || !currentGridState.plan || !currentGridState.plan.days) {
            return {};
        }
        return currentGridState.plan.days;
    };

    const getOrderedDays = () => {
        const configdays = currentGridState && currentGridState.config ? currentGridState.config.days : null;
        if (Array.isArray(configdays) && configdays.length) {
            return configdays;
        }
        return ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
    };

    const formatTime = (min) => {
        const h = Math.floor((Number(min) || 0) / 60);
        const m = (Number(min) || 0) % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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

    const renderHtmlToPdf = (doc, html, x, y, maxWidth) => {
        if (!html) {
            return y;
        }
        const div = document.createElement('div');
        div.innerHTML = String(html);

        let currentY = y;
        const lineHeight = 4;
        const paragraphGap = 1.2;
        const listGap = 0.4;
        const listItemGap = 0.15;
        const listIndent = 6;
        let isFirstElement = true;

        const processNode = (node, indent = 0, linkUrl = '') => {
            if (currentY > 280) {
                doc.addPage();
                currentY = 20;
            }
            if (node.nodeType === Node.TEXT_NODE) {
                const text = normalizePdfText(node.textContent || '', false);
                if (text.trim()) {
                    const compactText = text.replace(/[ \t]+/g, ' ');
                    const lines = doc.splitTextToSize(compactText, Math.max(20, maxWidth - indent));
                    if (linkUrl && typeof doc.textWithLink === 'function') {
                        const oldColor = doc.getTextColor();
                        doc.setTextColor(25, 92, 179);
                        lines.forEach((line) => {
                            doc.textWithLink(String(line), x + indent, currentY, {url: linkUrl});
                            currentY += lineHeight;
                        });
                        doc.setTextColor(oldColor);
                    } else {
                        doc.text(lines, x + indent, currentY);
                        currentY += lines.length * lineHeight;
                    }
                }
                return;
            }
            if (node.nodeType !== Node.ELEMENT_NODE) {
                return;
            }
            const tag = node.tagName.toLowerCase();
            const saved = doc.getFont().fontStyle || 'normal';

            if (tag === 'strong' || tag === 'b') {
                doc.setFont(undefined, 'bold');
                Array.from(node.childNodes).forEach((child) => processNode(child, indent, linkUrl));
                doc.setFont(undefined, saved);
                return;
            }
            if (tag === 'em' || tag === 'i') {
                doc.setFont(undefined, 'italic');
                Array.from(node.childNodes).forEach((child) => processNode(child, indent, linkUrl));
                doc.setFont(undefined, saved);
                return;
            }
            if (tag === 'a') {
                const hrefRaw = String(node.getAttribute('href') || '').trim();
                const href = /^(https?:\/\/|mailto:)/i.test(hrefRaw) ? hrefRaw : '';
                Array.from(node.childNodes).forEach((child) => processNode(child, indent, href || linkUrl));
                return;
            }
            if (tag === 'br') {
                currentY += 2;
                return;
            }
            if (tag === 'p') {
                if (!isFirstElement && currentY > y) {
                    currentY += paragraphGap;
                }
                isFirstElement = false;
                Array.from(node.childNodes).forEach((child) => processNode(child, indent, linkUrl));
                currentY += paragraphGap;
                return;
            }
            if (tag === 'ul' || tag === 'ol') {
                if (!isFirstElement) {
                    currentY += listGap;
                }
                isFirstElement = false;
                Array.from(node.childNodes).forEach((child) => {
                    if (child.nodeType === Node.ELEMENT_NODE && child.tagName.toLowerCase() === 'li') {
                        processNode(child, indent, linkUrl);
                    }
                });
                currentY += listGap;
                return;
            }
            if (tag === 'li') {
                doc.text('• ', x + indent, currentY);
                Array.from(node.childNodes).forEach((child) => processNode(child, indent + listIndent, linkUrl));
                currentY += listItemGap;
                return;
            }
            Array.from(node.childNodes).forEach((child) => processNode(child, indent, linkUrl));
        };

        Array.from(div.childNodes).forEach((child) => {
            processNode(child);
            isFirstElement = false;
        });

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

    const getSelectedPdfColumns = () => {
        const all = bySel('#kg-pdf-columns-all');
        const host = bySel('#kg-pdf-columns-options');
        if (!host || (all && all.checked)) {
            return PDF_COLUMN_ORDER.slice();
        }
        const selected = Array.from(host.querySelectorAll('input[type="checkbox"]:checked'))
            .map((el) => String(el.value || '').trim())
            .filter((key) => PDF_COLUMN_ORDER.includes(key));
        return selected.length ? selected : PDF_COLUMN_ORDER.slice();
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

    const bindPdfColumnsDropdown = () => {
        const root = bySel('#kg-pdf-columns-dropdown');
        const toggle = bySel('#kg-pdf-columns-toggle');
        const panel = bySel('#kg-pdf-columns-panel');
        const all = bySel('#kg-pdf-columns-all');
        const options = bySel('#kg-pdf-columns-options');
        if (!toggle || !panel || !all || !options) {
            return;
        }
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
        });
        updatePdfColumnsToggleLabel();
    };

    const getPdfColumnValue = (item, key) => {
        const details = item && item.details ? item.details : {};
        switch (key) {
            case 'uhrzeit':
                return `${formatTimeForPdf(item.startMin)} – ${formatTimeForPdf(item.endMin)}`;
            case 'titel':
                return escapeTextForPdf(item.title || '');
            case 'seminarphase':
                return escapeTextForPdf(item.phase || details.phase || '');
            case 'kognitive':
                return escapeTextForPdf(getCognitiveLabel(item));
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

    const getPdfLinesForItem = (item, selectedcols) => {
        const details = item && item.details ? item.details : {};
        const lines = [];
        selectedcols.forEach((key) => {
            if (key === 'kurzbeschreibung') {
                const description = getPdfColumnValue(item, key);
                if (description) {
                    lines.push(`Kurzbeschreibung: ${description}`);
                } else {
                    lines.push('Kurzbeschreibung:');
                }
                const extras = [
                    ['Raumanforderungen', stripHtml(details.requirements || '')],
                    ['Sozialform', stripHtml(details.socialform || '')],
                    ['Vorbereitungszeit', stripHtml(details.preparation || '')],
                    ['Gruppengröße', stripHtml(item.group || details.group || '')]
                ];
                extras.forEach(([label, value]) => {
                    if (value) {
                        lines.push(`${label}: ${value}`);
                    }
                });
                return;
            }
            const label = PDF_COLUMN_LABELS[key] || key;
            const value = getPdfColumnValue(item, key);
            if (value) {
                lines.push(`${label}: ${value}`);
            } else if (key === 'sonstiges') {
                lines.push(`${label}:`);
            }
        });
        return lines;
    };

    const drawPdfTitlePage = (doc, title, meta, subtitle = '') => {
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
        doc.line(14, y, 196, y);
        y += 10;

        doc.setFontSize(11);
        metaRows.forEach(([label, value]) => {
            doc.setFont(undefined, 'bold');
            doc.text(`${label}:`, 14, y);
            doc.setFont(undefined, 'normal');
            doc.text(escapeTextForPdf(value) || '—', 52, y);
            y += 9;
        });

        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        doc.text('Seminarplaner', 14, pageHeight - 14);
    };

    const addBausteinCoverPage = (doc, day, unit, methodCount) => {
        doc.addPage();
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
        y = renderHtmlToPdf(doc, unit.topics || '', 14, y, 180);
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
        y = renderHtmlToPdf(doc, unit.objectives || '', 14, y, 180);
        if (y === beforeObjectives) {
            doc.text('Keine Angaben.', 14, y);
        }
    };

    const renderFlowMethodPage = (doc, day, item) => {
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
            {label: 'Seminarphase', content: item.phase || details.phase || ''},
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
            if (y > 252) {
                doc.addPage();
                y = 20;
            }
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.text(`${section.label}:`, 14, y);
            y += 6;
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            y = renderHtmlToPdf(doc, section.content, 14, y, 180);
            y += 5;
        });
    };

    const buildFlowUnitGroups = (day, entries) => {
        const sorted = entries.slice().sort((a, b) => (a.startMin || 0) - (b.startMin || 0));
        const unitsInOrder = [];
        const seenUnitIds = new Set();
        const methods = [];
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
                    methods: []
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
                    methods: []
                };
                unitsInOrder.push(target);
            }
            target.methods.push(method);
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

    const exportPdfZim = () => {
        const jsPDF = ensurePdfReady();
        const meta = getPdfMeta();
        const days = getOrderedDays();
        const plan = getPlanByDay();
        const selectedcols = getSelectedPdfColumns();
        const doc = new jsPDF();
        if (typeof doc.autoTable !== 'function') {
            throw new Error('PDF-Tabellenbibliothek nicht geladen');
        }

        drawPdfTitlePage(doc, 'ZIM', meta, 'Deckblatt');
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
            seminarphase: 28,
            kognitive: 28,
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
            columnStyles
        });

        const filename = meta.title ? `ZIM-${meta.title}.pdf` : 'ZIM-Papier.pdf';
        doc.save(filename);
    };

    const exportPdfFlow = () => {
        const jsPDF = ensurePdfReady();
        const meta = getPdfMeta();
        const days = getOrderedDays();
        const plan = getPlanByDay();
        const doc = new jsPDF();

        drawPdfTitlePage(doc, 'ZIM', meta, 'Konzeptsammlung');

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

    const saveMethods = (cmid, newMethods) => {
        return asCall('mod_seminarplaner_save_method_cards', {
            cmid,
            methodsjson: JSON.stringify(newMethods)
        });
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
        return units.map((unit, idx) => {
            const baseid = String(unit && unit.id ? unit.id : '').trim();
            return {
                id: baseid || uid(),
                title: String(unit && unit.title ? unit.title : '').trim(),
                topics: String(unit && unit.topics ? unit.topics : ''),
                objectives: String(unit && unit.objectives ? unit.objectives : '')
            };
        }).filter((unit) => !!unit.id);
    };

    const buildPayloadFromParsedObject = (parsed) => {
        const object = parsed && typeof parsed === 'object' ? parsed : {};
        const methodsArr = Array.isArray(object.methods) ? object.methods : [];
        const planningstate = object.planningstate && typeof object.planningstate === 'object' ? object.planningstate : null;
        const bausteineFromObject = Array.isArray(object.bausteine) ? object.bausteine : [];
        const bausteineFromState = planningstate && Array.isArray(planningstate.units) ? planningstate.units : [];
        const bausteineArr = normalizeImportedPlanningUnits(bausteineFromObject.length ? bausteineFromObject : bausteineFromState);
        const seminarplaene = Array.isArray(object.seminarplaene) ? object.seminarplaene : [];
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
        const globalSetSelect = bySel('#kg-global-set-select');
        const globalSetImportBtn = bySel('#kg-global-set-import');
        const globalSetAutosync = bySel('#kg-global-set-autosync');
        const globalSetApplyBtn = bySel('#kg-global-set-apply');
        bindPdfColumnsDropdown();

        if (parsebtn && fileinput) {
            fileinput.addEventListener('change', () => {
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
                    previewUnits = (Array.isArray(currentImportPayload.bausteine) ? currentImportPayload.bausteine : []).map((unit) => ({
                        unit,
                        selected: true
                    }));
                    previewGrids = (Array.isArray(currentImportPayload.seminarplaene) ? currentImportPayload.seminarplaene : []).map((plan) => ({
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
                    setStatus(`Analyse fehlgeschlagen: ${e.message || e}`, true);
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
                        const saveres = await saveMethods(cmid, result.merged);
                        methods = result.merged;
                        successParts.push(
                            `Seminareinheiten: ${selectedRows.length} verarbeitet (+${result.stats.added}, überschrieben ${result.stats.overwritten}, Kopien ${result.stats.copied}, nicht hinzugefügt ${result.stats.skipped}; gesamt ${saveres.count})`
                        );
                        postLoads.push(loadMethods(cmid));
                    }

                    if (selectedUnits.length) {
                        const importedstate = currentImportPayload.planningstate && typeof currentImportPayload.planningstate === 'object'
                            ? Object.assign({}, currentImportPayload.planningstate)
                            : {units: selectedUnits};
                        const selectedUnitIds = new Set(selectedUnits.map((unit) => String(unit && unit.id ? unit.id : '').trim()).filter(Boolean));
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
                    Notification.exception(e);
                    setImportStatus(`Import fehlgeschlagen: ${e.message || e}`, true);
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
        if (globalSetImportBtn) {
            globalSetImportBtn.addEventListener('click', () => {
                const setid = Number.parseInt(globalSetSelect ? (globalSetSelect.value || '0') : '0', 10) || 0;
                if (!setid) {
                    setGlobalStatus('Bitte zuerst ein globales Konzept auswählen.', true);
                    return;
                }
                asCall('mod_seminarplaner_import_global_methodset', {cmid, methodsetid: setid})
                    .then((res) => {
                        if (pendingAutosyncPrefs[setid]) {
                            return asCall('mod_seminarplaner_set_methodset_sync_policy', {
                                cmid,
                                methodsetid: setid,
                                autosyncenabled: true
                            }).then(() => res).catch(() => res);
                        }
                        return res;
                    })
                    .then((res) => {
                        return Promise.all([loadMethods(cmid), loadGlobalSyncStatus(cmid)]).then(() => res);
                    })
                    .then((res) => {
                        refreshGlobalSyncUi();
                        setGlobalStatus(
                            `Import erfolgreich: ${res.importedcount} Seminareinheiten aus "${res.setname}" importiert (insgesamt ${res.totalcount}).`,
                            false
                        );
                    })
                    .catch((e) => {
                        Notification.exception(e);
                        setGlobalStatus('Import des globalen Konzepts fehlgeschlagen.', true);
                    });
            });
        }
        if (globalSetSelect) {
            globalSetSelect.addEventListener('change', refreshGlobalSyncUi);
        }
        if (globalSetAutosync) {
            globalSetAutosync.addEventListener('change', () => {
                const selected = getSelectedSyncLink();
                if (!selected) {
                    const setid = Number.parseInt(globalSetSelect ? (globalSetSelect.value || '0') : '0', 10) || 0;
                    if (setid > 0) {
                        pendingAutosyncPrefs[setid] = !!globalSetAutosync.checked;
                        setGlobalStatus(
                            globalSetAutosync.checked
                                ? 'Auto-Update vorgemerkt und wird nach dem Import aktiviert.'
                                : 'Auto-Update-Vormerkung entfernt.',
                            false
                        );
                    }
                    return;
                }
                asCall('mod_seminarplaner_set_methodset_sync_policy', {
                    cmid,
                    methodsetid: Number(selected.methodsetid),
                    autosyncenabled: !!globalSetAutosync.checked
                }).then(() => loadGlobalSyncStatus(cmid)).then(() => {
                    refreshGlobalSyncUi();
                    setGlobalStatus('Auto-Update-Einstellung gespeichert.', false);
                }).catch((e) => {
                    Notification.exception(e);
                    setGlobalStatus('Auto-Update-Einstellung konnte nicht gespeichert werden.', true);
                });
            });
        }
        if (globalSetApplyBtn) {
            globalSetApplyBtn.addEventListener('click', () => {
                const selected = getSelectedSyncLink();
                if (!selected) {
                    setGlobalStatus('Bitte zuerst ein verknüpftes globales Konzept auswählen.', true);
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

    return {
        init: function(cmid) {
            ensureExternalLibraries().then(() => {
                return Promise.all([
                    loadMethods(cmid),
                    loadGrids(cmid),
                    loadPlanningState(cmid),
                    loadGlobalMethodsets(cmid),
                    loadGlobalSyncStatus(cmid)
                ]);
            }).then(() => {
                    bind(cmid);
                    step(1);
                    refreshGlobalSyncUi();
                }).catch((e) => {
                    Notification.exception(e);
                    setStatus('Initialisierung fehlgeschlagen.', true);
                });
        }
    };
});
