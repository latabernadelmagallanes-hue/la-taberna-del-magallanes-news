const SUPABASE_URL = 'https://jwizuyoipoymqzvuirnb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3aXp1eW9pcG95bXF6dnVpcm5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxMTU5ODMsImV4cCI6MjEwNzY5MTk4M30.zJCH7t3FkmyNAwxnt6pMGFB-leiANwgdt0QA6wwVMtU';

function escapeAttr(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function stripHtml(html) {
  if (!html) return '';
  return String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export default async (request, context) => {
  const url = new URL(request.url);
  const articleId = url.searchParams.get('article');

  if (!articleId || !/^\d+$/.test(articleId)) {
    return context.next();
  }

  const [response, apiRes] = await Promise.all([
    context.next(),
    fetch(
      `${SUPABASE_URL}/rest/v1/articles?id=eq.${articleId}&select=id,title,lead,content,image_url,author,type,created_at`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    ).catch(() => null)
  ]);

  if (!apiRes || !apiRes.ok) {
    return response;
  }

  const rows = await apiRes.json().catch(() => []);
  const article = Array.isArray(rows) ? rows[0] : null;
  if (!article) {
    return response;
  }

  let html = await response.text();

  const title = escapeAttr(`${article.title} · La Taberna del Magallanes News`);
  const plainBody = stripHtml(article.content);
  const description = escapeAttr((article.lead || plainBody).slice(0, 200));
  const image = article.image_url && article.image_url.startsWith('http')
    ? escapeAttr(article.image_url)
    : '';
  const canonicalUrl = escapeAttr(url.toString());

  const metaTags = [
    `<meta property="og:type" content="article">`,
    `<meta property="og:site_name" content="La Taberna del Magallanes News">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta property="og:url" content="${canonicalUrl}">`,
    image ? `<meta property="og:image" content="${image}">` : '',
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">`,
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${description}">`,
    image ? `<meta name="twitter:image" content="${image}">` : ''
  ].filter(Boolean).join('\n');

  html = html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`)
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, `<meta name="description" content="${description}">\n${metaTags}`);

  const noscriptArticle = `
<noscript>
  <article style="max-width:800px;margin:2rem auto;padding:1.5rem;font-family:Georgia,serif;">
    <h1>${escapeAttr(article.title)}</h1>
    <p><strong>${escapeAttr(article.author || 'Lic. Luis Aponte')}</strong></p>
    ${article.lead ? `<p><em>${escapeAttr(article.lead)}</em></p>` : ''}
    <div>${article.content || ''}</div>
  </article>
</noscript>`;

  html = html.replace('</body>', `${noscriptArticle}\n</body>`);

  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/html; charset=utf-8');

  return new Response(html, {
    status: response.status,
    headers
  });
};

export const config = {
  path: ['/', '/index.html']
};
