// ═══════════════════════════════════════════════════════
// superadmin.js — Platform owner tools (NEW)
//
// Only visible to emails in SUPER_ADMIN_EMAILS (tenant.js).
// This is where you manually onboard a new shop, per the
// "I manually create accounts for each shop owner" choice.
//
// Creating a shop does three things atomically (via Cloud
// Function createShopWithOwner — see functions/index.js):
//   1. Creates the Firebase Auth user for the shop owner
//   2. Writes shops/{shopId}/info  (name, city, trial dates)
//   3. Writes shops/{shopId}/users/{ownerUid} with role 'owner'
//   4. Writes userShopMap/{ownerUid} → {shopId}
// All four steps run server-side so there's no window where
// a half-created shop exists, and your own session as the
// platform owner is never disturbed.
// ═══════════════════════════════════════════════════════

async function renderSuperAdminTab() {
  if (!isSuperAdmin()) return;

  // One-time bootstrap: stamp the superAdmin custom claim used by
  // firestore.rules (isPlatformSuperAdmin()). Safe to call repeatedly —
  // the Cloud Function just re-sets the same claim — but we skip it
  // after the first successful call per browser to avoid the extra
  // round-trip every time you open this tab.
  if (!localStorage.getItem('_superAdminClaimSet')) {
    try {
      const { httpsCallable } = window._fb;
      const call = httpsCallable(window._functions, 'setSuperAdminClaim');
      await call({});
      localStorage.setItem('_superAdminClaimSet', '1');
      // Token needs a refresh to pick up the new claim
      await window._auth.currentUser.getIdToken(true);
    } catch (e) {
      console.warn('Could not set super admin claim yet:', e.message);
    }
  }

  const { getDocs, collection } = window._fb;
  const box = document.getElementById('superadmin-shops-list');
  box.innerHTML = `<div class="empty" style="padding:1rem 0">Loading shops...</div>`;
  try {
    const snap = await getDocs(collection(window._db, 'shops'));
    const shops = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!shops.length) { box.innerHTML = `<div class="empty"><div class="empty-icon">🏪</div>No shops yet. Create the first one above.</div>`; return; }
    box.innerHTML = shops.map(s => {
      const status = s.subscriptionStatus || 'trial';
      const statusColor = status === 'active' ? 'pill-ok' : status === 'trial' ? 'pill-low' : 'pill-out';
      return `<div class="perm-user-card">
        <div class="perm-user-top">
          <div>
            <div class="perm-user-name">${s.name || s.id}</div>
            <div style="font-size:12px;color:var(--text3)">${s.city || ''} · ${s.ownerEmail || ''}</div>
          </div>
          <span class="stock-pill ${statusColor}">${status}</span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
          <button class="btn" style="font-size:12px" onclick="extendTrial('${s.id}')">+7 day trial</button>
          <button class="btn" style="font-size:12px" onclick="forceActivate('${s.id}')">Mark active (90 days)</button>
          <button class="btn btn-danger" style="font-size:12px" onclick="forceExpire('${s.id}')">Mark expired</button>
        </div>
      </div>`;
    }).join('');
  } catch (e) {
    box.innerHTML = `<div class="empty">Could not load shops: ${e.message}</div>`;
  }
}

function openCreateShopModal() {
  ['cs-shopname', 'cs-city', 'cs-owner-name', 'cs-owner-email', 'cs-owner-pass'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('cs-error').style.display = 'none';
  document.getElementById('create-shop-modal').classList.remove('hidden');
}

async function createShopWithOwner() {
  const shopName = document.getElementById('cs-shopname').value.trim();
  const city = document.getElementById('cs-city').value.trim();
  const ownerName = document.getElementById('cs-owner-name').value.trim();
  const ownerEmail = document.getElementById('cs-owner-email').value.trim();
  const ownerPass = document.getElementById('cs-owner-pass').value;
  const errEl = document.getElementById('cs-error');
  errEl.style.display = 'none';

  if (!shopName || !ownerEmail || !ownerPass) { errEl.textContent = 'Shop name, owner email, and password are required.'; errEl.style.display = 'block'; return; }
  if (ownerPass.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; errEl.style.display = 'block'; return; }

  const btn = document.getElementById('cs-save-btn');
  btn.textContent = 'Creating shop...'; btn.disabled = true;

  try {
    const { httpsCallable } = window._fb;
    const callCreateShop = httpsCallable(window._functions, 'createShopWithOwner');
    await callCreateShop({ shopName, city, ownerName: ownerName || ownerEmail, ownerEmail, ownerPass });
    closeModal('create-shop-modal');
    toast(`Shop "${shopName}" created for ${ownerEmail}!`);
    renderSuperAdminTab();
  } catch (e) {
    errEl.textContent = e.message || 'Could not create shop.';
    errEl.style.display = 'block';
  } finally {
    btn.textContent = 'Create shop'; btn.disabled = false;
  }
}

// ── Subscription overrides — these MUST go through the
//    setShopSubscription Cloud Function, not a direct client
//    write. firestore.rules blocks any client write to
//    subscriptionStatus/subscriptionExpiresAt on purpose (so a
//    shop owner can't unlock themselves from the browser console);
//    the Cloud Function re-checks that the caller is the super
//    admin before touching anything. See functions/index.js.

async function extendTrial(shopId) {
  try {
    const { httpsCallable } = window._fb;
    const call = httpsCallable(window._functions, 'setShopSubscription');
    await call({ shopId, status: 'trial', extendDays: 7 });
    toast('Trial extended by 7 days');
  } catch (e) { toast(e.message || 'Could not update subscription'); }
  renderSuperAdminTab();
}

async function forceActivate(shopId) {
  try {
    const { httpsCallable } = window._fb;
    const call = httpsCallable(window._functions, 'setShopSubscription');
    await call({ shopId, status: 'active', extendDays: 90 });
    toast('Marked active for 90 days');
  } catch (e) { toast(e.message || 'Could not update subscription'); }
  renderSuperAdminTab();
}

async function forceExpire(shopId) {
  if (!confirm('Lock this shop out immediately?')) return;
  try {
    const { httpsCallable } = window._fb;
    const call = httpsCallable(window._functions, 'setShopSubscription');
    await call({ shopId, status: 'expired' });
    toast('Shop marked expired');
  } catch (e) { toast(e.message || 'Could not update subscription'); }
  renderSuperAdminTab();
}
