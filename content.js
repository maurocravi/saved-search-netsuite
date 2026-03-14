// Polyfill fallback por si el scope se aísla
const extBrowser = typeof browser !== 'undefined' ? browser : chrome;

// Clases CSS extraídas de Tailwind que se necesitan para el input
// Evitamos inyectar CDN para no romper las CSP ni el diseño NetSuite por el 'preflight'
const TAILWIND_STYLES = `
.ns-filter-input {
    padding: 0.5rem;
    margin: 0.5rem;
    border-width: 2px;
    border-style: solid;
    border-color: #3b82f6; 
    border-radius: 0.375rem; 
    width: 16rem;      
    position: fixed;   
    top: 1rem;         
    right: 1rem;       
    z-index: 9999;     
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    background-color: white;
    color: black;
    outline: none;
    box-sizing: border-box;
}
.ns-filter-input:focus {
    border-color: #2563eb; 
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
    let input = document.getElementById('ns-filter-search-input');
    if (!input) {
        input = document.createElement('input');
        input.id = 'ns-filter-search-input';
        input.placeholder = "Filtrar campos...";
        input.className = "ns-filter-input";
        
        // Evitar que el keypress en el input dispare eventos de la app NetSuite
        input.addEventListener('keydown', (e) => e.stopPropagation());
        
        input.addEventListener('input', (e) => {
            applyFilter(e.target.value);
        });
        
        document.body.appendChild(input);
    }
    return input;
}

function applyFilter(term) {
    term = term.toLowerCase();
    // ".uir-list-row-tr" captura filas de Results, Filters y cualquier otra tabla estándar.
    const rows = document.querySelectorAll('.uir-list-row-tr');
    
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(term) ? "" : "none";
    });
}

function init() {
    injectStyles();
    const searchInput = getOrCreateSearchInput();
    
    // Configurar MutationObserver para capturar cambios en el DOM asíncronamente
    // Buscamos un contenedor raíz; document.body cubre todo pero '#main_form' es buena idea si existe.
    const formContainer = document.getElementById('main_form') || document.body;
    
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
                applyFilter(searchInput.value);
            }
        }
    });

    observer.observe(formContainer, { childList: true, subtree: true });
}

// Iniciar cuando el DOM se cargue (aún si la tabla de NetSuite no terminó)
window.addEventListener('load', init);