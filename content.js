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
        
        // Detener eventos para prevenir que NetSuite capture el tipeo
        input.addEventListener('keydown', (e) => e.stopPropagation());
        input.addEventListener('keypress', (e) => e.stopPropagation());
        input.addEventListener('keyup', (e) => e.stopPropagation());
        
        // Prevenir que un click dentro del input cierre el menu
        input.addEventListener('mousedown', (e) => e.stopPropagation());
        input.addEventListener('click', (e) => e.stopPropagation());
        
        const clearBtn = document.createElement('button');
        clearBtn.innerHTML = '&#x2715;'; 
        clearBtn.className = 'ns-filter-clear';
        clearBtn.style.display = 'none'; 
        clearBtn.type = 'button';
        clearBtn.title = 'Limpiar búsqueda';

        input.addEventListener('input', (e) => {
            const dropdown = container.closest(DROPDOWN_SELECTORS) || document.body;
            applyFilter(e.target.value, dropdown);
            clearBtn.style.display = e.target.value ? 'block' : 'none';
        });

        clearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            input.value = '';
            const dropdown = container.closest(DROPDOWN_SELECTORS) || document.body;
            applyFilter('', dropdown);
            clearBtn.style.display = 'none';
            input.focus();
        });
        
        wrapper.appendChild(input);
        wrapper.appendChild(clearBtn);
        container.appendChild(wrapper);
        
        window.__nsSearchContainer = container;
        document.body.appendChild(container); // Lo dejamos oculto en el root
        return container;
    }

    function applyFilter(term, contextNode = document.body) {
        term = term.toLowerCase();
        let elementsToFilter = [];
        
        if (contextNode !== document.body) {
            // Filtrado estricto dentro del dropdown
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
        
        elementsToFilter.forEach(el => {
            if (!el) return;
            if (el.id === 'ns-filter-container' || el.closest('#ns-filter-container')) return;

            const elId = el.id || "";
            if (elId.endsWith('_addedit') || el.classList.contains('uir-machine-addrow')) {
                el.style.display = "";
                return;
            }

            const text = el.innerText.toLowerCase();
            el.style.display = text.includes(term) ? "" : "none";
        });
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