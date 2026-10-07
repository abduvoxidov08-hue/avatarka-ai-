const msgs = {
  bekor: 'Kirish bekor qilindi.',
  holat: 'Kirish seansi eskirgan. Qaytadan urinib ko\'ring.',
  server: 'Server xatosi. Server logiga qarang va qayta urinib ko\'ring.',
};
const k = new URLSearchParams(location.search).get('xato');
if (k) document.getElementById('err').textContent = msgs[k] || 'Xatolik.';
