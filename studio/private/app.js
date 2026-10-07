const H = { 'X-Requested-With': 'office' };

async function init() {
  const r = await fetch('/api/me');
  if (!r.ok) return (location.href = '/login.html');
  const me = await r.json();
  document.getElementById('name').textContent = me.name || me.email;
  if (me.picture) {
    const img = document.getElementById('avatar');
    img.src = me.picture;
    img.hidden = false;
  }
  if (me.yetishmayotganRuxsatlar.length) {
    const w = document.getElementById('warn');
    w.hidden = false;
    w.textContent = `Diqqat: ${me.yetishmayotganRuxsatlar.length} ta ruxsat berilmagan. Chiqib, qayta kiring va barcha katakchalarni belgilang.`;
  }
}

document.getElementById('logout').onclick = async () => {
  await fetch('/auth/logout', { method: 'POST', headers: H });
  location.href = '/login.html';
};
document.getElementById('revoke').onclick = async () => {
  if (!confirm('Google ruxsatlari bekor qilinadi va chiqib ketasiz. Davom etasizmi?')) return;
  await fetch('/auth/revoke', { method: 'POST', headers: H });
  location.href = '/login.html';
};
init();
