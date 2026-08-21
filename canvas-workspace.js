(function () {
  const STYLE = `
    :host{--fs-font-text:"SF Pro Text",-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;--fs-font-display:"SF Pro Display","SF Pro Text",-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif}
    :host(.filmscript-theme-transition),:host(.filmscript-theme-transition) *{transition-property:color,background-color,border-color,box-shadow,opacity,fill,stroke,outline-color!important;transition-duration:240ms!important;transition-timing-function:cubic-bezier(.22,.7,.25,1)!important}:host(.filmscript-theme-fading){opacity:.72}@media(prefers-reduced-motion:reduce){:host(.filmscript-theme-transition),:host(.filmscript-theme-transition) *{transition-duration:.01ms!important}:host(.filmscript-theme-fading){opacity:1!important}}
    :host,:host *{font-family:var(--fs-font-text)!important}
    :host h1,:host h2,:host h3,:host h4,:host h5,:host h6{font-family:var(--fs-font-display)!important}:host h1,:host h2{font-weight:900!important}:host h3{font-weight:800!important}
    :host{display:block;min-height:560px;color:var(--ink,#2C2C2A);font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;--cv-accent:var(--accent,#BA7517);--cv-accent-soft:var(--accent-soft,rgba(186,117,23,.11));--cv-bg:var(--bg,#F5F0E8);--cv-surface:var(--surface,#FFFEF9);--cv-ink:var(--ink,#2C2C2A);--cv-muted:var(--muted,#888780);--cv-hair:var(--hair,#E7E4DA);--cv-soft:var(--soft,#EFEBE1)}
    /* The workspace is in a Shadow DOM, so it must explicitly follow the
       document theme. This keeps the Imagine preview and its glass layers
       in the same mode as the gallery behind them. */
    :host-context(html[data-filmscript-theme="dark"]){--cv-bg:#1D1D1B;--cv-surface:#262624;--cv-ink:#ECEAE2;--cv-muted:#96948B;--cv-hair:#3A3A36;--cv-soft:#31312E}
    :host-context(html[data-filmscript-theme="light"]){--cv-bg:#F5F0E8;--cv-surface:#FFFEF9;--cv-ink:#2C2C2A;--cv-muted:#888780;--cv-hair:#E7E4DA;--cv-soft:#EFEBE1}
    *{box-sizing:border-box}button,input,textarea,select{font:inherit}button{color:inherit}.cv-root{min-height:560px;animation:cv-in .2s cubic-bezier(.2,.8,.2,1) both}.cv-page{width:min(1180px,calc(100% - 72px));margin:0 auto;padding:38px 0 78px}.cv-loading{display:grid;place-items:center;min-height:520px;color:var(--cv-muted);font-size:13px}.cv-loading span{width:22px;height:22px;border:2px solid var(--cv-hair);border-top-color:var(--cv-accent);border-radius:50%;animation:cv-spin .7s linear infinite;margin-bottom:12px}.cv-load-stack{display:grid;justify-items:center}.cv-top{display:flex;align-items:center;gap:18px;padding:0 0 24px;border-bottom:1px solid var(--cv-hair)}.cv-title{margin-right:auto}.cv-eyebrow{font-size:9.5px;line-height:1;text-transform:uppercase;letter-spacing:1.5px;font-weight:750;color:var(--cv-accent)}.cv-title h1{margin:8px 0 0;font-size:30px;line-height:1;letter-spacing:-.8px}.cv-tabs{display:flex;gap:3px;padding:3px;background:color-mix(in srgb,var(--cv-soft) 72%,transparent);border-radius:11px}.cv-tab{border:0;background:transparent;border-radius:8px;padding:8px 12px;font-size:11.5px;font-weight:600;cursor:pointer;transition:background .15s ease,color .15s ease,transform .12s ease}.cv-tab:hover{background:var(--cv-surface)}.cv-tab[aria-current=true]{color:var(--cv-accent);background:var(--cv-surface);box-shadow:0 1px 5px rgba(30,28,24,.07)}.cv-icon-btn{width:34px;height:34px;display:grid;place-items:center;border:1px solid var(--cv-hair);background:var(--cv-surface);border-radius:9px 10px 8px 9px;cursor:pointer;transition:transform .13s ease,border-color .15s ease,background .15s ease}.cv-icon-btn:hover{border-color:var(--cv-muted);transform:translateY(-1px)}.cv-icon-btn svg{width:16px;height:16px}.cv-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin:32px 0 18px}.cv-heading h2{margin:0;font-size:21px;letter-spacing:-.35px}.cv-heading p{max-width:580px;margin:7px 0 0;color:var(--cv-muted);font-size:12.5px;line-height:1.5}.cv-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.cv-btn{min-height:36px;padding:0 13px;border:1px solid var(--cv-hair);border-radius:9px 10px 8px 9px;background:var(--cv-surface);color:var(--cv-ink);font-size:11.5px;font-weight:650;cursor:pointer;transition:transform .12s ease,border-color .15s ease,background .15s ease,box-shadow .15s ease}.cv-btn:hover{border-color:var(--cv-muted);transform:translateY(-1px);box-shadow:0 5px 14px rgba(30,28,24,.07)}.cv-btn:active{transform:scale(.98)}.cv-btn.primary{background:var(--cv-ink);border-color:var(--cv-ink);color:var(--cv-surface)}.cv-btn.accent{background:var(--cv-accent);border-color:var(--cv-accent);color:#181716}.cv-btn.danger{color:#B24C47;border-color:color-mix(in srgb,#B24C47 45%,var(--cv-hair))}.cv-btn:disabled{opacity:.45;cursor:not-allowed;transform:none}.cv-card{position:relative;background:var(--cv-surface);border:1px solid color-mix(in srgb,var(--cv-ink) 52%,var(--cv-hair));border-radius:16px 14px 17px 13px}.cv-card:after{content:'';position:absolute;inset:4px -3px -4px 3px;z-index:-1;border:1px solid color-mix(in srgb,var(--cv-ink) 16%,transparent);border-radius:14px 17px 13px 16px;pointer-events:none}.cv-tool-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.cv-tool{min-height:210px;padding:24px;text-align:left;cursor:pointer;overflow:hidden;transition:transform .18s cubic-bezier(.2,.8,.2,1),box-shadow .18s ease,border-color .18s ease}.cv-tool:hover{transform:translateY(-3px);border-color:var(--cv-accent);box-shadow:0 16px 34px rgba(34,31,25,.09)}.cv-tool-no{font-size:9px;letter-spacing:1.3px;color:var(--cv-muted);font-weight:750}.cv-tool-icon{width:45px;height:45px;display:grid;place-items:center;margin-top:26px;border-radius:13px 11px 14px 10px;background:var(--cv-accent-soft);color:var(--cv-accent)}.cv-tool-icon svg{width:23px;height:23px}.cv-tool h3{font-size:19px;margin:18px 0 7px}.cv-tool p{margin:0;color:var(--cv-muted);font-size:12px;line-height:1.5}.cv-tool-arrow{position:absolute;right:22px;bottom:20px;color:var(--cv-muted);transition:transform .18s ease,color .18s ease}.cv-tool:hover .cv-tool-arrow{transform:translateX(3px);color:var(--cv-accent)}
    .cv-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:16px}.cv-search{position:relative;flex:1;min-width:220px}.cv-search svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);width:15px;color:var(--cv-muted)}.cv-search input,.cv-filter{width:100%;height:38px;border:1px solid var(--cv-hair);border-radius:10px;background:var(--cv-surface);color:var(--cv-ink);outline:0}.cv-search input{padding:0 14px 0 36px}.cv-search input:focus,.cv-filter:focus{border-color:var(--cv-accent);box-shadow:0 0 0 3px var(--cv-accent-soft)}.cv-filter{width:auto;max-width:160px;padding:0 28px 0 10px;font-size:11px}.cv-view-toggle{display:flex;padding:3px;border:1px solid var(--cv-hair);background:var(--cv-surface);border-radius:10px}.cv-view-toggle button{width:31px;height:30px;border:0;border-radius:7px;background:transparent;cursor:pointer;color:var(--cv-muted)}.cv-view-toggle button.active{background:var(--cv-soft);color:var(--cv-ink)}.cv-view-toggle svg{width:15px}.cv-vault-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:15px;padding-bottom:90px}.cv-vault-grid.list{grid-template-columns:1fr;gap:8px}.cv-item{position:relative;overflow:hidden;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}.cv-item:hover{transform:translateY(-2px);box-shadow:0 12px 26px rgba(30,28,24,.08)}.cv-item.selected{border-color:var(--cv-accent);box-shadow:0 0 0 3px var(--cv-accent-soft)}.cv-item-image{aspect-ratio:4/3;background:linear-gradient(135deg,var(--cv-soft),color-mix(in srgb,var(--cv-soft) 58%,var(--cv-bg)));display:grid;place-items:center;overflow:hidden}.cv-item-image img{width:100%;height:100%;object-fit:cover;transition:transform .25s ease}.cv-item:hover .cv-item-image img{transform:scale(1.025)}.cv-item-image svg{width:42px;height:42px;color:color-mix(in srgb,var(--cv-muted) 48%,transparent)}.cv-item-check{position:absolute;z-index:2;top:10px;left:10px;width:20px;height:20px;accent-color:var(--cv-accent);cursor:pointer}.cv-item-menu{position:absolute;z-index:2;top:9px;right:9px;width:29px;height:29px;border:1px solid color-mix(in srgb,var(--cv-hair) 70%,transparent);border-radius:9px;background:color-mix(in srgb,var(--cv-surface) 88%,transparent);backdrop-filter:blur(8px);cursor:pointer}.cv-item-body{padding:14px}.cv-item-title{font-size:14px;font-weight:720;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cv-item-meta{display:flex;justify-content:space-between;gap:10px;margin-top:11px;color:var(--cv-muted);font-size:10.5px}.cv-status{display:inline-flex;align-items:center;gap:6px}.cv-status:before{content:'';width:6px;height:6px;border-radius:50%;background:#5A9B74}.cv-status.unavailable:before{background:#B75B55}.cv-status.limited:before{background:#C38A2C}.cv-item-price{font-weight:700;color:var(--cv-ink)}.cv-vault-grid.list .cv-item{display:grid;grid-template-columns:112px minmax(0,1fr)}.cv-vault-grid.list .cv-item-image{aspect-ratio:auto;height:92px}.cv-vault-grid.list .cv-item-body{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center}.cv-vault-grid.list .cv-item-meta{margin:0;gap:24px}.cv-picker-modal{width:min(1060px,calc(100vw - 40px));overflow:hidden}.cv-picker-modal .cv-modal-head{padding:20px 24px 17px}.cv-picker-modal .cv-modal-body{padding:18px 22px 24px}.cv-picker-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(205px,1fr));gap:14px;max-height:min(560px,calc(100vh - 220px));overflow:auto;padding:2px 2px 8px}.cv-picker-card{display:flex;min-width:0;flex-direction:column;overflow:hidden;padding:0!important;text-align:left;border:1px solid color-mix(in srgb,var(--cv-ink) 47%,var(--cv-hair))!important;border-radius:15px 13px 16px 14px!important;background:var(--cv-surface)!important;box-shadow:none;cursor:pointer;transition:transform .16s cubic-bezier(.2,.8,.2,1),box-shadow .16s ease,border-color .16s ease}.cv-picker-card:hover,.cv-picker-card:focus-visible{transform:translateY(-2px);border-color:var(--cv-accent)!important;box-shadow:0 12px 26px rgba(30,28,24,.10);outline:0}.cv-picker-card:focus-visible{box-shadow:0 0 0 3px var(--cv-accent-soft),0 12px 26px rgba(30,28,24,.10)}.cv-picker-image{width:100%;aspect-ratio:4/3;overflow:hidden;background:var(--cv-soft)}.cv-picker-image img{display:block;width:100%;height:100%;object-fit:cover}.cv-picker-empty-image{display:grid;width:100%;height:100%;place-items:center;color:var(--cv-muted);background:linear-gradient(135deg,var(--cv-soft),color-mix(in srgb,var(--cv-soft) 54%,var(--cv-bg)))}.cv-picker-empty-image svg{width:34px;height:34px}.cv-picker-copy{display:grid;gap:9px;padding:13px 14px 14px}.cv-picker-title{overflow:hidden;font-size:13px;font-weight:760;line-height:1.2;text-overflow:ellipsis;white-space:nowrap}.cv-picker-meta{display:flex;align-items:center;justify-content:space-between;gap:9px;color:var(--cv-muted);font-size:10px}.cv-picker-price{color:var(--cv-ink);font-weight:750;white-space:nowrap}.cv-empty{min-height:370px;display:grid;place-items:center;text-align:center;padding:44px}.cv-empty-art{width:70px;height:55px;color:var(--cv-muted);margin:0 auto 20px}.cv-empty h3{font-size:23px;margin:0}.cv-empty p{max-width:500px;margin:11px auto 22px;color:var(--cv-muted);font-size:13px;line-height:1.55}.cv-empty-actions{display:flex;justify-content:center;gap:8px}.cv-selection{position:fixed;z-index:90;left:50%;bottom:24px;transform:translateX(-50%);display:flex;align-items:center;gap:5px;padding:7px;background:color-mix(in srgb,var(--cv-ink) 94%,transparent);color:var(--cv-surface);border-radius:13px 11px 14px 10px;box-shadow:0 16px 42px rgba(0,0,0,.25);animation:cv-up .18s cubic-bezier(.2,.8,.2,1) both}.cv-selection strong{font-size:11px;padding:0 9px;white-space:nowrap}.cv-selection button{height:32px;border:0;border-radius:8px;background:transparent;color:inherit;padding:0 9px;font-size:10.5px;font-weight:650;cursor:pointer;white-space:nowrap}.cv-selection button:hover{background:rgba(255,255,255,.12)}.cv-selection .accent{background:var(--cv-accent);color:#171615}.cv-selection .accent:hover{background:var(--cv-accent)}
    .cv-modal-backdrop{position:fixed;z-index:500;inset:0;background:rgba(23,22,20,.42);backdrop-filter:blur(3px);display:grid;place-items:center;padding:24px;animation:cv-fade .15s ease both}.cv-modal{width:min(720px,100%);max-height:min(820px,calc(100vh - 48px));overflow:auto;background:var(--cv-surface);border:1px solid var(--cv-hair);border-radius:18px 15px 19px 14px;box-shadow:0 28px 70px rgba(0,0,0,.25);animation:cv-modal .2s cubic-bezier(.2,.8,.2,1) both}.cv-modal.large{width:min(1120px,100%)}.cv-modal-head{position:sticky;z-index:3;top:0;display:flex;align-items:center;gap:16px;padding:20px 22px 16px;background:color-mix(in srgb,var(--cv-surface) 94%,transparent);backdrop-filter:blur(12px);border-bottom:1px solid var(--cv-hair)}.cv-modal-head h3{margin:0;font-size:20px;letter-spacing:-.3px}.cv-modal-head p{margin:4px 0 0;color:var(--cv-muted);font-size:11px}.cv-close{margin-left:auto}.cv-modal-body{padding:22px}.cv-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.cv-field{display:grid;gap:6px}.cv-field.wide{grid-column:1/-1}.cv-field label,.cv-field>span{font-size:9.5px;font-weight:750;letter-spacing:.75px;text-transform:uppercase;color:var(--cv-muted)}.cv-field input,.cv-field textarea,.cv-field select{width:100%;border:1px solid var(--cv-hair);border-radius:9px 10px 8px 9px;background:var(--cv-bg);color:var(--cv-ink);outline:0;padding:10px 11px}.cv-field input,.cv-field select{height:40px}.cv-field textarea{min-height:82px;resize:vertical}.cv-field input:focus,.cv-field textarea:focus,.cv-field select:focus{border-color:var(--cv-accent);box-shadow:0 0 0 3px var(--cv-accent-soft)}.cv-frame-format{display:flex;gap:8px;margin:16px 0 0;padding:0;border:0}.cv-frame-format label{flex:1;display:flex;align-items:center;justify-content:center;min-height:40px;padding:0 12px;border:1px solid var(--cv-hair);border-radius:10px;background:var(--cv-surface);font-size:11px;font-weight:750;cursor:pointer;transition:border-color .15s ease,background-color .15s ease}.cv-frame-format label:has(input:checked){border-color:var(--cv-accent);background:var(--cv-accent-soft)}.cv-frame-format input{position:absolute;opacity:0;pointer-events:none}.cv-image-access-note{margin:12px 0 -2px;padding:10px 11px;border:1px solid color-mix(in srgb,var(--cv-accent) 36%,var(--cv-hair));border-radius:10px;background:var(--cv-accent-soft);color:var(--cv-muted);font-size:10.5px;line-height:1.45}.cv-form-section{margin:18px 0 11px;padding-top:16px;border-top:1px solid var(--cv-hair);font-size:10px;font-weight:750;letter-spacing:1px;text-transform:uppercase;color:var(--cv-accent)}.cv-more{grid-column:1/-1;border:1px solid var(--cv-hair);border-radius:11px;padding:0 13px}.cv-more summary{padding:12px 0;font-size:11px;font-weight:700;cursor:pointer}.cv-more .cv-form-grid{padding:2px 0 14px}.cv-form-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:20px}.cv-file-drop{position:relative;min-height:106px;border:1px dashed var(--cv-muted);border-radius:12px;display:grid;place-items:center;text-align:center;color:var(--cv-muted);cursor:pointer;overflow:hidden}.cv-file-drop:hover{border-color:var(--cv-accent);color:var(--cv-accent);background:var(--cv-accent-soft)}.cv-file-drop input{position:absolute;inset:0;opacity:0;cursor:pointer}.cv-file-drop svg{width:31px;height:31px}.cv-file-drop small{display:block;margin-top:6px;font-size:10px}.cv-role-grid,.cv-board-type-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.cv-role,.cv-board-type{display:flex;align-items:center;gap:12px;min-height:66px;padding:13px;border:1px solid var(--cv-hair);border-radius:12px 10px 13px 11px;background:var(--cv-surface);cursor:pointer;text-align:left;transition:transform .13s ease,border-color .15s ease,background .15s ease}.cv-role:hover,.cv-board-type:hover{transform:translateY(-1px);border-color:var(--cv-accent);background:var(--cv-accent-soft)}.cv-role.selected{border-color:var(--cv-accent);box-shadow:0 0 0 3px var(--cv-accent-soft)}.cv-role-icon{width:35px;height:35px;display:grid;place-items:center;border-radius:10px;background:var(--cv-soft);color:var(--cv-accent)}.cv-role strong,.cv-board-type strong{display:block;font-size:12.5px}.cv-role small,.cv-board-type small{display:block;margin-top:3px;color:var(--cv-muted);font-size:10.5px;line-height:1.35}
    .cv-board-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(245px,1fr));gap:15px}.cv-board-card{min-height:185px;padding:18px;cursor:pointer;overflow:hidden;transition:transform .17s ease,box-shadow .17s ease,border-color .17s ease}.cv-board-card:hover{transform:translateY(-3px);border-color:var(--cv-accent);box-shadow:0 14px 30px rgba(30,28,24,.08)}.cv-board-preview{height:92px;border-radius:11px 9px 12px 10px;background-color:var(--cv-soft);background-image:radial-gradient(circle,color-mix(in srgb,var(--cv-muted) 25%,transparent) 1px,transparent 1px);background-size:12px 12px;position:relative;overflow:hidden}.cv-board-preview:before,.cv-board-preview:after{content:'';position:absolute;background:var(--cv-surface);border:1px solid var(--cv-hair);box-shadow:0 4px 8px rgba(0,0,0,.05)}.cv-board-preview:before{width:70px;height:48px;left:28px;top:20px;transform:rotate(-2deg)}.cv-board-preview:after{width:48px;height:58px;right:32px;top:15px;transform:rotate(3deg)}.cv-board-card h3{margin:15px 0 4px;font-size:14px}.cv-board-card p{margin:0;color:var(--cv-muted);font-size:10.5px}.cv-board-menu{position:absolute;right:13px;top:13px;z-index:2}.cv-board-shell{position:fixed;z-index:350;inset:44px 0 0;background:var(--cv-bg);display:flex;flex-direction:column;animation:cv-in .17s ease both}.cv-board-top{height:56px;flex:0 0 56px;display:flex;align-items:center;gap:8px;padding:0 14px;border-bottom:1px solid var(--cv-hair);background:var(--cv-surface)}.cv-board-back{display:flex;align-items:center;gap:6px}.cv-board-title{min-width:120px;max-width:300px;height:34px;border:0;background:transparent;color:var(--cv-ink);font-weight:720;outline:0;padding:0 8px}.cv-board-save{margin-right:auto;font-size:10.5px;color:var(--cv-muted)}.cv-board-viewport{position:relative;flex:1;min-height:0;overflow:hidden;cursor:grab;background-color:var(--cv-bg);background-image:radial-gradient(circle,color-mix(in srgb,var(--cv-muted) 30%,transparent) 1px,transparent 1px);background-size:18px 18px;touch-action:none}.cv-board-viewport.panning{cursor:grabbing}.cv-board-layer{position:absolute;left:0;top:0;width:5000px;height:3500px;transform-origin:0 0;will-change:transform}.cv-element{position:absolute;min-width:80px;min-height:54px;background:var(--cv-surface);border:1px solid var(--cv-hair);border-radius:10px 9px 11px 8px;box-shadow:0 6px 18px rgba(30,28,24,.08);overflow:hidden;cursor:move;user-select:none;transition:box-shadow .12s ease,border-color .12s ease}.cv-element.selected{border-color:var(--cv-accent);box-shadow:0 0 0 3px var(--cv-accent-soft),0 9px 22px rgba(30,28,24,.12)}.cv-element.image,.cv-element.vault{padding:0}.cv-element img{width:100%;height:100%;object-fit:cover;pointer-events:none}.cv-element-content{width:100%;height:100%;padding:14px;outline:0;overflow:auto;white-space:pre-wrap;user-select:text;cursor:text;font-size:13px;line-height:1.45}.cv-element.text .cv-element-content{font-size:21px;font-weight:720}.cv-element.note{background:color-mix(in srgb,#F2C870 28%,var(--cv-surface));border-color:color-mix(in srgb,#BA7517 38%,var(--cv-hair))}.cv-vault-element-meta{position:absolute;left:8px;right:8px;bottom:8px;padding:8px 9px;border-radius:8px;background:rgba(18,18,17,.74);color:#fff;backdrop-filter:blur(5px);font-size:10px}.cv-vault-element-meta strong{display:block;font-size:11px}.cv-resize{position:absolute;right:3px;bottom:3px;width:13px;height:13px;border-right:2px solid var(--cv-accent);border-bottom:2px solid var(--cv-accent);cursor:nwse-resize}.cv-element-toolbar{position:absolute;z-index:20;display:flex;gap:3px;padding:4px;border:1px solid var(--cv-hair);border-radius:10px;background:var(--cv-surface);box-shadow:0 8px 22px rgba(0,0,0,.14)}.cv-element-toolbar button{height:29px;border:0;border-radius:7px;background:transparent;padding:0 8px;font-size:10px;font-weight:650;cursor:pointer}.cv-element-toolbar button:hover{background:var(--cv-soft)}.cv-board-empty{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);text-align:center;color:var(--cv-muted);pointer-events:none}.cv-board-empty h3{margin:0;color:var(--cv-ink);font-size:18px}.cv-board-empty p{margin:8px 0 14px;font-size:11px}.cv-board-empty span{display:inline-block;margin:3px;padding:6px 8px;border:1px solid var(--cv-hair);border-radius:999px;font-size:9.5px}.cv-context{position:fixed;z-index:600;width:180px;padding:5px;border:1px solid var(--cv-hair);border-radius:11px;background:var(--cv-surface);box-shadow:0 14px 36px rgba(0,0,0,.2);animation:cv-modal .12s ease both}.cv-context button{display:flex;align-items:center;gap:9px;width:100%;height:34px;border:0;border-radius:7px;background:transparent;color:var(--cv-ink);font-size:11px;text-align:left;cursor:pointer}.cv-context button:hover{background:var(--cv-soft)}.cv-context svg{width:14px;color:var(--cv-muted)}
    .cv-quote-layout{display:grid;grid-template-columns:minmax(360px,.8fr) minmax(460px,1.2fr);gap:18px}.cv-quote-form{padding:18px}.cv-quote-preview{padding:30px;min-height:670px;background:#FBF9F4;color:#252523;border:1px solid #DED9CE;border-radius:12px;box-shadow:0 14px 34px rgba(30,28,24,.08)}.cv-preview-eyebrow{font-size:8px;font-weight:800;letter-spacing:1.4px;color:#BA7517}.cv-quote-preview h2{font-size:25px;letter-spacing:-.6px;margin:7px 0 5px}.cv-preview-meta{display:flex;justify-content:space-between;gap:20px;padding:13px 0 18px;border-bottom:1px solid #D8D3C9;color:#6F6D67;font-size:9.5px;line-height:1.55}.cv-preview-table{margin-top:18px}.cv-preview-row{display:grid;grid-template-columns:minmax(0,1fr) 60px 75px;gap:10px;padding:10px 0;border-bottom:1px solid #E0DCD3;font-size:10px;align-items:center}.cv-preview-row.header{font-size:8px;font-weight:800;letter-spacing:.7px;color:#77736C}.cv-preview-row strong{display:block}.cv-preview-row small{display:block;margin-top:2px;color:#77736C}.cv-preview-total{width:220px;margin:20px 0 0 auto}.cv-preview-total div{display:flex;justify-content:space-between;padding:5px 0;font-size:10px}.cv-preview-total div:last-child{margin-top:4px;padding-top:9px;border-top:1px solid #252523;font-size:13px;font-weight:800}.cv-quote-lines{grid-column:1/-1;border:1px solid var(--cv-hair);border-radius:11px;overflow:hidden}.cv-quote-line{display:grid;grid-template-columns:minmax(140px,1fr) 72px 72px 90px 30px;gap:8px;align-items:center;padding:8px;border-bottom:1px solid var(--cv-hair)}.cv-quote-line:last-child{border-bottom:0}.cv-quote-line input{height:34px;min-width:0;border:1px solid var(--cv-hair);border-radius:8px;background:var(--cv-bg);color:var(--cv-ink);padding:0 8px}.cv-quote-line button{border:0;background:transparent;cursor:pointer}.cv-menu-pop{position:fixed;z-index:520;width:170px;padding:5px;border:1px solid var(--cv-hair);border-radius:11px;background:var(--cv-surface);box-shadow:0 14px 34px rgba(0,0,0,.18)}.cv-menu-pop button{width:100%;height:34px;border:0;border-radius:7px;background:transparent;text-align:left;padding:0 10px;font-size:11px;cursor:pointer}.cv-menu-pop button:hover{background:var(--cv-soft)}.cv-toast{position:fixed;z-index:900;left:50%;bottom:24px;transform:translateX(-50%);padding:10px 14px;border-radius:10px;background:var(--cv-ink);color:var(--cv-surface);font-size:11px;box-shadow:0 12px 30px rgba(0,0,0,.22);animation:cv-up .18s ease both}
    .cv-preview-signatures{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:42px}.cv-preview-signatures span{padding-top:7px;border-top:1px solid #D8D3C9;color:#BA7517;font-size:7.5px;font-weight:800;letter-spacing:.75px}
    @keyframes cv-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}@keyframes cv-up{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}@keyframes cv-modal{from{opacity:0;transform:scale(.985) translateY(5px)}to{opacity:1;transform:none}}@keyframes cv-fade{from{opacity:0}to{opacity:1}}@keyframes cv-spin{to{transform:rotate(360deg)}}
    @media(max-width:900px){.cv-page{width:min(100% - 32px,1180px);padding:24px 0 48px}.cv-tool-grid{grid-template-columns:1fr}.cv-top{align-items:flex-start;flex-wrap:wrap}.cv-title{width:100%}.cv-tabs{order:3;width:100%;overflow:auto}.cv-tab{flex:1}.cv-form-grid,.cv-role-grid,.cv-board-type-grid,.cv-quote-layout{grid-template-columns:1fr}.cv-quote-preview{min-height:auto}.cv-selection{max-width:calc(100vw - 24px);overflow:auto;justify-content:flex-start}.cv-board-top{overflow:auto}.cv-board-title{min-width:150px}.cv-toolbar{align-items:stretch}.cv-search{min-width:100%}.cv-filter{flex:1;max-width:none}.cv-vault-grid{grid-template-columns:repeat(auto-fill,minmax(170px,1fr))}}
    /* Canvas keeps the visual language light, but gives every surface a clear job. */
    .cv-top{align-items:flex-end;gap:20px;padding-bottom:20px}.cv-top .cv-title{min-width:170px}.cv-top .cv-title h1{font-size:28px}.cv-top:after{content:'One calm place for references, boards, and shot planning';order:1;margin:0 auto 3px;color:var(--cv-muted);font-size:11px}.cv-tabs{order:2}.cv-top>.cv-btn{order:3;white-space:nowrap}
    .cv-board-grid{grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:18px}.cv-board-card{min-height:232px;padding:15px}.cv-board-card:focus-visible{outline:3px solid var(--cv-accent-soft);outline-offset:3px}.cv-board-preview{height:122px}.cv-board-preview img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.cv-board-preview.has-image:after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 44%,rgba(20,19,17,.34))}.cv-board-preview-stub{position:absolute;background:color-mix(in srgb,var(--cv-surface) 92%,transparent);border:1px solid color-mix(in srgb,var(--cv-ink) 14%,var(--cv-hair));box-shadow:0 4px 8px rgba(0,0,0,.07);border-radius:4px}.cv-board-preview-stub.one{width:37%;height:48%;left:12%;top:24%;transform:rotate(-4deg)}.cv-board-preview-stub.two{width:29%;height:62%;right:13%;top:14%;transform:rotate(5deg)}.cv-board-preview-stub.three{width:20%;height:32%;left:42%;bottom:9%;transform:rotate(2deg)}.cv-board-card h3{margin:14px 0 5px}.cv-board-card p{line-height:1.45}.cv-board-meta{display:flex;align-items:center;gap:8px;margin-top:10px;color:var(--cv-muted);font-size:10px}.cv-board-meta strong{color:var(--cv-ink);font-weight:700}.cv-board-menu{right:10px;top:10px}.cv-item-menu svg{width:14px;height:14px}
    .cv-board-top{height:62px;flex-basis:62px;gap:7px;overflow:auto}.cv-board-top .cv-btn{white-space:nowrap}.cv-board-tools{display:flex;align-items:center;gap:5px;padding-left:5px;border-left:1px solid var(--cv-hair)}.cv-board-tools .cv-btn{min-height:32px;padding:0 10px;display:inline-flex;align-items:center;gap:6px;flex:0 0 auto}.cv-board-tools .cv-btn svg{width:14px;height:14px}.cv-board-zoom{display:flex;align-items:center;gap:4px;margin-left:3px;flex:0 0 auto}.cv-board-zoom span{min-width:42px;text-align:center;font-size:10px;color:var(--cv-muted)}.cv-board-empty{width:min(420px,calc(100% - 32px));padding:28px 24px;border:1px dashed color-mix(in srgb,var(--cv-muted) 55%,transparent);border-radius:16px;background:color-mix(in srgb,var(--cv-surface) 72%,transparent);box-shadow:0 12px 30px rgba(30,28,24,.05);pointer-events:auto}.cv-board-empty span{background:var(--cv-surface)}.cv-board-empty .cv-btn{display:inline-flex;align-items:center;gap:6px}.cv-board-empty .cv-btn svg{width:14px;height:14px}
    .cv-element-toolbar button:disabled{opacity:.4;cursor:not-allowed}
    .cv-board-mode-switch{display:flex;align-items:center;gap:3px;padding:3px;border:1px solid var(--cv-hair);border-radius:10px;background:var(--cv-soft);flex:0 0 auto}.cv-board-mode{border:0!important;background:transparent!important;color:var(--cv-muted)}.cv-board-mode.active{background:var(--cv-surface)!important;color:var(--cv-accent);box-shadow:0 1px 4px rgba(30,28,24,.1)}.cv-board-mode[aria-pressed=true]{cursor:default}.cv-board-viewport.tool-select{cursor:crosshair}.cv-board-viewport.tool-hand,.cv-board-viewport.tool-hand .cv-element{cursor:grab}.cv-board-viewport.tool-hand.panning,.cv-board-viewport.tool-hand.panning .cv-element{cursor:grabbing}.cv-board-viewport.tool-erase{cursor:crosshair}.cv-board-viewport.tool-erase .cv-element{cursor:crosshair}.cv-board-selection-marquee{position:absolute;z-index:70;pointer-events:none;border:1px solid color-mix(in srgb,var(--cv-accent) 80%,var(--cv-ink));border-radius:9px 11px 8px 10px;background:color-mix(in srgb,var(--cv-accent) 17%,transparent);box-shadow:0 8px 20px color-mix(in srgb,var(--cv-accent) 17%,transparent);backdrop-filter:blur(1px);animation:cv-marquee-in .12s cubic-bezier(.2,.8,.2,1) both}.cv-board-eraser-trail{position:absolute;z-index:80;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;opacity:1;transition:opacity .34s cubic-bezier(.22,.7,.25,1)}.cv-board-eraser-trail.is-fading{opacity:0}.cv-board-eraser-trail polyline{fill:none;stroke:#E78A9E;stroke-width:18;stroke-linecap:round;stroke-linejoin:round;opacity:.72;filter:drop-shadow(0 1px 2px rgba(126,57,74,.16))}@keyframes cv-marquee-in{from{opacity:0;transform:scale(.985)}to{opacity:1;transform:scale(1)}}
    @media(max-width:900px){.cv-top{align-items:flex-start;flex-wrap:wrap}.cv-top:after{order:4;width:100%;margin:0}.cv-tabs{order:3;width:100%}.cv-top>.cv-btn{order:2;margin-left:auto}.cv-board-tools{border-left:0;padding-left:0}.cv-board-shell{inset:0}.cv-board-top{height:auto;min-height:58px;padding:9px;flex-wrap:wrap}.cv-board-title{order:2;flex:1;min-width:150px}.cv-board-save{order:3;margin-right:0}.cv-board-tools{order:4;width:100%;overflow:auto}.cv-board-zoom{order:5}}
    /* A Board is a true working surface: its canvas owns every pixel below the tools. */
    :host,.cv-root{height:100%}.cv-board-shell{position:relative!important;inset:auto!important;width:100%;height:100%;min-height:0}.cv-board-viewport{background-size:18px 18px}.cv-vault-grid:not(.list){grid-auto-rows:292px}.cv-vault-grid:not(.list) .cv-item{display:flex;height:100%;min-height:0;flex-direction:column}.cv-vault-grid:not(.list) .cv-item-image{flex:0 0 auto}.cv-vault-grid:not(.list) .cv-item-body{flex:1;min-height:0}.cv-element.image,.cv-element.vault{background:var(--cv-soft)}.cv-element.image img,.cv-element.vault img{display:block;width:100%;height:100%;object-fit:cover}
    /* Vault cards use one clipped, rounded surface. The sketch-outline
       pseudo-element looked pointed while the image lifted on hover. */
    .cv-card.cv-item{border-radius:20px;isolation:isolate;overflow:hidden;background:var(--cv-surface)}.cv-card.cv-item:after{display:none}.cv-item-image{border-radius:0;clip-path:none;background:transparent}.cv-item-image img{display:block;width:100%;height:100%;object-fit:cover;border:0;border-radius:0;transform:translateZ(0) scale(1.002)}.cv-item:hover{box-shadow:0 14px 30px rgba(30,28,24,.12)}
    .cv-card.cv-item{cursor:pointer}.cv-item:focus-visible{outline:3px solid var(--cv-accent-soft);outline-offset:3px}.cv-item-check,.cv-item-menu{cursor:pointer}.cv-item-image-empty{height:100%;width:100%;display:grid;place-items:center;align-content:center;gap:8px;color:var(--cv-muted);font-size:10.5px;background:linear-gradient(135deg,color-mix(in srgb,var(--cv-soft) 78%,var(--cv-surface)),var(--cv-soft))}.cv-item-image-empty svg{width:31px;height:31px}.cv-vault-upload-preview{display:none;grid-template-columns:repeat(auto-fill,minmax(108px,1fr));gap:10px}.cv-vault-upload-preview.has-images{display:grid}.cv-vault-upload-preview figure{position:relative;margin:0;aspect-ratio:4/3;overflow:hidden;border-radius:11px;background:var(--cv-soft);box-shadow:0 4px 12px rgba(30,28,24,.08);animation:cv-upload-preview-in .2s cubic-bezier(.2,.8,.2,1) both}.cv-vault-upload-preview img{display:block;width:100%;height:100%;object-fit:cover}.cv-vault-upload-preview figcaption{position:absolute;left:0;right:0;bottom:0;padding:7px 8px;background:linear-gradient(transparent,rgba(15,14,12,.72));color:#fff;font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-top:18px}@keyframes cv-upload-preview-in{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}.cv-item-detail{width:min(940px,100%)}.cv-detail-layout{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(300px,.92fr);gap:24px;align-items:start}.cv-detail-image{aspect-ratio:4/3;overflow:hidden;border-radius:16px;background:var(--cv-soft);box-shadow:0 12px 30px rgba(30,28,24,.1)}.cv-detail-image img{display:block;width:100%;height:100%;object-fit:cover}.cv-detail-placeholder{height:100%;display:grid;place-items:center;align-content:center;gap:10px;color:var(--cv-muted);font-size:11px}.cv-detail-placeholder svg{width:54px;height:42px}.cv-detail-content{min-width:0}.cv-detail-price{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--cv-hair);border-radius:13px;overflow:hidden;background:var(--cv-bg)}.cv-detail-price>div{padding:13px 14px}.cv-detail-price>div+div{border-left:1px solid var(--cv-hair)}.cv-detail-price span,.cv-detail-row span,.cv-detail-note>span{display:block;color:var(--cv-muted);font-size:9px;font-weight:750;letter-spacing:.8px;text-transform:uppercase}.cv-detail-price strong{display:block;margin-top:5px;font-size:15px;letter-spacing:-.2px}.cv-detail-counts{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.cv-detail-counts span,.cv-detail-tags span{padding:6px 8px;border-radius:999px;background:var(--cv-soft);color:var(--cv-muted);font-size:10px}.cv-detail-counts strong{color:var(--cv-ink)}.cv-detail-description{margin:15px 0;color:var(--cv-ink);font-size:12.5px;line-height:1.55}.cv-detail-rows{border-top:1px solid var(--cv-hair)}.cv-detail-row{display:grid;grid-template-columns:112px minmax(0,1fr);gap:12px;padding:9px 0;border-bottom:1px solid var(--cv-hair);align-items:baseline}.cv-detail-row strong{font-size:11.5px;font-weight:650;overflow-wrap:anywhere}.cv-detail-empty{padding:14px 0;color:var(--cv-muted);font-size:11px}.cv-detail-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:13px}.cv-detail-note{margin-top:13px;padding:11px 12px;border-radius:10px;background:var(--cv-accent-soft);font-size:11px;line-height:1.5}.cv-detail-note>span{margin-bottom:4px;color:var(--cv-accent)}.cv-item-detail .cv-form-actions{margin-top:18px}@media(max-width:720px){.cv-item-detail .cv-modal-body{padding:16px}.cv-detail-layout{grid-template-columns:1fr;gap:17px}.cv-detail-image{max-height:330px}.cv-detail-price{grid-template-columns:1fr}.cv-detail-price>div+div{border-left:0;border-top:1px solid var(--cv-hair)}}
    .cv-note-content{border:0;background:transparent;resize:none;color:var(--cv-ink);font:inherit}.cv-note-content::placeholder{color:var(--cv-muted);opacity:.72}.cv-element.is-new{animation:cv-board-element-in .24s cubic-bezier(.2,.8,.2,1) both}@keyframes cv-board-element-in{from{opacity:0;filter:brightness(1.08)}to{opacity:1;filter:none}}
    @media(prefers-reduced-motion:reduce){*,*:before,*:after{animation-duration:.01ms!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}
    /* Imagine is a visual wall first; controls stay concentrated in one floating composer. */
    .cv-imagine-page{width:100%;max-width:none;margin:0;padding:0;min-height:calc(100vh - 44px)}.cv-imagine-page .cv-top{position:absolute;z-index:5;top:0;left:0;right:0;margin:0;padding:15px 24px;border:0;background:linear-gradient(180deg,rgba(14,15,16,.72),transparent);color:#fff}.cv-imagine-page .cv-top:after{display:none}.cv-imagine-page .cv-title h1{font-size:22px;color:#fff}.cv-imagine-page .cv-tab{color:rgba(255,255,255,.72)}.cv-imagine-page .cv-tabs{background:rgba(10,11,12,.4);backdrop-filter:blur(12px)}.cv-imagine-page .cv-tab[aria-current=true]{background:rgba(255,255,255,.18);color:#fff;box-shadow:none}.cv-imagine-stage{position:relative;display:grid;min-height:calc(100vh - 44px);overflow:hidden;background:#111}.cv-imagine-gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));grid-auto-rows:minmax(165px,22vw);align-content:start;gap:2px;width:100%;min-height:100%;background:#151515}.cv-imagine-tile{position:relative;display:block;min-width:0;padding:0;border:0;background:#1d1d1d;overflow:hidden;cursor:pointer}.cv-imagine-tile:after{content:'Add to Board';position:absolute;inset:auto 10px 10px auto;padding:6px 8px;border-radius:8px;background:rgba(12,12,12,.68);color:#fff;font-size:10px;font-weight:700;opacity:0;transform:translateY(4px);transition:opacity .16s ease,transform .16s ease}.cv-imagine-tile:hover:after{opacity:1;transform:none}.cv-imagine-tile img{display:block;width:100%;height:100%;object-fit:cover;transition:transform .32s cubic-bezier(.2,.8,.2,1),filter .2s ease}.cv-imagine-tile:hover img{transform:scale(1.04);filter:brightness(.82)}.cv-imagine-empty{display:grid;grid-column:1/-1;min-height:100vh;place-items:center;background:radial-gradient(circle at 50% 38%,#38352d 0,#171715 42%,#111 78%);color:#f9f6ee;text-align:center}.cv-imagine-empty div{display:grid;justify-items:center;gap:11px}.cv-imagine-empty svg{width:42px;height:42px;opacity:.72}.cv-imagine-empty strong{font-size:20px}.cv-imagine-empty span{font-size:12px;color:rgba(255,255,255,.62)}.cv-imagine-shade{position:absolute;z-index:1;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(0,0,0,.28),transparent 26%,transparent 58%,rgba(0,0,0,.56))}.cv-imagine-console{position:fixed;z-index:6;left:50%;bottom:30px;width:min(920px,calc(100vw - 48px));padding:14px 16px 15px;transform:translateX(-50%);border:1px solid rgba(255,255,255,.13);border-radius:24px 21px 26px 20px;background:rgba(28,29,31,.93);color:#fff;box-shadow:0 22px 72px rgba(0,0,0,.42);backdrop-filter:blur(18px);animation:cv-imagine-console-in .32s cubic-bezier(.2,.8,.2,1) both}.cv-imagine-console-top{display:flex;align-items:flex-start;gap:12px}.cv-imagine-reference{position:relative;display:grid;flex:0 0 54px;width:54px;height:54px;place-items:center;overflow:hidden;border:1px solid rgba(255,255,255,.12);border-radius:13px;background:rgba(255,255,255,.07);color:rgba(255,255,255,.75);cursor:pointer}.cv-imagine-reference>svg{width:21px}.cv-imagine-reference input{position:absolute;inset:0;opacity:0;cursor:pointer}.cv-imagine-reference-list{display:grid;width:100%;height:100%;grid-template-columns:1fr 1fr;overflow:hidden}.cv-imagine-reference-list img{width:100%;height:100%;object-fit:cover}.cv-imagine-console textarea{width:100%;min-height:54px;max-height:112px;padding:10px 3px;border:0;resize:vertical;outline:0;background:transparent;color:#fff;font-size:15px;line-height:1.45}.cv-imagine-console textarea::placeholder{color:rgba(255,255,255,.52)}.cv-imagine-controls{display:flex;align-items:center;gap:9px;margin-top:12px}.cv-imagine-segment{display:flex;gap:3px;margin:0;padding:3px;border:0;border-radius:10px;background:rgba(255,255,255,.08)}.cv-imagine-segment label{position:relative;display:grid;place-items:center;min-width:52px;height:31px;border-radius:8px;color:rgba(255,255,255,.65);font-size:11px;font-weight:750;cursor:pointer}.cv-imagine-segment label:has(input:checked){background:rgba(255,255,255,.17);color:#fff}.cv-imagine-segment input{position:absolute;opacity:0;pointer-events:none}.cv-imagine-style{display:flex;align-items:center;gap:7px;height:37px;padding:0 9px;border:1px solid rgba(255,255,255,.1);border-radius:10px;background:rgba(255,255,255,.06)}.cv-imagine-style span{font-size:10px;font-weight:700;color:rgba(255,255,255,.55)}.cv-imagine-style select{min-width:102px;border:0;outline:0;background:transparent;color:#fff;font-size:11px;font-weight:750}.cv-imagine-style option{color:#222}.cv-imagine-library-count{margin-left:auto;color:rgba(255,255,255,.56);font-size:10px;font-weight:650}.cv-imagine-generate{height:48px;padding:0 21px;border:0;border-radius:14px 12px 15px 11px;background:var(--cv-accent);color:#181716;font-size:13px;font-weight:850;cursor:pointer;transition:transform .14s ease,filter .14s ease}.cv-imagine-generate:hover{filter:brightness(1.07);transform:translateY(-1px)}.cv-imagine-generate:disabled{opacity:.58;cursor:wait;transform:none}@keyframes cv-imagine-console-in{from{opacity:0;transform:translate(-50%,14px)}to{opacity:1;transform:translate(-50%,0)}}
    @media(max-width:720px){.cv-imagine-page .cv-top{padding:13px 16px}.cv-imagine-page .cv-title{width:auto}.cv-imagine-page .cv-title .cv-eyebrow{display:none}.cv-imagine-page .cv-tabs{width:auto;max-width:calc(100vw - 122px);overflow:auto}.cv-imagine-page .cv-tab{flex:0 0 auto;padding:7px 9px}.cv-imagine-gallery{grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:38vw}.cv-imagine-console{bottom:15px;width:calc(100vw - 24px);padding:11px 12px}.cv-imagine-controls{flex-wrap:wrap}.cv-imagine-library-count{order:3;margin-left:0}.cv-imagine-generate{margin-left:auto;height:42px;padding:0 16px}.cv-imagine-style{flex:1}.cv-imagine-style select{width:100%}}
    /* Imagine follows FilmScript's global day/night appearance instead of
       carrying its own permanent dark theme. */
    .cv-imagine-page .cv-top{background:linear-gradient(180deg,color-mix(in srgb,var(--cv-bg) 94%,transparent),transparent);color:var(--cv-ink)}.cv-imagine-page .cv-title h1{color:var(--cv-ink)}.cv-imagine-page .cv-tab{color:color-mix(in srgb,var(--cv-ink) 68%,transparent)}.cv-imagine-page .cv-tabs{background:color-mix(in srgb,var(--cv-soft) 74%,transparent);border:1px solid color-mix(in srgb,var(--cv-hair) 82%,transparent)}.cv-imagine-page .cv-tab[aria-current=true]{background:var(--cv-surface);color:var(--cv-accent);box-shadow:0 1px 5px color-mix(in srgb,var(--cv-ink) 10%,transparent)}.cv-imagine-stage{background:var(--cv-bg)}.cv-imagine-gallery{background:var(--cv-soft)}.cv-imagine-tile{background:var(--cv-surface)}.cv-imagine-empty{background:radial-gradient(circle at 50% 38%,color-mix(in srgb,var(--cv-accent) 18%,var(--cv-surface)) 0,var(--cv-bg) 72%);color:var(--cv-ink)}.cv-imagine-empty span{color:var(--cv-muted)}.cv-imagine-shade{background:linear-gradient(180deg,color-mix(in srgb,var(--cv-bg) 28%,transparent),transparent 26%,transparent 58%,color-mix(in srgb,var(--cv-bg) 48%,transparent))}.cv-imagine-console{border-color:color-mix(in srgb,var(--cv-hair) 88%,transparent);background:color-mix(in srgb,var(--cv-surface) 92%,transparent);color:var(--cv-ink);box-shadow:0 22px 72px color-mix(in srgb,var(--cv-ink) 22%,transparent)}.cv-imagine-reference{border-color:var(--cv-hair);background:var(--cv-soft);color:var(--cv-muted)}.cv-imagine-console textarea{color:var(--cv-ink)}.cv-imagine-console textarea::placeholder{color:var(--cv-muted)}.cv-imagine-segment{background:var(--cv-soft)}.cv-imagine-segment label{color:var(--cv-muted)}.cv-imagine-segment label:has(input:checked){background:var(--cv-surface);color:var(--cv-ink);box-shadow:0 1px 4px color-mix(in srgb,var(--cv-ink) 10%,transparent)}.cv-imagine-style{border-color:var(--cv-hair);background:var(--cv-soft)}.cv-imagine-style span,.cv-imagine-library-count{color:var(--cv-muted)}.cv-imagine-style select{color:var(--cv-ink)}.cv-imagine-console{transition:border-color .18s ease,background-color .18s ease,box-shadow .18s ease,transform .18s cubic-bezier(.2,.8,.2,1)}.cv-imagine-console.is-dragging{border-color:var(--cv-accent);background:color-mix(in srgb,var(--cv-surface) 84%,var(--cv-accent-soft));box-shadow:0 0 0 5px var(--cv-accent-soft),0 22px 72px color-mix(in srgb,var(--cv-ink) 20%,transparent);transform:translate(-50%,-4px)}.cv-imagine-drop-hint{display:none;position:absolute;inset:-36px 20px auto;padding:7px 11px;border:1px solid color-mix(in srgb,var(--cv-accent) 55%,var(--cv-hair));border-radius:10px 11px 9px 10px;background:var(--cv-surface);color:var(--cv-accent);font-size:10px;font-weight:750;letter-spacing:.2px;box-shadow:0 7px 18px color-mix(in srgb,var(--cv-ink) 12%,transparent)}.cv-imagine-console.is-dragging .cv-imagine-drop-hint{display:block;animation:cv-drop-hint .16s ease both}@keyframes cv-drop-hint{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
    .cv-imagine-reference-wrap{position:relative;flex:0 0 54px;width:54px;height:54px}.cv-imagine-reference-wrap .cv-imagine-reference{width:100%;height:100%;min-width:0;min-height:0}.cv-imagine-reference.has-references{border-color:color-mix(in srgb,var(--cv-accent) 48%,var(--cv-hair));box-shadow:0 0 0 2px var(--cv-accent-soft)}.cv-imagine-reference-list{display:block;position:absolute;inset:0}.cv-imagine-reference-list img{display:block;width:100%;height:100%;object-fit:cover}.cv-imagine-reference-list span{position:absolute;right:4px;bottom:4px;display:grid;min-width:19px;height:19px;padding:0 4px;place-items:center;border:1px solid color-mix(in srgb,var(--cv-surface) 90%,transparent);border-radius:7px 6px 8px 6px;background:var(--cv-ink);color:var(--cv-surface);font-size:9px;font-weight:800;box-shadow:0 2px 7px color-mix(in srgb,var(--cv-ink) 35%,transparent)}.cv-imagine-reference-remove{position:absolute;z-index:3;top:-6px;right:-6px;display:grid;width:20px;height:20px;padding:0;place-items:center;border:1px solid color-mix(in srgb,var(--cv-surface) 92%,transparent);border-radius:7px 6px 8px 6px;background:var(--cv-ink);color:var(--cv-surface);font-size:16px;line-height:1;cursor:pointer;opacity:0;transform:scale(.82) rotate(-12deg);box-shadow:0 4px 12px color-mix(in srgb,var(--cv-ink) 32%,transparent);transition:opacity .15s ease,transform .18s cubic-bezier(.2,.8,.2,1),background .15s ease}.cv-imagine-reference-wrap:hover .cv-imagine-reference-remove,.cv-imagine-reference-remove:focus-visible{opacity:1;transform:scale(1) rotate(0)}.cv-imagine-reference-remove:hover{background:#B75B55}.cv-imagine-style-picker{position:relative;flex:0 0 auto}.cv-imagine-style-trigger{display:flex;align-items:center;gap:7px;height:37px;padding:0 10px;border:1px solid var(--cv-hair);border-radius:10px 11px 9px 10px;background:var(--cv-soft);color:var(--cv-ink);cursor:pointer;transition:border-color .15s ease,background .15s ease,transform .14s ease}.cv-imagine-style-trigger:hover{border-color:color-mix(in srgb,var(--cv-accent) 54%,var(--cv-hair));background:var(--cv-surface);transform:translateY(-1px)}.cv-imagine-style-trigger span{color:var(--cv-muted);font-size:10px;font-weight:750}.cv-imagine-style-trigger strong{font-size:11.5px;font-weight:780}.cv-imagine-style-trigger i{margin-left:3px;font-size:16px;line-height:1;font-style:normal;color:var(--cv-muted);transform:translateY(-2px)}.cv-imagine-style-menu{position:absolute;z-index:8;left:0;bottom:calc(100% + 8px);display:grid;min-width:156px;padding:5px;border:1px solid var(--cv-hair);border-radius:13px 12px 14px 11px;background:var(--cv-surface);box-shadow:0 16px 38px color-mix(in srgb,var(--cv-ink) 19%,transparent);animation:cv-imagine-style-in .16s cubic-bezier(.2,.8,.2,1) both}.cv-imagine-style-menu button{height:33px;border:0;border-radius:8px;background:transparent;color:var(--cv-ink);padding:0 10px;text-align:left;font-size:11.5px;font-weight:670;cursor:pointer}.cv-imagine-style-menu button:hover,.cv-imagine-style-menu button.active{background:var(--cv-accent-soft);color:var(--cv-accent)}@keyframes cv-imagine-style-in{from{opacity:0;transform:translateY(4px) scale(.98)}to{opacity:1;transform:none}}
    /* Liquid Glass composer: the working gallery stays visibly alive beneath it. */
    .cv-imagine-console{isolation:isolate;overflow:hidden;border-color:color-mix(in srgb,var(--cv-surface) 72%,var(--cv-hair));background:linear-gradient(128deg,color-mix(in srgb,var(--cv-surface) 72%,transparent) 0%,color-mix(in srgb,var(--cv-surface) 46%,transparent) 42%,color-mix(in srgb,var(--cv-accent) 10%,transparent) 100%);backdrop-filter:blur(30px) saturate(175%) brightness(1.06);-webkit-backdrop-filter:blur(30px) saturate(175%) brightness(1.06);box-shadow:0 24px 74px color-mix(in srgb,var(--cv-ink) 22%,transparent),inset 0 1px 0 color-mix(in srgb,var(--cv-surface) 88%,transparent),inset 0 -1px 0 color-mix(in srgb,var(--cv-ink) 10%,transparent)}.cv-imagine-console:before{content:'';position:absolute;z-index:0;inset:1px;border-radius:23px 20px 25px 19px;pointer-events:none;background:radial-gradient(90% 120% at 8% -28%,color-mix(in srgb,#fff 58%,transparent),transparent 52%),linear-gradient(118deg,color-mix(in srgb,var(--cv-surface) 46%,transparent),transparent 34%,color-mix(in srgb,var(--cv-accent) 10%,transparent));opacity:.9}.cv-imagine-console:after{content:'';position:absolute;z-index:0;top:-58%;left:-18%;width:64%;height:172%;pointer-events:none;transform:rotate(18deg);background:linear-gradient(90deg,transparent,color-mix(in srgb,#fff 22%,transparent),transparent);filter:blur(9px);opacity:.48}.cv-imagine-console>*{position:relative;z-index:1}.cv-imagine-console:focus-within{border-color:color-mix(in srgb,var(--cv-surface) 74%,var(--cv-accent));box-shadow:0 27px 82px color-mix(in srgb,var(--cv-ink) 26%,transparent),0 0 0 1px color-mix(in srgb,var(--cv-accent) 25%,transparent),inset 0 1px 0 color-mix(in srgb,var(--cv-surface) 92%,transparent);transform:translate(-50%,-2px)}.cv-imagine-console:hover{border-color:color-mix(in srgb,var(--cv-surface) 85%,var(--cv-accent));box-shadow:0 25px 78px color-mix(in srgb,var(--cv-ink) 24%,transparent),inset 0 1px 0 color-mix(in srgb,var(--cv-surface) 86%,transparent)}.cv-imagine-console.is-dragging{background:linear-gradient(128deg,color-mix(in srgb,var(--cv-surface) 60%,transparent),color-mix(in srgb,var(--cv-accent) 16%,transparent));backdrop-filter:blur(32px) saturate(185%) brightness(1.06);-webkit-backdrop-filter:blur(32px) saturate(185%) brightness(1.06)}
    .cv-imagine-aspect label{display:flex;align-items:center;gap:6px;min-width:76px;padding:0 8px}.cv-aspect-preview{display:block;flex:0 0 auto;border:1.5px solid currentColor;border-radius:4px 3px 4px 3px;opacity:.82;box-shadow:inset 0 0 0 1px color-mix(in srgb,currentColor 14%,transparent)}.cv-aspect-preview.horizontal{width:20px;height:12px}.cv-aspect-preview.vertical{width:11px;height:19px}.cv-aspect-preview.square{width:15px;height:15px}.cv-imagine-aspect label:has(input:checked) .cv-aspect-preview{color:var(--cv-accent);opacity:1;box-shadow:0 0 0 2px var(--cv-accent-soft),inset 0 0 0 1px color-mix(in srgb,var(--cv-accent) 18%,transparent)}
    /* Imagine composer: compact pickers, clear option spacing and aspect-aware frames. */
    .cv-imagine-aspect-picker{position:relative;flex:0 0 auto}.cv-imagine-aspect-trigger{display:flex;align-items:center;gap:7px;height:37px;padding:0 10px;border:1px solid var(--cv-hair);border-radius:10px 11px 9px 10px;background:var(--cv-soft);color:var(--cv-ink);cursor:pointer;transition:border-color .15s ease,background .15s ease,transform .14s ease}.cv-imagine-aspect-trigger:hover{border-color:color-mix(in srgb,var(--cv-accent) 54%,var(--cv-hair));background:var(--cv-surface);transform:translateY(-1px)}.cv-imagine-aspect-trigger strong{font-size:11.5px;font-weight:780}.cv-imagine-aspect-trigger>i:last-child{margin-left:2px;color:var(--cv-muted);font-size:16px;font-style:normal;line-height:1;transform:translateY(-2px)}.cv-imagine-aspect-menu,.cv-imagine-style-menu{position:absolute;z-index:8;left:0;bottom:calc(100% + 9px);display:grid;gap:4px;padding:6px;border:1px solid var(--cv-hair);border-radius:13px 12px 14px 11px;background:var(--cv-surface);box-shadow:0 16px 38px color-mix(in srgb,var(--cv-ink) 19%,transparent);animation:cv-imagine-style-in .16s cubic-bezier(.2,.8,.2,1) both}.cv-imagine-aspect-menu{min-width:126px}.cv-imagine-style-menu{min-width:156px}.cv-imagine-aspect-menu button,.cv-imagine-style-menu button{display:flex;align-items:center;gap:9px;height:34px;margin:0;padding:0 10px;border:0;border-radius:8px;background:transparent;color:var(--cv-ink);text-align:left;font-size:11.5px;font-weight:670;cursor:pointer;transition:background .14s ease,color .14s ease}.cv-imagine-style-menu button{width:100%}.cv-imagine-aspect-menu button:hover,.cv-imagine-style-menu button:hover{background:var(--cv-soft);color:var(--cv-ink)}.cv-imagine-aspect-menu button.active,.cv-imagine-style-menu button.active{background:var(--cv-accent-soft);color:var(--cv-accent)}.cv-imagine-aspect-menu .cv-aspect-preview{color:currentColor}.cv-imagine-quality-menu{min-width:176px}.cv-imagine-quality-menu button{justify-content:space-between}.cv-imagine-quality-menu b{font-size:10px;font-weight:760;color:var(--cv-muted)}.cv-imagine-quality-menu button.active b{color:currentColor}.cv-imagine-reference-row{display:flex;align-items:flex-start;gap:8px;flex:0 0 auto}.cv-imagine-reference-add{flex:0 0 54px;width:54px;height:54px;border-style:dashed;transition:border-color .15s ease,background .15s ease,color .15s ease,transform .15s ease}.cv-imagine-reference-add:hover{border-color:var(--cv-accent);background:var(--cv-accent-soft);color:var(--cv-accent);transform:translateY(-1px)}.cv-imagine-console textarea{min-height:54px;max-height:180px;resize:none;overflow:hidden;transition:height .16s cubic-bezier(.2,.8,.2,1)}.cv-imagine-generate{color:#fff!important}.cv-imagine-gallery{grid-template-columns:repeat(12,minmax(0,1fr));grid-auto-rows:7px;grid-auto-flow:dense;gap:8px;padding:8px;align-content:start;background:color-mix(in srgb,var(--cv-soft) 86%,var(--cv-bg))}.cv-imagine-tile{grid-column:span 3;grid-row:span 19;border-radius:11px 10px 12px 9px;box-shadow:0 2px 7px color-mix(in srgb,var(--cv-ink) 10%,transparent)}.cv-imagine-tile.vertical{grid-column:span 2;grid-row:span 40}.cv-imagine-tile img{object-fit:contain;background:color-mix(in srgb,var(--cv-ink) 14%,var(--cv-soft))}.cv-imagine-tile:after{content:'View details';left:50%;right:auto;bottom:10px;transform:translate(-50%,4px);white-space:nowrap}.cv-imagine-tile:hover:after{transform:translate(-50%,0)}.cv-imagine-preview{width:min(920px,100%)}.cv-imagine-preview-image{display:grid;max-height:58vh;place-items:center;overflow:hidden;border-radius:15px 13px 16px 12px;background:#151515}.cv-imagine-preview-image img{display:block;max-width:100%;max-height:58vh;object-fit:contain}.cv-imagine-preview-meta{display:grid;grid-template-columns:minmax(0,1fr) repeat(2,minmax(118px,.35fr));gap:10px;margin-top:14px}.cv-imagine-preview-meta>div{min-width:0;padding:11px 12px;border:1px solid var(--cv-hair);border-radius:10px 11px 9px 10px;background:var(--cv-bg)}.cv-imagine-preview-meta span{display:block;margin-bottom:5px;color:var(--cv-muted);font-size:9px;font-weight:760;letter-spacing:.8px;text-transform:uppercase}.cv-imagine-preview-meta p{margin:0;font-size:11.5px;line-height:1.45;overflow-wrap:anywhere}.cv-imagine-preview-meta strong{font-size:12px;line-height:1.4}@media(max-width:1100px){.cv-imagine-gallery{grid-template-columns:repeat(8,minmax(0,1fr))}.cv-imagine-tile{grid-column:span 4}.cv-imagine-tile.vertical{grid-column:span 2}}
    .cv-imagine-console{overflow:visible;isolation:auto;background:color-mix(in srgb,var(--cv-surface) 82%,transparent)}.cv-imagine-console:before,.cv-imagine-console:after{content:none}.cv-imagine-controls{position:relative;z-index:12}.cv-imagine-aspect-picker,.cv-imagine-style-picker{position:relative;z-index:1}.cv-imagine-aspect-picker:has(.cv-imagine-aspect-menu),.cv-imagine-style-picker:has(.cv-imagine-style-menu){z-index:30}.cv-imagine-size-menu{min-width:126px;max-height:min(360px,calc(100vh - 210px));overflow:auto}.cv-imagine-size-menu button{justify-content:flex-start}.cv-imagine-size-menu button span{flex:1;white-space:nowrap}.cv-imagine-size-menu button b{display:none}.cv-imagine-size-menu button.active b{color:currentColor}
    @media(max-width:720px){.cv-imagine-gallery{grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:10px;gap:5px;padding:5px}.cv-imagine-tile.horizontal{grid-column:span 2;grid-row:span 19}.cv-imagine-tile.vertical{grid-column:span 1;grid-row:span 32}.cv-imagine-reference-row{gap:7px}.cv-imagine-preview-meta{grid-template-columns:1fr}.cv-imagine-aspect-trigger,.cv-imagine-style-trigger{height:35px}.cv-imagine-library-count{display:none}}
    /* Imagine gallery: every visual keeps its intrinsic ratio without letting
       a portrait frame monopolize the page. A shared thumbnail height makes
       the newest row calm and predictable, while the width expresses 4:3,
       3:2, 16:9, or portrait naturally. */
    .cv-imagine-gallery{display:flex;flex-direction:column;align-items:stretch;gap:8px;width:100%;min-height:100%;padding:8px;background:color-mix(in srgb,var(--cv-soft) 86%,var(--cv-bg))}.cv-imagine-gallery-row{display:flex;align-items:stretch;gap:8px;width:100%;min-width:0;height:var(--cv-imagine-row-height,220px)}.cv-imagine-tile{display:block;flex:var(--cv-imagine-ratio,1) 1 0;min-width:0;height:100%;aspect-ratio:auto;padding:0;border-radius:11px 10px 12px 9px;background:color-mix(in srgb,var(--cv-ink) 7%,var(--cv-surface));box-shadow:0 2px 7px color-mix(in srgb,var(--cv-ink) 10%,transparent);transition:transform .18s cubic-bezier(.2,.8,.2,1),box-shadow .18s ease}.cv-imagine-gallery.is-entering .cv-imagine-tile{will-change:opacity,transform,filter;animation:cv-imagine-tile-enter .32s cubic-bezier(.18,.86,.28,1) both;animation-delay:min(calc(var(--cv-imagine-stagger,0) * 20ms),300ms)}@keyframes cv-imagine-tile-enter{from{opacity:0;transform:translateY(10px) scale(.985);filter:blur(2px)}to{opacity:1;transform:none;filter:none}}@media(prefers-reduced-motion:reduce){.cv-imagine-gallery.is-entering .cv-imagine-tile{animation:none}}.cv-imagine-tile.vertical,.cv-imagine-tile.horizontal{grid-column:auto;grid-row:auto}.cv-imagine-tile:hover{transform:translateY(-2px);box-shadow:0 9px 22px color-mix(in srgb,var(--cv-ink) 16%,transparent)}.cv-imagine-tile img{display:block;width:100%;height:100%;object-fit:contain;object-position:center;transform:none;transition:filter .18s ease}.cv-imagine-tile:hover img{transform:none;filter:brightness(.84)}.cv-imagine-style-trigger i,.cv-imagine-aspect-trigger>i:last-child{display:none}.cv-imagine-style-trigger,.cv-imagine-aspect-trigger{justify-content:center;min-width:0}.cv-imagine-style-trigger{gap:6px}.cv-imagine-aspect-trigger{gap:7px}.cv-imagine-style-menu,.cv-imagine-aspect-menu{isolation:isolate}.cv-imagine-style-menu button,.cv-imagine-aspect-menu button{margin-block:1px}.cv-imagine-empty{flex:1 0 100%}
    /* Composer controls share a single liquid-glass system and keep the
       primary action anchored to the far edge of the workspace. */
    .cv-imagine-controls{width:100%;min-width:0;gap:10px}.cv-imagine-controls .cv-imagine-generate{margin-left:auto;flex:0 0 auto;min-width:124px;height:39px;padding-inline:18px;border:1px solid color-mix(in srgb,var(--cv-accent) 72%,var(--cv-hair));border-radius:12px 11px 13px 10px;background:linear-gradient(135deg,color-mix(in srgb,var(--cv-accent) 88%,#fff 12%),var(--cv-accent));color:#fff;box-shadow:0 8px 20px color-mix(in srgb,var(--cv-accent) 31%,transparent),inset 0 1px 0 rgba(255,255,255,.36);text-shadow:0 1px 1px rgba(0,0,0,.14)}.cv-imagine-controls .cv-imagine-generate:hover{filter:saturate(1.07) brightness(1.04);box-shadow:0 12px 26px color-mix(in srgb,var(--cv-accent) 39%,transparent),inset 0 1px 0 rgba(255,255,255,.4)}.cv-imagine-aspect-trigger,.cv-imagine-style-trigger{border-color:color-mix(in srgb,var(--cv-surface) 78%,var(--cv-hair));background:linear-gradient(135deg,color-mix(in srgb,var(--cv-surface) 78%,transparent),color-mix(in srgb,var(--cv-accent) 7%,transparent));backdrop-filter:blur(18px) saturate(150%);-webkit-backdrop-filter:blur(18px) saturate(150%);box-shadow:inset 0 1px 0 color-mix(in srgb,var(--cv-surface) 88%,transparent),0 5px 16px color-mix(in srgb,var(--cv-ink) 9%,transparent);transition:transform .18s cubic-bezier(.2,.8,.2,1),border-color .18s ease,background .18s ease,box-shadow .18s ease}.cv-imagine-aspect-trigger:hover,.cv-imagine-style-trigger:hover{border-color:color-mix(in srgb,var(--cv-accent) 48%,var(--cv-hair));background:linear-gradient(135deg,color-mix(in srgb,var(--cv-surface) 86%,transparent),color-mix(in srgb,var(--cv-accent) 13%,transparent));box-shadow:inset 0 1px 0 color-mix(in srgb,var(--cv-surface) 94%,transparent),0 9px 22px color-mix(in srgb,var(--cv-ink) 14%,transparent);transform:translateY(-1px)}.cv-imagine-aspect-menu,.cv-imagine-style-menu{border-color:color-mix(in srgb,var(--cv-surface) 72%,var(--cv-hair));background:color-mix(in srgb,var(--cv-surface) 86%,transparent);backdrop-filter:blur(22px) saturate(155%);-webkit-backdrop-filter:blur(22px) saturate(155%);box-shadow:0 16px 34px color-mix(in srgb,var(--cv-ink) 21%,transparent),inset 0 1px 0 color-mix(in srgb,var(--cv-surface) 85%,transparent)}@media(max-width:720px){.cv-imagine-controls{gap:8px}.cv-imagine-controls .cv-imagine-generate{min-width:108px;margin-left:auto}.cv-imagine-aspect-trigger,.cv-imagine-style-trigger{flex:0 1 auto}}
    /* One consistent liquid-glass menu treatment, including over images. */
    .cv-imagine-aspect-menu,.cv-imagine-style-menu{border-color:color-mix(in srgb,var(--cv-surface) 72%,var(--cv-hair));background:linear-gradient(135deg,color-mix(in srgb,var(--cv-surface) 72%,transparent),color-mix(in srgb,var(--cv-surface) 54%,transparent));backdrop-filter:blur(30px) saturate(165%) brightness(1.08);-webkit-backdrop-filter:blur(30px) saturate(165%) brightness(1.08);box-shadow:0 16px 34px color-mix(in srgb,var(--cv-ink) 24%,transparent),inset 0 1px 0 color-mix(in srgb,var(--cv-surface) 86%,transparent)}
    .cv-imagine-aspect-menu button,.cv-imagine-style-menu button{text-shadow:0 1px 12px color-mix(in srgb,var(--cv-surface) 70%,transparent)}
    .cv-imagine-controls .cv-imagine-generate{min-width:94px;padding-inline:15px}
    /* A pending frame occupies the exact selected aspect ratio immediately.
       It therefore pushes the wall into its final layout before the generated
       file reaches the browser, while later jobs remain independent. */
    .cv-imagine-pending{position:relative;display:grid;place-items:center;overflow:hidden;border:1px dashed color-mix(in srgb,var(--cv-accent) 56%,var(--cv-hair));background:linear-gradient(132deg,color-mix(in srgb,var(--cv-accent-soft) 78%,var(--cv-surface)),color-mix(in srgb,var(--cv-soft) 68%,var(--cv-surface)));pointer-events:none;isolation:isolate;animation:cv-imagine-pending-in .26s cubic-bezier(.2,.8,.2,1) both}.cv-imagine-pending:after{content:none}.cv-imagine-pending:before{content:'';position:absolute;z-index:-1;inset:-38%;background:linear-gradient(112deg,transparent 32%,color-mix(in srgb,var(--cv-surface) 82%,transparent) 49%,transparent 66%);transform:translateX(-50%) rotate(14deg);animation:cv-imagine-sheen 1.7s ease-in-out infinite}.cv-imagine-pending-content{display:grid;justify-items:center;gap:7px;padding:16px;text-align:center;color:var(--cv-ink)}.cv-imagine-pending-content i{display:block;width:24px;height:24px;border:2px solid color-mix(in srgb,var(--cv-accent) 22%,var(--cv-hair));border-top-color:var(--cv-accent);border-radius:50%;animation:cv-spin .78s linear infinite}.cv-imagine-pending-content strong{font-size:14px;font-weight:820;letter-spacing:-.2px}.cv-imagine-pending-content span{color:var(--cv-muted);font-size:10px;font-weight:650}@keyframes cv-imagine-pending-in{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}@keyframes cv-imagine-sheen{0%,18%{transform:translateX(-54%) rotate(14deg)}70%,100%{transform:translateX(54%) rotate(14deg)}}
    /* Imagine preview: the frame receives its own breathing room and the
       inspector stays separate, so portrait and landscape images are never
       forced into the same crop. */
    .cv-imagine-preview-backdrop{padding:18px}.cv-imagine-preview{display:grid;grid-template-columns:minmax(0,1fr) minmax(290px,360px);width:min(1480px,calc(100vw - 36px));height:min(840px,calc(100vh - 36px));max-height:none;overflow:hidden;border:1px solid color-mix(in srgb,var(--cv-surface) 30%,var(--cv-hair));border-radius:22px 19px 23px 18px;background:color-mix(in srgb,var(--cv-ink) 92%,#080909);box-shadow:0 34px 100px rgba(0,0,0,.48)}.cv-imagine-preview-canvas{display:grid;min-width:0;min-height:0;place-items:center;padding:clamp(18px,3vw,48px);background:radial-gradient(circle at 45% 46%,color-mix(in srgb,var(--cv-surface) 11%,transparent),transparent 54%),linear-gradient(135deg,color-mix(in srgb,var(--cv-ink) 96%,#050505),color-mix(in srgb,var(--cv-ink) 82%,#12110f))}.cv-imagine-preview-canvas img{display:block;max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;border-radius:15px 13px 16px 12px;box-shadow:0 18px 48px rgba(0,0,0,.32)}.cv-imagine-inspector{display:flex;min-width:0;min-height:0;flex-direction:column;gap:11px;padding:15px;background:color-mix(in srgb,var(--cv-surface) 13%,transparent);border-left:1px solid color-mix(in srgb,var(--cv-surface) 16%,transparent);color:color-mix(in srgb,var(--cv-surface) 94%,#fff);backdrop-filter:blur(24px) saturate(135%);-webkit-backdrop-filter:blur(24px) saturate(135%)}.cv-imagine-inspector-head{display:flex;align-items:flex-start;gap:11px;padding:3px 2px 5px}.cv-imagine-inspector-head h3{margin:5px 0 0;font-size:18px;letter-spacing:-.28px}.cv-imagine-inspector-head p{margin:4px 0 0;color:color-mix(in srgb,var(--cv-surface) 58%,transparent);font-size:10.5px}.cv-imagine-inspector .cv-eyebrow{color:color-mix(in srgb,var(--cv-accent) 82%,#ffe0a3)}.cv-imagine-inspector .cv-close{margin-left:auto;flex:0 0 auto;border-color:color-mix(in srgb,var(--cv-surface) 18%,transparent);background:color-mix(in srgb,var(--cv-surface) 10%,transparent);color:inherit}.cv-imagine-inspector-card{min-width:0;padding:13px;border:1px solid color-mix(in srgb,var(--cv-surface) 13%,transparent);border-radius:14px 12px 15px 11px;background:color-mix(in srgb,var(--cv-surface) 8%,transparent);box-shadow:inset 0 1px 0 color-mix(in srgb,var(--cv-surface) 10%,transparent)}.cv-imagine-inspector-label{display:block;margin-bottom:9px;color:color-mix(in srgb,var(--cv-surface) 50%,transparent);font-size:9px;font-weight:780;letter-spacing:1px;text-transform:uppercase}.cv-imagine-inspector-card p{display:-webkit-box;margin:0;overflow:hidden;color:color-mix(in srgb,var(--cv-surface) 89%,transparent);font-size:12px;line-height:1.48;-webkit-box-orient:vertical;-webkit-line-clamp:8}.cv-imagine-inspector-details dl{display:grid;gap:8px;margin:0}.cv-imagine-inspector-details dl>div{display:flex;justify-content:space-between;gap:12px}.cv-imagine-inspector-details dt,.cv-imagine-inspector-details dd{margin:0;font-size:11px;line-height:1.35}.cv-imagine-inspector-details dt{color:color-mix(in srgb,var(--cv-surface) 50%,transparent)}.cv-imagine-inspector-details dd{color:color-mix(in srgb,var(--cv-surface) 92%,transparent);font-weight:700;text-align:right}.cv-imagine-preview-references{display:flex;align-items:center;gap:6px;min-height:42px}.cv-imagine-preview-references img{width:42px;height:42px;border:1px solid color-mix(in srgb,var(--cv-surface) 30%,transparent);border-radius:9px 8px 10px 7px;object-fit:cover}.cv-imagine-preview-references span{display:grid;width:42px;height:42px;place-items:center;border-radius:9px;background:color-mix(in srgb,var(--cv-surface) 12%,transparent);color:color-mix(in srgb,var(--cv-surface) 82%,transparent);font-size:11px;font-weight:780}.cv-imagine-preview-none{color:color-mix(in srgb,var(--cv-surface) 52%,transparent);font-size:11px}.cv-imagine-inspector-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:auto;padding-top:3px}.cv-imagine-inspector-actions .cv-btn{min-height:41px;border-color:color-mix(in srgb,var(--cv-surface) 20%,transparent);background:color-mix(in srgb,var(--cv-surface) 10%,transparent);color:color-mix(in srgb,var(--cv-surface) 94%,#fff)}.cv-imagine-inspector-actions .cv-btn.accent{border-color:var(--cv-accent);background:var(--cv-accent);color:#fff}@media(max-width:800px){.cv-imagine-preview-backdrop{padding:10px}.cv-imagine-preview{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) auto;width:100%;height:min(920px,calc(100vh - 20px));overflow:auto}.cv-imagine-preview-canvas{min-height:310px;padding:20px}.cv-imagine-inspector{border-top:1px solid color-mix(in srgb,var(--cv-surface) 16%,transparent);border-left:0}.cv-imagine-inspector-card p{-webkit-line-clamp:4}}
    /* The preview is a calm glass window over the gallery—not a black
       lightbox. The original grid stays perceptible behind it, while the
       image and its inspector retain their own clear, individual surfaces. */
    .cv-imagine-preview-backdrop{background:color-mix(in srgb,var(--cv-bg) 28%,transparent);backdrop-filter:blur(18px) saturate(126%);-webkit-backdrop-filter:blur(18px) saturate(126%)}.cv-imagine-preview{border-color:color-mix(in srgb,var(--cv-surface) 72%,var(--cv-hair));background:color-mix(in srgb,var(--cv-surface) 48%,transparent);box-shadow:0 30px 84px color-mix(in srgb,var(--cv-ink) 26%,transparent),inset 0 1px 0 color-mix(in srgb,var(--cv-surface) 90%,transparent);backdrop-filter:blur(34px) saturate(135%);-webkit-backdrop-filter:blur(34px) saturate(135%)}.cv-imagine-preview-canvas{padding:clamp(22px,3.6vw,56px);background:radial-gradient(circle at 43% 42%,color-mix(in srgb,var(--cv-accent-soft) 42%,transparent),transparent 57%),linear-gradient(135deg,color-mix(in srgb,var(--cv-soft) 76%,transparent),color-mix(in srgb,var(--cv-bg) 54%,transparent))}.cv-imagine-preview-canvas img{box-shadow:0 19px 46px color-mix(in srgb,var(--cv-ink) 23%,transparent),0 0 0 1px color-mix(in srgb,var(--cv-surface) 64%,transparent)}.cv-imagine-inspector{background:color-mix(in srgb,var(--cv-surface) 58%,transparent);border-left-color:color-mix(in srgb,var(--cv-surface) 62%,var(--cv-hair));color:var(--cv-ink);backdrop-filter:blur(32px) saturate(150%);-webkit-backdrop-filter:blur(32px) saturate(150%)}.cv-imagine-inspector-head p,.cv-imagine-inspector-label,.cv-imagine-inspector-details dt,.cv-imagine-preview-none{color:var(--cv-muted)}.cv-imagine-inspector .cv-eyebrow{color:var(--cv-accent)}.cv-imagine-inspector .cv-close{border-color:var(--cv-hair);background:color-mix(in srgb,var(--cv-surface) 65%,transparent);color:var(--cv-ink)}.cv-imagine-inspector-card{border-color:color-mix(in srgb,var(--cv-surface) 72%,var(--cv-hair));background:color-mix(in srgb,var(--cv-surface) 46%,transparent);box-shadow:inset 0 1px 0 color-mix(in srgb,var(--cv-surface) 86%,transparent)}.cv-imagine-inspector-card p,.cv-imagine-inspector-details dd{color:var(--cv-ink)}.cv-imagine-preview-references img{border-color:var(--cv-hair)}.cv-imagine-preview-references span{background:var(--cv-soft);color:var(--cv-ink)}.cv-imagine-inspector-actions .cv-btn{border-color:var(--cv-hair);background:color-mix(in srgb,var(--cv-surface) 58%,transparent);color:var(--cv-ink)}
    /* A frame preview is intentionally just the frame. The gallery stays
       behind the glass; metadata belongs in the item workflow, not here. */
    .cv-imagine-preview-solo{position:relative;display:grid;grid-template-columns:minmax(0,1fr) clamp(330px,22vw,420px);align-items:stretch;gap:clamp(12px,1.25vw,24px);width:calc(100vw - 40px);height:calc(100vh - 40px);max-height:none;overflow:visible;border:0;background:transparent;box-shadow:none;backdrop-filter:none;-webkit-backdrop-filter:none}.cv-imagine-preview-solo-image{display:grid;min-width:0;min-height:0;padding:clamp(8px,1.35vw,26px);place-items:center}.cv-imagine-preview-solo-image>img{display:block;max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;border-radius:16px 14px 17px 13px;box-shadow:0 24px 68px color-mix(in srgb,var(--cv-ink) 35%,transparent),0 0 0 1px color-mix(in srgb,var(--cv-surface) 76%,transparent)}.cv-imagine-preview-solo .cv-imagine-inspector{max-height:none;overflow:auto;border:1px solid color-mix(in srgb,var(--cv-surface) 72%,var(--cv-hair));border-radius:18px 15px 19px 14px;box-shadow:0 20px 54px color-mix(in srgb,var(--cv-ink) 25%,transparent),inset 0 1px 0 color-mix(in srgb,var(--cv-surface) 84%,transparent)}.cv-imagine-preview-solo .cv-close{position:absolute;z-index:2;top:10px;right:10px;width:32px;height:32px;border-color:var(--cv-hair);background:color-mix(in srgb,var(--cv-surface) 72%,transparent);color:var(--cv-ink);box-shadow:0 4px 14px color-mix(in srgb,var(--cv-ink) 18%,transparent);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}.cv-imagine-preview-solo .cv-close:hover{background:var(--cv-surface)}@media(max-width:800px){.cv-imagine-preview-solo{grid-template-columns:1fr;width:min(680px,calc(100vw - 28px));height:auto;max-height:calc(100vh - 28px);overflow:auto}.cv-imagine-preview-solo-image{min-height:310px;padding:14px}.cv-imagine-preview-solo-image>img{max-height:calc(100vh - 300px)}.cv-imagine-preview-solo .cv-imagine-inspector{max-height:none;min-height:250px}.cv-imagine-preview-solo .cv-close{top:8px;right:8px}}
    .cv-imagine-preview-solo{align-items:stretch}.cv-imagine-preview-solo-image{align-self:stretch}.cv-imagine-preview-solo .cv-imagine-inspector{height:100%;max-height:none;background:color-mix(in srgb,var(--cv-surface) 88%,transparent);border-color:color-mix(in srgb,var(--cv-surface) 84%,var(--cv-hair));box-shadow:0 20px 54px color-mix(in srgb,var(--cv-ink) 25%,transparent),inset 0 1px 0 color-mix(in srgb,var(--cv-surface) 96%,transparent)}.cv-imagine-preview-solo .cv-imagine-inspector-card{background:color-mix(in srgb,var(--cv-surface) 76%,transparent);border-color:color-mix(in srgb,var(--cv-surface) 88%,var(--cv-hair))}.cv-imagine-preview-solo .cv-imagine-inspector-card p,.cv-imagine-preview-solo .cv-imagine-inspector-details dd{color:var(--cv-ink);opacity:1}.cv-imagine-preview-solo .cv-imagine-inspector-head p,.cv-imagine-preview-solo .cv-imagine-inspector-label,.cv-imagine-preview-solo .cv-imagine-inspector-details dt{color:var(--cv-muted);opacity:1}.cv-imagine-preview-reference{position:relative;display:block;width:42px;height:42px;padding:0;border:0;border-radius:9px 8px 10px 7px;overflow:hidden;background:transparent;cursor:pointer}.cv-imagine-preview-reference img{display:block;width:100%;height:100%;border:1px solid var(--cv-hair);border-radius:inherit;object-fit:cover}.cv-imagine-preview-reference span{position:absolute;inset:0;display:grid;width:auto;height:auto;place-items:center;border-radius:inherit;background:color-mix(in srgb,var(--cv-ink) 68%,transparent);color:#fff;font-size:9px;font-weight:780;letter-spacing:.2px;opacity:0;transition:opacity .16s ease}.cv-imagine-preview-reference:hover span,.cv-imagine-preview-reference:focus-visible span{opacity:1}.cv-imagine-preview-reference:focus-visible{outline:2px solid var(--cv-accent);outline-offset:2px}
    /* Imagine is a scrollable visual wall. The reserved tail lets the last
       row travel above the fixed composer instead of disappearing behind it. */
    .cv-imagine-stage{display:block;height:calc(100dvh - 44px);min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-gutter:stable}.cv-imagine-gallery{min-height:100%;padding:8px 8px clamp(310px,35vh,440px)}.cv-imagine-stage::-webkit-scrollbar{width:10px}.cv-imagine-stage::-webkit-scrollbar-thumb{border:3px solid transparent;border-radius:999px;background:color-mix(in srgb,var(--cv-ink) 30%,transparent);background-clip:padding-box}.cv-imagine-stage::-webkit-scrollbar-track{background:transparent}@media(max-width:720px){.cv-imagine-stage{height:calc(100dvh - 44px)}.cv-imagine-gallery{padding:5px 5px 350px}}
    /* The image never exceeds its available canvas. This is particularly
       important for 9:16 and 2:3 frames, which must be seen in full. */
    .cv-imagine-preview-solo-image{overflow:hidden;max-height:calc(100dvh - 40px)}.cv-imagine-preview-solo-image>img{max-inline-size:100%;max-block-size:calc(100dvh - 92px);width:auto!important;height:auto!important;object-fit:contain;object-position:center}@media(max-width:800px){.cv-imagine-preview-solo-image{max-height:none;overflow:visible}.cv-imagine-preview-solo-image>img{max-block-size:calc(100dvh - 300px)}}
    /* One shared, glassy reference browser powers Boards and generated frames. */
    .cv-storyboard-image-modal{width:min(920px,100%)}.cv-visual-reference-modal{width:min(1080px,100%)}.cv-visual-reference-picker{margin-top:17px;padding:13px;border:1px solid color-mix(in srgb,var(--cv-hair) 82%,transparent);border-radius:17px 14px 18px 15px;background:color-mix(in srgb,var(--cv-surface) 72%,transparent);box-shadow:inset 0 1px 0 color-mix(in srgb,var(--cv-surface) 78%,transparent),0 12px 30px color-mix(in srgb,var(--cv-ink) 8%,transparent);backdrop-filter:blur(20px) saturate(150%);-webkit-backdrop-filter:blur(20px) saturate(150%);transition:border-color .18s ease,box-shadow .18s ease,background .18s ease}.cv-visual-reference-picker.is-dragging{border-color:var(--cv-accent);background:color-mix(in srgb,var(--cv-accent-soft) 42%,var(--cv-surface));box-shadow:0 0 0 4px var(--cv-accent-soft),0 16px 34px color-mix(in srgb,var(--cv-ink) 12%,transparent)}.cv-visual-reference-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:12px}.cv-visual-reference-head h4{margin:5px 0 0;font-size:14px;letter-spacing:-.18px}.cv-visual-reference-head p{max-width:440px;margin:4px 0 0;color:var(--cv-muted);font-size:10.5px;line-height:1.42}.cv-visual-reference-tabs{display:flex;flex:0 0 auto;gap:3px;padding:3px;border:1px solid color-mix(in srgb,var(--cv-hair) 80%,transparent);border-radius:10px;background:color-mix(in srgb,var(--cv-soft) 74%,transparent)}.cv-visual-reference-tabs button{height:29px;border:0;border-radius:7px;background:transparent;color:var(--cv-muted);padding:0 8px;font-size:9.5px;font-weight:750;white-space:nowrap;cursor:pointer;transition:color .15s ease,background .15s ease}.cv-visual-reference-tabs button:hover,.cv-visual-reference-tabs button.active{background:var(--cv-surface);color:var(--cv-accent);box-shadow:0 1px 4px color-mix(in srgb,var(--cv-ink) 9%,transparent)}.cv-visual-reference-layout{display:grid;grid-template-columns:108px minmax(0,1fr);gap:11px;min-height:176px}.cv-visual-reference-upload-wrap{display:grid;align-content:start;gap:7px}.cv-visual-reference-upload-wrap>span{color:var(--cv-muted);font-size:8.5px;font-weight:650;line-height:1.25;text-align:center}.cv-visual-reference-upload{display:grid;align-content:center;justify-items:center;gap:5px;min-height:132px;width:100%;padding:12px 7px;border:1px dashed color-mix(in srgb,var(--cv-accent) 66%,var(--cv-hair));border-radius:13px 11px 14px 10px;background:linear-gradient(135deg,color-mix(in srgb,var(--cv-accent-soft) 45%,transparent),color-mix(in srgb,var(--cv-surface) 68%,transparent));color:var(--cv-accent);cursor:pointer;transition:transform .16s cubic-bezier(.2,.8,.2,1),border-color .16s ease,background .16s ease,box-shadow .16s ease}.cv-visual-reference-upload:hover{transform:translateY(-2px);border-style:solid;border-color:var(--cv-accent);background:var(--cv-accent-soft);box-shadow:0 8px 18px color-mix(in srgb,var(--cv-ink) 10%,transparent)}.cv-visual-reference-upload svg{width:34px;height:24px}.cv-visual-reference-upload strong{font-size:10px}.cv-visual-reference-upload small{color:var(--cv-muted);font-size:8.5px}.cv-visual-reference-gallery{display:grid;grid-auto-flow:row dense;grid-template-columns:repeat(12,minmax(0,1fr));grid-auto-rows:8px;align-content:start;gap:7px;max-height:264px;min-height:176px;overflow:auto;padding:1px 2px 5px}.cv-visual-reference-card{position:relative;grid-column:span var(--vr-cols);grid-row:span var(--vr-rows);display:block;min-width:0;overflow:hidden;padding:0;border:1px solid color-mix(in srgb,var(--cv-ink) 26%,var(--cv-hair));border-radius:11px 9px 12px 10px;background:var(--cv-soft);cursor:pointer;box-shadow:0 2px 7px color-mix(in srgb,var(--cv-ink) 8%,transparent);transition:transform .16s cubic-bezier(.2,.8,.2,1),border-color .16s ease,box-shadow .16s ease}.cv-visual-reference-card:hover{z-index:1;transform:translateY(-2px);border-color:var(--cv-accent);box-shadow:0 9px 22px color-mix(in srgb,var(--cv-ink) 16%,transparent)}.cv-visual-reference-card.is-selected{border-color:var(--cv-accent);box-shadow:0 0 0 3px var(--cv-accent-soft),0 9px 22px color-mix(in srgb,var(--cv-ink) 16%,transparent)}.cv-visual-reference-card img{display:block;width:100%;height:100%;object-fit:cover}.cv-visual-reference-card-copy{position:absolute;z-index:1;right:0;bottom:0;left:0;display:grid;gap:2px;padding:18px 7px 6px;background:linear-gradient(transparent,rgba(18,18,17,.75));color:#fff;text-align:left;opacity:0;transform:translateY(4px);transition:opacity .15s ease,transform .16s ease}.cv-visual-reference-card:hover .cv-visual-reference-card-copy,.cv-visual-reference-card:focus-visible .cv-visual-reference-card-copy{opacity:1;transform:none}.cv-visual-reference-card-copy strong{overflow:hidden;font-size:9.5px;line-height:1.15;text-overflow:ellipsis;white-space:nowrap}.cv-visual-reference-card-copy small{font-size:8px;opacity:.78}.cv-visual-reference-check{position:absolute;z-index:2;top:6px;right:6px;display:grid;width:20px;height:20px;place-items:center;border:1px solid color-mix(in srgb,var(--cv-surface) 80%,transparent);border-radius:7px 6px 8px 6px;background:var(--cv-accent);color:#fff;font-size:11px;font-weight:900;box-shadow:0 3px 9px rgba(0,0,0,.18)}.cv-visual-reference-empty{grid-column:1/-1;display:grid;place-content:center;justify-items:center;gap:7px;min-height:165px;padding:16px;text-align:center;color:var(--cv-muted)}.cv-visual-reference-empty strong{color:var(--cv-ink);font-size:12px}.cv-visual-reference-empty span{max-width:250px;font-size:10px;line-height:1.45}.cv-visual-reference-empty .cv-btn{margin-top:3px;min-height:31px;font-size:10px}@media(max-width:680px){.cv-visual-reference-head{display:grid;gap:10px}.cv-visual-reference-tabs{width:100%;overflow:auto}.cv-visual-reference-tabs button{flex:0 0 auto}.cv-visual-reference-layout{grid-template-columns:86px minmax(0,1fr);gap:9px}.cv-visual-reference-upload{min-height:116px}.cv-visual-reference-gallery{grid-template-columns:repeat(8,minmax(0,1fr));max-height:245px}.cv-visual-reference-card{grid-column:span max(2,calc(var(--vr-cols) - 1));grid-row:span var(--vr-rows)}}
    .cv-visually-hidden{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
    .cv-module-loading-shell{display:grid;min-height:clamp(500px,72dvh,780px);padding:clamp(28px,6vw,72px) 18px;place-items:center;background:radial-gradient(circle at 50% 44%,color-mix(in srgb,var(--cv-accent) 9%,transparent),transparent 48%)}
    .cv-module-loader{position:relative;isolation:isolate;width:min(680px,100%);overflow:hidden;padding:clamp(25px,4.5vw,42px);border:1px solid color-mix(in srgb,var(--cv-ink) 25%,transparent);border-radius:26px 22px 29px 20px / 22px 28px 21px 26px;background:linear-gradient(145deg,color-mix(in srgb,var(--cv-surface) 76%,transparent),color-mix(in srgb,var(--cv-soft) 52%,transparent));box-shadow:0 26px 72px color-mix(in srgb,var(--cv-ink) 14%,transparent),inset 0 1px 0 color-mix(in srgb,#fff 72%,transparent);backdrop-filter:blur(28px) saturate(145%);-webkit-backdrop-filter:blur(28px) saturate(145%);animation:cvModuleLoaderIn .28s cubic-bezier(.2,.8,.2,1) both}.cv-module-loader:before{content:"";position:absolute;z-index:-1;width:390px;height:390px;top:-270px;left:-110px;border-radius:45% 55% 48% 52%;background:radial-gradient(circle at 58% 64%,color-mix(in srgb,var(--cv-accent) 24%,transparent),transparent 64%);animation:cvModuleLoaderDrift 4.2s ease-in-out infinite alternate}.cv-module-loader:after{content:"";position:absolute;inset:4px;pointer-events:none;border:1px solid color-mix(in srgb,var(--cv-ink) 15%,transparent);border-radius:22px 20px 25px 18px;opacity:.48}
    .cv-module-loader-head{display:grid;grid-template-columns:58px minmax(0,1fr);align-items:center;gap:18px}.cv-module-loader-mark{position:relative;display:grid;width:58px;height:58px;place-items:center;border:1px solid color-mix(in srgb,var(--cv-accent) 38%,transparent);border-radius:19px 16px 21px 15px;background:color-mix(in srgb,var(--cv-surface) 62%,transparent);box-shadow:0 12px 25px color-mix(in srgb,var(--cv-accent) 15%,transparent),inset 0 1px 0 color-mix(in srgb,#fff 70%,transparent);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}.cv-module-loader-mark:before{content:"";position:absolute;inset:7px;border:1px solid color-mix(in srgb,var(--cv-accent) 35%,transparent);border-radius:50%;animation:cvModuleOrbit 1.8s linear infinite}.cv-module-loader-mark:after{content:"";position:absolute;top:5px;left:26px;width:6px;height:6px;border-radius:50%;background:var(--cv-accent);box-shadow:0 0 0 4px color-mix(in srgb,var(--cv-accent) 14%,transparent)}.cv-module-loader-mark span{position:absolute;display:block;border:1.5px solid var(--cv-accent);border-radius:7px 6px 8px 5px}.cv-module-loader-mark span:nth-child(1){width:27px;height:20px;transform:translate(-4px,-3px) rotate(-5deg);opacity:.46}.cv-module-loader-mark span:nth-child(2){width:28px;height:21px;transform:translate(4px,3px) rotate(4deg);animation:cvCanvasFrame 1.45s ease-in-out infinite}.cv-module-loader-mark span:nth-child(3){width:6px;height:6px;border:0;border-radius:50%;background:var(--cv-accent);transform:translate(8px,-5px)}
    .cv-module-loader-kicker{display:block;color:var(--cv-accent);font-size:9.5px;font-weight:820;letter-spacing:1.55px;text-transform:uppercase}.cv-module-loader h2{margin:6px 0 0;color:var(--cv-ink);font-size:clamp(22px,3vw,31px);font-weight:790;letter-spacing:-.9px;line-height:1.05}.cv-module-loader p{margin:8px 0 0;color:var(--cv-muted);font-size:12px;line-height:1.52}.cv-module-loader-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:30px}.cv-module-loader-cell{position:relative;min-height:112px;overflow:hidden;border:1px solid color-mix(in srgb,var(--cv-ink) 18%,transparent);border-radius:17px 14px 19px 13px;background:color-mix(in srgb,var(--cv-surface) 55%,transparent);box-shadow:0 12px 25px color-mix(in srgb,var(--cv-ink) 6%,transparent),inset 0 1px 0 color-mix(in srgb,#fff 65%,transparent);backdrop-filter:blur(20px) saturate(120%);-webkit-backdrop-filter:blur(20px) saturate(120%);animation:cvModuleCell 1.65s ease-in-out infinite;animation-delay:calc(var(--loader-cell) * 90ms)}.cv-module-loader-cell:before{content:"";position:absolute;inset:0;background:linear-gradient(108deg,transparent 20%,color-mix(in srgb,#fff 52%,transparent) 43%,transparent 66%);transform:translateX(-120%);animation:cvModuleShimmer 1.65s ease-in-out infinite;animation-delay:calc(var(--loader-cell) * 90ms)}.cv-module-loader-cell i,.cv-module-loader-cell b,.cv-module-loader-cell span{position:absolute;left:15px;display:block;border-radius:999px;background:color-mix(in srgb,var(--cv-muted) 16%,transparent)}.cv-module-loader-cell i{top:15px;width:7px;height:7px;background:var(--cv-accent);box-shadow:0 0 0 4px color-mix(in srgb,var(--cv-accent) 13%,transparent)}.cv-module-loader-cell b{top:35px;width:43%;height:7px}.cv-module-loader-cell span{top:56px;width:calc(100% - 30px);height:6px;box-shadow:0 15px 0 color-mix(in srgb,var(--cv-muted) 11%,transparent),0 30px 0 color-mix(in srgb,var(--cv-muted) 8%,transparent)}.cv-module-loader-status{display:flex;align-items:center;gap:9px;margin-top:18px;color:var(--cv-muted);font-size:10.5px;font-weight:650}.cv-module-loader-status:before{content:"";width:8px;height:8px;border-radius:50%;background:var(--cv-accent);animation:cvModulePulse 1.25s ease-out infinite}
    .cv-imagine-loading-stage{min-height:calc(100dvh - 44px);padding:8px;overflow:hidden;background:color-mix(in srgb,var(--cv-soft) 86%,var(--cv-bg))}.cv-imagine-skeleton-gallery{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));grid-auto-rows:88px;gap:8px;min-height:100%;align-content:start}.cv-imagine-skeleton{position:relative;grid-column:span 3;grid-row:span 2;overflow:hidden;border:1px solid color-mix(in srgb,var(--cv-hair) 78%,transparent);border-radius:13px 11px 14px 10px;background:linear-gradient(145deg,color-mix(in srgb,var(--cv-surface) 60%,transparent),color-mix(in srgb,var(--cv-soft) 78%,transparent));box-shadow:0 7px 18px color-mix(in srgb,var(--cv-ink) 8%,transparent),inset 0 1px 0 color-mix(in srgb,#fff 45%,transparent);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);animation:cvImagineSkeletonFloat 1.75s ease-in-out infinite;animation-delay:calc(var(--skeleton-index) * 55ms)}.cv-imagine-skeleton.wide{grid-column:span 5}.cv-imagine-skeleton.portrait{grid-column:span 2;grid-row:span 3}.cv-imagine-skeleton:before{content:"";position:absolute;inset:0;background:linear-gradient(105deg,transparent 22%,color-mix(in srgb,#fff 50%,transparent) 45%,transparent 68%);transform:translateX(-120%);animation:cvImagineSkeletonShimmer 1.7s ease-in-out infinite;animation-delay:calc(var(--skeleton-index) * 55ms)}.cv-imagine-skeleton:after{content:"";position:absolute;left:14px;bottom:14px;width:42%;height:7px;border-radius:999px;background:color-mix(in srgb,var(--cv-muted) 14%,transparent);box-shadow:0 -18px 0 -1px color-mix(in srgb,var(--cv-accent) 16%,transparent)}
    .cv-imagine-tile.is-image-loading:before{content:"";position:absolute;z-index:1;inset:0;background:linear-gradient(105deg,color-mix(in srgb,var(--cv-soft) 88%,var(--cv-surface)) 20%,color-mix(in srgb,#fff 44%,transparent) 46%,color-mix(in srgb,var(--cv-soft) 88%,var(--cv-surface)) 72%);background-size:240% 100%;animation:cvImageTileShimmer 1.35s ease-in-out infinite}.cv-imagine-tile.is-image-loading:after{display:none}.cv-imagine-tile.is-image-loading img{opacity:0!important;filter:none!important}.cv-imagine-tile img{opacity:1;transition:opacity .18s ease,filter .18s ease}.cv-imagine-tile.is-image-error img{opacity:.08;filter:grayscale(1)}
    @keyframes cvModuleLoaderIn{from{opacity:0;transform:translateY(9px) scale(.985)}to{opacity:1;transform:none}}@keyframes cvModuleLoaderDrift{to{transform:translate(32px,18px) rotate(8deg)}}@keyframes cvModuleOrbit{to{transform:rotate(360deg)}}@keyframes cvCanvasFrame{0%,100%{transform:translate(4px,3px) rotate(4deg)}50%{transform:translate(2px,0) rotate(1deg)}}@keyframes cvModuleCell{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px);border-color:color-mix(in srgb,var(--cv-accent) 34%,transparent)}}@keyframes cvModuleShimmer{45%,100%{transform:translateX(120%)}}@keyframes cvModulePulse{70%,100%{box-shadow:0 0 0 8px color-mix(in srgb,var(--cv-accent) 0%,transparent)}}@keyframes cvImagineSkeletonFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}@keyframes cvImagineSkeletonShimmer{45%,100%{transform:translateX(120%)}}@keyframes cvImageTileShimmer{0%{background-position:120% 0}100%{background-position:-120% 0}}
    @media(max-width:760px){.cv-module-loader{padding:24px 20px}.cv-module-loader-head{grid-template-columns:50px minmax(0,1fr);gap:13px}.cv-module-loader-mark{width:50px;height:50px}.cv-module-loader-grid{gap:8px}.cv-module-loader-cell{min-height:92px}.cv-module-loader-cell:nth-child(3){display:none}.cv-imagine-skeleton-gallery{grid-template-columns:repeat(6,minmax(0,1fr));grid-auto-rows:72px;gap:5px}.cv-imagine-skeleton{grid-column:span 3}.cv-imagine-skeleton.wide{grid-column:span 4}.cv-imagine-skeleton.portrait{grid-column:span 2;grid-row:span 3}}
    :host([scope="account"]){height:calc(100dvh - 56px);min-height:0;overflow:hidden}:host([scope="account"]) .cv-root,:host([scope="account"]) .cv-imagine-page,:host([scope="account"]) .cv-imagine-stage{height:100%;min-height:0}:host([scope="account"]) .cv-imagine-gallery{min-height:100%;overflow:auto;overscroll-behavior:contain;padding-bottom:190px;scrollbar-color:color-mix(in srgb,var(--cv-muted) 52%,transparent) transparent}:host([scope="account"]) .cv-imagine-empty{min-height:100%}:host([scope="account"]) .cv-imagine-loading-stage{height:100%;min-height:0}:host([scope="account"]) .cv-imagine-tile:after{display:none}
    @media(prefers-reduced-motion:reduce){.cv-module-loader,.cv-module-loader:before,.cv-module-loader-mark:before,.cv-module-loader-mark span,.cv-module-loader-cell,.cv-module-loader-cell:before,.cv-module-loader-status:before,.cv-imagine-skeleton,.cv-imagine-skeleton:before,.cv-imagine-tile.is-image-loading:before{animation:none!important}}
    @media(prefers-reduced-transparency:reduce){.cv-module-loader,.cv-module-loader-mark,.cv-module-loader-cell,.cv-imagine-skeleton{background:var(--cv-surface);backdrop-filter:none;-webkit-backdrop-filter:none}}
  `;

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const tr = (value) => {
    const text = String(value ?? '');
    return window.filmscriptLanguage?.get?.() === 'es'
      ? (window.filmscriptLanguage?.t?.(text, 'es') || text)
      : text;
  };
  const localize = (english, spanish) => window.filmscriptLanguage?.get?.() === 'es' ? spanish : english;
  const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const money = (value) => `$${num(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const today = () => new Date().toISOString().slice(0, 10);
  const uid = (prefix) => {
    const bytes = new Uint8Array(10);
    crypto.getRandomValues(bytes);
    return `${prefix}_${[...bytes].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
  };
  const typeLabels = { art: 'Art', photo: 'Photo', video: 'Video', blank: 'Blank' };
  const icon = (name) => {
    const paths = {
      settings: '<circle cx="12" cy="12" r="3"/><path d="M19 13.5a1.7 1.7 0 0 0 .3 1.9l.1.1-2 2-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.1h-3v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-2-2 .1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1h-.1v-3h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-2 .1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.1h3v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 2 2-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1v3h-.1a1.7 1.7 0 0 0-1.6 1Z"/>',
      search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 4 4"/>',
      shot: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="m3 10 18-4M8 8l2-3M14 7l2-3"/>',
      vault: '<path d="M4 7h16v13H4zM3 7l2-4h14l2 4M9 11h6v5H9z"/>',
      boards: '<rect x="4" y="4" width="7" height="9" rx="1"/><rect x="13" y="4" width="7" height="5" rx="1"/><rect x="13" y="11" width="7" height="9" rx="1"/><rect x="4" y="15" width="7" height="5" rx="1"/>',
      image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="16" cy="9" r="2"/><path d="m5 17 5-5 3 3 2-2 4 4"/>',
      text: '<path d="M5 5h14M12 5v14M8 19h8"/>', note: '<path d="M5 3h14v15l-3 3H5zM8 8h8M8 12h6"/>',
      plus: '<path d="M12 5v14M5 12h14"/>', back: '<path d="m15 5-7 7 7 7"/>',
      grid: '<rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/>',
      select: '<path d="m5 3 14 8-6 2 3 6-3 1-3-6-5 4z"/>',
      hand: '<path d="M8 11V5a1.5 1.5 0 0 1 3 0v5V4a1.5 1.5 0 0 1 3 0v6V6a1.5 1.5 0 0 1 3 0v6V9a1.5 1.5 0 0 1 3 0v5c0 4-2.5 7-6.5 7H12c-2.6 0-4.1-1.3-5.2-3.2L4.5 14a1.6 1.6 0 0 1 2.7-1.6L8 14"/>',
      eraser: '<path d="m7 20-3-3a2.2 2.2 0 0 1 0-3.1l7.7-7.7a2.2 2.2 0 0 1 3.1 0l4.7 4.7a2.2 2.2 0 0 1 0 3.1L13.8 20H7Z"/><path d="m9 20 7-7"/>',
      list: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
      upload: '<path d="M12 16V4m0 0L7 9m5-5 5 5M4 15v5h16v-5"/>',
      duplicate: '<rect x="8" y="8" width="11" height="11" rx="1.5"/><path d="M16 8V5.8A1.8 1.8 0 0 0 14.2 4H5.8A1.8 1.8 0 0 0 4 5.8v8.4A1.8 1.8 0 0 0 5.8 16H8"/>',
      group: '<circle cx="8" cy="11" r="3"/><circle cx="16" cy="11" r="3"/><path d="M10.5 9.5h3M10.5 12.5h3"/>',
      align: '<path d="M5 4v16M8 7h10M8 12h7M8 17h12"/>',
      download: '<path d="M12 4v10m0 0 4-4m-4 4-4-4M5 19h14"/>',
      delete: '<path d="M4 7h16M10 11v5M14 11v5M9 7l1-3h4l1 3M6 7l1 13h10l1-13"/>',
      undo: '<path d="M9 7 4 12l5 5"/><path d="M5 12h8a6 6 0 0 1 6 6"/>', redo: '<path d="m15 7 5 5-5 5"/><path d="M19 12h-8a6 6 0 0 0-6 6"/>',
      dots: '<circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/>',
      landscape: '<circle cx="47" cy="9" r="4"/><path d="M4 34 19 18l10 10 8-8 22 14M8 10q3-3 6 0 3-3 6 0"/>',
    };
    const viewBox = name === 'landscape' ? '0 0 64 40' : '0 0 24 24';
    return `<svg viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.note}</svg>`;
  };

  class FilmScriptCanvasWorkspace extends HTMLElement {
    static get observedAttributes() { return ['script-id', 'project-title', 'initial-view', 'scope']; }

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.state = {
        loading: true, error: '', workspace: null, view: 'home', selected: new Set(),
        search: '', category: '', availability: '', condition: '', storage: '', sort: 'recent',
        itemModal: false, itemSaving: false, editingItemId: '', itemDetailId: '', boardModal: false,
        quoteDraft: null, quoteSaving: false, activeBoardId: '', boardContext: null,
        vaultMenu: null, boardMenu: null, pickerMode: '', boardTool: 'select', toast: '', autosave: 'Saved',
        storyboardImageModal: false, storyboardImageGenerating: false, storyboardReferenceIds: [],
        visualReferencePicker: null, visualReferencePickerSource: 'imagine', visualReferencePickerDragging: false,
        imaginePendingJobs: [], imagineReferenceIds: [], imagineDragging: false, imagineStyle: 'cinematic', imagineStyleMenu: false,
        imagineMediaMode: '', imagineModelId: '', imagineMediaModeExplicit: false, imagineModelIdExplicit: false,
        imagineOrientation: 'horizontal', imagineAspectMenu: false, imagineSize: '1536x1024', imagineSizeMenu: false, imagineQuality: 'low', imagineQualityMenu: false, imaginePrompt: '', imaginePreviewId: '',
        entitlements: null, accountTier: 'free', accountAuthenticated: null,
      };
      this._history = [];
      this._future = [];
      this._historyLimit = 60;
      this._textHistoryKey = '';
      this._textHistoryTimer = 0;
      this._boardSaveTimer = 0;
      // A save can finish after the user has undone a change. Keep an
      // increasing revision so a stale response never replaces newer local
      // Board state.
      this._boardSaveRevision = 0;
      this._toastTimer = 0;
      this._pendingVaultFiles = [];
      this._pendingVaultPreviewUrls = [];
      this._pendingBoardFile = null;
      this._imagineJobSequence = 0;
      this._imagineAnimateNextRender = false;
      // Keep the first Imagine render eligible for its entrance motion too.
      // A direct live link starts with `initial-view="imagine"`, so it does
      // not pass through a view-change event before the workspace is loaded.
      this._imagineEntrancePending = true;
      this._imagineRecoveryTimers = new Map();
      this._imagineLayoutTimer = 0;
      this._loadRetryTimer = 0;
      this._loadRetryCount = 0;
      this._onLanguageChange = () => {
        if (this.isConnected) this.render();
      };
      this._onImagineViewportResize = () => {
        clearTimeout(this._imagineLayoutTimer);
        this._imagineLayoutTimer = setTimeout(() => {
          if (this.isConnected && this.state.view === 'imagine') this.render();
        }, 120);
      };
    }

    get scriptId() { return this.getAttribute('script-id') || ''; }
    get projectTitle() { return this.getAttribute('project-title') || 'Untitled screenplay'; }
    get accountScoped() { return this.getAttribute('scope') === 'account'; }

    _isImagineOnlyWorkspace() {
      return this.accountScoped
        || ['imagine', 'account_imaging', 'standalone_imaging'].includes(this.state.workspace?.accessScope);
    }

    _getWorkspace() {
      return this.accountScoped
        ? window.filmscriptCanvas.getAccountImaging()
        : window.filmscriptCanvas.get(this.scriptId);
    }

    _generateImage(options) {
      return this.accountScoped
        ? window.filmscriptCanvas.generateAccountImagingImage(options)
        : window.filmscriptCanvas.generateStoryboardImage(this.scriptId, options);
    }

    connectedCallback() {
      if (!this._bound) {
        this._bound = true;
        this.shadowRoot.addEventListener('click', (event) => this._onClick(event));
        // Vault images are delivered from the production media store.  A brief
        // network hiccup must not leave the card showing raw alt text forever:
        // retry once with a cache-busting URL, then use the intentional empty
        // state instead of a broken-image glyph.
        this.shadowRoot.addEventListener('error', (event) => this._onImageError(event), true);
        // Imagine assets can arrive from older renders without trustworthy
        // dimensions. Read the browser's decoded dimensions as a visual
        // fallback so the gallery never crops a real 4:3 or portrait frame.
        this.shadowRoot.addEventListener('load', (event) => this._onImageLoad(event), true);
        this.shadowRoot.addEventListener('input', (event) => this._onInput(event));
        this.shadowRoot.addEventListener('change', (event) => this._onChange(event));
        this.shadowRoot.addEventListener('submit', (event) => this._onSubmit(event));
        this.shadowRoot.addEventListener('contextmenu', (event) => this._onContextMenu(event));
        this.shadowRoot.addEventListener('dragover', (event) => this._onDragOver(event));
        this.shadowRoot.addEventListener('dragleave', (event) => this._onDragLeave(event));
        this.shadowRoot.addEventListener('drop', (event) => this._onDrop(event));
        this.shadowRoot.addEventListener('paste', (event) => this._onPaste(event));
        this.shadowRoot.addEventListener('pointerdown', (event) => this._onPointerDown(event));
        this.shadowRoot.addEventListener('wheel', (event) => this._onWheel(event), { passive: false });
        this.shadowRoot.addEventListener('keydown', (event) => this._onKeyDown(event));
      }
      window.addEventListener('resize', this._onImagineViewportResize, { passive: true });
      if (!this._canvasDragHandler) this._canvasDragHandler = (event) => this._applyRemoteCanvasDrag(event.detail);
      if (!this._canvasOperationHandler) this._canvasOperationHandler = (event) => this._applyRemoteCanvasOperation(event.detail);
      window.addEventListener('filmscript:canvas.drag', this._canvasDragHandler);
      window.addEventListener('filmscript:content.operation', this._canvasOperationHandler);
      window.addEventListener('filmscript:language-change', this._onLanguageChange);
      this.load();
    }

    disconnectedCallback() {
      clearTimeout(this._boardSaveTimer);
      clearTimeout(this._toastTimer);
      clearTimeout(this._textHistoryTimer);
      clearTimeout(this._imagineLayoutTimer);
      clearTimeout(this._loadRetryTimer);
      this._loadRetryTimer = 0;
      window.removeEventListener('resize', this._onImagineViewportResize);
      window.removeEventListener('filmscript:canvas.drag', this._canvasDragHandler);
      window.removeEventListener('filmscript:content.operation', this._canvasOperationHandler);
      window.removeEventListener('filmscript:language-change', this._onLanguageChange);
      this._clearImagineRecoveryTimers();
      this._stopPointerInteraction();
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (name === 'scope' && oldValue !== newValue && this.isConnected) {
        this.state.imaginePendingJobs = [];
        this.load();
        return;
      }
      if (name === 'script-id' && newValue && oldValue !== newValue && this.isConnected) {
        // A request belongs to the screenplay that started it. Do not let an
        // in-flight frame leave a visual placeholder in the next screenplay.
        this.state.imaginePendingJobs = [];
        this.load();
      }
      if (name === 'initial-view' && oldValue !== newValue && this.isConnected && this.state.workspace) {
        if (this._isImagineOnlyWorkspace()) {
          this.state.view = 'imagine';
          this.render();
          return;
        }
        if (newValue === 'imagine') this._imagineEntrancePending = true;
        this.state.view = newValue === 'imagine' ? 'imagine' : (['home', 'vault', 'boards'].includes(this.state.workspace.settings?.lastTool) ? this.state.workspace.settings.lastTool : 'home');
        this.render();
      }
    }

    _resetLoadRetry() {
      clearTimeout(this._loadRetryTimer);
      this._loadRetryTimer = 0;
      this._loadRetryCount = 0;
    }

    _retryLoadWhenClientReady() {
      clearTimeout(this._loadRetryTimer);
      if (this._loadRetryCount >= 20) {
        this._loadRetryTimer = 0;
        this.state.loading = false;
        if (this.accountScoped) this.state.error = localize('Imagine is not available right now.', 'Imagine no está disponible en este momento.');
        else this.state.error = 'Canvas is not available right now.';
        this.render();
        return;
      }
      this._loadRetryCount += 1;
      this._loadRetryTimer = window.setTimeout(() => {
        this._loadRetryTimer = 0;
        if (this.isConnected) this.load({ preserveClientRetry: true });
      }, 250);
    }

    async load({ preserveClientRetry = false } = {}) {
      if (!preserveClientRetry) this._resetLoadRetry();
      if (!this.accountScoped && !this.scriptId) {
        this.state.loading = false;
        this.state.error = 'Canvas is not available for this screenplay.';
        this.render();
        return;
      }
      const accountClientReady = !this.accountScoped || (
        typeof window.filmscriptCanvas?.getAccountImaging === 'function'
        && typeof window.filmscriptCanvas?.generateAccountImagingImage === 'function'
        && typeof window.filmscriptCanvas?.uploadAccountImagingAsset === 'function'
        && typeof window.filmscriptCanvas?.accountImagingAssetUrl === 'function'
      );
      if (!window.filmscriptCanvas) {
        this.state.loading = true;
        this.state.error = '';
        this.render();
        this._retryLoadWhenClientReady();
        return;
      }
      if (!accountClientReady) {
        this.state.loading = true;
        this.state.error = '';
        this.render();
        this._retryLoadWhenClientReady();
        return;
      }
      this._resetLoadRetry();
      this.state.loading = true;
      this.render();
      try {
        const [result, account] = await Promise.all([
          this._getWorkspace(),
          this.getAccountEntitlements(),
        ]);
        this.state.workspace = result.workspace;
        this._syncImagineCapabilities(result.workspace);
        this._restoreImagineJobs(result.workspace);
        if (account) {
          this.state.entitlements = account.entitlements || {};
          this.state.accountTier = account.tier || account.plan || 'free';
          this.state.accountAuthenticated = Boolean(account.authenticated);
        }
        this.state.loading = false;
        this.state.error = '';
        const requested = this.getAttribute('initial-view');
        if (requested === 'imagine') this._imagineEntrancePending = true;
        this.state.view = this.accountScoped || ['imagine', 'account_imaging', 'standalone_imaging'].includes(result.workspace?.accessScope) || requested === 'imagine' ? 'imagine' : ['home', 'vault', 'boards'].includes(result.workspace?.settings?.lastTool)
          ? result.workspace.settings.lastTool
          : 'home';
      } catch (error) {
        this.state.loading = false;
        this.state.error = error.message || (this.accountScoped
          ? localize('Imagine could not be loaded.', 'No se pudo cargar Imagine.')
          : 'Canvas could not be loaded.');
      }
      this.render();
    }

    assetUrl(assetId) {
      if (!assetId) return '';
      return this.accountScoped
        ? window.filmscriptCanvas.accountImagingAssetUrl(assetId)
        : window.filmscriptCanvas.assetUrl(this.scriptId, assetId);
    }
    asset(assetId) { return this.state.workspace?.assets?.find((entry) => entry.id === assetId) || null; }
    activeBoard() { return this.state.workspace?.boards?.find((board) => board.id === this.state.activeBoardId) || null; }

    _normalizeImagineCapabilityOptions(value, fallback = []) {
      const supplied = Array.isArray(value) || Boolean(value && typeof value === 'object');
      const entries = Array.isArray(value)
        ? value
        : (value && typeof value === 'object'
          ? Object.entries(value).map(([id, option]) => (
            option && typeof option === 'object' && !Array.isArray(option)
              ? { id, ...option }
              : { id, enabled: Boolean(option) }
          ))
          : []);
      const normalized = entries.map((option) => {
        const source = typeof option === 'string' ? { id: option, label: option } : (option || {});
        const id = String(source.id || source.value || '').trim().toLowerCase();
        const status = String(source.status || '').trim().toLowerCase();
        const enabled = source.enabled !== false
          && source.available !== false
          && !['disabled', 'unavailable', 'hidden'].includes(status);
        return {
          id,
          label: String(source.labels?.en || source.label || source.name || id).trim(),
          labelEs: String(source.labels?.es || source.labelEs || source.spanishLabel || '').trim(),
          mediaMode: String(source.mediaMode || '').trim().toLowerCase(),
          enabled,
        };
      }).filter((option) => option.id && option.enabled);
      return normalized.length || supplied ? normalized : fallback.map((option) => ({ ...option, enabled: true }));
    }

    _imagineCapabilities(workspace = this.state.workspace) {
      const capabilities = workspace?.capabilities && typeof workspace.capabilities === 'object'
        ? workspace.capabilities
        : {};
      const mediaModes = this._normalizeImagineCapabilityOptions(capabilities.mediaModes, [
        { id: 'image', label: 'Image', mediaMode: '' },
      ]);
      const models = this._normalizeImagineCapabilityOptions(capabilities.models ?? capabilities.imageModels, [
        { id: 'imagine-image-v1', label: 'Imagine Image', mediaMode: 'image' },
      ]);
      const suppliedDefaults = capabilities.defaults && typeof capabilities.defaults === 'object'
        ? capabilities.defaults
        : {};
      const defaultMediaMode = String(suppliedDefaults.mediaMode || '').trim().toLowerCase();
      const mediaMode = mediaModes.some((option) => option.id === defaultMediaMode)
        ? defaultMediaMode
        : (mediaModes[0]?.id || '');
      const modelsForDefaultMode = models.filter((option) => !option.mediaMode || option.mediaMode === mediaMode);
      const defaultModelId = String(suppliedDefaults.modelId || suppliedDefaults.imageModelId || '').trim().toLowerCase();
      const modelId = modelsForDefaultMode.some((option) => option.id === defaultModelId)
        ? defaultModelId
        : (modelsForDefaultMode[0]?.id || models[0]?.id || '');
      return { mediaModes, models, imageModels: models, defaults: { mediaMode, modelId } };
    }

    _imagineModelsForMode(capabilities, mediaMode) {
      return capabilities.models.filter((option) => !option.mediaMode || option.mediaMode === mediaMode);
    }

    _syncImagineCapabilities(workspace = this.state.workspace) {
      const capabilities = this._imagineCapabilities(workspace);
      const requestedMediaMode = String(this.state.imagineMediaMode || '').trim().toLowerCase();
      const mediaMode = this.state.imagineMediaModeExplicit && capabilities.mediaModes.some((option) => option.id === requestedMediaMode)
        ? requestedMediaMode
        : capabilities.defaults.mediaMode;
      const models = this._imagineModelsForMode(capabilities, mediaMode);
      const requestedModelId = String(this.state.imagineModelId || '').trim().toLowerCase();
      const modelId = this.state.imagineModelIdExplicit && models.some((option) => option.id === requestedModelId)
        ? requestedModelId
        : (models.some((option) => option.id === capabilities.defaults.modelId)
          ? capabilities.defaults.modelId
          : (models[0]?.id || ''));
      this.state.imagineMediaMode = mediaMode;
      this.state.imagineModelId = modelId;
      return capabilities;
    }

    _imagineCapabilityLabel(option) {
      if (option.id === 'image') return localize('Image', 'Imagen');
      if (option.id === 'video') return 'Video';
      if (window.filmscriptLanguage?.get?.() === 'es') {
        if (option.labelEs) return option.labelEs;
        if (/^Imagine Image\b/i.test(option.label || '')) return String(option.label).replace(/^Imagine Image\b/i, 'Imagen Imagine');
      }
      return option.label || option.id;
    }

    _imagineJobsOwnerId() {
      return this.accountScoped ? String(this.state.workspace?.ownerUserId || '') : '';
    }

    _imagineJobsStorageKey() {
      if (!this.accountScoped) return `filmscript_imagine_jobs_${this.scriptId}`;
      const ownerUserId = this._imagineJobsOwnerId();
      return /^usr_[a-zA-Z0-9_-]+$/.test(ownerUserId) ? `filmscript_imaging_jobs_account_${ownerUserId}` : '';
    }

    _imagineJobsStorage() { return this.accountScoped ? window.sessionStorage : window.localStorage; }

    _readSavedImagineJobs() {
      try {
        const storageKey = this._imagineJobsStorageKey();
        if (!storageKey) return [];
        if (this.accountScoped) this._imagineJobsStorage().removeItem('filmscript_imaging_jobs_account');
        const saved = JSON.parse(this._imagineJobsStorage().getItem(storageKey) || '[]');
        const oldestAllowed = Date.now() - (30 * 60 * 1000);
        const ownerUserId = this._imagineJobsOwnerId();
        return (Array.isArray(saved) ? saved : []).map((job) => ({
          ...job,
          // Jobs saved before account capabilities were introduced must keep
          // their original request fingerprint during refresh recovery.
          mediaMode: String(job?.mediaMode || 'image').trim().toLowerCase(),
          modelId: String(job?.modelId || 'imagine-image-v1').trim().toLowerCase(),
        })).filter((job) => (
          /^imagine-job_[a-f0-9]+$/.test(String(job?.id || ''))
          && Number(job?.createdAtMs || 0) >= oldestAllowed
          && String(job?.prompt || '').trim().length >= 8
          && (!this.accountScoped || String(job?.ownerUserId || '') === ownerUserId)
        )).slice(-8);
      } catch { return []; }
    }

    _saveImagineJobs(jobs = this.state.imaginePendingJobs) {
      try {
        const storageKey = this._imagineJobsStorageKey();
        if (!storageKey) return;
        this._imagineJobsStorage().setItem(storageKey, JSON.stringify((jobs || []).slice(-8)));
      } catch { /* A live request still completes normally. */ }
    }

    _clearImagineRecoveryTimers(jobId = '') {
      for (const [id, timer] of this._imagineRecoveryTimers) {
        if (jobId && id !== jobId) continue;
        clearTimeout(timer);
        this._imagineRecoveryTimers.delete(id);
      }
    }

    _assetForImagineJob(jobId, workspace = this.state.workspace) {
      return (workspace?.assets || []).find((asset) => asset?.source === 'imagine' && asset?.generation?.requestId === jobId) || null;
    }

    _finishImagineJob(job, asset = null) {
      this._clearImagineRecoveryTimers(job.id);
      this.state.imaginePendingJobs = this.state.imaginePendingJobs.filter((entry) => entry.id !== job.id);
      this._saveImagineJobs();
      if (asset) {
        this.state.workspace.assets = Array.isArray(this.state.workspace?.assets) ? this.state.workspace.assets : [];
        if (!this.state.workspace.assets.some((entry) => entry.id === asset.id)) this.state.workspace.assets.push(asset);
      }
    }

    _restoreImagineJobs(workspace) {
      this._clearImagineRecoveryTimers();
      const saved = this._readSavedImagineJobs();
      const pending = saved.filter((job) => !this._assetForImagineJob(job.id, workspace));
      this.state.imaginePendingJobs = pending;
      this._saveImagineJobs(pending);
      pending.forEach((job) => this._watchImagineJob(job));
    }

    _watchImagineJob(job) {
      if (!job?.id || this._imagineRecoveryTimers.has(job.id)) return;
      const check = async () => {
        this._imagineRecoveryTimers.delete(job.id);
        if (!this.state.imaginePendingJobs.some((entry) => entry.id === job.id)) return;
        try {
          const result = await this._getWorkspace();
          if (result?.workspace) this.state.workspace = result.workspace;
          const completed = this._assetForImagineJob(job.id, result?.workspace);
          if (completed) {
            this._finishImagineJob(job, completed);
            this._imagineAnimateNextRender = true;
            this.render();
            return;
          }
        } catch { /* Keep watching: a refresh must survive a brief network loss. */ }
        // If the original browser request was terminated before it reached the
        // provider, replay the same idempotent request after its full timeout.
        // The server returns an existing frame if it had actually completed.
        if (Date.now() - Number(job.createdAtMs || 0) >= 135_000) return this._submitImagineJob(job, true);
        this._imagineRecoveryTimers.set(job.id, setTimeout(check, 4000));
      };
      this._imagineRecoveryTimers.set(job.id, setTimeout(check, 4000));
    }

    async _submitImagineJob(job, isRecovery = false) {
      if (!job?.id || !this.state.imaginePendingJobs.some((entry) => entry.id === job.id)) return;
      this._clearImagineRecoveryTimers(job.id);
      const capabilities = this._imagineCapabilities();
      const mediaMode = String(job.mediaMode || '').trim().toLowerCase();
      const modelId = String(job.modelId || '').trim().toLowerCase();
      const mediaModeSupported = capabilities.mediaModes.some((option) => option.id === mediaMode);
      const modelSupported = this._imagineModelsForMode(capabilities, mediaMode).some((option) => option.id === modelId);
      if (!mediaModeSupported || !modelSupported) {
        if (isRecovery) {
          // A saved request is immutable. Check once more for the original
          // result, then retire its placeholder rather than replaying it with
          // a newer default model and risking a duplicate charge/output.
          try {
            const result = await this._getWorkspace();
            if (result?.workspace) this.state.workspace = result.workspace;
            const completed = this._assetForImagineJob(job.id, result?.workspace);
            if (completed) {
              this._finishImagineJob(job, completed);
              this._imagineAnimateNextRender = true;
              this.render();
              return;
            }
          } catch { /* The immutable request still must not be replayed. */ }
        }
        this._finishImagineJob(job);
        this.toast(localize(
          'This saved Imagine request can no longer be retried with its original model.',
          'Esta solicitud guardada de Imagine ya no puede reintentarse con su modelo original.',
        ));
        this.render();
        return;
      }
      try {
        const result = await this._generateImage({
          prompt: job.prompt,
          mediaMode,
          modelId,
          orientation: job.orientation,
          size: job.size,
          style: job.style,
          quality: job.quality || 'low',
          mode: 'imagine-freeform',
          referenceAssetIds: job.referenceAssetIds,
          requestId: job.id,
        });
        if (result?.pending) {
          this._watchImagineJob(job);
          return;
        }
        if (!result?.asset?.id) throw new Error('The image was not returned.');
        this._finishImagineJob(job, result.asset);
        this._imagineAnimateNextRender = true;
        this.toast(isRecovery
          ? localize('Your image finished after reload.', 'Tu imagen terminó después de recargar.')
          : this.accountScoped
            ? localize('Image ready in your Imagine gallery.', 'Imagen lista en tu galería de Imagine.')
            : 'Image ready to reuse across FilmScript.');
      } catch (error) {
        if (isRecovery && (!error?.status || error.status >= 500)) {
          // Retain the job for one more passive check rather than spending a
          // second image credit during a transient provider outage.
          this._imagineRecoveryTimers.set(job.id, setTimeout(() => {
            this._imagineRecoveryTimers.delete(job.id);
            this._watchImagineJob(job);
          }, 10000));
          return;
        }
        this._finishImagineJob(job);
        if (!this.handleImageGenerationError(error)) this.toast(error?.message || 'The image could not be generated.');
      }
    }

    imagineAssetRatio(asset) {
      const width = num(asset?.width);
      const height = num(asset?.height);
      const stored = num(asset?.generation?.aspectRatio);
      const fallback = asset?.generation?.orientation === 'vertical' ? (2 / 3) : (3 / 2);
      const ratio = width > 0 && height > 0 ? width / height : (stored > 0 ? stored : fallback);
      return Math.max(.38, Math.min(2.8, ratio));
    }

    imagineSizeOptions() {
      return [
        // Each entry is an exact, documented GPT Image 2 size. The UI stays
        // deliberately human: it displays the framing ratio, not pixel jargon.
        { value: '1536x1024', label: '3:2', compact: '3:2', orientation: 'horizontal', ratio: 3 / 2 },
        { value: '2048x1152', label: '16:9', compact: '16:9', orientation: 'horizontal', ratio: 16 / 9 },
        { value: '1024x1024', label: '1:1', compact: '1:1', orientation: 'square', ratio: 1 },
        { value: '1024x1536', label: '2:3', compact: '2:3', orientation: 'vertical', ratio: 2 / 3 },
        { value: '2160x3840', label: '9:16', compact: '9:16', orientation: 'vertical', ratio: 9 / 16 },
      ];
    }

    imagineSizeOption(value) {
      return this.imagineSizeOptions().find((entry) => entry.value === value) || this.imagineSizeOptions()[0];
    }

    imagineStyleLabel(value) {
      return ({
        cinematic: localize('Cinematic', 'Cinematográfico'),
        animated: localize('Animated', 'Animado'),
        sketch: localize('Sketch', 'Boceto'),
        anime: 'Anime',
      })[value] || value;
    }

    imagineQualityLabel(value) {
      return ({
        low: localize('Low', 'Baja'),
        medium: localize('Medium', 'Media'),
        high: localize('High', 'Alta'),
      })[value] || value;
    }

    imagineCreditLabel(count) { return localize(`${count} credits`, `${count} créditos`); }

    imagineFormatLabel(asset) {
      const generation = asset?.generation || {};
      const rawSize = String(generation.requestedSize || generation.actualSize || '').toLowerCase();
      const matched = rawSize.match(/^(\d+)x(\d+)$/);
      const width = matched ? Number(matched[1]) : num(asset?.width);
      const height = matched ? Number(matched[2]) : num(asset?.height);
      if (width > 0 && height > 0) {
        const gcd = (left, right) => right ? gcd(right, left % right) : left;
        const divisor = gcd(Math.round(width), Math.round(height));
        return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
      }
      return generation.orientation === 'vertical' ? '2:3' : generation.orientation === 'square' ? '1:1' : '3:2';
    }

    imagineImages() {
      const timestamp = (asset) => Date.parse(asset?.createdAt || '') || 0;
      // The index fallback keeps a just-created frame ahead of an older one
      // even if two records happen to share a timestamp.
      return (this.state.workspace?.assets || [])
        .map((asset, index) => ({ asset, index }))
        .filter(({ asset }) => asset.source === 'imagine')
        .sort((left, right) => timestamp(right.asset) - timestamp(left.asset) || right.index - left.index)
        .map(({ asset }) => asset);
    }

    imagineGalleryEntries() {
      const timestamp = (value) => Number(value?.createdAtMs) || Date.parse(value?.createdAt || '') || 0;
      const completed = this.imagineImages().map((asset, index) => ({
        type: 'image',
        id: asset.id,
        asset,
        ratio: this.imagineAssetRatio(asset),
        createdAt: asset.createdAt,
        createdAtMs: Date.parse(asset.createdAt || '') || 0,
        sequence: index,
      }));
      const pending = (this.state.imaginePendingJobs || []).map((job) => ({ type: 'pending', ...job }));
      return [...pending, ...completed]
        .sort((left, right) => timestamp(right) - timestamp(left) || Number(right.sequence || 0) - Number(left.sequence || 0));
    }

    imagineJustifiedRows(entries) {
      const gallery = this.shadowRoot?.querySelector('.cv-imagine-gallery');
      const availableWidth = Math.max(320, (gallery?.clientWidth || window.innerWidth || 1280) - 16);
      const gap = availableWidth < 720 ? 6 : 8;
      const targetHeight = Math.max(150, Math.min(286, availableWidth * .17));
      const rows = [];
      let row = [];
      let ratioTotal = 0;
      const finalize = () => {
        if (!row.length) return;
        rows.push({ entries: row, height: Math.max(108, (availableWidth - gap * (row.length - 1)) / ratioTotal) });
        row = [];
        ratioTotal = 0;
      };
      entries.forEach((entry) => {
        const ratio = Math.max(.38, Math.min(2.8, num(entry.ratio, 16 / 9)));
        const nextTotal = ratioTotal + ratio;
        const nextWidth = (nextTotal * targetHeight) + (gap * row.length);
        if (row.length && nextWidth > availableWidth * 1.04) finalize();
        row.push({ ...entry, ratio });
        ratioTotal += ratio;
      });
      // A solitary final image would become disproportionately tall. Fold it
      // into the row above; both rows stay full-width and visually calm.
      if (row.length === 1 && rows.length) {
        const previous = rows.pop().entries;
        row = [...previous, ...row];
        ratioTotal = row.reduce((total, entry) => total + entry.ratio, 0);
      }
      finalize();
      return rows;
    }

    renderImagineTile(entry, index = 0) {
      const vertical = entry.ratio < 1;
      const style = `--cv-imagine-ratio:${entry.ratio.toFixed(4)};--cv-imagine-stagger:${Math.min(index, 15)}`;
      if (entry.type === 'pending') {
        const product = 'Imagine';
        const productMarkup = '<strong>Imagine</strong>';
        const direction = vertical ? localize('vertical', 'vertical') : localize('horizontal', 'horizontal');
        return `<div class="cv-imagine-tile cv-imagine-pending ${vertical ? 'vertical' : 'horizontal'}" style="${style}" data-imagine-entry="pending:${esc(entry.id)}" aria-busy="true" aria-label="${product} ${esc(localize(`is creating a ${direction} frame`, `está creando una imagen ${direction}`))}"><span class="cv-imagine-pending-content"><i aria-hidden="true"></i>${productMarkup}<span>${esc(localize('Creating your frame', 'Creando tu imagen'))}</span></span></div>`;
      }
      const asset = entry.asset;
      const dimensions = num(asset.width) > 0 && num(asset.height) > 0 ? `${Math.round(num(asset.width))} × ${Math.round(num(asset.height))}` : '';
      const viewLabel = localize('View generated image', 'Ver imagen generada');
      return `<button class="cv-imagine-tile is-image-loading ${vertical ? 'vertical' : 'horizontal'}" style="${style}" data-imagine-entry="asset:${esc(asset.id)}" data-action="imagine-preview" data-id="${asset.id}" title="${esc(dimensions ? `${viewLabel}, ${dimensions}` : viewLabel)}"><img loading="lazy" decoding="async" src="${esc(this.assetUrl(asset.id))}" alt="${esc(asset.prompt || localize('Generated visual', 'Imagen generada'))}"></button>`;
    }

    entitlementEnabled(value) { return value === true || value?.allowed === true; }

    async getAccountEntitlements({ refresh = false } = {}) {
      const reader = window.filmscriptEntitlements;
      if (!reader?.get) return null;
      try { return await (refresh && reader.refresh ? reader.refresh() : reader.get()); } catch { return null; }
    }

    hasImageGenerationAccess() {
      return this.entitlementEnabled(this.state.entitlements?.imageGeneration);
    }

    imageGenerationMessage({ exhausted = false } = {}) {
      return exhausted
        ? localize('Your image credits are used for this cycle. They renew automatically; each image uses 3 credits.', 'Tus créditos de imagen se agotaron para este ciclo. Se renuevan automáticamente; cada imagen usa 3 créditos.')
        : localize('Image generation is included with FilmScript Creator and Full. Creator includes 100 image credits each month; Full includes 1,000; each image uses 3 credits.', 'La generación de imágenes está incluida con FilmScript Creator y Full. Creator incluye 100 créditos de imagen al mes; Full incluye 1,000; cada imagen usa 3 créditos.');
    }

    presentImageGenerationUpgrade({ exhausted = false, error = 'image_generation_plan_required', message = '', requiredTier = 'creator', checkoutPlan = '', source = '' } = {}) {
      const detail = {
        error: exhausted ? 'image_credits_exhausted' : error,
        requiredTier,
        checkoutPlan,
        source,
        message: message || this.imageGenerationMessage({ exhausted }),
      };
      this.toast(detail.message);
      window.dispatchEvent(new CustomEvent('filmscript:pro-required', { detail }));
      window.dispatchEvent(new CustomEvent('filmscript:upgrade-required', { detail }));
    }

    async ensureImageGeneration() {
      const account = await this.getAccountEntitlements({ refresh: true });
      if (account) {
        this.state.entitlements = account.entitlements || {};
        this.state.accountTier = account.tier || account.plan || 'free';
        this.state.accountAuthenticated = Boolean(account.authenticated);
      }
      // Authentication and connection failures remain server-owned. Manual
      // Canvas, Board, Vault, and reference-upload workflows never pass here.
      if (!account || !account.authenticated || this.hasImageGenerationAccess()) return true;
      this.presentImageGenerationUpgrade({ exhausted: ['creator', 'full'].includes(this.state.accountTier) });
      return false;
    }

    handleImageGenerationError(error) {
      const code = error?.code || error?.data?.error || '';
      if (!['image_generation_plan_required', 'image_credits_exhausted', 'paid_plan_required', 'full_plan_required'].includes(code)) return false;
      if (!error?.entitlementNotified) {
        this.presentImageGenerationUpgrade({
          exhausted: code === 'image_credits_exhausted',
          error: code,
          message: error?.message || '',
        });
      } else {
        this.toast(error?.message || this.imageGenerationMessage({ exhausted: code === 'image_credits_exhausted' }));
      }
      return true;
    }

    async openStoryboardImageModal() {
      if (!await this.ensureImageGeneration()) return;
      this.state.boardContext = null;
      this.state.visualReferencePicker = { target: 'board-generate' };
      this.state.visualReferencePickerSource = 'imagine';
      this.state.storyboardReferenceIds = [];
      this.state.storyboardImageModal = true;
      this.state.storyboardImageGenerating = false;
      this.render();
    }

    async downloadGeneratedImage(assetId) {
      const asset = this.asset(assetId);
      const source = this.assetUrl(assetId);
      if (!asset || !source) return;
      try {
        const response = await fetch(source, { credentials: 'include' });
        if (!response.ok) throw new Error('Download failed');
        const blob = await response.blob();
        const extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `FilmScript-${String(asset.prompt || 'generated-visual').replace(/[^a-z0-9_-]+/gi, '-').slice(0, 60)}.${extension}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.toast('Image downloaded');
      } catch (error) {
        this.toast('Could not download this image. Please try again.');
      }
    }

    async downloadBoardSelection() {
      const board = this.activeBoard();
      const element = board?.elements?.find((entry) => this.state.selected.has(entry.id) && (entry.type === 'image' || (entry.type === 'vault' && entry.assetId)));
      if (!element) return this.toast('Select an image to download.');
      const assetId = element.assetId || this.state.workspace?.vaultItems?.find((item) => item.id === element.vaultItemId)?.mainImageId;
      if (!assetId) return this.toast('This image is no longer available.');
      const asset = this.asset(assetId) || { prompt: element.content || 'board-reference' };
      const source = this.assetUrl(assetId);
      try {
        const response = await fetch(source, { credentials: 'include' });
        if (!response.ok) throw new Error('Download failed');
        const blob = await response.blob();
        const extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `FilmScript-${String(asset.prompt || element.content || 'board-reference').replace(/[^a-z0-9_-]+/gi, '-').slice(0, 60)}.${extension}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.toast('Image downloaded');
      } catch (error) {
        this.toast('Could not download this image. Please try again.');
      }
    }

    setView(view) {
      if (this._isImagineOnlyWorkspace() && view !== 'imagine') view = 'imagine';
      if (view === 'shotlist') {
        this.dispatchEvent(new CustomEvent('filmscript:canvas-shotlist', { bubbles: true, composed: true }));
        return;
      }
      if (view === 'vault') window.filmscriptSounds?.play?.('vaultOpen');
      // Imagine is a blank visual canvas. References belong to the active
      // composer only, never to a screenplay or a previous workspace view.
      if (view === 'imagine' && this.state.view !== 'imagine') {
        this.state.imagineReferenceIds = [];
        this._imagineEntrancePending = true;
      }
      this.state.view = view;
      this.state.selected.clear();
      this.state.vaultMenu = null;
      this.state.boardMenu = null;
      if (this.state.workspace && !this._isImagineOnlyWorkspace()) {
        this.state.workspace.settings.lastTool = view === 'board' || view === 'quote' ? 'boards' : view === 'imagine' ? 'home' : view;
        window.filmscriptCanvas.update(this.scriptId, { settings: this.state.workspace.settings }).catch(() => {});
      }
      this.render();
    }

    toast(message) {
      this.state.toast = message;
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => { this.state.toast = ''; this.render(); }, 2200);
      this.render();
    }

    _isImagineLoadingTarget() {
      return this.accountScoped
        || this.getAttribute('initial-view') === 'imagine'
        || this.state.view === 'imagine'
        || ['imagine', 'account_imaging', 'standalone_imaging'].includes(this.state.workspace?.accessScope);
    }

    _renderCanvasLoading() {
      const title = esc(tr('Loading Canvas'));
      const copy = esc(tr('Connecting your visual references and boards.'));
      return `<div class="cv-module-loading-shell" aria-busy="true"><section class="cv-module-loader cv-module-loader--canvas" role="status" aria-live="polite" aria-atomic="true"><div class="cv-module-loader-head"><div class="cv-module-loader-mark" aria-hidden="true"><span></span><span></span><span></span></div><div><span class="cv-module-loader-kicker">FilmScript · ${esc(tr('Canvas'))}</span><h2>${title}</h2><p>${copy}</p></div></div><div class="cv-module-loader-grid" aria-hidden="true"><div class="cv-module-loader-cell" style="--loader-cell:0"><i></i><b></b><span></span></div><div class="cv-module-loader-cell" style="--loader-cell:1"><i></i><b></b><span></span></div><div class="cv-module-loader-cell" style="--loader-cell:2"><i></i><b></b><span></span></div></div><div class="cv-module-loader-status">${title}</div></section></div>`;
    }

    _renderImagineLoading() {
      const label = esc(this.accountScoped
        ? localize('Loading your Imagine gallery', 'Cargando tu galería de Imagine')
        : tr('Loading your Imagine gallery'));
      const tiles = [
        'wide', 'square', 'portrait', 'wide', 'portrait', 'square',
        'wide', 'square', 'portrait', 'wide', 'square', 'portrait',
      ].map((shape, index) => `<div class="cv-imagine-skeleton ${shape}" style="--skeleton-index:${index}" aria-hidden="true"></div>`).join('');
      return `<section class="cv-imagine-loading-stage" role="status" aria-live="polite" aria-atomic="true" aria-busy="true" aria-label="${label}"><span class="cv-visually-hidden">${label}. ${esc(tr('Frames will appear as soon as they are ready.'))}</span><div class="cv-imagine-skeleton-gallery">${tiles}</div></section>`;
    }

    render() {
      if (!this.state.loading && this._canPatchBoard()) {
        this._patchBoard();
        return;
      }
      const animateImagineReflow = this._imagineAnimateNextRender && this.state.view === 'imagine';
      const previousImagineTiles = animateImagineReflow ? this._captureImagineTileRects() : null;
      this._imagineAnimateNextRender = false;
      const content = this.state.loading
        ? (this._isImagineLoadingTarget() ? this._renderImagineLoading() : this._renderCanvasLoading())
        : this.state.error
          ? `<div class="cv-empty"><div><h3>${esc(this.accountScoped ? localize('Imagine could not open', 'No se pudo abrir Imagine') : 'Canvas could not open')}</h3><p>${esc(this.state.error)}</p><button class="cv-btn" data-action="retry">${esc(localize('Try again', 'Intentar de nuevo'))}</button></div></div>`
          : this._renderView();
      const overlays = this.state.loading ? '' : this._renderOverlays();
      this.shadowRoot.innerHTML = `<style>${STYLE}</style><div class="cv-root">${content}</div>${overlays}${this.state.toast ? `<div class="cv-toast" role="status">${esc(this.state.toast)}</div>` : ''}`;
      if (this.state.view === 'board') requestAnimationFrame(() => this._positionBoardLayer());
      if (animateImagineReflow) requestAnimationFrame(() => this._animateImagineReflow(previousImagineTiles));
    }

    _captureImagineTileRects() {
      return new Map([...this.shadowRoot.querySelectorAll('[data-imagine-entry]')].map((tile) => [
        tile.dataset.imagineEntry,
        tile.getBoundingClientRect(),
      ]));
    }

    _animateImagineReflow(previousTiles) {
      const tiles = [...this.shadowRoot.querySelectorAll('[data-imagine-entry]')];
      if (!tiles.length) return;
      for (const tile of tiles) {
        const previous = previousTiles?.get(tile.dataset.imagineEntry);
        const current = tile.getBoundingClientRect();
        if (!previous) {
          tile.animate([
            { opacity: 0, transform: 'scale(.94)' },
            { opacity: 1, transform: 'scale(1)' },
          ], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'none' });
          continue;
        }
        const deltaX = previous.left - current.left;
        const deltaY = previous.top - current.top;
        if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) continue;
        tile.animate([
          { transform: `translate(${deltaX}px, ${deltaY}px)` },
          { transform: 'translate(0, 0)' },
        ], { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'none' });
      }
    }

    _canPatchBoard() {
      return this.state.view === 'board'
        && Boolean(this.shadowRoot.querySelector('.cv-board-shell'))
        // A partial board patch must never leave an old modal on screen. This
        // used to keep the Vault picker visible after an item was chosen.
        && !this.shadowRoot.querySelector('.cv-modal-backdrop,.cv-menu-pop,.cv-context')
        && !this.state.boardContext
        && !this.state.pickerMode
        && !this.state.itemModal
        && !this.state.boardModal
        && !this.state.storyboardImageModal
        && !this.state.vaultMenu
        && !this.state.boardMenu;
    }

    _patchBoard() {
      const board = this.activeBoard();
      const shell = this.shadowRoot.querySelector('.cv-board-shell');
      const layer = this.shadowRoot.querySelector('[data-board-layer]');
      const viewport = this.shadowRoot.querySelector('[data-board-viewport]');
      if (!board || !shell || !layer || !viewport) return;
      board.elements = Array.isArray(board.elements) ? board.elements : [];
      board.viewport = { x: 0, y: 0, zoom: 1, ...(board.viewport || {}) };
      const selected = this.state.selected;
      layer.innerHTML = board.elements.filter((element) => !element.hidden)
        .map((element) => this._renderBoardElement(element, selected.has(element.id))).join('');
      const empty = viewport.querySelector('.cv-board-empty');
      if (empty && board.elements.length) empty.remove();
      if (!empty && !board.elements.length) {
        const message = document.createElement('div');
        message.className = 'cv-board-empty';
        message.innerHTML = `<h3>${esc(typeLabels[board.type])} Board</h3><p>Start with one image, Vault item, or note. You can move and resize everything later.</p>`;
        viewport.appendChild(message);
      }
      this._syncBoardSelection();
      this._updateBoardChrome();
      requestAnimationFrame(() => this._boardNewElementIds?.clear());
    }

    _syncBoardSelection() {
      const shell = this.shadowRoot.querySelector('.cv-board-shell');
      if (!shell) return;
      const selected = this.state.selected;
      shell.querySelectorAll('[data-element-id]').forEach((node) => node.classList.toggle('selected', selected.has(node.dataset.elementId)));
      const toolbar = shell.querySelector('.cv-element-toolbar');
      if (toolbar) toolbar.remove();
      if (this.state.boardTool === 'select' && selected.size) {
        const nextToolbar = document.createElement('div');
        nextToolbar.className = 'cv-element-toolbar';
        nextToolbar.style.cssText = 'left:18px;top:70px';
        nextToolbar.innerHTML = `<button data-action="board-duplicate-selection">Duplicate</button><button data-action="board-group-selection" ${selected.size > 1 ? '' : 'disabled'}>Group</button><button data-action="board-align-left" ${selected.size > 1 ? '' : 'disabled'}>Align left</button><button data-action="board-delete-selection" style="color:#B24C47">Delete</button>`;
        shell.appendChild(nextToolbar);
      }
    }

    _updateBoardChrome() {
      const board = this.activeBoard();
      const shell = this.shadowRoot.querySelector('.cv-board-shell');
      if (!board || !shell) return;
      const save = shell.querySelector('.cv-board-save');
      if (save) save.textContent = this.state.autosave;
      const title = shell.querySelector('[data-field="board-title"]');
      if (title && document.activeElement !== title) title.value = board.title || '';
      const zoom = shell.querySelector('.cv-board-zoom span');
      if (zoom) zoom.textContent = `${Math.round(board.viewport.zoom * 100)}%`;
      const snap = shell.querySelector('[data-action="board-snap"]');
      if (snap) snap.classList.toggle('active', Boolean(board.settings?.snapToGrid));
      const undo = shell.querySelector('[data-action="board-undo"]');
      const redo = shell.querySelector('[data-action="board-redo"]');
      if (undo) undo.disabled = !this._history.length;
      if (redo) redo.disabled = !this._future.length;
      shell.querySelectorAll('[data-action^="board-tool-"]').forEach((button) => {
        const active = button.dataset.action === `board-tool-${this.state.boardTool || 'select'}`;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      const viewport = shell.querySelector('[data-board-viewport]');
      if (viewport) viewport.className = `cv-board-viewport tool-${this.state.boardTool || 'select'}`;
      this._positionBoardLayer();
      if (this.state.toast) {
        let toast = this.shadowRoot.querySelector('.cv-toast');
        if (!toast) { toast = document.createElement('div'); toast.className = 'cv-toast'; toast.setAttribute('role', 'status'); this.shadowRoot.appendChild(toast); }
        toast.textContent = this.state.toast;
      } else this.shadowRoot.querySelector('.cv-toast')?.remove();
    }

    _renderView() {
      if (this.state.view === 'board') return this._renderBoardEditor();
      if (this.state.view === 'quote') return `<main class="cv-page">${this._renderQuoteBuilder()}</main>`;
      const body = this.state.view === 'vault' ? this._renderVault() : this.state.view === 'boards' ? this._renderBoards() : this.state.view === 'imagine' ? this._renderImagine() : this._renderHome();
      return `<main class="cv-page ${this.state.view === 'imagine' ? 'cv-imagine-page' : ''}">${this.state.view === 'home' ? '' : this._renderTop()}${body}</main>`;
    }

    _renderTop() {
      // Imagine is a first-class workspace, not a Canvas sub-view. Its only
      // navigation lives in the main FilmScript bar so it has no duplicate
      // Visual Production header or Canvas-only tabs.
      if (this.state.view === 'imagine') return '';
      return `<header class="cv-top"><div class="cv-title"><div class="cv-eyebrow">Visual production</div><h1>${this.state.view === 'imagine' ? 'Imagine' : 'Canvas'}</h1></div><nav class="cv-tabs" aria-label="Canvas tools"><button class="cv-tab" data-action="view-home" aria-current="${this.state.view === 'home'}">Home</button><button class="cv-tab" data-action="view-vault" aria-current="${this.state.view === 'vault'}">Vault</button><button class="cv-tab" data-action="view-boards" aria-current="${this.state.view === 'boards'}">Boards</button></nav>${this.state.view === 'imagine' ? '' : '<button class="cv-btn accent" data-action="create-board">+ New board</button>'}</header>`;
    }

    _renderHome() {
      const details = {
        vault: { name: 'Vault', icon: 'vault', text: 'Build a visual inventory of props, furniture, wardrobe, textures, and production assets.' },
        boards: { name: 'Boards', icon: 'boards', text: 'Arrange references, concepts, notes, and Vault items on an open visual workspace.' },
      };
      const cards = ['boards', 'vault'].map((id, index) => {
        const tool = details[id];
        return `<button class="cv-card cv-tool" data-action="view-${id}"><span class="cv-tool-no">0${index + 1}</span><span class="cv-tool-icon">${icon(tool.icon)}</span><h3>${tool.name}</h3><p>${tool.text}</p><span class="cv-tool-arrow">→</span></button>`;
      }).join('');
      return `<section><div class="cv-heading"><div><h2>Your visual workspace</h2><p>Start with a Board, then collect references in Vault. Everything stays connected to ${esc(this.projectTitle)}.</p></div></div><div class="cv-tool-grid">${cards}</div></section>`;
    }

    _renderImagine() {
      // A stable chronological order keeps new frames at the top. Do not use
      // CSS dense packing here: it can visually pull older frames above a
      // newer one simply to fill a gap.
      const galleryEntries = this.imagineGalleryEntries();
      const references = (this.state.workspace?.assets || []).filter((asset) => this.state.imagineReferenceIds.includes(asset.id));
      const capabilities = this._imagineCapabilities();
      const mediaMode = capabilities.mediaModes.some((option) => option.id === this.state.imagineMediaMode)
        ? this.state.imagineMediaMode
        : capabilities.defaults.mediaMode;
      const modelOptionsForMode = this._imagineModelsForMode(capabilities, mediaMode);
      const modelId = modelOptionsForMode.some((option) => option.id === this.state.imagineModelId)
        ? this.state.imagineModelId
        : (modelOptionsForMode.some((option) => option.id === capabilities.defaults.modelId)
          ? capabilities.defaults.modelId
          : (modelOptionsForMode[0]?.id || ''));
      const imageLocked = this.state.accountAuthenticated === true && !this.hasImageGenerationAccess();
      const capabilityUnavailable = !mediaMode || !modelId;
      const disabled = imageLocked || capabilityUnavailable ? 'disabled' : '';
      const imageActionTitle = imageLocked ? this.imageGenerationMessage({ exhausted: this.state.accountTier === 'full' }) : localize('Generate image', 'Generar imagen');
      const style = ['cinematic', 'animated', 'sketch', 'anime'].includes(this.state.imagineStyle) ? this.state.imagineStyle : 'cinematic';
      const styleLabel = this.imagineStyleLabel(style);
      const sizeOption = this.imagineSizeOption(this.state.imagineSize);
      const orientation = sizeOption.orientation;
      const quality = ['low', 'medium', 'high'].includes(this.state.imagineQuality) ? this.state.imagineQuality : 'low';
      const qualityCredits = { low: 3, medium: 5, high: 10 };
      const qualityLabel = this.imagineQualityLabel(quality);
      const imageActionLabel = imageLocked
        ? (this.state.accountTier === 'full' ? localize('Credits used', 'Créditos agotados') : localize('Unlock Full', 'Desbloquear Full'))
        : this.imagineCreditLabel(qualityCredits[quality]);
      // Build true justified rows rather than letting flex leave a ragged
      // final line. Every row calculates one shared height from its combined
      // aspect ratios, so both its left and right edges land exactly on the
      // gallery margins without stretching or cropping a frame.
      const animateEntrance = this._imagineEntrancePending;
      this._imagineEntrancePending = false;
      let tileIndex = 0;
      const tiles = galleryEntries.length
        ? this.imagineJustifiedRows(galleryEntries).map((row) => {
          const height = Math.round(row.height);
          return `<div class="cv-imagine-gallery-row" style="--cv-imagine-row-height:${height}px">${row.entries.map((entry) => this.renderImagineTile(entry, tileIndex++)).join('')}</div>`;
        }).join('')
        : `<div class="cv-imagine-empty"><div>${icon('image')}<strong>${esc(localize('Make your first frame', 'Crea tu primera imagen'))}</strong><span>${esc(this.accountScoped ? localize('Every image you create will stay in your personal gallery.', 'Cada imagen que crees quedará en tu galería personal.') : 'It will live here, ready for Boards and Shot List.')}</span></div></div>`;
      const referencePreview = references.length ? `<div class="cv-imagine-reference-list"><img src="${esc(this.assetUrl(references[0].id))}" alt="${esc(references[0].prompt || localize('Reference image', 'Imagen de referencia'))}">${references.length > 1 ? `<span>+${references.length - 1}</span>` : ''}</div>` : '';
      const referenceControl = references.length
        ? `<div class="cv-imagine-reference-row"><div class="cv-imagine-reference-wrap"><span class="cv-imagine-reference has-references" title="${esc(localize('Current visual references', 'Referencias visuales actuales'))}">${referencePreview}</span><button class="cv-imagine-reference-remove" type="button" data-action="imagine-remove-reference" data-id="${esc(references[0].id)}" aria-label="${esc(localize('Remove reference', 'Quitar referencia'))}" title="${esc(localize('Remove reference', 'Quitar referencia'))}" ${disabled}>×</button></div><label class="cv-imagine-reference cv-imagine-reference-add" title="${esc(localize('Add another visual reference', 'Agregar otra referencia visual'))}">${icon('image')}<input data-file="imagine-references" type="file" accept="image/png,image/jpeg,image/webp" multiple ${disabled}></label></div>`
        : `<label class="cv-imagine-reference" title="${esc(localize('Add visual references', 'Agregar referencias visuales'))}">${icon('image')}<input data-file="imagine-references" type="file" accept="image/png,image/jpeg,image/webp" multiple ${disabled}></label>`;
      const styleOptions = ['cinematic', 'animated', 'sketch', 'anime'].map((value) => `<button type="button" role="menuitemradio" aria-checked="${style === value}" class="${style === value ? 'active' : ''}" data-action="imagine-style-select" data-style="${value}">${esc(this.imagineStyleLabel(value))}</button>`).join('');
      const sizeOptions = this.imagineSizeOptions().map((entry) => `<button type="button" role="menuitemradio" aria-checked="${sizeOption.value === entry.value}" class="${sizeOption.value === entry.value ? 'active' : ''}" data-action="imagine-size-select" data-size="${entry.value}" aria-label="${entry.compact}"><i class="cv-aspect-preview ${entry.orientation}" aria-hidden="true"></i><span>${entry.compact}</span></button>`).join('');
      const qualityOptions = ['low', 'medium', 'high'].map((value) => `<button type="button" role="menuitemradio" aria-checked="${quality === value}" class="${quality === value ? 'active' : ''}" data-action="imagine-quality-select" data-quality="${value}"><span>${esc(this.imagineQualityLabel(value))}</span><b>${esc(this.imagineCreditLabel(qualityCredits[value]))}</b></button>`).join('');
      const imageAction = imageLocked
        ? `<button class="cv-imagine-generate" type="button" data-action="imagine-unlock-full" title="${esc(imageActionTitle)}">${imageActionLabel}</button>`
        : `<button class="cv-imagine-generate" type="submit" title="${esc(imageActionTitle)}">${imageActionLabel}</button>`;
      const dropHint = esc(localize('Drop to add as reference', 'Suelta para agregar como referencia'));
      const promptPlaceholder = esc(localize('Describe the frame you want to create…', 'Describe la imagen que quieres crear…'));
      const aspectLabel = esc(localize('Aspect ratio', 'Relación de aspecto'));
      const styleControlLabel = esc(localize('Style', 'Estilo'));
      const qualityControlLabel = esc(localize('Quality', 'Calidad'));
      const mediaModeControl = capabilities.mediaModes.length > 1
        ? `<label class="cv-imagine-style cv-imagine-capability"><span>${esc(localize('Media', 'Tipo'))}</span><select name="mediaMode" data-field="imagine-media-mode" aria-label="${esc(localize('Media type', 'Tipo de contenido'))}" ${disabled}>${capabilities.mediaModes.map((option) => `<option value="${esc(option.id)}" ${option.id === mediaMode ? 'selected' : ''}>${esc(this._imagineCapabilityLabel(option))}</option>`).join('')}</select></label>`
        : `<input type="hidden" name="mediaMode" value="${esc(mediaMode)}">`;
      const modelControl = modelOptionsForMode.length > 1
        ? `<label class="cv-imagine-style cv-imagine-capability"><span>${esc(localize('Model', 'Modelo'))}</span><select name="modelId" data-field="imagine-model-id" aria-label="${esc(localize('Image model', 'Modelo de imagen'))}" ${disabled}>${modelOptionsForMode.map((option) => `<option value="${esc(option.id)}" ${option.id === modelId ? 'selected' : ''}>${esc(this._imagineCapabilityLabel(option))}</option>`).join('')}</select></label>`
        : `<input type="hidden" name="modelId" value="${esc(modelId)}">`;
      return `<section class="cv-imagine-stage"><div class="cv-imagine-gallery${animateEntrance ? ' is-entering' : ''}">${tiles}</div><form class="cv-imagine-console ${this.state.imagineDragging ? 'is-dragging' : ''}" data-form="imagine-image"><span class="cv-imagine-drop-hint">${dropHint}</span><div class="cv-imagine-console-top">${referenceControl}<textarea data-imagine-prompt name="prompt" required minlength="8" maxlength="3000" placeholder="${promptPlaceholder}" ${disabled}>${esc(this.state.imaginePrompt)}</textarea></div><div class="cv-imagine-controls">${mediaModeControl}${modelControl}<div class="cv-imagine-aspect-picker cv-imagine-size-picker"><input type="hidden" name="size" value="${sizeOption.value}"><input type="hidden" name="orientation" value="${orientation}"><button class="cv-imagine-aspect-trigger" type="button" data-action="imagine-size-menu" aria-label="${aspectLabel}: ${sizeOption.compact}" aria-haspopup="menu" aria-expanded="${this.state.imagineSizeMenu}" ${disabled}><i class="cv-aspect-preview ${orientation}" aria-hidden="true"></i><strong>${sizeOption.compact}</strong></button>${this.state.imagineSizeMenu ? `<div class="cv-imagine-aspect-menu cv-imagine-size-menu" role="menu">${sizeOptions}</div>` : ''}</div><div class="cv-imagine-style-picker"><input type="hidden" name="style" value="${style}"><button class="cv-imagine-style-trigger" type="button" data-action="imagine-style-menu" aria-label="${styleControlLabel}: ${esc(styleLabel)}" aria-haspopup="menu" aria-expanded="${this.state.imagineStyleMenu}" ${disabled}><span>${styleControlLabel}</span><strong>${styleLabel}</strong></button>${this.state.imagineStyleMenu ? `<div class="cv-imagine-style-menu" role="menu">${styleOptions}</div>` : ''}</div><div class="cv-imagine-style-picker cv-imagine-quality-picker"><input type="hidden" name="quality" value="${quality}"><button class="cv-imagine-style-trigger" type="button" data-action="imagine-quality-menu" aria-label="${qualityControlLabel}: ${esc(qualityLabel)}, ${esc(this.imagineCreditLabel(qualityCredits[quality]))}" aria-haspopup="menu" aria-expanded="${this.state.imagineQualityMenu}" ${disabled}><span>${qualityControlLabel}</span><strong>${esc(qualityLabel)}</strong></button>${this.state.imagineQualityMenu ? `<div class="cv-imagine-style-menu cv-imagine-quality-menu" role="menu">${qualityOptions}</div>` : ''}</div>${imageAction}</div></form></section>`;
    }

    // Imagine's pickers are intentionally patched in place. Re-rendering the
    // entire visual workspace on each choice made the gallery briefly unmount
    // and flash white, especially while large generated images were decoding.
    _patchImagineControls() {
      const form = this.shadowRoot.querySelector('[data-form="imagine-image"]');
      if (!form || this.state.view !== 'imagine') return this.render();

      const imageLocked = this.state.accountAuthenticated === true && !this.hasImageGenerationAccess();
      const style = ['cinematic', 'animated', 'sketch', 'anime'].includes(this.state.imagineStyle) ? this.state.imagineStyle : 'cinematic';
      const styleLabel = this.imagineStyleLabel(style);
      const sizeOption = this.imagineSizeOption(this.state.imagineSize);
      const quality = ['low', 'medium', 'high'].includes(this.state.imagineQuality) ? this.state.imagineQuality : 'low';
      const qualityCredits = { low: 3, medium: 5, high: 10 };
      const qualityLabel = this.imagineQualityLabel(quality);
      const sizeOptions = this.imagineSizeOptions().map((entry) => `<button type="button" role="menuitemradio" aria-checked="${sizeOption.value === entry.value}" class="${sizeOption.value === entry.value ? 'active' : ''}" data-action="imagine-size-select" data-size="${entry.value}" aria-label="${entry.compact}"><i class="cv-aspect-preview ${entry.orientation}" aria-hidden="true"></i><span>${entry.compact}</span></button>`).join('');
      const styleOptions = ['cinematic', 'animated', 'sketch', 'anime'].map((value) => `<button type="button" role="menuitemradio" aria-checked="${style === value}" class="${style === value ? 'active' : ''}" data-action="imagine-style-select" data-style="${value}">${esc(this.imagineStyleLabel(value))}</button>`).join('');
      const qualityOptions = ['low', 'medium', 'high'].map((value) => `<button type="button" role="menuitemradio" aria-checked="${quality === value}" class="${quality === value ? 'active' : ''}" data-action="imagine-quality-select" data-quality="${value}"><span>${esc(this.imagineQualityLabel(value))}</span><b>${esc(this.imagineCreditLabel(qualityCredits[value]))}</b></button>`).join('');

      const sizePicker = form.querySelector('.cv-imagine-size-picker');
      const stylePicker = form.querySelector('.cv-imagine-style-picker:not(.cv-imagine-quality-picker)');
      const qualityPicker = form.querySelector('.cv-imagine-quality-picker');
      if (!sizePicker || !stylePicker || !qualityPicker) return this.render();
      form.querySelectorAll('.cv-imagine-aspect-menu,.cv-imagine-style-menu').forEach((menu) => menu.remove());

      const sizeInput = sizePicker.querySelector('input[name="size"]');
      const orientationInput = sizePicker.querySelector('input[name="orientation"]');
      if (sizeInput) sizeInput.value = sizeOption.value;
      if (orientationInput) orientationInput.value = sizeOption.orientation;
      const sizeTrigger = sizePicker.querySelector('[data-action="imagine-size-menu"]');
      if (sizeTrigger) {
        sizeTrigger.setAttribute('aria-label', `${localize('Aspect ratio', 'Relación de aspecto')}: ${sizeOption.compact}`);
        sizeTrigger.setAttribute('aria-expanded', String(Boolean(this.state.imagineSizeMenu)));
        sizeTrigger.querySelector('strong').textContent = sizeOption.compact;
        const preview = sizeTrigger.querySelector('.cv-aspect-preview');
        if (preview) preview.className = `cv-aspect-preview ${sizeOption.orientation}`;
      }
      const styleInput = stylePicker.querySelector('input[name="style"]');
      if (styleInput) styleInput.value = style;
      const styleTrigger = stylePicker.querySelector('[data-action="imagine-style-menu"]');
      if (styleTrigger) {
        styleTrigger.setAttribute('aria-label', `${localize('Style', 'Estilo')}: ${styleLabel}`);
        styleTrigger.setAttribute('aria-expanded', String(Boolean(this.state.imagineStyleMenu)));
        styleTrigger.querySelector('strong').textContent = styleLabel;
      }
      const qualityInput = qualityPicker.querySelector('input[name="quality"]');
      if (qualityInput) qualityInput.value = quality;
      const qualityTrigger = qualityPicker.querySelector('[data-action="imagine-quality-menu"]');
      if (qualityTrigger) {
        qualityTrigger.setAttribute('aria-label', `${localize('Quality', 'Calidad')}: ${qualityLabel}, ${this.imagineCreditLabel(qualityCredits[quality])}`);
        qualityTrigger.setAttribute('aria-expanded', String(Boolean(this.state.imagineQualityMenu)));
        qualityTrigger.querySelector('strong').textContent = qualityLabel;
      }
      const generate = form.querySelector('.cv-imagine-generate');
      if (generate && !imageLocked) generate.textContent = this.imagineCreditLabel(qualityCredits[quality]);
      if (this.state.imagineSizeMenu) sizePicker.insertAdjacentHTML('beforeend', `<div class="cv-imagine-aspect-menu cv-imagine-size-menu" role="menu">${sizeOptions}</div>`);
      if (this.state.imagineStyleMenu) stylePicker.insertAdjacentHTML('beforeend', `<div class="cv-imagine-style-menu" role="menu">${styleOptions}</div>`);
      if (this.state.imagineQualityMenu) qualityPicker.insertAdjacentHTML('beforeend', `<div class="cv-imagine-style-menu cv-imagine-quality-menu" role="menu">${qualityOptions}</div>`);
    }

    _filteredVault() {
      const search = this.state.search.trim().toLocaleLowerCase();
      let items = (this.state.workspace?.vaultItems || []).filter((item) => !item.archived);
      if (search) items = items.filter((item) => [item.name, item.code, item.category, item.subcategory, item.description, ...(item.tags || [])].join(' ').toLocaleLowerCase().includes(search));
      if (this.state.category) items = items.filter((item) => item.category === this.state.category);
      if (this.state.availability) items = items.filter((item) => item.availability === this.state.availability);
      if (this.state.condition) items = items.filter((item) => item.condition === this.state.condition);
      if (this.state.storage) items = items.filter((item) => item.storageLocation === this.state.storage);
      const sortTime = (value) => Date.parse(value || 0) || 0;
      if (this.state.sort === 'used') items.sort((a, b) => sortTime(b.lastUsedAt) - sortTime(a.lastUsedAt));
      else if (this.state.sort === 'price-low') items.sort((a, b) => num(a.dailyPrice) - num(b.dailyPrice));
      else if (this.state.sort === 'price-high') items.sort((a, b) => num(b.dailyPrice) - num(a.dailyPrice));
      else items.sort((a, b) => sortTime(b.createdAt) - sortTime(a.createdAt));
      return items;
    }

    _renderVault() {
      const items = this._filteredVault();
      const all = this.state.workspace?.vaultItems || [];
      const categories = [...new Set(all.map((item) => item.category).filter(Boolean))].sort();
      const storage = [...new Set(all.map((item) => item.storageLocation).filter(Boolean))].sort();
      const view = this.state.workspace?.settings?.vaultView || 'grid';
      const toolbar = `<div class="cv-toolbar"><label class="cv-search">${icon('search')}<input data-field="vault-search" value="${esc(this.state.search)}" placeholder="Search Vault by name, code, tag, or description" aria-label="Search Vault"></label><select class="cv-filter" data-field="vault-category"><option value="">All categories</option>${categories.map((value) => `<option ${this.state.category === value ? 'selected' : ''}>${esc(value)}</option>`).join('')}</select><select class="cv-filter" data-field="vault-availability"><option value="">Any availability</option>${['available','limited','reserved','unavailable'].map((value) => `<option value="${value}" ${this.state.availability === value ? 'selected' : ''}>${esc(value.replace('_',' '))}</option>`).join('')}</select><select class="cv-filter" data-field="vault-condition"><option value="">Any condition</option>${['new','excellent','good','fair','damaged','needs_repair'].map((value) => `<option value="${value}" ${this.state.condition === value ? 'selected' : ''}>${esc(value.replace('_',' '))}</option>`).join('')}</select>${storage.length ? `<select class="cv-filter" data-field="vault-storage"><option value="">All storage</option>${storage.map((value) => `<option ${this.state.storage === value ? 'selected' : ''}>${esc(value)}</option>`).join('')}</select>` : ''}<select class="cv-filter" data-field="vault-sort"><option value="recent" ${this.state.sort === 'recent' ? 'selected' : ''}>Recently added</option><option value="used" ${this.state.sort === 'used' ? 'selected' : ''}>Recently used</option><option value="price-low" ${this.state.sort === 'price-low' ? 'selected' : ''}>Lowest price</option><option value="price-high" ${this.state.sort === 'price-high' ? 'selected' : ''}>Highest price</option></select><div class="cv-view-toggle"><button data-action="vault-grid" class="${view === 'grid' ? 'active' : ''}" aria-label="Grid view">${icon('grid')}</button><button data-action="vault-list" class="${view === 'list' ? 'active' : ''}" aria-label="List view">${icon('list')}</button></div></div>`;
      if (!all.filter((item) => !item.archived).length) return `<section><div class="cv-heading"><div><h2>Vault</h2><p>Your reusable production inventory, connected to this project.</p></div></div><div class="cv-card cv-empty"><div>${icon('landscape').replace('<svg','<svg class="cv-empty-art"')}<h3>Build your production library</h3><p>Add props, furniture, wardrobe, textures, set dressing, and other production assets so they are ready for future projects.</p><div class="cv-empty-actions"><button class="cv-btn accent" data-action="add-item">Add First Item</button><button class="cv-btn" data-action="import-items">Import Items</button></div><input hidden type="file" accept=".json,.csv" data-file="vault-import"></div></div></section>`;
      const cards = items.map((item) => this._renderVaultCard(item)).join('');
      return `<section><div class="cv-heading"><div><h2>Vault</h2><p>${all.filter((item) => !item.archived).length} production asset${all.length === 1 ? '' : 's'} ready to pull into Boards and quotes.</p></div><div class="cv-actions"><button class="cv-btn" data-action="import-items">Import</button><input hidden type="file" accept=".json,.csv" data-file="vault-import"><button class="cv-btn accent" data-action="add-item">+ Add item</button></div></div>${toolbar}${items.length ? `<div class="cv-vault-grid ${view === 'list' ? 'list' : ''}">${cards}</div>` : `<div class="cv-empty"><div><h3>No matching assets</h3><p>Clear one or more filters to see the rest of your Vault.</p><button class="cv-btn" data-action="clear-vault-filters">Clear filters</button></div></div>`}${this._renderSelectionBar()}</section>`;
    }

    _renderVaultCard(item) {
      const selected = this.state.selected.has(item.id);
      const image = item.mainImageId
        ? `<img data-vault-image data-asset-id="${esc(item.mainImageId)}" loading="lazy" decoding="async" src="${esc(this.assetUrl(item.mainImageId))}" alt="${esc(item.name)}">`
        : `<div class="cv-item-image-empty">${icon('landscape')}<span>No image yet</span></div>`;
      return `<article class="cv-card cv-item ${selected ? 'selected' : ''}" data-item-id="${item.id}" data-action="view-item" data-id="${item.id}" role="button" tabindex="0" aria-label="View ${esc(item.name)}"><input class="cv-item-check" type="checkbox" data-action="toggle-item" data-select-item="${item.id}" ${selected ? 'checked' : ''} aria-label="Select ${esc(item.name)}"><button class="cv-item-menu" data-action="item-menu" data-id="${item.id}" aria-label="Item actions">${icon('dots')}</button><div class="cv-item-image">${image}</div><div class="cv-item-body"><div><div class="cv-item-title">${esc(item.name)}</div><div class="cv-item-meta"><span class="cv-status ${esc(item.availability)}">${esc(item.quantityAvailable)} available</span><span class="cv-item-price">${money(item.dailyPrice)}/day</span></div></div></div></article>`;
    }

    _onImageError(event) {
      const image = event.target;
      if (image instanceof HTMLImageElement && image.matches('.cv-imagine-tile img')) {
        const tile = image.closest('.cv-imagine-tile');
        tile?.classList.remove('is-image-loading');
        tile?.classList.add('is-image-error');
        return;
      }
      if (!(image instanceof HTMLImageElement) || !image.matches('img[data-vault-image]')) return;
      const wrapper = image.closest('.cv-item-image');
      if (!image.dataset.retried) {
        image.dataset.retried = 'true';
        const separator = image.src.includes('?') ? '&' : '?';
        // Let an in-flight S3/edge response settle before retrying.  The source
        // is unchanged; the parameter only bypasses a failed browser cache.
        window.setTimeout(() => { image.src = `${image.src}${separator}retry=${Date.now()}`; }, 180);
        return;
      }
      image.remove();
      if (wrapper) wrapper.innerHTML = `<div class="cv-item-image-empty">${icon('landscape')}<span>Image unavailable</span></div>`;
    }

    _onImageLoad(event) {
      const image = event.target;
      if (!(image instanceof HTMLImageElement) || !image.matches('.cv-imagine-tile img')) return;
      const tile = image.closest('.cv-imagine-tile');
      if (!tile) return;
      tile.classList.remove('is-image-loading', 'is-image-error');
      const width = Number(image.naturalWidth);
      const height = Number(image.naturalHeight);
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
      // The asset metadata is authoritative for newly generated images, but
      // this makes legacy or externally generated files truthful as soon as
      // the browser knows their intrinsic dimensions, without a full rerender.
      const ratio = Math.max(.38, Math.min(2.8, width / height));
      tile.style.setProperty('--cv-imagine-ratio', ratio.toFixed(4));
      tile.classList.toggle('vertical', ratio < 1);
      tile.classList.toggle('horizontal', ratio >= 1);
      tile.dataset.imageRatio = ratio.toFixed(4);
      // Legacy assets sometimes arrive without dimensions. Keep the in-memory
      // record truthful and reflow once (coalesced) so its justified row still
      // reaches both gallery edges after the browser decodes the real file.
      const asset = (this.state.workspace?.assets || []).find((entry) => entry.id === tile.dataset.id);
      if (asset && (Number(asset.width) !== width || Number(asset.height) !== height)) {
        asset.width = width;
        asset.height = height;
        clearTimeout(this._imagineLayoutTimer);
        this._imagineLayoutTimer = setTimeout(() => {
          if (this.isConnected && this.state.view === 'imagine') this.render();
        }, 40);
      }
    }

    _renderSelectionBar() {
      if (!this.state.selected.size) return '';
      return `<div class="cv-selection" role="toolbar" aria-label="Selected Vault items"><strong>${this.state.selected.size} selected</strong><button data-action="selection-project">Add to Project</button><button data-action="selection-board">Add to Board</button><button data-action="selection-proposal">Create Proposal</button><button class="accent" data-action="selection-quote">Create Quote</button><button data-action="selection-export">Export PDF</button><button data-action="selection-duplicate">Duplicate</button><button data-action="selection-archive">Archive</button><button data-action="selection-clear" aria-label="Clear selection">×</button></div>`;
    }

    _boardPreview(board) {
      const elements = Array.isArray(board.elements) ? board.elements : [];
      const imageElement = elements.find((element) => element.type === 'image' && element.assetId)
        || elements.find((element) => element.type === 'vault' && element.assetId);
      const vaultItem = !imageElement ? elements.map((element) => this.state.workspace.vaultItems.find((item) => item.id === element.vaultItemId)).find((item) => item?.mainImageId) : null;
      const imageId = imageElement?.assetId || vaultItem?.mainImageId || '';
      const image = imageId ? `<img loading="lazy" src="${esc(this.assetUrl(imageId))}" alt="">` : '';
      return `<div class="cv-board-preview ${image ? 'has-image' : ''}">${image}<span class="cv-board-preview-stub one"></span><span class="cv-board-preview-stub two"></span><span class="cv-board-preview-stub three"></span></div>`;
    }

    _renderBoards() {
      const boards = (this.state.workspace?.boards || []).filter((board) => !board.archived);
      if (!boards.length) return `<section><div class="cv-heading"><div><h2>Boards</h2><p>One clear visual space for references, notes, and decisions.</p></div></div><div class="cv-card cv-empty"><div>${icon('boards').replace('<svg','<svg class="cv-empty-art"')}<h3>Start with one visual board</h3><p>Bring together images, Vault items, and notes so the team can see the direction at a glance.</p><button class="cv-btn accent" data-action="create-board">Create board</button></div></div></section>`;
      return `<section><div class="cv-heading"><div><h2>Boards</h2><p>${boards.length} visual workspace${boards.length === 1 ? '' : 's'} · autosaved as you work</p></div><button class="cv-btn accent" data-action="create-board">+ New board</button></div><div class="cv-board-grid">${boards.map((board) => { const count = (board.elements || []).length; return `<article class="cv-card cv-board-card" data-action="open-board" data-id="${board.id}" role="button" tabindex="0" aria-label="Open ${esc(board.title)}"><button class="cv-item-menu cv-board-menu" data-action="board-menu" data-id="${board.id}" aria-label="Board actions">${icon('dots')}</button>${this._boardPreview(board)}<h3>${esc(board.title)}</h3><p>${esc(typeLabels[board.type] || 'Blank')} Board</p><div class="cv-board-meta"><strong>${count}</strong> element${count === 1 ? '' : 's'}<span>·</span><span>${board.updatedAt ? new Date(board.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Ready'}</span></div></article>`; }).join('')}</div></section>`;
    }

    _renderOverlays() {
      const overlays = [];
      if (this.state.itemModal) overlays.push(this._renderItemModal());
      if (this.state.itemDetailId) overlays.push(this._renderItemDetail());
      if (this.state.boardModal) overlays.push(this._renderBoardModal());
      if (this.state.storyboardImageModal) overlays.push(this._renderStoryboardImageModal());
      if (this.state.visualReferencePicker?.target === 'board-add') overlays.push(this._renderVisualReferencePicker());
      if (this.state.imaginePreviewId) overlays.push(this._renderImaginePreview());
      if (this.state.pickerMode) overlays.push(this._renderBoardPicker());
      if (this.state.vaultMenu) overlays.push(this._renderVaultMenu());
      if (this.state.boardMenu) overlays.push(this._renderBoardMenu());
      if (this.state.boardContext) overlays.push(this._renderBoardContext());
      return overlays.join('');
    }

    _renderItemModal() {
      const item = this.state.editingItemId ? this.state.workspace.vaultItems.find((entry) => entry.id === this.state.editingItemId) : null;
      const value = (key, fallback = '') => esc(item?.[key] ?? fallback);
      return `<div class="cv-modal-backdrop" data-action="close-item"><form class="cv-modal" data-form="vault-item" data-stop><header class="cv-modal-head"><div><div class="cv-eyebrow">Vault item</div><h3>${item ? 'Edit production asset' : 'Add production asset'}</h3><p>Start with the essentials. Everything else can be filled in later.</p></div><button type="button" class="cv-icon-btn cv-close" data-action="close-item" aria-label="Close" ${this.state.itemSaving ? 'disabled' : ''}>×</button></header><div class="cv-modal-body"><div class="cv-form-grid"><label class="cv-file-drop wide">${icon('upload')}<span><strong>${item?.imageIds?.length ? 'Add or replace images' : 'Upload a main image'}</strong><small>PNG, JPEG, or WebP · multiple images supported</small></span><input data-file="vault-images" type="file" accept="image/png,image/jpeg,image/webp" multiple ${this.state.itemSaving ? 'disabled' : ''}></label><div class="cv-vault-upload-preview wide" data-vault-preview></div><div class="cv-field wide"><span>Item name *</span><input required name="name" value="${value('name')}" placeholder="e.g. Distressed wooden chair" ${this.state.itemSaving ? 'disabled' : ''}></div><div class="cv-field"><span>Category</span><input name="category" value="${value('category','Uncategorized')}" list="cv-category-list" placeholder="Props" ${this.state.itemSaving ? 'disabled' : ''}><datalist id="cv-category-list">${['Furniture','Props','Wardrobe','Practical lights','Decorations','Set dressing','Textures','Vehicles','Art pieces','Construction','Graphic elements'].map((label) => `<option>${label}</option>`).join('')}</datalist></div><div class="cv-field"><span>Subcategory</span><input name="subcategory" value="${value('subcategory')}" placeholder="Chairs" ${this.state.itemSaving ? 'disabled' : ''}></div><div class="cv-field"><span>Quantity owned</span><input name="quantityOwned" type="number" min="0" value="${value('quantityOwned',1)}" ${this.state.itemSaving ? 'disabled' : ''}></div><div class="cv-field"><span>Quantity available</span><input name="quantityAvailable" type="number" min="0" value="${value('quantityAvailable',1)}" ${this.state.itemSaving ? 'disabled' : ''}></div><div class="cv-field"><span>Daily rental price</span><input name="dailyPrice" type="number" min="0" step="0.01" value="${value('dailyPrice',0)}" ${this.state.itemSaving ? 'disabled' : ''}></div><div class="cv-field"><span>Availability</span><select name="availability" ${this.state.itemSaving ? 'disabled' : ''}>${['available','limited','reserved','unavailable'].map((option) => `<option value="${option}" ${item?.availability === option ? 'selected' : ''}>${option.replace('_',' ')}</option>`).join('')}</select></div><div class="cv-field wide"><span>Description</span><textarea name="description" placeholder="What makes this item useful on set?" ${this.state.itemSaving ? 'disabled' : ''}>${value('description')}</textarea></div><details class="cv-more"><summary>More Details</summary><div class="cv-form-grid"><div class="cv-field"><span>Internal code</span><input name="code" value="${value('code')}"></div><div class="cv-field"><span>Condition</span><select name="condition">${['new','excellent','good','fair','damaged','needs_repair'].map((option) => `<option value="${option}" ${item?.condition === option ? 'selected' : ''}>${option.replace('_',' ')}</option>`).join('')}</select></div><div class="cv-field"><span>Color</span><input name="color" value="${value('color')}"></div><div class="cv-field"><span>Material</span><input name="material" value="${value('material')}"></div><div class="cv-field"><span>Dimensions</span><input name="dimensions" value="${value('dimensions')}" placeholder="W × H × D"></div><div class="cv-field"><span>Weight</span><input name="weight" value="${value('weight')}"></div><div class="cv-field wide"><span>Storage location</span><input name="storageLocation" value="${value('storageLocation')}"></div><div class="cv-field"><span>Weekly rental price</span><input name="weeklyPrice" type="number" min="0" step="0.01" value="${value('weeklyPrice',0)}"></div><div class="cv-field"><span>Replacement value</span><input name="replacementValue" type="number" min="0" step="0.01" value="${value('replacementValue',0)}"></div><div class="cv-field"><span>Deposit amount</span><input name="depositAmount" type="number" min="0" step="0.01" value="${value('depositAmount',0)}"></div><div class="cv-field"><span>Owner or supplier</span><input name="ownerSupplier" value="${value('ownerSupplier')}"></div><div class="cv-field wide"><span>Contact information</span><input name="contactInformation" value="${value('contactInformation')}"></div><div class="cv-field wide"><span>Tags</span><input name="tags" value="${esc((item?.tags || []).join(', '))}" placeholder="vintage, wood, hero prop"></div><div class="cv-field wide"><span>Production notes</span><textarea name="productionNotes">${value('productionNotes')}</textarea></div><div class="cv-field wide"><span>Damage notes</span><textarea name="damageNotes">${value('damageNotes')}</textarea></div><div class="cv-field wide"><span>Included accessories</span><textarea name="includedAccessories">${value('includedAccessories')}</textarea></div></div></details></div><div class="cv-form-actions"><button type="button" class="cv-btn" data-action="close-item" ${this.state.itemSaving ? 'disabled' : ''}>Cancel</button><button class="cv-btn accent" data-vault-submit type="submit" ${this.state.itemSaving ? 'disabled' : ''}>${this.state.itemSaving ? (item ? 'Saving…' : 'Adding to Vault…') : (item ? 'Save changes' : 'Add to Vault')}</button></div></div></form></div>`;
    }

    _renderItemDetail() {
      const item = this.state.workspace?.vaultItems?.find((entry) => entry.id === this.state.itemDetailId);
      if (!item) { this.state.itemDetailId = ''; return ''; }
      const image = item.mainImageId
        ? `<img loading="lazy" decoding="async" src="${esc(this.assetUrl(item.mainImageId))}" alt="${esc(item.name)}">`
        : `<div class="cv-detail-placeholder">${icon('landscape')}<span>No image yet</span></div>`;
      const label = (value) => String(value || '').replace(/_/g, ' ');
      const rows = [
        ['Category', [item.category, item.subcategory].filter(Boolean).join(' · ')],
        ['Availability', label(item.availability || 'available')],
        ['Condition', label(item.condition)],
        ['Internal code', item.code],
        ['Storage', item.storageLocation],
        ['Color', item.color],
        ['Material', item.material],
        ['Dimensions', item.dimensions],
        ['Weight', item.weight],
        ['Owner / supplier', item.ownerSupplier],
        ['Contact', item.contactInformation],
      ].filter(([, value]) => String(value || '').trim());
      const info = rows.map(([name, value]) => `<div class="cv-detail-row"><span>${esc(name)}</span><strong>${esc(value)}</strong></div>`).join('');
      return `<div class="cv-modal-backdrop" data-action="close-item-detail"><section class="cv-modal cv-item-detail" data-stop aria-label="${esc(item.name)} details"><header class="cv-modal-head"><div><div class="cv-eyebrow">Vault asset</div><h3>${esc(item.name)}</h3><p>${esc(item.category || 'Production asset')} · ${esc(item.quantityAvailable)} available</p></div><button class="cv-icon-btn cv-close" data-action="close-item-detail" aria-label="Close details">×</button></header><div class="cv-modal-body"><div class="cv-detail-layout"><div class="cv-detail-image">${image}</div><div class="cv-detail-content"><div class="cv-detail-price"><div><span>Daily rate</span><strong>${money(item.dailyPrice)}/day</strong></div><div><span>Weekly rate</span><strong>${money(item.weeklyPrice)}/week</strong></div></div><div class="cv-detail-counts"><span><strong>${esc(item.quantityOwned)}</strong> owned</span><span><strong>${esc(item.quantityAvailable)}</strong> available</span>${item.replacementValue ? `<span><strong>${money(item.replacementValue)}</strong> replacement</span>` : ''}</div>${item.description ? `<p class="cv-detail-description">${esc(item.description)}</p>` : ''}<div class="cv-detail-rows">${info || '<div class="cv-detail-empty">No additional details yet.</div>'}</div>${item.tags?.length ? `<div class="cv-detail-tags">${item.tags.map((tag) => `<span>${esc(tag)}</span>`).join('')}</div>` : ''}${item.productionNotes ? `<div class="cv-detail-note"><span>Production notes</span>${esc(item.productionNotes)}</div>` : ''}<div class="cv-form-actions"><button class="cv-btn" data-action="close-item-detail">Close</button><button class="cv-btn accent" data-action="edit-item" data-id="${item.id}">Edit item</button></div></div></div></div></section></div>`;
    }

    _renderBoardModal() {
      const types = { art: 'Production design, set concepts, materials, and color.', photo: 'Lighting, lenses, framing, wardrobe, and composition.', video: 'Treatments, movement, editing, and motion references.', blank: 'An empty open workspace for any visual direction.' };
      return `<div class="cv-modal-backdrop" data-action="close-board-modal"><form class="cv-modal" data-form="new-board" data-stop><header class="cv-modal-head"><div><div class="cv-eyebrow">New Board</div><h3>Choose a starting point</h3><p>Board types are templates, never restrictions.</p></div><button type="button" class="cv-icon-btn cv-close" data-action="close-board-modal">×</button></header><div class="cv-modal-body"><div class="cv-field" style="margin-bottom:16px"><span>Board name</span><input name="title" required placeholder="e.g. Clínica clandestina"></div><div class="cv-board-type-grid">${Object.entries(types).map(([type,copy]) => `<button type="submit" name="type" value="${type}" class="cv-board-type"><span class="cv-role-icon">${icon(type === 'photo' ? 'image' : type === 'video' ? 'shot' : 'boards')}</span><span><strong>${typeLabels[type]} Board</strong><small>${copy}</small></span></button>`).join('')}</div></div></form></div>`;
    }

    _visualReferenceAssets(source = this.state.visualReferencePickerSource) {
      if (source === 'vault') {
        return (this.state.workspace?.vaultItems || [])
          .filter((item) => !item.archived && item.mainImageId && this.asset(item.mainImageId))
          .map((item) => ({
            id: item.mainImageId,
            asset: this.asset(item.mainImageId),
            title: item.name || 'Vault asset',
            meta: item.category || 'Vault',
            kind: 'Vault',
          }));
      }
      return this.imagineImages().map((asset) => ({
        id: asset.id,
        asset,
        title: asset.prompt || 'Generated visual',
        meta: asset.generation?.orientation === 'vertical' ? 'Vertical' : 'Horizontal',
        kind: 'Imagine',
      }));
    }

    _visualReferenceGridStyle(asset) {
      const ratio = this.imagineAssetRatio(asset);
      const cols = ratio > 1.38 ? 3 : ratio < .8 ? 2 : 2;
      const rows = Math.max(7, Math.min(20, Math.round((cols / ratio) * 6)));
      return `--vr-cols:${cols};--vr-rows:${rows}`;
    }

    _renderVisualReferenceSource({ target = this.state.visualReferencePicker?.target || 'board-add' } = {}) {
      const source = this.state.visualReferencePickerSource === 'vault' ? 'vault' : 'imagine';
      const selectedIds = new Set(this.state.storyboardReferenceIds || []);
      const assets = this._visualReferenceAssets(source);
      const title = target === 'board-generate' ? 'References for this frame' : 'Add a visual reference';
      const copy = target === 'board-generate'
        ? 'Attach up to four references. Imagine will use their visual language while creating this frame.'
        : 'Upload an image, reuse an Imagine frame, or place a saved Vault asset on this Board.';
      const cards = assets.map(({ id, asset, title: assetTitle, meta, kind }) => {
        const selected = target === 'board-generate' && selectedIds.has(id);
        return `<button type="button" class="cv-visual-reference-card ${selected ? 'is-selected' : ''}" data-action="visual-reference-select" data-id="${esc(id)}" style="${this._visualReferenceGridStyle(asset)}" title="${esc(assetTitle)}"><img loading="lazy" decoding="async" src="${esc(this.assetUrl(id))}" alt="${esc(assetTitle)}"><span class="cv-visual-reference-card-copy"><strong>${esc(assetTitle)}</strong><small>${esc(kind)} · ${esc(meta)}</small></span>${selected ? `<span class="cv-visual-reference-check">✓</span>` : ''}</button>`;
      }).join('');
      const empty = source === 'imagine'
        ? `<div class="cv-visual-reference-empty"><strong>No generated frames yet</strong><span>Make one in Imagine and it will appear here immediately.</span><button type="button" class="cv-btn accent" data-action="open-imagine">Open Imagine</button></div>`
        : `<div class="cv-visual-reference-empty"><strong>No Vault images yet</strong><span>Add an image to Vault, or upload it directly here.</span></div>`;
      return `<section class="cv-visual-reference-picker ${this.state.visualReferencePickerDragging ? 'is-dragging' : ''}" data-visual-reference-drop="board" aria-label="${esc(title)}"><div class="cv-visual-reference-head"><div><div class="cv-eyebrow">Connected visual library</div><h4>${esc(title)}</h4><p>${esc(copy)}</p></div><div class="cv-visual-reference-tabs"><button type="button" class="${source === 'imagine' ? 'active' : ''}" data-action="recent-imagine">Recent Imagine</button><button type="button" class="${source === 'vault' ? 'active' : ''}" data-action="visual-reference-vault">Vault</button><button type="button" data-action="open-imagine">Open Imagine</button></div></div><div class="cv-visual-reference-layout"><div class="cv-visual-reference-upload-wrap"><button type="button" class="cv-visual-reference-upload" data-action="reference-upload" aria-label="Upload a reference image">${icon('landscape')}<strong>Upload</strong><small>Drop or choose</small></button><input hidden data-file="visual-reference-upload" type="file" accept="image/png,image/jpeg,image/webp" ${target === 'board-generate' ? 'multiple' : ''}><span>From your computer</span></div><div class="cv-visual-reference-gallery">${cards || empty}</div></div></section>`;
    }

    _renderVisualReferencePicker() {
      return `<div class="cv-modal-backdrop" data-action="close-visual-reference-picker"><section class="cv-modal cv-visual-reference-modal" data-stop><header class="cv-modal-head"><div><div class="cv-eyebrow">Board library</div><h3>Choose a visual</h3><p>Your latest Imagine images and Vault remain connected everywhere.</p></div><button class="cv-icon-btn cv-close" data-action="close-visual-reference-picker" aria-label="Close visual picker">×</button></header><div class="cv-modal-body">${this._renderVisualReferenceSource({ target: 'board-add' })}</div></section></div>`;
    }

    _renderStoryboardImageModal() {
      const loading = this.state.storyboardImageGenerating;
      const locked = this.state.accountAuthenticated === true && !this.hasImageGenerationAccess();
      const submitLabel = loading ? 'Generating frame…' : locked ? (this.state.accountTier === 'full' ? 'Credits used' : 'Unlock Full') : 'Generate image';
      const accessNote = locked ? `<p class="cv-image-access-note">${esc(this.imageGenerationMessage({ exhausted: this.state.accountTier === 'full' }))}</p>` : '';
      return `<div class="cv-modal-backdrop" data-action="close-storyboard-image"><form class="cv-modal cv-storyboard-image-modal" data-form="storyboard-image" data-stop><header class="cv-modal-head"><div><div class="cv-eyebrow">Storyboard image</div><h3>Turn a beat into a frame</h3><p>Describe the action, mood, lens, lighting, and composition. The frame is added directly to this Board.</p></div><button type="button" class="cv-icon-btn cv-close" data-action="close-storyboard-image" aria-label="Close" ${loading ? 'disabled' : ''}>×</button></header><div class="cv-modal-body"><div class="cv-field"><span>Visual direction</span><textarea name="prompt" required minlength="8" maxlength="3000" placeholder="A wide 35mm shot of Briella waiting alone at a rainy bus stop, sodium-vapor streetlight, quiet tension, cinematic realism" ${loading ? 'disabled' : ''}></textarea></div><fieldset class="cv-frame-format" aria-label="Frame format"><label><input type="radio" name="orientation" value="horizontal" checked ${loading ? 'disabled' : ''}>16:9</label><label><input type="radio" name="orientation" value="vertical" ${loading ? 'disabled' : ''}>Vertical</label></fieldset>${this._renderVisualReferenceSource({ target: 'board-generate' })}${accessNote}<div class="cv-form-actions"><button type="button" class="cv-btn" data-action="close-storyboard-image" ${loading ? 'disabled' : ''}>Cancel</button><button class="cv-btn accent" type="submit" ${loading ? 'disabled' : ''}>${submitLabel}</button></div></div></form></div>`;
    }

    _renderImaginePreview() {
      const asset = this.asset(this.state.imaginePreviewId);
      if (!asset) { this.state.imaginePreviewId = ''; return ''; }
      const generation = asset.generation || {};
      const orientation = this.imagineFormatLabel(asset);
      const created = asset.createdAt ? new Date(asset.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Just now';
      const dimensions = num(asset.width) > 0 && num(asset.height) > 0 ? `${Math.round(num(asset.width))} × ${Math.round(num(asset.height) )}` : orientation;
      const style = String(generation.style || 'cinematic').replace(/^./, (letter) => letter.toUpperCase());
      const quality = ['low', 'medium', 'high'].includes(String(generation.quality || '')) ? String(generation.quality).replace(/^./, (letter) => letter.toUpperCase()) : 'Low';
      const referenceAssets = (Array.isArray(generation.referenceAssetIds) ? generation.referenceAssetIds : []).map((id) => this.asset(id)).filter(Boolean);
      const product = 'Imagine';
      const copyTitle = localize(`Copy reference to ${product}`, `Copiar referencia a ${product}`);
      const referenceThumbs = referenceAssets.length ? `<div class="cv-imagine-preview-references">${referenceAssets.slice(0, 4).map((reference) => `<button type="button" class="cv-imagine-preview-reference" data-action="imagine-copy-reference" data-id="${esc(reference.id)}" title="${esc(copyTitle)}"><img src="${esc(this.assetUrl(reference.id))}" alt="${esc(localize('Reference image', 'Imagen de referencia'))}"><span>${esc(localize('Copy', 'Copiar'))}</span></button>`).join('')}${referenceAssets.length > 4 ? `<span>+${referenceAssets.length - 4}</span>` : ''}</div>` : `<span class="cv-imagine-preview-none">${esc(localize('No references', 'Sin referencias'))}</span>`;
      return `<div class="cv-modal-backdrop cv-imagine-preview-backdrop" data-action="close-imagine-preview"><section class="cv-modal cv-imagine-preview cv-imagine-preview-solo" data-stop aria-label="${esc(localize('Generated image preview', 'Vista previa de imagen generada'))}"><div class="cv-imagine-preview-solo-image"><img src="${esc(this.assetUrl(asset.id))}" alt="${esc(asset.prompt || localize('Generated visual', 'Imagen generada'))}"></div><aside class="cv-imagine-inspector"><header class="cv-imagine-inspector-head"><div><div class="cv-eyebrow">${product} ${esc(localize('frame', 'imagen'))}</div><h3>${esc(localize('Generated visual', 'Imagen generada'))}</h3><p>${esc(created)}</p></div></header><section class="cv-imagine-inspector-card"><span class="cv-imagine-inspector-label">Prompt</span><p>${esc(asset.prompt || localize('No prompt stored.', 'No se guardó el prompt.'))}</p></section><section class="cv-imagine-inspector-card cv-imagine-inspector-details"><span class="cv-imagine-inspector-label">${esc(localize('Details', 'Detalles'))}</span><dl><div><dt>${esc(localize('Format', 'Formato'))}</dt><dd>${esc(orientation)}</dd></div><div><dt>${esc(localize('Style', 'Estilo'))}</dt><dd>${esc(style)}</dd></div><div><dt>${esc(localize('Quality', 'Calidad'))}</dt><dd>${esc(quality)}</dd></div><div><dt>${esc(localize('Size', 'Tamaño'))}</dt><dd>${esc(dimensions)}</dd></div><div><dt>${esc(localize('Created', 'Creada'))}</dt><dd>${esc(created)}</dd></div></dl></section><section class="cv-imagine-inspector-card"><span class="cv-imagine-inspector-label">${esc(localize('References', 'Referencias'))}</span>${referenceThumbs}</section></aside><button class="cv-icon-btn cv-close" data-action="close-imagine-preview" aria-label="${esc(localize('Close preview', 'Cerrar vista previa'))}">×</button></section></div>`;
    }

    _renderBoardPicker() {
      if (this.state.pickerMode === 'board-imagine') {
        const images = this.imagineImages();
        return `<div class="cv-modal-backdrop" data-action="close-picker"><section class="cv-modal cv-picker-modal" data-stop><header class="cv-modal-head"><div><div class="cv-eyebrow">Imagine → Board</div><h3>Add a generated visual</h3><p>Choose a saved Imagine image. It remains connected to your visual library.</p></div><button class="cv-icon-btn cv-close" data-action="close-picker">×</button></header><div class="cv-modal-body">${images.length ? `<div class="cv-picker-grid">${images.map((asset) => `<button class="cv-picker-card" data-action="add-imagine-image" data-id="${asset.id}"><span class="cv-picker-image"><img loading="lazy" src="${esc(this.assetUrl(asset.id))}" alt=""></span><span class="cv-picker-copy"><span class="cv-picker-title">${esc(asset.prompt || 'Generated visual')}</span><span class="cv-picker-meta">${this.imagineFormatLabel(asset)}</span></span></button>`).join('')}</div>` : `<div class="cv-empty"><div><h3>No generated images yet</h3><p>Create a visual in Imagine, then it will appear here instantly.</p><button class="cv-btn accent" data-action="view-imagine">Open Imagine</button></div></div>`}</div></section></div>`;
      }
      if (this.state.pickerMode === 'imagine-board') {
        const boards = (this.state.workspace?.boards || []).filter((board) => !board.archived);
        return `<div class="cv-modal-backdrop" data-action="close-picker"><section class="cv-modal" data-stop><header class="cv-modal-head"><div><div class="cv-eyebrow">Imagine → Board</div><h3>Choose a Board</h3><p>Add this generated visual as a live image on the Board.</p></div><button class="cv-icon-btn cv-close" data-action="close-picker">×</button></header><div class="cv-modal-body">${boards.length ? `<div class="cv-board-grid">${boards.map((board) => `<button class="cv-card cv-board-card" data-action="pick-imagine-board" data-id="${board.id}"><div class="cv-board-preview"></div><h3>${esc(board.title)}</h3><p>${esc(typeLabels[board.type])} Board</p></button>`).join('')}</div>` : `<div class="cv-empty"><div><h3>Create a Board first</h3><p>Your image is saved in Imagine and will be ready when you return.</p><button class="cv-btn accent" data-action="picker-create-board">Create Board</button></div></div>`}</div></section></div>`;
      }
      if (this.state.pickerMode === 'board-vault') {
        const items = (this.state.workspace?.vaultItems || []).filter((item) => !item.archived);
        const cards = items.map((item) => {
          const image = item.mainImageId
            ? `<img loading="lazy" decoding="async" src="${esc(this.assetUrl(item.mainImageId))}" alt="${esc(item.name)}">`
            : `<span class="cv-picker-empty-image">${icon('landscape')}</span>`;
          return `<button class="cv-picker-card" data-action="pick-vault-item" data-id="${item.id}" aria-label="Add ${esc(item.name)} to this Board"><span class="cv-picker-image">${image}</span><span class="cv-picker-copy"><span class="cv-picker-title">${esc(item.name)}</span><span class="cv-picker-meta"><span class="cv-status ${esc(item.availability)}">${esc(item.quantityAvailable)} available</span><strong class="cv-picker-price">${money(item.dailyPrice)}/day</strong></span></span></button>`;
        }).join('');
        return `<div class="cv-modal-backdrop" data-action="close-picker"><section class="cv-modal cv-picker-modal" data-stop><header class="cv-modal-head"><div><div class="cv-eyebrow">Vault → Board</div><h3>Choose a production asset</h3><p>Select once to place it on the Board. Its availability, code, and price stay connected.</p></div><button class="cv-icon-btn cv-close" data-action="close-picker" aria-label="Close Vault">×</button></header><div class="cv-modal-body">${items.length ? `<div class="cv-picker-grid" aria-label="Vault items">${cards}</div>` : `<div class="cv-empty"><div><h3>Your Vault is empty</h3><p>Add an asset in Vault, then return to this Board.</p><button class="cv-btn" data-action="close-picker">Close</button></div></div>`}</div></section></div>`;
      }
      const boards = (this.state.workspace?.boards || []).filter((board) => !board.archived);
      return `<div class="cv-modal-backdrop" data-action="close-picker"><section class="cv-modal" data-stop><header class="cv-modal-head"><div><div class="cv-eyebrow">Vault → Boards</div><h3>Add selected items to a Board</h3><p>Vault data remains connected to every visual card.</p></div><button class="cv-icon-btn cv-close" data-action="close-picker">×</button></header><div class="cv-modal-body">${boards.length ? `<div class="cv-board-grid">${boards.map((board) => `<button class="cv-card cv-board-card" data-action="pick-board" data-id="${board.id}"><div class="cv-board-preview"></div><h3>${esc(board.title)}</h3><p>${esc(typeLabels[board.type])} Board</p></button>`).join('')}</div>` : `<div class="cv-empty"><div><h3>Create a Board first</h3><p>Your selected Vault items are still selected.</p><button class="cv-btn accent" data-action="picker-create-board">Create Board</button></div></div>`}</div></section></div>`;
    }

    _renderVaultMenu() {
      const { id, x, y } = this.state.vaultMenu;
      return `<div class="cv-menu-pop" style="left:${x}px;top:${y}px" data-stop><button data-action="edit-item" data-id="${id}">Edit item</button><button data-action="duplicate-item" data-id="${id}">Duplicate</button><button data-action="archive-item" data-id="${id}">Archive</button><button data-action="delete-item" data-id="${id}" style="color:#B24C47">Delete…</button></div>`;
    }

    _renderBoardMenu() {
      const { id, x, y } = this.state.boardMenu;
      return `<div class="cv-menu-pop" style="left:${x}px;top:${y}px" data-stop><button data-action="open-board" data-id="${id}">Open Board</button><button data-action="board-history" data-id="${id}">Version History</button><button data-action="board-comments" data-id="${id}">Comments</button><button data-action="duplicate-board" data-id="${id}">Duplicate</button><button data-action="delete-board" data-id="${id}" style="color:#B24C47">Delete…</button></div>`;
    }

    _renderBoardContext() {
      const { x, y, elementId } = this.state.boardContext;
      const element = elementId ? this.activeBoard()?.elements?.find((entry) => entry.id === elementId) : null;
      if (element) {
        const isImage = element.type === 'image' || (element.type === 'vault' && element.assetId);
        return `<div class="cv-context" style="left:${x}px;top:${y}px" data-stop><button data-action="board-object-comments" data-id="${element.id}">${icon('note')}Comments</button><button data-action="board-duplicate-selection">${icon('duplicate')}Duplicate</button><button data-action="board-group-selection" ${this.state.selected.size > 1 ? '' : 'disabled'}>${icon('group')}Group</button><button data-action="board-align-left" ${this.state.selected.size > 1 ? '' : 'disabled'}>${icon('align')}Align left</button>${isImage ? `<button data-action="board-download-selection">${icon('download')}Download</button>` : ''}<button data-action="board-delete-selection" style="color:#B24C47">${icon('delete')}Delete</button></div>`;
      }
      return `<div class="cv-context" style="left:${x}px;top:${y}px" data-stop><button data-action="board-generate-image">${icon('image')}Generate image</button><button data-action="board-add-imagine">${icon('image')}Add from Imagine</button><button data-action="board-add-image">${icon('image')}Add Image</button><button data-action="board-add-text">${icon('text')}Add Text</button><button data-action="board-add-note">${icon('note')}Add Note</button><button data-action="board-add-vault">${icon('vault')}Add Vault Item</button><button data-action="board-upload">${icon('upload')}Upload Image</button></div>`;
    }

    _renderBoardEditor() {
      const board = this.activeBoard();
      if (!board) { this.state.view = 'boards'; return `${this._renderTop()}${this._renderBoards()}`; }
      board.elements = Array.isArray(board.elements) ? board.elements : [];
      board.viewport = { x: 0, y: 0, zoom: 1, ...(board.viewport || {}) };
      board.settings = { snapToGrid: false, gridSize: 16, ...(board.settings || {}) };
      const selected = this.state.selected;
      const imageLocked = this.state.accountAuthenticated === true && !this.hasImageGenerationAccess();
      const boardImageActionLabel = imageLocked ? (this.state.accountTier === 'full' ? 'Credits used' : 'Unlock Full') : 'Generate';
      const boardImageActionTitle = imageLocked ? this.imageGenerationMessage({ exhausted: this.state.accountTier === 'full' }) : 'Generate storyboard image';
      const elements = board.elements.filter((element) => !element.hidden).map((element) => this._renderBoardElement(element, selected.has(element.id))).join('');
      const empty = !board.elements.length ? `<div class="cv-board-empty"><h3>${esc(typeLabels[board.type])} Board</h3><p>Start with a generated frame, an image, a Vault item, or a note. You can move and resize everything later.</p><div class="cv-empty-actions"><button class="cv-btn accent" data-action="board-generate-image" title="${esc(boardImageActionTitle)}">${icon('image')} ${boardImageActionLabel}</button><button class="cv-btn" data-action="board-add-image">${icon('image')} Add image</button><button class="cv-btn" data-action="board-add-vault">${icon('vault')} Add from Vault</button></div></div>` : '';
      const selectedImage = [...selected].map((id) => board.elements.find((entry) => entry.id === id)).find((entry) => entry && (entry.type === 'image' || (entry.type === 'vault' && entry.assetId)));
      const toolbar = this.state.boardTool === 'select' && selected.size ? `<div class="cv-element-toolbar" style="left:18px;top:70px"><button data-action="board-duplicate-selection">Duplicate</button><button data-action="board-group-selection" ${selected.size > 1 ? '' : 'disabled'}>Group</button><button data-action="board-align-left" ${selected.size > 1 ? '' : 'disabled'}>Align left</button>${selectedImage ? '<button data-action="board-download-selection">Download</button>' : ''}<button data-action="board-delete-selection" style="color:#B24C47">Delete</button></div>` : '';
      const tool = this.state.boardTool || 'select';
      return `<div class="cv-board-shell"><header class="cv-board-top"><button class="cv-btn cv-board-back" data-action="back-boards">${icon('back')} Boards</button><input class="cv-board-title" data-field="board-title" value="${esc(board.title)}" aria-label="Board title"><span class="cv-board-save">${esc(this.state.autosave)}</span><div class="cv-board-tools" aria-label="Board tools"><div class="cv-board-mode-switch" role="toolbar" aria-label="Board interaction mode"><button class="cv-icon-btn cv-board-mode ${tool === 'select' ? 'active' : ''}" data-action="board-tool-select" title="Select — choose multiple elements with Shift-click" aria-label="Select elements" aria-pressed="${tool === 'select'}">${icon('select')}</button><button class="cv-icon-btn cv-board-mode ${tool === 'hand' ? 'active' : ''}" data-action="board-tool-hand" title="Hand — move and resize without editing" aria-label="Move and resize" aria-pressed="${tool === 'hand'}">${icon('hand')}</button><button class="cv-icon-btn cv-board-mode ${tool === 'erase' ? 'active' : ''}" data-action="board-tool-erase" title="Eraser — drag across elements to remove them" aria-label="Erase elements" aria-pressed="${tool === 'erase'}">${icon('eraser')}</button></div><button class="cv-icon-btn" data-action="board-undo" title="Undo" aria-label="Undo" ${this._history.length ? '' : 'disabled'}>${icon('undo')}</button><button class="cv-icon-btn" data-action="board-redo" title="Redo" aria-label="Redo" ${this._future.length ? '' : 'disabled'}>${icon('redo')}</button><button class="cv-btn accent" data-action="board-generate-image" title="${esc(boardImageActionTitle)}">${icon('image')} ${boardImageActionLabel}</button><button class="cv-btn" data-action="board-add-imagine">Imagine</button><button class="cv-btn" data-action="board-add-image">${icon('image')} Image</button><button class="cv-btn" data-action="board-add-text">Text</button><button class="cv-btn" data-action="board-add-note">Note</button><button class="cv-btn" data-action="board-add-vault">Vault</button><button class="cv-btn" data-action="board-fit" title="Fit all board elements">Fit</button><div class="cv-board-zoom"><button class="cv-btn" data-action="board-zoom-out" aria-label="Zoom out">−</button><span>${Math.round(board.viewport.zoom * 100)}%</span><button class="cv-btn" data-action="board-zoom-in" aria-label="Zoom in">+</button></div><button class="cv-icon-btn ${board.settings.snapToGrid ? 'active' : ''}" data-action="board-snap" title="Snap to grid" aria-label="Snap to grid">${icon('grid')}</button></div><input hidden type="file" accept="image/png,image/jpeg,image/webp" data-file="board-image" tabindex="-1"></header><div class="cv-board-viewport tool-${tool}" data-board-viewport tabindex="0" aria-label="Board canvas"><div class="cv-board-layer" data-board-layer>${elements}</div>${empty}</div>${toolbar}</div>`;
    }

    _renderBoardElement(element, selected) {
      const style = `left:${element.positionX}px;top:${element.positionY}px;width:${element.width}px;height:${element.height}px;z-index:${element.zIndex};transform:rotate(${element.rotation || 0}deg)`;
      const fresh = this._boardNewElementIds?.has(element.id) ? 'is-new' : '';
      if (element.type === 'image') return `<article class="cv-element image ${fresh} ${selected ? 'selected' : ''}" data-element-id="${element.id}" style="${style}"><img loading="lazy" src="${esc(this.assetUrl(element.assetId))}" alt="Board reference"><span class="cv-resize" data-resize-id="${element.id}"></span></article>`;
      if (element.type === 'vault') {
        const item = this.state.workspace.vaultItems.find((entry) => entry.id === element.vaultItemId);
        const image = item?.mainImageId ? `<img loading="lazy" src="${esc(this.assetUrl(item.mainImageId))}" alt="${esc(item.name)}">` : '';
        return `<article class="cv-element vault ${fresh} ${selected ? 'selected' : ''}" data-element-id="${element.id}" style="${style}">${image}<div class="cv-vault-element-meta"><strong>${esc(item?.name || element.content || 'Vault item')}</strong>${item ? `${esc(item.quantityAvailable)} available · ${money(item.dailyPrice)}/day` : 'Vault link unavailable'}</div><span class="cv-resize" data-resize-id="${element.id}"></span></article>`;
      }
      const editable = this.state.boardTool !== 'hand' && this.state.boardTool !== 'erase';
      if (element.type === 'note') return `<article class="cv-element note ${fresh} ${selected ? 'selected' : ''}" data-element-id="${element.id}" style="${style}"><textarea class="cv-element-content cv-note-content" data-content-id="${element.id}" data-placeholder="Write a note…" placeholder="Write a note…" aria-label="Board note" ${editable ? '' : 'readonly'}>${esc(element.content)}</textarea><span class="cv-resize" data-resize-id="${element.id}"></span></article>`;
      return `<article class="cv-element ${esc(element.type)} ${fresh} ${selected ? 'selected' : ''}" data-element-id="${element.id}" style="${style}"><div class="cv-element-content" contenteditable="${editable ? 'true' : 'false'}" data-content-id="${element.id}" data-placeholder="Write…">${esc(element.content)}</div><span class="cv-resize" data-resize-id="${element.id}"></span></article>`;
    }

    _renderQuoteBuilder() {
      const quote = this.state.quoteDraft;
      if (!quote) { this.state.view = 'vault'; return `${this._renderTop()}${this._renderVault()}`; }
      const totals = this._quoteTotals(quote);
      return `<div><header class="cv-top"><button class="cv-btn" data-action="quote-back">← Vault</button><div class="cv-title"><div class="cv-eyebrow">Canvas document</div><h1>${esc(this._quoteTypeLabel(quote.documentType))}</h1></div><span style="font-size:10.5px;color:var(--cv-muted)">${this.state.quoteSaving ? 'Saving…' : quote.id ? 'Draft saved' : 'Unsaved draft'}</span><button class="cv-btn" data-action="quote-save">Save draft</button><button class="cv-btn accent" data-action="quote-export">Export PDF</button></header><div class="cv-heading"><div><h2>Quote builder</h2><p>Project-specific prices stay inside this document and never overwrite the original Vault rates.</p></div></div><div class="cv-quote-layout"><form class="cv-card cv-quote-form" data-form="quote"><div class="cv-form-grid"><div class="cv-field"><span>Document type</span><select data-quote="documentType">${['visual_proposal','rental_quote','inventory_pull_list','art_department_package'].map((value) => `<option value="${value}" ${quote.documentType === value ? 'selected' : ''}>${esc(this._quoteTypeLabel(value))}</option>`).join('')}</select></div><div class="cv-field"><span>Quote number</span><input data-quote="quoteNumber" value="${esc(quote.quoteNumber)}"></div><div class="cv-field"><span>Client name</span><input data-quote="clientName" value="${esc(quote.clientName)}"></div><div class="cv-field"><span>Company name</span><input data-quote="companyName" value="${esc(quote.companyName)}"></div><div class="cv-field"><span>Production name</span><input data-quote="productionName" value="${esc(quote.productionName)}"></div><div class="cv-field"><span>Project name</span><input data-quote="projectName" value="${esc(quote.projectName)}"></div><div class="cv-field wide"><span>Contact information</span><input data-quote="contactInformation" value="${esc(quote.contactInformation)}"></div><div class="cv-field"><span>Issue date</span><input type="date" data-quote="issueDate" value="${esc(quote.issueDate)}"></div><div class="cv-field"><span>Valid until</span><input type="date" data-quote="validityDate" value="${esc(quote.validityDate)}"></div><div class="cv-field"><span>Rental start</span><input type="date" data-quote="rentalStartDate" value="${esc(quote.rentalStartDate)}"></div><div class="cv-field"><span>Rental end</span><input type="date" data-quote="rentalEndDate" value="${esc(quote.rentalEndDate)}"></div><div class="cv-form-section wide">Selected items</div><div class="cv-quote-lines">${quote.items.map((item) => `<div class="cv-quote-line" data-quote-item="${item.id}"><strong>${esc(item.name)}</strong><input type="number" min="1" data-quote-item-field="quantity" value="${item.quantity}" aria-label="Quantity"><input type="number" min="1" data-quote-item-field="rentalDays" value="${item.rentalDays}" aria-label="Rental days"><input type="number" min="0" step="0.01" data-quote-item-field="pricePerDay" value="${item.pricePerDay}" aria-label="Price per day"><button type="button" data-action="quote-remove-item" data-id="${item.id}" aria-label="Remove item">×</button></div>`).join('')}</div><div class="cv-field"><span>Discount</span><input type="number" min="0" step="0.01" data-quote="discount" value="${quote.discount}"></div><div class="cv-field"><span>Tax rate %</span><input type="number" min="0" max="100" step="0.01" data-quote="taxRate" value="${quote.taxRate}"></div><div class="cv-field"><span>Deposit</span><input type="number" min="0" step="0.01" data-quote="deposit" value="${quote.deposit}"></div><div class="cv-field"><span>Transportation</span><input type="number" min="0" step="0.01" data-quote="transportationCosts" value="${quote.transportationCosts}"></div><div class="cv-field"><span>Labor</span><input type="number" min="0" step="0.01" data-quote="laborCosts" value="${quote.laborCosts}"></div><div class="cv-field"><span>Additional fees</span><input type="number" min="0" step="0.01" data-quote="additionalFees" value="${quote.additionalFees}"></div><div class="cv-field wide"><span>Notes</span><textarea data-quote="notes">${esc(quote.notes)}</textarea></div><div class="cv-field wide"><span>Terms and conditions</span><textarea data-quote="terms">${esc(quote.terms)}</textarea></div></div></form>${this._renderQuotePreview(quote, totals)}</div></div>`;
    }

    _renderQuotePreview(quote, totals) {
      return `<section class="cv-quote-preview" aria-label="Live PDF preview"><div class="cv-preview-eyebrow">${esc(this._quoteTypeLabel(quote.documentType).toUpperCase())}</div><h2>${esc(quote.projectName || this.projectTitle)}</h2><div class="cv-preview-meta"><span><strong>${esc(quote.companyName || 'FilmScript production workspace')}</strong><br>${esc(quote.contactInformation || 'Contact information not filled')}</span><span style="text-align:right"><strong>${esc(quote.quoteNumber)}</strong><br>${esc(quote.issueDate || 'Issue date not filled')}</span></div><div class="cv-preview-table"><div class="cv-preview-row header"><span>ITEM</span><span>QTY / DAYS</span><span style="text-align:right">TOTAL</span></div>${quote.items.map((item) => `<div class="cv-preview-row"><span><strong>${esc(item.name)}</strong><small>${esc(item.code || item.description || '')}</small></span><span>${item.quantity} × ${item.rentalDays}d</span><span style="text-align:right;font-weight:700">${money(item.quantity * item.rentalDays * item.pricePerDay)}</span></div>`).join('')}</div><div class="cv-preview-total"><div><span>Subtotal</span><span>${money(totals.subtotal)}</span></div><div><span>Tax</span><span>${money(totals.tax)}</span></div><div><span>Deposit</span><span>${money(quote.deposit)}</span></div><div><span>Total</span><span>${money(totals.total)}</span></div></div><div class="cv-preview-signatures"><span>AUTHORIZED SIGNATURE</span><span>CLIENT APPROVAL</span></div></section>`;
    }

    _quoteTypeLabel(value) { return ({ visual_proposal: 'Visual Proposal', rental_quote: 'Rental Quote', inventory_pull_list: 'Inventory Pull List', art_department_package: 'Art Department Package' })[value] || 'Rental Quote'; }
    _quoteTotals(quote) {
      const subtotal = quote.items.reduce((sum, item) => sum + num(item.quantity,1) * num(item.rentalDays,1) * num(item.pricePerDay), 0);
      const taxable = Math.max(0, subtotal - num(quote.discount) + num(quote.transportationCosts) + num(quote.laborCosts) + num(quote.additionalFees));
      const tax = taxable * num(quote.taxRate) / 100;
      return { subtotal, tax, total: taxable + tax + num(quote.deposit) };
    }

    _onClick(event) {
      const trigger = event.target.closest('[data-action]');
      const stopBoundary = event.target.closest('[data-stop]');
      // A backdrop also has a data-action. Ignore it when the click originated
      // inside its modal so form controls can focus and submit normally.
      if (stopBoundary && (!trigger || !stopBoundary.contains(trigger))) return;
      if (!trigger) {
        if (this.state.vaultMenu || this.state.boardMenu || this.state.boardContext || this.state.imagineStyleMenu || this.state.imagineAspectMenu || this.state.imagineSizeMenu || this.state.imagineQualityMenu) {
          this.state.vaultMenu = this.state.boardMenu = this.state.boardContext = null;
          this.state.imagineStyleMenu = this.state.imagineAspectMenu = this.state.imagineSizeMenu = this.state.imagineQualityMenu = false;
          return this.state.view === 'imagine' ? this._patchImagineControls() : this.render();
        }
        return;
      }
      const action = trigger.dataset.action;
      const id = trigger.dataset.id || '';
      event.stopPropagation();
      if (action === 'none') return;
      if (action === 'retry') return this.load();
      if (action === 'view-home') return this.setView('home');
      if (action === 'view-vault') return this.setView('vault');
      if (action === 'view-boards') return this.setView('boards');
      if (action === 'view-shotlist') return this.setView('shotlist');
      if (action === 'view-imagine') return this.setView('imagine');
      if (action === 'imagine-unlock-full') {
        return this.presentImageGenerationUpgrade({
          requiredTier: 'full',
          checkoutPlan: 'full',
          source: 'imagine',
          message: 'FilmScript Full unlocks image generation across Imagine, Boards, and Shot List.',
        });
      }
      if (action === 'imagine-remove-reference') {
        this.state.imagineReferenceIds = this.state.imagineReferenceIds.filter((referenceId) => referenceId !== id);
        return this.render();
      }
      if (action === 'imagine-copy-reference') {
        if (!id || !this.asset(id)) return;
        this.state.imagineReferenceIds = [...new Set([...this.state.imagineReferenceIds, id])].slice(-4);
        this.state.imaginePreviewId = '';
        this.toast('Reference added to Imagine');
        return this.render();
      }
      if (action === 'imagine-style-menu') { this.state.imagineStyleMenu = !this.state.imagineStyleMenu; this.state.imagineAspectMenu = this.state.imagineSizeMenu = this.state.imagineQualityMenu = false; return this._patchImagineControls(); }
      if (action === 'imagine-style-select') {
        const style = trigger.dataset.style;
        if (['cinematic', 'animated', 'sketch', 'anime'].includes(style)) this.state.imagineStyle = style;
        this.state.imagineStyleMenu = false;
        return this._patchImagineControls();
      }
      if (action === 'imagine-size-menu') { this.state.imagineSizeMenu = !this.state.imagineSizeMenu; this.state.imagineStyleMenu = this.state.imagineAspectMenu = this.state.imagineQualityMenu = false; return this._patchImagineControls(); }
      if (action === 'imagine-size-select') {
        const option = this.imagineSizeOption(trigger.dataset.size);
        this.state.imagineSize = option.value;
        this.state.imagineOrientation = option.orientation === 'vertical' ? 'vertical' : 'horizontal';
        this.state.imagineSizeMenu = false;
        return this._patchImagineControls();
      }
      if (action === 'imagine-aspect-menu') { this.state.imagineAspectMenu = !this.state.imagineAspectMenu; this.state.imagineStyleMenu = this.state.imagineSizeMenu = this.state.imagineQualityMenu = false; return this._patchImagineControls(); }
      if (action === 'imagine-aspect-select') {
        this.state.imagineOrientation = trigger.dataset.orientation === 'vertical' ? 'vertical' : 'horizontal';
        this.state.imagineAspectMenu = false;
        return this._patchImagineControls();
      }
      if (action === 'imagine-quality-menu') { this.state.imagineQualityMenu = !this.state.imagineQualityMenu; this.state.imagineStyleMenu = this.state.imagineAspectMenu = this.state.imagineSizeMenu = false; return this._patchImagineControls(); }
      if (action === 'imagine-quality-select') {
        const quality = trigger.dataset.quality;
        if (['low', 'medium', 'high'].includes(quality)) this.state.imagineQuality = quality;
        this.state.imagineQualityMenu = false;
        return this._patchImagineControls();
      }
      if (action === 'imagine-preview') { this.state.imaginePreviewId = id; return this.render(); }
      if (action === 'close-imagine-preview') { this.state.imaginePreviewId = ''; return this.render(); }
      if (action === 'add-item') { this.clearVaultUploadDraft(); this.state.itemModal = true; this.state.itemSaving = false; this.state.editingItemId = ''; return this.render(); }
      if (action === 'close-item') { if (this.state.itemSaving) return; this.clearVaultUploadDraft(); this.state.itemModal = false; this.state.editingItemId = ''; return this.render(); }
      if (action === 'view-item') { this.state.itemDetailId = id; this.state.vaultMenu = null; return this.render(); }
      if (action === 'toggle-item') return;
      if (action === 'close-item-detail') { this.state.itemDetailId = ''; return this.render(); }
      if (action === 'edit-item') { this.state.itemModal = true; this.state.editingItemId = id; this.state.itemDetailId = ''; this.state.vaultMenu = null; return this.render(); }
      if (action === 'item-menu') { const rect = trigger.getBoundingClientRect(); this.state.vaultMenu = { id, x: Math.min(innerWidth - 180, rect.right - 170), y: rect.bottom + 5 }; return this.render(); }
      if (action === 'duplicate-item') return this.duplicateVaultItem(id);
      if (action === 'archive-item') return this.archiveVaultItems([id]);
      if (action === 'delete-item') return this.deleteVaultItem(id);
      if (action === 'vault-grid' || action === 'vault-list') return this.setVaultView(action === 'vault-list' ? 'list' : 'grid');
      if (action === 'clear-vault-filters') { Object.assign(this.state,{search:'',category:'',availability:'',condition:'',storage:''}); return this.render(); }
      if (action === 'import-items') return this.shadowRoot.querySelector('[data-file="vault-import"]')?.click();
      if (action === 'selection-clear') { this.state.selected.clear(); return this.render(); }
      if (action === 'selection-project') return this.addSelectionToProject();
      if (action === 'selection-board') { this.state.pickerMode = 'selection'; return this.render(); }
      if (action === 'selection-proposal') return this.openQuote('visual_proposal');
      if (action === 'selection-quote') return this.openQuote('rental_quote');
      if (action === 'selection-export') return this.openQuote('inventory_pull_list');
      if (action === 'selection-duplicate') return this.duplicateSelected();
      if (action === 'selection-archive') return this.archiveVaultItems([...this.state.selected]);
      if (action === 'create-board') { this.state.boardModal = true; return this.render(); }
      if (action === 'close-board-modal') { this.state.boardModal = false; return this.render(); }
      if (action === 'open-storyboard-image') return this.openStoryboardImageModal();
      if (action === 'close-storyboard-image') { if (this.state.storyboardImageGenerating) return; this.state.storyboardImageModal = false; this.state.visualReferencePicker = null; return this.render(); }
      if (action === 'close-visual-reference-picker') { this.state.visualReferencePicker = null; this.state.visualReferencePickerDragging = false; return this.render(); }
      if (action === 'recent-imagine') { this.state.visualReferencePickerSource = 'imagine'; return this.render(); }
      if (action === 'visual-reference-vault') { this.state.visualReferencePickerSource = 'vault'; return this.render(); }
      if (action === 'open-imagine') { this.state.visualReferencePicker = null; this.state.storyboardImageModal = false; return this.setView('imagine'); }
      if (action === 'reference-upload') {
        const input = this.shadowRoot.querySelector('[data-file="visual-reference-upload"]');
        if (!input) return this.toast('Image upload is not ready yet.');
        input.value = ''; input.click(); return;
      }
      if (action === 'visual-reference-select') return this.selectVisualReference(id);
      if (action === 'open-board') return this.openBoard(id);
      if (action === 'download-generated-image') return this.downloadGeneratedImage(id);
      if (action === 'imagine-add-to-board') { this.state.pendingImagineAssetId = id; this.state.pickerMode = 'imagine-board'; return this.render(); }
      if (action === 'board-menu') { const rect = trigger.getBoundingClientRect(); this.state.boardMenu = { id, x: Math.min(innerWidth - 180, rect.right - 170), y: rect.bottom + 5 }; return this.render(); }
      if (action === 'board-history') { this.state.boardMenu = null; window.filmscriptPlatform?.openActivity?.('canvas'); return this.render(); }
      if (action === 'board-comments') { this.state.boardMenu = null; window.dispatchEvent(new CustomEvent('filmscript:open-comments',{detail:{module:'canvas',entityType:'canvas_board',entityId:id}})); return this.render(); }
      if (action === 'board-object-comments') { this.state.boardContext = null; window.dispatchEvent(new CustomEvent('filmscript:open-comments',{detail:{module:'canvas',entityType:'canvas_object',entityId:id}})); return this.render(); }
      if (action === 'duplicate-board') return this.duplicateBoard(id);
      if (action === 'delete-board') return this.deleteBoard(id);
      if (action === 'close-picker') { this.state.pickerMode = ''; return this.render(); }
      if (action === 'picker-create-board') { this.state.pickerMode = ''; this.state.boardModal = true; return this.render(); }
      if (action === 'pick-board') return this.addSelectedToBoard(id);
      if (action === 'pick-imagine-board') return this.addImagineToBoard(id);
      if (action === 'pick-vault-item') return this.addVaultItemToActiveBoard(id);
      if (action === 'add-imagine-image') return this.addImagineImageToActiveBoard(id);
      if (action === 'back-boards') { this.flushBoardSave(); this.state.view = 'boards'; this.state.activeBoardId = ''; this.state.selected.clear(); return this.render(); }
      if (action === 'board-tool-select') return this.setBoardTool('select');
      if (action === 'board-tool-hand') return this.setBoardTool('hand');
      if (action === 'board-tool-erase') return this.setBoardTool('erase');
      if (action === 'board-add-image' || action === 'board-upload') {
        this.state.boardContext = null; this.state.visualReferencePicker = { target: 'board-add' };
        this.state.visualReferencePickerSource = 'imagine'; return this.render();
      }
      if (action === 'board-generate-image') {
        this.state.visualReferencePicker = { target: 'board-generate' }; return this.openStoryboardImageModal();
      }
      if (action === 'board-add-text') return this.addBoardElement('text');
      if (action === 'board-add-note') return this.addBoardElement('note');
      if (action === 'board-add-vault') { this.state.boardContext = null; this.state.pickerMode = 'board-vault'; return this.render(); }
      if (action === 'board-add-imagine') { this.state.boardContext = null; this.state.pickerMode = 'board-imagine'; return this.render(); }
      if (action === 'board-zoom-in') return this.zoomBoard(.12);
      if (action === 'board-zoom-out') return this.zoomBoard(-.12);
      if (action === 'board-fit') return this.fitBoard();
      if (action === 'board-snap') { const board=this.activeBoard(); if(!board)return; this.pushHistory(); board.settings.snapToGrid=!board.settings.snapToGrid; this.queueBoardSave(); return this.render(); }
      if (action === 'board-undo') return this.undoBoard();
      if (action === 'board-redo') return this.redoBoard();
      if (action === 'board-delete-selection') { this.state.boardContext = null; return this.deleteBoardSelection(); }
      if (action === 'board-duplicate-selection') { this.state.boardContext = null; return this.duplicateBoardSelection(); }
      if (action === 'board-group-selection') { this.state.boardContext = null; return this.groupBoardSelection(); }
      if (action === 'board-align-left') { this.state.boardContext = null; return this.alignBoardSelection(); }
      if (action === 'board-download-selection') { this.state.boardContext = null; return this.downloadBoardSelection(); }
      if (action === 'quote-back') { this.state.quoteDraft = null; this.state.view='vault'; return this.render(); }
      if (action === 'quote-save') return this.saveQuote();
      if (action === 'quote-export') return this.exportQuote();
      if (action === 'quote-remove-item') { this.state.quoteDraft.items=this.state.quoteDraft.items.filter((item)=>item.id!==id); return this.render(); }
    }

    _onInput(event) {
      if (event.target.dataset.imaginePrompt !== undefined) {
        this.state.imaginePrompt = event.target.value;
        event.target.style.height = 'auto';
        event.target.style.height = `${Math.min(180, Math.max(54, event.target.scrollHeight))}px`;
        return;
      }
      const field = event.target.dataset.field;
      if (field === 'vault-search') { this.state.search = event.target.value; return this.render(); }
      if (field === 'board-title') { const board=this.activeBoard(); if(board){this._beginTextHistory('board-title');board.title=event.target.value;this.queueBoardSave();} return; }
      if (event.target.dataset.contentId) {
        const element = this.activeBoard()?.elements.find((entry) => entry.id === event.target.dataset.contentId);
        if (element) { this._beginTextHistory(`element:${element.id}`); element.content = String(event.target.value ?? event.target.textContent ?? '').slice(0, 20000); element.updatedAt = new Date().toISOString(); this.queueBoardSave(); }
        return;
      }
      const quoteField = event.target.dataset.quote;
      if (quoteField && this.state.quoteDraft) {
        this.state.quoteDraft[quoteField] = ['discount','taxRate','deposit','transportationCosts','laborCosts','additionalFees'].includes(quoteField) ? num(event.target.value) : event.target.value;
        return this._refreshQuotePreview();
      }
      const lineField = event.target.dataset.quoteItemField;
      if (lineField && this.state.quoteDraft) {
        const row = event.target.closest('[data-quote-item]');
        const item = this.state.quoteDraft.items.find((entry) => entry.id === row?.dataset.quoteItem);
        if (item) item[lineField] = num(event.target.value, lineField === 'pricePerDay' ? 0 : 1);
        return this._refreshQuotePreview();
      }
    }

    _onChange(event) {
      const field = event.target.dataset.field;
      if (field === 'imagine-media-mode') {
        const capabilities = this._imagineCapabilities();
        const requested = String(event.target.value || '').trim().toLowerCase();
        if (capabilities.mediaModes.some((option) => option.id === requested)) {
          this.state.imagineMediaMode = requested;
          this.state.imagineMediaModeExplicit = true;
        }
        const models = this._imagineModelsForMode(capabilities, this.state.imagineMediaMode);
        if (!models.some((option) => option.id === this.state.imagineModelId)) {
          this.state.imagineModelId = models.some((option) => option.id === capabilities.defaults.modelId)
            ? capabilities.defaults.modelId
            : (models[0]?.id || '');
          this.state.imagineModelIdExplicit = false;
        }
        return this.render();
      }
      if (field === 'imagine-model-id') {
        const capabilities = this._imagineCapabilities();
        const models = this._imagineModelsForMode(capabilities, this.state.imagineMediaMode);
        const requested = String(event.target.value || '').trim().toLowerCase();
        if (models.some((option) => option.id === requested)) {
          this.state.imagineModelId = requested;
          this.state.imagineModelIdExplicit = true;
        }
        return this.render();
      }
      if (field === 'vault-category') this.state.category = event.target.value;
      else if (field === 'vault-availability') this.state.availability = event.target.value;
      else if (field === 'vault-condition') this.state.condition = event.target.value;
      else if (field === 'vault-storage') this.state.storage = event.target.value;
      else if (field === 'vault-sort') this.state.sort = event.target.value;
      else if (event.target.dataset.selectItem) {
        if (event.target.checked) this.state.selected.add(event.target.dataset.selectItem); else this.state.selected.delete(event.target.dataset.selectItem);
      } else if (event.target.dataset.file === 'vault-images') {
        this.setPendingVaultFiles([...event.target.files]);
        return;
      } else if (event.target.dataset.file === 'vault-import') {
        const file = event.target.files?.[0];
        event.target.value = '';
        return this.importVault(file);
      } else if (event.target.dataset.file === 'board-image') {
        const file = event.target.files?.[0];
        event.target.value = '';
        return this.uploadBoardImage(file);
      } else if (event.target.dataset.file === 'visual-reference-upload') {
        const files = [...(event.target.files || [])].filter((file) => ['image/png', 'image/jpeg', 'image/webp'].includes(file.type));
        event.target.value = '';
        return this.uploadVisualReferences(files);
      } else if (event.target.dataset.file === 'imagine-references') {
        const files = [...(event.target.files || [])].slice(0, 4);
        event.target.value = '';
        return this.uploadImagineReferences(files);
      }
      else if (event.target.dataset.quote) return this._onInput(event);
      if (field || event.target.dataset.selectItem) this.render();
    }

    _imagineComposerFrom(event) {
      if (this.state.view !== 'imagine') return null;
      return event.target instanceof Element ? event.target.closest('.cv-imagine-console') : null;
    }

    _visualReferencePickerFrom(event) {
      return event.target instanceof Element ? event.target.closest('[data-visual-reference-drop="board"]') : null;
    }

    _setImagineDragging(active) {
      this.state.imagineDragging = active;
      this.shadowRoot.querySelector('.cv-imagine-console')?.classList.toggle('is-dragging', active);
    }

    _onDragOver(event) {
      const visualPicker = this._visualReferencePickerFrom(event);
      if (visualPicker && event.dataTransfer?.types?.includes('Files')) {
        event.preventDefault(); event.dataTransfer.dropEffect = 'copy';
        this.state.visualReferencePickerDragging = true;
        return visualPicker.classList.add('is-dragging');
      }
      const composer = this._imagineComposerFrom(event);
      if (!composer || !event.dataTransfer?.types?.includes('Files')) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      this._setImagineDragging(true);
    }

    _onDragLeave(event) {
      const visualPicker = this._visualReferencePickerFrom(event);
      if (visualPicker && !visualPicker.contains(event.relatedTarget)) {
        this.state.visualReferencePickerDragging = false;
        return visualPicker.classList.remove('is-dragging');
      }
      const composer = this._imagineComposerFrom(event);
      if (!composer || composer.contains(event.relatedTarget)) return;
      this._setImagineDragging(false);
    }

    _onDrop(event) {
      const visualPicker = this._visualReferencePickerFrom(event);
      if (visualPicker && event.dataTransfer?.files?.length) {
        event.preventDefault(); this.state.visualReferencePickerDragging = false;
        visualPicker.classList.remove('is-dragging');
        const files = [...event.dataTransfer.files].filter((file) => ['image/png', 'image/jpeg', 'image/webp'].includes(file.type)).slice(0, 4);
        if (!files.length) return this.toast('Drop a PNG, JPEG, or WebP image to use as a reference.');
        return this.uploadVisualReferences(files);
      }
      const composer = this._imagineComposerFrom(event);
      if (!composer || !event.dataTransfer?.files?.length) return;
      event.preventDefault();
      this._setImagineDragging(false);
      const files = [...event.dataTransfer.files]
        .filter((file) => ['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
        .slice(0, 4);
      if (!files.length) return this.toast('Drop a PNG, JPEG, or WebP image to use as a reference.');
      this.uploadImagineReferences(files);
    }

    _onPaste(event) {
      if (this.state.view !== 'imagine') return;
      const clipboard = event.clipboardData;
      if (!clipboard) return;
      const pastedFiles = Array.from(clipboard.files || []);
      const files = (pastedFiles.length ? pastedFiles : Array.from(clipboard.items || [])
        .filter((item) => item.kind === 'file' && /^image\//.test(item.type || ''))
        .map((item) => item.getAsFile())
        .filter(Boolean))
        .filter((file) => /^image\/(png|jpeg|webp)$/.test(file.type || ''))
        .slice(0, 4);
      if (!files.length) return;
      event.preventDefault();
      this.uploadImagineReferences(files);
    }

    _onSubmit(event) {
      event.preventDefault();
      const form = event.target;
      if (form.dataset.form === 'vault-item') return this.saveVaultItem(form);
      if (form.dataset.form === 'new-board') {
        const submitter = event.submitter;
        return this.createBoard(new FormData(form).get('title'), submitter?.value || 'blank');
      }
      if (form.dataset.form === 'storyboard-image') {
        const data = new FormData(form);
        return this.generateStoryboardImage({ prompt: data.get('prompt'), orientation: data.get('orientation') });
      }
      if (form.dataset.form === 'imagine-image') return this.generateImagineImage(new FormData(form));
    }

    _onContextMenu(event) {
      const viewport = event.target.closest('[data-board-viewport]');
      if (!viewport) return;
      event.preventDefault();
      const rect = this.getBoundingClientRect();
      const element = event.target.closest('[data-element-id]');
      if (element) {
        const elementId = element.dataset.elementId;
        if (!this.state.selected.has(elementId)) this.state.selected = new Set([elementId]);
        this.state.boardContext = { x: Math.min(innerWidth - 190, event.clientX), y: Math.min(innerHeight - 190, event.clientY), elementId };
      } else {
        this.state.boardContext = { x: Math.min(innerWidth - 190, event.clientX), y: Math.min(innerHeight - 190, event.clientY), boardX: event.offsetX, boardY: event.offsetY };
      }
      this.render();
    }

    _onKeyDown(event) {
      // Imagine is a prompt-first canvas: Enter makes a frame immediately.
      // Shift+Enter stays available for a deliberate line break, and IME
      // composition must never be mistaken for a completed prompt.
      if (
        this.state.view === 'imagine'
        && event.target?.matches?.('textarea[data-imagine-prompt]')
        && event.key === 'Enter'
        && !event.shiftKey
        && !event.altKey
        && !event.ctrlKey
        && !event.metaKey
        && !event.isComposing
        && !event.repeat
      ) {
        const form = event.target.closest('form[data-form="imagine-image"]');
        if (form) {
          event.preventDefault();
          return this.generateImagineImage(new FormData(form));
        }
      }
      if (this.state.view === 'vault' && (event.key === 'Enter' || event.key === ' ') && !event.target.matches('input,button,select,textarea')) {
        const card = event.target.closest('[data-action="view-item"]');
        if (card) { event.preventDefault(); this.state.itemDetailId = card.dataset.id; return this.render(); }
      }
      if (this.state.view === 'boards' && (event.key === 'Enter' || event.key === ' ')) {
        const card = event.target.closest('[data-action="open-board"]');
        if (card) { event.preventDefault(); return this.openBoard(card.dataset.id); }
      }
      if (this.state.view !== 'board' || event.target.matches('input,textarea,[contenteditable=true]')) return;
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === 'z') { event.preventDefault(); return event.shiftKey ? this.redoBoard() : this.undoBoard(); }
      if (modifier && event.key.toLowerCase() === 'd') { event.preventDefault(); return this.duplicateBoardSelection(); }
      if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); return this.deleteBoardSelection(); }
      if (event.key === 'Escape') { this._stopPointerInteraction(true); this.state.selected.clear(); this.state.boardContext=null; return this.render(); }
      if (event.key === '+' || event.key === '=') return this.zoomBoard(.12);
      if (event.key === '-') return this.zoomBoard(-.12);
    }

    async setVaultView(view) {
      this.state.workspace.settings.vaultView = view;
      this.render();
      try { await window.filmscriptCanvas.update(this.scriptId, { settings: this.state.workspace.settings }); } catch {}
    }

    async compressImage(file) {
      if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Choose a PNG, JPEG, or WebP image.');
      if (file.size > 14 * 1024 * 1024) throw new Error('Images must be under 14 MB before compression.');
      let objectUrl = '';
      try {
        let source;
        if (typeof createImageBitmap === 'function') source = await createImageBitmap(file);
        else {
          objectUrl = URL.createObjectURL(file);
          source = await new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error('The image could not be decoded.'));
            image.src = objectUrl;
          });
        }
        const sourceWidth = source.width || source.naturalWidth;
        const sourceHeight = source.height || source.naturalHeight;
        if (!sourceWidth || !sourceHeight) throw new Error('The image has no readable dimensions.');
        const scale = Math.min(1, 1920 / Math.max(sourceWidth, sourceHeight));
        const width = Math.max(1, Math.round(sourceWidth * scale));
        const height = Math.max(1, Math.round(sourceHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d', { alpha: true }).drawImage(source, 0, 0, width, height);
        source.close?.();
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        const type = file.type === 'image/png' ? 'image/png' : 'image/webp';
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, .84));
        const compressed = new File([blob || file], file.name.replace(/\.[^.]+$/, type === 'image/png' ? '.png' : '.webp'), { type: blob?.type || file.type });
        return { file: compressed, width, height };
      } catch (error) {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        if (file.size > 8 * 1024 * 1024) throw new Error('This image could not be compressed. Choose an image under 8 MB.');
        return { file, width: 0, height: 0 };
      }
    }

    async uploadFiles(files, scope = 'canvas') {
      const assets = [];
      for (const original of files || []) {
        const compressed = await this.compressImage(original);
        const result = this.accountScoped
          ? await window.filmscriptCanvas.uploadAccountImagingAsset(compressed.file, compressed)
          : await window.filmscriptCanvas.uploadAsset(this.scriptId, compressed.file, { ...compressed, scope });
        assets.push(result.asset);
        this.state.workspace.assets = Array.isArray(this.state.workspace.assets) ? this.state.workspace.assets : [];
        this.state.workspace.assets.push(result.asset);
      }
      return assets;
    }

    clearVaultUploadDraft() {
      (this._pendingVaultPreviewUrls || []).forEach((url) => URL.revokeObjectURL(url));
      this._pendingVaultPreviewUrls = [];
      this._pendingVaultFiles = [];
    }

    setPendingVaultFiles(files) {
      this.clearVaultUploadDraft();
      this._pendingVaultFiles = (files || []).filter((file) => /^image\/(png|jpeg|webp)$/.test(file?.type || ''));
      this._pendingVaultPreviewUrls = this._pendingVaultFiles.map((file) => URL.createObjectURL(file));
      const label = this.shadowRoot.querySelector('.cv-file-drop strong');
      if (label) label.textContent = `${this._pendingVaultFiles.length} image${this._pendingVaultFiles.length === 1 ? '' : 's'} ready`;
      const preview = this.shadowRoot.querySelector('[data-vault-preview]');
      if (!preview) return;
      preview.replaceChildren();
      this._pendingVaultFiles.forEach((file, index) => {
        const figure = document.createElement('figure');
        const image = document.createElement('img');
        image.src = this._pendingVaultPreviewUrls[index];
        image.alt = file.name || 'Selected image';
        const caption = document.createElement('figcaption');
        caption.textContent = file.name || 'Selected image';
        figure.append(image, caption);
        preview.append(figure);
      });
      preview.classList.toggle('has-images', Boolean(this._pendingVaultFiles.length));
    }

    setVaultSaving(saving, editing = false) {
      this.state.itemSaving = Boolean(saving);
      const form = this.shadowRoot.querySelector('[data-form="vault-item"]');
      if (!form) return;
      form.querySelectorAll('input,textarea,select,button').forEach((control) => { control.disabled = Boolean(saving); });
      const submit = form.querySelector('[data-vault-submit]');
      if (submit) submit.textContent = saving ? (editing ? 'Saving…' : 'Adding to Vault…') : (editing ? 'Save changes' : 'Add to Vault');
    }

    formObject(form) {
      const data = Object.fromEntries(new FormData(form).entries());
      ['quantityOwned','quantityAvailable'].forEach((key) => { data[key] = Math.max(0, Math.round(num(data[key]))); });
      ['dailyPrice','weeklyPrice','replacementValue','depositAmount'].forEach((key) => { data[key] = Math.max(0, num(data[key])); });
      data.tags = String(data.tags || '').split(',').map((entry) => entry.trim()).filter(Boolean);
      return data;
    }

    async saveVaultItem(form) {
      if (this.state.itemSaving) return;
      const editing = this.state.workspace.vaultItems.find((entry) => entry.id === this.state.editingItemId);
      const draft = this.formObject(form);
      this.setVaultSaving(true, Boolean(editing));
      try {
        const assets = await this.uploadFiles(this._pendingVaultFiles);
        if (assets.length) {
          draft.imageIds = [...(editing?.imageIds || []), ...assets.map((asset) => asset.id)];
          draft.mainImageId = editing?.mainImageId || assets[0].id;
        }
        const result = editing
          ? await window.filmscriptCanvas.updateVaultItem(this.scriptId, editing.id, draft)
          : await window.filmscriptCanvas.createVaultItem(this.scriptId, draft);
        if (editing) this.state.workspace.vaultItems = this.state.workspace.vaultItems.map((item) => item.id === editing.id ? result.item : item);
        else this.state.workspace.vaultItems.unshift(result.item);
        this.clearVaultUploadDraft();
        this.state.itemModal = false; this.state.itemSaving = false; this.state.editingItemId = '';
        this.toast(editing ? 'Vault item updated' : 'Added to Vault');
      } catch (error) {
        this.setVaultSaving(false, Boolean(editing));
        this.toast(error.message || 'Could not save the Vault item.');
      }
    }

    async duplicateVaultItem(itemId, silent = false) {
      const item = this.state.workspace.vaultItems.find((entry) => entry.id === itemId);
      if (!item) return;
      try {
        const copy = { ...item, id: undefined, name: `${item.name} copy`, code: item.code ? `${item.code}-COPY` : '' };
        const result = await window.filmscriptCanvas.createVaultItem(this.scriptId, copy);
        this.state.workspace.vaultItems.unshift(result.item);
        if (!silent) this.toast('Vault item duplicated');
      } catch (error) { this.toast(error.message); }
    }

    async duplicateSelected() {
      for (const itemId of [...this.state.selected]) await this.duplicateVaultItem(itemId, true);
      this.state.selected.clear();
      this.toast('Selected items duplicated');
    }

    async archiveVaultItems(ids) {
      if (!ids.length || !confirm(`Archive ${ids.length} selected item${ids.length === 1 ? '' : 's'}?`)) return;
      try {
        for (const itemId of ids) {
          const result = await window.filmscriptCanvas.updateVaultItem(this.scriptId, itemId, { archived: true });
          this.state.workspace.vaultItems = this.state.workspace.vaultItems.map((item) => item.id === itemId ? result.item : item);
        }
        this.state.selected.clear(); this.state.vaultMenu = null; this.toast('Items archived');
      } catch (error) { this.toast(error.message); }
    }

    async deleteVaultItem(itemId) {
      const item = this.state.workspace.vaultItems.find((entry) => entry.id === itemId);
      if (!item || !confirm(`Delete “${item.name}” permanently? This will also remove its cards from Boards.`)) return;
      try {
        await window.filmscriptCanvas.deleteVaultItem(this.scriptId, itemId);
        this.state.workspace.vaultItems = this.state.workspace.vaultItems.filter((entry) => entry.id !== itemId);
        this.state.workspace.boards.forEach((board) => { board.elements = board.elements.filter((element) => element.vaultItemId !== itemId); });
        this.state.vaultMenu = null; this.toast('Vault item deleted');
      } catch (error) { this.toast(error.message); }
    }

    async addSelectionToProject() {
      const selection = { id: uid('vsel'), name: this.projectTitle, itemIds: [...this.state.selected], context: { project: this.projectTitle }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      const selections = [...(this.state.workspace.vaultSelections || []), selection];
      try {
        const result = await window.filmscriptCanvas.update(this.scriptId, { vaultSelections: selections });
        this.state.workspace = result.workspace; this.state.selected.clear(); this.toast('Added to this project');
      } catch (error) { this.toast(error.message); }
    }

    openQuote(documentType) {
      const items = [...this.state.selected].map((itemId) => this.state.workspace.vaultItems.find((item) => item.id === itemId)).filter(Boolean);
      if (!items.length) return this.toast('Select at least one Vault item first.');
      this.state.quoteDraft = {
        documentType, clientName:'',companyName:'',productionName:this.projectTitle,projectName:this.projectTitle,contactInformation:'',
        quoteNumber:`FS-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`,issueDate:today(),validityDate:'',rentalStartDate:'',rentalEndDate:'',
        items:items.map((item)=>({id:uid('qti'),vaultItemId:item.id,name:item.name,code:item.code,imageId:item.mainImageId,quantity:item.projectOverrides?.requestedQuantity||1,rentalDays:item.projectOverrides?.rentalDays||1,pricePerDay:item.projectOverrides?.negotiatedPrice||item.dailyPrice,description:item.description,notes:'',sceneAssignment:item.projectOverrides?.sceneAssignment||'',setAssignment:item.projectOverrides?.setAssignment||''})),
        discount:0,taxRate:0,deposit:0,transportationCosts:0,laborCosts:0,additionalFees:0,notes:'',terms:'',display:{imageStyle:'compact',prices:true,itemCodes:true,quantities:true,descriptions:true,notes:true,assignments:true,companyBranding:true},status:'draft'
      };
      this.state.view = 'quote'; this.render();
    }

    _refreshQuotePreview() {
      const preview = this.shadowRoot.querySelector('.cv-quote-preview');
      if (preview) preview.outerHTML = this._renderQuotePreview(this.state.quoteDraft, this._quoteTotals(this.state.quoteDraft));
    }

    async saveQuote() {
      if (!this.state.quoteDraft || this.state.quoteSaving) return this.state.quoteDraft;
      this.state.quoteSaving = true; this.render();
      try {
        const result = this.state.quoteDraft.id
          ? await window.filmscriptCanvas.updateQuote(this.scriptId, this.state.quoteDraft.id, this.state.quoteDraft)
          : await window.filmscriptCanvas.createQuote(this.scriptId, this.state.quoteDraft);
        this.state.quoteDraft = result.quote;
        const index = this.state.workspace.quotes.findIndex((quote) => quote.id === result.quote.id);
        if (index >= 0) this.state.workspace.quotes[index] = result.quote; else this.state.workspace.quotes.unshift(result.quote);
        this.state.quoteSaving = false; this.render(); return result.quote;
      } catch (error) { this.state.quoteSaving = false; this.toast(error.message); return null; }
    }

    async exportQuote() {
      if (!confirm('Export this client document as a final PDF? Review names, prices, dates, and terms before continuing.')) return;
      const quote = await this.saveQuote();
      if (!quote) return;
      try {
        const response = await fetch(window.filmscriptCanvas.quotePdfUrl(this.scriptId, quote.id), { credentials:'include' });
        if (!response.ok) throw new Error((await response.json().catch(()=>({}))).error || 'Could not export the PDF.');
        const blob = await response.blob();
        const url = URL.createObjectURL(blob); const link=document.createElement('a'); link.href=url; link.download=`${quote.projectName || 'FilmScript'}-${quote.quoteNumber}.pdf`; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
        this.toast('PDF exported');
      } catch (error) { this.toast(error.message); }
    }

    async importVault(file) {
      if (!file) return;
      try {
        const raw = await file.text(); let entries;
        if (file.name.toLowerCase().endsWith('.json')) entries = JSON.parse(raw);
        else {
          const [header,...rows]=raw.split(/\r?\n/).filter(Boolean).map((line)=>line.split(',').map((cell)=>cell.trim()));
          entries=rows.map((row)=>Object.fromEntries(header.map((key,index)=>[key,row[index]||''])));
        }
        if (!Array.isArray(entries)) throw new Error('The import file must contain a list of items.');
        for (const entry of entries.slice(0,500)) {
          const result=await window.filmscriptCanvas.createVaultItem(this.scriptId,entry); this.state.workspace.vaultItems.unshift(result.item);
        }
        this.toast(`${Math.min(entries.length,500)} item${entries.length===1?'':'s'} imported`);
      } catch (error) { this.toast(error.message || 'Could not import those items.'); }
    }

    async createBoard(title, type) {
      try {
        const result=await window.filmscriptCanvas.createBoard(this.scriptId,{title:String(title||'').trim()||`Untitled ${typeLabels[type]} Board`,type,elements:[],viewport:{x:0,y:0,zoom:1},settings:{snapToGrid:false,gridSize:16}});
        this.state.workspace.boards.unshift(result.board); this.state.boardModal=false; this.openBoard(result.board.id);
      } catch(error){this.toast(error.message);}
    }

    openBoard(boardId){this.state.activeBoardId=boardId;this.state.view='board';this.state.selected.clear();this.state.boardTool='select';this.state.boardMenu=null;this._history=[];this._future=[];this.state.autosave='Saved';this.render();}
    setBoardTool(tool){if(!['select','hand','erase'].includes(tool))return;this._stopPointerInteraction(false);this.state.boardTool=tool;this.state.boardContext=null;if(tool!=='select')this.state.selected.clear();this.render();}
    async duplicateBoard(boardId){const board=this.state.workspace.boards.find((entry)=>entry.id===boardId);if(!board)return;try{const result=await window.filmscriptCanvas.createBoard(this.scriptId,{...board,id:undefined,title:`${board.title} copy`,elements:board.elements.map((element)=>({...element,id:undefined,positionX:element.positionX+24,positionY:element.positionY+24}))});this.state.workspace.boards.unshift(result.board);this.state.boardMenu=null;this.toast('Board duplicated');}catch(error){this.toast(error.message);}}
    async deleteBoard(boardId){const board=this.state.workspace.boards.find((entry)=>entry.id===boardId);if(!board||!confirm(`Delete “${board.title}” and every element on it?`))return;try{await window.filmscriptCanvas.deleteBoard(this.scriptId,boardId);this.state.workspace.boards=this.state.workspace.boards.filter((entry)=>entry.id!==boardId);this.state.boardMenu=null;this.toast('Board deleted');}catch(error){this.toast(error.message);}}

    _boardPoint(){const board=this.activeBoard();const context=this.state.boardContext;const viewport=this.shadowRoot.querySelector('[data-board-viewport]');const rect=viewport?.getBoundingClientRect();if(context&&rect)return{x:(context.x-rect.left-board.viewport.x)/board.viewport.zoom,y:(context.y-rect.top-board.viewport.y)/board.viewport.zoom};return{x:(viewport?.clientWidth||800)/2/board.viewport.zoom-board.viewport.x/board.viewport.zoom,y:(viewport?.clientHeight||600)/2/board.viewport.zoom-board.viewport.y/board.viewport.zoom};}
    _snapshotCurrent(){const board=this.activeBoard();return board?JSON.stringify({title:board.title||'',elements:Array.isArray(board.elements)?board.elements:[],viewport:{x:0,y:0,zoom:1,...(board.viewport||{})},settings:{snapToGrid:false,gridSize:16,...(board.settings||{})}}):'';}
    pushHistory(){const snapshot=this._snapshotCurrent();if(!snapshot||this._history.at(-1)===snapshot)return false;this._history.push(snapshot);if(this._history.length>this._historyLimit)this._history.shift();this._future=[];this._updateBoardChrome();return true;}
    _beginTextHistory(key){if(this._textHistoryKey!==key){this.pushHistory();this._textHistoryKey=key;}clearTimeout(this._textHistoryTimer);this._textHistoryTimer=setTimeout(()=>{this._textHistoryKey='';},700);}
    _assetFrame(assetId,fallbackWidth=300,fallbackHeight=220){const asset=(this.state.workspace?.assets||[]).find((entry)=>entry.id===assetId)||{};const ratio=num(asset.width)>0&&num(asset.height)>0?num(asset.width)/num(asset.height):fallbackWidth/fallbackHeight;const width=Math.round(Math.max(150,Math.min(420,fallbackWidth)));return{width,height:Math.round(width/ratio),aspectRatio:ratio};}
    addBoardElement(type,extra={}){const board=this.activeBoard();if(!board)return;board.elements=Array.isArray(board.elements)?board.elements:[];board.settings={snapToGrid:false,gridSize:16,...(board.settings||{})};this.pushHistory();const point=this._boardPoint();if(!this.state.boardContext&&board.elements.length){const slot=board.elements.length%6;const cycle=Math.floor(board.elements.length/6);const offsets=[[0,0],[360,0],[-360,0],[0,230],[360,230],[-360,230]][slot];point.x+=offsets[0]+cycle*28;point.y+=offsets[1]+cycle*28;}const element={id:uid('bel'),type,positionX:point.x,positionY:point.y,width:type==='text'?320:220,height:type==='text'?90:150,rotation:0,zIndex:Math.max(0,...board.elements.map((entry)=>entry.zIndex||0))+1,content:type==='text'?'Title':'',metadata:{},status:'',locked:false,hidden:false,groupId:'',sceneId:'',vaultItemId:'',assetId:'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),...extra};if(board.settings.snapToGrid){const g=Math.max(1,num(board.settings.gridSize,16));element.positionX=Math.round(element.positionX/g)*g;element.positionY=Math.round(element.positionY/g)*g;}board.elements.push(element);this._boardNewElementIds=new Set([element.id]);this.state.selected=new Set([element.id]);this.state.boardContext=null;this.queueBoardSave();this.render();if(type==='note')requestAnimationFrame(()=>this.shadowRoot.querySelector(`[data-content-id="${element.id}"]`)?.focus());}
    async uploadBoardImage(file){if(!file)return;this.toast('Optimizing and uploading image…');try{const [asset]=await this.uploadFiles([file]);if(!asset?.id)throw new Error('The image could not be uploaded.');const frame=this._assetFrame(asset.id,300,220);this.addBoardElement('image',{assetId:asset.id,...frame,content:file.name});this.toast('Image added to Board');}catch(error){this.toast(error.message||'Could not upload that image.');}}
    async uploadVisualReferences(files) {
      const valid = (files || []).slice(0, 4).filter((file) => ['image/png', 'image/jpeg', 'image/webp'].includes(file.type));
      if (!valid.length) return this.toast('Choose a PNG, JPEG, or WebP image.');
      const target = this.state.visualReferencePicker?.target;
      try {
        this.toast('Preparing your reference…');
        const assets = await this.uploadFiles(target === 'board-add' ? valid.slice(0, 1) : valid);
        this.state.workspace.assets = Array.isArray(this.state.workspace.assets) ? this.state.workspace.assets : [];
        assets.forEach((asset) => { if (asset?.id && !this.state.workspace.assets.some((entry) => entry.id === asset.id)) this.state.workspace.assets.push(asset); });
        if (target === 'board-add') {
          const asset = assets[0];
          if (!asset?.id) throw new Error('The image could not be uploaded.');
          this.state.visualReferencePicker = null;
          const frame = this._assetFrame(asset.id, 340, 230);
          this.addBoardElement('image', { assetId: asset.id, ...frame, content: asset.filename || valid[0].name || 'Reference image', metadata: { source: 'upload' } });
          return this.toast('Image added to Board');
        }
        this.state.storyboardReferenceIds = [...new Set([...(this.state.storyboardReferenceIds || []), ...assets.map((asset) => asset.id)])].slice(-4);
        this.render();
      } catch (error) { this.toast(error?.message || 'Could not add that reference image.'); }
    }

    selectVisualReference(assetId) {
      const asset = this.asset(assetId);
      if (!asset) return this.toast('That visual is no longer available.');
      const target = this.state.visualReferencePicker?.target;
      if (target === 'board-generate') {
        const selected = new Set(this.state.storyboardReferenceIds || []);
        if (selected.has(assetId)) selected.delete(assetId);
        else {
          if (selected.size >= 4) return this.toast('Use up to four references for one frame.');
          selected.add(assetId);
        }
        this.state.storyboardReferenceIds = [...selected];
        return this.render();
      }
      this.state.visualReferencePicker = null;
      const frame = this._assetFrame(assetId, 340, 230);
      this.addBoardElement('image', { assetId, ...frame, content: asset.prompt || asset.filename || 'Visual reference', metadata: { source: asset.source || 'library' } });
      this.toast('Visual added to Board');
    }
    async generateStoryboardImage(value){
      const prompt=String(typeof value==='object' ? value?.prompt : value||'').trim();
      const orientation=value?.orientation==='vertical'?'vertical':'horizontal';
      const referenceAssetIds=[...new Set(this.state.storyboardReferenceIds || [])].slice(0,4);
      if(!await this.ensureImageGeneration())return;
      if(prompt.length<8)return this.toast('Describe the frame in a little more detail.');
      if(this.state.storyboardImageGenerating)return;
      this.state.storyboardImageGenerating=true;this.render();
      try{
        const result=await this._generateImage({prompt,orientation,referenceAssetIds});
        if(!result?.asset?.id)throw new Error('The storyboard frame was not returned.');
        this.state.workspace.assets=Array.isArray(this.state.workspace.assets)?this.state.workspace.assets:[];
        this.state.workspace.assets.push(result.asset);
        this.state.storyboardImageModal=false;this.state.visualReferencePicker=null;this.state.storyboardReferenceIds=[];
        const frame=this._assetFrame(result.asset.id,360,240);
        this.addBoardElement('image',{assetId:result.asset.id,...frame,content:'Generated storyboard frame',metadata:{source:'openai',prompt:result.revisedPrompt||prompt,orientation}});
        this.toast('Storyboard frame added to Board');
      }catch(error){
        this.state.storyboardImageGenerating=false;
        if(!this.handleImageGenerationError(error))this.toast(error?.message||'Could not generate that storyboard frame.');
        this.render();
      }
    }

    async uploadImagineReferences(files) {
      if (!files.length) return;
      try {
        this.toast('Preparing references…');
        const assets = await this.uploadFiles(files, 'imagine');
        this.state.workspace.assets.push(...assets);
        this.state.imagineReferenceIds = [...new Set([...this.state.imagineReferenceIds, ...assets.map((asset) => asset.id)])].slice(-4);
        this.render();
      } catch (error) { this.toast(error?.message || 'Those references could not be uploaded.'); }
    }

    async generateImagineImage(form) {
      const prompt = String(form.get('prompt') || '').trim();
      if (!await this.ensureImageGeneration()) return;
      if (prompt.length < 8) return this.toast('Describe the image in a little more detail.');
      const capabilities = this._imagineCapabilities();
      const requestedMediaMode = String(form.get('mediaMode') || this.state.imagineMediaMode || '').trim().toLowerCase();
      const mediaMode = capabilities.mediaModes.some((option) => option.id === requestedMediaMode)
        ? requestedMediaMode
        : capabilities.defaults.mediaMode;
      const modelOptions = this._imagineModelsForMode(capabilities, mediaMode);
      const requestedModelId = String(form.get('modelId') || this.state.imagineModelId || '').trim().toLowerCase();
      const modelId = modelOptions.some((option) => option.id === requestedModelId)
        ? requestedModelId
        : (modelOptions.some((option) => option.id === capabilities.defaults.modelId)
          ? capabilities.defaults.modelId
          : (modelOptions[0]?.id || ''));
      if (!mediaMode || !modelId) return this.toast(localize('Image generation is not available right now.', 'La generación de imágenes no está disponible en este momento.'));
      const sizeOption = this.imagineSizeOption(String(form.get('size') || this.state.imagineSize));
      const orientation = sizeOption.orientation === 'vertical' ? 'vertical' : 'horizontal';
      const style = ['cinematic', 'animated', 'sketch', 'anime'].includes(String(form.get('style') || '')) ? String(form.get('style')) : 'cinematic';
      const quality = ['low', 'medium', 'high'].includes(String(form.get('quality') || '')) ? String(form.get('quality')) : 'low';
      const referenceAssetIds = [...this.state.imagineReferenceIds];
      const createdAtMs = Date.now();
      const job = {
        id: uid('imagine-job'),
        ownerUserId: this.accountScoped ? this._imagineJobsOwnerId() : '',
        createdAt: new Date(createdAtMs).toISOString(),
        createdAtMs,
        sequence: ++this._imagineJobSequence,
        prompt,
        mediaMode,
        modelId,
        orientation,
        size: sizeOption.value,
        style,
        quality,
        referenceAssetIds,
        ratio: sizeOption.ratio,
      };
      this.state.imaginePendingJobs.push(job);
      this._saveImagineJobs();
      this._imagineAnimateNextRender = true;
      this.render();
      // The job is persisted before its request begins. If the tab refreshes,
      // the next Canvas load restores its placeholder and safely resumes it.
      this._submitImagineJob(job);
    }

    async addImagineToBoard(boardId) {
      const board = this.state.workspace.boards.find((entry) => entry.id === boardId);
      const assetId = this.state.pendingImagineAssetId;
      if (!board || !assetId) return;
      const frame = this._assetFrame(assetId, 320, 220);
      const point = { x: 180 + (board.elements.length % 3) * 300, y: 140 + Math.floor(board.elements.length / 3) * 230 };
      board.elements.push({ id: uid('bel'), type: 'image', assetId, ...frame, positionX: point.x, positionY: point.y, rotation: 0, zIndex: board.elements.length + 1, content: 'Generated visual', metadata: { source: 'imagine' }, status: '', locked: false, hidden: false, groupId: '', sceneId: '', vaultItemId: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      try {
        const result = await window.filmscriptCanvas.updateBoard(this.scriptId, board.id, board);
        this.state.workspace.boards = this.state.workspace.boards.map((entry) => entry.id === board.id ? result.board : entry);
        this.state.pickerMode = ''; this.state.pendingImagineAssetId = '';
        this.toast(`Image added to ${board.title}`);
      } catch (error) { this.toast(error?.message || 'Could not add the image to this Board.'); }
    }

    addImagineImageToActiveBoard(assetId) {
      const asset = this.asset(assetId);
      if (!asset) return this.toast('That generated image is no longer available.');
      this.state.pickerMode = '';
      const frame = this._assetFrame(assetId, 340, 230);
      this.addBoardElement('image', { assetId, ...frame, content: asset.prompt || 'Generated visual', metadata: { source: 'imagine' } });
      this.toast('Generated image added to Board');
    }

    async addSelectedToBoard(boardId){const board=this.state.workspace.boards.find((entry)=>entry.id===boardId);if(!board)return;if(this.state.pickerMode==='board-vault'&&!this.state.selected.size){this.state.pickerMode='';this.setView('vault');return this.toast('Select Vault items, then choose Add to Board.');}const ids=[...this.state.selected];let index=0;for(const itemId of ids){const item=this.state.workspace.vaultItems.find((entry)=>entry.id===itemId);if(!item)continue;const frame=this._assetFrame(item.mainImageId,260,190);board.elements.push({id:uid('bel'),type:'vault',positionX:180+(index%3)*290,positionY:160+Math.floor(index/3)*230,...frame,rotation:0,zIndex:board.elements.length+index+1,content:item.name,metadata:{showPrice:true,showCode:true,requestedQuantity:1},status:'proposed',locked:false,hidden:false,groupId:'',sceneId:'',vaultItemId:item.id,assetId:item.mainImageId||'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});index++;}try{const result=await window.filmscriptCanvas.updateBoard(this.scriptId,board.id,board);this.state.workspace.boards=this.state.workspace.boards.map((entry)=>entry.id===board.id?result.board:entry);this.state.pickerMode='';this.state.selected.clear();this.toast(`${index} Vault item${index===1?'':'s'} added to ${board.title}`);}catch(error){this.toast(error.message);}}

    addVaultItemToActiveBoard(itemId){const item=this.state.workspace.vaultItems.find((entry)=>entry.id===itemId);if(!item)return;this.state.pickerMode='';const frame=this._assetFrame(item.mainImageId,260,190);this.addBoardElement('vault',{vaultItemId:item.id,assetId:item.mainImageId||'',content:item.name,...frame,metadata:{showPrice:true,showCode:true,requestedQuantity:1},status:'proposed'});this.toast(`${item.name} added to Board`);}

    queueBoardSave(){const board=this.activeBoard();if(!board)return;const revision=++this._boardSaveRevision;this.state.autosave='Saving…';this._updateBoardChrome();clearTimeout(this._boardSaveTimer);this._boardSaveTimer=setTimeout(()=>this.flushBoardSave(revision),1500);}
    async flushBoardSave(revision=this._boardSaveRevision){clearTimeout(this._boardSaveTimer);const board=this.activeBoard();if(!board)return;const boardId=board.id;const payload=JSON.parse(JSON.stringify(board));try{const result=await window.filmscriptCanvas.updateBoard(this.scriptId,boardId,payload);if(revision!==this._boardSaveRevision)return;const index=this.state.workspace.boards.findIndex((entry)=>entry.id===boardId);if(index>=0)this.state.workspace.boards[index]=result.board;this.state.autosave='Saved';if(this.state.view==='board')this._updateBoardChrome();}catch(error){if(revision!==this._boardSaveRevision)return;this.state.autosave='Save failed';this.toast(error.message);}}
    zoomBoard(delta){const board=this.activeBoard();if(!board)return;const next=Math.max(.2,Math.min(3,board.viewport.zoom+delta));if(next===board.viewport.zoom)return;this.pushHistory();board.viewport.zoom=next;this.queueBoardSave();this.render();}
    fitBoard(){
      const board=this.activeBoard();
      const viewport=this.shadowRoot.querySelector('[data-board-viewport]');
      if(!board||!viewport)return;
      this.pushHistory();
      const elements=(board.elements||[]).filter((element)=>!element.hidden);
      if(!elements.length){board.viewport={...board.viewport,zoom:1,x:40,y:40};this.queueBoardSave();return this.render();}
      const minX=Math.min(...elements.map((element)=>num(element.positionX))), minY=Math.min(...elements.map((element)=>num(element.positionY)));
      const maxX=Math.max(...elements.map((element)=>num(element.positionX)+Math.max(80,num(element.width,220)))), maxY=Math.max(...elements.map((element)=>num(element.positionY)+Math.max(54,num(element.height,150))));
      const contentWidth=Math.max(1,maxX-minX), contentHeight=Math.max(1,maxY-minY);
      const padding=90;
      const zoom=Math.max(.2,Math.min(3,Math.min((viewport.clientWidth-padding)/contentWidth,(viewport.clientHeight-padding)/contentHeight)));
      board.viewport={...board.viewport,zoom,x:(viewport.clientWidth-contentWidth*zoom)/2-minX*zoom,y:(viewport.clientHeight-contentHeight*zoom)/2-minY*zoom};
      this.queueBoardSave();
      this.render();
    }
    _positionBoardLayer(){const board=this.activeBoard();const layer=this.shadowRoot.querySelector('[data-board-layer]');if(layer)layer.style.transform=`translate(${board.viewport.x}px,${board.viewport.y}px) scale(${board.viewport.zoom})`;}
    _restoreBoardSnapshot(snapshot){const board=this.activeBoard();if(!board||!snapshot)return false;const state=JSON.parse(snapshot);board.title=state.title||board.title||'';board.elements=Array.isArray(state.elements)?state.elements:[];board.viewport={x:0,y:0,zoom:1,...(state.viewport||{})};board.settings={snapToGrid:false,gridSize:16,...(state.settings||{})};this.state.selected.clear();this._textHistoryKey='';return true;}
    undoBoard(){const board=this.activeBoard();if(!board||!this._history.length)return;const current=this._snapshotCurrent();const previous=this._history.pop();if(current)this._future.push(current);this._restoreBoardSnapshot(previous);this.queueBoardSave();this.render();}
    redoBoard(){const board=this.activeBoard();if(!board||!this._future.length)return;const current=this._snapshotCurrent();const next=this._future.pop();if(current&&this._history.at(-1)!==current)this._history.push(current);this._restoreBoardSnapshot(next);this.queueBoardSave();this.render();}
    deleteBoardSelection(){const board=this.activeBoard();if(!board||!this.state.selected.size)return;if(!confirm(`Delete ${this.state.selected.size} selected element${this.state.selected.size===1?'':'s'}?`))return;this.pushHistory();board.elements=board.elements.filter((entry)=>!this.state.selected.has(entry.id));this.state.selected.clear();this.queueBoardSave();this.render();}
    duplicateBoardSelection(){const board=this.activeBoard();if(!board||!this.state.selected.size)return;this.pushHistory();const copies=board.elements.filter((entry)=>this.state.selected.has(entry.id)).map((entry,index)=>({...entry,id:uid('bel'),positionX:entry.positionX+24,positionY:entry.positionY+24,zIndex:board.elements.length+index+1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}));board.elements.push(...copies);this.state.selected=new Set(copies.map((entry)=>entry.id));this.queueBoardSave();this.render();}
    groupBoardSelection(){const board=this.activeBoard();if(!board||this.state.selected.size<2)return;this.pushHistory();const groupId=uid('grp');board.elements.forEach((entry)=>{if(this.state.selected.has(entry.id))entry.groupId=groupId;});this.queueBoardSave();this.toast('Elements grouped');}
    alignBoardSelection(){const board=this.activeBoard();const elements=board?.elements.filter((entry)=>this.state.selected.has(entry.id))||[];if(elements.length<2)return;this.pushHistory();const left=Math.min(...elements.map((entry)=>entry.positionX));elements.forEach((entry)=>{entry.positionX=left;});this.queueBoardSave();this.render();}

    _onPointerDown(event){
      if(this.state.view!=='board'||event.button!==0)return;
      this._stopPointerInteraction(false);
      const resize=event.target.closest('[data-resize-id]');
      const elementNode=event.target.closest('[data-element-id]');
      const viewport=event.target.closest('[data-board-viewport]');
      const board=this.activeBoard();
      const tool=this.state.boardTool||'select';
      if(!board||!viewport)return;
      if(tool==='erase'){
        event.preventDefault();
        return this._startBoardErase(event,viewport,board);
      }
      if(resize){
        event.preventDefault();event.stopPropagation();
        const element=board.elements.find((entry)=>entry.id===resize.dataset.resizeId);
        if(!element)return;
        const isImage=element.type==='image'||element.type==='vault';
        const vaultAsset=isImage&&element.type==='vault'?this.state.workspace.vaultItems.find((item)=>item.id===element.vaultItemId)?.mainImageId:'';
        const assetRatio=isImage?this._assetFrame(element.assetId||vaultAsset,element.width,element.height).aspectRatio:0;
        const aspectRatio=assetRatio>0?assetRatio:num(element.width)/Math.max(1,num(element.height));
        this.pushHistory();
        this._pointer={kind:'resize',startX:event.clientX,startY:event.clientY,element,startW:element.width,startH:element.height,zoom:board.viewport.zoom,aspectRatio:isImage?aspectRatio:0};
        return this._startPointerInteraction(event);
      }
      if(tool==='select'&&elementNode&&event.target.closest('[data-content-id],input,textarea,[contenteditable="true"]')){event.stopPropagation();return;}
      if(elementNode){
        event.preventDefault();
        const id=elementNode.dataset.elementId;
        const element=board.elements.find((entry)=>entry.id===id);
        if(!element||element.locked)return;
        const groupIds=element.groupId?board.elements.filter((entry)=>entry.groupId===element.groupId).map((entry)=>entry.id):[id];
        if(tool==='select'){
          if(event.shiftKey){if(this.state.selected.has(id))this.state.selected.delete(id);else this.state.selected.add(id);}
          else if(!this.state.selected.has(id))this.state.selected=new Set(groupIds);
        }else this.state.selected=new Set(groupIds);
        this._syncBoardSelection();
        const originals=new Map(board.elements.filter((entry)=>this.state.selected.has(entry.id)).map((entry)=>[entry.id,{x:entry.positionX,y:entry.positionY}]));
        this.pushHistory();
        this._pointer={kind:'move',startX:event.clientX,startY:event.clientY,originals,zoom:board.viewport.zoom};
        return this._startPointerInteraction(event);
      }
      event.preventDefault();
      this.state.boardContext=null;
      if(tool==='select') return this._startBoardMarquee(event,viewport,board);
      this.state.selected.clear();this._syncBoardSelection();
      this._pointer={kind:'pan',startX:event.clientX,startY:event.clientY,startVX:board.viewport.x,startVY:board.viewport.y};
      viewport.classList.add('panning');this._startPointerInteraction(event);
    }
    _startBoardMarquee(event,viewport,board){
      const rect=viewport.getBoundingClientRect();
      const x=event.clientX-rect.left,y=event.clientY-rect.top;
      const marquee=document.createElement('div');
      marquee.className='cv-board-selection-marquee';
      marquee.style.left=`${x}px`;marquee.style.top=`${y}px`;marquee.style.width='0px';marquee.style.height='0px';
      viewport.appendChild(marquee);
      this._pointer={kind:'marquee',viewport,board,rect,startX:event.clientX,startY:event.clientY,startLocalX:x,startLocalY:y,additive:event.shiftKey,marquee};
      this._startPointerInteraction(event);
    }
    _updateBoardMarquee(pointer,event){
      const x=Math.max(0,Math.min(pointer.rect.width,event.clientX-pointer.rect.left));
      const y=Math.max(0,Math.min(pointer.rect.height,event.clientY-pointer.rect.top));
      const left=Math.min(pointer.startLocalX,x),top=Math.min(pointer.startLocalY,y);
      pointer.endLocalX=x;pointer.endLocalY=y;
      pointer.marquee.style.left=`${left}px`;pointer.marquee.style.top=`${top}px`;
      pointer.marquee.style.width=`${Math.abs(x-pointer.startLocalX)}px`;pointer.marquee.style.height=`${Math.abs(y-pointer.startLocalY)}px`;
    }
    _finishBoardMarquee(){
      const pointer=this._pointer,board=this.activeBoard();
      if(!pointer||pointer.kind!=='marquee'||!board)return;
      const endX=pointer.endLocalX??pointer.startLocalX,endY=pointer.endLocalY??pointer.startLocalY;
      const left=Math.min(pointer.startLocalX,endX),right=Math.max(pointer.startLocalX,endX),top=Math.min(pointer.startLocalY,endY),bottom=Math.max(pointer.startLocalY,endY);
      const zoom=board.viewport.zoom||1;
      const selection={left:(left-board.viewport.x)/zoom,right:(right-board.viewport.x)/zoom,top:(top-board.viewport.y)/zoom,bottom:(bottom-board.viewport.y)/zoom};
      const next=pointer.additive?new Set(this.state.selected):new Set();
      // A rectangle selects every visible element it touches; it feels natural
      // for overlapping mood-board references and avoids precision hunting.
      board.elements.forEach((element)=>{
        if(element.hidden||element.locked)return;
        const x=num(element.positionX),y=num(element.positionY),w=num(element.width),h=num(element.height);
        if(x<selection.right&&x+w>selection.left&&y<selection.bottom&&y+h>selection.top)next.add(element.id);
      });
      this.state.selected=next;this._syncBoardSelection();
    }
    _startBoardErase(event,viewport,board){
      const rect=viewport.getBoundingClientRect();
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('class','cv-board-eraser-trail');svg.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);svg.setAttribute('preserveAspectRatio','none');
      const trace=document.createElementNS('http://www.w3.org/2000/svg','polyline');svg.appendChild(trace);viewport.appendChild(svg);
      this.state.selected.clear();this._syncBoardSelection();
      this._pointer={kind:'erase',viewport,board,rect,trace,trail:svg,points:[],lastTrailX:null,lastTrailY:null,erased:new Set(),historyPushed:false,exitTimer:null};
      this._eraseBoardAt(event);this._startPointerInteraction(event);
    }
    _pointIsInsideBoard(event,pointer=this._pointer){if(!event||!pointer?.rect)return false;const {left,right,top,bottom}=pointer.rect;return event.clientX>=left&&event.clientX<=right&&event.clientY>=top&&event.clientY<=bottom;}
    _clearEraserExitTimer(pointer=this._pointer){if(pointer?.exitTimer){clearTimeout(pointer.exitTimer);pointer.exitTimer=null;}}
    _armEraserExitTimer(){const pointer=this._pointer;if(!pointer||pointer.kind!=='erase'||pointer.exitTimer)return;pointer.exitTimer=window.setTimeout(()=>{if(this._pointer===pointer)this._stopPointerInteraction(true,true);},3000);}
    _eraseBoardAt(event){
      const p=this._pointer;const board=this.activeBoard();if(!p||p.kind!=='erase'||!board)return;
      // Pointer capture lets the gesture continue outside the board. Do not
      // clamp and keep erasing at its edge: after three seconds outside, end
      // the gesture and fade away its trail as a safety net for trackpads.
      if(!this._pointIsInsideBoard(event,p)){this._armEraserExitTimer();return;}
      this._clearEraserExitTimer(p);
      const x=Math.max(0,Math.min(p.rect.width,event.clientX-p.rect.left));const y=Math.max(0,Math.min(p.rect.height,event.clientY-p.rect.top));
      // Keep the eraser responsive on long gestures. The trail is feedback,
      // not a permanent drawing, so retain a compact recent path instead of
      // growing an SVG polyline indefinitely.
      if(p.lastTrailX===null||Math.hypot(x-p.lastTrailX,y-p.lastTrailY)>=3){p.points.push(`${x},${y}`);if(p.points.length>180)p.points.splice(0,p.points.length-180);p.trace.setAttribute('points',p.points.join(' '));p.lastTrailX=x;p.lastTrailY=y;}
      const bx=(x-board.viewport.x)/board.viewport.zoom,by=(y-board.viewport.y)/board.viewport.zoom,radius=12/board.viewport.zoom;
      const hit=board.elements.filter((element)=>!element.hidden&&!element.locked&&bx>=num(element.positionX)-radius&&bx<=num(element.positionX)+num(element.width)+radius&&by>=num(element.positionY)-radius&&by<=num(element.positionY)+num(element.height)+radius);
      if(!hit.length)return;
      if(!p.historyPushed){this.pushHistory();p.historyPushed=true;}
      hit.forEach((element)=>p.erased.add(element.id));
      board.elements=board.elements.filter((element)=>!p.erased.has(element.id));
      p.erased.forEach((id)=>this.shadowRoot.querySelector(`[data-element-id="${id}"]`)?.remove());
    }
    _startPointerInteraction(startEvent){
      const pointer=this._pointer;
      if(!pointer)return;
      pointer.pointerId=startEvent?.pointerId;
      pointer.captureTarget=startEvent?.target?.closest?.('[data-board-viewport]')||pointer.viewport||this.shadowRoot.querySelector('[data-board-viewport]');
      try{if(pointer.pointerId!==undefined&&pointer.captureTarget?.setPointerCapture)pointer.captureTarget.setPointerCapture(pointer.pointerId);}catch(error){}
      this._pointerMove=(event)=>{if(pointer.pointerId===undefined||event.pointerId===pointer.pointerId)this._onPointerMove(event);};
      this._pointerUp=(event)=>{if(pointer.pointerId===undefined||event.pointerId===pointer.pointerId){if(pointer.kind==='marquee')this._finishBoardMarquee();this._stopPointerInteraction(pointer.kind!=='marquee',pointer.kind==='erase'&&!this._pointIsInsideBoard(event,pointer));}};
      this._pointerCancel=(event)=>{if(pointer.pointerId===undefined||event.pointerId===pointer.pointerId)this._stopPointerInteraction(true,pointer.kind==='erase');};
      this._pointerBlur=()=>this._stopPointerInteraction(true);
      this._pointerVisibility=()=>{if(document.hidden)this._stopPointerInteraction(true);};
      window.addEventListener('pointermove',this._pointerMove);
      window.addEventListener('pointerup',this._pointerUp);
      window.addEventListener('pointercancel',this._pointerCancel);
      window.addEventListener('blur',this._pointerBlur,{once:true});
      document.addEventListener('visibilitychange',this._pointerVisibility);
    }
    _onPointerMove(event){const p=this._pointer;const board=this.activeBoard();if(!p||!board)return;if(p.kind==='erase')return this._eraseBoardAt(event);if(p.kind==='marquee')return this._updateBoardMarquee(p,event);const dx=event.clientX-p.startX,dy=event.clientY-p.startY;if(p.kind==='pan'){board.viewport.x=p.startVX+dx;board.viewport.y=p.startVY+dy;this._positionBoardLayer();}else if(p.kind==='move'){for(const [id,start] of p.originals){const element=board.elements.find((entry)=>entry.id===id);if(!element)continue;let x=start.x+dx/p.zoom,y=start.y+dy/p.zoom;if(board.settings.snapToGrid){const g=board.settings.gridSize;x=Math.round(x/g)*g;y=Math.round(y/g)*g;}element.positionX=x;element.positionY=y;const node=this.shadowRoot.querySelector(`[data-element-id="${id}"]`);if(node){node.style.left=`${x}px`;node.style.top=`${y}px`;}}window.filmscriptPlatform?.sendPresence?.({type:'canvas.drag',module:'canvas',selectedObjectId:[...p.originals.keys()][0],temporaryPosition:{boardId:board.id,objects:[...p.originals.keys()].map((id)=>{const item=board.elements.find((entry)=>entry.id===id);return{id,positionX:item?.positionX,positionY:item?.positionY};})}});}else if(p.kind==='resize'){let w=Math.max(80,p.startW+dx/p.zoom),h=Math.max(54,p.startH+dy/p.zoom);if(p.aspectRatio>0){const byWidth=p.startW+dx/p.zoom;const byHeight=(p.startH+dy/p.zoom)*p.aspectRatio;w=Math.max(80,54*p.aspectRatio,Math.abs(dx/p.zoom)>=Math.abs(dy/p.zoom)?byWidth:byHeight);if(board.settings.snapToGrid){const g=board.settings.gridSize;w=Math.max(80,54*p.aspectRatio,Math.round(w/g)*g);}h=w/p.aspectRatio;}else if(board.settings.snapToGrid){const g=board.settings.gridSize;w=Math.round(w/g)*g;h=Math.round(h/g)*g;}p.element.width=w;p.element.height=h;p.element.aspectRatio=p.aspectRatio||p.element.aspectRatio;const node=this.shadowRoot.querySelector(`[data-element-id="${p.element.id}"]`);if(node){node.style.width=`${w}px`;node.style.height=`${h}px`;}}}
    _stopPointerInteraction(save=false,fadeEraser=false){const pointer=this._pointer;if(this._pointerMove)window.removeEventListener('pointermove',this._pointerMove);if(this._pointerUp)window.removeEventListener('pointerup',this._pointerUp);if(this._pointerCancel)window.removeEventListener('pointercancel',this._pointerCancel);if(this._pointerBlur)window.removeEventListener('blur',this._pointerBlur);if(this._pointerVisibility)document.removeEventListener('visibilitychange',this._pointerVisibility);this._pointerMove=this._pointerUp=this._pointerCancel=this._pointerBlur=this._pointerVisibility=null;this._clearEraserExitTimer(pointer);try{if(pointer?.pointerId!==undefined&&pointer.captureTarget?.hasPointerCapture?.(pointer.pointerId))pointer.captureTarget.releasePointerCapture(pointer.pointerId);}catch(error){}this.shadowRoot.querySelector('[data-board-viewport]')?.classList.remove('panning');if(save&&pointer&&(pointer.kind!=='erase'||pointer.erased.size)){if(pointer.kind==='move'||pointer.kind==='resize')this._commitCanvasPointer(pointer);else this.queueBoardSave();}this._pointer=null;const refresh=()=>{pointer?.trail?.remove();pointer?.marquee?.remove();if(pointer?.kind==='erase'&&pointer.erased.size)this.render();};if(fadeEraser&&pointer?.kind==='erase'&&pointer.trail){pointer.trail.classList.add('is-fading');window.setTimeout(refresh,350);}else refresh();}

    async _commitCanvasPointer(pointer){const board=this.activeBoard();if(!board)return;const changes=[];if(pointer.kind==='move')for(const [id,start] of pointer.originals){const element=board.elements.find((entry)=>entry.id===id);if(element)changes.push({element,previous:{positionX:start.x,positionY:start.y},patch:{positionX:element.positionX,positionY:element.positionY}});}else if(pointer.kind==='resize'&&pointer.element)changes.push({element:pointer.element,previous:{width:pointer.startW,height:pointer.startH},patch:{width:pointer.element.width,height:pointer.element.height}});try{for(const change of changes){const key=`canvas:${board.id}:${change.element.id}`;const baseVersion=this._collaborationVersions?.get(key)||0;const result=await window.filmscriptPlatform?.sendOperation?.({module:'canvas',documentId:`canvas:${board.id}`,entityType:'canvas_object',entityId:change.element.id,baseVersion,current:{id:change.element.id,version:baseVersion,...change.previous},previous:change.previous,patch:change.patch,operationType:'field.set',metadata:{boardId:board.id,boardTitle:board.title}});if(!this._collaborationVersions)this._collaborationVersions=new Map();this._collaborationVersions.set(key,result?.entity?.version||baseVersion);}this.state.autosave='Saving…';this._updateBoardChrome();const saved=await window.filmscriptCanvas.updateBoardElements(this.scriptId,board.id,changes.map((change)=>({id:change.element.id,patch:change.patch})));const index=this.state.workspace.boards.findIndex((entry)=>entry.id===board.id);if(index>=0)this.state.workspace.boards[index]=saved.board;this.state.autosave='Saved';this._updateBoardChrome();}catch(error){this.toast(error?.message||'This object changed for another collaborator. Review their position before replacing it.');this.load();}}

    _applyRemoteCanvasDrag(detail){if(detail?.module!=='canvas'||detail?.clientId===window.filmscriptPlatform?.clientId)return;const temporary=detail.temporaryPosition;if(!temporary||temporary.boardId!==this.state.activeBoardId)return;for(const item of temporary.objects||[]){const node=this.shadowRoot.querySelector(`[data-element-id="${item.id}"]`);if(node){node.style.left=`${num(item.positionX)}px`;node.style.top=`${num(item.positionY)}px`;node.style.setProperty('--collaborator-color',detail.color);}}}
    _applyRemoteCanvasOperation(detail){if(detail?.module!=='canvas'||!detail.entityId||!detail.entity)return;const board=this.activeBoard();if(!board||detail.documentId!==`canvas:${board.id}`)return;const element=board.elements.find((entry)=>entry.id===detail.entityId);if(!element)return;for(const field of detail.changedFields||[])element[field]=detail.entity[field];if(!this._collaborationVersions)this._collaborationVersions=new Map();this._collaborationVersions.set(`canvas:${board.id}:${element.id}`,detail.entity.version||0);this.render();}
    _onWheel(event){const viewport=event.target.closest('[data-board-viewport]');if(!viewport||this.state.view!=='board')return;event.preventDefault();const board=this.activeBoard();if(event.ctrlKey||event.metaKey){const next=Math.max(.2,Math.min(3,board.viewport.zoom*(event.deltaY>0?.92:1.08)));board.viewport.zoom=next;}else{board.viewport.x-=event.deltaX;board.viewport.y-=event.deltaY;}this._positionBoardLayer();this.queueBoardSave();}
  }

  if (!customElements.get('film-script-canvas')) customElements.define('film-script-canvas', FilmScriptCanvasWorkspace);
})();
