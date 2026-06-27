// ═══════════════════════════════════════════════════════
// loosesale.js — Open a bag for loose-kg selling, sell loose
// CHANGED FOR MULTI-TENANT: writes via shopDoc()/shopCol()
// ═══════════════════════════════════════════════════════

function openOpenBagModal(bagId) {
  const bag = bags.find(b => b.id === bagId);
  if (!bag) return;
  openingBagId = bagId;
  document.getElementById('ob-bag-name').textContent = `${bag.name} (${bag.weight})`;
  const kgMatch = (bag.weight || '').match(/(\d+(\.\d+)?)/);
  const defaultKg = kgMatch ? Number(kgMatch[1]) : 25;
  document.getElementById('ob-kg').value = defaultKg;
  const defaultPricePerKg = bag.price && defaultKg ? (Number(bag.price) / defaultKg).toFixed(2) : '';
  document.getElementById('ob-price-per-kg').value = defaultPricePerKg;
  document.getElementById('open-bag-modal').classList.remove('hidden');
}

async function confirmOpenBag() {
  const bag = bags.find(b => b.id === openingBagId);
  if (!bag) return;
  const kg = Number(document.getElementById('ob-kg').value);
  const pricePerKg = Number(document.getElementById('ob-price-per-kg').value);
  if (!kg || kg <= 0) { toast('Enter valid kg amount'); return; }
  if (!pricePerKg || pricePerKg <= 0) { toast('Enter price per kg'); return; }
  if (Number(bag.stock) < 1) { toast('No full bags in stock to open'); return; }

  const { addDoc, updateDoc, increment } = window._fb;
  const orderId = 'OPEN-' + Date.now().toString().slice(-8);

  await addDoc(shopCol('openedBags'), {
    bagId: bag.id, bagName: bag.name, weight: bag.weight,
    originalKg: kg, remainingKg: kg, pricePerKg,
    costPerBag: bag.cost || 0, orderId,
    openedAt: Date.now(), openedBy: currentUser?.email || ''
  });
  await updateDoc(shopDoc('bags', bag.id), { stock: increment(-1) });

  closeModal('open-bag-modal');
  toast(`Opened 1 bag of ${bag.name} → ${kg} kg loose stock created`);
}

async function deleteOpenBag(openId, bagId, remainingKg) {
  if (!confirm(`Close this opened bag? ${remainingKg} kg of loose stock will be removed from tracking (e.g. sold off-book or wasted).`)) return;
  const { deleteDoc } = window._fb;
  await deleteDoc(shopDoc('openedBags', openId));
  toast('Opened bag closed');
}

function openLooseSaleModal(preselectBagId) {
  const sel = document.getElementById('ls-bag');
  const bagsWithOpenStock = [...new Set(openedBags.map(ob => ob.bagId))]
    .map(id => bags.find(b => b.id === id)).filter(Boolean);

  if (!bagsWithOpenStock.length) { toast('No loose stock available. Open a bag first.'); return; }

  sel.innerHTML = bagsWithOpenStock.map(b => {
    const totalKg = openedBags.filter(ob => ob.bagId === b.id).reduce((s, ob) => s + Number(ob.remainingKg || 0), 0);
    return `<option value="${b.id}">${b.name} (${b.weight}) — ${totalKg.toFixed(2)} kg available</option>`;
  }).join('');

  if (preselectBagId) sel.value = preselectBagId;
  onLooseBagSelect();
  document.getElementById('loose-sale-modal').classList.remove('hidden');
}

function onLooseBagSelect() {
  const bagId = document.getElementById('ls-bag').value;
  looseSaleBagId = bagId;
  const records = openedBags.filter(ob => ob.bagId === bagId);
  const totalKg = records.reduce((s, ob) => s + Number(ob.remainingKg || 0), 0);
  const avgPrice = records.length ? records[0].pricePerKg : 0; // assume same price across opened batches of same bag
  document.getElementById('ls-available').textContent = `${totalKg.toFixed(2)} kg available`;
  document.getElementById('ls-price-per-kg').value = avgPrice;
  updateLooseSalePreview();
}

function updateLooseSalePreview() {
  const kg = Number(document.getElementById('ls-kg').value) || 0;
  const price = Number(document.getElementById('ls-price-per-kg').value) || 0;
  const total = kg * price;
  document.getElementById('ls-preview').textContent = total > 0 ? `Total: ₹${total.toLocaleString('en-IN')}` : '';
}

async function confirmLooseSale() {
  if (!hasPerm('record')) { toast('No permission'); return; }
  const bagId = document.getElementById('ls-bag').value;
  const kg = Number(document.getElementById('ls-kg').value);
  const pricePerKg = Number(document.getElementById('ls-price-per-kg').value);
  const cust = document.getElementById('ls-cust').value.trim();
  const phone = document.getElementById('ls-phone').value.trim();
  const bag = bags.find(b => b.id === bagId);
  if (!bag) { toast('Select a bag'); return; }
  if (!kg || kg <= 0) { toast('Enter kg to sell'); return; }
  if (!pricePerKg || pricePerKg <= 0) { toast('Enter price per kg'); return; }

  const records = openedBags.filter(ob => ob.bagId === bagId).sort((a, b) => a.openedAt - b.openedAt);
  const totalAvail = records.reduce((s, ob) => s + Number(ob.remainingKg || 0), 0);
  if (kg > totalAvail) { toast(`Only ${totalAvail.toFixed(2)} kg available`); return; }

  const { updateDoc, addDoc } = window._fb;

  // Deduct from oldest opened batch(es) first
  let remaining = kg;
  let costPerBagAvg = 0, costWeight = 0;
  for (const rec of records) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, Number(rec.remainingKg));
    await updateDoc(shopDoc('openedBags', rec.id), { remainingKg: Number(rec.remainingKg) - take });
    costPerBagAvg += (rec.costPerBag || 0) * take;
    costWeight += take;
    remaining -= take;
  }
  const avgCostPerKg = costWeight > 0 ? costPerBagAvg / costWeight : 0;

  const total = kg * pricePerKg;
  const cost = avgCostPerKg * kg;
  const profit = total - cost;
  const orderId = 'ORD-' + Date.now().toString().slice(-8);
  const invoiceNo = 'INV-' + Date.now().toString().slice(-6);

  await addDoc(shopCol('sales'), {
    bagId, bagName: bag.name, weight: bag.weight,
    saleMode: 'loose', qtyDisplay: `${kg} kg`, pricePerKg,
    qty: 1, total, profit, costPerBag: 0,
    orderId, invoiceNo, customer: cust, phone,
    type: cust ? 'walkin' : 'walkin',
    date: Date.now(), recordedBy: currentUser?.email || ''
  });

  if (phone && cust) {
    const existing = customers.find(c => c.phone === phone);
    if (!existing) await addDoc(shopCol('customers'), { name: cust, phone, area: '', notes: '', totalOrders: 1, createdAt: Date.now() });
  }

  closeModal('loose-sale-modal');
  toast(`Sold ${kg} kg of ${bag.name} for ₹${total.toLocaleString('en-IN')}`);
}
