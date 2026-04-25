// ====================== CYBERGEN AI ======================
console.log('🚀 CyberGen AI iniciando...');

const MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro", "gemini-2.0-flash", "gemini-1.5-flash"];

const SYSTEM_PROMPT = 'Eres CyberGen AI, analista de datos senior. ' +
    'Usa ## títulos, **negritas**, `código` para números. ' +
    'Para gráficos: [CHART_DATA:{"type":"bar","data":{"labels":["A","B"],"datasets":[{"label":"V","data":[10,20]}]}}]';

// =======================================
// 🔐 API KEY SEGURA
// =======================================
var API_KEY = '';
var IS_DEMO = true;

// 1. Intentar variable global (Vercel/Netlify)
if (typeof window.GEMINI_API_KEY !== 'undefined' && window.GEMINI_API_KEY) {
    API_KEY = window.GEMINI_API_KEY;
}

// 2. Intentar localStorage
if (!API_KEY) {
    try {
        var saved = localStorage.getItem('cybergen_api_key');
        if (saved && saved.length > 10) API_KEY = saved;
    } catch(e) {}
}

IS_DEMO = !API_KEY;

// Función pública para configurar API Key desde consola
window.configurarAPI = function(clave) {
    if (clave && clave.length > 10) {
        API_KEY = clave;
        IS_DEMO = false;
        try { localStorage.setItem('cybergen_api_key', clave); } catch(e) {}
        updateModelDisplay();
        console.log('✅ API Key configurada. IA activa.');
        return '✅ OK';
    }
    return '❌ Clave inválida';
};

// Estado
var chatHistory = [];
var selectedModel = MODELS[0];
var isAudioEnabled = true;
var currentChart = null;

// ====================== INICIALIZACIÓN ======================
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ DOM listo');
    loadSettings();
    initModelSelector();
    bindAllEvents();
    updateModelDisplay();
    updateAudioButton();
    console.log(IS_DEMO ? '🔔 MODO DEMO' : '🔐 IA ACTIVA');
});

function loadSettings() {
    try {
        var m = localStorage.getItem('cybergen_model');
        if (m && MODELS.indexOf(m) >= 0) selectedModel = m;
        var a = localStorage.getItem('cybergen_audio');
        if (a !== null) isAudioEnabled = a === 'true';
    } catch(e) {}
}

// ====================== EVENTOS ======================
function bindAllEvents() {
    // Enviar
    var sendBtn = document.getElementById('send-btn');
    var userInput = document.getElementById('user-input');
    if (sendBtn) sendBtn.addEventListener('click', handleSend);
    if (userInput) {
        userInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
        });
        userInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 60) + 'px';
        });
    }

    // Sidebar
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebar-overlay');
    var toggleBtn = document.getElementById('toggle-sidebar');
    var closeBtn = document.getElementById('close-sidebar');
    
    if (toggleBtn) toggleBtn.addEventListener('click', function() {
        if (sidebar) sidebar.classList.remove('closed');
        if (overlay && window.innerWidth <= 768) overlay.classList.add('active');
    });
    if (closeBtn) closeBtn.addEventListener('click', function() {
        if (sidebar) sidebar.classList.add('closed');
        if (overlay) overlay.classList.remove('active');
    });
    if (overlay) overlay.addEventListener('click', function() {
        if (sidebar) sidebar.classList.add('closed');
        overlay.classList.remove('active');
    });
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && sidebar && !sidebar.classList.contains('closed')) {
            sidebar.classList.add('closed');
            if (overlay) overlay.classList.remove('active');
        }
    });

    // Botones
    var clearBtn = document.getElementById('clear-chat');
    var exportBtn = document.getElementById('btn-export');
    var newChatBtn = document.getElementById('btn-new-chat');
    var closeChartBtn = document.getElementById('close-chart-btn');
    
    if (clearBtn) clearBtn.addEventListener('click', clearChat);
    if (exportBtn) exportBtn.addEventListener('click', exportConversation);
    if (newChatBtn) newChatBtn.addEventListener('click', function() { clearChat(); if (sidebar) sidebar.classList.add('closed'); });
    if (closeChartBtn) closeChartBtn.addEventListener('click', hideChartPanel);

    // Voz
    var voiceBtn = document.getElementById('voice-btn');
    var audioBtn = document.getElementById('toggle-audio-btn');
    if (voiceBtn) voiceBtn.addEventListener('click', startVoice);
    if (audioBtn) audioBtn.addEventListener('click', toggleAudio);

    // Archivos
    var fileInput = document.getElementById('file-input');
    if (fileInput) fileInput.addEventListener('change', handleFile);

    // Modelo
    var modelSel = document.getElementById('model-selector');
    if (modelSel) modelSel.addEventListener('change', function() {
        selectedModel = this.value;
        try { localStorage.setItem('cybergen_model', selectedModel); } catch(e) {}
        updateModelDisplay();
    });

    // Botones rápidos
    document.querySelectorAll('.quick-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var p = this.getAttribute('data-prompt');
            if (p && userInput) { userInput.value = p; userInput.focus(); handleSend(); }
        });
    });

    console.log('✅ Eventos vinculados');
}

// ====================== ARCHIVOS ======================
function handleFile(e) {
    var file = e.target.files[0];
    if (!file) return;
    var ui = document.getElementById('user-input');
    if (ui) ui.placeholder = '📎 ' + file.name;
    processFile(file);
}

function processFile(file) {
    var ext = file.name.split('.').pop().toLowerCase();
    var ui = document.getElementById('user-input');
    if (['xlsx','xls','csv'].indexOf(ext) >= 0) {
        var reader = new FileReader();
        reader.onload = function(e) {
            try {
                var wb = XLSX.read(new Uint8Array(e.target.result), {type:'array'});
                var t = '';
                wb.SheetNames.forEach(function(n) { t += '📋 '+n+'\n'+XLSX.utils.sheet_to_csv(wb.Sheets[n])+'\n\n'; });
                if (ui) ui.dataset.fileData = t;
            } catch(err) { if (ui) ui.dataset.fileData = '[Error]'; }
        };
        reader.readAsArrayBuffer(file);
    } else if (ext === 'txt') {
        var reader = new FileReader();
        reader.onload = function(e) { if (ui) ui.dataset.fileData = e.target.result; };
        reader.readAsText(file);
    } else {
        if (ui) ui.dataset.fileData = '[Archivo: '+file.name+']';
    }
}

// ====================== ENVIAR MENSAJE ======================
function handleSend() {
    var ui = document.getElementById('user-input');
    var chat = document.getElementById('chat-container');
    if (!ui || !chat) return;
    
    var prompt = ui.value.trim();
    if (!prompt) return;
    
    var fd = ui.dataset.fileData || '';
    delete ui.dataset.fileData;
    ui.value = '';
    ui.style.height = 'auto';
    ui.placeholder = 'Escribe...';
    var fi = document.getElementById('file-input');
    if (fi) fi.value = '';
    
    var full = fd ? '📎 Datos:\n'+fd+'\n\n❓ '+prompt : prompt;
    
    var ws = chat.querySelector('.welcome-screen');
    if (ws) ws.remove();
    
    addMsg('user', esc(prompt));
    chatHistory.push({role:'user', parts:[{text:full}]});
    
    var think = addMsg('ai', '<div class="typing-indicator"><span></span><span></span><span></span></div>');
    
    if (!IS_DEMO && API_KEY) {
        callAI(full, think);
    } else {
        setTimeout(function() {
            think.remove();
            var r = getDemo(prompt);
            chatHistory.push({role:'model', parts:[{text:r}]});
            var p = processResp(r);
            addMsg('ai', p.html);
            if (p.charts.length) { renderChart(p.charts[0]); document.getElementById('chart-panel').classList.remove('hidden'); }
        }, 500);
    }
}

function getDemo(p) {
    return '## 🤖 Modo Demo\n\n📊 Recibido: *'+p.substring(0,80)+'...*\n\n✅ Interfaz funcional.\n\n🔑 Escribe en consola: `configurarAPI("tu-clave")`';
}

function callAI(prompt, think) {
    fetch('https://generativelanguage.googleapis.com/v1beta/models/'+selectedModel+':generateContent?key='+API_KEY, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
            contents:[{role:'user',parts:[{text:prompt}]}],
            systemInstruction:{parts:[{text:SYSTEM_PROMPT}]}
        })
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
        think.remove();
        var t = d.candidates[0].content.parts[0].text;
        chatHistory.push({role:'model', parts:[{text:t}]});
        var p = processResp(t);
        addMsg('ai', p.html);
        if (p.charts.length) { renderChart(p.charts[0]); document.getElementById('chart-panel').classList.remove('hidden'); }
        if (isAudioEnabled) speak(t);
    })
    .catch(function(e) { think.innerHTML = '<span style="color:#f06;">❌ Error: '+e.message+'</span>'; });
}

// ====================== PROCESAR RESPUESTA ======================
function processResp(text) {
    var html = text, charts = [], regex = /\[CHART_DATA:({.*?})\]/gs, m;
    while ((m = regex.exec(text)) !== null) {
        try { charts.push(JSON.parse(m[1])); html = html.replace(m[0], '📊 Gráfico generado'); } catch(e) {}
    }
    try { html = marked.parse(html); } catch(e) {}
    return {html:html, charts:charts};
}

function renderChart(cfg) {
    var canvas = document.getElementById('myChart');
    if (!canvas) return;
    if (currentChart) { currentChart.destroy(); currentChart = null; }
    try {
        currentChart = new Chart(canvas, {
            type: cfg.type || 'bar',
            data: cfg.data,
            options: Object.assign({responsive:true, maintainAspectRatio:false}, cfg.options||{})
        });
    } catch(e) {}
}

function hideChartPanel() {
    var p = document.getElementById('chart-panel');
    if (p) p.classList.add('hidden');
    if (currentChart) { currentChart.destroy(); currentChart = null; }
}

// ====================== VOZ ======================
function speak(text) {
    if (!isAudioEnabled || !text) return;
    try {
        speechSynthesis.cancel();
        var c = text.replace(/\[CHART_DATA:.*?\]/gs,'').replace(/```[\s\S]*?```/g,'').replace(/[#*`_~]/g,'').replace(/\s+/g,' ').trim();
        if (c) { var u = new SpeechSynthesisUtterance(c); u.lang='es-ES'; u.rate=1.05; speechSynthesis.speak(u); }
    } catch(e) {}
}

function toggleAudio() {
    isAudioEnabled = !isAudioEnabled;
    try { localStorage.setItem('cybergen_audio', isAudioEnabled); } catch(e) {}
    updateAudioButton();
    if (!isAudioEnabled) try { speechSynthesis.cancel(); } catch(e) {}
}

function updateAudioButton() {
    var btn = document.getElementById('toggle-audio-btn');
    if (!btn) return;
    btn.innerHTML = isAudioEnabled ? '<i class="fas fa-volume-up"></i> <span>Voz Activada</span>' : '<i class="fas fa-volume-mute"></i> <span>Voz Silenciada</span>';
}

function startVoice() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('No soportado'); return; }
    try {
        var rec = new SR(); rec.lang='es-ES'; rec.interimResults=false;
        var vb = document.getElementById('voice-btn'), ui = document.getElementById('user-input');
        if (vb) vb.style.color = '#f06';
        if (ui) ui.placeholder = '🎤 Escuchando...';
        rec.start();
        rec.onresult = function(e) { if (ui) ui.value = e.results[0][0].transcript; if (vb) vb.style.color=''; handleSend(); };
        rec.onerror = rec.onend = function() { if (vb) vb.style.color=''; if (ui) ui.placeholder='Escribe...'; };
    } catch(e) {}
}

// ====================== UI ======================
function addMsg(role, content) {
    var chat = document.getElementById('chat-container');
    if (!chat) return document.createElement('div');
    var div = document.createElement('div');
    div.className = 'message ' + role + '-message';
    div.innerHTML = content;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
    return div;
}

function clearChat() {
    var chat = document.getElementById('chat-container');
    if (!chat) return;
    chat.innerHTML = '<div class="welcome-screen"><div class="welcome-icon">🧠</div><h2>CyberGen AI</h2><p>Chat limpiado</p><div class="quick-actions">' +
        '<button class="quick-btn" data-prompt="Gráfico de barras: Enero 150, Febrero 230"><i class="fas fa-chart-bar"></i> Gráfico</button>' +
        '<button class="quick-btn" data-prompt="Explícame qué es una API REST"><i class="fas fa-code"></i> API REST</button>' +
        '<button class="quick-btn" data-prompt="Analiza: Q1=15000, Q2=23000"><i class="fas fa-chart-line"></i> Analizar</button>' +
        '<button class="quick-btn" data-prompt="Función JS para ordenar array"><i class="fas fa-terminal"></i> Código</button>' +
        '</div></div>';
    chatHistory = [];
    hideChartPanel();
    document.querySelectorAll('.quick-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var p = this.getAttribute('data-prompt');
            var ui = document.getElementById('user-input');
            if (p && ui) { ui.value = p; ui.focus(); handleSend(); }
        });
    });
    var ui = document.getElementById('user-input');
    if (ui) ui.focus();
}

function initModelSelector() {
    var sel = document.getElementById('model-selector');
    if (!sel) return;
    sel.innerHTML = MODELS.map(function(m) { return '<option value="'+m+'"'+(m===selectedModel?' selected':'')+'>'+m+'</option>'; }).join('');
}

function updateModelDisplay() {
    var span = document.getElementById('current-model-name');
    if (span) span.textContent = IS_DEMO ? 'MODO DEMO' : selectedModel;
}

function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function exportConversation() {
    if (!chatHistory.length) { alert('Sin conversación'); return; }
    var md = '# CyberGen AI\n\n';
    chatHistory.forEach(function(m) {
        md += m.role==='user' ? '## 👤 Usuario\n'+m.parts[0].text+'\n\n' : '## 🤖 CyberGen\n'+m.parts[0].text+'\n\n---\n\n';
    });
    var b = new Blob([md], {type:'text/markdown'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = 'cybergen-'+Date.now()+'.md';
    a.click();
}

console.log('✅ CyberGen AI listo');