define(['core/ajax', 'core/notification'], function(Ajax, Notification) {
    const DAYS_ALL = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
    const MORNING_START_MIN = 8 * 60;
    const AFTERNOON_START_MIN = (12 * 60) + 30;
    const AFTERNOON_END_MIN = 18 * 60;
    const DEFAULT_AXIS_THEME = 'modern'; // 'modern' | 'clean'
    const THEME_STORAGE_KEY = 'kg_roterfaden_axis_theme';

    const bySel = (sel) => document.querySelector(sel);
    const asCall = (methodname, args) => Ajax.call([{methodname, args}])[0];

    const parseTimeToMinutes = (value) => {
        if (!value) {
            return 0;
        }
        const parts = String(value).split(':');
        const hh = Number.parseInt(parts[0], 10);
        const mm = Number.parseInt(parts[1], 10);
        if (!Number.isFinite(hh) || !Number.isFinite(mm)) {
            return 0;
        }
        return (hh * 60) + mm;
    };
    const minutesToLabel = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
    const getTodayDayName = () => {
        const jsDay = new Date().getDay();
        const mondayBased = (jsDay + 6) % 7;
        return DAYS_ALL[mondayBased] || 'Montag';
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
    const decodeHtmlEntities = (value) => {
        const textarea = document.createElement('textarea');
        textarea.innerHTML = String(value || '');
        return String(textarea.value || '');
    };
    const getMoodleRoot = () => {
        if (typeof window === 'undefined' || !window.M || !window.M.cfg || !window.M.cfg.wwwroot) {
            return '';
        }
        return String(window.M.cfg.wwwroot).replace(/\/+$/, '');
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

    class RoterFadenView {
        constructor(cmid) {
            this.cmid = cmid;
            this.status = bySel('#kg-roterfaden-status');
            this.list = bySel('#kg-roterfaden-list');
            this.empty = bySel('#kg-roterfaden-empty');
            this.themeSelect = bySel('#kg-roterfaden-theme');
            this.planningState = {units: []};
            this.lastEntries = [];
            this.emptyMessage = '';
            this.axisTheme = DEFAULT_AXIS_THEME;
            this.iconBaseUrl = `${getMoodleRoot()}/mod/seminarplaner/pix/lucide`;
            if (typeof window !== 'undefined' && window.localStorage) {
                const stored = String(window.localStorage.getItem(THEME_STORAGE_KEY) || '').toLowerCase().trim();
                if (stored === 'clean' || stored === 'modern') {
                    this.axisTheme = stored;
                }
            }
            if (typeof window !== 'undefined' && window.KG_ROTERFADEN_AXIS_THEME) {
                const requested = String(window.KG_ROTERFADEN_AXIS_THEME || '').toLowerCase().trim();
                if (requested === 'clean' || requested === 'modern') {
                    this.axisTheme = requested;
                }
            }
            if (!this.list || !this.empty) {
                return;
            }
            this.bindThemeControl();
            this.init();
        }

        renderIcon(name, extraClass = '') {
            if (!name || !this.iconBaseUrl) {
                return '';
            }
            const classes = `kg-roterfaden-icon${extraClass ? ` ${extraClass}` : ''}`;
            return `<img class="${classes}" src="${this.iconBaseUrl}/${name}.svg" alt="" aria-hidden="true" loading="lazy" decoding="async">`;
        }

        setStatus(text, isError = false) {
            if (!this.status) {
                return;
            }
            this.status.textContent = text || '';
            this.status.style.color = isError ? '#b91c1c' : '#166534';
        }

        parsePlanningState(raw) {
            const units = Array.isArray((raw || {}).units) ? raw.units : [];
            return {
                units: units.map((unit) => ({
                    id: String(unit.id || ''),
                    slotkey: String(unit.slotkey || '').trim(),
                    title: String(unit.title || 'Baustein').trim(),
                    topics: String(unit.topics || ''),
                    active: unit.active !== false
                }))
            };
        }

        getActiveUnit(entry) {
            const slotkey = String(entry.slotkey || '').trim();
            if (slotkey) {
                const variants = this.planningState.units.filter((unit) => String(unit.slotkey || '').trim() === slotkey);
                if (variants.length) {
                    return variants.find((unit) => unit.active) || variants[0];
                }
            }
            const unitid = String(entry.unitid || '');
            if (unitid) {
                return this.planningState.units.find((unit) => String(unit.id) === unitid) || null;
            }
            return null;
        }

        normalizeEntries(state) {
            const plan = (state || {}).plan || {};
            const plandays = plan.days || {};
            const days = Array.isArray(((state || {}).config || {}).days) && state.config.days.length
                ? state.config.days
                : DAYS_ALL;
            const dayorder = {};
            days.forEach((day, idx) => {
                dayorder[String(day)] = idx;
            });

            const entries = [];
            days.forEach((day) => {
                const list = Array.isArray(plandays[day]) ? plandays[day] : [];
                list.forEach((entry) => {
                    if (!entry || entry.kind === 'break') {
                        return;
                    }
                    const startMin = Number(entry.startMin || 0);
                    const normalizedStart = Number.isFinite(startMin) ? startMin : 0;
                    const period = normalizedStart >= AFTERNOON_START_MIN ? 'afternoon' : 'morning';
                    const base = {
                        day: String(day),
                        startMin: normalizedStart,
                        period: period
                    };
                    if (entry.kind === 'unit') {
                        const unit = this.getActiveUnit(entry);
                        entries.push(Object.assign(base, {
                            kind: 'unit',
                            title: String((unit && unit.title) || entry.title || 'Baustein'),
                            topicsHtml: formatRichText((unit && unit.topics) || '')
                        }));
                        return;
                    }
                    if (entry.kind === 'method') {
                        entries.push(Object.assign(base, {
                            kind: 'method',
                            title: String(entry.title || 'Seminareinheit'),
                            topicsHtml: ''
                        }));
                    }
                });
            });

            entries.sort((a, b) => {
                const daydiff = (dayorder[a.day] ?? 999) - (dayorder[b.day] ?? 999);
                if (daydiff !== 0) {
                    return daydiff;
                }
                return a.startMin - b.startMin;
            });

            return entries;
        }

        groupEntries(entries) {
            const grouped = {};
            entries.forEach((entry) => {
                if (!grouped[entry.day]) {
                    grouped[entry.day] = {morning: [], afternoon: []};
                }
                if (entry.period === 'afternoon') {
                    grouped[entry.day].afternoon.push(entry);
                } else {
                    grouped[entry.day].morning.push(entry);
                }
            });
            return grouped;
        }

        renderPeriodBlock(period, title, entries) {
            const periodicon = period === 'afternoon'
                ? this.renderIcon('sunset', 'kg-roterfaden-icon--period')
                : this.renderIcon('sun', 'kg-roterfaden-icon--period');
            const itemsHtml = entries.map((entry) => {
                const isUnit = entry.kind === 'unit';
                const timeLabel = minutesToLabel(entry.startMin);
                const topics = isUnit && entry.topicsHtml ? entry.topicsHtml : '';
                const contentHtml = isUnit
                    ? `<details class="kg-roterfaden-topics-toggle">
                        <summary>${this.renderIcon('list-checks', 'kg-roterfaden-icon--inline')}<span>Themen</span></summary>
                        <div class="kg-roterfaden-topics">${topics || '<p class="sp-filter-status">Keine Themen hinterlegt.</p>'}</div>
                    </details>`
                    : `<div class="kg-roterfaden-method-note">Start: ${escapeHtml(timeLabel)} Uhr</div>`;
                return `
                    <article class="kg-roterfaden-entry">
                        <div class="kg-roterfaden-entry-header">
                            <h5 class="kg-roterfaden-title">${escapeHtml(entry.title)}</h5>
                        </div>
                        <div class="kg-roterfaden-entry-content">
                            <div class="kg-roterfaden-meta">${this.renderIcon('clock-3', 'kg-roterfaden-icon--meta')}<span>Uhrzeit: ${escapeHtml(timeLabel)}</span></div>
                            ${contentHtml}
                        </div>
                    </article>
                `;
            }).join('');

            return `
                <section class="kg-roterfaden-period">
                    <h4 class="kg-roterfaden-period-title">${periodicon}<span>${escapeHtml(title)}</span></h4>
                    <div class="kg-roterfaden-period-list">${itemsHtml}</div>
                </section>
            `;
        }

        render(entries, emptymessage) {
            this.lastEntries = Array.isArray(entries) ? entries : [];
            if (!entries.length) {
                this.list.innerHTML = '';
                this.empty.textContent = emptymessage;
                this.empty.classList.remove('kg-hidden');
                return;
            }

            this.empty.classList.add('kg-hidden');
            this.empty.textContent = '';
            const grouped = this.groupEntries(entries);
            const todayName = getTodayDayName();
            const orderedDays = Object.keys(grouped).sort((a, b) => DAYS_ALL.indexOf(a) - DAYS_ALL.indexOf(b));
            const mobileRows = [];

            orderedDays.forEach((day) => {
                const morning = grouped[day].morning.filter((entry) => entry.startMin >= MORNING_START_MIN
                    && entry.startMin < AFTERNOON_START_MIN);
                const afternoon = grouped[day].afternoon.filter((entry) => entry.startMin >= AFTERNOON_START_MIN
                    && entry.startMin <= AFTERNOON_END_MIN);
                const isToday = String(day) === String(todayName);
                const periodBlocks = [];
                if (morning.length) {
                    periodBlocks.push(this.renderPeriodBlock('morning', 'Vormittag', morning));
                }
                if (afternoon.length) {
                    periodBlocks.push(this.renderPeriodBlock('afternoon', 'Nachmittag', afternoon));
                }
                if (!periodBlocks.length) {
                    return;
                }
                const isCompact = periodBlocks.length === 1;
                mobileRows.push(`
                    <section class="kg-roterfaden-mobile-row${isToday ? ' is-today' : ''}">
                        <div class="kg-roterfaden-mobile-marker" aria-hidden="true">
                            <span class="kg-roterfaden-node-dot"></span>
                        </div>
                        <div class="kg-roterfaden-mobile-content">
                            <div class="kg-roterfaden-mobile-day">${this.renderIcon('calendar-days', 'kg-roterfaden-icon--day')}<span>${escapeHtml(day)}</span>${isToday ? ' <span class="kg-roterfaden-today">heute</span>' : ''}</div>
                            <div class="kg-roterfaden-mobile-card${isToday ? ' is-today' : ''}">
                                <div class="kg-roterfaden-node-content">
                                    <div class="kg-roterfaden-period-columns${isCompact ? ' kg-roterfaden-period-columns--single' : ''}">
                                        ${periodBlocks.join('')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                `);
            });

            this.list.innerHTML = `
                <div class="kg-roterfaden-timeline-wrap kg-roterfaden-theme-${this.axisTheme}">
                    <div class="kg-roterfaden-timeline-mobile" style="display:grid;gap:18px;padding:6px 0 4px;">
                        ${mobileRows.join('')}
                    </div>
                </div>
            `;
        }

        scrollToToday() {
            if (!this.list) {
                return;
            }
            const run = () => {
                const todayRow = this.list.querySelector('.kg-roterfaden-mobile-row.is-today');
                if (todayRow && typeof todayRow.scrollIntoView === 'function') {
                    todayRow.scrollIntoView({behavior: 'smooth', block: 'center', inline: 'nearest'});
                }
            };

            if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
                window.requestAnimationFrame(() => window.requestAnimationFrame(run));
                return;
            }
            setTimeout(run, 0);
        }

        bindThemeControl() {
            if (!this.themeSelect) {
                return;
            }
            this.themeSelect.value = this.axisTheme;
            this.themeSelect.addEventListener('change', () => {
                const nextTheme = String(this.themeSelect.value || '').toLowerCase().trim();
                if (nextTheme !== 'clean' && nextTheme !== 'modern') {
                    return;
                }
                this.axisTheme = nextTheme;
                if (typeof window !== 'undefined' && window.localStorage) {
                    window.localStorage.setItem(THEME_STORAGE_KEY, this.axisTheme);
                }
                this.render(this.lastEntries || [], this.emptyMessage || '');
            });
        }

        init() {
            const emptymessage = this.empty.getAttribute('data-empty-message') || '';
            this.emptyMessage = emptymessage;
            asCall('mod_seminarplaner_get_roterfaden_state', {cmid: this.cmid}).then((roterfaden) => {
                let publishedstate = {};
                try {
                    publishedstate = roterfaden.statejson ? JSON.parse(roterfaden.statejson) : {};
                } catch (e) {
                    publishedstate = {};
                }
                this.planningState = this.parsePlanningState(publishedstate);

                if (!roterfaden.ispublished) {
                    this.render([], emptymessage);
                    return;
                }
                const entries = this.normalizeEntries(publishedstate);
                this.render(entries, emptymessage);
                this.scrollToToday();
                this.setStatus(`Roter Faden geladen (${entries.length} Einträge).`, false);
            }).catch((error) => {
                Notification.exception(error);
                this.render([], emptymessage);
                this.setStatus('Roter Faden konnte nicht geladen werden.', true);
            });
        }
    }

    return {
        init: function(cmid) {
            return new RoterFadenView(cmid);
        }
    };
});
