// ═══════════════════════════════════════════════════════
// permissions.js — Worker accounts and permission toggles
//
// CHANGED FOR MULTI-TENANT:
//   1. Permissions now live at shops/{shopId}/users/{uid}
//   2. Creating a worker account NO LONGER calls
//      createUserWithEmailAndPassword on the client. That call
//      signs the *current* user out and logs in as the new
//      worker — harmless for a single shop owner testing alone,
//      but in a multi-tenant app it would kick the shop owner
//      out of their own session. Worker creation now calls a
//      Cloud Function (createWorkerAccount in functions/index.js)
//      that creates the Auth user with the Admin SDK, writes
//      userShopMap + shops/{shopId}/users in one call, and never
//      touches the caller's own session.
// ═══════════════════════════════════════════════════════

function renderPermissions() {
  if (!isAdmin()) { document.getElementById('permissions-list').innerHTML = `<div class="alert red">🔒 Only the shop owner can access permissions.</div>`; return; }
  const list = document.getElementById('permissions-list');
  if (!users.length) { list.innerHTML = `<div class="empty"><div class="empty-icon">👥</div>No users yet.</div>`; return; }
  list.innerHTML = users.map(u => {
    const isOwnerUser = u.role === 'owner';
    const perms = isOwnerUser ? getAdminPerms() : (u.permissions || {});
    const permToggles = Object.entries(ALL_PERMS).map(([key, label]) => {
      const checked = isOwnerUser ? true : (perms[key] === true);
      const disabled = isOwnerUser || key === 'permissions' || key === 'billing';
      return `<div class="perm-toggle">
        <span style="font-size:11px;color:var(--text2)">${label}</span>
        <label class="toggle-sw">
          <input type="checkbox" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} onchange="togglePerm('${u.id}','${key}',this.checked)">
          <span class="toggle-slider"></span>
        </label>
      </div>`;
    }).join('');
    return `<div class="perm-user-card">
      <div class="perm-user-top">
        <div><div class="perm-user-name">${u.name || u.email}</div><div style="font-size:12px;color:var(--text3)">${u.email}</div></div>
        <div style="display:flex;gap:6px;align-items:center">
          <span class="perm-user-role ${isOwnerUser ? 'role-admin' : 'role-worker'}">${isOwnerUser ? '👑 Owner' : 'Worker'}</span>
          ${!isOwnerUser ? `<button class="btn btn-danger" style="font-size:11px;padding:4px 10px" onclick="deleteUser('${u.id}')">Remove</button>` : ''}
        </div>
      </div>
      ${!isOwnerUser ? `<div class="perm-grid">${permToggles}</div>` : '<div style="font-size:12px;color:var(--green)">✓ Owner has full access to everything</div>'}
    </div>`;
  }).join('');
}

async function togglePerm(userId, permKey, value) {
  const { updateDoc } = window._fb;
  const user = users.find(u => u.id === userId);
  if (!user) return;
  const perms = { ...(user.permissions || {}) };
  perms[permKey] = value;
  await updateDoc(shopDoc('users', userId), { permissions: perms });
  toast(`Permission ${value ? 'granted' : 'removed'}: ${ALL_PERMS[permKey]}`);
}

function openNewUserModal() {
  ['nu-name', 'nu-email', 'nu-pass'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('nu-error').style.display = 'none';
  document.getElementById('user-modal').classList.remove('hidden');
}

async function createWorkerAccount() {
  const name = document.getElementById('nu-name').value.trim();
  const email = document.getElementById('nu-email').value.trim();
  const pass = document.getElementById('nu-pass').value;
  const errEl = document.getElementById('nu-error');
  errEl.style.display = 'none';
  if (!email || !pass) { errEl.textContent = 'Email and password are required.'; errEl.style.display = 'block'; return; }
  if (pass.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; errEl.style.display = 'block'; return; }

  const btn = document.getElementById('nu-save-btn');
  btn.textContent = 'Creating...'; btn.disabled = true;

  try {
    // Calls the createWorkerAccount Cloud Function — see functions/index.js.
    // It uses the Admin SDK so the caller's own session is never disturbed.
    const { httpsCallable } = window._fb;
    const callCreateWorker = httpsCallable(window._functions, 'createWorkerAccount');
    await callCreateWorker({ shopId: currentShopId, name: name || email, email, password: pass });
    closeModal('user-modal');
    toast(`Account created for ${name || email}!`);
  } catch (e) {
    errEl.textContent = e.message || 'Could not create account. Please try again.';
    errEl.style.display = 'block';
  } finally {
    btn.textContent = 'Create account'; btn.disabled = false;
  }
}

async function deleteUser(userId) {
  const u = users.find(x => x.id === userId);
  if (!u) return;
  if (!confirm(`Remove worker "${u.name || u.email}"? They will lose access immediately.`)) return;
  const { deleteDoc, doc } = window._fb;
  await deleteDoc(shopDoc('users', userId));
  // Also remove their shop mapping so they can't resolve into this shop anymore
  await deleteDoc(doc(window._db, 'userShopMap', userId));
  toast('Worker removed');
}
