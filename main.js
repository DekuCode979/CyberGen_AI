console.log('🚀 CyberGen AI V1.2 iniciando...');

const MODELS_LIST = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro", "gemini-1.5-flash", "gemini-1.5-pro"];
const SYSTEM_PROMPT = 'Eres CyberGen AI, analista de datos. Usa ## títulos, **negritas**, `código` para números. Para gráficos: [CHART_DATA:{"type":"bar","data":{"labels":["A","B"],"datasets":[{"label":"Datos","data":[10,20]}]}}]';

// Busca API Key en: 1) config.js (local) 2) Variable de entorno (Vercel) 3) localStorage
let API_KEY = "";
try { API_KEY = window.CYBERGEN_CONFIG.GEMINI_API_KEY.trim(); } catch(e) {}
if (!API_KEY && typeof VITE_GEMINI_API_KEY !== 'undefined') API_KEY = VITE_GEMINI_API_KEY;

let globalHistory = [];
try { globalHistory = JSON.parse(localStorage.getItem('cyberpunk_history_v15')) || []; } catch(e) { globalHistory = []; }
let currentSessionStartIndex = globalHistory.length;
let uploadedFilesData = [];
let selectedModel = localStorage.getItem("selectedGeminiModel") || MODELS_LIST[0];
let isAudioEnabled = localStorage.getItem("cyberpunk_audio") !== "false";
let isProcessing = false;

const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const modelStatus = document.getElementById('model-status');
const statusDot = document.getElementById('status-dot');
const modelSelect = document.getElementById('model-select');
const historyList = document.getElementById('history-list');
const fileUpload = document.getElementById('file-upload');
const toggleAudioBtn = document.getElementById('toggle-audio-global');
const audioStatusText = document.getElementById('audio-status-text');

function initApp() {
    if (statusDot) statusDot.style.background = API_KEY ? 'var(--neon-green)' : 'var(--neon-pink)';
    if (modelSelect) modelSelect.value = selectedModel;
    modelStatus.textContent = selectedModel;
    updateAudioBtn();
    bindEvents();
    renderHistory();
    console.log('✅ Listo. API Key:', API_KEY ? 'SÍ' : 'NO');
}

function bindEvents() {
    sendBtn.addEventListener('click', handleSend);
    userInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    });
    document.getElementById('toggle-sidebar').addEventListener('click', function() {
        sidebar.classList.toggle('closed');
        sidebarOverlay.classList.toggle('active');
    });
    document.getElementById('close-sidebar').addEventListener('click', function() {
        sidebar.classList.add('closed');
        sidebarOverlay.classList.remove('active');
    });
    sidebarOverlay.addEventListener('click', function() {
        sidebar.classList.add('closed');
        sidebarOverlay.classList.remove('active');
    });
    document.getElementById('clear-chat').addEventListener('click', function() {
        chatBox.innerHTML = '<div class="welcome-screen"><div class="welcome-icon"><i class="fas fa-brain" style="color: var(--neon-cyan);"></i></div><h2>Terminal Limpia</h2><p>Escribe tu consulta.</p></div>';
    });
    document.getElementById('new-chat-btn').addEventListener('click', function() {
        currentSessionStartIndex = globalHistory.length;
        chatBox.innerHTML = '<div class="welcome-screen"><div class="welcome-icon"><i class="fas fa-brain" style="color: var(--neon-cyan);"></i></div><h2>Terminal Limpia</h2><p>Escribe tu consulta.</p></div>';
        addMessage('ai', '<b>🧠 Nueva sesión iniciada.</b>');
    });
    document.getElementById('btn-download-session').addEventListener('click', function() {
        var text = globalHistory.slice(currentSessionStartIndex).map(function(h) {
            return (h.role === 'user' ? 'TU' : 'IA') + ': ' + h.text;
        }).join('\n\n---\n\n');
        var blob = new Blob([text], {type: 'text/plain'});
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'sesion.txt';
        a.click();
    });
    document.getElementById('btn-clear-memory').addEventListener('click', function() {
        if (confirm('¿Borrar toda la memoria?')) {
            globalHistory = [];
            currentSessionStartIndex = 0;
            localStorage.removeItem('cyberpunk_history_v15');
            chatBox.innerHTML = '<div class="welcome-screen"><div class="welcome-icon"><i class="fas fa-brain" style="color: var(--neon-cyan);"></i></div><h2>Terminal Limpia</h2><p>Escribe tu consulta.</p></div>';
            renderHistory();
            addMessage('ai', '<b>🗑️ Memoria borrada.</b>');
        }
    });
    toggleAudioBtn.addEventListener('click', function() {
        isAudioEnabled = !isAudioEnabled;
        localStorage.setItem("cyberpunk_audio", isAudioEnabled);
        var icon = toggleAudioBtn.querySelector('i');
        icon.className = isAudioEnabled ? 'fas fa-volume-up' : 'fas fa-volume-mute';
        audioStatusText.textContent = isAudioEnabled ? 'ON' : 'OFF';
        if (!isAudioEnabled) window.speechSynthesis.cancel();
    });
    modelSelect.addEventListener('change', function() {
        selectedModel = modelSelect.value;
        localStorage.setItem("selectedGeminiModel", selectedModel);
        modelStatus.textContent = selectedModel;
    });
    fileUpload.addEventListener('change', function(e) {
        var files = e.target.files;
        if (!files.length) return;
        uploadedFilesData = [];
        var count = 0;
        for (var i = 0; i < files.length; i++) {
            (function(f) {
                var reader = new FileReader();
                reader.onload = function(ev) {
                    uploadedFilesData.push({ name: f.name, type: f.type, base64: ev.target.result.split(',')[1] });
                    count++;
                    if (count === files.length) {
                        addMessage('ai', '<b>✅ ' + files.length + ' archivo(s) listo(s).</b>');
                    }
                };
                reader.readAsDataURL(f);
            })(files[i]);
        }
        e.target.value = '';
    });
    document.getElementById('stt-btn').addEventListener('click', function() {
        var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) { addMessage('ai', '<b>🎤 No soportado.</b>'); return; }
        var rec = new SR();
        rec.lang = 'es-ES';
        rec.onresult = function(e) { userInput.value = e.results[0][0].transcript; userInput.focus(); };
        rec.start();
        addMessage('ai', '<b>🎤 Escuchando...</b>');
    });
}

function addMessage(role, text) {
    var div = document.createElement('div');
    div.className = 'message ' + role + '-message';
    div.innerHTML = text;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
    return div;
}

function updateAudioBtn() {
    if (!toggleAudioBtn) return;
    var icon = toggleAudioBtn.querySelector('i');
    icon.className = isAudioEnabled ? 'fas fa-volume-up' : 'fas fa-volume-mute';
    audioStatusText.textContent = isAudioEnabled ? 'ON' : 'OFF';
}

function renderHistory() {
    if (!historyList) return;
    historyList.innerHTML = '';
    var msgs = globalHistory.filter(function(m) { return m.role === 'user'; }).slice(-10).reverse();
    if (!msgs.length) {
        historyList.innerHTML = '<p style="color:var(--text-dim);padding:10px;">Sin historial</p>';
        return;
    }
    msgs.forEach(function(m) {
        var d = document.createElement('div');
        d.className = 'history-item';
        d.textContent = m.text.substring(0, 35) + '...';
        historyList.appendChild(d);
    });
}

async function handleSend() {
    if (isProcessing) return;
    var text = userInput.value.trim();
    if (!text && uploadedFilesData.length === 0) return;

    isProcessing = true;
    sendBtn.disabled = true;
    sendBtn.style.opacity = '0.5';
    userInput.value = '';

    var welcome = document.getElementById('welcome-screen');
    if (welcome) welcome.style.display = 'none';

    addMessage('user', text || '📎 Archivo adjunto');
    globalHistory.push({ role: "user", text: text });
    localStorage.setItem('cyberpunk_history_v15', JSON.stringify(globalHistory));

    var loadingDiv = addMessage('ai', '<i class="fas fa-spinner fa-spin"></i> Pensando...');

    try {
        var files = uploadedFilesData.map(function(f) { return { type: f.type, data: f.base64 }; });
        uploadedFilesData = [];

        var response = await callAPI(text, files);
        loadingDiv.remove();

        var msgDiv = addMessage('ai', '');
        msgDiv.innerHTML = formatText(response);

        globalHistory.push({ role: "model", text: response });
        localStorage.setItem('cyberpunk_history_v15', JSON.stringify(globalHistory));
        renderHistory();

        if (isAudioEnabled && response) {
            window.speechSynthesis.cancel();
            var clean = response.replace(/\[CHART_DATA[\s\S]*?\]/g, '').replace(/```[\s\S]*?```/g, '').replace(/<[^>]*>/g, '').replace(/[#*`_~\-\[\]]/g, ' ').replace(/([.?!])\s*/g, '$1|').replace(/\s+/g, ' ').trim();
            if (clean) {
                var chunks = clean.split('|').filter(function(c) { return c.trim(); });
                var i = 0;
                function next() {
                    if (i >= chunks.length) return;
                    var u = new SpeechSynthesisUtterance(chunks[i].trim());
                    u.lang = 'es-ES'; u.rate = 1.0;
                    u.onend = function() { i++; next(); };
                    u.onerror = function() { i++; next(); };
                    window.speechSynthesis.speak(u);
                }
                setTimeout(next, 100);
            }
        }

    } catch(e) {
        loadingDiv.innerHTML = '<b>❌ Error:</b> ' + e.message;
        if (statusDot) statusDot.style.background = 'var(--neon-pink)';
    }

    isProcessing = false;
    sendBtn.disabled = false;
    sendBtn.style.opacity = '1';
    userInput.focus();
}

async function callAPI(prompt, files) {
    for (var i = 0; i < MODELS_LIST.length; i++) {
        var model = MODELS_LIST[i];
        modelStatus.textContent = '🔄 ' + model;

        try {
            var contents = globalHistory.slice(currentSessionStartIndex).map(function(h) {
                return { role: h.role, parts: [{ text: h.text }] };
            }).slice(-10);

            var userParts = [{ text: prompt }];
            if (files && files.length > 0 && i === 0) {
                files.forEach(function(f) {
                    userParts.push({ inlineData: { mimeType: f.type, data: f.data } });
                });
            }
            contents.push({ role: "user", parts: userParts });

            var res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + API_KEY, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: contents,
                    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
                    generationConfig: { temperature: 0.7, maxOutputTokens: 4096 }
                })
            });

            if (!res.ok) {
                if (res.status === 400 || res.status === 404 || res.status === 429) continue;
                var err = await res.json().catch(function() { return {}; });
                throw new Error(err.error?.message || 'Error ' + res.status);
            }

            var data = await res.json();
            modelStatus.textContent = selectedModel;
            if (statusDot) statusDot.style.background = 'var(--neon-green)';
            return data.candidates[0].content.parts[0].text;

        } catch(e) {
            console.error('Error con ' + model + ':', e.message);
            if (i >= MODELS_LIST.length - 1) throw e;
        }
    }
    throw new Error("Todos los modelos fallaron");
}

function formatText(text) {
    if (!text) return '';
    text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, function(m, lang, code) {
        return '<pre><code>' + code.trim().replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</code></pre>';
    });
    try { text = marked.parse(text); } catch(e) {}
    return text;
}

document.addEventListener('DOMContentLoaded', initApp);
console.log('✅ CyberGen AI V15.2 listo');
