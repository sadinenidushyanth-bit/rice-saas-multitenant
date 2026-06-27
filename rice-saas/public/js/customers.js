// ═══════════════════════════════════════════════════════
// customers.js — Customer list and management
// CHANGED FOR MULTI-TENANT: writes via shopDoc()/shopCol()
// ═══════════════════════════════════════════════════════

function renderCustomers() {
  const total = customers.length;
  const withOrders = customers.filter(c => c.totalOrders > 0).length;
  document.getElementById('customers-metrics').innerHTML = `
    <div class="metric-card"><div class="metric-label">Total customers</div><div class="metric-value metric-accent">${total}</div></div>
    <div class="metric-card"><div class="metric-label">Repeat customers</div><div class="metric-value">${withOrders}</div></div>`;
  const list = document.getElementById('customers-list');
  if (!customers.length) { list.innerHTML = `<div class="empty" style="padding:1.5rem 0"><div class="empty-icon">👥</div>No customers saved yet.</div>`; return; }
  list.innerHTML = customers.map(c => {
    const init = (c.name || '?').charAt(0).toUpperCase();
    const waNum = (c.phone || '').replace(/[^0-9]/g, '');
    return `<div class="customer-row">
      <div class="cust-avatar">${init}</div>
      <div class="cust-info"><div class="cust-name">${c.name}</div><div class="cust-meta">${c.phone || 'No number'} ${c.area ? '· ' + c.area : ''}</div></div>
      ${waNum ? `<button class="cust-wa" onclick="window.open('https://wa.me/${waNum}','_blank')">💬 WhatsApp</button>` : ''}
    </div>`;
  }).join('');
}

function openCustomerModal() {
  if (!hasPerm('addCustomer')) { toast('No permission'); return; }
  editingCustId = null;
  document.getElementById('cust-modal-title').textContent = 'Add customer';
  document.getElementById('cm-save-btn').textContent = 'Save';
  ['cm-name', 'cm-phone', 'cm-area', 'cm-notes'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('customer-modal').classList.remove('hidden');
}

async function saveCustomer() {
  const name = document.getElementById('cm-name').value.trim();
  const phone = document.getElementById('cm-phone').value.trim();
  if (!name) { toast('Name required'); return; }
  const data = { name, phone, area: document.getElementById('cm-area').value.trim(), notes: document.getElementById('cm-notes').value.trim(), totalOrders: 0, createdAt: Date.now() };
  const { addDoc, updateDoc } = window._fb;
  document.getElementById('cm-save-btn').textContent = 'Saving...';
  if (editingCustId) await updateDoc(shopDoc('customers', editingCustId), data);
  else await addDoc(shopCol('customers'), data);
  closeModal('customer-modal');
  toast('Customer saved!');
}
