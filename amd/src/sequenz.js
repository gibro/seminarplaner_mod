// This file is part of Moodle - http://moodle.org/

/**
 * Sequence view (D3/D10/D11/D20) – read-only foundation.
 *
 * Renders the migrated sequence section of a plan: one day at a time,
 * morning/afternoon anchors with a time budget bar, the midday break as
 * a named divider, module (Baustein) groupings with automatic
 * continuation detection and phase colour coding.
 *
 * @module mod_seminarplaner/sequenz
 */
define(['core/ajax'], function(Ajax) {
    const DEFAULT_BOUNDARY_MIN = 750; // 12:30 fallback, same rule as the PHP converter.

    const bySel = (sel) => document.querySelector(sel);
    const asCall = (methodname, args) => Ajax.call([{methodname, args}])[0];

    const escapeHtml = (str) => String(str || '').replace(/[&<>"']/g, (ch) => {
        return ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[ch] || ch;
    });

    const parseTimeToMinutes = (value) => {
        const parts = String(value || '').split(':');
        const hh = Number.parseInt(parts[0], 10);
        const mm = Number.parseInt(parts[1], 10);
        if (!Number.isFinite(hh) || !Number.isFinite(mm)) {
            return null;
        }
        return hh * 60 + mm;
    };

    const minutesToLabel = (min) => {
        const clean = Math.max(0, Math.round(min));
        return `${String(Math.floor(clean / 60)).padStart(2, '0')}:${String(clean % 60).padStart(2, '0')}`;
    };

    const PHASE_KEYS = [
        {key: 'orientierung', match: ['orientierung', 'warm-up', 'einstieg']},
        {key: 'erfahrung', match: ['erfahrung', 'erwartungsabfrage', 'vorwissen']},
        {key: 'analyse', match: ['analyse']},
        {key: 'handlung', match: ['handlung', 'aktion', 'praxis']},
        {key: 'transfer', match: ['transfer', 'abschluss', 'auswertung']},
    ];

    const phaseKey = (phase) => {
        const clean = String(phase || '').trim().toLowerCase();
        if (!clean) {
            return '';
        }
        const found = PHASE_KEYS.find((candidate) => candidate.match.some((m) => clean.includes(m)));
        return found ? found.key : '';
    };

    class SequenzView {
        constructor(cmid) {
            this.cmid = cmid;
            this.state = null;
            this.sequenz = null;
            this.dayIndex = 0;
            this.legacyByUid = {};
        }

        init() {
            const prev = bySel('#sq-prev-day');
            const next = bySel('#sq-next-day');
            if (prev) {
                prev.addEventListener('click', () => this.stepDay(-1));
            }
            if (next) {
                next.addEventListener('click', () => this.stepDay(1));
            }
            const select = bySel('#sq-grid-select');
            if (select) {
                select.addEventListener('change', () => {
                    const gridid = Number.parseInt(select.value, 10);
                    if (Number.isFinite(gridid) && gridid > 0) {
                        this.loadState(gridid);
                    }
                });
            }
            this.loadGrids();
        }

        setStatus(text, isError = false) {
            const el = bySel('#sq-status');
            if (el) {
                el.textContent = text;
                el.style.color = isError ? '#b91c1c' : '#166534';
            }
        }

        loadGrids() {
            asCall('mod_seminarplaner_list_grids', {cmid: this.cmid}).then((res) => {
                const grids = (res.grids || []).filter((grid) => !Number(grid.isarchived));
                const select = bySel('#sq-grid-select');
                if (!select) {
                    return;
                }
                select.innerHTML = grids.map((grid) =>
                    `<option value="${Number(grid.id)}">${escapeHtml(grid.name)}</option>`).join('');
                if (!grids.length) {
                    this.setStatus('Noch kein Seminarplan vorhanden – lege zuerst im Überblick einen an.');
                    return;
                }
                this.loadState(Number(grids[0].id));
            }).catch(() => {
                this.setStatus('Seminarpläne konnten nicht geladen werden.', true);
            });
        }

        loadState(gridid) {
            asCall('mod_seminarplaner_get_user_state', {cmid: this.cmid, gridid}).then((res) => {
                let state = {};
                try {
                    state = JSON.parse(String(res.statejson || '{}')) || {};
                } catch (e) {
                    state = {};
                }
                this.state = state;
                this.sequenz = (state && typeof state.sequenz === 'object') ? state.sequenz : null;
                this.dayIndex = 0;
                this.indexLegacyEntries();
                this.render();
            }).catch(() => {
                this.setStatus('Der Seminarplan konnte nicht geladen werden.', true);
            });
        }

        // Phase and details still live on the legacy grid entries; the
        // placements reference them via quelle.uids (see datenmodell-sequenz.md).
        indexLegacyEntries() {
            this.legacyByUid = {};
            const days = (this.state && this.state.plan && this.state.plan.days) || {};
            Object.keys(days).forEach((day) => {
                (Array.isArray(days[day]) ? days[day] : []).forEach((entry) => {
                    if (entry && entry.uid) {
                        this.legacyByUid[String(entry.uid)] = entry;
                    }
                });
            });
        }

        stepDay(delta) {
            const total = this.dayCount();
            if (!total) {
                return;
            }
            this.dayIndex = (this.dayIndex + delta + total) % total;
            this.render();
        }

        dayCount() {
            return this.sequenz && Array.isArray(this.sequenz.tage) ? this.sequenz.tage.length : 0;
        }

        middayWindow(dayname) {
            const config = (this.state && this.state.config) || {};
            let best = null;
            (Array.isArray(config.breaks) ? config.breaks : []).forEach((brk) => {
                if (!brk || typeof brk !== 'object') {
                    return;
                }
                const applies = (Array.isArray(brk.days) ? brk.days : []).map(String);
                if (!applies.includes('all') && !applies.includes(String(dayname))) {
                    return;
                }
                const start = parseTimeToMinutes(brk.start);
                if (start === null) {
                    return;
                }
                const candidate = {start, end: start + Math.max(0, Number(brk.duration) || 0)};
                if (!best || Math.abs(start - DEFAULT_BOUNDARY_MIN) < Math.abs(best.start - DEFAULT_BOUNDARY_MIN)) {
                    best = candidate;
                }
            });
            return best || {start: DEFAULT_BOUNDARY_MIN, end: DEFAULT_BOUNDARY_MIN};
        }

        dayFrame(dayname) {
            const config = (this.state && this.state.config) || {};
            const range = config.timeRange || {};
            const start = parseTimeToMinutes(range.start);
            const end = parseTimeToMinutes(range.end);
            const midday = this.middayWindow(dayname);
            return {
                start: start === null ? 510 : start,
                end: end === null ? 1050 : end,
                midday,
            };
        }

        placement(pid) {
            const all = (this.sequenz && this.sequenz.platzierungen) || {};
            return all[pid] || null;
        }

        baustein(bid) {
            const all = (this.sequenz && this.sequenz.bausteine) || {};
            return bid ? (all[bid] || null) : null;
        }

        placementPhase(placement) {
            const uids = (placement && placement.quelle && Array.isArray(placement.quelle.uids))
                ? placement.quelle.uids : [];
            for (const uid of uids) {
                const entry = this.legacyByUid[String(uid)];
                if (entry && entry.phase) {
                    return phaseKey(entry.phase);
                }
            }
            return '';
        }

        render() {
            const container = bySel('#sq-day');
            const label = bySel('#sq-day-label');
            if (!container) {
                return;
            }
            if (!this.sequenz || !this.dayCount()) {
                container.innerHTML = '';
                if (label) {
                    label.textContent = '—';
                }
                this.setStatus('Für diesen Seminarplan gibt es noch keine Sequenzdaten.');
                return;
            }

            const day = this.sequenz.tage[this.dayIndex];
            if (label) {
                label.textContent = `Tag ${Number(day.tag) || this.dayIndex + 1} · ${day.bezeichnung || ''}`;
            }
            this.setStatus('');

            const seenBausteine = this.bausteineSeenBeforeCurrentDay();
            const frame = this.dayFrame(day.bezeichnung);
            const morning = this.renderAnchor(day, 'vormittag', frame, seenBausteine);
            const divider = `
                <div class="sq-break-divider"><span>🕐 Mittagspause</span></div>`;
            const afternoon = this.renderAnchor(day, 'nachmittag', frame, seenBausteine);
            container.innerHTML = morning + divider + afternoon;
        }

        // Module ids already shown on earlier days (continuation across days, D20).
        bausteineSeenBeforeCurrentDay() {
            const seen = {};
            for (let i = 0; i < this.dayIndex; i++) {
                const day = this.sequenz.tage[i];
                ['vormittag', 'nachmittag'].forEach((ankername) => {
                    const seq = (((day.anker || {})[ankername] || {}).sequenz) || [];
                    seq.forEach((pid) => {
                        const placement = this.placement(pid);
                        if (placement && placement.bausteinid) {
                            seen[String(placement.bausteinid)] = true;
                        }
                    });
                });
            }
            return seen;
        }

        renderAnchor(day, ankername, frame, seenBausteine) {
            const seq = (((day.anker || {})[ankername] || {}).sequenz) || [];
            const isMorning = ankername === 'vormittag';
            const anchorStart = isMorning ? frame.start : Math.max(frame.midday.end, frame.start);
            const anchorEnd = isMorning ? Math.min(frame.midday.start, frame.end) : frame.end;
            const budget = Math.max(0, anchorEnd - anchorStart);

            const placements = seq.map((pid) => ({pid, data: this.placement(pid)})).filter((p) => p.data);
            const used = placements.reduce((sum, p) => sum + Math.max(0, Number(p.data.dauer) || 0), 0);
            const over = used - budget;
            const fillpct = budget > 0 ? Math.min(100, Math.round((used / budget) * 100)) : (used > 0 ? 100 : 0);

            const title = isMorning ? 'Vormittag' : 'Nachmittag';
            const timespan = `${minutesToLabel(anchorStart)}–${minutesToLabel(anchorEnd)}`;
            const budgetlabel = over > 0
                ? `+${over} Min. über ${isMorning ? 'der Mittagspause' : 'dem Tagesende'}`
                : `${used} von ${budget} Min. belegt`;

            let body = this.renderSequence(placements, anchorStart, seenBausteine);
            if (!placements.length) {
                body = '<div class="sq-empty">Noch keine Einheiten in diesem Abschnitt.</div>';
            }

            const overrun = over > 0
                ? `<div class="sq-overrun"><strong>+${over} Min. über ${isMorning ? 'der Mittagspause' : 'dem Tagesende'}.</strong>
                     Kürzen oder in den nächsten Abschnitt verschieben.</div>`
                : '';

            return `
                <div class="sq-anchor" data-anker="${ankername}">
                  <div class="sq-anchor__head">
                    <div class="sq-anchor__title">${title} <span class="sq-anchor__time">${timespan}</span></div>
                    <div class="sq-budget">
                      <div class="sq-budget__bar"><div class="sq-budget__fill${over > 0 ? ' sq-budget__fill--over' : ''}" style="width:${fillpct}%"></div></div>
                      <div class="sq-budget__label">${escapeHtml(budgetlabel)}</div>
                    </div>
                  </div>
                  <div class="sq-anchor__body">${body}${overrun}</div>
                </div>`;
        }

        renderSequence(placements, anchorStart, seenBausteine) {
            // Group directly consecutive placements of the same module.
            const groups = [];
            placements.forEach((p) => {
                const bid = p.data.typ === 'einheit' ? (p.data.bausteinid || null) : null;
                const previous = groups.length ? groups[groups.length - 1] : null;
                if (previous && bid && previous.bausteinid === bid) {
                    previous.items.push(p);
                    return;
                }
                groups.push({bausteinid: bid, items: [p]});
            });

            let clock = anchorStart;
            const html = groups.map((group) => {
                const start = clock;
                const duration = group.items.reduce((sum, p) => sum + Math.max(0, Number(p.data.dauer) || 0), 0);
                clock += duration;

                if (!group.bausteinid) {
                    return group.items.map((p, index) => {
                        const itemstart = start + group.items.slice(0, index)
                            .reduce((sum, prev) => sum + Math.max(0, Number(prev.data.dauer) || 0), 0);
                        return this.renderPlacement(p, itemstart);
                    }).join('');
                }

                const baustein = this.baustein(group.bausteinid) || {};
                const continuation = seenBausteine[group.bausteinid] === true;
                seenBausteine[group.bausteinid] = true;
                const unfilled = group.items.every((p) => this.isUnfilled(p.data));
                const units = group.items.map((p, index) => {
                    const itemstart = start + group.items.slice(0, index)
                        .reduce((sum, prev) => sum + Math.max(0, Number(prev.data.dauer) || 0), 0);
                    return this.renderPlacement(p, itemstart, true);
                }).join('');

                return `
                    <div class="sq-baustein${unfilled ? ' sq-baustein--empty' : ''}">
                      <div class="sq-baustein__head">
                        <div class="sq-baustein__title">${escapeHtml(baustein.titel || 'Baustein')}
                          ${continuation ? '<span class="sq-badge sq-badge--variant">Fortsetzung</span>' : ''}
                          <span class="sq-badge">${unfilled ? `${duration} Min. reserviert` : `${duration} Min.`}</span>
                        </div>
                      </div>
                      ${unfilled ? '' : `<div class="sq-baustein__units">${units}</div>`}
                    </div>`;
            }).join('');

            return html;
        }

        isUnfilled(placement) {
            if (placement.typ !== 'einheit') {
                return false;
            }
            const auswahl = ((this.sequenz && this.sequenz.einheitenauswahlen) || {})[placement.einheitenauswahl];
            return !auswahl || !Array.isArray(auswahl.kandidaten) || !auswahl.kandidaten.length;
        }

        renderPlacement(p, startMin, inBaustein = false) {
            const data = p.data;
            const duration = Math.max(0, Number(data.dauer) || 0);
            const timelabel = `${minutesToLabel(startMin)}–${minutesToLabel(startMin + duration)}`;

            if (data.typ === 'pause') {
                return `
                    <div class="sq-pause">
                      <span class="sq-pause__label">${escapeHtml(data.titel || 'Pause')}</span>
                      <span class="sq-badge">${duration} Min.</span>
                      <span class="sq-unit__time">${timelabel}</span>
                    </div>`;
            }

            const phase = this.placementPhase(data);
            const legacy = this.legacyEntryFor(data);
            const phasetext = legacy && legacy.phase ? String(legacy.phase) : '';

            return `
                <div class="sq-unit${inBaustein ? '' : ' sq-unit--standalone'}">
                  <div class="sq-unit__phase${phase ? ' sq-phase-bg--' + phase : ''}"></div>
                  <div class="sq-unit__main">
                    <div class="sq-unit__title">${escapeHtml(data.titel || 'Seminareinheit')}</div>
                    <div class="sq-unit__meta">
                      <span class="sq-badge">${duration} Min.</span>
                      ${phasetext ? `<span class="sq-badge">${escapeHtml(phasetext)}</span>` : ''}
                      <span class="sq-unit__time">${timelabel}</span>
                    </div>
                  </div>
                </div>`;
        }

        legacyEntryFor(placement) {
            const uids = (placement && placement.quelle && Array.isArray(placement.quelle.uids))
                ? placement.quelle.uids : [];
            for (const uid of uids) {
                const entry = this.legacyByUid[String(uid)];
                if (entry) {
                    return entry;
                }
            }
            return null;
        }
    }

    return {
        init: function(cmid) {
            new SequenzView(Number(cmid)).init();
        },
    };
});
