// Static Sites adapter. The authenticated FilmScript API remains on AWS.
export default {
  async fetch(request, env) {
    const first = await env.ASSETS.fetch(request);
    if (first.status !== 404 || request.method !== "GET") return first;

    const url = new URL(request.url);
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const candidates = [pathname, `/dist${pathname}`, `/public${pathname}`];

    for (const candidate of [...new Set(candidates)]) {
      const response = await env.ASSETS.fetch(
        new Request(new URL(candidate, request.url), request),
      );
      if (response.status !== 404) return response;
    }

    if (pathname === "/" || pathname === "/index.html") {
      return Response.redirect(new URL("/Features.dc.html", request.url), 302);
    }
    return new Response("Not found", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  },
};
