/**
 * app.js - Lógica principal de Cajitas Pro
 */

const STORAGE_KEY = "cajitas_grupos_personalizados_v3";
const generateId = () => crypto?.randomUUID?.() || Math.random().toString(36).substring(2, 15);

// ==========================================
// 1. ESTADO GLOBAL
// ==========================================
let state = load();

function load() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {
            groups: [{ id: generateId(), name: "Ejemplo Grupo", items: [{ id: generateId(), text: "Clic para copiar" }] }]
        };
    } catch { return { groups: [] }; }
}

function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    render();
}

// ==========================================
// 2. UI Y NOTIFICACIONES
// ==========================================
function markError(el) {
    el.classList.add("error-shake");
    setTimeout(() => el.classList.remove("error-shake"), 400);
    el.focus();
}

function showToast(msg) {
    let toast = document.getElementById("toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toast";
        toast.className = "toast";
        document.body.appendChild(toast);
    }
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

function showUndoToast(msg, onUndoCallback) {
    let toast = document.getElementById("toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toast";
        toast.className = "toast";
        document.body.appendChild(toast);
    }

    toast.innerHTML = `<span style="vertical-align: middle;">${msg} <span style="opacity:0.75; font-size:12px; margin-left:8px;">(Ctrl+Z para deshacer)</span></span>`;
    toast.classList.add("show");

    if (window.undoTimerId) clearTimeout(window.undoTimerId);

    let timerId = setTimeout(() => {
        toast.classList.remove("show");
        if (window.currentUndoAction) window.currentUndoAction = null;
    }, 4500);
    window.undoTimerId = timerId;

    window.currentUndoAction = () => {
        clearTimeout(timerId);
        toast.classList.remove("show");
        onUndoCallback();
        window.currentUndoAction = null;
        if (window.undoTimerId) clearTimeout(window.undoTimerId);
    };
}

// ==========================================
// 3. TEMA Y MODO COMPACTO
// ==========================================
function initTheme() {
    const currentTheme = localStorage.getItem("theme") || "dark";
    document.documentElement.setAttribute("data-theme", currentTheme);

    const themeBtn = document.createElement("button");
    themeBtn.className = "theme-btn";
    themeBtn.title = "Cambiar Tema";
    document.body.appendChild(themeBtn);

    themeBtn.onclick = () => {
        const isDark = document.documentElement.getAttribute("data-theme") === "dark";
        const newTheme = isDark ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", newTheme);
        localStorage.setItem("theme", newTheme);
        showToast(newTheme === "dark" ? "Modo Oscuro" : "Modo Claro");
    };
}

function initCompactMode() {
    const isInitiallyCompact = localStorage.getItem("is-compact") === "true";
    if (isInitiallyCompact) document.body.classList.add("is-compact");

    const toggleBtn = document.createElement("button");
    toggleBtn.className = `floating-btn ${isInitiallyCompact ? "is-active" : ""}`;
    toggleBtn.title = "Modo Compacto";
    document.body.appendChild(toggleBtn);

    toggleBtn.onclick = () => {
        const isCompactNow = document.body.classList.toggle("is-compact");
        toggleBtn.classList.toggle("is-active", isCompactNow);
        localStorage.setItem("is-compact", isCompactNow);
        document.querySelectorAll('.group').forEach(g => g.draggable = !isCompactNow);
        render();
        showToast(isCompactNow ? "Vista Compacta" : "Vista Edición");
    };
}

// ==========================================
// 4. CRUD GRUPOS E ITEMS
// ==========================================
function createGroup() {
    const newGroupName = document.getElementById("newGroupName");
    const name = newGroupName.value.trim();
    if (!name) return markError(newGroupName);
    state.groups.unshift({ id: generateId(), name, items: [] });
    newGroupName.value = "";
    save();
}

function renameGroup(id, newName) {
    const g = state.groups.find(x => x.id === id);
    if (g && newName?.trim() && g.name !== newName.trim()) {
        g.name = newName.trim();
        save();
    }
}

let deletedGroupBackup = null;
function undoDeleteGroup() {
    if (!deletedGroupBackup) return;
    state.groups.splice(deletedGroupBackup.index, 0, deletedGroupBackup.group);
    deletedGroupBackup = null;
    save();
}

function deleteGroup(id) {
    const index = state.groups.findIndex(x => x.id === id);
    if (index > -1) {
        deletedGroupBackup = { index: index, group: state.groups[index] };
        state.groups = state.groups.filter(x => x.id !== id);
        save();
        showUndoToast(`Grupo "${deletedGroupBackup.group.name}" eliminado`, undoDeleteGroup);
    }
}

function clearGroup(id) {
    const g = state.groups.find(x => x.id === id);
    if (confirm(`¿Vaciar ${g.name}?`)) { g.items = []; save(); }
}

function clearAll() {
    if (confirm("¿BORRAR TODO?")) {
        state.groups = [];
        save();
    }
}

function addItem() {
    const input = document.getElementById("input");
    const groupSelect = document.getElementById("groupSelect");
    const val = input.value.trim();
    const g = state.groups.find(x => x.id === groupSelect.value);

    if (!val) return markError(input);
    if (!g) return alert("Selecciona un grupo");

    g.items.unshift({ id: generateId(), text: val });
    input.value = "";
    save();
}

function editItem(gid, iid, newText) {
    const g = state.groups.find(x => x.id === gid);
    if (!g) return;
    const item = g.items.find(x => x.id === iid);
    if (item && newText?.trim() && item.text !== newText.trim()) {
        item.text = newText.trim();
        save();
    }
}

let deletedItemBackup = null;
function undoDeleteItem() {
    if (!deletedItemBackup) return;
    const g = state.groups.find(x => x.id === deletedItemBackup.gid);
    if (g) {
        g.items.splice(deletedItemBackup.index, 0, deletedItemBackup.item);
        deletedItemBackup = null;
        save();
    }
}

function deleteItem(gid, iid) {
    const g = state.groups.find(x => x.id === gid);
    if (!g) return;
    const index = g.items.findIndex(x => x.id === iid);

    if (index > -1) {
        deletedItemBackup = { gid, index, item: g.items[index] };
        g.items.splice(index, 1);
        save();
        showUndoToast("Cajita eliminada", undoDeleteItem);
    }
}

// ==========================================
// 5. DRAG AND DROP
// ==========================================
const syncStateFromDom = () => {
    const newGroups = Array.from(document.querySelectorAll('.group')).map(gEl => {
        const gid = gEl.dataset.id;
        const originalGroup = state.groups.find(g => g.id === gid);
        const items = Array.from(gEl.querySelectorAll('.card')).map(cEl => {
            const iid = cEl.dataset.id;
            return state.groups.flatMap(g => g.items).find(it => it.id === iid);
        }).filter(Boolean);
        return { ...originalGroup, items };
    });
    state.groups = newGroups;
    save();
};

function initDragAndDrop(el) {
    const groupsEl = document.getElementById("groups");

    el.addEventListener('dragstart', (e) => {
        if (document.body.classList.contains("is-compact")) return e.preventDefault();
        if (e.target.classList.contains('card')) return; // No arrastrar grupo si es card
        el.classList.add('dragging');
    });

    el.addEventListener('dragend', () => {
        el.classList.remove('dragging');
        syncStateFromDom();
    });

    el.addEventListener('dragover', (e) => {
        e.preventDefault();
        const dragging = document.querySelector('.group.dragging');
        if (!dragging || dragging === el) return;
        const rect = el.getBoundingClientRect();
        const next = (e.clientY > rect.top + rect.height / 2) ? el.nextSibling : el;
        groupsEl.insertBefore(dragging, next);
    });
}

function initItemDragAndDrop(card, gid, iid) {
    card.addEventListener('dragstart', (e) => {
        if (document.body.classList.contains("is-compact")) return e.preventDefault();
        e.stopPropagation();
        card.classList.add('dragging');
        e.dataTransfer.setData('text/plain', iid);
        e.dataTransfer.effectAllowed = 'move';
    });

    card.addEventListener('dragend', (e) => {
        e.stopPropagation();
        card.classList.remove('dragging');
        syncStateFromDom();
    });

    card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const dragging = document.querySelector('.card.dragging');
        if (!dragging || dragging === card) return;

        const rect = card.getBoundingClientRect();
        const isAfter = (e.clientY > rect.top + rect.height / 2) || (e.clientX > rect.left + rect.width / 2);
        card.parentNode.insertBefore(dragging, isAfter ? card.nextSibling : card);
    });
}

// ==========================================
// 6. BACKUP Y EXPORTACIÓN
// ==========================================
function exportData() {
    let copy = { groups: state.groups };
    const dataStr = JSON.stringify(copy, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', `cajitas_v3_${new Date().toISOString().slice(0, 10)}.json`);
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
                state.groups = imported.groups;
                save();
                showToast("Importado ✅");
            }
        } catch {
            alert("Error en JSON");
        }
        document.getElementById("fileInput").value = "";
    };
    reader.readAsText(file);
}

// ==========================================
// 7. RENDERIZADO DEL DOM
// ==========================================
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function render() {
    // 1. Refrescar el Select de Grupos
    const groupSelect = document.getElementById("groupSelect");
    if (groupSelect) {
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
            if (state.groups.some(g => g.id === prevValue)) {
                groupSelect.value = prevValue;
            }
        }
    }

    // 2. Refrescar Cuadrícula de Grupos Principales
    const groupsEl = document.getElementById("groups");
    if (!groupsEl) return;

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
                    <span class="drag-handle"><span class="material-symbols-outlined">drag_indicator</span></span>
                    <p class="gname">${g.name} — ${g.items.length}</p>
                </div>
                <div class="gtools">
                    <button class="mini btn-rename"><span class="material-symbols-outlined">edit</span> Renombrar</button>
                    <button class="mini btn-clear"><span class="material-symbols-outlined">mop</span> Vaciar</button>
                    <button class="mini btn-delete"><span class="material-symbols-outlined">delete</span> Borrar</button>
                </div>
            </div>
            <div class="grid"></div>
        `;

        sec.querySelector(".btn-rename").onclick = () => {
            const p = sec.querySelector(".gname");
            if (p.querySelector("input")) return;

            const currentName = g.name;
            const input = document.createElement("input");
            input.type = "text";
            input.className = "edit-input";
            input.value = currentName;
            p.innerHTML = "";
            p.appendChild(input);
            input.focus();

            const saveRename = () => { renameGroup(g.id, input.value); render(); };
            input.onblur = saveRename;
            input.onkeydown = (ev) => {
                if (ev.key === "Enter") saveRename();
                if (ev.key === "Escape") render();
            };
        };

        sec.querySelector(".btn-clear").onclick = () => clearGroup(g.id);

        sec.querySelector(".btn-delete").onclick = () => {
            if (confirm("¿Eliminar grupo?")) {
                sec.classList.add("fade-out");
                setTimeout(() => deleteGroup(g.id), 200);
            }
        };

        const grid = sec.querySelector(".grid");
        if (g.items.length === 0) {
            sec.querySelector(".grid").innerHTML = `<p class="muted empty-msg">Sin cajitas</p>`;
        } else {
            g.items.forEach(item => {
                const card = document.createElement("div");
                card.className = "card";
                card.draggable = !isCompact;
                card.dataset.id = item.id;
                initItemDragAndDrop(card, g.id, item.id);

                card.innerHTML = `
                    <div class="text">${escapeHtml(item.text)}</div>
                    <div class="actions">
                        <button class="a btn-edit"><span class="material-symbols-outlined">edit</span> <span class="btn-text">Editar</span></button>
                        <button class="a btn-del"><span class="material-symbols-outlined">delete</span> <span class="btn-text">Borrar</span></button>
                    </div>
                `;

                card.querySelector(".btn-edit").onclick = (e) => {
                    e.stopPropagation();
                    const textDiv = card.querySelector(".text");
                    if (textDiv.querySelector("textarea")) return;

                    const currentText = item.text;
                    const textarea = document.createElement("textarea");
                    textarea.className = "edit-textarea";
                    textarea.value = currentText;
                    textDiv.innerHTML = "";
                    textDiv.appendChild(textarea);
                    textarea.focus();

                    const saveEdit = () => { editItem(g.id, item.id, textarea.value); render(); };
                    textarea.onblur = saveEdit;
                    textarea.onkeydown = (ev) => { if (ev.key === "Escape") render(); };
                    textarea.onclick = (ev) => ev.stopPropagation();
                };

                card.querySelector(".btn-del").onclick = (e) => {
                    e.stopPropagation();
                    card.classList.add("fade-out");
                    setTimeout(() => deleteItem(g.id, item.id), 200);
                };

                card.onclick = () => {
                    if (!card.querySelector("textarea")) copyText(item.text, card);
                };

                grid.appendChild(card);
            });
        }

        // Listener para permitir soltar items en el grid vacío
        grid.addEventListener('dragover', (e) => {
            e.preventDefault();
            const dragging = document.querySelector('.card.dragging');
            if (!dragging || grid.contains(dragging)) return;

            const emptyMsg = grid.querySelector('.empty-msg');
            if (emptyMsg) grid.innerHTML = "";
            grid.appendChild(dragging);
        });

        groupsEl.appendChild(sec);
    });
}

// ==========================================
// 8. INICIALIZACIÓN
// ==========================================
initTheme();
initCompactMode();
render();

document.getElementById("createGroupBtn").onclick = createGroup;
document.getElementById("addBtn").onclick = addItem;
document.getElementById("clearAllBtn").onclick = clearAll;
document.getElementById("exportBtn").onclick = exportData;

const fileInput = document.getElementById("fileInput");
document.getElementById("importBtn").onclick = () => fileInput.click();
fileInput.onchange = importData;

document.getElementById("input").onkeydown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") addItem();
};
document.getElementById("newGroupName").onkeydown = (e) => {
    if (e.key === "Enter") createGroup();
};

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === 'z') {
        if (typeof window.currentUndoAction === 'function') {
            e.preventDefault();
            window.currentUndoAction();
        }
    }
});

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(console.error);
}
