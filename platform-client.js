(() => {
  const resolve = (path) => window.filmscriptApiUrl ? window.filmscriptApiUrl(path) : path;
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
  const state = { me: null, profile: null, notifications: [], presence: [], eventSource: null, commentContext: null, localContext: null };
  let lastUserActivityAt = Date.now();
  const currentModule = () => ({ editor:'script', shotlist:'shot_list', 'shot-list':'shot_list' }[new URLSearchParams(location.search).get('view') || 'script'] || new URLSearchParams(location.search).get('view') || 'script');

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[char]);
  const api = {
    me: () => request('/api/me'), profile: () => request('/api/me/platform-profile'),
    updateProfile: (body) => request('/api/me/platform-profile', { method:'PATCH', body:JSON.stringify(body) }),
    notifications: () => request('/api/notifications'), markRead: (id, read = true) => request(`/api/notifications${id ? `/${id}` : ''}`, { method:'PATCH', body:JSON.stringify({ read }) }),
    members: () => request(`/api/projects/${projectId}/members`), invite: (body) => request(`/api/projects/${projectId}/members`, { method:'POST', body:JSON.stringify(body) }),
    updateMember: (id, body) => request(`/api/projects/${projectId}/members/${id}`, { method:'PATCH', body:JSON.stringify(body) }),
    transferOwnership: (membershipId) => request(`/api/projects/${projectId}/ownership/transfer`, { method:'POST', body:JSON.stringify({ membershipId }) }),
    updateInvitation: (id, body) => request(`/api/projects/${projectId}/invitations/${id}`, { method:'PATCH', body:JSON.stringify(body) }),
    revokeInvitation: (id) => request(`/api/projects/${projectId}/invitations/${id}`, { method:'DELETE' }),
    invitationLink: (id, resend = false) => request(`/api/projects/${projectId}/invitations/${id}/${resend ? 'resend' : 'link'}`, { method:'POST' }),
    activity: (module) => request(`/api/projects/${projectId}/activity${module ? `?module=${encodeURIComponent(module)}` : ''}`),
    comments: (module, entityId) => request(`/api/projects/${projectId}/comments?module=${encodeURIComponent(module)}${entityId ? `&entityId=${encodeURIComponent(entityId)}` : ''}`),
    createComment: (body) => request(`/api/projects/${projectId}/comments`, { method:'POST', headers:{ 'X-FilmScript-Client-Id':clientId }, body:JSON.stringify(body) }),
    updateComment: (id, resolved) => request(`/api/projects/${projectId}/comments/${id}`, { method:'PATCH', headers:{ 'X-FilmScript-Client-Id':clientId }, body:JSON.stringify({ resolved }) }),
    translationPreview: (id, targetLanguage) => request(`/api/scripts/${id}/translation`, { method:'POST', body:JSON.stringify({ preview:true,targetLanguage }) }),
    translate: (id, targetLanguage) => request(`/api/scripts/${id}/translation`, { method:'POST', body:JSON.stringify({ targetLanguage }) }),
    createShared: (body) => request(`/api/projects/${projectId}/shared-projects`, { method:'POST', body:JSON.stringify(body) }),
    locationPlans: () => request(`/api/projects/${projectId}/location-plans`),
    createLocationPlan: (body) => request(`/api/projects/${projectId}/location-plans`, { method:'POST', body:JSON.stringify(body) }),
    saveLocationPlan: (plan, expectedVersion) => request(`/api/projects/${projectId}/location-plans/${plan.id}`, { method:'PATCH', body:JSON.stringify({ plan, expectedVersion }) }),
    collaborate: (body) => request(`/api/projects/${projectId}/collaboration/operations`, { method:'POST', headers:{ 'X-FilmScript-Client-Id':clientId }, body:JSON.stringify(body) }),
  };

  function applyTheme(theme, persist = false) {
    const selected = themes.some(([id]) => id === theme) ? theme : 'filmscript';
    document.documentElement.dataset.filmscriptTheme = selected;
    if (selected === 'dark') document.documentElement.setAttribute('data-filmscript-dark', ''); else document.documentElement.removeAttribute('data-filmscript-dark');
    try { localStorage.setItem('filmscript_theme_v2', selected); } catch {}
    if (persist) api.updateProfile({ theme:selected }).catch(() => {});
    window.dispatchEvent(new CustomEvent('filmscript:theme-changed', { detail:{ theme:selected, dark:selected === 'dark' } }));
  }

  function closeDialog() { document.querySelector('.fs-platform-scrim')?.remove(); }
  function dialog(title, subtitle, content, className = '') {
    closeDialog();
    document.querySelectorAll('details[open]').forEach((details) => details.removeAttribute('open'));
    const scrim = document.createElement('div'); scrim.className = 'fs-platform-scrim';
    scrim.innerHTML = `<section class="fs-platform-dialog ${className}" role="dialog" aria-modal="true" aria-labelledby="fs-platform-title"><header class="fs-platform-head"><div><h2 id="fs-platform-title">${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div><button class="fs-platform-close" type="button" aria-label="Close">×</button></header><div class="fs-platform-body">${content}</div></section>`;
    scrim.addEventListener('click', (event) => { if (event.target === scrim || event.target.closest('.fs-platform-close')) closeDialog(); });
    document.body.appendChild(scrim); scrim.querySelector('button,input,select')?.focus();
    const onKey = (event) => { if (event.key === 'Escape') { closeDialog(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey); return scrim;
  }

  function avatar(person, className = 'fs-member-avatar') {
    const name = person?.name || person?.email || 'Collaborator'; const initial = name.trim().charAt(0).toUpperCase() || 'C';
    return `<span class="${className}"${person?.color ? ` style="--collaborator-color:${escapeHtml(person.color)}"` : ''}>${person?.picture ? `<img src="${escapeHtml(person.picture)}" alt="">` : escapeHtml(initial)}</span>`;
  }

  const relativeTime = (value) => {
    const seconds = Math.max(0, Math.round((Date.now() - Date.parse(value || 0)) / 1000));
    if (seconds < 60) return 'Now'; if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`; if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`; if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return new Date(value).toLocaleDateString(undefined, { month:'short', day:'numeric', year:new Date(value).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  };

  const notificationTypeLabel = (type) => ({ project_invitation:'Invitation', mention:'Mention', comment_reply:'Reply', permission_changed:'Access', removed_from_project:'Access', ownership_transfer:'Ownership', analysis_completed:'Analysis', breakdown_completed:'Breakdown', translation_completed:'Translation', shot_list_generation_completed:'Shot List' }[type] || 'Project');

  async function openNotifications() {
    const result = await api.notifications(); state.notifications = result.notifications;
    const content = result.notifications.length ? `<div class="fs-platform-list fs-notification-list">${result.notifications.map((item) => `<article class="fs-notification-card${item.read ? '' : ' is-unread'}" data-notification-id="${item.id}"><button type="button" class="fs-notification-main" data-link="${escapeHtml(item.deepLink || '')}" data-id="${item.id}">${avatar(item.actor || { name:'FilmScript' })}<span class="fs-member-copy"><span class="fs-notification-meta">${escapeHtml(notificationTypeLabel(item.type))}${item.count > 1 ? ` · ${item.count} updates` : ''} · ${escapeHtml(relativeTime(item.updatedAt))}</span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.message)}</small></span>${item.read ? '' : '<i aria-label="Unread">●</i>'}</button><button type="button" class="fs-notification-read" data-toggle-read="${item.id}" data-read="${item.read ? 'true' : 'false'}">Mark ${item.read ? 'unread' : 'read'}</button></article>`).join('')}</div><div class="fs-dialog-actions"><button class="fs-action" data-mark-all ${result.unreadCount ? '' : 'disabled'}>Mark all as read</button></div>` : '<div class="fs-member-card"><span class="fs-member-copy"><strong>You are all caught up</strong><small>Invitations, mentions, replies and important project changes will appear here.</small></span></div>';
    const root = dialog('Notifications', result.unreadCount ? `${result.unreadCount} unread` : 'You are up to date', content, 'fs-notifications-dialog');
    root.querySelectorAll('[data-id]').forEach((button) => button.addEventListener('click', async () => { await api.markRead(button.dataset.id, true); if (button.dataset.link) location.href = button.dataset.link; else openNotifications(); }));
    root.querySelectorAll('[data-toggle-read]').forEach((button) => button.addEventListener('click', async () => { await api.markRead(button.dataset.toggleRead, button.dataset.read !== 'true'); await openNotifications(); refreshNotifications(); }));
    root.querySelector('[data-mark-all]')?.addEventListener('click', async () => { await api.markRead(); openNotifications(); refreshNotifications(); });
  }

  const accessModules = ['script','analysis','breakdown','shot_list','stripboard','calendar','budget','canvas','location_plan','imagine','files','project_settings','members','exports','lumiere'];
  const cinematicRoles = ['producer','director','writer','assistant_director','director_of_photography','camera_department','gaffer','grip','production_designer','art_department','sound','hair_and_makeup','wardrobe','production','client','talent'];
  const roleLabels = { owner:'Owner', co_owner:'Co owner', admin:'Admin', editor:'Editor', department_editor:'Department Editor', commenter:'Commenter', viewer:'Viewer', temporary_guest:'Temporary Guest' };
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
    const pending = (result.invitations || []).filter((invitation) => invitation.status !== 'accepted').map((invitation) => `<article class="fs-invitation-row"><span class="fs-invite-mark" aria-hidden="true"></span><span class="fs-member-copy"><strong>${escapeHtml(invitation.invitedEmail || invitation.invitedUsername || 'Secure guest link')}</strong><small>${escapeHtml(label(invitation.cinematicRole || 'Collaborator'))} · ${escapeHtml(roleLabels[invitation.projectRole] || label(invitation.projectRole))}</small><span class="fs-access-summary">${escapeHtml((invitation.permissionSummary || []).join(', ') || 'No module access')}</span></span><span class="fs-finance-summary">${escapeHtml(invitation.financialSummary)}</span><span class="fs-invite-expiry"><strong>${escapeHtml(label(invitation.status))}</strong><small>${invitation.expiresAt ? `Expires ${escapeHtml(new Date(invitation.expiresAt).toLocaleDateString())}` : 'No expiration'}</small></span>${canManage ? `<details class="fs-context"><summary aria-label="Invitation actions">•••</summary><div class="fs-context-menu"><button data-copy-invite="${invitation.id}">Copy invitation link</button>${result.emailDelivery === 'configured' ? `<button data-resend-invite="${invitation.id}">Resend invitation</button>` : ''}<button data-edit-invite="${invitation.id}">Edit access</button><button class="fs-danger-text" data-revoke-invite="${invitation.id}">Revoke invitation</button></div></details>` : ''}</article>`).join('');
    const content = `<div class="fs-dashboard-toolbar"><div><p class="fs-eyebrow">PROJECT SETTINGS</p><h3>People</h3></div>${canManage ? '<button class="fs-action fs-action-primary" data-new-invite>Invite people</button>' : ''}</div><section class="fs-people-section">${people || '<div class="fs-empty-access"><strong>No collaborators yet</strong><p>Invite someone when you are ready to share the project.</p></div>'}</section><section class="fs-pending-section"><div class="fs-section-title"><h3>Pending Invitations</h3><span>${(result.invitations || []).filter((item) => item.status === 'pending').length}</span></div>${pending || '<div class="fs-empty-access"><strong>No pending invitations</strong><p>New invitations will appear here until they are accepted.</p></div>'}</section>`;
    const root = dialog('People & Access', 'Manage project roles, module permissions, and sensitive financial access.', content, 'fs-people-dialog');
    root.querySelector('[data-new-invite]')?.addEventListener('click', () => openAccessEditor({ inviting:true, dashboard:result }));
    root.querySelectorAll('[data-edit-member]').forEach((button) => button.onclick = () => openAccessEditor({ member:result.members.find((item) => item.id === button.dataset.editMember), dashboard:result }));
    root.querySelectorAll('[data-edit-invite]').forEach((button) => button.onclick = () => openAccessEditor({ invitation:result.invitations.find((item) => item.id === button.dataset.editInvite), dashboard:result }));
    root.querySelectorAll('[data-member-role]').forEach((button) => button.onclick = async () => { const [id,projectRole] = button.dataset.memberRole.split(':'); await api.updateMember(id,{projectRole}); openMembers(); });
    root.querySelectorAll('[data-member-status]').forEach((button) => button.onclick = async () => { const [id,status] = button.dataset.memberStatus.split(':'); if (status === 'removed' && !confirm('Remove this person from the project now?')) return; await api.updateMember(id,{status}); openMembers(); });
    root.querySelectorAll('[data-transfer]').forEach((button) => button.onclick = async () => { if (!confirm('Transfer billing ownership to this person?')) return; await api.transferOwnership(button.dataset.transfer); openMembers(); });
    root.querySelectorAll('[data-copy-invite]').forEach((button) => button.onclick = async () => { await copyInvitationLink(button.dataset.copyInvite); button.textContent = 'Copied'; });
    root.querySelectorAll('[data-resend-invite]').forEach((button) => button.onclick = async () => { await api.invitationLink(button.dataset.resendInvite,true); button.textContent = 'Sent'; });
    root.querySelectorAll('[data-revoke-invite]').forEach((button) => button.onclick = async () => { if (!confirm('Revoke this invitation now?')) return; await api.revokeInvitation(button.dataset.revokeInvite); openMembers(); });
    if (!canManageFinancial) root.querySelectorAll('[name="financial"]').forEach((select) => select.disabled = true);
  }

  const moduleLabel = (module) => ({ script:'Script Editor', breakdown:'Breakdown', shot_list:'Shot List', canvas:'Canvas', budget:'Budget', analysis:'Analysis', stripboard:'Stripboard', calendar:'Calendar', imagine:'Imagine' }[module] || label(module));

  function currentCommentAnchor(module = currentModule()) {
    const queryEntity = new URLSearchParams(location.search).get('entity');
    let node = document.activeElement?.closest?.('[data-shot-id],[data-scene-id],[data-block-id]');
    if (!node) node = window.getSelection?.()?.anchorNode?.parentElement?.closest?.('[data-shot-id],[data-scene-id],[data-block-id]');
    const entityId = queryEntity || node?.dataset?.shotId || node?.dataset?.sceneId || node?.dataset?.blockId || (state.localContext?.module === module ? state.localContext.selectedObjectId || state.localContext.sceneId || state.localContext.selection?.blockId : null) || null;
    const entityType = module === 'script' ? 'script_block' : module === 'breakdown' ? 'breakdown_card' : module === 'shot_list' ? 'shot_list_item' : module === 'canvas' ? 'canvas_object' : 'project';
    return { module, entityId, entityType };
  }

  async function openActivity(module = null) {
    const selectedModule = module || null; const result = await api.activity(selectedModule);
    const title = selectedModule && ['script','canvas'].includes(selectedModule) ? 'Version History' : selectedModule ? `${moduleLabel(selectedModule)} Activity` : 'Project Activity';
    const cards = result.events.map((item) => `<article class="fs-activity-card" data-activity-id="${item.id}">${avatar(item.actor)}<span class="fs-member-copy"><span class="fs-activity-meta">${escapeHtml(item.actor?.name || 'FilmScript')} · ${escapeHtml(moduleLabel(item.module))} · ${escapeHtml(relativeTime(item.updatedAt || item.createdAt))}</span><strong>${escapeHtml(item.summary)}</strong>${item.count > 1 ? `<small>Grouped from ${item.count} related changes</small>` : ''}</span></article>`).join('');
    dialog(title, 'Meaningful project changes—never cursor movement or individual keystrokes.', cards ? `<div class="fs-platform-list fs-activity-list">${cards}</div>` : '<div class="fs-member-card"><span class="fs-member-copy"><strong>No activity yet</strong><small>Important changes in this area will appear here.</small></span></div>', 'fs-activity-dialog');
  }

  async function openComments(context = currentCommentAnchor()) {
    if (!projectId) return;
    state.commentContext = { ...context };
    const [result, peopleResult] = await Promise.all([api.comments(context.module, context.entityId), api.members().catch(() => ({ members:[] }))]);
    const comments = result.comments || []; const replies = new Map();
    comments.filter((item) => item.parentCommentId).forEach((item) => { if (!replies.has(item.parentCommentId)) replies.set(item.parentCommentId, []); replies.get(item.parentCommentId).push(item); });
    const highlighted = new URLSearchParams(location.search).get('comment');
    const commentCard = (item, reply = false) => `<article class="fs-comment-card${reply ? ' is-reply' : ''}${item.resolved ? ' is-resolved' : ''}${highlighted === item.id ? ' is-highlighted' : ''}" data-comment-id="${item.id}">${avatar(item.author)}<div class="fs-comment-content"><div class="fs-comment-meta"><strong>${escapeHtml(item.author?.name || 'Collaborator')}</strong><span>${escapeHtml(relativeTime(item.updatedAt || item.createdAt))}</span>${item.resolved ? '<span class="fs-comment-state">Resolved</span>' : ''}</div><p>${escapeHtml(item.body)}</p><div class="fs-comment-actions">${reply ? '' : `<button type="button" data-reply-to="${item.id}">Reply</button>`}<button type="button" data-comment-state="${item.id}" data-resolved="${item.resolved ? 'true' : 'false'}">${item.resolved ? 'Reopen' : 'Resolve'}</button></div>${reply ? '' : `<div class="fs-comment-replies">${(replies.get(item.id) || []).map((entry) => commentCard(entry, true)).join('')}</div><form class="fs-comment-reply-form" data-reply-form="${item.id}" hidden><textarea name="body" maxlength="5000" placeholder="Write a reply…" required></textarea><button class="fs-action fs-action-primary">Reply</button></form>`}</div></article>`;
    const roots = comments.filter((item) => !item.parentCommentId);
    const members = (peopleResult.members || []).filter((member) => member.username && member.userId !== state.me?.id);
    const mentionHints = members.length ? `<div class="fs-mention-hints"><span>Mention:</span>${members.slice(0,8).map((member) => `<button type="button" data-mention="${escapeHtml(member.username)}">@${escapeHtml(member.username)}</button>`).join('')}</div>` : '';
    const anchorCopy = context.entityId ? `Anchored to ${context.entityType.replaceAll('_',' ')}` : `Project-level ${moduleLabel(context.module)} discussion`;
    const root = dialog('Comments', anchorCopy, `<div class="fs-comment-thread">${roots.map((item) => commentCard(item)).join('') || '<div class="fs-member-card"><span class="fs-member-copy"><strong>No comments yet</strong><small>Start a focused discussion here.</small></span></div>'}</div><form class="fs-comment-compose" data-comment-form><textarea name="body" maxlength="5000" placeholder="Add a comment or @mention…" required></textarea>${mentionHints}<div class="fs-dialog-actions"><button class="fs-action fs-action-primary">Comment</button></div></form>`, 'fs-comments-dialog');
    root.querySelectorAll('[data-reply-to]').forEach((button) => button.onclick = () => { const form = root.querySelector(`[data-reply-form="${CSS.escape(button.dataset.replyTo)}"]`); form.hidden = !form.hidden; if (!form.hidden) form.querySelector('textarea').focus(); });
    root.querySelectorAll('[data-comment-state]').forEach((button) => button.onclick = async () => { await api.updateComment(button.dataset.commentState, button.dataset.resolved !== 'true'); openComments(context); });
    root.querySelectorAll('[data-reply-form]').forEach((form) => form.onsubmit = async (event) => { event.preventDefault(); const body = new FormData(form).get('body'); await api.createComment({ ...context, parentCommentId:form.dataset.replyForm, body }); openComments(context); });
    const compose = root.querySelector('[data-comment-form]'); compose.onsubmit = async (event) => { event.preventDefault(); const body = new FormData(compose).get('body'); await api.createComment({ ...context, body }); openComments(context); };
    root.querySelectorAll('[data-mention]').forEach((button) => button.onclick = () => { const input = compose.querySelector('textarea'); const token = `@${button.dataset.mention} `; input.setRangeText(token, input.selectionStart, input.selectionEnd, 'end'); input.focus(); });
  }

  function openThemes() {
    const selected = document.documentElement.dataset.filmscriptTheme || 'filmscript';
    const root = dialog('Interface theme', 'Your theme follows your FilmScript account on every device.', `<div class="fs-theme-grid">${themes.map(([id,label,color]) => `<button class="fs-theme-swatch" style="--swatch:${color}" data-theme="${id}" aria-pressed="${selected === id}">${label}</button>`).join('')}</div><div class="fs-dialog-actions"><button class="fs-action" data-photo>Change profile photo</button></div>`);
    root.querySelectorAll('[data-theme]').forEach((button) => button.addEventListener('click', () => { applyTheme(button.dataset.theme, true); root.querySelectorAll('[data-theme]').forEach((item) => item.setAttribute('aria-pressed', String(item === button))); }));
    root.querySelector('[data-photo]').onclick = openAvatarEditor;
  }

  function openAvatarEditor() {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/png,image/jpeg,image/webp'; input.click();
    input.onchange = () => {
      const file = input.files?.[0]; if (!file || file.size > 8 * 1024 * 1024) return;
      const image = new Image(); image.onload = () => {
        let zoom = 1; let offsetX = 0; let offsetY = 0;
        const root = dialog('Profile photo', 'Zoom and reposition the circular crop before saving.', `<div class="fs-avatar-editor"><div class="fs-avatar-preview"><canvas width="512" height="512"></canvas></div><div><label class="fs-form-field"><span>Zoom</span><input type="range" min="1" max="3" step=".01" value="1" data-zoom></label><p style="color:var(--text-secondary)">Drag the preview to reposition your image.</p><div class="fs-dialog-actions"><button class="fs-action fs-action-primary" data-save>Save photo</button></div></div></div>`);
        const canvas = root.querySelector('canvas'); const context = canvas.getContext('2d'); let dragging = false; let previous = null;
        const draw = () => { const base = Math.max(512 / image.width, 512 / image.height) * zoom; const width = image.width * base; const height = image.height * base; context.clearRect(0,0,512,512); context.drawImage(image, (512-width)/2+offsetX, (512-height)/2+offsetY, width, height); };
        draw(); root.querySelector('[data-zoom]').oninput = (event) => { zoom = Number(event.target.value); draw(); };
        canvas.onpointerdown = (event) => { dragging = true; previous = event; canvas.setPointerCapture(event.pointerId); };
        canvas.onpointermove = (event) => { if (!dragging) return; offsetX += event.clientX - previous.clientX; offsetY += event.clientY - previous.clientY; previous = event; draw(); };
        canvas.onpointerup = () => { dragging = false; };
        root.querySelector('[data-save]').onclick = () => canvas.toBlob(async (blob) => { if (!blob) return; const result = await request('/api/me/avatar', { method:'POST', body:blob, headers:{ 'Content-Type':'image/webp' } }); document.querySelectorAll('[data-testid="account-avatar"]').forEach((avatarEl) => { avatarEl.style.backgroundImage = `url(${resolve(result.avatarUrl)})`; avatarEl.style.backgroundSize = 'cover'; avatarEl.textContent = ''; }); closeDialog(); }, 'image/webp', .86);
      }; image.src = URL.createObjectURL(file);
    };
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
    const unique = [...new Map(state.presence.map((person) => [person.userId, person])).values()].slice(0,5);
    container.innerHTML = unique.map((person) => `<button class="fs-live-avatar" style="--collaborator-color:${escapeHtml(person.color)}" title="${escapeHtml(person.name)} · ${escapeHtml(person.module || 'Project')} · ${escapeHtml(person.state || 'active')}">${person.picture ? `<img src="${escapeHtml(person.picture)}" alt="${escapeHtml(person.name)}">` : escapeHtml(person.name?.charAt(0) || 'C')}</button>`).join('');
    document.querySelectorAll('[data-collaborator-active]').forEach((node) => { node.removeAttribute('data-collaborator-active'); node.style.removeProperty('--collaborator-color'); });
    for (const person of state.presence) { if (person.clientId === clientId || person.state === 'disconnected') continue; const selector = person.module === 'breakdown' && person.sceneId ? `[data-scene-id="${CSS.escape(person.sceneId)}"]` : person.module === 'shot_list' && person.selectedObjectId ? `[data-shot-id="${CSS.escape(person.selectedObjectId)}"]` : ''; if (selector) document.querySelectorAll(selector).forEach((node) => { node.dataset.collaboratorActive = person.name; node.style.setProperty('--collaborator-color',person.color); }); }
    renderRemoteCursors();
  }

  function renderRemoteCursors() {
    document.querySelectorAll('.fs-remote-caret,.fs-remote-selection').forEach((node) => node.remove());
    for (const person of state.presence) {
      if (person.clientId === clientId || person.module !== 'script' || person.state === 'disconnected' || !person.selection?.blockId) continue;
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
    ['ai.job.completed','content.operation','content.conflict','comment.created','comment.updated','activity.updated','notification.updated','script.crdt','canvas.drag'].forEach((type) => state.eventSource.addEventListener(type, (event) => { let detail={};try{detail=JSON.parse(event.data)}catch{}window.dispatchEvent(new CustomEvent(`filmscript:${type}`,{detail})); if (type === 'notification.updated') refreshNotifications(); if ((type === 'comment.created' || type === 'comment.updated') && state.commentContext && document.querySelector('.fs-comments-dialog')) { clearTimeout(state.commentRefreshTimer); state.commentRefreshTimer = setTimeout(() => openComments(state.commentContext), 180); } }));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) sendPresence({ type:'presence.updated' }); });
    const activity = () => { const wasIdle = Date.now() - lastUserActivityAt > 90_000; lastUserActivityAt = Date.now(); if (wasIdle) sendPresence({ type:'presence.updated' }); };
    ['pointerdown','keydown','wheel'].forEach((type) => document.addEventListener(type, activity, { passive:true }));
    const heartbeat = setInterval(() => { if (!document.hidden && Date.now() - lastUserActivityAt < 90_000) sendPresence({ type:'presence.updated' }); }, 16_000); heartbeat.unref?.();
    addEventListener('scroll', renderRemoteCursors, { passive:true, capture:true }); addEventListener('resize', renderRemoteCursors, { passive:true });
  }

  let presenceTimer = 0;
  function sendPresence(detail = {}) {
    if (!projectId || document.hidden) return;
    state.localContext = { ...(state.localContext || {}), ...detail, module:detail.module || currentModule() };
    clearTimeout(presenceTimer); presenceTimer = setTimeout(() => request(`/api/projects/${projectId}/collaboration/presence`, { method:'POST', headers:{ 'X-FilmScript-Client-Id':clientId }, body:JSON.stringify({ type:detail.type || 'presence.updated', module:currentModule(), ...detail }) }).catch(() => {}), detail.type === 'cursor.updated' ? 80 : 120);
  }

  function mountHub() {
    const host = document.querySelector('.v5-top-actions') || document.querySelector('.fs-app-topbar > div:last-child'); if (!host || document.querySelector('.fs-platform-hub')) return;
    const hub = document.createElement('div'); hub.className = 'fs-platform-hub';
    hub.innerHTML = `${projectId ? '<span class="fs-live-avatars" aria-label="Active collaborators"></span><button class="fs-platform-button fs-manage-people" data-people title="People and access" aria-label="People and access"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 19v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V19"></path><circle cx="9.5" cy="7" r="3"></circle><path d="M17 5.2a3 3 0 0 1 0 5.6M21 19v-1.5a4 4 0 0 0-3-3.87"></path></svg></button><details class="fs-module-menu"><summary class="fs-platform-button" title="Module actions" aria-label="Module actions">•••</summary><div class="fs-module-menu-pop"><button type="button" data-module-history></button><button type="button" data-module-comments>Comments</button></div></details>' : ''}<button class="fs-platform-button" data-bell title="Notifications" aria-label="Notifications"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M10 21h4"></path></svg><span class="fs-notification-badge" hidden></span></button>`;
    host.prepend(hub); hub.querySelector('[data-bell]').onclick = openNotifications; hub.querySelector('[data-people]')?.addEventListener('click', openMembers);
    const menu = hub.querySelector('.fs-module-menu'); menu?.addEventListener('toggle', () => { if (!menu.open) return; const module = currentModule(); menu.querySelector('[data-module-history]').textContent = ['script','canvas'].includes(module) ? 'Version History' : 'Activity'; });
    hub.querySelector('[data-module-history]')?.addEventListener('click', () => { menu.removeAttribute('open'); openActivity(currentModule()); });
    hub.querySelector('[data-module-comments]')?.addEventListener('click', () => { menu.removeAttribute('open'); openComments(currentCommentAnchor()); });
  }

  function mountMobileNav() {
    if (document.querySelector('.fs-mobile-global')) return;
    const globalNav = document.createElement('nav'); globalNav.className = 'fs-mobile-nav fs-mobile-global'; globalNav.setAttribute('aria-label', 'FilmScript navigation');
    globalNav.innerHTML = `<a href="App.dc.html"${projectId ? '' : ' aria-current="page"'}>Home</a><a href="App.dc.html">Projects</a><a href="App.dc.html?lumiere=1">Lumiere</a><button data-activity>Activity</button><button data-profile>Profile</button>`;
    document.body.appendChild(globalNav); globalNav.querySelector('[data-activity]').onclick = openNotifications; globalNav.querySelector('[data-profile]').onclick = openThemes;
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
    const observer = new MutationObserver(() => document.querySelectorAll('[data-filmscript-profile-panel],[data-testid="account-details-panel"]').forEach((panel) => { if (panel.querySelector('[data-platform-theme]')) return; const button = document.createElement('button'); button.type = 'button'; button.className = 'fs-action'; button.dataset.platformTheme = '1'; button.style.cssText = 'width:100%;margin-top:8px'; button.textContent = 'Theme and profile photo'; button.onclick = openThemes; panel.appendChild(button); }));
    observer.observe(document.documentElement, { childList:true, subtree:true });
  }

  async function init() {
    try { state.me = await api.me(); const local = localStorage.getItem('filmscript_theme_v2'); applyTheme(state.me.theme || local || 'filmscript'); } catch { applyTheme(localStorage.getItem('filmscript_theme_v2') || 'filmscript'); }
    mountHub(); mountMobileNav(); syncResponsiveChrome(); addEventListener('resize', syncResponsiveChrome, { passive:true }); injectProfileControls(); refreshNotifications(); connectCollaboration();
    document.addEventListener('pointerdown', (event) => { const entity = event.target?.closest?.('[data-shot-id],[data-scene-id],[data-block-id]'); if (!entity) return; state.localContext = { module:currentModule(), selectedObjectId:entity.dataset.shotId || entity.dataset.sceneId || entity.dataset.blockId || null, sceneId:entity.dataset.sceneId || null, selection:{ blockId:entity.dataset.blockId || null } }; }, { passive:true, capture:true });
    const invitation = params.get('invitation'); if (invitation) request('/api/invitations/accept', { method:'POST', body:JSON.stringify({ token:invitation }) }).then((result) => location.replace(`Editor%20v5.dc.html?script=${encodeURIComponent(result.membership.projectId)}`)).catch((error) => dialog('Invitation unavailable', error.message, '<div class="fs-dialog-actions"><button class="fs-action" onclick="location.href=\'App.dc.html\'">Back to projects</button></div>'));
    if (params.get('comment') && projectId) openComments(currentCommentAnchor()).catch(() => {});
  }

  window.addEventListener('filmscript:open-comments', (event) => openComments(event.detail || currentCommentAnchor()).catch(() => {}));
  window.filmscriptPlatform = { api, clientId, openTranslation, openMembers, openActivity, openComments, openNotifications, openThemes, openShare, openLocationPlan, sendPresence, sendOperation:(body) => api.collaborate(body), applyTheme };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
