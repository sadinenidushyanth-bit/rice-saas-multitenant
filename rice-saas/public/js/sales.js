// ═══════════════════════════════════════════════════════
// sales.js — Sales tab rendering, record sale
// CHANGED FOR MULTI-TENANT: all reads/writes via shopDoc()/shopCol()
// ═══════════════════════════════════════════════════════

function setSalesFilter(f, btn) {
  salesFilter = f;
  document.querySelectorAll('#tab-sales .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (f !== 'custom') {
    document.getElementById('sales-start-date').value = '';
    document.getElementById('sales-end-date').value = '';
  }
  renderSales();
}

function customSalesFilter() {
  const start = document.getElementById('sales-start-date').value;
  const end   = document.getElementById('sales-end-date').value;
  if (!start && !end) return;
  salesFilter = 'custom';
  document.querySelectorAll('#tab-sales .filter-btn').forEach(b => b.classList.remove('active'));
  renderSales();
}

function renderSales() {
  const now = new Date();
  const search = document.getElementById('sales-search')?.value.toLowerCase().trim() || '';
  let fl = sales.filter(x => {
    const d = new Date(x.date);
    if (search) {
      const matchName = (x.customer || '').toLowerCase().includes(search);
      const matchId = (x.orderId || '').toLowerCase().includes(search);
      const matchProduct = (x.bagName || '').toLowerCase().includes(search);
      if (!matchName && !matchId && !matchProduct) return false;
    }
    if (salesFilter === 'all') return true;
    if (salesFilter === 'today') return d.toDateString() === now.toDateString();
    if (salesFilter === 'week') { const w = new Date(now); w.setDate(now.getDate() - 7); return d >= w; }
    if (salesFilter === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (salesFilter === 'custom') {
      const start = document.getElementById('sales-start-date').value;
      const end = document.getElementById('sales-end-date').value;
      const startTime = start ? new Date(start).setHours(0, 0, 0, 0) : 0;
      const endTime = end ? new Date(end).setHours(23, 59, 59, 999) : Infinity;
      return d.getTime() >= startTime && d.getTime() <= endTime;
    }
    return true;
  });

  const total = fl.reduce((s, x) => s + x.total, 0);
  const totalCost = fl.reduce((s, x) => s + (x.costPerBag || 0) * x.qty, 0);
  const totalProfit = fl.reduce((s, x) => s + (x.profit ?? ((x.pricePerBag || x.price || 0) - (x.costPerBag || 0)) * x.qty), 0);
  const todayT = sales.filter(x => new Date(x.date).toDateString() === now.toDateString()).reduce((s, x) => s + x.total, 0);
  const todayP = sales.filter(x => new Date(x.date).toDateString() === now.toDateString()).reduce((s, x) => s + (x.profit ?? 0), 0);

  const canViewRev = hasPerm('viewRevenue');
  const canViewProfit = hasPerm('viewProfitMetrics');

  document.getElementById('sales-metrics').innerHTML = `
    <div class="metric-card"><div class="metric-label">Revenue (filtered)</div><div class="metric-value metric-accent">${canViewRev ? '₹' + total.toLocaleString('en-IN') : '🔒'}</div><div class="metric-sub">${fl.length} transactions</div></div>
    <div class="metric-card"><div class="metric-label">Profit (filtered)</div><div class="metric-value" style="color:${totalProfit >= 0 ? 'var(--green)' : 'var(--red)'}">${canViewProfit ? '₹' + totalProfit.toLocaleString('en-IN') : '🔒'}</div><div class="metric-sub">Vendor cost ${canViewProfit ? '₹' + totalCost.toLocaleString('en-IN') : '🔒'}</div></div>
    <div class="metric-card"><div class="metric-label">Today revenue</div><div class="metric-value">${canViewRev ? '₹' + todayT.toLocaleString('en-IN') : '🔒'}</div><div class="metric-sub">Profit ${canViewProfit ? '₹' + todayP.toLocaleString('en-IN') : '🔒'}</div></div>
    <div class="metric-card"><div class="metric-label">Deliveries / Walk-ins</div><div class="metric-value">${sales.filter(x => x.type === 'delivery' || x.type === 'whatsapp').length} / ${sales.filter(x => x.type === 'walkin').length}</div></div>`;

  const list = document.getElementById('sales-list');
  if (!fl.length) { list.innerHTML = `<div class="empty" style="padding:1.5rem 0"><div class="empty-icon">📋</div>No sales in this period.</div>`; return; }

  list.innerHTML = fl.map(s => {
    const icon = s.type === 'delivery' ? '🛵' : s.type === 'whatsapp' ? '💬' : '🏪';
    const d = new Date(s.date);
    const ds = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const invBtn = `<button onclick="reshowInvoice('${s.id}')" style="background:var(--blue-light);color:var(--blue);border:none;border-radius:6px;padding:2px 8px;font-size:11px;cursor:pointer;margin-left:4px;font-family:var(--font)">🧾 Invoice</button>`;
    const locIcon = s.locationLink ? `<a href="${s.locationLink}" target="_blank" title="View Location" style="margin-left:8px;text-decoration:none;font-size:14px">📍</a>` : '';
    const isLoose = s.saleMode === 'loose';
    const qtyLabel = isLoose ? s.qtyDisplay : (s.qty + ' bags');
    const priceLabel = isLoose ? ` · ₹${Number(s.pricePerKg).toLocaleString('en-IN')}/kg` : (s.pricePerBag ? ` · ₹${Number(s.pricePerBag).toLocaleString('en-IN')}/bag` : '');
    return `<div class="sale-row">
      <div class="sale-icon">${icon}</div>
      <div class="sale-info">
        <div class="sale-name">${s.bagName} × ${qtyLabel} ${invBtn}${locIcon}</div>
        <div class="sale-meta">${s.customer || 'Walk-in'} · ID: ${s.orderId || '--'} · ${s.weight}${priceLabel} · ${ds}</div>
      </div>
      <div class="sale-amt">₹${s.total.toLocaleString('en-IN')}</div>
    </div>`;
  }).join('');
}

function renderRecordForm() {
  const sel = document.getElementById('rs-bag');
  const avail = bags.filter(b => Number(b.stock) > 0);
  sel.innerHTML = !avail.length ? '<option value="">No bags in stock</option>' :
    avail.map(b => `<option value="${b.id}">${b.name} – ${b.weight} [${b.stock} left]</option>`).join('');
  onBagSelect();
}

function onBagSelect() {
  const sel = document.getElementById('rs-bag');
  const bag = bags.find(b => b.id === sel.value);
  if (bag) {
    document.getElementById('rs-cost').value = bag.cost || '';
    document.getElementById('rs-price').value = bag.price || '';
  }
  updateSalePreview();
}

function toggleInvoiceFields() {
  const type = document.getElementById('rs-type').value;
  const showFields = (type === 'whatsapp' || type === 'delivery');
  document.getElementById('invoice-fields').style.display = showFields ? 'block' : 'none';
  const waNotice = document.getElementById('invoice-wa-notice');
  if (waNotice) waNotice.style.display = type === 'whatsapp' ? 'block' : 'none';
  const delNotice = document.getElementById('invoice-del-notice');
  if (delNotice) delNotice.style.display = type === 'delivery' ? 'block' : 'none';
}

function updateSalePreview() {
  const qty = Number(document.getElementById('rs-qty').value) || 1;
  const price = Number(document.getElementById('rs-price').value) || 0;
  const cost = Number(document.getElementById('rs-cost').value) || 0;
  const preview = document.getElementById('sale-preview');
  const sel = document.getElementById('rs-bag');
  const bag = bags.find(b => b.id === sel.value);
  if (!bag || !price) { preview.style.display = 'none'; return; }
  const total = price * qty;
  preview.style.display = 'block';
  preview.innerHTML = `<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>Selling price × ${qty} bag(s)</span><strong>₹${total.toLocaleString('en-IN')}</strong></div>`;
}

async function recordSale() {
  if (!hasPerm('record')) { toast('No permission to record sales'); return; }
  const bagId = document.getElementById('rs-bag').value;
  const qty = Number(document.getElementById('rs-qty').value) || 1;
  const sellingPrice = Number(document.getElementById('rs-price').value);
  const costPrice = Number(document.getElementById('rs-cost').value) || 0;
  const cust = document.getElementById('rs-cust').value.trim();
  const phone = document.getElementById('rs-phone').value.trim();
  const type = document.getElementById('rs-type').value;
  const address = (document.getElementById('rs-address')?.value || '').trim();
  const locationLink = (document.getElementById('rs-location')?.value || '').trim();
  const bag = bags.find(b => b.id === bagId);
  if (!bag) { toast('Please select a bag'); return; }
  if (!sellingPrice) { toast('Please enter the selling price'); return; }
  if (qty > Number(bag.stock)) { toast('Not enough stock! Only ' + bag.stock + ' bags left.'); return; }

  const total = sellingPrice * qty;
  const profit = (sellingPrice - costPrice) * qty;
  const orderId = 'ORD-' + Date.now().toString().slice(-8);
  const invoiceNo = 'INV-' + Date.now().toString().slice(-6);
  const { updateDoc, addDoc, increment } = window._fb;

  const sale = {
    bagId, bagName: bag.name, weight: bag.weight,
    costPerBag: costPrice, pricePerBag: sellingPrice,
    qty, total, profit, orderId, invoiceNo,
    customer: cust, phone, address, locationLink, type,
    date: Date.now(), recordedBy: currentUser?.email || ''
  };

  await updateDoc(shopDoc('bags', bagId), { stock: increment(-qty) });
  await addDoc(shopCol('sales'), sale);

  if (type === 'delivery' || type === 'whatsapp') {
    await addDoc(shopCol('orders'), {
      name: cust || 'Customer', phone, total, address, locationLink, orderId, invoiceNo,
      items: `${qty} x ${bag.name} (${bag.weight})`,
      status: 'Pending', payment: 'COD', date: Date.now(),
      bagId, bagName: bag.name, weight: bag.weight, qty,
      costPerBag: costPrice, pricePerBag: sellingPrice,
      saleRecorded: true
    });
  }
  if (phone && cust) {
    const existing = customers.find(c => c.phone === phone);
    if (!existing) await addDoc(shopCol('customers'), { name: cust, phone, area: '', notes: '', totalOrders: 1, createdAt: Date.now() });
  }

  toast(`Sale recorded! ₹${total.toLocaleString('en-IN')} · Profit ₹${profit.toLocaleString('en-IN')}`);
  ['rs-qty', 'rs-cust', 'rs-phone', 'rs-price', 'rs-address', 'rs-location'].forEach(id => { const el = document.getElementById(id); if (el) el.value = id === 'rs-qty' ? 1 : ''; });
  showInvoice({ ...sale, bagImg: bag.img || '' });
}
