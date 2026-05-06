define(['core/ajax', 'core/notification'], function(Ajax, Notification) {
    const DAYS_ALL = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
    const VIEW_MODE_WEEK = 'week';
    const VIEW_MODE_DAY = 'day';
    const TIME_AXIS_WIDTH = 80;
    const ZOOM_LEVELS = [
        {id: 'fine', label: '5 Min', slotMinutes: 5, slotPx: 30, labelEverySlots: 3, showMinor: true},
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
    const lucideIconUrl = (name) => {
        const root = (typeof M !== 'undefined' && M && M.cfg && M.cfg.wwwroot) ? String(M.cfg.wwwroot).replace(/\/$/, '') : '';
        return `${root}/mod/seminarplaner/pix/lucide/${String(name || '').trim()}.svg`;
    };
    const lucideIcon = (name, cssclass = 'sp-menu-icon') => `<img class="${escapeHtml(cssclass)}" src="${escapeHtml(lucideIconUrl(name))}" alt="" aria-hidden="true">`;
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
    const decodeHtmlEntities = (value) => {
        const textarea = document.createElement('textarea');
        textarea.innerHTML = String(value || '');
        return String(textarea.value || '');
    };
    const formatRichText = (value) => {
        const raw = String(value || '').trim();
        if (!raw) {
            return '';
        }
        const decoded = decodeHtmlEntities(raw).trim();
        const hasRawHtmlTags = /<[a-z][\s\S]*>/i.test(raw);
        const hasDecodedHtmlTags = /<[a-z][\s\S]*>/i.test(decoded);
        if (hasRawHtmlTags) {
            return sanitizeHtml(raw);
        }
        if (hasDecodedHtmlTags) {
            return sanitizeHtml(decoded);
        }
        return escapeHtml(raw).replace(/\r?\n/g, '<br>');
    };
    const getTodayDayName = () => {
        const jsDay = new Date().getDay();
        const mondayBased = (jsDay + 6) % 7;
        return DAYS_ALL[mondayBased] || 'Montag';
    };
    const CONFLICT_MARKER = 'GRID_TIME_CONFLICT:';
    const UNIT_SLOT_COLORS = ['#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#6366f1'];

    class Seminarplaner {
        constructor(cmid) {
            this.cmid = cmid;
            this.wrapper = bySel('.sp-wrapper');
            this.msg = bySel('#sp-msg');
            this.status = bySel('#kg-status');
            this.savedState = bySel('#sp-saved-state');
            this.zoomIndex = 1;
            this.versionhash = '';
            this.methods = [];
            this.planningState = {units: [], slotorder: []};
            this.methodAlternativeSelection = {};
            this.filterIndex = [];
            this.debounceTimer = null;
            this.autosaveTimer = null;
            this.dirty = false;
            this.breakModal = null;
            this.breakEditRef = null;
            this.methodDetailModal = null;
            this.saveInFlight = null;
            this.pendingSaveOptions = null;
            this.resizeState = null;
            this.expandedUnitSlotKey = null;
            this.roterFadenState = {ispublished: false, gridid: 0};
            this.isUpdatingPublishControl = false;

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
                view: {mode: VIEW_MODE_WEEK, day: 'Montag'},
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

        setSavedState(text, isError = false) {
            if (!this.savedState) {
                return;
            }
            this.savedState.innerHTML = `<span class="kg-btn-content">${lucideIcon('clipboard-check', 'kg-lucide kg-lucide--sm')}<span>${escapeHtml(String(text || ''))}</span></span>`;
            this.savedState.classList.toggle('is-error', !!isError);
        }

        getLoadedGridStorageKey() {
            return `mod_seminarplaner_loaded_grid_${this.cmid}`;
        }

        readRememberedLoadedGridId() {
            try {
                const raw = sessionStorage.getItem(this.getLoadedGridStorageKey()) || '';
                const gridid = Number.parseInt(String(raw), 10);
                return Number.isFinite(gridid) && gridid > 0 ? String(gridid) : '';
            } catch (e) {
                return '';
            }
        }

        rememberLoadedGridId(gridid) {
            const normalized = Number.parseInt(String(gridid || ''), 10);
            if (!Number.isFinite(normalized) || normalized <= 0) {
                this.clearRememberedLoadedGridId();
                return;
            }
            try {
                sessionStorage.setItem(this.getLoadedGridStorageKey(), String(normalized));
            } catch (e) {
                // Ignore storage issues (private mode or blocked storage).
            }
        }

        clearRememberedLoadedGridId() {
            try {
                sessionStorage.removeItem(this.getLoadedGridStorageKey());
            } catch (e) {
                // Ignore storage issues (private mode or blocked storage).
            }
        }

        getPublishStatusNode() {
            return bySel('#kg-publish-roterfaden-status');
        }

        setPublishStatus(text, isError = false) {
            const node = this.getPublishStatusNode();
            if (!node) {
                return;
            }
            node.textContent = text || '';
            node.style.color = isError ? '#b91c1c' : '';
        }

        buildGridPayload() {
            return {
                config: this.state.config,
                view: this.state.view,
                plan: this.state.plan,
                zoomIndex: this.zoomIndex,
                sourceMode: this.state.sourceMode || 'methods'
            };
        }

        loadRoterFadenState() {
            return asCall('mod_seminarplaner_get_roterfaden_state', {cmid: this.cmid}).then((res) => {
                this.roterFadenState = {
                    ispublished: !!(res && res.ispublished),
                    gridid: Number((res && res.gridid) || 0) || 0
                };
                this.syncPublishControl();
            }).catch(() => {
                this.roterFadenState = {ispublished: false, gridid: 0};
                this.syncPublishControl();
            });
        }

        syncPublishControl() {
            const checkbox = bySel('#kg-publish-roterfaden');
            if (!checkbox) {
                return;
            }
            const currentgridid = this.getGridId();
            const currentpublished = this.roterFadenState.ispublished && Number(this.roterFadenState.gridid) === Number(currentgridid);
            this.isUpdatingPublishControl = true;
            checkbox.checked = !!currentpublished;
            checkbox.disabled = !currentgridid;
            this.isUpdatingPublishControl = false;
            if (!currentgridid) {
                this.setPublishStatus('');
            } else if (currentpublished) {
                this.setPublishStatus('Dieser Seminarplan ist als Roter Faden veröffentlicht.');
            } else if (this.roterFadenState.ispublished && this.roterFadenState.gridid > 0) {
                this.setPublishStatus(`Aktuell ist Seminarplan #${this.roterFadenState.gridid} veröffentlicht.`);
            } else {
                this.setPublishStatus('Aktuell ist kein Roter Faden veröffentlicht.');
            }
        }

        publishCurrentGrid(options = {}) {
            const silent = !!options.silent;
            const gridid = this.getGridId();
            if (!gridid) {
                return Promise.resolve(false);
            }
            return asCall('mod_seminarplaner_publish_roterfaden', {
                cmid: this.cmid,
                gridid: gridid,
                statejson: JSON.stringify(this.buildGridPayload())
            }).then((res) => {
                const success = !!(res && res.success);
                if (!success) {
                    throw new Error('Publish failed');
                }
                this.roterFadenState = {ispublished: true, gridid: Number(gridid)};
                this.syncPublishControl();
                if (!silent) {
                    this.setStatus('Roter Faden veröffentlicht.', false);
                }
                return true;
            });
        }

        unpublishRoterFaden(options = {}) {
            const silent = !!options.silent;
            return asCall('mod_seminarplaner_unpublish_roterfaden', {cmid: this.cmid}).then((res) => {
                const success = !!(res && res.success);
                if (!success) {
                    throw new Error('Unpublish failed');
                }
                this.roterFadenState = Object.assign({}, this.roterFadenState, {ispublished: false});
                this.syncPublishControl();
                if (!silent) {
                    this.setStatus('Roter Faden ist nicht sichtbar.', false);
                }
                return true;
            });
        }

        extractErrorMessage(error) {
            if (!error) {
                return '';
            }
            if (typeof error === 'string') {
                return error;
            }
            if (typeof error.message === 'string' && error.message) {
                return error.message;
            }
            if (typeof error.error === 'string' && error.error) {
                return error.error;
            }
            if (typeof error.debuginfo === 'string' && error.debuginfo) {
                return error.debuginfo;
            }
            return '';
        }

        parseConflictPayload(error) {
            const message = this.extractErrorMessage(error);
            const idx = message.indexOf(CONFLICT_MARKER);
            if (idx === -1) {
                return null;
            }
            const payloadraw = message.slice(idx + CONFLICT_MARKER.length).trim();
            if (!payloadraw) {
                return {days: [], count: 0};
            }
            try {
                const payload = JSON.parse(payloadraw);
                return {
                    days: Array.isArray(payload.days) ? payload.days : [],
                    count: Number(payload.count || 0) || 0
                };
            } catch (e) {
                return {days: [], count: 0};
            }
        }

        highlightConflictDays(days = []) {
            const uniquedays = Array.from(new Set((days || []).map((day) => String(day || '').trim()).filter(Boolean)));
            if (!uniquedays.length) {
                return;
            }
            uniquedays.forEach((day) => {
                const grid = Array.from(document.querySelectorAll('.sp-daycol .sp-grid')).find((entry) => entry.getAttribute('data-day') === day);
                const col = grid ? grid.closest('.sp-daycol') : null;
                if (!col) {
                    return;
                }
                col.classList.add('sp-conflict-highlight');
                window.setTimeout(() => col.classList.remove('sp-conflict-highlight'), 2600);
            });
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

        ensureViewState() {
            const mode = this.state && this.state.view ? String(this.state.view.mode || '') : '';
            const validMode = mode === VIEW_MODE_DAY ? VIEW_MODE_DAY : VIEW_MODE_WEEK;
            const availableDays = (this.state.config.days && this.state.config.days.length) ? this.state.config.days : DAYS_ALL;
            const day = this.state && this.state.view ? String(this.state.view.day || '') : '';
            const validDay = availableDays.includes(day) ? day : (availableDays[0] || 'Montag');
            this.state.view = Object.assign({}, this.state.view || {}, {
                mode: validMode,
                day: validDay
            });
        }

        getVisibleDays() {
            this.ensureViewState();
            return this.state.view.mode === VIEW_MODE_DAY ? [this.state.view.day] : this.state.config.days.slice();
        }

        updateViewLabel() {
            const labelNode = bySel('#sp-view-label');
            if (!labelNode) {
                return;
            }
            this.ensureViewState();
            if (this.state.view.mode === VIEW_MODE_DAY) {
                const start = String((this.state.config.timeRange || {}).start || '08:30');
                const end = String((this.state.config.timeRange || {}).end || '17:30');
                labelNode.textContent = `Tagesansicht - ${this.state.view.day} (${start} - ${end})`;
                return;
            }
            labelNode.textContent = 'Wochenansicht';
        }

        updateViewControls() {
            this.ensureViewState();
            const isDay = this.state.view.mode === VIEW_MODE_DAY;
            const weekBtn = bySel('#sp-view-week');
            const dayBtn = bySel('#sp-view-day');
            const daySwitch = bySel('.sp-day-switch');
            const daySelect = bySel('#sp-day-select');
            if (weekBtn) {
                weekBtn.classList.toggle('is-active', !isDay);
            }
            if (dayBtn) {
                dayBtn.classList.toggle('is-active', isDay);
            }
            if (daySwitch) {
                daySwitch.classList.toggle('is-hidden', !isDay);
            }
            if (daySelect) {
                daySelect.innerHTML = this.state.config.days
                    .map((day) => `<option value="${escapeHtml(day)}">${escapeHtml(day)}</option>`)
                    .join('');
                daySelect.value = this.state.view.day;
            }
            this.updateViewLabel();
        }

        setViewMode(mode) {
            this.state.view.mode = mode === VIEW_MODE_DAY ? VIEW_MODE_DAY : VIEW_MODE_WEEK;
            if (this.state.view.mode === VIEW_MODE_DAY && !this.state.config.days.includes(this.state.view.day)) {
                const today = getTodayDayName();
                this.state.view.day = this.state.config.days.includes(today) ? today : (this.state.config.days[0] || 'Montag');
            }
            this.ensureViewState();
            this.refreshLayout();
            this.scheduleAutosave();
        }

        setViewDay(dayName) {
            const selected = String(dayName || '').trim();
            if (!this.state.config.days.includes(selected)) {
                return;
            }
            this.state.view.day = selected;
            this.ensureViewState();
            this.refreshLayout();
            this.scheduleAutosave();
        }

        shiftViewDay(offset) {
            this.ensureViewState();
            const idx = this.state.config.days.indexOf(this.state.view.day);
            if (idx < 0) {
                return;
            }
            const delta = Number(offset || 0);
            const nextIdx = (idx + delta + this.state.config.days.length) % this.state.config.days.length;
            this.setViewDay(this.state.config.days[nextIdx]);
        }

        getPointerClientY(event) {
            if (!event) {
                return 0;
            }
            if (typeof event.clientY === 'number') {
                return event.clientY;
            }
            if (event.touches && event.touches[0] && typeof event.touches[0].clientY === 'number') {
                return event.touches[0].clientY;
            }
            if (event.changedTouches && event.changedTouches[0] && typeof event.changedTouches[0].clientY === 'number') {
                return event.changedTouches[0].clientY;
            }
            return 0;
        }

        startItemResize(event, item, day, edge) {
            if (!item || (item.kind !== 'method' && item.kind !== 'unit' && item.kind !== 'break')) {
                return;
            }
            if (item.flowid && Number(item.flowTotal || 1) > 1) {
                event.preventDefault();
                event.stopPropagation();
                const flowid = String(item.flowid || '');
                const entries = this.flowEntries(flowid);
                const first = entries[0] || null;
                const last = entries.length ? entries[entries.length - 1] : null;
                const isFirst = first && String(first.uid) === String(item.uid);
                const isLast = last && String(last.uid) === String(item.uid);
                if ((edge === 'start' && !isFirst) || (edge !== 'start' && !isLast)) {
                    this.warn('Geteilte Elemente bitte am ersten Abschnitt oben oder am letzten Abschnitt unten anpassen.');
                    return;
                }
                const itemElement = event.currentTarget && typeof event.currentTarget.closest === 'function'
                    ? event.currentTarget.closest('.sp-item')
                    : null;
                if (itemElement) {
                    itemElement.dataset.wasDraggable = itemElement.draggable ? '1' : '0';
                    itemElement.draggable = false;
                }
                this.resizeState = {
                    day,
                    uid: String(item.uid),
                    flowid,
                    groupEntries: entries,
                    edge: edge === 'start' ? 'start' : 'end',
                    originY: Number(this.getPointerClientY(event) || 0),
                    startMin: Number(first.startMin || 0),
                    endMin: Number(last.endMin || 0),
                    totalDuration: entries.reduce((sum, entry) => sum + this.getEntryDuration(entry), 0),
                    firstDay: first.day,
                    firstStartMin: Number(first.startMin || 0),
                    lastDay: last.day,
                    lastEndMin: Number(last.endMin || 0),
                    itemElement,
                    snapshot: this.clonePlanDays()
                };
                document.body.classList.add('sp-resizing');
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            const itemElement = event.currentTarget && typeof event.currentTarget.closest === 'function'
                ? event.currentTarget.closest('.sp-item')
                : null;
            if (itemElement) {
                itemElement.dataset.wasDraggable = itemElement.draggable ? '1' : '0';
                itemElement.draggable = false;
            }
            this.resizeState = {
                day,
                uid: String(item.uid),
                edge: edge === 'start' ? 'start' : 'end',
                originY: Number(this.getPointerClientY(event) || 0),
                startMin: Number(item.startMin || 0),
                endMin: Number(item.endMin || 0),
                itemElement
            };
            document.body.classList.add('sp-resizing');
        }

        updateItemResize(event) {
            if (!this.resizeState) {
                return;
            }
            if (this.resizeState.flowid) {
                const level = ZOOM_LEVELS[this.zoomIndex];
                const dy = Number(this.getPointerClientY(event) || 0) - this.resizeState.originY;
                const stepPx = Number(level.slotPx || 1);
                const stepMin = Number(level.slotMinutes || 15);
                const movedSteps = Math.round(dy / stepPx);
                const movedMin = movedSteps * stepMin;
                const minDuration = Number(this.state.config.granularity || 15);
                let rangeStartDay = this.resizeState.firstDay;
                let rangeStartMin = this.resizeState.firstStartMin;
                let rangeEndDay = this.resizeState.lastDay;
                let rangeEndMin = this.resizeState.lastEndMin;
                if (this.resizeState.edge === 'start') {
                    rangeStartDay = this.resizeState.day;
                    rangeStartMin = Number(this.resizeState.startMin || 0) + movedMin;
                } else {
                    rangeEndDay = this.resizeState.day;
                    rangeEndMin = Number(this.resizeState.endMin || 0) + movedMin;
                }

                const originalEntries = (Array.isArray(this.resizeState.groupEntries) && this.resizeState.groupEntries.length)
                    ? this.resizeState.groupEntries
                    : this.flowEntriesFromSnapshot(this.resizeState.snapshot, this.resizeState.flowid);
                this.restorePlanDays(this.resizeState.snapshot);
                this.removeFlow(this.resizeState.flowid);
                const group = {
                    entries: originalEntries
                };
                const meta = this.entryPayloadFromGroup(group);
                const segments = this.allocateBetweenPoints(rangeStartDay, rangeStartMin, rangeEndDay, rangeEndMin);
                const duration = segments.reduce((sum, segment) => sum + (segment.endMin - segment.startMin), 0);
                if (duration < minDuration) {
                    this.restorePlanDays(this.resizeState.snapshot);
                    return;
                }
                meta.payload.duration = duration;
                const added = this.addItemsFromSegments(meta.kind, meta.payload, segments, {
                    flowid: this.resizeState.flowid,
                    preferredUids: originalEntries.map((entry) => String(entry.uid || '')).filter(Boolean)
                });
                if (!added) {
                    this.restorePlanDays(this.resizeState.snapshot);
                    return;
                }
                this.renderOverlays();
                return;
            }
            const list = this.state.plan.days[this.resizeState.day] || [];
            const idx = list.findIndex((entry) => String(entry.uid) === this.resizeState.uid);
            if (idx < 0) {
                return;
            }
            const current = list[idx];
            const level = ZOOM_LEVELS[this.zoomIndex];
            const dy = Number(this.getPointerClientY(event) || 0) - this.resizeState.originY;
            const stepPx = Number(level.slotPx || 1);
            const stepMin = Number(level.slotMinutes || 15);
            const movedSteps = Math.round(dy / stepPx);
            const movedMin = movedSteps * stepMin;

            const minDuration = current.kind === 'break' ? 5 : Number(this.state.config.granularity || 15);
            let nextStart = this.resizeState.startMin;
            let nextEnd = this.resizeState.endMin;
            if (this.resizeState.edge === 'start') {
                nextStart = this.resizeState.startMin + movedMin;
                if (nextEnd - nextStart < minDuration) {
                    nextStart = nextEnd - minDuration;
                }
            } else {
                nextEnd = this.resizeState.endMin + movedMin;
                if (nextEnd - nextStart < minDuration) {
                    nextEnd = nextStart + minDuration;
                }
            }

            const candidate = Object.assign({}, current, {startMin: nextStart, endMin: nextEnd});
            if (!this.withinBounds(candidate.startMin, candidate.endMin)) {
                return;
            }
            if (this.hasCollision(list.filter((entry) => String(entry.uid) !== this.resizeState.uid), candidate)) {
                return;
            }
            list[idx] = candidate;
            this.renderOverlays();
        }

        finishItemResize() {
            if (!this.resizeState) {
                return;
            }
            if (this.resizeState.itemElement) {
                const restore = this.resizeState.itemElement.dataset.wasDraggable === '1';
                this.resizeState.itemElement.draggable = restore;
                delete this.resizeState.itemElement.dataset.wasDraggable;
            }
            this.resizeState = null;
            document.body.classList.remove('sp-resizing');
            this.savePlan();
        }

        closeContextMenus(exceptmenu = null) {
            byAll('details.ml-card-menu[open]').forEach((menu) => {
                if (exceptmenu && menu === exceptmenu) {
                    return;
                }
                menu.open = false;
            });
        }

        handleContextMenuToggle(event) {
            const menu = event.target.closest('details.ml-card-menu');
            if (!menu) {
                this.closeContextMenus();
                return;
            }
            this.closeContextMenus(menu);
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

        snapBreakDuration(raw) {
            const value = Number.parseInt(raw, 10);
            if (!Number.isFinite(value) || value <= 0) {
                return 5;
            }
            return Math.max(5, Math.ceil(value / 5) * 5);
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

        isMobileViewport() {
            return window.matchMedia('(max-width: 900px)').matches;
        }

        getUnitSlotColor(slotkey) {
            const key = String(slotkey || '');
            let hash = 0;
            for (let i = 0; i < key.length; i++) {
                hash = ((hash << 5) - hash) + key.charCodeAt(i);
                hash |= 0;
            }
            const idx = Math.abs(hash) % UNIT_SLOT_COLORS.length;
            return UNIT_SLOT_COLORS[idx];
        }

        ensureUnitAccordionState(slots) {
            if (!this.isMobileViewport()) {
                return;
            }
            const keys = (slots || []).map((slot) => String(slot.key || '')).filter(Boolean);
            if (!keys.length) {
                this.expandedUnitSlotKey = null;
                return;
            }
            if (!this.expandedUnitSlotKey || !keys.includes(this.expandedUnitSlotKey)) {
                this.expandedUnitSlotKey = keys[0];
            }
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

        dropEventToStartMinute(event, day, fallbackIndex = 0) {
            const start = parseTimeToMinutes(this.state.config.timeRange.start);
            const end = parseTimeToMinutes(this.state.config.timeRange.end);
            const level = ZOOM_LEVELS[this.zoomIndex];
            const slotMinutes = Number(level.slotMinutes || 15);
            const slotPx = Number(level.slotPx || 1);
            const target = document.querySelector(`[data-overlay="${day}"]`) || document.querySelector(`.sp-grid[data-day="${day}"]`);
            if (!target || typeof event.clientY !== 'number') {
                return this.indexToMinutes(fallbackIndex);
            }
            const rect = target.getBoundingClientRect();
            const rawIndex = Math.round((event.clientY - rect.top) / slotPx);
            const maxIndex = Math.max(0, Math.floor((end - start) / slotMinutes) - 1);
            const index = Math.max(0, Math.min(maxIndex, rawIndex));
            return this.indexToMinutes(index);
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

        comparePlanPoints(dayA, minA, dayB, minB) {
            const aidx = this.state.config.days.indexOf(dayA);
            const bidx = this.state.config.days.indexOf(dayB);
            if (aidx !== bidx) {
                return aidx - bidx;
            }
            return Number(minA || 0) - Number(minB || 0);
        }

        comparePlanEntries(a, b) {
            const aday = this.state.config.days.indexOf(a.day);
            const bday = this.state.config.days.indexOf(b.day);
            if (aday !== bday) {
                return aday - bday;
            }
            return Number(a.startMin || 0) - Number(b.startMin || 0);
        }

        clonePlanDays() {
            return JSON.parse(JSON.stringify(this.state.plan.days || {}));
        }

        restorePlanDays(snapshot) {
            this.state.plan.days = JSON.parse(JSON.stringify(snapshot || {}));
            this.ensurePlanDays();
        }

        getEntryFlowKey(entry) {
            const flowid = String(entry && entry.flowid ? entry.flowid : '').trim();
            return flowid ? `flow:${flowid}` : `entry:${String(entry && entry.uid ? entry.uid : uid())}`;
        }

        getEntryDuration(entry) {
            return Math.max(0, Number(entry.endMin || 0) - Number(entry.startMin || 0));
        }

        entryPayloadFromGroup(group) {
            const entries = (group && Array.isArray(group.entries) ? group.entries : []).slice().sort((a, b) => this.comparePlanEntries(a, b));
            const first = entries[0] || {};
            const duration = entries.reduce((sum, entry) => sum + this.getEntryDuration(entry), 0);
            if (first.kind === 'unit') {
                return {
                    kind: 'unit',
                    flowid: String(first.flowid || '').trim() || uid(),
                    payload: {
                        title: first.title,
                        duration,
                        unitid: first.unitid,
                        slotkey: first.slotkey
                    },
                    first
                };
            }
            return {
                kind: 'method',
                flowid: String(first.flowid || '').trim() || uid(),
                payload: {
                    title: first.title,
                    duration,
                    cardHtml: first.cardHtml,
                    entryId: first.entryId,
                    details: first.details,
                    phase: first.phase,
                    cognitive: first.cognitive,
                    cognitiveLevel: first.cognitiveLevel,
                    parentunit: first.parentunit
                },
                first
            };
        }

        collectReflowGroups(startDay, startMin, options = {}) {
            const includeTouching = !!options.includeTouching;
            const groups = new Map();
            const qualifies = (entry, day) => {
                if (!entry || entry.kind === 'break') {
                    return false;
                }
                const dayIndex = this.state.config.days.indexOf(day);
                const startIndex = this.state.config.days.indexOf(startDay);
                if (dayIndex < startIndex) {
                    return false;
                }
                if (dayIndex > startIndex) {
                    return true;
                }
                const endMin = Number(entry.endMin || 0);
                return includeTouching ? endMin >= startMin : endMin > startMin;
            };

            this.state.config.days.forEach((day) => {
                (this.state.plan.days[day] || []).forEach((entry) => {
                    if (!qualifies(entry, day)) {
                        return;
                    }
                    const key = this.getEntryFlowKey(entry);
                    if (!groups.has(key)) {
                        groups.set(key, {key, entries: []});
                    }
                });
            });

            if (!groups.size) {
                return [];
            }

            this.state.config.days.forEach((day) => {
                const kept = [];
                (this.state.plan.days[day] || []).forEach((entry) => {
                    const key = this.getEntryFlowKey(entry);
                    if (groups.has(key)) {
                        groups.get(key).entries.push(Object.assign({day}, entry));
                        return;
                    }
                    kept.push(entry);
                });
                this.state.plan.days[day] = kept;
            });

            return Array.from(groups.values())
                .map((group) => Object.assign({}, group, {
                    entries: group.entries.slice().sort((a, b) => this.comparePlanEntries(a, b))
                }))
                .filter((group) => group.entries.length)
                .sort((a, b) => this.comparePlanEntries(a.entries[0], b.entries[0]));
        }

        reflowGroups(groups) {
            for (const group of (groups || [])) {
                const meta = this.entryPayloadFromGroup(group);
                if (!meta.first || !this.getEntryDuration(meta.first)) {
                    continue;
                }
                const added = this.addSegmentedItems(meta.kind, meta.payload, meta.first.day, meta.first.startMin, {flowid: meta.flowid});
                if (!added) {
                    return false;
                }
            }
            return true;
        }

        hasBreakCollision(candidate, ignoreUid = '') {
            return this.state.config.days.some((day) => {
                if (String(day) !== String(candidate.day)) {
                    return false;
                }
                return (this.state.plan.days[day] || []).some((entry) => {
                    return entry.kind === 'break'
                        && String(entry.uid || '') !== String(ignoreUid || '')
                        && this.overlaps(entry, candidate);
                });
            });
        }

        placeBreakAndReflow(candidate, options = {}) {
            const item = Object.assign({
                uid: uid(),
                title: 'Pause',
                kind: 'break',
                details: {}
            }, candidate || {});
            const day = String(item.day || '');
            const ignoreUid = String(options.ignoreUid || item.uid || '');
            if (!day || !this.state.config.days.includes(day)) {
                this.warn('Ungültiger Zieltag für die Pause.');
                return false;
            }
            if (!this.withinBounds(item.startMin, item.endMin)) {
                this.warn('Pause liegt außerhalb des Zeitrasters.');
                return false;
            }
            if (this.hasBreakCollision(Object.assign({}, item, {day}), ignoreUid)) {
                this.warn('Pause überschneidet sich mit einer anderen Pause.');
                return false;
            }

            const snapshot = this.clonePlanDays();
            const groups = this.collectReflowGroups(day, Number(item.startMin || 0));
            if (!this.state.plan.days[day]) {
                this.state.plan.days[day] = [];
            }
            const clean = Object.assign({}, item);
            delete clean.day;
            this.state.plan.days[day].push(clean);
            if (!this.reflowGroups(groups)) {
                this.restorePlanDays(snapshot);
                return false;
            }
            this.clearWarn();
            return true;
        }

        reflowAfterBreakRemoval(day, startMin) {
            const snapshot = this.clonePlanDays();
            const groups = this.collectReflowGroups(day, startMin, {includeTouching: true});
            if (!this.reflowGroups(groups)) {
                this.restorePlanDays(snapshot);
                return false;
            }
            this.clearWarn();
            return true;
        }

        allocateBetweenPoints(startDay, startMin, endDay, endMin) {
            const dayStart = parseTimeToMinutes(this.state.config.timeRange.start);
            const dayEnd = parseTimeToMinutes(this.state.config.timeRange.end);
            let rangeStartDay = String(startDay || '');
            let rangeEndDay = String(endDay || '');
            let rangeStartMin = Number(startMin || 0);
            let rangeEndMin = Number(endMin || 0);
            if (!this.state.config.days.includes(rangeStartDay) || !this.state.config.days.includes(rangeEndDay)) {
                return [];
            }
            if (this.comparePlanPoints(rangeStartDay, rangeStartMin, rangeEndDay, rangeEndMin) > 0) {
                const swapDay = rangeStartDay;
                const swapMin = rangeStartMin;
                rangeStartDay = rangeEndDay;
                rangeStartMin = rangeEndMin;
                rangeEndDay = swapDay;
                rangeEndMin = swapMin;
            }

            const startIdx = this.state.config.days.indexOf(rangeStartDay);
            const endIdx = this.state.config.days.indexOf(rangeEndDay);
            const segments = [];
            for (let idx = startIdx; idx <= endIdx; idx++) {
                const day = this.state.config.days[idx];
                const from = idx === startIdx ? Math.max(dayStart, rangeStartMin) : dayStart;
                const to = idx === endIdx ? Math.min(dayEnd, rangeEndMin) : dayEnd;
                if (to <= from) {
                    continue;
                }
                let pointer = from;
                const blockers = (this.state.plan.days[day] || [])
                    .filter((entry) => entry && entry.endMin > from && entry.startMin < to)
                    .map((entry) => ({
                        start: Math.max(from, Number(entry.startMin || 0)),
                        end: Math.min(to, Number(entry.endMin || 0))
                    }))
                    .filter((entry) => entry.end > entry.start)
                    .sort((a, b) => a.start - b.start);

                blockers.forEach((blocker) => {
                    if (blocker.start > pointer) {
                        segments.push({day, startMin: pointer, endMin: blocker.start});
                    }
                    if (blocker.end > pointer) {
                        pointer = blocker.end;
                    }
                });
                if (pointer < to) {
                    segments.push({day, startMin: pointer, endMin: to});
                }
            }
            return segments;
        }

        getBlockedRangesByDay(skipflow = '') {
            const map = {};
            this.state.config.days.forEach((day) => {
                map[day] = (this.state.plan.days[day] || [])
                    .filter((entry) => {
                        if (!skipflow) {
                            return true;
                        }
                        return String(entry.flowid || '') !== skipflow;
                    })
                    .map((entry) => ({start: entry.startMin, end: entry.endMin}))
                    .sort((a, b) => a.start - b.start);
            });
            return map;
        }

        nextFreeMinute(dayidx, minute, blockedByDay, days) {
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
                const blocked = blockedByDay[days[idx]] || [];
                const blocking = blocked.find((range) => current >= range.start && current < range.end);
                if (!blocking) {
                    return {dayidx: idx, minute: current};
                }
                current = blocking.end;
            }
            return {dayidx: Math.max(0, days.length - 1), minute: dayEnd};
        }

        allocateAcrossPlan(startday, startmin, totalduration, options = {}) {
            const isDayMode = this.state && this.state.view && this.state.view.mode === VIEW_MODE_DAY;
            const days = isDayMode ? [String(startday || '')] : this.state.config.days.slice();
            if (!days.length) {
                return {segments: [], endday: startday, endmin: startmin};
            }
            const dayStart = parseTimeToMinutes(this.state.config.timeRange.start);
            const dayEnd = parseTimeToMinutes(this.state.config.timeRange.end);
            const blockedByDay = this.getBlockedRangesByDay(String(options.skipflowid || ''));
            let remaining = Math.max(0, Number(totalduration || 0));
            let dayidx = Math.max(0, days.indexOf(startday));
            let pointer = Number.isFinite(startmin) ? startmin : dayStart;
            const segments = [];

            const first = this.nextFreeMinute(dayidx, pointer, blockedByDay, days);
            dayidx = first.dayidx;
            pointer = first.minute;

            while (remaining > 0 && dayidx < days.length) {
                const free = this.nextFreeMinute(dayidx, pointer, blockedByDay, days);
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
                const blocked = blockedByDay[day] || [];
                let stop = dayEnd;
                const nextBlocked = blocked.find((range) => range.start > pointer);
                if (nextBlocked) {
                    stop = Math.min(stop, nextBlocked.start);
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

        getUnitMethodCards(unit) {
            if (!unit || !Array.isArray(unit.methods)) {
                return [];
            }
            const cards = [];
            unit.methods.forEach((methodentry) => {
                const method = this.methods.find((entry) => String(entry.id) === String(methodentry.methodid));
                if (method) {
                    cards.push(this.toCard(method));
                }
            });
            return cards;
        }

        getMethodAlternativeSlots() {
            const methodById = new Map(
                this.methods
                    .map((method) => [String(method.id || '').trim(), method])
                    .filter((entry) => !!entry[0])
            );
            const visited = new Set();
            const slots = [];

            this.methods.forEach((method) => {
                const startid = String(method.id || '').trim();
                if (!startid || visited.has(startid)) {
                    return;
                }
                const queue = [startid];
                const groupSet = new Set();
                while (queue.length) {
                    const currentid = String(queue.shift() || '').trim();
                    if (!currentid || groupSet.has(currentid) || !methodById.has(currentid)) {
                        continue;
                    }
                    groupSet.add(currentid);
                    const current = methodById.get(currentid);
                    this.getMethodAlternativeIds(current).forEach((altid) => {
                        const normalized = String(altid || '').trim();
                        if (normalized && !groupSet.has(normalized)) {
                            queue.push(normalized);
                        }
                    });
                }
                if (!groupSet.size) {
                    return;
                }
                groupSet.forEach((id) => visited.add(id));
                const groupMethods = this.methods.filter((entry) => groupSet.has(String(entry.id || '').trim()));
                if (!groupMethods.length) {
                    return;
                }
                const alternatives = groupMethods.map((entry) => this.toCard(entry));
                const slotkey = groupMethods.map((entry) => String(entry.id || '').trim()).join('|');
                const selected = String(this.methodAlternativeSelection[slotkey] || '').trim();
                const active = alternatives.find((entry) => String(entry.id) === selected) || alternatives[0];
                this.methodAlternativeSelection[slotkey] = String(active.id);
                slots.push({key: slotkey, alternatives, active});
            });

            return slots;
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

            const methodslots = this.getMethodAlternativeSlots();
            const cards = methodslots.map((slot) => slot.active).filter(Boolean);
            this.filterIndex = cards;
            this.populateTagsFilter();

            methodslots.forEach((slot) => {
                if (!methodshost) {
                    return;
                }
                const cardData = slot.active;
                if (!cardData) {
                    return;
                }
                const card = document.createElement('div');
                card.className = 'sp-card sp-card--with-menu';
                if (cardData.cognitiveLevel) {
                    card.classList.add(`sp-level-${cardData.cognitiveLevel}`);
                }
                card.draggable = true;
                card.dataset.cardId = cardData.id;
                const methodalternativeselector = slot.alternatives.length > 1
                    ? `<div class="sp-method-slot__alt"><label class="kg-label">Alternative</label><select class="kg-input" data-act="source-method-alt">${slot.alternatives.map((entry) => `<option value="${escapeHtml(String(entry.id))}" ${String(entry.id) === String(cardData.id) ? 'selected' : ''}>${escapeHtml(entry.title)} (${escapeHtml(String(entry.duration))} Min)</option>`).join('')}</select></div>`
                    : '';

                card.innerHTML = `
                    <div class="sp-card-compact">
                        <div class="sp-card-title">
                            <span class="sp-title-text sp-card-title-main"><strong class="sp-titletext">${escapeHtml(cardData.title)}</strong></span>
                            <details class="ml-card-menu">
                                <summary class="ml-card-menu-toggle" data-action="toggle-context-menu" title="Kontextmenü" aria-label="Kontextmenü" draggable="false">⋮</summary>
                                <div class="ml-card-menu-panel">
                                    <button type="button" class="ml-card-menu-btn" data-action="preview-method">Ansehen</button>
                                    <button type="button" class="ml-card-menu-btn" data-action="edit-method">Bearbeiten</button>
                                </div>
                            </details>
                        </div>
                        <div class="sp-card-meta">
                            <span class="sp-badge">${escapeHtml(String(cardData.duration))} Min</span>
                            <span class="sp-badge">${escapeHtml(cardData.group || '-')}</span>
                            ${slot.alternatives.length > 1 ? '<span class="sp-badge">Alternative</span>' : ''}
                        </div>
                        ${methodalternativeselector}
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
                const sourcemethodaltselector = card.querySelector('[data-act="source-method-alt"]');
                if (sourcemethodaltselector) {
                    sourcemethodaltselector.addEventListener('change', () => {
                        const selectedid = String(sourcemethodaltselector.value || '').trim();
                        this.methodAlternativeSelection[slot.key] = selectedid;
                        this.renderMethods();
                    });
                }

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
                const previewBtn = card.querySelector('.ml-card-menu-btn[data-action="preview-method"]');
                if (previewBtn) {
                    previewBtn.addEventListener('click', (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        this.closeContextMenus();
                        this.openMethodDetailModal(cardData);
                    });
                }
                const editBtn = card.querySelector('.ml-card-menu-btn[data-action="edit-method"]');
                if (editBtn) {
                    editBtn.addEventListener('click', (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        this.closeContextMenus();
                        this.openMethodLibraryEditor(cardData.id);
                    });
                }

                methodshost.appendChild(card);
            });

            const slots = this.getPlanningSlots();
            if (unitshost) {
                if (!slots.length) {
                    unitshost.innerHTML = '<p class="sp-filter-status">Keine Bausteine vorhanden. Im Baustein anlegen.</p>';
                } else {
                    this.ensureUnitAccordionState(slots);
                    const ismobile = this.isMobileViewport();
                    slots.forEach((slot) => {
                        const unit = slot.active;
                        if (!unit) {
                            return;
                        }
                        const methodcards = this.getUnitMethodCards(unit);
                        const slotcolor = this.getUnitSlotColor(slot.key);
                        const expanded = !ismobile || String(this.expandedUnitSlotKey || '') === String(slot.key);
                        const card = document.createElement('article');
                        card.className = 'sp-card sp-unit-slot';
                        card.style.setProperty('--sp-unit-color', slotcolor);
                        card.setAttribute('data-slot-key', String(slot.key));
                        card.draggable = true;
                        const alternativeselector = slot.units.length > 1
                            ? `<div class="sp-unit-slot__alt"><label class="kg-label">Alternative</label><select class="kg-input" data-act="source-unit-alt">${slot.units.map((entry) => `<option value="${escapeHtml(String(entry.id))}" ${String(entry.id) === String(unit.id) ? 'selected' : ''}>${escapeHtml(entry.title)} (${escapeHtml(String(entry.duration))} Min)</option>`).join('')}</select></div>`
                            : '';
                        card.innerHTML = `
                            <button type="button" class="sp-unit-slot__header" data-action="toggle-unit-slot" data-slot-key="${escapeHtml(String(slot.key))}" aria-expanded="${expanded ? 'true' : 'false'}">
                                <div class="sp-unit-slot__title">
                                    <strong class="sp-titletext" data-full-title="${escapeHtml(unit.title)}">${escapeHtml(unit.title)}</strong>
                                </div>
                                <div class="sp-unit-slot__meta">
                                    <span class="sp-badge">${escapeHtml(String(unit.duration))} Min</span>
                                    <span class="sp-badge">${escapeHtml(String((unit.methods || []).length))} Seminareinheiten</span>
                                    ${slot.units.length > 1 ? '<span class="sp-badge">Alternative</span>' : ''}
                                    <span class="sp-unit-slot__chevron" aria-hidden="true">${expanded ? '▾' : '▸'}</span>
                                </div>
                            </button>
                            <div class="sp-unit-slot__content ${expanded ? '' : 'kg-hidden'}" data-slot-content="${escapeHtml(String(slot.key))}">
                                ${alternativeselector}
                                <div class="sp-unit-methods">
                                    <div class="sp-unit-methods__label">Pool der Seminareinheiten dieses Bausteins</div>
                                    <div class="sp-unit-methods__list">${methodcards.length ? methodcards.map((methodcard) => `<button type="button" class="sp-unit-method-link" data-action="preview-unit-method" data-method-id="${escapeHtml(String(methodcard.id))}" draggable="false">${escapeHtml(methodcard.title)}</button>`).join('') : '<span class="sp-filter-status">Keine Seminareinheiten zugeordnet</span>'}</div>
                                </div>
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
                        const toggle = card.querySelector('[data-action="toggle-unit-slot"]');
                        if (toggle) {
                            toggle.addEventListener('click', (event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                if (!this.isMobileViewport()) {
                                    return;
                                }
                                const slotkey = String(toggle.getAttribute('data-slot-key') || '');
                                if (!slotkey) {
                                    return;
                                }
                                this.expandedUnitSlotKey = this.expandedUnitSlotKey === slotkey ? '' : slotkey;
                                this.renderMethods();
                            });
                        }
                        const sourcealtselector = card.querySelector('[data-act="source-unit-alt"]');
                        if (sourcealtselector) {
                            sourcealtselector.addEventListener('change', () => {
                                const selectedid = String(sourcealtselector.value || '').trim();
                                const slotunitids = slot.units.map((entry) => String(entry.id || '').trim());
                                this.planningState.units = this.planningState.units.map((entry) => {
                                    const entryid = String(entry.id || '').trim();
                                    if (!slotunitids.includes(entryid)) {
                                        return entry;
                                    }
                                    return Object.assign({}, entry, {active: entryid === selectedid});
                                });
                                this.renderMethods();
                            });
                        }
                        card.querySelectorAll('[data-action="preview-unit-method"]').forEach((button) => {
                            button.addEventListener('click', (event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                const method = this.methods.find((entry) => String(entry.id) === String(button.getAttribute('data-method-id')));
                                if (!method) {
                                    return;
                                }
                                this.openMethodDetailModal(this.toCard(method));
                            });
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
            const allDayRow = bySel('#sp-allday-row');
            if (!header || !row) {
                return;
            }

            header.querySelectorAll('.sp-colhead').forEach((el) => el.remove());
            row.querySelectorAll('.sp-daycol').forEach((el) => el.remove());
            if (allDayRow) {
                allDayRow.querySelectorAll('.sp-allday-cell').forEach((el) => el.remove());
            }

            const visibleDays = this.getVisibleDays();
            visibleDays.forEach((day) => {
                const h = document.createElement('div');
                h.className = 'sp-colhead';
                h.innerHTML = `
                    <div class="sp-colhead-day">${escapeHtml(day)}</div>
                    <div class="sp-sum" data-sum="${escapeHtml(day)}">0 Min</div>
                `;
                header.appendChild(h);

                const dayCol = document.createElement('div');
                dayCol.className = 'sp-daycol';
                dayCol.innerHTML = `<div class="sp-grid" data-day="${escapeHtml(day)}"></div><div class="sp-overlay" data-overlay="${escapeHtml(day)}"></div>`;
                row.appendChild(dayCol);

                if (allDayRow) {
                    const allDayCell = document.createElement('div');
                    allDayCell.className = 'sp-allday-cell';
                    allDayCell.setAttribute('data-allday', day);
                    allDayCell.innerHTML = '<span class="sp-allday-empty">Keine Einträge</span>';
                    allDayRow.appendChild(allDayCell);
                }
            });

            const count = visibleDays.length;
            header.style.gridTemplateColumns = `${TIME_AXIS_WIDTH}px repeat(${count}, minmax(180px, 1fr))`;
            row.style.gridTemplateColumns = `${TIME_AXIS_WIDTH}px repeat(${count}, minmax(180px, 1fr))`;
            if (allDayRow) {
                allDayRow.style.gridTemplateColumns = `${TIME_AXIS_WIDTH}px repeat(${count}, minmax(180px, 1fr))`;
            }
            this.updateViewControls();
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

        renderAllDayRow() {
            if (!bySel('#sp-allday-row')) {
                return;
            }
            this.getVisibleDays().forEach((day) => {
                const target = bySel(`[data-allday="${day}"]`);
                if (!target) {
                    return;
                }
                const items = this.state.plan.days[day] || [];
                if (!items.length) {
                    target.innerHTML = '<span class="sp-allday-empty">Keine Einträge</span>';
                    return;
                }
                const totalMin = items.reduce((sum, item) => sum + Math.max(0, Number(item.endMin || 0) - Number(item.startMin || 0)), 0);
                const methods = items.filter((item) => item.kind === 'method').length;
                const units = items.filter((item) => item.kind === 'unit').length;
                const breaks = items.filter((item) => item.kind === 'break').length;
                const chips = [
                    `${items.length} Einträge`,
                    `${Math.floor(totalMin / 60)}h ${totalMin % 60}m`,
                    methods ? `${methods} Seminareinheiten` : '',
                    units ? `${units} Bausteine` : '',
                    breaks ? `${breaks} Pausen` : ''
                ].filter(Boolean);
                target.innerHTML = chips.map((chip) => `<span class="sp-allday-chip">${escapeHtml(chip)}</span>`).join('');
            });
        }

        renderOverlays() {
            const start = parseTimeToMinutes(this.state.config.timeRange.start);
            const end = parseTimeToMinutes(this.state.config.timeRange.end);
            const slotMinutes = ZOOM_LEVELS[this.zoomIndex].slotMinutes;
            const slotsPerDay = Math.max(1, Math.round((end - start) / slotMinutes));

            const todayName = getTodayDayName();
            this.getVisibleDays().forEach((day) => {
                const overlay = document.querySelector(`[data-overlay="${day}"]`);
                if (!overlay) {
                    return;
                }
                overlay.innerHTML = '';
                const now = new Date();
                const nowMinute = toMin(now.getHours(), now.getMinutes());
                const isToday = day === todayName;
                if (isToday && nowMinute >= start && nowMinute <= end) {
                    const topPx = ((nowMinute - start) / slotMinutes) * ZOOM_LEVELS[this.zoomIndex].slotPx;
                    const indicator = document.createElement('div');
                    indicator.className = 'sp-nowline';
                    indicator.style.top = `${topPx}px`;
                    indicator.innerHTML = `<span class="sp-nowline__label">${escapeHtml(label(nowMinute))}</span>`;
                    overlay.appendChild(indicator);
                }

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
                    if ((Number(it.endMin || 0) - Number(it.startMin || 0)) <= 10) {
                        className += ' sp-item--compact';
                    }
                    if (it.cognitiveLevel) {
                        className += ` sp-level-${it.cognitiveLevel}`;
                    }
                    div.className = className;
                    div.style.gridRow = `${startIdx} / ${endIdx}`;
                    div.style.gridColumn = '1 / -1';
                    div.draggable = true;

                    div.addEventListener('dragstart', (e) => {
                        const fromResizeHandle = e.target && typeof e.target.closest === 'function' && e.target.closest('.sp-resize-handle');
                        if (fromResizeHandle || this.resizeState) {
                            e.preventDefault();
                            return;
                        }
                        div.classList.add('sp-item--dragging');
                        e.dataTransfer.setData('text/plain', JSON.stringify({type: 'move', day, uid: it.uid}));
                    });
                    div.addEventListener('dragend', () => {
                        div.classList.remove('sp-item--dragging');
                    });
                    div.addEventListener('dragover', (event) => event.preventDefault());
                    div.addEventListener('drop', (event) => this.onDrop(event, {getAttribute: () => day}, this.minutesToIndex(it.startMin)));

                    let title = it.title || '';
                    if (it.flowTotal > 1 && it.flowOrder > 1) {
                        title = `${title} (Fortsetzung ${it.flowOrder}/${it.flowTotal})`;
                    }
                    const timeLabel = `${label(it.startMin)} - ${label(it.endMin)}`;
                    const isDayView = this.state.view.mode === VIEW_MODE_DAY;
                    const titleWithTime = isDayView ? `${title} - ${timeLabel}` : title;

                    let menuActions = '';
                    let unitmethodshtml = '';
                    let unitLabelHtml = '';
                    let unitColorKey = '';
                    if (it.kind === 'unit') {
                        const slot = this.getPlanningSlot(it.slotkey);
                        const alternatives = slot && Array.isArray(slot.units) ? slot.units : [];
                        unitColorKey = String(it.slotkey || it.unitid || '');
                        const selector = alternatives.length > 1
                            ? `<div class="sp-menu-select-wrap"><label class="sp-menu-select-label">${lucideIcon('arrow-left-right', 'sp-menu-select-label-icon')}Alternativer Baustein</label><select class="kg-input" data-act="unit-alt" data-uid="${escapeHtml(it.uid)}">${alternatives.map((unit) => `<option value="${escapeHtml(unit.id)}" ${String(unit.id) === String(it.unitid) ? 'selected' : ''}>${escapeHtml(unit.title)}</option>`).join('')}</select></div>`
                            : '';
                        menuActions = `${selector}
                            <button type="button" class="ml-card-menu-btn" data-action="edit-unit" data-uid="${escapeHtml(it.uid)}"><span class="sp-menu-btn__icon">${lucideIcon('notebook-pen')}</span><span class="sp-menu-btn__label">Bearbeiten</span></button>
                            <button type="button" class="ml-card-menu-btn" data-act="resolve-unit" data-uid="${escapeHtml(it.uid)}"><span class="sp-menu-btn__icon">${lucideIcon('blocks')}</span><span class="sp-menu-btn__label">Auflösen</span></button>`;
                        const unit = this.getUnitById(it.unitid);
                        const methodcards = this.getUnitMethodCards(unit);
                        if (methodcards.length) {
                            unitmethodshtml = `
                                <div class="sp-item-unit-methods">
                                    <div class="sp-item-unit-methods__label">Seminareinheiten</div>
                                    <div class="sp-item-unit-methods__scroller">
                                        ${methodcards.map((methodcard) => `
                                            <button type="button" class="sp-unit-method-card${methodcard.cognitiveLevel ? ` sp-level-${escapeHtml(String(methodcard.cognitiveLevel))}` : ''}" data-action="preview-unit-method" data-method-id="${escapeHtml(String(methodcard.id))}">
                                                <div class="sp-card-compact">
                                                    <div class="sp-card-title">
                                                        <span class="sp-title-text sp-card-title-main"><strong class="sp-titletext">${escapeHtml(methodcard.title)}</strong></span>
                                                    </div>
                                                    <div class="sp-card-meta">
                                                        <span class="sp-badge">${escapeHtml(String(methodcard.duration || '-'))} Min</span>
                                                        <span class="sp-badge">${escapeHtml(methodcard.group || '-')}</span>
                                                    </div>
                                                    <div class="sp-card-description">${sanitizeHtml(methodcard.description || '')}</div>
                                                </div>
                                            </button>
                                        `).join('')}
                                    </div>
                                </div>
                            `;
                        }
                        unitLabelHtml = `<div class="sp-entry-unitlabel">Baustein: ${escapeHtml((unit && unit.title) || title)}</div>`;
                    } else if (it.kind === 'method') {
                        menuActions = '';
                        const method = this.methods.find((m) => String(m.id) === String(it.entryId));
                        const alternatives = method ? this.getMethodAlternativeIds(method) : [];
                        if (alternatives.length > 1) {
                            menuActions += `<div class="sp-menu-select-wrap"><label class="sp-menu-select-label">${lucideIcon('git-compare-arrows', 'sp-menu-select-label-icon')}Alternative Seminareinheit</label><select class="kg-input" data-act="method-alt" data-uid="${escapeHtml(it.uid)}">${alternatives.map((id) => {
                                const alt = this.methods.find((m) => String(m.id) === String(id));
                                return alt ? `<option value="${escapeHtml(id)}" ${String(id) === String(it.entryId) ? 'selected' : ''}>${escapeHtml(alt.titel || id)}</option>` : '';
                            }).join('')}</select></div>`;
                        }
                        menuActions += `
                            <button type="button" class="ml-card-menu-btn" data-action="preview-plan-method" data-uid="${escapeHtml(it.uid)}"><span class="sp-menu-btn__icon">${lucideIcon('file-text')}</span><span class="sp-menu-btn__label">Ansehen</span></button>
                            <button type="button" class="ml-card-menu-btn" data-action="edit-plan-method" data-uid="${escapeHtml(it.uid)}"><span class="sp-menu-btn__icon">${lucideIcon('notebook-pen')}</span><span class="sp-menu-btn__label">Bearbeiten</span></button>
                        `;
                        if (it.parentunit) {
                            const parentunit = this.getUnitById(it.parentunit);
                            if (parentunit) {
                                unitColorKey = String(parentunit.slotkey || parentunit.id || '');
                                unitLabelHtml = `<div class="sp-entry-unitlabel">Baustein: ${escapeHtml(parentunit.title || '')}</div>`;
                            }
                        }
                    }

                    if (unitColorKey) {
                        div.classList.add('sp-item--unit-colored');
                        div.style.setProperty('--sp-unit-color', this.getUnitSlotColor(unitColorKey));
                    }

                    let defaultActions = '';
                    defaultActions += `<button type="button" class="ml-card-menu-btn ml-card-menu-btn-delete" data-act="delete" data-uid="${escapeHtml(it.uid)}"><span class="sp-menu-btn__icon">${lucideIcon('trash-2')}</span><span class="sp-menu-btn__label">Löschen</span></button>`;

                    div.innerHTML = `
                        <div class="sp-item-content">
                            ${unitLabelHtml}
                            <div class="sp-title" data-full-title="${escapeHtml(titleWithTime)}">${escapeHtml(titleWithTime)}</div>
                            ${isDayView ? '' : `<div class="sp-meta">${escapeHtml(timeLabel)}</div>`}
                            ${unitmethodshtml}
                        </div>
                        <details class="ml-card-menu sp-item-context">
                            <summary class="ml-card-menu-toggle" data-action="toggle-context-menu" aria-label="Kontextmenü">⋮</summary>
                            <div class="ml-card-menu-panel" role="menu" aria-label="Eintrag Aktionen">
                                ${menuActions}
                                ${defaultActions}
                            </div>
                        </details>
                    `;
                    if (it.kind === 'method' || it.kind === 'break') {
                        const topHandle = document.createElement('div');
                        topHandle.className = 'sp-resize-handle sp-resize-handle--top';
                        topHandle.setAttribute('data-resize', 'start');
                        topHandle.setAttribute('aria-hidden', 'true');
                        topHandle.addEventListener('pointerdown', (event) => this.startItemResize(event, it, day, 'start'));
                        div.appendChild(topHandle);

                        const bottomHandle = document.createElement('div');
                        bottomHandle.className = 'sp-resize-handle sp-resize-handle--bottom';
                        bottomHandle.setAttribute('data-resize', 'end');
                        bottomHandle.setAttribute('aria-hidden', 'true');
                        bottomHandle.addEventListener('pointerdown', (event) => this.startItemResize(event, it, day, 'end'));
                        div.appendChild(bottomHandle);
                    }
                    if (it.kind === 'method') {
                        div.classList.add('sp-item--method-clickable');
                        div.setAttribute('role', 'button');
                        div.setAttribute('tabindex', '0');
                        div.setAttribute('aria-label', `${title || 'Seminareinheit'} öffnen`);
                        div.addEventListener('click', (event) => {
                            if (event.target.closest('.ml-card-menu, .sp-btn, select, button, input, textarea, a, .sp-resize-handle')) {
                                return;
                            }
                            this.openMethodDetailFromPlanItem(it);
                        });
                        div.addEventListener('keydown', (event) => {
                            if (event.key !== 'Enter' && event.key !== ' ') {
                                return;
                            }
                            if (event.target.closest('.ml-card-menu, .sp-btn, select, button, input, textarea, a, .sp-resize-handle')) {
                                return;
                            }
                            event.preventDefault();
                            this.openMethodDetailFromPlanItem(it);
                        });
                    }
                    if (it.kind === 'break') {
                        div.classList.add('sp-item--method-clickable');
                        div.setAttribute('role', 'button');
                        div.setAttribute('tabindex', '0');
                        div.setAttribute('aria-label', 'Pause bearbeiten');
                        div.addEventListener('click', (event) => {
                            if (event.target.closest('.ml-card-menu, .sp-btn, select, button, input, textarea, a, .sp-resize-handle')) {
                                return;
                            }
                            this.openBreakModalForItem(day, it);
                        });
                        div.addEventListener('keydown', (event) => {
                            if (event.key !== 'Enter' && event.key !== ' ') {
                                return;
                            }
                            if (event.target.closest('.ml-card-menu, .sp-btn, select, button, input, textarea, a, .sp-resize-handle')) {
                                return;
                            }
                            event.preventDefault();
                            this.openBreakModalForItem(day, it);
                        });
                    }
                    overlay.appendChild(div);
                });
            });

            bySel('#sp-grid-row')?.querySelectorAll('[data-act="method-alt"]').forEach((select) => {
                select.addEventListener('change', () => {
                    this.closeContextMenus();
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

            bySel('#sp-grid-row')?.querySelectorAll('[data-action="preview-unit-method"]').forEach((button) => {
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    this.closeContextMenus();
                    const method = this.methods.find((entry) => String(entry.id) === String(button.getAttribute('data-method-id')));
                    if (!method) {
                        return;
                    }
                    this.openMethodDetailModal(this.toCard(method));
                });
            });

            bySel('#sp-grid-row')?.querySelectorAll('[data-action="preview-plan-method"]').forEach((button) => {
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    this.closeContextMenus();
                    const found = this.findItemByUid(button.getAttribute('data-uid'));
                    if (!found.item || found.item.kind !== 'method') {
                        return;
                    }
                    this.openMethodDetailFromPlanItem(found.item);
                });
            });

            bySel('#sp-grid-row')?.querySelectorAll('[data-action="edit-plan-method"]').forEach((button) => {
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    this.closeContextMenus();
                    const found = this.findItemByUid(button.getAttribute('data-uid'));
                    if (!found.item || found.item.kind !== 'method') {
                        return;
                    }
                    const methodid = String(found.item.entryId || '').trim();
                    if (!methodid) {
                        return;
                    }
                    this.openMethodLibraryEditor(methodid);
                });
            });

            bySel('#sp-grid-row')?.querySelectorAll('[data-action="edit-unit"]').forEach((button) => {
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    this.closeContextMenus();
                    const found = this.findItemByUid(button.getAttribute('data-uid'));
                    if (!found.item || found.item.kind !== 'unit') {
                        return;
                    }
                    const unitid = String(found.item.unitid || '').trim();
                    if (!unitid) {
                        return;
                    }
                    this.openPlanningModeEditor(unitid);
                });
            });

            bySel('#sp-grid-row')?.querySelectorAll('[data-act="unit-alt"]').forEach((select) => {
                select.addEventListener('change', () => {
                    this.closeContextMenus();
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
            this.renderAllDayRow();
        }

        updateSums() {
            this.getVisibleDays().forEach((day) => {
                const sum = (this.state.plan.days[day] || []).reduce((acc, item) => acc + (item.endMin - item.startMin), 0);
                const el = document.querySelector(`[data-sum="${day}"]`);
                if (el) {
                    el.textContent = `${Math.floor(sum / 60)} Std ${sum % 60} Min`;
                }
            });
        }

        refreshLayout() {
            this.ensureViewState();
            this.wrapper.classList.remove('sp-zoom-fine', 'sp-zoom-medium', 'sp-zoom-coarse');
            this.wrapper.classList.add(`sp-zoom-${ZOOM_LEVELS[this.zoomIndex].id}`);
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
            const scale = bySel('#sp-time-scale');
            if (scale) {
                scale.value = String(ZOOM_LEVELS[this.zoomIndex].slotMinutes);
            }
        }

        addSegmentedItems(kind, payload, day, startMin, options = {}) {
            const duration = this.snapDuration(payload.duration || this.state.config.granularity);
            const skipflow = String(options.skipflowid || '');
            const allocation = this.allocateAcrossPlan(day, startMin, duration, {skipflowid: skipflow});
            if (!allocation.segments.length) {
                this.warn('Kein freier Zeitraum im Raster verfügbar.');
                return null;
            }

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
                    title: payload.title || (kind === 'unit' ? 'Baustein' : 'Seminareinheit'),
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

        addItemsFromSegments(kind, payload, segments, options = {}) {
            const cleanSegments = (Array.isArray(segments) ? segments : [])
                .filter((segment) => segment && segment.endMin > segment.startMin);
            if (!cleanSegments.length) {
                this.warn('Kein freier Zeitraum im Raster verfügbar.');
                return null;
            }

            const collisions = cleanSegments.some((segment) => {
                const list = this.state.plan.days[segment.day] || [];
                return this.hasCollision(list, segment);
            });
            if (collisions) {
                this.warn('Zeitüberschneidung im Zielbereich.');
                return null;
            }

            const flowid = options.flowid || uid();
            const preferredUids = Array.isArray(options.preferredUids) ? options.preferredUids : [];
            const total = cleanSegments.length;
            const created = cleanSegments.map((segment, index) => {
                const base = {
                    uid: preferredUids[index] || uid(),
                    flowid,
                    flowOrder: index + 1,
                    flowTotal: total,
                    title: payload.title || (kind === 'unit' ? 'Baustein' : 'Seminareinheit'),
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
            const last = created[created.length - 1];
            return {entries: created, endday: last.day, endmin: last.endMin};
        }

        handleAddMethod(payload, day, startMin) {
            const result = this.addSegmentedItems('method', payload, day, startMin);
            if (!result) {
                return;
            }
            this.clearWarn();
            this.setStatus('Neues Element hinzugefügt. Speichern läuft ...', false);
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
            this.setStatus('Neues Element hinzugefügt. Speichern läuft ...', false);
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

        flowEntriesFromSnapshot(snapshot, flowid) {
            const list = [];
            const days = snapshot || {};
            this.state.config.days.forEach((day) => {
                (days[day] || []).forEach((entry) => {
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
            if (moving.kind === 'break') {
                const snapshot = this.clonePlanDays();
                const oldDay = String(payload.day || '');
                const oldStart = Number(moving.startMin || 0);
                const duration = this.getEntryDuration(moving);
                this.state.plan.days[oldDay] = (this.state.plan.days[oldDay] || [])
                    .filter((entry) => String(entry.uid) !== String(moving.uid));
                if (!this.reflowAfterBreakRemoval(oldDay, oldStart)) {
                    this.restorePlanDays(snapshot);
                    return;
                }
                const placed = this.placeBreakAndReflow({
                    uid: moving.uid,
                    day,
                    title: moving.title || 'Pause',
                    startMin,
                    endMin: startMin + duration,
                    kind: 'break',
                    details: moving.details || {}
                }, {ignoreUid: moving.uid});
                if (!placed) {
                    this.restorePlanDays(snapshot);
                    return;
                }
                this.setStatus('Pause verschoben. Elemente wurden neu eingeteilt. Speichern läuft ...', false);
                this.savePlan();
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
            this.setStatus('Neue Elemente hinzugefügt. Speichern läuft ...', false);
            this.savePlan();
        }

        onDrop(event, grid, slotIndex) {
            event.preventDefault();
            event.stopPropagation();
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

            const startMin = this.dropEventToStartMinute(event, day, slotIndex);
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
            const btn = event.target.closest('button[data-act]');
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

            if (act === 'resolve-unit') {
                this.closeContextMenus();
                this.resolveUnitItem(itemuid);
                return;
            }

            if (act === 'delete') {
                if (item.kind === 'break') {
                    const snapshot = this.clonePlanDays();
                    const startMin = Number(item.startMin || 0);
                    list.splice(idx, 1);
                    if (!this.reflowAfterBreakRemoval(day, startMin)) {
                        this.restorePlanDays(snapshot);
                        return;
                    }
                } else if (item.flowid) {
                    this.removeFlow(item.flowid);
                } else {
                    list.splice(idx, 1);
                }
                this.closeContextMenus();
                this.savePlan();
                return;
            }
            if (act === 'extend' || act === 'shorten') {
                return;
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
                    this.warn('Einheit teilweise aufgelöst: nicht alle Seminareinheiten konnten eingeplant werden.');
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
            asCall('mod_seminarplaner_delete_grid', {
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
                        this.setSavedState('Gespeichert: -');
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
                    const duration = this.snapBreakDuration(modal.querySelector('#sp-break-duration').value);
                    if (!this.state.plan.days[day]) {
                        this.state.plan.days[day] = [];
                    }
                    const baseUid = this.breakEditRef && this.breakEditRef.itemuid
                        ? String(this.breakEditRef.itemuid)
                        : uid();
                    const item = {
                        uid: baseUid,
                        day,
                        title: 'Pause',
                        startMin,
                        endMin: startMin + duration,
                        kind: 'break',
                        details: {}
                    };
                    const snapshot = this.clonePlanDays();
                    if (this.breakEditRef && this.breakEditRef.day) {
                        const oldday = this.breakEditRef.day;
                        const olditem = (this.state.plan.days[oldday] || [])
                            .find((entry) => String(entry.uid) === baseUid);
                        const oldstart = olditem ? Number(olditem.startMin || 0) : startMin;
                        this.state.plan.days[oldday] = (this.state.plan.days[oldday] || [])
                            .filter((entry) => String(entry.uid) !== baseUid);
                        if (!this.reflowAfterBreakRemoval(oldday, oldstart)) {
                            this.restorePlanDays(snapshot);
                            return;
                        }
                    }
                    if (!this.placeBreakAndReflow(item, {ignoreUid: baseUid})) {
                        this.restorePlanDays(snapshot);
                        return;
                    }
                    this.breakEditRef = null;
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
                    <div class="sp-method-detail__text">${formatRichText(entry.value)}</div>
                </section>
            `).join('') : '<p class="sp-method-detail__empty">Keine zusätzlichen Details vorhanden.</p>';

            return `${metaHtml}${sectionsHtml}`;
        }

        openMethodLibraryEditor(methodid = '') {
            const base = (typeof M !== 'undefined' && M && M.cfg && M.cfg.wwwroot) ? String(M.cfg.wwwroot) : '';
            const cmid = encodeURIComponent(String(this.cmid || ''));
            const editparam = methodid ? `&editmethodid=${encodeURIComponent(String(methodid))}` : '';
            window.location.href = `${base}/mod/seminarplaner/methodlibrary.php?id=${cmid}${editparam}#ml-edit-section`;
        }

        openPlanningModeEditor(unitid = '') {
            const base = (typeof M !== 'undefined' && M && M.cfg && M.cfg.wwwroot) ? String(M.cfg.wwwroot) : '';
            const cmid = encodeURIComponent(String(this.cmid || ''));
            const editparam = unitid ? `&editunitid=${encodeURIComponent(String(unitid))}` : '';
            window.location.href = `${base}/mod/seminarplaner/planningmode.php?id=${cmid}${editparam}&focus=step2#kg-pm-step-2`;
        }

        openMethodDetailFromPlanItem(item) {
            if (!item || item.kind !== 'method') {
                return;
            }
            const method = this.methods.find((entry) => String(entry.id) === String(item.entryId || ''));
            if (method) {
                this.openMethodDetailModal(this.toCard(method));
                return;
            }
            const fallback = {
                id: item.entryId || '',
                title: item.title || 'Seminareinheit',
                duration: Math.max(5, Number((item.endMin || 0) - (item.startMin || 0)) || 5),
                group: '',
                phase: item.phase || '',
                cognitive: item.cognitive || '',
                tags: '',
                details: Object.assign({
                    description: '',
                    reflection: '',
                    requirements: '',
                    socialform: '',
                    preparation: '',
                    materials: '',
                    flow: '',
                    risks: '',
                    resources: '',
                    objectives: '',
                    contact: ''
                }, item.details || {})
            };
            this.openMethodDetailModal(fallback);
        }

        createMethodDetailModal() {
            const modal = document.createElement('div');
            modal.className = 'sp-modal';
            modal.setAttribute('aria-hidden', 'true');
            modal.innerHTML = `
                <div class="sp-modal__backdrop" data-modal-close="method-detail"></div>
                <div class="sp-modal__dialog sp-modal__dialog--large" role="dialog" aria-modal="true" aria-labelledby="sp-method-detail-title">
                    <header class="sp-modal__header">
                        <h2 id="sp-method-detail-title">Seminareinheit</h2>
                        <button type="button" class="sp-modal__close" data-modal-close="method-detail" aria-label="Popup schließen">X</button>
                    </header>
                    <div class="sp-modal__body sp-method-detail__body" id="sp-method-detail-body"></div>
                    <div class="sp-modal__actions">
                        <button type="button" class="kg-btn kg-btn-primary" id="sp-method-detail-edit">Bearbeiten</button>
                        <button type="button" class="kg-btn" data-modal-close="method-detail">Schließen</button>
                    </div>
                </div>
            `;
            this.wrapper.appendChild(modal);
            this.methodDetailModal = modal;

            modal.addEventListener('click', (event) => {
                if (event.target.getAttribute('data-modal-close') === 'method-detail') {
                    this.closeMethodDetailModal();
                }
            });
            const editBtn = modal.querySelector('#sp-method-detail-edit');
            if (editBtn) {
                editBtn.addEventListener('click', () => {
                    const methodid = String(editBtn.getAttribute('data-method-id') || '').trim();
                    this.closeMethodDetailModal();
                    this.openMethodLibraryEditor(methodid);
                });
            }
        }

        openMethodDetailModal(cardData) {
            if (!this.methodDetailModal) {
                return;
            }
            const title = this.methodDetailModal.querySelector('#sp-method-detail-title');
            const body = this.methodDetailModal.querySelector('#sp-method-detail-body');
            const editBtn = this.methodDetailModal.querySelector('#sp-method-detail-edit');
            if (title) {
                title.textContent = cardData.title || 'Seminareinheit';
            }
            if (body) {
                body.innerHTML = this.buildMethodDetailBody(cardData);
            }
            if (editBtn) {
                const methodid = String(cardData && cardData.id ? cardData.id : '').trim();
                if (methodid) {
                    editBtn.setAttribute('data-method-id', methodid);
                    editBtn.disabled = false;
                } else {
                    editBtn.setAttribute('data-method-id', '');
                    editBtn.disabled = true;
                }
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
            this.breakEditRef = null;
            const title = this.breakModal.querySelector('#sp-break-modal-title');
            if (title) {
                title.textContent = 'Pause hinzufügen';
            }
            const start = parseTimeToMinutes(this.state.config.timeRange.start);
            const end = parseTimeToMinutes(this.state.config.timeRange.end);
            this.breakModal.querySelector('#sp-break-day').value = this.state.config.days[0] || DAYS_ALL[0];
            this.breakModal.querySelector('#sp-break-start').value = label(Math.min(end - this.state.config.granularity, start + 240));
            this.breakModal.classList.add('sp-modal--visible');
            this.breakModal.removeAttribute('aria-hidden');
        }

        openBreakModalForItem(day, item) {
            if (!this.breakModal || !item || item.kind !== 'break') {
                return;
            }
            this.breakEditRef = {
                day: String(day || ''),
                itemuid: String(item.uid || '')
            };
            const title = this.breakModal.querySelector('#sp-break-modal-title');
            if (title) {
                title.textContent = 'Pause bearbeiten';
            }
            this.breakModal.querySelector('#sp-break-day').value = String(day || this.state.config.days[0] || DAYS_ALL[0]);
            this.breakModal.querySelector('#sp-break-start').value = label(Number(item.startMin || 0));
            this.breakModal.querySelector('#sp-break-duration').value = String(Math.max(5, Number(item.endMin || 0) - Number(item.startMin || 0)));
            this.breakModal.classList.add('sp-modal--visible');
            this.breakModal.removeAttribute('aria-hidden');
        }

        closeBreakModal() {
            if (!this.breakModal) {
                return;
            }
            this.breakEditRef = null;
            this.breakModal.classList.remove('sp-modal--visible');
            this.breakModal.setAttribute('aria-hidden', 'true');
        }

        findFirstGapInDay(day, duration) {
            const dayStart = parseTimeToMinutes(this.state.config.timeRange.start);
            const dayEnd = parseTimeToMinutes(this.state.config.timeRange.end);
            const items = (this.state.plan.days[day] || []).slice().sort((a, b) => a.startMin - b.startMin);
            let pointer = dayStart;
            for (const item of items) {
                if (item.startMin - pointer >= duration) {
                    return pointer;
                }
                if (item.endMin > pointer) {
                    pointer = item.endMin;
                }
                if (pointer + duration > dayEnd) {
                    return null;
                }
            }
            return pointer + duration <= dayEnd ? pointer : null;
        }

        addBreakAtFirstGap() {
            this.ensurePlanDays();
            this.ensureViewState();
            const duration = this.snapBreakDuration(5);
            const days = this.state.view.mode === VIEW_MODE_DAY ? [this.state.view.day] : this.state.config.days.slice();
            for (const day of days) {
                const startMin = this.findFirstGapInDay(day, duration);
                if (!Number.isFinite(startMin)) {
                    continue;
                }
                const item = {
                    uid: uid(),
                    title: 'Pause',
                    startMin,
                    endMin: startMin + duration,
                    kind: 'break',
                    details: {}
                };
                this.state.plan.days[day].push(item);
                this.clearWarn();
                this.setStatus(`Pause hinzugefügt: ${day} ${label(startMin)} (${duration} Min).`, false);
                this.savePlan();
                return;
            }
            this.warn('Kein freier Zeitraum für Pause verfügbar.');
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
            const viewWeek = bySel('#sp-view-week');
            if (viewWeek) {
                viewWeek.addEventListener('click', () => this.setViewMode(VIEW_MODE_WEEK));
            }
            const viewDay = bySel('#sp-view-day');
            if (viewDay) {
                viewDay.addEventListener('click', () => this.setViewMode(VIEW_MODE_DAY));
            }
            const daySelect = bySel('#sp-day-select');
            if (daySelect) {
                daySelect.addEventListener('change', () => this.setViewDay(daySelect.value));
            }
            const dayPrev = bySel('#sp-day-prev');
            if (dayPrev) {
                dayPrev.addEventListener('click', () => this.shiftViewDay(-1));
            }
            const dayNext = bySel('#sp-day-next');
            if (dayNext) {
                dayNext.addEventListener('click', () => this.shiftViewDay(1));
            }
            const timeScale = bySel('#sp-time-scale');
            if (timeScale) {
                timeScale.addEventListener('change', () => {
                    const minutes = Number.parseInt(timeScale.value, 10);
                    const index = ZOOM_LEVELS.findIndex((entry) => Number(entry.slotMinutes) === minutes);
                    if (index < 0) {
                        return;
                    }
                    this.zoomIndex = index;
                    this.refreshLayout();
                    this.scheduleAutosave();
                });
            }
            document.addEventListener('click', (event) => {
                const tabLink = event.target.closest('.kg-tabs a.kg-tab');
                if (tabLink && tabLink.href) {
                    event.preventDefault();
                    window.location.href = tabLink.href;
                    return;
                }
                const addBreakTrigger = event.target.closest('#sp-addbreak');
                if (addBreakTrigger) {
                    event.preventDefault();
                    this.addBreakAtFirstGap();
                    return;
                }
                const clearTrigger = event.target.closest('#sp-clear');
                if (clearTrigger) {
                    event.preventDefault();
                    this.deleteSelectedGrid();
                    return;
                }
                this.handleContextMenuToggle(event);
                this.handleItemAction(event);
            });
            document.addEventListener('pointermove', (event) => this.updateItemResize(event), {passive: false});
            document.addEventListener('pointerup', () => this.finishItemResize());
            document.addEventListener('pointercancel', () => this.finishItemResize());
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    this.closeContextMenus();
                    this.finishItemResize();
                }
            });
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
                status.textContent = this.filterIndex.length ? `${visible} von ${this.filterIndex.length} Seminareinheiten angezeigt.` : 'Keine Seminareinheiten geladen.';
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
                        asCall('mod_seminarplaner_create_grid', {cmid: this.cmid, name: pendingname, description: ''})
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
                    const dur = this.snapBreakDuration(br.duration);
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
                    const selectedgridid = String(selectgrid.value || '').trim();
                    const loadedgridid = String(this.state.gridid || '').trim();
                    if (selectedgridid === loadedgridid && selectedgridid) {
                        this.toggleStepTwo(true);
                        this.setStatus('Aktueller Seminarplan ist bereits geladen.', false);
                        this.syncPublishControl();
                        return;
                    }
                    this.toggleStepTwo(false);
                    this.setStatus('Seminarplan ausgewählt. Bitte "Seminarplan laden" klicken.', false);
                    this.syncPublishControl();
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
                    this.loadGridState().then(() => this.syncPublishControl());
                });
            }
            const savebtn = bySel('#kg-save-grid');
            if (savebtn) {
                savebtn.addEventListener('click', () => this.saveGridState({silent: false, manual: true}));
            }
            const publishcheckbox = bySel('#kg-publish-roterfaden');
            if (publishcheckbox) {
                publishcheckbox.addEventListener('change', () => {
                    if (this.isUpdatingPublishControl) {
                        return;
                    }
                    const shouldpublish = !!publishcheckbox.checked;
                    const rollback = () => {
                        this.isUpdatingPublishControl = true;
                        publishcheckbox.checked = !shouldpublish;
                        this.isUpdatingPublishControl = false;
                        this.syncPublishControl();
                    };
                    if (shouldpublish) {
                        this.saveGridState({silent: true, autosave: true})
                            .then(() => this.publishCurrentGrid({silent: false}))
                            .catch((error) => {
                                Notification.exception(error);
                                rollback();
                            });
                        return;
                    }
                    this.unpublishRoterFaden({silent: false}).catch((error) => {
                        Notification.exception(error);
                        rollback();
                    });
                });
            }
        }

        listGrids(preferred = '') {
            return asCall('mod_seminarplaner_list_grids', {cmid: this.cmid}).then((res) => {
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
            return asCall('mod_seminarplaner_get_method_cards', {cmid: this.cmid}).then((res) => {
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
            return asCall('mod_seminarplaner_get_planning_state', {cmid: this.cmid}).then((res) => {
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
                view: {mode: VIEW_MODE_WEEK, day: 'Montag'},
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
                    view: {mode: VIEW_MODE_WEEK, day: 'Montag'},
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
                        title: entry.title || `Seminareinheit ${entry.methodid || ''}`,
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
                view: Object.assign({}, defaults.view, raw.view || {}),
                plan: raw.plan && raw.plan.days ? raw.plan : {days: {}},
                sourceMode: raw.sourceMode === 'units' ? 'units' : 'methods'
            };
        }

        loadGridState(options = {}) {
            const silent = !!options.silent;
            const gridid = this.getGridId();
            this.state.gridid = gridid;
            if (!gridid) {
                this.clearRememberedLoadedGridId();
                this.state = Object.assign({}, this.state, this.normalizeLoadedState({}));
                this.ensurePlanDays();
                this.syncSourceTabs();
                this.renderMethods();
                this.applyConfigToModal();
                this.refreshLayout();
                this.syncPublishControl();
                return Promise.resolve();
            }

            return asCall('mod_seminarplaner_get_user_state', {cmid: this.cmid, gridid}).then((res) => {
                let parsed = {};
                try {
                    parsed = res.statejson ? JSON.parse(res.statejson) : {};
                } catch (e) {
                    parsed = {};
                }
                const normalized = this.normalizeLoadedState(parsed);
                this.state = Object.assign({}, this.state, normalized, {gridid});
                this.versionhash = res.versionhash || '';
                this.rememberLoadedGridId(gridid);
                this.ensurePlanDays();
                this.syncSourceTabs();
                this.applyConfigToModal();
                this.renderMethods();
                this.refreshLayout();
                this.syncPublishControl();
                if (!silent) {
                    this.setStatus('Seminarplan geladen.', false);
                    this.setSavedState('Gespeichert: Geladen');
                }
            }).catch((error) => {
                Notification.exception(error);
                this.setStatus('Seminarplan laden fehlgeschlagen.', true);
                this.setSavedState('Gespeichert: Fehler', true);
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
            const payload = this.buildGridPayload();

            const request = asCall('mod_seminarplaner_save_user_state', {
                cmid: this.cmid,
                gridid,
                statejson: JSON.stringify(payload),
                expectedhash: this.versionhash || ''
            }).then((res) => {
                this.versionhash = res.versionhash || '';
                this.dirty = false;
                const timestr = new Date().toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'});
                this.setSavedState(`Gespeichert: ${timestr}`);
                if (!silent) {
                    this.setStatus(`Seminarplan erfolgreich gespeichert (${timestr}).`, false);
                } else if (autosave) {
                    this.setStatus(`Automatisch gespeichert (${timestr}).`, false);
                }
                const shouldsyncpublished = this.roterFadenState.ispublished
                    && Number(this.roterFadenState.gridid) === Number(gridid);
                if (shouldsyncpublished) {
                    return this.publishCurrentGrid({silent: true}).then(() => res).catch(() => res);
                }
                return res;
            }).catch((error) => {
                this.dirty = true;
                const conflict = this.parseConflictPayload(error);
                if (conflict) {
                    const daycount = (conflict.days || []).length;
                    const message = daycount > 0
                        ? `Speichern abgelehnt: Zeitkonflikt in ${daycount} Tag(en). Plan wird neu geladen.`
                        : 'Speichern abgelehnt: Zeitkonflikt. Plan wird neu geladen.';
                    this.setStatus(message, true);
                    this.setSavedState('Gespeichert: Konflikt', true);
                    return this.loadGridState({silent: true}).then(() => {
                        this.highlightConflictDays(conflict.days || []);
                        this.setStatus(message, true);
                    });
                }
                Notification.exception(error);
                this.setSavedState('Gespeichert: Fehler', true);
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
                if (document.visibilityState !== 'visible') {
                    return;
                }
                if (this.state.gridid && this.dirty) {
                    this.saveGridState({silent: true, autosave: true});
                }
            }, 20000);
        }

        savePlan() {
            this.refreshLayout();
            this.scheduleAutosave();
        }

        initData() {
            const rememberedgridid = this.readRememberedLoadedGridId();
            Promise.all([this.listGrids(rememberedgridid), this.loadSources(), this.loadRoterFadenState()])
                .then(() => {
                    const hasselected = this.getGridId() > 0;
                    const shouldrestore = rememberedgridid && hasselected && String(this.getGridId()) === String(rememberedgridid);
                    this.toggleStepTwo(false);
                    this.syncPublishControl();
                    if (shouldrestore) {
                        this.toggleStepTwo(true);
                        return this.loadGridState({silent: true}).then(() => {
                            this.setStatus('Seminarplan aus Sitzung automatisch geladen.', false);
                            this.setSavedState('Gespeichert: Wiederhergestellt');
                        });
                    }
                    if (!hasselected) {
                        this.setStatus('Schritt 1: Bitte Seminarplan erstellen oder aus der Liste auswählen.', false);
                    }
                    return null;
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
