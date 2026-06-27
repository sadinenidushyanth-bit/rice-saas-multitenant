// ═══════════════════════════════════════════════════════
// modals.js — Injects all modal dialogs into #modals-container
// Keeping these as one template string (rather than hand-written
// in index.html) keeps the main HTML file readable. None of this
// is shop-data-specific; it's pure markup.
// ═══════════════════════════════════════════════════════

document.getElementById('modals-container').innerHTML = `

<!-- BAG MODAL -->
<div id="bag-modal" class="modal-bg hidden">
  <div class="modal">
    <div class="modal-handle"></div>
    <div class="modal-title" id="bag-modal-title">Add rice bag</div>
    <div class="form-group">
      <label class="form-label">Photo</label>
      <div class="img-upload" onclick="document.getElementById('img-file').click()">
        <img id="img-prev" src="" style="display:none">
        <span id="img-upload-label">Tap to add photo</span>
      </div>
      <input type="file" id="img-file" accept="image/*" style="display:none" onchange="handleImg(event)">
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Rice name</label><input type="text" id="bm-name" class="form-control" placeholder="e.g. Sona Masuri"></div>
      <div class="form-group"><label class="form-label">Weight / bag</label><input type="text" id="bm-weight" class="form-control" placeholder="e.g. 25 kg"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Vendor cost / bag (₹)</label><input type="number" id="bm-cost" class="form-control" oninput="updateProfitPreview()"></div>
      <div class="form-group"><label class="form-label">Selling price / bag (₹)</label><input type="number" id="bm-price" class="form-control" oninput="updateProfitPreview()"></div>
    </div>
    <div id="profit-preview" style="display:none;font-size:12px;font-weight:600;margin-bottom:10px"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Stock (bags)</label><input type="number" id="bm-stock" class="form-control"></div>
      <div class="form-group"><label class="form-label">Low stock alert at</label><input type="number" id="bm-lowstock" class="form-control" value="5"></div>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal('bag-modal')">Cancel</button>
      <button class="btn btn-primary" id="bm-save-btn" onclick="saveBag()">Add bag</button>
    </div>
  </div>
</div>

<!-- OPEN BAG MODAL -->
<div id="open-bag-modal" class="modal-bg hidden">
  <div class="modal">
    <div class="modal-handle"></div>
    <div class="modal-title">📦 Open a bag for loose sale</div>
    <p style="font-size:13px;color:var(--text3);margin-bottom:10px">Opening: <strong id="ob-bag-name"></strong></p>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Total kg in this bag</label><input type="number" id="ob-kg" class="form-control"></div>
      <div class="form-group"><label class="form-label">Selling price per kg (₹)</label><input type="number" id="ob-price-per-kg" class="form-control"></div>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal('open-bag-modal')">Cancel</button>
      <button class="btn btn-primary" onclick="confirmOpenBag()">Open bag</button>
    </div>
  </div>
</div>

<!-- LOOSE SALE MODAL -->
<div id="loose-sale-modal" class="modal-bg hidden">
  <div class="modal">
    <div class="modal-handle"></div>
    <div class="modal-title">⚖️ Sell loose rice (by kg)</div>
    <div class="form-group"><label class="form-label">Rice</label><select id="ls-bag" class="form-control" onchange="onLooseBagSelect()"></select></div>
    <p style="font-size:12px;color:var(--text3);margin-bottom:10px" id="ls-available"></p>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Kg to sell</label><input type="number" id="ls-kg" class="form-control" step="0.1" oninput="updateLooseSalePreview()"></div>
      <div class="form-group"><label class="form-label">Price per kg (₹)</label><input type="number" id="ls-price-per-kg" class="form-control" oninput="updateLooseSalePreview()"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Customer name</label><input type="text" id="ls-cust" class="form-control"></div>
      <div class="form-group"><label class="form-label">Phone</label><input type="tel" id="ls-phone" class="form-control"></div>
    </div>
    <div id="ls-preview" style="font-size:14px;font-weight:600;color:var(--green);margin-bottom:12px"></div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal('loose-sale-modal')">Cancel</button>
      <button class="btn btn-primary" onclick="confirmLooseSale()">Confirm sale</button>
    </div>
  </div>
</div>

<!-- ORDER MODAL -->
<div id="order-modal" class="modal-bg hidden">
  <div class="modal">
    <div class="modal-handle"></div>
    <div class="modal-title" id="order-modal-title">New delivery order</div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Customer name</label><input type="text" id="om-name" class="form-control"></div>
      <div class="form-group"><label class="form-label">Phone</label><input type="tel" id="om-phone" class="form-control"></div>
    </div>
    <div class="form-group"><label class="form-label">Address</label><textarea id="om-address" class="form-control"></textarea></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Landmark</label><input type="text" id="om-landmark" class="form-control"></div>
      <div class="form-group"><label class="form-label">Location link</label><input type="text" id="om-location" class="form-control" placeholder="Google Maps link"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Bag (optional, deducts stock)</label><select id="om-bag" class="form-control" onchange="onOrderBagSelect()"></select></div>
      <div class="form-group"><label class="form-label">Quantity</label><input type="number" id="om-qty" class="form-control" value="1" oninput="updateOrderTotal()"></div>
    </div>
    <div class="form-group"><label class="form-label">Items description</label><input type="text" id="om-items" class="form-control" placeholder="e.g. 2 x Sona Masuri (25kg)"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Total (₹)</label><input type="number" id="om-total" class="form-control"></div>
      <div class="form-group"><label class="form-label">Payment</label><select id="om-payment" class="form-control"><option>COD</option><option>UPI</option><option>Paid</option></select></div>
    </div>
    <div class="form-group"><label class="form-label">Status</label>
      <select id="om-status" class="form-control"><option>Pending</option><option>Confirmed</option><option>Delivering</option><option>Delivered</option><option>Cancelled</option></select>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal('order-modal')">Cancel</button>
      <button class="btn btn-primary" id="om-save-btn" onclick="saveOrder()">Save order</button>
    </div>
  </div>
</div>

<!-- CUSTOMER MODAL -->
<div id="customer-modal" class="modal-bg hidden">
  <div class="modal">
    <div class="modal-handle"></div>
    <div class="modal-title" id="cust-modal-title">Add customer</div>
    <div class="form-group"><label class="form-label">Name</label><input type="text" id="cm-name" class="form-control"></div>
    <div class="form-group"><label class="form-label">Phone</label><input type="tel" id="cm-phone" class="form-control"></div>
    <div class="form-group"><label class="form-label">Area</label><input type="text" id="cm-area" class="form-control"></div>
    <div class="form-group"><label class="form-label">Notes</label><textarea id="cm-notes" class="form-control"></textarea></div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal('customer-modal')">Cancel</button>
      <button class="btn btn-primary" id="cm-save-btn" onclick="saveCustomer()">Save</button>
    </div>
  </div>
</div>

<!-- SEND MESSAGE MODAL -->
<div id="send-modal" class="modal-bg hidden">
  <div class="modal">
    <div class="modal-handle"></div>
    <div class="modal-title">Send to customers</div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div>
        <button class="btn" style="font-size:12px;padding:4px 10px" onclick="selectAllCustomers(true)">Select all</button>
        <button class="btn" style="font-size:12px;padding:4px 10px" onclick="selectAllCustomers(false)">Clear</button>
      </div>
      <span id="selected-count" style="font-size:12px;color:var(--text3)"></span>
    </div>
    <div id="cust-select-list" style="max-height:300px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius-sm)"></div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal('send-modal')">Cancel</button>
      <button class="btn btn-wa" onclick="sendToSelected()">Send via WhatsApp</button>
    </div>
  </div>
</div>

<!-- INVOICE MODAL -->
<div id="invoice-modal" class="modal-bg hidden">
  <div class="modal" style="max-width:420px">
    <div class="modal-handle"></div>
    <div class="modal-title">🧾 Invoice</div>
    <div id="invoice-preview" class="invoice-box"></div>
    <div class="modal-actions" style="flex-wrap:wrap">
      <button class="btn" onclick="closeModal('invoice-modal')">Close</button>
      <button class="btn" onclick="printInvoice()">🖨 Print</button>
      <button class="btn btn-wa" id="invoice-wa-btn" onclick="sendInvoiceWA()">💬 Send on WhatsApp</button>
    </div>
  </div>
</div>

<!-- NEW WORKER USER MODAL -->
<div id="user-modal" class="modal-bg hidden">
  <div class="modal">
    <div class="modal-handle"></div>
    <div class="modal-title">Create worker account</div>
    <div id="nu-error" class="auth-error" style="display:none"></div>
    <div class="form-group"><label class="form-label">Name</label><input type="text" id="nu-name" class="form-control"></div>
    <div class="form-group"><label class="form-label">Email</label><input type="email" id="nu-email" class="form-control"></div>
    <div class="form-group"><label class="form-label">Password</label><input type="text" id="nu-pass" class="form-control" placeholder="At least 6 characters"></div>
    <p style="font-size:11px;color:var(--text3);margin-bottom:8px">After creating, set their permissions from the list below.</p>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal('user-modal')">Cancel</button>
      <button class="btn btn-primary" id="nu-save-btn" onclick="createWorkerAccount()">Create account</button>
    </div>
  </div>
</div>

<!-- CREATE SHOP MODAL (super admin only) -->
<div id="create-shop-modal" class="modal-bg hidden">
  <div class="modal">
    <div class="modal-handle"></div>
    <div class="modal-title">🏪 Create new shop</div>
    <div id="cs-error" class="auth-error" style="display:none"></div>
    <div class="form-group"><label class="form-label">Shop name</label><input type="text" id="cs-shopname" class="form-control" placeholder="e.g. Sri Lakshmi Rice Traders"></div>
    <div class="form-group"><label class="form-label">City / Area</label><input type="text" id="cs-city" class="form-control"></div>
    <hr style="border:none;border-top:1px solid var(--border);margin:14px 0">
    <p style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:8px">Shop owner login</p>
    <div class="form-group"><label class="form-label">Owner name</label><input type="text" id="cs-owner-name" class="form-control"></div>
    <div class="form-group"><label class="form-label">Owner email</label><input type="email" id="cs-owner-email" class="form-control"></div>
    <div class="form-group"><label class="form-label">Owner password</label><input type="text" id="cs-owner-pass" class="form-control" placeholder="At least 6 characters"></div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal('create-shop-modal')">Cancel</button>
      <button class="btn btn-primary" id="cs-save-btn" onclick="createShopWithOwner()">Create shop</button>
    </div>
  </div>
</div>
`;
