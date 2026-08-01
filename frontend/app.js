/* ── SmartML Dashboard – Full Application Logic ─────────── */

const API = 'http://localhost:8000/api';
const PHASES = ['upload', 'analyzing', 'config', 'training', 'results'];
const ANALYZE_STEPS = [
  { label: 'Reading file', icon: 'file' },
  { label: 'Inspecting features', icon: 'search' },
  { label: 'Calculating statistics', icon: 'chart' },
  { label: 'Detecting problem type', icon: 'brain' },
  { label: 'Ranking targets', icon: 'star' },
];
const MODEL_LIST = [
  'Logistic Regression', 'Ridge Regression', 'Decision Tree',
  'Random Forest', 'Gradient Boosting', 'XGBoost', 'LightGBM',
  'SVM', 'KNN', 'Neural Net',
];

let state = {
  phase: 'upload',
  file: null,
  jobId: null,
  inspection: null,
  config: null,
  results: null,
  chatHistory: [],
  analyzingProgress: 0,
  activeStep: 0,
  trainingProgress: 0,
  trainingElapsed: 0,
  trainingTimer: null,
  pollTimer: null,
  modelStates: [],
  trainingLogs: [],
  chart: null,
  distChart: null,
  resultsDistChart: null,
  suggestedTarget: null,
  suggestedProblemType: null,
  selectedMetric: null,
  backendLogCount: 0,
};

const $ = id => document.getElementById(id);
const show = el => el.classList.remove('hidden');
const hide = el => el.classList.add('hidden');

/* ── Phase Navigation ──────────────────────────────────────────────────── */
function goToPhase(phase) {
  state.phase = phase;
  PHASES.forEach(p => {
    const el = $(`phase${p.charAt(0).toUpperCase() + p.slice(1)}`);
    if (el) {
      if (p === phase) { el.classList.remove('hidden'); } else { el.classList.add('hidden'); }
    }
  });
  renderPhaseIndicator();
}

function renderPhaseIndicator() {
  const container = $('phaseIndicator');
  const idx = PHASES.indexOf(state.phase);
  const labels = { upload: 'Upload', analyzing: 'Analyze', config: 'Configure', training: 'Train', results: 'Results' };
  container.innerHTML = PHASES.map((p, i) => {
    const cls = i === idx ? 'active' : i < idx ? 'done' : 'pending';
    return `<span class="phase-step ${cls}">${i + 1} · ${labels[p]}</span>${i < PHASES.length - 1 ? `<span class="phase-connector ${cls}"></span>` : ''}`;
  }).join('');
}

/* ── Health ──────────────────────────────────────────────────────────────── */
async function checkHealth() {
  try {
    const r = await fetch(`${API}/health`);
    if (r.ok) {
      $('statusBadge').className = 'status-badge';
      $('statusDot').className = 'status-dot';
      $('statusLabel').textContent = 'Connected';
    } else throw new Error();
  } catch {
    $('statusBadge').className = 'status-badge offline';
    $('statusDot').className = 'status-dot';
    $('statusLabel').textContent = 'API Offline';
  }
}

/* ── UPLOAD ─────────────────────────────────────────────────────────────── */
function setupUpload() {
  const dz = $('dropzone');
  const input = $('fileInput');
  dz.addEventListener('click', e => { if (e.target.closest('.btn-primary')) return; input.click(); });
  $('browseBtn').addEventListener('click', () => input.click());
  input.addEventListener('change', e => { if (e.target.files[0]) uploadFile(e.target.files[0]); });
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', e => {
    e.preventDefault(); dz.classList.remove('dragover');
    const f = e.dataTransfer.files[0];
    if (f) uploadFile(f);
  });
}

async function uploadFile(file) {
  state.file = file;
  hide($('uploadError'));
  hide($('dropzoneEmpty'));
  show($('dropzoneProgress'));
  $('progressFileName').textContent = file.name;
  $('progressFileSize').textContent = `${(file.size / 1024).toFixed(1)} KB`;
  $('uploadProgressFill').style.width = '30%';
  $('uploadStatus').textContent = 'Uploading…';
  $('uploadPercent').textContent = '30%';

  const fd = new FormData();
  fd.append('file', file);

  try {
    $('uploadProgressFill').style.width = '60%';
    $('uploadPercent').textContent = '60%';
    const r = await fetch(`${API}/upload`, { method: 'POST', body: fd });
    const data = await r.json();
    if (!r.ok) throw new Error(data.detail || 'Upload failed');

    $('uploadProgressFill').style.width = '100%';
    $('uploadPercent').textContent = '100%';
    $('uploadStatus').textContent = 'Processing…';

    state.jobId = data.job_id;
    state.inspection = data.inspection;

    show($('progressCheck'));
    await delay(500);
    goToPhase('analyzing');
    startAnalyzing(file.name);
  } catch (err) {
    $('uploadError').textContent = err.message;
    show($('uploadError'));
    hide($('dropzoneProgress'));
    show($('dropzoneEmpty'));
    $('uploadProgressFill').style.width = '0%';
  }
}

/* ── ANALYZING ────────────────────────────────────────────────────────── */
function startAnalyzing(filename) {
  $('analyzingFilename').textContent = filename;
  state.analyzingProgress = 0;
  state.activeStep = 0;
  renderAnalyzingSteps();
  animateAnalyzing();
}

function renderAnalyzingSteps() {
  const icons = { file: '📄', search: '🔍', chart: '📊', brain: '🧠', star: '⭐' };
  $('analyzingSteps').innerHTML = ANALYZE_STEPS.map((s, i) => {
    const cls = i < state.activeStep ? 'done' : i === state.activeStep ? 'active' : 'pending';
    return `<div class="analyzing-step glass ${cls}">
      <div class="analyzing-step-icon">${icons[s.icon]}</div>
      <div class="analyzing-step-label">${s.label}</div>
    </div>`;
  }).join('');
}

function animateAnalyzing() {
  const duration = 1500;
  const stepInterval = duration / ANALYZE_STEPS.length;
  const start = Date.now();

  function tick() {
    const elapsed = Date.now() - start;
    const pct = Math.min(100, (elapsed / duration) * 100);
    state.analyzingProgress = pct;
    const fill = $('analyzingProgressFill');
    if (fill) fill.style.width = `${pct}%`;
    const pctEl = $('analyzingPercent');
    if (pctEl) pctEl.textContent = `${Math.round(pct)}%`;
    state.activeStep = Math.min(ANALYZE_STEPS.length - 1, Math.floor(elapsed / stepInterval));
    renderAnalyzingSteps();

    if (elapsed < duration) {
      requestAnimationFrame(tick);
    } else {
      delay(200).then(() => {
        renderConfig();
        goToPhase('config');
        renderSessionSummary();
        sendChat('Hello! What can you help me with?', 'chatHistory', true);
      });
    }
  }
  requestAnimationFrame(tick);
}

/* ── CONFIG ──────────────────────────────────────────────────────────────── */
function renderConfig() {
  const insp = state.inspection;
  if (!insp) return;

  $('configSubtitle').textContent = insp.filename || 'dataset.csv';

  const kpis = insp.kpis || {};
  const rows = insp.rows || 0;
  const cols = insp.columns || 0;
  const totalMissing = Object.values(insp.missing_values || {}).reduce((a, b) => a + (b || 0), 0);
  const totalCells = rows * cols;

  const stats = [
    { label: 'Quality Score', value: kpis.data_quality_score ?? 100, suffix: '%', tone: 'emerald' },
    { label: 'Rows', value: rows.toLocaleString(), suffix: '', tone: 'indigo' },
    { label: 'Columns', value: cols.toLocaleString(), suffix: '', tone: 'violet' },
    { label: 'Cells', value: totalCells.toLocaleString(), suffix: '', tone: 'indigo' },
    { label: 'Missing', value: totalMissing.toLocaleString(), suffix: '', tone: 'rose' },
    { label: 'Duplicates', value: kpis.duplicate_pct ?? 0, suffix: '%', tone: 'amber' },
  ];

  const toneColors = {
    emerald: 'rgba(16,185,129,0.3)', indigo: 'rgba(99,102,241,0.3)',
    violet: 'rgba(139,92,246,0.3)', rose: 'rgba(244,63,94,0.3)', amber: 'rgba(245,158,11,0.3)',
  };
  const iconSvgs = {
    emerald: '<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#10b981" stroke-width="2"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>',
    indigo: '<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#6366f1" stroke-width="2"><path d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>',
    violet: '<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#8b5cf6" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>',
    rose: '<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#f43f5e" stroke-width="2"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>',
    amber: '<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#f59e0b" stroke-width="2"><path d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"/></svg>',
  };

  $('statsGrid').innerHTML = stats.map(s => `
    <div class="stat-card glass">
      <div class="stat-card-glow" style="background:${toneColors[s.tone]}"></div>
      <div class="stat-card-inner">
        <div class="stat-card-top">
          <span class="stat-card-label">${s.label}</span>
          ${iconSvgs[s.tone]}
        </div>
        <div class="stat-card-value">
          <span class="stat-card-number">${s.value}</span>
          ${s.suffix ? `<span class="stat-card-suffix">${s.suffix}</span>` : ''}
        </div>
      </div>
    </div>
  `).join('');

  const colNames = insp.column_names || [];
  const dtypes = insp.dtypes || {};
  const missing = insp.missing_values || {};
  const numCols = new Set(insp.numeric_columns || []);
  const catCols = new Set(insp.categorical_columns || []);
  const dtCols = new Set(insp.datetime_columns || []);
  const stats2 = insp.column_stats || {};
  const r = insp.rows || 1;

  $('colCountTag').textContent = `${colNames.length} detected`;
  const targetSugg = insp.suggested_target || kpis.suggested_target;

  const typeStyle = (col) => {
    if (numCols.has(col)) return 'numeric';
    if (catCols.has(col)) return 'categorical';
    if (dtCols.has(col)) return 'datetime';
    return 'other';
  };

  $('columnsTableBody').innerHTML = colNames.map(col => {
    const mis = missing[col] || 0;
    const misPct = r > 0 ? ((mis / r) * 100).toFixed(1) : 0;
    const uniqueVal = stats2[col]?.unique_count ?? '—';
    return `<tr>
      <td><span class="col-name">${col}</span>${col === targetSugg ? `<span class="ai-pick-badge">AI Pick</span>` : ''}</td>
      <td><span class="dtype-badge ${typeStyle(col)}">${dtypes[col] || 'unknown'}</span></td>
      <td>${mis > 0 ? `<span style="color:${misPct > 20 ? 'var(--red)' : misPct > 5 ? 'var(--amber)' : 'inherit'}">${mis} (${misPct}%)</span>` : '<span style="color:var(--text-3)">—</span>'}</td>
      <td>${uniqueVal}</td>
    </tr>`;
  }).join('');

  const sel = $('targetSelect');
  sel.innerHTML = '<option value="">Select column to predict…</option>';
  colNames.forEach(col => {
    const opt = document.createElement('option');
    opt.value = col; opt.textContent = col;
    sel.appendChild(opt);
  });

  if (targetSugg) {
    state.suggestedTarget = targetSugg;
    state.suggestedProblemType = insp.suggested_problem_type || 'auto';
    show($('aiSuggestionBox'));
    $('aiSuggestTarget').textContent = targetSugg;
    $('aiSuggestProblem').textContent = state.suggestedProblemType || 'auto';
  }

  const headers = insp.preview_headers || [];
  const previewRows = insp.preview_rows || [];
  $('previewTableHead').innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
  $('previewTableBody').innerHTML = previewRows.map(row =>
    `<tr>${row.map(val => `<td>${val === null ? '<span style="color:var(--text-3);font-style:italic">null</span>' : val}</td>`).join('')}</tr>`
  ).join('');

  const chartSelect = $('distColSelect');
  chartSelect.innerHTML = '';
  const charts = insp.charts || [];
  if (charts.length > 0) {
    charts.forEach(ch => {
      const opt = document.createElement('option');
      opt.value = ch.column; opt.textContent = ch.column;
      chartSelect.appendChild(opt);
    });
    const drawDist = colName => {
      const chData = charts.find(c => c.column === colName);
      if (!chData) return;
      if (state.distChart) { state.distChart.destroy(); state.distChart = null; }
      state.distChart = new SimpleBarChart($('distChart'), chData.labels, chData.values, chData.column);
    };
    chartSelect.onchange = e => drawDist(e.target.value);
    drawDist(charts[0].column);
  }

  renderSessionSummary();
}

function renderSessionSummary() {
  const insp = state.inspection;
  if (!insp) return;
  const kpis = insp.kpis || {};
  $('summaryRows').innerHTML = [
    ['File', insp.filename || '—'],
    ['Target', state.suggestedTarget || '—'],
    ['Type', state.suggestedProblemType || 'Auto'],
    ['Strategy', 'Smart Auto-Pick'],
    ['Rows / Cols', `${(insp.rows || 0).toLocaleString()} × ${(insp.columns || 0)}`],
  ].map(([k, v]) => `<div class="summary-row"><span class="summary-key">${k}</span><span class="summary-val">${v}</span></div>`).join('');
}

/* ── Training Config ────────────────────────────────────────────────────── */
$('problemToggles').addEventListener('click', e => {
  const btn = e.target.closest('.toggle-btn');
  if (!btn) return;
  $('problemToggles').querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
});

$('btnApplySuggest').addEventListener('click', () => {
  if (state.suggestedTarget) {
    $('targetSelect').value = state.suggestedTarget;
    hide($('aiSuggestionBox'));
    const problemType = state.suggestedProblemType;
    if (problemType) {
      $('problemToggles').querySelectorAll('.toggle-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.value === problemType);
      });
    }
  }
});

$('btnStartTraining').addEventListener('click', async () => {
  const target = $('targetSelect').value;
  if (!target) { showToast('Please select a target column first.'); return; }
  const activeProb = $('problemToggles').querySelector('.toggle-btn.active');
  const problemType = activeProb ? activeProb.dataset.value : null;
  const strategy = $('strategySelect').value;

  state.config = { target_column: target, problem_type: problemType || 'auto', model_selection: strategy };

  try {
    const r = await fetch(`${API}/train`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: state.jobId, target_column: target, problem_type: problemType || null, model_selection: strategy })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.detail || 'Unable to start training');
    state.jobId = data.job_id;
    goToPhase('training');
    startTraining(state.jobId);
  } catch (err) {
    /* API offline — simulation handles it */
  }
});

/* ── TRAINING ────────────────────────────────────────────────────────────── */
function startTraining(jobId) {
  const targetEl = $('trainingTarget');
  const typeEl = $('trainingType');
  if (targetEl) targetEl.textContent = state.config.target_column;
  if (typeEl) typeEl.textContent = state.config.problem_type || 'auto';
  state.trainingProgress = 0;
  state.trainingElapsed = 0;
  state.modelStates = MODEL_LIST.map(name => ({ name, status: 'queued' }));
  state.trainingLogs = [];
  const logEl = $('liveLog');
  if (logEl) logEl.innerHTML = '';

  renderModelFleet();
  addLog('info', `Job ${(jobId || 'demo').slice(0, 8)}… queued`);
  addLog('info', `Target: ${state.config.target_column} | Strategy: ${state.config.model_selection}`);

  state.trainingTimer = setInterval(() => {
    state.trainingElapsed++;
    const s = state.trainingElapsed;
    const elapsedEl = $('elapsedDisplay');
    if (elapsedEl) elapsedEl.textContent = s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
    if (s > 15) show($('trainingWarning'));
  }, 1000);

  state.backendLogCount = 0;
  pollTraining(jobId);
  state.pollTimer = setInterval(() => pollTraining(jobId), 2000);
}

async function pollTraining(jobId) {
  try {
    const r = await fetch(`${API}/status/${jobId}`);
    const data = await r.json();
    if (!r.ok) throw new Error(data.detail || 'Status unavailable');
    syncTrainingTelemetry(data);
    if (data.status === 'completed' || data.status === 'failed') {
      clearInterval(state.pollTimer);
      clearInterval(state.trainingTimer);
      if (data.status === 'completed') {
        addLog('success', 'Training complete!');
        updateTrainingRing(100);
        state.modelStates = state.modelStates.map(m => ({ ...m, status: m.status === 'failed' ? 'failed' : 'done' }));
        renderModelFleet();
        await delay(800);
        loadResults(jobId);
      } else {
        addLog('error', `Failed: ${data.message || 'Unknown error'}`);
        updateTrainingRing(0);
        state.modelStates = state.modelStates.map(m => ({ ...m, status: 'failed' }));
        renderModelFleet();
      }
    } else if (data.status === 'running') {
      addLog('info', 'Training in progress…');
      updateTrainingRing(data.progress?.percent || 0);
    } else if (data.status === 'queued') {
      addLog('info', 'Job queued, waiting for worker…');
    }
  } catch (err) {
    addLog('warning', `Status check: ${err.message}`);
  }
}

function syncTrainingTelemetry(data) {
  const progress = data.progress || {};
  if (typeof progress.percent === 'number') updateTrainingRing(progress.percent);
  if (progress.current_model) {
    state.modelStates = state.modelStates.map(m => m.name === progress.current_model ? { ...m, status: 'training' } : m);
  }
  (data.logs || []).slice(state.backendLogCount).forEach(entry => {
    const message = entry.message || '';
    const model = MODEL_LIST.find(name => message.startsWith(name));
    if (model && /completed\./i.test(message)) {
      state.modelStates = state.modelStates.map(m => m.name === model ? { ...m, status: 'done' } : m);
    } else if (model && /failed:/i.test(message)) {
      state.modelStates = state.modelStates.map(m => m.name === model ? { ...m, status: 'failed' } : m);
    }
    addLog(entry.level || 'info', message);
  });
  state.backendLogCount = (data.logs || []).length;
  renderModelFleet();
}

function simulateModelTraining() {
  const totalDuration = 10000 + Math.random() * 6000;
  const modelInterval = totalDuration / MODEL_LIST.length;

  MODEL_LIST.forEach((name, i) => {
    const startAt = i * modelInterval * (0.5 + Math.random() * 0.5);
    const duration = modelInterval * (0.6 + Math.random() * 0.8);

    setTimeout(() => {
      state.modelStates[i].status = 'training';
      renderModelFleet();
      addLog('info', `Training ${name}…`);
    }, startAt);

    setTimeout(() => {
      state.modelStates[i].status = Math.random() > 0.08 ? 'done' : 'failed';
      renderModelFleet();
      const completed = state.modelStates.filter(m => m.status === 'done' || m.status === 'failed').length;
      const pct = Math.round((completed / MODEL_LIST.length) * 100);
      updateTrainingRing(pct);
      addLog(state.modelStates[i].status === 'done' ? 'success' : 'error',
        `${name} ${state.modelStates[i].status === 'done' ? '✓ completed' : '✗ failed'}`);

      if (completed === MODEL_LIST.length) {
        addLog('info', 'All models complete. Ranking results…');
        setTimeout(() => { loadResults(state.jobId); }, 800);
      }
    }, startAt + duration);
  });
}

function renderModelFleet() {
  $('modelFleet').innerHTML = state.modelStates.map(m => {
    const statusMap = { queued: 'Queued', training: 'Training…', done: 'Complete', failed: 'Failed' };
    return `<div class="model-card ${m.status}">
      <div class="model-card-name">${m.name}</div>
      <div class="model-card-status">${statusMap[m.status] || m.status}</div>
    </div>`;
  }).join('');
  $('trainingModelCount').textContent = `${state.modelStates.filter(m => m.status === 'done' || m.status === 'failed').length} / ${MODEL_LIST.length} models complete`;
}

function updateTrainingRing(pct) {
  const circumference = 452.39;
  const offset = circumference - (pct / 100) * circumference;
  $('ringFill').style.strokeDashoffset = offset;
  $('ringPercent').textContent = `${Math.round(pct)}%`;
}

function addLog(type, msg) {
  state.trainingLogs.push({ type, msg });
  const log = $('liveLog');
  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  const div = document.createElement('div');
  div.className = `log-entry ${type}`;
  div.innerHTML = `<span class="log-time">${time}</span><span class="log-msg">${msg}</span>`;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

/* ── RESULTS ─────────────────────────────────────────────────────────────── */
async function loadResults(jobId) {
  let data;
  try {
    const r = await fetch(`${API}/results/${jobId}`);
    if (r.ok) { data = await r.json(); }
  } catch (e) { /* fall through */ }

  if (!data) {
    addLog('warning', 'Backend results not ready, using local mock.');
    data = generateMockResults();
  }

  state.results = data;
  renderResults(data);
  goToPhase('results');
  sendChat(`Training is complete! Tell me about ${data.best_model?.name || 'the best model'} and what it means.`, 'chatHistory', false);
}

function renderResults(data) {
  const best = data.best_model;
  const results = data.results || [];
  const problemType = data.problem_type || state.config?.problem_type || 'classification';
  const metrics = best?.metrics || {};

  $('resultsSubtitle').textContent = `${data.successful || results.filter(r => r.status !== 'failed').length}/${data.total_models || results.length} models trained successfully`;

  $('bestModelName').textContent = best?.name || '—';
  $('bestModelMeta').textContent = `${problemType.charAt(0).toUpperCase() + problemType.slice(1)} · ${data.filename || state.file?.name || 'dataset'}`;

  const primaryKeys = problemType === 'classification'
    ? ['accuracy', 'f1_score', 'precision', 'recall', 'roc_auc']
    : ['r2_score', 'rmse', 'mae', 'mse'];

  $('bestMetrics').innerHTML = primaryKeys
    .filter(k => metrics[k] !== undefined)
    .map(k => `<div class="metric-chip">
      <div class="metric-chip-val">${typeof metrics[k] === 'number' ? metrics[k].toFixed(4) : metrics[k]}</div>
      <div class="metric-chip-key">${k.replace(/_/g, ' ').toUpperCase()}</div>
    </div>`).join('');

  const leaderboard = results.filter(r => r.status !== 'failed').sort((a, b) => {
    const mk = problemType === 'classification' ? 'accuracy' : 'r2_score';
    return (b.metrics?.[mk] || 0) - (a.metrics?.[mk] || 0);
  });
  $('leaderboardCount').textContent = `${leaderboard.length} models`;
  const primaryMetric = problemType === 'classification' ? 'accuracy' : 'r2_score';
  const maxVal = Math.max(...leaderboard.map(r => r.metrics?.[primaryMetric] || 0), 0.001);

  $('leaderboardList').innerHTML = leaderboard.map((r, i) => {
    const val = r.metrics?.[primaryMetric] || 0;
    const pct = (val / maxVal) * 100;
    const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : 'normal';
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1;
    return `<div class="lb-item">
      <span class="lb-rank ${rankClass}">${medal}</span>
      <span class="lb-name">${r.model_name}</span>
      <div class="lb-bar-wrap"><div class="lb-bar ${i === 0 ? 'gold-bar' : 'default-bar'}" style="width:${pct}%"></div></div>
      <span class="lb-metric">${val.toFixed(4)}</span>
      <button class="lb-export-btn" onclick="exportModel('${r.model_name}')" title="Export">↓</button>
    </div>`;
  }).join('');

  renderChart(leaderboard, problemType);

  const resChartSelect = $('resultsDistColSelect');
  resChartSelect.innerHTML = '';
  const charts = state.inspection?.charts || [];
  if (charts.length > 0) {
    charts.forEach(ch => {
      const opt = document.createElement('option');
      opt.value = ch.column; opt.textContent = ch.column;
      resChartSelect.appendChild(opt);
    });
    const drawResDist = colName => {
      const chData = charts.find(c => c.column === colName);
      if (!chData) return;
      if (state.resultsDistChart) { state.resultsDistChart.destroy(); state.resultsDistChart = null; }
      state.resultsDistChart = new SimpleBarChart($('resultsDistChart'), chData.labels, chData.values, chData.column);
    };
    resChartSelect.onchange = e => drawResDist(e.target.value);
    drawResDist(charts[0].column);
  }

  $('btnExport').onclick = () => exportModel(null);
  $('btnExportHero').onclick = () => exportModel(null);
}

function renderChart(results, problemType) {
  const metricKeys = problemType === 'classification'
    ? ['accuracy', 'f1_score', 'precision', 'recall', 'roc_auc']
    : ['r2_score', 'rmse', 'mae', 'mse'];

  const available = metricKeys.filter(k => results.some(r => r.metrics?.[k] !== undefined));
  if (!available.length) return;
  state.selectedMetric = available[0];

  $('chartToggles').innerHTML = available.map(k =>
    `<button class="chart-btn ${k === state.selectedMetric ? 'active' : ''}" data-metric="${k}">${k.replace(/_/g, ' ')}</button>`
  ).join('');

  $('chartToggles').querySelectorAll('.chart-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.selectedMetric = btn.dataset.metric;
      $('chartToggles').querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      drawMetricsChart(results, state.selectedMetric);
    });
  });

  drawMetricsChart(results, state.selectedMetric);
}

function drawMetricsChart(results, metric) {
  if (state.chart) { state.chart.destroy(); state.chart = null; }
  const completed = results.filter(r => r.metrics?.[metric] !== undefined);
  const labels = completed.map(r => r.model_name);
  const values = completed.map(r => r.metrics[metric]);
  state.chart = new SimpleBarChart($('metricsChart'), labels, values, metric);
}

/* ── Export ──────────────────────────────────────────────────────────────── */
async function exportModel(modelName) {
  if (!state.jobId) return;
  try {
    const r = await fetch(`${API}/export`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: state.jobId, model_name: modelName })
    });
    if (!r.ok) {
      const err = await r.json();
      throw new Error(err.detail || 'Export failed');
    }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smartml_export_${modelName ? modelName.replace(/ /g, '_').toLowerCase() : 'best'}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    showToast(`Export error: ${err.message}`);
  }
}

/* ── AI Chat ────────────────────────────────────────────────────────────── */
function setupChat() {
  const input = $('chatInput');
  const send = () => {
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';
    sendChat(msg, 'chatHistory', false);
  };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
  $('chatSendBtn').addEventListener('click', send);
}

async function sendChat(message, historyKey, isInitial) {
  if (isInitial && state.chatHistory.length > 0) return;
  if (!state.jobId || !message.trim()) return;

  addChatMessage('user', message);
  const history = state[historyKey];
  history.push({ role: 'user', content: message });

  if (isInitial) {
    const insp = state.inspection;
    if (!insp) return;
    const rows = insp.rows || '?';
    const cols = insp.columns || '?';
    const colList = (insp.column_names || []).slice(0, 5).join(', ');
    const suggested = state.suggestedTarget;
    let reply = `👋 Hi! I'm your SmartML Assistant.\n\nI can see you've uploaded a dataset with **${rows} rows** and **${cols} columns**.\n\nYour columns include: \`${colList}\`${(insp.column_names || []).length > 5 ? '…' : ''}\n\n`;
    if (suggested) {
      reply += `🎯 Based on my analysis, I recommend using **\`${suggested}\`** as the target column. You can apply this suggestion below.`;
    } else {
      reply += `**Tip:** Select a target column to predict and configure your training settings on the right. Ask me anything about your data!`;
    }
    addChatMessage('assistant', reply);
    history.push({ role: 'assistant', content: reply });
    return;
  }

  addChatMessage('assistant typing', '…');
  try {
    const r = await fetch(`${API}/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: state.jobId, message, history })
    });
    if (!r.ok) throw new Error('API error');
    const data = await r.json();
    removeTyping();
    const reply = data.reply || "I couldn't process that. Try again!";
    addChatMessage('assistant', reply);
    history.push({ role: 'assistant', content: reply });

    if (data.suggested_target && historyKey === 'chatHistory') {
      state.suggestedTarget = data.suggested_target;
      state.suggestedProblemType = data.suggested_problem_type;
      show($('aiSuggestionBox'));
      $('aiSuggestTarget').textContent = data.suggested_target;
      $('aiSuggestProblem').textContent = data.suggested_problem_type || 'auto';
    }
  } catch {
    removeTyping();
    // Fallback response
    const insp = state.inspection;
    const results = state.results;
    let reply;
    if (results) {
      const best = results.best_model;
      reply = `🏆 **${best?.name || 'the champion'}** is your best model with ${best?.metrics ? Object.entries(best.metrics).slice(0, 3).map(([k, v]) => `${k}: ${typeof v === 'number' ? v.toFixed(4) : v}`).join(', ') : 'great metrics'}. You can export it using the download button.`;
    } else if (insp) {
      reply = `Your dataset has **${insp.rows} rows** and **${insp.columns} columns**. Try selecting a target column and starting training!`;
    } else {
      reply = "I'm here to help! Upload a dataset to get started.";
    }
    addChatMessage('assistant', reply);
    history.push({ role: 'assistant', content: reply });
  }
}

function addChatMessage(role, text) {
  const container = $('chatMessages');
  const div = document.createElement('div');
  div.className = `chat-bubble ${role}`;
  if (role === 'typing') {
    div.innerHTML = `<div class="chat-avatar"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></div><div class="chat-text"><span class="typing-dots">…</span></div>`;
  } else if (role === 'user') {
    div.innerHTML = `<div class="chat-text">${formatChatText(text)}</div><div class="chat-avatar"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`;
  } else {
    div.innerHTML = `<div class="chat-avatar"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></div><div class="chat-text">${formatChatText(text)}</div>`;
  }
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function removeTyping() {
  const container = $('chatMessages');
  const typing = container.querySelector('.chat-bubble.typing');
  if (typing) typing.remove();
}

function formatChatText(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

/* ── SimpleBarChart ─────────────────────────────────────────────────────── */
class SimpleBarChart {
  constructor(canvas, labels, values, metric) {
    this.canvas = canvas;
    this.labels = labels;
    this.values = values;
    this.metric = metric;
    this.animReq = null;
    this.draw(1);
    this.animate();
  }
  animate() {
    this.animPct = 0;
    const step = () => {
      this.animPct = Math.min(1, this.animPct + 0.04);
      this.draw(this.animPct);
      if (this.animPct < 1) this.animReq = requestAnimationFrame(step);
    };
    this.animReq = requestAnimationFrame(step);
  }
  destroy() { if (this.animReq) cancelAnimationFrame(this.animReq); }
  draw(pct) {
    const canvas = this.canvas;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    const W = rect.width || 400;
    const H = 220;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const n = this.values.length;
    if (!n) return;

    const padL = 8, padR = 8, padT = 16, padB = 48;
    const maxV = Math.max(...this.values.map(Math.abs)) || 1;
    const barW = Math.max(8, Math.min(40, (W - padL - padR) / n - 6));
    const chartH = H - padT - padB;

    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padT + (chartH / 4) * i;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    }

    const bestVal = Math.max(...this.values);
    this.values.forEach((v, i) => {
      const x = padL + (i / n) * (W - padL - padR) + (W - padL - padR) / n / 2 - barW / 2;
      const barH = (v / maxV) * chartH * pct;
      const y = padT + chartH - barH;
      const grad = ctx.createLinearGradient(0, y, 0, y + barH);
      if (v === bestVal) {
        grad.addColorStop(0, '#818cf8'); grad.addColorStop(1, '#6366f1');
      } else {
        grad.addColorStop(0, 'rgba(99,102,241,0.6)'); grad.addColorStop(1, 'rgba(99,102,241,0.3)');
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      const r = Math.min(4, barW / 2);
      ctx.roundRect(x, y, barW, barH, [r, r, 0, 0]);
      ctx.fill();
      if (pct > 0.8) {
        ctx.fillStyle = v === bestVal ? '#818cf8' : 'rgba(161,161,170,0.8)';
        ctx.font = `600 ${Math.min(11, barW)}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(typeof v === 'number' ? v.toFixed(3) : v, x + barW / 2, y - 4);
      }
      ctx.fillStyle = 'rgba(113,113,122,0.9)';
      ctx.font = `500 ${Math.min(10, barW - 2)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      const lbl = this.labels[i].length > 10 ? this.labels[i].slice(0, 9) + '…' : this.labels[i];
      ctx.save();
      ctx.translate(x + barW / 2, H - padB + 14);
      ctx.rotate(-0.4);
      ctx.fillText(lbl, 0, 0);
      ctx.restore();
    });
  }
}

/* ── Session Reset ──────────────────────────────────────────────────────── */
function resetSession() {
  clearInterval(state.pollTimer);
  clearInterval(state.trainingTimer);
  if (state.chart) { state.chart.destroy(); state.chart = null; }
  if (state.distChart) { state.distChart.destroy(); state.distChart = null; }
  if (state.resultsDistChart) { state.resultsDistChart.destroy(); state.resultsDistChart = null; }

  state.jobId = null;
  state.file = null;
  state.inspection = null;
  state.config = null;
  state.results = null;
  state.chatHistory = [];
  state.modelStates = [];
  state.trainingLogs = [];
  state.suggestedTarget = null;
  state.suggestedProblemType = null;

  $('fileInput').value = '';
  $('chatMessages').innerHTML = '<div class="chat-bubble assistant"><div class="chat-avatar"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></div><div class="chat-text">👋 Hi! Upload a dataset to get started. I\'ll help you pick a target, understand your data, and explain results.</div></div>';
  $('liveLog').innerHTML = '';
  $('modelFleet').innerHTML = '';
  $('leaderboardList').innerHTML = '';
  $('bestMetrics').innerHTML = '';

  hide($('dropzoneProgress'));
  hide($('uploadError'));
  hide($('aiSuggestionBox'));
  hide($('trainingWarning'));
  hide($('progressCheck'));
  show($('dropzoneEmpty'));
  $('uploadProgressFill').style.width = '0%';
  $('btnStartTraining').disabled = false;
  $('btnStartTraining').innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 15V3m0 12l-4-4m4 4l4-4M2 17l.621 2.485A2 2 0 004.561 21h14.878a2 2 0 001.94-1.515L22 17"/></svg> Start Training';

  updateTrainingRing(0);
  state.trainingProgress = 0;
  goToPhase('upload');
}

/* ── Toast ────────────────────────────────────────────────────────────────── */
function showToast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const div = document.createElement('div');
  div.className = 'toast';
  div.innerHTML = msg;
  Object.assign(div.style, {
    position: 'fixed', bottom: '24px', right: '24px', zIndex: '9999',
    padding: '12px 20px', borderRadius: '12px',
    background: 'rgba(30,41,59,0.95)', backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.1)', color: '#f4f4f5',
    fontSize: '14px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    animation: 'fadeIn 0.3s ease-out', maxWidth: '360px'
  });
  document.body.appendChild(div);
  setTimeout(() => { div.style.opacity = '0'; div.style.transition = 'opacity 0.3s'; setTimeout(() => div.remove(), 300); }, 3000);
}

/* ── Mock Data Generator (Fallback) ──────────────────────────────────────── */
function generateMockResults() {
  const models = MODEL_LIST;
  const problemType = state.config?.problem_type || 'classification';
  const metricKeys = problemType === 'classification'
    ? ['accuracy', 'f1_score', 'precision', 'recall', 'roc_auc']
    : ['r2_score', 'rmse', 'mae', 'mse'];

  const results = models.map(name => {
    const metrics = {};
    metricKeys.forEach(k => {
      if (k === 'rmse' || k === 'mae' || k === 'mse') {
        metrics[k] = Math.random() * 2 + 0.1;
      } else {
        metrics[k] = 0.6 + Math.random() * 0.35;
      }
    });
    return { model_name: name, metrics, training_time: Math.random() * 30 + 5, total_time: Math.random() * 30 + 5, status: Math.random() > 0.1 ? 'completed' : 'completed' };
  });

  const sorted = [...results].sort((a, b) => {
    const mk = problemType === 'classification' ? 'accuracy' : 'r2_score';
    return (b.metrics[mk] || 0) - (a.metrics[mk] || 0);
  });

  return {
    job_id: state.jobId || 'mock',
    filename: state.file?.name || 'dataset.csv',
    problem_type: problemType,
    target_column: state.config?.target_column || 'target',
    best_model: sorted[0],
    results: sorted,
    total_models: sorted.length,
    successful: sorted.filter(r => r.status === 'completed').length,
    failed: sorted.filter(r => r.status === 'failed').length
  };
}

/* ── Init SVG defs ──────────────────────────────────────────────────────── */
function initSvgs() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.style.position = 'absolute'; svg.style.width = '0'; svg.style.height = '0';
  svg.innerHTML = `<defs>
    <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#8b5cf6"/>
    </linearGradient>
  </defs>`;
  document.body.prepend(svg);
}

/* ── Init ────────────────────────────────────────────────────────────────── */
function init() {
  initSvgs();
  setupUpload();
  setupChat();
  checkHealth();
  setInterval(checkHealth, 30000);
  renderPhaseIndicator();

  $('btnNewSession').addEventListener('click', resetSession);

  // Add spin animation for loading state
  const style = document.createElement('style');
  style.textContent = `
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .typing-dots { animation: blink 1.2s infinite; }
    @keyframes blink { 0%,100% { opacity: 0.3; } 50% { opacity: 1; } }
    .toast { animation: slideUp 0.3s ease-out; }
    @keyframes slideUp { from { opacity:0; transform: translateY(20px); } to { opacity:1; transform: translateY(0); } }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
  `;
  document.head.appendChild(style);
}

document.addEventListener('DOMContentLoaded', init);

function delay(ms) { return new Promise(res => setTimeout(res, ms)); }
