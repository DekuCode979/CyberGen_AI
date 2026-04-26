// ====================== CYBERGEN AI V15.2 ======================
console.log('🚀 CyberGen AI iniciando...');

// Configuración
const MODELS_LIST = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro", "gemini-1.5-flash", "gemini-1.5-pro"];
const SYSTEM_PROMPT = 'Eres CyberGen AI, analista de datos. Usa ## títulos, **negritas**, `código` para números. Para gráficos: [CHART_DATA:{"type":"bar","data":{"labels":["A","B"],"datasets":[{"label":"Datos","data":[10,20]}]}}]';

// API Key
let API_KEY = "";
try {
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) {
        API_KEY = import.meta.env.VITE_GEMINI_API_KEY.trim();
    }
} catch(e) {}
if (!API_KEY && window.CYBERGEN_CONFIG?.GEMINI_API_KEY) {
    API_KEY = window.CYBERGEN_CONFIG.GEMINI_API_KEY.trim();
}
if (!API_KEY) {
    API_KEY = localStorage.getItem("GEMINI_PRO_KEY") || "";
}

// Estado
let globalHistory = [];
try { globalHistory = JSON.parse(localStorage.getItem('cyberpunk_history_v15')) || []; } catch(e) { globalHistory = []; }
let currentSessionStartIndex = globalHistory.length;
let uploadedFilesData = [];
let selectedModel = localStorage.getItem("selectedGeminiModel") || MODELS_LIST[0];
let isAudioEnabled = localStorage.getItem("cyberpunk_audio") !== "false";

// DOM
const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const modelStatus = document.getElementById('model-status');
const modelSelect = document.getElementById('model-select');
const historyList = document.getElementById('history-list');
const fileUpload = document.getElementById('file-upload');
const toggleAudioBtn = document.getElementById('toggle-audio-global');
const audioStatusText = document.getElementById('audio-status-text');

// Inicialización
function initApp() {
    console.log('🔑 API Key:', API_KEY ? 'Configurada' : 'NO configurada');
    
    if (!API_KEY) {
        addMessage('ai', '⚠️ <b>API Key no detectada.</b><br>En Vercel: configura VITE_GEMINI_API_KEY.<br>En local: crea config.js');
    }
    
    modelSelect.value = selectedModel;
    updateModelStatus();
    updateAudioBtn();
    bindEvents();
}

function bindEvents() {
    sendBtn.addEventListener('click', handleSend);
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });
    
    document.getElementById('toggle-sidebar').addEventListener('click', () => {
        sidebar.classList.toggle('closed');
        sidebarOverlay.classList.toggle('active');
    });
    document.getElementById('close-sidebar').addEventListener('click', () => {
        sidebar.classList.add('closed');
        sidebarOverlay.classList.remove('active');
    });
    sidebarOverlay.addEventListener('click', () => {
        sidebar.classList.add('closed');
        sidebarOverlay.classList.remove('active');
    });
    
    document.getElementById('clear-chat').addEventListener('click', clearChat);
    document.getElementById('new-chat-btn').addEventListener('click', newSession);
    document.getElementById('btn-download-session').addEventListener('click', downloadSession);
    document.getElementById('btn-clear-memory').addEventListener('click', clearMemory);
    toggleAudioBtn.addEventListener('click', toggleAudio);
    modelSelect.addEventListener('change', (e) => {
        selectedModel = e.target.value;
        localStorage.setItem("selectedGeminiModel", selectedModel);
        updateModelStatus();
    });
    fileUpload.addEventListener('change', handleFiles);
    document.getElementById('stt-btn').addEventListener('click', speechToText);
    
    document.querySelectorAll('.quick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            userInput.value = btn.getAttribute('data-prompt');
            userInput.focus();
        });
    });
}

// Chat
function addMessage(role, text) {
    const div = document.createElement('div');
    div.className = `message ${role}-message`;
    div.innerHTML = text;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
    return div;
}

function formatText(text) {
    if (!text) return '';
    text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (m, lang, code) => {
        return `<pre><code class="language-${lang || 'javascript'}">${code.trim().replace(/</g,'&lt;').replace(/>/g,'&gt;')}</code></pre>`;
    });
    return marked.parse(text);
}

function clearChat() {
    chatBox.innerHTML = '<div class="welcome-screen"><div class="welcome-icon"><i class="fas fa-brain" style="color: var(--neon-cyan);"></i></div><h2>Terminal Limpia</h2><p>Escribe tu consulta.</p></div>';
}

function newSession() {
    currentSessionStartIndex = globalHistory.length;
    clearChat();
    addMessage('ai', formatText('🧠 **Nueva sesión iniciada.**'));
}

function clearMemory() {
    if (confirm('¿Borrar toda la memoria?')) {
        globalHistory = [];
        currentSessionStartIndex = 0;
        localStorage.removeItem('cyberpunk_history_v15');
        clearChat();
        renderHistory();
        addMessage('ai', formatText('🗑️ Memoria borrada.'));
    }
}

function downloadSession() {
    const text = globalHistory.slice(currentSessionStartIndex).map(h => `${h.role === 'user' ? 'Tu' : 'IA'}: ${h.text}`).join('\n\n---\n\n');
    const blob = new Blob([text], {type: 'text/plain'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sesion.txt';
    a.click();
}

// API Gemini
async function callAPI(prompt, files = []) {
    for (let i = 0; i < MODELS_LIST.length; i++) {
        const model = MODELS_LIST[i];
        updateModelStatus();
        
        try {
            const contents = globalHistory.slice(currentSessionStartIndex).map(h => ({
                role: h.role,
                parts: [{ text: h.text }]
            })).slice(-10);
            
            const userParts = [{ text: prompt }];
            if (files.length > 0 && i === 0) {
                files.forEach(f => {
                    userParts.push({ inlineData: { mimeType: f.type, data: f.data } });
                });
            }
            contents.push({ role: "user", parts: userParts });
            
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents,
                    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
                    generationConfig: { temperature: 0.7, maxOutputTokens: 4096 }
                })
            });
            
            if (!res.ok) {
                if (res.status === 400 || res.status === 404 || res.status === 429) continue;
                throw new Error(`Error ${res.status}`);
            }
            
            const data = await res.json();
            return data.candidates[0].content.parts[0].text;
            
        } catch(e) {
            console.error(`Error con ${model}:`, e);
            if (i >= MODELS_LIST.length - 1) throw e;
        }
    }
    throw new Error("Todos los modelos fallaron");
}

// Gráficos
function processCharts(text, parent) {
    const regex = /\[CHART_DATA:\s*(\{[\s\S]*?\})\s*\]/g;
    let match;
    let result = text;
    
    while ((match = regex.exec(text)) !== null) {
        try {
            let json = match[1].replace(/,\s*}/g, '}').replace(/,\s*\]/g, ']');
            json = json.replace(/(['"]?)([a-zA-Z0-9_]+)(['"]?)\s*:/g, '"$2":');
            const config = JSON.parse(json);
            const id = 'chart-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
            
            const wrapper = document.createElement('div');
            wrapper.className = 'chart-panel';
            wrapper.innerHTML = `<div class="chart-header"><h3>Gráfico</h3><button onclick="this.parentElement.parentElement.remove()"><i class="fas fa-times"></i></button></div><canvas id="${id}"></canvas>`;
            parent.appendChild(wrapper);
            
            setTimeout(() => {
                const ctx = document.getElementById(id)?.getContext('2d');
                if (ctx) new Chart(ctx, config);
            }, 200);
            
            result = result.replace(match[0], '');
        } catch(e) {
            result = result.replace(match[0], '<p style="color:red">[Error en gráfico]</p>');
        }
    }
    return result;
}

// Enviar mensaje
async function handleSend() {
    const text = userInput.value.trim();
    if (!text && uploadedFilesData.length === 0) return;
    if (!API_KEY) {
        addMessage('ai', formatText('❌ **Sin API Key.** Configúrala en Vercel o en config.js'));
        return;
    }
    
    userInput.value = '';
    const welcome = document.getElementById('welcome-screen');
    if (welcome) welcome.style.display = 'none';
    
    addMessage('user', formatText(text || '📎 Archivo adjunto'));
    globalHistory.push({ role: "user", text });
    localStorage.setItem('cyberpunk_history_v15', JSON.stringify(globalHistory));
    
    const loadingDiv = addMessage('ai', '<i class="fas fa-spinner fa-spin"></i> Pensando...');
    
    try {
        const files = uploadedFilesData.map(f => ({ type: f.type, data: f.base64 }));
        uploadedFilesData = [];
        
        const response = await callAPI(text, files);
        loadingDiv.remove();
        
        const msgDiv = addMessage('ai', '');
        let clean = processCharts(response, msgDiv);
        msgDiv.innerHTML = formatText(clean);
        
        msgDiv.querySelectorAll('pre code').forEach(b => Prism.highlightElement(b));
        
        globalHistory.push({ role: "model", text: response });
        localStorage.setItem('cyberpunk_history_v15', JSON.stringify(globalHistory));
        renderHistory();
        
        speak(response);
        
    } catch(e) {
        loadingDiv.innerHTML = formatText('❌ **Error:** ' + e.message);
    }
}

// Archivos
function handleFiles(e) {
    const files = e.target.files;
    if (!files.length) return;
    
    uploadedFilesData = [];
    let count = 0;
    
    Array.from(files).forEach(f => {
        const reader = new FileReader();
        reader.onload = function(ev) {
            uploadedFilesData.push({
                name: f.name,
                type: f.type,
                base64: ev.target.result.split(',')[1]
            });
            count++;
            if (count === files.length) {
                addMessage('ai', formatText(`✅ **${files.length} archivo(s) listo(s).**`));
            }
        };
        reader.readAsDataURL(f);
    });
    e.target.value = '';
}

// Voz
function speak(text) {
    if (!isAudioEnabled || !text) return;
    window.speechSynthesis.cancel();
    
    const clean = text
        .replace(/\[CHART_DATA[\s\S]*?\]/g, '')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/<[^>]*>/g, '')
        .replace(/[#*`_~\-\[\]]/g, ' ')
        .replace(/([.?!])\s*/g, '$1|')
        .replace(/\s+/g, ' ').trim();
    
    if (!clean) return;
    
    const chunks = clean.split('|').filter(c => c.trim());
    let i = 0;
    
    function next() {
        if (i >= chunks.length) return;
        const u = new SpeechSynthesisUtterance(chunks[i].trim());
        u.lang = 'es-ES';
        u.rate = 1.0;
        u.onend = () => { i++; next(); };
        u.onerror = () => { i++; next(); };
        window.speechSynthesis.speak(u);
    }
    setTimeout(next, 100);
}

function toggleAudio() {
    isAudioEnabled = !isAudioEnabled;
    localStorage.setItem("cyberpunk_audio", isAudioEnabled);
    updateAudioBtn();
    if (!isAudioEnabled) window.speechSynthesis.cancel();
}

function updateAudioBtn() {
    if (!toggleAudioBtn) return;
    const icon = toggleAudioBtn.querySelector('i');
    icon.className = isAudioEnabled ? 'fas fa-volume-up' : 'fas fa-volume-mute';
    audioStatusText.textContent = isAudioEnabled ? 'ON' : 'OFF';
}

// Utilidades
function updateModelStatus() {
    modelStatus.textContent = selectedModel;
}

function renderHistory() {
    if (!historyList) return;
    historyList.innerHTML = '';
    const msgs = globalHistory.filter(m => m.role === 'user').slice(-10).reverse();
    if (!msgs.length) {
        historyList.innerHTML = '<p style="color:var(--text-dim);padding:10px;">Sin historial</p>';
        return;
    }
    msgs.forEach(m => {
        const d = document.createElement('div');
        d.className = 'history-item';
        d.textContent = m.text.substring(0, 35) + '...';
        historyList.appendChild(d);
    });
}

function speechToText() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
        alert('Reconocimiento de voz no soportado. Usa Chrome.');
        return;
    }
    const rec = new SR();
    rec.lang = 'es-ES';
    rec.onresult = (e) => {
        userInput.value = e.results[0][0].transcript;
        userInput.focus();
    };
    rec.start();
    addMessage('ai', formatText('🎤 Escuchando...'));
}

// Arranque
document.addEventListener('DOMContentLoaded', initApp);
console.log('✅ CyberGen AI listo');