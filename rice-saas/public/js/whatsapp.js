// ═══════════════════════════════════════════════════════
// whatsapp.js — Morning message, broadcast, order link
// NOT directly shop-scoped here — it only reads bags/sales/
// customers arrays which are already filtered per-shop by
// the listeners in firebase.js.
// ═══════════════════════════════════════════════════════

function buildMorningMessage() {
  const shopName = settings.shopName || 'Rice Shop';
  const city = settings.city || 'Tuni';
  const inStock = bags.filter(b => Number(b.stock) > 0);
  const now = new Date();
  const day = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  document.getElementById('morning-date').textContent = day;

  const offer = generateSmartOffer();
  let msg = `🌾 *${shopName} – ${city}*\n📅 ${day}\n━━━━━━━━━━━━━━━━━\n📦 *Today's Available Stock:*\n\n`;
  if (!inStock.length) msg += `_No bags available right now. Please check tomorrow._\n`;
  else inStock.forEach(b => { msg += `✅ *${b.name}* (${b.weight}) — ₹${Number(b.price).toLocaleString('en-IN')}/bag  [${b.stock} bags]\n`; });
  if (offer) msg += `\n🎁 *Today's Special:*\n${offer}\n`;
  msg += `\n🛵 *Home delivery available*\nReply with name, address & items to order.\n\n_Fresh rice, delivered to your door_ 🙏`;
  document.getElementById('morning-offer').textContent = offer || 'No special offer today — all prices as listed.';
  window._morningMsg = msg;
}

function generateSmartOffer() {
  if (!bags.length || !sales.length) return '';
  const week = Date.now() - 7 * 86400000;
  const recent = sales.filter(s => s.date > week);
  if (!recent.length) return '';
  const counts = {};
  recent.forEach(s => { counts[s.bagName] = (counts[s.bagName] || 0) + s.qty; });
  const topName = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topBag = bags.find(b => b.name === topName);
  if (!topBag || Number(topBag.stock) < 3) return '';
  const qty = Number(topBag.stock);
  const price = Number(topBag.price);
  const offers = [
    `Buy 2 bags of *${topBag.name}* (${topBag.weight}) & get FREE home delivery! 🚚`,
    `*${topBag.name}* is our best seller this week! Only ₹${price.toLocaleString('en-IN')} per bag. ${qty} bags left — order now!`,
    `*${topBag.name}* (${topBag.weight}) @ ₹${price.toLocaleString('en-IN')} — Fresh stock, limited quantity! 🌾`,
  ];
  return offers[Math.floor(Date.now() / 3600000) % offers.length];
}

function regenerateOffer() { buildMorningMessage(); renderWA(); toast('Message refreshed!'); }

function renderWA() {
  const shopName = settings.shopName || 'Rice Shop';
  const city = settings.city || 'Tuni';
  const inStock = bags.filter(b => Number(b.stock) > 0);
  const outStock = bags.filter(b => Number(b.stock) === 0);
  let msg = `🌾 *${shopName} – ${city}*\n📦 *Today's Stock & Prices*\n━━━━━━━━━━━━━━━━━\n`;
  if (!inStock.length) msg += `_No bags available right now_\n`;
  else inStock.forEach(b => { msg += `✅ ${b.name} (${b.weight}) — ₹${Number(b.price).toLocaleString('en-IN')}\n`; });
  if (outStock.length) msg += `\n❌ *Not available:* ${outStock.map(b => b.name).join(', ')}\n`;
  msg += `\n🛵 *Home delivery available*\nReply with name, address & items to order.\n\n_Fresh rice, delivered to your door 🙏_`;
  document.getElementById('wa-msg').textContent = msg;
  document.getElementById('wa-time').textContent = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const avail = inStock.map(b => `${b.name} (${b.weight}) ₹${b.price}`).join(', ');
  document.getElementById('wa-order-msg').textContent = `Hi! I want to order rice 🙏\n\n*Name:* \n*Address:* \n*Items:* \n\n_Available: ${avail || 'Please check with shop'}_`;
  window._broadcastMsg = msg;
}

function openSendModal(type) {
  sendMsgType = type;
  document.getElementById('send-modal').classList.remove('hidden');
  renderCustomerSelectList();
}

function renderCustomerSelectList() {
  const list = document.getElementById('cust-select-list');
  if (!customers.length) {
    list.innerHTML = `<div style="padding:16px;text-align:center;color:var(--text3);font-size:13px">No customers saved yet.</div>`;
    updateSelectedCount(); return;
  }
  list.innerHTML = customers.map(c => `
    <div class="cust-select-row" id="csr-${c.id}" onclick="toggleCustSelect('${c.id}')">
      <input type="checkbox" id="chk-${c.id}" onclick="event.stopPropagation();toggleCustSelect('${c.id}')">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600">${c.name}</div>
        <div style="font-size:11px;color:var(--text3)">${c.phone || 'No number'} ${c.area ? '· ' + c.area : ''}</div>
      </div>
    </div>`).join('');
  updateSelectedCount();
}

function toggleCustSelect(id) {
  const chk = document.getElementById('chk-' + id);
  const row = document.getElementById('csr-' + id);
  chk.checked = !chk.checked;
  row.classList.toggle('selected', chk.checked);
  updateSelectedCount();
}

function selectAllCustomers(val) {
  customers.forEach(c => {
    const chk = document.getElementById('chk-' + c.id);
    const row = document.getElementById('csr-' + c.id);
    if (chk) { chk.checked = val; row.classList.toggle('selected', val); }
  });
  updateSelectedCount();
}

function updateSelectedCount() {
  const n = document.querySelectorAll('#cust-select-list input[type=checkbox]:checked').length;
  document.getElementById('selected-count').textContent = n > 0 ? `${n} selected` : '';
}

function sendToSelected() {
  const selected = customers.filter(c => { const chk = document.getElementById('chk-' + c.id); return chk && chk.checked; });
  if (!selected.length) { toast('Select at least one customer'); return; }
  const msg = sendMsgType === 'morning' ? (window._morningMsg || '') : (window._broadcastMsg || '');
  const encoded = encodeURIComponent(msg);
  selected.forEach((c, i) => {
    const num = (c.phone || '').replace(/[^0-9]/g, '');
    if (!num) return;
    setTimeout(() => { window.open(`https://wa.me/${num}?text=${encoded}`, '_blank'); }, i * 800);
  });
  toast(`Opening WhatsApp for ${selected.length} customer(s). Please allow pop-ups.`);
  setTimeout(() => closeModal('send-modal'), 1000);
}

function copyMsg() {
  navigator.clipboard.writeText(document.getElementById('wa-msg').textContent).then(() => toast('Message copied!'));
}
function shareOrderLink() {
  const ownerNum = (settings.waNumber || '').replace(/[^0-9]/g, '');
  const msg = document.getElementById('wa-order-msg').textContent;
  const url = ownerNum ? `https://wa.me/${ownerNum}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}
function copyOrderLink() {
  const ownerNum = (settings.waNumber || '').replace(/[^0-9]/g, '');
  const msg = document.getElementById('wa-order-msg').textContent;
  const url = ownerNum ? `https://wa.me/${ownerNum}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
  navigator.clipboard.writeText(url).then(() => toast('Order link copied!'));
}
