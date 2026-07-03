define(['core/ajax', 'core/notification'], function(Ajax, Notification) {
    const bySel = (sel) => document.querySelector(sel);
    const asCall = (methodname, args) => Ajax.call([{methodname, args}])[0];

    let reviewTargets = [];
    let existingCandidates = [];
    let changedMethodsForNewSet = [];
    let newSetSelection = [];

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
            host.innerHTML = '<div class="kg-ie-item">Keine neuen/geänderten Seminareinheiten für dieses Konzept gefunden.</div>';
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

    const loadReviewTargets = (cmid) => {
        const select = bySel('#kg-review-existing-set-select');
        if (!select) {
            return Promise.resolve();
        }
        return asCall('mod_seminarplaner_list_review_targets', {cmid}).then((res) => {
            reviewTargets = Array.isArray(res.methodsets) ? res.methodsets : [];
            select.innerHTML = '<option value="0">Bitte wählen</option>';
            reviewTargets.forEach((set) => {
                const opt = document.createElement('option');
                opt.value = String(set.id);
                opt.textContent = `${set.displayname} [${set.status}] · Konzeptverantwortliche: ${set.reviewercount || 0}`;
                select.appendChild(opt);
            });
        });
    };

    const loadChangedMethodsForNewSet = (cmid) => {
        if (!reviewTargets.length) {
            changedMethodsForNewSet = [];
            newSetSelection = [];
            renderNewSetMethods();
            setStatus('#kg-review-new-status', 'Keine globalen Konzepte als Vergleich verfügbar.', true);
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
                `${changedMethodsForNewSet.length} geänderte/neue Seminareinheiten für ein neues Konzept verfügbar.`,
                false
            );
        });
    };

    const loadExistingCandidates = (cmid) => {
        const methodsetid = getSelectedExistingSetId();
        if (!methodsetid) {
            existingCandidates = [];
            renderExistingCandidates();
            setStatus('#kg-review-existing-status', 'Bitte zuerst ein globales Konzept wählen.', true);
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
            setStatus('#kg-review-existing-status', 'Bitte ein bestehendes Konzept auswählen.', true);
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
                `Erfolgreich eingereicht (Konzept #${res.methodsetid}, Version #${res.versionid}, ${res.savedcount} Seminareinheiten im Konzept).`,
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
                `Neues Konzept eingereicht (Konzept #${res.methodsetid}, Version #${res.versionid}, ${res.savedcount} Seminareinheiten).`,
                false
            );
            return loadReviewTargets(cmid).then(() => loadChangedMethodsForNewSet(cmid));
        }).catch((e) => {
            Notification.exception(e);
            setStatus('#kg-review-new-status', 'Einreichen des neuen Konzepts fehlgeschlagen.', true);
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
    };

    return {
        init: function(cmid) {
            loadReviewTargets(cmid).then(() => loadChangedMethodsForNewSet(cmid)).then(() => {
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
