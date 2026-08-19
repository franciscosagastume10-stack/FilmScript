(() => {
  const resolve = (path) => window.filmscriptApiUrl ? window.filmscriptApiUrl(path) : path;
  const request = async (path, options = {}) => {
    const response = await fetch(resolve(path), { credentials: 'include', cache: 'no-store', ...options, headers:{ ...(options.body ? { 'Content-Type':'application/json' } : {}), ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'This guest invitation is no longer available.');
    return data;
  };
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[character]);
  const status = document.querySelector('[data-guest-status]');
  const navigation = document.querySelector('[data-guest-modules]');
  const content = document.querySelector('[data-guest-content]');
  const labels = { script:'Script', analysis:'Analysis', breakdown:'Breakdown', shot_list:'Shot List', stripboard:'Stripboard', calendar:'Calendar', canvas:'Canvas', imagine:'Imagine', files:'Files' };
  async function openModule(module) {
    content.innerHTML = '<div class="fs-guest-loading">Loading permitted content</div>';
    try {
      const result = await request(`/api/guest/modules/${module}`);
      if (module === 'script') {
        const blocks = (result.content?.blocks || []).map((block) => `<p class="fs-guest-script-block fs-block-${escapeHtml(block.type)}">${escapeHtml(block.text)}</p>`).join('');
        content.innerHTML = `<article><h2>${escapeHtml(result.content?.title || 'Script')}</h2><div class="fs-guest-script">${blocks || '<p>No script content is available yet.</p>'}</div></article>`;
      } else content.innerHTML = `<article><h2>${escapeHtml(labels[module] || module)}</h2><pre>${escapeHtml(JSON.stringify(result.content, null, 2))}</pre></article>`;
      navigation.querySelectorAll('button').forEach((button) => button.setAttribute('aria-current', button.dataset.module === module ? 'page' : 'false'));
    } catch (error) { content.innerHTML = `<div class="fs-guest-error"><strong>Access unavailable</strong><p>${escapeHtml(error.message)}</p></div>`; }
  }
  async function init() {
    const token = new URLSearchParams(location.search).get('invitation');
    if (!token) { status.textContent = 'This invitation link is incomplete.'; return; }
    try {
      const result = await request('/api/invitations/guest', { method:'POST', body:JSON.stringify({ token }) });
      history.replaceState({}, '', 'GuestAccess.html');
      const permissions = result.invitation?.permissions?.modulePermissions || {};
      const modules = Object.keys(labels).filter((module) => ['view','comment','edit','manage'].includes(permissions[module]));
      status.textContent = `Read only access expires ${new Date(result.expiresAt).toLocaleString()}.`;
      navigation.hidden = false;
      navigation.innerHTML = modules.map((module) => `<button type="button" data-module="${module}">${labels[module]}</button>`).join('');
      navigation.querySelectorAll('button').forEach((button) => button.onclick = () => openModule(button.dataset.module));
      if (modules[0]) openModule(modules[0]); else content.innerHTML = '<div class="fs-guest-error"><strong>No project areas were shared.</strong></div>';
    } catch (error) { status.textContent = error.message; content.innerHTML = '<div class="fs-guest-error"><strong>Ask the project owner for a new invitation.</strong></div>'; }
  }
  init();
})();
