// Telegram WebApp Initialization
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

// API Base URL configuration:
let API_BASE_URL = localStorage.getItem("API_BACKEND_URL");
if (!API_BASE_URL) {
  if (window.location.hostname.includes("netlify.app")) {
    API_BASE_URL = "http://localhost:8000";
  } else {
    API_BASE_URL = window.location.origin;
  }
}

// Elements
const candidatesList = document.getElementById("candidatesList");
const emptyState = document.getElementById("emptyState");
const loadingIndicator = document.getElementById("loadingIndicator");
const badgeCount = document.getElementById("badgeCount");
const refreshBtn = document.getElementById("refreshBtn");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const triggerAutoBtn = document.getElementById("triggerAutoBtn");

// Modal Elements
const captionModal = document.getElementById("captionModal");
const modalCaptionText = document.getElementById("modalCaptionText");
const saveCaptionBtn = document.getElementById("saveCaptionBtn");
const cancelModalBtn = document.getElementById("cancelModalBtn");
const closeModalBtn = document.getElementById("closeModalBtn");

let currentEditingAlbumId = null;
let currentCategory = "all";

// Haptic helper
function haptic(type = "light") {
  if (tg?.HapticFeedback) {
    if (type === "success") tg.HapticFeedback.notificationOccurred("success");
    else if (type === "error") tg.HapticFeedback.notificationOccurred("error");
    else tg.HapticFeedback.impactOccurred(type);
  }
}

// Toast notification
function showToast(text, isError = false) {
  const toast = document.getElementById("toast");
  const toastIcon = document.getElementById("toastIcon");
  const toastText = document.getElementById("toastText");

  toastIcon.textContent = isError ? "❌" : "✅";
  toastText.textContent = text;
  toast.className = `fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl ${isError ? 'bg-rose-900/90 border-rose-700' : 'bg-slate-800/95 border-slate-700'} text-white text-xs font-medium shadow-2xl backdrop-blur-md opacity-100 transition-all duration-300 flex items-center space-x-2`;

  setTimeout(() => {
    toast.classList.replace("opacity-100", "opacity-0");
  }, 2500);
}

// Category Pills Handler
document.querySelectorAll(".cat-pill").forEach(pill => {
  pill.addEventListener("click", async () => {
    haptic("light");
    document.querySelectorAll(".cat-pill").forEach(p => {
      p.className = "cat-pill px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-600 transition-all";
    });
    pill.className = "cat-pill active px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap bg-sky-500 text-white shadow-md shadow-sky-500/25 transition-all";
    
    currentCategory = pill.dataset.cat;
    await loadCandidatesAndGenerateIfNeeded(currentCategory);
  });
});

// Load Candidates from Backend
async function loadCandidates(cat = currentCategory) {
  loadingIndicator.classList.remove("hidden");
  candidatesList.innerHTML = "";
  emptyState.classList.add("hidden");

  try {
    const res = await fetch(`${API_BASE_URL}/api/candidates?status=pending&category=${cat}`);
    if (!res.ok) throw new Error("Yuklab bo'lmadi");
    const data = await res.json();
    const candidates = data.candidates || [];

    badgeCount.textContent = `${candidates.length} ta kutilmoqda`;

    if (candidates.length === 0) {
      emptyState.classList.remove("hidden");
      return 0;
    } else {
      candidates.forEach(album => renderAlbumCard(album));
      return candidates.length;
    }
  } catch (err) {
    console.error(err);
    showToast("Server bilan bog'lanishda xatolik", true);
    emptyState.classList.remove("hidden");
    return 0;
  } finally {
    loadingIndicator.classList.add("hidden");
  }
}

// If user selects a category and it has no candidates, instantly auto-generate 10 photos for that category!
async function loadCandidatesAndGenerateIfNeeded(cat) {
  const count = await loadCandidates(cat);
  if (count === 0 && cat !== "all") {
    showToast("To'plam tayyorlanmoqda...", false);
    try {
      await fetch(`${API_BASE_URL}/api/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: cat, query: "", media_type: cat === "videos" ? "video" : "photo" })
      });
      await loadCandidates(cat);
    } catch (e) {
      console.error(e);
    }
  }
}

// Render Album Card with Compact 10-Photo 5x2 Grid Gallery
function renderAlbumCard(album) {
  const card = document.createElement("div");
  card.id = `album-${album.id}`;
  card.className = "bg-slate-900 border border-slate-800/80 rounded-3xl p-4 shadow-xl space-y-3 transition-all";

  const count = album.media_urls.length;
  let mediaHtml = "";

  if (album.media_type === "video") {
    mediaHtml = `
      <div class="relative rounded-2xl overflow-hidden bg-black max-h-[300px] flex items-center justify-center border border-slate-800">
        <video src="${album.media_urls[0]}" controls class="w-full max-h-[300px] object-contain rounded-2xl" preload="metadata"></video>
      </div>
    `;
  } else {
    // Compact 10-Photo 5x2 Grid
    mediaHtml = `<div class="album-compact-grid">`;
    album.media_urls.forEach((url, idx) => {
      mediaHtml += `
        <div class="grid-photo-item" title="Kattalashtirish (Rasm ${idx + 1})" onclick="window.open('${url}', '_blank')">
          <img src="${url}" alt="photo ${idx + 1}" loading="lazy">
        </div>
      `;
    });
    mediaHtml += `</div>`;
  }

  card.innerHTML = `
    <!-- Card Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center space-x-2">
        <span class="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 uppercase tracking-wider">
          ${album.category}
        </span>
        <span class="text-[11px] text-slate-400 font-medium">
          ${album.media_type === 'video' ? '🎬 Video' : `📸 ${count} ta sara rasm`}
        </span>
      </div>
      <button class="edit-btn text-xs text-sky-400 hover:text-sky-300 font-semibold flex items-center space-x-1" data-id="${album.id}">
        <span>✏️ Tahrirlash</span>
      </button>
    </div>

    <!-- Media Showcase (Compact Grid) -->
    ${mediaHtml}

    <!-- Caption / Status Section -->
    <div class="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3.5 space-y-2">
      <div class="flex items-center justify-between">
        <h4 class="text-xs font-bold text-white tracking-wide">${album.title}</h4>
        <span class="text-[10px] text-sky-400 font-medium">✨ Gemini AI Status</span>
      </div>
      <p id="caption-text-${album.id}" class="text-xs text-slate-300 whitespace-pre-line leading-relaxed font-normal">
        ${escapeHtml(album.caption)}
      </p>
    </div>

    <!-- Actions Buttons -->
    <div class="grid grid-cols-2 gap-2 pt-1">
      <button class="reject-btn py-2.5 px-3 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-semibold text-xs transition-all active:scale-95 flex items-center justify-center space-x-1.5" data-id="${album.id}">
        <span>❌ Rad etish</span>
      </button>
      <button class="approve-btn py-2.5 px-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 text-white font-semibold text-xs shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center justify-center space-x-1.5" data-id="${album.id}">
        <span>✅ Kanalga joylash</span>
      </button>
    </div>
  `;

  // Attach action handlers
  card.querySelector(".approve-btn").addEventListener("click", () => handleApprove(album.id));
  card.querySelector(".reject-btn").addEventListener("click", () => handleReject(album.id));
  card.querySelector(".edit-btn").addEventListener("click", () => openEditModal(album.id, album.caption));

  candidatesList.appendChild(card);
}

// Approve & Publish
async function handleApprove(albumId) {
  haptic("medium");
  const card = document.getElementById(`album-${albumId}`);
  const btn = card?.querySelector(".approve-btn");
  if (btn) btn.innerHTML = `<span>⏳ Joylanmoqda...</span>`;

  try {
    const res = await fetch(`${API_BASE_URL}/api/approve/${albumId}`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Xatolik yuz berdi");

    haptic("success");
    showToast("10 talik to'plam kanalga muvaffaqiyatli joylandi! ✨");
    card.remove();
    updateBadgeAfterAction();
  } catch (err) {
    haptic("error");
    showToast(err.message, true);
    if (btn) btn.innerHTML = `<span>✅ Kanalga joylash</span>`;
  }
}

// Reject
async function handleReject(albumId) {
  haptic("light");
  const card = document.getElementById(`album-${albumId}`);
  try {
    await fetch(`${API_BASE_URL}/api/reject/${albumId}`, { method: "POST" });
    showToast("To'plam rad etildi");
    card.remove();
    updateBadgeAfterAction();
  } catch (err) {
    showToast("Xatolik yuz berdi", true);
  }
}

function updateBadgeAfterAction() {
  const remaining = candidatesList.children.length;
  badgeCount.textContent = `${remaining} ta kutilmoqda`;
  if (remaining === 0) {
    emptyState.classList.remove("hidden");
  }
}

// Modal Handlers
function openEditModal(albumId, currentCaption) {
  haptic("light");
  currentEditingAlbumId = albumId;
  modalCaptionText.value = currentCaption;
  captionModal.classList.remove("hidden");
}

function closeEditModal() {
  captionModal.classList.add("hidden");
  currentEditingAlbumId = null;
}

saveCaptionBtn.addEventListener("click", async () => {
  if (!currentEditingAlbumId) return;
  const newCaption = modalCaptionText.value.trim();
  try {
    const res = await fetch(`${API_BASE_URL}/api/caption/${currentEditingAlbumId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caption: newCaption })
    });
    if (!res.ok) throw new Error("Saqlab bo'lmadi");

    const capEl = document.getElementById(`caption-text-${currentEditingAlbumId}`);
    if (capEl) capEl.textContent = newCaption;

    haptic("success");
    showToast("Matn yangilandi!");
    closeEditModal();
  } catch (err) {
    showToast("Xatolik: saqlanmadi", true);
  }
});

closeModalBtn.addEventListener("click", closeEditModal);
cancelModalBtn.addEventListener("click", closeEditModal);

// Instant Search Handler
async function handleSearch() {
  const query = searchInput.value.trim();
  if (!query) {
    showToast("Iltimos, mavzu yoki mashina nomini yozing!", true);
    return;
  }

  haptic("medium");
  searchBtn.disabled = true;
  searchBtn.innerHTML = `<span>⏳ 10 ta rasm qidirilmoqda...</span>`;

  try {
    const res = await fetch(`${API_BASE_URL}/api/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: currentCategory === "all" ? "cars" : currentCategory,
        query: query,
        media_type: currentCategory === "videos" ? "video" : "photo"
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Topilmadi");

    haptic("success");
    showToast(`'${query}' bo'yicha 10 ta sara rasm tayyorlandi! ✨`);
    searchInput.value = "";
    loadCandidates();
  } catch (err) {
    haptic("error");
    showToast(err.message, true);
  } finally {
    searchBtn.disabled = false;
    searchBtn.innerHTML = `<span>AI Qidirish</span>`;
  }
}

searchBtn.addEventListener("click", handleSearch);
searchInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") handleSearch();
});

refreshBtn.addEventListener("click", () => {
  haptic("light");
  loadCandidates();
});

triggerAutoBtn.addEventListener("click", async () => {
  haptic("medium");
  triggerAutoBtn.disabled = true;
  triggerAutoBtn.textContent = "⏳ 10 ta sara rasm tayyorlanmoqda...";
  try {
    await fetch(`${API_BASE_URL}/api/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "avatars_boys", query: "" })
    });
    showToast("Yangi to'plam qo'shildi!");
    loadCandidates();
  } catch (err) {
    showToast("Xatolik yuz berdi", true);
  } finally {
    triggerAutoBtn.disabled = false;
    triggerAutoBtn.textContent = "⚡️ Yangi to'plamlar yig'ish (AI)";
  }
});

// Settings Modal Handlers
const settingsBtn = document.getElementById("settingsBtn");
const settingsModal = document.getElementById("settingsModal");
const settingsBackendUrlInput = document.getElementById("settingsBackendUrlInput");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const cancelSettingsModalBtn = document.getElementById("cancelSettingsModalBtn");
const closeSettingsModalBtn = document.getElementById("closeSettingsModalBtn");

if (settingsBtn) {
  settingsBtn.addEventListener("click", () => {
    haptic("light");
    settingsBackendUrlInput.value = API_BASE_URL;
    settingsModal.classList.remove("hidden");
  });
}

function closeSettingsModal() {
  settingsModal.classList.add("hidden");
}

if (closeSettingsModalBtn) closeSettingsModalBtn.addEventListener("click", closeSettingsModal);
if (cancelSettingsModalBtn) cancelSettingsModalBtn.addEventListener("click", closeSettingsModal);

if (saveSettingsBtn) {
  saveSettingsBtn.addEventListener("click", () => {
    let val = settingsBackendUrlInput.value.trim().replace(/\/$/, "");
    if (!val) val = "http://localhost:8000";
    API_BASE_URL = val;
    localStorage.setItem("API_BACKEND_URL", val);
    haptic("success");
    showToast("Server manzili saqlandi!");
    closeSettingsModal();
    loadCandidates();
  });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.innerText = text;
  return div.innerHTML;
}

// Initial load
loadCandidates();
