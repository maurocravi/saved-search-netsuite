// Polyfill fallback por si el scope se aísla
const extBrowser = typeof browser !== 'undefined' ? browser : chrome;

// Evitar inicializaciones duplicadas en single-page applications o hot reloads múltiples
if (!window.__nsFilterExtensionLoaded) {
    window.__nsFilterExtensionLoaded = true;

    // Clases CSS con truco de :focus-within para mantener vivo el dropdown de NetSuite
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
    /* Mágico: Si el usuario enfoca nuestro input, forzamos a NetSuite a mantener visible la caja evitando que el evento 'blur' colapse todo */
    .ns-dropdown-active:focus-within {
        display: block !important;
        visibility: visible !important;
    }
    `;

    const DROPDOWN_SELECTORS = [
        '.uir-field-choices',
        '.dropdownDiv',
        '.listboxcontainer',
        '.uir-select-popup',
        '[id^="dropdown_"]',
        'div[id*="dropdown"]',
        'div[class*="dropdown"]'
    ].join(', ');

    function isDropdownNode(node) {
        if (node.nodeType !== 1) return false;
        if (node.id === 'ns-filter-container') return false;
        return node.matches && node.matches(DROPDOWN_SELECTORS);
    }

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
        
        input.addEventListener('keydown', (e) => e.stopPropagation());
        
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

        clearBtn.addEventListener('click', () => {
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
        document.body.appendChild(container);
        return container;
    }

    function applyFilter(term, contextNode = document.body) {
        term = term.toLowerCase();
        let elementsToFilter = [];
        
        if (contextNode !== document.body && contextNode.matches(DROPDOWN_SELECTORS)) {
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
        console.log("Extensión NetSuite cargada de forma segura - Inicializando observadores");
        injectStyles();
        const searchContainer = getOrCreateSearchContainer();
        const searchInput = document.getElementById('ns-filter-search-input');
        let activeDropdown = null;
        
        function injectIntoDropdown(node) {
            if (activeDropdown === node && searchContainer.parentNode === node) return;
            
            const style = window.getComputedStyle(node);
            if (style.display === 'none' || style.visibility === 'hidden') return;

            activeDropdown = node;
            activeDropdown.classList.add('ns-dropdown-active'); 
            activeDropdown.prepend(searchContainer);
            searchContainer.style.display = 'block';
            searchInput.value = '';
            applyFilter('', activeDropdown);
            
            setTimeout(() => {
                searchInput.focus();
            }, 50);
        }

        function closeDropdown() {
            searchContainer.style.display = 'none';
            document.body.appendChild(searchContainer); // Salvaguardar contenedor reseteándolo al body
            if (activeDropdown) {
                activeDropdown.classList.remove('ns-dropdown-active');
            }
            activeDropdown = null;
        }

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (isDropdownNode(node)) {
                            injectIntoDropdown(node);
                        } else if (node.nodeType === 1) {
                            const subDrops = node.querySelectorAll(DROPDOWN_SELECTORS);
                            subDrops.forEach(injectIntoDropdown);
                        }
                    });
                }
                if (mutation.type === 'attributes' && (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
                    const node = mutation.target;
                    if (isDropdownNode(node)) {
                        const style = window.getComputedStyle(node);
                        const isVisible = style.display !== 'none' && style.visibility !== 'hidden';
                        
                        // Si NetSuite aplica estilos inline explícitos para ocultarlo, debemos soltar el seguro de :focus-within
                        const isInlineHidden = node.style.display === 'none' || node.style.visibility === 'hidden';
                        
                        if (isVisible && !isInlineHidden) {
                            injectIntoDropdown(node);
                        } else if ((!isVisible || isInlineHidden) && activeDropdown === node) {
                            closeDropdown();
                        }
                    }
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });

        // Respaldo de seguridad en caso de que un clíc abra un repintado asíncrono invisible al observer inicial
        document.addEventListener('mousedown', (e) => {
            if (e.target.closest('#ns-filter-container')) return;
            
            setTimeout(() => {
                const dropdowns = document.querySelectorAll(DROPDOWN_SELECTORS);
                for (let node of dropdowns) {
                    if (node.id === 'ns-filter-container') continue;
                    const style = window.getComputedStyle(node);
                    const isInlineHidden = node.style.display === 'none' || node.style.visibility === 'hidden';
                    
                    if (style.display !== 'none' && style.visibility !== 'hidden' && !isInlineHidden) {
                        injectIntoDropdown(node);
                        break;
                    }
                }
            }, 100);
        });
    }

    // Comprobación SPA defensiva. Asegurar que init solo ruede una vez.
    setInterval(() => {
        if (window.location.pathname.includes('app/common/search/search.nl')) {
            if (!window.__nsFilterInitDone) {
                window.__nsFilterInitDone = true;
                init();
            } else if (!document.getElementById('ns-filter-container') && window.__nsSearchContainer) {
                // Si NetSuite reescribió el sub-DOM destructivamente, lo re-anclamos al Body
                document.body.appendChild(window.__nsSearchContainer);
            }
        }
    }, 1000);
}