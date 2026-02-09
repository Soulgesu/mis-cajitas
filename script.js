const STORAGE_KEY = "cajitas_grupos_personalizados_v3";

// --- INICIALIZACIÓN DE TEMA ---
const currentTheme = localStorage.getItem("theme") || "dark";
document.documentElement.setAttribute("data-theme", currentTheme);

const themeBtn = document.createElement("button");
themeBtn.className = "theme-btn";
document.body.appendChild(themeBtn);

themeBtn.onclick = () => {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const newTheme = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    showToast(newTheme === "dark" ? "Modo Oscuro" : "Modo Claro");
};

// --- SELECTORES ---
const newGroupName = document.getElementById("newGroupName");
const createGroupBtn = document.getElementById("createGroupBtn");
const input = document.getElementById("input");
const groupSelect = document.getElementById("groupSelect");
const addBtn = document.getElementById("addBtn");
const clearAllBtn = document.getElementById("clearAllBtn");
const groupsEl = document.getElementById("groups");
const toast = document.getElementById("toast");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const fileInput = document.getElementById("fileInput");

const generateId = () => crypto?.randomUUID?.() || Math.random().toString(36).substring(2, 15);

let state = load();

// --- MODO COMPACTO ---
const toggleBtn = document.createElement("button");
toggleBtn.className = "floating-btn";
document.body.appendChild(toggleBtn);
toggleBtn.onclick = () => {
    const isCompactNow = document.body.classList.toggle("is-compact");
    toggleBtn.classList.toggle("is-active", isCompactNow);
    document.querySelectorAll('.group').forEach(g => g.draggable = !isCompactNow);
    render();
    showToast(isCompactNow ? "Vista Compacta" : "Vista Edición");
};

function load() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : { 
            groups: [{id: generateId(), name:"Ejemplo Grupo", items:[{id: generateId(), text: "Clic para copiar"}]}] 
        };
    } catch { return { groups: [] }; }
}

function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    render();
}

function markError(el) {
    el.classList.add("error-shake");
    setTimeout(() => el.classList.remove("error-shake"), 400);
    el.focus();
}

// --- BACKUP ---
function exportData() {
    const dataStr = JSON.stringify(state, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', `cajitas_v3_${new Date().toISOString().slice(0,10)}.json`);
    link.click();
}

function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const imported = JSON.parse(event.target.result);
            if (imported.groups && confirm("¿Sobrescribir datos?")) {
                state = imported;
                save();
                showToast("Importado ✅");
            }
        } catch { alert("Error en JSON"); }
        fileInput.value = "";
    };
    reader.readAsText(file);
}

function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 1000);
}

async function copyText(text, element) {
    try {
        await navigator.clipboard.writeText(text);
        
        if (element) {
            element.classList.add("copy-success");
            setTimeout(() => {
                element.classList.remove("copy-success");
            }, 500);
        }
    } catch { 
        showToast("Error al copiar ❌"); 
    }
}

function refreshSelect() {
    const prevValue = groupSelect.value;
    groupSelect.innerHTML = "";
    if (state.groups.length === 0) {
        groupSelect.innerHTML = "<option value=''>Crea un grupo...</option>";
        groupSelect.disabled = true;
    } else {
        groupSelect.disabled = false;
        state.groups.forEach(g => {
            const opt = document.createElement("option");
            opt.value = g.id; opt.textContent = g.name;
            groupSelect.appendChild(opt);
        });
        if (state.groups.some(g => g.id === prevValue)) groupSelect.value = prevValue;
    }
}

// --- CRUD ---
function createGroup() {
    const name = newGroupName.value.trim();
    if (!name) return markError(newGroupName);
    state.groups.unshift({ id: generateId(), name, items: [] });
    newGroupName.value = "";
    save();
}

function renameGroup(id) {
    const g = state.groups.find(x => x.id === id);
    const n = prompt("Nuevo nombre:", g.name);
    if (n?.trim()) { g.name = n.trim(); save(); }
}

function deleteGroup(id) {
    if (confirm("¿Eliminar grupo?")) {
        state.groups = state.groups.filter(x => x.id !== id);
        save();
    }
}

function addItem() {
    const val = input.value.trim();
    const g = state.groups.find(x => x.id === groupSelect.value);
    if (!val) return markError(input);
    if (!g) return alert("Selecciona un grupo");
    g.items.unshift({ id: generateId(), text: val });
    input.value = "";
    save();
}

function editItem(gid, iid) {
    const g = state.groups.find(x => x.id === gid);
    const item = g.items.find(x => x.id === iid);
    const n = prompt("Editar:", item.text);
    if (n?.trim()) { item.text = n.trim(); save(); }
}

function deleteItem(gid, iid) {
    const g = state.groups.find(x => x.id === gid);
    g.items = g.items.filter(x => x.id !== iid);
    save();
}

function clearGroup(id) {
    const g = state.groups.find(x => x.id === id);
    if (confirm(`¿Vaciar ${g.name}?`)) { g.items = []; save(); }
}

// --- DRAG & DROP ---
function initDragAndDrop(el) {
    el.addEventListener('dragstart', (e) => {
        if (document.body.classList.contains("is-compact")) return e.preventDefault();
        el.classList.add('dragging');
    });

    el.addEventListener('dragend', () => {
        el.classList.remove('dragging');
        const newOrder = Array.from(groupsEl.querySelectorAll('.group')).map(gEl => 
            state.groups.find(g => g.id === gEl.dataset.id)
        );
        state.groups = newOrder;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        refreshSelect();
    });

    el.addEventListener('dragover', (e) => {
        e.preventDefault();
        const dragging = document.querySelector('.dragging');
        if (!dragging || dragging === el) return;
        const rect = el.getBoundingClientRect();
        const next = (e.clientY > rect.top + rect.height / 2) ? el.nextSibling : el;
        groupsEl.insertBefore(dragging, next);
    });
}

function render() {
    refreshSelect();
    groupsEl.innerHTML = "";
    if (state.groups.length === 0) {
        groupsEl.innerHTML = "<div class='empty'>No hay grupos creados.</div>";
        return;
    }

    const isCompact = document.body.classList.contains("is-compact");

    state.groups.forEach(g => {
        if (isCompact && g.items.length === 0) return;

        const sec = document.createElement("section");
        sec.className = "group";
        sec.draggable = !isCompact;
        sec.dataset.id = g.id;
        initDragAndDrop(sec);

        sec.innerHTML = `
            <div class="ghead">
                <div>
                    <span class="drag-handle">☰</span>
                    <p class="gname">${g.name} — ${g.items.length}</p>
                </div>
                <div class="gtools">
                    <button class="mini btn-rename" onclick="renameGroup('${g.id}')">Renombrar</button>
                    <button class="mini btn-clear" onclick="clearGroup('${g.id}')">Vaciar</button>
                    <button class="mini btn-delete" onclick="deleteGroup('${g.id}')">Borrar</button>
                </div>
            </div>
            <div class="grid"></div>
        `;

        const grid = sec.querySelector(".grid");
        if (g.items.length === 0) {
            grid.innerHTML = "<div class='empty'>Sin cajitas</div>";
        } else {
            g.items.forEach(item => {
                const card = document.createElement("div");
                card.className = "card";
                card.innerHTML = `
                    <div class="text">${item.text}</div>
                    <div class="actions">
                        <button class="a btn-edit">Editar</button>
                        <button class="a btn-del">Borrar</button>
                    </div>
                `;
                card.querySelector(".btn-edit").onclick = (e) => { e.stopPropagation(); editItem(g.id, item.id); };
                card.querySelector(".btn-del").onclick = (e) => { e.stopPropagation(); deleteItem(g.id, item.id); };
                card.onclick = () => copyText(item.text, card);
                grid.appendChild(card);
            });
        }
        groupsEl.appendChild(sec);
    });
}

// --- EVENTOS ---
createGroupBtn.onclick = createGroup;
addBtn.onclick = addItem;
clearAllBtn.onclick = () => confirm("¿BORRAR TODO?") && (state.groups = [], save());
exportBtn.onclick = exportData;
importBtn.onclick = () => fileInput.click();
fileInput.onchange = importData;
input.onkeydown = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") addItem(); };
newGroupName.onkeydown = (e) => { if (e.key === "Enter") createGroup(); };

// Registro del Service Worker para PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(console.error);
}

render();