const workflowButtons = document.querySelector('#workflow-buttons');
const liveStatus = document.querySelector('#live-status');
const liveStatusWrap = document.querySelector('#live-status-wrap');
const entranceSwitch = document.querySelector('#entrance-enabled');
const emptyWorkflows = document.querySelector('#empty-workflows');
let state = { workflows: [], activeId: null, overlayEnabled: true };

async function control(action, id) {
  const response = await fetch('/api/control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, id })
  });
  const updatedState = await response.json();
  if (!response.ok) throw new Error(updatedState.error || 'Non \u00e8 stato possibile applicare il comando.');
  state = updatedState;
  render();
}

function render() {
  workflowButtons.replaceChildren();
  emptyWorkflows.hidden = state.workflows.length > 0;
  for (const workflow of state.workflows) {
    const button = document.createElement('button');
    button.type = 'button';
    const isActive = state.activeId === workflow.id;
    const isOnAir = isActive && state.overlayEnabled !== false;
    button.className = `workflow-choice${isOnAir ? ' is-on-air' : isActive ? ' is-selected-off' : ''}`;
    const name = document.createElement('span');
    name.textContent = workflow.name;
    const status = document.createElement('small');
    status.textContent = isActive ? (isOnAir ? 'IN DIRETTA \u00b7 premi per spegnere' : 'SPENTA \u00b7 premi per attivare') : 'Premi per mandare in onda';
    button.append(name, status);
    button.setAttribute('aria-pressed', String(isOnAir));
    button.onclick = () => control('select', workflow.id).catch(error => { liveStatus.textContent = error.message; });
    workflowButtons.append(button);
  }

  const statusText = !state.workflows.length
    ? 'Aggiungi una lista per andare in diretta'
    : state.overlayEnabled !== false ? 'Fascia informativa in diretta' : 'Fascia informativa disattivata';
  liveStatus.textContent = statusText;
  liveStatusWrap.classList.toggle('is-live', Boolean(state.workflows.length) && state.overlayEnabled !== false);
  liveStatusWrap.classList.toggle('is-off', !state.workflows.length || state.overlayEnabled === false);
  liveStatusWrap.querySelector('.status-dot').classList.toggle('inactive', state.overlayEnabled === false || !state.workflows.length);
  entranceSwitch.checked = Boolean(state.entranceEnabled);
  entranceSwitch.disabled = !state.workflows.length;
}

entranceSwitch.addEventListener('change', () => control('toggle-entrance').catch(error => { liveStatus.textContent = error.message; }));
fetch('/api/state').then(response => response.json()).then(value => { state = value; render(); });
const events = new EventSource('/api/events');
events.onmessage = event => { state = JSON.parse(event.data); render(); };
