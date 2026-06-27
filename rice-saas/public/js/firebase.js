// ═══════════════════════════════════════════════════════
// firebase.js — Real-time listeners
//
// CHANGED FOR MULTI-TENANT: every collection() call below
// is now shopCol('name') instead of collection(window._db,'name').
// That single change is what makes Shop A never see Shop B's data.
// ═══════════════════════════════════════════════════════

function listenBags() {
  const { onSnapshot } = window._fb;
  unsubBags = onSnapshot(shopCol('bags'), snap => {
    bags = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderStock(); renderRecordForm(); renderWA();
  });
}

function listenSales() {
  const { onSnapshot } = window._fb;
  unsubSales = onSnapshot(shopCol('sales'), snap => {
    sales = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.date - a.date);
    renderSales();
  });
}

function listenOrders() {
  const { onSnapshot } = window._fb;
  unsubOrders = onSnapshot(shopCol('orders'), snap => {
    orders = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.date - a.date);
    renderOrders();
  });
}

function listenCustomers() {
  const { onSnapshot } = window._fb;
  unsubCustomers = onSnapshot(shopCol('customers'), snap => {
    customers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderCustomers();
  });
}

function listenUsers() {
  if (!isAdmin()) return;
  const { onSnapshot } = window._fb;
  unsubUsers = onSnapshot(shopCol('users'), snap => {
    users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderPermissions();
  });
}

function listenOpenedBags() {
  const { onSnapshot } = window._fb;
  onSnapshot(shopCol('openedBags'), snap => {
    openedBags = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(ob => Number(ob.remainingKg || 0) > 0)
      .sort((a, b) => b.openedAt - a.openedAt);
    renderStock();
  });
}

// ── Live shop info (so a subscription change reflects instantly) ──
function listenShopInfo() {
  const { onSnapshot } = window._fb;
  unsubShopInfo = onSnapshot(shopInfoRef(), snap => {
    if (!snap.exists()) return;
    currentShopData = snap.data();
    settings.shopName       = currentShopData.name || 'Rice Shop';
    settings.city            = currentShopData.city || '';
    settings.waNumber        = currentShopData.waNumber || '';
    settings.deliveryCharge  = Number(currentShopData.deliveryCharge) || 0;
    const nameDisplay = document.getElementById('shop-name-display');
    if (nameDisplay) nameDisplay.innerHTML = `🌾 <span>${settings.shopName}</span>`;
    // If subscription just expired while the app is open, lock immediately
    if (!isSuperAdmin() && !isSubscriptionActive()) {
      showLockedScreen();
    }
    renderBillingTab();
  });
}
