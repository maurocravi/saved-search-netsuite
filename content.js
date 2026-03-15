// Polyfill fallback por si el scope se aísla
const extBrowser = typeof browser !== 'undefined' ? browser : chrome;

if (!window.__nsFilterExtensionLoaded) {
    window.__nsFilterExtensionLoaded = true;

    // Remove any leftover containers from previous extension reloads in development
    document.querySelectorAll('#ns-filter-container').forEach(el => el.remove());

    const TAILWIND_STYLES = `
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
        background-color: #fef08a; /* bg-yellow-200 */
        color: #000;
        border-radius: 2px;
    }
    /* Estilos forzados para anular la ocultación de NetSuite */
    .ns-dropdown-locked {
        display: block !important;
        visibility: visible !important;
    }
    `;

    const DROPDOWN_SELECTORS = [
        '.uir-field-choices',
        '.dropdownDiv',
        '.listboxcontainer',
        '.ns-dropdown'
    ].join(', ');

    function injectStyles() {
        if (document.getElementById('ns-filter-styles')) return;
        const style = document.createElement('style');
        style.id = 'ns-filter-styles';
        style.textContent = TAILWIND_STYLES;
        document.head.appendChild(style);
    }

    function getOrCreateSearchContainer() {
        if (window.__nsSearchContainer) return window.__nsSearchContainer;

        let container = document.createElement('div');
        container.id = 'ns-filter-container';
        container.className = 'ns-filter-container';

        const wrapper = document.createElement('div');
        wrapper.className = 'ns-filter-wrapper';

        const input = document.createElement('input');
        input.id = 'ns-filter-search-input';
        input.placeholder = "Filtrar opciones...";
        input.className = "ns-filter-input";
        
        // Detener eventos para prevenir que NetSuite capture el tipeo (excepto Flechas para navegación nativa)
        input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                // Al permitir propagación, NetSuite recibe el evento y mueve su selección interna
                return;
            }
            e.stopPropagation();
        });
        input.addEventListener('keypress', (e) => e.stopPropagation());
        input.addEventListener('keyup', (e) => e.stopPropagation());
        
        // Prevenir que un click dentro del input cierre el menu
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
                    applyFilter(val, dropdown);
                });
            }, 150); // Mínimo retardo para no frizar UI tipiando rápido
        });

        clearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            input.value = '';
            const dropdown = container.closest(DROPDOWN_SELECTORS) || document.body;
            applyFilter('', dropdown);
            clearBtn.style.display = 'none';
            counter.style.display = 'none';
            input.focus();
        });
        
        wrapper.appendChild(input);
        wrapper.appendChild(counter);
        wrapper.appendChild(clearBtn);
        container.appendChild(wrapper);
        
        window.__nsSearchContainer = container;
        document.body.appendChild(container); // Lo dejamos oculto en el root
        return container;
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
            
            // Buscar la primera coincidencia de cualquiera de los términos
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
                    // Recursividad obligada en la cola sobrante
                    addHighlights(afterNode, terms);
                } else {
                    node.parentNode.replaceChild(fragment, node);
                }
            }
        } else if (node.nodeType === 1 && node.nodeName !== 'SCRIPT' && node.nodeName !== 'STYLE') {
            Array.from(node.childNodes).forEach(child => addHighlights(child, terms));
        }
    }

    let fastAliasMap = new Map();
    let mapBuilt = false;
    let mapBuildingInProgress = false;
    let hasActiveHighlights = false; // Flag para skip de removeHighlights

    const MAX_WALK_DEPTH = 10; // Límite de profundidad para evitar recorrido infinito

    function buildAliasMap(callback) {
        if (mapBuilt) { if (callback) callback(); return; }
        if (mapBuildingInProgress) { if (callback) callback(); return; }
        mapBuildingInProgress = true;
        
        // El secreto para Firefox: wrappedJSObject
        const pageWindow = typeof window.wrappedJSObject !== 'undefined' ? window.wrappedJSObject : window;
        
        // Recopilar las raíces a explorar
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

        // Recolectar trabajo en una cola BFS con límite de profundidad
        const seen = new Set();
        const queue = [];
        for (const root of roots) {
            queue.push({ node: root, depth: 0 });
        }

        function processChunk(deadline) {
            const hasIdleTime = typeof deadline !== 'undefined' && typeof deadline.timeRemaining === 'function';
            const chunkLimit = 500; // Nodos por chunk si no hay idle API
            let processed = 0;

            while (queue.length > 0) {
                // Ceder el hilo si se acabó el tiempo idle, o después de N nodos
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
                // Todavía hay trabajo, programar siguiente chunk
                if (typeof requestIdleCallback === 'function') {
                    requestIdleCallback(processChunk);
                } else {
                    setTimeout(() => processChunk({}), 0);
                }
            } else {
                // Completado
                mapBuilt = true;
                mapBuildingInProgress = false;
                console.log(`[NetSuite Extension] AliasMap construido: ${fastAliasMap.size} entradas`);
                if (callback) callback();
            }
        }

        // Iniciar procesamiento no-bloqueante
        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(processChunk);
        } else {
            setTimeout(() => processChunk({}), 0);
        }
    }

    function applyFilter(term, contextNode = document.body) {
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

        // Early-return rápido: cuando no hay términos, mostrar todo sin manipular DOM innecesariamente
        if (terms.length === 0) {
            // Solo limpiar highlights si los hay
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

        // Solo remover highlights si hay activos
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

            // Agarrar texto base asegurando limpieza agresiva de saltos de línea y nbsp ocultos
            const rawText = el.textContent.replace(/[\s\u00A0]+/g, ' ').trim().toLowerCase();
            const textBase = rawText.replace(/[()]/g, ' ').trim();
            
            // Extraer ID nativo y cachearlo en el DOM — solo exact-match O(1)
            if (!el.hasAttribute('data-ns-id')) {
                const id = fastAliasMap.get(rawText) || fastAliasMap.get(textBase) || 'unknown';
                el.setAttribute('data-ns-id', id);
            }

            const nsId = el.getAttribute('data-ns-id');
            
            // Búsqueda simple: Texto visual + ID oculto
            const searchableText = rawText + ' ' + textBase + ' ' + nsId;
            const isMatch = terms.every(t => searchableText.includes(t));

            el.style.display = isMatch ? "" : "none";
            
            if (isMatch) {
                matchCount++;
                addHighlights(el, terms);
                hasActiveHighlights = true;
            }
        });

        // Actualizar contador
        const counter = document.getElementById('ns-filter-counter');
        if (counter) {
            counter.textContent = `${matchCount} resultado${matchCount !== 1 ? 's' : ''}`;
        }
    }

    function init() {
        console.log("Extensión NetSuite cargada: Motor de Filtrado Optimizado");
        injectStyles();
        const searchContainer = getOrCreateSearchContainer();
        const searchInput = document.getElementById('ns-filter-search-input');
        
        let activeDropdown = null;
        let isDropdownLocked = false;
        
        // Anti-Cierre: Un observador exclusivamente para el dropdown activo, para evitar que NetSuite lo cierre
        const stateGuardian = new MutationObserver((mutations) => {
            if (!activeDropdown || !isDropdownLocked) return;
            for (let m of mutations) {
                if (m.type === 'attributes' && (m.attributeName === 'style' || m.attributeName === 'class')) {
                    if (activeDropdown.style.display === 'none' || activeDropdown.style.visibility === 'hidden') {
                        // NetSuite intentó cerrarlo. Si estamos enfocados en la búsqueda, lo reabrimos a la fuerza.
                        if (document.activeElement === searchInput || searchContainer.contains(document.activeElement)) {
                            activeDropdown.classList.add('ns-dropdown-locked');
                        }
                    }
                }
            }
        });

        function injectIntoDropdown(node) {
            if (activeDropdown === node && searchContainer.parentNode === node) return;
            
            // Comprobar que realmente es visible (ancho/alto > 0 indica que está pintado)
            const rect = node.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;

            // Desvincular de dropdown anterior
            stateGuardian.disconnect();
            
            activeDropdown = node;
            activeDropdown.prepend(searchContainer);
            searchContainer.style.display = 'block';
            searchInput.value = '';
            
            // Lazy build: construir el alias map la primera vez que se abre un dropdown
            buildAliasMap(() => {
                applyFilter('', activeDropdown);
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

        // Buscar en el DOM y determinar si debemos inyectar
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
                // Si el usuario da clic fuera legítimamente, cerramos el lock de NetSuite
                closeDropdown();
            }
        }

        // Eventos nativos robustos
        document.addEventListener('mousedown', (e) => {
            if (e.target.closest('#ns-filter-container')) return;
            
            // NetSuite muestra el panel en la fase asíncrona tras el mousedown
            setTimeout(scanForVisibleDropdowns, 50);
            setTimeout(scanForVisibleDropdowns, 200);
            
            // Si el user hace clic en otro lado, quitamos el lock global
            if (activeDropdown && !activeDropdown.contains(e.target)) {
                closeDropdown();
            }
        }, true); // Captura fase para asegurar prelación
    }

    // Comprobación SPA inicial (arranca una sola vez de forma estricta)
    const bootCheck = setInterval(() => {
        if (window.location.pathname.includes('app/common/search/search.nl')) {
            if (!window.__nsFilterInitDone) {
                window.__nsFilterInitDone = true;
                clearInterval(bootCheck);
                init();
            }
        }
    }, 1000);
}