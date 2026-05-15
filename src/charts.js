import * as d3 from 'd3';

const ROMAN = { 1:'I', 2:'II', 3:'III', 4:'IV', 5:'V', 6:'VI', 7:'VII', 8:'VIII', 9:'IX' };
export const VH_COLORS = {
  "Juda yaxshi": "#10b981",
  "Yaxshi":      "#3b82f6",
  "O'rta":       "#f97316",
  "Qoniqarli":   "#8b5cf6",
  "Past":        "#ef4444",
  "Yomon":       "#6b7280",
};

function noData(el) {
  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:100%;flex-direction:column;gap:8px;">
      <svg width="36" height="36" fill="none" stroke="#cbd5e1" stroke-width="1.5" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span style="color:#94a3b8;font-size:12px;font-family:inherit;">Ma'lumotlar mavjud emas</span>
    </div>`;
}

function tip(el) {
  const d = document.createElement('div');
  d.className = 'chart-tooltip';
  el.appendChild(d);
  return d;
}

function showTip(tooltip, event, el, html) {
  tooltip.style.opacity = '1';
  tooltip.innerHTML = html;
  const [px, py] = d3.pointer(event, el);
  const tw = tooltip.offsetWidth || 140;
  const left = px + tw + 20 > el.clientWidth ? px - tw - 8 : px + 12;
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${py - 10}px`;
}

function hideTip(tooltip) { tooltip.style.opacity = '0'; }

function gridLines(svg, scale, length, axis = 'y') {
  const g = svg.append('g').attr('class', 'grid');
  const fn = axis === 'y' ? d3.axisLeft(scale).tickSize(-length).tickFormat('') : d3.axisBottom(scale).tickSize(-length).tickFormat('');
  g.call(fn);
  g.selectAll('line').style('stroke', '#f1f5f9').style('stroke-dasharray', '3,3');
  g.select('.domain').remove();
  return g;
}

// ═══════════════════════════════════════════════
// 1. Premium Grouped Bar — Tuman × Ekin turi
// ═══════════════════════════════════════════════
const BAR_COLORS = {
  "Bug'doy": { top: '#FCD34D', mid: '#F59E0B', bot: '#D97706', hex: '#F59E0B', id: 'grad-bugdoy' },
  Paxta:    { top: '#7DD3FC', mid: '#38BDF8', bot: '#0284C7', hex: '#0EA5E9', id: 'grad-paxta'  },
};

export function renderBarChart(data, el, onBarClick) {
  el.innerHTML = '';
  if (!data.length) return noData(el);

  // Group: area + count per tuman per turi
  const grouped = d3.rollup(data, v => ({ area: d3.sum(v, d => d.area_ha), count: v.length }),
    d => d.tuman, d => d.Turi);

  const rows = Array.from(grouped, ([tuman, m]) => ({
    tuman,
    "Bug'doy":       (m.get("Bug'doy") || {}).area  || 0,
    "Bug'doy_count": (m.get("Bug'doy") || {}).count || 0,
    Paxta:           (m.get("Paxta")   || {}).area  || 0,
    Paxta_count:     (m.get("Paxta")   || {}).count || 0,
    total: ((m.get("Bug'doy") || {}).area || 0) + ((m.get("Paxta") || {}).area || 0),
  })).sort((a, b) => b.total - a.total).slice(0, 12);

  const keys = ["Bug'doy", "Paxta"];
  const w = el.clientWidth || 400;
  const h = el.clientHeight || 255;
  const mg = { top: 26, right: 14, bottom: 64, left: 54 };
  const W = w - mg.left - mg.right;
  const H = h - mg.top - mg.bottom;

  const svg = d3.select(el).append('svg')
    .attr('width', w).attr('height', h)
    .style('overflow', 'visible');

  // ── Gradient defs ──
  const defs = svg.append('defs');
  keys.forEach(k => {
    const c = BAR_COLORS[k];
    const lg = defs.append('linearGradient')
      .attr('id', c.id).attr('x1', '0').attr('y1', '0').attr('x2', '0').attr('y2', '1');
    lg.append('stop').attr('offset', '0%').attr('stop-color', c.top);
    lg.append('stop').attr('offset', '60%').attr('stop-color', c.mid);
    lg.append('stop').attr('offset', '100%').attr('stop-color', c.bot);
  });
  // Drop-shadow filter
  const filt = defs.append('filter').attr('id', 'bar-shadow')
    .attr('x', '-10%').attr('y', '-10%').attr('width', '120%').attr('height', '130%');
  filt.append('feDropShadow')
    .attr('dx', 0).attr('dy', 2).attr('stdDeviation', 2)
    .attr('flood-color', 'rgba(0,0,0,0.12)');

  const g = svg.append('g').attr('transform', `translate(${mg.left},${mg.top})`);

  const x0 = d3.scaleBand().domain(rows.map(d => d.tuman)).range([0, W]).padding(0.3);
  const x1 = d3.scaleBand().domain(keys).range([0, x0.bandwidth()]).padding(0.08);
  const yMax = d3.max(rows, d => Math.max(d["Bug'doy"], d.Paxta)) || 1;
  const y = d3.scaleLinear().domain([0, yMax * 1.2]).nice().range([H, 0]);

  // ── Grid lines ──
  g.append('g')
    .call(d3.axisLeft(y).tickSize(-W).tickFormat(''))
    .call(ax => {
      ax.select('.domain').remove();
      ax.selectAll('line').style('stroke', '#f1f5f9').style('stroke-dasharray', '4,4');
    });

  const tooltip = tip(el);

  // ── Bar groups ──
  const grp = g.append('g').selectAll('g').data(rows).join('g')
    .attr('transform', d => `translate(${x0(d.tuman)},0)`);

  // Bars
  grp.selectAll('rect.bar')
    .data(d => keys.map(k => ({ k, v: d[k], count: d[k + '_count'], t: d.tuman })))
    .join('rect').attr('class', 'bar')
    .attr('x', d => x1(d.k))
    .attr('width', x1.bandwidth())
    .attr('rx', 4)
    .attr('fill', d => `url(#${BAR_COLORS[d.k].id})`)
    .attr('filter', 'url(#bar-shadow)')
    .attr('cursor', 'pointer')
    .attr('y', H).attr('height', 0)
    .on('mouseover', function(e, d) {
      d3.select(this).transition().duration(120).attr('opacity', 0.82).attr('rx', 6);
      showTip(tooltip, e, el,
        `<b style="color:#fff">${d.t}</b><br>` +
        `<span style="color:${BAR_COLORS[d.k].mid}">${d.k}</span><br>` +
        `Maydon: <b>${d3.format(',.1f')(d.v)} ga</b><br>` +
        `Maydonlar soni: <b>${d.count.toLocaleString()} ta</b>`);
    })
    .on('mouseout', function() {
      d3.select(this).transition().duration(120).attr('opacity', 1).attr('rx', 4);
      hideTip(tooltip);
    })
    .on('click', (e, d) => {
      if (onBarClick) onBarClick(d.t, d.k);
    })
    .transition().duration(700).ease(d3.easeCubicOut)
    .delay((d, i) => i * 45)
    .attr('y', d => y(d.v))
    .attr('height', d => Math.max(0, H - y(d.v)));

  // Value labels above bars
  grp.selectAll('text.val')
    .data(d => keys.map(k => ({ k, v: d[k] })))
    .join('text').attr('class', 'val')
    .attr('x', d => x1(d.k) + x1.bandwidth() / 2)
    .attr('text-anchor', 'middle')
    .style('font-size', '9px').style('font-weight', '700')
    .style('fill', d => BAR_COLORS[d.k].bot)
    .style('opacity', 0)
    .attr('y', d => y(d.v) - 4)
    .text(d => d.v > 0 ? (d.v >= 1000 ? (d.v / 1000).toFixed(1) + 'K' : d.v.toFixed(0)) : '')
    .transition().duration(600).delay(500)
    .style('opacity', 1);

  // Total label above group
  grp.append('text')
    .attr('x', x0.bandwidth() / 2)
    .attr('y', d => y(Math.max(d["Bug'doy"], d.Paxta)) - 15)
    .attr('text-anchor', 'middle')
    .style('font-size', '8.5px').style('font-weight', '600').style('fill', '#94a3b8')
    .style('opacity', 0)
    .text(d => d.total >= 1000 ? (d.total / 1000).toFixed(0) + 'K' : d.total.toFixed(0))
    .transition().duration(600).delay(650)
    .style('opacity', 1);

  // ── Axes ──
  g.append('g').attr('transform', `translate(0,${H})`)
    .call(d3.axisBottom(x0).tickSize(0))
    .call(ax => ax.select('.domain').style('stroke', '#e2e8f0'))
    .selectAll('text')
    .attr('transform', 'rotate(-35)').style('text-anchor', 'end')
    .attr('dx', '-0.5em').attr('dy', '0.15em')
    .style('font-size', '10.5px').style('fill', '#64748b');

  g.append('g')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => d >= 1000 ? d3.format('.0s')(d) : d))
    .call(ax => ax.select('.domain').remove())
    .selectAll('text').style('font-size', '10.5px').style('fill', '#94a3b8');

  // ── Legend ──
  const leg = document.getElementById('bar-legend');
  if (leg) {
    leg.innerHTML = keys.map(k => `
      <div class="legend-item">
        <div style="width:10px;height:10px;border-radius:3px;background:${BAR_COLORS[k].mid};flex-shrink:0;"></div>
        <span style="font-size:11.5px;color:#475569;font-weight:500;">${k}</span>
      </div>`).join('');
  }
}

// ── Share bar update (called from main.js) ──
export function updateEkinShare(data) {
  const el = document.getElementById('ekin-share');
  if (!el) return;

  const bugdoy = d3.sum(data, d => d.Turi === "Bug'doy" ? d.area_ha : 0);
  const paxta  = d3.sum(data, d => d.Turi === "Paxta"   ? d.area_ha : 0);
  const total  = bugdoy + paxta || 1;
  const bp = (bugdoy / total * 100).toFixed(1);
  const pp = (paxta  / total * 100).toFixed(1);

  const fmt = v => v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(1)+'K' : v.toFixed(0);

  el.innerHTML = `
    <div class="flex items-center gap-2 text-xs">
      <span class="flex items-center gap-1.5 font-medium" style="color:#D97706;">
        <span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#F59E0B;"></span>
        Bug'doy
      </span>
      <span class="text-slate-400">${fmt(bugdoy)} ga · ${bp}%</span>
      <span class="flex-1 h-1.5 rounded-full overflow-hidden" style="background:#fef3c7;">
        <span class="block h-full rounded-full transition-all duration-500" style="width:${bp}%;background:linear-gradient(90deg,#FCD34D,#D97706);"></span>
      </span>
    </div>
    <div class="flex items-center gap-2 text-xs">
      <span class="flex items-center gap-1.5 font-medium" style="color:#0284C7;">
        <span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#0EA5E9;"></span>
        Paxta
      </span>
      <span class="text-slate-400">${fmt(paxta)} ga · ${pp}%</span>
      <span class="flex-1 h-1.5 rounded-full overflow-hidden" style="background:#e0f2fe;">
        <span class="block h-full rounded-full transition-all duration-500" style="width:${pp}%;background:linear-gradient(90deg,#7DD3FC,#0284C7);"></span>
      </span>
    </div>`;
}

// ═══════════════════════════════
// 2. Bonitet Distribution
// ═══════════════════════════════
export function renderBonitetChart(data, el, bonitetFilter) {
  el.innerHTML = '';
  if (!data.length) return noData(el);

  const [minB, maxB] = bonitetFilter;
  if (minB >= maxB) return noData(el);

  const sz = (maxB - minB) / 3;
  const segs = [
    { label: `${minB.toFixed(0)}–${(minB + sz).toFixed(0)}`,       min: minB,      max: minB + sz },
    { label: `${(minB + sz).toFixed(0)}–${(minB + 2*sz).toFixed(0)}`, min: minB+sz,   max: minB+2*sz },
    { label: `${(minB + 2*sz).toFixed(0)}–${maxB.toFixed(0)}`,     min: minB+2*sz, max: maxB },
  ];
  const VH_KEYS = ["Juda yaxshi", "Yaxshi", "O'rta", "Past"];

  const result = segs.map(s => {
    const row = { group: s.label };
    VH_KEYS.forEach(k => { row[k] = 0; row[k + '_area'] = 0; });
    data.forEach(d => {
      const idx = d.bonitet === maxB ? 2 : segs.findIndex(sg => d.bonitet >= sg.min && d.bonitet < sg.max);
      if (idx !== -1 && VH_KEYS.includes(d.VH)) {
        row[d.VH]++;
        row[d.VH + '_area'] += d.area_ha;
      }
    });
    return row;
  });

  const w = el.clientWidth, h = el.clientHeight;
  const m = { top: 12, right: 12, bottom: 36, left: 46 };
  const W = w - m.left - m.right, H = h - m.top - m.bottom;

  const svg = d3.select(el).append('svg').attr('width', w).attr('height', h)
    .append('g').attr('transform', `translate(${m.left},${m.top})`);

  const x0 = d3.scaleBand().domain(result.map(d => d.group)).range([0, W]).padding(0.28);
  const x1 = d3.scaleBand().domain(VH_KEYS).range([0, x0.bandwidth()]).padding(0.06);
  const yMax = d3.max(result, d => d3.max(VH_KEYS, k => d[k])) || 0;
  const y  = d3.scaleLinear().domain([0, yMax * 1.12]).nice().range([H, 0]);
  const color = d3.scaleOrdinal().domain(VH_KEYS).range(VH_KEYS.map(k => VH_COLORS[k]));

  gridLines(svg, y, W);

  const tooltip = tip(el);

  svg.append('g').selectAll('g').data(result).join('g')
    .attr('transform', d => `translate(${x0(d.group)},0)`)
    .selectAll('rect').data(d => VH_KEYS.map(k => ({ k, v: d[k], area: d[k + '_area'], g: d.group }))).join('rect')
      .attr('x', d => x1(d.k)).attr('width', x1.bandwidth()).attr('rx', 2)
      .attr('y', d => y(d.v)).attr('height', d => H - y(d.v))
      .attr('fill', d => color(d.k))
      .on('mouseover', (e, d) => showTip(tooltip, e, el,
        `<b>${d.g}</b><br>${d.k}: <b>${d.v.toLocaleString()} ta</b><br>` +
        `Maydon: <b>${d3.format(',.1f')(d.area)} ga</b>`))
      .on('mouseout', () => hideTip(tooltip));

  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${H})`)
    .call(d3.axisBottom(x0).tickSize(0));
  svg.append('g').attr('class', 'axis')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => d + ' ta'));
}

// ═══════════════════════════════
// 3. Scatter Plot — Meyor × Evopo
// ═══════════════════════════════
export function renderScatterPlot(data, el) {
  el.innerHTML = '';
  if (!data.length) return noData(el);

  const sample = data.length > 1800 ? d3.shuffle(data.slice()).slice(0, 1800) : data;

  const w = el.clientWidth, h = el.clientHeight;
  const m = { top: 16, right: 14, bottom: 46, left: 52 };
  const W = w - m.left - m.right, H = h - m.top - m.bottom;

  const rootSvg = d3.select(el).append('svg').attr('width', w).attr('height', h);
  const g = rootSvg.append('g').attr('transform', `translate(${m.left},${m.top})`);

  const x = d3.scaleLinear().domain(d3.extent(sample, d => d.Meyor)).nice().range([0, W]);
  const y = d3.scaleLinear().domain(d3.extent(sample, d => d.evopo)).nice().range([H, 0]);
  const color = d3.scaleOrdinal().domain(["Bug'doy", "Paxta"]).range(['#f59e0b', '#0ea5e9']);

  gridLines(g, y, W);

  // CSS transition on SVG elements — avoids D3 transition conflicts
  const fadeStyle = 'opacity 0.2s ease';

  // ── Crosshair lines ──
  const chV = g.append('line').style('pointer-events', 'none').style('opacity', 0)
    .style('transition', fadeStyle)
    .style('stroke', '#ef4444').style('stroke-width', 1.5).style('stroke-dasharray', '5,3');
  const chH = g.append('line').style('pointer-events', 'none').style('opacity', 0)
    .style('transition', fadeStyle)
    .style('stroke', '#ef4444').style('stroke-width', 1.5).style('stroke-dasharray', '5,3');

  // ── Selected dot ring ──
  const selRing = g.append('circle').style('pointer-events', 'none').style('opacity', 0)
    .style('transition', fadeStyle)
    .attr('fill', 'none').attr('stroke', '#ef4444').attr('stroke-width', 2);

  // ── X-axis value marker ──
  const xMark = g.append('g').style('pointer-events', 'none').style('opacity', 0)
    .style('transition', fadeStyle);
  xMark.append('line').attr('y1', 0).attr('y2', 5)
    .style('stroke', '#ef4444').style('stroke-width', 2);
  const xMarkTxt = xMark.append('text').attr('y', 16).attr('text-anchor', 'middle')
    .style('font-size', '9.5px').style('font-weight', '700').style('fill', '#ef4444')
    .style('font-family', 'inherit');

  // ── Y-axis value marker ──
  const yMark = g.append('g').style('pointer-events', 'none').style('opacity', 0)
    .style('transition', fadeStyle);
  yMark.append('line').attr('x1', -5).attr('x2', 0)
    .style('stroke', '#ef4444').style('stroke-width', 2);
  const yMarkTxt = yMark.append('text').attr('x', -8).attr('dy', '0.35em').attr('text-anchor', 'end')
    .style('font-size', '9.5px').style('font-weight', '700').style('fill', '#ef4444')
    .style('font-family', 'inherit');

  const tooltip = tip(el);
  let selected = null;

  // ── Dots ──
  const circles = g.append('g').selectAll('circle').data(sample).join('circle')
    .attr('cx', d => x(d.Meyor)).attr('cy', d => y(d.evopo))
    .attr('r', 3).attr('fill', d => color(d.Turi)).attr('opacity', 0.55)
    .attr('cursor', 'pointer')
    .on('mouseover', function(e, d) {
      if (selected) return;
      d3.select(this).interrupt().attr('r', 5).attr('opacity', 1);
      showTip(tooltip, e, el,
        `<b>${d.tuman}</b> — <span style="color:${color(d.Turi)}">${d.Turi}</span><br>` +
        `Maydon: <b>${d.area_ha.toFixed(2)} ga</b><br>` +
        `Meyor: <b>${d3.format(',.0f')(d.Meyor)} m³</b><br>` +
        `Evopo: <b>${d3.format(',.0f')(d.evopo)} m³</b>`);
    })
    .on('mouseout', function() {
      if (selected) return;
      d3.select(this).interrupt().attr('r', 3).attr('opacity', 0.55);
      hideTip(tooltip);
    })
    .on('click', function(e, d) {
      e.stopPropagation();
      hideTip(tooltip);
      selected === d ? doDeselect() : doSelect(d);
    });

  function doSelect(d) {
    selected = d;
    const cx = x(d.Meyor), cy = y(d.evopo);

    // Named transition 'sc' — cancels any previous 'sc' transition cleanly
    circles.interrupt('sc').transition('sc').duration(220)
      .attr('r',       d2 => d2 === d ? 7 : 3)
      .attr('opacity', d2 => d2 === d ? 1 : 0.04);

    chV.attr('x1', cx).attr('x2', cx).attr('y1', cy).attr('y2', H).style('opacity', 1);
    chH.attr('x1', 0).attr('x2', cx).attr('y1', cy).attr('y2', cy).style('opacity', 1);
    selRing.attr('cx', cx).attr('cy', cy).attr('r', 10).style('opacity', 1);

    xMark.attr('transform', `translate(${cx},${H})`).style('opacity', 1);
    xMarkTxt.text(d3.format(',.0f')(d.Meyor));
    yMark.attr('transform', `translate(0,${cy})`).style('opacity', 1);
    yMarkTxt.text(d3.format(',.0f')(d.evopo));

    tooltip.innerHTML = [
      `<div style="font-weight:700;font-size:13px;color:#fff;margin-bottom:2px">${d.tuman}</div>`,
      `<div style="color:${color(d.Turi)};font-size:11px;margin-bottom:7px">${d.Turi}</div>`,
      `<table style="border-spacing:0 3px;font-size:11.5px;width:100%">`,
      `<tr><td style="color:#94a3b8;padding-right:10px">Maydon</td><td style="font-weight:600;color:#f8fafc">${d.area_ha.toFixed(2)} ga</td></tr>`,
      `<tr><td style="color:#94a3b8">Meyor</td><td style="font-weight:600;color:#f8fafc">${d3.format(',.0f')(d.Meyor)} m³</td></tr>`,
      `<tr><td style="color:#94a3b8">Evopo</td><td style="font-weight:600;color:#f8fafc">${d3.format(',.0f')(d.evopo)} m³</td></tr>`,
      `<tr><td style="color:#94a3b8">Foiz</td><td style="font-weight:600;color:#10b981">${d.Foiz.toFixed(1)}%</td></tr>`,
      `<tr><td style="color:#94a3b8">Bonitet</td><td style="font-weight:600;color:#f8fafc">${d.bonitet}</td></tr>`,
      `<tr><td style="color:#94a3b8">Sizot suvi</td><td style="font-weight:600;color:#f8fafc">${d.sizotSuvi.toFixed(2)} m</td></tr>`,
      `</table>`,
      `<div style="color:#475569;font-size:10px;margin-top:6px;border-top:1px solid rgba(255,255,255,0.08);padding-top:5px">Yopish uchun bosing</div>`,
    ].join('');
    tooltip.style.opacity = '1';
    const tw = tooltip.offsetWidth || 160, th = tooltip.offsetHeight || 150;
    tooltip.style.left = `${cx + m.left + tw + 16 > w ? cx + m.left - tw - 8 : cx + m.left + 14}px`;
    tooltip.style.top  = `${cy + m.top + th > h ? Math.max(4, cy + m.top - th) : cy + m.top}px`;
  }

  function doDeselect() {
    selected = null;
    circles.interrupt('sc').transition('sc').duration(220).attr('r', 3).attr('opacity', 0.55);
    chV.style('opacity', 0);
    chH.style('opacity', 0);
    selRing.style('opacity', 0);
    xMark.style('opacity', 0);
    yMark.style('opacity', 0);
    hideTip(tooltip);
  }

  rootSvg.on('click', () => { if (selected) doDeselect(); });

  // ── Axes ──
  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${H})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d => d >= 1000 ? d3.format('.0s')(d) : d));
  g.append('g').attr('class', 'axis')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => d >= 1000 ? d3.format('.0s')(d) : d));

  g.append('text').attr('x', W / 2).attr('y', H + 40)
    .attr('text-anchor', 'middle').style('font-size', '11px').style('fill', '#94a3b8').text('Meyor (m³)');
  g.append('text').attr('transform', 'rotate(-90)').attr('x', -H / 2).attr('y', -40)
    .attr('text-anchor', 'middle').style('font-size', '11px').style('fill', '#94a3b8').text('Evopo (m³)');
}

// ═══════════════════════════════
// 4. Heatmap — Gidromodul × Tuman
// ═══════════════════════════════
export function renderHeatmap(data, el) {
  el.innerHTML = '';
  if (!data.length) return noData(el);

  const grouped = d3.rollup(data,
    v => ({ val: d3.sum(v, d => d.area_ha), count: v.length }),
    d => d.gidromodul, d => d.tuman);
  const cells = [];
  grouped.forEach((tm, gm) => tm.forEach((d, tuman) => cells.push({ gm, tuman, val: d.val, count: d.count })));

  const tumans = [...new Set(cells.map(c => c.tuman))].sort();
  const gms    = [...new Set(cells.map(c => c.gm))].sort((a, b) => a - b);

  const w = el.clientWidth, h = el.clientHeight;
  const m = { top: 12, right: 12, bottom: 28, left: 70 };
  const W = w - m.left - m.right, H = h - m.top - m.bottom;

  const svg = d3.select(el).append('svg').attr('width', w).attr('height', h)
    .append('g').attr('transform', `translate(${m.left},${m.top})`);

  const x = d3.scaleBand().domain(gms).range([0, W]).padding(0.07);
  const y = d3.scaleBand().domain(tumans).range([0, H]).padding(0.07);
  const colorScale = d3.scaleSequential(d3.interpolateGreens)
    .domain([0, d3.max(cells, c => c.val)]);

  const tooltip = tip(el);

  svg.selectAll('rect').data(cells).join('rect')
    .attr('x', c => x(c.gm)).attr('y', c => y(c.tuman))
    .attr('width', x.bandwidth()).attr('height', y.bandwidth())
    .attr('rx', 3).attr('fill', c => colorScale(c.val)).attr('opacity', 0)
    .on('mouseover', (e, c) => showTip(tooltip, e, el,
      `<b>${c.tuman}</b> — GM <b>${ROMAN[c.gm] || c.gm}</b><br>` +
      `Maydon: <b>${d3.format(',.0f')(c.val)} ga</b><br>` +
      `Maydonlar soni: <b>${c.count.toLocaleString()} ta</b>`))
    .on('mouseout', () => hideTip(tooltip))
    .transition().duration(450).attr('opacity', 0.88);

  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${H})`)
    .call(d3.axisBottom(x).tickSize(0).tickFormat(d => ROMAN[d] || d));
  svg.append('g').attr('class', 'axis')
    .call(d3.axisLeft(y).tickSize(0))
    .selectAll('text').style('font-size', '10px');
  svg.selectAll('.domain').remove();
}

// ═══════════════════════════════
// 5. Horizontal Bar — VH Holat
// ═══════════════════════════════
export function renderHorizBar(data, el) {
  el.innerHTML = '';
  if (!data.length) return noData(el);

  const grouped = d3.rollup(data, v => ({ count: v.length, area: d3.sum(v, d => d.area_ha) }), d => d.VH);
  const rows = Array.from(grouped, ([name, d]) => ({ name, count: d.count, area: d.area }))
    .sort((a, b) => b.count - a.count);

  const w = el.clientWidth, h = el.clientHeight;
  const m = { top: 12, right: 48, bottom: 28, left: 88 };
  const W = w - m.left - m.right, H = h - m.top - m.bottom;

  const svg = d3.select(el).append('svg').attr('width', w).attr('height', h)
    .append('g').attr('transform', `translate(${m.left},${m.top})`);

  const y = d3.scaleBand().domain(rows.map(d => d.name)).range([0, H]).padding(0.22);
  const x = d3.scaleLinear().domain([0, d3.max(rows, d => d.count) * 1.18]).nice().range([0, W]);

  gridLines(svg, x, H, 'x');

  const tooltip = tip(el);

  svg.selectAll('rect').data(rows).join('rect')
    .attr('y', d => y(d.name)).attr('height', y.bandwidth())
    .attr('x', 0).attr('width', 0).attr('rx', 3)
    .attr('fill', d => VH_COLORS[d.name] || '#64748b').attr('opacity', 0.88)
    .on('mouseover', (e, d) => showTip(tooltip, e, el,
      `<b>${d.name}</b><br>Maydonlar: <b>${d.count.toLocaleString()} ta</b><br>Umumiy: <b>${d3.format(',.0f')(d.area)} ga</b>`))
    .on('mouseout', () => hideTip(tooltip))
    .transition().duration(550).delay((d, i) => i * 70)
    .attr('width', d => x(d.count));

  svg.selectAll('.val-lbl').data(rows).join('text').attr('class', 'val-lbl')
    .attr('x', d => x(d.count) + 5).attr('y', d => y(d.name) + y.bandwidth() / 2)
    .attr('dy', '0.35em').style('font-size', '11px').style('fill', '#64748b')
    .text(d => d.count.toLocaleString());

  svg.append('g').attr('class', 'axis').call(d3.axisLeft(y).tickSize(0)).select('.domain').remove();
  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${H})`)
    .call(d3.axisBottom(x).ticks(4).tickFormat(d3.format('.0s')));
}
