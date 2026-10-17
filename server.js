const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 4173;
const ROOT = __dirname;
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(Buffer.isBuffer(body) || typeof body === 'string' ? body : JSON.stringify(body));
}

async function generateStudySet(input) {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY не задан');
  const prompt = `Ты создаёшь учебный набор для школьника. Отвечай только валидным JSON без markdown и дополнительного текста.
Предмет: ${input.subject}
Название темы: ${input.title}
Материал ученика:
${input.text.slice(0, 24000)}
Формат ответа:
{"cards":[{"icon":"💡","title":"...","text":"..."}],"questions":[{"question":"...","answers":["...","...","...","..."],"correct":0,"explanation":"..."}],"summary":"..."}
Сделай 3-5 карточек простыми словами уровня ELI10 и 5 вопросов по этому материалу. correct — индекс правильного ответа от 0 до 3. Не выдумывай факты: используй только материал, а если данных мало, создай вопросы на понимание самого текста.`;
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, temperature: 0.2, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'Ты аккуратный русскоязычный помощник по учёбе.' }, { role: 'user', content: prompt }] })
  });
  if (!response.ok) throw new Error(`Groq API: ${response.status} ${await response.text()}`);
  const data = await response.json();
  return JSON.parse(data.choices?.[0]?.message?.content || '{}');
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/study') {
    let raw = ''; req.on('data', chunk => { raw += chunk; });
    req.on('end', async () => { try { const input = JSON.parse(raw); if (!input.text?.trim()) return send(res, 400, { error: 'Текст материала пустой' }); send(res, 200, await generateStudySet(input)); } catch (error) { send(res, 502, { error: error.message }); } });
    return;
  }
  const requested = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const file = path.join(ROOT, requested);
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8', '.wasm': 'application/wasm' };
  send(res, 200, fs.readFileSync(file), types[path.extname(file)] || 'application/octet-stream');
});
server.listen(PORT, () => console.log(`Учёба без паники: http://localhost:${PORT}`));
