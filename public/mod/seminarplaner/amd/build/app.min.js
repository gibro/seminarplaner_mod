define(['core/ajax', 'core/notification'], function(Ajax, Notification) {
    const DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

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
        materialien: '#kg-f-materialien',
        materialtechnik: '#kg-f-materialtechnik',
        ablauf: '#kg-f-ablauf',
        tags: '#kg-f-tags',
        kognitive: '#kg-f-kognitive'
    };

    let state = {
        methods: [],
        entries: [],
        config: {
            start: '08:30',
            end: '17:30',
            step: 15
        },
        sourceMode: 'methods'
    };

    let planningState = {units: [], slotorder: []};
    let currentHash = '';

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

    const getGridId = () => {
        const el = bySel('#kg-grid-select');
        return el && el.value ? parseInt(el.value, 10) : 0;
    };

    const parseTimeToMinutes = (time) => {
        if (!time || !String(time).includes(':')) {
            return 0;
        }
        const parts = String(time).split(':').map((p) => parseInt(p, 10));
        return parts[0] * 60 + parts[1];
    };

    const minutesToTime = (minutes) => {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const splitMulti = (value) => {
        if (Array.isArray(value)) {
            return value.map((v) => String(v || '').trim()).filter(Boolean);
        }
        return String(value || '').split(/##|,|;|\r?\n/).map((v) => v.trim()).filter(Boolean);
    };

    const UNIT_COLORS = ['#1d4ed8', '#0f766e', '#b45309', '#7c3aed', '#be123c', '#0369a1', '#166534'];

    const colorForUnit = (unitid) => {
        const str = String(unitid || '');
        let sum = 0;
        for (let i = 0; i < str.length; i++) {
            sum += str.charCodeAt(i) * (i + 1);
        }
        return UNIT_COLORS[sum % UNIT_COLORS.length];
    };

    const hexToRgba = (hex, alpha) => {
        const clean = String(hex || '').replace('#', '');
        if (clean.length !== 6) {
            return `rgba(29,78,216,${alpha})`;
        }
        const r = parseInt(clean.slice(0, 2), 16);
        const g = parseInt(clean.slice(2, 4), 16);
        const b = parseInt(clean.slice(4, 6), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    };

    const dayIndex = (day) => DAYS.indexOf(day);

    const absoluteMinutes = (day, minute) => {
        const idx = dayIndex(day);
        if (idx < 0) {
            return -1;
        }
        const dayStart = parseTimeToMinutes(state.config.start);
        const dayEnd = parseTimeToMinutes(state.config.end);
        const dayLength = Math.max(1, dayEnd - dayStart);
        return (idx * dayLength) + (minute - dayStart);
    };

    const getBreaksByDay = () => {
        const map = {};
        state.entries.forEach((entry) => {
            const isBreak = entry && (entry.type === 'break' || entry.kind === 'break');
            if (!isBreak) {
                return;
            }
            const day = String(entry.day || '').trim();
            const start = parseTimeToMinutes(entry.start);
            const duration = Math.max(0, Number(entry.duration || 0));
            if (!day || !Number.isFinite(start) || duration <= 0) {
                return;
            }
            if (!map[day]) {
                map[day] = [];
            }
            map[day].push({start, end: start + duration});
        });
        Object.keys(map).forEach((day) => {
            map[day].sort((a, b) => a.start - b.start);
        });
        return map;
    };

    const moveToNextFreeMinute = (dayidx, minute, breaksByDay) => {
        const dayStart = parseTimeToMinutes(state.config.start);
        const dayEnd = parseTimeToMinutes(state.config.end);
        let idx = dayidx;
        let min = minute;

        while (idx < DAYS.length) {
            if (min < dayStart) {
                min = dayStart;
            }
            if (min >= dayEnd) {
                idx += 1;
                min = dayStart;
                continue;
            }
            const day = DAYS[idx];
            const breaks = breaksByDay[day] || [];
            const hit = breaks.find((br) => min >= br.start && min < br.end);
            if (!hit) {
                return {dayidx: idx, minute: min};
            }
            min = hit.end;
        }
        return {dayidx: DAYS.length - 1, minute: dayEnd};
    };

    const allocateDuration = (startDay, startTime, totalDuration) => {
        const breaksByDay = getBreaksByDay();
        const dayStart = parseTimeToMinutes(state.config.start);
        const dayEnd = parseTimeToMinutes(state.config.end);
        const segments = [];
        let remaining = Math.max(0, Number(totalDuration || 0));
        let dayidx = dayIndex(startDay);
        if (dayidx < 0) {
            dayidx = 0;
        }
        let current = parseTimeToMinutes(startTime);
        if (!Number.isFinite(current)) {
            current = dayStart;
        }

        const firstFree = moveToNextFreeMinute(dayidx, current, breaksByDay);
        dayidx = firstFree.dayidx;
        current = firstFree.minute;

        while (remaining > 0 && dayidx < DAYS.length) {
            const free = moveToNextFreeMinute(dayidx, current, breaksByDay);
            dayidx = free.dayidx;
            current = free.minute;
            if (dayidx >= DAYS.length) {
                break;
            }
            if (current >= dayEnd) {
                dayidx += 1;
                current = dayStart;
                continue;
            }

            const day = DAYS[dayidx];
            const breaks = breaksByDay[day] || [];
            let nextStop = dayEnd;
            const nextBreak = breaks.find((br) => br.start > current);
            if (nextBreak) {
                nextStop = Math.min(nextStop, nextBreak.start);
            }

            const chunk = Math.min(remaining, Math.max(0, nextStop - current));
            if (chunk <= 0) {
                current = nextStop;
                continue;
            }
            segments.push({
                day,
                start: minutesToTime(current),
                startMin: current,
                duration: chunk,
                endMin: current + chunk
            });
            remaining -= chunk;
            current += chunk;

            if (current >= dayEnd) {
                dayidx += 1;
                current = dayStart;
            }
        }

        let endday = startDay;
        let endtime = startTime;
        if (segments.length) {
            const last = segments[segments.length - 1];
            endday = last.day;
            endtime = minutesToTime(last.endMin);
        }
        return {segments, endday, endtime};
    };

    const calcUnitWindow = (entry) => {
        const alloc = allocateDuration(entry.day, entry.start, entry.duration);
        const firstSegment = alloc.segments.length ? alloc.segments[0] : null;
        return {
            startday: firstSegment ? firstSegment.day : entry.day,
            starttime: firstSegment ? firstSegment.start : entry.start,
            endday: alloc.endday,
            endtime: alloc.endtime
        };
    };

    const buildUnitBands = () => {
        const byUnit = {};

        state.entries.forEach((entry) => {
            if (entry.type === 'unit') {
                const unit = getUnitById(entry.unitid);
                if (!unit) {
                    return;
                }
                const window = calcUnitWindow(entry);
                byUnit[String(entry.unitid)] = {
                    unitid: String(entry.unitid),
                    label: String(unit.title || 'Baustein'),
                    color: colorForUnit(entry.unitid),
                    absStart: absoluteMinutes(window.startday, parseTimeToMinutes(window.starttime)),
                    absEnd: absoluteMinutes(window.endday, parseTimeToMinutes(window.endtime))
                };
            }
        });

        const methodRanges = {};
        state.entries.forEach((entry) => {
            if (entry.type !== 'method' || !entry.parentunit) {
                return;
            }
            const methodStart = parseTimeToMinutes(entry.start);
            const methodEnd = methodStart + Number(entry.duration || 0);
            const absStart = absoluteMinutes(entry.day, methodStart);
            const absEnd = absoluteMinutes(entry.day, methodEnd);
            if (absStart < 0 || absEnd < 0) {
                return;
            }
            const key = String(entry.parentunit);
            if (!methodRanges[key]) {
                methodRanges[key] = {min: absStart, max: absEnd};
            } else {
                methodRanges[key].min = Math.min(methodRanges[key].min, absStart);
                methodRanges[key].max = Math.max(methodRanges[key].max, absEnd);
            }
        });

        Object.keys(methodRanges).forEach((unitid) => {
            if (byUnit[unitid]) {
                return;
            }
            const unit = getUnitById(unitid);
            byUnit[unitid] = {
                unitid,
                label: unit ? String(unit.title || 'Baustein') : 'Baustein',
                color: colorForUnit(unitid),
                absStart: methodRanges[unitid].min,
                absEnd: methodRanges[unitid].max
            };
        });

        return Object.values(byUnit).filter((band) => Number.isFinite(band.absStart) && Number.isFinite(band.absEnd));
    };

    const getBandForSlot = (bands, day, minute, step) => {
        const slotStart = absoluteMinutes(day, minute);
        const slotEnd = absoluteMinutes(day, minute + step);
        if (slotStart < 0 || slotEnd < 0) {
            return null;
        }
        const band = bands.find((candidate) => candidate.absStart < slotEnd && candidate.absEnd > slotStart);
        if (!band) {
            return null;
        }
        const dayStart = parseTimeToMinutes(state.config.start);
        const dayEnd = parseTimeToMinutes(state.config.end);
        const dayStartAbs = absoluteMinutes(day, dayStart);
        const dayEndAbs = absoluteMinutes(day, dayEnd);
        const isFirstSlotOfDay = minute === dayStart;
        const isLastSlotOfDay = minute >= (dayEnd - step);

        return {
            band,
            isStart: band.absStart >= slotStart && band.absStart < slotEnd,
            isEnd: band.absEnd > slotStart && band.absEnd <= slotEnd,
            startsHereForDay: isFirstSlotOfDay && band.absStart < slotStart,
            continuesFromPrevDay: isFirstSlotOfDay && band.absStart < dayStartAbs && band.absEnd > dayStartAbs,
            continuesToNextDay: isLastSlotOfDay && band.absEnd > dayEndAbs && band.absStart < dayEndAbs
        };
    };

    const readMultiSelect = (selector) => {
        const el = bySel(selector);
        if (!el) {
            return [];
        }
        return Array.from(el.selectedOptions).map((opt) => opt.value);
    };

    const readFiles = (selector) => {
        const el = bySel(selector);
        if (!el || !el.files) {
            return [];
        }
        return Array.from(el.files).map((f) => f.name);
    };

    const clearForm = () => {
        Object.keys(FIELDS).forEach((key) => {
            const el = bySel(FIELDS[key]);
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
            if (el.type === 'file') {
                el.value = '';
                return;
            }
            el.value = '';
        });
    };

    const buildMethodFromForm = () => {
        const title = (bySel(FIELDS.titel)?.value || '').trim();
        if (!title) {
            return null;
        }
        return {
            id: uid(),
            titel: title,
            seminarphase: readMultiSelect(FIELDS.seminarphase),
            zeitbedarf: (bySel(FIELDS.zeitbedarf)?.value || '').trim(),
            gruppengroesse: (bySel(FIELDS.gruppengroesse)?.value || '').trim(),
            kurzbeschreibung: (bySel(FIELDS.kurzbeschreibung)?.value || '').trim(),
            autor: (bySel(FIELDS.autor)?.value || '').trim(),
            lernziele: (bySel(FIELDS.lernziele)?.value || '').trim(),
            komplexitaet: (bySel(FIELDS.komplexitaet)?.value || '').trim(),
            vorbereitung: (bySel(FIELDS.vorbereitung)?.value || '').trim(),
            raum: readMultiSelect(FIELDS.raum),
            sozialform: readMultiSelect(FIELDS.sozialform),
            risiken: (bySel(FIELDS.risiken)?.value || '').trim(),
            debrief: (bySel(FIELDS.debrief)?.value || '').trim(),
            materialien: readFiles(FIELDS.materialien),
            materialtechnik: (bySel(FIELDS.materialtechnik)?.value || '').trim(),
            ablauf: (bySel(FIELDS.ablauf)?.value || '').trim(),
            tags: (bySel(FIELDS.tags)?.value || '').trim(),
            kognitive: readMultiSelect(FIELDS.kognitive),
            alternativen: []
        };
    };

    const normalizeMethods = () => {
        const order = [];
        const byid = new Map();
        state.methods.forEach((method) => {
            const normalized = Object.assign({}, method);
            const id = String(normalized.id || '').trim();
            if (!id) {
                return;
            }
            normalized.id = id;
            const rawalternatives = normalized.alternativen;
            const values = Array.isArray(rawalternatives)
                ? rawalternatives
                : (typeof rawalternatives === 'string' ? rawalternatives.split(/##|[\r\n,;]+/u) : []);
            normalized.alternativen = values.map((value) => String(value || '').trim()).filter(Boolean);
            byid.set(id, normalized);
            order.push(id);
        });

        const links = new Map();
        order.forEach((id) => links.set(id, new Set()));
        order.forEach((id) => {
            const method = byid.get(id);
            method.alternativen.forEach((altid) => {
                if (!altid || altid === id || !byid.has(altid)) {
                    return;
                }
                links.get(id).add(altid);
                links.get(altid).add(id);
            });
        });

        state.methods = order.map((id) => {
            const method = byid.get(id);
            method.alternativen = order.filter((otherid) => otherid !== id && links.get(id).has(otherid));
            return method;
        });
    };

    const normalizePlanningState = (raw) => {
        const units = Array.isArray(raw.units) ? raw.units : [];
        const slotorder = Array.isArray(raw.slotorder) ? raw.slotorder.map((s) => String(s || '')) : [];
        const normalizedunits = units.map((unit) => ({
                id: String(unit.id || uid()),
                title: String(unit.title || 'Ohne Titel').trim(),
                duration: Math.max(5, Number.parseInt(unit.duration, 10) || 90),
                slotkey: String(unit.slotkey || '').trim(),
                active: unit.active !== false,
                methods: Array.isArray(unit.methods) ? unit.methods.map((entry) => ({
                    id: String(entry.id || uid()),
                    methodid: String(entry.methodid || '')
                })).filter((entry) => entry.methodid) : []
            }));
        const grouped = {};
        normalizedunits.forEach((unit) => {
            const key = String(unit.slotkey || '').trim();
            if (!key) {
                return;
            }
            if (!grouped[key]) {
                grouped[key] = [];
            }
            grouped[key].push(unit);
        });
        Object.keys(grouped).forEach((key) => {
            if (grouped[key].length < 2) {
                grouped[key].forEach((unit) => {
                    unit.slotkey = '';
                });
            }
        });
        return {
            units: normalizedunits,
            slotorder
        };
    };

    const getMethodById = (methodid) => state.methods.find((m) => String(m.id) === String(methodid)) || null;

    const getPlanningSlotKey = (unit) => (unit.slotkey ? `group:${unit.slotkey}` : `unit:${unit.id}`);

    const getPlanningSlots = () => {
        const grouped = {};
        planningState.units.forEach((unit) => {
            const key = getPlanningSlotKey(unit);
            if (!grouped[key]) {
                grouped[key] = [];
            }
            grouped[key].push(unit);
        });
        const order = planningState.slotorder.filter((key) => !!grouped[key]);
        Object.keys(grouped).forEach((key) => {
            if (!order.includes(key)) {
                order.push(key);
            }
        });
        planningState.slotorder = order;
        return order.map((key) => {
            const units = grouped[key];
            let active = units.find((u) => u.active);
            if (!active) {
                active = units[0];
                active.active = true;
            }
            return {key, units, active};
        });
    };

    const getPlanningSlot = (slotkey) => getPlanningSlots().find((slot) => slot.key === slotkey) || null;

    const getUnitById = (unitid) => planningState.units.find((u) => String(u.id) === String(unitid)) || null;

    const updateStateJson = () => {
        const textarea = bySel('#kg-state-json');
        if (textarea) {
            textarea.value = JSON.stringify(state, null, 2);
        }
    };

    const renderSourceCards = () => {
        const sidebar = bySel('#kg-methods');
        if (!sidebar) {
            return;
        }
        sidebar.innerHTML = '';

        if (state.sourceMode === 'units') {
            const slots = getPlanningSlots();
            if (!slots.length) {
                sidebar.innerHTML = '<p class="sp-filter-status">Keine Bausteine vorhanden. Im Bereich Bausteine anlegen.</p>';
                return;
            }
            slots.forEach((slot) => {
                const active = slot.active;
                if (!active) {
                    return;
                }
                const card = document.createElement('div');
                card.className = 'sp-card';
                card.draggable = true;
                card.innerHTML = `
                    <div class="sp-card-compact">
                        <div class="sp-card-title"><strong>${active.title}</strong></div>
                        <div class="sp-card-meta">
                            <span class="sp-badge">⏱️ ${active.duration} Min</span>
                            <span class="sp-badge">🧩 ${active.methods.length} Seminareinheiten</span>
                            ${slot.units.length > 1 ? '<span class="sp-badge">Alternative</span>' : ''}
                        </div>
                    </div>
                `;
                card.addEventListener('dragstart', (event) => {
                    event.dataTransfer.setData('text/plain', JSON.stringify({
                        type: 'unit',
                        slotkey: slot.key,
                        unitid: active.id,
                        duration: active.duration
                    }));
                    event.dataTransfer.effectAllowed = 'copy';
                });
                sidebar.appendChild(card);
            });
            return;
        }

        normalizeMethods();
        state.methods.forEach((method) => {
            const card = document.createElement('div');
            card.className = 'sp-card';
            card.draggable = true;
            card.dataset.methodId = method.id;
            card.innerHTML = `
              <div class="sp-card-compact">
                <div class="sp-card-title"><strong>${method.titel || '(ohne Titel)'}</strong></div>
                <div class="sp-card-meta">
                  <span class="sp-badge">⏱️ ${method.zeitbedarf || '-'}</span>
                  <span class="sp-badge">👥 ${method.gruppengroesse || '-'}</span>
                  <span class="sp-badge">🤝 ${(method.sozialform || []).join(', ') || '-'}</span>
                </div>
                <div class="sp-card-description">${method.kurzbeschreibung || ''}</div>
              </div>
            `;
            card.addEventListener('dragstart', (event) => {
                event.dataTransfer.setData('text/plain', JSON.stringify({type: 'method', methodid: method.id}));
                event.dataTransfer.effectAllowed = 'copy';
            });
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'sp-remove';
            removeBtn.textContent = '✕';
            removeBtn.addEventListener('click', () => {
                state.methods = state.methods.filter((m) => String(m.id) !== String(method.id));
                state.entries = state.entries.filter((entry) => String(entry.methodid) !== String(method.id));
                renderAll();
            });
            card.appendChild(removeBtn);
            sidebar.appendChild(card);
        });
    };

    const addMethodEntryAt = (methodid, day, startTime) => {
        const method = getMethodById(methodid);
        if (!method) {
            return;
        }
        const duration = parseInt(method.zeitbedarf, 10) || (parseInt(state.config.step, 10) || 15);
        const flowid = uid();
        const alloc = allocateDuration(day, startTime, duration);
        alloc.segments.forEach((segment) => {
            state.entries.push({
                id: uid(),
                type: 'method',
                methodid: String(method.id),
                day: segment.day,
                start: segment.start,
                duration: segment.duration,
                flowid
            });
        });
    };

    const addUnitEntryAt = (slotkey, unitid, day, startTime) => {
        const slot = getPlanningSlot(slotkey);
        const unit = getUnitById(unitid);
        if (!slot || !unit) {
            return;
        }
        const alloc = allocateDuration(day, startTime, Number(unit.duration || 90));
        const unitStart = alloc.segments.length ? alloc.segments[0] : {day, start: startTime};
        state.entries.push({
            id: uid(),
            type: 'unit',
            slotkey,
            unitid: String(unit.id),
            day: unitStart.day,
            start: unitStart.start,
            duration: Number(unit.duration || 90)
        });
    };

    const resolveUnitToMethods = (entry) => {
        const unit = getUnitById(entry.unitid);
        if (!unit) {
            return;
        }
        let pointerDay = entry.day;
        let pointerTime = entry.start;

        unit.methods.forEach((methodentry) => {
            const method = getMethodById(methodentry.methodid);
            if (!method) {
                return;
            }
            const remaining = parseInt(method.zeitbedarf, 10) || (parseInt(state.config.step, 10) || 15);
            const flowid = uid();
            const alloc = allocateDuration(pointerDay, pointerTime, remaining);
            alloc.segments.forEach((segment) => {
                state.entries.push({
                    id: uid(),
                    type: 'method',
                    methodid: String(method.id),
                    day: segment.day,
                    start: segment.start,
                    duration: segment.duration,
                    parentunit: String(unit.id),
                    flowid
                });
            });
            pointerDay = alloc.endday;
            pointerTime = alloc.endtime;
        });
        state.entries = state.entries.filter((it) => String(it.id) !== String(entry.id));
    };

    const getMethodAlternativeIds = (method) => {
        const ids = [String(method.id)].concat(Array.isArray(method.alternativen) ? method.alternativen.map((id) => String(id)) : []);
        const unique = [];
        ids.forEach((id) => {
            if (!unique.includes(id) && getMethodById(id)) {
                unique.push(id);
            }
        });
        return unique;
    };

    const renderGrid = () => {
        const grid = bySel('#kg-grid');
        if (!grid) {
            return;
        }

        const start = parseTimeToMinutes(state.config.start);
        const end = parseTimeToMinutes(state.config.end);
        const step = parseInt(state.config.step, 10) || 15;
        const unitBands = buildUnitBands();

        grid.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'sp-grid-head';
        header.innerHTML = '<div class="sp-time-col"></div>' + DAYS.map((d) => `<div class="sp-day-head">${d}</div>`).join('');
        grid.appendChild(header);

        for (let t = start; t <= end; t += step) {
            const row = document.createElement('div');
            row.className = 'sp-grid-row';

            const timeCol = document.createElement('div');
            timeCol.className = 'sp-time-col';
            timeCol.textContent = minutesToTime(t);
            row.appendChild(timeCol);

            DAYS.forEach((day) => {
                const slot = document.createElement('div');
                slot.className = 'sp-slot';
                slot.dataset.day = day;
                slot.dataset.start = minutesToTime(t);

                const bandState = getBandForSlot(unitBands, day, t, step);
                if (bandState) {
                    const {band, isStart, isEnd, startsHereForDay, continuesFromPrevDay, continuesToNextDay} = bandState;
                    slot.classList.add('sp-slot--unitband');
                    if (isStart) {
                        slot.classList.add('sp-slot--unitband-start');
                    }
                    if (isEnd) {
                        slot.classList.add('sp-slot--unitband-end');
                    }
                    if (continuesFromPrevDay) {
                        slot.classList.add('sp-slot--unitband-continue-start');
                    }
                    if (continuesToNextDay) {
                        slot.classList.add('sp-slot--unitband-continue-end');
                    }
                    slot.style.setProperty('--kg-band-color', band.color);
                    slot.style.setProperty('--kg-band-bg', hexToRgba(band.color, 0.10));
                    if (isStart || startsHereForDay) {
                        const label = document.createElement('div');
                        label.className = 'sp-unit-band-label';
                        label.textContent = band.label;
                        slot.appendChild(label);
                    }
                    if (continuesFromPrevDay) {
                        const marker = document.createElement('div');
                        marker.className = 'sp-unit-band-marker sp-unit-band-marker--start';
                        const dayidx = dayIndex(day);
                        const prevday = dayidx > 0 ? DAYS[dayidx - 1] : 'Vortag';
                        marker.textContent = `Fortsetzung von ${prevday}`;
                        slot.appendChild(marker);
                    }
                    if (continuesToNextDay) {
                        const marker = document.createElement('div');
                        marker.className = 'sp-unit-band-marker sp-unit-band-marker--end';
                        const dayidx = dayIndex(day);
                        const nextday = dayidx >= 0 && dayidx < DAYS.length - 1 ? DAYS[dayidx + 1] : 'Folgetag';
                        marker.textContent = `Weiter an ${nextday}`;
                        slot.appendChild(marker);
                    }
                }

                slot.addEventListener('dragover', (event) => {
                    event.preventDefault();
                    slot.classList.add('sp-slot--over');
                });
                slot.addEventListener('dragleave', () => slot.classList.remove('sp-slot--over'));
                slot.addEventListener('drop', (event) => {
                    event.preventDefault();
                    slot.classList.remove('sp-slot--over');
                    let payload = null;
                    try {
                        payload = JSON.parse(event.dataTransfer.getData('text/plain') || '{}');
                    } catch (e) {
                        payload = null;
                    }
                    if (!payload) {
                        return;
                    }
                    const startTime = minutesToTime(t);
                    if (payload.type === 'method') {
                        addMethodEntryAt(payload.methodid, day, startTime);
                    }
                    if (payload.type === 'unit') {
                        addUnitEntryAt(payload.slotkey, payload.unitid, day, startTime);
                    }
                    if (payload.type === 'entry') {
                        state.entries = state.entries.map((entry) => {
                            if (entry.id !== payload.entryid) {
                                return entry;
                            }
                            return Object.assign({}, entry, {day, start: startTime});
                        });
                    }
                    renderAll();
                });

                const entries = state.entries.filter((entry) => entry.day === day && entry.start === minutesToTime(t));
                entries.forEach((entry) => {
                    const chip = document.createElement('div');
                    chip.className = 'sp-entry';
                    chip.draggable = true;
                    chip.addEventListener('dragstart', (event) => {
                        event.dataTransfer.setData('text/plain', JSON.stringify({type: 'entry', entryid: entry.id}));
                        event.dataTransfer.effectAllowed = 'move';
                    });

                    if (entry.type === 'unit') {
                        chip.classList.add('sp-entry--unit');
                        const unit = getUnitById(entry.unitid);
                        const slotDef = getPlanningSlot(entry.slotkey);
                        const unitcolor = colorForUnit(entry.unitid);
                        const window = calcUnitWindow(entry);
                        const optionHtml = slotDef && slotDef.units.length > 1
                            ? `<select class="kg-input" data-act="unit-alt" data-entry="${entry.id}">${slotDef.units.map((unitOption) => `<option value="${unitOption.id}" ${String(unitOption.id) === String(entry.unitid) ? 'selected' : ''}>${unitOption.title}</option>`).join('')}</select>`
                            : '';
                        chip.style.borderLeft = `4px solid ${unitcolor}`;
                        chip.innerHTML = `
                            <span><strong>${unit ? unit.title : '(Baustein fehlt)'}</strong> (${entry.duration} Min)</span>
                            <small>${window.startday} ${window.starttime} -> ${window.endday} ${window.endtime}</small>
                            <div class="kg-row">${optionHtml}<button type="button" class="kg-btn" data-act="resolve-unit" data-entry="${entry.id}">Auflösen</button></div>
                        `;
                    } else {
                        const method = getMethodById(entry.methodid);
                        const alternatives = method ? getMethodAlternativeIds(method) : [];
                        const optionHtml = alternatives.length > 1
                            ? `<select class="kg-input" data-act="method-alt" data-entry="${entry.id}">${alternatives.map((id) => {
                                const alt = getMethodById(id);
                                return alt ? `<option value="${id}" ${String(id) === String(entry.methodid) ? 'selected' : ''}>${alt.titel || id}</option>` : '';
                            }).join('')}</select>`
                            : '';
                        let parentBadge = '';
                        if (entry.parentunit) {
                            const parentunit = getUnitById(entry.parentunit);
                            const unitcolor = colorForUnit(entry.parentunit);
                            chip.classList.add('sp-entry--unit-method');
                            chip.style.borderLeft = `4px solid ${unitcolor}`;
                            parentBadge = `<small class="sp-entry-unitlabel" style="color:${unitcolor}">${parentunit ? parentunit.title : 'Baustein'}</small>`;
                        }
                        chip.innerHTML = `<span>${method ? method.titel : '(Seminareinheit fehlt)'} (${entry.duration} Min)</span>${parentBadge}${optionHtml}`;
                    }

                    const remove = document.createElement('button');
                    remove.type = 'button';
                    remove.textContent = '✕';
                    remove.className = 'sp-remove-mini';
                    remove.addEventListener('click', () => {
                        if (entry.flowid) {
                            state.entries = state.entries.filter((e) => String(e.flowid || '') !== String(entry.flowid));
                        } else {
                            state.entries = state.entries.filter((e) => e.id !== entry.id);
                        }
                        renderAll();
                    });
                    chip.appendChild(remove);

                    slot.appendChild(chip);
                });

                row.appendChild(slot);
            });

            grid.appendChild(row);
        }

        bySel('#kg-grid')?.querySelectorAll('[data-act="method-alt"]').forEach((select) => {
            select.addEventListener('change', () => {
                state.entries = state.entries.map((entry) => {
                    const targetid = String(select.getAttribute('data-entry'));
                    const target = state.entries.find((e) => String(e.id) === targetid);
                    const sameflow = target && target.flowid ? String(target.flowid) : '';
                    const apply = String(entry.id) === targetid || (sameflow && String(entry.flowid || '') === sameflow);
                    if (!apply) {
                        return entry;
                    }
                    return Object.assign({}, entry, {methodid: String(select.value)});
                });
                renderAll();
            });
        });
        bySel('#kg-grid')?.querySelectorAll('[data-act="unit-alt"]').forEach((select) => {
            select.addEventListener('change', () => {
                state.entries = state.entries.map((entry) => {
                    if (String(entry.id) !== String(select.getAttribute('data-entry'))) {
                        return entry;
                    }
                    const unit = getUnitById(select.value);
                    return Object.assign({}, entry, {
                        unitid: String(select.value),
                        duration: unit ? Number(unit.duration || entry.duration || 90) : Number(entry.duration || 90)
                    });
                });
                renderAll();
            });
        });
        bySel('#kg-grid')?.querySelectorAll('[data-act="resolve-unit"]').forEach((button) => {
            button.addEventListener('click', () => {
                const entry = state.entries.find((e) => String(e.id) === String(button.getAttribute('data-entry')));
                if (!entry) {
                    return;
                }
                resolveUnitToMethods(entry);
                renderAll();
            });
        });
    };

    const renderAll = () => {
        renderSourceCards();
        renderGrid();
        updateStateJson();
    };

    const listGrids = (cmid) => {
        return asCall('mod_seminarplaner_list_grids', {cmid}).then((res) => {
            const select = bySel('#kg-grid-select');
            const prev = select ? select.value : '';
            if (select) {
                select.innerHTML = '';
                (res.grids || []).forEach((grid) => {
                    const option = document.createElement('option');
                    option.value = String(grid.id);
                    option.textContent = `${grid.name} (#${grid.id})`;
                    select.appendChild(option);
                });
                if (prev && Array.from(select.options).some((o) => o.value === prev)) {
                    select.value = prev;
                }
            }
            setStatus(`Seminarpläne geladen: ${(res.grids || []).length}`, false);
            return res;
        });
    };

    const loadPlanningSources = (cmid) => {
        return Promise.all([
            asCall('mod_seminarplaner_get_method_cards', {cmid}),
            asCall('mod_seminarplaner_get_planning_state', {cmid})
        ]).then(([methodsres, planningres]) => {
            let methods = [];
            let planning = {};
            try {
                methods = methodsres.methodsjson ? JSON.parse(methodsres.methodsjson) : [];
            } catch (e) {
                methods = [];
            }
            try {
                planning = planningres.statejson ? JSON.parse(planningres.statejson) : {};
            } catch (e) {
                planning = {};
            }
            state.methods = Array.isArray(methods) ? methods : [];
            normalizeMethods();
            planningState = normalizePlanningState(planning);
        });
    };

    const loadState = (cmid) => {
        const gridid = getGridId();
        if (!gridid) {
            state.entries = [];
            state.config = {start: '08:30', end: '17:30', step: 15};
            currentHash = '';
            renderAll();
            return Promise.resolve();
        }

        return asCall('mod_seminarplaner_get_user_state', {cmid, gridid}).then((res) => {
            let loaded = {};
            try {
                loaded = res.statejson ? JSON.parse(res.statejson) : {};
            } catch (e) {
                loaded = {};
            }
            state.entries = Array.isArray(loaded.entries) ? loaded.entries : [];
            state.config = loaded.config || {start: '08:30', end: '17:30', step: 15};
            if (loaded.sourceMode === 'units' || loaded.sourceMode === 'methods') {
                state.sourceMode = loaded.sourceMode;
            }
            currentHash = res.versionhash || '';

            const modeSel = bySel('#kg-source-mode');
            if (modeSel) {
                modeSel.value = state.sourceMode;
            }
            bySel('#kg-range-start').value = state.config.start || '08:30';
            bySel('#kg-range-end').value = state.config.end || '17:30';
            bySel('#kg-range-step').value = String(state.config.step || 15);

            renderAll();
            setStatus('Seminarplan geladen.', false);
        }).catch((e) => {
            Notification.exception(e);
            setStatus('Seminarplan konnte nicht geladen werden.', true);
        });
    };

    const saveState = (cmid) => {
        const gridid = getGridId();
        if (!gridid) {
            setStatus('Bitte zuerst einen Seminarplan auswählen.', true);
            return;
        }
        const payload = {
            entries: state.entries,
            config: state.config,
            sourceMode: state.sourceMode
        };

        asCall('mod_seminarplaner_save_user_state', {
            cmid,
            gridid,
            statejson: JSON.stringify(payload),
            expectedhash: currentHash || ''
        }).then((res) => {
            currentHash = res.versionhash || '';
            setStatus('Gespeichert.', false);
        }).catch((e) => {
            Notification.exception(e);
            setStatus('Speichern fehlgeschlagen.', true);
        });
    };

    const bindEvents = (cmid) => {
        bySel('#kg-create-grid')?.addEventListener('click', () => {
            const name = (bySel('#kg-grid-name')?.value || '').trim();
            if (!name) {
                setStatus('Bitte Seminarplan-Name eingeben.', true);
                return;
            }
            asCall('mod_seminarplaner_create_grid', {cmid, name, description: ''}).then(() => {
                bySel('#kg-grid-name').value = '';
                return listGrids(cmid);
            }).then(() => {
                const select = bySel('#kg-grid-select');
                if (select && select.options.length) {
                    select.selectedIndex = select.options.length - 1;
                }
                return loadState(cmid);
            }).catch((e) => {
                Notification.exception(e);
                setStatus('Seminarplan konnte nicht erstellt werden.', true);
            });
        });

        bySel('#kg-refresh-grids')?.addEventListener('click', () => listGrids(cmid));
        bySel('#kg-load-grid')?.addEventListener('click', () => loadState(cmid));
        bySel('#kg-save-state')?.addEventListener('click', () => saveState(cmid));
        bySel('#kg-grid-select')?.addEventListener('change', () => loadState(cmid));

        bySel('#kg-add-method')?.addEventListener('click', () => {
            const method = buildMethodFromForm();
            if (!method) {
                setStatus('Titel ist Pflichtfeld.', true);
                return;
            }
            state.methods.push(method);
            normalizeMethods();
            asCall('mod_seminarplaner_save_method_cards', {
                cmid,
                methodsjson: JSON.stringify(state.methods)
            }).then(() => {
                clearForm();
                renderAll();
                setStatus('Seminareinheit hinzugefügt. Ziehe sie in den Seminarplan.', false);
            }).catch((e) => {
                Notification.exception(e);
                setStatus('Seminareinheit konnte nicht gespeichert werden.', true);
            });
        });

        bySel('#kg-clear-form')?.addEventListener('click', clearForm);

        bySel('#kg-source-mode')?.addEventListener('change', (event) => {
            state.sourceMode = String(event.target.value || 'methods');
            renderSourceCards();
        });

        bySel('#kg-refresh-sources')?.addEventListener('click', () => {
            loadPlanningSources(cmid).then(() => {
                renderSourceCards();
                setStatus('Seminareinheiten und Bausteine aktualisiert.', false);
            }).catch((e) => {
                Notification.exception(e);
                setStatus('Quellen konnten nicht aktualisiert werden.', true);
            });
        });

        bySel('#kg-apply-grid')?.addEventListener('click', () => {
            state.config.start = bySel('#kg-range-start')?.value || '08:30';
            state.config.end = bySel('#kg-range-end')?.value || '17:30';
            state.config.step = parseInt(bySel('#kg-range-step')?.value || '15', 10) || 15;
            renderGrid();
            updateStateJson();
        });
    };

    return {
        init: function(cmid) {
            bindEvents(cmid);
            Promise.all([listGrids(cmid), loadPlanningSources(cmid)]).then(() => {
                return loadState(cmid);
            }).then(() => {
                renderAll();
            }).catch((e) => {
                Notification.exception(e);
            });
        }
    };
});
