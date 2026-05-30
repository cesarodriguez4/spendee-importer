const $ = (sel) => document.querySelector(sel);
const state = {
  sources: [],
  source: null,
  file: null,
  rows: [],
};

async function init() {
  state.sources = await fetch('/api/sources').then((r) => r.json());
  const select = $('#source');
  state.sources.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.label;
    select.appendChild(opt);
  });
  select.addEventListener('change', onSourceChange);
  onSourceChange();

  setupDropzone();
  $('#process').addEventListener('click', onProcess);
  $('#download').addEventListener('click', onDownload);
  setupBatch();
}

function currentFormat() {
  return $('#format').value;
}

function currentSource() {
  return state.sources.find((s) => s.id === $('#source').value);
}

function onSourceChange() {
  const src = currentSource();
  state.source = src;
  $('#file').setAttribute('accept', src.accept);
  renderOptions(src.options);
}

function renderOptions(options) {
  const container = $('#options');
  container.innerHTML = '';
  options.forEach((opt) => {
    const label = document.createElement('label');
    label.textContent = opt.label;
    let input;
    if (opt.type === 'select') {
      input = document.createElement('select');
      opt.choices.forEach((c) => {
        const o = document.createElement('option');
        o.value = c.value; o.textContent = c.label;
        input.appendChild(o);
      });
    } else {
      input = document.createElement('input');
      input.type = opt.type;
      if (opt.default !== undefined) input.value = opt.default;
    }
    input.name = opt.name;
    input.dataset.option = opt.name;
    label.appendChild(input);
    container.appendChild(label);
  });
}

function collectOptions() {
  return collectOptionsFrom($('#options'));
}

function missingExchangeRate(source, options) {
  if (source !== 'banescoVE') return false;
  const rate = Number(options.exchangeRate);
  return !Number.isFinite(rate) || rate <= 0;
}

function setupDropzone() {
  const dz = $('#dropzone');
  const input = $('#file');
  dz.addEventListener('click', () => input.click());
  input.addEventListener('change', () => setFile(input.files[0]));
  ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => {
    e.preventDefault(); dz.classList.add('drag');
  }));
  ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => {
    e.preventDefault(); dz.classList.remove('drag');
  }));
  dz.addEventListener('drop', (e) => {
    if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
  });
}

function setFile(file) {
  state.file = file;
  $('#file-name').textContent = file ? file.name : 'Ningún archivo seleccionado';
}

function setStatus(msg, isError = false) {
  const el = $('#status');
  el.textContent = msg;
  el.classList.toggle('error', isError);
}

async function onProcess() {
  if (!state.file) return setStatus('Selecciona un archivo primero.', true);
  const options = collectOptions();
  if (missingExchangeRate(state.source.id, options)) {
    return setStatus('Ingresa la tasa de cambio (Bs/USD) para Banesco Venezuela.', true);
  }
  setStatus('Procesando…');
  const fd = new FormData();
  fd.append('file', state.file);
  fd.append('source', state.source.id);
  fd.append('options', JSON.stringify(options));
  try {
    const res = await fetch('/api/preview', { method: 'POST', body: fd });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Error procesando');
    state.rows = body.rows;
    renderPreview(body.rows);
    setStatus(`${body.rows.length} filas listas.`);
  } catch (err) {
    setStatus(err.message, true);
  }
}

function renderPreview(rows) {
  $('#preview-section').classList.remove('hidden');
  $('#row-count').textContent = `(${rows.length})`;
  $('#output-name').value = `${state.source.id}_report.xlsx`;
  const thead = $('#preview thead tr');
  thead.innerHTML = '<th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Tags</th><th>Gasto</th><th>Ingreso</th>'
    + '<th>Payee</th><th>Currency</th>';
  const tbody = $('#preview tbody');
  tbody.innerHTML = '';
  rows.forEach((row, idx) => {
    const tr = document.createElement('tr');
    tr.appendChild(td(row.date));
    tr.appendChild(td(row.name));
    tr.appendChild(editableTd(row.category ?? '', (v) => { state.rows[idx].category = v; }));
    tr.appendChild(editableTd(row.tags ?? '', (v) => { state.rows[idx].tags = v; }));
    tr.appendChild(amountTd(row.expense, 'expense'));
    tr.appendChild(amountTd(row.income, 'income'));
    tr.appendChild(editableTd(row.payee ?? '', (v) => { state.rows[idx].payee = v; }));
    tr.appendChild(editableTd(row.currency ?? '', (v) => { state.rows[idx].currency = v; }));
    tbody.appendChild(tr);
  });
}

function td(text) {
  const el = document.createElement('td');
  el.textContent = text ?? '';
  return el;
}

function editableTd(value, onChange) {
  const el = document.createElement('td');
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value;
  input.addEventListener('input', () => onChange(input.value));
  el.appendChild(input);
  return el;
}

function amountTd(value, kind) {
  const el = document.createElement('td');
  el.className = `amount ${kind}`;
  if (value !== null && value !== undefined && value !== '') {
    el.textContent = Number(value).toFixed(2);
  }
  return el;
}

async function onDownload() {
  const baseName = $('#output-name').value.trim() || `${state.source.id}_report.xlsx`;
  const CHUNK_SIZE = 900;
  const chunks = state.rows.length > CHUNK_SIZE ? chunkRows(state.rows, CHUNK_SIZE) : [state.rows];
  try {
    for (let i = 0; i < chunks.length; i++) {
      const fileName = chunks.length === 1 ? baseName : suffixFileName(baseName, `_part${i + 1}of${chunks.length}`);
      setStatus(`Descargando ${i + 1}/${chunks.length}…`);
      await downloadChunk(chunks[i], fileName);
    }
    setStatus(chunks.length > 1 ? `Listo: ${chunks.length} archivos (chunks de ${CHUNK_SIZE}).` : 'Listo.');
  } catch (err) {
    setStatus(err.message, true);
  }
}

function chunkRows(rows, size) {
  const out = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

function suffixFileName(name, suffix) {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? name + suffix : name.slice(0, dot) + suffix + name.slice(dot);
}

async function downloadChunk(rows, fileName) {
  const res = await fetch('/api/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows, fileName, format: currentFormat() }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Error generando XLSX');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
// ---------- Import masivo ----------

let batchSeq = 0;

function setupBatch() {
  $('#batch-add').addEventListener('click', () => addBatchRow());
  $('#batch-run').addEventListener('click', onBatchRun);
  addBatchRow();
}

function addBatchRow() {
  const id = `batch-${++batchSeq}`;
  const wrap = document.createElement('div');
  wrap.className = 'batch-item';
  wrap.dataset.id = id;

  const select = document.createElement('select');
  select.className = 'batch-source';
  state.sources.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.label;
    select.appendChild(opt);
  });

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.className = 'batch-file';

  const options = document.createElement('div');
  options.className = 'batch-options';

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'secondary';
  remove.textContent = 'Quitar';
  remove.addEventListener('click', () => wrap.remove());

  const syncSource = () => {
    const src = state.sources.find((s) => s.id === select.value);
    fileInput.setAttribute('accept', src.accept);
    renderOptionsInto(options, src.options);
  };
  select.addEventListener('change', syncSource);

  wrap.appendChild(select);
  wrap.appendChild(fileInput);
  wrap.appendChild(options);
  wrap.appendChild(remove);
  $('#batch-list').appendChild(wrap);
  syncSource();
}

function renderOptionsInto(container, options) {
  container.innerHTML = '';
  options.forEach((opt) => {
    const label = document.createElement('label');
    label.textContent = opt.label;
    let input;
    if (opt.type === 'select') {
      input = document.createElement('select');
      opt.choices.forEach((c) => {
        const o = document.createElement('option');
        o.value = c.value; o.textContent = c.label;
        input.appendChild(o);
      });
    } else {
      input = document.createElement('input');
      input.type = opt.type;
      if (opt.default !== undefined) input.value = opt.default;
    }
    input.dataset.option = opt.name;
    label.appendChild(input);
    container.appendChild(label);
  });
}

function setBatchStatus(msg, isError = false) {
  const el = $('#batch-status');
  el.textContent = msg;
  el.classList.toggle('error', isError);
}

async function onBatchRun() {
  const items = Array.from(document.querySelectorAll('.batch-item'));
  const jobs = items
    .map((wrap) => ({
      source: wrap.querySelector('.batch-source').value,
      file: wrap.querySelector('.batch-file').files[0],
      options: collectOptionsFrom(wrap.querySelector('.batch-options')),
    }))
    .filter((j) => j.file);

  if (jobs.length === 0) return setBatchStatus('Agrega al menos un banco con archivo.', true);

  const missingRate = jobs.find((j) => missingExchangeRate(j.source, j.options));
  if (missingRate) {
    return setBatchStatus('Ingresa la tasa de cambio (Bs/USD) para Banesco Venezuela.', true);
  }

  const format = $('#batch-format').value;
  let done = 0;
  try {
    for (const job of jobs) {
      setBatchStatus(`Procesando ${job.source} (${done + 1}/${jobs.length})…`);
      const rows = await previewJob(job);
      await downloadChunk(rows, `${job.source}_report.xlsx`, format);
      done += 1;
    }
    setBatchStatus(`Listo: ${done} archivo(s) descargado(s).`);
  } catch (err) {
    setBatchStatus(err.message, true);
  }
}

function collectOptionsFrom(container) {
  const out = {};
  container.querySelectorAll('[data-option]').forEach((el) => {
    out[el.dataset.option] = el.value;
  });
  return out;
}

async function previewJob(job) {
  const fd = new FormData();
  fd.append('file', job.file);
  fd.append('source', job.source);
  fd.append('options', JSON.stringify(job.options));
  const res = await fetch('/api/preview', { method: 'POST', body: fd });
  const body = await res.json();
  if (!res.ok) throw new Error(`${job.source}: ${body.error || 'Error procesando'}`);
  return body.rows;
}
init();
