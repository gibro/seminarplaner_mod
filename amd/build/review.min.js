define(['core/ajax', 'core/notification'], function(Ajax, Notification) {
    const bySel = (sel) => document.querySelector(sel);
    const asCall = (methodname, args) => Ajax.call([{methodname, args}])[0];
    const escapeHtml = (str) => String(str || '').replace(/[&<>"']/g, (ch) => (
        {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch] || ch
    ));

    let reviewTargets = [];
    let existingCandidates = [];
    let changedMethodsForNewSet = [];
    let newSetSelection = [];
    // D32: Seminarpläne der Aktivität für das Seminarkonzept-Einreichen.
    let konzeptPlans = [];

    // D32: Objektart eines Review-Ziels ('sammlung' | 'seminarkonzept').
    const targetTyp = (set) => String(set && set.typ ? set.typ : 'sammlung');
    const TYP_LABELS = {sammlung: 'Methoden-Sammlung', seminarkonzept: 'Seminarkonzept'};

    const setStatus = (selector, text, isError) => {
        const el = bySel(selector);
        if (!el) {
            return;
        }
        el.textContent = text;
        el.style.color = isError ? '#b91c1c' : '#166534';
    };

    const getSelectedExistingSetId = () => {
        const select = bySel('#kg-review-existing-set-select');
        return Number.parseInt(select ? (select.value || '0') : '0', 10) || 0;
    };

    const normalizeTitle = (title) => String(title || '').trim().toLowerCase();

    const renderExistingCandidates = () => {
        const host = bySel('#kg-review-existing-candidates');
        if (!host) {
            return;
        }
        if (!existingCandidates.length) {
            host.innerHTML = '<div class="kg-ie-item">Keine neuen/geänderten Seminareinheiten für diese Sammlung gefunden.</div>';
            return;
        }
        host.innerHTML = '';
        existingCandidates.forEach((item, idx) => {
            const changed = Array.isArray(item.changedfields) && item.changedfields.length
                ? ` · ${item.changedfields.join(', ')}`
                : '';
            const row = document.createElement('label');
            row.className = 'kg-ie-item';
            row.innerHTML = `
                <input type="checkbox" class="kg-review-existing-check" data-idx="${idx}" ${item.selected ? 'checked' : ''}>
                <span class="kg-ie-title">${item.title}</span>
                <span class="kg-ie-meta">${item.status === 'new' ? 'Neu' : 'Geändert'}${changed}</span>
            `;
            host.appendChild(row);
        });
        host.querySelectorAll('.kg-review-existing-check').forEach((cb) => {
            cb.addEventListener('change', () => {
                const idx = Number.parseInt(cb.getAttribute('data-idx') || '-1', 10);
                if (idx >= 0 && existingCandidates[idx]) {
                    existingCandidates[idx].selected = !!cb.checked;
                }
            });
        });
    };

    const renderNewSetMethods = () => {
        const host = bySel('#kg-review-new-methods');
        if (!host) {
            return;
        }
        if (!changedMethodsForNewSet.length) {
            host.innerHTML = '<div class="kg-ie-item">Keine geänderten/neuen Seminareinheiten gefunden.</div>';
            return;
        }
        host.innerHTML = '';
        changedMethodsForNewSet.forEach((method, idx) => {
            const title = String(method.title || '(ohne Titel)');
            const changed = Array.isArray(method.changedfields) && method.changedfields.length
                ? ` · ${method.changedfields.join(', ')}`
                : '';
            const row = document.createElement('label');
            row.className = 'kg-ie-item';
            row.innerHTML = `
                <input type="checkbox" class="kg-review-new-check" data-idx="${idx}" ${newSetSelection[idx] ? 'checked' : ''}>
                <span class="kg-ie-title">${title}</span>
                <span class="kg-ie-meta">${method.status === 'new' ? 'Neu' : 'Geändert'}${changed}</span>
            `;
            host.appendChild(row);
        });
        host.querySelectorAll('.kg-review-new-check').forEach((cb) => {
            cb.addEventListener('change', () => {
                const idx = Number.parseInt(cb.getAttribute('data-idx') || '-1', 10);
                if (idx >= 0) {
                    newSetSelection[idx] = !!cb.checked;
                }
            });
        });
    };

    // D37: Statusanzeige entlang des Flussdiagramms oben.
    const STATUS_LABELS = {
        draft: {label: 'Entwurf – noch nicht eingereicht', step: 'Schritt 1 steht noch aus', cls: 'draft'},
        review: {label: 'In Prüfung', step: 'Die Konzeptverantwortlichen schauen gerade darüber', cls: 'review'},
        published: {label: 'Für alle da', step: 'Freigegeben – sichtbar in der globalen Bibliothek', cls: 'published'},
        archived: {label: 'Archiviert', step: 'Nicht mehr in der globalen Bibliothek', cls: 'archived'},
    };

    const renderStatusList = () => {
        const host = bySel('#kg-review-status-list');
        if (!host) {
            return;
        }
        if (!reviewTargets.length) {
            host.innerHTML = '<div class="kg-ie-item">Noch keine Methoden-Sammlungen in deinem Bereich – '
                + 'reiche unten deine erste Sammlung ein.</div>';
            return;
        }
        host.innerHTML = reviewTargets.map((set) => {
            const info = STATUS_LABELS[String(set.status)] || {label: String(set.status), step: '', cls: 'draft'};
            const typlabel = TYP_LABELS[targetTyp(set)] || TYP_LABELS.sammlung;
            return `
              <div class="kg-review-status-row">
                <span class="kg-review-status-chip kg-review-status-chip--${info.cls}">${escapeHtml(info.label)}</span>
                <span class="kg-review-status-name">${escapeHtml(set.displayname)}</span>
                <span class="kg-review-status-step">${escapeHtml(typlabel)} · ${escapeHtml(info.step)}
                  · Konzeptverantwortliche: ${Number(set.reviewercount) || 0}</span>
              </div>`;
        }).join('');
    };

    const loadReviewTargets = (cmid) => {
        const select = bySel('#kg-review-existing-set-select');
        if (!select) {
            return Promise.resolve();
        }
        return asCall('mod_seminarplaner_list_review_targets', {cmid}).then((res) => {
            reviewTargets = Array.isArray(res.methodsets) ? res.methodsets : [];
            select.innerHTML = '<option value="0">Bitte wählen</option>';
            // D32: der Diff-Flow vergleicht Seminareinheiten und zielt daher
            // nur auf Methoden-Sammlungen; Seminarkonzepte haben unten ihren
            // eigenen Einreichen-Block.
            reviewTargets.filter((set) => targetTyp(set) === 'sammlung').forEach((set) => {
                const statuslabel = (STATUS_LABELS[String(set.status)] || {label: set.status}).label;
                const opt = document.createElement('option');
                opt.value = String(set.id);
                opt.textContent = `${set.displayname} [${statuslabel}] · Konzeptverantwortliche: ${set.reviewercount || 0}`;
                select.appendChild(opt);
            });
            renderKonzeptTargets();
            renderStatusList();
        });
    };

    // ---- D32: Seminarkonzept einreichen ---------------------------------

    const renderKonzeptTargets = () => {
        const select = bySel('#kg-review-konzept-target');
        if (!select) {
            return;
        }
        const previous = select.value;
        select.innerHTML = '<option value="0">Neues Seminarkonzept</option>';
        reviewTargets.filter((set) => targetTyp(set) === 'seminarkonzept').forEach((set) => {
            const statuslabel = (STATUS_LABELS[String(set.status)] || {label: set.status}).label;
            const opt = document.createElement('option');
            opt.value = String(set.id);
            opt.textContent = `${set.displayname} [${statuslabel}] – neue Version einreichen`;
            select.appendChild(opt);
        });
        if (previous && select.querySelector(`option[value="${previous}"]`)) {
            select.value = previous;
        }
        toggleKonzeptNewFields();
    };

    const toggleKonzeptNewFields = () => {
        const select = bySel('#kg-review-konzept-target');
        const fields = bySel('#kg-review-konzept-newfields');
        if (fields) {
            fields.classList.toggle('kg-hidden', !!(select && Number.parseInt(select.value || '0', 10)));
        }
    };

    const slugify = (text) => String(text || '')
        .toLowerCase()
        .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);

    const prefillKonzeptFields = () => {
        const planselect = bySel('#kg-review-konzept-plan');
        const plan = konzeptPlans.find((p) => String(p.id) === String(planselect ? planselect.value : ''));
        if (!plan) {
            return;
        }
        const displayname = bySel('#kg-review-konzept-displayname');
        if (displayname && !displayname.value.trim()) {
            displayname.value = String(plan.name || '');
        }
        const shortname = bySel('#kg-review-konzept-shortname');
        if (shortname && !shortname.value.trim()) {
            const slug = slugify(plan.name) || 'seminarkonzept';
            shortname.value = `${slug}-${String(Date.now()).slice(-5)}`;
        }
    };

    const loadKonzeptPlans = (cmid) => {
        const select = bySel('#kg-review-konzept-plan');
        if (!select) {
            return Promise.resolve();
        }
        return asCall('mod_seminarplaner_list_grids', {cmid}).then((res) => {
            konzeptPlans = (Array.isArray(res.grids) ? res.grids : []).filter((g) => !Number(g.isarchived));
            select.innerHTML = '<option value="0">Bitte wählen</option>';
            konzeptPlans.forEach((plan) => {
                const opt = document.createElement('option');
                opt.value = String(plan.id);
                opt.textContent = String(plan.name || `Plan ${plan.id}`);
                select.appendChild(opt);
            });
        }).catch(() => {
            konzeptPlans = [];
        });
    };

    const submitKonzept = (cmid) => {
        const gridid = Number.parseInt((bySel('#kg-review-konzept-plan') || {value: '0'}).value || '0', 10) || 0;
        if (!gridid) {
            setStatus('#kg-review-konzept-status', 'Bitte zuerst einen Seminarplan auswählen.', true);
            return;
        }
        const methodsetid = Number.parseInt((bySel('#kg-review-konzept-target') || {value: '0'}).value || '0', 10) || 0;
        const displayname = String((bySel('#kg-review-konzept-displayname') || {}).value || '').trim();
        const shortname = String((bySel('#kg-review-konzept-shortname') || {}).value || '').trim();
        const description = String((bySel('#kg-review-konzept-description') || {}).value || '').trim();
        const changelog = String((bySel('#kg-review-konzept-changelog') || {}).value || '').trim();
        if (!methodsetid && (!displayname || !shortname)) {
            setStatus('#kg-review-konzept-status', 'Bitte Name und Kurzbezeichnung ausfüllen.', true);
            return;
        }
        asCall('mod_seminarplaner_submit_seminarkonzept_for_review', {
            cmid,
            gridid,
            methodsetid,
            shortname,
            displayname,
            description,
            changelog
        }).then((res) => {
            setStatus('#kg-review-konzept-status',
                `Seminarkonzept „${res.planname}" eingereicht (Version #${res.versionid}, `
                + `${res.savedcount} Seminareinheiten enthalten).`,
                false
            );
            return loadReviewTargets(cmid);
        }).catch((e) => {
            Notification.exception(e);
            setStatus('#kg-review-konzept-status', 'Einreichen des Seminarkonzepts fehlgeschlagen.', true);
        });
    };

    const loadChangedMethodsForNewSet = (cmid) => {
        if (!reviewTargets.length) {
            changedMethodsForNewSet = [];
            newSetSelection = [];
            renderNewSetMethods();
            setStatus('#kg-review-new-status', 'Keine globalen Methoden-Sammlungen als Vergleich verfügbar.', true);
            return Promise.resolve();
        }

        const calls = reviewTargets.map((set) =>
            asCall('mod_seminarplaner_get_review_method_candidates', {cmid, methodsetid: Number(set.id)})
                .then((res) => Array.isArray(res.candidates) ? res.candidates : [])
                .catch(() => [])
        );

        return Promise.all(calls).then((allCandidateLists) => {
            const byMethodId = {};
            allCandidateLists.forEach((candidates) => {
                candidates.forEach((row) => {
                    const methodid = String(row.methodid || '').trim();
                    const title = String(row.title || '').trim();
                    if (!methodid || !title) {
                        return;
                    }
                    if (!byMethodId[methodid]) {
                        byMethodId[methodid] = {
                            methodid,
                            title,
                            status: String(row.status || 'changed'),
                            changedfields: Array.isArray(row.changedfields) ? Array.from(row.changedfields) : []
                        };
                        return;
                    }
                    if (String(row.status || '') === 'new') {
                        byMethodId[methodid].status = 'new';
                    }
                    const mergedFields = (byMethodId[methodid].changedfields || [])
                        .concat(Array.isArray(row.changedfields) ? row.changedfields : []);
                    byMethodId[methodid].changedfields = Array.from(new Set(mergedFields));
                });
            });

            changedMethodsForNewSet = Object.values(byMethodId);
            newSetSelection = changedMethodsForNewSet.map(() => true);
            renderNewSetMethods();
            setStatus('#kg-review-new-status',
                `${changedMethodsForNewSet.length} geänderte/neue Seminareinheiten für eine neue Methoden-Sammlung verfügbar.`,
                false
            );
        });
    };

    const loadExistingCandidates = (cmid) => {
        const methodsetid = getSelectedExistingSetId();
        if (!methodsetid) {
            existingCandidates = [];
            renderExistingCandidates();
            setStatus('#kg-review-existing-status', 'Bitte zuerst eine Methoden-Sammlung wählen.', true);
            return Promise.resolve();
        }
        return asCall('mod_seminarplaner_get_review_method_candidates', {cmid, methodsetid}).then((res) => {
            const rows = Array.isArray(res.candidates) ? res.candidates : [];
            existingCandidates = rows.map((row) => Object.assign({}, row, {selected: false}));
            renderExistingCandidates();
            setStatus('#kg-review-existing-status', `${existingCandidates.length} neue/geänderte Seminareinheiten gefunden.`, false);
        }).catch((e) => {
            existingCandidates = [];
            renderExistingCandidates();
            setStatus('#kg-review-existing-status', 'Diff konnte nicht geladen werden.', true);
            throw e;
        });
    };

    const submitExistingSelection = (cmid) => {
        const methodsetid = getSelectedExistingSetId();
        if (!methodsetid) {
            setStatus('#kg-review-existing-status', 'Bitte eine bestehende Methoden-Sammlung auswählen.', true);
            return;
        }
        const selected = existingCandidates.filter((c) => c.selected)
            .map((c) => String(c.methodid || '').trim())
            .filter(Boolean);
        if (!selected.length) {
            setStatus('#kg-review-existing-status', 'Bitte mindestens eine Seminareinheit auswählen.', true);
            return;
        }
        const changelog = String((bySel('#kg-review-existing-changelog') || {}).value || '').trim();
        asCall('mod_seminarplaner_submit_methodset_for_review', {
            cmid,
            methodsetid,
            changelog,
            methodids: selected
        }).then((res) => {
            setStatus('#kg-review-existing-status',
                `Erfolgreich eingereicht (Sammlung #${res.methodsetid}, Version #${res.versionid}, ${res.savedcount} Seminareinheiten in der Sammlung).`,
                false
            );
            return loadExistingCandidates(cmid);
        }).catch((e) => {
            Notification.exception(e);
            setStatus('#kg-review-existing-status', 'Einreichen fehlgeschlagen.', true);
        });
    };

    const submitNewSet = (cmid) => {
        const shortname = String((bySel('#kg-review-new-shortname') || {}).value || '').trim();
        const displayname = String((bySel('#kg-review-new-displayname') || {}).value || '').trim();
        const description = String((bySel('#kg-review-new-description') || {}).value || '').trim();
        const changelog = String((bySel('#kg-review-new-changelog') || {}).value || '').trim();
        if (!shortname || !displayname) {
            setStatus('#kg-review-new-status', 'Bitte Name und Kurzbezeichnung ausfüllen.', true);
            return;
        }
        const selectedids = changedMethodsForNewSet
            .map((method, idx) => ({id: String(method.methodid || ''), selected: !!newSetSelection[idx]}))
            .filter((item) => item.selected && item.id)
            .map((item) => item.id);
        if (!selectedids.length) {
            setStatus('#kg-review-new-status', 'Bitte mindestens eine Seminareinheit auswählen.', true);
            return;
        }

        asCall('mod_seminarplaner_create_methodset_for_review', {
            cmid,
            shortname,
            displayname,
            description,
            changelog,
            methodids: selectedids
        }).then((res) => {
            setStatus('#kg-review-new-status',
                `Methoden-Sammlung eingereicht (Sammlung #${res.methodsetid}, Version #${res.versionid}, ${res.savedcount} Seminareinheiten).`,
                false
            );
            return loadReviewTargets(cmid).then(() => loadChangedMethodsForNewSet(cmid));
        }).catch((e) => {
            Notification.exception(e);
            setStatus('#kg-review-new-status', 'Einreichen der Methoden-Sammlung fehlgeschlagen.', true);
        });
    };

    const bind = (cmid) => {
        const setselect = bySel('#kg-review-existing-set-select');
        const refreshExisting = bySel('#kg-review-existing-refresh');
        const submitExisting = bySel('#kg-review-existing-submit');
        const selectAllExisting = bySel('#kg-review-existing-select-all');
        const selectNoneExisting = bySel('#kg-review-existing-select-none');
        const submitNew = bySel('#kg-review-new-submit');
        const selectAllNew = bySel('#kg-review-new-select-all');
        const selectNoneNew = bySel('#kg-review-new-select-none');

        if (setselect) {
            setselect.addEventListener('change', () => {
                loadExistingCandidates(cmid).catch(Notification.exception);
            });
        }
        if (refreshExisting) {
            refreshExisting.addEventListener('click', () => {
                loadExistingCandidates(cmid).catch(Notification.exception);
            });
        }
        if (submitExisting) {
            submitExisting.addEventListener('click', () => submitExistingSelection(cmid));
        }
        if (selectAllExisting) {
            selectAllExisting.addEventListener('click', () => {
                existingCandidates.forEach((c) => {
                    c.selected = true;
                });
                renderExistingCandidates();
            });
        }
        if (selectNoneExisting) {
            selectNoneExisting.addEventListener('click', () => {
                existingCandidates.forEach((c) => {
                    c.selected = false;
                });
                renderExistingCandidates();
            });
        }
        if (submitNew) {
            submitNew.addEventListener('click', () => submitNewSet(cmid));
        }
        if (selectAllNew) {
            selectAllNew.addEventListener('click', () => {
                newSetSelection = changedMethodsForNewSet.map(() => true);
                renderNewSetMethods();
            });
        }
        if (selectNoneNew) {
            selectNoneNew.addEventListener('click', () => {
                newSetSelection = changedMethodsForNewSet.map(() => false);
                renderNewSetMethods();
            });
        }

        // D32: Seminarkonzept-Block.
        const konzeptplan = bySel('#kg-review-konzept-plan');
        if (konzeptplan) {
            konzeptplan.addEventListener('change', prefillKonzeptFields);
        }
        const konzepttarget = bySel('#kg-review-konzept-target');
        if (konzepttarget) {
            konzepttarget.addEventListener('change', toggleKonzeptNewFields);
        }
        const konzeptsubmit = bySel('#kg-review-konzept-submit');
        if (konzeptsubmit) {
            konzeptsubmit.addEventListener('click', () => submitKonzept(cmid));
        }
    };

    return {
        init: function(cmid) {
            Promise.all([
                loadReviewTargets(cmid),
                loadKonzeptPlans(cmid)
            ]).then(() => loadChangedMethodsForNewSet(cmid)).then(() => {
                bind(cmid);
                renderExistingCandidates();
                renderNewSetMethods();
            }).catch((e) => {
                Notification.exception(e);
                setStatus('#kg-review-existing-status', 'Review-Seite konnte nicht initialisiert werden.', true);
            });
        }
    };
});
