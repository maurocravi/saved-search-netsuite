// Polyfill fallback por si el scope se aísla
const extBrowser = typeof browser !== 'undefined' ? browser : chrome;

// Clases CSS extraídas de Tailwind que se necesitan para el input
// Evitamos inyectar CDN para no romper las CSP ni el diseño NetSuite por el 'preflight'
const TAILWIND_STYLES = `
.ns-filter-container {
    display: none; /* Oculto por defecto hasta que se abra un dropdown */
    width: 100%;
    padding: 0.5rem;
    box-sizing: border-box;
    background-color: #f3f4f6; /* Fondo ligero para la caja del buscador */
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
`;

function injectStyles() {
    if (document.getElementById('ns-filter-styles')) return;
    const style = document.createElement('style');
    style.id = 'ns-filter-styles';
    style.textContent = TAILWIND_STYLES;
    document.head.appendChild(style);
}

function getOrCreateSearchContainer() {
    let container = document.getElementById('ns-filter-container');
    
    if (!container) {
        container = document.createElement('div');
        container.id = 'ns-filter-container';
        container.className = 'ns-filter-container';

        const wrapper = document.createElement('div');
        wrapper.className = 'ns-filter-wrapper';

        const input = document.createElement('input');
        input.id = 'ns-filter-search-input';
        input.placeholder = "Filtrar opciones...";
        input.className = "ns-filter-input";
        
        // Evitar que el keypress dispare navegación de NS
        input.addEventListener('keydown', (e) => e.stopPropagation());
        
        const clearBtn = document.createElement('button');
        clearBtn.innerHTML = '&#x2715;'; 
        clearBtn.className = 'ns-filter-clear';
        clearBtn.style.display = 'none'; 
        clearBtn.type = 'button';
        clearBtn.title = 'Limpiar búsqueda';

        input.addEventListener('input', (e) => {
            // El dropdown activo es el ancestro principal del input en este momento
            const dropdown = container.closest('.uir-field-choices, [id^="dropdown_"]') || document.body;
            applyFilter(e.target.value, dropdown);
            clearBtn.style.display = e.target.value ? 'block' : 'none';
        });

        clearBtn.addEventListener('click', () => {
            input.value = '';
            const dropdown = container.closest('.uir-field-choices, [id^="dropdown_"]') || document.body;
            applyFilter('', dropdown);
            clearBtn.style.display = 'none';
            input.focus();
        });
        
        wrapper.appendChild(input);
        wrapper.appendChild(clearBtn);
        container.appendChild(wrapper);
        // Lo creamos inicialmente en caché dentro de body
        document.body.appendChild(container);
    }
    return container;
}

function applyFilter(term, contextNode = document.body) {
    term = term.toLowerCase();
    
    // Buscar filas O items de dropdown dentro del contexto activo
    // .uir-list-row-tr y .uir-machine-row aplican para tablas de variables,
    // .uir-dropdown-item (o similar) puede aplicar para selects transformados
    const selectors = '.uir-machine-table tr.uir-list-row-tr, .uir-machine-table tr.uir-machine-row, #filter_splits tr, #column_splits tr, tr.uir-list-row-tr, tr.uir-machine-row, .dropdown-row, tr';
    const rows = contextNode.querySelectorAll(selectors);
    
    rows.forEach(row => {
        // Ignorar nuestra propia fila contenedor o input
        if (row.id === 'ns-filter-container' || row.closest('#ns-filter-container')) return;

        // Preservar siempre la fila vacía de inserción
        const rowId = row.id || "";
        if (rowId.endsWith('_addedit') || row.classList.contains('uir-machine-addrow')) {
            row.style.display = "";
            return;
        }

        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(term) ? "" : "none";
    });
}

function init() {
    console.log("Extensión NetSuite cargada en editor");
    injectStyles();
    const searchContainer = getOrCreateSearchContainer();
    const searchInput = document.getElementById('ns-filter-search-input');
    let activeDropdown = null;
    
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            // NetSuite muestra el dropdown montándolo al body o alterando su display.
            // Los elementos habituales incluyen .uir-field-choices o divs flotantes generados dinámicamente.
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) { // ELEMENT_NODE
                        // Comprobar si NetSuite acaba de crear o mostrar un dropdown selection div.
                        if (node.classList && (node.classList.contains('uir-field-choices') || node.id.startsWith('dropdown_') || node.matches('div[id*="dropdown"]'))) {
                            activeDropdown = node;
                            
                            // Mover nuestro contenedor como hijo principal y hacerlo visible
                            activeDropdown.prepend(searchContainer);
                            searchContainer.style.display = 'block';
                            
                            // Resetear el valor
                            searchInput.value = '';
                            applyFilter('', activeDropdown);
                            setTimeout(() => searchInput.focus(), 50);
                        }
                    }
                });
            }
            // Capturar si un dropdown existente que estaba en display: none ahora  es visible
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const node = mutation.target;
                if (node.classList && (node.classList.contains('uir-field-choices') || node.id.startsWith('dropdown_') || node.matches('div[id*="dropdown"]'))) {
                    if (window.getComputedStyle(node).display !== 'none' && activeDropdown !== node) {
                        activeDropdown = node;
                        activeDropdown.prepend(searchContainer);
                        searchContainer.style.display = 'block';
                        searchInput.value = '';
                        applyFilter('', activeDropdown);
                        setTimeout(() => searchInput.focus(), 50);
                    } else if (window.getComputedStyle(node).display === 'none' && activeDropdown === node) {
                        // El dropdown se cerró
                        searchContainer.style.display = 'none';
                        document.body.appendChild(searchContainer); // devolver al body para caché
                        activeDropdown = null;
                    }
                }
            }
        }
    });

    // Observar tanto el DOM como los atributos CSS style del body y sus hijos
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
}

// Iniciar usando comprobación recurrente para manejo dinámico
setInterval(() => {
    // Validar el contexto: Ejecutar solo si estamos en la edición/creación de un Saved Search
    if (window.location.pathname.includes('app/common/search/search.nl')) {
        if (!document.getElementById('ns-filter-container')) {
            init();
        }
    }
}, 1000);