

export default async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }


  const API_KEY = process.env.GEMINI_API_KEY; 
  
  if (!API_KEY) {
    return res.status(500).json({ error: 'El mesero perdió la llave (Revisa Vercel Env)' });
  }

  // Recibimos lo que el cliente nos pidió desde main.js
  const { prompt, files, history, systemPrompt } = req.body;

  // Lista de modelos de respaldo por si uno falla
  const MODELS_LIST = [
    "gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro", 
    "gemini-2.5-flash", "gemini-2.5-flash-lite"
  ];

  // Intentamos conectar con la cocina (Google)
  for (let i = 0; i < MODELS_LIST.length; i++) {
    const model = MODELS_LIST[i];
    try {
      // Preparamos el historial de la conversación
      let contents = history.map(h => ({ role: h.role, parts: [{ text: h.text }] })).slice(-8);
      let userParts = [{ text: prompt }];
      
      // Si subieron archivos, los agregamos
      if (files && files.length > 0 && i === 0) {
        files.forEach(f => userParts.push({ inlineData: { mimeType: f.type, data: f.data } }));
      }
      contents.push({ role: "user", parts: userParts });

      
      const apiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contents, 
          systemInstruction: { parts: [{ text: systemPrompt }] } 
        })
      });

      
      if (!apiRes.ok) {
        if ([400, 404, 429].includes(apiRes.status)) continue;
        const err = await apiRes.json().catch(() => ({}));
        throw new Error(err.error?.message || `Error ${apiRes.status}`);
      }


      const data = await apiRes.json();
      return res.status(200).json({ text: data.candidates[0].content.parts[0].text });

    } catch (e) {
      if (i === MODELS_LIST.length - 1) return res.status(500).json({ error: e.message });
    }
  }
  return res.status(500).json({ error: "Todos los modelos fallaron" });
}