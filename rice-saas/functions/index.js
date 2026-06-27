// ═══════════════════════════════════════════════════════
// functions/index.js — Cloud Functions for multi-tenant SaaS
//
// Deploy with: firebase deploy --only functions
//
// Requires these to be set via:
//   firebase functions:config:set razorpay.key_id="rzp_live_xxx" razorpay.key_secret="xxx" razorpay.webhook_secret="xxx"
// (or, on newer CLI, firebase functions:secrets:set RAZORPAY_KEY_SECRET etc.)
// ═══════════════════════════════════════════════════════

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');
const Razorpay = require('razorpay');

admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

const SUPER_ADMIN_EMAILS = ['sadinenidushaynth@gmail.com'];

function isSuperAdminEmail(email) {
  return SUPER_ADMIN_EMAILS.includes(email);
}

// ─────────────────────────────────────────────────────────
// setSuperAdminClaim
// One-time bootstrap: call this ONCE (e.g. from the browser
// console after logging in as yourself) to stamp your own
// Firebase Auth token with { superAdmin: true }. This is what
// firestore.rules checks via request.auth.token.superAdmin —
// custom claims are tamper-proof from the client and are the
// standard way to grant "god mode" safely.
//
// Guarded so it only ever works for emails in SUPER_ADMIN_EMAILS,
// so a curious shop owner can't call this on themselves.
// ─────────────────────────────────────────────────────────
exports.setSuperAdminClaim = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => {
    if (!context.auth || !isSuperAdminEmail(context.auth.token.email)) {
      throw new functions.https.HttpsError('permission-denied', 'Not allowed.');
    }
    await auth.setCustomUserClaims(context.auth.uid, { superAdmin: true });
    return { ok: true, message: 'Super admin claim set. Sign out and sign back in for it to take effect.' };
  });

// ─────────────────────────────────────────────────────────
// createShopWithOwner
// Called by: superadmin.js → createShopWithOwner()
// Caller must be a super admin. Creates everything needed
// for a brand-new shop + its owner account, server-side,
// using the Admin SDK so the caller's own session in the
// browser is never touched (the bug with client-side
// createUserWithEmailAndPassword signing out the caller).
// ─────────────────────────────────────────────────────────
exports.createShopWithOwner = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => {
    if (!context.auth || !isSuperAdminEmail(context.auth.token.email)) {
      throw new functions.https.HttpsError('permission-denied', 'Only the platform owner can create shops.');
    }

    const { shopName, city, ownerName, ownerEmail, ownerPass } = data;
    if (!shopName || !ownerEmail || !ownerPass) {
      throw new functions.https.HttpsError('invalid-argument', 'shopName, ownerEmail and ownerPass are required.');
    }
    if (ownerPass.length < 6) {
      throw new functions.https.HttpsError('invalid-argument', 'Password must be at least 6 characters.');
    }

    // 1. Create the Auth user for the shop owner
    let userRecord;
    try {
      userRecord = await auth.createUser({ email: ownerEmail, password: ownerPass, displayName: ownerName });
    } catch (e) {
      throw new functions.https.HttpsError('already-exists', e.message);
    }

    const shopRef = db.collection('shops').doc(); // auto-id
    const shopId = shopRef.id;
    const now = Date.now();
    const trialEndsAt = now + 14 * 24 * 60 * 60 * 1000; // 14-day free trial

    const batch = db.batch();

    // 2. shops/{shopId}/info  (the "info" sub-doc lives at the shop doc itself —
    //    we keep shop metadata directly on shops/{shopId}, and bags/sales/etc as
    //    sub-collections, matching shopInfoRef() in tenant.js)
    batch.set(shopRef, {
      name: shopName,
      city: city || '',
      waNumber: '',
      deliveryCharge: 0,
      ownerEmail,
      ownerUid: userRecord.uid,
      subscriptionStatus: 'trial',
      trialEndsAt,
      createdAt: now,
    });

    // 3. shops/{shopId}/users/{ownerUid}
    const ownerUserRef = shopRef.collection('users').doc(userRecord.uid);
    batch.set(ownerUserRef, {
      name: ownerName || ownerEmail,
      email: ownerEmail,
      role: 'owner',
      permissions: {}, // owners get full access via isAdmin(), permissions map unused for them
      createdAt: now,
    });

    // 4. userShopMap/{uid} → shopId   (top-level, used by resolveShopForUser)
    const mapRef = db.collection('userShopMap').doc(userRecord.uid);
    batch.set(mapRef, { shopId, role: 'owner' });

    await batch.commit();

    return { shopId, ownerUid: userRecord.uid };
  });

// ─────────────────────────────────────────────────────────
// createWorkerAccount
// Called by: permissions.js → createWorkerAccount()
// Caller must be the owner (or have permission) of the shop
// they're adding a worker to. Same "don't disturb caller's
// session" reasoning as above.
// ─────────────────────────────────────────────────────────
exports.createWorkerAccount = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Please sign in.');
    }
    const { shopId, name, email, password } = data;
    if (!shopId || !email || !password) {
      throw new functions.https.HttpsError('invalid-argument', 'shopId, email and password are required.');
    }
    if (password.length < 6) {
      throw new functions.https.HttpsError('invalid-argument', 'Password must be at least 6 characters.');
    }

    // Verify caller belongs to this shop and is the owner (or has permissions perm)
    const callerUid = context.auth.uid;
    const callerDoc = await db.collection('shops').doc(shopId).collection('users').doc(callerUid).get();
    if (!callerDoc.exists) {
      throw new functions.https.HttpsError('permission-denied', 'You do not belong to this shop.');
    }
    const callerData = callerDoc.data();
    const isOwner = callerData.role === 'owner';
    const canManagePerms = callerData.permissions && callerData.permissions.permissions === true;
    if (!isOwner && !canManagePerms) {
      throw new functions.https.HttpsError('permission-denied', 'You do not have permission to add workers.');
    }

    let userRecord;
    try {
      userRecord = await auth.createUser({ email, password, displayName: name });
    } catch (e) {
      throw new functions.https.HttpsError('already-exists', e.message);
    }

    const now = Date.now();
    const batch = db.batch();
    const workerRef = db.collection('shops').doc(shopId).collection('users').doc(userRecord.uid);
    batch.set(workerRef, {
      name: name || email, email, role: 'worker',
      permissions: {}, // owner toggles these afterward in the Permissions tab
      createdAt: now,
    });
    batch.set(db.collection('userShopMap').doc(userRecord.uid), { shopId, role: 'worker' });
    await batch.commit();

    return { workerUid: userRecord.uid };
  });

// ─────────────────────────────────────────────────────────
// Razorpay billing
// ─────────────────────────────────────────────────────────
const PLANS = {
  monthly: { amountInr: 299, days: 30 },
  yearly:  { amountInr: 2990, days: 365 },
};

function getRazorpayInstance() {
  const keyId = functions.config().razorpay?.key_id;
  const keySecret = functions.config().razorpay?.key_secret;
  if (!keyId || !keySecret) {
    throw new functions.https.HttpsError('failed-precondition', 'Razorpay is not configured on the server yet.');
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

// createRazorpayOrder
// Called by: billing.js → startCheckout()
exports.createRazorpayOrder = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Please sign in.');
    const { shopId, plan } = data;
    const planConfig = PLANS[plan];
    if (!shopId || !planConfig) throw new functions.https.HttpsError('invalid-argument', 'Invalid plan.');

    // Verify caller belongs to this shop
    const callerDoc = await db.collection('shops').doc(shopId).collection('users').doc(context.auth.uid).get();
    if (!callerDoc.exists) throw new functions.https.HttpsError('permission-denied', 'You do not belong to this shop.');

    const razorpay = getRazorpayInstance();
    const amountPaise = planConfig.amountInr * 100;

    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `${shopId}_${plan}_${Date.now()}`,
      notes: { shopId, plan },
    });

    return {
      orderId: order.id,
      amount: amountPaise,
      currency: 'INR',
      keyId: functions.config().razorpay.key_id,
    };
  });

// razorpayWebhook
// Configure this URL in the Razorpay dashboard under Webhooks.
// This is the ONLY automatic place subscriptionStatus is set to 'active' —
// never trust the client-side payment "success" callback alone.
exports.razorpayWebhook = functions
  .region('asia-south1')
  .https.onRequest(async (req, res) => {
    const webhookSecret = functions.config().razorpay?.webhook_secret;
    if (!webhookSecret) {
      console.error('Webhook secret not configured');
      res.status(500).send('Webhook not configured');
      return;
    }

    const signature = req.headers['x-razorpay-signature'];
    const body = JSON.stringify(req.body);
    const expectedSignature = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');

    if (signature !== expectedSignature) {
      console.error('Invalid Razorpay webhook signature');
      res.status(400).send('Invalid signature');
      return;
    }

    const event = req.body.event;
    if (event === 'order.paid' || event === 'payment.captured') {
      const payment = req.body.payload.payment.entity;
      const orderNotes = req.body.payload.order?.entity?.notes || payment.notes || {};
      const { shopId, plan } = orderNotes;
      const planConfig = PLANS[plan];

      if (shopId && planConfig) {
        const shopRef = db.collection('shops').doc(shopId);
        const shopSnap = await shopRef.get();
        const existing = shopSnap.exists ? shopSnap.data() : {};
        // Extend from current expiry if still active, otherwise from now
        const base = (existing.subscriptionStatus === 'active' && existing.subscriptionExpiresAt > Date.now())
          ? existing.subscriptionExpiresAt
          : Date.now();
        const newExpiry = base + planConfig.days * 24 * 60 * 60 * 1000;

        await shopRef.update({
          subscriptionStatus: 'active',
          subscriptionExpiresAt: newExpiry,
        });

        await shopRef.collection('payments').add({
          plan,
          amountInr: planConfig.amountInr,
          razorpayPaymentId: payment.id,
          razorpayOrderId: payment.order_id,
          date: Date.now(),
        });
      }
    }

    res.status(200).send('OK');
  });

// ─────────────────────────────────────────────────────────
// setShopSubscription
// Called by: superadmin.js → extendTrial() / forceActivate() / forceExpire()
//
// Firestore rules deliberately block ANY client-side write to
// subscriptionStatus / subscriptionExpiresAt (see firestore.rules) —
// otherwise a shop owner could just edit their own subscription
// field from the browser console and get free access forever.
// This function is the one sanctioned bypass: it runs with the
// Admin SDK (which ignores security rules) and itself checks that
// the CALLER is the platform super admin before touching anything.
// ─────────────────────────────────────────────────────────
exports.setShopSubscription = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => {
    if (!context.auth || !isSuperAdminEmail(context.auth.token.email)) {
      throw new functions.https.HttpsError('permission-denied', 'Only the platform owner can change subscription status.');
    }
    const { shopId, status, extendDays } = data;
    if (!shopId || !status) {
      throw new functions.https.HttpsError('invalid-argument', 'shopId and status are required.');
    }
    const validStatuses = ['trial', 'active', 'expired'];
    if (!validStatuses.includes(status)) {
      throw new functions.https.HttpsError('invalid-argument', 'status must be trial, active, or expired.');
    }

    const shopRef = db.collection('shops').doc(shopId);
    const update = { subscriptionStatus: status };

    if (status === 'trial') {
      update.trialEndsAt = Date.now() + (extendDays || 7) * 24 * 60 * 60 * 1000;
    } else if (status === 'active') {
      update.subscriptionExpiresAt = Date.now() + (extendDays || 90) * 24 * 60 * 60 * 1000;
    }
    // 'expired' needs no extra fields — isSubscriptionActive() in tenant.js
    // treats any non-active/non-trial status as locked out.

    await shopRef.update(update);
    return { ok: true };
  });
