// ═══════════════════════════════════════════════════════
// stock.js — Stock tab rendering and bag management
// CHANGED FOR MULTI-TENANT: doc(window._db,'bags',id) → shopDoc('bags',id)
// ═══════════════════════════════════════════════════════

function renderStock() {
  const totalBags = bags.reduce((s, b) => s + Number(b.stock), 0);
  const totalVal  = bags.reduce((s, b) => s + Number(b.cost || 0) * Number(b.stock), 0);

  let mHtml = `<div class="metric-card"><div class="metric-label">Vendor investment</div><div class="metric-value">₹${totalVal.toLocaleString('en-IN')}</div><div class="metric-sub">Current stock cost</div></div>`;
  bags.forEach(b => {
    mHtml += `<div class="metric-card"><div class="metric-label">${b.name}</div><div class="metric-value">${b.stock}</div><div class="metric-sub">${b.weight}</div></div>`;
  });
  mHtml += `<div class="metric-card"><div class="metric-label">Bags in stock</div><div class="metric-value metric-accent">${totalBags}</div><div class="metric-sub">${bags.length} products total</div></div>`;
  document.getElementById('metrics-bar').innerHTML = mHtml;

  let alerts = '';
  bags.filter(b => Number(b.stock) === 0).forEach(b => {
    alerts += `<div class="alert red">🚫 <strong>${b.name}</strong> is out of stock</div>`;
  });
  bags.filter(b => Number(b.stock) > 0 && Number(b.stock) <= (Number(b.lowStock) || 5)).forEach(b => {
    alerts += `<div class="alert amber">⚠️ <strong>${b.name}</strong> — only ${b.stock} bags left. Reorder soon!</div>`;
  });
  document.getElementById('stock-alerts').innerHTML = alerts;

  const canEdit = hasPerm('addEditBag'), canDel = hasPerm('deleteBag');
  const grid = document.getElementById('bag-grid');
  if (!bags.length) { grid.innerHTML = `<div class="empty"><div class="empty-icon">🌾</div>No rice bags added yet.</div>`; return; }

  const search = document.getElementById('stock-search')?.value.toLowerCase().trim() || '';
  const fl = bags.filter(b => b.name.toLowerCase().includes(search));
  if (!fl.length) { grid.innerHTML = `<div class="empty" style="padding:1.5rem 0"><div class="empty-icon">🌾</div>No matching bags found.</div>`; return; }

  grid.innerHTML = fl.map(b => {
    const s = Number(b.stock);
    const hasOpenStock = openedBags.some(ob => ob.bagId === b.id && Number(ob.remainingKg || 0) > 0);
    const pc = s === 0 && !hasOpenStock ? 'pill-out' : s <= (Number(b.lowStock) || 5) ? 'pill-low' : 'pill-ok';
    const pl = s === 0 && !hasOpenStock ? 'Out of stock' : s <= (Number(b.lowStock) || 5) ? `Low – ${s} left` : `${s} in stock`;
    const ph = b.img ? `<div class="bag-photo"><img src="${b.img}" alt="${b.name}"></div>` : `<div class="bag-photo">🌾</div>`;
    const price = Number(b.price || 0);

    const bagOpenRecords = openedBags.filter(ob => ob.bagId === b.id && Number(ob.remainingKg || 0) > 0);
    const totalOpenedKg  = bagOpenRecords.reduce((s, ob) => s + Number(ob.remainingKg || 0), 0);
    const openedBanner   = bagOpenRecords.length > 0 ? bagOpenRecords.map(ob => {
      const remKg = Number(ob.remainingKg || 0);
      const origKg = Number(ob.originalKg || 0);
      const pct = origKg > 0 ? Math.min(100, remKg / origKg * 100) : 50;
      return `<div class="bag-open-banner">
        <div>
          <div style="font-size:10px;opacity:0.85">${ob.orderId} · opened ${new Date(ob.openedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
          <div class="kg-left">${remKg % 1 === 0 ? remKg : remKg.toFixed(2)} kg left</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          <span style="font-size:10px;opacity:0.8">₹${ob.pricePerKg || '?'}/kg</span>
          <button onclick="deleteOpenBag('${ob.id}','${b.id}',${ob.remainingKg})" style="background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.4);color:#fff;border-radius:6px;padding:2px 8px;font-size:10px;cursor:pointer;font-family:var(--font)">🗑 Close</button>
        </div>
      </div>
      <div class="loose-progress"><div class="loose-progress-bar" style="width:${pct}%"></div></div>`;
    }).join('') : '';

    return `<div class="bag-card">${ph}<div class="bag-body">
      <div class="bag-name">${b.name}</div><div class="bag-wt">${b.weight}</div>
      <div class="bag-price">₹${price.toLocaleString('en-IN')}<span style="font-size:11px;color:var(--text3);font-weight:400">/bag</span></div>
      ${openedBanner}
      <span class="stock-pill ${pc}">${pl}</span>
      <div class="bag-btns" style="flex-wrap:wrap;gap:5px;">
        ${totalOpenedKg > 0 && hasPerm('record') ? `<button class="btn btn-sell-loose" onclick="openLooseSaleModal('${b.id}')" style="flex:2">⚖️ Sell loose</button>` : ''}
        ${s > 0 && hasPerm('record') ? `<button class="btn btn-open-bag" onclick="openOpenBagModal('${b.id}')">📦 Open bag</button>` : ''}
        ${canEdit ? `<button class="btn" onclick="openEditBagModal('${b.id}')">Edit</button>` : ''}
        ${canDel ? `<button class="btn btn-danger" onclick="deleteBag('${b.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg></button>` : ''}
      </div>
    </div></div>`;
  }).join('');
}

function openBagModal() {
  if (!hasPerm('addEditBag')) { toast('No permission'); return; }
  editingBagId = null; uploadedImg = '';
  document.getElementById('bag-modal-title').textContent = 'Add rice bag';
  document.getElementById('bm-save-btn').textContent = 'Add bag';
  ['bm-name', 'bm-price', 'bm-stock', 'bm-cost'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('bm-weight').value = '10 kg';
  document.getElementById('bm-lowstock').value = '5';
  const prev = document.getElementById('img-prev');
  prev.style.display = 'none'; prev.src = '';
  document.getElementById('img-upload-label').textContent = 'Tap to add photo';
  document.getElementById('profit-preview').style.display = 'none';
  document.getElementById('bag-modal').classList.remove('hidden');
}

function openEditBagModal(id) {
  if (!hasPerm('addEditBag')) { toast('No permission'); return; }
  const bag = bags.find(b => b.id === id);
  if (!bag) return;
  editingBagId = id; uploadedImg = bag.img || '';
  document.getElementById('bag-modal-title').textContent = 'Edit bag';
  document.getElementById('bm-save-btn').textContent = 'Save changes';
  document.getElementById('bm-name').value     = bag.name;
  document.getElementById('bm-price').value    = bag.price;
  document.getElementById('bm-stock').value    = bag.stock;
  document.getElementById('bm-weight').value   = bag.weight;
  document.getElementById('bm-lowstock').value = bag.lowStock || 5;
  document.getElementById('bm-cost').value     = bag.cost || '';
  const prev = document.getElementById('img-prev');
  if (bag.img) { prev.src = bag.img; prev.style.display = 'block'; } else { prev.style.display = 'none'; }
  updateProfitPreview();
  document.getElementById('bag-modal').classList.remove('hidden');
}

function handleImg(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    uploadedImg = ev.target.result;
    const prev = document.getElementById('img-prev');
    prev.src = uploadedImg; prev.style.display = 'block';
    document.getElementById('img-upload-label').textContent = 'Tap to change photo';
  };
  reader.readAsDataURL(file);
}

function updateProfitPreview() {
  const cost = Number(document.getElementById('bm-cost').value) || 0;
  const price = Number(document.getElementById('bm-price').value) || 0;
  const preview = document.getElementById('profit-preview');
  if (!cost || !price) { preview.style.display = 'none'; return; }
  const profit = price - cost;
  const margin = Math.round(profit / cost * 100);
  preview.style.display = 'block';
  preview.textContent = `Profit: ₹${profit.toLocaleString('en-IN')} per bag (${margin}% margin above vendor cost)`;
  preview.style.color = margin >= 15 ? 'var(--green)' : margin >= 5 ? 'var(--amber)' : 'var(--red)';
}

async function saveBag() {
  if (!hasPerm('addEditBag')) { toast('No permission'); return; }
  const name = document.getElementById('bm-name').value.trim();
  const price = Number(document.getElementById('bm-price').value);
  const stock = Number(document.getElementById('bm-stock').value);
  const weight = document.getElementById('bm-weight').value;
  const lowStock = Number(document.getElementById('bm-lowstock').value) || 5;
  const cost = Number(document.getElementById('bm-cost').value) || 0;
  if (!name || !price || isNaN(stock)) { toast('Please fill all fields'); return; }

  const btn = document.getElementById('bm-save-btn');
  btn.textContent = 'Saving...'; btn.disabled = true;

  const { ref, uploadBytes, uploadString, getDownloadURL, serverTimestamp, setDoc, updateDoc, doc } = window._fb;

  let imgUrl  = (editingBagId && uploadedImg && !uploadedImg.startsWith('data:')) ? uploadedImg : '';
  let imgPath = '';
  if (uploadedImg && window._storage) {
    try {
      const safeName = name.replace(/\s/g, '_');
      const fileInput = document.getElementById('img-file');
      const hasNewFile = fileInput && fileInput.files && fileInput.files[0];
      // Namespace storage path by shop so two shops' images never collide
      const basePath = `shops/${currentShopId}/product_images/${editingBagId || ('new_' + Date.now())}/${safeName}_${Date.now()}.jpg`;
      if (hasNewFile) {
        const file = fileInput.files[0];
        imgPath = basePath;
        const imgRef = ref(window._storage, imgPath);
        const snap = await uploadBytes(imgRef, file);
        imgUrl = await getDownloadURL(snap.ref);
      } else if (uploadedImg.startsWith('data:')) {
        imgPath = basePath;
        const imgRef = ref(window._storage, imgPath);
        const snap = await uploadString(imgRef, uploadedImg, 'data_url');
        imgUrl = await getDownloadURL(snap.ref);
      }
    } catch (err) {
      console.error('Image upload failed:', err);
      imgUrl = '';
    }
  }

  if (editingBagId) {
    const data = { name, cost, price, stock, weight, lowStock, updatedAt: serverTimestamp() };
    if (imgUrl) data.img = imgUrl;
    if (imgPath) data.imgPath = imgPath;
    await updateDoc(shopDoc('bags', editingBagId), data);
  } else {
    const newRef = doc(shopCol('bags'));
    await setDoc(newRef, {
      name, cost, price, stock, weight, lowStock,
      img: imgUrl, imgPath,
      totalSold: 0, totalRevenue: 0,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
  }

  btn.disabled = false;
  closeModal('bag-modal');
  toast(editingBagId ? 'Bag updated!' : 'Bag added!');
}

async function deleteBag(id) {
  if (!hasPerm('deleteBag')) { toast('No permission'); return; }
  const bag = bags.find(b => b.id === id);
  if (!bag) return;
  if (!confirm(`Delete "${bag.name}"?`)) return;
  const { deleteDoc } = window._fb;
  await deleteDoc(shopDoc('bags', id));
  toast('Bag deleted');
}
