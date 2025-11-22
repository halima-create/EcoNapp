/* ===========================
   Simple "Data Layer" (localStorage)
   =========================== */
const LS_USERS = "dc_users";
const LS_NOTIFS = "dc_notifications";
const LS_SESSION = "dc_session"; // contact number of current user

function getUsers() {
  return JSON.parse(localStorage.getItem(LS_USERS) || "[]");
}
function saveUsers(users) {
  localStorage.setItem(LS_USERS, JSON.stringify(users));
}
function getUserByContact(contact) {
  return getUsers().find(u => u.contact === contact);
}
function upsertUser(user) {
  const users = getUsers();
  const idx = users.findIndex(u => u.contact === user.contact);
  if (idx >= 0) users[idx] = user; else users.push(user);
  saveUsers(users);
}
function setSession(contact) {
  localStorage.setItem(LS_SESSION, contact);
}
function getSession() {
  return localStorage.getItem(LS_SESSION);
}
function clearSession() {
  localStorage.removeItem(LS_SESSION);
}
function getNotifs() {
  return JSON.parse(localStorage.getItem(LS_NOTIFS) || "[]");
}
function addNotif(n) {
  const list = getNotifs();
  list.unshift(n);
  localStorage.setItem(LS_NOTIFS, JSON.stringify(list));
}
function clearNotifs() {
  localStorage.setItem(LS_NOTIFS, JSON.stringify([]));
}

/* ===========================
   Routing by page
   =========================== */
document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page || "";
  if (page === "index") initIndex();
  if (page === "awareness") initAwareness();
  if (page === "points") initPoints();
  if (page === "company") initCompany();
});

/* ===========================
   Page: index.html
   =========================== */
function initIndex() {
  const newForm = document.getElementById("newUserForm");
  const returnForm = document.getElementById("returnForm");

  // Returning user login
  returnForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const contact = (document.getElementById("returnContact").value || "").trim();
    const user = getUserByContact(contact);
    if (!user) {
      document.getElementById("returnError").textContent = "No account found for this contact number.";
      return;
    }
    setSession(contact);
    location.href = "awareness.html";
  });

  // New user signup
  newForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const address = document.getElementById("address").value.trim();
    const contact = document.getElementById("contact").value.trim();

    if (getUserByContact(contact)) {
      document.getElementById("newUserError").textContent = "An account with this contact already exists.";
      return;
    }

    const user = {
      name, email, password, address, contact,
      points: 0,
      pending: 0 // remainder diapers (<10) carried to next time
    };
    upsertUser(user);
    setSession(contact);
    location.href = "awareness.html";
  });
}

/* ===========================
   Page: awareness.html
   =========================== */
function initAwareness() {
  const contact = getSession();
  if (!contact) {
    // no session -> go to home
    location.href = "index.html";
    return;
  }

  const user = getUserByContact(contact);
  if (!user) {
    clearSession();
    location.href = "index.html";
    return;
  }

  // Welcome name
  document.getElementById("welcomeName").textContent = user.name || "Customer";

  // Logout
  document.getElementById("logoutBtn").addEventListener("click", () => {
    clearSession();
    location.href = "index.html";
  });

  // Modal elements
  const countModal = document.getElementById("countModal");
  const diaperInput = document.getElementById("diaperInput");
  const countOk = document.getElementById("countOk");
  const countCancel = document.getElementById("countCancel");

  const pointsModal = document.getElementById("pointsModal");
  const pointsMsg = document.getElementById("pointsMsg");
  const addMoreBtn = document.getElementById("addMoreBtn");
  const okBtn = document.getElementById("okBtn");

  // Notify flow
  document.getElementById("notifyBtn").addEventListener("click", () => {
    diaperInput.value = "";
    show(countModal);
    diaperInput.focus();
  });

  countCancel.addEventListener("click", () => hide(countModal));
  countOk.addEventListener("click", () => {
    const n = Number(diaperInput.value);
    if (!Number.isFinite(n) || n < 0) {
      alert("Please enter a valid non-negative number.");
      return;
    }
    hide(countModal);
    handleDiaperNotify(user, n, pointsModal, pointsMsg);
  });

  addMoreBtn.addEventListener("click", () => {
    hide(pointsModal);
    diaperInput.value = "";
    show(countModal);
    diaperInput.focus();
  });
  okBtn.addEventListener("click", () => hide(pointsModal));
}

/* Handle notify: add to pending, grant points per 10, notify company */
function handleDiaperNotify(user, addCount, pointsModal, pointsMsg) {
  const beforePending = user.pending || 0;
  let total = beforePending + addCount;

  let earned = 0;
  while (total >= 10) {
    total -= 10;
    earned += 5; // 5 points per 10 diapers
  }

  user.pending = total;
  if (!user.points) user.points = 0;
  user.points += earned;
  upsertUser(user);

  // Notify company (store a notification record)
  addNotif({
    ts: new Date().toISOString(),
    contact: user.contact,
    name: user.name,
    address: user.address,
    addedDiapers: addCount,
    earnedPoints: earned,
    pendingCarry: user.pending
  });

  // On-screen message
  const lines = [];
  if (earned > 0) lines.push(`You earned <strong>${earned} points</strong>!`);
  else lines.push(`No points yet.`);
  lines.push(`Current remainder (carry forward): <strong>${user.pending}</strong> diapers.`);
  pointsMsg.innerHTML = lines.join("<br>");
  show(pointsModal);
}

/* ===========================
   Page: points.html
   =========================== */
function initPoints() {
  const contact = getSession();
  if (!contact) { location.href = "index.html"; return; }
  const user = getUserByContact(contact);
  if (!user) { clearSession(); location.href = "index.html"; return; }

  document.getElementById("pointsValue").textContent = user.points || 0;
  document.getElementById("pendingValue").textContent = user.pending || 0;

  document.getElementById("logoutBtn").addEventListener("click", () => {
    clearSession();
    location.href = "index.html";
  });
}

/* ===========================
   Page: company.html
   =========================== */
function initCompany() {
  const list = document.getElementById("notifList");
  const empty = document.getElementById("notifEmpty");

  function render() {
    const data = getNotifs();
    list.innerHTML = "";
    if (!data.length) {
      empty.style.display = "block";
      return;
    }
    empty.style.display = "none";
    for (const n of data) {
      const item = document.createElement("div");
      item.className = "item";
      const when = new Date(n.ts).toLocaleString();
      item.innerHTML = `
        <div>
          <div><strong>${n.name}</strong> <span class="meta">(${n.contact})</span></div>
          <div class="meta">${n.address}</div>
          <div class="meta">Notified: <span class="badge">${n.addedDiapers} diapers</span>
            &nbsp; Earned: <span class="badge">${n.earnedPoints} points</span>
            &nbsp; Carry: <span class="badge">${n.pendingCarry}</span>
          </div>
        </div>
        <div class="meta">${when}</div>
      `;
      list.appendChild(item);
    }
  }

  document.getElementById("clearNotifs").addEventListener("click", () => {
    if (confirm("Clear all notifications?")) {
      clearNotifs();
      render();
    }
  });

  render();
}

/* ===========================
   UI helpers
   =========================== */
function show(el){ el.classList.add("show"); el.classList.remove("hidden"); }
function hide(el){ el.classList.remove("show"); el.classList.add("hidden"); }
