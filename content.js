// Polyfill fallback por si el scope se aísla
const extBrowser = typeof browser !== 'undefined' ? browser : chrome;

if (!window.__nsFilterExtensionLoaded) {
    window.__nsFilterExtensionLoaded = true;

    // Remove any leftover containers from previous extension reloads in development
    document.querySelectorAll('#ns-filter-container').forEach(el => el.remove());
    document.querySelectorAll('#ns-record-modal-overlay').forEach(el => el.remove());

    // =========================================================================
    // ESTILOS COMPARTIDOS
    // =========================================================================

    const SHARED_STYLES = `
    /* ---- Shared ---- */
    .ns-filter-container {
        display: none; 
        width: 100%;
        padding: 0.5rem;
        box-sizing: border-box;
        background-color: #f3f4f6; 
        border-bottom: 1px solid #e5e7eb;
    }
    .ns-filter-wrapper {
        position: relative;
        width: 100%;
        display: flex;
        align-items: center;
    }
    .ns-filter-input {
        padding: 0.5rem;
        padding-right: 2rem;
        border-width: 1px;
        border-style: solid;
        border-color: #d1d5db; 
        border-radius: 0.25rem; 
        width: 100%;      
        box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);
        background-color: white;
        color: black;
        outline: none;
        box-sizing: border-box;
        font-family: inherit;
        font-size: 14px;
    }
    .ns-filter-input:focus {
        border-color: #2563eb; 
    }
    .ns-filter-clear {
        position: absolute;
        right: 0.5rem;
        cursor: pointer;
        font-weight: bold;
        color: #9ca3af;
        background: transparent;
        border: none;
        padding: 0.25rem;
    }
    .ns-filter-clear:hover {
        color: #4b5563;
    }
    .ns-filter-counter {
        margin-left: auto;
        margin-right: 2.5rem;
        font-size: 0.75rem;
        color: #6b7280;
        font-weight: 500;
        white-space: nowrap;
    }
    .ns-highlight {
        background-color: #fef08a;
        color: #000;
        border-radius: 2px;
    }
    .ns-dropdown-locked {
        display: block !important;
        visibility: visible !important;
    }

    /* ---- Record Search Modal ---- */
    .ns-record-modal-overlay {
        display: none;
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 99999;
        justify-content: center;
        align-items: flex-start;
        padding-top: 12vh;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }
    .ns-record-modal-overlay.ns-modal-visible {
        display: flex;
    }
    .ns-record-modal {
        background: #fff;
        border-radius: 12px;
        box-shadow: 0 25px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,0,0,0.05);
        width: 560px;
        max-width: 90vw;
        max-height: 65vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: ns-modal-appear 0.15s ease-out;
    }
    @keyframes ns-modal-appear {
        from { opacity: 0; transform: translateY(-12px) scale(0.97); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .ns-record-modal-header {
        padding: 16px 20px 12px;
        border-bottom: 1px solid #e5e7eb;
    }
    .ns-record-modal-title {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #6b7280;
        margin-bottom: 10px;
    }
    .ns-record-modal-input-wrapper {
        position: relative;
        display: flex;
        align-items: center;
    }
    .ns-record-modal-input {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-size: 15px;
        color: #111827;
        background: #f9fafb;
        outline: none;
        box-sizing: border-box;
        transition: border-color 0.15s, box-shadow 0.15s;
    }
    .ns-record-modal-input:focus {

        border-color: #2563eb;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
        background: #fff;
    }
    .ns-record-modal-results {
        overflow-y: auto;
        flex: 1;
        padding: 6px 0;
    }
    .ns-record-history-label {
        padding: 8px 20px 4px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #9ca3af;
    }
    .ns-record-modal-empty {
        padding: 32px 20px;
        text-align: center;
        color: #9ca3af;
        font-size: 14px;
    }
    .ns-record-result-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 20px;
        cursor: pointer;
        transition: background-color 0.08s;
        border-left: 3px solid transparent;
    }
    .ns-record-result-item:hover,
    .ns-record-result-item.ns-result-active {
        background-color: #eff6ff;
        border-left-color: #2563eb;
    }
    .ns-record-result-label {
        font-size: 14px;
        color: #1f2937;
        font-weight: 500;
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        margin-right: 12px;
    }
    .ns-record-result-id {
        font-size: 12px;
        color: #9ca3af;
        font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
        flex-shrink: 0;
        background: #f3f4f6;
        padding: 2px 8px;
        border-radius: 4px;
    }
    .ns-record-modal-footer {
        padding: 8px 20px;
        border-top: 1px solid #e5e7eb;
        display: flex;
        align-items: center;
        gap: 16px;
        font-size: 11px;
        color: #9ca3af;
        background: #f9fafb;
    }
    .ns-record-modal-footer kbd {
        display: inline-block;
        padding: 1px 5px;
        font-size: 11px;
        font-family: inherit;
        color: #6b7280;
        background: #fff;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        box-shadow: 0 1px 0 #d1d5db;
    }
    .ns-record-result-count {
        margin-left: auto;
        font-size: 11px;
        color: #9ca3af;
    }

    /* Flash highlight para el campo seleccionado */
    @keyframes ns-field-flash {
        0%   { outline: 3px solid #2563eb; outline-offset: 4px; box-shadow: 0 0 20px rgba(37, 99, 235, 0.3); }
        70%  { outline: 3px solid #2563eb; outline-offset: 4px; box-shadow: 0 0 20px rgba(37, 99, 235, 0.3); }
        100% { outline: 3px solid transparent; outline-offset: 4px; box-shadow: none; }
    }
    .ns-field-flash {
        animation: ns-field-flash 2s ease-out forwards;
        position: relative;
        z-index: 1;
    }

    /* ---- Environment Visualizer ---- */
    .ns-env-visualizer {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 6px;
        z-index: 2147483647;
        pointer-events: none;
    }
    .ns-env-production {
        background-color: #ef4444;
        box-shadow: 0 0 8px rgba(239, 68, 68, 0.5);
    }
    .ns-env-sandbox {
        background-color: #3b82f6;
        box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
    }
    .ns-env-development {
        background-color: #10b981;
        box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
    }

    /* ---- Copy ID Toast ---- */
    @keyframes ns-toast-fade {
        0%   { opacity: 0; transform: translateY(10px); }
        15%  { opacity: 1; transform: translateY(0); }
        80%  { opacity: 1; transform: translateY(0); }
        100% { opacity: 0; transform: translateY(-10px); }
    }
    .ns-copy-toast {
        position: fixed;
        background: #1f2937;
        color: #fff;
        padding: 6px 12px;
        border-radius: 6px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        font-size: 13px;
        font-weight: 500;
        z-index: 2147483647;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        pointer-events: none;
        animation: ns-toast-fade 2s forwards;
    }
    `;

    const DROPDOWN_SELECTORS = [
        '.uir-field-choices',
        '.dropdownDiv',
        '.listboxcontainer',
        '.ns-dropdown'
    ].join(', ');

    // =========================================================================
    // UTILIDADES COMPARTIDAS
    // =========================================================================

    function injectStyles() {
        if (document.getElementById('ns-filter-styles')) return;
        const style = document.createElement('style');
        style.id = 'ns-filter-styles';
        style.textContent = SHARED_STYLES;
        document.head.appendChild(style);
    }

    // Recursivo: quita los highlights previos devolviendo a texto puro
    function removeHighlights(node) {
        if (!node) return;
        const highlights = node.querySelectorAll('.ns-highlight');
        highlights.forEach(h => {
            const parent = h.parentNode;
            parent.replaceChild(document.createTextNode(h.textContent), h);
            parent.normalize(); 
        });
    }

    // Recursivo: resalta sobre nodos de texto sin romper html interno
    function addHighlights(node, terms) {
        if (!node || terms.length === 0) return;
        if (node.nodeType === 3) { // TEXT_NODE
            const textContent = node.nodeValue;
            const lowerText = textContent.toLowerCase();
            
            let firstMatch = null;
            let matchIndex = -1;
            for (const term of terms) {
                const idx = lowerText.indexOf(term);
                if (idx !== -1 && (matchIndex === -1 || idx < matchIndex)) {
                    matchIndex = idx;
                    firstMatch = term;
                }
            }

            if (firstMatch) {
                const matchLen = firstMatch.length;
                const beforeMatch = textContent.slice(0, matchIndex);
                const matchText = textContent.slice(matchIndex, matchIndex + matchLen);
                const afterMatch = textContent.slice(matchIndex + matchLen);

                const fragment = document.createDocumentFragment();
                if (beforeMatch) fragment.appendChild(document.createTextNode(beforeMatch));
                
                const span = document.createElement('span');
                span.className = 'ns-highlight';
                span.textContent = matchText;
                fragment.appendChild(span);
                
                if (afterMatch) {
                    const afterNode = document.createTextNode(afterMatch);
                    fragment.appendChild(afterNode);
                    node.parentNode.replaceChild(fragment, node);
                    addHighlights(afterNode, terms);
                } else {
                    node.parentNode.replaceChild(fragment, node);
                }
            }
        } else if (node.nodeType === 1 && node.nodeName !== 'SCRIPT' && node.nodeName !== 'STYLE') {
            Array.from(node.childNodes).forEach(child => addHighlights(child, terms));
        }
    }

    // ---- AliasMap (BFS no-bloqueante con depth limit) ----

    let fastAliasMap = new Map();
    let mapBuilt = false;
    let mapBuildingInProgress = false;
    let hasActiveHighlights = false;

    const MAX_WALK_DEPTH = 10;

    function buildAliasMap(callback) {
        if (mapBuilt) { if (callback) callback(); return; }
        if (mapBuildingInProgress) { if (callback) callback(); return; }
        mapBuildingInProgress = true;
        
        const pageWindow = typeof window.wrappedJSObject !== 'undefined' ? window.wrappedJSObject : window;
        
        const roots = [];
        try {
            if (pageWindow.NS) roots.push(pageWindow.NS);
            if (pageWindow._dynamicData) roots.push(pageWindow._dynamicData);
        } catch(e) {
            console.error("[NetSuite Extension] Error accediendo a variables globales:", e);
        }

        if (roots.length === 0) {
            mapBuilt = true;
            mapBuildingInProgress = false;
            if (callback) callback();
            return;
        }

        const seen = new Set();
        const queue = [];
        for (const root of roots) {
            queue.push({ node: root, depth: 0 });
        }

        function processChunk(deadline) {
            const hasIdleTime = typeof deadline !== 'undefined' && typeof deadline.timeRemaining === 'function';
            const chunkLimit = 500;
            let processed = 0;

            while (queue.length > 0) {
                if (hasIdleTime && deadline.timeRemaining() <= 0) break;
                if (!hasIdleTime && processed >= chunkLimit) break;

                const { node: n, depth } = queue.shift();
                processed++;

                if (!n || typeof n !== 'object' || seen.has(n) || depth > MAX_WALK_DEPTH) continue;
                seen.add(n);

                if (Array.isArray(n)) {
                    for (let i = 0; i < n.length; i++) {
                        const item = n[i];
                        if (Array.isArray(item) && item.length >= 2 && typeof item[0] === 'string' && typeof item[1] === 'string') {
                            const val = item[0].toLowerCase();
                            const txt = item[1].replace(/[\s\u00A0]+/g, ' ').trim().toLowerCase();
                            if (val.length > 1) fastAliasMap.set(txt, val);
                        } else {
                            queue.push({ node: item, depth: depth + 1 });
                        }
                    }
                } else {
                    const val = n.value || n.id || n.internalid;
                    const txt = n.text || n.label || n.name;
                    if (typeof val === 'string' && typeof txt === 'string' && val.trim() !== '') {
                        fastAliasMap.set(txt.replace(/[\s\u00A0]+/g, ' ').trim().toLowerCase(), val.toLowerCase());
                    }
                    for (const k in n) {
                        try {
                            const child = n[k];
                            if (child && typeof child === 'object') {
                                queue.push({ node: child, depth: depth + 1 });
                            }
                        } catch(e) {}
                    }
                }
            }

            if (queue.length > 0) {
                if (typeof requestIdleCallback === 'function') {
                    requestIdleCallback(processChunk);
                } else {
                    setTimeout(() => processChunk({}), 0);
                }
            } else {
                mapBuilt = true;
                mapBuildingInProgress = false;
                console.log(`[NetSuite Extension] AliasMap construido: ${fastAliasMap.size} entradas`);
                if (callback) callback();
            }
        }

        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(processChunk);
        } else {
            setTimeout(() => processChunk({}), 0);
        }
    }

    // =========================================================================
    // CONTEXTO A: SAVED SEARCH — Filtro de Dropdowns
    // =========================================================================

    function initSavedSearch() {
        console.log("[NetSuite Extension] Contexto A: Saved Search — Motor de Filtrado Optimizado");
        injectStyles();

        // ---- Crear contenedor de búsqueda para dropdowns ----
        function getOrCreateSearchContainer() {
            if (window.__nsSearchContainer) return window.__nsSearchContainer;

            const container = document.createElement('div');
            container.id = 'ns-filter-container';
            container.className = 'ns-filter-container';

            const wrapper = document.createElement('div');
            wrapper.className = 'ns-filter-wrapper';

            const input = document.createElement('input');
            input.id = 'ns-filter-search-input';
            input.placeholder = "Filtrar opciones...";
            input.className = "ns-filter-input";
            
            input.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') return;
                e.stopPropagation();
            });
            input.addEventListener('keypress', (e) => e.stopPropagation());
            input.addEventListener('keyup', (e) => e.stopPropagation());
            input.addEventListener('mousedown', (e) => e.stopPropagation());
            input.addEventListener('click', (e) => e.stopPropagation());
            
            const counter = document.createElement('span');
            counter.id = 'ns-filter-counter';
            counter.className = 'ns-filter-counter';
            counter.style.display = 'none';

            const clearBtn = document.createElement('button');
            clearBtn.innerHTML = '&#x2715;'; 
            clearBtn.className = 'ns-filter-clear';
            clearBtn.style.display = 'none'; 
            clearBtn.type = 'button';
            clearBtn.title = 'Limpiar búsqueda';

            let debounceTimer;
            input.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                const val = e.target.value;
                clearBtn.style.display = val ? 'block' : 'none';
                counter.style.display = val ? 'block' : 'none';
                counter.textContent = 'Buscando...';
                
                debounceTimer = setTimeout(() => {
                    requestAnimationFrame(() => {
                        const dropdown = container.closest(DROPDOWN_SELECTORS) || document.body;
                        applyDropdownFilter(val, dropdown);
                    });
                }, 150);
            });

            clearBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                input.value = '';
                const dropdown = container.closest(DROPDOWN_SELECTORS) || document.body;
                applyDropdownFilter('', dropdown);
                clearBtn.style.display = 'none';
                counter.style.display = 'none';
                input.focus();
            });
            
            wrapper.appendChild(input);
            wrapper.appendChild(counter);
            wrapper.appendChild(clearBtn);
            container.appendChild(wrapper);
            
            window.__nsSearchContainer = container;
            document.body.appendChild(container);
            return container;
        }

        // ---- Filtro de dropdown ----
        function applyDropdownFilter(term, contextNode = document.body) {
            const terms = term.trim().toLowerCase().split(/\s+/).filter(t => t);
            let elementsToFilter = [];
            
            if (contextNode !== document.body) {
                const allInnerElems = contextNode.querySelectorAll('div, tr, li, .dropdown-row');
                elementsToFilter = Array.from(allInnerElems).filter(el => {
                    if (el.id === 'ns-filter-container' || el.closest('#ns-filter-container')) return false;
                    const containsBlockElements = el.querySelector('div, table, ul');
                    return !containsBlockElements;
                });
            } else {
                const tableSelectors = '.uir-machine-table tr.uir-list-row-tr, .uir-machine-table tr.uir-machine-row, #filter_splits tr, #column_splits tr, tr.uir-list-row-tr, tr.uir-machine-row';
                elementsToFilter = Array.from(contextNode.querySelectorAll(tableSelectors));
            }

            if (terms.length === 0) {
                if (hasActiveHighlights) {
                    elementsToFilter.forEach(el => removeHighlights(el));
                    hasActiveHighlights = false;
                }
                elementsToFilter.forEach(el => { el.style.display = ""; });
                const counter = document.getElementById('ns-filter-counter');
                if (counter) counter.textContent = '';
                return;
            }
            
            let matchCount = 0;

            if (hasActiveHighlights) {
                elementsToFilter.forEach(el => removeHighlights(el));
                hasActiveHighlights = false;
            }

            elementsToFilter.forEach(el => {
                if (!el) return;
                if (el.id === 'ns-filter-container' || el.closest('#ns-filter-container')) return;

                const elId = el.id || "";

                if (elId.endsWith('_addedit') || el.classList.contains('uir-machine-addrow')) {
                    el.style.display = "";
                    return;
                }

                const rawText = el.textContent.replace(/[\s\u00A0]+/g, ' ').trim().toLowerCase();
                const textBase = rawText.replace(/[()]/g, ' ').trim();
                
                if (!el.hasAttribute('data-ns-id')) {
                    const id = fastAliasMap.get(rawText) || fastAliasMap.get(textBase) || 'unknown';
                    el.setAttribute('data-ns-id', id);
                }

                const nsId = el.getAttribute('data-ns-id');
                
                const searchableText = rawText + ' ' + textBase + ' ' + nsId;
                const isMatch = terms.every(t => searchableText.includes(t));

                el.style.display = isMatch ? "" : "none";
                
                if (isMatch) {
                    matchCount++;
                    addHighlights(el, terms);
                    hasActiveHighlights = true;
                }
            });

            const counter = document.getElementById('ns-filter-counter');
            if (counter) {
                counter.textContent = `${matchCount} resultado${matchCount !== 1 ? 's' : ''}`;
            }
        }

        // ---- Lógica de inyección en dropdowns ----
        const searchContainer = getOrCreateSearchContainer();
        const searchInput = document.getElementById('ns-filter-search-input');
        
        let activeDropdown = null;
        let isDropdownLocked = false;
        
        const stateGuardian = new MutationObserver((mutations) => {
            if (!activeDropdown || !isDropdownLocked) return;
            for (let m of mutations) {
                if (m.type === 'attributes' && (m.attributeName === 'style' || m.attributeName === 'class')) {
                    if (activeDropdown.style.display === 'none' || activeDropdown.style.visibility === 'hidden') {
                        if (document.activeElement === searchInput || searchContainer.contains(document.activeElement)) {
                            activeDropdown.classList.add('ns-dropdown-locked');
                        }
                    }
                }
            }
        });

        function injectIntoDropdown(node) {
            if (activeDropdown === node && searchContainer.parentNode === node) return;
            
            const rect = node.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;

            stateGuardian.disconnect();
            
            activeDropdown = node;
            activeDropdown.prepend(searchContainer);
            searchContainer.style.display = 'block';
            searchInput.value = '';
            
            buildAliasMap(() => {
                applyDropdownFilter('', activeDropdown);
            });
            
            isDropdownLocked = true;
            activeDropdown.classList.add('ns-dropdown-locked');

            stateGuardian.observe(activeDropdown, { attributes: true, attributeFilter: ['style', 'class'] });

            setTimeout(() => {
                searchInput.focus();
            }, 10);
        }

        function closeDropdown() {
            if (activeDropdown) {
                activeDropdown.classList.remove('ns-dropdown-locked');
                stateGuardian.disconnect();
            }
            searchContainer.style.display = 'none';
            document.body.appendChild(searchContainer); 
            activeDropdown = null;
            isDropdownLocked = false;
        }

        function scanForVisibleDropdowns() {
            const dropdowns = document.querySelectorAll(DROPDOWN_SELECTORS);
            let foundVisible = false;
            
            for (let i = 0; i < dropdowns.length; i++) {
                const node = dropdowns[i];
                if (node.id === 'ns-filter-container') continue;
                
                const rect = node.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    foundVisible = true;
                    if (activeDropdown !== node) {
                        injectIntoDropdown(node);
                    }
                    break;
                }
            }
            
            if (!foundVisible && activeDropdown) {
                closeDropdown();
            }
        }

        document.addEventListener('mousedown', (e) => {
            if (e.target.closest('#ns-filter-container')) return;
            
            setTimeout(scanForVisibleDropdowns, 50);
            setTimeout(scanForVisibleDropdowns, 200);
            
            if (activeDropdown && !activeDropdown.contains(e.target)) {
                closeDropdown();
            }
        }, true);
    }

    // =========================================================================
    // CONTEXTO B: RECORDS — Modal de Búsqueda de Campos
    // =========================================================================

    function initRecordSearch() {
        console.log("[NetSuite Extension] Contexto B: Record — Buscador de Campos (Ctrl+Shift+F)");
        injectStyles();

        let modalOverlay = null;
        let modalInput = null;
        let modalResults = null;
        let modalCounter = null;
        let currentFields = [];
        let filteredFields = [];
        let activeIndex = -1;
        let previouslyFlashed = null;
        let isShowingHistory = false;

        const HISTORY_KEY = 'ns_field_search_history';
        const MAX_HISTORY = 15;

        // ---- Historial de búsquedas en localStorage ----
        function getSearchHistory() {
            try {
                const raw = localStorage.getItem(HISTORY_KEY);
                return raw ? JSON.parse(raw) : [];
            } catch(e) {
                return [];
            }
        }

        function addToSearchHistory(field) {
            try {
                let history = getSearchHistory();
                // Remover duplicado si ya existe
                history = history.filter(h => h.fieldId !== field.fieldId);
                // Agregar al inicio
                history.unshift({ fieldId: field.fieldId, label: field.label });
                // Limitar a MAX_HISTORY
                if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
                localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
            } catch(e) {
                // localStorage no disponible, silenciar
            }
        }

        // ---- Extracción de campos del formulario ----
        function extractFormFields() {
            const fields = [];
            const seen = new Set();

            // Estrategia 1: data-walkthrough en los field wrappers de NetSuite
            document.querySelectorAll('[data-walkthrough]').forEach(el => {
                const fieldId = el.getAttribute('data-walkthrough');
                if (!fieldId || seen.has(fieldId)) return;

                // Buscar label correspondiente
                const labelEl = el.querySelector('.smalltextnolink, label, .uir-label span');
                const label = labelEl ? labelEl.textContent.replace(/[\s\u00A0]+/g, ' ').trim() : '';
                if (!label && !fieldId) return;

                seen.add(fieldId);
                fields.push({
                    fieldId: fieldId,
                    label: label || fieldId,
                    element: el
                });
            });

            // Estrategia 2: Buscar rows de formulario <tr> que contengan labels + inputs/selects
            document.querySelectorAll('table.main_form tr, #main_form tr, form tr').forEach(tr => {
                // Buscar un campo de formulario dentro de este tr
                const inputEl = tr.querySelector('input[id]:not([type="hidden"]), select[id], textarea[id]');
                if (!inputEl) return;

                const fieldId = inputEl.id || inputEl.name || '';
                if (!fieldId || seen.has(fieldId)) return;
                // Filtrar IDs de infraestructura NetSuite (botones, frames, etc)
                if (fieldId.startsWith('_') || fieldId.includes('frame') || fieldId === 'ns-record-modal-input') return;

                // Buscar el label
                const labelCell = tr.querySelector('.smalltextnolink, .label, label');
                const label = labelCell ? labelCell.textContent.replace(/[\s\u00A0]+/g, ' ').trim() : '';
                if (!label) return;

                seen.add(fieldId);
                fields.push({
                    fieldId: fieldId,
                    label: label,
                    element: tr
                });
            });

            // Estrategia 3: Buscar directamente inputs con ID dentro del main form
            const mainForm = document.getElementById('main_form') || document.querySelector('form[name="main_form"]') || document.body;
            mainForm.querySelectorAll('input[id]:not([type="hidden"]), select[id], textarea[id]').forEach(inputEl => {
                const fieldId = inputEl.id || '';
                if (!fieldId || seen.has(fieldId)) return;
                if (fieldId.startsWith('_') || fieldId.startsWith('sys') || fieldId.includes('frame') || fieldId === 'ns-record-modal-input') return;
                if (fieldId.startsWith('inpt_')) return; // NetSuite display-only proxies

                // Intentar encontrar un label cercano
                let label = '';
                const parentTr = inputEl.closest('tr');
                if (parentTr) {
                    const labelEl = parentTr.querySelector('.smalltextnolink, .label, label');
                    if (labelEl) label = labelEl.textContent.replace(/[\s\u00A0]+/g, ' ').trim();
                }
                if (!label) {
                    // Intentar con el aria-label o title
                    label = inputEl.getAttribute('aria-label') || inputEl.getAttribute('title') || '';
                }
                if (!label) label = fieldId; // Fallback al ID como label

                seen.add(fieldId);
                fields.push({
                    fieldId: fieldId,
                    label: label,
                    element: parentTr || inputEl
                });
            });

            return fields;
        }

        // ---- Crear el modal ----
        function createModal() {
            if (modalOverlay) return;

            modalOverlay = document.createElement('div');
            modalOverlay.id = 'ns-record-modal-overlay';
            modalOverlay.className = 'ns-record-modal-overlay';

            const modal = document.createElement('div');
            modal.className = 'ns-record-modal';

            // Header
            const header = document.createElement('div');
            header.className = 'ns-record-modal-header';

            const title = document.createElement('div');
            title.className = 'ns-record-modal-title';
            title.textContent = 'Buscar campo en el formulario';

            const inputWrapper = document.createElement('div');
            inputWrapper.className = 'ns-record-modal-input-wrapper';

            modalInput = document.createElement('input');
            modalInput.id = 'ns-record-modal-input';
            modalInput.className = 'ns-record-modal-input';
            modalInput.placeholder = 'Nombre del campo o ID interno...';
            modalInput.type = 'text';
            modalInput.autocomplete = 'off';

            inputWrapper.appendChild(modalInput);
            header.appendChild(title);
            header.appendChild(inputWrapper);

            // Results container
            modalResults = document.createElement('div');
            modalResults.className = 'ns-record-modal-results';

            // Footer
            const footer = document.createElement('div');
            footer.className = 'ns-record-modal-footer';

            modalCounter = document.createElement('span');
            modalCounter.className = 'ns-record-result-count';

            footer.innerHTML = '<span><kbd>↑↓</kbd> navegar</span><span><kbd>Enter</kbd> ir al campo</span><span><kbd>Esc</kbd> cerrar</span>';
            footer.appendChild(modalCounter);

            modal.appendChild(header);
            modal.appendChild(modalResults);
            modal.appendChild(footer);
            modalOverlay.appendChild(modal);
            document.body.appendChild(modalOverlay);

            // ---- Event listeners ----

            // Cerrar al hacer click en el overlay (fuera del modal)
            modalOverlay.addEventListener('mousedown', (e) => {
                if (e.target === modalOverlay) {
                    closeModal();
                }
            });

            // Input filtering con debounce
            let debounceTimer;
            modalInput.addEventListener('input', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    filterModalResults(modalInput.value);
                }, 80);
            });

            // Keyboard navigation
            modalInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    closeModal();
                    return;
                }
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    activeIndex = Math.min(activeIndex + 1, filteredFields.length - 1);
                    renderActiveItem();
                    return;
                }
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    activeIndex = Math.max(activeIndex - 1, 0);
                    renderActiveItem();
                    return;
                }
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (activeIndex >= 0 && activeIndex < filteredFields.length) {
                        selectField(filteredFields[activeIndex]);
                    } else if (filteredFields.length > 0) {
                        selectField(filteredFields[0]);
                    }
                    return;
                }
                // Impedir propagación a NetSuite
                e.stopPropagation();
            });
            modalInput.addEventListener('keypress', (e) => e.stopPropagation());
            modalInput.addEventListener('keyup', (e) => e.stopPropagation());
        }

        // ---- Filtrar resultados ----
        function filterModalResults(term) {
            const terms = term.trim().toLowerCase().split(/\s+/).filter(t => t);
            
            if (terms.length === 0) {
                // Sin texto: mostrar historial
                showHistory();
                return;
            }

            // Con texto: buscar en TODOS los campos del formulario
            isShowingHistory = false;
            filteredFields = currentFields.filter(f => {
                const searchable = (f.label + ' ' + f.fieldId).toLowerCase();
                return terms.every(t => searchable.includes(t));
            });

            activeIndex = filteredFields.length > 0 ? 0 : -1;
            renderResults(terms);
        }

        // ---- Mostrar historial ----
        function showHistory() {
            isShowingHistory = true;
            const history = getSearchHistory();

            // Resolver elementos del DOM para cada entry del historial
            filteredFields = history.map(h => {
                // Buscar el campo en el form actual
                const match = currentFields.find(f => f.fieldId === h.fieldId);
                return {
                    fieldId: h.fieldId,
                    label: h.label,
                    element: match ? match.element : null
                };
            });

            activeIndex = filteredFields.length > 0 ? 0 : -1;
            renderResults();
        }

        // ---- Renderizar lista de resultados ----
        function renderResults(terms = []) {
            modalResults.innerHTML = '';
            
            if (filteredFields.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'ns-record-modal-empty';
                empty.textContent = isShowingHistory 
                    ? 'Sin historial de búsquedas recientes'
                    : 'Sin coincidencias';
                modalResults.appendChild(empty);
                modalCounter.textContent = '';
                return;
            }

            // Etiqueta de sección
            if (isShowingHistory) {
                const historyLabel = document.createElement('div');
                historyLabel.className = 'ns-record-history-label';
                historyLabel.textContent = 'Recientes';
                modalResults.appendChild(historyLabel);
                modalCounter.textContent = '';
            } else {
                modalCounter.textContent = `${filteredFields.length} campo${filteredFields.length !== 1 ? 's' : ''}`;
            }

            filteredFields.forEach((field, idx) => {
                const item = document.createElement('div');
                item.className = 'ns-record-result-item' + (idx === activeIndex ? ' ns-result-active' : '');
                item.setAttribute('data-idx', idx);

                const labelSpan = document.createElement('span');
                labelSpan.className = 'ns-record-result-label';
                labelSpan.textContent = field.label;

                const idSpan = document.createElement('span');
                idSpan.className = 'ns-record-result-id';
                idSpan.textContent = field.fieldId;

                item.appendChild(labelSpan);
                item.appendChild(idSpan);

                // Resaltar términos en label e ID
                if (terms.length > 0) {
                    addHighlights(labelSpan, terms);
                    addHighlights(idSpan, terms);
                }

                item.addEventListener('click', () => {
                    selectField(field);
                });

                item.addEventListener('mouseenter', () => {
                    activeIndex = idx;
                    renderActiveItem();
                });

                modalResults.appendChild(item);
            });
        }

        // ---- Resaltar item activo (sin re-render completo) ----
        function renderActiveItem() {
            const items = modalResults.querySelectorAll('.ns-record-result-item');
            items.forEach((item, idx) => {
                if (idx === activeIndex) {
                    item.classList.add('ns-result-active');
                    item.scrollIntoView({ block: 'nearest' });
                } else {
                    item.classList.remove('ns-result-active');
                }
            });
        }

        // ---- Seleccionar un campo: cerrar modal y scroll ----
        function selectField(field) {
            // Guardar en historial
            addToSearchHistory(field);
            closeModal();

            // Limpiar flash anterior
            if (previouslyFlashed) {
                previouslyFlashed.classList.remove('ns-field-flash');
                previouslyFlashed = null;
            }

            const target = field.element;
            if (!target) return;

            // Scroll al campo
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // Flash highlight
            setTimeout(() => {
                target.classList.add('ns-field-flash');
                previouslyFlashed = target;

                // Quitar la clase después de la animación
                setTimeout(() => {
                    target.classList.remove('ns-field-flash');
                    if (previouslyFlashed === target) previouslyFlashed = null;
                }, 2100);
            }, 300); // Esperar a que termine el scroll
        }

        // ---- Abrir modal ----
        function openModal() {
            createModal();

            // Extraer campos frescos cada vez que se abre
            currentFields = extractFormFields();

            modalInput.value = '';
            // Mostrar historial por defecto
            showHistory();
            
            modalOverlay.classList.add('ns-modal-visible');
            
            // Focus con delay para asegurar render
            setTimeout(() => {
                modalInput.focus();
            }, 50);
        }

        // ---- Cerrar modal ----
        function closeModal() {
            if (modalOverlay) {
                modalOverlay.classList.remove('ns-modal-visible');
            }
        }

        // ---- Listener del atajo de teclado: Ctrl + Shift + F ----
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'F') {
                e.preventDefault();
                e.stopPropagation();
                
                // Toggle: si está abierto, cerrar
                if (modalOverlay && modalOverlay.classList.contains('ns-modal-visible')) {
                    closeModal();
                } else {
                    openModal();
                }
            }
            // Escape global para cerrar
            if (e.key === 'Escape' && modalOverlay && modalOverlay.classList.contains('ns-modal-visible')) {
                e.preventDefault();
                closeModal();
            }
        }, true);
    }

    // =========================================================================
    // URL ROUTER — Detección de contexto
    // =========================================================================

    const SAVED_SEARCH_PATTERN = 'app/common/search/search.nl';
    const RECORD_PATTERNS = [
        '/app/common/entity/',
        '/app/accounting/transactions/',
        '/app/common/custom/',
        '/app/common/item/',
        '/app/site/hosting/',
        '/app/crm/',
        '/app/setup/',
    ];

    function detectContext() {
        const path = window.location.pathname;
        const search = window.location.search;

        if (path.includes(SAVED_SEARCH_PATTERN)) {
            return 'saved-search';
        }

        // Verificar si es un Record: coincidencia con patrones conocidos
        for (const pattern of RECORD_PATTERNS) {
            if (path.includes(pattern)) {
                return 'record';
            }
        }

        // Fallback: cualquier .nl con ?id= es probablemente un Record
        if (path.endsWith('.nl') && search.includes('id=')) {
            return 'record';
        }

        return null;
    }

    // =========================================================================
    // CONTEXTO C: GLOBAL — Alt + Click Copy ID
    // =========================================================================

    function initCopyId() {
        console.log("[NetSuite Extension] Contexto Global: Alt + Click Copy ID activado");
        
        document.addEventListener('click', (e) => {
            if (!e.altKey) return;
            
            let targetFieldId = null;
            
            // 1. Intentar encontrar el 'for' de un label cercano
            const labelEl = e.target.closest('label');
            if (labelEl && labelEl.htmlFor) {
                targetFieldId = labelEl.htmlFor;
            }
            
            // 2. Intentar buscar el input asociado si estamos clickeando un tr o wrapper
            if (!targetFieldId) {
                const rowWrapper = e.target.closest('tr') || e.target.closest('.uir-field-wrapper');
                if (rowWrapper) {
                    const inputEl = rowWrapper.querySelector('input[id]:not([type="hidden"]), select[id], textarea[id]');
                    if (inputEl) {
                        targetFieldId = inputEl.id || inputEl.name;
                    }
                }
            }
            
            // 3. Fallback: El usuario hizo click justo encima de un input o select
            if (!targetFieldId && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) {
                targetFieldId = e.target.id || e.target.name;
            }

            if (targetFieldId) {
                // Limpiar el prefijo inpt_ de NetSuite que usa para algunos select proxies
                if (targetFieldId.startsWith('inpt_')) {
                    targetFieldId = targetFieldId.replace('inpt_', '');
                }
                
                e.preventDefault();
                e.stopPropagation();
                
                // Copiar al portapapeles
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(targetFieldId).then(() => {
                        showCopyToast(`ID Copiado: ${targetFieldId}`, e.clientX, e.clientY);
                    }).catch(() => fallbackCopy(targetFieldId, e));
                } else {
                    fallbackCopy(targetFieldId, e);
                }
            }
        }, true);
    }

    function fallbackCopy(text, e) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.top = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            showCopyToast(`ID Copiado: ${text}`, e.clientX, e.clientY);
        } catch (err) {
            console.error('[NetSuite Extension] Error copiando el ID: ', err);
        }
        document.body.removeChild(textArea);
    }

    function showCopyToast(msg, x, y) {
        document.querySelectorAll('.ns-copy-toast').forEach(el => el.remove());
        const toast = document.createElement('div');
        toast.className = 'ns-copy-toast';
        toast.textContent = msg;
        // Ajustar offset para mostrarse en el puntero
        toast.style.left = `${x + 15}px`;
        toast.style.top = `${y + 15}px`;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.remove(), 2000);
    }

    // =========================================================================
    // CONTEXTO D: GLOBAL — Environment Visualizer
    // =========================================================================

    function initEnvironment() {
        console.log("[NetSuite Extension] Contexto Global: Environment Visualizer activado");
        const urlObj = window.location.href.toLowerCase();
        let envType = '';
        
        if (urlObj.includes('system.netsuite.com')) {
            envType = 'production';
        } else if (urlObj.includes('sandbox')) {
            envType = 'sandbox';
        } else if (urlObj.includes('checkout') || urlObj.includes('tstdrv')) {
            envType = 'development';
        }

        if (envType) {
            injectStyles();
            const visualizer = document.createElement('div');
            visualizer.className = `ns-env-visualizer ns-env-${envType}`;
            document.body.appendChild(visualizer);
            
            if (envType === 'sandbox') {
                changeFaviconToBlue();
            }
        }
    }

    function changeFaviconToBlue() {
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');
        
        // Fondo azul suave
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(8, 8, 8, 0, 2 * Math.PI);
        ctx.fill();
        
        // Texto SB en blanco
        ctx.fillStyle = 'white';
        ctx.font = 'bold 9px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('SB', 8, 8);
        
        link.href = canvas.toDataURL("image/x-icon");
    }

    // =========================================================================
    // INITIALIZATION & URL ROUTER
    // =========================================================================

    const bootCheck = setInterval(() => {
        if (document.body && !window.__nsFilterInitDone) {
            window.__nsFilterInitDone = true;
            clearInterval(bootCheck);

            // 1. Cargar Módulos Globales (funcionan en cualquier página de NetSuite)
            initEnvironment();
            initCopyId();

            // 2. Modulos Específicos según ruta de NetSuite
            const context = detectContext();
            if (context === 'saved-search') {
                initSavedSearch();
            } else if (context === 'record') {
                initRecordSearch();
            }
        }
    }, 500);
}