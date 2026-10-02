// Har kuni 09:00 va 21:00 Toshkent vaqti (UTC+5) = 04:00 va 16:00 UTC.
// Scheduled Function 30 soniya bilan cheklangan, shuning uchun ishni background function'ga topshiradi.
export default async (req) => {
  const base = process.env.URL || process.env.DEPLOY_URL;
  if (!base || !process.env.ADMIN_PASSWORD) {
    console.error("URL yoki ADMIN_PASSWORD yo'q - post ishga tushirilmadi");
    return;
  }
  const res = await fetch(`${base}/.netlify/functions/post-background?source=scheduled`, {
    method: "POST",
    headers: { "x-admin-password": process.env.ADMIN_PASSWORD },
  });
  console.log(`post-background chaqirildi: HTTP ${res.status}`);
};

export const config = { schedule: "0 4,16 * * *" };
