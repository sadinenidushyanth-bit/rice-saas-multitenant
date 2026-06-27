// ═══════════════════════════════════════════════════════
// profit.js — Profit vs vendor cost analytics
// No direct Firestore calls — operates on the already
// shop-scoped `sales` array populated by listenSales().
// ═══════════════════════════════════════════════════════

function setProfitFilter(f, btn) {
  profitFilter = f;
  document.querySelectorAll('#tab-profit .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (f !== 'custom') {
    document.getElementById('profit-start-date').value = '';
    document.getElementById('profit-end-date').value = '';
  }
  renderProfit();
}

function customProfitFilter() {
  const start = document.getElementById('profit-start-date').value;
  const end = document.getElementById('profit-end-date').value;
  if (!start && !end) return;
  profitFilter = 'custom';
  document.querySelectorAll('#tab-profit .filter-btn').forEach(b => b.classList.remove('active'));
  renderProfit();
}

function renderProfit() {
  const now = new Date();
  const filtered = sales.filter(s => {
    const d = new Date(s.date);
    if (profitFilter === 'today') return d.toDateString() === now.toDateString();
    if (profitFilter === 'week') { const w = new Date(now); w.setDate(now.getDate() - 7); return d >= w; }
    if (profitFilter === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (profitFilter === 'custom') {
      const start = document.getElementById('profit-start-date').value;
      const end = document.getElementById('profit-end-date').value;
      const startTime = start ? new Date(start).setHours(0, 0, 0, 0) : 0;
      const endTime = end ? new Date(end).setHours(23, 59, 59, 999) : Infinity;
      return d.getTime() >= startTime && d.getTime() <= endTime;
    }
    return true;
  });

  const totalRev = filtered.reduce((s, x) => s + x.total, 0);
  const totalCost = filtered.reduce((s, x) => s + (x.costPerBag || 0) * x.qty, 0);
  const totalProfit = totalRev - totalCost;
  const totalBagsSold = filtered.reduce((s, x) => s + x.qty, 0);
  const avgMargin = totalCost > 0 ? Math.round((totalProfit / totalCost) * 100) : 0;

  document.getElementById('profit-metrics').innerHTML = `
    <div class="metric-card"><div class="metric-label">Revenue</div><div class="metric-value metric-accent">₹${totalRev.toLocaleString('en-IN')}</div><div class="metric-sub">${totalBagsSold} bags sold</div></div>
    <div class="metric-card"><div class="metric-label">Vendor cost</div><div class="metric-value" style="color:var(--red)">₹${totalCost.toLocaleString('en-IN')}</div><div class="metric-sub">what you paid</div></div>
    <div class="metric-card"><div class="metric-label">Net profit</div><div class="metric-value" style="color:${totalProfit >= 0 ? 'var(--green)' : 'var(--red)'}">₹${totalProfit.toLocaleString('en-IN')}</div></div>
    <div class="metric-card"><div class="metric-label">Avg margin</div><div class="metric-value" style="color:${avgMargin >= 15 ? 'var(--green)' : avgMargin >= 5 ? 'var(--amber)' : 'var(--red)'}">${avgMargin}%</div><div class="metric-sub">above vendor cost</div></div>`;

  const byProduct = {};
  filtered.forEach(s => {
    if (!byProduct[s.bagName]) byProduct[s.bagName] = { name: s.bagName, weight: s.weight || '', qty: 0, revenue: 0, cost: 0, profit: 0 };
    byProduct[s.bagName].qty += s.qty;
    byProduct[s.bagName].revenue += s.total;
    byProduct[s.bagName].cost += (s.costPerBag || 0) * s.qty;
    byProduct[s.bagName].profit += s.profit || 0;
  });
  const products = Object.values(byProduct).sort((a, b) => b.profit - a.profit);
  const ppEl = document.getElementById('profit-per-product');
  if (!products.length) { ppEl.innerHTML = `<div class="empty" style="padding:1.5rem 0"><div class="empty-icon">📊</div>No sales in this period.</div>`; document.getElementById('profit-sales-list').innerHTML = ''; return; }
  ppEl.innerHTML = products.map(p => {
    const margin = p.cost > 0 ? Math.round(p.profit / p.cost * 100) : 0;
    const mc = margin >= 15 ? 'pm-good' : margin >= 5 ? 'pm-ok' : 'pm-low';
    return `<div class="profit-row">
      <div><div class="profit-label">${p.name}</div><div class="profit-meta">${p.weight} · ${p.qty} bags sold</div></div>
      <div class="profit-right">
        <div class="profit-amt">₹${p.profit.toLocaleString('en-IN')}</div>
        <div><span class="profit-margin ${mc}">${margin}% margin</span></div>
        <div style="font-size:11px;color:var(--text3)">Rev ₹${p.revenue.toLocaleString('en-IN')} · Cost ₹${p.cost.toLocaleString('en-IN')}</div>
      </div>
    </div>`;
  }).join('');

  const salesEl = document.getElementById('profit-sales-list');
  const recentFiltered = filtered.slice(0, 30);
  if (!recentFiltered.length) { salesEl.innerHTML = ''; return; }
  salesEl.innerHTML = recentFiltered.map(s => {
    const profit = s.profit ?? (s.total - (s.costPerBag || 0) * s.qty);
    const margin = (s.costPerBag && s.costPerBag > 0) ? Math.round((s.pricePerBag - s.costPerBag) / s.costPerBag * 100) : null;
    const d = new Date(s.date);
    const ds = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const typeIcon = s.type === 'delivery' ? '🛵' : s.type === 'whatsapp' ? '💬' : '🏪';
    return `<div class="sale-row">
      <div class="sale-icon">${typeIcon}</div>
      <div class="sale-info">
        <div class="sale-name">${s.bagName} × ${s.qty} ${s.invoiceNo ? `<span style="font-size:10px;color:var(--text3)">${s.invoiceNo}</span>` : ''}
          ${(s.type === 'whatsapp' || s.type === 'delivery') ? `<button onclick="reshowInvoice('${s.id}')" style="background:var(--blue-light);color:var(--blue);border:none;border-radius:6px;padding:2px 7px;font-size:10px;cursor:pointer;margin-left:4px">🧾 Invoice</button>` : ''}</div>
        <div class="sale-meta">${s.customer || 'Walk-in'} · Cost ₹${((s.costPerBag || 0) * s.qty).toLocaleString('en-IN')} · Sold ₹${s.total.toLocaleString('en-IN')} · ${ds}</div>
      </div>
      <div style="text-align:right">
        <div class="sale-profit ${profit < 0 ? 'loss' : ''}">+₹${profit.toLocaleString('en-IN')}</div>
        ${margin !== null ? `<div style="font-size:11px;color:var(--text3)">${margin}% margin</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

function reshowInvoice(saleId) {
  const s = sales.find(x => x.id === saleId);
  if (s) showInvoice(s);
}

function openOrderInvoice(orderId) {
  const o = orders.find(x => x.id === orderId);
  if (!o) return;
  const fakeSale = {
    orderId: o.orderId, invoiceNo: o.invoiceNo || ('INV-' + o.id.slice(-6).toUpperCase()),
    customer: o.name, phone: o.phone, address: o.address + (o.landmark ? ' · ' + o.landmark : ''),
    bagName: o.items || 'See items below', weight: '', qty: 1,
    pricePerBag: o.total, costPerBag: 0, total: o.total, date: o.date, type: 'whatsapp',
    _isOrder: true, _itemsText: o.items, _payment: o.payment
  };
  showInvoice(fakeSale);
}
