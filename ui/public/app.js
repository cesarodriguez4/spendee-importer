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
  const out = {};
  document.querySelectorAll('[data-option]').forEach((el) => {
    out[el.dataset.option] = el.value;
  });
  return out;
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
  setStatus('Procesando…');
  const fd = new FormData();
  fd.append('file', state.file);
  fd.append('source', state.source.id);
  fd.append('options', JSON.stringify(collectOptions()));
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
  const hasExtras = rows.some((r) => r.payee !== undefined || r.currency !== undefined);
  const thead = $('#preview thead tr');
  thead.innerHTML = '<th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Tags</th><th>Gasto</th><th>Ingreso</th>'
    + (hasExtras ? '<th>Payee</th><th>Currency</th>' : '');
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
    if (hasExtras) {
      tr.appendChild(td(row.payee ?? ''));
      tr.appendChild(td(row.currency ?? ''));
    }
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
    body: JSON.stringify({ rows, fileName }),
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

init();
