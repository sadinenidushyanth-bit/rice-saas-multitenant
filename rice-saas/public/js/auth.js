// ═══════════════════════════════════════════════════════
// auth.js — Login, logout, permission checks
//
// CHANGED FOR MULTI-TENANT:
//   After Firebase Auth confirms the user, we now resolve
//   their shopId from userShopMap before loading any data.
//   If no shop is found, or the shop's subscription has
//   lapsed, the user never reaches the dashboard.
// ═══════════════════════════════════════════════════════

function startApp() {
  if (window._appStarted) return;
  if (!window._fb || !window._auth) { setTimeout(startApp, 80); return; }
  window._appStarted = true;

  const btn = document.getElementById('login-btn');
  const authTimeout = setTimeout(() => {
    if (btn) { btn.textContent = 'Sign in'; btn.disabled = false; }
  }, 5000);

  window._fb.onAuthStateChanged(window._auth, async user => {
    clearTimeout(authTimeout);
    if (btn) { btn.textContent = 'Sign in'; btn.disabled = false; }

    if (user) {
      currentUser = user;

      // ── 1. Resolve shopId for this user ──
      const shopId = await resolveShopForUser(user.uid);

      if (!shopId && !isSuperAdmin()) {
        // No shop assigned and not the platform owner — nothing to show
        currentShopId = null;
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('locked-screen').classList.add('hidden');
        document.getElementById('app').classList.add('hidden');
        document.getElementById('auth-error').textContent = 'Your account is not linked to any shop yet. Contact the platform owner.';
        document.getElementById('auth-error').style.display = 'block';
        return;
      }

      currentShopId = shopId; // may be null for super admin with no personal shop

      if (currentShopId) {
        await loadShopInfo();
        await loadUserData(user.uid);

        // ── 2. Subscription gate ──
        if (!isSuperAdmin() && !isSubscriptionActive()) {
          showLockedScreen();
          return;
        }
      }

      document.getElementById('auth-screen').classList.add('hidden');
      document.getElementById('locked-screen').classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');
      applyPermissions();

      if (currentShopId) {
        listenBags(); listenSales(); listenOrders(); listenCustomers(); listenUsers(); listenOpenedBags();
        listenShopInfo();
        showTab('stock');
      } else {
        // Super admin with no shop of their own — land on Platform tab
        showTab('superadmin');
      }

    } else {
      currentUser = null; currentUserData = null; currentShopId = null; currentShopData = null;
      document.getElementById('auth-screen').classList.remove('hidden');
      document.getElementById('locked-screen').classList.add('hidden');
      document.getElementById('app').classList.add('hidden');
    }
  });
}

if (window._fbReady) startApp();
else document.addEventListener('firebase-ready', startApp);

async function loadUserData(uid) {
  const { getDoc } = window._fb;
  const snap = await getDoc(shopDoc('users', uid));
  if (snap.exists()) {
    currentUserData = snap.data();
  } else {
    // Should not normally happen — a shop's first user is created by
    // the super admin via createShopWithOwner(). Fallback: treat as owner.
    currentUserData = { name: currentUser.email, email: currentUser.email, role: 'owner', permissions: getAdminPerms() };
  }
  const badge = document.getElementById('user-badge');
  const roleTag = currentUserData.role === 'owner' ? ' 👑' : '';
  badge.textContent = (currentUserData.name || currentUserData.email || 'User') + roleTag;
  badge.className = 'user-badge' + (currentUserData.role === 'owner' ? '' : ' worker');
}

function getAdminPerms() {
  const p = {};
  Object.keys(ALL_PERMS).forEach(k => p[k] = true);
  return p;
}

// "isAdmin" kept as a name for backward compatibility with existing render
// functions — within a shop, the owner role plays the admin role.
function isAdmin() {
  return currentUserData?.role === 'owner' || isSuperAdmin();
}

function hasPerm(p) {
  if (isAdmin()) return true;
  return currentUserData?.permissions?.[p] === true;
}

function applyPermissions() {
  const tabMap = {
    'nav-stock': 'stock', 'nav-sales': 'sales', 'nav-record': 'record',
    'nav-orders': 'orders', 'nav-whatsapp': 'whatsapp', 'nav-customers': 'customers',
    'nav-profit': 'profit', 'nav-permissions': 'permissions', 'nav-billing': 'billing',
    'nav-settings': 'settings',
  };
  Object.entries(tabMap).forEach(([navId, perm]) => {
    const el = document.getElementById(navId);
    if (!el) return;
    if (!currentShopId) { el.classList.add('hidden'); return; }
    if (hasPerm(perm)) { el.classList.remove('hidden', 'locked'); }
    else { el.classList.add('locked'); }
  });
  if (!isAdmin()) document.getElementById('nav-permissions').classList.add('hidden');
  if (!isAdmin()) document.getElementById('nav-billing').classList.add('hidden');

  // Platform tab — super admin only
  const superNav = document.getElementById('nav-superadmin');
  if (isSuperAdmin()) superNav.classList.remove('hidden');
  else superNav.classList.add('hidden');

  const addBagBtn = document.getElementById('btn-add-bag');
  if (addBagBtn && !hasPerm('addEditBag')) addBagBtn.classList.add('hidden');
  const looseSaleBtn = document.getElementById('btn-sell-loose-quick');
  if (looseSaleBtn && !hasPerm('record')) looseSaleBtn.classList.add('hidden');
}

async function doLogin() {
  if (!window._fb || !window._auth) { toast('Still connecting, please wait...'); return; }
  const loginVal = document.getElementById('auth-email').value.trim();
  const pass     = document.getElementById('auth-pass').value;
  const errEl    = document.getElementById('auth-error');
  const btn      = document.getElementById('login-btn');
  errEl.style.display = 'none';

  if (!loginVal) { errEl.textContent = 'Please enter your email address.'; errEl.style.display = 'block'; return; }
  if (!pass)     { errEl.textContent = 'Please enter your password.'; errEl.style.display = 'block'; return; }
  if (!loginVal.includes('@')) {
    errEl.innerHTML = '⚠️ Please enter your <strong>email address</strong> (e.g. name@gmail.com).';
    errEl.style.display = 'block'; return;
  }

  btn.textContent = 'Signing in...'; btn.disabled = true;
  try {
    await window._fb.signInWithEmailAndPassword(window._auth, loginVal, pass);
  } catch (e) {
    const c = e.code || '';
    let msg = '❌ Login failed. Please try again.';
    if (c === 'auth/invalid-credential' || c === 'auth/wrong-password' || c === 'auth/user-not-found' || c === 'auth/invalid-email')
      msg = '❌ Wrong email or password. Please check and try again.';
    else if (c === 'auth/too-many-requests') msg = '⚠️ Too many attempts. Wait a few minutes and try again.';
    else if (c === 'auth/network-request-failed') msg = '⚠️ No internet. Check your WiFi or mobile data.';
    else if (c === 'auth/user-disabled') msg = '❌ Account disabled. Contact your admin.';
    errEl.textContent = msg; errEl.style.display = 'block';
    btn.textContent = 'Sign in'; btn.disabled = false;
  }
}

function toggleAuthPass(btn) {
  const inp = document.getElementById('auth-pass');
  if (inp.type === 'password') { inp.type = 'text'; btn.textContent = 'Hide'; }
  else { inp.type = 'password'; btn.textContent = 'Show'; }
}

async function doLogout() {
  const { signOut } = window._fb;
  if (unsubBags) unsubBags();
  if (unsubSales) unsubSales();
  if (unsubOrders) unsubOrders();
  if (unsubCustomers) unsubCustomers();
  if (unsubUsers) unsubUsers();
  if (unsubShopInfo) unsubShopInfo();
  await signOut(window._auth);
}
