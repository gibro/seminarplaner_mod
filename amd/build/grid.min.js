define(['core/ajax', 'core/notification'], function(Ajax, Notification) {
    const DAYS_ALL = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
    const ZOOM_LEVELS = [
        {id: 'fine', label: '5 Min', slotMinutes: 5, slotPx: 18, labelEverySlots: 3, showMinor: true},
        {id: 'medium', label: '15 Min', slotMinutes: 15, slotPx: 26, labelEverySlots: 1, showMinor: true},
        {id: 'coarse', label: '30 Min', slotMinutes: 30, slotPx: 30, labelEverySlots: 2, showMinor: false}
    ];

    const COGNITIVE_LEVELS = {
        erinnern: 1,
        verstehen: 2,
        anwenden: 3,
        analysieren: 4,
        bewerten: 5,
        erschaffen: 6
    };
    const FILTER_DROPDOWNS = {
        tags: {
            root: '#sp-filter-tags-dropdown',
            toggle: '#sp-filter-tags-toggle',
            panel: '#sp-filter-tags-panel',
            all: '#sp-filter-tags-all',
            options: '#sp-filter-tags-options',
            labelAll: 'Alle Tags',
            labelSome: 'Tags'
        },
        phase: {
            root: '#sp-filter-phase-dropdown',
            toggle: '#sp-filter-phase-toggle',
            panel: '#sp-filter-phase-panel',
            all: '#sp-filter-phase-all',
            options: '#sp-filter-phase-options',
            labelAll: 'Alle Seminarphasen',
            labelSome: 'Seminarphasen'
        },
        group: {
            root: '#sp-filter-group-dropdown',
            toggle: '#sp-filter-group-toggle',
            panel: '#sp-filter-group-panel',
            all: '#sp-filter-group-all',
            options: '#sp-filter-group-options',
            labelAll: 'Alle Gruppengrößen',
            labelSome: 'Gruppengrößen'
        },
        duration: {
            root: '#sp-filter-duration-dropdown',
            toggle: '#sp-filter-duration-toggle',
            panel: '#sp-filter-duration-panel',
            all: '#sp-filter-duration-all',
            options: '#sp-filter-duration-options',
            labelAll: 'Alle Zeiten',
            labelSome: 'Zeiten'
        },
        cognitive: {
            root: '#sp-filter-cognitive-dropdown',
            toggle: '#sp-filter-cognitive-toggle',
            panel: '#sp-filter-cognitive-panel',
            all: '#sp-filter-cognitive-all',
            options: '#sp-filter-cognitive-options',
            labelAll: 'Alle Dimensionen',
            labelSome: 'Dimensionen'
        }
    };
    const GRID_PRESETS = {
        'standard-week': {days: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'], timeRange: {start: '08:30', end: '17:30'}, granularity: 15, breaks: [{days: ['all'], start: '12:00', duration: 60}]},
        'weekend-seminar': {days: ['Freitag', 'Samstag', 'Sonntag'], timeRange: {start: '08:30', end: '17:30'}, granularity: 15, breaks: [{days: ['all'], start: '12:00', duration: 60}]},
        'half-week-mo-mi': {days: ['Montag', 'Dienstag', 'Mittwoch'], timeRange: {start: '08:30', end: '17:30'}, granularity: 15, breaks: [{days: ['all'], start: '12:00', duration: 60}]},
        'half-week-mi-fr': {days: ['Mittwoch', 'Donnerstag', 'Freitag'], timeRange: {start: '08:30', end: '17:30'}, granularity: 15, breaks: [{days: ['all'], start: '12:00', duration: 60}]},
        'compact-day': {days: ['Montag'], timeRange: {start: '08:30', end: '17:30'}, granularity: 15, breaks: [{days: ['all'], start: '12:00', duration: 60}]}
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

    const bySel = (sel) => document.querySelector(sel);
    const byAll = (sel, root) => Array.from((root || document).querySelectorAll(sel));
    const asCall = (methodname, args) => Ajax.call([{methodname, args}])[0];
    const uid = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const getValue = (sel) => {
        const el = bySel(sel);
        return el ? String(el.value || '') : '';
    };

    const toMin = (h, m) => h * 60 + m;
    const label = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
    const parseTimeToMinutes = (value) => {
        if (!value) {
            return null;
        }
        const parts = String(value).split(':');
        const hh = Number.parseInt(parts[0], 10);
        const mm = Number.parseInt(parts[1], 10);
        if (!Number.isFinite(hh) || !Number.isFinite(mm)) {
            return null;
        }
        return toMin(hh, mm);
    };

    const escapeHtml = (str) => String(str || '').replace(/[&<>"']/g, (ch) => {
        return ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[ch] || ch;
    });
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

    class Seminarplaner {
        constructor(cmid) {
            this.cmid = cmid;
            this.wrapper = bySel('.sp-wrapper');
            this.msg = bySel('#sp-msg');
            this.status = bySel('#kg-status');
            this.zoomIndex = 1;
            this.versionhash = '';
            this.methods = [];
            this.planningState = {units: [], slotorder: []};
            this.filterIndex = [];
            this.debounceTimer = null;
            this.autosaveTimer = null;
            this.dirty = false;
            this.breakModal = null;
            this.methodDetailModal = null;
            this.saveInFlight = null;
            this.pendingSaveOptions = null;

            this.state = {
                gridid: 0,
                meta: {title: '', date: '', number: '', contact: ''},
                config: {
                    preset: 'standard-week',
                    days: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'],
                    timeRange: {start: '08:30', end: '17:30'},
                    granularity: 15,
                    breaks: [{days: ['all'], start: '12:00', duration: 60}],
                    tableColumns: Object.assign({}, DEFAULT_COLUMNS)
                },
                plan: {days: {}},
                sourceMode: 'methods'
            };

            if (!this.wrapper) {
                return;
            }

            this.ensurePlanDays();
            this.bindTopbar();
            this.bindToolbar();
            this.bindConfigModal();
            this.bindFilters();
            this.bindSourceControls();
            this.createBreakModal();
            this.createMethodDetailModal();
            this.bindAutoSaveLifecycle();
            this.initData();
        }

        setStatus(text, isError = false) {
            if (!this.status) {
                return;
            }
            this.status.textContent = text;
            this.status.style.color = isError ? '#b91c1c' : '#166534';
        }

        syncSourceTabs() {
            const tabs = byAll('[data-tab-value]', bySel('#sp-source-tabs'));
            const panels = byAll('[data-tab-info]');
            const activeId = this.state.sourceMode === 'units' ? '#sp-tab-units' : '#sp-tab-methods';
            tabs.forEach((tab) => {
                const selected = String(tab.getAttribute('data-tab-value') || '') === activeId;
                tab.classList.toggle('is-active', selected);
                tab.setAttribute('aria-selected', selected ? 'true' : 'false');
            });
            panels.forEach((panel) => {
                const panelid = `#${panel.id}`;
                panel.classList.toggle('active', panelid === activeId);
            });
        }

        setSourceMode(mode, autosave = true) {
            this.state.sourceMode = mode === 'units' ? 'units' : 'methods';
            this.syncSourceTabs();
            this.renderMethods();
            if (autosave) {
                this.scheduleAutosave();
            }
        }

        warn(text) {
            if (this.msg) {
                this.msg.textContent = text;
            }
            this.setStatus(text, true);
        }

        clearWarn() {
            if (this.msg) {
                this.msg.textContent = '';
            }
        }

        toggleStepTwo(visible) {
            const section = bySel('#kg-grid-step-2');
            if (!section) {
                return;
            }
            section.classList.toggle('kg-hidden', !visible);
        }

        openConfigModal() {
            const panel = bySel('#sp-config-inline');
            if (!panel) {
                return;
            }
            this.applyConfigToModal();
            panel.classList.remove('kg-hidden');
            panel.scrollIntoView({behavior: 'smooth', block: 'start'});
        }

        closeConfigPanel() {
            const panel = bySel('#sp-config-inline');
            if (!panel) {
                return;
            }
            panel.classList.add('kg-hidden');
        }

        resetLoadedGridState() {
            const normalized = this.normalizeLoadedState({});
            this.state = Object.assign({}, this.state, normalized, {gridid: 0});
            this.versionhash = '';
            this.ensurePlanDays();
            this.syncSourceTabs();
            this.renderMethods();
            this.applyConfigToModal();
            this.refreshLayout();
        }

        getGridId() {
            const select = bySel('#kg-grid-select');
            if (!select || !select.value) {
                return 0;
            }
            return Number.parseInt(select.value, 10) || 0;
        }

        snapDuration(raw) {
            const granularity = Number(this.state.config.granularity || 15);
            const value = Number.parseInt(raw, 10);
            if (!Number.isFinite(value) || value <= 0) {
                return granularity;
            }
            return Math.max(granularity, Math.ceil(value / granularity) * granularity);
        }

        ensurePlanDays() {
            if (!this.state.plan || !this.state.plan.days) {
                this.state.plan = {days: {}};
            }
            this.state.config.days.forEach((day) => {
                if (!Array.isArray(this.state.plan.days[day])) {
                    this.state.plan.days[day] = [];
                }
            });
            Object.keys(this.state.plan.days).forEach((day) => {
                if (!this.state.config.days.includes(day)) {
                    delete this.state.plan.days[day];
                }
            });
        }

        normalizePlanningState(raw) {
            const units = Array.isArray((raw || {}).units) ? raw.units : [];
            const slotorder = Array.isArray((raw || {}).slotorder) ? raw.slotorder.map((entry) => String(entry || '')) : [];
            return {
                units: units.map((unit) => ({
                    id: String(unit.id || uid()),
                    title: String(unit.title || 'Ohne Titel').trim(),
                    duration: Math.max(5, Number.parseInt(unit.duration, 10) || 90),
                    slotkey: String(unit.slotkey || '').trim(),
                    topics: sanitizeHtml(unit.topics || ''),
                    objectives: sanitizeHtml(unit.objectives || ''),
                    active: unit.active !== false,
                    methods: Array.isArray(unit.methods) ? unit.methods.map((entry) => ({
                        id: String(entry.id || uid()),
                        methodid: String(entry.methodid || '')
                    })).filter((entry) => entry.methodid) : []
                })),
                slotorder
            };
        }

        getPlanningSlotKey(unit) {
            return unit.slotkey ? `group:${unit.slotkey}` : `unit:${unit.id}`;
        }

        getPlanningSlots() {
            const grouped = {};
            this.planningState.units.forEach((unit) => {
                const key = this.getPlanningSlotKey(unit);
                if (!grouped[key]) {
                    grouped[key] = [];
                }
                grouped[key].push(unit);
            });
            const order = this.planningState.slotorder.filter((key) => !!grouped[key]);
            Object.keys(grouped).forEach((key) => {
                if (!order.includes(key)) {
                    order.push(key);
                }
            });
            this.planningState.slotorder = order;
            return order.map((key) => {
                const units = grouped[key];
                let active = units.find((entry) => entry.active);
                if (!active) {
                    active = units[0];
                    active.active = true;
                }
                return {key, units, active};
            });
        }

        getPlanningSlot(slotkey) {
            return this.getPlanningSlots().find((slot) => slot.key === slotkey) || null;
        }

        getUnitById(unitid) {
            return this.planningState.units.find((unit) => String(unit.id) === String(unitid)) || null;
        }

        minutesToIndex(min) {
            const start = parseTimeToMinutes(this.state.config.timeRange.start);
            const slotMinutes = ZOOM_LEVELS[this.zoomIndex].slotMinutes;
            return Math.floor((min - start) / slotMinutes);
        }

        indexToMinutes(idx) {
            const start = parseTimeToMinutes(this.state.config.timeRange.start);
            const slotMinutes = ZOOM_LEVELS[this.zoomIndex].slotMinutes;
            return start + (idx * slotMinutes);
        }

        withinBounds(s, e) {
            const start = parseTimeToMinutes(this.state.config.timeRange.start);
            const end = parseTimeToMinutes(this.state.config.timeRange.end);
            return s >= start && e <= end;
        }

        overlaps(a, b) {
            return a.startMin < b.endMin && b.startMin < a.endMin;
        }

        hasCollision(list, candidate) {
            return (list || []).some((it) => this.overlaps(it, candidate));
        }

        getBreaksByDay() {
            const map = {};
            this.state.config.days.forEach((day) => {
                map[day] = (this.state.plan.days[day] || [])
                    .filter((entry) => entry.kind === 'break')
                    .map((entry) => ({start: entry.startMin, end: entry.endMin}))
                    .sort((a, b) => a.start - b.start);
            });
            return map;
        }

        nextFreeMinute(dayidx, minute, breaksByDay, days) {
            const dayStart = parseTimeToMinutes(this.state.config.timeRange.start);
            const dayEnd = parseTimeToMinutes(this.state.config.timeRange.end);
            let idx = dayidx;
            let current = minute;
            while (idx < days.length) {
                if (current < dayStart) {
                    current = dayStart;
                }
                if (current >= dayEnd) {
                    idx += 1;
                    current = dayStart;
                    continue;
                }
                const breaks = breaksByDay[days[idx]] || [];
                const blocking = breaks.find((br) => current >= br.start && current < br.end);
                if (!blocking) {
                    return {dayidx: idx, minute: current};
                }
                current = blocking.end;
            }
            return {dayidx: Math.max(0, days.length - 1), minute: dayEnd};
        }

        allocateAcrossPlan(startday, startmin, totalduration) {
            const days = this.state.config.days.slice();
            if (!days.length) {
                return {segments: [], endday: startday, endmin: startmin};
            }
            const dayStart = parseTimeToMinutes(this.state.config.timeRange.start);
            const dayEnd = parseTimeToMinutes(this.state.config.timeRange.end);
            const breaksByDay = this.getBreaksByDay();
            let remaining = Math.max(0, Number(totalduration || 0));
            let dayidx = Math.max(0, days.indexOf(startday));
            let pointer = Number.isFinite(startmin) ? startmin : dayStart;
            const segments = [];

            const first = this.nextFreeMinute(dayidx, pointer, breaksByDay, days);
            dayidx = first.dayidx;
            pointer = first.minute;

            while (remaining > 0 && dayidx < days.length) {
                const free = this.nextFreeMinute(dayidx, pointer, breaksByDay, days);
                dayidx = free.dayidx;
                pointer = free.minute;
                if (dayidx >= days.length) {
                    break;
                }
                if (pointer >= dayEnd) {
                    dayidx += 1;
                    pointer = dayStart;
                    continue;
                }
                const day = days[dayidx];
                const breaks = breaksByDay[day] || [];
                let stop = dayEnd;
                const nextBreak = breaks.find((br) => br.start > pointer);
                if (nextBreak) {
                    stop = Math.min(stop, nextBreak.start);
                }
                const chunk = Math.min(remaining, Math.max(0, stop - pointer));
                if (chunk <= 0) {
                    pointer = stop;
                    continue;
                }
                segments.push({day, startMin: pointer, endMin: pointer + chunk});
                remaining -= chunk;
                pointer += chunk;
                if (pointer >= dayEnd) {
                    dayidx += 1;
                    pointer = dayStart;
                }
            }

            const last = segments.length ? segments[segments.length - 1] : null;
            return {
                segments,
                endday: last ? last.day : startday,
                endmin: last ? last.endMin : startmin
            };
        }

        normalizeCognitiveLabel(value) {
            if (!value) {
                return '';
            }
            return String(value).split(/[:\-–]/)[0].trim().toLowerCase();
        }

        getMethodAlternativeIds(method) {
            const ids = [String(method.id || '')]
                .concat(Array.isArray(method.alternativen) ? method.alternativen.map((id) => String(id || '')) : []);
            const unique = [];
            ids.forEach((id) => {
                if (!id || unique.includes(id)) {
                    return;
                }
                if (this.methods.some((entry) => String(entry.id) === id)) {
                    unique.push(id);
                }
            });
            return unique;
        }

        toCard(method) {
            const duration = this.snapDuration(method.zeitbedarf);
            const title = String(method.titel || '').trim();
            const cognitive = Array.isArray(method.kognitive) ? method.kognitive : [method.kognitive || ''];
            const levels = cognitive
                .map((entry) => COGNITIVE_LEVELS[this.normalizeCognitiveLabel(entry)] || null)
                .filter((level) => level !== null);

            const details = {
                description: method.kurzbeschreibung || '',
                reflection: method.debrief || '',
                requirements: Array.isArray(method.raum) ? method.raum.join(', ') : (method.raum || ''),
                socialform: Array.isArray(method.sozialform) ? method.sozialform.join(', ') : (method.sozialform || ''),
                preparation: method.vorbereitung || '',
                materials: method.materialtechnik || '',
                flow: method.ablauf || '',
                risks: method.risiken || '',
                resources: Array.isArray(method.materialien) ? method.materialien.join(', ') : (method.materialien || ''),
                objectives: method.lernziele || '',
                contact: method.autor || ''
            };

            return {
                id: method.id || uid(),
                title,
                duration,
                description: method.kurzbeschreibung || '',
                tags: method.tags || '',
                group: method.gruppengroesse || '',
                phase: Array.isArray(method.seminarphase) ? method.seminarphase.join(', ') : (method.seminarphase || ''),
                cognitive: Array.isArray(method.kognitive) ? method.kognitive.join(', ') : (method.kognitive || ''),
                cardHtml: `<p><strong>${escapeHtml(title)}</strong></p>`,
                details,
                cognitiveLevel: levels.length ? Math.max(...levels) : null
            };
        }

        renderMethods() {
            const methodshost = bySel('#sp-methods');
            const unitshost = bySel('#sp-units');
            if (!methodshost && !unitshost) {
                return;
            }
            if (methodshost) {
                methodshost.innerHTML = '';
            }
            if (unitshost) {
                unitshost.innerHTML = '';
            }

            const cards = this.methods.map((method) => this.toCard(method));
            this.filterIndex = cards;
            this.populateTagsFilter();

            cards.forEach((cardData) => {
                if (!methodshost) {
                    return;
                }
                const card = document.createElement('div');
                card.className = 'sp-card';
                if (cardData.cognitiveLevel) {
                    card.classList.add(`sp-level-${cardData.cognitiveLevel}`);
                }
                card.draggable = true;
                card.dataset.cardId = cardData.id;

                card.innerHTML = `
                    <div class="sp-card-compact">
                        <div class="sp-card-title">
                            <span class="sp-title-text sp-card-title-main"><strong class="sp-titletext">${escapeHtml(cardData.title)}</strong></span>
                            <button type="button" class="sp-card-preview" data-action="preview-method" title="Methodenkarte anzeigen" aria-label="Methodenkarte anzeigen" draggable="false">🔍</button>
                        </div>
                        <div class="sp-card-meta">
                            <span class="sp-badge">${escapeHtml(String(cardData.duration))} Min</span>
                            <span class="sp-badge">${escapeHtml(cardData.group || '-')}</span>
                        </div>
                        <div class="sp-card-description">${sanitizeHtml(cardData.description)}</div>
                    </div>
                    <span class="sp-hidden" data-field="description">${escapeHtml(cardData.details.description)}</span>
                    <span class="sp-hidden" data-field="reflection">${escapeHtml(cardData.details.reflection)}</span>
                    <span class="sp-hidden" data-field="requirements">${escapeHtml(cardData.details.requirements)}</span>
                    <span class="sp-hidden" data-field="materials">${escapeHtml(cardData.details.materials)}</span>
                    <span class="sp-hidden" data-field="tags">${escapeHtml(cardData.tags)}</span>
                    <span class="sp-hidden" data-field="seminarphase">${escapeHtml(cardData.phase)}</span>
                    <span class="sp-hidden" data-field="zeitbedarf">${escapeHtml(String(cardData.duration))}</span>
                    <span class="sp-hidden" data-field="gruppengroesse">${escapeHtml(cardData.group)}</span>
                `;

                card.addEventListener('dragstart', (e) => {
                    const payload = {
                        type: 'method',
                        title: cardData.title,
                        duration: cardData.duration,
                        cardHtml: cardData.cardHtml,
                        entryId: String(cardData.id),
                        details: cardData.details,
                        phase: cardData.phase || '',
                        cognitive: cardData.cognitive || '',
                        cognitiveLevel: cardData.cognitiveLevel
                    };
                    e.dataTransfer.setData('text/plain', JSON.stringify(payload));
                });
                const previewBtn = card.querySelector('[data-action="preview-method"]');
                if (previewBtn) {
                    previewBtn.addEventListener('click', (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        this.openMethodDetailModal(cardData);
                    });
                }

                methodshost.appendChild(card);
            });

            const slots = this.getPlanningSlots();
            if (unitshost) {
                if (!slots.length) {
                    unitshost.innerHTML = '<p class="sp-filter-status">Keine Bausteine vorhanden. Im Baustein anlegen.</p>';
                } else {
                    slots.forEach((slot) => {
                        const unit = slot.active;
                        if (!unit) {
                            return;
                        }
                        const card = document.createElement('div');
                        card.className = 'sp-card';
                        card.draggable = true;
                        card.innerHTML = `
                            <div class="sp-card-compact">
                                <div class="sp-card-title">
                                    <span class="sp-title-text sp-card-title-main">
                                        <strong class="sp-titletext" data-full-title="${escapeHtml(unit.title)}">${escapeHtml(unit.title)}</strong>
                                    </span>
                                </div>
                                <div class="sp-card-meta">
                                    <span class="sp-badge">${escapeHtml(String(unit.duration))} Min</span>
                                    <span class="sp-badge">${escapeHtml(String((unit.methods || []).length))} Methoden</span>
                                    ${slot.units.length > 1 ? '<span class="sp-badge">Alternative</span>' : ''}
                                </div>
                                <div class="sp-card-description">${sanitizeHtml(unit.topics || '')}</div>
                            </div>
                        `;
                        card.addEventListener('dragstart', (event) => {
                            event.dataTransfer.setData('text/plain', JSON.stringify({
                                type: 'unit',
                                slotkey: slot.key,
                                unitid: unit.id,
                                duration: unit.duration,
                                title: unit.title
                            }));
                        });
                        unitshost.appendChild(card);
                    });
                }
            }

            if (this.state.sourceMode === 'units') {
                const statusUnits = bySel('#sp-filter-status');
                if (statusUnits) {
                    statusUnits.textContent = `${slots.length} Bausteine verfügbar.`;
                }
            } else {
                this.applyFilters();
            }
        }

        getSelectedFilterValues(key) {
            const cfg = FILTER_DROPDOWNS[key];
            if (!cfg) {
                return [];
            }
            const all = bySel(cfg.all);
            const optionsHost = bySel(cfg.options);
            if (!optionsHost) {
                return [];
            }
            if (all && all.checked) {
                return [];
            }
            return Array.from(optionsHost.querySelectorAll('input[type="checkbox"]:checked'))
                .map((el) => String(el.value || '').trim())
                .filter(Boolean);
        }

        updateFilterDropdownLabel(key) {
            const cfg = FILTER_DROPDOWNS[key];
            if (!cfg) {
                return;
            }
            const btn = bySel(cfg.toggle);
            if (!btn) {
                return;
            }
            const selected = this.getSelectedFilterValues(key);
            btn.textContent = selected.length ? `${cfg.labelSome} (${selected.length})` : cfg.labelAll;
        }

        clearFilterSelections(key) {
            const cfg = FILTER_DROPDOWNS[key];
            if (!cfg) {
                return;
            }
            const all = bySel(cfg.all);
            const optionsHost = bySel(cfg.options);
            if (all) {
                all.checked = true;
            }
            if (optionsHost) {
                optionsHost.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
                    cb.checked = false;
                });
            }
            this.updateFilterDropdownLabel(key);
        }

        bindFilterDropdown(key) {
            const cfg = FILTER_DROPDOWNS[key];
            if (!cfg) {
                return;
            }
            const root = bySel(cfg.root);
            const toggle = bySel(cfg.toggle);
            const panel = bySel(cfg.panel);
            const all = bySel(cfg.all);
            const optionsHost = bySel(cfg.options);

            if (toggle && panel) {
                toggle.addEventListener('click', () => panel.classList.toggle('kg-hidden'));
                document.addEventListener('click', (event) => {
                    if (!root) {
                        return;
                    }
                    if (!root.contains(event.target)) {
                        panel.classList.add('kg-hidden');
                    }
                });
            }
            if (all) {
                all.addEventListener('change', () => {
                    if (all.checked && optionsHost) {
                        optionsHost.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
                            cb.checked = false;
                        });
                    }
                    this.updateFilterDropdownLabel(key);
                    this.applyFilters();
                });
            }
            if (optionsHost) {
                optionsHost.addEventListener('change', (event) => {
                    const target = event.target;
                    if (!target || target.type !== 'checkbox') {
                        return;
                    }
                    if (all) {
                        all.checked = false;
                    }
                    this.updateFilterDropdownLabel(key);
                    this.applyFilters();
                });
            }
            this.updateFilterDropdownLabel(key);
        }

        populateTagsFilter() {
            const optionsHost = bySel('#sp-filter-tags-options');
            if (!optionsHost) {
                return;
            }
            const keep = this.getSelectedFilterValues('tags');
            const tags = new Set();
            this.filterIndex.forEach((card) => {
                String(card.tags || '').split(/[,;]+/).map((x) => x.trim()).filter(Boolean).forEach((x) => tags.add(x));
            });
            optionsHost.innerHTML = '';
            Array.from(tags).sort((a, b) => a.localeCompare(b, 'de')).forEach((tag) => {
                const row = document.createElement('label');
                row.className = 'kg-tag-option';
                row.innerHTML = `<input type="checkbox" value="${escapeHtml(tag)}" ${keep.includes(tag) ? 'checked' : ''}><span>${escapeHtml(tag)}</span>`;
                optionsHost.appendChild(row);
            });
            this.updateFilterDropdownLabel('tags');
        }

        buildTimeColumn() {
            const level = ZOOM_LEVELS[this.zoomIndex];
            const slotMinutes = level.slotMinutes;
            const start = parseTimeToMinutes(this.state.config.timeRange.start);
            const end = parseTimeToMinutes(this.state.config.timeRange.end);
            const labelEvery = level.labelEverySlots || 1;

            const times = bySel('#sp-times');
            if (!times) {
                return;
            }
            times.innerHTML = '';

            let i = 0;
            for (let t = start; t < end; t += slotMinutes) {
                const d = document.createElement('div');
                d.className = `sp-timeslot ${i % labelEvery === 0 ? 'sp-timeslot--major' : 'sp-timeslot--minor'}`;
                d.textContent = i % labelEvery === 0 ? label(t) : '';
                times.appendChild(d);
                i++;
            }
        }

        generateDynamicColumns() {
            const header = bySel('#sp-header');
            const row = bySel('#sp-grid-row');
            if (!header || !row) {
                return;
            }

            header.querySelectorAll('.sp-colhead').forEach((el) => el.remove());
            row.querySelectorAll('.sp-daycol').forEach((el) => el.remove());

            this.state.config.days.forEach((day) => {
                const h = document.createElement('div');
                h.className = 'sp-colhead';
                h.innerHTML = `${escapeHtml(day)} <div class="sp-sum" data-sum="${escapeHtml(day)}">0 Min</div>`;
                header.appendChild(h);

                const dayCol = document.createElement('div');
                dayCol.className = 'sp-daycol';
                dayCol.innerHTML = `<div class="sp-grid" data-day="${escapeHtml(day)}"></div><div class="sp-overlay" data-overlay="${escapeHtml(day)}"></div>`;
                row.appendChild(dayCol);
            });

            const count = this.state.config.days.length;
            header.style.gridTemplateColumns = `120px repeat(${count}, minmax(180px, 1fr))`;
            row.style.gridTemplateColumns = `120px repeat(${count}, minmax(180px, 1fr))`;
        }

        setupDayGrids() {
            const level = ZOOM_LEVELS[this.zoomIndex];
            const slotMinutes = level.slotMinutes;
            const start = parseTimeToMinutes(this.state.config.timeRange.start);
            const end = parseTimeToMinutes(this.state.config.timeRange.end);
            const slotsPerDay = Math.max(1, Math.round((end - start) / slotMinutes));
            const labelEvery = level.labelEverySlots || 1;

            this.generateDynamicColumns();

            document.querySelectorAll('.sp-daycol').forEach((dayCol) => {
                dayCol.style.setProperty('--rows', slotsPerDay);
                dayCol.style.setProperty('--slot-height', `${level.slotPx}px`);

                const grid = dayCol.querySelector('.sp-grid');
                if (grid) {
                    grid.innerHTML = '';
                    for (let i = 0; i < slotsPerDay; i++) {
                        const cell = document.createElement('div');
                        cell.className = `sp-timeslot ${i % labelEvery === 0 ? 'sp-timeslot--major' : 'sp-timeslot--minor'}`;
                        cell.addEventListener('dragover', (e) => e.preventDefault());
                        cell.addEventListener('drop', (e) => this.onDrop(e, grid, i));
                        grid.appendChild(cell);
                    }
                }

                const overlay = dayCol.querySelector('.sp-overlay');
                if (overlay) {
                    overlay.style.setProperty('--rows', slotsPerDay);
                    overlay.style.setProperty('--slot-height', `${level.slotPx}px`);
                }
            });
        }

        renderOverlays() {
            const start = parseTimeToMinutes(this.state.config.timeRange.start);
            const end = parseTimeToMinutes(this.state.config.timeRange.end);
            const slotMinutes = ZOOM_LEVELS[this.zoomIndex].slotMinutes;
            const slotsPerDay = Math.max(1, Math.round((end - start) / slotMinutes));

            this.state.config.days.forEach((day) => {
                const overlay = document.querySelector(`[data-overlay="${day}"]`);
                if (!overlay) {
                    return;
                }
                overlay.innerHTML = '';

                const items = (this.state.plan.days[day] || []).slice().sort((a, b) => a.startMin - b.startMin);
                items.forEach((it) => {
                    let startIdx = Math.floor((it.startMin - start) / slotMinutes) + 1;
                    let endIdx = Math.ceil((it.endMin - start) / slotMinutes) + 1;
                    startIdx = Math.max(1, startIdx);
                    endIdx = Math.min(slotsPerDay + 1, Math.max(startIdx + 1, endIdx));

                    const div = document.createElement('div');
                    let className = 'sp-item';
                    if (it.kind === 'break') {
                        className += ' sp-item--break';
                    }
                    if (it.kind === 'unit') {
                        className += ' sp-entry--unit';
                    }
                    if (it.kind === 'method' && it.parentunit) {
                        className += ' sp-entry--unit-method';
                    }
                    if (it.cognitiveLevel) {
                        className += ` sp-level-${it.cognitiveLevel}`;
                    }
                    div.className = className;
                    div.style.gridRow = `${startIdx} / ${endIdx}`;
                    div.style.gridColumn = '1 / -1';
                    div.draggable = true;

                    div.addEventListener('dragstart', (e) => {
                        e.dataTransfer.setData('text/plain', JSON.stringify({type: 'move', day, uid: it.uid}));
                    });

                    let title = it.title || '';
                    if (it.flowTotal > 1 && it.flowOrder > 1) {
                        title = `${title} (Fortsetzung ${it.flowOrder}/${it.flowTotal})`;
                    }

                    let extraActions = '';
                    if (it.kind === 'unit') {
                        const slot = this.getPlanningSlot(it.slotkey);
                        const alternatives = slot && Array.isArray(slot.units) ? slot.units : [];
                        const selector = alternatives.length > 1
                            ? `<select class="kg-input" data-act="unit-alt" data-uid="${escapeHtml(it.uid)}">${alternatives.map((unit) => `<option value="${escapeHtml(unit.id)}" ${String(unit.id) === String(it.unitid) ? 'selected' : ''}>${escapeHtml(unit.title)}</option>`).join('')}</select>`
                            : '';
                        extraActions = `${selector}<button type="button" class="sp-btn" data-act="resolve-unit" data-uid="${escapeHtml(it.uid)}">Auflösen</button>`;
                    } else if (it.kind === 'method') {
                        const method = this.methods.find((m) => String(m.id) === String(it.entryId));
                        const alternatives = method ? this.getMethodAlternativeIds(method) : [];
                        if (alternatives.length > 1) {
                            extraActions = `<select class="kg-input" data-act="method-alt" data-uid="${escapeHtml(it.uid)}">${alternatives.map((id) => {
                                const alt = this.methods.find((m) => String(m.id) === String(id));
                                return alt ? `<option value="${escapeHtml(id)}" ${String(id) === String(it.entryId) ? 'selected' : ''}>${escapeHtml(alt.titel || id)}</option>` : '';
                            }).join('')}</select>`;
                        }
                    }

                    let defaultActions = '';
                    if (it.kind !== 'unit' && it.kind !== 'break') {
                        defaultActions += `<button type="button" class="sp-btn" data-act="shorten" data-uid="${escapeHtml(it.uid)}">-15</button>`;
                        defaultActions += `<button type="button" class="sp-btn" data-act="extend" data-uid="${escapeHtml(it.uid)}">+15</button>`;
                    }
                    defaultActions += `<button type="button" class="sp-btn" data-act="delete" data-uid="${escapeHtml(it.uid)}">Löschen</button>`;

                    div.innerHTML = `
                        <div class="sp-item-content">
                            <div class="sp-title">${escapeHtml(title)}</div>
                            <div class="sp-meta">${escapeHtml(label(it.startMin))} - ${escapeHtml(label(it.endMin))}</div>
                        </div>
                        <div class="sp-item-actions" role="group" aria-label="Aktionen">
                            ${extraActions}
                            ${defaultActions}
                        </div>
                    `;
                    overlay.appendChild(div);
                });
            });

            bySel('#sp-grid-row')?.querySelectorAll('[data-act="method-alt"]').forEach((select) => {
                select.addEventListener('change', () => {
                    const found = this.findItemByUid(select.getAttribute('data-uid'));
                    if (!found.item) {
                        return;
                    }
                    const flowid = found.item.flowid ? String(found.item.flowid) : '';
                    this.state.config.days.forEach((day) => {
                        this.state.plan.days[day] = (this.state.plan.days[day] || []).map((entry) => {
                            const same = flowid
                                ? String(entry.flowid || '') === flowid
                                : String(entry.uid) === String(found.item.uid);
                            if (!same) {
                                return entry;
                            }
                            const method = this.methods.find((m) => String(m.id) === String(select.value));
                            if (!method) {
                                return entry;
                            }
                            const card = this.toCard(method);
                            return Object.assign({}, entry, {
                                entryId: String(method.id),
                                title: card.title,
                                details: card.details,
                                phase: card.phase,
                                cognitive: card.cognitive,
                                cognitiveLevel: card.cognitiveLevel
                            });
                        });
                    });
                    this.savePlan();
                });
            });

            bySel('#sp-grid-row')?.querySelectorAll('[data-act="unit-alt"]').forEach((select) => {
                select.addEventListener('change', () => {
                    const found = this.findItemByUid(select.getAttribute('data-uid'));
                    if (!found.item) {
                        return;
                    }
                    const unit = this.getUnitById(select.value);
                    if (!unit) {
                        return;
                    }
                    if (found.item.flowid) {
                        const segments = this.flowEntries(found.item.flowid);
                        if (!segments.length) {
                            return;
                        }
                        const anchor = segments[0];
                        this.removeFlow(found.item.flowid);
                        const moved = this.addSegmentedItems('unit', {
                            title: unit.title,
                            duration: unit.duration,
                            unitid: unit.id,
                            slotkey: found.item.slotkey
                        }, anchor.day, anchor.startMin, {flowid: found.item.flowid});
                        if (!moved) {
                            segments.forEach((entry) => {
                                if (!this.state.plan.days[entry.day]) {
                                    this.state.plan.days[entry.day] = [];
                                }
                                this.state.plan.days[entry.day].push(entry);
                            });
                            return;
                        }
                    } else {
                        this.state.plan.days[found.day] = (this.state.plan.days[found.day] || []).map((entry) => {
                            if (String(entry.uid) !== String(found.item.uid)) {
                                return entry;
                            }
                            return Object.assign({}, entry, {
                                unitid: String(unit.id),
                                title: unit.title
                            });
                        });
                    }
                    this.savePlan();
                });
            });

            this.updateSums();
        }

        updateSums() {
            this.state.config.days.forEach((day) => {
                const sum = (this.state.plan.days[day] || []).reduce((acc, item) => acc + (item.endMin - item.startMin), 0);
                const el = document.querySelector(`[data-sum="${day}"]`);
                if (el) {
                    el.textContent = `${Math.floor(sum / 60)} Std ${sum % 60} Min`;
                }
            });
        }

        refreshLayout() {
            this.wrapper.style.setProperty('--slot-height', `${ZOOM_LEVELS[this.zoomIndex].slotPx}px`);
            this.buildTimeColumn();
            this.setupDayGrids();
            this.renderOverlays();
            this.updateZoomControls();
        }

        updateZoomControls() {
            const zoomIn = bySel('#sp-zoom-in');
            const zoomOut = bySel('#sp-zoom-out');
            const indicator = bySel('#sp-zoom-indicator');
            if (zoomIn) {
                zoomIn.disabled = this.zoomIndex === ZOOM_LEVELS.length - 1;
            }
            if (zoomOut) {
                zoomOut.disabled = this.zoomIndex === 0;
            }
            if (indicator) {
                indicator.textContent = ZOOM_LEVELS[this.zoomIndex].label;
            }
        }

        addSegmentedItems(kind, payload, day, startMin, options = {}) {
            const duration = this.snapDuration(payload.duration || this.state.config.granularity);
            const allocation = this.allocateAcrossPlan(day, startMin, duration);
            if (!allocation.segments.length) {
                this.warn('Kein freier Zeitraum im Raster verfügbar.');
                return null;
            }

            const skipflow = String(options.skipflowid || '');
            const collisions = allocation.segments.some((segment) => {
                const list = (this.state.plan.days[segment.day] || []).filter((entry) => {
                    if (!skipflow) {
                        return true;
                    }
                    return String(entry.flowid || '') !== skipflow;
                });
                return this.hasCollision(list, segment);
            });
            if (collisions) {
                this.warn('Zeitüberschneidung im Zielbereich.');
                return null;
            }

            const flowid = options.flowid || uid();
            const total = allocation.segments.length;
            const created = allocation.segments.map((segment, index) => {
                const base = {
                    uid: uid(),
                    flowid,
                    flowOrder: index + 1,
                    flowTotal: total,
                    title: payload.title || (kind === 'unit' ? 'Baustein' : 'Methode'),
                    day: segment.day,
                    startMin: segment.startMin,
                    endMin: segment.endMin,
                    kind
                };
                if (kind === 'unit') {
                    base.unitid = String(payload.unitid || '');
                    base.slotkey = String(payload.slotkey || '');
                } else {
                    base.cardHtml = payload.cardHtml || '';
                    base.entryId = payload.entryId || null;
                    base.details = payload.details || {};
                    base.phase = payload.phase || '';
                    base.cognitive = payload.cognitive || '';
                    base.cognitiveLevel = payload.cognitiveLevel || null;
                    if (payload.parentunit) {
                        base.parentunit = String(payload.parentunit);
                    }
                }
                return Object.assign(base, options.extra || {});
            });

            created.forEach((entry) => {
                if (!this.state.plan.days[entry.day]) {
                    this.state.plan.days[entry.day] = [];
                }
                this.state.plan.days[entry.day].push(entry);
            });
            return {
                entries: created,
                endday: allocation.endday,
                endmin: allocation.endmin
            };
        }

        handleAddMethod(payload, day, startMin) {
            const result = this.addSegmentedItems('method', payload, day, startMin);
            if (!result) {
                return;
            }
            this.clearWarn();
            this.savePlan();
        }

        handleAddUnit(payload, day, startMin) {
            const unit = this.getUnitById(payload.unitid);
            if (!unit) {
                this.warn('Baustein nicht gefunden.');
                return;
            }
            const result = this.addSegmentedItems('unit', {
                title: unit.title || payload.title || 'Baustein',
                duration: Number(unit.duration || payload.duration || 90),
                unitid: unit.id,
                slotkey: payload.slotkey
            }, day, startMin);
            if (!result) {
                return;
            }
            this.clearWarn();
            this.savePlan();
        }

        findItemByUid(itemuid) {
            let foundday = '';
            let founditem = null;
            this.state.config.days.some((day) => {
                const item = (this.state.plan.days[day] || []).find((entry) => String(entry.uid) === String(itemuid));
                if (item) {
                    foundday = day;
                    founditem = item;
                    return true;
                }
                return false;
            });
            return {day: foundday, item: founditem};
        }

        flowEntries(flowid) {
            const list = [];
            this.state.config.days.forEach((day) => {
                (this.state.plan.days[day] || []).forEach((entry) => {
                    if (String(entry.flowid || '') === String(flowid)) {
                        list.push(Object.assign({day}, entry));
                    }
                });
            });
            return list.sort((a, b) => {
                if (a.flowOrder && b.flowOrder) {
                    return a.flowOrder - b.flowOrder;
                }
                if (a.day === b.day) {
                    return a.startMin - b.startMin;
                }
                return this.state.config.days.indexOf(a.day) - this.state.config.days.indexOf(b.day);
            });
        }

        removeFlow(flowid) {
            this.state.config.days.forEach((day) => {
                this.state.plan.days[day] = (this.state.plan.days[day] || []).filter((entry) => String(entry.flowid || '') !== String(flowid));
            });
        }

        handleMoveItem(payload, day, startMin) {
            const items = this.state.plan.days[payload.day] || [];
            const moving = items.find((x) => x.uid === payload.uid);
            if (!moving) {
                return;
            }
            if (moving.flowid) {
                const flows = this.flowEntries(moving.flowid);
                const totalduration = flows.reduce((sum, entry) => sum + (entry.endMin - entry.startMin), 0);
                const first = flows[0];
                const meta = first.kind === 'unit' ? {
                    title: first.title,
                    duration: totalduration,
                    unitid: first.unitid,
                    slotkey: first.slotkey
                } : {
                    title: first.title,
                    duration: totalduration,
                    cardHtml: first.cardHtml,
                    entryId: first.entryId,
                    details: first.details,
                    phase: first.phase,
                    cognitive: first.cognitive,
                    cognitiveLevel: first.cognitiveLevel,
                    parentunit: first.parentunit
                };
                this.removeFlow(moving.flowid);
                const moved = this.addSegmentedItems(first.kind, meta, day, startMin, {flowid: moving.flowid});
                if (!moved) {
                    flows.forEach((entry) => {
                        const restoredday = entry.day;
                        if (!this.state.plan.days[restoredday]) {
                            this.state.plan.days[restoredday] = [];
                        }
                        this.state.plan.days[restoredday].push(entry);
                    });
                    return;
                }
                this.clearWarn();
                this.savePlan();
                return;
            }
            const duration = moving.endMin - moving.startMin;
            const candidate = Object.assign({}, moving, {startMin, endMin: startMin + duration});
            if (!this.withinBounds(candidate.startMin, candidate.endMin)) {
                this.warn('Außerhalb des Rasters.');
                return;
            }
            const targetList = day === payload.day ? items.filter((x) => x.uid !== payload.uid) : this.state.plan.days[day];
            if (this.hasCollision(targetList, candidate)) {
                this.warn('Zeitüberschneidung im Zieltag.');
                return;
            }

            this.state.plan.days[payload.day] = items.filter((x) => x.uid !== payload.uid);
            this.state.plan.days[day].push(candidate);
            this.clearWarn();
            this.savePlan();
        }

        onDrop(event, grid, slotIndex) {
            event.preventDefault();
            const day = grid.getAttribute('data-day');
            if (!day) {
                return;
            }
            if (!this.state.plan.days[day]) {
                this.state.plan.days[day] = [];
            }

            let payload = {};
            try {
                payload = JSON.parse(event.dataTransfer.getData('text/plain') || '{}');
            } catch (e) {
                payload = {};
            }

            const startMin = this.indexToMinutes(slotIndex);
            if (payload.type === 'move') {
                this.handleMoveItem(payload, day, startMin);
            }
            if (payload.type === 'method') {
                this.handleAddMethod(payload, day, startMin);
            }
            if (payload.type === 'unit') {
                this.handleAddUnit(payload, day, startMin);
            }
        }

        handleItemAction(event) {
            const btn = event.target.closest('button.sp-btn');
            if (!btn) {
                return;
            }
            const act = btn.getAttribute('data-act');
            if (!act) {
                return;
            }
            const itemuid = btn.getAttribute('data-uid');
            if (!itemuid) {
                return;
            }

            const day = this.state.config.days.find((d) => (this.state.plan.days[d] || []).some((entry) => entry.uid === itemuid));
            if (!day) {
                return;
            }
            const list = this.state.plan.days[day] || [];
            const idx = list.findIndex((entry) => entry.uid === itemuid);
            if (idx < 0) {
                return;
            }

            const item = list[idx];
            const delta = 15;

            if (act === 'resolve-unit') {
                this.resolveUnitItem(itemuid);
                return;
            }

            if (act === 'delete') {
                if (item.flowid) {
                    this.removeFlow(item.flowid);
                } else {
                    list.splice(idx, 1);
                }
                this.savePlan();
                return;
            }
            if (act === 'extend' || act === 'shorten') {
                if (item.flowid && Number(item.flowTotal || 1) > 1) {
                    this.warn('Fortsetzungen können nicht segmentweise verlängert werden.');
                    return;
                }
                const diff = act === 'extend' ? delta : -delta;
                const nextDuration = (item.endMin - item.startMin) + diff;
                if (nextDuration < delta) {
                    this.warn(`Mindestdauer ${delta} Minuten.`);
                    return;
                }
                const candidate = Object.assign({}, item, {endMin: item.startMin + nextDuration});
                if (!this.withinBounds(candidate.startMin, candidate.endMin)) {
                    this.warn('Grenze des Tagesrasters erreicht.');
                    return;
                }
                if (this.hasCollision(list.filter((entry) => entry.uid !== item.uid), candidate)) {
                    this.warn('Überschneidung bei Anpassung.');
                    return;
                }
                list[idx] = candidate;
                this.savePlan();
            }
        }

        resolveUnitItem(itemuid) {
            const found = this.findItemByUid(itemuid);
            const item = found.item;
            if (!item || item.kind !== 'unit') {
                return;
            }
            const unit = this.getUnitById(item.unitid);
            if (!unit) {
                this.warn('Baustein ist nicht mehr verfügbar.');
                return;
            }
            const segments = item.flowid ? this.flowEntries(item.flowid) : [Object.assign({day: found.day}, item)];
            if (!segments.length) {
                return;
            }
            const first = segments[0];
            const startday = first.day;
            const startmin = first.startMin;
            const flowid = item.flowid || uid();

            if (item.flowid) {
                this.removeFlow(item.flowid);
            } else if (found.day) {
                this.state.plan.days[found.day] = (this.state.plan.days[found.day] || []).filter((entry) => String(entry.uid) !== String(item.uid));
            }

            let pointerday = startday;
            let pointermin = startmin;
            const parentunit = String(unit.id);
            for (const methodentry of (unit.methods || [])) {
                const method = this.methods.find((entry) => String(entry.id) === String(methodentry.methodid));
                if (!method) {
                    continue;
                }
                const card = this.toCard(method);
                const added = this.addSegmentedItems('method', {
                    title: card.title,
                    duration: card.duration,
                    cardHtml: card.cardHtml,
                    entryId: card.id,
                    details: card.details,
                    phase: card.phase,
                    cognitive: card.cognitive,
                    cognitiveLevel: card.cognitiveLevel,
                    parentunit
                }, pointerday, pointermin);
                if (!added) {
                    this.warn('Einheit teilweise aufgelöst: nicht alle Methoden konnten eingeplant werden.');
                    break;
                }
                pointerday = added.endday;
                pointermin = added.endmin;
            }

            this.clearWarn();
            this.savePlan();
        }

        clearPlan() {
            this.state.plan = {days: {}};
            this.ensurePlanDays();
            this.savePlan();
        }

        deleteSelectedGrid() {
            const select = bySel('#kg-grid-select');
            const gridid = this.getGridId();
            if (!gridid) {
                this.setStatus('Bitte zuerst einen Seminarplan auswählen.', true);
                return;
            }
            const selectedName = select && select.selectedOptions && select.selectedOptions[0]
                ? select.selectedOptions[0].textContent
                : `#${gridid}`;
            if (!window.confirm(`Soll der Seminarplan "${selectedName}" wirklich gelöscht werden?`)) {
                return;
            }
            this.closeConfigPanel();
            asCall('mod_konzeptgenerator_delete_grid', {
                cmid: this.cmid,
                gridid
            }).then(() => {
                const previous = String(gridid);
                return this.listGrids().then(() => {
                    const updatedSelect = bySel('#kg-grid-select');
                    const hasCurrent = updatedSelect && Array.from(updatedSelect.options).some((o) => o.value === previous);
                    if (!hasCurrent) {
                        this.resetLoadedGridState();
                        this.toggleStepTwo(false);
                    }
                    this.setStatus('Seminarplan gelöscht.', false);
                });
            }).catch((error) => {
                Notification.exception(error);
                this.setStatus('Seminarplan löschen fehlgeschlagen.', true);
            });
        }

        // Compatibility no-ops for stale cached AMD bundles that may still call these methods.
        saveMetaFromInputs() {}
        applyMetaToInputs() {}
        bindMetaInputs() {}

        createBreakModal() {
            const modal = document.createElement('div');
            modal.className = 'sp-modal';
            modal.setAttribute('aria-hidden', 'true');
            modal.innerHTML = `
                <div class="sp-modal__backdrop" data-modal-close="break"></div>
                <div class="sp-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="sp-break-modal-title">
                    <header class="sp-modal__header">
                        <h2 id="sp-break-modal-title">Pause hinzufügen</h2>
                        <button type="button" class="sp-modal__close" data-modal-close="break" aria-label="Modal schließen">X</button>
                    </header>
                    <form class="sp-modal__body" id="sp-break-form">
                        <label class="sp-modal__field"><span class="sp-modal__label">Tag</span><select id="sp-break-day" class="kg-input kg-grid-select">${DAYS_ALL.map((day) => `<option value="${escapeHtml(day)}">${escapeHtml(day)}</option>`).join('')}</select></label>
                        <label class="sp-modal__field"><span class="sp-modal__label">Start</span><input id="sp-break-start" class="kg-input" type="time" required></label>
                        <label class="sp-modal__field"><span class="sp-modal__label">Dauer (Min)</span><input id="sp-break-duration" class="kg-input" type="number" min="5" step="5" value="15" required></label>
                        <div class="sp-modal__actions">
                            <button type="button" class="kg-btn" data-modal-close="break">Abbrechen</button>
                            <button type="submit" class="kg-btn kg-btn-primary">Übernehmen</button>
                        </div>
                    </form>
                </div>
            `;
            this.wrapper.appendChild(modal);
            this.breakModal = modal;

            modal.addEventListener('click', (event) => {
                if (event.target.getAttribute('data-modal-close') === 'break') {
                    this.closeBreakModal();
                }
            });

            const form = modal.querySelector('#sp-break-form');
            if (form) {
                form.addEventListener('submit', (event) => {
                    event.preventDefault();
                    const day = modal.querySelector('#sp-break-day').value;
                    const startMin = parseTimeToMinutes(modal.querySelector('#sp-break-start').value);
                    const duration = this.snapDuration(modal.querySelector('#sp-break-duration').value);
                    if (!this.state.plan.days[day]) {
                        this.state.plan.days[day] = [];
                    }
                    const item = {
                        uid: uid(),
                        title: 'Pause',
                        startMin,
                        endMin: startMin + duration,
                        kind: 'break',
                        details: {}
                    };
                    if (!this.withinBounds(item.startMin, item.endMin)) {
                        this.warn('Pause liegt außerhalb des Zeitrasters.');
                        return;
                    }
                    if (this.hasCollision(this.state.plan.days[day], item)) {
                        this.warn('Pause überschneidet sich mit einer Methode.');
                        return;
                    }
                    this.state.plan.days[day].push(item);
                    this.closeBreakModal();
                    this.savePlan();
                });
            }
        }

        buildMethodDetailBody(cardData) {
            const meta = [
                {label: 'Dauer', value: `${cardData.duration} Min`},
                {label: 'Gruppengröße', value: cardData.group},
                {label: 'Seminarphase', value: cardData.phase},
                {label: 'Kognitive Dimension', value: cardData.cognitive},
                {label: 'Tags', value: cardData.tags},
                {label: 'Autor:in', value: cardData.details.contact}
            ].filter((entry) => String(entry.value || '').trim() !== '');

            const sections = [
                {title: 'Kurzbeschreibung', value: cardData.details.description},
                {title: 'Ablauf', value: cardData.details.flow},
                {title: 'Lernziele', value: cardData.details.objectives},
                {title: 'Raum', value: cardData.details.requirements},
                {title: 'Sozialform', value: cardData.details.socialform},
                {title: 'Vorbereitung', value: cardData.details.preparation},
                {title: 'Material/Technik', value: cardData.details.materials},
                {title: 'Zusätzliche Materialien', value: cardData.details.resources},
                {title: 'Risiken/Tipps', value: cardData.details.risks},
                {title: 'Debrief/Reflexion', value: cardData.details.reflection}
            ].filter((entry) => String(entry.value || '').trim() !== '');

            const metaHtml = meta.length ? `
                <div class="sp-method-detail__meta">
                    ${meta.map((entry) => `<span class="sp-method-detail__meta-item"><strong>${escapeHtml(entry.label)}:</strong> ${escapeHtml(entry.value)}</span>`).join('')}
                </div>
            ` : '';

            const sectionsHtml = sections.length ? sections.map((entry) => `
                <section class="sp-method-detail__section">
                    <h3>${escapeHtml(entry.title)}</h3>
                    <div class="sp-method-detail__text">${sanitizeHtml(entry.value)}</div>
                </section>
            `).join('') : '<p class="sp-method-detail__empty">Keine zusätzlichen Details vorhanden.</p>';

            return `${metaHtml}${sectionsHtml}`;
        }

        createMethodDetailModal() {
            const modal = document.createElement('div');
            modal.className = 'sp-modal';
            modal.setAttribute('aria-hidden', 'true');
            modal.innerHTML = `
                <div class="sp-modal__backdrop" data-modal-close="method-detail"></div>
                <div class="sp-modal__dialog sp-modal__dialog--large" role="dialog" aria-modal="true" aria-labelledby="sp-method-detail-title">
                    <header class="sp-modal__header">
                        <h2 id="sp-method-detail-title">Methodenkarte</h2>
                        <button type="button" class="sp-modal__close" data-modal-close="method-detail" aria-label="Popup schließen">X</button>
                    </header>
                    <div class="sp-modal__body sp-method-detail__body" id="sp-method-detail-body"></div>
                </div>
            `;
            this.wrapper.appendChild(modal);
            this.methodDetailModal = modal;

            modal.addEventListener('click', (event) => {
                if (event.target.getAttribute('data-modal-close') === 'method-detail') {
                    this.closeMethodDetailModal();
                }
            });
        }

        openMethodDetailModal(cardData) {
            if (!this.methodDetailModal) {
                return;
            }
            const title = this.methodDetailModal.querySelector('#sp-method-detail-title');
            const body = this.methodDetailModal.querySelector('#sp-method-detail-body');
            if (title) {
                title.textContent = cardData.title || 'Methodenkarte';
            }
            if (body) {
                body.innerHTML = this.buildMethodDetailBody(cardData);
            }
            this.methodDetailModal.classList.add('sp-modal--visible');
            this.methodDetailModal.removeAttribute('aria-hidden');
        }

        closeMethodDetailModal() {
            if (!this.methodDetailModal) {
                return;
            }
            this.methodDetailModal.classList.remove('sp-modal--visible');
            this.methodDetailModal.setAttribute('aria-hidden', 'true');
        }

        openBreakModal() {
            if (!this.breakModal) {
                return;
            }
            const start = parseTimeToMinutes(this.state.config.timeRange.start);
            const end = parseTimeToMinutes(this.state.config.timeRange.end);
            this.breakModal.querySelector('#sp-break-day').value = this.state.config.days[0] || DAYS_ALL[0];
            this.breakModal.querySelector('#sp-break-start').value = label(Math.min(end - this.state.config.granularity, start + 240));
            this.breakModal.classList.add('sp-modal--visible');
            this.breakModal.removeAttribute('aria-hidden');
        }

        closeBreakModal() {
            if (!this.breakModal) {
                return;
            }
            this.breakModal.classList.remove('sp-modal--visible');
            this.breakModal.setAttribute('aria-hidden', 'true');
        }

        bindToolbar() {
            const zoomin = bySel('#sp-zoom-in');
            if (zoomin) {
                zoomin.addEventListener('click', () => {
                    this.zoomIndex = Math.min(ZOOM_LEVELS.length - 1, this.zoomIndex + 1);
                    this.refreshLayout();
                    this.scheduleAutosave();
                });
            }
            const zoomout = bySel('#sp-zoom-out');
            if (zoomout) {
                zoomout.addEventListener('click', () => {
                    this.zoomIndex = Math.max(0, this.zoomIndex - 1);
                    this.refreshLayout();
                    this.scheduleAutosave();
                });
            }
            const clearbtn = bySel('#sp-clear');
            if (clearbtn) {
                clearbtn.addEventListener('click', () => this.deleteSelectedGrid());
            }
            const addbreakbtn = bySel('#sp-addbreak');
            if (addbreakbtn) {
                addbreakbtn.addEventListener('click', () => this.openBreakModal());
            }
            document.addEventListener('click', (event) => this.handleItemAction(event));
        }

        bindFilters() {
            const input = bySel('#sp-filter-search');
            const reset = bySel('#sp-filter-reset');
            if (input) {
                input.addEventListener('input', () => this.applyFilters());
            }
            Object.keys(FILTER_DROPDOWNS).forEach((key) => this.bindFilterDropdown(key));
            if (reset) {
                reset.addEventListener('click', () => {
                    if (input) {
                        input.value = '';
                    }
                    Object.keys(FILTER_DROPDOWNS).forEach((key) => this.clearFilterSelections(key));
                    this.applyFilters();
                });
            }
        }

        bindSourceControls() {
            const tabs = byAll('[data-tab-value]', bySel('#sp-source-tabs'));
            tabs.forEach((tab) => {
                const applytab = () => {
                    const target = bySel(String(tab.getAttribute('data-tab-value') || ''));
                    if (!target) {
                        return;
                    }
                    byAll('[data-tab-info]').forEach((panel) => panel.classList.remove('active'));
                    tabs.forEach((entry) => entry.classList.remove('is-active'));
                    target.classList.add('active');
                    tab.classList.add('is-active');
                    this.setSourceMode(String(tab.getAttribute('data-source') || 'methods'), true);
                };
                tab.addEventListener('click', applytab);
                tab.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        applytab();
                    }
                });
            });
            this.syncSourceTabs();
        }

        applyFilters() {
            if (this.state.sourceMode === 'units') {
                const status = bySel('#sp-filter-status');
                if (status) {
                    const slots = this.getPlanningSlots();
                    status.textContent = `${slots.length} Bausteine verfügbar.`;
                }
                return;
            }
            const search = getValue('#sp-filter-search').trim().toLowerCase();
            const tags = this.getSelectedFilterValues('tags').map((x) => x.toLowerCase());
            const phases = this.getSelectedFilterValues('phase').map((x) => x.toLowerCase());
            const groups = this.getSelectedFilterValues('group').map((x) => x.toLowerCase());
            const durations = this.getSelectedFilterValues('duration').map((x) => x.toLowerCase());
            const cognitive = this.getSelectedFilterValues('cognitive').map((x) => this.normalizeCognitiveLabel(x));
            const sidebarCards = Array.from(document.querySelectorAll('#sp-methods .sp-card'));
            let visible = 0;
            this.filterIndex.forEach((card) => {
                const el = sidebarCards.find((node) => node.dataset.cardId === String(card.id));
                if (!el) {
                    return;
                }
                const hay = [card.title, card.description, card.tags, card.phase, card.group].join(' ').toLowerCase();
                const cardtags = String(card.tags || '').toLowerCase().split(/[,;]+/).map((x) => x.trim()).filter(Boolean);
                const cardphase = String(card.phase || '').toLowerCase().split(/[,;]+/).map((x) => x.trim()).filter(Boolean);
                const cardduration = String(card.duration || '').toLowerCase();
                const cardcognitive = this.normalizeCognitiveLabel((Array.isArray(card.cognitive) ? card.cognitive.join(', ') : (card.cognitive || '')));
                const match = (!search || hay.includes(search))
                    && (!tags.length || cardtags.some((t) => tags.includes(t)))
                    && (!phases.length || cardphase.some((p) => phases.includes(p)))
                    && (!groups.length || groups.includes(String(card.group || '').toLowerCase()))
                    && (!durations.length || durations.includes(cardduration))
                    && (!cognitive.length || cognitive.includes(cardcognitive));
                el.style.display = match ? '' : 'none';
                if (match) {
                    visible++;
                }
            });
            const status = bySel('#sp-filter-status');
            if (status) {
                status.textContent = this.filterIndex.length ? `${visible} von ${this.filterIndex.length} Methoden angezeigt.` : 'Keine Methoden geladen.';
            }
        }

        bindConfigModal() {
            const panel = bySel('#sp-config-inline');
            const form = bySel('#sp-config-form');
            const preset = bySel('#sp-config-preset');
            const addbreak = bySel('#sp-add-break');
            const closepanelbtn = bySel('#sp-config-collapse');

            if (closepanelbtn) {
                closepanelbtn.addEventListener('click', () => this.closeConfigPanel());
            }

            if (preset) {
                preset.addEventListener('change', () => this.applyPreset(preset.value));
            }
            if (addbreak) {
                addbreak.addEventListener('click', () => this.addBreakItem());
            }
            if (form) {
                form.addEventListener('submit', (event) => {
                    event.preventDefault();
                    const days = Array.from(form.querySelectorAll('input[name="days"]:checked')).map((el) => el.value);
                    if (!days.length) {
                        this.warn('Bitte mindestens einen Tag auswählen.');
                        return;
                    }
                    const start = form.querySelector('#sp-config-time-start').value || '08:30';
                    const end = form.querySelector('#sp-config-time-end').value || '17:30';
                    if ((parseTimeToMinutes(end) || 0) <= (parseTimeToMinutes(start) || 0)) {
                        this.warn('Endzeit muss nach Startzeit liegen.');
                        return;
                    }
                    const pendingconfig = {
                        preset: getValue('#sp-config-preset') || 'custom',
                        days,
                        timeRange: {start, end},
                        granularity: this.state.config.granularity || 15,
                        breaks: this.collectBreaks(),
                        tableColumns: Object.assign({}, DEFAULT_COLUMNS, this.state.config.tableColumns || {})
                    };
                    const pendingname = getValue('#kg-grid-name').trim();
                    const selectedgrid = this.getGridId();

                    const applyAndSaveCurrentGrid = () => {
                        this.state.config = pendingconfig;
                        this.ensurePlanDays();
                        this.applyConfiguredBreaksToPlan();
                        if (panel) {
                            panel.classList.add('kg-hidden');
                        }
                        this.savePlan();
                        this.setStatus('Seminarplan-Einstellungen übernommen.', false);
                    };

                    if (pendingname) {
                        asCall('mod_konzeptgenerator_create_grid', {cmid: this.cmid, name: pendingname, description: ''})
                            .then((created) => {
                                const createdid = String(created.gridid || '');
                                return this.listGrids(createdid).then(() => createdid);
                            })
                            .then((createdid) => {
                                const select = bySel('#kg-grid-select');
                                if (select && createdid) {
                                    select.value = createdid;
                                }
                                this.toggleStepTwo(true);
                                return this.loadGridState();
                            })
                            .then(() => {
                                this.state.config = pendingconfig;
                                this.ensurePlanDays();
                                this.applyConfiguredBreaksToPlan();
                                return this.saveGridState({silent: true});
                            })
                            .then(() => {
                                const nameinput = bySel('#kg-grid-name');
                                if (nameinput) {
                                    nameinput.value = '';
                                }
                                this.closeConfigPanel();
                                this.refreshLayout();
                                this.setStatus('Neuer Seminarplan mit Einstellungen erstellt und geladen.', false);
                            })
                            .catch((error) => {
                                Notification.exception(error);
                                this.setStatus('Seminarplan erstellen fehlgeschlagen.', true);
                            });
                        return;
                    }

                    if (!selectedgrid) {
                        this.setStatus('Bitte Seminarplan-Namen eingeben oder einen bestehenden Seminarplan laden.', true);
                        return;
                    }

                    applyAndSaveCurrentGrid();
                });
            }
        }

        applyConfigToModal() {
            const form = bySel('#sp-config-form');
            if (!form) {
                return;
            }
            const preset = bySel('#sp-config-preset');
            if (preset) {
                preset.value = this.state.config.preset || 'custom';
            }
            form.querySelectorAll('input[name="days"]').forEach((cb) => {
                cb.checked = this.state.config.days.includes(cb.value);
            });
            form.querySelector('#sp-config-time-start').value = this.state.config.timeRange.start;
            form.querySelector('#sp-config-time-end').value = this.state.config.timeRange.end;
            this.loadBreaksIntoModal(this.state.config.breaks || []);
        }

        applyPreset(key) {
            const preset = GRID_PRESETS[key];
            if (!preset) {
                return;
            }
            this.state.config = Object.assign({}, this.state.config, {
                preset: key,
                days: preset.days.slice(),
                timeRange: Object.assign({}, preset.timeRange),
                granularity: preset.granularity,
                breaks: (preset.breaks || []).map((br) => Object.assign({}, br))
            });
            this.applyConfigToModal();
        }

        addBreakItem(breakConfig) {
            const list = bySel('#sp-breaks-list');
            if (!list) {
                return;
            }
            const config = breakConfig || {days: ['all'], start: '12:00', duration: 60};
            const row = document.createElement('div');
            row.className = 'sp-break-item';
            row.innerHTML = `
                <select class="kg-input kg-grid-select sp-break-days-select">
                    <option value="all" ${config.days.includes('all') ? 'selected' : ''}>Alle Tage</option>
                    ${DAYS_ALL.map((d) => `<option value="${escapeHtml(d)}" ${(config.days || []).includes(d) ? 'selected' : ''}>${escapeHtml(d)}</option>`).join('')}
                </select>
                <input type="time" class="kg-input sp-break-start" value="${escapeHtml(config.start)}">
                <input type="number" class="kg-input sp-break-duration" value="${escapeHtml(String(config.duration))}" min="5" step="5">
                <button type="button" class="kg-btn sp-break-remove">X</button>
            `;
            list.appendChild(row);
            row.querySelector('.sp-break-remove').addEventListener('click', () => {
                row.remove();
            });
        }

        loadBreaksIntoModal(breaks) {
            const list = bySel('#sp-breaks-list');
            if (!list) {
                return;
            }
            list.innerHTML = '';
            (breaks || []).forEach((br) => this.addBreakItem(br));
        }

        collectBreaks() {
            const list = bySel('#sp-breaks-list');
            if (!list) {
                return [];
            }
            return Array.from(list.querySelectorAll('.sp-break-item')).map((row) => {
                const day = row.querySelector('.sp-break-days-select').value || 'all';
                const start = row.querySelector('.sp-break-start').value || '12:00';
                const duration = Number.parseInt(row.querySelector('.sp-break-duration').value || '60', 10) || 60;
                return {days: [day], start, duration};
            });
        }

        collectTableColumns() {
            return Object.assign({}, DEFAULT_COLUMNS, this.state.config.tableColumns || {});
        }

        updatePreview() {}

        applyConfiguredBreaksToPlan() {
            this.state.config.days.forEach((day) => {
                this.state.plan.days[day] = (this.state.plan.days[day] || []).filter((item) => item.kind !== 'break');
            });
            const breaks = this.state.config.breaks || [];
            breaks.forEach((br) => {
                const days = (br.days || []).includes('all') ? this.state.config.days : (br.days || []);
                days.forEach((day) => {
                    if (!this.state.plan.days[day]) {
                        this.state.plan.days[day] = [];
                    }
                    const startMin = parseTimeToMinutes(br.start);
                    const dur = this.snapDuration(br.duration);
                    const item = {
                        uid: uid(),
                        title: 'Pause',
                        startMin,
                        endMin: startMin + dur,
                        kind: 'break',
                        details: {}
                    };
                    if (this.withinBounds(item.startMin, item.endMin) && !this.hasCollision(this.state.plan.days[day], item)) {
                        this.state.plan.days[day].push(item);
                    }
                });
            });
        }

        bindTopbar() {
            const createbtn = bySel('#kg-create-grid');
            if (createbtn) {
                createbtn.addEventListener('click', () => {
                    const name = getValue('#kg-grid-name').trim();
                    if (!name) {
                        this.setStatus('Bitte Seminarplan-Namen eingeben.', true);
                        return;
                    }
                    this.openConfigModal();
                    this.setStatus('Einstellungen festlegen und mit "Übernehmen" neuen Seminarplan erstellen.', false);
                });
            }
            const nameinput = bySel('#kg-grid-name');
            if (nameinput) {
                nameinput.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                    }
                });
            }

            const selectgrid = bySel('#kg-grid-select');
            if (selectgrid) {
                selectgrid.addEventListener('change', () => {
                    this.closeConfigPanel();
                    const input = bySel('#kg-grid-name');
                    if (input) {
                        input.value = '';
                    }
                    this.toggleStepTwo(false);
                    this.setStatus('Seminarplan ausgewählt. Bitte "Seminarplan laden" klicken.', false);
                });
            }
            const loadbtn = bySel('#kg-load-grid');
            if (loadbtn) {
                loadbtn.addEventListener('click', () => {
                    const gridid = this.getGridId();
                    if (!gridid) {
                        this.setStatus('Bitte zuerst einen Seminarplan auswählen.', true);
                        return;
                    }
                    this.closeConfigPanel();
                    if (nameinput) {
                        nameinput.value = '';
                    }
                    this.toggleStepTwo(true);
                    this.loadGridState();
                });
            }
            const savebtn = bySel('#kg-save-grid');
            if (savebtn) {
                savebtn.addEventListener('click', () => this.saveGridState({silent: false, manual: true}));
            }
        }

        listGrids(preferred = '') {
            return asCall('mod_konzeptgenerator_list_grids', {cmid: this.cmid}).then((res) => {
                const select = bySel('#kg-grid-select');
                const prev = select ? select.value : '';
                if (!select) {
                    return;
                }
                select.innerHTML = '';
                (res.grids || []).forEach((grid) => {
                    const opt = document.createElement('option');
                    opt.value = String(grid.id);
                    opt.textContent = `${grid.name} (#${grid.id})`;
                    select.appendChild(opt);
                });
                if (preferred && Array.from(select.options).some((o) => o.value === preferred)) {
                    select.value = preferred;
                } else if (prev && Array.from(select.options).some((o) => o.value === prev)) {
                    select.value = prev;
                }
            });
        }

        loadMethodCards() {
            return asCall('mod_konzeptgenerator_get_method_cards', {cmid: this.cmid}).then((res) => {
                let decoded = [];
                try {
                    decoded = res.methodsjson ? JSON.parse(res.methodsjson) : [];
                } catch (e) {
                    decoded = [];
                }
                this.methods = Array.isArray(decoded) ? decoded : [];
            });
        }

        loadPlanningState() {
            return asCall('mod_konzeptgenerator_get_planning_state', {cmid: this.cmid}).then((res) => {
                let decoded = {};
                try {
                    decoded = res.statejson ? JSON.parse(res.statejson) : {};
                } catch (e) {
                    decoded = {};
                }
                this.planningState = this.normalizePlanningState(decoded);
            }).catch(() => {
                this.planningState = {units: [], slotorder: []};
            });
        }

        loadSources() {
            return Promise.all([this.loadMethodCards(), this.loadPlanningState()]).then(() => {
                this.renderMethods();
            });
        }

        normalizeLoadedState(raw) {
            const defaults = {
                meta: {title: '', date: '', number: '', contact: ''},
                config: {
                    preset: 'standard-week',
                    days: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'],
                    timeRange: {start: '08:30', end: '17:30'},
                    granularity: 15,
                    breaks: [{days: ['all'], start: '12:00', duration: 60}],
                    tableColumns: Object.assign({}, DEFAULT_COLUMNS)
                },
                plan: {days: {}},
                sourceMode: 'methods'
            };

            if (!raw || typeof raw !== 'object') {
                return defaults;
            }

            if (raw.entries && raw.config) {
                const migrated = {
                    meta: defaults.meta,
                    config: {
                        preset: 'custom',
                        days: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'],
                        timeRange: {start: raw.config.start || '08:30', end: raw.config.end || '17:30'},
                        granularity: Number.parseInt(raw.config.step || '15', 10) || 15,
                        breaks: [],
                        tableColumns: Object.assign({}, DEFAULT_COLUMNS)
                    },
                    plan: {days: {}},
                    sourceMode: raw.sourceMode === 'units' ? 'units' : 'methods'
                };
                migrated.config.days.forEach((day) => {
                    migrated.plan.days[day] = [];
                });
                (raw.entries || []).forEach((entry) => {
                    if (!migrated.plan.days[entry.day]) {
                        migrated.plan.days[entry.day] = [];
                    }
                    const start = parseTimeToMinutes(entry.start);
                    const dur = Number.parseInt(entry.duration || '15', 10) || 15;
                    migrated.plan.days[entry.day].push({
                        uid: entry.id || uid(),
                        title: entry.title || `Methode ${entry.methodid || ''}`,
                        startMin: start,
                        endMin: start + dur,
                        kind: 'method',
                        details: {},
                        entryId: entry.methodid || null
                    });
                });
                return migrated;
            }

            return {
                meta: Object.assign({}, defaults.meta, raw.meta || {}),
                config: Object.assign({}, defaults.config, raw.config || {}, {
                    tableColumns: Object.assign({}, DEFAULT_COLUMNS, (raw.config || {}).tableColumns || {})
                }),
                plan: raw.plan && raw.plan.days ? raw.plan : {days: {}},
                sourceMode: raw.sourceMode === 'units' ? 'units' : 'methods'
            };
        }

        loadGridState() {
            const gridid = this.getGridId();
            this.state.gridid = gridid;
            if (!gridid) {
                this.state = Object.assign({}, this.state, this.normalizeLoadedState({}));
                this.ensurePlanDays();
                this.syncSourceTabs();
                this.renderMethods();
                this.applyConfigToModal();
                this.refreshLayout();
                return Promise.resolve();
            }

            return asCall('mod_konzeptgenerator_get_user_state', {cmid: this.cmid, gridid}).then((res) => {
                let parsed = {};
                try {
                    parsed = res.statejson ? JSON.parse(res.statejson) : {};
                } catch (e) {
                    parsed = {};
                }
                const normalized = this.normalizeLoadedState(parsed);
                this.state = Object.assign({}, this.state, normalized, {gridid});
                this.versionhash = res.versionhash || '';
                this.ensurePlanDays();
                this.syncSourceTabs();
                this.applyConfigToModal();
                this.renderMethods();
                this.refreshLayout();
                this.setStatus('Seminarplan geladen.', false);
            }).catch((error) => {
                Notification.exception(error);
                this.setStatus('Seminarplan laden fehlgeschlagen.', true);
            });
        }

        saveGridState(options = {}) {
            const normalizedoptions = {
                silent: !!options.silent,
                autosave: !!options.autosave,
                manual: !!options.manual
            };
            if (this.saveInFlight) {
                const queued = this.pendingSaveOptions || {silent: true, autosave: false, manual: false};
                this.pendingSaveOptions = {
                    // If any queued save is explicit/manual, keep it visible.
                    silent: queued.silent && normalizedoptions.silent,
                    autosave: queued.autosave || normalizedoptions.autosave,
                    manual: queued.manual || normalizedoptions.manual
                };
                return this.saveInFlight;
            }

            const silent = !!options.silent;
            const autosave = !!options.autosave;
            const gridid = this.getGridId();
            if (!gridid) {
                if (!silent) {
                    this.setStatus('Bitte zuerst einen Seminarplan auswählen.', true);
                }
                return Promise.resolve();
            }

            this.state.gridid = gridid;
            const payload = {
                config: this.state.config,
                plan: this.state.plan,
                zoomIndex: this.zoomIndex,
                sourceMode: this.state.sourceMode || 'methods'
            };

            const request = asCall('mod_konzeptgenerator_save_user_state', {
                cmid: this.cmid,
                gridid,
                statejson: JSON.stringify(payload),
                expectedhash: this.versionhash || ''
            }).then((res) => {
                this.versionhash = res.versionhash || '';
                this.dirty = false;
                if (!silent) {
                    const timestr = new Date().toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'});
                    this.setStatus(`Seminarplan erfolgreich gespeichert (${timestr}).`, false);
                } else if (autosave) {
                    const timestr = new Date().toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'});
                    this.setStatus(`Automatisch gespeichert (${timestr}).`, false);
                }
            }).catch((error) => {
                Notification.exception(error);
                this.dirty = true;
                if (!silent) {
                    this.setStatus('Seminarplan speichern fehlgeschlagen (möglicher Konflikt).', true);
                } else if (autosave) {
                    this.setStatus('Automatische Speicherung fehlgeschlagen.', true);
                }
                throw error;
            });
            const requestwithcleanup = request.then((result) => {
                this.saveInFlight = null;
                if (this.pendingSaveOptions) {
                    const nextoptions = this.pendingSaveOptions;
                    this.pendingSaveOptions = null;
                    this.saveGridState(nextoptions);
                }
                return result;
            }, (error) => {
                this.saveInFlight = null;
                if (this.pendingSaveOptions) {
                    const nextoptions = this.pendingSaveOptions;
                    this.pendingSaveOptions = null;
                    this.saveGridState(nextoptions);
                }
                throw error;
            });
            this.saveInFlight = requestwithcleanup;
            return requestwithcleanup;
        }

        scheduleAutosave() {
            if (!this.state.gridid) {
                return;
            }
            this.dirty = true;
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => this.saveGridState({silent: true, autosave: true}), 700);
        }

        bindAutoSaveLifecycle() {
            clearInterval(this.autosaveTimer);
            this.autosaveTimer = setInterval(() => {
                if (this.state.gridid && this.dirty) {
                    this.saveGridState({silent: true, autosave: true});
                }
            }, 20000);
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden' && this.state.gridid && this.dirty) {
                    this.saveGridState({silent: true, autosave: true});
                }
            });
        }

        savePlan() {
            this.refreshLayout();
            this.scheduleAutosave();
        }

        initData() {
            Promise.all([this.listGrids(), this.loadSources()])
                .then(() => {
                    const hasselected = this.getGridId() > 0;
                    this.toggleStepTwo(false);
                    if (!hasselected) {
                        this.setStatus('Schritt 1: Bitte Seminarplan erstellen oder aus der Liste auswählen.', false);
                    }
                    window.setInterval(() => {
                        this.loadSources()
                            .then(() => this.refreshLayout())
                            .catch(() => {
                                // Keep current UI on silent refresh failures.
                            });
                    }, 30000);
                })
                .catch((error) => {
                    Notification.exception(error);
                    this.setStatus('Initialisierung fehlgeschlagen.', true);
                });
        }
    }

    return {
        init: function(cmid) {
            return new Seminarplaner(cmid);
        }
    };
});
