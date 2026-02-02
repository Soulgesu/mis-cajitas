const STORAGE_KEY = "cajitas_grupos_personalizados_v2";

// Selectores de interfaz
const newGroupName = document.getElementById("newGroupName");
const createGroupBtn = document.getElementById("createGroupBtn");
const input = document.getElementById("input");
const groupSelect = document.getElementById("groupSelect");
const addBtn = document.getElementById("addBtn");
const clearAllBtn = document.getElementById("clearAllBtn");
const groupsEl = document.getElementById("groups");
const toast = document.getElementById("toast");

let state = load();

// Control de vista compacta
const toggleBtn = document.createElement("button");
toggleBtn.className = "floating-btn";
document.body.appendChild(toggleBtn);
toggleBtn.onclick = () => {
    document.body.classList.toggle("is-compact");
    const isCompact = document.body.classList.contains("is-compact");
    toggleBtn.classList.toggle("is-active", isCompact);
    showToast(isCompact ? "Modo Compacto" : "Modo Edición");
};

function load() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw === null) return { groups: [{id:crypto.randomUUID(), name:"Números", items:[]}, {id:crypto.randomUUID(), name:"Letras", items:[]}] };
        return JSON.parse(raw);
    } catch { return { groups: [] }; }
}

function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    render();
}

function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 1000);
}

async function copyText(text) {
    await navigator.clipboard.writeText(text);
    showToast("Copiado ✅");
}

function refreshSelect() {
    const prevValue = groupSelect.value;
    groupSelect.innerHTML = "";
    if (state.groups.length === 0) {
        groupSelect.innerHTML = "<option value=''>Crea un grupo primero...</option>";
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

function createGroup() {
    const name = newGroupName.value.trim();
    if (!name) return;
    state.groups.unshift({ id: crypto.randomUUID(), name, items: [] });
    newGroupName.value = "";
    save();
}

function renameGroup(id) {
    const g = state.groups.find(x => x.id === id);
    const n = prompt("Nuevo nombre:", g.name);
    if (n && n.trim()) { g.name = n.trim(); save(); }
}

function deleteGroup(id) {
    if (confirm("¿Borrar grupo y todo su contenido?")) {
        state.groups = state.groups.filter(x => x.id !== id);
        save();
    }
}

function addItem() {
    const val = input.value.trim();
    const gid = groupSelect.value;
    const g = state.groups.find(x => x.id === gid);
    if (val && g) {
        g.items.unshift({ id: crypto.randomUUID(), text: val });
        input.value = "";
        save();
    }
}

function editItem(gid, iid) {
    const g = state.groups.find(x => x.id === gid);
    const item = g.items.find(x => x.id === iid);
    const n = prompt("Editar:", item.text);
    if (n !== null && n.trim()) { item.text = n.trim(); save(); }
}

function deleteItem(gid, iid) {
    const g = state.groups.find(x => x.id === gid);
    g.items = g.items.filter(x => x.id !== iid);
    save();
}

function clearGroup(id) {
    const g = state.groups.find(x => x.id === id);
    if (confirm(`¿Vaciar "${g.name}"?`)) { g.items = []; save(); }
}

function clearAll() {
    if (confirm("¿BORRAR TODO PERMANENTEMENTE?")) { state.groups = []; save(); }
}

// Implementación de reordenamiento nativo
function initDragAndDrop(el) {
    el.addEventListener('dragstart', () => el.classList.add('dragging'));

    el.addEventListener('dragend', () => {
        el.classList.remove('dragging');
        // Sincronizar estado con el nuevo orden del DOM
        const newOrder = [];
        groupsEl.querySelectorAll('.group').forEach(groupEl => {
            const groupData = state.groups.find(g => g.id === groupEl.dataset.id);
            if (groupData) newOrder.push(groupData);
        });
        state.groups = newOrder;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        refreshSelect();
    });

    el.addEventListener('dragover', (e) => {
        e.preventDefault();
        const dragging = document.querySelector('.dragging');
        if (!dragging || dragging === el) return;
        
        const rect = el.getBoundingClientRect();
        const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
        groupsEl.insertBefore(dragging, next ? el.nextSibling : el);
    });
}

function render() {
    refreshSelect();
    groupsEl.innerHTML = "";
    if (state.groups.length === 0) {
        groupsEl.innerHTML = "<div class='empty'>No hay grupos creados.</div>";
        return;
    }

    state.groups.forEach(g => {
        const sec = document.createElement("section");
        sec.className = "group";
        sec.draggable = true;
        sec.dataset.id = g.id;
        initDragAndDrop(sec);

        sec.innerHTML = `
            <div class="ghead">
                <div style="display:flex;align-items:center;gap:8px">
                    <span class="drag-handle">☰</span>
                    <p class="gname">${g.name} — ${g.items.length}</p>
                </div>
                <div class="gtools">
                    <button class="mini btn-rename" onclick="renameGroup('${g.id}')">Renombrar</button>
                    <button class="mini btn-clear" onclick="clearGroup('${g.id}')">Limpiar</button>
                    <button class="mini btn-delete" onclick="deleteGroup('${g.id}')">Borrar grupo</button>
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
                        <button class="a" onclick="event.stopPropagation(); editItem('${g.id}','${item.id}')">Editar</button>
                        <button class="a" onclick="event.stopPropagation(); deleteItem('${g.id}','${item.id}')">Borrar</button>
                    </div>
                `;
                card.onclick = () => copyText(item.text);
                grid.appendChild(card);
            });
        }
        groupsEl.appendChild(sec);
    });
}

// Global scope para handlers inline
window.renameGroup = renameGroup; window.deleteGroup = deleteGroup;
window.editItem = editItem; window.deleteItem = deleteItem;
window.clearGroup = clearGroup;

createGroupBtn.onclick = createGroup;
addBtn.onclick = addItem;
clearAllBtn.onclick = clearAll;

// Atajos de teclado
input.onkeydown = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") addItem(); };
newGroupName.onkeydown = (e) => { if (e.key === "Enter") createGroup(); };

render();

// Lifecycle de PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .catch(err => console.error('PWA Registration failed:', err));
    });
}