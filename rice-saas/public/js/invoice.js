// ═══════════════════════════════════════════════════════
// invoice.js — Invoice modal, WhatsApp send, print
// No Firestore calls here — purely renders from the `settings`
// object (already shop-scoped) and the sale/order passed in.
// ═══════════════════════════════════════════════════════

function showInvoice(sale) {
  currentInvoiceSale = sale;
  const shop = settings.shopName || 'Rice Shop';
  const city = settings.city || 'Tuni';
  const waNum = (settings.waNumber || '').replace(/[^0-9]/g, '');
  const d = new Date(sale.date);
  const ds = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const delivery = settings.deliveryCharge || 0;

  let itemsHtml = '';
  let grandTotal = 0;
  const isLoose = sale._isLoose || sale.saleMode === 'loose';
  const sBagName = sale._bagName || sale.bagName;
  const sQtyDisp = sale._qtyDisplay || sale.qtyDisplay || (sale.qty + ' bag(s)');
  const sPriceKg = sale._pricePerKg || sale.pricePerKg;
  const sSubtotal = sale._total || sale.total;

  if (isLoose) {
    grandTotal = Number(sSubtotal || 0) + delivery;
    itemsHtml = `
      <div class="inv-row"><span>${sBagName} (loose)</span><span>${sQtyDisp}</span></div>
      <div class="inv-row"><span>Price per kg</span><span>₹${Number(sPriceKg || 0).toLocaleString('en-IN')}/kg</span></div>
      ${delivery ? `<div class="inv-row"><span>Delivery charge</span><span>₹${delivery}</span></div>` : ''}
      <div class="inv-row bold total"><span>TOTAL</span><span>₹${grandTotal.toLocaleString('en-IN')}</span></div>`;
  } else if (sale._isOrder) {
    grandTotal = Number(sale.total || 0);
    itemsHtml = `
      <div class="inv-row"><span style="flex:1;white-space:pre-wrap">${sale._itemsText || 'As ordered'}</span></div>
      ${delivery ? `<div class="inv-row"><span>Delivery charge</span><span>₹${delivery}</span></div>` : ''}
      <div class="inv-row bold total"><span>TOTAL</span><span>₹${grandTotal.toLocaleString('en-IN')}</span></div>
      <div class="inv-row"><span>Payment</span><span>${sale._payment || 'COD'}</span></div>`;
  } else {
    const subtotal = Number(sale.pricePerBag || 0) * sale.qty;
    grandTotal = subtotal + delivery;
    itemsHtml = `
      <div class="inv-row"><span>${sale.bagName}${sale.weight ? ' (' + sale.weight + ')' : ''}</span><span>× ${sale.qty} bag(s)</span></div>
      <div class="inv-row"><span>Price per bag</span><span>₹${Number(sale.pricePerBag || 0).toLocaleString('en-IN')}</span></div>
      <div class="inv-row"><span>Subtotal</span><span>₹${subtotal.toLocaleString('en-IN')}</span></div>
      ${delivery ? `<div class="inv-row"><span>Delivery charge</span><span>₹${delivery}</span></div>` : ''}
      <div class="inv-row bold total"><span>TOTAL</span><span>₹${grandTotal.toLocaleString('en-IN')}</span></div>`;
  }

  document.getElementById('invoice-preview').innerHTML = `
    <div class="inv-header"><div class="inv-shop">🌾 ${shop}</div><div class="inv-sub">${city}${waNum ? ' · WhatsApp: +' + waNum : ''}</div></div>
    <div class="inv-body">
      <div class="inv-section"><div class="inv-label">Invoice details</div>
        <div class="inv-row"><span>Order ID</span><strong># ${sale.orderId || '--'}</strong></div>
        <div class="inv-row"><span>Invoice No.</span><strong>${sale.invoiceNo || '—'}</strong></div>
        <div class="inv-row"><span>Date & Time</span><span>${ds}</span></div>
      </div>
      <div class="inv-section"><div class="inv-label">Bill to</div>
        <div class="inv-row"><span>Name</span><strong>${sale.customer || '—'}</strong></div>
        <div class="inv-row"><span>Phone</span><span>${sale.phone || '—'}</span></div>
        ${sale.address ? `<div class="inv-row"><span>Address</span><span style="text-align:right;max-width:180px;font-size:12px">${sale.address}</span></div>` : ''}
      </div>
      <div class="inv-section"><div class="inv-label">Order items</div>${itemsHtml}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:12px;text-align:center;line-height:1.7;border-top:1px dashed var(--border);padding-top:10px">
        🌾 Thank you for your order, ${sale.customer || 'valued customer'}!<br>Fresh rice delivered to your door 🙏
      </div>
    </div>`;

  const waBtn = document.getElementById('invoice-wa-btn');
  waBtn.disabled = !sale.phone;
  document.getElementById('invoice-modal').classList.remove('hidden');
}

function sendInvoiceWA() {
  if (!currentInvoiceSale) return;
  const s = currentInvoiceSale;
  const shop = settings.shopName || 'Rice Shop';
  const city = settings.city || 'Tuni';
  const delivery = settings.deliveryCharge || 0;
  const dateStr = new Date(s.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  let itemsBlock = '';
  let grandTotal = 0;
  if (s._isLoose) {
    grandTotal = Number(s._total || 0) + delivery;
    itemsBlock = `⚖️ *Item:* ${s._bagName} (loose rice)\n📏 *Quantity:* ${s._qtyDisplay}\n💵 *Price:* ₹${Number(s._pricePerKg || 0).toLocaleString('en-IN')} per kg\nSubtotal: ₹${Number(s._total || 0).toLocaleString('en-IN')}\n${delivery ? `🚚 Delivery: ₹${delivery}\n` : ''}`;
  } else if (s._isOrder) {
    grandTotal = Number(s.total || 0);
    itemsBlock = `🛍 *Items:*\n${s._itemsText || 'As ordered'}\n${delivery ? `🚚 Delivery: ₹${delivery}\n` : ''}💳 Payment: ${s._payment || 'COD'}\n`;
  } else {
    const subtotal = Number(s.pricePerBag || 0) * s.qty;
    grandTotal = subtotal + delivery;
    itemsBlock = `🛍 *Item:* ${s.bagName}${s.weight ? ' (' + s.weight + ')' : ''}\n📦 *Qty:* ${s.qty} bag(s)\n💵 *Price:* ₹${Number(s.pricePerBag || 0).toLocaleString('en-IN')} per bag\nSubtotal: ₹${subtotal.toLocaleString('en-IN')}\n${delivery ? `🚚 Delivery: ₹${delivery}\n` : ''}`;
  }
  const msg = `🧾 *INVOICE*\n🌾 *${shop}* — ${city}\n━━━━━━━━━━━━━━━━\n📄 Invoice No: *${s.invoiceNo || '—'}*\n📅 Date: ${dateStr}\n\n👤 *Bill To*\nName: *${s.customer || '—'}*\nPhone: ${s.phone || '—'}\n${s.address ? `📍 Address: ${s.address}\n` : ''}\n${itemsBlock}━━━━━━━━━━━━━━━━\n💰 *TOTAL: ₹${grandTotal.toLocaleString('en-IN')}*\n\n_Thank you for your order! Fresh rice, delivered to your door 🌾🙏_`;
  const num = (s.phone || '').replace(/[^0-9]/g, '');
  if (!num) { toast('No customer phone number saved'); return; }
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank');
}

function printInvoice() {
  const s = currentInvoiceSale;
  if (!s) { toast('No invoice loaded'); return; }
  const shop = settings.shopName || 'Rice Shop';
  const city = settings.city || 'Tuni';
  const waNum = (settings.waNumber || '').replace(/[^0-9]/g, '');
  const d = new Date(s.date);
  const ds = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const delivery = settings.deliveryCharge || 0;
  let itemsRows = '';
  let grandTotal = 0;
  if (s._isLoose) {
    grandTotal = Number(s._total || 0) + delivery;
    itemsRows = `<tr><td>${s._bagName} (loose)</td><td align="center">${s._qtyDisplay}</td><td align="right">₹${Number(s._pricePerKg || 0).toLocaleString('en-IN')}/kg</td></tr><tr><td colspan="2">Subtotal</td><td align="right">₹${Number(s._total || 0).toLocaleString('en-IN')}</td></tr>${delivery ? `<tr><td colspan="2">Delivery charge</td><td align="right">₹${delivery}</td></tr>` : ''}<tr class="p-total"><td colspan="2">TOTAL</td><td align="right">₹${grandTotal.toLocaleString('en-IN')}</td></tr>`;
  } else if (s._isOrder) {
    grandTotal = Number(s.total || 0);
    itemsRows = `<tr><td colspan="3" style="padding:6px 0;font-size:13px;white-space:pre-wrap">${s._itemsText || 'As ordered'}</td></tr>${delivery ? `<tr><td colspan="2">Delivery charge</td><td align="right">₹${delivery}</td></tr>` : ''}<tr class="p-total"><td colspan="2">TOTAL</td><td align="right">₹${grandTotal.toLocaleString('en-IN')}</td></tr><tr><td colspan="2">Payment</td><td align="right">${s._payment || 'COD'}</td></tr>`;
  } else {
    const subtotal = Number(s.pricePerBag || 0) * s.qty;
    grandTotal = subtotal + delivery;
    itemsRows = `<tr><td>${s.bagName}${s.weight ? ' (' + s.weight + ')' : ''}</td><td align="center">${s.qty} bag(s)</td><td align="right">₹${Number(s.pricePerBag || 0).toLocaleString('en-IN')} each</td></tr><tr><td colspan="2">Subtotal</td><td align="right">₹${subtotal.toLocaleString('en-IN')}</td></tr>${delivery ? `<tr><td colspan="2">Delivery charge</td><td align="right">₹${delivery}</td></tr>` : ''}<tr class="p-total"><td colspan="2">TOTAL</td><td align="right">₹${grandTotal.toLocaleString('en-IN')}</td></tr>`;
  }
  const printArea = document.getElementById('print-area');
  printArea.innerHTML = `<div class="p-wrap"><div class="p-head"><h1>🌾 ${shop}</h1><p>${city}${waNum ? ' · WhatsApp: +' + waNum : ''}</p></div><div class="p-body">
    <div class="p-section"><div class="p-label">Invoice</div><table><tr><td>Order ID</td><td><strong># ${s.orderId || '--'}</strong></td></tr><tr><td>Invoice No.</td><td><strong>${s.invoiceNo || '—'}</strong></td></tr><tr><td>Date & Time</td><td>${ds}</td></tr></table></div>
    <div class="p-section"><div class="p-label">Bill To</div><table><tr><td>Name</td><td><strong>${s.customer || '—'}</strong></td></tr><tr><td>Phone</td><td>${s.phone || '—'}</td></tr>${s.address ? `<tr><td>Address</td><td style="max-width:180px;word-break:break-word">${s.address}</td></tr>` : ''}</table></div>
    <div class="p-section"><div class="p-label">Order Items</div><table>${itemsRows}</table></div>
    <div class="p-thanks">🌾 Thank you for your order, ${s.customer || 'valued customer'}!<br>Fresh rice delivered to your door 🙏</div>
  </div></div>`;
  setTimeout(() => { window.print(); setTimeout(() => { printArea.innerHTML = ''; }, 2000); }, 150);
}
