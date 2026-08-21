(() => {
  const localize = (value) => window.filmscriptLanguage?.t?.(value) || value;
  document.title = `${localize('Project invitation')} | FilmScript`;
  const token = new URLSearchParams(location.search).get('invitation');
  const button = document.querySelector('[data-invitation-continue]');
  if (!token) { button.removeAttribute('href'); button.textContent = 'Invitation link unavailable'; return; }
  const returnTo = `/App.dc.html?invitation=${encodeURIComponent(token)}`;
  const resolve = (path) => window.filmscriptApiUrl ? window.filmscriptApiUrl(path) : path;
  fetch(resolve('/api/me'), { credentials:'include', cache:'no-store' }).then((response) => response.json()).then((account) => {
    if (account.authenticated) location.replace(returnTo);
  }).catch(() => {});
  button.href = resolve(`/auth/google?returnTo=${encodeURIComponent(returnTo)}`);
})();
