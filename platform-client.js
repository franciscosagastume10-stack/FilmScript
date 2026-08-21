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
  const state = { me: null, profile: null, notifications: [], presence: [], eventSource: null, chatPeer: null, chatMessages: [], chatRequestId: null, chatReturnFocus: null, releaseNoticeState: 'idle' };
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
    scrim.innerHTML = `<section class="fs-platform-dialog ${className}" role="dialog" aria-modal="true" aria-labelledby="fs-platform-title"><header class="fs-platform-head"><div><h2 id="fs-platform-title">${escapeHtml(uiText(title))}</h2><p>${escapeHtml(uiText(subtitle))}</p></div><button class="fs-platform-close" type="button" aria-label="${escapeHtml(localize('Close', 'Cerrar'))}">×</button></header><div class="fs-platform-body">${content}</div></section>`;
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
    if (elapsed < 60_000) return localize('Now', 'Ahora');
    if (elapsed < 60 * 60_000) return `${Math.floor(elapsed / 60_000)}m`;
    if (elapsed < 24 * 60 * 60_000) return `${Math.floor(elapsed / (60 * 60_000))}h`;
    if (elapsed < 48 * 60 * 60_000) return localize('Yesterday', 'Ayer');
    return new Intl.DateTimeFormat(interfaceLocale(), { month:'short', day:'numeric' }).format(new Date(time));
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
    const content = localizeNotification(item);
    const notificationType = String(item.type || '').toLowerCase();
    const userAuthored = notificationType === 'message' || notificationType === 'mention' || notificationType.includes('comment') || notificationType.includes('reply');
    const unreadLabel = localize('Unread', 'No leída');
    const deleteLabel = localize('Delete notification', 'Eliminar notificación');
    return `<article class="fs-notification-card${item.read ? '' : ' is-unread'}" data-notification-row data-id="${escapeHtml(item.id)}"><button type="button" class="fs-notification-open" data-notification-open data-link="${escapeHtml(item.deepLink || '')}" aria-label="${escapeHtml(`${content.title}. ${content.message}`)}"><span class="fs-notification-icon" data-tone="${visual.tone}" aria-hidden="true">${visual.glyph}</span><span class="fs-notification-copy"><span class="fs-notification-title"><strong>${escapeHtml(content.title)}</strong><time datetime="${escapeHtml(item.updatedAt || item.createdAt || '')}">${escapeHtml(notificationTime(item.updatedAt || item.createdAt))}</time></span><span class="fs-notification-message"${userAuthored ? ' data-i18n-skip' : ''}>${escapeHtml(content.message)}</span></span>${item.read ? '' : `<span class="fs-notification-unread" aria-label="${escapeHtml(unreadLabel)}"></span>`}</button><button type="button" class="fs-notification-delete" data-notification-delete aria-label="${escapeHtml(deleteLabel)}" title="${escapeHtml(deleteLabel)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"></path></svg></button></article>`;
  }

  async function openNotifications() {
    let result;
    try { result = await api.notifications(); }
    catch { return dialog(localize('Notifications', 'Notificaciones'), localize('Notifications are unavailable right now.', 'Las notificaciones no están disponibles en este momento.'), `<div class="fs-notification-empty"><strong>${escapeHtml(localize('Try again in a moment.', 'Intenta de nuevo en un momento.'))}</strong></div>`, 'fs-notifications-dialog'); }
    state.notifications = Array.isArray(result.notifications) ? result.notifications : [];
    const unreadCount = Number(result.unreadCount) || state.notifications.filter((item) => !item.read).length;
    const unread = state.notifications.filter((item) => !item.read); const earlier = state.notifications.filter((item) => item.read);
    const groups = [[unread.length ? localize('New', 'Nuevas') : '', unread], [earlier.length ? localize('Earlier', 'Anteriores') : '', earlier]].filter(([,items]) => items.length);
    const list = groups.map(([labelText,items]) => `<section class="fs-notification-group"><h3>${escapeHtml(labelText)}</h3><div class="fs-notification-stack">${items.map(notificationCard).join('')}</div></section>`).join('');
    const empty = `<div class="fs-notification-empty"><span aria-hidden="true">✓</span><strong>${escapeHtml(localize('You are all caught up', 'Estás al día'))}</strong><p>${escapeHtml(localize('Invitations, mentions and completed FilmScript work will appear here.', 'Aquí aparecerán invitaciones, menciones y trabajos completados en FilmScript.'))}</p></div>`;
    const unreadText = localize('unread', 'sin leer');
    const toolbar = state.notifications.length ? `<div class="fs-notification-toolbar"><span><strong>${unreadCount}</strong> ${escapeHtml(unreadText)}</span><div>${unreadCount ? `<button type="button" data-mark-all>${escapeHtml(localize('Read all', 'Leer todas'))}</button>` : ''}<button type="button" data-clear-all>${escapeHtml(localize('Clear', 'Limpiar'))}</button></div></div>` : '';
    const summary = unreadCount
      ? (interfaceLocale() === 'es' ? `${unreadCount} ${unreadCount === 1 ? 'novedad' : 'novedades'}` : `${unreadCount} new ${unreadCount === 1 ? 'update' : 'updates'}`)
      : localize('Everything important, without the noise.', 'Todo lo importante, sin ruido.');
    const root = dialog(localize('Notifications', 'Notificaciones'), summary, `<div class="fs-notification-center">${toolbar}${list || empty}</div>`, 'fs-notifications-dialog');
    root.querySelectorAll('[data-notification-open]').forEach((button) => button.addEventListener('click', async () => { const row = button.closest('[data-notification-row]'); if (row?.classList.contains('is-unread')) await api.markRead(row.dataset.id); if (button.dataset.link) location.href = button.dataset.link; else { openNotifications(); refreshNotifications(); } }));
    root.querySelectorAll('[data-notification-delete]').forEach((button) => button.addEventListener('click', async () => { const row = button.closest('[data-notification-row]'); if (!row) return; button.disabled = true; try { await api.deleteNotification(row.dataset.id); row.classList.add('is-removing'); window.setTimeout(() => { openNotifications(); refreshNotifications(); }, 190); } catch { button.disabled = false; } }));
    root.querySelector('[data-mark-all]')?.addEventListener('click', async (event) => { event.currentTarget.disabled = true; await api.markRead(); root.querySelectorAll('.is-unread').forEach((row) => row.classList.remove('is-unread')); openNotifications(); refreshNotifications(); });
    root.querySelector('[data-clear-all]')?.addEventListener('click', async (event) => { if (!confirm(localize('Delete all notifications?', '¿Eliminar todas las notificaciones?'))) return; event.currentTarget.disabled = true; await api.deleteNotification(); root.querySelectorAll('[data-notification-row]').forEach((row) => row.classList.add('is-removing')); window.setTimeout(() => { openNotifications(); refreshNotifications(); }, 190); });
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
    return Boolean(document.querySelector('.fs-platform-scrim, .fs-profile-onboarding, .fs-language-modal:not([hidden])'));
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
      if (window.filmscriptLanguage?.isAccountHydrated && !window.filmscriptLanguage.isAccountHydrated()) {
        if (attempt >= 40) { state.releaseNoticeState = 'deferred'; return; }
        window.setTimeout(() => check(attempt + 1), 150);
        return;
      }
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
    let result; try { result = await api.chatPeers(); } catch { dialog(localize('Chat', 'Chat'), localize('Collaborator chat is unavailable right now.', 'El chat con colaboradores no está disponible en este momento.'), `<p class="fs-guest-error">${escapeHtml(localize('Try again in a moment.', 'Intenta de nuevo en un momento.'))}</p>`); return; }
    const people = (result.peers || []).filter((member) => member.userId && member.userId !== state.me?.id);
    const collaborator = localize('Collaborator', 'Colaborador');
    const collaboratorDescription = localize('FilmScript collaborator', 'Colaborador de FilmScript');
    const cards = people.map((member) => { const displayName = member.name || member.email || collaborator; return `<button class="fs-chat-person" type="button" data-chat-peer="${escapeHtml(member.userId)}" aria-label="${escapeHtml(localize(`Chat with ${displayName}`, `Chatear con ${displayName}`))}"><span class="fs-chat-avatar">${escapeHtml(String(member.name || member.email || 'C').trim().charAt(0).toUpperCase())}</span><span><strong>${escapeHtml(displayName)}</strong><small>${escapeHtml(member.email || collaboratorDescription)}</small></span><span class="fs-chat-arrow" aria-hidden="true">›</span></button>`; }).join('');
    const empty = `<div class="fs-chat-empty">${escapeHtml(localize('Invite a collaborator to start chatting.', 'Invita a un colaborador para empezar a chatear.'))}</div>`;
    const root = dialog(localize('Collaborator chat', 'Chat con colaboradores'), localize('Pick someone from this project to start a private conversation.', 'Elige a alguien de este proyecto para iniciar una conversación privada.'), `<div class="fs-chat-directory">${cards || empty}</div>`, 'fs-chat-directory-dialog');
    root.querySelectorAll('[data-chat-peer]').forEach((button) => button.addEventListener('click', () => { closeDialog(); openChat(button.dataset.chatPeer, button.querySelector('strong')?.textContent || collaborator); }));
  }

  let chatCleanup = null;
  function closeChatPanel(panel = document.querySelector('.fs-chat-panel')) {
    const returnFocus = state.chatReturnFocus;
    chatCleanup?.(); chatCleanup = null;
    state.chatPeer = null; state.chatRequestId = null; state.chatReturnFocus = null;
    panel?.remove();
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll:true });
  }

  async function openChat(peerId, peerName = '') {
    if (!projectId || !peerId) return;
    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (activeElement && !activeElement.closest('.fs-chat-panel')) state.chatReturnFocus = activeElement;
    chatCleanup?.(); chatCleanup = null;
    state.chatPeer = peerId;
    const requestId = `${peerId}:${Date.now()}:${Math.random()}`;
    state.chatRequestId = requestId;
    let panel = document.querySelector('.fs-chat-panel');
    if (!panel) { panel = document.createElement('section'); panel.className = 'fs-chat-panel'; document.body.appendChild(panel); }
    const displayPeerName = peerName || localize('Collaborator', 'Colaborador');
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-labelledby', 'fs-chat-peer-name');
    panel.innerHTML = `<header class="fs-chat-head"><span class="fs-chat-brand" aria-hidden="true">✦</span><div><strong id="fs-chat-peer-name" data-project-content data-i18n-skip>${escapeHtml(displayPeerName)}</strong><small data-chat-peer-caption>${escapeHtml(localize('FilmScript collaborator', 'Colaborador de FilmScript'))}</small></div><button type="button" class="fs-chat-close" data-chat-close aria-label="${escapeHtml(localize('Close chat', 'Cerrar chat'))}">×</button></header><div class="fs-chat-messages" data-chat-messages aria-live="polite" aria-busy="true"><div class="fs-chat-loading" role="status" data-chat-copy="loading">${escapeHtml(localize('Opening conversation…', 'Abriendo conversación…'))}</div></div><form class="fs-chat-compose" data-chat-form><textarea name="body" rows="1" maxlength="2000" placeholder="${escapeHtml(localize('Write a message…', 'Escribe un mensaje…'))}" aria-label="${escapeHtml(localize('Message', 'Mensaje'))}"></textarea><button type="submit" aria-label="${escapeHtml(localize('Send message', 'Enviar mensaje'))}" title="${escapeHtml(localize('Send message', 'Enviar mensaje'))}">↗</button></form>`;
    panel.querySelector('[data-chat-close]').onclick = () => closeChatPanel(panel);
    const onKeyDown = (event) => { if (event.key === 'Escape' && panel.contains(document.activeElement) && !document.querySelector('.fs-platform-scrim')) { event.preventDefault(); closeChatPanel(panel); } };
    document.addEventListener('keydown', onKeyDown);
    chatCleanup = () => document.removeEventListener('keydown', onKeyDown);
    const messages = panel.querySelector('[data-chat-messages]');
    const render = (items) => { messages.setAttribute('aria-busy', 'false'); messages.innerHTML = items.length ? items.map((item) => `<article class="fs-chat-bubble ${item.senderId === state.me?.id ? 'is-mine' : ''}"><p data-project-content data-i18n-skip>${escapeHtml(item.body)}</p><time>${escapeHtml(notificationTime(item.createdAt))}</time></article>`).join('') : `<div class="fs-chat-empty" data-chat-copy="empty">${escapeHtml(localize('No messages yet. Say hello.', 'Aún no hay mensajes. Saluda.'))}</div>`; messages.scrollTop = messages.scrollHeight; };
    try { const result = await api.chat(peerId); if (state.chatPeer !== peerId || state.chatRequestId !== requestId || !panel.isConnected) return; state.chatMessages = result.messages || []; render(state.chatMessages); } catch { if (state.chatPeer === peerId && state.chatRequestId === requestId && panel.isConnected) { messages.setAttribute('aria-busy', 'false'); messages.innerHTML = `<div class="fs-chat-empty" data-chat-copy="error">${escapeHtml(localize('Conversation could not be loaded. Try again.', 'No se pudo cargar la conversación. Intenta de nuevo.'))}</div>`; } }
    panel.querySelector('[data-chat-form]').onsubmit = async (event) => { event.preventDefault(); const input = panel.querySelector('textarea'); input.setCustomValidity(''); const body = input.value.trim(); if (!body) return; input.disabled = true; try { const result = await api.sendChat(peerId, body); state.chatMessages = [...state.chatMessages.filter((item) => item.id !== result.message.id), result.message]; input.value = ''; render(state.chatMessages); } catch { input.setCustomValidity(localize('Message could not be sent. Try again.', 'No se pudo enviar el mensaje. Intenta de nuevo.')); input.reportValidity(); } finally { input.disabled = false; input.focus(); } };
    requestAnimationFrame(() => panel.querySelector('textarea')?.focus({ preventScroll:true }));
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
      openChat(peer.userId, peer.name || peer.email || localize('Collaborator', 'Colaborador'));
      return true;
    } catch { return false; }
  }

  const accessModules = ['script','analysis','breakdown','shot_list','stripboard','calendar','budget','canvas','location_plan','imagine','files','project_settings','members','exports','lumiere'];
  const cinematicRoles = ['producer','director','writer','assistant_director','director_of_photography','camera_department','gaffer','grip','production_designer','art_department','sound','hair_and_makeup','wardrobe','production','client','talent'];
  const roleLabels = { owner:'Owner', co_owner:'Co owner', admin:'Admin', editor:'Editor', department_editor:'Department Editor', commenter:'Commenter', viewer:'Viewer', temporary_guest:'Temporary Guest' };
  const uiText = (value) => window.filmscriptLanguage?.t?.(value) || value;
  const interfaceLocale = () => String(window.filmscriptLanguage?.get?.() || document.documentElement.lang || 'en').toLowerCase().startsWith('es') ? 'es' : 'en';
  const localize = (english, spanish) => { const translated = uiText(english); return interfaceLocale() === 'es' ? (translated !== english ? translated : spanish) : translated; };
  const localizedLabel = (value) => uiText(String(value || '').replaceAll('_',' ').replace(/\b\w/g, (character) => character.toUpperCase()));
  const localizedError = (error, englishFallback = 'FilmScript could not complete that action.', spanishFallback = 'FilmScript no pudo completar esa acción.') => {
    const source = String(error?.message || englishFallback);
    const translated = uiText(source);
    return interfaceLocale() === 'es' && translated === source ? spanishFallback : translated;
  };
  const notificationSystemCopy = Object.freeze({
    'Project invitation':'Invitación al proyecto', 'You were invited to collaborate in FilmScript.':'Te invitaron a colaborar en FilmScript.',
    'Project access removed':'Acceso al proyecto eliminado', 'Your project access was removed.':'Se eliminó tu acceso al proyecto.',
    'Permissions updated':'Permisos actualizados', 'Your project permissions changed.':'Cambiaron tus permisos del proyecto.',
    'You are now the project owner':'Ahora eres propietario del proyecto', 'Billing ownership and project ownership were transferred to you.':'Se te transfirieron la propiedad del proyecto y la titularidad de facturación.',
    'You were mentioned':'Te mencionaron', 'New collaborator message':'Nuevo mensaje de un colaborador',
    'Translation is ready':'La traducción está lista', 'Translation could not be completed':'No se pudo completar la traducción',
    'Your credits were returned. You can retry when ready.':'Se devolvieron tus créditos. Puedes intentarlo de nuevo cuando quieras.',
    'Analysis completed':'Análisis completado', 'Your screenplay analysis is ready.':'El análisis de tu guion está listo.',
    'Breakdown completed':'Desglose completado', 'Your production breakdown is ready.':'Tu desglose de producción está listo.',
    'Shot List completed':'Lista de planos completada', 'Your shot list is ready.':'Tu lista de planos está lista.',
    'Lumiere could not complete this request.':'Lumiere no pudo completar esta solicitud.', 'Lumiere could not complete this request':'Lumiere no pudo completar esta solicitud',
    'Shot List generation completed':'Generación de Lista de planos completada', 'Translation completed':'Traducción completada',
    'Your reserved credits were released. You can retry when ready.':'Se liberaron tus créditos reservados. Puedes intentarlo de nuevo cuando quieras.',
  });
  const localizeNotificationSystemText = (value) => {
    const source = String(value || '');
    if (interfaceLocale() !== 'es') return uiText(source);
    const translated = uiText(source); if (translated !== source) return translated;
    if (notificationSystemCopy[source]) return notificationSystemCopy[source];
    const independentProject = source.match(/^(.+) was created as an independent project\.$/);
    if (independentProject) return `${independentProject[1]} se creó como proyecto independiente.`;
    const breakdownItems = source.match(/^(.+) updated (\d+) Breakdown items? in Scene (.+)\.$/);
    if (breakdownItems) return `${breakdownItems[1]} actualizó ${breakdownItems[2]} elementos de Desglose en la escena ${breakdownItems[3]}.`;
    return source;
  };
  const localizeNotification = (item = {}) => {
    const type = String(item.type || '').toLowerCase();
    const userAuthoredMessage = type === 'message' || type === 'mention' || type.includes('comment') || type.includes('reply');
    return { title:localizeNotificationSystemText(item.title), message:userAuthoredMessage ? String(item.message || '') : localizeNotificationSystemText(item.message) };
  };
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
    const roleOptions = ['co_owner','admin','editor','department_editor','commenter','viewer','temporary_guest'].map((role) => `<option value="${role}"${currentRole === role ? ' selected' : ''}>${escapeHtml(uiText(roleLabels[role]))}</option>`).join('');
    const cinematicOptions = cinematicRoles.map((role) => `<option value="${role}"${currentCinematic === role ? ' selected' : ''}>${escapeHtml(localizedLabel(role))}</option>`).join('');
    const moduleRows = accessModules.map((module) => {
      const englishModule = label(module);
      const moduleLabel = localizedLabel(module);
      const permissionLabel = localize(`${englishModule} permission`, `Permiso de ${moduleLabel}`);
      return `<label class="fs-permission-row"><span><strong>${escapeHtml(moduleLabel)}</strong></span><select name="module_${module}" aria-label="${escapeHtml(permissionLabel)}">${['no_access','view','comment','edit','manage'].map((level) => `<option value="${level}"${(permissions[module] || 'no_access') === level ? ' selected' : ''}>${escapeHtml(localizedLabel(level))}</option>`).join('')}</select></label>`;
    }).join('');
    const financialValue = financial.includes('financial.manage_access') || financial.includes('financial.edit_all') ? 'full' : financial.includes('financial.edit_department') ? 'department_edit' : financial.includes('financial.view_department') ? 'department_view' : financial.includes('financial.view_all') ? 'all_view' : 'none';
    const subjectName = subject.name || subject.invitedEmail || subject.invitedUsername || localize('collaborator', 'colaborador');
    const accessTitle = inviting ? localize('Invite a collaborator', 'Invitar a un colaborador') : localize(`Access for ${subjectName}`, `Acceso para ${subjectName}`);
    const root = dialog(accessTitle, localize('Choose a role preset, then customize each project area.', 'Elige un rol base y luego personaliza cada área del proyecto.'), `<form data-access-form class="fs-access-editor">${target}<div class="fs-form-grid"><label class="fs-form-field"><span>Cinematic role</span><select name="cinematicRole">${cinematicOptions}</select></label><label class="fs-form-field"><span>Project role</span><select name="projectRole">${roleOptions}</select></label></div><section class="fs-permission-section"><h3>Module permissions</h3><div class="fs-permission-list">${moduleRows}</div></section><section class="fs-financial-section"><div class="fs-financial-warning">Financial information is sensitive. Choose exactly who can access it.</div><label class="fs-form-field"><span>Financial access</span><select name="financial"><option value="none"${financialValue === 'none' ? ' selected' : ''}>No financial access</option><option value="all_view"${financialValue === 'all_view' ? ' selected' : ''}>View all financial information</option><option value="full"${financialValue === 'full' ? ' selected' : ''}>Edit all and export</option><option value="department_view"${financialValue === 'department_view' ? ' selected' : ''}>View assigned departments</option><option value="department_edit"${financialValue === 'department_edit' ? ' selected' : ''}>Edit assigned departments</option></select></label><label class="fs-form-field"><span>Financial department IDs</span><input name="departments" value="${escapeHtml(departments.join(', '))}" placeholder="camera, art, production"></label></section><div class="fs-dialog-actions"><button class="fs-action" type="button" data-back>Cancel</button><button class="fs-action fs-action-primary" type="submit">${inviting ? 'Create invitation' : 'Save access'}</button></div><p class="fs-form-message" data-form-message role="status"></p></form>`, 'fs-access-dialog');
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
      } catch (error) { message.textContent = localizedError(error, 'FilmScript could not save this access change.', 'FilmScript no pudo guardar este cambio de acceso.'); }
    };
  }

  async function openMembers() {
    let result;
    try { result = await api.members(); } catch (error) { return dialog('People & Access', 'Project collaboration settings', `<div class="fs-guest-error"><strong>${escapeHtml(localize('People and access could not be loaded.', 'No se pudieron cargar las personas ni los accesos.'))}</strong><p>${escapeHtml(localizedError(error, 'Try again in a moment.', 'Intenta de nuevo en un momento.'))}</p></div>`); }
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
    const empty = `<div class="fs-member-card"><span class="fs-member-copy"><strong>${escapeHtml(localize('No activity yet', 'Todavía no hay actividad'))}</strong><small>${escapeHtml(localize('Important project changes will appear here.', 'Los cambios importantes del proyecto aparecerán aquí.'))}</small></span></div>`;
    const events = result.events.length ? `<div class="fs-platform-list">${result.events.map((item) => `<article class="fs-activity-card">${avatar(item.actor)}<span class="fs-member-copy"><strong data-project-content data-i18n-skip>${escapeHtml(item.summary)}</strong><small>${escapeHtml(new Date(item.createdAt).toLocaleString(interfaceLocale()))}</small></span></article>`).join('')}</div>` : empty;
    dialog(localize('Project activity', 'Actividad del proyecto'), localize('Meaningful changes, without cursor noise or every keystroke.', 'Cambios importantes, sin el ruido del cursor ni cada pulsación.'), events);
  }

  function creditsLabel() {
    if (state.me?.credits?.unlimited) return localize('Unlimited Lumiere credits', 'Créditos de Lumiere ilimitados');
    const remaining = state.me?.credits?.remaining ?? state.me?.credits?.text?.remaining;
    if (Number.isFinite(Number(remaining))) return localize(`${Number(remaining).toLocaleString(interfaceLocale())} Lumiere credits`, `${Number(remaining).toLocaleString(interfaceLocale())} créditos de Lumiere`);
    const imageRemaining = state.me?.credits?.image?.remaining;
    if (Number.isFinite(Number(imageRemaining))) return localize(`${Number(imageRemaining).toLocaleString(interfaceLocale())} image credits`, `${Number(imageRemaining).toLocaleString(interfaceLocale())} créditos de imagen`);
    return localize('Credits available', 'Créditos disponibles');
  }

  async function refreshAccountState() {
    const account = await api.me(); state.me = account;
    try { const platform = await api.profile(); state.profile = platform.profile || null; } catch {}
    applyAccountIdentity();
    return account;
  }

  async function openAccount() {
    try { await refreshAccountState(); } catch (error) {
      if (!state.me) return dialog(localize('Account', 'Cuenta'), localize('Your account could not be loaded.', 'No se pudo cargar tu cuenta.'), `<p class="fs-form-message">${escapeHtml(localizedError(error, 'Try again in a moment.', 'Intenta de nuevo en un momento.'))}</p>`);
    }
    const selectedTheme = document.documentElement.dataset.filmscriptTheme || state.profile?.theme || 'filmscript';
    let selectedIcon = profileIcon(state.profile?.avatarCrop?.presetIcon)?.id || null;
    let selectedBackground = avatarBackground(state.profile?.avatarCrop?.presetBackground)[0];
    const maxBirthDate = new Date().toISOString().slice(0,10);
    const root = dialog('Account', 'Your identity, preferences and private details in one place.', `
      <div class="fs-account-layout">
        <section class="fs-account-hero">
          <div class="fs-account-avatar-preview" data-account-preview aria-label="${escapeHtml(localize('Current profile image', 'Imagen de perfil actual'))}"></div>
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
      button.disabled = true; button.textContent = localize('Saving', 'Guardando'); status.textContent = '';
      try {
        const result = await api.updateProfile({ avatarCrop:{ presetIcon:selectedIcon, presetBackground:selectedBackground } });
        state.profile = result.profile;
        applyAccountIdentity(); renderPreview();
        window.dispatchEvent(new CustomEvent('filmscript:avatar-changed', { detail:{ presetIcon:selectedIcon, presetBackground:selectedBackground } }));
        status.textContent = localize('Icon saved everywhere in FilmScript.', 'El icono se guardó en todo FilmScript.'); button.textContent = localize('Saved', 'Guardado');
      } catch (error) { status.textContent = localizedError(error, 'The icon could not be saved. Try again.', 'No se pudo guardar el icono. Intenta de nuevo.'); button.disabled = false; button.textContent = localize('Use icon', 'Usar icono'); }
    });
    root.querySelector('[data-account-form]').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget; const button = form.querySelector('[type="submit"]'); const status = root.querySelector('[data-account-status]');
      button.disabled = true; button.textContent = localize('Saving', 'Guardando'); status.textContent = '';
      const data = new FormData(form);
      let platform = null;
      try {
        // Validate the unique username first. A username conflict must not save
        // a different name or private profile fields as an accidental partial edit.
        platform = await api.updateProfile({ username:String(data.get('username') || '').trim() || null });
        const account = await api.updateMe({ name:String(data.get('name') || '').trim(), gender:data.get('gender') || null, birthDate:data.get('birthDate') || null });
        state.me = account; state.profile = platform.profile; applyAccountIdentity();
        window.dispatchEvent(new CustomEvent('filmscript:profile-updated', { detail:account }));
        status.textContent = localize('Account details saved.', 'Se guardaron los detalles de la cuenta.'); button.textContent = localize('Saved', 'Guardado');
      } catch (error) {
        if (platform?.profile) {
          state.profile = platform.profile;
          const detail = localizedError(error, 'The remaining account details could not be saved.', 'No se pudieron guardar los demás detalles de la cuenta.');
          status.textContent = localize(`Your username was saved, but the other details could not be saved. ${detail}`, `Tu usuario se guardó, pero no se pudieron guardar los demás detalles. ${detail}`);
        } else status.textContent = localizedError(error, 'Account details could not be saved.', 'No se pudieron guardar los detalles de la cuenta.');
        button.disabled = false; button.textContent = localize('Save details', 'Guardar detalles');
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
        dialog(localize('Photo unavailable', 'Foto no disponible'), localize('Choose a PNG, JPEG or WebP image smaller than 8 MB.', 'Elige una imagen PNG, JPEG o WebP de menos de 8 MB.'), `<p class="fs-form-message">${escapeHtml(localize('That file cannot be used as a FilmScript profile photo.', 'Ese archivo no se puede usar como foto de perfil de FilmScript.'))}</p>`);
        return;
      }
      const objectUrl = URL.createObjectURL(file); const image = new Image();
      image.onerror = () => { URL.revokeObjectURL(objectUrl); dialog(localize('Photo unavailable', 'Foto no disponible'), localize('FilmScript could not read that image.', 'FilmScript no pudo leer esa imagen.'), `<p class="fs-form-message">${escapeHtml(localize('Try exporting the image as PNG or JPEG, then upload it again.', 'Intenta exportar la imagen como PNG o JPEG y vuelve a subirla.'))}</p>`); };
      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        let zoom = 1; let offsetX = 0; let offsetY = 0;
        const root = dialog(localize('Profile photo', 'Foto de perfil'), localize('Zoom and reposition the circular crop before saving.', 'Amplía y reposiciona el recorte circular antes de guardar.'), `<div class="fs-avatar-editor"><div class="fs-avatar-preview"><canvas width="512" height="512" tabindex="0" role="img" aria-label="${escapeHtml(localize('Profile crop preview. Drag or use arrow keys to reposition.', 'Vista previa del recorte de perfil. Arrastra o usa las flechas para reposicionar.'))}"></canvas></div><div><label class="fs-form-field"><span>${escapeHtml(localize('Zoom', 'Zoom'))}</span><input type="range" min="1" max="3" step=".01" value="1" data-zoom></label><p class="fs-avatar-help">${escapeHtml(localize('Drag the preview or use the arrow keys to reposition your image.', 'Arrastra la vista previa o usa las flechas para reposicionar la imagen.'))}</p><p class="fs-form-message" data-photo-status role="status" aria-live="polite"></p><div class="fs-dialog-actions"><button class="fs-action fs-action-primary" data-save>${escapeHtml(localize('Save photo', 'Guardar foto'))}</button></div></div></div>`);
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
          if (!blob) { status.textContent = localize('FilmScript could not prepare this crop. Try another image.', 'FilmScript no pudo preparar este recorte. Prueba con otra imagen.'); return; }
          button.disabled = true; button.textContent = localize('Saving', 'Guardando'); status.textContent = '';
          try {
            const result = await request('/api/me/avatar', { method:'POST', body:blob, headers:{ 'Content-Type':'image/webp' } });
            state.me = { ...(state.me || {}), avatar:result.avatarUrl };
            state.profile = { ...(state.profile || {}), avatarUrl:result.avatarUrl, avatarCrop:{ outputWidth:512, outputHeight:512 } };
            applyAccountIdentity();
            window.dispatchEvent(new CustomEvent('filmscript:avatar-changed', { detail:{ avatarUrl:result.avatarUrl } }));
            openAccount();
          } catch (error) { button.disabled = false; button.textContent = localize('Save photo', 'Guardar foto'); status.textContent = localizedError(error, 'The profile photo could not be saved.', 'No se pudo guardar la foto de perfil.'); }
        }, 'image/webp', .86);
      }; image.src = objectUrl;
    };
    input.click();
  }

  async function openTranslation(script) {
    const languages = [['English','Inglés'],['Spanish','Español'],['French','Francés'],['Portuguese','Portugués'],['German','Alemán']];
    const options = languages.map(([value, spanish]) => `<option value="${value}">${escapeHtml(localize(value, spanish))}</option>`).join('');
    const root = dialog(localize('Translate Script', 'Traducir guion'), localize('This will create a new independent project.', 'Esto creará un proyecto nuevo e independiente.'), `<div class="fs-form-grid"><label class="fs-form-field" style="grid-column:1/-1"><span>${escapeHtml(localize('Source script', 'Guion de origen'))}</span><input data-project-content data-i18n-skip value="${escapeHtml(script.title)}" readonly></label><label class="fs-form-field" style="grid-column:1/-1"><span>${escapeHtml(localize('Target language', 'Idioma de destino'))}</span><select data-language>${options}</select></label></div><div data-translation-summary class="fs-member-card" style="margin-top:14px"><span class="fs-member-copy"><strong>${escapeHtml(localize('Choose a target language', 'Elige un idioma de destino'))}</strong><small>${escapeHtml(localize('The exact credit cost will appear before processing.', 'El costo exacto en créditos aparecerá antes de procesar.'))}</small></span></div><div class="fs-dialog-actions"><button class="fs-action fs-action-primary" data-start disabled>${escapeHtml(localize('Translate and create project', 'Traducir y crear proyecto'))}</button></div>`);
    const select = root.querySelector('[data-language]'); const start = root.querySelector('[data-start]'); let preview;
    const refresh = async () => {
      try {
        preview = await api.translationPreview(script.id, select.value);
        const available = preview.availableCredits ?? localize('Unlimited', 'Ilimitados');
        const summary = localize(
          `${preview.pageCount} pages · Translation cost ${preview.requiredCredits} credits · Available ${available}`,
          `${preview.pageCount} páginas · Costo de traducción: ${preview.requiredCredits} créditos · Disponibles: ${available}`
        );
        root.querySelector('[data-translation-summary]').innerHTML = `<span class="fs-member-copy"><strong data-project-content data-i18n-skip>${escapeHtml(preview.newProjectName)}</strong><small>${escapeHtml(summary)}</small></span>`;
        start.disabled = false;
      } catch (error) { root.querySelector('[data-translation-summary]').textContent = localizedError(error, 'The translation cost could not be calculated.', 'No se pudo calcular el costo de la traducción.'); }
    };
    select.onchange = refresh; refresh(); start.onclick = async () => {
      start.disabled = true; start.textContent = localize('Starting translation', 'Iniciando traducción');
      try {
        const result = await api.translate(script.id, select.value);
        root.querySelector('.fs-platform-body').innerHTML = `<div class="fs-member-card"><span class="fs-member-copy"><strong>${escapeHtml(localize('Translation started', 'Traducción iniciada'))}</strong><small>${escapeHtml(localize('You can leave this screen. FilmScript will notify you when the new project is ready.', 'Puedes salir de esta pantalla. FilmScript te avisará cuando el proyecto nuevo esté listo.'))}</small><div class="fs-progress" style="margin-top:12px"><span style="--progress:${result.job.progress}%"></span></div></span></div>`;
        refreshNotifications();
      } catch (error) {
        start.disabled = false; start.textContent = localize('Translate and create project', 'Traducir y crear proyecto');
        root.querySelector('[data-translation-summary]').textContent = localizedError(error, 'The translation could not be started.', 'No se pudo iniciar la traducción.');
      }
    };
  }

  async function openShare() {
    const modules = ['script','analysis','breakdown','stripboard','shot_list','calendar','budget','canvas','location_plan','imagine','files'];
    const sectionRows = modules.map((module) => {
      const moduleLabel = localizedLabel(module);
      return `<label class="fs-member-card"><input type="checkbox" name="section" value="${module}"><span class="fs-member-copy"><strong>${escapeHtml(moduleLabel)}</strong><small>${escapeHtml(localize('View access only', 'Solo acceso de visualización'))}</small></span><input type="checkbox" name="export_${module}" aria-label="${escapeHtml(localize(`Allow export for ${label(module)}`, `Permitir exportación de ${moduleLabel}`))}"><span>${escapeHtml(localize('Allow export', 'Permitir exportación'))}</span></label>`;
    }).join('');
    const root = dialog(localize('Create Shared Project', 'Crear Proyecto compartido'), localize('Choose exactly what an external viewer can see. This Shared Project is read only.', 'Elige exactamente qué puede ver una persona externa. Este Proyecto compartido es de solo lectura.'), `<form data-share><div class="fs-form-grid"><label class="fs-form-field" style="grid-column:1/-1"><span>${escapeHtml(localize('Access', 'Acceso'))}</span><select name="accessMode"><option value="public">${escapeHtml(localize('Anyone with the link', 'Cualquiera con el enlace'))}</option><option value="password">${escapeHtml(localize('Password protected', 'Protegido con contraseña'))}</option><option value="email_restricted">${escapeHtml(localize('Invited emails only', 'Solo correos invitados'))}</option></select></label><label class="fs-form-field" style="grid-column:1/-1"><span>${escapeHtml(localize('Password or invited emails', 'Contraseña o correos invitados'))}</span><input name="accessValue" placeholder="${escapeHtml(localize('Add when required', 'Añade la información cuando sea necesaria'))}"></label></div><div class="fs-platform-list" style="margin-top:15px">${sectionRows}</div><div class="fs-dialog-actions"><button class="fs-action fs-action-primary">${escapeHtml(localize('Create Shared Project', 'Crear Proyecto compartido'))}</button></div></form><div data-share-result></div>`);
    root.querySelector('[data-share]').onsubmit = async (event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget); const mode = form.get('accessMode'); const value = String(form.get('accessValue') || ''); const sections = form.getAll('section').map((module) => ({ module, canView:true, canExport:form.get(`export_${module}`) === 'on' }));
      try {
        const result = await api.createShared({ accessMode:mode, ...(mode === 'password' ? { password:value } : {}), ...(mode === 'email_restricted' ? { allowedEmails:value.split(',').map((item) => item.trim()) } : {}), sections });
        root.querySelector('[data-share-result]').innerHTML = `<div class="fs-member-card"><span class="fs-member-copy"><strong>${escapeHtml(localize('Shared Project is ready', 'El Proyecto compartido está listo'))}</strong><input data-project-content data-i18n-skip value="${escapeHtml(result.sharedProject.url)}" aria-label="${escapeHtml(localize('Shared Project link', 'Enlace del Proyecto compartido'))}" readonly style="width:100%;margin-top:8px"></span><button class="fs-action" data-copy>${escapeHtml(localize('Copy', 'Copiar'))}</button></div>`;
        root.querySelector('[data-copy]').onclick = () => navigator.clipboard.writeText(result.sharedProject.url);
      } catch (error) { root.querySelector('[data-share-result]').textContent = localizedError(error, 'The Shared Project could not be created.', 'No se pudo crear el Proyecto compartido.'); }
    };
  }

  async function openLocationPlan() {
    let result = await api.locationPlans(); let plan = result.locationPlans?.[0];
    if (!plan) plan = (await api.createLocationPlan({ name:localize('Location Plan', 'Plan de locaciones'), unitSystem:'metric' })).locationPlan;
    let tool = 'select'; let selectedId = null; let draftStart = null; let cablePoints = []; let saving = false;
    const root = dialog(localize('Location Plan', 'Plan de locaciones'), localize('Real measurements without CAD complexity.', 'Medidas reales sin la complejidad de un programa CAD.'), `<div class="fs-location-toolbar" role="toolbar" aria-label="${escapeHtml(localize('Location Plan tools', 'Herramientas del Plan de locaciones'))}"><button class="fs-action" data-tool="select">${escapeHtml(localize('Select', 'Seleccionar'))}</button><button class="fs-action" data-tool="wall">${escapeHtml(localize('Wall', 'Pared'))}</button><button class="fs-action" data-tool="door">${escapeHtml(localize('Door', 'Puerta'))}</button><button class="fs-action" data-tool="window">${escapeHtml(localize('Window', 'Ventana'))}</button><button class="fs-action" data-tool="measure">${escapeHtml(localize('Measure', 'Medir'))}</button><button class="fs-action" data-tool="cable">${escapeHtml(localize('Cable', 'Cable'))}</button><button class="fs-action" data-tool="zone">${escapeHtml(localize('Zone', 'Zona'))}</button><button class="fs-action" data-tool="route">${escapeHtml(localize('Route', 'Ruta'))}</button><button class="fs-action" data-tool="equipment">${escapeHtml(localize('Equipment', 'Equipo'))}</button><button class="fs-action" data-tool="note">${escapeHtml(localize('Note', 'Nota'))}</button></div><div class="fs-location-stage"><svg viewBox="0 0 1000 650" tabindex="0" aria-label="${escapeHtml(localize('Editable Location Plan', 'Plan de locaciones editable'))}"><g data-grid></g><g data-zones></g><g data-walls></g><g data-cables></g><g data-equipment></g></svg><aside data-inspector><strong>${escapeHtml(localize('Location Plan', 'Plan de locaciones'))}</strong><p>${escapeHtml(localize('Select a wall or draw the physical space.', 'Selecciona una pared o dibuja el espacio físico.'))}</p><label class="fs-form-field"><span>${escapeHtml(localize('Units', 'Unidades'))}</span><select data-units><option value="metric">${escapeHtml(localize('Metric', 'Métrico'))}</option><option value="imperial">${escapeHtml(localize('Imperial', 'Imperial'))}</option></select></label><label style="display:flex;gap:8px;margin-top:12px"><input type="checkbox" data-lock> ${escapeHtml(localize('Lock Scale', 'Bloquear escala'))}</label></aside></div><div class="fs-dialog-actions"><span data-plan-status style="margin-right:auto;color:var(--text-secondary)">${escapeHtml(localize(`Version ${plan.version}`, `Versión ${plan.version}`))}</span><button class="fs-action" data-view>${escapeHtml(localize('Department view', 'Vista por departamento'))}</button><button class="fs-action fs-action-primary" data-save>${escapeHtml(localize('Save Location Plan', 'Guardar Plan de locaciones'))}</button></div>`, 'fs-location-dialog');
    const svg = root.querySelector('svg'); const ns = 'http://www.w3.org/2000/svg'; root.querySelector('[data-units]').value = plan.unitSystem || 'metric'; root.querySelector('[data-lock]').checked = !!plan.scale?.locked;
    const svgPoint = (event) => { const matrix = svg.getScreenCTM(); return { x:(event.clientX-matrix.e)/matrix.a, y:(event.clientY-matrix.f)/matrix.d }; };
    const line = (parent, a, b, attrs={}) => { const el=document.createElementNS(ns,'line'); Object.entries({x1:a.x,y1:a.y,x2:b.x,y2:b.y,...attrs}).forEach(([k,v])=>el.setAttribute(k,v)); parent.appendChild(el); return el; };
    function render() {
      const walls=root.querySelector('[data-walls]'); const cables=root.querySelector('[data-cables]'); const equipment=root.querySelector('[data-equipment]'); walls.innerHTML='';cables.innerHTML='';equipment.innerHTML='';
      (plan.walls||[]).forEach((wall) => { const selected=wall.id===selectedId; const el=line(walls,wall.start,wall.end,{stroke:selected?'var(--accent)':'var(--text-primary)','stroke-width':wall.thickness||8,'stroke-linecap':'round','data-id':wall.id,tabindex:'0'}); el.onclick=(event)=>{event.stopPropagation();selectedId=wall.id;renderInspector();render()}; });
      (plan.cables||[]).forEach((cable) => { const path=document.createElementNS(ns,'polyline');path.setAttribute('points',(cable.points||[]).map(p=>`${p.x},${p.y}`).join(' '));path.setAttribute('fill','none');path.setAttribute('stroke','#d35400');path.setAttribute('stroke-width','4');cables.appendChild(path); });
      (plan.equipment||[]).forEach((item)=>{const g=document.createElementNS(ns,'g');g.innerHTML=`<circle cx="${item.position.x}" cy="${item.position.y}" r="18" fill="var(--surface-primary)" stroke="var(--accent)" stroke-width="3"/><text x="${item.position.x}" y="${item.position.y+34}" text-anchor="middle" fill="var(--text-primary)" font-size="14">${escapeHtml(item.name)}</text>`;equipment.appendChild(g)});
    }
    function renderInspector(){const inspector=root.querySelector('[data-inspector]');const wall=(plan.walls||[]).find(item=>item.id===selectedId);if(!wall)return;const canvasLength=Math.hypot(wall.end.x-wall.start.x,wall.end.y-wall.start.y);const real=canvasLength*(plan.scale?.realWorldUnitsPerCanvasUnit||1);inspector.innerHTML=`<strong>${escapeHtml(localize('Wall', 'Pared'))}</strong><label class="fs-form-field" style="margin-top:12px"><span>${escapeHtml(localize('Length', 'Longitud'))}</span><input type="number" min=".01" step=".01" data-length value="${real.toFixed(2)}"></label><label class="fs-form-field" style="margin-top:12px"><span>${escapeHtml(localize('Thickness', 'Grosor'))}</span><input type="number" min="1" step="1" data-thickness value="${wall.thickness||8}"></label><button class="fs-action" data-calibrate style="width:100%;margin-top:12px">${escapeHtml(plan.scale?.calibrated ? localize('Recalibrate Scale', 'Recalibrar escala') : localize('Calibrate Scale', 'Calibrar escala'))}</button>`;inspector.querySelector('[data-thickness]').onchange=e=>{wall.thickness=Math.max(1,Number(e.target.value)||8);render()};inspector.querySelector('[data-length]').onchange=e=>{if(!plan.scale?.calibrated)return;const target=Number(e.target.value)/(plan.scale.realWorldUnitsPerCanvasUnit||1);const current=Math.max(.001,canvasLength);wall.end={x:wall.start.x+(wall.end.x-wall.start.x)*target/current,y:wall.start.y+(wall.end.y-wall.start.y)*target/current};render()};inspector.querySelector('[data-calibrate]').onclick=()=>{if(plan.scale?.locked)return;const known=Number(inspector.querySelector('[data-length]').value);if(known>0)plan.scale={...plan.scale,calibrated:true,realWorldUnitsPerCanvasUnit:known/canvasLength};renderInspector()};}
    root.querySelectorAll('[data-tool]').forEach(button=>button.onclick=()=>{tool=button.dataset.tool;draftStart=null;cablePoints=[];root.querySelectorAll('[data-tool]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)))});
    svg.onpointerdown=(event)=>{const p=svgPoint(event);if(tool==='select'){selectedId=null;render();return}if(tool==='equipment'){plan.equipment.push({id:`eq_${Date.now()}`,name:localize('Generic Equipment', 'Equipo genérico'),category:'production',position:p,dimensions:{width:1,height:1},rotation:0,notes:''});render();return}if(tool==='wall'){draftStart=p;svg.setPointerCapture(event.pointerId);return}if(tool==='cable'){cablePoints.push(p);if(event.detail>=2&&cablePoints.length>1){const length=cablePoints.slice(1).reduce((sum,current,index)=>sum+Math.hypot(current.x-cablePoints[index].x,current.y-cablePoints[index].y),0);plan.cables.push({id:`cable_${Date.now()}`,points:[...cablePoints],slackPercentage:10,routeLength:length,recommendedLength:length*1.1});cablePoints=[];render()}return}};
    svg.onpointerup=(event)=>{if(tool!=='wall'||!draftStart)return;const end=svgPoint(event);if(Math.hypot(end.x-draftStart.x,end.y-draftStart.y)>4){const dx=end.x-draftStart.x,dy=end.y-draftStart.y,angle=Math.atan2(dy,dx),snap=Math.round(angle/(Math.PI/4))*(Math.PI/4),length=Math.hypot(dx,dy);const snapped={x:draftStart.x+Math.cos(snap)*length,y:draftStart.y+Math.sin(snap)*length};const wall={id:`wall_${Date.now()}`,start:draftStart,end:snapped,thickness:8,connectedWallIds:[],doorIds:[],windowIds:[]};plan.walls.push(wall);selectedId=wall.id;draftStart=null;render();renderInspector()}};
    root.querySelector('[data-lock]').onchange=e=>{plan.scale={...(plan.scale||{}),locked:e.target.checked}};root.querySelector('[data-units]').onchange=e=>{plan.unitSystem=e.target.value};
    root.querySelector('[data-save]').onclick=async()=>{if(saving)return;saving=true;root.querySelector('[data-plan-status]').textContent=localize('Saving', 'Guardando');try{plan=(await api.saveLocationPlan(plan,plan.version)).locationPlan;root.querySelector('[data-plan-status]').textContent=localize(`Saved · Version ${plan.version}`, `Guardado · Versión ${plan.version}`)}catch(error){root.querySelector('[data-plan-status]').textContent=localizedError(error, 'The Location Plan could not be saved.', 'No se pudo guardar el Plan de locaciones.')}finally{saving=false}};
    root.querySelector('[data-view]').onclick=()=>{const choice=prompt(localize('Department view: all, director, camera, lighting, art, or production', 'Vista por departamento: todos, dirección, cámara, iluminación, arte o producción'),localize('all','todos'));if(choice)root.querySelector('[data-plan-status]').textContent=localize(`${choice.charAt(0).toUpperCase()+choice.slice(1)} view`, `Vista: ${choice}`)};render();
  }

  async function refreshNotifications() {
    try {
      const result = await api.notifications(); const badge = document.querySelector('.fs-notification-badge');
      if (badge) { badge.textContent = result.unreadCount > 99 ? '99+' : result.unreadCount; badge.hidden = !result.unreadCount; }
      syncHubLanguage();
    } catch {}
  }

  const presenceModuleLabel = (module) => ({
    script:['Script','Guion'], analysis:['Analysis','Análisis'], breakdown:['Breakdown','Desglose'], shot_list:['Shot List','Lista de planos'],
    stripboard:['Stripboard','Plan de rodaje'], calendar:['Calendar','Calendario'], budget:['Budget','Presupuesto'], canvas:['Canvas','Canvas'],
    location_plan:['Location Plan','Plan de locaciones'], imagine:['Imagine','Imagine'], project:['Project','Proyecto'],
  }[String(module || 'project').toLowerCase()] || [label(module || 'Project'), label(module || 'Proyecto')]);
  const presenceStateLabel = (presenceState) => ({ active:['active','activo'], idle:['idle','inactivo'], disconnected:['disconnected','desconectado'] }[String(presenceState || 'active').toLowerCase()] || [String(presenceState || 'active'), String(presenceState || 'activo')]);
  const presenceLabel = (person) => {
    const moduleCopy = presenceModuleLabel(person.module); const stateCopy = presenceStateLabel(person.state);
    return `${person.name || localize('Collaborator', 'Colaborador')} · ${interfaceLocale() === 'es' ? moduleCopy[1] : moduleCopy[0]} · ${interfaceLocale() === 'es' ? stateCopy[1] : stateCopy[0]}`;
  };

  function renderPresence() {
    const container = document.querySelector('.fs-live-avatars'); if (!container) return;
    const unique = [...new Map(state.presence.filter((person) => person.clientId !== clientId && person.userId !== state.me?.id && person.state !== 'disconnected').map((person) => [person.userId, person])).values()].slice(0,5);
    container.innerHTML = unique.map((person) => { const preset = profileIcon(person.avatarPreset); const palette = avatarBackground(person.avatarBackground); const picture = person.picture ? resolveAsset(person.picture) : null; const accessibleLabel = presenceLabel(person); return `<button type="button" class="fs-live-avatar${preset ? ' fs-preset-avatar' : ''}" data-project-content data-i18n-skip style="--collaborator-color:${escapeHtml(person.color)};${preset ? `--profile-avatar-bg:${palette[2]};--profile-avatar-ink:${palette[3]}` : ''}" title="${escapeHtml(accessibleLabel)}" aria-label="${escapeHtml(accessibleLabel)}">${preset ? preset.svg : picture ? `<img src="${escapeHtml(picture)}" alt="${escapeHtml(person.name)}">` : escapeHtml(person.name?.charAt(0) || 'C')}</button>`; }).join('');
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
    ['ai.job.completed','content.operation','content.conflict','comment.created','message.created','script.crdt','canvas.drag'].forEach((type) => state.eventSource.addEventListener(type, async (event) => { let detail={};try{detail=JSON.parse(event.data)}catch{}window.dispatchEvent(new CustomEvent(`filmscript:${type}`,{detail})); if (type === 'message.created' && state.chatPeer && detail && (detail.senderId === state.chatPeer || detail.recipientId === state.chatPeer)) { try { state.chatMessages = (await api.chat(state.chatPeer)).messages || []; const panel = document.querySelector('.fs-chat-panel'); const messages = panel?.querySelector('[data-chat-messages]'); messages?.replaceChildren(...state.chatMessages.map((item) => { const article=document.createElement('article'); article.className=`fs-chat-bubble ${item.senderId === state.me?.id ? 'is-mine' : ''}`; article.innerHTML=`<p data-project-content data-i18n-skip>${escapeHtml(item.body)}</p><time>${escapeHtml(notificationTime(item.createdAt))}</time>`; return article; })); if (messages) { messages.setAttribute('aria-busy', 'false'); messages.scrollTop = messages.scrollHeight; } } catch {} } }));
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
    hub.innerHTML = `${projectId ? '<span class="fs-live-avatars" role="group"></span><button type="button" class="fs-platform-button fs-manage-people" data-people><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 19v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V19"></path><circle cx="9.5" cy="7" r="3"></circle><path d="M17 5.2a3 3 0 0 1 0 5.6M21 19v-1.5a4 4 0 0 0-3-3.87"></path></svg></button><button type="button" class="fs-platform-button" data-chat><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v11H9l-5 3v-14Z"></path><path d="M8 10h8M8 13h5"></path></svg></button>' : ''}<button type="button" class="fs-platform-button" data-bell><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M10 21h4"></path></svg><span class="fs-notification-badge" hidden></span></button>`;
    host.prepend(hub); syncHubLanguage(); hub.querySelector('[data-bell]').onclick = openNotifications; hub.querySelector('[data-chat]')?.addEventListener('click', openChatDirectory); hub.querySelector('[data-people]')?.addEventListener('click', openMembers);
  }

  function syncHubLanguage() {
    const hub = document.querySelector('.fs-platform-hub'); if (!hub) return;
    const setLabel = (selector, english, spanish) => { const element = hub.querySelector(selector); if (!element) return; const value = localize(english, spanish); element.setAttribute('aria-label', value); element.setAttribute('title', value); };
    const live = hub.querySelector('.fs-live-avatars'); if (live) live.setAttribute('aria-label', localize('Active collaborators', 'Colaboradores activos'));
    setLabel('[data-people]', 'People and access', 'Personas y acceso');
    setLabel('[data-chat]', 'Collaborator chat', 'Chat con colaboradores');
    const badge = hub.querySelector('.fs-notification-badge'); const count = badge && !badge.hidden ? badge.textContent : '';
    setLabel('[data-bell]', count ? `Notifications, ${count} unread` : 'Notifications', count ? `Notificaciones, ${count} sin leer` : 'Notificaciones');
  }

  function mountMobileNav() {
    if (document.querySelector('.fs-mobile-global')) return;
    const globalNav = document.createElement('nav'); globalNav.className = 'fs-mobile-nav fs-mobile-global'; globalNav.setAttribute('aria-label', localize('FilmScript navigation', 'Navegación de FilmScript'));
    globalNav.innerHTML = `<a href="App.dc.html"${projectId ? '' : ' aria-current="page"'}>${escapeHtml(localize('Home', 'Inicio'))}</a><a href="App.dc.html">${escapeHtml(localize('Projects', 'Proyectos'))}</a><a href="App.dc.html?lumiere=1">Lumiere</a><button type="button" data-activity>${escapeHtml(localize('Activity', 'Actividad'))}</button><button type="button" data-profile>${escapeHtml(localize('Account', 'Cuenta'))}</button>`;
    document.body.appendChild(globalNav); globalNav.querySelector('[data-activity]').onclick = openNotifications; globalNav.querySelector('[data-profile]').onclick = openAccount;
    if (!projectId) return;
    const view = params.get('view') || 'script'; const projectNav = document.createElement('nav'); projectNav.className = 'fs-mobile-nav fs-mobile-project'; projectNav.setAttribute('aria-label', localize('Project navigation', 'Navegación del proyecto'));
    projectNav.innerHTML = `<a href="App.dc.html">${escapeHtml(localize('Overview', 'Resumen'))}</a><a href="Editor%20v5.dc.html?script=${projectId}"${view === 'script' ? ' aria-current="page"' : ''}>${escapeHtml(localize('Script', 'Guion'))}</a><a href="Editor%20v5.dc.html?script=${projectId}&view=breakdown"${['breakdown','stripboard','shot-list','budget','calendar'].includes(view) ? ' aria-current="page"' : ''}>${escapeHtml(localize('Production', 'Producción'))}</a><a href="Editor%20v5.dc.html?script=${projectId}&view=canvas"${view === 'canvas' ? ' aria-current="page"' : ''}>Canvas</a><button type="button" data-more>${escapeHtml(localize('More', 'Más'))}</button>`;
    document.body.appendChild(projectNav); projectNav.querySelector('[data-more]').onclick = () => { const root = dialog(localize('More', 'Más'), localize('Authorized project modules', 'Módulos autorizados del proyecto'), `<div class="fs-platform-list"><a class="fs-member-card" href="Editor%20v5.dc.html?script=${projectId}&view=analysis">${escapeHtml(localize('Analysis', 'Análisis'))}</a><a class="fs-member-card" href="Editor%20v5.dc.html?script=${projectId}&view=budget">${escapeHtml(localize('Budget', 'Presupuesto'))}</a><button type="button" class="fs-member-card" data-location>${escapeHtml(localize('Location Plan', 'Plan de locaciones'))}</button><button type="button" class="fs-member-card" data-people>${escapeHtml(localize('Members', 'Miembros'))}</button><button type="button" class="fs-member-card" data-share>${escapeHtml(localize('Shared Projects', 'Proyectos compartidos'))}</button></div>`); root.querySelector('[data-location]').onclick = () => { closeDialog(); openLocationPlan(); }; root.querySelector('[data-people]').onclick = () => { closeDialog(); openMembers(); }; root.querySelector('[data-share]').onclick = () => { closeDialog(); openShare(); }; };
  }

  function syncDynamicLanguage() {
    syncHubLanguage(); renderPresence();
    document.querySelectorAll('.fs-mobile-nav').forEach((nav) => nav.remove()); mountMobileNav();
    const panel = document.querySelector('.fs-chat-panel'); if (!panel) return;
    const set = (selector, value, attribute) => { const element = panel.querySelector(selector); if (!element) return; if (attribute) element.setAttribute(attribute, value); else element.textContent = value; };
    set('[data-chat-peer-caption]', localize('FilmScript collaborator', 'Colaborador de FilmScript'));
    set('[data-chat-close]', localize('Close chat', 'Cerrar chat'), 'aria-label');
    set('.fs-chat-compose textarea', localize('Write a message…', 'Escribe un mensaje…'), 'placeholder');
    set('.fs-chat-compose textarea', localize('Message', 'Mensaje'), 'aria-label');
    set('.fs-chat-compose button', localize('Send message', 'Enviar mensaje'), 'aria-label');
    set('.fs-chat-compose button', localize('Send message', 'Enviar mensaje'), 'title');
    const copy = panel.querySelector('[data-chat-copy]');
    if (copy?.dataset.chatCopy === 'loading') copy.textContent = localize('Opening conversation…', 'Abriendo conversación…');
    if (copy?.dataset.chatCopy === 'empty') copy.textContent = localize('No messages yet. Say hello.', 'Aún no hay mensajes. Saluda.');
    if (copy?.dataset.chatCopy === 'error') copy.textContent = localize('Conversation could not be loaded. Try again.', 'No se pudo cargar la conversación. Intenta de nuevo.');
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
    mountHub(); mountMobileNav(); syncResponsiveChrome(); addEventListener('resize', syncResponsiveChrome, { passive:true }); window.addEventListener('filmscript:language-change', syncDynamicLanguage); injectProfileControls(); refreshNotifications(); connectCollaboration();
    const invitation = params.get('invitation');
    if (invitation) request('/api/invitations/accept', { method:'POST', body:JSON.stringify({ token:invitation }) }).then((result) => location.replace(`Editor%20v5.dc.html?script=${encodeURIComponent(result.membership.projectId)}`)).catch((error) => dialog('Invitation unavailable', error.message, '<div class="fs-dialog-actions"><button class="fs-action" onclick="location.href=\'App.dc.html\'">Back to projects</button></div>'));
    else if (params.get('chat')) openChatFromDeepLink();
    else scheduleReleaseNotice();
  }

  window.filmscriptPlatform = { api, clientId, openTranslation, openMembers, openActivity, openAccount, openThemes, openShare, openLocationPlan, openChatDirectory, openChat, openChatFromDeepLink, sendPresence, sendOperation:(body) => api.collaborate(body), applyTheme };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
