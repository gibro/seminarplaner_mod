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
    let editingMethodId = '';
    let addButtonDefaultHtml = '';

    const bySel = (sel) => document.querySelector(sel);
    const asCall = (methodname, args) => Ajax.call([{methodname, args}])[0];
    const uid = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const getMoodleRoot = () => {
        if (typeof window === 'undefined' || !window.M || !window.M.cfg || !window.M.cfg.wwwroot) {
            return '';
        }
        return String(window.M.cfg.wwwroot).replace(/\/+$/, '');
    };
    const MOODLE_ROOT = getMoodleRoot();
    const LUCIDE_BASE_URL = MOODLE_ROOT ? `${MOODLE_ROOT}/mod/seminarplaner/pix/lucide` : '';
    const renderLucideIcon = (name, extraClass = '') => {
        if (!name || !LUCIDE_BASE_URL) {
            return '';
        }
        const classes = `kg-lucide${extraClass ? ` ${extraClass}` : ''}`;
        return `<img class="${classes}" src="${LUCIDE_BASE_URL}/${name}.svg" alt="" aria-hidden="true" loading="lazy" decoding="async">`;
    };
    const escapeHtml = (str) => String(str || '').replace(/[&<>"']/g, (ch) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch] || ch));
    const sanitizeHtml = (html) => {
        const tpl = document.createElement('template');
        tpl.innerHTML = String(html || '');
        tpl.content.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach((el) => el.remove());
        tpl.content.querySelectorAll('*').forEach((el) => {
            Array.from(el.attributes).forEach((attr) => {
                const name = String(attr.name || '').toLowerCase();
                const value = String(attr.value || '').trim().toLowerCase();
                if (name.startsWith('on')) {
                    el.removeAttribute(attr.name);
                    return;
                }
                if ((name === 'href' || name === 'src') && value.startsWith('javascript:')) {
                    el.removeAttribute(attr.name);
                }
            });
        });
        return tpl.innerHTML;
    };

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
        const hint = bySel('#kg-f-alternativen-hint');
        if (!host) {
            return;
        }
        const selected = readMulti(FIELDS.alternativen);
        const currenttitle = String(bySel(FIELDS.titel)?.value || '').trim().toLowerCase();
        host.innerHTML = '';
        let optioncount = 0;
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
            optioncount++;
        });
        if (hint) {
            if (!methods.length) {
                hint.textContent = 'Noch keine Seminareinheiten geladen. Bitte zuerst Seminareinheiten importieren oder speichern.';
            } else if (!optioncount) {
                hint.textContent = 'Keine alternativen Seminareinheiten verfügbar (aktueller Titel ist bereits vergeben oder es gibt nur diese eine Seminareinheit).';
            } else {
                hint.textContent = '';
            }
        }
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
        const order = [];
        const byid = new Map();
        methods.forEach((method) => {
            const normalized = Object.assign({}, method);
            const id = String(normalized.id || '').trim();
            if (!id) {
                return;
            }
            normalized.id = id;
            byid.set(id, normalized);
            order.push(id);
        });

        const links = new Map();
        order.forEach((id) => {
            links.set(id, new Set());
        });

        order.forEach((id) => {
            const method = byid.get(id);
            const values = Array.isArray(method.alternativen) ? method.alternativen : [];
            values.map((value) => String(value || '').trim()).forEach((altid) => {
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

    const normalizeLoadedMethod = (method) => {
        const normalized = Object.assign({}, method);
        normalized.id = String(normalized.id || uid()).trim();
        normalized.titel = String(normalized.titel || normalized.title || normalized.name || '').trim();
        const rawalternatives = normalized.alternativen;
        const values = Array.isArray(rawalternatives)
            ? rawalternatives
            : (typeof rawalternatives === 'string' ? rawalternatives.split(/##|[\r\n,;]+/u) : []);
        normalized.alternativen = values.map((id) => String(id || '').trim()).filter(Boolean);
        return normalized;
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
                if (typeof editor.save === 'function') {
                    editor.save();
                }
            }
            el.value = '';
            if ('defaultValue' in el) {
                el.defaultValue = '';
            }
            if (el.hasAttribute && el.hasAttribute('value')) {
                el.setAttribute('value', '');
            }
        });
        editingMethodId = '';
        const addbutton = bySel('#kg-add-method');
        if (addbutton) {
            if (!addButtonDefaultHtml) {
                addButtonDefaultHtml = addbutton.innerHTML;
            }
            addbutton.innerHTML = addButtonDefaultHtml;
        }
        refreshAlternativeOptions();
    };

    const resetPageFormState = () => {
        const runReset = () => {
            clearForm();
            const needsRetry = Object.values(FIELDS).some((selector) => {
                const el = bySel(selector);
                return !!(el && el.tagName === 'TEXTAREA' && el.id
                    && typeof window !== 'undefined' && window.tinyMCE
                    && !window.tinyMCE.get(el.id));
            });
            return needsRetry;
        };

        let attempts = 0;
        const maxAttempts = 10;
        const tick = () => {
            const needsRetry = runReset();
            attempts += 1;
            if (needsRetry && attempts < maxAttempts && typeof window !== 'undefined') {
                window.setTimeout(tick, 150);
            }
        };

        tick();
        if (typeof window !== 'undefined') {
            window.setTimeout(clearForm, 1200);
        }
    };

    const setFieldValue = (selector, value) => {
        const el = bySel(selector);
        if (!el) {
            return;
        }
        const normalized = String(value || '');
        const editor = (typeof window !== 'undefined' && window.tinyMCE && el.id) ? window.tinyMCE.get(el.id) : null;
        if (editor) {
            editor.setContent(normalized);
        }
        el.value = normalized;
    };

    const setMultiFieldValues = (selector, values) => {
        const el = bySel(selector);
        if (!el) {
            return;
        }
        const list = Array.isArray(values)
            ? values.map((value) => String(value || '').trim()).filter(Boolean)
            : [];
        if (el.tagName === 'SELECT') {
            Array.from(el.options).forEach((opt) => {
                opt.selected = list.includes(opt.value);
            });
            return;
        }
        setFormMultiDropdownValues(selector, list);
    };

    const loadMethodIntoForm = (methodid) => {
        const method = methods.find((entry) => String(entry.id) === String(methodid));
        if (!method) {
            return;
        }
        editingMethodId = String(method.id);
        setFieldValue(FIELDS.titel, method.titel || '');
        setFieldValue(FIELDS.zeitbedarf, method.zeitbedarf || '');
        setFieldValue(FIELDS.gruppengroesse, method.gruppengroesse || '');
        setFieldValue(FIELDS.kurzbeschreibung, method.kurzbeschreibung || '');
        setFieldValue(FIELDS.autor, method.autor || '');
        setFieldValue(FIELDS.lernziele, method.lernziele || '');
        setFieldValue(FIELDS.komplexitaet, method.komplexitaet || '');
        setFieldValue(FIELDS.vorbereitung, method.vorbereitung || '');
        setFieldValue(FIELDS.risiken, method.risiken || '');
        setFieldValue(FIELDS.debrief, method.debrief || '');
        setFieldValue(FIELDS.materialtechnik, method.materialtechnik || '');
        setFieldValue(FIELDS.ablauf, method.ablauf || '');
        setFieldValue(FIELDS.tags, method.tags || '');
        setMultiFieldValues(FIELDS.seminarphase, method.seminarphase || []);
        setMultiFieldValues(FIELDS.raum, method.raum || []);
        setMultiFieldValues(FIELDS.sozialform, method.sozialform || []);
        setMultiFieldValues(FIELDS.kognitive, method.kognitive || []);
        setFormMultiDropdownValues(FIELDS.alternativen, method.alternativen || []);
        const materialdraft = bySel(FIELDS.materialien);
        if (materialdraft) {
            materialdraft.value = '0';
        }
        refreshAlternativeOptions();
        setFormMultiDropdownValues(FIELDS.alternativen, method.alternativen || []);
        const addbutton = bySel('#kg-add-method');
        if (addbutton) {
            if (!addButtonDefaultHtml) {
                addButtonDefaultHtml = addbutton.innerHTML;
            }
            addbutton.innerHTML = 'Seminareinheit aktualisieren';
        }
        setStatus(`Seminareinheit "${method.titel || ''}" zur Bearbeitung geladen.`, false);
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
        if (host) {
            host.innerHTML = '';
            methods.forEach((method) => {
                const card = document.createElement('div');
                card.className = 'sp-card';
	                card.innerHTML = `
	                  <div class="sp-card-compact">
	                    <div class="sp-card-title"><strong>${escapeHtml(method.titel)}</strong></div>
	                    <div class="sp-card-meta">
	                      <span class="sp-badge kg-method-badge">${renderLucideIcon('clock-3', 'kg-lucide--badge')}<span>${escapeHtml(method.zeitbedarf || '-')}</span></span>
	                      <span class="sp-badge kg-method-badge">${renderLucideIcon('users', 'kg-lucide--badge')}<span>${escapeHtml(method.gruppengroesse || '-')}</span></span>
	                      <span class="sp-badge kg-method-badge">${renderLucideIcon('handshake', 'kg-lucide--badge')}<span>${escapeHtml((method.sozialform || []).join(', ') || '-')}</span></span>
	                    </div>
	                    <div class="sp-card-description sp-card-description--rich">${sanitizeHtml(method.kurzbeschreibung || '')}</div>
	                  </div>
	                `;

                const remove = document.createElement('button');
                remove.type = 'button';
                remove.className = 'sp-remove';
                remove.textContent = '✕';
                remove.addEventListener('click', () => {
                    methods = methods.filter((m) => m.id !== method.id);
                    if (String(editingMethodId) === String(method.id)) {
                        clearForm();
                    }
                    render();
                });

                const edit = document.createElement('button');
                edit.type = 'button';
                edit.className = 'sp-remove';
                edit.textContent = 'Bearbeiten';
                edit.style.marginRight = '6px';
                edit.addEventListener('click', () => {
                    loadMethodIntoForm(method.id);
                });

                const actions = document.createElement('div');
                actions.appendChild(edit);
                actions.appendChild(remove);
                card.appendChild(actions);
                host.appendChild(card);
            });
        }

        if (state) {
            state.value = JSON.stringify(methods, null, 2);
        }
        refreshAlternativeOptions();
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

    const saveMethods = (cmid) => {
        normalizeAlternatives();
        asCall('mod_seminarplaner_save_method_cards', {
            cmid,
            methodsjson: JSON.stringify(serializeMethodsForSave())
        }).then((res) => {
            setStatus(`Seminareinheiten gespeichert (${res.count}).`, false);
        }).catch((e) => {
            Notification.exception(e);
            setStatus('Speichern fehlgeschlagen.', true);
        });
    };

    const upsertMethodFromForm = async (cmid) => {
        const method = await buildMethod();
        if (!method) {
            setStatus('Titel ist Pflichtfeld.', true);
            return false;
        }

        if (editingMethodId) {
            const idx = methods.findIndex((entry) => String(entry.id) === String(editingMethodId));
            if (idx >= 0) {
                const existing = methods[idx];
                const updated = Object.assign({}, existing, method, {id: existing.id});
                if (!(Number(updated.materialiendraftitemid || 0) > 0)) {
                    updated.materialien = Array.isArray(existing.materialien) ? existing.materialien : [];
                }
                methods[idx] = updated;
            } else {
                method.id = editingMethodId;
                methods.push(method);
            }
            const current = methods.find((entry) => String(entry.id) === String(editingMethodId));
            reconcileAlternativesForMethod(editingMethodId, current && Array.isArray(current.alternativen) ? current.alternativen : []);
            saveMethods(cmid);
            render();
            clearForm();
            setStatus('Seminareinheit aktualisiert und gespeichert.', false);
            return true;
        }

        methods.push(method);
        reconcileAlternativesForMethod(method.id, method.alternativen || []);
        saveMethods(cmid);
        clearForm();
        render();
        setStatus('Seminareinheit hinzugefügt und gespeichert.', false);
        return true;
    };

    const loadMethods = (cmid) => {
        asCall('mod_seminarplaner_get_method_cards', {cmid}).then((res) => {
            let decoded = [];
            try {
                decoded = res.methodsjson ? JSON.parse(res.methodsjson) : [];
            } catch (e) {
                decoded = [];
            }
            methods = Array.isArray(decoded) ? decoded.map((method) => normalizeLoadedMethod(method)) : [];
            normalizeAlternatives();
            render();
            setStatus(`Seminareinheiten geladen (${methods.length}).`, false);
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
        a.download = 'lernkarten-export.json';
        a.click();
        URL.revokeObjectURL(url);
        setStatus('Lernkarten exportiert.', false);
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

    const readRichTextField = (row, keys) => String(readFirst(row, keys) || '').trim();

    const mapLegacyRowToMethod = (row) => {
        const titel = stripHtml(readFirst(row, ['Titel', 'title', 'Name']));
        if (!titel) {
            return null;
        }

        const seminarphase = splitMultiString(readFirst(row, ['Seminarphase', 'seminarphase']));
        const zeitbedarf = stripHtml(readFirst(row, ['Zeitbedarf', 'zeitbedarf']));
        const gruppengroesse = stripHtml(readFirst(row, ['Gruppengröße', 'Gruppengroesse', 'gruppengroesse']));
        const kurzbeschreibung = readRichTextField(row, ['Kurzbeschreibung', 'kurzbeschreibung']);
        const autor = stripHtml(readFirst(row, ['Autor*in / Kontakt', 'Autor/in / Kontakt', 'autor_kontakt', 'autor']));
        const lernziele = readRichTextField(row, ['Lernziele (Ich-kann ...)', 'lernziele']);
        const komplexitaet = stripHtml(readFirst(row, ['Komplexitätsgrad', 'Komplexitaetsgrad', 'komplexitaet']));
        const vorbereitung = stripHtml(readFirst(row, ['Vorbereitung nötig', 'Vorbereitung noetig', 'vorbereitung']));
        const raum = splitMultiString(readFirst(row, ['Raumanforderungen', 'raumanforderungen']));
        const sozialform = splitMultiString(readFirst(row, ['Sozialform', 'sozialform']));
        const risiken = readRichTextField(row, ['Risiken/Tipps', 'risiken_tipps', 'risiken']);
        const debrief = readRichTextField(row, ['Debrief/Reflexionsfragen', 'debrief']);
        const materialien = splitMultiString(readFirst(row, ['Materialien', 'materialien']));
        const materialtechnik = readRichTextField(row, ['Material/Technik', 'material_technik', 'materialtechnik']);
        const ablauf = readRichTextField(row, ['Ablauf', 'ablauf']);
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
        setStatus(`Lernkarten importiert (${methods.length}).`, false);
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
        setStatus(`CSV importiert (${methods.length} Lernkarten).`, false);
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
            resetPageFormState();
            if (typeof window !== 'undefined') {
                window.addEventListener('load', resetPageFormState);
                window.addEventListener('pageshow', resetPageFormState);
            }
            const addbutton = bySel('#kg-add-method');
            if (addbutton) {
                addButtonDefaultHtml = addbutton.innerHTML;
            }
            bySel('#kg-add-method')?.addEventListener('click', async () => {
                try {
                    await upsertMethodFromForm(cmid);
                } catch (e) {
                    setStatus(`Datei konnte nicht verarbeitet werden: ${e.message || e}`, true);
                }
            });

            bySel('#kg-clear-form')?.addEventListener('click', clearForm);
            bySel(FIELDS.titel)?.addEventListener('input', refreshAlternativeOptions);
            bySel('#kg-save-methods')?.addEventListener('click', async () => {
                if (editingMethodId) {
                    await upsertMethodFromForm(cmid);
                    return;
                }
                saveMethods(cmid);
            });
            bySel('#kg-export-methods')?.addEventListener('click', exportMethods);
            bySel('#kg-import-methods')?.addEventListener('change', (e) => importMethods(e.target.files[0]));

            loadMethods(cmid);
        }
    };
});
