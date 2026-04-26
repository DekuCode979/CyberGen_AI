// ====================== CYBERGEN AI V1.2  ======================
// Compatible con Vercel (import.meta.env) y GitHub Pages (config.js + localStorage)
console.log('🚀 CyberGen AI V1.2 iniciando...');

// ====================== CONFIGURACIÓN ======================
const MODELS_LIST = [
    "gemini-2.5-flash", 
    "gemini-2.5-flash-lite", 
    "gemini-2.5-pro", 
    "gemini-1.5-flash", 
    "gemini-1.5-pro"
];

const SYSTEM_PROMPT = `Eres CyberGen AI V1.2, un analista de datos senior y arquitecto visual.
Usa SIEMPRE:
- ## para títulos principales
- ### para subtítulos
- **negritas** para conceptos clave
- \`código\` para números, porcentajes y valores monetarios
- Para gráficos: [CHART_DATA:{"type":"bar","data":{"labels":["A","B"],"datasets":[{"label":"Datos","data":[10,20]}]}}]
Responde en español, con tono profesional y directo.`;

// ====================== DETECCIÓN INTELIGENTE DE API KEY ======================
let API_KEY = "";

function detectAPIKey() {
    // 1. Intentar Vercel (import.meta.env)
    try {
        if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) {
            API_KEY = import.meta.env.VITE_GEMINI_API_KEY.trim();
            console.log('🔑 API Key detectada: Vercel (import.meta.env)');
            return true;
        }
    } catch(e) {}

    // 2. Intentar config.js local
    try {
        if (window.CYBERGEN_CONFIG?.GEMINI_API_KEY) {
            API_KEY = window.CYBERGEN_CONFIG.GEMINI_API_KEY.trim();
            console.log('🔑 API Key detectada: config.js local');
            return true;
        }
    } catch(e) {}

    // 3. Intentar localStorage
    try {
        const stored = localStorage.getItem("GEMINI_PRO_KEY");
        if (stored) {
            API_KEY = stored.trim();
            console.log('🔑 API Key detectada: localStorage');
            return true;
        }
    } catch(e) {}

    console.warn('⚠️ No se encontró API Key');
    return false;
}

// ====================== ESTADO GLOBAL ======================
let globalHistory = [];
try { 
    globalHistory = JSON.parse(localStorage.getItem('cyberpunk_history_v1.2')) || []; 
} catch(e) { 
    globalHistory = []; 
    localStorage.setItem('cyberpunk_history_v1.2', '[]');
}

let currentSessionStartIndex = globalHistory.length;
let uploadedFilesData = [];
let selectedModel = localStorage.getItem("selectedGeminiModel") || MODELS_LIST[0];
let isAudioEnabled = localStorage.getItem("cyberpunk_audio") !== "false";
let globalUtterance = null;
let isProcessing = false;

// ====================== REFERENCIAS AL DOM ======================
function $(id) { return document.getElementById(id); }

const chatBox = $('chat-box');
const userInput = $('user-input');
const sendBtn = $('send-btn');
const sidebar = $('sidebar');
const sidebarOverlay = $('sidebar-overlay');
const toggleSidebarBtn = $('toggle-sidebar');
const closeSidebarBtn = $('close-sidebar');
const modelStatus = $('model-status');
const statusDot = $('status-dot');
const modelSelect = $('model-select');
const historyList = $('history-list');
const sttBtn = $('stt-btn');
const fileUpload = $('file-upload');
const toggleAudioBtn = $('toggle-audio-global');
const audioStatusText = $('audio-status-text');
const newChatBtn = $('new-chat-btn');
const btnDownloadSession = $('btn-download-session');
const clearChatBtn = $('clear-chat');
const btnClearMemory = $('btn-clear-memory');
const welcomeScreen = $('welcome-screen');

// ====================== INICIALIZACIÓN ======================
function initApp() {
    console.log('🔧 Inicializando CyberGen AI V1.2...');
    
    const hasKey = detectAPIKey();
    updateStatusDot(hasKey);
    
    if (!hasKey) {
        addMessageToChat('ai', `
            <strong>⚠️ API Key no detectada</strong><br><br>
            <strong>Para usar en local:</strong><br>
            1. Crea archivo <code>config.js</code> con:<br>
            <pre><code>window.CYBERGEN_CONFIG = { GEMINI_API_KEY: "TU_CLAVE" };</code></pre><br>
            <strong>Para usar en Vercel:</strong><br>
            Configura variable de entorno <code>VITE_GEMINI_API_KEY</code>
        `);
    } else {
        // Caché en localStorage para persistencia
        try { localStorage.setItem("GEMINI_PRO_KEY", API_KEY); } catch(e) {}
    }
    
    modelSelect.value = selectedModel;
    renderHistorySidebar();
    updateModelStatus();
    updateAudioBtnStyle();
    bindEvents();
    autoResizeTextarea();
    enableDragAndDrop();
    
    console.log('✅ CyberGen AI V1.2 listo');
}

function bindEvents() {
    sendBtn.addEventListener('click', () => handleUserPrompt());
    
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleUserPrompt();
        }
    });

    toggleSidebarBtn.addEventListener('click', toggleSidebar);
    closeSidebarBtn.addEventListener('click', closeSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);
    clearChatBtn.addEventListener('click', clearChatView);
    newChatBtn.addEventListener('click', startNewSession);
    toggleAudioBtn.addEventListener('click', toggleAudio);
    btnDownloadSession.addEventListener('click', downloadSession);
    
    if (btnClearMemory) {
        btnClearMemory.addEventListener('click', clearAllMemory);
    }
    
    modelSelect.addEventListener('change', (e) => {
        selectedModel = e.target.value;
        localStorage.setItem("selectedGeminiModel", selectedModel);
        updateModelStatus();
        addMessageToChat('ai', formatMessage(`🤖 Modelo cambiado a **${selectedModel}**`));
    });
    
    fileUpload.addEventListener('change', handleFileUpload);
    sttBtn.addEventListener('click', toggleSpeechToText);
    
    // Quick actions
    document.querySelectorAll('.quick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const prompt = btn.getAttribute('data-prompt');
            if (prompt) {
                userInput.value = prompt;
                userInput.focus();
                userInput.dispatchEvent(new Event('input'));
            }
        });
    });
    
    // Cerrar sidebar con tecla Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeSidebar();
    });
}

function updateStatusDot(active) {
    if (statusDot) {
        statusDot.style.background = active ? 'var(--neon-green)' : 'var(--neon-pink)';
        statusDot.style.boxShadow = active 
            ? '0 0 15px var(--neon-green)' 
            : '0 0 15px var(--neon-pink)';
    }
}

// ====================== SIDEBAR ======================
function toggleSidebar() {
    sidebar.classList.toggle('closed');
    sidebarOverlay.classList.toggle('active', !sidebar.classList.contains('closed'));
}

function closeSidebar() {
    sidebar.classList.add('closed');
    sidebarOverlay.classList.remove('active');
}

// ====================== TEXTAREA AUTO-RESIZE ======================
function autoResizeTextarea() {
    userInput.addEventListener('input', function() {
        this.style.height = 'auto';
        const newHeight = Math.min(this.scrollHeight, 150);
        this.style.height = newHeight + 'px';
        this.style.overflowY = this.scrollHeight > 150 ? 'auto' : 'hidden';
    });
}

// ====================== MENSAJERÍA ======================
function addMessageToChat(role, text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;
    messageDiv.innerHTML = text;
    chatBox.appendChild(messageDiv);
    scrollToBottom();
    return messageDiv;
}

function scrollToBottom() {
    setTimeout(() => {
        chatBox.scrollTop = chatBox.scrollHeight;
    }, 50);
}

function showTypingIndicator() {
    removeTypingIndicator();
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message ai-message typing-indicator';
    typingDiv.innerHTML = '<span></span><span></span><span></span>';
    typingDiv.id = 'typing-indicator';
    chatBox.appendChild(typingDiv);
    scrollToBottom();
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
}

function formatMessage(rawText) {
    if (!rawText) return '';
    
    // Proteger bloques de código antes de marked
    const codeBlocks = [];
    let formatted = rawText.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        const index = codeBlocks.length;
        codeBlocks.push({ lang: lang || 'javascript', code: escapeHtml(code.trim()) });
        return `%%CODEBLOCK_${index}%%`;
    });
    
    // Convertir Markdown
    try {
        formatted = marked.parse(formatted);
    } catch(e) {
        formatted = rawText;
    }
    
    // Restaurar bloques de código
    codeBlocks.forEach((block, index) => {
        formatted = formatted.replace(
            `%%CODEBLOCK_${index}%%`, 
            `<pre><code class="language-${block.lang}">${block.code}</code></pre>`
        );
    });
    
    return formatted;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function clearChatView() {
    chatBox.innerHTML = '';
    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'welcome-screen';
    welcomeDiv.id = 'welcome-screen';
    welcomeDiv.innerHTML = `
        <div class="welcome-icon">
            <i class="fas fa-brain" style="color: var(--neon-cyan); text-shadow: var(--glow-cyan);"></i>
        </div>
        <h2>Terminal Limpia</h2>
        <p>Contexto de conversación activo. Escribe tu consulta.</p>
        <div class="quick-actions">
            <button class="quick-btn" data-prompt="Analiza el siguiente conjunto de datos:"><i class="fas fa-chart-bar"></i> Analizar Datos</button>
            <button class="quick-btn" data-prompt="Genera un gráfico de ejemplo con CHART_DATA:"><i class="fas fa-chart-pie"></i> Crear Gráfico</button>
            <button class="quick-btn" data-prompt="Explícame cómo funciona una API REST:"><i class="fas fa-code"></i> Explicar API</button>
            <button class="quick-btn" data-prompt="Resume el siguiente texto:"><i class="fas fa-file-alt"></i> Resumir Texto</button>
        </div>`;
    chatBox.appendChild(welcomeDiv);
    
    // Re-vincular quick actions
    document.querySelectorAll('.quick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const prompt = btn.getAttribute('data-prompt');
            if (prompt) {
                userInput.value = prompt;
                userInput.focus();
                userInput.dispatchEvent(new Event('input'));
            }
        });
    });
}

function downloadSession() {
    const sessionText = globalHistory.slice(currentSessionStartIndex)
        .map(h => `${h.role === 'user' ? '👤 USUARIO' : '🤖 CYBERGEN'}:\n${h.text}`)
        .join('\n\n' + '='.repeat(50) + '\n\n');
    
    const blob = new Blob([sessionText], {type: 'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cybergen-sesion-${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    addMessageToChat('ai', formatMessage('✅ **Sesión exportada correctamente.**'));
}

function clearAllMemory() {
    if (confirm('⚠️ ¿Borrar TODA la memoria? Esta acción no se puede deshacer.')) {
        globalHistory = [];
        currentSessionStartIndex = 0;
        localStorage.removeItem('cyberpunk_history_v1.2');
        clearChatView();
        renderHistorySidebar();
        addMessageToChat('ai', formatMessage('🗑️ **Memoria completamente borrada.**'));
    }
}

// ====================== GRÁFICOS DINÁMICOS ======================
function procesarEstructuraVisual(text, parentElement) {
    let processedText = text;
    const regex = /\[CHART_DATA:\s*(\{[\s\S]*?\})\s*\]/g;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
        try {
            let jsonStr = match[1]
                .replace(/,(\s*[}\]])/g, '$1')
                .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2":');
            
            const config = JSON.parse(jsonStr);
            const chartId = `chart-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
            
            const wrapper = document.createElement('div');
            wrapper.className = 'chart-panel';
            wrapper.innerHTML = `
                <div class="chart-header">
                    <h3><i class="fas fa-chart-line"></i> Visualización</h3>
                    <button class="chart-close-btn"><i class="fas fa-times"></i></button>
                </div>
                <canvas id="${chartId}"></canvas>`;
            
            parentElement.appendChild(wrapper);
            scrollToBottom();
            
            wrapper.querySelector('.chart-close-btn').addEventListener('click', () => {
                wrapper.style.animation = 'slideDown 0.3s ease';
                setTimeout(() => wrapper.remove(), 300);
            });
            
            setTimeout(() => {
                const ctx = document.getElementById(chartId)?.getContext('2d');
                if (ctx && window.Chart) {
                    // Aplicar tema cyberpunk por defecto
                    config.options = config.options || {};
                    config.options.plugins = config.options.plugins || {};
                    config.options.plugins.legend = config.options.plugins.legend || {};
                    config.options.plugins.legend.labels = config.options.plugins.legend.labels || {};
                    config.options.plugins.legend.labels.color = '#e0e0ff';
                    
                    if (config.data && config.data.datasets) {
                        config.data.datasets.forEach(ds => {
                            ds.borderColor = ds.borderColor || '#00f0ff';
                            ds.backgroundColor = ds.backgroundColor || 'rgba(0, 240, 255, 0.2)';
                        });
                    }
                    
                    new Chart(ctx, config);
                }
            }, 200);
            
            processedText = processedText.replace(match[0], '');
            
        } catch (e) {
            console.error('Error en gráfico:', e);
            processedText = processedText.replace(match[0], 
                '<p style="color: var(--neon-pink);"><i class="fas fa-exclamation-triangle"></i> [Error en datos del gráfico]</p>');
        }
    }
    return processedText;
}

// ====================== API DE GEMINI ======================
async function callGeminiAPI(promptText, files = []) {
    if (!API_KEY) {
        throw new Error("API Key no configurada. Usa config.js en local o VITE_GEMINI_API_KEY en Vercel.");
    }

    for (let i = 0; i < MODELS_LIST.length; i++) {
        const model = MODELS_LIST[i];
        updateModelStatus(`🔄 ${model}`);
        updateStatusDot(true);
        
        try {
            const contextMessages = globalHistory.slice(currentSessionStartIndex)
                .map(h => ({ role: h.role, parts: [{ text: h.text }] }))
                .slice(-10);

            let userParts = [{ text: promptText }];
            
            if (files.length > 0 && i === 0) {
                files.forEach(file => {
                    userParts.push({
                        inlineData: {
                            mimeType: file.mimeType,
                            data: file.data
                        }
                    });
                });
            }
            
            contextMessages.push({ role: "user", parts: userParts });

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: contextMessages,
                        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
                        generationConfig: { 
                            temperature: 0.7, 
                            maxOutputTokens: 8192,
                            topP: 0.95,
                            topK: 40
                        }
                    })
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const status = response.status;
                
                if (status === 429) {
                    console.warn(`⏳ Rate limit en ${model}, esperando...`);
                    await new Promise(r => setTimeout(r, 2000));
                    continue;
                }
                
                if (status === 400 || status === 404 || status === 503) {
                    console.warn(`⚠️ ${model} no disponible, intentando siguiente...`);
                    continue;
                }
                
                throw new Error(`HTTP ${status}: ${errorData.error?.message || 'Error desconocido'}`);
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (!text) throw new Error("Respuesta vacía del modelo");
            
            updateModelStatus(model);
            updateStatusDot(true);
            
            return text;

        } catch (error) {
            console.error(`❌ Fallo en ${model}:`, error.message);
            
            if (i >= MODELS_LIST.length - 1) {
                updateModelStatus('⚠️ Sin conexión');
                updateStatusDot(false);
                throw new Error(`Todos los modelos fallaron. ${error.message}`);
            }
        }
    }
}

function updateModelStatus(text) {
    if (modelStatus) modelStatus.textContent = text;
}

// ====================== FLUJO PRINCIPAL ======================
async function handleUserPrompt() {
    if (isProcessing) {
        addMessageToChat('ai', formatMessage('⏳ **Espera...** Aún estoy procesando tu solicitud anterior.'));
        return;
    }
    
    const userText = userInput.value.trim();
    
    if (!userText && uploadedFilesData.length === 0) return;

    isProcessing = true;
    sendBtn.disabled = true;
    sendBtn.style.opacity = '0.5';

    userInput.value = '';
    userInput.style.height = 'auto';
    
    // Ocultar welcome screen
    const welcome = document.getElementById('welcome-screen');
    if (welcome) welcome.style.display = 'none';

    // Mostrar mensaje del usuario
    const displayText = userText || '📎 Analizando archivo adjunto...';
    addMessageToChat('user', formatMessage(displayText));
    
    globalHistory.push({ role: "user", text: userText });
    saveHistory();

    showTypingIndicator();

    try {
        const filesPayload = uploadedFilesData.map(f => ({ 
            mimeType: f.type, 
            data: f.base64 
        }));
        uploadedFilesData = [];
        
        const aiResponseText = await callGeminiAPI(userText, filesPayload);
        
        removeTypingIndicator();

        const aiMessageDiv = addMessageToChat('ai', '');
        let cleanText = procesarEstructuraVisual(aiResponseText, aiMessageDiv);
        aiMessageDiv.innerHTML = formatMessage(cleanText);
        
        // Resaltar código
        aiMessageDiv.querySelectorAll('pre code').forEach(block => {
            if (window.Prism) Prism.highlightElement(block);
        });
        
        globalHistory.push({ role: "model", text: aiResponseText });
        saveHistory();
        renderHistorySidebar();
        
        speak(aiResponseText);

    } catch (error) {
        removeTypingIndicator();
        const errorMsg = error.message.includes('API Key') 
            ? `🔐 **Error de autenticación**<br><br>${error.message}`
            : `❌ **Error:** ${error.message}`;
        addMessageToChat('ai', formatMessage(errorMsg));
        updateStatusDot(false);
    } finally {
        isProcessing = false;
        sendBtn.disabled = false;
        sendBtn.style.opacity = '1';
        userInput.focus();
    }
}

function saveHistory() {
    try {
        localStorage.setItem('cyberpunk_history_v1.2', JSON.stringify(globalHistory));
    } catch(e) {
        console.warn('⚠️ No se pudo guardar historial (storage lleno)');
    }
}

// ====================== MANEJO DE ARCHIVOS ======================
function handleFileUpload(event) {
    const files = event.target.files;
    if (!files.length) return;
    
    uploadedFilesData = [];
    let processedCount = 0;
    const totalFiles = files.length;
    const MAX_SIZE = 200 * 1024 * 1024; // 200MB

    Array.from(files).forEach(file => {
        if (file.size > MAX_SIZE) {
            addMessageToChat('ai', formatMessage(`⚠️ **${file.name}** excede 200MB. Se omitió.`));
            processedCount++;
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            let base64Data = e.target.result.split(',')[1];
            uploadedFilesData.push({
                name: file.name,
                type: file.type,
                base64: base64Data
            });
            processedCount++;
            
            if (processedCount === totalFiles) {
                const successCount = uploadedFilesData.length;
                if (successCount > 0) {
                    const fileNames = uploadedFilesData.map(f => f.name).join(', ');
                    addMessageToChat('ai', formatMessage(
                        `✅ **${successCount} archivo(s) procesado(s)**\n\n` +
                        `📄 ${fileNames}\n\n` +
                        `Pregúntame sobre los datos o solicita un gráfico.`
                    ));
                }
            }
        };
        
        reader.onerror = function() {
            processedCount++;
            addMessageToChat('ai', formatMessage(`❌ Error al leer **${file.name}**`));
        };
        
        reader.readAsDataURL(file);
    });
    
    event.target.value = '';
}

function enableDragAndDrop() {
    const dropZone = document.body;
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const dt = new DataTransfer();
            Array.from(files).forEach(f => dt.items.add(f));
            fileUpload.files = dt.files;
            handleFileUpload({ target: { files: dt.files } });
        }
    });
}


// ====================== SISTEMA DE VOZ  ======================
function speak(text) {
    if (!isAudioEnabled || !text) return;
    
    // Cancelar cualquier voz anterior
    window.speechSynthesis.cancel();

    // Limpiar texto de markdown, código y caracteres especiales
    let clean = text
        .replace(/\[CHART_DATA[\s\S]*?\]/g, ' Gráfico generado.')
        .replace(/```[\s\S]*?```/g, ' Código omitido.')
        .replace(/<[^>]*>/g, '')           // Quitar HTML
        .replace(/[#*`_~\-\[\]]/g, ' ')    // Quitar markdown
        .replace(/\*\*/g, ' ')             // Quitar bold
        .replace(/__/g, ' ')               // Quitar italic
        .replace(/~~/g, ' ')               // Quitar tachado
        .replace(/([.?!:;])\s*/g, '$1|')   // Separar por puntuación
        .replace(/\n+/g, '. ')             // Saltos de línea a punto
        .replace(/\s+/g, ' ')              // Espacios múltiples a uno
        .trim();

    if (!clean || clean.length < 2) return;

    // Dividir en fragmentos manejables (máximo 200 caracteres cada uno)
    const rawChunks = clean.split('|').filter(c => c.trim().length > 0);
    const chunks = [];
    
    rawChunks.forEach(chunk => {
        chunk = chunk.trim();
        if (chunk.length <= 200) {
            chunks.push(chunk);
        } else {
            // Dividir chunks largos en partes más pequeñas
            const words = chunk.split(' ');
            let temp = '';
            words.forEach(word => {
                if ((temp + ' ' + word).length > 200) {
                    chunks.push(temp.trim());
                    temp = word;
                } else {
                    temp += ' ' + word;
                }
            });
            if (temp.trim()) chunks.push(temp.trim());
        }
    });

    if (chunks.length === 0) return;

    let chunkIndex = 0;
    let retryCount = 0;
    const MAX_RETRIES = 3;

    function playNext() {
        if (chunkIndex >= chunks.length) {
            globalUtterance = null;
            return;
        }

        // Seguridad: cancelar si hay utterance anterior
        if (globalUtterance) {
            globalUtterance.onend = null;
            globalUtterance.onerror = null;
        }

        const textToSpeak = chunks[chunkIndex].trim();
        if (!textToSpeak) {
            chunkIndex++;
            playNext();
            return;
        }

        globalUtterance = new SpeechSynthesisUtterance(textToSpeak);
        globalUtterance.lang = 'es-ES';
        globalUtterance.rate = 1.0;       // Velocidad normal (ni lento ni rápido)
        globalUtterance.pitch = 1.0;      // Tono normal
        globalUtterance.volume = 1.0;     // Volumen completo
        
        // Seguridad: evento de finalización
        globalUtterance.onend = () => {
            retryCount = 0;
            chunkIndex++;
            playNext();
        };
        
        // Seguridad: evento de error con recuperación
        globalUtterance.onerror = (event) => {
            console.warn('Error TTS:', event.error);
            
            // Si el error es "interrupted", reintentar
            if (event.error === 'interrupted' && retryCount < MAX_RETRIES) {
                retryCount++;
                console.log(`Reintentando chunk ${chunkIndex} (${retryCount}/${MAX_RETRIES})...`);
                setTimeout(() => {
                    window.speechSynthesis.cancel();
                    window.speechSynthesis.speak(globalUtterance);
                }, 300);
                return;
            }
            
            // Si no se puede recuperar, pasar al siguiente
            retryCount = 0;
            chunkIndex++;
            setTimeout(playNext, 200);
        };

        // Seguridad: pausar y reanudar para evitar bugs de Chrome
        window.speechSynthesis.cancel();
        
        // Timeout de seguridad: si no responde en 30s, saltar
        const safetyTimeout = setTimeout(() => {
            if (window.speechSynthesis.speaking) {
                window.speechSynthesis.cancel();
                chunkIndex++;
                playNext();
            }
        }, 30000);

        // Limpiar timeout cuando termine
        const originalOnEnd = globalUtterance.onend;
        globalUtterance.onend = (e) => {
            clearTimeout(safetyTimeout);
            if (originalOnEnd) originalOnEnd(e);
        };

        window.speechSynthesis.speak(globalUtterance);
    }
    
    // Pequeño delay inicial para estabilidad
    setTimeout(playNext, 100);
}

function toggleAudio() {
    isAudioEnabled = !isAudioEnabled;
    localStorage.setItem("cyberpunk_audio", isAudioEnabled);
    updateAudioBtnStyle();
    
    if (!isAudioEnabled) {
        window.speechSynthesis.cancel();
        globalUtterance = null;
        addMessageToChat('ai', formatMessage('🔇 **Voz desactivada**'));
    } else {
        addMessageToChat('ai', formatMessage('🔊 **Voz activada**'));
    }
}

function updateAudioBtnStyle() {
    if (!toggleAudioBtn) return;
    const icon = toggleAudioBtn.querySelector('i');
    if (isAudioEnabled) {
        icon.className = 'fas fa-volume-up';
        audioStatusText.textContent = 'ON';
        toggleAudioBtn.style.borderColor = 'var(--neon-cyan)';
        toggleAudioBtn.style.boxShadow = 'var(--glow-cyan)';
    } else {
        icon.className = 'fas fa-volume-mute';
        audioStatusText.textContent = 'OFF';
        toggleAudioBtn.style.borderColor = 'var(--border-subtle)';
        toggleAudioBtn.style.boxShadow = 'none';
    }
}

// Función para detener la voz manualmente (útil si se traba)
function stopSpeaking() {
    window.speechSynthesis.cancel();
    globalUtterance = null;
    console.log('🔇 Voz detenida manualmente');
}

// ====================== FUNCIONES AUXILIARES ======================
function renderHistorySidebar() {
    if (!historyList) return;
    historyList.innerHTML = '';
    
    const userMessages = globalHistory.filter(msg => msg.role === 'user');
    
    if (userMessages.length === 0) {
        historyList.innerHTML = `
            <div style="text-align: center; padding: 20px 10px;">
                <i class="fas fa-inbox" style="font-size: 2rem; color: var(--text-dim); margin-bottom: 10px; display: block;"></i>
                <p style="color: var(--text-dim); font-size: 0.8rem;">Sin historial aún</p>
                <p style="color: var(--text-dim); font-size: 0.7rem;">Tus conversaciones aparecerán aquí</p>
            </div>`;
        return;
    }
    
    // Agrupar mensajes por sesión
    const sessions = [];
    let currentSession = [];
    
    userMessages.forEach((msg, index) => {
        currentSession.push(msg);
        // Nueva sesión cada 10 mensajes o si hay un gap grande
        if (currentSession.length >= 10 || index === userMessages.length - 1) {
            sessions.push([...currentSession]);
            currentSession = [];
        }
    });
    
    // Mostrar sesiones (máximo 5 sesiones)
    sessions.slice(-5).reverse().forEach((session, sessionIndex) => {
        // Encabezado de sesión
        const sessionHeader = document.createElement('div');
        sessionHeader.style.cssText = `
            color: var(--neon-cyan);
            font-size: 0.65rem;
            text-transform: uppercase;
            letter-spacing: 2px;
            padding: 10px 10px 5px;
            font-family: 'Orbitron', sans-serif;
            display: flex;
            align-items: center;
            gap: 6px;
        `;
        sessionHeader.innerHTML = `<i class="fas fa-circle" style="font-size: 0.4rem;"></i> Sesión ${sessions.length - sessionIndex}`;
        historyList.appendChild(sessionHeader);
        
        // Mensajes de la sesión
        session.slice(-5).reverse().forEach((msg) => {
            const div = document.createElement('div');
            div.className = 'history-item';
            
            // Icono según contenido
            let icon = 'fa-comment';
            if (msg.text.toLowerCase().includes('gráfico') || msg.text.toLowerCase().includes('grafico')) {
                icon = 'fa-chart-bar';
            } else if (msg.text.toLowerCase().includes('código') || msg.text.toLowerCase().includes('codigo')) {
                icon = 'fa-code';
            } else if (msg.text.toLowerCase().includes('archivo') || msg.text.toLowerCase().includes('excel')) {
                icon = 'fa-file-alt';
            }
            
            // Truncar texto con puntos suspensivos
            const truncated = msg.text.length > 35 
                ? msg.text.substring(0, 35).trim() + '...' 
                : msg.text;
            
            div.innerHTML = `<i class="fas ${icon}" style="margin-right: 6px; font-size: 0.7rem; color: var(--text-dim);"></i>${escapeHtml(truncated)}`;
            div.title = msg.text;
            
            // Click: cargar mensaje en input
            div.addEventListener('click', () => {
                userInput.value = msg.text;
                userInput.focus();
                userInput.dispatchEvent(new Event('input'));
                closeSidebar();
            });
            
            // Doble click: enviar directamente
            div.addEventListener('dblclick', () => {
                userInput.value = msg.text;
                closeSidebar();
                handleUserPrompt();
            });
            
            // Botón eliminar (hover)
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
            deleteBtn.style.cssText = `
                display: none;
                position: absolute;
                right: 8px;
                top: 50%;
                transform: translateY(-50%);
                background: none;
                border: none;
                color: var(--neon-pink);
                cursor: pointer;
                font-size: 0.7rem;
                padding: 2px 5px;
            `;
            deleteBtn.title = 'Eliminar del historial';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = globalHistory.findIndex(h => h.role === 'user' && h.text === msg.text);
                if (index !== -1) {
                    globalHistory.splice(index, 1);
                    saveHistory();
                    renderHistorySidebar();
                }
            });
            
            div.style.position = 'relative';
            div.appendChild(deleteBtn);
            
            div.addEventListener('mouseenter', () => { deleteBtn.style.display = 'block'; });
            div.addEventListener('mouseleave', () => { deleteBtn.style.display = 'none'; });
            
            historyList.appendChild(div);
        });
        
        // Separador entre sesiones
        if (sessionIndex < sessions.slice(-5).length - 1) {
            const divider = document.createElement('div');
            divider.style.cssText = `
                height: 1px;
                background: linear-gradient(90deg, transparent, rgba(0,240,255,0.2), transparent);
                margin: 5px 0;
            `;
            historyList.appendChild(divider);
        }
    });
    
    // Footer con total de mensajes
    const footer = document.createElement('div');
    footer.style.cssText = `
        text-align: center;
        padding: 10px;
        color: var(--text-dim);
        font-size: 0.65rem;
        border-top: 1px solid rgba(0,240,255,0.1);
        margin-top: 10px;
    `;
    footer.textContent = `${userMessages.length} mensajes en historial`;
    historyList.appendChild(footer);
}

// ====================== NUEVA SESIÓN MEJORADA ======================
function startNewSession() {
    // Guardar sesión actual antes de crear nueva
    if (globalHistory.length > currentSessionStartIndex) {
        const sessionMessages = globalHistory.slice(currentSessionStartIndex);
        const lastUserMsg = sessionMessages.filter(m => m.role === 'user').pop();
        const sessionName = lastUserMsg 
            ? lastUserMsg.text.substring(0, 30) 
            : 'Sesión sin título';
        
        console.log(`💾 Sesión guardada: "${sessionName}" (${sessionMessages.length} mensajes)`);
    }
    
    // Crear nueva sesión
    currentSessionStartIndex = globalHistory.length;
    
    // Limpiar vista
    clearChatView();
    
    // Mensaje de bienvenida mejorado
    const greetings = [
        '🧠 **Nueva sesión iniciada**\n\nContexto reseteado. La memoria a largo plazo permanece intacta.\n\n¿En qué puedo ayudarte?',
        '🚀 **Sesión lista**\n\nNueva conversación iniciada. Estoy listo para analizar datos, generar gráficos o responder tus preguntas.',
        '💡 **Tablero limpio**\n\nSesión fresca iniciada. Cuéntame qué necesitas analizar hoy.',
    ];
    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
    
    addMessageToChat('ai', formatMessage(randomGreeting));
    
    // Notificar en sidebar
    renderHistorySidebar();
    
    // Scroll al top del chat
    chatBox.scrollTop = 0;
    
    console.log('✅ Nueva sesión iniciada');
}

// ====================== SPEECH-TO-TEXT MEJORADO ======================
function toggleSpeechToText() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        addMessageToChat('ai', formatMessage(
            '🎤 **Reconocimiento de voz no soportado**\n\n' +
            'Esta función requiere:\n' +
            '• Chrome, Edge o Brave\n' +
            '• Conexión HTTPS o localhost\n' +
            '• Permiso de micrófono'
        ));
        return;
    }
    
    // Verificar si ya está grabando
    if (sttBtn.classList.contains('recording')) {
        stopRecording();
        return;
    }
    
    // Solicitar permiso de micrófono primero
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => {
            startRecording();
        })
        .catch((err) => {
            console.error('Permiso de micrófono denegado:', err);
            addMessageToChat('ai', formatMessage(
                '🔒 **Permiso de micrófono denegado**\n\n' +
                'Para usar el dictado por voz:\n' +
                '1. Haz clic en el ícono de 🔒 en la barra de direcciones\n' +
                '2. Activa el permiso de micrófono\n' +
                '3. Recarga la página'
            ));
        });
    
    function startRecording() {
        const recognition = new SpeechRecognition();
        recognition.lang = 'es-ES';
        recognition.interimResults = true;
        recognition.continuous = true;
        recognition.maxAlternatives = 1;
        
        // Feedback visual
        sttBtn.classList.add('recording');
        sttBtn.style.color = 'var(--neon-pink)';
        sttBtn.style.animation = 'pulse 1s infinite';
        sttBtn.title = 'Grabando... Click para detener';
        
        // Indicador de escucha en el chat
        const listeningDiv = document.createElement('div');
        listeningDiv.className = 'message ai-message';
        listeningDiv.id = 'stt-listening-indicator';
        listeningDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-microphone" style="color: var(--neon-pink); animation: pulse 1s infinite;"></i>
                <span>🎤 <strong>Escuchando...</strong> Habla ahora</span>
            </div>
            <div id="stt-interim-text" style="color: var(--text-dim); font-size: 0.85rem; margin-top: 5px; min-height: 20px;"></div>
        `;
        chatBox.appendChild(listeningDiv);
        scrollToBottom();
        
        // Resultados
        recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript += transcript;
                }
            }
            
            // Mostrar texto interino
            const interimEl = document.getElementById('stt-interim-text');
            if (interimEl) {
                interimEl.textContent = interimTranscript || finalTranscript;
            }
            
            // Si hay texto final, ponerlo en el input
            if (finalTranscript.trim()) {
                userInput.value = finalTranscript.trim();
                userInput.dispatchEvent(new Event('input'));
                userInput.focus();
            }
        };
        
        // Manejo de errores
        recognition.onerror = (event) => {
            console.error('STT Error:', event.error);
            
            const errorMessages = {
                'no-speech': 'No se detectó voz. Intenta de nuevo.',
                'aborted': 'Grabación cancelada.',
                'audio-capture': 'No se encontró micrófono.',
                'network': 'Error de red. Verifica tu conexión.',
                'not-allowed': 'Permiso de micrófono denegado.',
                'service-not-allowed': 'Servicio de voz no disponible.',
                'bad-grammar': 'Error en el reconocimiento.',
                'language-not-supported': 'Idioma no soportado.',
            };
            
            const message = errorMessages[event.error] || `Error: ${event.error}`;
            addMessageToChat('ai', formatMessage(`⚠️ **Voz:** ${message}`));
            
            stopRecordingUI();
        };
        
        // Al finalizar
        recognition.onend = () => {
            stopRecordingUI();
            
            // Si hay texto en el input, preguntar si quiere enviar
            if (userInput.value.trim()) {
                const sendIndicator = document.createElement('div');
                sendIndicator.className = 'message ai-message';
                sendIndicator.innerHTML = `
                    <span>✅ <strong>Texto capturado.</strong> Presiona <kbd style="background: var(--bg-elevated); padding: 2px 6px; border-radius: 4px;">Enter</kbd> para enviar o edita el mensaje.</span>
                `;
                chatBox.appendChild(sendIndicator);
                scrollToBottom();
            }
        };
        
        // Iniciar reconocimiento
        recognition.start();
        
        // Guardar referencia para poder cancelar
        window.currentRecognition = recognition;
    }
    
    function stopRecording() {
        if (window.currentRecognition) {
            window.currentRecognition.stop();
            window.currentRecognition = null;
        }
        stopRecordingUI();
    }
    
    function stopRecordingUI() {
        sttBtn.classList.remove('recording');
        sttBtn.style.color = '';
        sttBtn.style.animation = '';
        sttBtn.title = 'Dictado por Voz';
        
        // Quitar indicador de escucha
        const indicator = document.getElementById('stt-listening-indicator');
        if (indicator) {
            indicator.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => indicator.remove(), 300);
        }
    }
}

// ====================== ARRANQUE DEL SISTEMA MEJORADO ======================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔧 Iniciando CyberGen AI V15.2...');
    console.log('📍 URL:', window.location.href);
    console.log('🌐 Navegador:', navigator.userAgent);
    
    try {
        // Verificar dependencias críticas
        const dependencies = checkDependencies();
        
        if (!dependencies.allOk) {
            showStartupError(
                'Dependencias faltantes',
                'Algunas librerías no se cargaron correctamente.',
                dependencies.missing
            );
            return;
        }
        
        // Verificar soporte del navegador
        const browserSupport = checkBrowserSupport();
        if (!browserSupport.ok) {
            console.warn('⚠️ Navegador con soporte limitado:', browserSupport.warnings);
        }
        
        // Iniciar aplicación
        initApp();
        
        // Registrar información de inicio
        logStartupInfo(dependencies, browserSupport);
        
        console.log('✅ CyberGen AI V15.2 operativo');
        
    } catch(e) {
        console.error('❌ Error fatal durante inicialización:', e);
        console.error('Stack:', e.stack);
        
        showStartupError(
            'Error al iniciar CyberGen AI',
            e.message,
            ['Recarga la página (F5)', 'Limpia la caché del navegador', 'Verifica la consola (F12)']
        );
    }
});

// ====================== DIAGNÓSTICO DE DEPENDENCIAS ======================
function checkDependencies() {
    const deps = {
        marked: typeof marked !== 'undefined',
        Chart: typeof Chart !== 'undefined',
        Prism: typeof Prism !== 'undefined',
        XLSX: typeof XLSX !== 'undefined',
        speechSynthesis: 'speechSynthesis' in window,
        localStorage: isLocalStorageAvailable(),
        fetch: typeof fetch !== 'undefined'
    };
    
    const missing = Object.entries(deps)
        .filter(([name, available]) => !available)
        .map(([name]) => {
            const names = {
                marked: 'marked.js (Markdown)',
                Chart: 'Chart.js (Gráficos)',
                Prism: 'Prism.js (Código)',
                XLSX: 'SheetJS (Excel)',
                speechSynthesis: 'Web Speech API (Voz)',
                localStorage: 'localStorage (Memoria)',
                fetch: 'Fetch API (Conexión)'
            };
            return names[name] || name;
        });
    
    return {
        allOk: missing.length === 0,
        missing: missing,
        details: deps
    };
}

function checkBrowserSupport() {
    const warnings = [];
    
    // Detectar navegador
    const ua = navigator.userAgent;
    let browser = 'Desconocido';
    
    if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Edg')) browser = 'Edge';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
    else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';
    
    // Verificar funcionalidades específicas
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
        warnings.push('Reconocimiento de voz no disponible');
    }
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        warnings.push('Acceso al micrófono no disponible');
    }
    
    if (browser === 'Safari') {
        warnings.push('Safari puede tener limitaciones con Web Speech API');
    }
    
    return {
        ok: warnings.length === 0,
        browser: browser,
        warnings: warnings
    };
}

function isLocalStorageAvailable() {
    try {
        const test = '__storage_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch(e) {
        return false;
    }
}

// ====================== REGISTRO DE INICIO ======================
function logStartupInfo(deps, browser) {
    console.log('📊 ─── Diagnóstico del Sistema ───');
    console.log('🖥️ Navegador:', browser.browser);
    console.log('📦 Dependencias:', deps.details);
    console.log('🔑 API Key:', API_KEY ? 'Configurada (' + API_KEY.substring(0, 8) + '...)' : 'NO CONFIGURADA');
    console.log('🤖 Modelo:', selectedModel);
    console.log('🔊 Voz:', isAudioEnabled ? 'Activada' : 'Desactivada');
    console.log('💾 Historial:', globalHistory.length, 'mensajes');
    console.log('📡 Plataforma:', detectPlatform());
    console.log('─────────────────────────────────');
}

function detectPlatform() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'Desarrollo Local';
    }
    if (window.location.hostname.includes('vercel.app')) {
        return 'Vercel (Producción)';
    }
    if (window.location.hostname.includes('github.io')) {
        return 'GitHub Pages';
    }
    return 'Desconocida';
}

// ====================== PANTALLA DE ERROR ======================
function showStartupError(title, message, suggestions = []) {
    if (!chatBox) {
        // Si no hay chatBox, mostrar en body
        document.body.innerHTML = `
            <div style="
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                background: #06060f;
                color: #e0e0ff;
                font-family: 'Rajdhani', sans-serif;
            ">
                <div style="text-align: center; max-width: 500px; padding: 40px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 4rem; color: #ff006e; margin-bottom: 20px;"></i>
                    <h2 style="color: #ff006e; font-family: 'Orbitron', sans-serif; margin-bottom: 15px;">${title}</h2>
                    <p style="color: #8080b0; margin-bottom: 25px; line-height: 1.6;">${message}</p>
                    ${suggestions.length > 0 ? `
                        <div style="text-align: left; background: #0a0a1a; padding: 20px; border-radius: 12px; border: 1px solid rgba(0,240,255,0.2);">
                            <strong style="color: #00f0ff;">Sugerencias:</strong>
                            <ul style="margin-top: 10px; color: #8080b0;">
                                ${suggestions.map(s => `<li style="margin-bottom: 5px;">${s}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    <button onclick="location.reload()" style="
                        margin-top: 25px;
                        padding: 12px 30px;
                        background: linear-gradient(135deg, #00f0ff, #b400ff);
                        color: white;
                        border: none;
                        border-radius: 25px;
                        font-family: 'Orbitron', sans-serif;
                        font-size: 0.9rem;
                        cursor: pointer;
                        letter-spacing: 1px;
                    ">
                        <i class="fas fa-redo"></i> Reintentar
                    </button>
                </div>
            </div>
        `;
        return;
    }
    
    // Si hay chatBox, mostrar error estilizado
    chatBox.innerHTML = `
        <div style="text-align: center; padding: 60px 20px;">
            <i class="fas fa-skull" style="font-size: 5rem; color: var(--neon-pink); text-shadow: var(--glow-pink); margin-bottom: 20px;"></i>
            <h2 style="color: var(--neon-pink); font-family: 'Orbitron', sans-serif;">${title}</h2>
            <p style="color: var(--text-secondary); margin: 15px 0;">${message}</p>
            ${suggestions.length > 0 ? `
                <div style="
                    text-align: left;
                    background: var(--bg-elevated);
                    padding: 20px;
                    border-radius: 12px;
                    border: var(--border-subtle);
                    max-width: 400px;
                    margin: 20px auto;
                ">
                    <strong style="color: var(--neon-cyan);"><i class="fas fa-lightbulb"></i> Sugerencias:</strong>
                    <ul style="margin-top: 10px; color: var(--text-dim);">
                        ${suggestions.map(s => `<li>${s}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
            <button onclick="location.reload()" class="new-chat-btn" style="max-width: 200px; margin: 20px auto;">
                <i class="fas fa-redo"></i> Reintentar
            </button>
        </div>
    `;
}

// ====================== RECUPERACIÓN DE ERRORES GLOBAL ======================
window.addEventListener('error', (event) => {
    console.error('⚠️ Error global capturado:', event.message);
    console.error('📍 Origen:', event.filename, 'línea:', event.lineno);
    
    // Evitar crash completo
    if (event.message.includes('marked') || event.message.includes('Prism')) {
        console.warn('🔄 Librería no disponible, usando fallback');
        event.preventDefault();
    }
});

// Manejar promesas no capturadas
window.addEventListener('unhandledrejection', (event) => {
    console.error('⚠️ Promesa no manejada:', event.reason);
    
    if (isProcessing) {
        isProcessing = false;
        sendBtn.disabled = false;
        sendBtn.style.opacity = '1';
        removeTypingIndicator();
        updateStatusDot(false);
    }
});

// ====================== DETECCIÓN DE CONEXIÓN ======================
window.addEventListener('online', () => {
    console.log('🌐 Conexión restaurada');
    updateStatusDot(!!API_KEY);
    if (modelStatus) modelStatus.textContent = selectedModel;
});

window.addEventListener('offline', () => {
    console.warn('📵 Sin conexión a internet');
    updateStatusDot(false);
    if (modelStatus) modelStatus.textContent = '📵 Sin conexión';
});

// ====================== ATALLO DE TECLADO ======================
document.addEventListener('keydown', (e) => {
    // Ctrl + K: Abrir/Cerrar sidebar
    if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        toggleSidebar();
    }
    
    // Ctrl + L: Limpiar chat
    if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        clearChatView();
    }
    
    // Ctrl + M: Toggle audio
    if (e.ctrlKey && e.key === 'm') {
        e.preventDefault();
        toggleAudio();
    }
    
    // Ctrl + N: Nueva sesión
    if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        startNewSession();
    }
});

console.log('🚀 CyberGen AI V15.2 - Núcleo cargado y blindado');