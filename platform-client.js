(() => {
  const resolve = (path) => window.filmscriptApiUrl ? window.filmscriptApiUrl(path) : path;
  const resolveAsset = (path) => /^(?:https?:|data:|blob:)/i.test(String(path || '')) ? String(path) : resolve(path);
  const request = async (path, options = {}) => {
    const response = await fetch(resolve(path), { credentials: 'include', cache: 'no-store', ...options, headers: { ...(options.body && typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.message || data.error || 'FilmScript could not complete that action.'), { status: response.status, code: data.error });
    return data;
  };
  const params = new URLSearchParams(location.search);
  const projectId = params.get('script') || params.get('project') || null;
  const clientId = (() => { try { const current = sessionStorage.getItem('filmscript_client_id'); if (current) return current; const next = `client_${crypto.randomUUID().replace(/-/g, '')}`; sessionStorage.setItem('filmscript_client_id', next); return next; } catch { return `client_${Date.now()}`; } })();
  const themes = [
    ['filmscript','FilmScript','#ffb703'],['dark','Dark','#191919'],['mint','Mint','#bce3ca'],['tangerine','Tangerine','#f6bd88'],
    ['lavender','Lavender','#d9c7ef'],['sky','Sky','#bcdff1'],['rose','Rose','#f0c4cf'],['sun','Sun','#f3dc8c'],
  ];
  const avatarBackgrounds = [
    ['amber','Amber','#D99A32','#241707'],['tangerine','Tangerine','#D8784E','#281008'],['mint','Mint','#70A98A','#10241A'],['sky','Sky','#6C9DC1','#10232E'],
    ['lavender','Lavender','#947EB8','#21152C'],['rose','Rose','#BD7586','#2D1019'],['sand','Sand','#B89A73','#261A0E'],['slate','Slate','#596875','#FFFEF9'],
  ];
  const profileIcons = [
    { id:'camera', label:'Cinema camera', svg:'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8.5 20.5c.2-2.8 1.8-4.3 4.7-4.4l17.1.4c2.5.1 3.8 1.7 3.7 4.2l-.3 12.1c-.1 2.4-1.8 3.8-4.2 3.8l-16.8-.4c-2.7-.1-4.1-1.6-4-4.3l-.2-11.4Z"/><path d="m34 23.2 7.2-4.1-.3 14.4-7-4.2M15 16l3.4-5.1 7.3.2 3 5.3M18.4 23.1c4-2.4 8.9.4 8.3 4.7-.5 3.5-4.6 5.2-7.4 3.1-2.5-1.8-2.8-5.9-.9-7.8Z"/></svg>' },
    { id:'clapperboard', label:'Clapperboard', svg:'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="m8.1 18.5 32.1-6.4 1.1 6-32 6.4-1.2-6Z"/><path d="m12.3 17.6 3.1 5m7.2-7 3.1 4.8m7.3-6.7 3.2 4.7M10.2 24.3l29.3-5.8.1 19.2-28.8.2-.6-13.6Z"/><path d="M11.2 29.2c8.8-.5 18.1-.4 27.7-.2"/></svg>' },
    { id:'film-reel', label:'Film reel', svg:'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M23.8 7.4c9.4-.2 16.9 7.2 16.7 16.7-.2 9.1-7.7 16.6-16.8 16.4C14.4 40.4 7 32.9 7.3 23.6 7.5 14.8 14.7 7.6 23.8 7.4Z"/><path d="M21 12.1c3.1-1.8 6.2.8 5 4-.8 2.2-3.6 3-5.4 1.5-1.7-1.4-1.5-4.2.4-5.5ZM12.7 24c-.2-3.5 3.6-5.2 6-2.7 1.7 1.8.9 4.7-1.4 5.5-2.1.8-4.4-.6-4.6-2.8Zm9.1 11.2c-3.2-1.5-2.9-5.6.4-6.6 2.3-.7 4.5 1.4 4 3.8-.4 2.2-2.4 3.7-4.4 2.8Zm10.8-8.4c-3.4.8-5.7-2.6-3.7-5.4 1.4-2 4.4-1.7 5.5.5 1 2 .2 4.4-1.8 4.9ZM22 23.6c.1-2.5 3.7-2.7 4-.2.3 2.7-3.8 3-4 .2Z"/></svg>' },
    { id:'screenplay', label:'Screenplay pages', svg:'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M13 7.8c7-.1 14.1.1 21.3.3l.7 31.1c-7.4.4-14.8.2-22.2-.2L13 7.8Z"/><path d="M18.4 15.3c3.5-.2 7.2-.1 11 .1m-11 6.3c2.9.1 6.1.1 9.5-.1m-9.6 6.5c4.5-.1 8.6 0 12 .3m-11.9 6c3.2.2 6.7.2 10.6 0"/><path d="m10.2 11.5.3 30.1c6.8.4 13.1.4 19-.1"/></svg>' },
    { id:'director-chair', label:'Director chair', svg:'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 8.7c7.9-.4 15.7-.3 23.4.2l-.8 12.5c-7.1.4-14.2.3-21.5-.2L12 8.7Z"/><path d="M14.3 22.1 35 40.2M34.2 21.8 14 40.5M10.5 23.8c9.3.8 18.5.7 27.5-.2M12.8 40.4h6.5m9.5 0h7"/></svg>' },
    { id:'spotlight', label:'Studio spotlight', svg:'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10.1 13.6c8-2.5 16-4.2 24-4.9l3.5 17.6c-7.8 1.5-15.3 3-22.7 4.8l-4.8-17.5Z"/><path d="m35.4 11.1 5.8-2.5m-4.1 8.1 5.7-.2m-5 6.2 5.6 2.1M25.1 29.2l-.2 7.3m-8.5 4h17.1m-12.1-4 7.3.1"/><path d="M13.8 17c7.3-2 14.8-3.5 22.3-4.4"/></svg>' },
    { id:'microphone', label:'Boom microphone', svg:'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M29.6 6.9c3.7-1.2 7.4 1.3 8 5.2.5 3.4-1.8 6.6-5.2 7.2-3.7.7-7.1-1.8-7.5-5.5-.3-3.1 1.5-5.9 4.7-6.9Z"/><path d="M28.2 19.1 16.8 40.8m-5.4-.2h11m6.8-34.2 8.9 5.4M23.6 16.7l3.7 2.2M14 26.7c2.8 2 5.4 3.5 8.1 4.2"/></svg>' },
    { id:'star', label:'Practical star', svg:'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="m24.1 7.2 4.5 11.1 12 .9-9.2 7.8 3 11.7-10.2-6.4-10.3 6.2 3.1-11.7-9-7.9 11.9-.6 4.2-11.1Z"/><path d="m24.2 13.1 2.6 7.9 8 .5-6.3 5.2 2 7.7"/></svg>' },
    { id:'moon', label:'Night exterior', svg:'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M32.7 8.5c-7.3 2.1-11.4 9.5-9.2 16.7 2.1 7.1 9.5 11.1 16.5 9-3.5 5-9.7 7.6-15.6 6.2C15.2 38.2 9.5 29 11.7 19.8 13.9 10.7 23.2 5 32.7 8.5Z"/><path d="M12 13.2 8.8 10m7.8-.1.1-4.3M9 18.9l-4.2.2"/></svg>' },
    { id:'sun', label:'Day exterior', svg:'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 14.2c5.7-.2 10.2 4.4 10 10-.2 5.4-4.6 9.7-10 9.7-5.5-.1-9.9-4.6-9.8-10 .1-5.2 4.4-9.5 9.8-9.7Z"/><path d="m24 5.5.2 5m-.3 27.6.1 4.5M5.5 24.2l4.7-.2m27.7.2 4.5-.1M10.7 10.8l3.4 3.4m19.6 19.5 3.2 3.2m.1-26.4-3.3 3.6M14 33.8l-3.3 3.3"/></svg>' },
  ];
  const state = { me: null, profile: null, notifications: [], presence: [], eventSource: null, chatPeer: null, chatMessages: [], chatRequestId: null, releaseNoticeState: 'idle' };
  let lastUserActivityAt = Date.now();
  let themeSave = Promise.resolve();
  const currentModule = () => ({ editor:'script', shotlist:'shot_list' }[new URLSearchParams(location.search).get('view') || 'script'] || new URLSearchParams(location.search).get('view') || 'script');

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[char]);
  const api = {
    me: () => request('/api/me'), profile: () => request('/api/me/platform-profile'),
    updateMe: (body) => request('/api/me', { method:'PATCH', body:JSON.stringify(body) }),
    updateProfile: (body) => request('/api/me/platform-profile', { method:'PATCH', body:JSON.stringify(body) }),
    notifications: () => request('/api/notifications'), markRead: (id) => request(`/api/notifications${id ? `/${id}` : ''}`, { method:'PATCH' }), deleteNotification: (id) => request(`/api/notifications${id ? `/${id}` : ''}`, { method:'DELETE' }),
    releaseNotice: () => request('/api/release-notice'), acknowledgeReleaseNotice: () => request('/api/release-notice', { method:'POST', keepalive:true }),
    members: () => request(`/api/projects/${projectId}/members`), invite: (body) => request(`/api/projects/${projectId}/members`, { method:'POST', body:JSON.stringify(body) }),
    updateMember: (id, body) => request(`/api/projects/${projectId}/members/${id}`, { method:'PATCH', body:JSON.stringify(body) }),
    transferOwnership: (membershipId) => request(`/api/projects/${projectId}/ownership/transfer`, { method:'POST', body:JSON.stringify({ membershipId }) }),
    updateInvitation: (id, body) => request(`/api/projects/${projectId}/invitations/${id}`, { method:'PATCH', body:JSON.stringify(body) }),
    revokeInvitation: (id) => request(`/api/projects/${projectId}/invitations/${id}`, { method:'DELETE' }),
    invitationLink: (id, resend = false) => request(`/api/projects/${projectId}/invitations/${id}/${resend ? 'resend' : 'link'}`, { method:'POST' }),
    activity: (module) => request(`/api/projects/${projectId}/activity${module ? `?module=${encodeURIComponent(module)}` : ''}`),
    translationPreview: (id, targetLanguage) => request(`/api/scripts/${id}/translation`, { method:'POST', body:JSON.stringify({ preview:true,targetLanguage }) }),
    translate: (id, targetLanguage) => request(`/api/scripts/${id}/translation`, { method:'POST', body:JSON.stringify({ targetLanguage }) }),
    createShared: (body) => request(`/api/projects/${projectId}/shared-projects`, { method:'POST', body:JSON.stringify(body) }),
    locationPlans: () => request(`/api/projects/${projectId}/location-plans`),
    createLocationPlan: (body) => request(`/api/projects/${projectId}/location-plans`, { method:'POST', body:JSON.stringify(body) }),
    saveLocationPlan: (plan, expectedVersion) => request(`/api/projects/${projectId}/location-plans/${plan.id}`, { method:'PATCH', body:JSON.stringify({ plan, expectedVersion }) }),
    collaborate: (body) => request(`/api/projects/${projectId}/collaboration/operations`, { method:'POST', headers:{ 'X-FilmScript-Client-Id':clientId }, body:JSON.stringify(body) }),
    chatPeers: () => request(`/api/projects/${projectId}/chat/peers`),
    chat: (peer) => request(`/api/projects/${projectId}/chat?with=${encodeURIComponent(peer)}`),
    sendChat: (peer, body) => request(`/api/projects/${projectId}/chat`, { method:'POST', headers:{ 'X-FilmScript-Client-Id':clientId }, body:JSON.stringify({ recipientId:peer, body }) }),
  };

  function applyTheme(theme, persist = false) {
    const selected = themes.some(([id]) => id === theme) ? theme : 'filmscript';
    if (window.filmscriptTheme?.get?.() !== selected) window.filmscriptTheme?.set?.(selected);
    else document.documentElement.dataset.filmscriptTheme = selected;
    if (!window.filmscriptTheme) {
      try { localStorage.setItem('filmscript_theme', selected); } catch {}
      window.dispatchEvent(new CustomEvent('filmscript:theme-change', { detail:{ theme:selected } }));
    }
    if (selected === 'dark') document.documentElement.setAttribute('data-filmscript-dark', ''); else document.documentElement.removeAttribute('data-filmscript-dark');
    if (persist) themeSave = themeSave.catch(() => {}).then(() => api.updateProfile({ theme:selected })).catch(() => {});
    window.dispatchEvent(new CustomEvent('filmscript:theme-changed', { detail:{ theme:selected, dark:selected === 'dark' } }));
  }

  function profileIcon(id) { return profileIcons.find((item) => item.id === id) || null; }
  function avatarBackground(id) { return avatarBackgrounds.find((item) => item[0] === id) || avatarBackgrounds[0]; }
  function accountIdentity() {
    const preset = profileIcon(state.profile?.avatarCrop?.presetIcon);
    const background = avatarBackground(state.profile?.avatarCrop?.presetBackground);
    const uploaded = state.profile?.avatarUrl || null;
    const fallback = state.me?.picture || state.me?.avatar || null;
    return { preset, background, imageUrl:preset ? null : uploaded || fallback, initial:String(state.me?.name || state.me?.email || 'F').trim().charAt(0).toUpperCase() || 'F' };
  }

  function renderIdentity(target, identity = accountIdentity()) {
    if (!target) return;
    const resolvedImage = identity.imageUrl ? resolveAsset(identity.imageUrl) : null;
    const signature = resolvedImage ? `photo:${resolvedImage}` : identity.preset ? `preset:${identity.preset.id}:${identity.background?.[0] || 'amber'}` : `initial:${identity.initial}`;
    const intact = resolvedImage ? !target.textContent && target.style.backgroundImage : identity.preset ? Boolean(target.querySelector('svg')) : target.textContent === identity.initial;
    if (target.dataset.avatarSignature === signature && intact) return;
    target.dataset.avatarSignature = signature;
    target.style.removeProperty('background-image');
    target.style.removeProperty('background-position');
    target.style.removeProperty('background-repeat');
    target.style.removeProperty('background-size');
    target.style.removeProperty('background-color');
    target.style.removeProperty('--profile-avatar-ink');
    target.replaceChildren();
    if (resolvedImage) {
      const url = resolvedImage;
      target.style.backgroundImage = `url("${String(url).replace(/["\\]/g, '\\$&')}")`;
      target.style.backgroundPosition = 'center';
      target.style.backgroundRepeat = 'no-repeat';
      target.style.backgroundSize = 'cover';
      target.dataset.avatarIdentity = 'photo';
    } else if (identity.preset) {
      target.style.backgroundColor = identity.background[2];
      target.style.setProperty('--profile-avatar-ink', identity.background[3]);
      target.innerHTML = identity.preset.svg;
      target.dataset.avatarIdentity = identity.preset.id;
    } else {
      target.style.backgroundColor = 'var(--accent)';
      target.textContent = identity.initial;
      target.dataset.avatarIdentity = 'initial';
    }
  }

  function applyAccountIdentity() {
    const identity = accountIdentity();
    document.querySelectorAll('[data-testid="account-avatar"]').forEach((avatarEl) => {
      renderIdentity(avatarEl, identity);
      avatarEl.dataset.avatarLoaded = 'true';
    });
  }

  let dialogCleanup = null;
  function closeDialog() {
    const scrim = document.querySelector('.fs-platform-scrim');
    const cleanup = dialogCleanup; dialogCleanup = null;
    scrim?.remove(); cleanup?.();
  }
  function dialog(title, subtitle, content, className = '') {
    closeDialog();
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.querySelectorAll('details[open]').forEach((details) => details.removeAttribute('open'));
    const scrim = document.createElement('div'); scrim.className = 'fs-platform-scrim';
    scrim.innerHTML = `<section class="fs-platform-dialog ${className}" role="dialog" aria-modal="true" aria-labelledby="fs-platform-title"><header class="fs-platform-head"><div><h2 id="fs-platform-title">${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div><button class="fs-platform-close" type="button" aria-label="Close">×</button></header><div class="fs-platform-body">${content}</div></section>`;
    scrim.addEventListener('click', (event) => { if (event.target === scrim || event.target.closest('.fs-platform-close')) closeDialog(); });
    document.body.appendChild(scrim);
    const inerted = [...document.body.children].filter((element) => element !== scrim && element instanceof HTMLElement && !element.inert);
    inerted.forEach((element) => { element.inert = true; });
    const focusable = () => [...scrim.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')].filter((element) => element.getClientRects().length);
    const onKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); closeDialog(); return; }
      if (event.key !== 'Tab') return;
      const items = focusable(); if (!items.length) return;
      const first = items[0]; const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    dialogCleanup = () => {
      document.removeEventListener('keydown', onKey);
      inerted.forEach((element) => { element.inert = false; });
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll:true });
    };
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(() => (scrim.querySelector('.fs-platform-close') || focusable()[0])?.focus());
    return scrim;
  }

  function avatar(person, className = 'fs-member-avatar') {
    const name = person?.name || person?.email || 'Collaborator'; const initial = name.trim().charAt(0).toUpperCase() || 'C';
    const preset = profileIcon(person?.avatarPreset); const background = avatarBackground(person?.avatarBackground)[2];
    const picture = person?.picture ? resolveAsset(person.picture) : null;
    const ink = avatarBackground(person?.avatarBackground)[3];
    const style = `${person?.color ? `--collaborator-color:${escapeHtml(person.color)};` : ''}${preset ? `--profile-avatar-bg:${background};--profile-avatar-ink:${ink};` : ''}`;
    return `<span class="${className}${preset ? ' fs-preset-avatar' : ''}"${style ? ` style="${style}"` : ''}>${preset ? preset.svg : picture ? `<img src="${escapeHtml(picture)}" alt="">` : escapeHtml(initial)}</span>`;
  }

  function notificationTime(value) {
    const time = Date.parse(value || ''); if (!Number.isFinite(time)) return '';
    const elapsed = Math.max(0, Date.now() - time);
    if (elapsed < 60_000) return 'Now';
    if (elapsed < 60 * 60_000) return `${Math.floor(elapsed / 60_000)}m`;
    if (elapsed < 24 * 60 * 60_000) return `${Math.floor(elapsed / (60 * 60_000))}h`;
    if (elapsed < 48 * 60 * 60_000) return 'Yesterday';
    return new Intl.DateTimeFormat(undefined, { month:'short', day:'numeric' }).format(new Date(time));
  }

  function notificationVisual(type) {
    const value = String(type || '').toLowerCase();
    if (value.includes('mention')) return { glyph:'@', tone:'mention' };
    if (value.includes('comment') || value.includes('reply')) return { glyph:'↩', tone:'comment' };
    if (value.includes('invitation') || value.includes('member')) return { glyph:'+', tone:'people' };
    if (value.includes('permission') || value.includes('ownership')) return { glyph:'✓', tone:'access' };
    if (value.includes('analysis') || value.includes('breakdown') || value.includes('shot') || value.includes('translation')) return { glyph:'✦', tone:'lumiere' };
    return { glyph:'F', tone:'filmscript' };
  }

  function notificationCard(item) {
    const visual = notificationVisual(item.type);
    return `<article class="fs-notification-card${item.read ? '' : ' is-unread'}" data-notification-row data-id="${escapeHtml(item.id)}"><button type="button" class="fs-notification-open" data-notification-open data-link="${escapeHtml(item.deepLink || '')}" aria-label="${escapeHtml(`${item.title}. ${item.message}`)}"><span class="fs-notification-icon" data-tone="${visual.tone}" aria-hidden="true">${visual.glyph}</span><span class="fs-notification-copy"><span class="fs-notification-title"><strong>${escapeHtml(item.title)}</strong><time datetime="${escapeHtml(item.updatedAt || item.createdAt || '')}">${escapeHtml(notificationTime(item.updatedAt || item.createdAt))}</time></span><span class="fs-notification-message">${escapeHtml(item.message)}</span></span>${item.read ? '' : '<span class="fs-notification-unread" aria-label="Unread"></span>'}</button><button type="button" class="fs-notification-delete" data-notification-delete aria-label="Delete notification" title="Delete"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"></path></svg></button></article>`;
  }

  async function openNotifications() {
    const result = await api.notifications(); state.notifications = result.notifications;
    const unread = result.notifications.filter((item) => !item.read); const earlier = result.notifications.filter((item) => item.read);
    const groups = [[unread.length ? 'New' : '', unread], [earlier.length ? 'Earlier' : '', earlier]].filter(([,items]) => items.length);
    const list = groups.map(([labelText,items]) => `<section class="fs-notification-group"><h3>${labelText}</h3><div class="fs-notification-stack">${items.map(notificationCard).join('')}</div></section>`).join('');
    const empty = '<div class="fs-notification-empty"><span aria-hidden="true">✓</span><strong>You are all caught up</strong><p>Invitations, mentions and completed FilmScript work will appear here.</p></div>';
    const toolbar = result.notifications.length ? `<div class="fs-notification-toolbar"><span><strong>${result.unreadCount}</strong> unread</span><div>${result.unreadCount ? '<button type="button" data-mark-all>Read all</button>' : ''}<button type="button" data-clear-all>Clear</button></div></div>` : '';
    const root = dialog('Notifications', result.unreadCount ? `${result.unreadCount} new ${result.unreadCount === 1 ? 'update' : 'updates'}` : 'Everything important, without the noise.', `<div class="fs-notification-center">${toolbar}${list || empty}</div>`, 'fs-notifications-dialog');
    root.querySelectorAll('[data-notification-open]').forEach((button) => button.addEventListener('click', async () => { const row = button.closest('[data-notification-row]'); if (row?.classList.contains('is-unread')) await api.markRead(row.dataset.id); if (button.dataset.link) location.href = button.dataset.link; else { openNotifications(); refreshNotifications(); } }));
    root.querySelectorAll('[data-notification-delete]').forEach((button) => button.addEventListener('click', async () => { const row = button.closest('[data-notification-row]'); if (!row) return; button.disabled = true; try { await api.deleteNotification(row.dataset.id); row.classList.add('is-removing'); window.setTimeout(() => { openNotifications(); refreshNotifications(); }, 190); } catch { button.disabled = false; } }));
    root.querySelector('[data-mark-all]')?.addEventListener('click', async (event) => { event.currentTarget.disabled = true; await api.markRead(); root.querySelectorAll('.is-unread').forEach((row) => row.classList.remove('is-unread')); openNotifications(); refreshNotifications(); });
    root.querySelector('[data-clear-all]')?.addEventListener('click', async (event) => { if (!confirm('Delete all notifications?')) return; event.currentTarget.disabled = true; await api.deleteNotification(); root.querySelectorAll('[data-notification-row]').forEach((row) => row.classList.add('is-removing')); window.setTimeout(() => { openNotifications(); refreshNotifications(); }, 190); });
  }

  function releaseNoticeCopy() {
    const spanish = String(window.filmscriptLanguage?.get?.() || document.documentElement.lang || 'en').toLowerCase().startsWith('es');
    return spanish ? {
      title: 'FilmScript 2.0 ya está aquí',
      subtitle: 'Una actualización para planificar con más claridad y mantener a tu equipo cerca.',
      eyebrow: 'NUEVO EN FILMSCRIPT',
      action: 'Entendido',
      close: 'Cerrar actualización de FilmScript 2.0',
      features: [
        ['split', 'Vista dividida en Desglose', 'Consulta el guion mientras organizas los elementos de producción.'],
        ['chat', 'Conversaciones en tu proyecto', 'Mantén conversaciones privadas con tus colaboradores sin salir de FilmScript.'],
        ['spark', 'Un espacio más claro', 'Controles, notificaciones y tu cuenta ahora son más fáciles de usar.'],
      ],
    } : {
      title: 'FilmScript 2.0 is here',
      subtitle: 'An update to help you plan with more clarity and keep your team close.',
      eyebrow: 'NEW IN FILMSCRIPT',
      action: 'Got it',
      close: 'Close FilmScript 2.0 update',
      features: [
        ['split', 'Split view in Breakdown', 'Keep the screenplay in view while you organize production elements.'],
        ['chat', 'Conversations in your project', 'Keep private conversations with collaborators inside FilmScript.'],
        ['spark', 'A clearer workspace', 'Controls, notifications, and your account are now easier to use.'],
      ],
    };
  }

  function releaseNoticeIcon(kind) {
    if (kind === 'split') return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4" width="17" height="16" rx="3"></rect><path d="M12 4v16M7 8h2M15 8h2M7 12h2M15 12h2"></path></svg>';
    if (kind === 'chat') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5.5h14v10H10l-5 3v-13Z"></path><path d="M8.5 9.5h7M8.5 12.5h4"></path></svg>';
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.45 5.55L19 10l-5.55 1.45L12 17l-1.45-5.55L5 10l5.55-1.45L12 3Z"></path><path d="m18.3 15 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z"></path></svg>';
  }

  function hasReleaseNoticeCollision() {
    return Boolean(document.querySelector('.fs-platform-scrim, .fs-language-modal:not([hidden])'));
  }

  function openReleaseNotice() {
    const copy = releaseNoticeCopy();
    const features = copy.features.map(([icon, title, body]) => `<li class="fs-release-notice-item"><span class="fs-release-notice-icon" aria-hidden="true">${releaseNoticeIcon(icon)}</span><span><strong>${title}</strong><small>${body}</small></span></li>`).join('');
    const root = dialog(copy.title, copy.subtitle, `<section class="fs-release-notice" data-i18n-skip><div class="fs-release-notice-orbit" aria-hidden="true"><span></span><i></i><b></b></div><div class="fs-release-notice-eyebrow">${copy.eyebrow}</div><ul class="fs-release-notice-list">${features}</ul><div class="fs-release-notice-actions"><button type="button" class="fs-action fs-action-primary" data-release-notice-ack>${copy.action}</button></div></section>`, 'fs-release-notice-dialog');
    const panel = root.querySelector('.fs-platform-dialog');
    panel?.setAttribute('data-i18n-skip', '');
    root.querySelector('.fs-platform-close')?.setAttribute('aria-label', copy.close);

    let acknowledged = false;
    const acknowledge = () => {
      if (acknowledged) return;
      acknowledged = true;
      api.acknowledgeReleaseNotice().catch(() => {});
    };
    const onKeyDown = (event) => { if (event.key === 'Escape') acknowledge(); };
    const onClickCapture = (event) => {
      if (event.target === root || event.target.closest('.fs-platform-close')) acknowledge();
    };
    document.addEventListener('keydown', onKeyDown, true);
    root.addEventListener('click', onClickCapture, true);
    const observer = new MutationObserver(() => {
      if (root.isConnected) return;
      observer.disconnect();
      document.removeEventListener('keydown', onKeyDown, true);
      root.removeEventListener('click', onClickCapture, true);
    });
    observer.observe(document.body, { childList:true });
    root.querySelector('[data-release-notice-ack]')?.addEventListener('click', () => { acknowledge(); closeDialog(); });
  }

  let releaseNoticeLanguageListener = null;
  function scheduleReleaseNotice() {
    if (!state.me?.authenticated || state.releaseNoticeState !== 'idle') return;
    const check = (attempt = 0) => {
      if (state.releaseNoticeState !== 'idle') return;
      if (window.filmscriptLanguage?.needsInitialChoice?.()) {
        state.releaseNoticeState = 'waiting-language';
        if (!releaseNoticeLanguageListener) {
          releaseNoticeLanguageListener = () => {
            releaseNoticeLanguageListener = null;
            state.releaseNoticeState = 'idle';
            window.setTimeout(scheduleReleaseNotice, 0);
          };
          window.addEventListener('filmscript:initial-language-choice', releaseNoticeLanguageListener, { once:true });
        }
        return;
      }
      if (hasReleaseNoticeCollision()) {
        if (attempt >= 40) { state.releaseNoticeState = 'deferred'; return; }
        window.setTimeout(() => check(attempt + 1), 150);
        return;
      }
      state.releaseNoticeState = 'checking';
      api.releaseNotice().then((result) => {
        if (!result?.notice?.version) { state.releaseNoticeState = 'done'; return; }
        // A notification, invitation, or language dialog can appear while the
        // account-level claim is in flight. Keep this single claim on the
        // current page until the other dialog has left rather than flashing
        // two layers at once or losing the welcome entirely.
        const presentWhenClear = (presentAttempt = 0) => {
          if (!hasReleaseNoticeCollision()) {
            state.releaseNoticeState = 'presenting';
            openReleaseNotice();
            return;
          }
          if (presentAttempt >= 120) { state.releaseNoticeState = 'deferred'; return; }
          window.setTimeout(() => presentWhenClear(presentAttempt + 1), 150);
        };
        presentWhenClear();
      }).catch(() => { state.releaseNoticeState = 'done'; });
    };
    window.setTimeout(() => check(), 120);
  }

  async function openChatDirectory() {
    if (!projectId) return;
    let result; try { result = await api.chatPeers(); } catch (error) { dialog('Chat', 'Collaborator chat is unavailable right now.', `<p class="fs-guest-error">${escapeHtml(error.message)}</p>`); return; }
    const people = (result.peers || []).filter((member) => member.userId && member.userId !== state.me?.id);
    const cards = people.map((member) => `<button class="fs-chat-person" type="button" data-chat-peer="${escapeHtml(member.userId)}"><span class="fs-chat-avatar">${escapeHtml(String(member.name || member.email || 'C').trim().charAt(0).toUpperCase())}</span><span><strong>${escapeHtml(member.name || member.email || 'Collaborator')}</strong><small>${escapeHtml(member.email || 'FilmScript collaborator')}</small></span><span class="fs-chat-arrow" aria-hidden="true">›</span></button>`).join('');
    const root = dialog('Collaborator chat', 'Pick someone from this project to start a private conversation.', `<div class="fs-chat-directory">${cards || '<div class="fs-chat-empty">Invite a collaborator to start chatting.</div>'}</div>`, 'fs-chat-directory-dialog');
    root.querySelectorAll('[data-chat-peer]').forEach((button) => button.addEventListener('click', () => { closeDialog(); openChat(button.dataset.chatPeer, button.querySelector('strong')?.textContent || 'Collaborator'); }));
  }

  async function openChat(peerId, peerName = 'Collaborator') {
    if (!projectId || !peerId) return;
    state.chatPeer = peerId;
    const requestId = `${peerId}:${Date.now()}:${Math.random()}`;
    state.chatRequestId = requestId;
    let panel = document.querySelector('.fs-chat-panel');
    if (!panel) { panel = document.createElement('section'); panel.className = 'fs-chat-panel'; panel.setAttribute('aria-label', 'Collaborator chat'); document.body.appendChild(panel); }
    panel.innerHTML = `<header class="fs-chat-head"><span class="fs-chat-brand" aria-hidden="true">✦</span><div><strong>${escapeHtml(peerName)}</strong><small>FilmScript collaborator</small></div><button type="button" class="fs-chat-close" data-chat-close aria-label="Close chat">×</button></header><div class="fs-chat-messages" data-chat-messages><div class="fs-chat-loading">Opening conversation…</div></div><form class="fs-chat-compose" data-chat-form><textarea name="body" rows="1" maxlength="2000" placeholder="Write a message…" aria-label="Message"></textarea><button type="submit" aria-label="Send message">↗</button></form>`;
    panel.querySelector('[data-chat-close]').onclick = () => { if (state.chatPeer === peerId) { state.chatPeer = null; state.chatRequestId = null; } panel.remove(); };
    const messages = panel.querySelector('[data-chat-messages]');
    const render = (items) => { messages.innerHTML = items.length ? items.map((item) => `<article class="fs-chat-bubble ${item.senderId === state.me?.id ? 'is-mine' : ''}"><p>${escapeHtml(item.body)}</p><time>${escapeHtml(notificationTime(item.createdAt))}</time></article>`).join('') : '<div class="fs-chat-empty">No messages yet. Say hello.</div>'; messages.scrollTop = messages.scrollHeight; };
    try { const result = await api.chat(peerId); if (state.chatPeer !== peerId || state.chatRequestId !== requestId || !panel.isConnected) return; state.chatMessages = result.messages || []; render(state.chatMessages); } catch (error) { if (state.chatPeer === peerId && state.chatRequestId === requestId && panel.isConnected) messages.innerHTML = `<div class="fs-chat-empty">${escapeHtml(error.message)}</div>`; }
    panel.querySelector('[data-chat-form]').onsubmit = async (event) => { event.preventDefault(); const input = panel.querySelector('textarea'); const body = input.value.trim(); if (!body) return; input.disabled = true; try { const result = await api.sendChat(peerId, body); state.chatMessages = [...state.chatMessages.filter((item) => item.id !== result.message.id), result.message]; input.value = ''; render(state.chatMessages); } catch (error) { input.setCustomValidity(error.message); input.reportValidity(); } finally { input.disabled = false; input.focus(); } };
  }

  async function openChatFromDeepLink() {
    const peerId = String(params.get('chat') || '').trim();
    if (!peerId) return false;
    const current = new URL(location.href);
    current.searchParams.delete('chat');
    history.replaceState(history.state, '', `${current.pathname}${current.search}${current.hash}`);
    if (!projectId || !/^usr_[A-Za-z0-9_-]{1,80}$/.test(peerId)) return false;
    try {
      const result = await api.chatPeers();
      const peer = (result.peers || []).find((candidate) => candidate.userId === peerId);
      if (!peer) return false;
      openChat(peer.userId, peer.name || peer.email || 'Collaborator');
      return true;
    } catch { return false; }
  }

  const accessModules = ['script','analysis','breakdown','shot_list','stripboard','calendar','budget','canvas','location_plan','imagine','files','project_settings','members','exports','lumiere'];
  const cinematicRoles = ['producer','director','writer','assistant_director','director_of_photography','camera_department','gaffer','grip','production_designer','art_department','sound','hair_and_makeup','wardrobe','production','client','talent'];
  const roleLabels = { owner:'Owner', co_owner:'Co owner', admin:'Admin', editor:'Editor', department_editor:'Department Editor', commenter:'Commenter', viewer:'Viewer', temporary_guest:'Temporary Guest' };
  const uiText = (value) => window.filmscriptLanguage?.t?.(value) || value;
  const interfaceLocale = () => window.filmscriptLanguage?.get?.() === 'es' ? 'es' : 'en';
  const localizedDate = (value) => new Date(value).toLocaleDateString(interfaceLocale());
  const label = (value) => String(value || '').replaceAll('_',' ').replace(/\b\w/g, (character) => character.toUpperCase());
  const financialLabel = (permissions = []) => permissions.includes('financial.manage_access') ? 'Full access and access management' : permissions.includes('financial.edit_all') ? 'Edit all financial information' : permissions.includes('financial.view_all') ? 'View all financial information' : permissions.includes('financial.edit_department') ? 'Edit assigned departments' : permissions.includes('financial.view_department') ? 'View assigned departments' : 'No financial access';
  const permissionSummary = (permissions = {}) => { const entries = Object.entries(permissions).filter(([, level]) => level !== 'no_access'); return entries.length ? `${entries.length} areas · ${entries.slice(0,3).map(([module,level]) => `${label(module)} ${label(level)}`).join(', ')}` : 'No module access'; };
  const permissionRank = { no_access:0, view:1, comment:2, edit:3, manage:4 };
  const cinematicSuggestions = {
    producer:{script:'view',analysis:'view',breakdown:'edit',shot_list:'edit',stripboard:'edit',calendar:'edit',canvas:'edit',location_plan:'edit',files:'edit'},
    director:{script:'comment',analysis:'view',breakdown:'view',shot_list:'edit',stripboard:'view',calendar:'view',canvas:'edit',location_plan:'edit',lumiere:'view'},
    writer:{script:'edit',analysis:'edit',breakdown:'view',shot_list:'view',lumiere:'edit'},
    assistant_director:{script:'view',analysis:'view',breakdown:'edit',shot_list:'edit',stripboard:'manage',calendar:'edit'},
    director_of_photography:{script:'view',analysis:'view',breakdown:'view',shot_list:'edit',canvas:'edit',location_plan:'edit',calendar:'view'},
    production_designer:{script:'view',breakdown:'edit',canvas:'edit',location_plan:'edit',files:'edit'},
    production:{script:'view',breakdown:'edit',stripboard:'edit',calendar:'edit',files:'edit',location_plan:'edit'},
    client:{script:'comment',analysis:'view',shot_list:'view',canvas:'view'}, talent:{script:'view',calendar:'view'}
  };
  function recommendedPermissions(projectRole, cinematicRole) {
    const result = Object.fromEntries(accessModules.map((module) => [module,'no_access']));
    if (['owner','co_owner','admin'].includes(projectRole)) accessModules.forEach((module) => { result[module] = 'manage'; });
    if (projectRole === 'co_owner') result.project_settings = 'edit';
    if (projectRole === 'admin') result.budget = 'no_access';
    if (projectRole === 'editor') accessModules.forEach((module) => { result[module] = ['project_settings','members','budget'].includes(module) ? 'no_access' : 'edit'; });
    if (projectRole === 'commenter') accessModules.forEach((module) => { result[module] = ['project_settings','members','budget'].includes(module) ? 'no_access' : 'comment'; });
    if (projectRole === 'viewer') accessModules.forEach((module) => { result[module] = ['project_settings','members','budget','lumiere'].includes(module) ? 'no_access' : 'view'; });
    for (const [module,level] of Object.entries(cinematicSuggestions[cinematicRole] || {})) if (permissionRank[level] > permissionRank[result[module]]) result[module] = level;
    if (projectRole !== 'owner') result.budget = 'no_access';
    if (projectRole === 'temporary_guest') for (const module of ['members','project_settings','exports','lumiere','budget']) result[module] = 'no_access';
    const maximum = projectRole === 'commenter' ? 'comment' : ['viewer','temporary_guest'].includes(projectRole) ? 'view' : null;
    if (maximum) for (const module of accessModules) if (permissionRank[result[module]] > permissionRank[maximum]) result[module] = maximum;
    return result;
  }

  async function copyInvitationLink(invitationId) {
    const result = await api.invitationLink(invitationId);
    await navigator.clipboard.writeText(result.url);
    return result;
  }

  function openAccessEditor({ member = null, invitation = null, dashboard, inviting = false }) {
    const subject = member || invitation || {};
    const currentRole = subject.projectRole || 'editor';
    const currentCinematic = subject.cinematicRole || 'writer';
    const storedPermissions = subject.modulePermissions || subject.permissions?.modulePermissions || {};
    const permissions = Object.keys(storedPermissions).length ? storedPermissions : recommendedPermissions(currentRole, currentCinematic);
    const financial = subject.financialPermissions || subject.permissions?.financialPermissions || ['financial.no_access'];
    const departments = subject.financialDepartmentIds || subject.permissions?.financialDepartmentIds || [];
    const target = inviting ? `<label class="fs-form-field fs-span-all"><span>FilmScript username, email, or secure guest link</span><input name="target" placeholder="name@example.com or username" autocomplete="email"><small>Leave this blank only when creating a Temporary Guest link.</small></label>` : '';
    const roleOptions = ['co_owner','admin','editor','department_editor','commenter','viewer','temporary_guest'].map((role) => `<option value="${role}"${currentRole === role ? ' selected' : ''}>${roleLabels[role]}</option>`).join('');
    const cinematicOptions = cinematicRoles.map((role) => `<option value="${role}"${currentCinematic === role ? ' selected' : ''}>${label(role)}</option>`).join('');
    const moduleRows = accessModules.map((module) => `<label class="fs-permission-row"><span><strong>${label(module)}</strong></span><select name="module_${module}" aria-label="${label(module)} permission">${['no_access','view','comment','edit','manage'].map((level) => `<option value="${level}"${(permissions[module] || 'no_access') === level ? ' selected' : ''}>${label(level)}</option>`).join('')}</select></label>`).join('');
    const financialValue = financial.includes('financial.manage_access') || financial.includes('financial.edit_all') ? 'full' : financial.includes('financial.edit_department') ? 'department_edit' : financial.includes('financial.view_department') ? 'department_view' : financial.includes('financial.view_all') ? 'all_view' : 'none';
    const root = dialog(inviting ? 'Invite a collaborator' : `Access for ${subject.name || subject.invitedEmail || subject.invitedUsername || 'collaborator'}`, 'Choose a role preset, then customize each project area.', `<form data-access-form class="fs-access-editor">${target}<div class="fs-form-grid"><label class="fs-form-field"><span>Cinematic role</span><select name="cinematicRole">${cinematicOptions}</select></label><label class="fs-form-field"><span>Project role</span><select name="projectRole">${roleOptions}</select></label></div><section class="fs-permission-section"><h3>Module permissions</h3><div class="fs-permission-list">${moduleRows}</div></section><section class="fs-financial-section"><div class="fs-financial-warning">Financial information is sensitive. Choose exactly who can access it.</div><label class="fs-form-field"><span>Financial access</span><select name="financial"><option value="none"${financialValue === 'none' ? ' selected' : ''}>No financial access</option><option value="all_view"${financialValue === 'all_view' ? ' selected' : ''}>View all financial information</option><option value="full"${financialValue === 'full' ? ' selected' : ''}>Edit all and export</option><option value="department_view"${financialValue === 'department_view' ? ' selected' : ''}>View assigned departments</option><option value="department_edit"${financialValue === 'department_edit' ? ' selected' : ''}>Edit assigned departments</option></select></label><label class="fs-form-field"><span>Financial department IDs</span><input name="departments" value="${escapeHtml(departments.join(', '))}" placeholder="camera, art, production"></label></section><div class="fs-dialog-actions"><button class="fs-action" type="button" data-back>Cancel</button><button class="fs-action fs-action-primary" type="submit">${inviting ? 'Create invitation' : 'Save access'}</button></div><p class="fs-form-message" data-form-message role="status"></p></form>`, 'fs-access-dialog');
    const mayManageFinancial = (dashboard?.access?.financialPermissions || []).includes('financial.manage_access');
    if (!mayManageFinancial) { root.querySelector('[name="financial"]').disabled = true; root.querySelector('[name="departments"]').disabled = true; }
    const applyPreset = () => { const values = recommendedPermissions(root.querySelector('[name="projectRole"]').value, root.querySelector('[name="cinematicRole"]').value); for (const [module,level] of Object.entries(values)) root.querySelector(`[name="module_${module}"]`).value = level; if (root.querySelector('[name="projectRole"]').value === 'temporary_guest') root.querySelector('[name="financial"]').value = 'none'; };
    root.querySelector('[name="projectRole"]').addEventListener('change', applyPreset);
    root.querySelector('[name="cinematicRole"]').addEventListener('change', applyPreset);
    root.querySelector('[data-back]').onclick = () => openMembers();
    root.querySelector('[data-access-form]').onsubmit = async (event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget); const financialMode = form.get('financial');
      const financialPermissions = financialMode === 'full' ? ['financial.view_all','financial.edit_all','financial.export'] : financialMode === 'all_view' ? ['financial.view_all'] : financialMode === 'department_edit' ? ['financial.view_department','financial.edit_department'] : financialMode === 'department_view' ? ['financial.view_department'] : ['financial.no_access'];
      const modulePermissions = Object.fromEntries(accessModules.map((module) => [module, form.get(`module_${module}`)]));
      const payload = { projectRole:form.get('projectRole'), cinematicRole:form.get('cinematicRole'), modulePermissions, financialPermissions, financialDepartmentIds:String(form.get('departments') || '').split(',').map((item) => item.trim()).filter(Boolean) };
      const message = root.querySelector('[data-form-message]');
      try {
        if (inviting) { const value = String(form.get('target') || '').trim(); const created = await api.invite({ ...payload, ...(value.includes('@') ? { email:value } : { username:value }) }); await navigator.clipboard.writeText(created.invitation.url).catch(() => {}); }
        else if (member) await api.updateMember(member.id, payload);
        else await api.updateInvitation(invitation.id, payload);
        openMembers();
      } catch (error) { message.textContent = error.message; }
    };
  }

  async function openMembers() {
    let result;
    try { result = await api.members(); } catch (error) { return dialog('People & Access', 'Project collaboration settings', `<div class="fs-guest-error"><strong>People and access could not be loaded.</strong><p>${escapeHtml(error.message)}</p></div>`); }
    const access = result.access || {}; const canManage = ['owner','co_owner','admin'].includes(access.projectRole); const canManageFinancial = (access.financialPermissions || []).includes('financial.manage_access'); const canAssignLeaders = ['owner','co_owner'].includes(access.projectRole);
    const people = result.members.map((member) => {
      const actions = member.projectRole === 'owner' || !canManage ? '' : `<details class="fs-context"><summary aria-label="Actions for ${escapeHtml(member.name || 'collaborator')}">•••</summary><div class="fs-context-menu"><button data-edit-member="${member.id}">Edit role and permissions</button>${canAssignLeaders ? `<button data-member-role="${member.id}:admin">Promote to Admin</button><button data-member-role="${member.id}:co_owner">Promote to Co owner</button>` : ''}${access.projectRole === 'owner' ? `<button data-transfer="${member.id}">Transfer ownership</button>` : ''}<button data-member-status="${member.id}:suspended">Suspend access</button><button class="fs-danger-text" data-member-status="${member.id}:removed">Remove from project</button></div></details>`;
      const collaboration = member.collaboration || { state:'disconnected', module:null };
      return `<article class="fs-people-row" data-member-id="${member.id}">${avatar({ ...member, color:collaboration.color })}<span class="fs-member-copy"><strong>${escapeHtml(member.name || member.email || 'Collaborator')}</strong><small>${escapeHtml(member.email || member.username || 'FilmScript member')}</small><span class="fs-access-summary">${escapeHtml(permissionSummary(member.modulePermissions))}</span></span><span class="fs-people-meta"><strong>${escapeHtml(label(member.cinematicRole || 'Collaborator'))}</strong><small>${escapeHtml(roleLabels[member.projectRole] || label(member.projectRole))}</small></span><span class="fs-finance-summary${financialLabel(member.financialPermissions) === 'No financial access' ? '' : ' has-access'}">${escapeHtml(financialLabel(member.financialPermissions))}</span><span class="fs-status fs-presence-${escapeHtml(collaboration.state)}">${escapeHtml(label(collaboration.state))}${collaboration.module ? ` · ${escapeHtml(label(collaboration.module))}` : ''}</span>${actions}</article>`;
    }).join('');
    const pending = (result.invitations || []).filter((invitation) => invitation.status !== 'accepted').map((invitation) => `<article class="fs-invitation-row"><span class="fs-invite-mark" aria-hidden="true"></span><span class="fs-member-copy"><strong>${escapeHtml(invitation.invitedEmail || invitation.invitedUsername || 'Secure guest link')}</strong><small>${escapeHtml(label(invitation.cinematicRole || 'Collaborator'))} · ${escapeHtml(roleLabels[invitation.projectRole] || label(invitation.projectRole))}</small><span class="fs-access-summary">${escapeHtml((invitation.permissionSummary || []).join(', ') || 'No module access')}</span></span><span class="fs-finance-summary">${escapeHtml(invitation.financialSummary)}</span><span class="fs-invite-expiry"><strong>${escapeHtml(label(invitation.status))}</strong><small>${invitation.expiresAt ? `Expires ${escapeHtml(localizedDate(invitation.expiresAt))}` : 'No expiration'}</small></span>${canManage ? `<details class="fs-context"><summary aria-label="Invitation actions">•••</summary><div class="fs-context-menu"><button data-copy-invite="${invitation.id}">Copy invitation link</button>${result.emailDelivery === 'configured' ? `<button data-resend-invite="${invitation.id}">Resend invitation</button>` : ''}<button data-edit-invite="${invitation.id}">Edit access</button><button class="fs-danger-text" data-revoke-invite="${invitation.id}">Revoke invitation</button></div></details>` : ''}</article>`).join('');
    const content = `<div class="fs-dashboard-toolbar"><div><p class="fs-eyebrow">PROJECT SETTINGS</p><h3>People</h3></div>${canManage ? '<button class="fs-action fs-action-primary" data-new-invite>Invite people</button>' : ''}</div><section class="fs-people-section">${people || '<div class="fs-empty-access"><strong>No collaborators yet</strong><p>Invite someone when you are ready to share the project.</p></div>'}</section><section class="fs-pending-section"><div class="fs-section-title"><h3>Pending Invitations</h3><span>${(result.invitations || []).filter((item) => item.status === 'pending').length}</span></div>${pending || '<div class="fs-empty-access"><strong>No pending invitations</strong><p>New invitations will appear here until they are accepted.</p></div>'}</section>`;
    const root = dialog('People & Access', 'Manage project roles, module permissions, and sensitive financial access.', content, 'fs-people-dialog');
    root.querySelector('[data-new-invite]')?.addEventListener('click', () => openAccessEditor({ inviting:true, dashboard:result }));
    root.querySelectorAll('[data-edit-member]').forEach((button) => button.onclick = () => openAccessEditor({ member:result.members.find((item) => item.id === button.dataset.editMember), dashboard:result }));
    root.querySelectorAll('[data-edit-invite]').forEach((button) => button.onclick = () => openAccessEditor({ invitation:result.invitations.find((item) => item.id === button.dataset.editInvite), dashboard:result }));
    root.querySelectorAll('[data-member-role]').forEach((button) => button.onclick = async () => { const [id,projectRole] = button.dataset.memberRole.split(':'); await api.updateMember(id,{projectRole}); openMembers(); });
    root.querySelectorAll('[data-member-status]').forEach((button) => button.onclick = async () => { const [id,status] = button.dataset.memberStatus.split(':'); if (status === 'removed' && !confirm(uiText('Remove this person from the project now?'))) return; await api.updateMember(id,{status}); openMembers(); });
    root.querySelectorAll('[data-transfer]').forEach((button) => button.onclick = async () => { if (!confirm(uiText('Transfer billing ownership to this person?'))) return; await api.transferOwnership(button.dataset.transfer); openMembers(); });
    root.querySelectorAll('[data-copy-invite]').forEach((button) => button.onclick = async () => { await copyInvitationLink(button.dataset.copyInvite); button.textContent = uiText('Copied'); });
    root.querySelectorAll('[data-resend-invite]').forEach((button) => button.onclick = async () => { await api.invitationLink(button.dataset.resendInvite,true); button.textContent = uiText('Sent'); });
    root.querySelectorAll('[data-revoke-invite]').forEach((button) => button.onclick = async () => { if (!confirm(uiText('Revoke this invitation now?'))) return; await api.revokeInvitation(button.dataset.revokeInvite); openMembers(); });
    if (!canManageFinancial) root.querySelectorAll('[name="financial"]').forEach((select) => select.disabled = true);
  }

  async function openActivity() {
    const result = await api.activity();
    dialog('Project activity', 'Meaningful changes, without cursor noise or every keystroke.', result.events.length ? `<div class="fs-platform-list">${result.events.map((item) => `<article class="fs-activity-card">${avatar(item.actor)}<span class="fs-member-copy"><strong>${escapeHtml(item.summary)}</strong><small>${escapeHtml(new Date(item.createdAt).toLocaleString())}</small></span></article>`).join('')}</div>` : '<div class="fs-member-card"><span class="fs-member-copy"><strong>No activity yet</strong><small>Important project changes will appear here.</small></span></div>');
  }

  function creditsLabel() {
    if (state.me?.credits?.unlimited) return 'Unlimited AI credits';
    const remaining = state.me?.credits?.remaining ?? state.me?.credits?.text?.remaining;
    if (Number.isFinite(Number(remaining))) return `${Number(remaining).toLocaleString()} AI credits`;
    const imageRemaining = state.me?.credits?.image?.remaining;
    if (Number.isFinite(Number(imageRemaining))) return `${Number(imageRemaining).toLocaleString()} image credits`;
    return 'Credits available';
  }

  async function refreshAccountState() {
    const account = await api.me(); state.me = account;
    try { const platform = await api.profile(); state.profile = platform.profile || null; } catch {}
    applyAccountIdentity();
    return account;
  }

  async function openAccount() {
    try { await refreshAccountState(); } catch (error) {
      if (!state.me) return dialog('Account', 'Your account could not be loaded.', `<p class="fs-form-message">${escapeHtml(error.message)}</p>`);
    }
    const selectedTheme = document.documentElement.dataset.filmscriptTheme || state.profile?.theme || 'filmscript';
    let selectedIcon = profileIcon(state.profile?.avatarCrop?.presetIcon)?.id || null;
    let selectedBackground = avatarBackground(state.profile?.avatarCrop?.presetBackground)[0];
    const maxBirthDate = new Date().toISOString().slice(0,10);
    const root = dialog('Account', 'Your identity, preferences and private details in one place.', `
      <div class="fs-account-layout">
        <section class="fs-account-hero">
          <div class="fs-account-avatar-preview" data-account-preview aria-label="Current profile image"></div>
          <div class="fs-account-hero-copy">
            <span class="fs-account-kicker">FilmScript account</span>
            <strong>${escapeHtml(state.me?.name || 'FilmScript member')}</strong>
            <span class="fs-account-email" title="${escapeHtml(state.me?.email || '')}">${escapeHtml(state.me?.email || 'No email available')}</span>
            <div class="fs-account-badges"><span>${escapeHtml(state.me?.planName || 'Free')}</span><span>${escapeHtml(creditsLabel())}</span></div>
          </div>
          <button type="button" class="fs-action" data-upload-photo>Upload photo</button>
        </section>

        <section class="fs-account-section" aria-labelledby="fs-account-avatar-title">
          <div class="fs-account-section-head"><div><h3 id="fs-account-avatar-title">Choose an icon</h3><p>Ten original, hand-drawn film symbols. Pick a background or upload your own photo.</p></div><button type="button" class="fs-action fs-action-primary" data-save-avatar${selectedIcon ? '' : ' disabled'}>Use icon</button></div>
          <div class="fs-avatar-preset-grid" role="radiogroup" aria-label="Profile icons">
            ${profileIcons.map((icon) => `<button type="button" class="fs-avatar-preset" data-avatar-icon="${icon.id}" role="radio" aria-checked="${selectedIcon === icon.id}" title="${escapeHtml(icon.label)}"><span>${icon.svg}</span><small>${escapeHtml(icon.label)}</small></button>`).join('')}
          </div>
          <div class="fs-avatar-color-row"><span>Background</span><div class="fs-avatar-color-grid" role="radiogroup" aria-label="Icon background color">${avatarBackgrounds.map(([id,label,color]) => `<button type="button" data-avatar-background="${id}" style="--avatar-color:${color}" role="radio" aria-label="${label}" aria-checked="${selectedBackground === id}"></button>`).join('')}</div></div>
          <p class="fs-account-status" data-avatar-status role="status" aria-live="polite"></p>
        </section>

        <form class="fs-account-section" data-account-form>
          <div class="fs-account-section-head"><div><h3>Account details</h3><p>Your email stays on one clean line and is never cropped into a broken address.</p></div></div>
          <div class="fs-account-form-grid">
            <label class="fs-form-field"><span>Name</span><input name="name" value="${escapeHtml(state.me?.name || '')}" minlength="2" maxlength="80" autocomplete="name" required></label>
            <label class="fs-form-field"><span>FilmScript username</span><input name="username" value="${escapeHtml(state.profile?.username || '')}" maxlength="30" pattern="[A-Za-z0-9_]{2,30}" placeholder="your_username" autocomplete="username"></label>
            <div class="fs-account-email-field"><span>Email</span><strong title="${escapeHtml(state.me?.email || '')}">${escapeHtml(state.me?.email || 'No email available')}</strong><em>${state.me?.authenticated ? 'Verified' : 'Not signed in'}</em></div>
          </div>
          <div class="fs-account-subsection">
            <div><h4>Personal profile</h4><p>Private account information used only for your FilmScript experience.</p></div>
            <div class="fs-account-form-grid">
              <label class="fs-form-field"><span>How should we refer to you?</span><select name="gender"><option value="">Not set</option><option value="man"${state.me?.profile?.gender === 'man' ? ' selected' : ''}>Man</option><option value="woman"${state.me?.profile?.gender === 'woman' ? ' selected' : ''}>Woman</option><option value="unspecified"${state.me?.profile?.gender === 'unspecified' ? ' selected' : ''}>Prefer not to say</option></select></label>
              <label class="fs-form-field"><span>Birthday</span><input name="birthDate" type="date" min="1900-01-01" max="${maxBirthDate}" value="${escapeHtml(state.me?.profile?.birthDate || '')}"></label>
            </div>
          </div>
          <div class="fs-account-save-row"><p class="fs-account-status" data-account-status role="status" aria-live="polite"></p><button type="submit" class="fs-action fs-action-primary">Save details</button></div>
        </form>

        <section class="fs-account-section" aria-labelledby="fs-account-theme-title">
          <div class="fs-account-section-head"><div><h3 id="fs-account-theme-title">Interface</h3><p>Your personal theme follows you across FilmScript.</p></div></div>
          <div class="fs-theme-grid">${themes.map(([id,label,color]) => `<button type="button" class="fs-theme-swatch" style="--swatch:${color}" data-theme="${id}" aria-pressed="${selectedTheme === id}">${label}</button>`).join('')}</div>
        </section>
      </div>`, 'fs-account-dialog');

    const preview = root.querySelector('[data-account-preview]');
    const renderPreview = (forcePreset = false) => {
      if (forcePreset && selectedIcon) renderIdentity(preview, { preset:profileIcon(selectedIcon), background:avatarBackground(selectedBackground), imageUrl:null, initial:accountIdentity().initial });
      else renderIdentity(preview);
    };
    renderPreview();
    root.querySelector('[data-upload-photo]').addEventListener('click', openAvatarEditor);
    root.querySelectorAll('[data-avatar-icon]').forEach((button) => button.addEventListener('click', () => {
      selectedIcon = button.dataset.avatarIcon;
      root.querySelectorAll('[data-avatar-icon]').forEach((item) => item.setAttribute('aria-checked', String(item === button)));
      root.querySelector('[data-save-avatar]').disabled = false;
      renderPreview(true);
    }));
    root.querySelectorAll('[data-avatar-background]').forEach((button) => button.addEventListener('click', () => {
      selectedBackground = button.dataset.avatarBackground;
      if (!selectedIcon) selectedIcon = profileIcons[0].id;
      root.querySelectorAll('[data-avatar-background]').forEach((item) => item.setAttribute('aria-checked', String(item === button)));
      root.querySelectorAll('[data-avatar-icon]').forEach((item) => item.setAttribute('aria-checked', String(item.dataset.avatarIcon === selectedIcon)));
      root.querySelector('[data-save-avatar]').disabled = false;
      renderPreview(true);
    }));
    root.querySelectorAll('.fs-account-section [role="radiogroup"]').forEach((group) => {
      const radios = [...group.querySelectorAll('[role="radio"]')];
      const syncTabs = () => { const checked = radios.find((radio) => radio.getAttribute('aria-checked') === 'true') || radios[0]; radios.forEach((radio) => { radio.tabIndex = radio === checked ? 0 : -1; }); };
      group.addEventListener('click', () => requestAnimationFrame(syncTabs));
      group.addEventListener('keydown', (event) => {
        if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
        event.preventDefault(); const current = Math.max(0, radios.indexOf(document.activeElement));
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? radios.length - 1 : (current + (['ArrowRight','ArrowDown'].includes(event.key) ? 1 : -1) + radios.length) % radios.length;
        radios[next]?.click(); radios[next]?.focus(); syncTabs();
      });
      syncTabs();
    });
    root.querySelector('[data-save-avatar]').addEventListener('click', async (event) => {
      if (!selectedIcon) return;
      const button = event.currentTarget; const status = root.querySelector('[data-avatar-status]');
      button.disabled = true; button.textContent = 'Saving'; status.textContent = '';
      try {
        const result = await api.updateProfile({ avatarCrop:{ presetIcon:selectedIcon, presetBackground:selectedBackground } });
        state.profile = result.profile;
        applyAccountIdentity(); renderPreview();
        window.dispatchEvent(new CustomEvent('filmscript:avatar-changed', { detail:{ presetIcon:selectedIcon, presetBackground:selectedBackground } }));
        status.textContent = 'Icon saved everywhere in FilmScript.'; button.textContent = 'Saved';
      } catch (error) { status.textContent = error.message; button.disabled = false; button.textContent = 'Use icon'; }
    });
    root.querySelector('[data-account-form]').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget; const button = form.querySelector('[type="submit"]'); const status = root.querySelector('[data-account-status]');
      button.disabled = true; button.textContent = 'Saving'; status.textContent = '';
      const data = new FormData(form);
      let platform = null;
      try {
        // Validate the unique username first. A username conflict must not save
        // a different name or private profile fields as an accidental partial edit.
        platform = await api.updateProfile({ username:String(data.get('username') || '').trim() || null });
        const account = await api.updateMe({ name:String(data.get('name') || '').trim(), gender:data.get('gender') || null, birthDate:data.get('birthDate') || null });
        state.me = account; state.profile = platform.profile; applyAccountIdentity();
        window.dispatchEvent(new CustomEvent('filmscript:profile-updated', { detail:account }));
        status.textContent = 'Account details saved.'; button.textContent = 'Saved';
      } catch (error) {
        if (platform?.profile) {
          state.profile = platform.profile;
          status.textContent = `Your username was saved, but the other details could not be saved. ${error.message}`;
        } else status.textContent = error.message;
        button.disabled = false; button.textContent = 'Save details';
      }
    });
    root.querySelectorAll('[data-theme]').forEach((button) => button.addEventListener('click', () => {
      applyTheme(button.dataset.theme, true);
      state.profile = { ...(state.profile || {}), theme:button.dataset.theme };
      root.querySelectorAll('[data-theme]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    }));
  }

  function openThemes() {
    return openAccount();
  }

  function openAvatarEditor() {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/png,image/jpeg,image/webp';
    input.onchange = () => {
      const file = input.files?.[0]; if (!file) return;
      if (!/^image\/(?:png|jpeg|webp)$/i.test(file.type) || file.size > 8 * 1024 * 1024) {
        dialog('Photo unavailable', 'Choose a PNG, JPEG or WebP image smaller than 8 MB.', '<p class="fs-form-message">That file cannot be used as a FilmScript profile photo.</p>');
        return;
      }
      const objectUrl = URL.createObjectURL(file); const image = new Image();
      image.onerror = () => { URL.revokeObjectURL(objectUrl); dialog('Photo unavailable', 'FilmScript could not read that image.', '<p class="fs-form-message">Try exporting the image as PNG or JPEG, then upload it again.</p>'); };
      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        let zoom = 1; let offsetX = 0; let offsetY = 0;
        const root = dialog('Profile photo', 'Zoom and reposition the circular crop before saving.', `<div class="fs-avatar-editor"><div class="fs-avatar-preview"><canvas width="512" height="512" tabindex="0" role="img" aria-label="Profile crop preview. Drag or use arrow keys to reposition."></canvas></div><div><label class="fs-form-field"><span>Zoom</span><input type="range" min="1" max="3" step=".01" value="1" data-zoom></label><p class="fs-avatar-help">Drag the preview or use the arrow keys to reposition your image.</p><p class="fs-form-message" data-photo-status role="status" aria-live="polite"></p><div class="fs-dialog-actions"><button class="fs-action fs-action-primary" data-save>Save photo</button></div></div></div>`);
        const canvas = root.querySelector('canvas'); const context = canvas.getContext('2d'); let dragging = false; let previous = null;
        const geometry = () => { const base = Math.max(512 / image.width, 512 / image.height) * zoom; return { width:image.width * base, height:image.height * base }; };
        const clampOffsets = () => { const { width,height } = geometry(); offsetX = Math.max(-(width - 512) / 2, Math.min((width - 512) / 2, offsetX)); offsetY = Math.max(-(height - 512) / 2, Math.min((height - 512) / 2, offsetY)); };
        const draw = () => { clampOffsets(); const { width,height } = geometry(); context.clearRect(0,0,512,512); context.drawImage(image, (512-width)/2+offsetX, (512-height)/2+offsetY, width, height); };
        draw(); root.querySelector('[data-zoom]').oninput = (event) => { zoom = Number(event.target.value); draw(); };
        canvas.onpointerdown = (event) => { dragging = true; previous = event; canvas.setPointerCapture(event.pointerId); canvas.focus({ preventScroll:true }); };
        canvas.onpointermove = (event) => { if (!dragging || !previous) return; const scale = 512 / Math.max(1, canvas.getBoundingClientRect().width); offsetX += (event.clientX - previous.clientX) * scale; offsetY += (event.clientY - previous.clientY) * scale; previous = event; draw(); };
        const finishDrag = (event) => { dragging = false; previous = null; if (event?.pointerId != null && canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId); };
        canvas.onpointerup = finishDrag; canvas.onpointercancel = finishDrag;
        canvas.onkeydown = (event) => { if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return; event.preventDefault(); const amount = event.shiftKey ? 16 : 5; if (event.key === 'ArrowLeft') offsetX -= amount; if (event.key === 'ArrowRight') offsetX += amount; if (event.key === 'ArrowUp') offsetY -= amount; if (event.key === 'ArrowDown') offsetY += amount; draw(); };
        root.querySelector('[data-save]').onclick = () => canvas.toBlob(async (blob) => {
          const button = root.querySelector('[data-save]'); const status = root.querySelector('[data-photo-status]');
          if (!blob) { status.textContent = 'FilmScript could not prepare this crop. Try another image.'; return; }
          button.disabled = true; button.textContent = 'Saving'; status.textContent = '';
          try {
            const result = await request('/api/me/avatar', { method:'POST', body:blob, headers:{ 'Content-Type':'image/webp' } });
            state.me = { ...(state.me || {}), avatar:result.avatarUrl };
            state.profile = { ...(state.profile || {}), avatarUrl:result.avatarUrl, avatarCrop:{ outputWidth:512, outputHeight:512 } };
            applyAccountIdentity();
            window.dispatchEvent(new CustomEvent('filmscript:avatar-changed', { detail:{ avatarUrl:result.avatarUrl } }));
            openAccount();
          } catch (error) { button.disabled = false; button.textContent = 'Save photo'; status.textContent = error.message; }
        }, 'image/webp', .86);
      }; image.src = objectUrl;
    };
    input.click();
  }

  async function openTranslation(script) {
    const root = dialog('Translate Script', 'This will create a new independent project.', `<div class="fs-form-grid"><label class="fs-form-field" style="grid-column:1/-1"><span>Source script</span><input value="${escapeHtml(script.title)}" readonly></label><label class="fs-form-field" style="grid-column:1/-1"><span>Target language</span><select data-language><option>English</option><option>Spanish</option><option>French</option><option>Portuguese</option><option>German</option></select></label></div><div data-translation-summary class="fs-member-card" style="margin-top:14px"><span class="fs-member-copy"><strong>Choose a target language</strong><small>The exact credit cost will appear before processing.</small></span></div><div class="fs-dialog-actions"><button class="fs-action fs-action-primary" data-start disabled>Translate and create project</button></div>`);
    const select = root.querySelector('[data-language]'); const start = root.querySelector('[data-start]'); let preview;
    const refresh = async () => { try { preview = await api.translationPreview(script.id, select.value); root.querySelector('[data-translation-summary]').innerHTML = `<span class="fs-member-copy"><strong>${escapeHtml(preview.newProjectName)}</strong><small>${preview.pageCount} pages · Translation cost ${preview.requiredCredits} credits · Available ${preview.availableCredits ?? 'Unlimited'}</small></span>`; start.disabled = false; } catch (error) { root.querySelector('[data-translation-summary]').textContent = error.message; } };
    select.onchange = refresh; refresh(); start.onclick = async () => { start.disabled = true; start.textContent = 'Starting translation'; try { const result = await api.translate(script.id, select.value); root.querySelector('.fs-platform-body').innerHTML = `<div class="fs-member-card"><span class="fs-member-copy"><strong>Translation started</strong><small>You can leave this screen. FilmScript will notify you when the new project is ready.</small><div class="fs-progress" style="margin-top:12px"><span style="--progress:${result.job.progress}%"></span></div></span></div>`; refreshNotifications(); } catch (error) { start.disabled = false; start.textContent = 'Translate and create project'; root.querySelector('[data-translation-summary]').textContent = error.message; } };
  }

  async function openShare() {
    const modules = ['script','analysis','breakdown','stripboard','shot_list','calendar','budget','canvas','location_plan','imagine','files'];
    const root = dialog('Create Shared Project', 'Choose exactly what an external viewer can see. This Shared Project is read only.', `<form data-share><div class="fs-form-grid"><label class="fs-form-field" style="grid-column:1/-1"><span>Access</span><select name="accessMode"><option value="public">Anyone with the link</option><option value="password">Password protected</option><option value="email_restricted">Invited emails only</option></select></label><label class="fs-form-field" style="grid-column:1/-1"><span>Password or invited emails</span><input name="accessValue" placeholder="Add when required"></label></div><div class="fs-platform-list" style="margin-top:15px">${modules.map((module) => `<label class="fs-member-card"><input type="checkbox" name="section" value="${module}"><span class="fs-member-copy"><strong>${module.replaceAll('_',' ')}</strong><small>View access only</small></span><input type="checkbox" name="export_${module}" aria-label="Allow export for ${module}"><span>Allow export</span></label>`).join('')}</div><div class="fs-dialog-actions"><button class="fs-action fs-action-primary">Create Shared Project</button></div></form><div data-share-result></div>`);
    root.querySelector('[data-share]').onsubmit = async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const mode = form.get('accessMode'); const value = String(form.get('accessValue') || ''); const sections = form.getAll('section').map((module) => ({ module, canView:true, canExport:form.get(`export_${module}`) === 'on' })); try { const result = await api.createShared({ accessMode:mode, ...(mode === 'password' ? { password:value } : {}), ...(mode === 'email_restricted' ? { allowedEmails:value.split(',').map((item) => item.trim()) } : {}), sections }); root.querySelector('[data-share-result]').innerHTML = `<div class="fs-member-card"><span class="fs-member-copy"><strong>Shared Project is ready</strong><input value="${escapeHtml(result.sharedProject.url)}" readonly style="width:100%;margin-top:8px"></span><button class="fs-action" data-copy>Copy</button></div>`; root.querySelector('[data-copy]').onclick = () => navigator.clipboard.writeText(result.sharedProject.url); } catch (error) { root.querySelector('[data-share-result]').textContent = error.message; } };
  }

  async function openLocationPlan() {
    let result = await api.locationPlans(); let plan = result.locationPlans?.[0];
    if (!plan) plan = (await api.createLocationPlan({ name:'Location Plan', unitSystem:'metric' })).locationPlan;
    let tool = 'select'; let selectedId = null; let draftStart = null; let cablePoints = []; let saving = false;
    const root = dialog('Location Plan', 'Real measurements without CAD complexity.', `<div class="fs-location-toolbar" role="toolbar" aria-label="Location Plan tools"><button class="fs-action" data-tool="select">Select</button><button class="fs-action" data-tool="wall">Wall</button><button class="fs-action" data-tool="door">Door</button><button class="fs-action" data-tool="window">Window</button><button class="fs-action" data-tool="measure">Measure</button><button class="fs-action" data-tool="cable">Cable</button><button class="fs-action" data-tool="zone">Zone</button><button class="fs-action" data-tool="route">Route</button><button class="fs-action" data-tool="equipment">Equipment</button><button class="fs-action" data-tool="note">Note</button></div><div class="fs-location-stage"><svg viewBox="0 0 1000 650" tabindex="0" aria-label="Editable Location Plan"><g data-grid></g><g data-zones></g><g data-walls></g><g data-cables></g><g data-equipment></g></svg><aside data-inspector><strong>Location Plan</strong><p>Select a wall or draw the physical space.</p><label class="fs-form-field"><span>Units</span><select data-units><option value="metric">Metric</option><option value="imperial">Imperial</option></select></label><label style="display:flex;gap:8px;margin-top:12px"><input type="checkbox" data-lock> Lock Scale</label></aside></div><div class="fs-dialog-actions"><span data-plan-status style="margin-right:auto;color:var(--text-secondary)">Version ${plan.version}</span><button class="fs-action" data-view>Department view</button><button class="fs-action fs-action-primary" data-save>Save Location Plan</button></div>`, 'fs-location-dialog');
    const svg = root.querySelector('svg'); const ns = 'http://www.w3.org/2000/svg'; root.querySelector('[data-units]').value = plan.unitSystem || 'metric'; root.querySelector('[data-lock]').checked = !!plan.scale?.locked;
    const svgPoint = (event) => { const matrix = svg.getScreenCTM(); return { x:(event.clientX-matrix.e)/matrix.a, y:(event.clientY-matrix.f)/matrix.d }; };
    const line = (parent, a, b, attrs={}) => { const el=document.createElementNS(ns,'line'); Object.entries({x1:a.x,y1:a.y,x2:b.x,y2:b.y,...attrs}).forEach(([k,v])=>el.setAttribute(k,v)); parent.appendChild(el); return el; };
    function render() {
      const walls=root.querySelector('[data-walls]'); const cables=root.querySelector('[data-cables]'); const equipment=root.querySelector('[data-equipment]'); walls.innerHTML='';cables.innerHTML='';equipment.innerHTML='';
      (plan.walls||[]).forEach((wall) => { const selected=wall.id===selectedId; const el=line(walls,wall.start,wall.end,{stroke:selected?'var(--accent)':'var(--text-primary)','stroke-width':wall.thickness||8,'stroke-linecap':'round','data-id':wall.id,tabindex:'0'}); el.onclick=(event)=>{event.stopPropagation();selectedId=wall.id;renderInspector();render()}; });
      (plan.cables||[]).forEach((cable) => { const path=document.createElementNS(ns,'polyline');path.setAttribute('points',(cable.points||[]).map(p=>`${p.x},${p.y}`).join(' '));path.setAttribute('fill','none');path.setAttribute('stroke','#d35400');path.setAttribute('stroke-width','4');cables.appendChild(path); });
      (plan.equipment||[]).forEach((item)=>{const g=document.createElementNS(ns,'g');g.innerHTML=`<circle cx="${item.position.x}" cy="${item.position.y}" r="18" fill="var(--surface-primary)" stroke="var(--accent)" stroke-width="3"/><text x="${item.position.x}" y="${item.position.y+34}" text-anchor="middle" fill="var(--text-primary)" font-size="14">${escapeHtml(item.name)}</text>`;equipment.appendChild(g)});
    }
    function renderInspector(){const inspector=root.querySelector('[data-inspector]');const wall=(plan.walls||[]).find(item=>item.id===selectedId);if(!wall)return;const canvasLength=Math.hypot(wall.end.x-wall.start.x,wall.end.y-wall.start.y);const real=canvasLength*(plan.scale?.realWorldUnitsPerCanvasUnit||1);inspector.innerHTML=`<strong>Wall</strong><label class="fs-form-field" style="margin-top:12px"><span>Length</span><input type="number" min=".01" step=".01" data-length value="${real.toFixed(2)}"></label><label class="fs-form-field" style="margin-top:12px"><span>Thickness</span><input type="number" min="1" step="1" data-thickness value="${wall.thickness||8}"></label><button class="fs-action" data-calibrate style="width:100%;margin-top:12px">${plan.scale?.calibrated?'Recalibrate Scale':'Calibrate Scale'}</button>`;inspector.querySelector('[data-thickness]').onchange=e=>{wall.thickness=Math.max(1,Number(e.target.value)||8);render()};inspector.querySelector('[data-length]').onchange=e=>{if(!plan.scale?.calibrated)return;const target=Number(e.target.value)/(plan.scale.realWorldUnitsPerCanvasUnit||1);const current=Math.max(.001,canvasLength);wall.end={x:wall.start.x+(wall.end.x-wall.start.x)*target/current,y:wall.start.y+(wall.end.y-wall.start.y)*target/current};render()};inspector.querySelector('[data-calibrate]').onclick=()=>{if(plan.scale?.locked)return;const known=Number(inspector.querySelector('[data-length]').value);if(known>0)plan.scale={...plan.scale,calibrated:true,realWorldUnitsPerCanvasUnit:known/canvasLength};renderInspector()};}
    root.querySelectorAll('[data-tool]').forEach(button=>button.onclick=()=>{tool=button.dataset.tool;draftStart=null;cablePoints=[];root.querySelectorAll('[data-tool]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)))});
    svg.onpointerdown=(event)=>{const p=svgPoint(event);if(tool==='select'){selectedId=null;render();return}if(tool==='equipment'){plan.equipment.push({id:`eq_${Date.now()}`,name:'Generic Equipment',category:'production',position:p,dimensions:{width:1,height:1},rotation:0,notes:''});render();return}if(tool==='wall'){draftStart=p;svg.setPointerCapture(event.pointerId);return}if(tool==='cable'){cablePoints.push(p);if(event.detail>=2&&cablePoints.length>1){const length=cablePoints.slice(1).reduce((sum,current,index)=>sum+Math.hypot(current.x-cablePoints[index].x,current.y-cablePoints[index].y),0);plan.cables.push({id:`cable_${Date.now()}`,points:[...cablePoints],slackPercentage:10,routeLength:length,recommendedLength:length*1.1});cablePoints=[];render()}return}};
    svg.onpointerup=(event)=>{if(tool!=='wall'||!draftStart)return;const end=svgPoint(event);if(Math.hypot(end.x-draftStart.x,end.y-draftStart.y)>4){const dx=end.x-draftStart.x,dy=end.y-draftStart.y,angle=Math.atan2(dy,dx),snap=Math.round(angle/(Math.PI/4))*(Math.PI/4),length=Math.hypot(dx,dy);const snapped={x:draftStart.x+Math.cos(snap)*length,y:draftStart.y+Math.sin(snap)*length};const wall={id:`wall_${Date.now()}`,start:draftStart,end:snapped,thickness:8,connectedWallIds:[],doorIds:[],windowIds:[]};plan.walls.push(wall);selectedId=wall.id;draftStart=null;render();renderInspector()}};
    root.querySelector('[data-lock]').onchange=e=>{plan.scale={...(plan.scale||{}),locked:e.target.checked}};root.querySelector('[data-units]').onchange=e=>{plan.unitSystem=e.target.value};
    root.querySelector('[data-save]').onclick=async()=>{if(saving)return;saving=true;root.querySelector('[data-plan-status]').textContent='Saving';try{plan=(await api.saveLocationPlan(plan,plan.version)).locationPlan;root.querySelector('[data-plan-status]').textContent=`Saved · Version ${plan.version}`}catch(error){root.querySelector('[data-plan-status]').textContent=error.message}finally{saving=false}};
    root.querySelector('[data-view]').onclick=()=>{const choice=prompt('Department view: all, director, camera, lighting, art, or production','all');if(choice)root.querySelector('[data-plan-status]').textContent=`${choice.charAt(0).toUpperCase()+choice.slice(1)} view`};render();
  }

  async function refreshNotifications() {
    try { const result = await api.notifications(); const badge = document.querySelector('.fs-notification-badge'); if (badge) { badge.textContent = result.unreadCount > 99 ? '99+' : result.unreadCount; badge.hidden = !result.unreadCount; } } catch {}
  }

  function renderPresence() {
    const container = document.querySelector('.fs-live-avatars'); if (!container) return;
    const unique = [...new Map(state.presence.filter((person) => person.clientId !== clientId && person.userId !== state.me?.id && person.state !== 'disconnected').map((person) => [person.userId, person])).values()].slice(0,5);
    container.innerHTML = unique.map((person) => { const preset = profileIcon(person.avatarPreset); const palette = avatarBackground(person.avatarBackground); const picture = person.picture ? resolveAsset(person.picture) : null; return `<button class="fs-live-avatar${preset ? ' fs-preset-avatar' : ''}" style="--collaborator-color:${escapeHtml(person.color)};${preset ? `--profile-avatar-bg:${palette[2]};--profile-avatar-ink:${palette[3]}` : ''}" title="${escapeHtml(person.name)} · ${escapeHtml(person.module || 'Project')} · ${escapeHtml(person.state || 'active')}">${preset ? preset.svg : picture ? `<img src="${escapeHtml(picture)}" alt="${escapeHtml(person.name)}">` : escapeHtml(person.name?.charAt(0) || 'C')}</button>`; }).join('');
    container.hidden = unique.length === 0;
    document.querySelectorAll('[data-collaborator-active]').forEach((node) => { node.removeAttribute('data-collaborator-active'); node.style.removeProperty('--collaborator-color'); });
    for (const person of state.presence) { if (person.clientId === clientId || person.userId === state.me?.id || person.state === 'disconnected') continue; const selector = person.module === 'breakdown' && person.sceneId ? `[data-scene-id="${CSS.escape(person.sceneId)}"]` : person.module === 'shot_list' && person.selectedObjectId ? `[data-shot-id="${CSS.escape(person.selectedObjectId)}"]` : ''; if (selector) document.querySelectorAll(selector).forEach((node) => { node.dataset.collaboratorActive = person.name; node.style.setProperty('--collaborator-color',person.color); }); }
    renderRemoteCursors();
  }

  function renderRemoteCursors() {
    document.querySelectorAll('.fs-remote-caret,.fs-remote-selection').forEach((node) => node.remove());
    for (const person of state.presence) {
      if (person.clientId === clientId || person.userId === state.me?.id || person.module !== 'script' || person.state === 'disconnected' || !person.selection?.blockId) continue;
      const block = document.querySelector(`[data-block-id="${CSS.escape(person.selection.blockId)}"]`); if (!block) continue;
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, { acceptNode:(node) => node.parentElement?.matches?.('[data-marker],[data-dialogue-marker]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
      let remaining = Math.max(0, Number(person.selection.anchorOffset) || 0); let target = null; let text;
      while ((text = walker.nextNode())) { if (remaining <= text.data.length) { target = text; break; } remaining -= text.data.length; }
      if (!target) target = block.firstChild; if (!target) continue;
      const range = document.createRange(); try { range.setStart(target, Math.min(remaining, target.textContent?.length || 0)); range.collapse(true); } catch { continue; }
      const rect = range.getBoundingClientRect(); if (!rect.width && !rect.height) continue;
      const caret = document.createElement('span'); caret.className = 'fs-remote-caret'; caret.style.cssText = `--collaborator-color:${person.color};left:${rect.left}px;top:${rect.top}px;height:${Math.max(16, rect.height)}px`; caret.innerHTML = `<span>${escapeHtml(person.name)}</span>`; document.body.appendChild(caret);
      if (!person.selection.collapsed && Number(person.selection.focusOffset) !== Number(person.selection.anchorOffset)) {
        const textNodes = []; const focusWalker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, { acceptNode:(node) => node.parentElement?.matches?.('[data-marker],[data-dialogue-marker]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT }); let focusText;
        while ((focusText = focusWalker.nextNode())) textNodes.push(focusText);
        const locate = (offset) => { let left = Math.max(0, Number(offset) || 0); for (const node of textNodes) { if (left <= node.data.length) return [node,left]; left -= node.data.length; } return [textNodes.at(-1), textNodes.at(-1)?.data.length || 0]; };
        const [anchorNode,anchorOffset] = locate(person.selection.anchorOffset); const [focusNode,focusOffset] = locate(person.selection.focusOffset);
        if (anchorNode && focusNode) { const selected = document.createRange(); try { if (Number(person.selection.anchorOffset) <= Number(person.selection.focusOffset)) { selected.setStart(anchorNode,anchorOffset); selected.setEnd(focusNode,focusOffset); } else { selected.setStart(focusNode,focusOffset); selected.setEnd(anchorNode,anchorOffset); } for (const box of selected.getClientRects()) { const mark=document.createElement('span'); mark.className='fs-remote-selection'; mark.style.cssText=`--collaborator-color:${person.color};left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px`; document.body.appendChild(mark); } } catch {} }
      }
    }
  }

  function connectCollaboration() {
    if (!projectId || typeof EventSource === 'undefined') return;
    if (state.eventSource) state.eventSource.close();
    const url = new URL(resolve(`/api/projects/${projectId}/collaboration/events`), location.href); url.searchParams.set('module', currentModule()); url.searchParams.set('clientId', clientId);
    state.eventSource = new EventSource(url, { withCredentials:true });
    state.eventSource.addEventListener('connected', (event) => { state.presence = JSON.parse(event.data).presence || []; renderPresence(); });
    state.eventSource.addEventListener('presence.joined', (event) => { const person = JSON.parse(event.data); state.presence = [...state.presence.filter((item) => item.clientId !== person.clientId), person]; renderPresence(); });
    state.eventSource.addEventListener('presence.updated', (event) => { const person = JSON.parse(event.data); state.presence = [...state.presence.filter((item) => item.clientId !== person.clientId), person]; renderPresence(); });
    state.eventSource.addEventListener('presence.left', (event) => { const person = JSON.parse(event.data); state.presence = state.presence.filter((item) => item.clientId !== person.clientId); renderPresence(); });
    ['ai.job.completed','content.operation','content.conflict','comment.created','message.created','script.crdt','canvas.drag'].forEach((type) => state.eventSource.addEventListener(type, async (event) => { let detail={};try{detail=JSON.parse(event.data)}catch{}window.dispatchEvent(new CustomEvent(`filmscript:${type}`,{detail})); if (type === 'message.created' && state.chatPeer && detail && (detail.senderId === state.chatPeer || detail.recipientId === state.chatPeer)) { try { state.chatMessages = (await api.chat(state.chatPeer)).messages || []; const panel = document.querySelector('.fs-chat-panel'); panel?.querySelector('[data-chat-messages]')?.replaceChildren(...state.chatMessages.map((item) => { const article=document.createElement('article'); article.className=`fs-chat-bubble ${item.senderId === state.me?.id ? 'is-mine' : ''}`; article.innerHTML=`<p>${escapeHtml(item.body)}</p><time>${escapeHtml(notificationTime(item.createdAt))}</time>`; return article; })); } catch {} } }));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) sendPresence({ type:'presence.updated' }); });
    const activity = () => { const wasIdle = Date.now() - lastUserActivityAt > 90_000; lastUserActivityAt = Date.now(); if (wasIdle) sendPresence({ type:'presence.updated' }); };
    ['pointerdown','keydown','wheel'].forEach((type) => document.addEventListener(type, activity, { passive:true }));
    const heartbeat = setInterval(() => { if (!document.hidden && Date.now() - lastUserActivityAt < 90_000) sendPresence({ type:'presence.updated' }); }, 16_000); heartbeat.unref?.();
    addEventListener('scroll', renderRemoteCursors, { passive:true, capture:true }); addEventListener('resize', renderRemoteCursors, { passive:true });
  }

  let presenceTimer = 0;
  function sendPresence(detail = {}) {
    if (!projectId || document.hidden) return;
    clearTimeout(presenceTimer); presenceTimer = setTimeout(() => request(`/api/projects/${projectId}/collaboration/presence`, { method:'POST', headers:{ 'X-FilmScript-Client-Id':clientId }, body:JSON.stringify({ type:detail.type || 'presence.updated', module:currentModule(), ...detail }) }).catch(() => {}), detail.type === 'cursor.updated' ? 80 : 120);
  }

  function mountHub() {
    const host = document.querySelector('.v5-top-actions') || document.querySelector('.fs-app-topbar > div:last-child'); if (!host || document.querySelector('.fs-platform-hub')) return;
    const hub = document.createElement('div'); hub.className = 'fs-platform-hub';
    hub.innerHTML = `${projectId ? '<span class="fs-live-avatars" aria-label="Active collaborators"></span><button class="fs-platform-button fs-manage-people" data-people title="People and access" aria-label="People and access"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 19v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V19"></path><circle cx="9.5" cy="7" r="3"></circle><path d="M17 5.2a3 3 0 0 1 0 5.6M21 19v-1.5a4 4 0 0 0-3-3.87"></path></svg></button><button class="fs-platform-button" data-chat title="Collaborator chat" aria-label="Collaborator chat"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v11H9l-5 3v-14Z"></path><path d="M8 10h8M8 13h5"></path></svg></button>' : ''}<button class="fs-platform-button" data-bell title="Notifications" aria-label="Notifications"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M10 21h4"></path></svg><span class="fs-notification-badge" hidden></span></button>`;
    host.prepend(hub); hub.querySelector('[data-bell]').onclick = openNotifications; hub.querySelector('[data-chat]')?.addEventListener('click', openChatDirectory); hub.querySelector('[data-people]')?.addEventListener('click', openMembers);
  }

  function mountMobileNav() {
    if (document.querySelector('.fs-mobile-global')) return;
    const globalNav = document.createElement('nav'); globalNav.className = 'fs-mobile-nav fs-mobile-global'; globalNav.setAttribute('aria-label', 'FilmScript navigation');
    globalNav.innerHTML = `<a href="App.dc.html"${projectId ? '' : ' aria-current="page"'}>Home</a><a href="App.dc.html">Projects</a><a href="App.dc.html?lumiere=1">Lumiere</a><button data-activity>Activity</button><button data-profile>Account</button>`;
    document.body.appendChild(globalNav); globalNav.querySelector('[data-activity]').onclick = openNotifications; globalNav.querySelector('[data-profile]').onclick = openAccount;
    if (!projectId) return;
    const view = params.get('view') || 'script'; const projectNav = document.createElement('nav'); projectNav.className = 'fs-mobile-nav fs-mobile-project'; projectNav.setAttribute('aria-label', 'Project navigation');
    projectNav.innerHTML = `<a href="App.dc.html">Overview</a><a href="Editor%20v5.dc.html?script=${projectId}"${view === 'script' ? ' aria-current="page"' : ''}>Script</a><a href="Editor%20v5.dc.html?script=${projectId}&view=breakdown"${['breakdown','stripboard','shot-list','budget','calendar'].includes(view) ? ' aria-current="page"' : ''}>Production</a><a href="Editor%20v5.dc.html?script=${projectId}&view=canvas"${view === 'canvas' ? ' aria-current="page"' : ''}>Canvas</a><button data-more>More</button>`;
    document.body.appendChild(projectNav); projectNav.querySelector('[data-more]').onclick = () => { const root = dialog('More', 'Authorized project modules', `<div class="fs-platform-list"><a class="fs-member-card" href="Editor%20v5.dc.html?script=${projectId}&view=analysis">Analysis</a><a class="fs-member-card" href="Editor%20v5.dc.html?script=${projectId}&view=budget">Budget</a><button class="fs-member-card" data-location>Location Plan</button><button class="fs-member-card" data-people>Members</button><button class="fs-member-card" data-share>Shared Projects</button></div>`); root.querySelector('[data-location]').onclick = () => { closeDialog(); openLocationPlan(); }; root.querySelector('[data-people]').onclick = () => { closeDialog(); openMembers(); }; root.querySelector('[data-share]').onclick = () => { closeDialog(); openShare(); }; };
  }

  function syncResponsiveChrome() {
    const workModes = document.querySelector('.v5-work-modes'); if (!workModes) return;
    if (matchMedia('(max-width:900px)').matches) workModes.style.setProperty('display', 'none', 'important');
    else workModes.style.setProperty('display', 'flex');
  }

  function injectProfileControls() {
    let identityFrame = 0;
    const observer = new MutationObserver((records) => {
      const hasNewAvatar = records.some((record) => [...record.addedNodes].some((node) => node.nodeType === Node.ELEMENT_NODE && (node.matches?.('[data-testid="account-avatar"]') || node.querySelector?.('[data-testid="account-avatar"]'))));
      if (!hasNewAvatar || identityFrame) return;
      identityFrame = requestAnimationFrame(() => { identityFrame = 0; applyAccountIdentity(); });
    });
    observer.observe(document.body, { childList:true, subtree:true });
  }

  async function init() {
    try {
      state.me = await api.me();
      try { const platform = await api.profile(); state.profile = platform.profile || null; } catch {}
      const local = window.filmscriptTheme?.get?.() || localStorage.getItem('filmscript_theme');
      applyTheme(state.profile?.theme || state.me.theme || local || 'filmscript'); applyAccountIdentity();
    } catch { applyTheme(window.filmscriptTheme?.get?.() || localStorage.getItem('filmscript_theme') || 'filmscript'); }
    mountHub(); mountMobileNav(); syncResponsiveChrome(); addEventListener('resize', syncResponsiveChrome, { passive:true }); injectProfileControls(); refreshNotifications(); connectCollaboration();
    const invitation = params.get('invitation');
    if (invitation) request('/api/invitations/accept', { method:'POST', body:JSON.stringify({ token:invitation }) }).then((result) => location.replace(`Editor%20v5.dc.html?script=${encodeURIComponent(result.membership.projectId)}`)).catch((error) => dialog('Invitation unavailable', error.message, '<div class="fs-dialog-actions"><button class="fs-action" onclick="location.href=\'App.dc.html\'">Back to projects</button></div>'));
    else if (params.get('chat')) openChatFromDeepLink();
    else scheduleReleaseNotice();
  }

  window.filmscriptPlatform = { api, clientId, openTranslation, openMembers, openActivity, openAccount, openThemes, openShare, openLocationPlan, openChatDirectory, openChat, openChatFromDeepLink, sendPresence, sendOperation:(body) => api.collaborate(body), applyTheme };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
