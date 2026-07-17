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

    // Safety net for deployments where the Sites asset mount is unavailable:
    // keep the canonical URL usable and send the owner to the live ERP panel.
    if (pathname === "/" || pathname === "/index.html") {
      return Response.redirect("https://erp.filmscript.app/login", 302);
    }
    return first;
  },
};
