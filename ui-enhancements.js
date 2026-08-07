// ============================================
// SHEET COMMANDER PRO — UI ENHANCEMENTS
// Onboarding, orientation ("formula bar"), and
// small quality-of-life additions. Loaded AFTER
// script.js — never redefines its core logic,
// only adds to it, so nothing existing breaks.
// ============================================

(function () {
    const TAB_INFO = {
        dashboard: { path: 'Dashboard', desc: 'A quick look at your workspace. Start by importing a file.' },
        import:    { path: 'Import Data', desc: 'Step 1 — bring in an .xlsx, .csv or .txt file, or start from a template.' },
        data:      { path: 'View & Clean', desc: 'Step 2 — sort, search, remove duplicates and tidy your rows.' },
        vlookup:   { path: 'Merge Files', desc: 'Combine your table with a second file by matching a shared column.' },
        ifelse:    { path: 'Add Rules', desc: 'Automatically label or flag rows based on a condition you set.' },
        pivot:     { path: 'Summarize', desc: 'Step 3 — group your data and calculate totals, counts or averages.' },
        charts:    { path: 'Visualize', desc: 'Step 4 — turn your columns into a chart.' },
        workflows: { path: 'Workflows', desc: 'Save a sequence of steps once, then run it again in one click.' },
        plugins:   { path: 'Plugins', desc: 'Connect other tools, like Google Sheets or Slack.' },
        export:    { path: 'Export & Share', desc: 'Step 5 — download your finished data or schedule a report.' }
    };

    function updateFormulaBar(tabId) {
        const info = TAB_INFO[tabId];
        if (!info) return;
        const pathEl = document.getElementById('fxPath');
        const descEl = document.getElementById('fxDesc');
        if (pathEl) pathEl.textContent = info.path;
        if (descEl) descEl.textContent = info.desc;
    }

    function goToTab(tabId) {
        const li = document.querySelector('.sidebar ul li[data-tab="' + tabId + '"]');
        if (li) li.click();
    }

    document.addEventListener('DOMContentLoaded', () => {
        // Keep the orientation bar in sync with whichever tab is active,
        // without touching the click handler already set up in script.js.
        document.querySelectorAll('.sidebar ul li').forEach((li) => {
            li.addEventListener('click', () => updateFormulaBar(li.dataset.tab));
        });

        // Dashboard "flow step" cards jump straight to a tab.
        document.querySelectorAll('.flow-step[data-jump]').forEach((el) => {
            el.addEventListener('click', () => goToTab(el.dataset.jump));
        });

        // Help / settings button opens the shortcuts modal.
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                if (typeof openModal === 'function') openModal('helpModal');
            });
        }

        // First-visit welcome tour.
        try {
            const seen = localStorage.getItem('sheet_commander_welcome_seen');
            if (!seen) {
                setTimeout(() => {
                    if (typeof openModal === 'function') openModal('welcomeModal');
                }, 400);
            }
        } catch (e) { /* localStorage unavailable — skip tour silently */ }

        const dontShow = document.getElementById('dontShowWelcome');
        const welcomeModal = document.getElementById('welcomeModal');
        if (welcomeModal) {
            welcomeModal.addEventListener('click', (e) => {
                const closing = e.target.closest('button') || e.target.classList.contains('modal');
                if (closing && dontShow && dontShow.checked) {
                    try { localStorage.setItem('sheet_commander_welcome_seen', '1'); } catch (e2) {}
                }
            });
        }
    });

    // ---- Teach the AI bar two more plain-English phrases ----
    // The original assistant recognizes pivot/chart/total/filter/sort/export,
    // but not "remove duplicates" or "fill missing values" — even though the
    // app already has both functions built in (used by the Data tab buttons).
    // We wrap the existing handler so those phrases now actually run them.
    if (typeof handleAIQuery === 'function') {
        const baseHandleAIQuery = handleAIQuery;
        handleAIQuery = function (query) {
            if (!query || !query.trim()) return baseHandleAIQuery(query);
            const lower = query.toLowerCase();
            if (lower.includes('duplicate')) {
                if (typeof removeDuplicates === 'function') removeDuplicates();
                if (typeof dom !== 'undefined') dom.aiQuery.value = '';
                return;
            }
            if (lower.includes('missing') || lower.includes('blank') || lower.includes('empty value')) {
                if (typeof fillMissingValues === 'function') fillMissingValues();
                if (typeof dom !== 'undefined') dom.aiQuery.value = '';
                return;
            }
            if (lower.includes('trim') || lower.includes('extra space')) {
                if (typeof trimSpaces === 'function') trimSpaces();
                if (typeof dom !== 'undefined') dom.aiQuery.value = '';
                return;
            }
            return baseHandleAIQuery(query);
        };
    }
})();
