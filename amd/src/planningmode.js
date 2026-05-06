define(['core/ajax', 'core/notification'], function(Ajax, Notification) {
    const bySel = (sel, root) => (root || document).querySelector(sel);
    const byAll = (sel, root) => Array.from((root || document).querySelectorAll(sel));
    const asCall = (methodname, args) => Ajax.call([{methodname, args}])[0];
    const uid = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

    const PHASE_OPTIONS = ['Warm-Up', 'Einstieg', 'Erwartungsabfrage', 'Vorwissen aktivieren', 'Wissen vermitteln', 'Reflexion',
        'Transfer', 'Evaluation/Feedback', 'Abschluss'];
    const COGNITIVE_OPTIONS = ['Erinnern', 'Verstehen', 'Anwenden', 'Analysieren', 'Bewerten', 'Erschaffen'];
    const COGNITIVE_LEVELS = {
        erinnern: 1,
        verstehen: 2,
        anwenden: 3,
        analysieren: 4,
        bewerten: 5,
        erschaffen: 6
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
    const stripHtml = (value) => {
        if (!value) {
            return '';
        }
        const div = document.createElement('div');
        div.innerHTML = String(value);
        return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
    };
    const normalizeText = (v) => String(v || '').trim().toLowerCase();
    const splitMulti = (value) => {
        if (Array.isArray(value)) {
            return value.map((v) => String(v || '').trim()).filter(Boolean);
        }
        return String(value || '').split(/##|,|;|\r?\n/).map((v) => v.trim()).filter(Boolean);
    };

    const getMethodCognitiveLevel = (method) => {
        const levels = splitMulti(method && method.kognitive ? method.kognitive : [])
            .map((entry) => normalizeText(String(entry).split(/[:\-–]/)[0]))
            .map((key) => COGNITIVE_LEVELS[key] || null)
            .filter((level) => level !== null);
        if (!levels.length) {
            return null;
        }
        return Math.max(...levels);
    };

    const renderFilterDropdown = (field, label, options, selectedValues) => {
        const selected = Array.isArray(selectedValues) ? selectedValues : [];
        const buttonLabel = selected.length ? `${label} (${selected.length})` : label;
        return `
            <div class="kg-tag-dropdown kg-pm-filter-dropdown" data-filter-dropdown="${escapeHtml(field)}">
                <button type="button" class="kg-input kg-tag-dropdown-toggle" data-filter-toggle="${escapeHtml(field)}">${escapeHtml(buttonLabel)}</button>
                <div class="kg-tag-dropdown-panel kg-hidden" data-filter-panel="${escapeHtml(field)}">
                    ${options.map((value) => {
                        const normalized = normalizeText(value);
                        const checked = selected.includes(normalized) ? 'checked' : '';
                        return `<label class="kg-tag-option"><input type="checkbox" data-filter-option="${escapeHtml(field)}" value="${escapeHtml(normalized)}" ${checked}><span>${escapeHtml(value)}</span></label>`;
                    }).join('')}
                </div>
            </div>
        `;
    };

    const renderTagFilterDropdown = (slotkey, selectedValues, methods) => {
        const selected = Array.isArray(selectedValues) ? selectedValues : [];
        const options = [];
        const seen = new Set();
        (Array.isArray(methods) ? methods : []).forEach((method) => {
            splitMulti(method && method.tags ? method.tags : []).forEach((tag) => {
                const normalized = normalizeText(tag);
                if (!normalized || seen.has(normalized)) {
                    return;
                }
                seen.add(normalized);
                options.push({value: normalized, label: String(tag).trim()});
            });
        });
        options.sort((a, b) => a.label.localeCompare(b.label, 'de'));
        const buttonLabel = selected.length ? `Tags (${selected.length})` : 'Tags';
        return `
            <div class="kg-tag-dropdown kg-pm-filter-dropdown" data-filter-dropdown="tags" data-slotkey="${escapeHtml(slotkey)}">
                <button type="button" class="kg-input kg-tag-dropdown-toggle" data-filter-toggle="tags">${escapeHtml(buttonLabel)}</button>
                <div class="kg-tag-dropdown-panel kg-hidden" data-filter-panel="tags">
                    ${options.length
                        ? options.map((entry) => {
                            const checked = selected.includes(entry.value) ? 'checked' : '';
                            return `<label class="kg-tag-option"><input type="checkbox" data-filter-option="tags" value="${escapeHtml(entry.value)}" ${checked}><span>${escapeHtml(entry.label)}</span></label>`;
                        }).join('')
                        : '<div class="sp-filter-status">Keine Tags vorhanden.</div>'}
                </div>
            </div>
        `;
    };

    const renderInlineTagDropdown = (slotkey, methods) => {
        const options = [];
        const seen = new Set();
        (Array.isArray(methods) ? methods : []).forEach((method) => {
            splitMulti(method && method.tags ? method.tags : []).forEach((tag) => {
                const normalized = normalizeText(tag);
                if (!normalized || seen.has(normalized)) {
                    return;
                }
                seen.add(normalized);
                options.push({value: String(tag).trim(), normalized});
            });
        });
        options.sort((a, b) => a.value.localeCompare(b.value, 'de'));
        return `
            <div class="kg-tag-dropdown" data-inline-tags-dropdown="${escapeHtml(slotkey)}">
                <button type="button" class="kg-input kg-tag-dropdown-toggle" data-inline-tags-toggle="1">Tags wählen</button>
                <div class="kg-tag-dropdown-panel kg-hidden" data-inline-tags-panel="1">
                    ${options.length
                        ? options.map((entry) => `<label class="kg-tag-option"><input type="checkbox" data-inline-tags-option="1" value="${escapeHtml(entry.value)}"><span>${escapeHtml(entry.value)}</span></label>`).join('')
                        : '<div class="sp-filter-status">Keine Tags vorhanden.</div>'}
                </div>
            </div>
            <input type="hidden" data-f="tags" value="">
        `;
    };

    class PlanningMode {
        constructor(cmid) {
            this.cmid = cmid;
            this.status = bySel('#kg-pm-status');
            this.versionhash = '';
            this.methods = [];
            this.filters = {};
            this.editingUnitId = '';
            this.state = {units: [], slotorder: [], openslots: {}};

            this.bindTop();
            Promise.all([this.loadMethods(), this.loadPlanningState()]).then(() => {
                this.renderAll();
                this.applyRequestedEditFromUrl();
            }).catch((error) => {
                Notification.exception(error);
                this.setStatus('Baustein konnte nicht geladen werden.', true);
            });
        }

        setStatus(text, isError = false) {
            if (!this.status) {
                return;
            }
            this.status.textContent = text;
            this.status.style.color = isError ? '#b91c1c' : '#166534';
        }

        bindTop() {
            bySel('#kg-pm-add-unit')?.addEventListener('click', () => this.addUnit());
            bySel('#kg-pm-save')?.addEventListener('click', () => this.savePlanningState(false));
            bySel('#kg-pm-check')?.addEventListener('click', () => this.runDidacticCheck());
            bySel('#kg-pm-cancel-edit')?.addEventListener('click', () => this.resetUnitForm());
            this.bindAlternativeDropdown();
        }

        bindAlternativeDropdown() {
            const dropdown = bySel('#kg-pm-unit-alt-dropdown');
            const toggle = bySel('#kg-pm-unit-alt-toggle');
            const panel = bySel('#kg-pm-unit-alt-panel');
            const optionshost = bySel('#kg-pm-unit-alt-options');
            if (!dropdown || !toggle || !panel || !optionshost) {
                return;
            }
            toggle.addEventListener('click', () => {
                const opening = panel.classList.contains('kg-hidden');
                panel.classList.toggle('kg-hidden');
                dropdown.classList.toggle('kg-form-multi-open', opening);
            });
            document.addEventListener('click', (event) => {
                if (!dropdown.contains(event.target)) {
                    panel.classList.add('kg-hidden');
                    dropdown.classList.remove('kg-form-multi-open');
                }
            });
            optionshost.addEventListener('change', (event) => {
                const target = event.target;
                if (!target || !target.matches('[data-pm-alt-option="1"]')) {
                    return;
                }
                const values = byAll('[data-pm-alt-option="1"]:checked', optionshost)
                    .map((checkbox) => String(checkbox.value || '').trim())
                    .filter(Boolean);
                this.setAlternativeUnitSelection(values);
            });
            this.setAlternativeUnitSelection([]);
        }

        readAlternativeUnitSelection() {
            const hidden = bySel('#kg-pm-unit-altunits');
            if (!hidden) {
                return [];
            }
            return String(hidden.value || '')
                .split('##')
                .map((value) => String(value || '').trim())
                .filter(Boolean);
        }

        setAlternativeUnitSelection(values) {
            const hidden = bySel('#kg-pm-unit-altunits');
            const optionshost = bySel('#kg-pm-unit-alt-options');
            const toggle = bySel('#kg-pm-unit-alt-toggle');
            const clean = Array.isArray(values)
                ? values.map((value) => String(value || '').trim()).filter(Boolean)
                : [];
            if (hidden) {
                hidden.value = clean.join('##');
            }
            if (optionshost) {
                const selectedset = new Set(clean);
                byAll('[data-pm-alt-option="1"]', optionshost).forEach((checkbox) => {
                    checkbox.checked = selectedset.has(String(checkbox.value || '').trim());
                });
            }
            if (toggle) {
                toggle.textContent = clean.length ? `Bausteine (${clean.length})` : 'Bausteine wählen';
            }
        }

        refreshAlternativeUnitOptions() {
            const optionshost = bySel('#kg-pm-unit-alt-options');
            if (!optionshost) {
                return;
            }
            const selected = this.readAlternativeUnitSelection();
            const selectedset = new Set(selected);
            const renderedids = new Set();
            const editingid = String(this.editingUnitId || '');
            optionshost.innerHTML = '';
            this.state.units.forEach((unit) => {
                const id = String(unit && unit.id ? unit.id : '').trim();
                if (!id || (editingid && id === editingid)) {
                    return;
                }
                renderedids.add(id);
                const row = document.createElement('label');
                row.className = 'kg-tag-option';
                row.innerHTML = `<input type="checkbox" value="${escapeHtml(id)}" data-pm-alt-option="1"><span>${escapeHtml(String(unit.title || 'Baustein'))}</span>`;
                const checkbox = bySel('input[type="checkbox"]', row);
                if (checkbox) {
                    checkbox.checked = selectedset.has(id);
                }
                optionshost.appendChild(row);
            });
            this.setAlternativeUnitSelection(selected.filter((id) => renderedids.has(id)));
        }

        normalizeState(raw) {
            const units = Array.isArray(raw.units) ? raw.units : [];
            const slotorder = Array.isArray(raw.slotorder) ? raw.slotorder.map((v) => String(v || '')) : [];
            const openslots = raw.openslots && typeof raw.openslots === 'object' ? raw.openslots : {};
            return {
                units: units.map((unit) => ({
                    id: String(unit.id || uid()),
                    title: String(unit.title || 'Ohne Titel').trim(),
                    plannedduration: Math.max(5, Number.parseInt(unit.plannedduration || unit.duration, 10) || 90),
                    duration: Math.max(5, Number.parseInt(unit.duration || unit.plannedduration, 10) || 90),
                    slotkey: String(unit.slotkey || '').trim(),
                    objectives: sanitizeHtml(unit.objectives || ''),
                    topics: sanitizeHtml(unit.topics || ''),
                    active: unit.active !== false,
                    methods: Array.isArray(unit.methods) ? unit.methods.map((entry) => ({
                        id: String(entry.id || uid()),
                        methodid: String(entry.methodid || '')
                    })).filter((entry) => entry.methodid) : []
                })),
                slotorder,
                openslots
            };
        }

        parseMethodDuration(raw) {
            const text = String(raw || '').trim();
            if (!text) {
                return 0;
            }
            const matches = text.match(/\d+/g);
            if (!matches || !matches.length) {
                return 0;
            }
            const values = matches.map((entry) => Number.parseInt(entry, 10)).filter((value) => Number.isFinite(value) && value > 0);
            if (!values.length) {
                return 0;
            }
            return Math.max(...values);
        }

        getUnitMethodsDuration(unit) {
            const methods = Array.isArray(unit && unit.methods) ? unit.methods : [];
            return methods.reduce((sum, entry) => {
                const method = this.getMethodById(entry.methodid);
                return sum + this.parseMethodDuration(method ? method.zeitbedarf : '');
            }, 0);
        }

        recomputeUnitDurations() {
            const overruns = [];
            this.state.units = this.state.units.map((unit) => {
                const plannedduration = Math.max(5, Number.parseInt(unit.plannedduration || unit.duration, 10) || 90);
                const methodsduration = this.getUnitMethodsDuration(unit);
                const hasmethods = Array.isArray(unit.methods) && unit.methods.length > 0;
                const duration = hasmethods ? Math.max(5, methodsduration) : plannedduration;
                if (hasmethods && methodsduration > plannedduration) {
                    overruns.push({
                        title: String(unit.title || 'Baustein'),
                        planned: plannedduration,
                        actual: methodsduration
                    });
                }
                return Object.assign({}, unit, {plannedduration, duration});
            });
            return overruns;
        }

        getSlotKey(unit) {
            return `unit:${unit.id}`;
        }

        getSlots() {
            const grouped = {};
            this.state.units.forEach((unit) => {
                const key = this.getSlotKey(unit);
                grouped[key] = {key, units: [unit], active: unit};
            });
            const order = this.state.slotorder.filter((key) => key.indexOf('unit:') === 0 && !!grouped[key]);
            Object.keys(grouped).forEach((key) => {
                if (!order.includes(key)) {
                    order.push(key);
                }
            });
            this.state.slotorder = order;
            return order.map((key) => grouped[key]);
        }

        getAlternativeUnits(unit) {
            const slotkey = String(unit && unit.slotkey ? unit.slotkey : '').trim();
            if (!slotkey) {
                return [];
            }
            return this.state.units.filter((entry) => {
                const entryid = String(entry && entry.id ? entry.id : '').trim();
                const currentid = String(unit && unit.id ? unit.id : '').trim();
                const entryslotkey = String(entry && entry.slotkey ? entry.slotkey : '').trim();
                return entryid && entryid !== currentid && entryslotkey === slotkey;
            });
        }

        addUnit() {
            const title = String(bySel('#kg-pm-unit-title')?.value || '').trim();
            if (!title) {
                this.setStatus('Bitte Titel eingeben.', true);
                return;
            }
            const plannedduration = Math.max(5, Number.parseInt(bySel('#kg-pm-unit-duration')?.value || '90', 10) || 90);
            const selectedAlternativeUnitIds = this.readAlternativeUnitSelection();
            const objectives = sanitizeHtml(this.readRichText('#kg-pm-unit-objectives'));
            const topics = sanitizeHtml(this.readRichText('#kg-pm-unit-topics'));
            const selectedunits = this.state.units.filter((unit) => selectedAlternativeUnitIds.includes(String(unit.id || '')));
            const existinggroupkey = selectedunits.find((unit) => String(unit.slotkey || '').trim()) || null;
            const slotkey = selectedunits.length
                ? (existinggroupkey ? String(existinggroupkey.slotkey || '').trim() : `alt-${uid()}`)
                : '';
            this.state.units = this.state.units.map((unit) => {
                if (!selectedAlternativeUnitIds.includes(String(unit.id || ''))) {
                    return unit;
                }
                return Object.assign({}, unit, {slotkey});
            });
            if (this.editingUnitId) {
                this.state.units = this.state.units.map((unit) => {
                    if (String(unit.id) !== String(this.editingUnitId)) {
                        return unit;
                    }
                    const methodsduration = this.getUnitMethodsDuration(unit);
                    const hasmethods = Array.isArray(unit.methods) && unit.methods.length > 0;
                    return Object.assign({}, unit, {
                        title,
                        plannedduration,
                        duration: hasmethods ? Math.max(5, methodsduration) : plannedduration,
                        slotkey,
                        objectives,
                        topics
                    });
                });
                this.normalizeActiveFlags();
                this.resetUnitForm();
                this.renderAll();
                this.savePlanningState(true);
                return;
            }
            const unit = {
                id: uid(),
                title,
                plannedduration,
                duration: plannedduration,
                slotkey,
                objectives,
                topics,
                active: true,
                methods: []
            };
            const key = this.getSlotKey(unit);
            this.state.units.forEach((entry) => {
                if (this.getSlotKey(entry) === key) {
                    entry.active = false;
                }
            });
            this.state.units.push(unit);
            if (!this.state.slotorder.includes(key)) {
                this.state.slotorder.push(key);
            }
            this.resetUnitForm();
            this.renderAll();
            this.savePlanningState(true);
        }

        ensureUnitAlternativeSlots() {
            const grouped = {};
            this.state.units.forEach((unit) => {
                const normalizedslotkey = String(unit.slotkey || '').trim();
                unit.slotkey = normalizedslotkey;
                if (!normalizedslotkey) {
                    return;
                }
                if (!grouped[normalizedslotkey]) {
                    grouped[normalizedslotkey] = [];
                }
                grouped[normalizedslotkey].push(unit);
            });

            Object.keys(grouped).forEach((slotkey) => {
                const units = grouped[slotkey];
                if (units.length < 2) {
                    units.forEach((unit) => {
                        unit.slotkey = '';
                    });
                }
            });
        }

        readRichText(selector) {
            const el = bySel(selector);
            if (!el) {
                return '';
            }
            const editor = (typeof window !== 'undefined' && window.tinyMCE && el.id) ? window.tinyMCE.get(el.id) : null;
            if (editor) {
                return String(editor.getContent() || '').trim();
            }
            return String(el.value || '').trim();
        }

        setRichText(selector, value) {
            const el = bySel(selector);
            if (!el) {
                return;
            }
            const normalized = String(value || '');
            const editor = (typeof window !== 'undefined' && window.tinyMCE && el.id) ? window.tinyMCE.get(el.id) : null;
            if (editor) {
                editor.setContent(normalized);
                return;
            }
            el.value = normalized;
        }

        normalizeActiveFlags() {
            const grouped = {};
            this.state.units.forEach((unit) => {
                const key = this.getSlotKey(unit);
                if (!grouped[key]) {
                    grouped[key] = [];
                }
                grouped[key].push(unit);
            });
            Object.keys(grouped).forEach((key) => {
                const list = grouped[key];
                if (!list.some((entry) => entry.active)) {
                    list[0].active = true;
                } else {
                    let found = false;
                    list.forEach((entry) => {
                        if (entry.active && !found) {
                            found = true;
                            entry.active = true;
                        } else if (entry.active && found) {
                            entry.active = false;
                        }
                    });
                }
            });
        }

        updateUnitFormMode() {
            const addbtn = bySel('#kg-pm-add-unit');
            const cancelbtn = bySel('#kg-pm-cancel-edit');
            if (addbtn) {
                addbtn.textContent = this.editingUnitId ? 'Baustein aktualisieren' : 'Baustein hinzufügen';
            }
            if (cancelbtn) {
                cancelbtn.classList.toggle('kg-hidden', !this.editingUnitId);
            }
        }

        editUnit(unitid) {
            const unit = this.state.units.find((entry) => String(entry.id) === String(unitid));
            if (!unit) {
                return;
            }
            this.editingUnitId = String(unit.id);
            bySel('#kg-pm-unit-title').value = unit.title || '';
            bySel('#kg-pm-unit-duration').value = String(unit.plannedduration || unit.duration || 90);
            this.setRichText('#kg-pm-unit-objectives', unit.objectives || '');
            this.setRichText('#kg-pm-unit-topics', unit.topics || '');
            const unitslotkey = String(unit.slotkey || '').trim();
            const selected = this.state.units
                .filter((entry) => String(entry.id) !== String(unit.id) && unitslotkey && String(entry.slotkey || '').trim() === unitslotkey)
                .map((entry) => String(entry.id));
            this.setAlternativeUnitSelection(selected);
            this.refreshAlternativeUnitOptions();
            this.updateUnitFormMode();
        }

        resetUnitForm() {
            this.editingUnitId = '';
            bySel('#kg-pm-unit-title').value = '';
            bySel('#kg-pm-unit-duration').value = '90';
            this.setRichText('#kg-pm-unit-objectives', '');
            this.setRichText('#kg-pm-unit-topics', '');
            this.setAlternativeUnitSelection([]);
            this.refreshAlternativeUnitOptions();
            this.updateUnitFormMode();
        }

        removeSlot(key) {
            this.state.units = this.state.units.filter((unit) => this.getSlotKey(unit) !== key);
            this.state.slotorder = this.state.slotorder.filter((entry) => entry !== key);
            delete this.state.openslots[key];
            delete this.filters[key];
            this.renderAll();
            this.savePlanningState(true);
        }

        setActiveSlotUnit(key, unitid) {
            this.state.units.forEach((unit) => {
                if (this.getSlotKey(unit) === key) {
                    unit.active = String(unit.id) === String(unitid);
                }
            });
            this.renderAll();
            this.savePlanningState(true);
        }

        moveSlot(key, step) {
            const order = this.state.slotorder.slice();
            const idx = order.indexOf(key);
            if (idx < 0) {
                return;
            }
            const target = idx + step;
            if (target < 0 || target >= order.length) {
                return;
            }
            const tmp = order[idx];
            order[idx] = order[target];
            order[target] = tmp;
            this.state.slotorder = order;
            this.renderAll();
            this.savePlanningState(true);
        }

        getMethodById(id) {
            return this.methods.find((m) => String(m.id) === String(id)) || null;
        }

        ensureMethodAlternatives() {
            const order = [];
            const byid = new Map();
            this.methods.forEach((method) => {
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
                const rawalternatives = method.alternativen;
                const values = Array.isArray(rawalternatives)
                    ? rawalternatives
                    : (typeof rawalternatives === 'string' ? rawalternatives.split(/##|[\r\n,;]+/u) : []);
                values.map((value) => String(value || '').trim()).forEach((altid) => {
                    if (!altid || altid === id || !byid.has(altid)) {
                        return;
                    }
                    links.get(id).add(altid);
                    links.get(altid).add(id);
                });
            });

            this.methods = order.map((id) => {
                const method = byid.get(id);
                method.alternativen = order.filter((otherid) => otherid !== id && links.get(id).has(otherid));
                return method;
            });
        }

        createInlineMethod(slotkey) {
            const root = bySel(`[data-inline-form="${slotkey}"]`);
            if (!root) {
                return null;
            }
            const title = String(bySel('[data-f="title"]', root)?.value || '').trim();
            if (!title) {
                this.setStatus('Bitte einen Titel für die Seminareinheit eingeben.', true);
                return null;
            }
            const method = {
                id: uid(),
                titel: title,
                seminarphase: String(bySel('[data-f="phase"]', root)?.value || '').trim() ? [String(bySel('[data-f="phase"]', root)?.value || '').trim()] : [],
                zeitbedarf: String(bySel('[data-f="duration"]', root)?.value || '').trim(),
                gruppengroesse: '',
                kurzbeschreibung: String(bySel('[data-f="description"]', root)?.value || '').trim(),
                autor: '',
                lernziele: String(bySel('[data-f="objectives"]', root)?.value || '').trim(),
                komplexitaet: '',
                vorbereitung: String(bySel('[data-f="prep"]', root)?.value || '').trim(),
                raum: [],
                sozialform: splitMulti(String(bySel('[data-f="social"]', root)?.value || '').trim()),
                risiken: '',
                debrief: String(bySel('[data-f="debrief"]', root)?.value || '').trim(),
                materialien: [],
                materialtechnik: String(bySel('[data-f="materials"]', root)?.value || '').trim(),
                ablauf: String(bySel('[data-f="flow"]', root)?.value || '').trim(),
                tags: String(bySel('[data-f="tags"]', root)?.value || '').trim(),
                kognitive: splitMulti(String(bySel('[data-f="cognitive"]', root)?.value || '').trim()),
                alternativen: []
            };
            this.methods.push(method);
            this.ensureMethodAlternatives();
            this.persistMethods(true);
            byAll('input,textarea,select', root).forEach((field) => {
                if (field.tagName === 'SELECT') {
                    field.selectedIndex = 0;
                } else {
                    field.value = '';
                }
            });
            bySel('[data-f="duration"]', root).value = '30';
            this.bindInlineTagDropdown(root, slotkey);
            return method;
        }

        persistMethods(silent) {
            return asCall('mod_seminarplaner_save_method_cards', {
                cmid: this.cmid,
                methodsjson: JSON.stringify(this.methods)
            }).then(() => {
                if (!silent) {
                    this.setStatus('Seminareinheiten gespeichert.', false);
                }
            }).catch((error) => {
                if (!silent) {
                    Notification.exception(error);
                    this.setStatus('Seminareinheiten konnten nicht gespeichert werden.', true);
                }
            });
        }

        attachMethod(unitid, methodid) {
            const unit = this.state.units.find((u) => String(u.id) === String(unitid));
            const method = this.getMethodById(methodid);
            if (!unit || !method) {
                return;
            }
            unit.methods.push({id: uid(), methodid: String(method.id)});
            this.recomputeUnitDurations();
            this.renderAll();
            this.savePlanningState(true);
        }

        removeMethod(unitid, entryid) {
            const unit = this.state.units.find((u) => String(u.id) === String(unitid));
            if (!unit) {
                return;
            }
            unit.methods = unit.methods.filter((entry) => String(entry.id) !== String(entryid));
            this.recomputeUnitDurations();
            this.renderAll();
            this.savePlanningState(true);
        }

        moveMethod(unitid, entryid, step) {
            const unit = this.state.units.find((u) => String(u.id) === String(unitid));
            if (!unit) {
                return;
            }
            const list = unit.methods.slice();
            const idx = list.findIndex((entry) => String(entry.id) === String(entryid));
            if (idx < 0) {
                return;
            }
            const target = idx + step;
            if (target < 0 || target >= list.length) {
                return;
            }
            const tmp = list[idx];
            list[idx] = list[target];
            list[target] = tmp;
            unit.methods = list;
            this.recomputeUnitDurations();
            this.renderAll();
            this.savePlanningState(true);
        }

        replaceMethodAlternative(unitid, entryid, methodid) {
            const unit = this.state.units.find((u) => String(u.id) === String(unitid));
            if (!unit) {
                return;
            }
            unit.methods = unit.methods.map((entry) => {
                if (String(entry.id) !== String(entryid)) {
                    return entry;
                }
                return Object.assign({}, entry, {methodid: String(methodid)});
            });
            this.recomputeUnitDurations();
            this.renderAll();
            this.savePlanningState(true);
        }

        ensureFilter(slotkey) {
            if (!this.filters[slotkey]) {
                this.filters[slotkey] = {search: '', phase: [], tags: [], cognitive: []};
            }
            const current = this.filters[slotkey];
            if (!Array.isArray(current.phase)) {
                current.phase = current.phase ? [String(current.phase)] : [];
            }
            if (!Array.isArray(current.tags)) {
                current.tags = current.tags ? [String(current.tags)] : [];
            }
            if (!Array.isArray(current.cognitive)) {
                current.cognitive = current.cognitive ? [String(current.cognitive)] : [];
            }
            return this.filters[slotkey];
        }

        methodsForSlot(slotkey) {
            const filter = this.ensureFilter(slotkey);
            return this.methods.filter((method) => {
                const hay = normalizeText([
                    stripHtml(method.titel || ''),
                    stripHtml(method.kurzbeschreibung || ''),
                    splitMulti(method.tags).join(' ')
                ].join(' '));
                const phase = splitMulti(method.seminarphase).map((v) => normalizeText(v));
                const tags = splitMulti(method.tags).map((v) => normalizeText(v));
                const cognitive = splitMulti(method.kognitive).map((v) => normalizeText(v.split(/[:\-–]/)[0]));
                return (!filter.search || hay.includes(filter.search))
                    && (!filter.phase.length || filter.phase.some((value) => phase.includes(value)))
                    && (!filter.tags.length || filter.tags.some((value) => tags.includes(value)))
                    && (!filter.cognitive.length || filter.cognitive.some((value) => cognitive.includes(value)));
            });
        }

        getFilterLabel(field) {
            switch (field) {
            case 'phase':
                return 'Seminarphasen';
            case 'tags':
                return 'Tags';
            case 'cognitive':
                return 'Kognitive Dimensionen';
            default:
                return 'Filter';
            }
        }

        updateFilterDropdownLabel(wrapper, field) {
            if (!wrapper || !field || field === 'search') {
                return;
            }
            const toggle = bySel(`[data-filter-toggle="${field}"]`, wrapper);
            if (!toggle) {
                return;
            }
            const count = byAll(`[data-filter-option="${field}"]:checked`, wrapper).length;
            const label = this.getFilterLabel(field);
            toggle.textContent = count ? `${label} (${count})` : label;
        }

        renderMethodPool(wrapper, slotkey) {
            const pool = bySel('[data-pool="1"]', wrapper);
            if (!pool) {
                return;
            }
            const methods = this.methodsForSlot(slotkey);
            pool.innerHTML = '';
            if (!methods.length) {
                pool.innerHTML = '<p class="sp-filter-status">Keine Seminareinheiten für aktuellen Filter.</p>';
                return;
            }
            methods.forEach((method) => {
                const card = document.createElement('div');
                card.className = 'sp-card';
                const level = getMethodCognitiveLevel(method);
                if (level) {
                    card.classList.add(`sp-level-${level}`);
                }
                card.draggable = true;
                card.innerHTML = `<div class="sp-card-title"><strong>${escapeHtml(method.titel || '')}</strong></div><div class="sp-card-meta"><span class="sp-badge">${escapeHtml(method.zeitbedarf || '-')} Min</span></div><div class="sp-card-description">${escapeHtml(stripHtml(method.kurzbeschreibung || ''))}</div>`;
                card.addEventListener('dragstart', (event) => {
                    event.dataTransfer.setData('text/plain', JSON.stringify({type: 'method', methodid: String(method.id)}));
                });
                pool.appendChild(card);
            });
        }

        bindInlineTagDropdown(root, slotkey) {
            const dropdown = bySel(`[data-inline-tags-dropdown="${slotkey}"]`, root);
            const toggle = bySel('[data-inline-tags-toggle="1"]', dropdown);
            const panel = bySel('[data-inline-tags-panel="1"]', dropdown);
            const hidden = bySel('[data-f="tags"]', root);
            if (!dropdown || !toggle || !panel || !hidden) {
                return;
            }
            const update = () => {
                const values = byAll('[data-inline-tags-option="1"]:checked', dropdown)
                    .map((checkbox) => String(checkbox.value || '').trim())
                    .filter(Boolean);
                hidden.value = values.join('##');
                toggle.textContent = values.length ? `Tags (${values.length})` : 'Tags wählen';
            };
            toggle.addEventListener('click', () => {
                const opening = panel.classList.contains('kg-hidden');
                byAll('[data-inline-tags-panel="1"]', root).forEach((other) => {
                    if (other !== panel) {
                        other.classList.add('kg-hidden');
                    }
                });
                panel.classList.toggle('kg-hidden', !opening);
            });
            byAll('[data-inline-tags-option="1"]', dropdown).forEach((checkbox) => {
                checkbox.addEventListener('change', update);
            });
            document.addEventListener('click', (event) => {
                if (!dropdown.contains(event.target)) {
                    panel.classList.add('kg-hidden');
                }
            });
            update();
        }

        alternativeMethodIds(method) {
            const ids = [String(method.id)].concat(Array.isArray(method.alternativen) ? method.alternativen.map((id) => String(id)) : []);
            const unique = [];
            ids.forEach((id) => {
                if (!unique.includes(id) && this.getMethodById(id)) {
                    unique.push(id);
                }
            });
            return unique;
        }

        bindCanvasDrop(canvas, unitid) {
            canvas.addEventListener('dragover', (event) => {
                event.preventDefault();
                canvas.classList.add('kg-drop-over');
            });
            canvas.addEventListener('dragleave', () => canvas.classList.remove('kg-drop-over'));
            canvas.addEventListener('drop', (event) => {
                event.preventDefault();
                canvas.classList.remove('kg-drop-over');
                let payload = null;
                try {
                    payload = JSON.parse(event.dataTransfer.getData('text/plain') || '{}');
                } catch (e) {
                    payload = null;
                }
                if (!payload) {
                    return;
                }
                if (payload.type === 'method') {
                    this.attachMethod(unitid, payload.methodid);
                    return;
                }
                if (payload.type === 'new-inline-method') {
                    const method = this.createInlineMethod(payload.slotkey);
                    if (method) {
                        this.attachMethod(unitid, method.id);
                    }
                }
            });
        }

        renderUnitList() {
            const host = bySel('#kg-pm-unit-list');
            if (!host) {
                return;
            }
            host.innerHTML = '';
            const slots = this.getSlots();
            if (!slots.length) {
                host.innerHTML = '<p class="sp-filter-status">Noch keine Bausteine vorhanden.</p>';
                return;
            }
            slots.forEach((slot, idx) => {
                const row = document.createElement('div');
                row.className = 'kg-unit-row';
                const alternatives = this.getAlternativeUnits(slot.active);
                const hasalternatives = alternatives.length > 0;
                const alternativesummary = hasalternatives
                    ? `<div><strong>Alternativen:</strong> ${alternatives.map((unit) => `${escapeHtml(unit.title)} (${escapeHtml(String(unit.duration))} Min)`).join(' · ')}</div>`
                    : '';
                row.innerHTML = `
                    <div class="kg-unit-row-main">
                        <strong>${escapeHtml(slot.active.title)}</strong>
                        <span class="sp-badge">${slot.active.duration} Min</span>
                        ${hasalternatives ? '<span class="sp-badge">Alternative vorhanden</span>' : ''}
                    </div>
                    <div class="kg-unit-meta">
                        <div><strong>Lernziele:</strong> ${escapeHtml(stripHtml(slot.active.objectives || '')) || '<em>Keine Angaben</em>'}</div>
                        <div><strong>Themen:</strong> ${escapeHtml(stripHtml(slot.active.topics || '')) || '<em>Keine Angaben</em>'}</div>
                        ${alternativesummary}
                    </div>
                    <div class="kg-unit-row-actions">
                        <button class="kg-btn" data-act="edit">Bearbeiten</button>
                        <button class="kg-btn" data-act="up" ${idx === 0 ? 'disabled' : ''}>↑</button>
                        <button class="kg-btn" data-act="down" ${idx === slots.length - 1 ? 'disabled' : ''}>↓</button>
                        <button class="kg-btn" data-act="delete">Löschen</button>
                    </div>
                `;
                row.querySelector('[data-act="edit"]')?.addEventListener('click', () => this.editUnit(slot.active.id));
                row.querySelector('[data-act="up"]')?.addEventListener('click', () => this.moveSlot(slot.key, -1));
                row.querySelector('[data-act="down"]')?.addEventListener('click', () => this.moveSlot(slot.key, 1));
                row.querySelector('[data-act="delete"]')?.addEventListener('click', () => this.removeSlot(slot.key));
                host.appendChild(row);
            });
        }

        renderAccordion() {
            const host = bySel('#kg-pm-accordion');
            if (!host) {
                return;
            }
            const active = document.activeElement;
            const focusedSearchState = active && active.matches && active.matches('[data-filter="search"]')
                ? {
                    slotkey: String(active.closest('[data-slot-key]')?.getAttribute('data-slot-key') || ''),
                    start: typeof active.selectionStart === 'number' ? active.selectionStart : null,
                    end: typeof active.selectionEnd === 'number' ? active.selectionEnd : null
                }
                : null;
            host.innerHTML = '';
            this.getSlots().forEach((slot, slotIndex) => {
                const unit = slot.active;
                const alternatives = this.getAlternativeUnits(unit);
                const hasalternatives = alternatives.length > 0;
                const plannedduration = Math.max(5, Number.parseInt(unit.plannedduration || unit.duration, 10) || 90);
                const methodsduration = this.getUnitMethodsDuration(unit);
                const hasmethods = Array.isArray(unit.methods) && unit.methods.length > 0;
                const actualduration = hasmethods ? Math.max(5, methodsduration) : plannedduration;
                const overrun = hasmethods ? Math.max(0, methodsduration - plannedduration) : 0;
                const hasSavedOpen = Object.prototype.hasOwnProperty.call(this.state.openslots, slot.key);
                const open = hasSavedOpen ? !!this.state.openslots[slot.key] : slotIndex === 0;
                const filter = this.ensureFilter(slot.key);

                const wrapper = document.createElement('details');
                wrapper.className = 'kg-plan-row';
                wrapper.setAttribute('data-slot-key', slot.key);
                wrapper.open = open;
                wrapper.addEventListener('toggle', () => {
                    this.state.openslots[slot.key] = wrapper.open;
                    this.savePlanningState(true);
                });

                wrapper.innerHTML = `
                    <summary>
                        <div class="kg-plan-summary-top">
                            <span class="kg-accordion-indicator" aria-hidden="true">▸</span>
                            <span>${escapeHtml(unit.title)}</span>
                            <span class="sp-badge">${unit.duration} Min</span>
                            ${hasalternatives ? '<span class="sp-badge">Alternative vorhanden</span>' : ''}
                        </div>
                        <div class="kg-plan-summary-boxes">
                            <div class="kg-plan-summary-box">
                                <div class="kg-plan-summary-box-label">Lernziele</div>
                                <div class="kg-plan-summary-box-content">${sanitizeHtml(unit.objectives || '<em>Keine Angaben</em>')}</div>
                            </div>
                            <div class="kg-plan-summary-box">
                                <div class="kg-plan-summary-box-label">Themen</div>
                                <div class="kg-plan-summary-box-content">${sanitizeHtml(unit.topics || '<em>Keine Angaben</em>')}</div>
                            </div>
                        </div>
                    </summary>
                    <div class="kg-plan-grid">
                        <div class="kg-plan-col">
                            <h5>Baustein</h5>
                            <div class="sp-filter-status">Geplant (Schritt 1): ${escapeHtml(String(plannedduration))} Min</div>
                            <div class="sp-filter-status">Aktuell (Schritt 2): ${escapeHtml(String(actualduration))} Min</div>
                            ${hasalternatives ? `<div class="sp-filter-status">Alternativen: ${alternatives.map((entry) => escapeHtml(entry.title)).join(' · ')}</div>` : ''}
                            ${overrun > 0 ? `<div class="sp-filter-status kg-pm-overrun-warning"><span class="kg-pm-warning-triangle" aria-hidden="true"><span>!</span></span><span>Warnung: Geplante Dauer um ${escapeHtml(String(overrun))} Min überschritten.</span></div>` : ''}
                            <div class="sp-filter-status kg-dnd-hint">Zielbereich: Seminareinheiten hier hineinziehen.</div>
                            <div class="kg-unit-canvas kg-dnd-zone" data-canvas="1"></div>
                        </div>
                        <div class="kg-plan-col">
                            <h5>Pool der Seminareinheiten</h5>
                            <div class="sp-filter-status kg-dnd-hint">Quelle: Seminareinheit ziehen und im Zielbereich ablegen.</div>
                            <div class="kg-inline-filter">
                                <input class="kg-input" data-filter="search" type="search" value="${escapeHtml(filter.search)}" placeholder="Suche">
                                ${renderFilterDropdown('phase', 'Seminarphasen', PHASE_OPTIONS, filter.phase)}
                                ${renderTagFilterDropdown(slot.key, filter.tags, this.methods)}
                                ${renderFilterDropdown('cognitive', 'Kognitive Dimensionen', COGNITIVE_OPTIONS, filter.cognitive)}
                            </div>
                            <div class="kg-method-pool kg-dnd-source" data-pool="1"></div>
                        </div>
                        <div class="kg-plan-col">
                            <h5>Seminareinheit erstellen</h5>
                            <div class="kg-inline-form" data-inline-form="${escapeHtml(slot.key)}">
                                <label class="kg-label">Titel *</label><input class="kg-input" data-f="title" type="text">
                                <label class="kg-label">Lernziele (Ich kann ...)</label><textarea class="kg-input" data-f="objectives" rows="2"></textarea>
                                <details><summary>Weitere Felder</summary>
                                    <label class="kg-label">Zeitbedarf</label><input class="kg-input" data-f="duration" type="number" min="5" step="5" value="30">
                                    <label class="kg-label">Kurzbeschreibung</label><textarea class="kg-input" data-f="description" rows="2"></textarea>
                                </details>
                                <div class="kg-row">
                                    <button class="kg-btn kg-btn-primary" type="button" data-act="inline-create">Seminareinheit erstellen & einplanen</button>
                                    <div class="sp-card kg-inline-drag" draggable="true" data-act="inline-drag">Drag & Drop: In Zielbereich ziehen</div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;

                const canvas = bySel('[data-canvas="1"]', wrapper);
                if (canvas) {
                    this.bindCanvasDrop(canvas, unit.id);
                    if (!unit.methods.length) {
                        canvas.innerHTML = '<p class="sp-filter-status">Seminareinheiten hierher ziehen.</p>';
                    } else {
                        unit.methods.forEach((entry, index) => {
                            const method = this.getMethodById(entry.methodid);
                            if (!method) {
                                return;
                            }
                            const alternatives = this.alternativeMethodIds(method);
                            const selector = alternatives.length > 1
                                ? `<div class="kg-row"><span class="sp-badge">Alternative verfügbar</span><select class="kg-input" data-act="method-alt" data-entry="${escapeHtml(entry.id)}">${alternatives.map((id) => {
                                    const alt = this.getMethodById(id);
                                    return alt ? `<option value="${escapeHtml(id)}" ${id === String(method.id) ? 'selected' : ''}>${escapeHtml(alt.titel || id)}</option>` : '';
                                }).join('')}</select></div>`
                                : '';
                            const item = document.createElement('div');
                            item.className = 'sp-card kg-unit-method';
                            const level = getMethodCognitiveLevel(method);
                            if (level) {
                                item.classList.add(`sp-level-${level}`);
                            }
                            item.innerHTML = `
                                <div class="sp-card-title"><strong>${escapeHtml(method.titel || '')}</strong></div>
                                <div class="sp-card-meta"><span class="sp-badge">${escapeHtml(method.zeitbedarf || '-')} Min</span></div>
                                ${selector}
                                <div class="kg-row">
                                    <button class="kg-btn" data-act="entry-up" data-entry="${escapeHtml(entry.id)}" ${index === 0 ? 'disabled' : ''}>↑</button>
                                    <button class="kg-btn" data-act="entry-down" data-entry="${escapeHtml(entry.id)}" ${index === unit.methods.length - 1 ? 'disabled' : ''}>↓</button>
                                    <button class="kg-btn" data-act="entry-delete" data-entry="${escapeHtml(entry.id)}">Entfernen</button>
                                </div>
                            `;
                            canvas.appendChild(item);
                        });
                    }
                }

                this.renderMethodPool(wrapper, slot.key);

                byAll('[data-filter]', wrapper).forEach((input) => {
                    const apply = () => {
                        const field = String(input.getAttribute('data-filter') || '');
                        this.ensureFilter(slot.key)[field] = normalizeText(input.value);
                        this.renderMethodPool(wrapper, slot.key);
                    };
                    input.addEventListener('input', apply);
                    input.addEventListener('change', apply);
                    input.addEventListener('keydown', (event) => {
                        event.stopPropagation();
                    });
                });

                byAll('[data-filter-toggle]', wrapper).forEach((toggle) => {
                    toggle.addEventListener('click', () => {
                        const field = String(toggle.getAttribute('data-filter-toggle') || '');
                        const root = toggle.closest('[data-filter-dropdown]');
                        const panel = root ? bySel(`[data-filter-panel="${field}"]`, root) : null;
                        if (!panel) {
                            return;
                        }
                        const opening = panel.classList.contains('kg-hidden');
                        byAll('[data-filter-panel]', wrapper).forEach((other) => {
                            other.classList.add('kg-hidden');
                        });
                        panel.classList.toggle('kg-hidden', !opening);
                    });
                });

                byAll('[data-filter-option]', wrapper).forEach((checkbox) => {
                    checkbox.addEventListener('change', () => {
                        const field = String(checkbox.getAttribute('data-filter-option') || '');
                        if (!field) {
                            return;
                        }
                        this.ensureFilter(slot.key)[field] = byAll(`[data-filter-option="${field}"]:checked`, wrapper)
                            .map((option) => normalizeText(option.value))
                            .filter(Boolean);
                        this.updateFilterDropdownLabel(wrapper, field);
                        this.renderMethodPool(wrapper, slot.key);
                    });
                });
                ['phase', 'tags', 'cognitive'].forEach((field) => this.updateFilterDropdownLabel(wrapper, field));

                bySel('[data-act="inline-create"]', wrapper)?.addEventListener('click', () => {
                    const method = this.createInlineMethod(slot.key);
                    if (method) {
                        this.attachMethod(unit.id, method.id);
                    }
                });
                this.bindInlineTagDropdown(bySel(`[data-inline-form="${slot.key}"]`, wrapper), slot.key);
                bySel('[data-act="inline-drag"]', wrapper)?.addEventListener('dragstart', (event) => {
                    const root = bySel(`[data-inline-form="${slot.key}"]`, wrapper);
                    const title = String(bySel('[data-f="title"]', root)?.value || '').trim();
                    if (!title) {
                        event.preventDefault();
                        this.setStatus('Titel fehlt für neue Seminareinheit.', true);
                        return;
                    }
                    event.dataTransfer.setData('text/plain', JSON.stringify({type: 'new-inline-method', slotkey: slot.key}));
                });

                byAll('[data-act="entry-delete"]', wrapper).forEach((btn) => btn.addEventListener('click', () => this.removeMethod(unit.id, btn.getAttribute('data-entry'))));
                byAll('[data-act="entry-up"]', wrapper).forEach((btn) => btn.addEventListener('click', () => this.moveMethod(unit.id, btn.getAttribute('data-entry'), -1)));
                byAll('[data-act="entry-down"]', wrapper).forEach((btn) => btn.addEventListener('click', () => this.moveMethod(unit.id, btn.getAttribute('data-entry'), 1)));
                byAll('[data-act="method-alt"]', wrapper).forEach((select) => select.addEventListener('change', () => this.replaceMethodAlternative(unit.id, select.getAttribute('data-entry'), select.value)));

                host.appendChild(wrapper);
            });
            if (focusedSearchState && focusedSearchState.slotkey) {
                const search = bySel(`[data-slot-key="${focusedSearchState.slotkey}"] [data-filter="search"]`, host);
                if (search) {
                    search.focus();
                    if (focusedSearchState.start !== null && focusedSearchState.end !== null) {
                        search.setSelectionRange(focusedSearchState.start, focusedSearchState.end);
                    }
                }
            }
        }

        runDidacticCheck() {
            const output = bySel('#kg-pm-didactic');
            if (!output) {
                return;
            }
            const warnings = [];
            const sequence = [];
            this.getSlots().forEach((slot) => {
                slot.active.methods.forEach((entry) => {
                    const method = this.getMethodById(entry.methodid);
                    if (method) {
                        sequence.push(method);
                    }
                });
            });

            const social = sequence.map((m) => splitMulti(m.sozialform)[0] || '');
            for (let i = 2; i < social.length; i++) {
                if (social[i] && social[i] === social[i - 1] && social[i] === social[i - 2]) {
                    warnings.push('Abwechslung: Drei Seminareinheiten hintereinander mit gleicher Sozialform.');
                    break;
                }
            }
            const highload = sequence.map((m) => splitMulti(m.kognitive).map((v) => normalizeText(v.split(/[:\-–]/)[0]))
                .some((v) => ['analysieren', 'bewerten', 'erschaffen'].includes(v)));
            for (let i = 2; i < highload.length; i++) {
                if (highload[i] && highload[i - 1] && highload[i - 2]) {
                    warnings.push('Rhythmus: Mehrere kognitiv anspruchsvolle Seminareinheiten in Folge.');
                    break;
                }
            }
            const mentionstransfer = sequence.some((m) => normalizeText(m.lernziele).includes('transfer'));
            const endstransfer = sequence.length > 0 && splitMulti(sequence[sequence.length - 1].seminarphase).map((v) => normalizeText(v)).includes('transfer');
            if (mentionstransfer && !endstransfer) {
                warnings.push('Zielabdeckung: Transferziel genannt, aber kein klarer Transferabschluss am Ende.');
            }
            const prepheavy = sequence.filter((m) => normalizeText(m.vorbereitung).includes('>30')).length;
            if (prepheavy >= 3) {
                warnings.push('Machbarkeit: Häufung aufwändiger Vorbereitungen.');
            }

            if (!warnings.length) {
                output.innerHTML = '<p class="sp-filter-status">Keine auffälligen Risiken erkannt. Empfehlungen sind optional.</p>';
            } else {
                output.innerHTML = '<ul>' + warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('') + '</ul>';
            }
            const recommendations = bySel('#kg-pm-didactic')?.closest('.kg-ie-block');
            if (recommendations) {
                recommendations.scrollIntoView({behavior: 'smooth', block: 'start'});
                const focusTarget = bySel('#kg-pm-didactic');
                if (focusTarget) {
                    focusTarget.setAttribute('tabindex', '-1');
                    focusTarget.focus({preventScroll: true});
                }
            }
            this.setStatus('Didaktische Empfehlungen aktualisiert.', false);
        }

        renderAll() {
            this.recomputeUnitDurations();
            this.ensureUnitAlternativeSlots();
            this.normalizeActiveFlags();
            this.updateUnitFormMode();
            this.refreshAlternativeUnitOptions();
            this.renderUnitList();
            this.renderAccordion();
        }

        applyRequestedEditFromUrl() {
            if (typeof window === 'undefined' || !window.location) {
                return;
            }
            const params = new URLSearchParams(window.location.search || '');
            const requested = String(params.get('editunitid') || '').trim();
            const focus = String(params.get('focus') || '').trim().toLowerCase();
            if (!requested) {
                return;
            }
            const unit = this.state.units.find((entry) => String(entry.id) === requested);
            if (!unit) {
                this.setStatus('Baustein aus Link wurde nicht gefunden.', true);
                return;
            }
            if (focus === 'step2') {
                const slotkey = this.getSlotKey(unit);
                this.state.units.forEach((entry) => {
                    if (this.getSlotKey(entry) === slotkey) {
                        entry.active = String(entry.id) === String(unit.id);
                    }
                });
                this.state.openslots[slotkey] = true;
                this.renderAll();

                const section = bySel('#kg-pm-step-2');
                if (section) {
                    section.scrollIntoView({behavior: 'smooth', block: 'start'});
                }
                const slotRow = byAll('.kg-plan-row').find((row) => String(row.getAttribute('data-slot-key') || '') === slotkey);
                if (slotRow) {
                    slotRow.open = true;
                    slotRow.scrollIntoView({behavior: 'smooth', block: 'start'});
                }
                return;
            }
            this.editUnit(unit.id);
            const target = bySel('#kg-pm-unit-title');
            if (target) {
                target.scrollIntoView({behavior: 'smooth', block: 'center'});
                target.focus({preventScroll: true});
            }
        }

        loadMethods() {
            return asCall('mod_seminarplaner_get_method_cards', {cmid: this.cmid}).then((res) => {
                let parsed = [];
                try {
                    parsed = res.methodsjson ? JSON.parse(res.methodsjson) : [];
                } catch (e) {
                    parsed = [];
                }
                this.methods = Array.isArray(parsed) ? parsed : [];
                this.ensureMethodAlternatives();
            });
        }

        loadPlanningState() {
            return asCall('mod_seminarplaner_get_planning_state', {cmid: this.cmid}).then((res) => {
                let parsed = {};
                try {
                    parsed = res.statejson ? JSON.parse(res.statejson) : {};
                } catch (e) {
                    parsed = {};
                }
                this.state = this.normalizeState(parsed);
                this.ensureUnitAlternativeSlots();
                this.normalizeActiveFlags();
                this.recomputeUnitDurations();
                this.versionhash = String(res.versionhash || '');
            });
        }

        savePlanningState(silent) {
            this.ensureUnitAlternativeSlots();
            this.normalizeActiveFlags();
            const overruns = this.recomputeUnitDurations();
            return asCall('mod_seminarplaner_save_planning_state', {
                cmid: this.cmid,
                statejson: JSON.stringify(this.state),
                expectedhash: this.versionhash || ''
            }).then((res) => {
                this.versionhash = String(res.versionhash || '');
                if (!silent) {
                    const timestr = new Date().toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'});
                    if (overruns.length) {
                        this.setStatus(`Baustein gespeichert (${timestr}). Warnung: ${overruns.length} Baustein(e) überschreiten die geplante Dauer.`, true);
                    } else {
                        this.setStatus(`Baustein gespeichert (${timestr}).`, false);
                    }
                }
            }).catch((error) => {
                if (!silent) {
                    Notification.exception(error);
                    this.setStatus('Baustein konnte nicht gespeichert werden.', true);
                }
            });
        }
    }

    return {
        init: function(cmid) {
            return new PlanningMode(cmid);
        }
    };
});
