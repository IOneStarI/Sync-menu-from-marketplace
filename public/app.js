const form = document.querySelector('#sync-form');
const promptInput = document.querySelector('#prompt');
const submitButton = document.querySelector('#submit-button');
const resultsEl = document.querySelector('#results');
const progressPanel = document.querySelector('#progress-panel');
const progressTitle = document.querySelector('#progress-title');
const progressCount = document.querySelector('#progress-count');
const progressBar = document.querySelector('#progress-bar');
const progressSteps = document.querySelector('#progress-steps');

const progressState = {
  total: 0,
  completed: 0,
};

function setStatus(message) {
  submitButton.textContent = message;
}

function resetProgress() {
  progressState.total = 0;
  progressState.completed = 0;
  progressPanel.hidden = false;
  progressTitle.textContent = 'Preparing request';
  progressCount.textContent = '0%';
  progressBar.style.width = '0%';
  progressSteps.innerHTML = '';
}

function updateProgress() {
  const percent = progressState.total === 0
    ? 0
    : Math.round((progressState.completed / progressState.total) * 100);
  progressCount.textContent = `${percent}%`;
  progressBar.style.width = `${percent}%`;
}

function addProgressStep(label, state = 'active') {
  progressState.total += 1;
  const item = document.createElement('li');
  item.className = `progress-step ${state}`;
  item.innerHTML = `<span></span><strong>${escapeHtml(label)}</strong>`;
  progressSteps.append(item);
  updateProgress();
  return item;
}

function completeProgressStep(item, label) {
  item.classList.remove('active', 'failed');
  item.classList.add('done');
  if (label) item.querySelector('strong').textContent = label;
  progressState.completed += 1;
  updateProgress();
}

function failProgressStep(item, label) {
  item.classList.remove('active', 'done');
  item.classList.add('failed');
  if (label) item.querySelector('strong').textContent = label;
  updateProgress();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function metric(label, value) {
  return `
    <div class="metric">
      <strong>${escapeHtml(value ?? 0)}</strong>
      <span>${escapeHtml(label)}</span>
    </div>
  `;
}

function renderLogs(logs = []) {
  return logs
    .map((entry) => {
      if (entry.summary) {
        return `[${entry.level}] ${entry.message}: ${JSON.stringify(entry.summary)}`;
      }
      return `[${entry.level}] ${entry.message}`;
    })
    .join('\n');
}

function renderResult(result) {
  const summary = result.summary || {};
  const title = result.url || (result.action === 'clear_menu' ? 'Clear Choice menu' : 'Command');
  const card = document.createElement('article');
  card.className = `result-card ${result.ok ? 'ok' : 'fail'}`;
  card.innerHTML = `
    <div class="result-header">
      <div class="result-url">${escapeHtml(title)}</div>
      <span class="badge">${result.ok ? 'Completed' : 'Failed'}</span>
    </div>
    ${result.error ? `<p>${escapeHtml(result.error)}</p>` : ''}
    ${
      result.ok && result.action === 'sync_menu'
        ? `<div class="summary-grid">
            ${metric('Marketplace', summary.marketplace)}
            ${metric('Status', summary.status)}
            ${metric('Categories', summary.categories)}
            ${metric('Items', summary.items)}
            ${metric('Imported', summary.importedItems)}
          </div>`
        : ''
    }
    ${
      result.ok && result.action === 'clear_menu'
        ? `<div class="summary-grid">
            ${metric('Action', 'Clear menu')}
            ${metric('Status', summary.status)}
          </div>`
        : ''
    }
    <pre>${escapeHtml(renderLogs(result.logs))}</pre>
  `;
  return card;
}

function renderError(message) {
  const card = document.createElement('article');
  card.className = 'result-card fail';
  card.innerHTML = `
    <div class="result-header">
      <div class="result-url">Request failed</div>
      <span class="badge">Failed</span>
    </div>
    <p>${escapeHtml(message)}</p>
  `;
  return card;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const prompt = promptInput.value.trim();

  if (!prompt) {
    submitButton.textContent = 'Enter URL';
    promptInput.focus();
    return;
  }

  submitButton.disabled = true;
  setStatus('Import running');
  resultsEl.innerHTML = '';
  resetProgress();

  try {
    progressTitle.textContent = 'Sending command';
    const sendStep = addProgressStep('Sending command to server');
    completeProgressStep(sendStep, 'Command sent');
    const processingStep = addProgressStep('Server processing command');
    const response = await fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
      }),
    });
    completeProgressStep(processingStep, 'Server finished processing');

    progressTitle.textContent = 'Processing response';
    const parseStep = addProgressStep('Reading server response');
    const data = await response.json();
    completeProgressStep(parseStep, 'Server response received');

    if (!response.ok && !data.results) {
      throw new Error(data.error || 'Request failed');
    }

    const results = data.results || [];
    const resultStep = addProgressStep(`Rendering ${results.length || 0} result${results.length === 1 ? '' : 's'}`);
    for (const result of data.results || []) {
      resultsEl.append(renderResult(result));
    }
    completeProgressStep(resultStep, 'Results rendered');

    progressTitle.textContent = data.ok ? 'Completed' : 'Completed with errors';
    setStatus(data.ok ? 'Completed' : 'Completed with errors');
    promptInput.value = '';
  } catch (error) {
    const activeStep = progressSteps.querySelector('.progress-step.active');
    if (activeStep) failProgressStep(activeStep, error.message || 'Request failed');
    progressTitle.textContent = 'Failed';
    resultsEl.append(renderError(error.message || 'Request failed'));
    setStatus('Failed');
  } finally {
    window.setTimeout(() => {
      submitButton.disabled = false;
      submitButton.textContent = 'Submit';
    }, 1200);
  }
});
