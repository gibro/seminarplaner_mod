define(['core/ajax', 'core/notification'], function(Ajax, Notification) {
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

    let methods = [];

    const bySel = (sel) => document.querySelector(sel);
    const asCall = (methodname, args) => Ajax.call([{methodname, args}])[0];
    const uid = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

    const setStatus = (text, isError) => {
        const el = bySel('#kg-status');
        if (!el) {
            return;
        }
        el.textContent = text;
        el.style.color = isError ? '#b91c1c' : '#166534';
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
        const cleanvalues = Array.isArray(values)
            ? values.map((v) => String(v).trim()).filter(Boolean)
            : [];
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

    const refreshAlternativeOptions = () => {
        const host = bySel('#kg-f-alternativen-options');
        if (!host) {
            return;
        }
        const selected = readMulti(FIELDS.alternativen);
        const currenttitle = String(bySel(FIELDS.titel)?.value || '').trim().toLowerCase();
        host.innerHTML = '';
        methods.forEach((method) => {
            const id = String(method.id || '').trim();
            const title = String(method.titel || '').trim();
            if (!id || !title || title.toLowerCase() === currenttitle) {
                return;
            }
            const row = document.createElement('label');
            row.className = 'kg-tag-option';
            row.innerHTML = `<input type="checkbox" value="${id}" data-kg-form-multi-option="1"><span>${title}</span>`;
            host.appendChild(row);
        });
        host.querySelectorAll('[data-kg-form-multi-option="1"]').forEach((checkbox) => {
            checkbox.checked = selected.includes(String(checkbox.value || '').trim());
            checkbox.addEventListener('change', () => {
                const values = Array.from(host.querySelectorAll('[data-kg-form-multi-option="1"]:checked'))
                    .map((cb) => String(cb.value || '').trim())
                    .filter(Boolean);
                setFormMultiDropdownValues(FIELDS.alternativen, values);
            });
        });
        setFormMultiDropdownValues(FIELDS.alternativen, selected);
    };

    const normalizeAlternatives = () => {
        const ids = new Set(methods.map((method) => String(method.id || '')));
        methods = methods.map((method) => {
            const normalized = Object.assign({}, method);
            const values = Array.isArray(method.alternativen) ? method.alternativen : [];
            normalized.alternativen = values.map((id) => String(id || ''))
                .filter((id) => id && id !== String(normalized.id) && ids.has(id));
            return normalized;
        });
    };

    const readFieldValue = (selector) => {
        const el = bySel(selector);
        if (!el) {
            return '';
        }
        const editor = (typeof window !== 'undefined' && window.tinyMCE && el.id) ? window.tinyMCE.get(el.id) : null;
        if (editor) {
            return String(editor.getContent() || '').trim();
        }
        return String(el.value || '').trim();
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

    const clearForm = () => {
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
            const editor = (typeof window !== 'undefined' && window.tinyMCE && el.id) ? window.tinyMCE.get(el.id) : null;
            if (editor) {
                editor.setContent('');
            }
            el.value = '';
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
            kurzbeschreibung: readFieldValue(FIELDS.kurzbeschreibung),
            autor: (bySel(FIELDS.autor)?.value || '').trim(),
            lernziele: readFieldValue(FIELDS.lernziele),
            komplexitaet: (bySel(FIELDS.komplexitaet)?.value || '').trim(),
            vorbereitung: (bySel(FIELDS.vorbereitung)?.value || '').trim(),
            raum: readMulti(FIELDS.raum),
            sozialform: readMulti(FIELDS.sozialform),
            risiken: readFieldValue(FIELDS.risiken),
            debrief: readFieldValue(FIELDS.debrief),
            materialien: [],
            materialiendraftitemid: draftitemid || 0,
            materialtechnik: readFieldValue(FIELDS.materialtechnik),
            ablauf: readFieldValue(FIELDS.ablauf),
            tags: (bySel(FIELDS.tags)?.value || '').trim(),
            kognitive: readMulti(FIELDS.kognitive),
            alternativen: readMulti(FIELDS.alternativen)
        };
    };

    const render = () => {
        normalizeAlternatives();
        const host = bySel('#kg-methods');
        const state = bySel('#kg-state-json');
        if (!host) {
            return;
        }

        host.innerHTML = '';
        methods.forEach((method) => {
            const card = document.createElement('div');
            card.className = 'sp-card';
            card.innerHTML = `
              <div class="sp-card-compact">
                <div class="sp-card-title"><strong>${method.titel}</strong></div>
                <div class="sp-card-meta">
                  <span class="sp-badge">⏱️ ${method.zeitbedarf || '-'}</span>
                  <span class="sp-badge">👥 ${method.gruppengroesse || '-'}</span>
                  <span class="sp-badge">🤝 ${(method.sozialform || []).join(', ') || '-'}</span>
                </div>
                <div class="sp-card-description">${method.kurzbeschreibung || ''}</div>
              </div>
            `;

            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'sp-remove';
            remove.textContent = '✕';
            remove.addEventListener('click', () => {
                methods = methods.filter((m) => m.id !== method.id);
                render();
            });

            card.appendChild(remove);
            host.appendChild(card);
        });

        if (state) {
            state.value = JSON.stringify(methods, null, 2);
        }
        refreshAlternativeOptions();
    };

    const saveMethods = (cmid) => {
        asCall('mod_konzeptgenerator_save_method_cards', {
            cmid,
            methodsjson: JSON.stringify(methods)
        }).then((res) => {
            setStatus(`Methoden gespeichert (${res.count}).`, false);
        }).catch((e) => {
            Notification.exception(e);
            setStatus('Speichern fehlgeschlagen.', true);
        });
    };

    const loadMethods = (cmid) => {
        asCall('mod_konzeptgenerator_get_method_cards', {cmid}).then((res) => {
            let decoded = [];
            try {
                decoded = res.methodsjson ? JSON.parse(res.methodsjson) : [];
            } catch (e) {
                decoded = [];
            }
            methods = Array.isArray(decoded) ? decoded : [];
            methods = methods.map((method) => {
                const normalized = Object.assign({}, method);
                normalized.alternativen = Array.isArray(method.alternativen) ? method.alternativen : [];
                return normalized;
            });
            render();
            setStatus(`Methoden geladen (${methods.length}).`, false);
        }).catch((e) => {
            Notification.exception(e);
            setStatus('Laden fehlgeschlagen.', true);
        });
    };

    const exportMethods = () => {
        const blob = new Blob([JSON.stringify(methods, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'methodenkarten-export.json';
        a.click();
        URL.revokeObjectURL(url);
        setStatus('Methodenkarten exportiert.', false);
    };

    const parseCsvTable = (csvText) => {
        const text = String(csvText || '').replace(/^\uFEFF/, '');
        const firstLine = text.split(/\r?\n/, 1)[0] || '';
        const delimiterCandidates = [',', ';', '\t'];
        let delimiter = ',';
        let bestCount = -1;
        delimiterCandidates.forEach((cand) => {
            const count = (firstLine.match(new RegExp(`\\${cand}`, 'g')) || []).length;
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
            const joined = Object.values(obj).join('').trim();
            if (joined !== '') {
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

    const mapLegacyRowToMethod = (row) => {
        const titel = stripHtml(readFirst(row, ['Titel', 'title', 'Name']));
        if (!titel) {
            return null;
        }

        const seminarphase = splitMultiString(readFirst(row, ['Seminarphase', 'seminarphase']));
        const zeitbedarf = stripHtml(readFirst(row, ['Zeitbedarf', 'zeitbedarf']));
        const gruppengroesse = stripHtml(readFirst(row, ['Gruppengröße', 'Gruppengroesse', 'gruppengroesse']));
        const kurzbeschreibung = stripHtml(readFirst(row, ['Kurzbeschreibung', 'kurzbeschreibung']));
        const autor = stripHtml(readFirst(row, ['Autor*in / Kontakt', 'Autor/in / Kontakt', 'autor_kontakt', 'autor']));
        const lernziele = stripHtml(readFirst(row, ['Lernziele (Ich-kann ...)', 'lernziele']));
        const komplexitaet = stripHtml(readFirst(row, ['Komplexitätsgrad', 'Komplexitaetsgrad', 'komplexitaet']));
        const vorbereitung = stripHtml(readFirst(row, ['Vorbereitung nötig', 'Vorbereitung noetig', 'vorbereitung']));
        const raum = splitMultiString(readFirst(row, ['Raumanforderungen', 'raumanforderungen']));
        const sozialform = splitMultiString(readFirst(row, ['Sozialform', 'sozialform']));
        const risiken = stripHtml(readFirst(row, ['Risiken/Tipps', 'risiken_tipps', 'risiken']));
        const debrief = stripHtml(readFirst(row, ['Debrief/Reflexionsfragen', 'debrief']));
        const materialien = splitMultiString(readFirst(row, ['Materialien', 'materialien']));
        const materialtechnik = stripHtml(readFirst(row, ['Material/Technik', 'material_technik', 'materialtechnik']));
        const ablauf = stripHtml(readFirst(row, ['Ablauf', 'ablauf']));
        const tags = stripHtml(readFirst(row, ['Tags / Schlüsselworte', 'Tags / Schluesselworte', 'tags', 'Tags']));
        const kognitive = splitMultiString(readFirst(row, ['Kognitive Dimension', 'kognitive_dimension', 'kognitive']));

        return {
            id: uid(),
            titel,
            seminarphase,
            zeitbedarf,
            gruppengroesse,
            kurzbeschreibung,
            autor,
            lernziele,
            komplexitaet,
            vorbereitung,
            raum,
            sozialform,
            risiken,
            debrief,
            materialien,
            materialtechnik,
            ablauf,
            tags,
            kognitive
        };
    };

    const importFromJsonText = (text) => {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) {
            throw new Error('JSON muss ein Array sein');
        }
        methods = parsed.map((m) => ({id: m.id || uid(), ...m}));
        render();
        setStatus(`Methodenkarten importiert (${methods.length}).`, false);
    };

    const importFromCsvText = (text) => {
        const rows = parseCsvTable(text);
        if (!rows.length) {
            throw new Error('Keine Datensätze in CSV gefunden');
        }

        const mapped = rows.map(mapLegacyRowToMethod).filter((m) => m !== null);
        if (!mapped.length) {
            throw new Error('Keine importierbaren Einträge gefunden (Spalte "Titel" fehlt?)');
        }

        methods = mapped;
        render();
        setStatus(`CSV importiert (${methods.length} Methodenkarten).`, false);
    };

    const importFromZipFile = async (file) => {
        if (!window.JSZip) {
            throw new Error('ZIP-Import benötigt JSZip (nicht geladen)');
        }

        const ab = await file.arrayBuffer();
        const zip = await window.JSZip.loadAsync(ab);
        const csvNames = Object.keys(zip.files).filter((name) => !zip.files[name].dir && name.toLowerCase().endsWith('.csv'));
        if (!csvNames.length) {
            throw new Error('Keine CSV-Datei im ZIP gefunden');
        }

        let best = csvNames[0];
        const preferred = csvNames.find((n) => /records/i.test(n));
        if (preferred) {
            best = preferred;
        }

        const csvText = await zip.files[best].async('string');
        importFromCsvText(csvText);
    };

    const importMethods = (file) => {
        if (!file) {
            return;
        }

        const name = (file.name || '').toLowerCase();

        if (name.endsWith('.zip')) {
            importFromZipFile(file).catch((e) => {
                setStatus(`ZIP-Import fehlgeschlagen: ${e.message || e}`, true);
            });
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            try {
                const text = String(reader.result || '');
                if (name.endsWith('.json')) {
                    importFromJsonText(text);
                    return;
                }
                if (name.endsWith('.csv')) {
                    importFromCsvText(text);
                    return;
                }

                try {
                    importFromJsonText(text);
                } catch (jsonError) {
                    importFromCsvText(text);
                }
            } catch (e) {
                setStatus(`Import fehlgeschlagen: ${e.message || e}`, true);
            }
        };
        reader.readAsText(file);
    };

    return {
        init: function(cmid) {
            bindFormMultiDropdowns();
            refreshAlternativeOptions();
            bySel('#kg-add-method')?.addEventListener('click', async () => {
                try {
                    const method = await buildMethod();
                    if (!method) {
                        setStatus('Titel ist Pflichtfeld.', true);
                        return;
                    }
                    methods.push(method);
                    saveMethods(cmid);
                    clearForm();
                    render();
                    setStatus('Methode hinzugefügt und gespeichert.', false);
                } catch (e) {
                    setStatus(`Datei konnte nicht verarbeitet werden: ${e.message || e}`, true);
                }
            });

            bySel('#kg-clear-form')?.addEventListener('click', clearForm);
            bySel(FIELDS.titel)?.addEventListener('input', refreshAlternativeOptions);
            bySel('#kg-save-methods')?.addEventListener('click', () => saveMethods(cmid));
            bySel('#kg-export-methods')?.addEventListener('click', exportMethods);
            bySel('#kg-import-methods')?.addEventListener('change', (e) => importMethods(e.target.files[0]));

            loadMethods(cmid);
        }
    };
});
