const messagesEl = document.querySelector('#messages');
const promptEl = document.querySelector('#prompt');
const sendEl = document.querySelector('#send');
const stopEl = document.querySelector('#stop');
const statusEl = document.querySelector('.side-note');
const statusText = document.querySelector('#status-text');
let store = { conversations: [] };
let conversation;
let activeRequest = null;

function newConversation() { return { id: crypto.randomUUID(), title: 'New conversation', createdAt: new Date().toISOString(), messages: [] }; }
function current() { return conversation.messages; }
function save() { store.conversations = [conversation, ...store.conversations.filter(c => c.id !== conversation.id)].slice(0, 100); return window.offlineAI.saveHistory(store); }
function escape(text) { const x = document.createElement('span'); x.textContent = text; return x.innerHTML; }
function appendMessage(role, content, id) { const el = document.createElement('article'); el.className = `message ${role}`; if (id) el.id = id; el.innerHTML = `<div class="avatar">${role === 'user' ? 'You' : 'A'}</div><div class="bubble">${escape(content)}</div>`; messagesEl.append(el); messagesEl.scrollTop = messagesEl.scrollHeight; return el; }
function render() { messagesEl.innerHTML = ''; document.querySelector('#chat-title').textContent = conversation.title; if (!current().length) { messagesEl.innerHTML = document.querySelector('.welcome')?.outerHTML || `<section class="welcome"><div class="welcome-mark">A</div><h2>Aditya Intelligence</h2><p>Your private, offline assistant. Ask anything to begin.</p></section>`; } else current().forEach(m => appendMessage(m.role, m.content)); }
function setStreaming(active) { activeRequest = active ? crypto.randomUUID() : null; sendEl.classList.toggle('hidden', active); stopEl.classList.toggle('hidden', !active); promptEl.disabled = active; }
function autosize() { promptEl.style.height = 'auto'; promptEl.style.height = `${Math.min(promptEl.scrollHeight,160)}px`; }
async function send(text = promptEl.value.trim(), reuseLastUser = false) {
  if (!text || activeRequest) return;
  const status = await window.offlineAI.status(); if (!status.ready) { appendMessage('assistant', 'The local model is still loading. Please wait for Offline · Ready.'); return; }
  if (!current().length) messagesEl.innerHTML = '';
  if (!reuseLastUser) { current().push({ role: 'user', content: text }); appendMessage('user', text); }
  const assistant = { role: 'assistant', content: '' }; current().push(assistant);
  if (conversation.title === 'New conversation') { conversation.title = text.slice(0, 42) + (text.length > 42 ? '…' : ''); document.querySelector('#chat-title').textContent = conversation.title; }
  promptEl.value = ''; autosize(); setStreaming(true); const requestId = activeRequest; appendMessage('assistant', '', `reply-${requestId}`);
  await window.offlineAI.startChat({ requestId, messages: current().slice(0, -1) });
}
window.offlineAI.onToken(({ requestId, token }) => { if (requestId !== activeRequest) return; const reply = current().at(-1); reply.content += token; document.querySelector(`#reply-${requestId} .bubble`).textContent = reply.content; messagesEl.scrollTop = messagesEl.scrollHeight; });
window.offlineAI.onDone(async ({ requestId, stopped, error }) => { if (requestId !== activeRequest) return; if (error) { current().at(-1).content = `Error: ${error}`; document.querySelector(`#reply-${requestId} .bubble`).classList.add('error-text'); document.querySelector(`#reply-${requestId} .bubble`).textContent = current().at(-1).content; } if (stopped && !current().at(-1).content) current().pop(); setStreaming(false); await save(); });
window.offlineAI.onStatus(({ state, detail }) => { statusEl.className = `side-note ${state}`; statusText.textContent = state === 'ready' ? 'Offline · Ready' : detail || `Offline · ${state}`; });
document.querySelector('#new-chat').addEventListener('click', () => { conversation = newConversation(); render(); });
document.querySelector('#send').addEventListener('click', () => send());
document.querySelector('#stop').addEventListener('click', () => activeRequest && window.offlineAI.stopChat(activeRequest));
document.querySelector('#regenerate').addEventListener('click', () => { if (activeRequest || !current().length) return; if (current().at(-1).role === 'assistant') current().pop(); const last = current().at(-1); if (last?.role === 'user') send(last.content, true); });
document.querySelector('#clear-chat').addEventListener('click', async () => { if (await window.offlineAI.confirmClear()) { conversation.messages = []; conversation.title = 'New conversation'; await save(); render(); } });
document.addEventListener('click', e => { const btn = e.target.closest('[data-prompt]'); if (btn) send(btn.dataset.prompt); });
promptEl.addEventListener('input', autosize); promptEl.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
(async () => { store = await window.offlineAI.loadHistory(); conversation = newConversation(); render(); const status = await window.offlineAI.status(); if (status.ready) { statusEl.classList.add('ready'); statusText.textContent = 'Offline · Ready'; } })();
