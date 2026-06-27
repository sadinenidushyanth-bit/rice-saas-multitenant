// ═══════════════════════════════════════════════════════
// billing.js — Razorpay subscription billing (NEW)
//
// Flow:
//   1. Owner taps "Renew" / "Subscribe" → calls Cloud Function
//      createRazorpayOrder({shopId, plan}) which creates a
//      Razorpay order server-side and returns an order_id.
//   2. Razorpay Checkout opens in the browser using that order_id.
//   3. On success, Razorpay calls our webhook (functions/index.js
//      → razorpayWebhook) which verifies the signature and writes
//        shops/{shopId}/info.subscriptionStatus = 'active'
//        shops/{shopId}/info.subscriptionExpiresAt = <date>
//      and logs the payment under shops/{shopId}/payments/{id}.
//   4. listenShopInfo() in firebase.js picks up the change live,
//      so the locked screen disappears without a page reload.
//
// IMPORTANT: never trust the client to mark a payment successful.
// The webhook is the only thing allowed to flip subscriptionStatus.
// ═══════════════════════════════════════════════════════

const BILLING_PLANS = {
  monthly: { label: 'Monthly', amountInr: 299, days: 30 },
  yearly:  { label: 'Yearly (2 months free)', amountInr: 2990, days: 365 },
};

function renderBillingTab() {
  const box = document.getElementById('billing-status-box');
  if (!box || !currentShopData) return;
  const status = currentShopData.subscriptionStatus || 'trial';
  const expiresAt = currentShopData.subscriptionExpiresAt;
  const trialEndsAt = currentShopData.trialEndsAt;

  let statusHtml = '';
  if (status === 'active') {
    const expDate = expiresAt ? new Date(expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
    statusHtml = `<div class="alert green">✅ Subscription active — renews/expires on <strong>${expDate}</strong></div>`;
  } else if (status === 'trial') {
    const trialDate = trialEndsAt ? new Date(trialEndsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
    statusHtml = `<div class="alert amber">🕐 Free trial — ends <strong>${trialDate}</strong></div>`;
  } else {
    statusHtml = `<div class="alert red">🔒 Subscription expired. Renew to keep using the app.</div>`;
  }

  box.innerHTML = statusHtml + `
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">
      ${Object.entries(BILLING_PLANS).map(([key, p]) => `
        <button class="btn btn-primary" style="flex:1;min-width:140px;justify-content:center;padding:14px" onclick="startCheckout('${key}')">
          ${p.label}<br><span style="font-size:18px;font-weight:700">₹${p.amountInr}</span>
        </button>`).join('')}
    </div>`;

  // Payment history
  loadBillingHistory();
}

async function loadBillingHistory() {
  const histBox = document.getElementById('billing-history');
  if (!histBox) return;
  try {
    const { getDocs, query, orderBy, limit } = window._fb;
    const snap = await getDocs(query(shopCol('payments'), orderBy('date', 'desc'), limit(20)));
    const rows = snap.docs.map(d => d.data());
    if (!rows.length) { histBox.innerHTML = `<div class="empty" style="padding:1rem 0"><div class="empty-icon">💳</div>No payments yet.</div>`; return; }
    histBox.innerHTML = rows.map(p => `
      <div class="sale-row">
        <div class="sale-icon">💳</div>
        <div class="sale-info">
          <div class="sale-name">${p.plan === 'yearly' ? 'Yearly plan' : 'Monthly plan'}</div>
          <div class="sale-meta">${new Date(p.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · ${p.razorpayPaymentId || ''}</div>
        </div>
        <div class="sale-amt">₹${p.amountInr}</div>
      </div>`).join('');
  } catch (e) {
    histBox.innerHTML = `<div class="empty" style="padding:1rem 0">Could not load payment history.</div>`;
  }
}

function openRenewModal() {
  // Reuses the billing tab UI inside the locked screen via a simple confirm flow
  startCheckout('monthly');
}

async function startCheckout(planKey) {
  const plan = BILLING_PLANS[planKey];
  if (!plan) return;
  toast('Opening payment...');

  try {
    const { httpsCallable } = window._fb;
    const createOrder = httpsCallable(window._functions, 'createRazorpayOrder');
    const result = await createOrder({ shopId: currentShopId, plan: planKey });
    const { orderId, amount, currency, keyId } = result.data;

    // Load Razorpay checkout script once
    if (!window.Razorpay) {
      await loadRazorpayScript();
    }

    const rzp = new window.Razorpay({
      key: keyId,
      amount, currency, order_id: orderId,
      name: settings.shopName || 'Rice Shop Manager',
      description: `${plan.label} subscription`,
      prefill: { email: currentUser?.email || '' },
      theme: { color: '#2D7A5F' },
      handler: function (response) {
        // Payment succeeded client-side. The webhook (server-side) is what
        // actually activates the subscription — this is just user feedback.
        toast('Payment received! Activating your subscription...');
        setTimeout(() => { renderBillingTab(); }, 3000);
      },
      modal: {
        ondismiss: function () { toast('Payment cancelled.'); }
      }
    });
    rzp.open();
  } catch (e) {
    console.error(e);
    toast('Could not start payment. Please try again.');
  }
}

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
}
