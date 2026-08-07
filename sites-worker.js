// Cloudflare Worker entrypoint for the Sites static preview.
// FilmScript's authenticated API remains external and is configured through
// runtime-config.js once the AWS backend has a public HTTPS origin.
export default {
  async fetch(request, env) {
    const first = await env.ASSETS.fetch(request);
    if (first.status !== 404 || request.method !== "GET") return first;

    // Sites can expose the packaged build at either the asset root or under
    // its archive directory. Try both layouts so the static preview keeps
    // working when the hosting adapter changes its asset mount point.
    const url = new URL(request.url);
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const candidates = [pathname, `/dist${pathname}`, `/public${pathname}`];
    if (pathname.endsWith(".html")) candidates.push("/index.html", "/dist/index.html", "/public/index.html");

    for (const candidate of [...new Set(candidates)]) {
      const asset = await env.ASSETS.fetch(new Request(new URL(candidate, request.url), request));
      if (asset.status !== 404) return asset;
    }

    // Visual fallback: keep the Sites URL useful while its static asset mount
    // is being repaired. This intentionally has no authentication or login.
    if (pathname === "/" || pathname === "/index.html") {
      return new Response(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FilmScript Business</title><style>*{box-sizing:border-box}body{margin:0;background:#090a0c;color:#f4f5f7;font:14px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.app{display:flex;min-height:100vh}.side{width:250px;background:#0d0f12;border-right:1px solid #272b33;padding:26px 16px}.brand{font-weight:700;font-size:17px;margin:0 10px 34px}.brand small{display:block;color:#888;font-size:9px;letter-spacing:2px;margin-top:3px}.workspace{color:#9299a5;border:1px solid #282c34;padding:11px;border-radius:9px;font-size:11px;margin-bottom:18px}.nav{padding:12px;border-radius:8px;color:#9299a5;margin:4px 0}.nav.active{background:#1b1e24;color:#fff;border-left:2px solid #a8e66b}.main{padding:44px;flex:1;max-width:1250px}.eyebrow{color:#8b929e;letter-spacing:2px;font-size:10px}.hero{display:flex;justify-content:space-between;align-items:end;margin-bottom:25px}.hero h1{font-size:30px;margin:5px 0}.hero p{color:#9299a5}.pill{border:1px solid #2b3039;border-radius:8px;padding:10px;color:#a8e66b;font-size:11px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:13px}.card{background:#12151a;border:1px solid #272b33;border-radius:12px;padding:19px}.label{color:#9299a5;font-size:11px}.value{font-size:25px;margin:9px 0 4px}.up{color:#a8e66b;font-size:11px}.cols{display:grid;grid-template-columns:1.3fr 1fr;gap:14px;margin-top:14px}.card h3{font-size:14px;margin:0 0 17px}.row{display:flex;justify-content:space-between;border-top:1px solid #272b33;padding:13px 0;color:#cdd1d8}.row span{color:#9299a5}.bar{height:8px;background:#26362b;border-radius:8px;margin:18px 0}.bar i{display:block;height:100%;width:72%;background:#a8e66b;border-radius:8px}@media(max-width:760px){.side{width:190px}.main{padding:25px 16px}.grid{grid-template-columns:repeat(2,1fr)}.cols{grid-template-columns:1fr}.hero{display:block}}
</style><div class="app"><aside class="side"><div class="brand">FilmScript<small>BUSINESS</small></div><div class="workspace">● Panel de negocio <b style="float:right;color:#a8e66b">TEST</b></div><div class="nav active">⌂ &nbsp; Resumen</div><div class="nav">✦ &nbsp; IA y uso</div><div class="nav">◫ &nbsp; Operación</div><div class="nav">▣ &nbsp; Planes</div><div class="nav">↗ &nbsp; Compras</div></aside><main class="main"><div class="eyebrow">FILMSCRIPT / BUSINESS</div><div class="hero"><div><h1>Resumen</h1><p>Tu negocio, bajo control.</p></div><div class="pill">Vista previa · sin acceso</div></div><div class="grid"><div class="card"><div class="label">Ingresos netos</div><div class="value">$4,286.40</div><div class="up">↑ 12.8%</div></div><div class="card"><div class="label">Suscripciones activas</div><div class="value">118</div><div class="up">↑ 8 esta semana</div></div><div class="card"><div class="label">MRR</div><div class="value">$3,940</div><div class="up">↑ 9.4%</div></div><div class="card"><div class="label">ROS estimado</div><div class="value">34.6%</div><div class="up">Con OPEX registrado</div></div></div><div class="cols"><div class="card"><h3>Ingresos cobrados</h3><div class="bar"><i></i></div><div class="row"><span>Ventas brutas</span><b>$4,892</b></div><div class="row"><span>Comisiones Recurrente</span><b>$146.76</b></div><div class="row"><span>Ingreso neto</span><b>$4,745.24</b></div></div><div class="card"><h3>Embudo de compra</h3><div class="row"><span>Visitas</span><b>2,840</b></div><div class="row"><span>Checkout iniciado</span><b>214</b></div><div class="row"><span>Pago exitoso</span><b>86</b></div><div class="row"><span>Suscripción activa</span><b>82</b></div></div></div></main></div></html>`,{headers:{"content-type":"text/html;charset=UTF-8"}});
    }
    return first;
  },
};
