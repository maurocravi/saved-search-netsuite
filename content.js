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

    let globalAliasMap = [];
    let fastAliasMap = new Map();

    // Ahora el mapeo se delega al puente asíncrono (Main World Injection)
    function buildAliasMap() {
        if (globalAliasMap.length === 0) {
            console.log("[NetSuite Extension] Esperando datos del puente de inyección asincróno (NS_DICT_DATA)...");
        }
    }

    // Extraedor profundo de atributos ocultos: Busca valores dentro de eventos JS como fieldhelp.nl?f=entityid
    function getHiddenData(node) {
        let data = new Set();
        const walk = (n) => {
            if (n.nodeType === 1) {
                ['id', 'value', 'data-value', 'data-id', 'name', 'title', 'onmousedown', 'onclick'].forEach(attr => {
                    const val = n.getAttribute(attr);
                    if (val) {
                        data.add(val.toLowerCase());
                        
                        // Extracción heurística rigurosa: Si el atributo es un evento JS que abre un popup de ayuda de NetSuite
                        // Ej: nsapiShowFieldHelp('.../fieldhelp.nl?f=entityid&...')
                        if (attr === 'onclick' || attr === 'onmousedown') {
                            const helpMatch = val.match(/[?&]f=([^&']+)/i);
                            if (helpMatch && helpMatch[1]) {
                                data.add(helpMatch[1].toLowerCase());
                            }
                        }
                    }
                });
                const children = n.children;
                for (let i = 0; i < children.length; i++) {
                    walk(children[i]);
                }
            }
        };
        walk(node);
        return Array.from(data).join(' ');
    }

    function applyFilter(term, contextNode = document.body) {
        const terms = term.trim().toLowerCase().split(/\s+/).filter(t => t);
        let elementsToFilter = [];
        
        buildAliasMap(); // Siempre reconstruir, asegura atrapar options inyectados por peticiones asincronas
        
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
        
        let matchCount = 0;
        let insertionRowCount = 0;

        elementsToFilter.forEach(el => {
            if (!el) return;
            if (el.id === 'ns-filter-container' || el.closest('#ns-filter-container')) return;

            const elId = el.id || "";
            // Restaurar estilo e intentar purgar highlights viejos antes de evaluar
            removeHighlights(el);

            if (elId.endsWith('_addedit') || el.classList.contains('uir-machine-addrow')) {
                el.style.display = "";
                insertionRowCount++;
                return;
            }

            if (terms.length === 0) {
                el.style.display = "";
                matchCount++;
                return;
            }

            // Agarrar texto base asegurando limpieza agresiva de saltos de línea y nbsp ocultos
            const rawText = el.textContent.replace(/[\s\u00A0]+/g, ' ').trim().toLowerCase();
            const textBase = rawText.replace(/[()]/g, ' ').trim();
            
            // Extracción instantánea sin loops anidados
            let aliasText = fastAliasMap.get(rawText) || fastAliasMap.get(textBase) || '';

            // Atributos y Eventos ocultos
            const hiddenData = getHiddenData(el).toLowerCase().replace(/[()]/g, ' ');

            // Combinar todos los vectores de búsqueda en un macro string eficiente. 
            // Al estar todos concatenados, si pones un término y coincide con Name OR con ID, lo encuentra.
            const searchableText = (textBase + ' ' + aliasText + ' ' + hiddenData + ' ' + elId.replace(/[()]/g, ' ')).toLowerCase();
            
            // Requerir coincidencia exacta tipo AND para las palabras de la búsqueda, 
            // pero que dichas palabras puedan estar sobre CUALQUIER elemento del OR (Texto, Titulo, o ID)
            const isMatch = terms.every(t => searchableText.includes(t));

            el.style.display = isMatch ? "" : "none";
            
            if (isMatch) {
                matchCount++;
                addHighlights(el, terms);
                // Debug console.log (SOLO para coincidencias, para no saturar 5000 lineas, o lo mostramos para los primeros 3)
                if (matchCount <= 5) {
                    console.log(`[NetSuite Extension Debug] Coincidencia #${matchCount}:`, {
                        texto_limpio: textBase, 
                        ids_ocultos_o_alias: (aliasText + ' ' + hiddenData).trim(),
                        buscado_con: terms.join(' ')
                    });
                }
            }
        });

        // Actualizar contador
        const counter = document.getElementById('ns-filter-counter');
        if (counter) {
            if (terms.length > 0) {
                counter.textContent = `${matchCount} resultado${matchCount !== 1 ? 's' : ''}`;
            } else {
                counter.textContent = '';
            }
        }
    }

    function init() {
        console.log("Extensión NetSuite cargada: Motor de Filtrado Optimizado");
        
        // ==========================================
        // ESPIA DEL MAIN WORLD (Detección de Arrays Globales de NetSuite)
        // ==========================================
        window.addEventListener('message', function(event) {
            // Recibir los datos del script espía inyectado
            if (event.source === window && event.data && event.data.type === 'NS_DICT_DATA') {
                globalAliasMap = event.data.payload;
                fastAliasMap.clear();
                globalAliasMap.forEach(item => {
                    fastAliasMap.set(item.text, item.value); // Clave exacta -> ID exacto
                });
                console.log(`[NetSuite Extension] Recibidos ${globalAliasMap.length} alias de campos desde NetSuite Global Window.`);
            }
        });

        // Inyectamos un script que corra en el contexto de la página nativa
        const spyScript = document.createElement('script');
        spyScript.textContent = `
            (function() {
                try {
                    console.log("[NetSuite Extension] Iniciando extractor Main World dirigido a NS y _dynamicData...");
                    let localMap = [];
                    let seen = new Set();

                    function extractFrom(obj) {
                        if (!obj || typeof obj !== 'object') return;
                        if (seen.has(obj)) return; // Evitar loops infinitos
                        seen.add(obj);

                        if (Array.isArray(obj)) {
                            for (let i = 0; i < obj.length; i++) {
                                let item = obj[i];
                                // Detectar forma ['id', 'texto']
                                if (Array.isArray(item) && item.length >= 2 && typeof item[0] === 'string' && typeof item[1] === 'string') {
                                    localMap.push({ value: item[0], text: item[1] });
                                } else {
                                    extractFrom(item);
                                }
                            }
                        } else {
                            // Buscar propiedades típicas de NetSuite para combos
                            let val = obj.value || obj.id || obj.internalid;
                            let txt = obj.text || obj.label || obj.name;
                            
                            if (typeof val === 'string' && typeof txt === 'string' && val.trim() !== '') {
                                localMap.push({ value: val, text: txt });
                            }
                            
                            // Entrar a las sub-propiedades
                            for (let k in obj) {
                                try {
                                    if (Object.prototype.hasOwnProperty.call(obj, k)) {
                                        extractFrom(obj[k]);
                                    }
                                } catch(e) {}
                            }
                        }
                    }

                    // Escanear solo las variables donde sabemos que está la data
                    if (window.NS) extractFrom(window.NS);
                    if (window._dynamicData) extractFrom(window._dynamicData);

                    // Limpiar y filtrar resultados
                    let finalMap = [];
                    let uniqueIds = new Set();
                    for (let item of localMap) {
                        let v = item.value.replace(/[\\s\\u00A0]+/g, ' ').trim().toLowerCase();
                        let t = item.text.replace(/[\\s\\u00A0]+/g, ' ').trim().toLowerCase();
                        
                        // Los IDs internos de NetSuite rara vez tienen espacios y miden más de 1 caracter
                        if (v && t && !v.includes(' ') && v.length > 1) {
                            let key = v + '|' + t;
                            if (!uniqueIds.has(key)) {
                                uniqueIds.add(key);
                                finalMap.push({ value: v, text: t });
                            }
                        }
                    }

                    if (finalMap.length > 0) {
                        console.log("[NetSuite Extension] Extracción exitosa. Enviando " + finalMap.length + " pares a la extensión.");
                        window.postMessage({ type: 'NS_DICT_DATA', payload: finalMap }, '*');
                    } else {
                        console.log("[NetSuite Extension] No se encontraron datos útiles en el escaneo.");
                    }
                } catch(e) {
                    console.error("[NetSuite Extension] Error en inyección Main World:", e);
                }
            })();
        `;
        document.documentElement.appendChild(spyScript);
        // Limpiamos el nodo tras ejecutar para no dejar basura en el DOM
        spyScript.remove();

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
            applyFilter('', activeDropdown);
            
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

        // Observador global ultraligero: solo vigila inserciones en el DOM (no style/class) para no colgar Firefox
        const domObserver = new MutationObserver((mutations) => {
            let hasAddedElement = false;
            for (let m of mutations) {
                if (m.addedNodes.length > 0) {
                    hasAddedElement = true;
                    break;
                }
            }
            if (hasAddedElement) {
                requestAnimationFrame(scanForVisibleDropdowns);
            }
        });

        domObserver.observe(document.body, { childList: true, subtree: true });

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