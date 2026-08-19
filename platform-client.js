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
  const state = { me: null, profile: null, notifications: [], presence: [], eventSource: null };

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[char]);
  const api = {
    me: () => request('/api/me'), profile: () => request('/api/me/platform-profile'),
    updateProfile: (body) => request('/api/me/platform-profile', { method:'PATCH', body:JSON.stringify(body) }),
    notifications: () => request('/api/notifications'), markRead: (id) => request(`/api/notifications${id ? `/${id}` : ''}`, { method:'PATCH' }),
    members: () => request(`/api/projects/${projectId}/members`), invite: (body) => request(`/api/projects/${projectId}/members`, { method:'POST', body:JSON.stringify(body) }),
    activity: (module) => request(`/api/projects/${projectId}/activity${module ? `?module=${encodeURIComponent(module)}` : ''}`),
    translationPreview: (id, targetLanguage) => request(`/api/scripts/${id}/translation`, { method:'POST', body:JSON.stringify({ preview:true,targetLanguage }) }),
    translate: (id, targetLanguage) => request(`/api/scripts/${id}/translation`, { method:'POST', body:JSON.stringify({ targetLanguage }) }),
    createShared: (body) => request(`/api/projects/${projectId}/shared-projects`, { method:'POST', body:JSON.stringify(body) }),
    locationPlans: () => request(`/api/projects/${projectId}/location-plans`),
    createLocationPlan: (body) => request(`/api/projects/${projectId}/location-plans`, { method:'POST', body:JSON.stringify(body) }),
    saveLocationPlan: (plan, expectedVersion) => request(`/api/projects/${projectId}/location-plans/${plan.id}`, { method:'PATCH', body:JSON.stringify({ plan, expectedVersion }) }),
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

  async function openNotifications() {
    const result = await api.notifications(); state.notifications = result.notifications;
    const content = result.notifications.length ? `<div class="fs-platform-list">${result.notifications.map((item) => `<button type="button" class="fs-notification-card" data-link="${escapeHtml(item.deepLink || '')}" data-id="${item.id}">${avatar(item.actor || { name:'FilmScript' })}<span class="fs-member-copy"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.message)}</small></span>${item.read ? '' : '<i aria-label="Unread">●</i>'}</button>`).join('')}</div><div class="fs-dialog-actions"><button class="fs-action" data-mark-all>Mark all as read</button></div>` : '<div class="fs-member-card"><span class="fs-member-copy"><strong>You are all caught up</strong><small>Project invitations and completed Lumiere work will appear here.</small></span></div>';
    const root = dialog('Activity', 'Your FilmScript notifications', content);
    root.querySelectorAll('[data-id]').forEach((button) => button.addEventListener('click', async () => { await api.markRead(button.dataset.id); if (button.dataset.link) location.href = button.dataset.link; else openNotifications(); }));
    root.querySelector('[data-mark-all]')?.addEventListener('click', async () => { await api.markRead(); openNotifications(); refreshNotifications(); });
  }

  async function openMembers() {
    const result = await api.members();
    const canManage = ['owner','co_owner','admin'].includes(result.access?.projectRole);
    const cards = result.members.map((member) => `<article class="fs-member-card">${avatar(member)}<span class="fs-member-copy"><strong>${escapeHtml(member.name || member.email || 'Pending collaborator')}</strong><small>${escapeHtml((member.cinematicRole || 'Collaborator').replaceAll('_',' '))} · ${escapeHtml(member.email || member.username || member.status)}</small></span><span class="fs-member-role">${escapeHtml(member.projectRole.replaceAll('_',' '))}</span></article>`).join('');
    const invite = canManage ? `<form class="fs-form-grid" data-invite-form style="margin-top:18px"><label class="fs-form-field" style="grid-column:1/-1"><span>Invite by email or username</span><input name="target" required autocomplete="email" placeholder="name@example.com or username"></label><label class="fs-form-field"><span>Cinematic role</span><select name="cinematicRole"><option value="writer">Writer</option><option value="director">Director</option><option value="producer">Producer</option><option value="director_of_photography">Director of Photography</option><option value="production_designer">Production Designer</option><option value="production">Production</option><option value="client">Client</option></select></label><label class="fs-form-field"><span>Project role</span><select name="projectRole"><option value="editor">Editor</option><option value="department_editor">Department Editor</option><option value="commenter">Commenter</option><option value="viewer">Viewer</option><option value="temporary_guest">Temporary Guest</option></select></label><div class="fs-financial-warning">Financial information is sensitive. Choose exactly who can access it.</div><label class="fs-form-field" style="grid-column:1/-1"><span>Budget access</span><select name="financial"><option value="none">No financial access</option><option value="full">Full Budget access</option><option value="department">Department Budget access</option></select></label><div class="fs-dialog-actions" style="grid-column:1/-1"><button class="fs-action fs-action-primary" type="submit">Invite people</button></div></form><div data-invite-result></div>` : '';
    const root = dialog('People with access', 'Project roles and permissions stay separate from filmmaking responsibilities.', `<div class="fs-platform-list">${cards}</div>${invite}`);
    root.querySelector('[data-invite-form]')?.addEventListener('submit', async (event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget); const target = String(form.get('target') || '').trim(); const financial = form.get('financial');
      const payload = { ...(target.includes('@') ? { email:target } : { username:target }), cinematicRole:form.get('cinematicRole'), projectRole:form.get('projectRole'), financialPermissions:financial === 'full' ? ['financial.view_all','financial.edit_all','financial.export'] : financial === 'department' ? ['financial.view_department'] : ['financial.no_access'] };
      try { const created = await api.invite(payload); root.querySelector('[data-invite-result]').innerHTML = `<div class="fs-member-card" style="margin-top:12px"><span class="fs-member-copy"><strong>Pending invitation</strong><small>Copy this secure link if email delivery is not configured.</small><input value="${escapeHtml(created.invitation.url)}" readonly style="width:100%;margin-top:8px"></span><button class="fs-action" data-copy>Copy invite link</button></div>`; root.querySelector('[data-copy]').onclick = () => navigator.clipboard.writeText(created.invitation.url); } catch (error) { root.querySelector('[data-invite-result]').textContent = error.message; }
    });
  }

  async function openActivity() {
    const result = await api.activity();
    dialog('Project activity', 'Meaningful changes, without cursor noise or every keystroke.', result.events.length ? `<div class="fs-platform-list">${result.events.map((item) => `<article class="fs-activity-card">${avatar(item.actor)}<span class="fs-member-copy"><strong>${escapeHtml(item.summary)}</strong><small>${escapeHtml(new Date(item.createdAt).toLocaleString())}</small></span></article>`).join('')}</div>` : '<div class="fs-member-card"><span class="fs-member-copy"><strong>No activity yet</strong><small>Important project changes will appear here.</small></span></div>');
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
  }

  function connectCollaboration() {
    if (!projectId || typeof EventSource === 'undefined') return;
    const url = new URL(resolve(`/api/projects/${projectId}/collaboration/events`), location.href); url.searchParams.set('module', params.get('view') || 'script');
    state.eventSource = new EventSource(url, { withCredentials:true });
    state.eventSource.addEventListener('connected', (event) => { state.presence = JSON.parse(event.data).presence || []; renderPresence(); });
    state.eventSource.addEventListener('presence.joined', (event) => { const person = JSON.parse(event.data); state.presence = [...state.presence.filter((item) => item.clientId !== person.clientId), person]; renderPresence(); });
    state.eventSource.addEventListener('presence.updated', (event) => { const person = JSON.parse(event.data); state.presence = [...state.presence.filter((item) => item.clientId !== person.clientId), person]; renderPresence(); });
    state.eventSource.addEventListener('presence.left', (event) => { const person = JSON.parse(event.data); state.presence = state.presence.filter((item) => item.clientId !== person.clientId); renderPresence(); });
    ['ai.job.completed','content.operation','content.conflict','comment.created'].forEach((type) => state.eventSource.addEventListener(type, (event) => { let detail={};try{detail=JSON.parse(event.data)}catch{}window.dispatchEvent(new CustomEvent(`filmscript:${type}`,{detail})) }));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) sendPresence({ type:'presence.updated' }); });
  }

  let presenceTimer = 0;
  function sendPresence(detail = {}) {
    if (!projectId || document.hidden) return;
    clearTimeout(presenceTimer); presenceTimer = setTimeout(() => request(`/api/projects/${projectId}/collaboration/presence`, { method:'POST', headers:{ 'X-FilmScript-Client-Id':clientId }, body:JSON.stringify({ type:detail.type || 'presence.updated', module:params.get('view') || 'script', ...detail }) }).catch(() => {}), detail.type === 'cursor.updated' ? 80 : 120);
  }

  function mountHub() {
    const host = document.querySelector('.v5-top-actions') || document.querySelector('.fs-app-topbar > div:last-child'); if (!host || document.querySelector('.fs-platform-hub')) return;
    const hub = document.createElement('div'); hub.className = 'fs-platform-hub';
    hub.innerHTML = `${projectId ? '<div class="fs-live-avatars" aria-label="Active collaborators"></div><button class="fs-platform-button" data-people title="People with access" aria-label="People with access">People</button><button class="fs-platform-button" data-location title="Location Plan" aria-label="Location Plan">Plan</button><button class="fs-platform-button" data-activity title="Project activity" aria-label="Project activity">Activity</button><button class="fs-platform-button" data-share title="Create Shared Project" aria-label="Create Shared Project">Share</button>' : ''}<button class="fs-platform-button" data-bell title="Notifications" aria-label="Notifications"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M10 21h4"></path></svg><span class="fs-notification-badge" hidden></span></button>`;
    host.prepend(hub); hub.querySelector('[data-bell]').onclick = openNotifications; hub.querySelector('[data-people]')?.addEventListener('click', openMembers); hub.querySelector('[data-location]')?.addEventListener('click', openLocationPlan); hub.querySelector('[data-activity]')?.addEventListener('click', openActivity); hub.querySelector('[data-share]')?.addEventListener('click', openShare); renderPresence();
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
    const invitation = params.get('invitation'); if (invitation) request('/api/invitations/accept', { method:'POST', body:JSON.stringify({ token:invitation }) }).then((result) => location.replace(`Editor%20v5.dc.html?script=${encodeURIComponent(result.membership.projectId)}`)).catch((error) => dialog('Invitation unavailable', error.message, '<div class="fs-dialog-actions"><button class="fs-action" onclick="location.href=\'App.dc.html\'">Back to projects</button></div>'));
  }

  window.filmscriptPlatform = { api, clientId, openTranslation, openMembers, openActivity, openThemes, openShare, openLocationPlan, sendPresence, applyTheme };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
