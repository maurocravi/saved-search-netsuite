// Polyfill fallback por si el scope se aísla
const extBrowser = typeof browser !== 'undefined' ? browser : chrome;

// Clases CSS extraídas de Tailwind que se necesitan para el input
// Evitamos inyectar CDN para no romper las CSP ni el diseño NetSuite por el 'preflight'
const TAILWIND_STYLES = `
.ns-filter-container {
    position: fixed;   
    top: 3.5rem;       /* Move down to avoid top button ribbon in NetSuite editor */
    right: 2rem;       
    z-index: 9999;
    display: flex;
    align-items: center;
}
.ns-filter-input {
    padding: 0.5rem;
    padding-right: 2rem;
    border-width: 2px;
    border-style: solid;
    border-color: #3b82f6; 
    border-radius: 0.375rem; 
    width: 18rem;      
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
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

function getOrCreateSearchInput() {
    let container = document.getElementById('ns-filter-container');
    let input = document.getElementById('ns-filter-search-input');
    
    if (!container) {
        container = document.createElement('div');
        container.id = 'ns-filter-container';
        container.className = 'ns-filter-container';

        input = document.createElement('input');
        input.id = 'ns-filter-search-input';
        input.placeholder = "Filtrar campos...";
        input.className = "ns-filter-input";
        
        // Evitar que el keypress en el input dispare eventos de la app NetSuite
        input.addEventListener('keydown', (e) => e.stopPropagation());
        
        const clearBtn = document.createElement('button');
        clearBtn.innerHTML = '&#x2715;'; // X symbol
        clearBtn.className = 'ns-filter-clear';
        clearBtn.style.display = 'none'; // oculto inicialmente
        clearBtn.type = 'button';
        clearBtn.title = 'Limpiar búsqueda';

        input.addEventListener('input', (e) => {
            applyFilter(e.target.value);
            clearBtn.style.display = e.target.value ? 'block' : 'none';
        });

        clearBtn.addEventListener('click', () => {
            input.value = '';
            applyFilter('');
            clearBtn.style.display = 'none';
            input.focus();
        });
        
        container.appendChild(input);
        container.appendChild(clearBtn);
        document.body.appendChild(container);
    }
    return input;
}

function applyFilter(term) {
    term = term.toLowerCase();
    // ".uir-list-row-tr" captura filas de Results, Filters y cualquier otra tabla estándar.
    // En el modo edición, las sublistas también cargan bajo clases uir-machine-row o similares,
    // pero NetSuite típicamente conserva usabilidad sobre uir-list-row-tr o uir-machine-row.
    // Para las sublistas del editor de búsquedas (Criteria, Results), usamos 'tr.uir-list-row-tr, tr.uir-machine-row'.
    const rows = document.querySelectorAll('tr.uir-list-row-tr, tr.uir-machine-row');
    
    rows.forEach(row => {
        // Preservar siempre la fila vacía de inserción (donde se añade un nuevo criterio/resultado)
        const rowId = row.id || "";
        if (rowId.endsWith('_addedit') || row.classList.contains('uir-machine-addrow')) {
            row.style.display = "";
            return;
        }

        const cells = row.querySelectorAll('td');
        let text = '';
        // Buscar solo en la primera y segunda celda (índices 0 y 1)
        if (cells.length > 0) text += cells[0].innerText.toLowerCase() + ' ';
        if (cells.length > 1) text += cells[1].innerText.toLowerCase();

        row.style.display = text.includes(term) ? "" : "none";
    });
}

function init() {
    // Validar el contexto: Ejecutar solo si estamos en la edición/creación de un Saved Search
    if (!window.location.pathname.includes('app/common/search/search.nl')) {
        return; 
    }

    injectStyles();
    const searchInput = getOrCreateSearchInput();
    
    // Configurar MutationObserver para capturar cambios en el DOM asíncronamente
    // Al manipular sublistas o cambiar pestañas en el search.nl, el form cambia.
    const formContainer = document.body;
    
    const observer = new MutationObserver((mutations) => {
        let shouldRefilter = false;
        // Solo necesitamos saber si hubo NINGUNA mutación en nodos hijos. 
        // Si entra un nodo de fila nuevo, se debe re-aplicar
        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                shouldRefilter = true;
                break;
            }
        }

        if (shouldRefilter) {
            // Aplicar el filtro actual al nuevo DOM si tenemos un término escrito
            if (searchInput.value) {
                // Utiliza setTimeout para dejar que NetSuite renderice primero sus bindings
                setTimeout(() => applyFilter(searchInput.value), 50);
            }
        }
    });

    observer.observe(formContainer, { childList: true, subtree: true });
}

// Iniciar cuando el DOM se cargue
window.addEventListener('load', init);