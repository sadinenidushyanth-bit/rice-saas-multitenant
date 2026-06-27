// ═══════════════════════════════════════════════════════
// orders.js — Orders tab and management
// CHANGED FOR MULTI-TENANT: all reads/writes via shopDoc()/shopCol()
// ═══════════════════════════════════════════════════════

function setOrderFilter(f, btn) {
  orderFilter = f;
  document.querySelectorAll('#tab-orders .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderOrders();
}

function renderOrders() {
  const search = document.getElementById('orders-search')?.value.toLowerCase().trim() || '';
  let fl = orders.filter(o => {
    if (orderFilter !== 'all' && o.status !== orderFilter) return false;
    if (search) {
      const matchName = (o.name || '').toLowerCase().includes(search);
      const matchId = (o.orderId || '').toLowerCase().includes(search);
      const matchItems = (o.items || '').toLowerCase().includes(search);
      const matchAddress = (o.address || '').toLowerCase().includes(search);
      if (!matchName && !matchId && !matchItems && !matchAddress) return false;
    }
    return true;
  });

  const pending = orders.filter(o => o.status === 'Pending').length;
  const delivering = orders.filter(o => o.status === 'Delivering').length;
  const delivered = orders.filter(o => o.status === 'Delivered').length;
  const rev = orders.filter(o => o.status === 'Delivered').reduce((s, o) => s + Number(o.total || 0), 0);
  const canViewRev = hasPerm('viewRevenue');

  document.getElementById('orders-metrics').innerHTML = `
    <div class="metric-card"><div class="metric-label">Pending</div><div class="metric-value" style="color:var(--amber)">${pending}</div></div>
    <div class="metric-card"><div class="metric-label">Out for delivery</div><div class="metric-value" style="color:var(--purple)">${delivering}</div></div>
    <div class="metric-card"><div class="metric-label">Delivered</div><div class="metric-value metric-accent">${delivered}</div></div>
    <div class="metric-card"><div class="metric-label">Delivery revenue</div><div class="metric-value metric-accent">${canViewRev ? '₹' + rev.toLocaleString('en-IN') : '🔒'}</div></div>`;

  const list = document.getElementById('orders-list');
  if (!fl.length) { list.innerHTML = `<div class="empty" style="padding:1.5rem 0"><div class="empty-icon">📦</div>No orders found.</div>`; return; }

  const canUpdate = hasPerm('updateOrder');
  list.innerHTML = fl.map(o => {
    const d = new Date(o.date);
    const ds = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const statuses = ['Pending', 'Confirmed', 'Delivering', 'Delivered', 'Cancelled'];
    const waNum = (o.phone || '').replace(/[^0-9]/g, '');
    return `<div class="order-row">
      <div class="order-top"><div class="order-name">👤 ${o.name || 'Customer'} <span style="font-size:11px;color:var(--text3);font-weight:normal;margin-left:6px">#${o.orderId || '--'}</span></div><div class="order-amt">₹${Number(o.total || 0).toLocaleString('en-IN')}</div></div>
      <div class="order-meta">📍 ${o.address || '–'}${o.landmark ? ' · ' + o.landmark : ''} · ${ds}</div>
      ${o.items ? `<div class="order-items-text">🛍 ${o.items}</div>` : ''}
      <div class="order-footer">
        <span class="status-badge s-${o.status || 'Pending'}">${o.status || 'Pending'}</span>
        <span style="font-size:11px;color:var(--text3)">${o.payment || 'COD'}</span>
        ${canUpdate ? `<select class="form-control" style="padding:4px 8px;font-size:12px;width:auto;flex:1;min-width:130px" onchange="updateOrderStatus('${o.id}',this.value)">${statuses.map(s => `<option ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>` : ''}
        ${o.locationLink ? `<button class="btn" style="padding:5px 10px;font-size:12px;background:var(--amber-light);color:var(--amber);border-color:var(--amber-light)" onclick="window.open('${o.locationLink}','_blank')">📍 Location</button>` : ''}
        ${waNum ? `<button class="btn btn-wa" style="padding:5px 10px;font-size:12px" onclick="window.open('https://wa.me/${waNum}','_blank')">💬</button>` : ''}
        <button class="btn" style="padding:5px 10px;font-size:12px;background:var(--blue-light);color:var(--blue);border-color:var(--blue-light)" onclick="openOrderInvoice('${o.id}')">🧾 Invoice</button>
        ${isAdmin() || hasPerm('addOrder') ? `<button class="btn btn-danger" style="padding:5px 8px;font-size:12px" onclick="deleteOrder('${o.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg></button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function openOrderModal() {
  if (!hasPerm('addOrder')) { toast('No permission'); return; }
  editingOrderId = null;
  document.getElementById('order-modal-title').textContent = 'New delivery order';
  document.getElementById('om-save-btn').textContent = 'Save order';
  ['om-name', 'om-phone', 'om-total', 'om-address', 'om-landmark', 'om-location', 'om-items'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('om-status').value = 'Pending';
  document.getElementById('om-payment').value = 'COD';
  document.getElementById('om-qty').value = '1';
  renderOrderBagSelect();
  document.getElementById('order-modal').classList.remove('hidden');
}

function renderOrderBagSelect() {
  const sel = document.getElementById('om-bag');
  sel.innerHTML = '<option value="">-- No stock deduction --</option>' +
    bags.filter(b => Number(b.stock) > 0).map(b => `<option value="${b.id}">${b.name} (${b.weight})</option>`).join('');
}

function onOrderBagSelect() {
  const bag = bags.find(b => b.id === document.getElementById('om-bag').value);
  if (bag) {
    document.getElementById('om-total').value = bag.price * Number(document.getElementById('om-qty').value);
    document.getElementById('om-items').value = `${document.getElementById('om-qty').value} x ${bag.name} (${bag.weight})`;
  }
}

function updateOrderTotal() {
  const bag = bags.find(b => b.id === document.getElementById('om-bag').value);
  if (bag) document.getElementById('om-total').value = bag.price * Number(document.getElementById('om-qty').value);
}

async function saveOrder() {
  const name = document.getElementById('om-name').value.trim();
  if (!name) { toast('Customer name required'); return; }
  const { addDoc, updateDoc, increment } = window._fb;
  const bagId = document.getElementById('om-bag').value;
  const bag = bags.find(b => b.id === bagId);
  const qty = Number(document.getElementById('om-qty').value) || 1;
  if (bag && qty > Number(bag.stock)) { toast(`Not enough stock! Only ${bag.stock} left.`); return; }
  const total = Number(document.getElementById('om-total').value) || 0;
  const orderId = editingOrderId ? (orders.find(o => o.id === editingOrderId)?.orderId || 'ORD-' + Date.now().toString().slice(-8)) : 'ORD-' + Date.now().toString().slice(-8);
  const invoiceNo = editingOrderId ? (orders.find(o => o.id === editingOrderId)?.invoiceNo || 'INV-' + Date.now().toString().slice(-6)) : 'INV-' + Date.now().toString().slice(-6);

  const data = {
    name, phone: document.getElementById('om-phone').value.trim(),
    total, orderId, invoiceNo,
    address: document.getElementById('om-address').value.trim(),
    landmark: document.getElementById('om-landmark').value.trim(),
    locationLink: document.getElementById('om-location').value.trim(),
    items: document.getElementById('om-items').value.trim(),
    status: document.getElementById('om-status').value,
    payment: document.getElementById('om-payment').value,
    date: Date.now(),
    bagId: bagId || '', bagName: bag ? bag.name : '', weight: bag ? bag.weight : '',
    qty, costPerBag: bag ? (Number(bag.cost) || 0) : 0,
    pricePerBag: bag ? (Number(bag.price) || 0) : (total / qty),
    saleRecorded: false
  };
  document.getElementById('om-save-btn').textContent = 'Saving...';
  if (editingOrderId) {
    await updateDoc(shopDoc('orders', editingOrderId), data);
    if (data.status === 'Delivered') await updateOrderStatus(editingOrderId, 'Delivered');
  } else {
    if (bagId) await updateDoc(shopDoc('bags', bagId), { stock: increment(-qty) });
    const orderRef = await addDoc(shopCol('orders'), data);
    if (data.status === 'Delivered') await updateOrderStatus(orderRef.id, 'Delivered');
  }
  closeModal('order-modal');
  toast(editingOrderId ? 'Order updated!' : 'Order added!');
}

async function updateOrderStatus(id, status) {
  const { updateDoc, addDoc, increment } = window._fb;
  const order = orders.find(o => o.id === id);
  if (!order) return;
  const prevStatus = order.status;
  await updateDoc(shopDoc('orders', id), { status });

  if (status === 'Cancelled' && prevStatus !== 'Cancelled') {
    if (order.bagId) await updateDoc(shopDoc('bags', order.bagId), { stock: increment(Number(order.qty) || 1) });
  }

  if (status === 'Delivered') {
    if (order && !order.saleRecorded) {
      const qty = Number(order.qty) || 1;
      const price = Number(order.pricePerBag) || (Number(order.total) / qty) || 0;
      const cost = Number(order.costPerBag) || 0;
      const sale = {
        bagId: order.bagId || 'manual', bagName: order.bagName || 'Manual Order', weight: order.weight || '',
        costPerBag: cost, pricePerBag: price, qty, total: Number(order.total) || 0,
        profit: (price - cost) * qty, invoiceNo: order.invoiceNo || '', orderId: order.orderId || '', locationLink: order.locationLink || '',
        customer: order.name, phone: order.phone, type: 'delivery',
        date: Date.now(), recordedBy: currentUser?.email || ''
      };
      await addDoc(shopCol('sales'), sale);
      await updateDoc(shopDoc('orders', id), { saleRecorded: true });
    }
  }
  toast('Status: ' + status);
}

async function deleteOrder(id) {
  if (!confirm('Delete order?')) return;
  const { deleteDoc } = window._fb;
  await deleteDoc(shopDoc('orders', id));
  toast('Order deleted');
}
