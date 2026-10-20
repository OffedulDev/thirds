const list = document.querySelector('#workflow-list');
const form = document.querySelector('#workflow-form');
const fields = { id: document.querySelector('#workflow-id'), name: document.querySelector('#name'), motto: document.querySelector('#motto'), logo: document.querySelector('#logo'), logoFile: document.querySelector('#logo-file'), candidates: document.querySelector('#candidates') };
let state = { workflows: [], activeId: null };

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Richiesta non riuscita.');
  return body;
}
function imageOrInitials(workflow) {
  const element = document.createElement('div'); element.className = 'workflow-avatar';
  if (workflow.logo) {
    const image = document.createElement('img'); image.src = workflow.logo; image.alt = '';
    image.onerror = () => { element.textContent = workflow.name.slice(0, 2).toUpperCase(); };
    element.append(image);
  } else element.textContent = workflow.name.slice(0, 2).toUpperCase();
  return element;
}
function render() {
  list.replaceChildren();
  document.querySelector('#empty-state').hidden = state.workflows.length > 0;
  for (const workflow of state.workflows) {
    const row = document.createElement('div'); row.className = `workflow-item${state.activeId === workflow.id ? ' selected' : ''}`;
    row.append(imageOrInitials(workflow));
    const info = document.createElement('div'); info.className = 'workflow-info';
    const name = document.createElement('strong'); name.textContent = workflow.name;
    const motto = document.createElement('span'); motto.textContent = workflow.motto || `${(workflow.candidates || []).length} candidati`;
    info.append(name, motto);
    const actions = document.createElement('div'); actions.className = 'item-actions';
    const edit = document.createElement('button'); edit.className = 'text-button'; edit.textContent = 'Modifica'; edit.onclick = () => editWorkflow(workflow);
    const remove = document.createElement('button'); remove.className = 'text-button delete'; remove.textContent = 'Elimina'; remove.onclick = () => removeWorkflow(workflow);
    actions.append(edit, remove); row.append(info, actions); list.append(row);
  }
}
function clearForm() {
  form.reset(); fields.id.value = '';
  document.querySelector('#logo-help').textContent = 'Carica PNG, JPEG, WebP o GIF, massimo 5 MB.';
  document.querySelector('#form-title').textContent = 'Aggiungi lista';
  document.querySelector('#form-eyebrow').textContent = 'NUOVA';
  document.querySelector('#save-button').textContent = 'Salva lista';
  document.querySelector('#form-message').textContent = '';
}
function editWorkflow(workflow) {
  fields.id.value = workflow.id; fields.name.value = workflow.name; fields.motto.value = workflow.motto; fields.logo.value = workflow.logo;
  fields.logoFile.value = '';
  document.querySelector('#logo-help').textContent = workflow.logo ? 'Logo già presente. Scegli un file per sostituirlo.' : 'Carica PNG, JPEG, WebP o GIF, massimo 5 MB.';
  fields.candidates.value = (workflow.candidates || []).join('\n');
  document.querySelector('#form-title').textContent = 'Modifica lista';
  document.querySelector('#form-eyebrow').textContent = 'MODIFICA';
  document.querySelector('#save-button').textContent = 'Salva modifiche';
  document.querySelector('#form-message').textContent = '';
  fields.name.focus();
}
async function removeWorkflow(workflow) {
  if (!window.confirm(`Eliminare la lista \u201c${workflow.name}\u201d?`)) return;
  try { state = await api(`/api/workflows/${encodeURIComponent(workflow.id)}`, { method: 'DELETE' }); render(); }
  catch (error) { document.querySelector('#form-message').textContent = error.message; }
}
form.addEventListener('submit', async event => {
  event.preventDefault(); document.querySelector('#form-message').textContent = '';
  const data = { name: fields.name.value, motto: fields.motto.value, logo: fields.logo.value, candidates: fields.candidates.value.split(/\r?\n/).map(name => name.trim()).filter(Boolean) };
  try {
    const logoFile = fields.logoFile.files[0];
    if (logoFile) {
      const upload = await fetch('/api/logos', { method: 'POST', headers: { 'Content-Type': logoFile.type }, body: logoFile });
      const uploaded = await upload.json();
      if (!upload.ok) throw new Error(uploaded.error || 'Caricamento del logo non riuscito.');
      data.logo = uploaded.logo;
    }
    const id = fields.id.value;
    await api(id ? `/api/workflows/${encodeURIComponent(id)}` : '/api/workflows', { method: id ? 'PUT' : 'POST', body: JSON.stringify(data) });
    if (!id && location.pathname === '/admin/create') {
      location.assign('/admin');
      return;
    }
    state = await api('/api/state'); clearForm(); render();
  } catch (error) { document.querySelector('#form-message').textContent = error.message; }
});
document.body.classList.toggle('create-page', location.pathname === '/admin/create');
document.querySelector('#new-workflow').onclick = () => location.assign('/admin/create');
document.querySelector('#cancel-edit').onclick = () => {
  if (location.pathname === '/admin/create') location.assign('/admin');
  else clearForm();
};
fields.logoFile.addEventListener('change', () => {
  const file = fields.logoFile.files[0];
  document.querySelector('#logo-help').textContent = file ? `Logo selezionato: ${file.name}` : 'Carica PNG, JPEG, WebP o GIF, massimo 5 MB.';
});
api('/api/state').then(value => { state = value; render(); }).catch(error => { document.querySelector('#form-message').textContent = error.message; });
const events = new EventSource('/api/events');
events.onmessage = event => { state = JSON.parse(event.data); render(); };
