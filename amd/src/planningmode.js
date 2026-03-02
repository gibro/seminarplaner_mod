define(['core/ajax', 'core/notification'], function(Ajax, Notification) {
    const bySel = (sel, root) => (root || document).querySelector(sel);
    const byAll = (sel, root) => Array.from((root || document).querySelectorAll(sel));
    const asCall = (methodname, args) => Ajax.call([{methodname, args}])[0];
    const uid = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

    const PHASE_OPTIONS = ['Warm-Up', 'Einstieg', 'Erwartungsabfrage', 'Vorwissen aktivieren', 'Wissen vermitteln', 'Reflexion',
        'Transfer', 'Evaluation/Feedback', 'Abschluss'];
    const GROUP_OPTIONS = ['1', '2-3', '3–5', '6–12', '13–24', '25+', 'beliebig'];
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
        }

        normalizeState(raw) {
            const units = Array.isArray(raw.units) ? raw.units : [];
            const slotorder = Array.isArray(raw.slotorder) ? raw.slotorder.map((v) => String(v || '')) : [];
            const openslots = raw.openslots && typeof raw.openslots === 'object' ? raw.openslots : {};
            return {
                units: units.map((unit) => ({
                    id: String(unit.id || uid()),
                    title: String(unit.title || 'Ohne Titel').trim(),
                    duration: Math.max(5, Number.parseInt(unit.duration, 10) || 90),
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

        getSlotKey(unit) {
            return unit.slotkey ? `group:${unit.slotkey}` : `unit:${unit.id}`;
        }

        getSlots() {
            const grouped = {};
            this.state.units.forEach((unit) => {
                const key = this.getSlotKey(unit);
                if (!grouped[key]) {
                    grouped[key] = [];
                }
                grouped[key].push(unit);
            });
            const order = this.state.slotorder.filter((key) => !!grouped[key]);
            Object.keys(grouped).forEach((key) => {
                if (!order.includes(key)) {
                    order.push(key);
                }
            });
            this.state.slotorder = order;
            return order.map((key) => {
                const units = grouped[key];
                let active = units.find((u) => u.active);
                if (!active) {
                    active = units[0];
                    active.active = true;
                }
                return {key, units, active};
            });
        }

        addUnit() {
            const title = String(bySel('#kg-pm-unit-title')?.value || '').trim();
            if (!title) {
                this.setStatus('Bitte Titel eingeben.', true);
                return;
            }
            const duration = Math.max(5, Number.parseInt(bySel('#kg-pm-unit-duration')?.value || '90', 10) || 90);
            const slotkey = String(bySel('#kg-pm-unit-slotkey')?.value || '').trim();
            const objectives = sanitizeHtml(this.readRichText('#kg-pm-unit-objectives'));
            const topics = sanitizeHtml(this.readRichText('#kg-pm-unit-topics'));
            if (this.editingUnitId) {
                this.state.units = this.state.units.map((unit) => {
                    if (String(unit.id) !== String(this.editingUnitId)) {
                        return unit;
                    }
                    return Object.assign({}, unit, {title, duration, slotkey, objectives, topics});
                });
                this.normalizeActiveFlags();
                this.resetUnitForm();
                this.renderAll();
                this.savePlanningState(true);
                return;
            }
            const unit = {id: uid(), title, duration, slotkey, objectives, topics, active: true, methods: []};
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
            bySel('#kg-pm-unit-duration').value = String(unit.duration || 90);
            bySel('#kg-pm-unit-slotkey').value = unit.slotkey || '';
            this.setRichText('#kg-pm-unit-objectives', unit.objectives || '');
            this.setRichText('#kg-pm-unit-topics', unit.topics || '');
            this.updateUnitFormMode();
        }

        resetUnitForm() {
            this.editingUnitId = '';
            bySel('#kg-pm-unit-title').value = '';
            bySel('#kg-pm-unit-duration').value = '90';
            bySel('#kg-pm-unit-slotkey').value = '';
            this.setRichText('#kg-pm-unit-objectives', '');
            this.setRichText('#kg-pm-unit-topics', '');
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
            const ids = new Set(this.methods.map((m) => String(m.id || '')));
            this.methods = this.methods.map((method) => {
                const normalized = Object.assign({}, method);
                normalized.alternativen = Array.isArray(method.alternativen) ? method.alternativen : [];
                normalized.alternativen = normalized.alternativen
                    .map((id) => String(id || ''))
                    .filter((id) => id && id !== String(normalized.id) && ids.has(id));
                return normalized;
            });
        }

        createInlineMethod(slotkey) {
            const root = bySel(`[data-inline-form="${slotkey}"]`);
            if (!root) {
                return null;
            }
            const title = String(bySel('[data-f="title"]', root)?.value || '').trim();
            if (!title) {
                this.setStatus('Bitte einen Titel für die Methode eingeben.', true);
                return null;
            }
            const method = {
                id: uid(),
                titel: title,
                seminarphase: String(bySel('[data-f="phase"]', root)?.value || '').trim() ? [String(bySel('[data-f="phase"]', root)?.value || '').trim()] : [],
                zeitbedarf: String(bySel('[data-f="duration"]', root)?.value || '').trim(),
                gruppengroesse: String(bySel('[data-f="group"]', root)?.value || '').trim(),
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
            return method;
        }

        persistMethods(silent) {
            return asCall('mod_konzeptgenerator_save_method_cards', {
                cmid: this.cmid,
                methodsjson: JSON.stringify(this.methods)
            }).then(() => {
                if (!silent) {
                    this.setStatus('Methoden gespeichert.', false);
                }
            }).catch((error) => {
                if (!silent) {
                    Notification.exception(error);
                    this.setStatus('Methoden konnten nicht gespeichert werden.', true);
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
            this.renderAll();
            this.savePlanningState(true);
        }

        removeMethod(unitid, entryid) {
            const unit = this.state.units.find((u) => String(u.id) === String(unitid));
            if (!unit) {
                return;
            }
            unit.methods = unit.methods.filter((entry) => String(entry.id) !== String(entryid));
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
            this.renderAll();
            this.savePlanningState(true);
        }

        ensureFilter(slotkey) {
            if (!this.filters[slotkey]) {
                this.filters[slotkey] = {search: '', phase: [], group: [], cognitive: []};
            }
            const current = this.filters[slotkey];
            if (!Array.isArray(current.phase)) {
                current.phase = current.phase ? [String(current.phase)] : [];
            }
            if (!Array.isArray(current.group)) {
                current.group = current.group ? [String(current.group)] : [];
            }
            if (!Array.isArray(current.cognitive)) {
                current.cognitive = current.cognitive ? [String(current.cognitive)] : [];
            }
            return this.filters[slotkey];
        }

        methodsForSlot(slotkey) {
            const filter = this.ensureFilter(slotkey);
            return this.methods.filter((method) => {
                const hay = [method.titel, method.kurzbeschreibung, method.tags].join(' ').toLowerCase();
                const phase = splitMulti(method.seminarphase).map((v) => normalizeText(v));
                const cognitive = splitMulti(method.kognitive).map((v) => normalizeText(v.split(/[:\-–]/)[0]));
                const group = normalizeText(method.gruppengroesse);
                return (!filter.search || hay.includes(filter.search))
                    && (!filter.phase.length || filter.phase.some((value) => phase.includes(value)))
                    && (!filter.group.length || filter.group.includes(group))
                    && (!filter.cognitive.length || filter.cognitive.some((value) => cognitive.includes(value)));
            });
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
                const hasalternatives = slot.units.length > 1;
                row.innerHTML = `
                    <div class="kg-unit-row-main">
                        <strong>${escapeHtml(slot.active.title)}</strong>
                        <span class="sp-badge">${slot.active.duration} Min</span>
                        ${hasalternatives ? '<span class="sp-badge">Alternative vorhanden</span>' : ''}
                    </div>
                    <div class="kg-unit-meta">
                        <div><strong>Lernziele:</strong> ${escapeHtml(stripHtml(slot.active.objectives || '')) || '<em>Keine Angaben</em>'}</div>
                        <div><strong>Themen:</strong> ${escapeHtml(stripHtml(slot.active.topics || '')) || '<em>Keine Angaben</em>'}</div>
                    </div>
                    <div class="kg-unit-row-actions">
                        <button class="kg-btn" data-act="edit">Bearbeiten</button>
                        <button class="kg-btn" data-act="up" ${idx === 0 ? 'disabled' : ''}>↑</button>
                        <button class="kg-btn" data-act="down" ${idx === slots.length - 1 ? 'disabled' : ''}>↓</button>
                        <button class="kg-btn" data-act="delete">Löschen</button>
                    </div>
                    ${hasalternatives ? `<div><label class="kg-label">Aktive Alternative</label><select class="kg-input" data-act="select-active">${slot.units.map((unit) => `<option value="${escapeHtml(unit.id)}" ${unit.active ? 'selected' : ''}>${escapeHtml(unit.title)} (${unit.duration} Min)</option>`).join('')}</select></div>` : ''}
                `;
                row.querySelector('[data-act="edit"]')?.addEventListener('click', () => this.editUnit(slot.active.id));
                row.querySelector('[data-act="up"]')?.addEventListener('click', () => this.moveSlot(slot.key, -1));
                row.querySelector('[data-act="down"]')?.addEventListener('click', () => this.moveSlot(slot.key, 1));
                row.querySelector('[data-act="delete"]')?.addEventListener('click', () => this.removeSlot(slot.key));
                row.querySelector('[data-act="select-active"]')?.addEventListener('change', (event) => this.setActiveSlotUnit(slot.key, event.target.value));
                host.appendChild(row);
            });
        }

        renderAccordion() {
            const host = bySel('#kg-pm-accordion');
            if (!host) {
                return;
            }
            host.innerHTML = '';
            this.getSlots().forEach((slot, slotIndex) => {
                const unit = slot.active;
                const hasSavedOpen = Object.prototype.hasOwnProperty.call(this.state.openslots, slot.key);
                const open = hasSavedOpen ? !!this.state.openslots[slot.key] : slotIndex === 0;
                const filter = this.ensureFilter(slot.key);
                const methods = this.methodsForSlot(slot.key);

                const wrapper = document.createElement('details');
                wrapper.className = 'kg-plan-row';
                wrapper.open = open;
                wrapper.addEventListener('toggle', () => {
                    this.state.openslots[slot.key] = wrapper.open;
                    this.savePlanningState(true);
                });

                const alternativeselector = slot.units.length > 1
                    ? `<select class="kg-input" data-act="accordion-select">${slot.units.map((entry) => `<option value="${escapeHtml(entry.id)}" ${entry.active ? 'selected' : ''}>${escapeHtml(entry.title)}</option>`).join('')}</select>`
                    : '';

                wrapper.innerHTML = `
                    <summary>
                        <div class="kg-plan-summary-top">
                            <span class="kg-accordion-indicator" aria-hidden="true">▸</span>
                            <span>${escapeHtml(unit.title)}</span>
                            <span class="sp-badge">${unit.duration} Min</span>
                            ${slot.units.length > 1 ? '<span class="sp-badge">Alternative vorhanden</span>' : ''}
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
                            <div class="sp-filter-status">Gesamtdauer: ${escapeHtml(String(unit.duration || 0))} Min</div>
                            ${alternativeselector}
                            <div class="kg-unit-canvas" data-canvas="1"></div>
                        </div>
                        <div class="kg-plan-col">
                            <h5>Methodenpool</h5>
                            <div class="kg-inline-filter">
                                <input class="kg-input" data-filter="search" type="search" value="${escapeHtml(filter.search)}" placeholder="Suche">
                                ${renderFilterDropdown('phase', 'Seminarphasen', PHASE_OPTIONS, filter.phase)}
                                ${renderFilterDropdown('group', 'Gruppengrößen', GROUP_OPTIONS, filter.group)}
                                ${renderFilterDropdown('cognitive', 'Kognitive Dimensionen', COGNITIVE_OPTIONS, filter.cognitive)}
                            </div>
                            <div class="kg-method-pool" data-pool="1"></div>
                        </div>
                        <div class="kg-plan-col">
                            <h5>Methode erstellen</h5>
                            <div class="kg-inline-form" data-inline-form="${escapeHtml(slot.key)}">
                                <label class="kg-label">Titel *</label><input class="kg-input" data-f="title" type="text">
                                <div class="kg-two">
                                    <div><label class="kg-label">Zeitbedarf</label><input class="kg-input" data-f="duration" type="number" min="5" step="5" value="30"></div>
                                    <div><label class="kg-label">Seminarphase</label><select class="kg-input" data-f="phase"><option value="">-</option>${PHASE_OPTIONS.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('')}</select></div>
                                </div>
                                <div class="kg-two">
                                    <div><label class="kg-label">Gruppengröße</label><select class="kg-input" data-f="group"><option value="">-</option>${GROUP_OPTIONS.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('')}</select></div>
                                    <div><label class="kg-label">Tags</label><input class="kg-input" data-f="tags" type="text"></div>
                                </div>
                                <details><summary>Weitere Felder</summary>
                                    <label class="kg-label">Kurzbeschreibung</label><textarea class="kg-input" data-f="description" rows="2"></textarea>
                                    <label class="kg-label">Lernziele</label><textarea class="kg-input" data-f="objectives" rows="2"></textarea>
                                    <label class="kg-label">Sozialform (Komma-getrennt)</label><input class="kg-input" data-f="social" type="text">
                                    <label class="kg-label">Kognitive Dimension (Komma-getrennt)</label><input class="kg-input" data-f="cognitive" type="text">
                                    <label class="kg-label">Vorbereitung nötig</label><input class="kg-input" data-f="prep" type="text">
                                    <label class="kg-label">Material/Technik</label><textarea class="kg-input" data-f="materials" rows="2"></textarea>
                                    <label class="kg-label">Ablauf</label><textarea class="kg-input" data-f="flow" rows="2"></textarea>
                                    <label class="kg-label">Debrief</label><textarea class="kg-input" data-f="debrief" rows="2"></textarea>
                                </details>
                                <div class="kg-row">
                                    <button class="kg-btn kg-btn-primary" type="button" data-act="inline-create">Methode erstellen & einplanen</button>
                                    <div class="sp-card kg-inline-drag" draggable="true" data-act="inline-drag">In Bereich ziehen</div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;

                wrapper.querySelector('[data-act="accordion-select"]')?.addEventListener('change', (event) => {
                    this.setActiveSlotUnit(slot.key, event.target.value);
                });

                const canvas = bySel('[data-canvas="1"]', wrapper);
                if (canvas) {
                    this.bindCanvasDrop(canvas, unit.id);
                    if (!unit.methods.length) {
                        canvas.innerHTML = '<p class="sp-filter-status">Methoden hierher ziehen.</p>';
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
                                <div class="sp-card-meta"><span class="sp-badge">${escapeHtml(method.zeitbedarf || '-')} Min</span><span class="sp-badge">${escapeHtml(method.gruppengroesse || '-')}</span></div>
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

                const pool = bySel('[data-pool="1"]', wrapper);
                if (pool) {
                    if (!methods.length) {
                        pool.innerHTML = '<p class="sp-filter-status">Keine Methoden für aktuellen Filter.</p>';
                    } else {
                        methods.forEach((method) => {
                            const card = document.createElement('div');
                            card.className = 'sp-card';
                            const level = getMethodCognitiveLevel(method);
                            if (level) {
                                card.classList.add(`sp-level-${level}`);
                            }
                            card.draggable = true;
                            card.innerHTML = `<div class="sp-card-title"><strong>${escapeHtml(method.titel || '')}</strong></div><div class="sp-card-meta"><span class="sp-badge">${escapeHtml(method.zeitbedarf || '-')} Min</span><span class="sp-badge">${escapeHtml(method.gruppengroesse || '-')}</span></div><div class="sp-card-description">${escapeHtml(method.kurzbeschreibung || '')}</div>`;
                            card.addEventListener('dragstart', (event) => {
                                event.dataTransfer.setData('text/plain', JSON.stringify({type: 'method', methodid: String(method.id)}));
                            });
                            pool.appendChild(card);
                        });
                    }
                }

                byAll('[data-filter]', wrapper).forEach((input) => {
                    const apply = () => {
                        const field = String(input.getAttribute('data-filter') || '');
                        this.ensureFilter(slot.key)[field] = normalizeText(input.value);
                        this.renderAccordion();
                    };
                    input.addEventListener('input', apply);
                    input.addEventListener('change', apply);
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
                        this.renderAccordion();
                    });
                });

                bySel('[data-act="inline-create"]', wrapper)?.addEventListener('click', () => {
                    const method = this.createInlineMethod(slot.key);
                    if (method) {
                        this.attachMethod(unit.id, method.id);
                    }
                });
                bySel('[data-act="inline-drag"]', wrapper)?.addEventListener('dragstart', (event) => {
                    const root = bySel(`[data-inline-form="${slot.key}"]`, wrapper);
                    const title = String(bySel('[data-f="title"]', root)?.value || '').trim();
                    if (!title) {
                        event.preventDefault();
                        this.setStatus('Titel fehlt für neue Methode.', true);
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
                    warnings.push('Abwechslung: Drei Methoden hintereinander mit gleicher Sozialform.');
                    break;
                }
            }
            const highload = sequence.map((m) => splitMulti(m.kognitive).map((v) => normalizeText(v.split(/[:\-–]/)[0]))
                .some((v) => ['analysieren', 'bewerten', 'erschaffen'].includes(v)));
            for (let i = 2; i < highload.length; i++) {
                if (highload[i] && highload[i - 1] && highload[i - 2]) {
                    warnings.push('Rhythmus: Mehrere kognitiv anspruchsvolle Methoden in Folge.');
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
            this.updateUnitFormMode();
            this.renderUnitList();
            this.renderAccordion();
        }

        loadMethods() {
            return asCall('mod_konzeptgenerator_get_method_cards', {cmid: this.cmid}).then((res) => {
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
            return asCall('mod_konzeptgenerator_get_planning_state', {cmid: this.cmid}).then((res) => {
                let parsed = {};
                try {
                    parsed = res.statejson ? JSON.parse(res.statejson) : {};
                } catch (e) {
                    parsed = {};
                }
                this.state = this.normalizeState(parsed);
                this.versionhash = String(res.versionhash || '');
            });
        }

        savePlanningState(silent) {
            return asCall('mod_konzeptgenerator_save_planning_state', {
                cmid: this.cmid,
                statejson: JSON.stringify(this.state),
                expectedhash: this.versionhash || ''
            }).then((res) => {
                this.versionhash = String(res.versionhash || '');
                if (!silent) {
                    const timestr = new Date().toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'});
                    this.setStatus(`Baustein gespeichert (${timestr}).`, false);
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
