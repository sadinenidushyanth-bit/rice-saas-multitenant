// ═══════════════════════════════════════════════════════
// tenant.js — Multi-tenant core
//
// EVERYTHING in this app is now scoped under:
//   shops/{shopId}/<collection>/{docId}
//
// currentShopId is resolved once at login from the top-level
// userShopMap/{uid} document, then every Firestore call in
// every other file goes through shopCol() / shopDoc() below
// instead of calling collection()/doc() directly on window._db.
//
// This file must load BEFORE any other feature file.
// ═══════════════════════════════════════════════════════

let currentShopId   = null;
let currentShopData = null; // { name, city, waNumber, deliveryCharge, subscriptionStatus, ... }

const SUPER_ADMIN_EMAILS = ['sadinenidushaynth@gmail.com'];

function isSuperAdmin() {
  return currentUser && SUPER_ADMIN_EMAILS.includes(currentUser.email);
}

// ── Path helpers used by every other JS file ──────────
// Always call these instead of collection(window._db, 'bags') directly.
function shopCol(name) {
  const { collection, doc } = window._fb;
  if (!currentShopId) throw new Error('No shop context — cannot access ' + name);
  return collection(doc(collection(window._db, 'shops'), currentShopId), name);
}

function shopDoc(name, id) {
  const { doc } = window._fb;
  if (!currentShopId) throw new Error('No shop context — cannot access ' + name + '/' + id);
  return doc(shopCol(name), id);
}

function shopInfoRef() {
  const { doc, collection } = window._fb;
  if (!currentShopId) throw new Error('No shop context');
  return doc(collection(window._db, 'shops'), currentShopId);
}

// ── Resolve which shop the logged-in user belongs to ──
// userShopMap/{uid} = { shopId: '...', role: 'owner'|'worker' }
async function resolveShopForUser(uid) {
  const { doc, getDoc } = window._fb;
  const mapSnap = await getDoc(doc(window._db, 'userShopMap', uid));
  if (!mapSnap.exists()) return null;
  return mapSnap.data().shopId;
}

// ── Load shop info (name, city, subscription status, etc.) ──
async function loadShopInfo() {
  const { getDoc } = window._fb;
  const snap = await getDoc(shopInfoRef());
  if (snap.exists()) {
    currentShopData = snap.data();
  } else {
    currentShopData = { name: 'Rice Shop', city: '', waNumber: '', deliveryCharge: 0, subscriptionStatus: 'trial' };
  }
  // Reflect into the legacy `settings` object used by stock/sales/whatsapp renderers
  settings.shopName       = currentShopData.name || 'Rice Shop';
  settings.city           = currentShopData.city || '';
  settings.waNumber       = currentShopData.waNumber || '';
  settings.deliveryCharge = Number(currentShopData.deliveryCharge) || 0;

  const nameDisplay = document.getElementById('shop-name-display');
  if (nameDisplay) nameDisplay.innerHTML = `🌾 <span>${settings.shopName}</span>`;
}

// ── Subscription gate ─────────────────────────────────
// Returns true if the shop is allowed to use the app right now.
function isSubscriptionActive() {
  if (!currentShopData) return false;
  const status = currentShopData.subscriptionStatus;
  if (status === 'active') return true;
  if (status === 'trial') {
    const trialEnds = Number(currentShopData.trialEndsAt || 0);
    return Date.now() < trialEnds;
  }
  return false; // 'expired', 'cancelled', or missing
}

function showLockedScreen(message) {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('locked-screen').classList.remove('hidden');
  if (message) document.getElementById('locked-message').textContent = message;
}
