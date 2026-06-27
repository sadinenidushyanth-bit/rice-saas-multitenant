/**
 * migrate-to-multitenant.js
 *
 * ONE-TIME script to migrate your existing live data
 * (flat collections: bags, sales, orders, customers, users,
 * openedBags) into the new multi-tenant structure:
 *   shops/{shopId}/bags/...
 *   shops/{shopId}/sales/...
 *   etc.
 *
 * Your shop becomes the FIRST tenant. After this runs,
 * your existing login (sadinenidushaynth@gmail.com) is
 * wired up as that shop's owner, and the old flat
 * collections are left untouched (not deleted) so you can
 * verify everything migrated correctly before removing them.
 *
 * HOW TO RUN (from your laptop, inside the rice-saas folder):
 *   1. npm install firebase-admin
 *   2. Download a service account key:
 *      Firebase Console → Project Settings → Service Accounts
 *      → Generate new private key → save as serviceAccountKey.json
 *      in this same folder (functions/ or project root — update
 *      the require() path below to match where you put it).
 *   3. node migrate-to-multitenant.js
 *
 * This script is idempotent-ish: re-running it will create a
 * SECOND shop if you run it twice, so only run it once. If you
 * need to re-run, delete the shop doc it created first.
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // ← place this file here

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const auth = admin.auth();

const OWNER_EMAIL = 'sadinenidushaynth@gmail.com'; // ← your existing login email
const SHOP_NAME = 'Rice Shop'; // ← change if you want a different display name
const SHOP_CITY = 'Tuni';

async function migrate() {
  console.log('Starting migration...');

  // 1. Find your existing Auth user (must already exist — you've been logging in)
  const userRecord = await auth.getUserByEmail(OWNER_EMAIL);
  console.log('Found existing owner account:', userRecord.uid);

  // 2. Create the shop document
  const shopRef = db.collection('shops').doc(); // auto-id
  const shopId = shopRef.id;
  const now = Date.now();

  await shopRef.set({
    name: SHOP_NAME,
    city: SHOP_CITY,
    waNumber: '',
    deliveryCharge: 0,
    ownerEmail: OWNER_EMAIL,
    ownerUid: userRecord.uid,
    subscriptionStatus: 'active', // your own shop — mark active indefinitely
    subscriptionExpiresAt: now + 365 * 24 * 60 * 60 * 1000 * 10, // 10 years out, effectively unlimited
    createdAt: now,
    migratedAt: now,
  });
  console.log('Created shop:', shopId);

  // 3. Set you as the owner inside the new shop
  await shopRef.collection('users').doc(userRecord.uid).set({
    name: 'Dushyath',
    email: OWNER_EMAIL,
    role: 'owner',
    permissions: {},
    createdAt: now,
  });

  // 4. Map your uid to this shop (this is what login resolves at sign-in)
  await db.collection('userShopMap').doc(userRecord.uid).set({ shopId, role: 'owner' });
  console.log('Owner mapping created.');

  // 5. Copy each flat collection into shops/{shopId}/<collection>
  const collectionsToMigrate = ['bags', 'sales', 'orders', 'customers', 'openedBags'];
  for (const colName of collectionsToMigrate) {
    const snap = await db.collection(colName).get();
    if (snap.empty) { console.log(`  ${colName}: nothing to migrate.`); continue; }
    let batch = db.batch();
    let count = 0;
    for (const docSnap of snap.docs) {
      const destRef = shopRef.collection(colName).doc(docSnap.id); // keep same doc IDs
      batch.set(destRef, docSnap.data());
      count++;
      if (count % 400 === 0) { await batch.commit(); batch = db.batch(); } // Firestore batch limit safety
    }
    await batch.commit();
    console.log(`  ${colName}: migrated ${count} documents.`);
  }

  // 6. Migrate the existing `users` collection (worker accounts you already
  //    created) — these already have Auth accounts, just need re-mapping.
  const usersSnap = await db.collection('users').get();
  for (const docSnap of usersSnap.docs) {
    const uid = docSnap.id;
    if (uid === userRecord.uid) continue; // owner already handled above
    const data = docSnap.data();
    await shopRef.collection('users').doc(uid).set({
      name: data.name || data.email,
      email: data.email,
      role: data.role === 'admin' ? 'owner' : 'worker', // old "admin" role → "owner" if it ever applied
      permissions: data.permissions || {},
      createdAt: now,
    });
    await db.collection('userShopMap').doc(uid).set({ shopId, role: data.role === 'admin' ? 'owner' : 'worker' });
    console.log(`  migrated worker account: ${data.email}`);
  }

  console.log('\n✅ Migration complete!');
  console.log('Shop ID:', shopId);
  console.log('\nNext steps:');
  console.log('  1. Deploy the new app: firebase deploy --only hosting');
  console.log('  2. Deploy security rules: firebase deploy --only firestore:rules,storage:rules');
  console.log('  3. Log in with your existing email/password and confirm everything looks right.');
  console.log('  4. Once confirmed, you may manually delete the old flat collections');
  console.log('     (bags, sales, orders, customers, openedBags, users) from the Firebase');
  console.log('     console — this script does NOT delete them automatically, on purpose.');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
