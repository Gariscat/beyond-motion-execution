// Pages' static asset service does not currently return byte-range responses.
// This handler enables native video seeking for the task showcase MP4 assets.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!/^\/assets\/media\/task-(0[1-9]|1[0-4])\.mp4$/.test(url.pathname)) {
      return env.ASSETS.fetch(request);
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    const range = request.headers.get('Range');
    const ifRange = request.headers.get('If-Range');
    const originHeaders = new Headers(request.headers);
    originHeaders.delete('Range');
    originHeaders.delete('If-Range');
    const asset = await env.ASSETS.fetch(new Request(request, { headers: originHeaders }));
    const headers = new Headers(asset.headers);
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Referrer-Policy', 'no-referrer');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Robots-Tag', 'noindex, nofollow');
    const complete = () => new Response(request.method === 'HEAD' ? null : asset.body, {
      status: asset.status, headers,
    });
    if (asset.status !== 200 || request.method === 'HEAD' || !range) return complete();
    if (ifRange && ifRange !== headers.get('ETag') && ifRange !== headers.get('Last-Modified')) {
      return complete();
    }
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    // Unsupported multi-range requests fall back to the complete representation.
    if (!match || (!match[1] && !match[2])) return complete();
    // ASSETS may omit Content-Length inside a Worker, even though the edge adds
    // it to the final HTTP response. Use the actual representation length.
    // Each published video is below 25 MiB, within the per-request memory budget.
    const bytes = await asset.arrayBuffer();
    const size = bytes.byteLength;
    let start = 0;
    let end = size - 1;
    if (match[1]) {
      start = Number(match[1]);
      if (match[2]) end = Math.min(end, Number(match[2]));
    } else {
      const suffix = Number(match[2]);
      start = Math.max(0, size - suffix);
    }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) {
      headers.set('Content-Range', `bytes */${size}`);
      headers.set('Content-Length', '0');
      return new Response(null, { status: 416, headers });
    }
    headers.delete('Content-Encoding');
    headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
    headers.set('Content-Length', String(end - start + 1));
    return new Response(bytes.slice(start, end + 1), { status: 206, headers });
  },
};
