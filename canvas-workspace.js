(function () {
  const STYLE = `
    :host{--fs-font-text:"SF Pro Text",-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;--fs-font-display:"SF Pro Display","SF Pro Text",-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif}
    :host,:host *{font-family:var(--fs-font-text)!important}
    :host h1,:host h2,:host h3,:host h4,:host h5,:host h6{font-family:var(--fs-font-display)!important}:host h1,:host h2{font-weight:900!important}:host h3{font-weight:800!important}
    :host{display:block;min-height:560px;color:var(--ink,#2C2C2A);font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;--cv-accent:var(--accent,#BA7517);--cv-accent-soft:var(--accent-soft,rgba(186,117,23,.11));--cv-bg:var(--bg,#F5F0E8);--cv-surface:var(--surface,#FFFEF9);--cv-ink:var(--ink,#2C2C2A);--cv-muted:var(--muted,#888780);--cv-hair:var(--hair,#E7E4DA);--cv-soft:var(--soft,#EFEBE1)}
    *{box-sizing:border-box}button,input,textarea,select{font:inherit}button{color:inherit}.cv-root{min-height:560px;animation:cv-in .2s cubic-bezier(.2,.8,.2,1) both}.cv-loading{display:grid;place-items:center;min-height:520px;color:var(--cv-muted);font-size:13px}.cv-loading span{width:22px;height:22px;border:2px solid var(--cv-hair);border-top-color:var(--cv-accent);border-radius:50%;animation:cv-spin .7s linear infinite;margin-bottom:12px}.cv-load-stack{display:grid;justify-items:center}.cv-top{display:flex;align-items:center;gap:18px;padding:0 0 24px;border-bottom:1px solid var(--cv-hair)}.cv-title{margin-right:auto}.cv-eyebrow{font-size:9.5px;line-height:1;text-transform:uppercase;letter-spacing:1.5px;font-weight:750;color:var(--cv-accent)}.cv-title h1{margin:8px 0 0;font-size:30px;line-height:1;letter-spacing:-.8px}.cv-tabs{display:flex;gap:3px;padding:3px;background:color-mix(in srgb,var(--cv-soft) 72%,transparent);border-radius:11px}.cv-tab{border:0;background:transparent;border-radius:8px;padding:8px 12px;font-size:11.5px;font-weight:600;cursor:pointer;transition:background .15s ease,color .15s ease,transform .12s ease}.cv-tab:hover{background:var(--cv-surface)}.cv-tab[aria-current=true]{color:var(--cv-accent);background:var(--cv-surface);box-shadow:0 1px 5px rgba(30,28,24,.07)}.cv-icon-btn{width:34px;height:34px;display:grid;place-items:center;border:1px solid var(--cv-hair);background:var(--cv-surface);border-radius:9px 10px 8px 9px;cursor:pointer;transition:transform .13s ease,border-color .15s ease,background .15s ease}.cv-icon-btn:hover{border-color:var(--cv-muted);transform:translateY(-1px)}.cv-icon-btn svg{width:16px;height:16px}.cv-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin:32px 0 18px}.cv-heading h2{margin:0;font-size:21px;letter-spacing:-.35px}.cv-heading p{max-width:580px;margin:7px 0 0;color:var(--cv-muted);font-size:12.5px;line-height:1.5}.cv-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.cv-btn{min-height:36px;padding:0 13px;border:1px solid var(--cv-hair);border-radius:9px 10px 8px 9px;background:var(--cv-surface);color:var(--cv-ink);font-size:11.5px;font-weight:650;cursor:pointer;transition:transform .12s ease,border-color .15s ease,background .15s ease,box-shadow .15s ease}.cv-btn:hover{border-color:var(--cv-muted);transform:translateY(-1px);box-shadow:0 5px 14px rgba(30,28,24,.07)}.cv-btn:active{transform:scale(.98)}.cv-btn.primary{background:var(--cv-ink);border-color:var(--cv-ink);color:var(--cv-surface)}.cv-btn.accent{background:var(--cv-accent);border-color:var(--cv-accent);color:#181716}.cv-btn.danger{color:#B24C47;border-color:color-mix(in srgb,#B24C47 45%,var(--cv-hair))}.cv-btn:disabled{opacity:.45;cursor:not-allowed;transform:none}.cv-card{position:relative;background:var(--cv-surface);border:1px solid color-mix(in srgb,var(--cv-ink) 52%,var(--cv-hair));border-radius:16px 14px 17px 13px}.cv-card:after{content:'';position:absolute;inset:4px -3px -4px 3px;z-index:-1;border:1px solid color-mix(in srgb,var(--cv-ink) 16%,transparent);border-radius:14px 17px 13px 16px;pointer-events:none}.cv-tool-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.cv-tool{min-height:210px;padding:24px;text-align:left;cursor:pointer;overflow:hidden;transition:transform .18s cubic-bezier(.2,.8,.2,1),box-shadow .18s ease,border-color .18s ease}.cv-tool:hover{transform:translateY(-3px);border-color:var(--cv-accent);box-shadow:0 16px 34px rgba(34,31,25,.09)}.cv-tool-no{font-size:9px;letter-spacing:1.3px;color:var(--cv-muted);font-weight:750}.cv-tool-icon{width:45px;height:45px;display:grid;place-items:center;margin-top:26px;border-radius:13px 11px 14px 10px;background:var(--cv-accent-soft);color:var(--cv-accent)}.cv-tool-icon svg{width:23px;height:23px}.cv-tool h3{font-size:19px;margin:18px 0 7px}.cv-tool p{margin:0;color:var(--cv-muted);font-size:12px;line-height:1.5}.cv-tool-arrow{position:absolute;right:22px;bottom:20px;color:var(--cv-muted);transition:transform .18s ease,color .18s ease}.cv-tool:hover .cv-tool-arrow{transform:translateX(3px);color:var(--cv-accent)}
    .cv-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:16px}.cv-search{position:relative;flex:1;min-width:220px}.cv-search svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);width:15px;color:var(--cv-muted)}.cv-search input,.cv-filter{width:100%;height:38px;border:1px solid var(--cv-hair);border-radius:10px;background:var(--cv-surface);color:var(--cv-ink);outline:0}.cv-search input{padding:0 14px 0 36px}.cv-search input:focus,.cv-filter:focus{border-color:var(--cv-accent);box-shadow:0 0 0 3px var(--cv-accent-soft)}.cv-filter{width:auto;max-width:160px;padding:0 28px 0 10px;font-size:11px}.cv-view-toggle{display:flex;padding:3px;border:1px solid var(--cv-hair);background:var(--cv-surface);border-radius:10px}.cv-view-toggle button{width:31px;height:30px;border:0;border-radius:7px;background:transparent;cursor:pointer;color:var(--cv-muted)}.cv-view-toggle button.active{background:var(--cv-soft);color:var(--cv-ink)}.cv-view-toggle svg{width:15px}.cv-vault-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:15px;padding-bottom:90px}.cv-vault-grid.list{grid-template-columns:1fr;gap:8px}.cv-item{position:relative;overflow:hidden;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}.cv-item:hover{transform:translateY(-2px);box-shadow:0 12px 26px rgba(30,28,24,.08)}.cv-item.selected{border-color:var(--cv-accent);box-shadow:0 0 0 3px var(--cv-accent-soft)}.cv-item-image{aspect-ratio:4/3;background:linear-gradient(135deg,var(--cv-soft),color-mix(in srgb,var(--cv-soft) 58%,var(--cv-bg)));display:grid;place-items:center;overflow:hidden}.cv-item-image img{width:100%;height:100%;object-fit:cover;transition:transform .25s ease}.cv-item:hover .cv-item-image img{transform:scale(1.025)}.cv-item-image svg{width:42px;height:42px;color:color-mix(in srgb,var(--cv-muted) 48%,transparent)}.cv-item-check{position:absolute;z-index:2;top:10px;left:10px;width:20px;height:20px;accent-color:var(--cv-accent);cursor:pointer}.cv-item-menu{position:absolute;z-index:2;top:9px;right:9px;width:29px;height:29px;border:1px solid color-mix(in srgb,var(--cv-hair) 70%,transparent);border-radius:9px;background:color-mix(in srgb,var(--cv-surface) 88%,transparent);backdrop-filter:blur(8px);cursor:pointer}.cv-item-body{padding:14px}.cv-item-title{font-size:14px;font-weight:720;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cv-item-meta{display:flex;justify-content:space-between;gap:10px;margin-top:11px;color:var(--cv-muted);font-size:10.5px}.cv-status{display:inline-flex;align-items:center;gap:6px}.cv-status:before{content:'';width:6px;height:6px;border-radius:50%;background:#5A9B74}.cv-status.unavailable:before{background:#B75B55}.cv-status.limited:before{background:#C38A2C}.cv-item-price{font-weight:700;color:var(--cv-ink)}.cv-vault-grid.list .cv-item{display:grid;grid-template-columns:112px minmax(0,1fr)}.cv-vault-grid.list .cv-item-image{aspect-ratio:auto;height:92px}.cv-vault-grid.list .cv-item-body{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center}.cv-vault-grid.list .cv-item-meta{margin:0;gap:24px}.cv-empty{min-height:370px;display:grid;place-items:center;text-align:center;padding:44px}.cv-empty-art{width:70px;height:55px;color:var(--cv-muted);margin:0 auto 20px}.cv-empty h3{font-size:23px;margin:0}.cv-empty p{max-width:500px;margin:11px auto 22px;color:var(--cv-muted);font-size:13px;line-height:1.55}.cv-empty-actions{display:flex;justify-content:center;gap:8px}.cv-selection{position:fixed;z-index:90;left:50%;bottom:24px;transform:translateX(-50%);display:flex;align-items:center;gap:5px;padding:7px;background:color-mix(in srgb,var(--cv-ink) 94%,transparent);color:var(--cv-surface);border-radius:13px 11px 14px 10px;box-shadow:0 16px 42px rgba(0,0,0,.25);animation:cv-up .18s cubic-bezier(.2,.8,.2,1) both}.cv-selection strong{font-size:11px;padding:0 9px;white-space:nowrap}.cv-selection button{height:32px;border:0;border-radius:8px;background:transparent;color:inherit;padding:0 9px;font-size:10.5px;font-weight:650;cursor:pointer;white-space:nowrap}.cv-selection button:hover{background:rgba(255,255,255,.12)}.cv-selection .accent{background:var(--cv-accent);color:#171615}.cv-selection .accent:hover{background:var(--cv-accent)}
    .cv-modal-backdrop{position:fixed;z-index:500;inset:0;background:rgba(23,22,20,.42);backdrop-filter:blur(3px);display:grid;place-items:center;padding:24px;animation:cv-fade .15s ease both}.cv-modal{width:min(720px,100%);max-height:min(820px,calc(100vh - 48px));overflow:auto;background:var(--cv-surface);border:1px solid var(--cv-hair);border-radius:18px 15px 19px 14px;box-shadow:0 28px 70px rgba(0,0,0,.25);animation:cv-modal .2s cubic-bezier(.2,.8,.2,1) both}.cv-modal.large{width:min(1120px,100%)}.cv-modal-head{position:sticky;z-index:3;top:0;display:flex;align-items:center;gap:16px;padding:20px 22px 16px;background:color-mix(in srgb,var(--cv-surface) 94%,transparent);backdrop-filter:blur(12px);border-bottom:1px solid var(--cv-hair)}.cv-modal-head h3{margin:0;font-size:20px;letter-spacing:-.3px}.cv-modal-head p{margin:4px 0 0;color:var(--cv-muted);font-size:11px}.cv-close{margin-left:auto}.cv-modal-body{padding:22px}.cv-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.cv-field{display:grid;gap:6px}.cv-field.wide{grid-column:1/-1}.cv-field label,.cv-field>span{font-size:9.5px;font-weight:750;letter-spacing:.75px;text-transform:uppercase;color:var(--cv-muted)}.cv-field input,.cv-field textarea,.cv-field select{width:100%;border:1px solid var(--cv-hair);border-radius:9px 10px 8px 9px;background:var(--cv-bg);color:var(--cv-ink);outline:0;padding:10px 11px}.cv-field input,.cv-field select{height:40px}.cv-field textarea{min-height:82px;resize:vertical}.cv-field input:focus,.cv-field textarea:focus,.cv-field select:focus{border-color:var(--cv-accent);box-shadow:0 0 0 3px var(--cv-accent-soft)}.cv-form-section{margin:18px 0 11px;padding-top:16px;border-top:1px solid var(--cv-hair);font-size:10px;font-weight:750;letter-spacing:1px;text-transform:uppercase;color:var(--cv-accent)}.cv-more{grid-column:1/-1;border:1px solid var(--cv-hair);border-radius:11px;padding:0 13px}.cv-more summary{padding:12px 0;font-size:11px;font-weight:700;cursor:pointer}.cv-more .cv-form-grid{padding:2px 0 14px}.cv-form-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:20px}.cv-file-drop{position:relative;min-height:106px;border:1px dashed var(--cv-muted);border-radius:12px;display:grid;place-items:center;text-align:center;color:var(--cv-muted);cursor:pointer;overflow:hidden}.cv-file-drop:hover{border-color:var(--cv-accent);color:var(--cv-accent);background:var(--cv-accent-soft)}.cv-file-drop input{position:absolute;inset:0;opacity:0;cursor:pointer}.cv-file-drop svg{width:31px;height:31px}.cv-file-drop small{display:block;margin-top:6px;font-size:10px}.cv-role-grid,.cv-board-type-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.cv-role,.cv-board-type{display:flex;align-items:center;gap:12px;min-height:66px;padding:13px;border:1px solid var(--cv-hair);border-radius:12px 10px 13px 11px;background:var(--cv-surface);cursor:pointer;text-align:left;transition:transform .13s ease,border-color .15s ease,background .15s ease}.cv-role:hover,.cv-board-type:hover{transform:translateY(-1px);border-color:var(--cv-accent);background:var(--cv-accent-soft)}.cv-role.selected{border-color:var(--cv-accent);box-shadow:0 0 0 3px var(--cv-accent-soft)}.cv-role-icon{width:35px;height:35px;display:grid;place-items:center;border-radius:10px;background:var(--cv-soft);color:var(--cv-accent)}.cv-role strong,.cv-board-type strong{display:block;font-size:12.5px}.cv-role small,.cv-board-type small{display:block;margin-top:3px;color:var(--cv-muted);font-size:10.5px;line-height:1.35}
    .cv-board-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(245px,1fr));gap:15px}.cv-board-card{min-height:185px;padding:18px;cursor:pointer;overflow:hidden;transition:transform .17s ease,box-shadow .17s ease,border-color .17s ease}.cv-board-card:hover{transform:translateY(-3px);border-color:var(--cv-accent);box-shadow:0 14px 30px rgba(30,28,24,.08)}.cv-board-preview{height:92px;border-radius:11px 9px 12px 10px;background-color:var(--cv-soft);background-image:radial-gradient(circle,color-mix(in srgb,var(--cv-muted) 25%,transparent) 1px,transparent 1px);background-size:12px 12px;position:relative;overflow:hidden}.cv-board-preview:before,.cv-board-preview:after{content:'';position:absolute;background:var(--cv-surface);border:1px solid var(--cv-hair);box-shadow:0 4px 8px rgba(0,0,0,.05)}.cv-board-preview:before{width:70px;height:48px;left:28px;top:20px;transform:rotate(-2deg)}.cv-board-preview:after{width:48px;height:58px;right:32px;top:15px;transform:rotate(3deg)}.cv-board-card h3{margin:15px 0 4px;font-size:14px}.cv-board-card p{margin:0;color:var(--cv-muted);font-size:10.5px}.cv-board-menu{position:absolute;right:13px;top:13px;z-index:2}.cv-board-shell{position:fixed;z-index:350;inset:44px 0 0;background:var(--cv-bg);display:flex;flex-direction:column;animation:cv-in .17s ease both}.cv-board-top{height:56px;flex:0 0 56px;display:flex;align-items:center;gap:8px;padding:0 14px;border-bottom:1px solid var(--cv-hair);background:var(--cv-surface)}.cv-board-back{display:flex;align-items:center;gap:6px}.cv-board-title{min-width:120px;max-width:300px;height:34px;border:0;background:transparent;color:var(--cv-ink);font-weight:720;outline:0;padding:0 8px}.cv-board-save{margin-right:auto;font-size:10.5px;color:var(--cv-muted)}.cv-board-viewport{position:relative;flex:1;min-height:0;overflow:hidden;cursor:grab;background-color:var(--cv-bg);background-image:radial-gradient(circle,color-mix(in srgb,var(--cv-muted) 30%,transparent) 1px,transparent 1px);background-size:18px 18px;touch-action:none}.cv-board-viewport.panning{cursor:grabbing}.cv-board-layer{position:absolute;left:0;top:0;width:5000px;height:3500px;transform-origin:0 0;will-change:transform}.cv-element{position:absolute;min-width:80px;min-height:54px;background:var(--cv-surface);border:1px solid var(--cv-hair);border-radius:10px 9px 11px 8px;box-shadow:0 6px 18px rgba(30,28,24,.08);overflow:hidden;cursor:move;user-select:none;transition:box-shadow .12s ease,border-color .12s ease}.cv-element.selected{border-color:var(--cv-accent);box-shadow:0 0 0 3px var(--cv-accent-soft),0 9px 22px rgba(30,28,24,.12)}.cv-element.image,.cv-element.vault{padding:0}.cv-element img{width:100%;height:100%;object-fit:cover;pointer-events:none}.cv-element-content{width:100%;height:100%;padding:14px;outline:0;overflow:auto;white-space:pre-wrap;user-select:text;cursor:text;font-size:13px;line-height:1.45}.cv-element.text .cv-element-content{font-size:21px;font-weight:720}.cv-element.note{background:color-mix(in srgb,#F2C870 28%,var(--cv-surface));border-color:color-mix(in srgb,#BA7517 38%,var(--cv-hair))}.cv-vault-element-meta{position:absolute;left:8px;right:8px;bottom:8px;padding:8px 9px;border-radius:8px;background:rgba(18,18,17,.74);color:#fff;backdrop-filter:blur(5px);font-size:10px}.cv-vault-element-meta strong{display:block;font-size:11px}.cv-resize{position:absolute;right:3px;bottom:3px;width:13px;height:13px;border-right:2px solid var(--cv-accent);border-bottom:2px solid var(--cv-accent);cursor:nwse-resize}.cv-element-toolbar{position:absolute;z-index:20;display:flex;gap:3px;padding:4px;border:1px solid var(--cv-hair);border-radius:10px;background:var(--cv-surface);box-shadow:0 8px 22px rgba(0,0,0,.14)}.cv-element-toolbar button{height:29px;border:0;border-radius:7px;background:transparent;padding:0 8px;font-size:10px;font-weight:650;cursor:pointer}.cv-element-toolbar button:hover{background:var(--cv-soft)}.cv-board-empty{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);text-align:center;color:var(--cv-muted);pointer-events:none}.cv-board-empty h3{margin:0;color:var(--cv-ink);font-size:18px}.cv-board-empty p{margin:8px 0 14px;font-size:11px}.cv-board-empty span{display:inline-block;margin:3px;padding:6px 8px;border:1px solid var(--cv-hair);border-radius:999px;font-size:9.5px}.cv-context{position:fixed;z-index:600;width:180px;padding:5px;border:1px solid var(--cv-hair);border-radius:11px;background:var(--cv-surface);box-shadow:0 14px 36px rgba(0,0,0,.2);animation:cv-modal .12s ease both}.cv-context button{display:flex;align-items:center;gap:9px;width:100%;height:34px;border:0;border-radius:7px;background:transparent;color:var(--cv-ink);font-size:11px;text-align:left;cursor:pointer}.cv-context button:hover{background:var(--cv-soft)}.cv-context svg{width:14px;color:var(--cv-muted)}
    .cv-quote-layout{display:grid;grid-template-columns:minmax(360px,.8fr) minmax(460px,1.2fr);gap:18px}.cv-quote-form{padding:18px}.cv-quote-preview{padding:30px;min-height:670px;background:#FBF9F4;color:#252523;border:1px solid #DED9CE;border-radius:12px;box-shadow:0 14px 34px rgba(30,28,24,.08)}.cv-preview-eyebrow{font-size:8px;font-weight:800;letter-spacing:1.4px;color:#BA7517}.cv-quote-preview h2{font-size:25px;letter-spacing:-.6px;margin:7px 0 5px}.cv-preview-meta{display:flex;justify-content:space-between;gap:20px;padding:13px 0 18px;border-bottom:1px solid #D8D3C9;color:#6F6D67;font-size:9.5px;line-height:1.55}.cv-preview-table{margin-top:18px}.cv-preview-row{display:grid;grid-template-columns:minmax(0,1fr) 60px 75px;gap:10px;padding:10px 0;border-bottom:1px solid #E0DCD3;font-size:10px;align-items:center}.cv-preview-row.header{font-size:8px;font-weight:800;letter-spacing:.7px;color:#77736C}.cv-preview-row strong{display:block}.cv-preview-row small{display:block;margin-top:2px;color:#77736C}.cv-preview-total{width:220px;margin:20px 0 0 auto}.cv-preview-total div{display:flex;justify-content:space-between;padding:5px 0;font-size:10px}.cv-preview-total div:last-child{margin-top:4px;padding-top:9px;border-top:1px solid #252523;font-size:13px;font-weight:800}.cv-quote-lines{grid-column:1/-1;border:1px solid var(--cv-hair);border-radius:11px;overflow:hidden}.cv-quote-line{display:grid;grid-template-columns:minmax(140px,1fr) 72px 72px 90px 30px;gap:8px;align-items:center;padding:8px;border-bottom:1px solid var(--cv-hair)}.cv-quote-line:last-child{border-bottom:0}.cv-quote-line input{height:34px;min-width:0;border:1px solid var(--cv-hair);border-radius:8px;background:var(--cv-bg);color:var(--cv-ink);padding:0 8px}.cv-quote-line button{border:0;background:transparent;cursor:pointer}.cv-menu-pop{position:fixed;z-index:520;width:170px;padding:5px;border:1px solid var(--cv-hair);border-radius:11px;background:var(--cv-surface);box-shadow:0 14px 34px rgba(0,0,0,.18)}.cv-menu-pop button{width:100%;height:34px;border:0;border-radius:7px;background:transparent;text-align:left;padding:0 10px;font-size:11px;cursor:pointer}.cv-menu-pop button:hover{background:var(--cv-soft)}.cv-toast{position:fixed;z-index:900;left:50%;bottom:24px;transform:translateX(-50%);padding:10px 14px;border-radius:10px;background:var(--cv-ink);color:var(--cv-surface);font-size:11px;box-shadow:0 12px 30px rgba(0,0,0,.22);animation:cv-up .18s ease both}
    .cv-preview-signatures{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:42px}.cv-preview-signatures span{padding-top:7px;border-top:1px solid #D8D3C9;color:#BA7517;font-size:7.5px;font-weight:800;letter-spacing:.75px}
    @keyframes cv-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}@keyframes cv-up{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}@keyframes cv-modal{from{opacity:0;transform:scale(.985) translateY(5px)}to{opacity:1;transform:none}}@keyframes cv-fade{from{opacity:0}to{opacity:1}}@keyframes cv-spin{to{transform:rotate(360deg)}}
    @media(max-width:900px){.cv-tool-grid{grid-template-columns:1fr}.cv-top{align-items:flex-start;flex-wrap:wrap}.cv-title{width:100%}.cv-tabs{order:3;width:100%;overflow:auto}.cv-tab{flex:1}.cv-form-grid,.cv-role-grid,.cv-board-type-grid,.cv-quote-layout{grid-template-columns:1fr}.cv-quote-preview{min-height:auto}.cv-selection{max-width:calc(100vw - 24px);overflow:auto;justify-content:flex-start}.cv-board-top{overflow:auto}.cv-board-title{min-width:150px}.cv-toolbar{align-items:stretch}.cv-search{min-width:100%}.cv-filter{flex:1;max-width:none}.cv-vault-grid{grid-template-columns:repeat(auto-fill,minmax(170px,1fr))}}
    /* Canvas keeps the visual language light, but gives every surface a clear job. */
    .cv-top{align-items:flex-end;gap:20px;padding-bottom:20px}.cv-top .cv-title{min-width:170px}.cv-top .cv-title h1{font-size:28px}.cv-top:after{content:'One calm place for references, boards, and shot planning';order:1;margin:0 auto 3px;color:var(--cv-muted);font-size:11px}.cv-tabs{order:2}.cv-top>.cv-btn{order:3;white-space:nowrap}
    .cv-board-grid{grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:18px}.cv-board-card{min-height:232px;padding:15px}.cv-board-card:focus-visible{outline:3px solid var(--cv-accent-soft);outline-offset:3px}.cv-board-preview{height:122px}.cv-board-preview img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.cv-board-preview.has-image:after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 44%,rgba(20,19,17,.34))}.cv-board-preview-stub{position:absolute;background:color-mix(in srgb,var(--cv-surface) 92%,transparent);border:1px solid color-mix(in srgb,var(--cv-ink) 14%,var(--cv-hair));box-shadow:0 4px 8px rgba(0,0,0,.07);border-radius:4px}.cv-board-preview-stub.one{width:37%;height:48%;left:12%;top:24%;transform:rotate(-4deg)}.cv-board-preview-stub.two{width:29%;height:62%;right:13%;top:14%;transform:rotate(5deg)}.cv-board-preview-stub.three{width:20%;height:32%;left:42%;bottom:9%;transform:rotate(2deg)}.cv-board-card h3{margin:14px 0 5px}.cv-board-card p{line-height:1.45}.cv-board-meta{display:flex;align-items:center;gap:8px;margin-top:10px;color:var(--cv-muted);font-size:10px}.cv-board-meta strong{color:var(--cv-ink);font-weight:700}.cv-board-menu{right:10px;top:10px}.cv-item-menu svg{width:14px;height:14px}
    .cv-board-top{height:62px;flex-basis:62px;gap:7px;overflow:auto}.cv-board-top .cv-btn{white-space:nowrap}.cv-board-tools{display:flex;align-items:center;gap:5px;padding-left:5px;border-left:1px solid var(--cv-hair)}.cv-board-tools .cv-btn{min-height:32px;padding:0 10px;display:inline-flex;align-items:center;gap:6px;flex:0 0 auto}.cv-board-tools .cv-btn svg{width:14px;height:14px}.cv-board-zoom{display:flex;align-items:center;gap:4px;margin-left:3px;flex:0 0 auto}.cv-board-zoom span{min-width:42px;text-align:center;font-size:10px;color:var(--cv-muted)}.cv-board-empty{width:min(420px,calc(100% - 32px));padding:28px 24px;border:1px dashed color-mix(in srgb,var(--cv-muted) 55%,transparent);border-radius:16px;background:color-mix(in srgb,var(--cv-surface) 72%,transparent);box-shadow:0 12px 30px rgba(30,28,24,.05);pointer-events:auto}.cv-board-empty span{background:var(--cv-surface)}.cv-board-empty .cv-btn{display:inline-flex;align-items:center;gap:6px}.cv-board-empty .cv-btn svg{width:14px;height:14px}
    .cv-element-toolbar button:disabled{opacity:.4;cursor:not-allowed}
    @media(max-width:900px){.cv-top{align-items:flex-start;flex-wrap:wrap}.cv-top:after{order:4;width:100%;margin:0}.cv-tabs{order:3;width:100%}.cv-top>.cv-btn{order:2;margin-left:auto}.cv-board-tools{border-left:0;padding-left:0}.cv-board-shell{inset:0}.cv-board-top{height:auto;min-height:58px;padding:9px;flex-wrap:wrap}.cv-board-title{order:2;flex:1;min-width:150px}.cv-board-save{order:3;margin-right:0}.cv-board-tools{order:4;width:100%;overflow:auto}.cv-board-zoom{order:5}}
    @media(prefers-reduced-motion:reduce){*,*:before,*:after{animation-duration:.01ms!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}
  `;

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
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
      list: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
      upload: '<path d="M12 16V4m0 0L7 9m5-5 5 5M4 15v5h16v-5"/>',
      undo: '<path d="M9 7 4 12l5 5"/><path d="M5 12h8a6 6 0 0 1 6 6"/>', redo: '<path d="m15 7 5 5-5 5"/><path d="M19 12h-8a6 6 0 0 0-6 6"/>',
      dots: '<circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/>',
      landscape: '<circle cx="47" cy="9" r="4"/><path d="M4 34 19 18l10 10 8-8 22 14M8 10q3-3 6 0 3-3 6 0"/>',
    };
    const viewBox = name === 'landscape' ? '0 0 64 40' : '0 0 24 24';
    return `<svg viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.note}</svg>`;
  };

  class FilmScriptCanvasWorkspace extends HTMLElement {
    static get observedAttributes() { return ['script-id', 'project-title']; }

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.state = {
        loading: true, error: '', workspace: null, view: 'home', selected: new Set(),
        search: '', category: '', availability: '', condition: '', storage: '', sort: 'recent',
        itemModal: false, editingItemId: '', boardModal: false,
        quoteDraft: null, quoteSaving: false, activeBoardId: '', boardContext: null,
        vaultMenu: null, boardMenu: null, pickerMode: '', toast: '', autosave: 'Saved',
      };
      this._history = [];
      this._future = [];
      this._boardSaveTimer = 0;
      this._toastTimer = 0;
      this._pendingVaultFiles = [];
      this._pendingBoardFile = null;
    }

    get scriptId() { return this.getAttribute('script-id') || ''; }
    get projectTitle() { return this.getAttribute('project-title') || 'Untitled screenplay'; }

    connectedCallback() {
      if (!this._bound) {
        this._bound = true;
        this.shadowRoot.addEventListener('click', (event) => this._onClick(event));
        this.shadowRoot.addEventListener('input', (event) => this._onInput(event));
        this.shadowRoot.addEventListener('change', (event) => this._onChange(event));
        this.shadowRoot.addEventListener('submit', (event) => this._onSubmit(event));
        this.shadowRoot.addEventListener('contextmenu', (event) => this._onContextMenu(event));
        this.shadowRoot.addEventListener('pointerdown', (event) => this._onPointerDown(event));
        this.shadowRoot.addEventListener('wheel', (event) => this._onWheel(event), { passive: false });
        this.shadowRoot.addEventListener('keydown', (event) => this._onKeyDown(event));
      }
      this.load();
    }

    disconnectedCallback() {
      clearTimeout(this._boardSaveTimer);
      clearTimeout(this._toastTimer);
      this._stopPointerInteraction();
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (name === 'script-id' && oldValue && newValue && oldValue !== newValue && this.isConnected) this.load();
    }

    async load() {
      if (!this.scriptId || !window.filmscriptCanvas) return;
      this.state.loading = true;
      this.render();
      try {
        const result = await window.filmscriptCanvas.get(this.scriptId);
        this.state.workspace = result.workspace;
        this.state.loading = false;
        this.state.error = '';
        this.state.view = ['home', 'vault', 'boards'].includes(result.workspace?.settings?.lastTool)
          ? result.workspace.settings.lastTool
          : 'home';
      } catch (error) {
        this.state.loading = false;
        this.state.error = error.message || 'Canvas could not be loaded.';
      }
      this.render();
    }

    assetUrl(assetId) { return assetId ? window.filmscriptCanvas.assetUrl(this.scriptId, assetId) : ''; }
    asset(assetId) { return this.state.workspace?.assets?.find((entry) => entry.id === assetId) || null; }
    activeBoard() { return this.state.workspace?.boards?.find((board) => board.id === this.state.activeBoardId) || null; }

    setView(view) {
      if (view === 'shotlist') {
        this.dispatchEvent(new CustomEvent('filmscript:canvas-shotlist', { bubbles: true, composed: true }));
        return;
      }
      this.state.view = view;
      this.state.selected.clear();
      this.state.vaultMenu = null;
      this.state.boardMenu = null;
      if (this.state.workspace) {
        this.state.workspace.settings.lastTool = view === 'board' || view === 'quote' ? 'boards' : view;
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

    render() {
      const content = this.state.loading
        ? `<div class="cv-loading"><div class="cv-load-stack"><span></span>Loading Canvas…</div></div>`
        : this.state.error
          ? `<div class="cv-empty"><div><h3>Canvas could not open</h3><p>${esc(this.state.error)}</p><button class="cv-btn" data-action="retry">Try again</button></div></div>`
          : this._renderView();
      this.shadowRoot.innerHTML = `<style>${STYLE}</style><div class="cv-root">${content}</div>${this._renderOverlays()}${this.state.toast ? `<div class="cv-toast" role="status">${esc(this.state.toast)}</div>` : ''}`;
      if (this.state.view === 'board') requestAnimationFrame(() => this._positionBoardLayer());
    }

    _renderView() {
      if (this.state.view === 'board') return this._renderBoardEditor();
      if (this.state.view === 'quote') return this._renderQuoteBuilder();
      const body = this.state.view === 'vault' ? this._renderVault() : this.state.view === 'boards' ? this._renderBoards() : this._renderHome();
      return `${this._renderTop()}${body}`;
    }

    _renderTop() {
      return `<header class="cv-top"><div class="cv-title"><div class="cv-eyebrow">Visual production</div><h1>Canvas</h1></div><nav class="cv-tabs" aria-label="Canvas tools"><button class="cv-tab" data-action="view-home" aria-current="${this.state.view === 'home'}">Home</button><button class="cv-tab" data-action="view-vault" aria-current="${this.state.view === 'vault'}">Vault</button><button class="cv-tab" data-action="view-boards" aria-current="${this.state.view === 'boards'}">Boards</button></nav>${this.state.view === 'boards' ? '' : '<button class="cv-btn accent" data-action="create-board">+ New board</button>'}</header>`;
    }

    _renderHome() {
      const details = {
        shotlist: { name: 'Shot List', icon: 'shot', text: 'Plan camera coverage scene by scene, connected to the screenplay and Stripboard time.' },
        vault: { name: 'Vault', icon: 'vault', text: 'Build a visual inventory of props, furniture, wardrobe, textures, and production assets.' },
        boards: { name: 'Boards', icon: 'boards', text: 'Arrange references, concepts, notes, and Vault items on an open visual workspace.' },
      };
      const cards = ['boards', 'vault', 'shotlist'].map((id, index) => {
        const tool = details[id];
        return `<button class="cv-card cv-tool" data-action="view-${id}"><span class="cv-tool-no">0${index + 1}</span><span class="cv-tool-icon">${icon(tool.icon)}</span><h3>${tool.name}</h3><p>${tool.text}</p><span class="cv-tool-arrow">→</span></button>`;
      }).join('');
      return `<section><div class="cv-heading"><div><h2>Your visual workspace</h2><p>Start with a Board, collect references in Vault, then plan coverage in Shot List. Everything stays connected to ${esc(this.projectTitle)}.</p></div></div><div class="cv-tool-grid">${cards}</div></section>`;
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
      const image = item.mainImageId ? `<img loading="lazy" src="${esc(this.assetUrl(item.mainImageId))}" alt="${esc(item.name)}">` : icon('landscape');
      return `<article class="cv-card cv-item ${selected ? 'selected' : ''}" data-item-id="${item.id}"><input class="cv-item-check" type="checkbox" data-select-item="${item.id}" ${selected ? 'checked' : ''} aria-label="Select ${esc(item.name)}"><button class="cv-item-menu" data-action="item-menu" data-id="${item.id}" aria-label="Item actions">${icon('dots')}</button><div class="cv-item-image" data-action="edit-item" data-id="${item.id}">${image}</div><div class="cv-item-body"><div><div class="cv-item-title">${esc(item.name)}</div><div class="cv-item-meta"><span class="cv-status ${esc(item.availability)}">${esc(item.quantityAvailable)} available</span><span class="cv-item-price">${money(item.dailyPrice)}/day</span></div></div></div></article>`;
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
      if (this.state.boardModal) overlays.push(this._renderBoardModal());
      if (this.state.pickerMode) overlays.push(this._renderBoardPicker());
      if (this.state.vaultMenu) overlays.push(this._renderVaultMenu());
      if (this.state.boardMenu) overlays.push(this._renderBoardMenu());
      if (this.state.boardContext) overlays.push(this._renderBoardContext());
      return overlays.join('');
    }

    _renderItemModal() {
      const item = this.state.editingItemId ? this.state.workspace.vaultItems.find((entry) => entry.id === this.state.editingItemId) : null;
      const value = (key, fallback = '') => esc(item?.[key] ?? fallback);
      return `<div class="cv-modal-backdrop" data-action="close-item"><form class="cv-modal" data-form="vault-item" data-stop><header class="cv-modal-head"><div><div class="cv-eyebrow">Vault item</div><h3>${item ? 'Edit production asset' : 'Add production asset'}</h3><p>Start with the essentials. Everything else can be filled in later.</p></div><button type="button" class="cv-icon-btn cv-close" data-action="close-item" aria-label="Close">×</button></header><div class="cv-modal-body"><div class="cv-form-grid"><label class="cv-file-drop wide">${icon('upload')}<span><strong>${item?.imageIds?.length ? 'Add or replace images' : 'Upload a main image'}</strong><small>PNG, JPEG, or WebP · multiple images supported</small></span><input data-file="vault-images" type="file" accept="image/png,image/jpeg,image/webp" multiple></label><div class="cv-field wide"><span>Item name *</span><input required name="name" value="${value('name')}" placeholder="e.g. Distressed wooden chair"></div><div class="cv-field"><span>Category</span><input name="category" value="${value('category','Uncategorized')}" list="cv-category-list" placeholder="Props"><datalist id="cv-category-list">${['Furniture','Props','Wardrobe','Practical lights','Decorations','Set dressing','Textures','Vehicles','Art pieces','Construction','Graphic elements'].map((label) => `<option>${label}</option>`).join('')}</datalist></div><div class="cv-field"><span>Subcategory</span><input name="subcategory" value="${value('subcategory')}" placeholder="Chairs"></div><div class="cv-field"><span>Quantity owned</span><input name="quantityOwned" type="number" min="0" value="${value('quantityOwned',1)}"></div><div class="cv-field"><span>Quantity available</span><input name="quantityAvailable" type="number" min="0" value="${value('quantityAvailable',1)}"></div><div class="cv-field"><span>Daily rental price</span><input name="dailyPrice" type="number" min="0" step="0.01" value="${value('dailyPrice',0)}"></div><div class="cv-field"><span>Availability</span><select name="availability">${['available','limited','reserved','unavailable'].map((option) => `<option value="${option}" ${item?.availability === option ? 'selected' : ''}>${option.replace('_',' ')}</option>`).join('')}</select></div><div class="cv-field wide"><span>Description</span><textarea name="description" placeholder="What makes this item useful on set?">${value('description')}</textarea></div><details class="cv-more"><summary>More Details</summary><div class="cv-form-grid"><div class="cv-field"><span>Internal code</span><input name="code" value="${value('code')}"></div><div class="cv-field"><span>Condition</span><select name="condition">${['new','excellent','good','fair','damaged','needs_repair'].map((option) => `<option value="${option}" ${item?.condition === option ? 'selected' : ''}>${option.replace('_',' ')}</option>`).join('')}</select></div><div class="cv-field"><span>Color</span><input name="color" value="${value('color')}"></div><div class="cv-field"><span>Material</span><input name="material" value="${value('material')}"></div><div class="cv-field"><span>Dimensions</span><input name="dimensions" value="${value('dimensions')}" placeholder="W × H × D"></div><div class="cv-field"><span>Weight</span><input name="weight" value="${value('weight')}"></div><div class="cv-field wide"><span>Storage location</span><input name="storageLocation" value="${value('storageLocation')}"></div><div class="cv-field"><span>Weekly rental price</span><input name="weeklyPrice" type="number" min="0" step="0.01" value="${value('weeklyPrice',0)}"></div><div class="cv-field"><span>Replacement value</span><input name="replacementValue" type="number" min="0" step="0.01" value="${value('replacementValue',0)}"></div><div class="cv-field"><span>Deposit amount</span><input name="depositAmount" type="number" min="0" step="0.01" value="${value('depositAmount',0)}"></div><div class="cv-field"><span>Owner or supplier</span><input name="ownerSupplier" value="${value('ownerSupplier')}"></div><div class="cv-field wide"><span>Contact information</span><input name="contactInformation" value="${value('contactInformation')}"></div><div class="cv-field wide"><span>Tags</span><input name="tags" value="${esc((item?.tags || []).join(', '))}" placeholder="vintage, wood, hero prop"></div><div class="cv-field wide"><span>Production notes</span><textarea name="productionNotes">${value('productionNotes')}</textarea></div><div class="cv-field wide"><span>Damage notes</span><textarea name="damageNotes">${value('damageNotes')}</textarea></div><div class="cv-field wide"><span>Included accessories</span><textarea name="includedAccessories">${value('includedAccessories')}</textarea></div></div></details></div><div class="cv-form-actions"><button type="button" class="cv-btn" data-action="close-item">Cancel</button><button class="cv-btn accent" type="submit">${item ? 'Save changes' : 'Add to Vault'}</button></div></div></form></div>`;
    }

    _renderBoardModal() {
      const types = { art: 'Production design, set concepts, materials, and color.', photo: 'Lighting, lenses, framing, wardrobe, and composition.', video: 'Treatments, movement, editing, and motion references.', blank: 'An empty open workspace for any visual direction.' };
      return `<div class="cv-modal-backdrop" data-action="close-board-modal"><form class="cv-modal" data-form="new-board" data-stop><header class="cv-modal-head"><div><div class="cv-eyebrow">New Board</div><h3>Choose a starting point</h3><p>Board types are templates, never restrictions.</p></div><button type="button" class="cv-icon-btn cv-close" data-action="close-board-modal">×</button></header><div class="cv-modal-body"><div class="cv-field" style="margin-bottom:16px"><span>Board name</span><input name="title" required placeholder="e.g. Clínica clandestina"></div><div class="cv-board-type-grid">${Object.entries(types).map(([type,copy]) => `<button type="submit" name="type" value="${type}" class="cv-board-type"><span class="cv-role-icon">${icon(type === 'photo' ? 'image' : type === 'video' ? 'shot' : 'boards')}</span><span><strong>${typeLabels[type]} Board</strong><small>${copy}</small></span></button>`).join('')}</div></div></form></div>`;
    }

    _renderBoardPicker() {
      if (this.state.pickerMode === 'board-vault') {
        const items = (this.state.workspace?.vaultItems || []).filter((item) => !item.archived);
        return `<div class="cv-modal-backdrop" data-action="close-picker"><section class="cv-modal" data-stop><header class="cv-modal-head"><div><div class="cv-eyebrow">Vault → Board</div><h3>Choose a production asset</h3><p>The Board card stays connected to its Vault price, code, and availability.</p></div><button class="cv-icon-btn cv-close" data-action="close-picker">×</button></header><div class="cv-modal-body">${items.length ? `<div class="cv-vault-grid">${items.map((item) => `<button class="cv-card cv-item" data-action="pick-vault-item" data-id="${item.id}" style="text-align:left"><div class="cv-item-image">${item.mainImageId ? `<img loading="lazy" src="${esc(this.assetUrl(item.mainImageId))}" alt="${esc(item.name)}">` : icon('landscape')}</div><div class="cv-item-body"><div class="cv-item-title">${esc(item.name)}</div><div class="cv-item-meta"><span>${item.quantityAvailable} available</span><span class="cv-item-price">${money(item.dailyPrice)}/day</span></div></div></button>`).join('')}</div>` : `<div class="cv-empty"><div><h3>Your Vault is empty</h3><p>Add an asset in Vault, then return to this Board.</p><button class="cv-btn" data-action="close-picker">Close</button></div></div>`}</div></section></div>`;
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
      return `<div class="cv-menu-pop" style="left:${x}px;top:${y}px" data-stop><button data-action="open-board" data-id="${id}">Open Board</button><button data-action="duplicate-board" data-id="${id}">Duplicate</button><button data-action="delete-board" data-id="${id}" style="color:#B24C47">Delete…</button></div>`;
    }

    _renderBoardContext() {
      const { x, y } = this.state.boardContext;
      return `<div class="cv-context" style="left:${x}px;top:${y}px" data-stop><button data-action="board-add-image">${icon('image')}Add Image</button><button data-action="board-add-text">${icon('text')}Add Text</button><button data-action="board-add-note">${icon('note')}Add Note</button><button data-action="board-add-vault">${icon('vault')}Add Vault Item</button><button data-action="board-upload">${icon('upload')}Upload Image</button></div>`;
    }

    _renderBoardEditor() {
      const board = this.activeBoard();
      if (!board) { this.state.view = 'boards'; return `${this._renderTop()}${this._renderBoards()}`; }
      board.elements = Array.isArray(board.elements) ? board.elements : [];
      board.viewport = { x: 0, y: 0, zoom: 1, ...(board.viewport || {}) };
      board.settings = { snapToGrid: false, gridSize: 16, ...(board.settings || {}) };
      const selected = this.state.selected;
      const elements = board.elements.filter((element) => !element.hidden).map((element) => this._renderBoardElement(element, selected.has(element.id))).join('');
      const empty = !board.elements.length ? `<div class="cv-board-empty"><h3>${esc(typeLabels[board.type])} Board</h3><p>Start with one image, Vault item, or note. You can move and resize everything later.</p><div class="cv-empty-actions"><button class="cv-btn accent" data-action="board-add-image">${icon('image')} Add image</button><button class="cv-btn" data-action="board-add-vault">${icon('vault')} Add from Vault</button><button class="cv-btn" data-action="board-add-text">${icon('text')} Add text</button></div></div>` : '';
      const toolbar = selected.size ? `<div class="cv-element-toolbar" style="left:18px;top:70px"><button data-action="board-duplicate-selection">Duplicate</button><button data-action="board-group-selection" ${selected.size > 1 ? '' : 'disabled'}>Group</button><button data-action="board-align-left" ${selected.size > 1 ? '' : 'disabled'}>Align left</button><button data-action="board-delete-selection" style="color:#B24C47">Delete</button></div>` : '';
      return `<div class="cv-board-shell"><header class="cv-board-top"><button class="cv-btn cv-board-back" data-action="back-boards">${icon('back')} Boards</button><input class="cv-board-title" data-field="board-title" value="${esc(board.title)}" aria-label="Board title"><span class="cv-board-save">${esc(this.state.autosave)}</span><div class="cv-board-tools" aria-label="Board tools"><button class="cv-icon-btn" data-action="board-undo" title="Undo" aria-label="Undo" ${this._history.length ? '' : 'disabled'}>${icon('undo')}</button><button class="cv-icon-btn" data-action="board-redo" title="Redo" aria-label="Redo" ${this._future.length ? '' : 'disabled'}>${icon('redo')}</button><button class="cv-btn" data-action="board-add-image">${icon('image')} Image</button><button class="cv-btn" data-action="board-add-text">Text</button><button class="cv-btn" data-action="board-add-note">Note</button><button class="cv-btn" data-action="board-add-vault">Vault</button><button class="cv-btn" data-action="board-fit" title="Fit all board elements">Fit</button><div class="cv-board-zoom"><button class="cv-btn" data-action="board-zoom-out" aria-label="Zoom out">−</button><span>${Math.round(board.viewport.zoom * 100)}%</span><button class="cv-btn" data-action="board-zoom-in" aria-label="Zoom in">+</button></div><button class="cv-icon-btn ${board.settings.snapToGrid ? 'active' : ''}" data-action="board-snap" title="Snap to grid" aria-label="Snap to grid">${icon('grid')}</button></div><input hidden type="file" accept="image/png,image/jpeg,image/webp" data-file="board-image" tabindex="-1"></header><div class="cv-board-viewport" data-board-viewport tabindex="0" aria-label="Board canvas"><div class="cv-board-layer" data-board-layer>${elements}</div>${empty}</div>${toolbar}</div>`;
    }

    _renderBoardElement(element, selected) {
      const style = `left:${element.positionX}px;top:${element.positionY}px;width:${element.width}px;height:${element.height}px;z-index:${element.zIndex};transform:rotate(${element.rotation || 0}deg)`;
      if (element.type === 'image') return `<article class="cv-element image ${selected ? 'selected' : ''}" data-element-id="${element.id}" style="${style}"><img loading="lazy" src="${esc(this.assetUrl(element.assetId))}" alt="Board reference"><span class="cv-resize" data-resize-id="${element.id}"></span></article>`;
      if (element.type === 'vault') {
        const item = this.state.workspace.vaultItems.find((entry) => entry.id === element.vaultItemId);
        const image = item?.mainImageId ? `<img loading="lazy" src="${esc(this.assetUrl(item.mainImageId))}" alt="${esc(item.name)}">` : '';
        return `<article class="cv-element vault ${selected ? 'selected' : ''}" data-element-id="${element.id}" style="${style}">${image}<div class="cv-vault-element-meta"><strong>${esc(item?.name || element.content || 'Vault item')}</strong>${item ? `${esc(item.quantityAvailable)} available · ${money(item.dailyPrice)}/day` : 'Vault link unavailable'}</div><span class="cv-resize" data-resize-id="${element.id}"></span></article>`;
      }
      return `<article class="cv-element ${esc(element.type)} ${selected ? 'selected' : ''}" data-element-id="${element.id}" style="${style}"><div class="cv-element-content" contenteditable="true" data-content-id="${element.id}" data-placeholder="Write…">${esc(element.content)}</div><span class="cv-resize" data-resize-id="${element.id}"></span></article>`;
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
        if (this.state.vaultMenu || this.state.boardMenu || this.state.boardContext) { this.state.vaultMenu = this.state.boardMenu = this.state.boardContext = null; this.render(); }
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
      if (action === 'add-item') { this.state.itemModal = true; this.state.editingItemId = ''; this._pendingVaultFiles = []; return this.render(); }
      if (action === 'close-item') { this.state.itemModal = false; this.state.editingItemId = ''; return this.render(); }
      if (action === 'edit-item') { this.state.itemModal = true; this.state.editingItemId = id; this.state.vaultMenu = null; return this.render(); }
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
      if (action === 'open-board') return this.openBoard(id);
      if (action === 'board-menu') { const rect = trigger.getBoundingClientRect(); this.state.boardMenu = { id, x: Math.min(innerWidth - 180, rect.right - 170), y: rect.bottom + 5 }; return this.render(); }
      if (action === 'duplicate-board') return this.duplicateBoard(id);
      if (action === 'delete-board') return this.deleteBoard(id);
      if (action === 'close-picker') { this.state.pickerMode = ''; return this.render(); }
      if (action === 'picker-create-board') { this.state.pickerMode = ''; this.state.boardModal = true; return this.render(); }
      if (action === 'pick-board') return this.addSelectedToBoard(id);
      if (action === 'pick-vault-item') return this.addVaultItemToActiveBoard(id);
      if (action === 'back-boards') { this.flushBoardSave(); this.state.view = 'boards'; this.state.activeBoardId = ''; this.state.selected.clear(); return this.render(); }
      if (action === 'board-add-image' || action === 'board-upload') {
        // Open the native picker while the original click gesture is still active.
        // Rendering first replaces the input and Safari silently ignores the picker.
        const input = this.shadowRoot.querySelector('[data-file="board-image"]');
        if (!input) return this.toast('Image upload is not available on this Board yet.');
        input.value = '';
        this.state.boardContext = null;
        this.shadowRoot.querySelector('.cv-context')?.remove();
        input.click();
        return;
      }
      if (action === 'board-add-text') return this.addBoardElement('text');
      if (action === 'board-add-note') return this.addBoardElement('note');
      if (action === 'board-add-vault') { this.state.boardContext = null; this.state.pickerMode = 'board-vault'; return this.render(); }
      if (action === 'board-zoom-in') return this.zoomBoard(.12);
      if (action === 'board-zoom-out') return this.zoomBoard(-.12);
      if (action === 'board-fit') return this.fitBoard();
      if (action === 'board-snap') { const board=this.activeBoard(); board.settings.snapToGrid=!board.settings.snapToGrid; this.queueBoardSave(); return this.render(); }
      if (action === 'board-undo') return this.undoBoard();
      if (action === 'board-redo') return this.redoBoard();
      if (action === 'board-delete-selection') return this.deleteBoardSelection();
      if (action === 'board-duplicate-selection') return this.duplicateBoardSelection();
      if (action === 'board-group-selection') return this.groupBoardSelection();
      if (action === 'board-align-left') return this.alignBoardSelection();
      if (action === 'quote-back') { this.state.quoteDraft = null; this.state.view='vault'; return this.render(); }
      if (action === 'quote-save') return this.saveQuote();
      if (action === 'quote-export') return this.exportQuote();
      if (action === 'quote-remove-item') { this.state.quoteDraft.items=this.state.quoteDraft.items.filter((item)=>item.id!==id); return this.render(); }
    }

    _onInput(event) {
      const field = event.target.dataset.field;
      if (field === 'vault-search') { this.state.search = event.target.value; return this.render(); }
      if (field === 'board-title') { const board=this.activeBoard(); if(board){board.title=event.target.value;this.queueBoardSave();} return; }
      if (event.target.dataset.contentId) {
        const element = this.activeBoard()?.elements.find((entry) => entry.id === event.target.dataset.contentId);
        if (element) { element.content = event.target.textContent.slice(0, 20000); element.updatedAt = new Date().toISOString(); this.queueBoardSave(); }
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
      if (field === 'vault-category') this.state.category = event.target.value;
      else if (field === 'vault-availability') this.state.availability = event.target.value;
      else if (field === 'vault-condition') this.state.condition = event.target.value;
      else if (field === 'vault-storage') this.state.storage = event.target.value;
      else if (field === 'vault-sort') this.state.sort = event.target.value;
      else if (event.target.dataset.selectItem) {
        if (event.target.checked) this.state.selected.add(event.target.dataset.selectItem); else this.state.selected.delete(event.target.dataset.selectItem);
      } else if (event.target.dataset.file === 'vault-images') {
        this._pendingVaultFiles = [...event.target.files];
        const label = event.target.closest('.cv-file-drop')?.querySelector('strong');
        if (label) label.textContent = `${this._pendingVaultFiles.length} image${this._pendingVaultFiles.length === 1 ? '' : 's'} ready`;
        return;
      } else if (event.target.dataset.file === 'vault-import') {
        const file = event.target.files?.[0];
        event.target.value = '';
        return this.importVault(file);
      } else if (event.target.dataset.file === 'board-image') {
        const file = event.target.files?.[0];
        event.target.value = '';
        return this.uploadBoardImage(file);
      }
      else if (event.target.dataset.quote) return this._onInput(event);
      if (field || event.target.dataset.selectItem) this.render();
    }

    _onSubmit(event) {
      event.preventDefault();
      const form = event.target;
      if (form.dataset.form === 'vault-item') return this.saveVaultItem(form);
      if (form.dataset.form === 'new-board') {
        const submitter = event.submitter;
        return this.createBoard(new FormData(form).get('title'), submitter?.value || 'blank');
      }
    }

    _onContextMenu(event) {
      const viewport = event.target.closest('[data-board-viewport]');
      if (!viewport || event.target.closest('[data-element-id]')) return;
      event.preventDefault();
      const rect = this.getBoundingClientRect();
      this.state.boardContext = { x: Math.min(innerWidth - 190, event.clientX), y: Math.min(innerHeight - 190, event.clientY), boardX: event.offsetX, boardY: event.offsetY };
      this.render();
    }

    _onKeyDown(event) {
      if (this.state.view === 'boards' && (event.key === 'Enter' || event.key === ' ')) {
        const card = event.target.closest('[data-action="open-board"]');
        if (card) { event.preventDefault(); return this.openBoard(card.dataset.id); }
      }
      if (this.state.view !== 'board' || event.target.matches('input,textarea,[contenteditable=true]')) return;
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === 'z') { event.preventDefault(); return event.shiftKey ? this.redoBoard() : this.undoBoard(); }
      if (modifier && event.key.toLowerCase() === 'd') { event.preventDefault(); return this.duplicateBoardSelection(); }
      if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); return this.deleteBoardSelection(); }
      if (event.key === 'Escape') { this.state.selected.clear(); this.state.boardContext=null; return this.render(); }
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

    async uploadFiles(files) {
      const assets = [];
      for (const original of files || []) {
        const compressed = await this.compressImage(original);
        const result = await window.filmscriptCanvas.uploadAsset(this.scriptId, compressed.file, compressed);
        assets.push(result.asset);
        this.state.workspace.assets = Array.isArray(this.state.workspace.assets) ? this.state.workspace.assets : [];
        this.state.workspace.assets.push(result.asset);
      }
      return assets;
    }

    formObject(form) {
      const data = Object.fromEntries(new FormData(form).entries());
      ['quantityOwned','quantityAvailable'].forEach((key) => { data[key] = Math.max(0, Math.round(num(data[key]))); });
      ['dailyPrice','weeklyPrice','replacementValue','depositAmount'].forEach((key) => { data[key] = Math.max(0, num(data[key])); });
      data.tags = String(data.tags || '').split(',').map((entry) => entry.trim()).filter(Boolean);
      return data;
    }

    async saveVaultItem(form) {
      const editing = this.state.workspace.vaultItems.find((entry) => entry.id === this.state.editingItemId);
      const draft = this.formObject(form);
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
        this.state.itemModal = false; this.state.editingItemId = ''; this._pendingVaultFiles = [];
        this.toast(editing ? 'Vault item updated' : 'Added to Vault');
      } catch (error) { this.toast(error.message || 'Could not save the Vault item.'); }
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

    openBoard(boardId){this.state.activeBoardId=boardId;this.state.view='board';this.state.selected.clear();this.state.boardMenu=null;this._history=[];this._future=[];this.state.autosave='Saved';this.render();}
    async duplicateBoard(boardId){const board=this.state.workspace.boards.find((entry)=>entry.id===boardId);if(!board)return;try{const result=await window.filmscriptCanvas.createBoard(this.scriptId,{...board,id:undefined,title:`${board.title} copy`,elements:board.elements.map((element)=>({...element,id:undefined,positionX:element.positionX+24,positionY:element.positionY+24}))});this.state.workspace.boards.unshift(result.board);this.state.boardMenu=null;this.toast('Board duplicated');}catch(error){this.toast(error.message);}}
    async deleteBoard(boardId){const board=this.state.workspace.boards.find((entry)=>entry.id===boardId);if(!board||!confirm(`Delete “${board.title}” and every element on it?`))return;try{await window.filmscriptCanvas.deleteBoard(this.scriptId,boardId);this.state.workspace.boards=this.state.workspace.boards.filter((entry)=>entry.id!==boardId);this.state.boardMenu=null;this.toast('Board deleted');}catch(error){this.toast(error.message);}}

    _boardPoint(){const board=this.activeBoard();const context=this.state.boardContext;const viewport=this.shadowRoot.querySelector('[data-board-viewport]');const rect=viewport?.getBoundingClientRect();if(context&&rect)return{x:(context.x-rect.left-board.viewport.x)/board.viewport.zoom,y:(context.y-rect.top-board.viewport.y)/board.viewport.zoom};return{x:(viewport?.clientWidth||800)/2/board.viewport.zoom-board.viewport.x/board.viewport.zoom,y:(viewport?.clientHeight||600)/2/board.viewport.zoom-board.viewport.y/board.viewport.zoom};}
    pushHistory(){const board=this.activeBoard();if(!board)return;this._history.push(JSON.stringify({elements:board.elements,viewport:board.viewport}));if(this._history.length>50)this._history.shift();this._future=[];}
    addBoardElement(type,extra={}){const board=this.activeBoard();if(!board)return;board.elements=Array.isArray(board.elements)?board.elements:[];board.settings={snapToGrid:false,gridSize:16,...(board.settings||{})};this.pushHistory();const point=this._boardPoint();if(!this.state.boardContext&&board.elements.length){const slot=board.elements.length%6;const cycle=Math.floor(board.elements.length/6);const offsets=[[0,0],[360,0],[-360,0],[0,230],[360,230],[-360,230]][slot];point.x+=offsets[0]+cycle*28;point.y+=offsets[1]+cycle*28;}const element={id:uid('bel'),type,positionX:point.x,positionY:point.y,width:type==='text'?320:220,height:type==='text'?90:150,rotation:0,zIndex:Math.max(0,...board.elements.map((entry)=>entry.zIndex||0))+1,content:type==='text'?'Title':type==='note'?'Add a note…':'',metadata:{},status:'',locked:false,hidden:false,groupId:'',sceneId:'',vaultItemId:'',assetId:'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),...extra};if(board.settings.snapToGrid){const g=Math.max(1,num(board.settings.gridSize,16));element.positionX=Math.round(element.positionX/g)*g;element.positionY=Math.round(element.positionY/g)*g;}board.elements.push(element);this.state.selected=new Set([element.id]);this.state.boardContext=null;this.queueBoardSave();this.render();}
    async uploadBoardImage(file){if(!file)return;this.toast('Optimizing and uploading image…');try{const [asset]=await this.uploadFiles([file]);if(!asset?.id)throw new Error('The image could not be uploaded.');this.addBoardElement('image',{assetId:asset.id,width:300,height:220,content:file.name});this.toast('Image added to Board');}catch(error){this.toast(error.message||'Could not upload that image.');}}

    async addSelectedToBoard(boardId){const board=this.state.workspace.boards.find((entry)=>entry.id===boardId);if(!board)return;if(this.state.pickerMode==='board-vault'&&!this.state.selected.size){this.state.pickerMode='';this.setView('vault');return this.toast('Select Vault items, then choose Add to Board.');}const ids=[...this.state.selected];let index=0;for(const itemId of ids){const item=this.state.workspace.vaultItems.find((entry)=>entry.id===itemId);if(!item)continue;board.elements.push({id:uid('bel'),type:'vault',positionX:180+(index%3)*290,positionY:160+Math.floor(index/3)*230,width:260,height:190,rotation:0,zIndex:board.elements.length+index+1,content:item.name,metadata:{showPrice:true,showCode:true,requestedQuantity:1},status:'proposed',locked:false,hidden:false,groupId:'',sceneId:'',vaultItemId:item.id,assetId:item.mainImageId||'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});index++;}try{const result=await window.filmscriptCanvas.updateBoard(this.scriptId,board.id,board);this.state.workspace.boards=this.state.workspace.boards.map((entry)=>entry.id===board.id?result.board:entry);this.state.pickerMode='';this.state.selected.clear();this.toast(`${index} Vault item${index===1?'':'s'} added to ${board.title}`);}catch(error){this.toast(error.message);}}

    addVaultItemToActiveBoard(itemId){const item=this.state.workspace.vaultItems.find((entry)=>entry.id===itemId);if(!item)return;this.state.pickerMode='';this.addBoardElement('vault',{vaultItemId:item.id,assetId:item.mainImageId||'',content:item.name,width:260,height:190,metadata:{showPrice:true,showCode:true,requestedQuantity:1},status:'proposed'});this.toast(`${item.name} added to Board`);}

    queueBoardSave(){const board=this.activeBoard();if(!board)return;this.state.autosave='Saving…';clearTimeout(this._boardSaveTimer);this._boardSaveTimer=setTimeout(()=>this.flushBoardSave(),650);}
    async flushBoardSave(){clearTimeout(this._boardSaveTimer);const board=this.activeBoard();if(!board)return;try{const result=await window.filmscriptCanvas.updateBoard(this.scriptId,board.id,board);const index=this.state.workspace.boards.findIndex((entry)=>entry.id===board.id);if(index>=0)this.state.workspace.boards[index]=result.board;this.state.autosave='Saved';if(this.state.view==='board')this.render();}catch(error){this.state.autosave='Save failed';this.toast(error.message);}}
    zoomBoard(delta){const board=this.activeBoard();if(!board)return;board.viewport.zoom=Math.max(.2,Math.min(3,board.viewport.zoom+delta));this.queueBoardSave();this.render();}
    fitBoard(){
      const board=this.activeBoard();
      const viewport=this.shadowRoot.querySelector('[data-board-viewport]');
      if(!board||!viewport)return;
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
    _snapshotCurrent(){const board=this.activeBoard();return JSON.stringify({elements:board.elements,viewport:board.viewport});}
    undoBoard(){const board=this.activeBoard();if(!board||!this._history.length)return;this._future.push(this._snapshotCurrent());const state=JSON.parse(this._history.pop());board.elements=state.elements;board.viewport=state.viewport;this.state.selected.clear();this.queueBoardSave();this.render();}
    redoBoard(){const board=this.activeBoard();if(!board||!this._future.length)return;this._history.push(this._snapshotCurrent());const state=JSON.parse(this._future.pop());board.elements=state.elements;board.viewport=state.viewport;this.state.selected.clear();this.queueBoardSave();this.render();}
    deleteBoardSelection(){const board=this.activeBoard();if(!board||!this.state.selected.size)return;if(!confirm(`Delete ${this.state.selected.size} selected element${this.state.selected.size===1?'':'s'}?`))return;this.pushHistory();board.elements=board.elements.filter((entry)=>!this.state.selected.has(entry.id));this.state.selected.clear();this.queueBoardSave();this.render();}
    duplicateBoardSelection(){const board=this.activeBoard();if(!board||!this.state.selected.size)return;this.pushHistory();const copies=board.elements.filter((entry)=>this.state.selected.has(entry.id)).map((entry,index)=>({...entry,id:uid('bel'),positionX:entry.positionX+24,positionY:entry.positionY+24,zIndex:board.elements.length+index+1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}));board.elements.push(...copies);this.state.selected=new Set(copies.map((entry)=>entry.id));this.queueBoardSave();this.render();}
    groupBoardSelection(){const board=this.activeBoard();if(!board||this.state.selected.size<2)return;this.pushHistory();const groupId=uid('grp');board.elements.forEach((entry)=>{if(this.state.selected.has(entry.id))entry.groupId=groupId;});this.queueBoardSave();this.toast('Elements grouped');}
    alignBoardSelection(){const board=this.activeBoard();const elements=board?.elements.filter((entry)=>this.state.selected.has(entry.id))||[];if(elements.length<2)return;this.pushHistory();const left=Math.min(...elements.map((entry)=>entry.positionX));elements.forEach((entry)=>{entry.positionX=left;});this.queueBoardSave();this.render();}

    _onPointerDown(event){if(this.state.view!=='board'||event.button!==0)return;const resize=event.target.closest('[data-resize-id]');const elementNode=event.target.closest('[data-element-id]');const viewport=event.target.closest('[data-board-viewport]');const board=this.activeBoard();if(!board||!viewport)return;if(resize){event.preventDefault();event.stopPropagation();const element=board.elements.find((entry)=>entry.id===resize.dataset.resizeId);if(!element)return;this.pushHistory();this._pointer={kind:'resize',startX:event.clientX,startY:event.clientY,element,startW:element.width,startH:element.height,zoom:board.viewport.zoom};return this._startPointerInteraction();}if(elementNode&&!event.target.closest('[contenteditable=true]')){event.preventDefault();const id=elementNode.dataset.elementId;const element=board.elements.find((entry)=>entry.id===id);if(!element||element.locked)return;const groupIds=element.groupId?board.elements.filter((entry)=>entry.groupId===element.groupId).map((entry)=>entry.id):[id];if(event.shiftKey){if(this.state.selected.has(id))this.state.selected.delete(id);else this.state.selected.add(id);}else if(!this.state.selected.has(id))this.state.selected=new Set(groupIds);this.render();const originals=new Map(board.elements.filter((entry)=>this.state.selected.has(entry.id)).map((entry)=>[entry.id,{x:entry.positionX,y:entry.positionY}]));this.pushHistory();this._pointer={kind:'move',startX:event.clientX,startY:event.clientY,originals,zoom:board.viewport.zoom};return this._startPointerInteraction();}if(viewport){event.preventDefault();if(!event.shiftKey)this.state.selected.clear();this.state.boardContext=null;this.render();this.pushHistory();this._pointer={kind:'pan',startX:event.clientX,startY:event.clientY,startVX:board.viewport.x,startVY:board.viewport.y};viewport.classList.add('panning');this._startPointerInteraction();}}
    _startPointerInteraction(){this._pointerMove=(event)=>this._onPointerMove(event);this._pointerUp=()=>this._stopPointerInteraction(true);window.addEventListener('pointermove',this._pointerMove);window.addEventListener('pointerup',this._pointerUp,{once:true});}
    _onPointerMove(event){const p=this._pointer;const board=this.activeBoard();if(!p||!board)return;const dx=event.clientX-p.startX,dy=event.clientY-p.startY;if(p.kind==='pan'){board.viewport.x=p.startVX+dx;board.viewport.y=p.startVY+dy;this._positionBoardLayer();}else if(p.kind==='move'){for(const [id,start] of p.originals){const element=board.elements.find((entry)=>entry.id===id);if(!element)continue;let x=start.x+dx/p.zoom,y=start.y+dy/p.zoom;if(board.settings.snapToGrid){const g=board.settings.gridSize;x=Math.round(x/g)*g;y=Math.round(y/g)*g;}element.positionX=x;element.positionY=y;const node=this.shadowRoot.querySelector(`[data-element-id="${id}"]`);if(node){node.style.left=`${x}px`;node.style.top=`${y}px`;}}}else if(p.kind==='resize'){let w=Math.max(80,p.startW+dx/p.zoom),h=Math.max(54,p.startH+dy/p.zoom);if(board.settings.snapToGrid){const g=board.settings.gridSize;w=Math.round(w/g)*g;h=Math.round(h/g)*g;}p.element.width=w;p.element.height=h;const node=this.shadowRoot.querySelector(`[data-element-id="${p.element.id}"]`);if(node){node.style.width=`${w}px`;node.style.height=`${h}px`;}}}
    _stopPointerInteraction(save=false){if(this._pointerMove)window.removeEventListener('pointermove',this._pointerMove);if(this._pointerUp)window.removeEventListener('pointerup',this._pointerUp);this._pointerMove=this._pointerUp=null;if(save&&this._pointer){this.queueBoardSave();this.render();}this._pointer=null;}
    _onWheel(event){const viewport=event.target.closest('[data-board-viewport]');if(!viewport||this.state.view!=='board')return;event.preventDefault();const board=this.activeBoard();if(event.ctrlKey||event.metaKey){const next=Math.max(.2,Math.min(3,board.viewport.zoom*(event.deltaY>0?.92:1.08)));board.viewport.zoom=next;}else{board.viewport.x-=event.deltaX;board.viewport.y-=event.deltaY;}this._positionBoardLayer();this.queueBoardSave();}
  }

  if (!customElements.get('film-script-canvas')) customElements.define('film-script-canvas', FilmScriptCanvasWorkspace);
})();
