// ═══════════════════════════════════════════════════════
// settings.js — Shop settings
//
// CHANGED FOR MULTI-TENANT: previously these lived in
// localStorage on the device. They now live in
// shops/{shopId}/info so every device/worker for the shop
// sees the same shop name, WhatsApp number, etc. — and so
// Shop A's settings can never leak into Shop B.
// ═══════════════════════════════════════════════════════

function renderSettings() {
  document.getElementById('set-shopname').value = settings.shopName || '';
  document.getElementById('set-wanum').value = settings.waNumber || '';
  document.getElementById('set-city').value = settings.city || '';
  document.getElementById('set-delivery').value = settings.deliveryCharge || '';
}

async function saveSettings() {
  if (!hasPerm('settings')) { toast('No permission'); return; }
  settings.shopName = document.getElementById('set-shopname').value.trim() || 'Rice Shop';
  settings.waNumber = document.getElementById('set-wanum').value.trim();
  settings.city = document.getElementById('set-city').value.trim() || 'Tuni';
  settings.deliveryCharge = Number(document.getElementById('set-delivery').value) || 0;

  const { updateDoc } = window._fb;
  await updateDoc(shopInfoRef(), {
    name: settings.shopName,
    waNumber: settings.waNumber,
    city: settings.city,
    deliveryCharge: settings.deliveryCharge,
  });

  document.getElementById('shop-name-display').innerHTML = `🌾 <span>${settings.shopName}</span>`;
  toast('Settings saved!');
}
