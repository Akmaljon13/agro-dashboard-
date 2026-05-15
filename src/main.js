import * as d3 from 'd3';
import {
  renderBarChart, renderBonitetChart, renderScatterPlot,
  renderHeatmap, renderHorizBar, updateEkinShare, VH_COLORS,
} from './charts.js';

// ────────────────────────────────
// Constants
// ────────────────────────────────
const ROMAN = { 1:'I', 2:'II', 3:'III', 4:'IV', 5:'V', 6:'VI', 7:'VII', 8:'VIII', 9:'IX' };
const ROMAN_TO_NUM = Object.fromEntries(Object.entries(ROMAN).map(([k, v]) => [v, +k]));
const VH_ORDER = ["Juda yaxshi", "Yaxshi", "O'rta", "Qoniqarli", "Past", "Yomon"];

// ────────────────────────────────
// App State
// ────────────────────────────────
const app = {
  allData: [],
  bonitetRange: [0, 100],
  sizotRange: [0, 10],
  filters: {
    tumanlar:     new Set(),
    ekinTurlari:  new Set(),
    vhlar:        new Set(),
    gidromodullar: new Set(),
    bonitet:   [0, 100],
    sizotSuvi: [0, 10],
  },
  table: { page: 1, perPage: 10, sortCol: 'area_ha', sortDir: 'desc' },
};

// ────────────────────────────────
// Bootstrap
// ────────────────────────────────
(async function init() {
  try {
    const raw = await fetch('/data.json').then(r => r.json());

    app.allData = raw.map(r => ({
      tuman:      r.tuman || "Noma'lum",
      Turi:       ["Bug'doy", "Paxta"].includes(r.Turi) ? r.Turi : "Paxta",
      VH:         r.VH || "Yaxshi",
      Meyor:      +r.Meyor || 0,
      evopo:      +r.evopo || 0,
      Foiz:       +r.Foiz  || 0,
      area_ha:    +r.area_ha || 0,
      gidromodul: ROMAN_TO_NUM[r.GMR] || +r.gidromodul || 0,
      sizotSuvi:  +r.SS || 0,
      bonitet:    +r.bonitet || 0,
    }));

    const bExt = d3.extent(app.allData, d => d.bonitet);
    const sExt = d3.extent(app.allData, d => d.sizotSuvi);
    app.bonitetRange = [Math.floor(bExt[0] ?? 0), Math.ceil(bExt[1] ?? 100)];
    app.sizotRange   = [Math.round((sExt[0] ?? 0) * 10) / 10, Math.round((sExt[1] ?? 10) * 10) / 10];
    app.filters.bonitet   = [...app.bonitetRange];
    app.filters.sizotSuvi = [...app.sizotRange];

    document.getElementById('loading').style.display = 'none';
    initSidebarToggle();
    buildSidebar();
    render();
  } catch (err) {
    document.getElementById('loading').innerHTML = `
      <div class="text-center p-8">
        <div class="text-5xl mb-4">⚠️</div>
        <p class="text-red-500 font-semibold text-sm">Ma'lumot yuklashda xatolik</p>
        <p class="text-slate-400 text-xs mt-2">public/data.json fayli topilmadi yoki noto'g'ri</p>
        <p class="text-red-400 text-xs mt-3 font-mono">${err.message}</p>
      </div>`;
  }
})();

// ────────────────────────────────
// Sidebar Toggle (mobile)
// ────────────────────────────────
function initSidebarToggle() {
  const aside   = document.getElementById('sidebar-aside');
  const overlay = document.getElementById('sidebar-overlay');

  function open() {
    aside.classList.remove('-translate-x-full');
    aside.classList.add('translate-x-0');
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
  function close() {
    aside.classList.add('-translate-x-full');
    aside.classList.remove('translate-x-0');
    overlay.classList.add('hidden');
    document.body.style.overflow = '';
  }

  document.getElementById('menu-btn')?.addEventListener('click', open);
  document.getElementById('sidebar-close')?.addEventListener('click', close);
  overlay.addEventListener('click', close);

  // Re-render charts on window resize
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (app.allData.length) render();
    }, 200);
  });
}

// ────────────────────────────────
// Filter
// ────────────────────────────────
function getFiltered() {
  const { tumanlar, ekinTurlari, vhlar, gidromodullar, bonitet, sizotSuvi } = app.filters;
  return app.allData.filter(d => {
    if (tumanlar.size     && !tumanlar.has(d.tuman))           return false;
    if (ekinTurlari.size  && !ekinTurlari.has(d.Turi))         return false;
    if (vhlar.size        && !vhlar.has(d.VH))                 return false;
    if (gidromodullar.size && !gidromodullar.has(d.gidromodul)) return false;
    if (d.bonitet   < bonitet[0]   || d.bonitet   > bonitet[1])   return false;
    if (d.sizotSuvi < sizotSuvi[0] || d.sizotSuvi > sizotSuvi[1]) return false;
    return true;
  });
}

// ────────────────────────────────
// Render
// ────────────────────────────────
function render() {
  const data = getFiltered();

  document.getElementById('record-count').textContent =
    `${data.length.toLocaleString()} ta maydon`;

  renderKPIs(data);

  updateEkinShare(data);
  renderBarChart(data, document.getElementById('bar-chart'), (tuman, turi) => {
    // Ustun bosilganda: o'sha tuman + ekin turiga filter
    app.filters.tumanlar.clear();    app.filters.tumanlar.add(tuman);
    app.filters.ekinTurlari.clear(); app.filters.ekinTurlari.add(turi);
    buildSidebar();
    render();
  });
  renderBonitetChart(data, document.getElementById('bonitet-chart'), app.filters.bonitet);
  renderScatterPlot(data, document.getElementById('scatter-chart'), (tuman, turi) => {
    // Nuqta bosilganda: o'sha tumanga filter
    app.filters.tumanlar.clear();    app.filters.tumanlar.add(tuman);
    app.filters.ekinTurlari.clear(); app.filters.ekinTurlari.add(turi);
    buildSidebar();
    render();
  });
  renderHeatmap(data,  document.getElementById('heatmap-chart'));
  renderHorizBar(data, document.getElementById('horiz-chart'));

  app.table.page = 1;
  renderTable(data);
}

// ────────────────────────────────
// KPI Cards
// ────────────────────────────────
const KPI_DEFS = [
  {
    id: 'k0', label: "Umumiy maydon", unit: 'ga', bg: '#0ea5e9',
    icon: `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>`,
    compute: d => d3.sum(d, r => r.area_ha),
    fmt: v => v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(1)+'K' : v.toFixed(0),
  },
  {
    id: 'k1', label: "O'rtacha bonitet", unit: 'ball', bg: '#10b981',
    icon: `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>`,
    compute: d => d3.mean(d, r => r.bonitet) ?? 0,
    fmt: v => v.toFixed(1),
  },
  {
    id: 'k2', label: "Yetkazilgan suv", unit: '%', bg: '#3b82f6',
    icon: `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/></svg>`,
    compute: d => { const m = d3.sum(d, r => r.Meyor); return m > 0 ? (d3.sum(d, r => r.evopo) / m) * 100 : 0; },
    fmt: v => v.toFixed(1),
  },
  {
    id: 'k3', label: "Sarflangan suv", unit: 'mln m³', bg: '#f59e0b',
    icon: `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
    compute: d => d3.sum(d, r => r.evopo) / 1e6,
    fmt: v => v.toFixed(2),
  },
  {
    id: 'k4', label: "Suv sarfi foizi", unit: '%', bg: '#8b5cf6',
    icon: `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>`,
    compute: d => d3.mean(d, r => r.Foiz) ?? 0,
    fmt: v => v.toFixed(1),
  },
  {
    id: 'k5', label: "Sizot suvi", unit: 'm', bg: '#06b6d4',
    icon: `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
    compute: d => d3.mean(d, r => r.sizotSuvi) ?? 0,
    fmt: v => v.toFixed(2),
  },
];

function renderKPIs(data) {
  const section = document.getElementById('kpi-section');

  if (!section.children.length) {
    section.innerHTML = KPI_DEFS.map(k => `
      <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div class="flex items-start justify-between mb-2">
          <p class="text-xs text-slate-400 font-medium leading-snug">${k.label}</p>
          <div class="w-8 h-8 rounded-xl flex items-center justify-center text-white flex-shrink-0 ml-2 shadow-sm"
               style="background:${k.bg}">${k.icon}</div>
        </div>
        <div id="${k.id}" class="text-2xl font-bold text-slate-800 tabular-nums leading-none">--</div>
        <div class="text-xs text-slate-400 mt-1">${k.unit}</div>
      </div>`).join('');
  }

  KPI_DEFS.forEach(k => {
    document.getElementById(k.id).textContent = k.fmt(k.compute(data));
  });
}

// ────────────────────────────────
// Sidebar
// ────────────────────────────────
function buildSidebar() {
  const container = document.getElementById('sidebar-filters');
  container.innerHTML = '';

  const tumanlar = [...new Set(app.allData.map(d => d.tuman))].sort();
  const vhlar    = VH_ORDER.filter(v => app.allData.some(d => d.VH === v));
  const gms      = [...new Set(app.allData.map(d => d.gidromodul))].sort((a, b) => a - b);

  // Ekin turi
  container.appendChild(makeSection('Ekin turi', () => {
    const wrap = document.createElement('div');
    wrap.className = 'space-y-0.5';
    ["Bug'doy", "Paxta"].forEach(t =>
      wrap.appendChild(makeCheckbox(t, t, app.filters.ekinTurlari)));
    return wrap;
  }));

  // Tuman
  container.appendChild(makeSection('Tuman', () => {
    const wrap = document.createElement('div');

    const searchRow = document.createElement('div');
    searchRow.className = 'relative mb-2';
    searchRow.innerHTML = `
      <div class="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
        <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
      </div>
      <input id="tuman-search" type="text" placeholder="Qidirish..."
        class="w-full text-xs border border-slate-200 rounded-lg pl-7 pr-2 py-1.5 outline-none
               focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 bg-slate-50" />`;
    wrap.appendChild(searchRow);

    const list = document.createElement('div');
    list.className = 'space-y-0.5 max-h-32 overflow-y-auto pr-0.5';
    wrap.appendChild(list);

    const buildList = (q = '') => {
      list.innerHTML = '';
      tumanlar.filter(t => t.toLowerCase().includes(q.toLowerCase()))
        .forEach(t => list.appendChild(makeCheckbox(t, t, app.filters.tumanlar)));
    };
    buildList();
    searchRow.querySelector('#tuman-search').addEventListener('input', e => buildList(e.target.value));
    return wrap;
  }));

  // VH holat
  container.appendChild(makeSection('Vegetatsiya holati', () => {
    const wrap = document.createElement('div');
    wrap.className = 'space-y-0.5';
    vhlar.forEach(v => {
      const item = makeCheckbox(v, v, app.filters.vhlar);
      const dot = document.createElement('span');
      dot.style.cssText = `display:inline-block;width:7px;height:7px;border-radius:50%;background:${VH_COLORS[v] || '#64748b'};margin-right:4px;flex-shrink:0;`;
      item.querySelector('label').prepend(dot);
      wrap.appendChild(item);
    });
    return wrap;
  }));

  // Gidromodul
  container.appendChild(makeSection('Gidromodul', () => {
    const wrap = document.createElement('div');
    wrap.className = 'grid grid-cols-3 gap-1';
    gms.forEach(g => wrap.appendChild(makeCheckbox(ROMAN[g] || String(g), g, app.filters.gidromodullar, true)));
    return wrap;
  }));

  // Bonitet range
  container.appendChild(makeRangeSection('Ball boniteti', 'bonitet', app.bonitetRange, app.filters.bonitet, 0));

  // Sizot suvi range
  container.appendChild(makeRangeSection('Sizot suvi (m)', 'sizotSuvi', app.sizotRange, app.filters.sizotSuvi, 1));

  // Reset
  document.getElementById('reset-btn').onclick = () => {
    app.filters.tumanlar.clear();
    app.filters.ekinTurlari.clear();
    app.filters.vhlar.clear();
    app.filters.gidromodullar.clear();
    app.filters.bonitet   = [...app.bonitetRange];
    app.filters.sizotSuvi = [...app.sizotRange];
    buildSidebar();
    render();
  };
}

function makeSection(title, contentFn) {
  const el = document.createElement('div');
  el.className = 'filter-section';

  const header = document.createElement('div');
  header.className = 'filter-header';
  header.innerHTML = `
    <span class="filter-title">${title}</span>
    <svg class="chevron" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
      <polyline points="6 9 12 15 18 9"/>
    </svg>`;

  const body = document.createElement('div');
  body.className = 'filter-body';
  body.appendChild(contentFn());

  let open = true;
  header.onclick = () => {
    open = !open;
    body.style.display = open ? '' : 'none';
    header.querySelector('.chevron').classList.toggle('closed', !open);
  };

  el.appendChild(header);
  el.appendChild(body);
  return el;
}

function makeCheckbox(label, value, filterSet, compact = false) {
  const wrap = document.createElement('div');
  wrap.className = 'chk-item';

  const uid = `c_${String(value).replace(/[^a-z0-9]/gi, '_')}_${Math.random().toString(36).slice(2, 7)}`;
  wrap.innerHTML = `
    <input type="checkbox" id="${uid}" ${filterSet.has(value) ? 'checked' : ''}
      style="accent-color:#10b981;width:13px;height:13px;cursor:pointer;flex-shrink:0;" />
    <label for="${uid}" style="font-size:${compact ? '12px' : '12.5px'};color:#475569;cursor:pointer;font-weight:${compact ? 600 : 400};">${label}</label>`;

  wrap.querySelector('input').addEventListener('change', e => {
    if (e.target.checked) filterSet.add(value);
    else filterSet.delete(value);
    render();
  });
  return wrap;
}

function makeRangeSection(title, key, fullRange, currentRange, dec) {
  const [rMin, rMax] = fullRange;
  const step = dec === 0 ? 1 : 0.1;

  const sec = document.createElement('div');
  sec.className = 'filter-section';

  const header = document.createElement('div');
  header.className = 'filter-header';
  header.innerHTML = `<span class="filter-title">${title}</span>`;

  const body = document.createElement('div');
  body.className = 'filter-body';

  // Value display
  const display = document.createElement('div');
  display.className = 'flex items-center justify-between mb-3';
  const minSpan = document.createElement('span');
  minSpan.className = 'text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg tabular-nums';
  minSpan.textContent = currentRange[0].toFixed(dec);
  const maxSpan = document.createElement('span');
  maxSpan.className = 'text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg tabular-nums';
  maxSpan.textContent = currentRange[1].toFixed(dec);
  display.append(minSpan, Object.assign(document.createElement('span'), { className: 'text-slate-300 text-sm', textContent: '—' }), maxSpan);
  body.appendChild(display);

  // Slider
  const wrap = document.createElement('div');
  wrap.className = 'dual-range-wrap';

  const track = document.createElement('div');
  track.className = 'range-track';
  const fill = document.createElement('div');
  fill.className = 'range-fill';
  track.appendChild(fill);

  const minInput = Object.assign(document.createElement('input'), {
    type: 'range', min: rMin, max: rMax, step, value: currentRange[0],
  });
  const maxInput = Object.assign(document.createElement('input'), {
    type: 'range', min: rMin, max: rMax, step, value: currentRange[1],
  });

  function updateFill() {
    const lo = ((+minInput.value - rMin) / (rMax - rMin)) * 100;
    const hi = ((+maxInput.value - rMin) / (rMax - rMin)) * 100;
    fill.style.left = lo + '%';
    fill.style.width = (hi - lo) + '%';
  }

  minInput.addEventListener('input', () => {
    if (+minInput.value > +maxInput.value - step) minInput.value = +maxInput.value - step;
    minSpan.textContent = (+minInput.value).toFixed(dec);
    app.filters[key] = [+minInput.value, +maxInput.value];
    updateFill(); render();
  });
  maxInput.addEventListener('input', () => {
    if (+maxInput.value < +minInput.value + step) maxInput.value = +minInput.value + step;
    maxSpan.textContent = (+maxInput.value).toFixed(dec);
    app.filters[key] = [+minInput.value, +maxInput.value];
    updateFill(); render();
  });

  wrap.append(track, minInput, maxInput);
  body.appendChild(wrap);
  updateFill();

  sec.appendChild(header);
  sec.appendChild(body);
  return sec;
}

// ────────────────────────────────
// Data Table
// ────────────────────────────────
const HEADERS = [
  { key: 'tuman',      label: 'Tuman' },
  { key: 'Turi',       label: 'Ekin turi' },
  { key: 'area_ha',    label: 'Maydon (ga)' },
  { key: 'bonitet',    label: 'Bonitet' },
  { key: 'VH',         label: 'Holat' },
  { key: 'gidromodul', label: 'Gidromodul' },
  { key: 'Foiz',       label: 'Foiz (%)' },
  { key: 'sizotSuvi',  label: 'Sizot suvi (m)' },
];

const VH_BADGE = {
  "Juda yaxshi": "bg-emerald-100 text-emerald-700",
  "Yaxshi":      "bg-blue-100 text-blue-700",
  "O'rta":       "bg-orange-100 text-orange-700",
  "Qoniqarli":   "bg-purple-100 text-purple-700",
  "Past":        "bg-red-100 text-red-700",
  "Yomon":       "bg-slate-100 text-slate-600",
};

function renderTable(data) {
  const { page, perPage, sortCol, sortDir } = app.table;

  const sorted = [...data].sort((a, b) => {
    const [va, vb] = [a[sortCol], b[sortCol]];
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ?  1 : -1;
    return 0;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const safePage   = Math.min(page, totalPages);
  const slice      = sorted.slice((safePage - 1) * perPage, safePage * perPage);

  const thead = HEADERS.map(h => {
    const active = h.key === sortCol;
    const arrow  = active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';
    return `<th data-col="${h.key}" class="${active ? 'active' : ''}">${h.label}${arrow}</th>`;
  }).join('');

  const tbody = slice.length
    ? slice.map(d => `
        <tr>
          <td class="font-medium text-slate-700">${d.tuman}</td>
          <td><span class="badge ${d.Turi === "Bug'doy" ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}">${d.Turi}</span></td>
          <td class="tabular-nums">${d.area_ha.toFixed(2)}</td>
          <td class="tabular-nums font-semibold">${d.bonitet}</td>
          <td><span class="badge ${VH_BADGE[d.VH] || 'bg-slate-100 text-slate-600'}">${d.VH}</span></td>
          <td class="tabular-nums font-semibold">${ROMAN[d.gidromodul] || d.gidromodul}</td>
          <td class="tabular-nums">${d.Foiz.toFixed(1)}</td>
          <td class="tabular-nums">${d.sizotSuvi.toFixed(2)}</td>
        </tr>`).join('')
    : `<tr><td colspan="8" class="text-center py-10 text-slate-400">Ma'lumotlar topilmadi</td></tr>`;

  const container = document.getElementById('data-table');
  container.innerHTML = `
    <div class="tbl-wrap">
      <table>
        <thead><tr>${thead}</tr></thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>
    ${buildPagination(safePage, totalPages, sorted.length, perPage)}`;

  container.querySelectorAll('th[data-col]').forEach(th =>
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (app.table.sortCol === col) {
        app.table.sortDir = app.table.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        app.table.sortCol = col;
        app.table.sortDir = 'asc';
      }
      app.table.page = 1;
      renderTable(data);
    }));

  container.querySelectorAll('[data-page]').forEach(btn =>
    btn.addEventListener('click', () => {
      const p = +btn.dataset.page;
      if (!isNaN(p) && p >= 1 && p <= totalPages) {
        app.table.page = p;
        renderTable(data);
      }
    }));
}

function buildPagination(current, total, count, perPage) {
  const start = (current - 1) * perPage + 1;
  const end   = Math.min(current * perPage, count);

  const pages = [1];
  if (current - 2 > 2) pages.push('…');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
  if (current + 2 < total - 1) pages.push('…');
  if (total > 1) pages.push(total);

  const btns = pages.map(p =>
    p === '…'
      ? `<span class="px-1 text-slate-400 text-sm select-none">…</span>`
      : `<button data-page="${p}" class="page-btn${p === current ? ' active' : ''}">${p}</button>`
  ).join('');

  const nav = (dir, disabled) => `
    <button data-page="${current + dir}"
      class="page-btn" ${disabled ? 'disabled' : ''}>
      <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
        ${dir < 0 ? '<polyline points="15 18 9 12 15 6"/>' : '<polyline points="9 18 15 12 9 6"/>'}
      </svg>
    </button>`;

  return `
    <div class="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
      <span class="text-xs text-slate-400">${count.toLocaleString()} dan <b>${start}–${end}</b> ko'rsatilmoqda</span>
      <div class="pagination">
        ${nav(-1, current === 1)}
        ${btns}
        ${nav(1, current === total)}
      </div>
    </div>`;
}
