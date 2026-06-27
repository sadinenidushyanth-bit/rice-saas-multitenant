// ═══════════════════════════════════════════════════════
// tabs.js — Tab navigation
// ═══════════════════════════════════════════════════════

function showTab(name) {
  const tabs = ['stock', 'sales', 'record', 'orders', 'whatsapp', 'customers', 'profit', 'permissions', 'billing', 'settings', 'superadmin'];
  const tabPermMap = {
    sales: 'sales', record: 'record', orders: 'orders', whatsapp: 'whatsapp',
    customers: 'customers', profit: 'profit', permissions: 'permissions',
    billing: 'billing', settings: 'settings'
  };

  if (name === 'superadmin' && !isSuperAdmin()) { toast('Platform access only.'); return; }
  if (name !== 'superadmin' && tabPermMap[name] && !hasPerm(tabPermMap[name]) && !isAdmin()) {
    toast('You do not have access to this tab.'); return;
  }

  tabs.forEach(t => {
    const el = document.getElementById('tab-' + t);
    if (el) el.classList.toggle('hidden', t !== name);
    const btn = document.getElementById('nav-' + t);
    if (btn) btn.classList.toggle('active', t === name);
  });

  if (name === 'whatsapp')    { renderWA(); buildMorningMessage(); }
  if (name === 'permissions') renderPermissions();
  if (name === 'settings')    renderSettings();
  if (name === 'customers')   renderCustomers();
  if (name === 'profit')      renderProfit();
  if (name === 'record')      renderRecordForm();
  if (name === 'billing')     renderBillingTab();
  if (name === 'superadmin')  renderSuperAdminTab();
}
