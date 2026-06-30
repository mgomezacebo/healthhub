// HealthHub - SPA Mobile Web App Client-Side Core

// ==========================================
// 1. ESTADO GLOBAL & PERSISTENCIA
// ==========================================
const STORAGE_KEY = "healthhub_data";

let state = {
    profile: {
        name: "",
        sex: "", // 'hombre' | 'mujer'
        birthdate: "", // 'YYYY-MM-DD'
        heightCm: null,
        weightKg: null,
        dailyDeficitGoal: null
    },
    foodEntries: [],
    stepEntries: [],
    activityEntries: []
};

// Cargar datos desde localStorage al iniciar
function loadData() {
    const rawData = localStorage.getItem(STORAGE_KEY);
    if (rawData) {
        try {
            const parsed = JSON.parse(rawData);
            state = {
                profile: { ...state.profile, ...(parsed.profile || {}) },
                foodEntries: parsed.foodEntries || [],
                stepEntries: parsed.stepEntries || [],
                activityEntries: parsed.activityEntries || []
            };
        } catch (e) {
            console.error("Error al analizar los datos de localStorage. Reestableciendo valores por defecto.", e);
            saveData();
        }
    } else {
        saveData();
    }
}

// Guardar datos en localStorage
function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ==========================================
// 2. FÓRMULAS DE CÁLCULO DE SALUD
// ==========================================

// Cálculo de edad real basado en fecha de nacimiento
function calcularEdad(birthdate) {
    if (!birthdate) return 0;
    const birthDateObj = new Date(birthdate);
    const today = new Date();
    let age = today.getFullYear() - birthDateObj.getFullYear();
    const monthDiff = today.getMonth() - birthDateObj.getMonth();
    
    // Ajustar si el cumpleaños no ha pasado este año todavía
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDateObj.getDate())) {
        age--;
    }
    return Math.max(0, age);
}

// Función JS obligatoria para calorías quemadas por pasos
function calcularCaloriasPorPasos(pasos, pesoKg, alturaCm, edad, sexo) {
    const coeficienteSexo = sexo === "hombre" ? 0.57 : 0.50;
    const calorias = pasos * ((0.414 * alturaCm) / 100000) * pesoKg * coeficienteSexo * (1 - 0.003 * (edad - 30));
    return Math.max(0, Math.round(calorias));
}

// Función JS obligatoria para calcular Tasa Metabólica Basal (Mifflin-St Jeor)
function calcularTMB(pesoKg, alturaCm, edad, sexo) {
    if (sexo === "hombre") {
        return Math.round((10 * pesoKg) + (6.25 * alturaCm) - (5 * edad) + 5);
    }
    return Math.round((10 * pesoKg) + (6.25 * alturaCm) - (5 * edad) - 161);
}

// ==========================================
// 3. ENRUTADOR SIMPLE (SPA)
// ==========================================
let currentPage = "home";

function navigateTo(page) {
    currentPage = page;
    renderApp();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// ==========================================
// 4. FUNCIONES AUXILIARES DE FECHA
// ==========================================

function getTodayISO() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function isToday(dateString) {
    if (!dateString) return false;
    return dateString.startsWith(getTodayISO());
}

function formatDate(dateString) {
    if (!dateString) return "-";
    if (dateString === getTodayISO()) return "Hoy";
    
    const parts = dateString.split('-');
    if (parts.length < 3) return dateString;
    
    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const day = parseInt(parts[2], 10);
    const monthIdx = parseInt(parts[1], 10) - 1;
    const year = parts[0];
    
    return `${day} de ${months[monthIdx]} ${year}`;
}

function formatDateTime(dateTimeString) {
    if (!dateTimeString) return "-";
    const parts = dateTimeString.split('T');
    const datePart = parts[0];
    let timePart = parts[1] || "";
    
    if (timePart.includes(':')) {
        const tParts = timePart.split(':');
        timePart = `${tParts[0]}:${tParts[1]}`;
    }
    
    const formattedDate = formatDate(datePart);
    return timePart ? `${formattedDate} a las ${timePart}` : formattedDate;
}

// ==========================================
// 5. CÁLCULOS RESUMEN DIARIOS
// ==========================================

function calculateTodayFoodCalories() {
    return state.foodEntries
        .filter(entry => isToday(entry.datetime))
        .reduce((sum, entry) => sum + Number(entry.calories), 0);
}

function calculateTodayStepCalories() {
    const todayStr = getTodayISO();
    return state.stepEntries
        .filter(entry => entry.date === todayStr)
        .reduce((sum, entry) => sum + Number(entry.calories || 0), 0);
}

function calculateTodayActivityCalories() {
    const todayStr = getTodayISO();
    return state.activityEntries
        .filter(entry => entry.date === todayStr)
        .reduce((sum, entry) => sum + Number(entry.calories || 0), 0);
}

function calculateRestingCalories() {
    const { weightKg, heightCm, birthdate, sex } = state.profile;
    if (!weightKg || !heightCm || !birthdate || !sex) return 0;
    const edad = calcularEdad(birthdate);
    return calcularTMB(weightKg, heightCm, edad, sex);
}

// Balance diario: Gastadas Totales - Ingeridas
// Gastadas = Reposo (TMB) + Pasos + Actividad
function calculateDailyBalance() {
    const reposo = calculateRestingCalories();
    const pasos = calculateTodayStepCalories();
    const actividad = calculateTodayActivityCalories();
    const ingesta = calculateTodayFoodCalories();
    
    const gastadas = reposo + pasos + actividad;
    return gastadas - ingesta;
}

// ==========================================
// 6. SISTEMA DE TOASTS (NOTIFICACIONES)
// ==========================================

function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    const element = document.getElementById("toast-element");
    const messageEl = document.getElementById("toast-message");
    const iconEl = document.getElementById("toast-icon");
    
    if (!container || !element || !messageEl || !iconEl) return;
    
    messageEl.textContent = message;
    
    // Colores y bordes premium para los toasts
    if (type === "success") {
        element.className = "bg-slate-850 border border-emerald-500/30 text-emerald-400 rounded-2xl px-5 py-3.5 shadow-2xl flex items-center gap-3 backdrop-blur-md bg-slate-900/95";
        iconEl.innerHTML = `
            <div class="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
                </svg>
            </div>
        `;
    } else if (type === "error") {
        element.className = "bg-slate-850 border border-red-500/30 text-red-400 rounded-2xl px-5 py-3.5 shadow-2xl flex items-center gap-3 backdrop-blur-md bg-slate-900/95";
        iconEl.innerHTML = `
            <div class="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                <svg class="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
            </div>
        `;
    } else {
        element.className = "bg-slate-850 border border-sky-500/30 text-sky-400 rounded-2xl px-5 py-3.5 shadow-2xl flex items-center gap-3 backdrop-blur-md bg-slate-900/95";
        iconEl.innerHTML = `
            <div class="w-6 h-6 rounded-full bg-sky-500/10 flex items-center justify-center border border-sky-500/20">
                <svg class="w-3.5 h-3.5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
            </div>
        `;
    }
    
    // Animación de entrada
    container.classList.remove("translate-y-4", "opacity-0");
    container.classList.add("translate-y-0", "opacity-100");
    
    // Programar salida
    setTimeout(() => {
        container.classList.remove("translate-y-0", "opacity-100");
        container.classList.add("translate-y-4", "opacity-0");
    }, 2500);
}

// ==========================================
// 7. COMPONENTES VISUALES REUTILIZABLES
// ==========================================

// Header
function renderHeader(title, subtitle = "", showBackButton = false, backTarget = "home") {
    return `
        <header class="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/40 px-5 py-4 flex items-center justify-between">
            <div class="flex items-center gap-3">
                ${showBackButton ? `
                    <button onclick="navigateTo('${backTarget}')" class="w-10 h-10 rounded-xl bg-slate-800/60 border border-slate-700/45 flex items-center justify-center text-slate-300 hover:text-white transition-all active:scale-95">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"></path>
                        </svg>
                    </button>
                ` : `
                    <div class="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center">
                        <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                        </svg>
                    </div>
                `}
                <div>
                    <h1 class="text-lg font-bold tracking-tight text-white leading-tight">${title}</h1>
                    ${subtitle ? `<p class="text-xs text-slate-400 font-medium leading-none mt-0.5">${subtitle}</p>` : ""}
                </div>
            </div>
        </header>
    `;
}

// Menú de navegación inferior fijo
function renderBottomNav() {
    const tabs = [
        { id: "home", label: "Inicio", icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>` },
        { id: "food", label: "Alimentos", icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 22C17.5 22 21 17.5 21 12C21 8.5 19 6 17 6C15 6 13.5 7.5 12 7.5C10.5 7.5 9 6 7 6C5 6 3 8.5 3 12C3 17.5 6.5 22 12 22ZM12 6C12 4 14 3 14 3"></path>` },
        { id: "activity", label: "Actividad", icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>` },
        { id: "data", label: "Datos", icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>` },
        { id: "settings", label: "Perfil", icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>` }
    ];
    
    // Mapear rutas secundarias a sus pestañas correspondientes para mantener el estado "activo"
    let activeTab = currentPage;
    if (["add-food", "food-history"].includes(currentPage)) activeTab = "food";
    if (["add-steps", "add-activity"].includes(currentPage)) activeTab = "activity";
    if (["height", "weight", "birthdate", "sex", "deficit"].includes(currentPage)) activeTab = "data";
    if (currentPage === "profile") activeTab = "settings";

    const navItems = tabs.map(tab => {
        const isActive = activeTab === tab.id;
        const activeClass = isActive 
            ? "text-emerald-400 font-semibold" 
            : "text-slate-400 hover:text-slate-300 font-normal";
        const iconColorClass = isActive ? "text-emerald-400" : "text-slate-400";
        
        return `
            <button onclick="navigateTo('${tab.id}')" class="flex flex-col items-center justify-center py-2 flex-1 relative transition-all active:scale-90">
                <svg class="w-5 h-5 mb-1 ${iconColorClass} transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    ${tab.icon}
                </svg>
                <span class="text-[10px] tracking-wide ${activeClass} transition-colors">${tab.label}</span>
                ${isActive ? `<div class="absolute bottom-0 w-5 h-1 bg-emerald-400 rounded-t-full"></div>` : ""}
            </button>
        `;
    }).join("");

    return `
        <nav class="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-slate-900/90 backdrop-blur-lg border-t border-slate-800/60 flex items-center justify-around z-40 px-2 py-1 shadow-xl">
            ${navItems}
        </nav>
    `;
}

// Vacío de datos (Empty State)
function renderEmptyState(message, buttonText = "", targetRoute = "") {
    return `
        <div class="flex flex-col items-center justify-center py-10 px-4 text-center">
            <div class="w-16 h-16 rounded-2xl bg-slate-800/40 border border-slate-700/35 flex items-center justify-center text-slate-500 mb-4">
                <svg class="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0V9a2 2 0 00-2-2H6a2 2 0 00-2 2v2m0 4h18"></path>
                </svg>
            </div>
            <p class="text-sm text-slate-400 font-medium max-w-xs mb-5">${message}</p>
            ${buttonText && targetRoute ? `
                <button onclick="navigateTo('${targetRoute}')" class="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-xl hover:bg-emerald-500/20 transition-all active:scale-95">
                    ${buttonText}
                </button>
            ` : ""}
        </div>
    `;
}

// ==========================================
// 8. RENDERIZADORES DE PÁGINAS INDIVIDUALES
// ==========================================

// --- PÁGINA 1: INICIO (HOME) ---
function renderHome() {
    const isProfileIncomplete = !state.profile.heightCm || !state.profile.weightKg || !state.profile.birthdate || !state.profile.sex;
    
    const ingesta = calculateTodayFoodCalories();
    const pasosKcal = calculateTodayStepCalories();
    const actividadKcal = calculateTodayActivityCalories();
    const reposoKcal = calculateRestingCalories();
    const deficitGoal = state.profile.dailyDeficitGoal || 0;
    
    // Calorías gastadas totales = reposo + pasos + actividad
    const gastadasTotales = reposoKcal + pasosKcal + actividadKcal;
    const balance = gastadasTotales - ingesta; // > 0 es déficit, < 0 es superávit
    
    // Contenido Home
    let content = `
        <div class="px-5 py-4 space-y-6">
            <!-- Saludo y Perfil -->
            <div class="flex items-center justify-between">
                <div>
                    <h2 class="text-2xl font-bold tracking-tight text-white">¡Hola, ${state.profile.name || "Usuario"}!</h2>
                    <p class="text-xs text-slate-400">Mantente al tanto de tus objetivos hoy</p>
                </div>
                <div class="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-emerald-400">
                    ${(state.profile.name || "U").substring(0, 2).toUpperCase()}
                </div>
            </div>
    `;
    
    // Alerta de perfil incompleto
    if (isProfileIncomplete) {
        content += `
            <div class="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3">
                <svg class="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
                <div class="space-y-1">
                    <p class="text-xs font-semibold text-amber-400">Datos personales incompletos</p>
                    <p class="text-[11px] text-slate-400 leading-relaxed">Completa tu perfil para calcular el gasto en reposo (TMB) y las calorías de tus pasos automáticamente.</p>
                    <button onclick="navigateTo('data')" class="mt-2 text-[11px] font-bold text-amber-400 hover:underline">Completar datos &rarr;</button>
                </div>
            </div>
        `;
    }

    // Tarjeta del Progreso Calórico Diario (Balance)
    let balancePercentage = 0;
    let deficitStatusText = "";
    let statusColorClass = "text-emerald-400";
    
    if (isProfileIncomplete) {
        deficitStatusText = "Configura tus datos para ver tu balance diario.";
        statusColorClass = "text-slate-400";
    } else {
        if (balance > 0) {
            // Hay déficit (gastó más de lo que comió)
            if (deficitGoal > 0) {
                balancePercentage = Math.min(100, Math.round((balance / deficitGoal) * 100));
                if (balance >= deficitGoal) {
                    deficitStatusText = `🎉 ¡Objetivo superado! Déficit actual: ${balance} kcal (Objetivo: ${deficitGoal} kcal)`;
                    statusColorClass = "text-emerald-400";
                } else {
                    deficitStatusText = `Te faltan ${deficitGoal - balance} kcal de déficit para alcanzar el objetivo.`;
                    statusColorClass = "text-emerald-300";
                }
            } else {
                deficitStatusText = `Déficit actual: ${balance} kcal (Sin objetivo configurado)`;
                statusColorClass = "text-slate-300";
            }
        } else {
            // Hay superávit (comió más de lo que gastó)
            const superavit = Math.abs(balance);
            deficitStatusText = `⚠️ Superávit de ${superavit} kcal. Debes gastar más o ingerir menos calorías.`;
            statusColorClass = "text-rose-400";
        }
    }

    content += `
        <!-- Anillo / Tarjeta principal de Balance -->
        <div class="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
            <div class="absolute -right-16 -top-16 w-36 h-36 rounded-full bg-emerald-500/5 blur-3xl"></div>
            
            <div class="flex items-center justify-between mb-4">
                <span class="text-xs font-semibold tracking-wider text-slate-400 uppercase">Resumen Diario</span>
                <span class="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">Calorías (kcal)</span>
            </div>
            
            <div class="grid grid-cols-2 gap-4 items-center">
                <div>
                    <h3 class="text-xs font-medium text-slate-500">Balance del día</h3>
                    <div class="text-3xl font-extrabold text-white mt-1 leading-none">
                        ${isProfileIncomplete ? "-" : (balance > 0 ? `+${balance}` : balance)}
                        <span class="text-xs font-medium text-slate-500">kcal</span>
                    </div>
                    <p class="text-[11px] font-semibold mt-2 ${statusColorClass}">
                        ${deficitStatusText}
                    </p>
                </div>
                
                <!-- Progreso visual simple -->
                <div class="flex flex-col items-center justify-center pl-2">
                    <div class="relative w-24 h-24 flex items-center justify-center">
                        <!-- SVG Circular Progress Bar -->
                        <svg class="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                            <path class="text-slate-800" stroke="currentColor" stroke-width="3" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            ${!isProfileIncomplete && deficitGoal > 0 && balance > 0 ? `
                                <path class="text-emerald-400 transition-all duration-500 ease-out" stroke-dasharray="${balancePercentage}, 100" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            ` : ""}
                        </svg>
                        <div class="absolute flex flex-col items-center justify-center">
                            <span class="text-lg font-bold text-white leading-none">${isProfileIncomplete ? "-" : `${balancePercentage}%`}</span>
                            <span class="text-[8px] text-slate-500 uppercase tracking-widest font-semibold mt-0.5">Déficit</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Desglose de calorías -->
            <div class="grid grid-cols-4 gap-2 border-t border-slate-800/80 mt-5 pt-4 text-center">
                <div>
                    <span class="text-[10px] font-medium text-slate-500 block">Comida</span>
                    <span class="text-sm font-bold text-rose-400 block mt-0.5">${ingesta}</span>
                </div>
                <div>
                    <span class="text-[10px] font-medium text-slate-500 block">Reposo</span>
                    <span class="text-sm font-bold text-slate-300 block mt-0.5">${isProfileIncomplete ? "-" : reposoKcal}</span>
                </div>
                <div>
                    <span class="text-[10px] font-medium text-slate-500 block">Pasos</span>
                    <span class="text-sm font-bold text-sky-400 block mt-0.5">${isProfileIncomplete ? "-" : pasosKcal}</span>
                </div>
                <div>
                    <span class="text-[10px] font-medium text-slate-500 block">Actividad</span>
                    <span class="text-sm font-bold text-emerald-400 block mt-0.5">${actividadKcal}</span>
                </div>
            </div>
        </div>

        <!-- Botones Rápidos -->
        <div class="space-y-3">
            <h3 class="text-xs font-semibold tracking-wider text-slate-400 uppercase">Acciones Rápidas</h3>
            
            <div class="grid grid-cols-2 gap-3">
                <button onclick="navigateTo('add-food')" class="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700/60 text-left transition-all active:scale-95 flex items-center justify-between group">
                    <div class="space-y-1">
                        <span class="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400 mb-1">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                            </svg>
                        </span>
                        <p class="text-xs font-semibold text-white">Comida</p>
                        <p class="text-[9px] text-slate-500 leading-none">Registrar alimento</p>
                    </div>
                    <svg class="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path>
                    </svg>
                </button>
                
                <button onclick="navigateTo('add-steps')" class="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700/60 text-left transition-all active:scale-95 flex items-center justify-between group">
                    <div class="space-y-1">
                        <span class="w-8 h-8 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-400 mb-1">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"></path>
                            </svg>
                        </span>
                        <p class="text-xs font-semibold text-white">Pasos</p>
                        <p class="text-[9px] text-slate-500 leading-none">Registrar pasos</p>
                    </div>
                    <svg class="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path>
                    </svg>
                </button>
                
                <button onclick="navigateTo('add-activity')" class="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700/60 text-left transition-all active:scale-95 flex items-center justify-between group">
                    <div class="space-y-1">
                        <span class="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-1">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                            </svg>
                        </span>
                        <p class="text-xs font-semibold text-white">Actividad</p>
                        <p class="text-[9px] text-slate-500 leading-none">Registrar ejercicio</p>
                    </div>
                    <svg class="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path>
                    </svg>
                </button>

                <button onclick="navigateTo('deficit')" class="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700/60 text-left transition-all active:scale-95 flex items-center justify-between group">
                    <div class="space-y-1">
                        <span class="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 mb-1">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"></path>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"></path>
                            </svg>
                        </span>
                        <p class="text-xs font-semibold text-white">Objetivo</p>
                        <p class="text-[9px] text-slate-500 leading-none">Ver déficit objetivo</p>
                    </div>
                    <svg class="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path>
                    </svg>
                </button>
            </div>
            
            <button onclick="navigateTo('data')" class="w-full p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700/60 text-left transition-all active:scale-95 flex items-center justify-between group">
                <div class="flex items-center gap-3">
                    <span class="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                        </svg>
                    </span>
                    <div>
                        <p class="text-xs font-semibold text-white">Editar Datos Personales</p>
                        <p class="text-[9.5px] text-slate-500 leading-none mt-0.5">Introduce o modifica altura, peso, edad y sexo</p>
                    </div>
                </div>
                <svg class="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path>
                </svg>
            </button>
        </div>
    `;

    return content + "</div>";
}

// --- PÁGINA 2: DATOS PERSONALES ---
function renderData() {
    const { name, sex, birthdate, heightCm, weightKg, dailyDeficitGoal } = state.profile;
    
    // Validar si falta algún dato
    const isProfileIncomplete = !heightCm || !weightKg || !birthdate || !sex;
    
    let content = `
        <div class="px-5 py-4 space-y-6">
            <div class="flex items-center justify-between">
                <div>
                    <h2 class="text-xl font-bold text-white">Datos Personales</h2>
                    <p class="text-xs text-slate-400">Información básica para calcular tu metabolismo</p>
                </div>
            </div>
    `;

    if (isProfileIncomplete) {
        content += `
            <div class="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3">
                <svg class="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
                <div class="space-y-1">
                    <p class="text-xs font-semibold text-amber-400">Acceso limitado a cálculos</p>
                    <p class="text-[11px] text-slate-400 leading-relaxed">Faltan datos clave. Completa las tarjetas de abajo para poder estimar tus calorías de pasos y metabolismo basal (TMB).</p>
                </div>
            </div>
        `;
    }

    // Nombre editable rápido
    content += `
        <div class="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-2.5">
            <label class="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Nombre de Usuario</label>
            <div class="flex gap-2">
                <input id="profile-name-input" type="text" value="${name || ""}" placeholder="Introduce tu nombre" class="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-emerald-500/50 text-white placeholder-slate-600">
                <button onclick="guardarNombre()" class="px-4 bg-emerald-500 text-slate-950 text-xs font-bold rounded-xl active:scale-95 transition-all">Guardar</button>
            </div>
        </div>
        
        <div class="space-y-3">
            <h3 class="text-xs font-semibold tracking-wider text-slate-400 uppercase">Tarjetas de Datos</h3>
            
            <div class="space-y-2.5">
                <!-- Altura -->
                <div class="p-4 rounded-2xl bg-slate-900 border border-slate-800/80 flex items-center justify-between">
                    <div class="space-y-1">
                        <p class="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Altura</p>
                        <p class="text-base font-bold text-white">${heightCm ? `${heightCm} cm` : `<span class="text-slate-600 font-normal text-sm">Sin registrar</span>`}</p>
                    </div>
                    <button onclick="navigateTo('height')" class="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700/80 text-slate-300 text-xs font-semibold rounded-xl transition-all active:scale-95 border border-slate-700/30">
                        ${heightCm ? "Editar" : "Registrar"}
                    </button>
                </div>
                
                <!-- Peso -->
                <div class="p-4 rounded-2xl bg-slate-900 border border-slate-800/80 flex items-center justify-between">
                    <div class="space-y-1">
                        <p class="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Peso</p>
                        <p class="text-base font-bold text-white">${weightKg ? `${weightKg} kg` : `<span class="text-slate-600 font-normal text-sm">Sin registrar</span>`}</p>
                    </div>
                    <button onclick="navigateTo('weight')" class="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700/80 text-slate-300 text-xs font-semibold rounded-xl transition-all active:scale-95 border border-slate-700/30">
                        ${weightKg ? "Editar" : "Registrar"}
                    </button>
                </div>
                
                <!-- Fecha Nacimiento -->
                <div class="p-4 rounded-2xl bg-slate-900 border border-slate-800/80 flex items-center justify-between">
                    <div class="space-y-1">
                        <p class="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Fecha de Nacimiento</p>
                        <p class="text-base font-bold text-white">
                            ${birthdate ? `${formatDate(birthdate)} <span class="text-xs text-slate-500 font-normal">(${calcularEdad(birthdate)} años)</span>` : `<span class="text-slate-600 font-normal text-sm">Sin registrar</span>`}
                        </p>
                    </div>
                    <button onclick="navigateTo('birthdate')" class="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700/80 text-slate-300 text-xs font-semibold rounded-xl transition-all active:scale-95 border border-slate-700/30">
                        ${birthdate ? "Editar" : "Registrar"}
                    </button>
                </div>
                
                <!-- Sexo -->
                <div class="p-4 rounded-2xl bg-slate-900 border border-slate-800/80 flex items-center justify-between">
                    <div class="space-y-1">
                        <p class="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Sexo</p>
                        <p class="text-base font-bold text-white">${sex ? (sex === "hombre" ? "Hombre" : "Mujer") : `<span class="text-slate-600 font-normal text-sm">Sin registrar</span>`}</p>
                    </div>
                    <button onclick="navigateTo('sex')" class="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700/80 text-slate-300 text-xs font-semibold rounded-xl transition-all active:scale-95 border border-slate-700/30">
                        ${sex ? "Editar" : "Registrar"}
                    </button>
                </div>
                
                <!-- Objetivo Déficit -->
                <div class="p-4 rounded-2xl bg-slate-900 border border-slate-800/80 flex items-center justify-between">
                    <div class="space-y-1">
                        <p class="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Déficit Diario Objetivo</p>
                        <p class="text-base font-bold text-white">${dailyDeficitGoal ? `${dailyDeficitGoal} kcal` : `<span class="text-slate-600 font-normal text-sm">Sin configurar</span>`}</p>
                    </div>
                    <button onclick="navigateTo('deficit')" class="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700/80 text-slate-300 text-xs font-semibold rounded-xl transition-all active:scale-95 border border-slate-700/30">
                        ${dailyDeficitGoal ? "Editar" : "Configurar"}
                    </button>
                </div>
            </div>
        </div>
    `;

    return content + "</div>";
}

// Guardar nombre desde input rápido en Datos
window.guardarNombre = function() {
    const input = document.getElementById("profile-name-input");
    if (input) {
        state.profile.name = input.value.trim();
        saveData();
        showToast("Nombre de usuario guardado con éxito");
        renderApp();
    }
};

// --- PÁGINA 3: EDITAR ALTURA ---
function renderHeight() {
    return `
        <div class="px-5 py-4 space-y-6">
            <div>
                <h2 class="text-xl font-bold text-white">Editar Altura</h2>
                <p class="text-xs text-slate-400 font-medium">Se utiliza para estimar tu longitud de zancada y metabolismo basal</p>
            </div>
            
            <form onsubmit="guardarAltura(event)" class="space-y-4">
                <div class="space-y-2">
                    <label for="height-input" class="text-xs font-bold text-slate-400 uppercase tracking-wider block">Altura en Centímetros</label>
                    <input id="height-input" type="number" required min="100" max="250" value="${state.profile.heightCm || ""}" placeholder="Ej: 175" class="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-emerald-500/50 focus:outline-none rounded-xl text-white placeholder-slate-700 text-base">
                </div>
                
                <div class="space-y-2">
                    <label for="height-date" class="text-xs font-bold text-slate-400 uppercase tracking-wider block">Fecha de medición (Opcional)</label>
                    <input id="height-date" type="date" value="${getTodayISO()}" class="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-emerald-500/50 focus:outline-none rounded-xl text-white text-base">
                </div>
                
                <div class="flex gap-3 pt-4">
                    <button type="button" onclick="navigateTo('data')" class="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all text-sm active:scale-95">
                        Cancelar
                    </button>
                    <button type="submit" class="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-all text-sm active:scale-95 shadow-lg shadow-emerald-500/10">
                        Guardar
                    </button>
                </div>
            </form>
        </div>
    `;
}

window.guardarAltura = function(e) {
    e.preventDefault();
    const heightVal = parseInt(document.getElementById("height-input").value, 10);
    if (!heightVal || heightVal < 100 || heightVal > 250) {
        showToast("Por favor, introduce una altura válida entre 100 y 250 cm", "error");
        return;
    }
    
    state.profile.heightCm = heightVal;
    saveData();
    showToast("Altura guardada exitosamente");
    navigateTo("data");
};

// --- PÁGINA 4: EDITAR PESO ---
function renderWeight() {
    return `
        <div class="px-5 py-4 space-y-6">
            <div>
                <h2 class="text-xl font-bold text-white">Editar Peso</h2>
                <p class="text-xs text-slate-400 font-medium">Esencial para el cálculo calórico del esfuerzo físico y la tasa metabólica</p>
            </div>
            
            <form onsubmit="guardarPeso(event)" class="space-y-4">
                <div class="space-y-2">
                    <label for="weight-input" class="text-xs font-bold text-slate-400 uppercase tracking-wider block">Peso en Kilogramos</label>
                    <input id="weight-input" type="number" step="0.1" required min="30" max="300" value="${state.profile.weightKg || ""}" placeholder="Ej: 72.5" class="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-emerald-500/50 focus:outline-none rounded-xl text-white placeholder-slate-700 text-base">
                </div>
                
                <div class="space-y-2">
                    <label for="weight-date" class="text-xs font-bold text-slate-400 uppercase tracking-wider block">Fecha de medición (Opcional)</label>
                    <input id="weight-date" type="date" value="${getTodayISO()}" class="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-emerald-500/50 focus:outline-none rounded-xl text-white text-base">
                </div>
                
                <div class="flex gap-3 pt-4">
                    <button type="button" onclick="navigateTo('data')" class="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all text-sm active:scale-95">
                        Cancelar
                    </button>
                    <button type="submit" class="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-all text-sm active:scale-95 shadow-lg shadow-emerald-500/10">
                        Guardar
                    </button>
                </div>
            </form>
        </div>
    `;
}

window.guardarPeso = function(e) {
    e.preventDefault();
    const weightVal = parseFloat(document.getElementById("weight-input").value);
    if (!weightVal || weightVal < 30 || weightVal > 300) {
        showToast("Por favor, introduce un peso válido entre 30 y 300 kg", "error");
        return;
    }
    
    state.profile.weightKg = Math.round(weightVal * 10) / 10; // Redondear a 1 decimal
    saveData();
    showToast("Peso guardado exitosamente");
    navigateTo("data");
};

// --- PÁGINA 5: EDITAR FECHA DE NACIMIENTO ---
function renderBirthdate() {
    return `
        <div class="px-5 py-4 space-y-6">
            <div>
                <h2 class="text-xl font-bold text-white">Fecha de Nacimiento</h2>
                <p class="text-xs text-slate-400 font-medium">Requerida para calcular tu edad y adaptar las fórmulas metabólicas</p>
            </div>
            
            <form onsubmit="guardarFechaNacimiento(event)" class="space-y-4">
                <div class="space-y-2">
                    <label for="birthdate-input" class="text-xs font-bold text-slate-400 uppercase tracking-wider block">Fecha de Nacimiento</label>
                    <input id="birthdate-input" type="date" required max="${getTodayISO()}" value="${state.profile.birthdate || ""}" class="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-emerald-500/50 focus:outline-none rounded-xl text-white text-base">
                </div>
                
                <div class="flex gap-3 pt-4">
                    <button type="button" onclick="navigateTo('data')" class="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all text-sm active:scale-95">
                        Cancelar
                    </button>
                    <button type="submit" class="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-all text-sm active:scale-95 shadow-lg shadow-emerald-500/10">
                        Guardar
                    </button>
                </div>
            </form>
        </div>
    `;
}

window.guardarFechaNacimiento = function(e) {
    e.preventDefault();
    const birthVal = document.getElementById("birthdate-input").value;
    if (!birthVal) {
        showToast("Por favor, selecciona una fecha de nacimiento válida", "error");
        return;
    }
    
    // Validar fecha futura
    const selected = new Date(birthVal);
    if (selected > new Date()) {
        showToast("La fecha de nacimiento no puede ser en el futuro", "error");
        return;
    }
    
    state.profile.birthdate = birthVal;
    saveData();
    showToast("Fecha de nacimiento guardada");
    navigateTo("data");
};

// --- PÁGINA 6: EDITAR SEXO ---
function renderSex() {
    const currentSex = state.profile.sex;
    
    return `
        <div class="px-5 py-4 space-y-6">
            <div>
                <h2 class="text-xl font-bold text-white">Selecciona Sexo</h2>
                <p class="text-xs text-slate-400 font-medium">Usamos constantes biológicas diferenciadas para hombres y mujeres</p>
            </div>
            
            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <button onclick="guardarSexo('hombre')" class="p-6 rounded-2xl border ${currentSex === "hombre" ? "bg-emerald-500/10 border-emerald-500 text-emerald-400" : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"} flex flex-col items-center justify-center gap-3 transition-all active:scale-95">
                        <div class="w-12 h-12 rounded-full ${currentSex === "hombre" ? "bg-emerald-500/15" : "bg-slate-950"} flex items-center justify-center border border-slate-800">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                            </svg>
                        </div>
                        <span class="text-sm font-bold">Hombre</span>
                    </button>
                    
                    <button onclick="guardarSexo('mujer')" class="p-6 rounded-2xl border ${currentSex === "mujer" ? "bg-emerald-500/10 border-emerald-500 text-emerald-400" : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"} flex flex-col items-center justify-center gap-3 transition-all active:scale-95">
                        <div class="w-12 h-12 rounded-full ${currentSex === "mujer" ? "bg-emerald-500/15" : "bg-slate-950"} flex items-center justify-center border border-slate-800">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                            </svg>
                        </div>
                        <span class="text-sm font-bold">Mujer</span>
                    </button>
                </div>
                
                <div class="pt-4">
                    <button onclick="navigateTo('data')" class="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all text-sm active:scale-95">
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    `;
}

window.guardarSexo = function(selectedSex) {
    state.profile.sex = selectedSex;
    saveData();
    showToast("Sexo configurado exitosamente");
    navigateTo("data");
};

// --- PÁGINA 7: OBJETIVO DE DÉFICIT CALÓRICO ---
function renderDeficit() {
    const isProfileIncomplete = !state.profile.heightCm || !state.profile.weightKg || !state.profile.birthdate || !state.profile.sex;
    
    const ingesta = calculateTodayFoodCalories();
    const pasosKcal = calculateTodayStepCalories();
    const actividadKcal = calculateTodayActivityCalories();
    const reposoKcal = calculateRestingCalories();
    const deficitGoal = state.profile.dailyDeficitGoal || 0;
    
    const gastadasTotales = reposoKcal + pasosKcal + actividadKcal;
    const balance = gastadasTotales - ingesta; // > 0 es déficit, < 0 es superávit
    
    let content = `
        <div class="px-5 py-4 space-y-6">
            <div>
                <h2 class="text-xl font-bold text-white">Déficit Calórico Objetivo</h2>
                <p class="text-xs text-slate-400 font-medium">Define tu meta de restricción energética para perder peso de manera saludable</p>
            </div>
            
            <!-- Tarjeta explicativa con alert info -->
            <div class="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl space-y-2">
                <div class="flex items-center gap-2 text-emerald-400">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <span class="text-xs font-bold uppercase tracking-wider">¿Qué es el déficit calórico?</span>
                </div>
                <p class="text-[11.5px] text-slate-400 leading-relaxed">
                    Es la diferencia entre las calorías que gastas y las que ingieres. Al gastar más energía de la que consumes, obligas a tu cuerpo a utilizar las reservas de grasa, logrando una reducción de peso.
                </p>
            </div>
    `;

    if (!isProfileIncomplete) {
        let deficitRemText = "";
        let colorTextClass = "text-slate-300";
        if (balance > 0) {
            if (deficitGoal > 0) {
                if (balance >= deficitGoal) {
                    deficitRemText = "✅ ¡Objetivo de déficit diario alcanzado! Sigue así.";
                    colorTextClass = "text-emerald-400";
                } else {
                    deficitRemText = `Te quedan <strong>${deficitGoal - balance} kcal</strong> adicionales de déficit para cumplir tu objetivo de hoy.`;
                    colorTextClass = "text-sky-300";
                }
            } else {
                deficitRemText = "Introduce un objetivo de déficit abajo para realizar el seguimiento del día.";
            }
        } else {
            const extraBurn = Math.abs(balance) + deficitGoal;
            deficitRemText = `Actualmente estás en superávit. Necesitas gastar <strong>${extraBurn} kcal</strong> adicionales o comer menos para alcanzar el objetivo.`;
            colorTextClass = "text-rose-400";
        }

        content += `
            <!-- Resumen actual en tiempo real -->
            <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h3 class="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Estado de hoy</h3>
                <div class="grid grid-cols-3 gap-2 text-center">
                    <div class="bg-slate-950 p-2.5 rounded-xl border border-slate-800/40">
                        <span class="text-[9px] text-slate-500 block">Comido</span>
                        <span class="text-sm font-bold text-rose-400">${ingesta} kcal</span>
                    </div>
                    <div class="bg-slate-950 p-2.5 rounded-xl border border-slate-800/40">
                        <span class="text-[9px] text-slate-500 block">Quemado</span>
                        <span class="text-sm font-bold text-emerald-400">${gastadasTotales} kcal</span>
                    </div>
                    <div class="bg-slate-950 p-2.5 rounded-xl border border-slate-800/40">
                        <span class="text-[9px] text-slate-500 block">Balance</span>
                        <span class="text-sm font-bold ${balance > 0 ? "text-emerald-400" : "text-rose-400"}">${balance > 0 ? `+${balance}` : balance} kcal</span>
                    </div>
                </div>
                <div class="p-3 bg-slate-950/50 rounded-xl text-xs text-center ${colorTextClass}">
                    ${deficitRemText}
                </div>
            </div>
        `;
    }

    content += `
        <!-- Formulario -->
        <form onsubmit="guardarDeficit(event)" class="space-y-4">
            <div class="space-y-2">
                <label for="deficit-input" class="text-xs font-bold text-slate-400 uppercase tracking-wider block">Objetivo Diario (kcal)</label>
                <input id="deficit-input" type="number" required min="100" max="2000" value="${deficitGoal || ""}" placeholder="Ej: 500" class="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-emerald-500/50 focus:outline-none rounded-xl text-white placeholder-slate-700 text-base">
            </div>

            <!-- Valores rápidos prestablecidos -->
            <div class="space-y-1.5">
                <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Metas Recomendadas</label>
                <div class="grid grid-cols-3 gap-2">
                    <button type="button" onclick="aplicarDeficitRapido(300)" class="py-2.5 bg-slate-800 hover:bg-slate-700/80 rounded-xl text-xs font-bold border border-slate-700/20 active:scale-95 text-slate-300">300 kcal<span class="block text-[8px] font-normal text-slate-500 mt-0.5">Leve</span></button>
                    <button type="button" onclick="aplicarDeficitRapido(500)" class="py-2.5 bg-slate-800 hover:bg-slate-700/80 rounded-xl text-xs font-bold border border-slate-700/20 active:scale-95 text-slate-300">500 kcal<span class="block text-[8px] font-normal text-slate-500 mt-0.5">Recomendado</span></button>
                    <button type="button" onclick="aplicarDeficitRapido(700)" class="py-2.5 bg-slate-800 hover:bg-slate-700/80 rounded-xl text-xs font-bold border border-slate-700/20 active:scale-95 text-slate-300">700 kcal<span class="block text-[8px] font-normal text-slate-500 mt-0.5">Intenso</span></button>
                </div>
            </div>

            <div class="flex gap-3 pt-4">
                <button type="button" onclick="navigateTo('data')" class="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all text-sm active:scale-95">
                    Cancelar
                </button>
                <button type="submit" class="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-all text-sm active:scale-95 shadow-lg shadow-emerald-500/10">
                    Guardar Meta
                </button>
            </div>
        </form>
    </div>
    `;

    return content;
}

window.aplicarDeficitRapido = function(kcal) {
    const input = document.getElementById("deficit-input");
    if (input) {
        input.value = kcal;
    }
};

window.guardarDeficit = function(e) {
    e.preventDefault();
    const inputVal = parseInt(document.getElementById("deficit-input").value, 10);
    if (!inputVal || inputVal < 100 || inputVal > 2000) {
        showToast("Introduce una meta diaria realista entre 100 y 2000 kcal", "error");
        return;
    }
    
    state.profile.dailyDeficitGoal = inputVal;
    saveData();
    showToast("Objetivo de déficit diario guardado");
    navigateTo("data");
};

// --- PÁGINA 8: ALIMENTACIÓN ---
function renderFood() {
    const ingestaHoy = calculateTodayFoodCalories();
    
    // Filtrar comidas de hoy
    const comidasHoy = state.foodEntries
        .filter(entry => isToday(entry.datetime))
        // Mostrar primero lo más reciente
        .sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
        
    let content = `
        <div class="px-5 py-4 space-y-6">
            <!-- Resumen superior -->
            <div class="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg flex items-center justify-between overflow-hidden relative">
                <div class="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-rose-500/5 blur-2xl"></div>
                <div>
                    <span class="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Energía Consumida Hoy</span>
                    <span class="text-3xl font-extrabold text-white mt-1 block">${ingestaHoy} <span class="text-xs font-medium text-slate-500">kcal</span></span>
                </div>
                <div class="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center text-rose-400">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                    </svg>
                </div>
            </div>
            
            <!-- Botones de Control -->
            <div class="grid grid-cols-2 gap-3">
                <button onclick="navigateTo('add-food')" class="py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md shadow-emerald-500/10">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                    </svg>
                    Registrar Comida
                </button>
                
                <button onclick="navigateTo('food-history')" class="py-3.5 bg-slate-800 hover:bg-slate-700/80 text-slate-200 text-xs font-bold rounded-2xl flex items-center justify-center gap-2 transition-all border border-slate-700/35 active:scale-95">
                    <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    Historial Completo
                </button>
            </div>
            
            <!-- Listado de comidas de hoy -->
            <div class="space-y-3">
                <h3 class="text-xs font-semibold tracking-wider text-slate-400 uppercase">Comidas Registradas Hoy</h3>
    `;
    
    if (comidasHoy.length === 0) {
        content += renderEmptyState("Aún no has registrado ninguna comida para el día de hoy.", "Registrar comida ahora", "add-food");
    } else {
        content += `<div class="space-y-2.5">`;
        comidasHoy.forEach(comida => {
            const mealColors = {
                "Desayuno": "bg-amber-500/10 text-amber-400 border-amber-500/15",
                "Comida": "bg-sky-500/10 text-sky-400 border-sky-500/15",
                "Merienda": "bg-orange-500/10 text-orange-400 border-orange-500/15",
                "Cena": "bg-indigo-500/10 text-indigo-400 border-indigo-500/15",
                "Snack": "bg-purple-500/10 text-purple-400 border-purple-500/15",
                "Otro": "bg-slate-500/10 text-slate-400 border-slate-500/15"
            };
            const colorClass = mealColors[comida.mealType] || mealColors["Otro"];
            
            content += `
                <div class="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between transition-all hover:border-slate-800/80">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                            <span class="text-xs font-bold">${comida.calories}</span>
                        </div>
                        <div class="space-y-0.5">
                            <h4 class="text-sm font-semibold text-white max-w-[160px] truncate">${comida.name}</h4>
                            <div class="flex items-center gap-2">
                                <span class="px-1.5 py-0.5 rounded-md text-[8.5px] font-bold uppercase tracking-wider border ${colorClass}">
                                    ${comida.mealType}
                                </span>
                                <span class="text-[10px] text-slate-500 font-medium">
                                    ${formatDateTime(comida.datetime).split(' a las ')[1] || ""}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <button onclick="eliminarComida('${comida.id}')" class="w-9 h-9 rounded-xl hover:bg-red-500/10 border border-transparent hover:border-red-500/20 flex items-center justify-center text-slate-500 hover:text-red-400 transition-all active:scale-90">
                        <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                    </button>
                </div>
            `;
        });
        content += `</div>`;
    }

    return content + "</div>";
}

window.eliminarComida = function(id) {
    const confirmDelete = confirm("¿Estás seguro de que quieres eliminar esta comida?");
    if (confirmDelete) {
        state.foodEntries = state.foodEntries.filter(entry => entry.id !== id);
        saveData();
        showToast("Comida eliminada del historial");
        renderApp();
    }
};

// --- PÁGINA 9: REGISTRAR ALIMENTACIÓN ---
function renderAddFood() {
    // Generar formato fecha/hora local para el valor predeterminado del input (YYYY-MM-DDTHH:MM)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const datetimeStr = `${year}-${month}-${day}T${hour}:${minute}`;

    return `
        <div class="px-5 py-4 space-y-6">
            <div>
                <h2 class="text-xl font-bold text-white">Registrar Alimento</h2>
                <p class="text-xs text-slate-400 font-medium">Añade los detalles de lo que has ingerido</p>
            </div>
            
            <form onsubmit="guardarComida(event)" class="space-y-4.5">
                <div class="space-y-1.5">
                    <label for="food-name" class="text-xs font-bold text-slate-400 uppercase tracking-wider block">Nombre del alimento</label>
                    <input id="food-name" type="text" required placeholder="Ej: Pechuga de pollo a la plancha" class="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-emerald-500/50 focus:outline-none rounded-xl text-white placeholder-slate-700 text-sm">
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                    <div class="space-y-1.5">
                        <label for="food-calories" class="text-xs font-bold text-slate-400 uppercase tracking-wider block">Calorías (kcal)</label>
                        <input id="food-calories" type="number" required min="0" placeholder="Ej: 350" class="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-emerald-500/50 focus:outline-none rounded-xl text-white placeholder-slate-700 text-sm">
                    </div>
                    
                    <div class="space-y-1.5">
                        <label for="food-mealtype" class="text-xs font-bold text-slate-400 uppercase tracking-wider block">Tipo de comida</label>
                        <select id="food-mealtype" required class="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-emerald-500/50 focus:outline-none rounded-xl text-white text-sm">
                            <option value="Desayuno">Desayuno</option>
                            <option value="Comida" selected>Comida</option>
                            <option value="Merienda">Merienda</option>
                            <option value="Cena">Cena</option>
                            <option value="Snack">Snack</option>
                            <option value="Otro">Otro</option>
                        </select>
                    </div>
                </div>
                
                <div class="space-y-1.5">
                    <label for="food-datetime" class="text-xs font-bold text-slate-400 uppercase tracking-wider block">Fecha y Hora de consumo</label>
                    <input id="food-datetime" type="datetime-local" required value="${datetimeStr}" class="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-emerald-500/50 focus:outline-none rounded-xl text-white text-sm">
                </div>
                
                <div class="flex gap-3 pt-4">
                    <button type="button" onclick="navigateTo('food')" class="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all text-sm active:scale-95">
                        Cancelar
                    </button>
                    <button type="submit" class="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-all text-sm active:scale-95 shadow-lg shadow-emerald-500/10">
                        Guardar Registro
                    </button>
                </div>
            </form>
        </div>
    `;
}

window.guardarComida = function(e) {
    e.preventDefault();
    const name = document.getElementById("food-name").value.trim();
    const calories = parseInt(document.getElementById("food-calories").value, 10);
    const mealType = document.getElementById("food-mealtype").value;
    const datetime = document.getElementById("food-datetime").value;
    
    if (!name) {
        showToast("El nombre de la comida es obligatorio", "error");
        return;
    }
    if (isNaN(calories) || calories < 0) {
        showToast("Las calorías deben ser un número positivo", "error");
        return;
    }
    if (!datetime) {
        showToast("La fecha y la hora son obligatorias", "error");
        return;
    }
    
    const entry = {
        id: Date.now().toString(),
        name,
        calories,
        mealType,
        datetime,
        createdAt: new Date().toISOString()
    };
    
    state.foodEntries.push(entry);
    saveData();
    showToast("Comida registrada correctamente");
    navigateTo("food");
};

// --- PÁGINA 10: HISTORIAL DE INGESTA ---
function renderFoodHistory() {
    const totalEntries = state.foodEntries.length;
    const totalCalories = state.foodEntries.reduce((sum, e) => sum + Number(e.calories), 0);
    
    // Encontrar días únicos con registros
    const datesWithEntries = [...new Set(state.foodEntries.map(e => e.datetime.split('T')[0]))]
        .sort((a, b) => new Date(b) - new Date(a)); // Más recientes primero
        
    const totalDays = datesWithEntries.length || 1;
    const avgCalories = Math.round(totalCalories / totalDays);

    let content = `
        <div class="px-5 py-4 space-y-6">
            <!-- Tarjeta resumen histórico -->
            <div class="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
                <h3 class="text-xs font-semibold tracking-wider text-slate-400 uppercase mb-4">Total Acumulado</h3>
                
                <div class="grid grid-cols-3 gap-2 text-center">
                    <div class="bg-slate-950/60 p-3 rounded-2xl border border-slate-850">
                        <span class="text-[9px] text-slate-500 block">Total Kcal</span>
                        <span class="text-base font-extrabold text-white block mt-0.5">${totalCalories}</span>
                    </div>
                    <div class="bg-slate-950/60 p-3 rounded-2xl border border-slate-850">
                        <span class="text-[9px] text-slate-500 block">Registros</span>
                        <span class="text-base font-extrabold text-white block mt-0.5">${totalEntries}</span>
                    </div>
                    <div class="bg-slate-950/60 p-3 rounded-2xl border border-slate-850">
                        <span class="text-[9px] text-slate-500 block">Promedio</span>
                        <span class="text-base font-extrabold text-white block mt-0.5">${avgCalories} <span class="text-[8px] font-normal text-slate-500">/día</span></span>
                    </div>
                </div>
            </div>

            <!-- Listado por fechas -->
            <div class="space-y-4">
                <h3 class="text-xs font-semibold tracking-wider text-slate-400 uppercase">Registros por Fecha</h3>
    `;

    if (totalEntries === 0) {
        content += renderEmptyState("Aún no tienes registros de alimentos en el historial.", "Registrar comida", "add-food");
    } else {
        datesWithEntries.forEach(date => {
            // Filtrar comidas del día
            const entriesOfDay = state.foodEntries
                .filter(e => e.datetime.startsWith(date))
                .sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
                
            const dailySum = entriesOfDay.reduce((sum, e) => sum + Number(e.calories), 0);
            
            content += `
                <div class="bg-slate-950 border border-slate-800/40 rounded-2xl overflow-hidden">
                    <!-- Cabecera del día -->
                    <div class="bg-slate-900 px-4 py-2.5 flex items-center justify-between border-b border-slate-800/50">
                        <span class="text-xs font-bold text-white">${formatDate(date)}</span>
                        <span class="px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-400 text-[10px] font-bold border border-rose-500/15">
                            ${dailySum} kcal
                        </span>
                    </div>
                    <!-- Lista de alimentos -->
                    <div class="divide-y divide-slate-900">
            `;
            
            entriesOfDay.forEach(entry => {
                const time = entry.datetime.split('T')[1] || "";
                content += `
                    <div class="p-3 flex items-center justify-between hover:bg-slate-900/10">
                        <div class="flex items-center gap-2">
                            <span class="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0"></span>
                            <div class="space-y-0.5">
                                <p class="text-xs font-semibold text-slate-200 max-w-[180px] truncate">${entry.name}</p>
                                <p class="text-[9px] text-slate-500 font-medium">
                                    ${entry.mealType} ${time ? `&bull; ${time}` : ""}
                                </p>
                            </div>
                        </div>
                        
                        <div class="flex items-center gap-3">
                            <span class="text-xs font-bold text-white">${entry.calories} kcal</span>
                            <button onclick="eliminarComidaHistorial('${entry.id}')" class="text-slate-600 hover:text-red-400 transition-colors p-1">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                `;
            });
            
            content += `
                    </div>
                </div>
            `;
        });
    }

    return content + "</div></div>";
}

window.eliminarComidaHistorial = function(id) {
    const confirmDelete = confirm("¿Deseas eliminar este registro del historial?");
    if (confirmDelete) {
        state.foodEntries = state.foodEntries.filter(entry => entry.id !== id);
        saveData();
        showToast("Registro eliminado");
        renderApp();
    }
};

// --- PÁGINA 11: ACTIVIDAD FÍSICA ---
function renderActivity() {
    const isProfileIncomplete = !state.profile.heightCm || !state.profile.weightKg || !state.profile.birthdate || !state.profile.sex;
    
    const pasosKcal = calculateTodayStepCalories();
    const actividadKcal = calculateTodayActivityCalories();
    const activeCaloriesSum = pasosKcal + actividadKcal;
    
    // Obtener registros de pasos de hoy
    const stepsToday = state.stepEntries.find(e => e.date === getTodayISO())?.steps || 0;
    
    // Recientes combinados (últimos 5)
    const recentSteps = state.stepEntries.map(e => ({ ...e, type: "Pasos", name: `Caminar (${e.steps} pasos)` }));
    const recentExercises = state.activityEntries.map(e => ({ ...e, type: "Ejercicio" }));
    const allActivities = [...recentSteps, ...recentExercises]
        .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))
        .slice(0, 5);

    let content = `
        <div class="px-5 py-4 space-y-6">
            <!-- Tarjeta resumen calorias activas hoy -->
            <div class="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg flex items-center justify-between overflow-hidden relative">
                <div class="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-sky-500/5 blur-2xl"></div>
                <div>
                    <span class="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Calorías Activas Hoy</span>
                    <span class="text-3xl font-extrabold text-white mt-1 block">${activeCaloriesSum} <span class="text-xs font-medium text-slate-500">kcal</span></span>
                </div>
                <div class="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                    </svg>
                </div>
            </div>
            
            <!-- Bloques detallados de hoy -->
            <div class="grid grid-cols-2 gap-4">
                <div class="p-4 bg-slate-900 border border-slate-850 rounded-2xl space-y-1">
                    <span class="text-[9.5px] font-bold text-slate-500 tracking-wider uppercase block">Pasos de hoy</span>
                    <span class="text-lg font-bold text-white block">${stepsToday.toLocaleString("es")} pasos</span>
                    <span class="text-xs font-semibold text-sky-400 block">${pasosKcal} kcal quemadas</span>
                </div>
                <div class="p-4 bg-slate-900 border border-slate-850 rounded-2xl space-y-1">
                    <span class="text-[9.5px] font-bold text-slate-500 tracking-wider uppercase block">Actividades de hoy</span>
                    <span class="text-lg font-bold text-white block">${state.activityEntries.filter(e => e.date === getTodayISO()).length} registradas</span>
                    <span class="text-xs font-semibold text-emerald-400 block">${actividadKcal} kcal quemadas</span>
                </div>
            </div>

            <!-- Botones de Control -->
            <div class="grid grid-cols-2 gap-3">
                <button onclick="navigateTo('add-steps')" class="py-3.5 bg-slate-850 hover:bg-slate-800 text-slate-200 text-xs font-bold rounded-2xl flex items-center justify-center gap-2 border border-slate-850 transition-all active:scale-95">
                    <svg class="w-4 h-4 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 5l7 7-7 7M5 5l7 7-7 7"></path>
                    </svg>
                    Registrar Pasos
                </button>
                
                <button onclick="navigateTo('add-activity')" class="py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md shadow-emerald-500/10">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                    </svg>
                    Añadir Ejercicio
                </button>
            </div>
            
            <!-- Listado reciente -->
            <div class="space-y-3">
                <h3 class="text-xs font-semibold tracking-wider text-slate-400 uppercase">Actividades Recientes</h3>
    `;

    if (allActivities.length === 0) {
        content += renderEmptyState("No hay actividades ni pasos registrados últimamente.", "Añadir ejercicio", "add-activity");
    } else {
        content += `<div class="space-y-2.5">`;
        allActivities.forEach(item => {
            const isSteps = item.type === "Pasos";
            const iconBg = isSteps ? "bg-sky-500/10 text-sky-400 border-sky-500/15" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/15";
            
            content += `
                <div class="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between transition-all hover:border-slate-800/80">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl ${iconBg} border flex items-center justify-center shrink-0">
                            ${isSteps ? `
                                <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 5l7 7-7 7M5 5l7 7-7 7"></path>
                                </svg>
                            ` : `
                                <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                                </svg>
                            `}
                        </div>
                        <div class="space-y-0.5">
                            <h4 class="text-sm font-semibold text-white max-w-[160px] truncate">${item.name || item.type}</h4>
                            <div class="flex items-center gap-2">
                                <span class="px-1.5 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400">
                                    ${item.type}
                                </span>
                                <span class="text-[10px] text-slate-500 font-medium">
                                    ${formatDate(item.date)}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-2.5">
                        <span class="text-xs font-bold text-white">${item.calories} kcal</span>
                        <button onclick="eliminarActividad('${item.id}', '${item.type}')" class="w-9 h-9 rounded-xl hover:bg-red-500/10 border border-transparent hover:border-red-500/20 flex items-center justify-center text-slate-650 hover:text-red-400 transition-all active:scale-90">
                            <svg class="w-4.25 h-4.25" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        });
        content += `</div>`;
    }

    return content + "</div>";
}

window.eliminarActividad = function(id, type) {
    const confirmDelete = confirm(`¿Estás seguro de que quieres eliminar este registro de ${type}?`);
    if (confirmDelete) {
        if (type === "Pasos") {
            state.stepEntries = state.stepEntries.filter(entry => entry.id !== id);
        } else {
            state.activityEntries = state.activityEntries.filter(entry => entry.id !== id);
        }
        saveData();
        showToast("Actividad eliminada correctamente");
        renderApp();
    }
};

// --- PÁGINA 12: REGISTRAR PASOS DIARIOS ---
function renderAddSteps() {
    const isProfileIncomplete = !state.profile.heightCm || !state.profile.weightKg || !state.profile.birthdate || !state.profile.sex;
    
    // Cargar pasos guardados hoy para pre-rellenar
    const todayStr = getTodayISO();
    const existingSteps = state.stepEntries.find(e => e.date === todayStr)?.steps || "";

    let content = `
        <div class="px-5 py-4 space-y-6">
            <div>
                <h2 class="text-xl font-bold text-white">Registrar Pasos Diarios</h2>
                <p class="text-xs text-slate-400 font-medium">Lleva la cuenta de tus pasos diarios para estimar el gasto extra por movimiento pedestre</p>
            </div>
    `;

    if (isProfileIncomplete) {
        content += `
            <div class="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3">
                <svg class="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
                <div class="space-y-1">
                    <p class="text-xs font-semibold text-amber-400">Datos personales insuficientes</p>
                    <p class="text-[11px] text-slate-400 leading-relaxed">Debes completar tu peso, altura, edad y sexo en Datos Personales para calcular las calorías quemadas. De lo contrario, se guardará el registro con 0 kcal de gasto.</p>
                    <button type="button" onclick="navigateTo('data')" class="mt-2 text-[11px] font-bold text-amber-400 hover:underline">Completar ahora &rarr;</button>
                </div>
            </div>
        `;
    }

    content += `
        <form onsubmit="guardarPasos(event)" class="space-y-5">
            <div class="space-y-1.5">
                <label for="steps-date" class="text-xs font-bold text-slate-400 uppercase tracking-wider block">Fecha</label>
                <input id="steps-date" type="date" required value="${todayStr}" onchange="cambiarFechaPasos(this.value)" class="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-emerald-500/50 focus:outline-none rounded-xl text-white text-base">
            </div>
            
            <div class="space-y-1.5">
                <label for="steps-count" class="text-xs font-bold text-slate-400 uppercase tracking-wider block">Número de Pasos</label>
                <input id="steps-count" type="number" required min="0" max="100000" value="${existingSteps}" placeholder="Ej: 10000" oninput="calcularPrevisualizacionPasos(this.value)" class="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-emerald-500/50 focus:outline-none rounded-xl text-white placeholder-slate-700 text-lg font-bold">
            </div>

            <!-- Caja de previsualización dinámica -->
            <div id="steps-preview-card" class="bg-slate-950 border border-slate-850 rounded-2xl p-4 flex items-center justify-between">
                <div>
                    <span class="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Calorías Estimadas</span>
                    <span id="steps-preview-value" class="text-xl font-bold text-sky-400 block mt-1">0 <span class="text-xs font-medium text-slate-500">kcal</span></span>
                </div>
                <div class="w-10 h-10 rounded-xl bg-sky-500/5 border border-sky-500/10 flex items-center justify-center text-sky-400">
                    <svg class="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 5l7 7-7 7M5 5l7 7-7 7"></path>
                    </svg>
                </div>
            </div>

            <div class="flex gap-3 pt-2">
                <button type="button" onclick="navigateTo('activity')" class="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all text-sm active:scale-95">
                    Cancelar
                </button>
                <button type="submit" class="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-all text-sm active:scale-95 shadow-lg shadow-emerald-500/10">
                    Guardar Pasos
                </button>
            </div>
        </form>
    </div>
    `;

    // Cargar la previsualización inicial al abrir
    setTimeout(() => {
        if (existingSteps) {
            calcularPrevisualizacionPasos(existingSteps);
        }
    }, 50);

    return content;
}

window.cambiarFechaPasos = function(dateStr) {
    // Si ya existe un registro de pasos para esa fecha, cargarlo en el input
    const existing = state.stepEntries.find(e => e.date === dateStr);
    const countInput = document.getElementById("steps-count");
    if (countInput) {
        countInput.value = existing ? existing.steps : "";
        calcularPrevisualizacionPasos(existing ? existing.steps : 0);
    }
};

window.calcularPrevisualizacionPasos = function(stepsVal) {
    const previewVal = document.getElementById("steps-preview-value");
    if (!previewVal) return;

    const steps = parseInt(stepsVal, 10);
    const isProfileIncomplete = !state.profile.heightCm || !state.profile.weightKg || !state.profile.birthdate || !state.profile.sex;
    
    if (isNaN(steps) || steps <= 0 || isProfileIncomplete) {
        previewVal.innerHTML = `0 <span class="text-xs font-medium text-slate-500">kcal</span>`;
        return;
    }

    const { weightKg, heightCm, birthdate, sex } = state.profile;
    const edad = calcularEdad(birthdate);
    const kcal = calcularCaloriasPorPasos(steps, weightKg, heightCm, edad, sex);
    
    previewVal.innerHTML = `${kcal} <span class="text-xs font-medium text-slate-500">kcal</span>`;
};

window.guardarPasos = function(e) {
    e.preventDefault();
    const date = document.getElementById("steps-date").value;
    const stepsStr = document.getElementById("steps-count").value;
    const steps = parseInt(stepsStr, 10);
    
    if (!date) {
        showToast("La fecha es obligatoria", "error");
        return;
    }
    if (isNaN(steps) || steps < 0) {
        showToast("El número de pasos debe ser un número entero mayor o igual a 0", "error");
        return;
    }
    
    let calories = 0;
    const isProfileIncomplete = !state.profile.heightCm || !state.profile.weightKg || !state.profile.birthdate || !state.profile.sex;
    
    if (!isProfileIncomplete) {
        const { weightKg, heightCm, birthdate, sex } = state.profile;
        const edad = calcularEdad(birthdate);
        calories = calcularCaloriasPorPasos(steps, weightKg, heightCm, edad, sex);
    }
    
    // Evitar duplicados por fecha: sobreescribir si ya existe, si no añadir
    const existingIndex = state.stepEntries.findIndex(e => e.date === date);
    if (existingIndex > -1) {
        state.stepEntries[existingIndex] = {
            id: state.stepEntries[existingIndex].id,
            date,
            steps,
            calories,
            createdAt: new Date().toISOString()
        };
    } else {
        state.stepEntries.push({
            id: Date.now().toString(),
            date,
            steps,
            calories,
            createdAt: new Date().toISOString()
        });
    }
    
    saveData();
    showToast("Pasos registrados correctamente");
    navigateTo("activity");
};

// --- PÁGINA 13: REGISTRAR ACTIVIDAD FÍSICA MANUAL ---
function renderAddActivity() {
    const todayStr = getTodayISO();
    
    return `
        <div class="px-5 py-4 space-y-6">
            <div>
                <h2 class="text-xl font-bold text-white">Registrar Ejercicio</h2>
                <p class="text-xs text-slate-400 font-medium">Añade los detalles de otras actividades físicas manuales</p>
            </div>
            
            <form onsubmit="guardarActividad(event)" class="space-y-4.5">
                <div class="space-y-1.5">
                    <label for="act-name" class="text-xs font-bold text-slate-400 uppercase tracking-wider block">Nombre de la actividad</label>
                    <input id="act-name" type="text" required placeholder="Ej: Correr en cinta, Pesas..." class="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-emerald-500/50 focus:outline-none rounded-xl text-white placeholder-slate-700 text-sm">
                    
                    <!-- Sugerencias rápidas -->
                    <div class="flex flex-wrap gap-1.5 pt-1.5">
                        <button type="button" onclick="aplicarActividadRapida('Gimnasio')" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-lg border border-slate-700/20 active:scale-95">Gimnasio</button>
                        <button type="button" onclick="aplicarActividadRapida('Correr')" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-lg border border-slate-700/20 active:scale-95">Correr</button>
                        <button type="button" onclick="aplicarActividadRapida('Fútbol')" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-lg border border-slate-700/20 active:scale-95">Fútbol</button>
                        <button type="button" onclick="aplicarActividadRapida('Bicicleta')" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-lg border border-slate-700/20 active:scale-95">Bicicleta</button>
                        <button type="button" onclick="aplicarActividadRapida('Caminar')" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-lg border border-slate-700/20 active:scale-95">Caminar</button>
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                    <div class="space-y-1.5">
                        <label for="act-date" class="text-xs font-bold text-slate-400 uppercase tracking-wider block">Fecha</label>
                        <input id="act-date" type="date" required value="${todayStr}" class="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-emerald-500/50 focus:outline-none rounded-xl text-white text-sm">
                    </div>
                    
                    <div class="space-y-1.5">
                        <label for="act-calories" class="text-xs font-bold text-slate-400 uppercase tracking-wider block">Calorías Quemadas</label>
                        <input id="act-calories" type="number" required min="1" placeholder="Ej: 420" class="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-emerald-500/50 focus:outline-none rounded-xl text-white placeholder-slate-700 text-sm">
                    </div>
                </div>
                
                <div class="flex gap-3 pt-4">
                    <button type="button" onclick="navigateTo('activity')" class="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all text-sm active:scale-95">
                        Cancelar
                    </button>
                    <button type="submit" class="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-all text-sm active:scale-95 shadow-lg shadow-emerald-500/10">
                        Guardar Actividad
                    </button>
                </div>
            </form>
        </div>
    `;
}

window.aplicarActividadRapida = function(nombre) {
    const input = document.getElementById("act-name");
    if (input) {
        input.value = nombre;
    }
};

window.guardarActividad = function(e) {
    e.preventDefault();
    const name = document.getElementById("act-name").value.trim();
    const date = document.getElementById("act-date").value;
    const calories = parseInt(document.getElementById("act-calories").value, 10);
    
    if (!name) {
        showToast("El nombre de la actividad es obligatorio", "error");
        return;
    }
    if (!date) {
        showToast("La fecha es obligatoria", "error");
        return;
    }
    if (isNaN(calories) || calories <= 0) {
        showToast("Las calorías deben ser mayores que 0", "error");
        return;
    }
    
    const entry = {
        id: Date.now().toString(),
        name,
        date,
        calories,
        createdAt: new Date().toISOString()
    };
    
    state.activityEntries.push(entry);
    saveData();
    showToast("Ejercicio registrado exitosamente");
    navigateTo("activity");
};

// --- PÁGINA 14: PERFIL / AJUSTES (SETTINGS) ---
function renderSettings() {
    const { name, sex, birthdate, heightCm, weightKg, dailyDeficitGoal } = state.profile;
    
    return `
        <div class="px-5 py-4 space-y-6">
            <!-- Bloque de usuario -->
            <div class="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg flex items-center gap-4 overflow-hidden">
                <div class="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center font-extrabold text-2xl text-emerald-400 shrink-0">
                    ${(name || "U").substring(0, 2).toUpperCase()}
                </div>
                <div class="min-w-0 flex-1">
                    <h3 class="text-lg font-bold text-white truncate">${name || "Nombre de usuario"}</h3>
                    <p class="text-xs text-slate-400 truncate">${sex ? (sex === "hombre" ? "Hombre" : "Mujer") : "Sexo sin registrar"}${birthdate ? ` &bull; ${calcularEdad(birthdate)} años` : ""}</p>
                </div>
            </div>

            <!-- Importar / Exportar datos -->
            <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div class="space-y-1">
                    <h4 class="text-xs font-bold text-white uppercase tracking-wider">Copia de Seguridad</h4>
                    <p class="text-[10px] text-slate-500 leading-normal">Gestiona la copia de seguridad de todos tus datos para exportar o importar en otro terminal.</p>
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <button onclick="exportarDatos()" class="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition-all active:scale-95">
                        <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                        </svg>
                        Exportar datos
                    </button>
                    <button onclick="mostrarImportarContainer()" class="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition-all active:scale-95">
                        <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
                        </svg>
                        Importar datos
                    </button>
                </div>

                <!-- Caja oculta para importación JSON -->
                <div id="import-container" class="hidden space-y-3 pt-3 border-t border-slate-800/60">
                    <label for="import-json" class="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Pega el JSON de respaldo</label>
                    <textarea id="import-json" rows="4" placeholder='{"profile": {...}, "foodEntries": [...]}' class="w-full p-3 bg-slate-950 border border-slate-800 focus:border-emerald-500/50 focus:outline-none rounded-xl text-[11px] font-mono text-white placeholder-slate-700"></textarea>
                    <div class="flex gap-2">
                        <button onclick="cerrarImportarContainer()" class="flex-1 py-2 bg-slate-800 hover:bg-slate-750 text-slate-400 text-xs font-bold rounded-lg transition-all">Cancelar</button>
                        <button onclick="procesarImportarDatos()" class="flex-1 py-2 bg-emerald-500 text-slate-950 text-xs font-bold rounded-lg transition-all">Cargar datos</button>
                    </div>
                </div>
            </div>

            <!-- Acciones de riesgo -->
            <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div class="space-y-1">
                    <h4 class="text-xs font-bold text-white uppercase tracking-wider">Zona de Peligro</h4>
                    <p class="text-[10px] text-slate-500 leading-normal">Esta acción borrará de forma irreversible toda la información de la aplicación.</p>
                </div>
                
                <button onclick="confirmarReinicioTotal()" class="w-full py-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold rounded-xl hover:bg-red-500/20 transition-all active:scale-95 flex items-center justify-center gap-1.5">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                    Restablecer aplicación (Borrar datos)
                </button>
            </div>

            <!-- Nota de privacidad y versión -->
            <div class="space-y-4 text-center">
                <div class="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                    <p class="text-[10.5px] text-slate-500 leading-relaxed text-left">
                        🔒 <strong>Nota de Privacidad</strong>: Tus datos se guardan únicamente en este dispositivo mediante <code>localStorage</code>. No se envían a ningún servidor externo.
                    </p>
                </div>
                <div class="space-y-1">
                    <p class="text-[11px] font-bold text-slate-600">HealthHub App</p>
                    <p class="text-[9.5px] text-slate-500">Versión 1.0.0 &bull; Local & Privado</p>
                </div>
            </div>
        </div>
    `;
}

// Gestión de Copias de Seguridad (Backup)
window.exportarDatos = function() {
    try {
        const jsonStr = JSON.stringify(state, null, 2);
        // Crear un Blob y descargarlo
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `healthhub_backup_${getTodayISO()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast("Copia de seguridad descargada correctamente");
    } catch (e) {
        showToast("Error al exportar los datos", "error");
    }
};

window.mostrarImportarContainer = function() {
    const el = document.getElementById("import-container");
    if (el) el.classList.remove("hidden");
};

window.cerrarImportarContainer = function() {
    const el = document.getElementById("import-container");
    if (el) el.classList.add("hidden");
};

window.procesarImportarDatos = function() {
    const textarea = document.getElementById("import-json");
    if (!textarea) return;
    
    const value = textarea.value.trim();
    if (!value) {
        showToast("Por favor, introduce una cadena JSON válida", "error");
        return;
    }
    
    try {
        const parsed = JSON.parse(value);
        
        // Validación mínima de estructura para evitar corruptar el estado
        if (!parsed.profile && !parsed.foodEntries && !parsed.stepEntries && !parsed.activityEntries) {
            throw new Error("El archivo no contiene un formato compatible de HealthHub");
        }
        
        state = {
            profile: {
                name: parsed.profile?.name || "",
                sex: parsed.profile?.sex || "",
                birthdate: parsed.profile?.birthdate || "",
                heightCm: parsed.profile?.heightCm || null,
                weightKg: parsed.profile?.weightKg || null,
                dailyDeficitGoal: parsed.profile?.dailyDeficitGoal || null
            },
            foodEntries: parsed.foodEntries || [],
            stepEntries: parsed.stepEntries || [],
            activityEntries: parsed.activityEntries || []
        };
        
        saveData();
        showToast("Datos restaurados correctamente");
        cerrarImportarContainer();
        navigateTo("settings");
    } catch (e) {
        showToast("Error en el formato del JSON introducido", "error");
    }
};

// Reinicio total
window.confirmarReinicioTotal = function() {
    const confirmDelete = confirm("⚠️ ¿ESTÁS COMPLETAMENTE SEGURO?\n\nEsta acción eliminará de forma irreversible tu perfil, historial de comidas, pasos y actividades. No se puede deshacer.");
    if (confirmDelete) {
        // Restablecer estado a vacío
        state = {
            profile: {
                name: "",
                sex: "",
                birthdate: "",
                heightCm: null,
                weightKg: null,
                dailyDeficitGoal: null
            },
            foodEntries: [],
            stepEntries: [],
            activityEntries: []
        };
        saveData();
        showToast("Todos los datos locales han sido borrados", "error");
        navigateTo("home");
    }
};

// ==========================================
// 9. RENDERIZACIÓN GLOBAL (APP ASSEMBLY)
// ==========================================

function renderApp() {
    const root = document.getElementById("app-root");
    if (!root) return;
    
    // Título y subtítulo del Header según la página
    let pageTitle = "HealthHub";
    let pageSubtitle = "Control de salud";
    let showBack = false;
    let backTarget = "home";
    let pageHTML = "";
    
    switch (currentPage) {
        case "home":
            pageTitle = "HealthHub";
            pageSubtitle = "Control de Salud y Déficit";
            pageHTML = renderHome();
            break;
        case "data":
            pageTitle = "Datos Personales";
            pageSubtitle = "Configura tu perfil";
            showBack = true;
            backTarget = "home";
            pageHTML = renderData();
            break;
        case "height":
            pageTitle = "Altura";
            pageSubtitle = "Actualizar estatura";
            showBack = true;
            backTarget = "data";
            pageHTML = renderHeight();
            break;
        case "weight":
            pageTitle = "Peso";
            pageSubtitle = "Actualizar peso corporal";
            showBack = true;
            backTarget = "data";
            pageHTML = renderWeight();
            break;
        case "birthdate":
            pageTitle = "Fecha de Nacimiento";
            pageSubtitle = "Actualizar edad";
            showBack = true;
            backTarget = "data";
            pageHTML = renderBirthdate();
            break;
        case "sex":
            pageTitle = "Sexo Biológico";
            pageSubtitle = "Parámetro metabólico";
            showBack = true;
            backTarget = "data";
            pageHTML = renderSex();
            break;
        case "deficit":
            pageTitle = "Meta de Déficit";
            pageSubtitle = "Objetivo calórico diario";
            showBack = true;
            backTarget = "data";
            pageHTML = renderDeficit();
            break;
        case "food":
            pageTitle = "Alimentación";
            pageSubtitle = "Calorías ingeridas hoy";
            pageHTML = renderFood();
            break;
        case "add-food":
            pageTitle = "Registrar Alimento";
            pageSubtitle = "Añadir comida al diario";
            showBack = true;
            backTarget = "food";
            pageHTML = renderAddFood();
            break;
        case "food-history":
            pageTitle = "Historial Alimentario";
            pageSubtitle = "Todas las calorías consumidas";
            showBack = true;
            backTarget = "food";
            pageHTML = renderFoodHistory();
            break;
        case "activity":
            pageTitle = "Actividad Física";
            pageSubtitle = "Esfuerzo y movimiento hoy";
            pageHTML = renderActivity();
            break;
        case "add-steps":
            pageTitle = "Registrar Pasos";
            pageSubtitle = "Registrar pasos caminados";
            showBack = true;
            backTarget = "activity";
            pageHTML = renderAddSteps();
            break;
        case "add-activity":
            pageTitle = "Registrar Ejercicio";
            pageSubtitle = "Añadir ejercicio físico manual";
            showBack = true;
            backTarget = "activity";
            pageHTML = renderAddActivity();
            break;
        case "settings":
            pageTitle = "Ajustes y Perfil";
            pageSubtitle = "Administración local de la app";
            pageHTML = renderSettings();
            break;
        default:
            pageTitle = "HealthHub";
            pageHTML = renderHome();
    }
    
    // Estructurar el layout dinámico
    root.innerHTML = `
        ${renderHeader(pageTitle, pageSubtitle, showBack, backTarget)}
        <main class="flex-1 pb-16 animate-fade-in">
            ${pageHTML}
        </main>
        ${renderBottomNav()}
    `;
}

// ==========================================
// 10. INICIALIZACIÓN
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    // 1. Cargar datos guardados
    loadData();
    
    // 2. Renderizar aplicación
    renderApp();
});
