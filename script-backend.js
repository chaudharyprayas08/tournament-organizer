
/*
 * Tournament frontend
 * Backend-connected version
 *
 * The browser no longer connects directly to Firebase.
 * All authentication and tournament mutations go through the Node/Express API.
 */

const API_BASE = window.TOURNAMENT_API_BASE || "https://tournamentbackend-git-main-mohitpanwaro9s-projects.vercel.app/api" ||"https://localhost:3000/api";

const POOL_A = ["Affan", "Harendra", "Tajamul", "Kushagra", "Harsh"];
const POOL_B = ["Mohit", "Anand", "Mayuresh", "Amitesh", "Fadil", "Prayas"];

// ===== AUTH / API =====
let authToken = sessionStorage.getItem("tournamentAdminToken") || "";
let isAdmin = Boolean(authToken);
let state = { A: {}, B: {}, QA: {}, QB: {}, KO: {} };

async function api(path, options = {}) {
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {})
  };

  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  let data = {};
  try {
    data = await response.json();
  } catch (_) {}

  if (!response.ok) {
    const err = new Error(data.error || `Request failed (${response.status})`);
    err.status = response.status;
    throw err;
  }

  return data;
}

function setSync(cls, txt) {
  const e = document.getElementById("syncStatus");
  if (!e) return;
  e.className = cls;
  e.textContent = txt;
}

function updateAdminBadge() {
  const badge = document.getElementById("adminStatus");
  const btn = document.getElementById("loginBtn");

  if (isAdmin) {
    badge.className = "admin";
    badge.textContent = "🔓 Admin mode";
    btn.className = "btn-logout";
    btn.textContent = "🚪 Logout";
  } else {
    badge.className = "viewer";
    badge.textContent = "👁️ Viewer mode";
    btn.className = "btn-login";
    btn.textContent = "🔒 Admin Login";
  }

  const resetBtn = document.getElementById("resetBtn");
  if (resetBtn) resetBtn.style.display = isAdmin ? "inline-block" : "none";
}

function toggleAdmin() {
  if (isAdmin) {
    if (confirm("Logout from admin?")) {
      authToken = "";
      isAdmin = false;
      sessionStorage.removeItem("tournamentAdminToken");
      updateAdminBadge();
      rerenderAll();
    }
  } else {
    openModal();
  }
}

function openModal() {
  document.getElementById("loginModal").classList.remove("hidden");
  document.getElementById("pwdInput").value = "";
  document.getElementById("loginErr").textContent = "";
  setTimeout(() => document.getElementById("pwdInput").focus(), 50);
}

function closeModal() {
  document.getElementById("loginModal").classList.add("hidden");
}

async function submitLogin() {
  const pwd = document.getElementById("pwdInput").value.trim();

  if (!pwd) {
    document.getElementById("loginErr").textContent = "Enter a password.";
    return;
  }

  try {
    setSync("syncing", "🟡 Signing in…");

    const data = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ password: pwd })
    });

    authToken = data.token;
    isAdmin = true;
    sessionStorage.setItem("tournamentAdminToken", authToken);

    closeModal();
    updateAdminBadge();
    setSync("live", "🟢 Connected");
    await loadTournament();
  } catch (err) {
    document.getElementById("loginErr").textContent =
      err.message || "❌ Wrong password. Try again.";
    document.getElementById("pwdInput").select();
    setSync("offline", "🔴 Login failed");
  }
}

document.addEventListener("keydown", (e) => {
  const modal = document.getElementById("loginModal");
  if (!modal || modal.classList.contains("hidden")) return;

  if (e.key === "Enter") submitLogin();
  if (e.key === "Escape") closeModal();
});

// ===== BACKEND DATA =====
async function loadTournament() {
  try {
    setSync("syncing", "🟡 Loading…");

    const data = await api("/tournament");
    state = data.state || { A: {}, B: {}, QA: {}, QB: {}, KO: {} };

    setSync("live", "🟢 Live · Backend sync");
    rerenderAll();
  } catch (err) {
    console.error(err);
    setSync("offline", "🔴 Connection error");
    rerenderAll();
  }
}

async function savePoolMatch(sk, key, s1, s2) {
  if (!isAdmin) return;

  setSync("syncing", "🟡 Saving…");

  const method = state[sk]?.[key]?.done ? "PATCH" : "POST";

  try {
    const data = await api(`/tournament/matches/${sk}/${key}`, {
      method,
      body: JSON.stringify({ s1, s2 })
    });

    state = data.state || state;
    setSync("live", "🟢 Live · Backend sync");
    rerenderAll();
  } catch (err) {
    console.error(err);
    setSync("offline", "🔴 Save failed");
    alert(err.message || "Save failed.");
    await loadTournament();
  }
}

async function saveKOMatch(key, s1, s2) {
  if (!isAdmin) return;

  setSync("syncing", "🟡 Saving…");

  const method = state.KO?.[key]?.done ? "PATCH" : "POST";

  try {
    const data = await api(`/tournament/knockout/${key}`, {
      method,
      body: JSON.stringify({ s1, s2 })
    });

    state = data.state || state;
    setSync("live", "🟢 Live · Backend sync");
    rerenderAll();
  } catch (err) {
    console.error(err);
    setSync("offline", "🔴 Save failed");
    alert(err.message || "Save failed.");
    await loadTournament();
  }
}

// ===== TABS =====
document.querySelectorAll(".tab").forEach((t) =>
  t.addEventListener("click", () => {
    document
      .querySelectorAll(".tab")
      .forEach((x) => x.classList.remove("active"));

    document
      .querySelectorAll(".tab-panel")
      .forEach((x) => x.classList.add("hidden"));

    t.classList.add("active");
    document.getElementById(t.dataset.tab).classList.remove("hidden");

    if (t.dataset.tab === "wild") renderWild();
    if (t.dataset.tab === "qfPools") renderQF();
    if (t.dataset.tab === "knockout") renderKO();
  })
);

// ===== SCHEDULER =====
function roundRobin(players) {
  const arr = [...players];

  if (arr.length % 2 === 1) arr.push(null);

  const n = arr.length;
  const rounds = [];

  for (let r = 0; r < n - 1; r++) {
    const round = [];

    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];

      if (a && b) round.push([a, b]);
    }

    rounds.push(round);
    arr.splice(1, 0, arr.pop());
  }

  return rounds;
}

function schedule(players) {
  const rounds = roundRobin(players);
  const fixtures = [];

  rounds.forEach((rd, ri) =>
    rd.forEach((pair) => fixtures.push({ pair, round: ri + 1 }))
  );

  return { rounds, fixtures };
}

const SCHED_A = schedule(POOL_A);
const SCHED_B = schedule(POOL_B);

// ===== FIXTURES =====
function renderFixtures(sk, fixtures, cid, pfx) {
  const c = document.getElementById(cid);
  if (!c) return;

  c.innerHTML = "";
  let curRound = 0;

  fixtures.forEach((fx, idx) => {
    if (fx.round !== curRound) {
      curRound = fx.round;

      const h = document.createElement("div");
      h.className = "round-hdr";
      h.textContent = `Round ${curRound}`;
      c.appendChild(h);
    }

    const key = `m${idx}`;
    const pair = fx.pair;
    const st = state[sk]?.[key] || { s1: "", s2: "", done: false };

    const w1 = st.done && +st.s1 > +st.s2;
    const w2 = st.done && +st.s2 > +st.s1;

    const row = document.createElement("div");
    row.className =
      (st.done ? "played " : "") +
      (isAdmin ? "match-admin" : "match-viewer");

    if (isAdmin) {
      row.innerHTML = `
        <div class="p1 ${w1 ? "won" : ""}">${pair[0]}</div>
        <input type="number" min="0" value="${st.s1}" ${
          st.done ? "disabled" : ""
        } id="${pfx}-${key}-s1">
        <div class="vs">vs</div>
        <input type="number" min="0" value="${st.s2}" ${
          st.done ? "disabled" : ""
        } id="${pfx}-${key}-s2">
        <div class="p2 ${w2 ? "won" : ""}">${pair[1]}</div>
        <button class="btn btn-update" onclick="updateMatch('${sk}','${key}','${pfx}')">
          ${st.done ? "Edit" : "Save"}
        </button>`;
    } else {
      const sc1 = st.done
        ? `<div class="score-display">${st.s1}</div>`
        : `<div class="score-pending">—</div>`;

      const sc2 = st.done
        ? `<div class="score-display">${st.s2}</div>`
        : `<div class="score-pending">—</div>`;

      row.innerHTML = `
        <div class="p1 ${w1 ? "won" : ""}">${pair[0]}</div>
        ${sc1}
        <div class="vs">vs</div>
        ${sc2}
        <div class="p2 ${w2 ? "won" : ""}">${pair[1]}</div>`;
    }

    c.appendChild(row);
  });
}

async function updateMatch(sk, key, pfx) {
  if (!isAdmin) return;

  const st = state[sk]?.[key] || {};

  if (st.done) {
    // The original UI uses "Edit" to unlock the existing score.
    // We keep that behavior locally, then the next Save sends PATCH.
    st.done = false;
    state[sk][key] = st;
    rerenderAll();
    return;
  }

  const s1 = document.getElementById(`${pfx}-${key}-s1`).value;
  const s2 = document.getElementById(`${pfx}-${key}-s2`).value;

  if (s1 === "" || s2 === "" || +s1 === +s2) {
    alert("Enter valid scores (no ties).");
    return;
  }

  await savePoolMatch(sk, key, +s1, +s2);
}

// ===== STANDINGS =====
function standings(players, matches) {
  const s = {};

  players.forEach((p) => {
    s[p] = {
      name: p,
      P: 0,
      W: 0,
      L: 0,
      PF: 0,
      PA: 0,
      Pts: 0,
      NRR: 0,
      PR: 0
    };
  });

  Object.values(matches || {}).forEach((m) => {
    if (!m.done) return;

    const [a, b] = m.pair;
    if (!s[a] || !s[b]) return;

    s[a].P++;
    s[b].P++;
    s[a].PF += m.s1;
    s[a].PA += m.s2;
    s[b].PF += m.s2;
    s[b].PA += m.s1;

    if (m.s1 > m.s2) {
      s[a].W++;
      s[a].Pts += 2;
      s[b].L++;
    } else {
      s[b].W++;
      s[b].Pts += 2;
      s[a].L++;
    }
  });

  Object.values(s).forEach((r) => {
    r.NRR = r.P > 0 ? (r.PF - r.PA) / r.P : 0;
    r.PR = r.PA > 0 ? r.PF / r.PA : r.PF > 0 ? 99 : 0;
  });

  return Object.values(s).sort(
    (x, y) =>
      y.Pts - x.Pts ||
      y.NRR - x.NRR ||
      y.PR - x.PR ||
      y.PF - x.PF
  );
}

function renderTable(sk, players, tid, qn) {
  const rows = standings(players, state[sk] || {});
  const cls = qn === 2 ? "qual2" : "qual3";

  document.getElementById(tid).innerHTML = `
    <thead><tr><th>#</th><th style="text-align:left">Player</th>
    <th>P</th><th>W</th><th>L</th><th>PF</th><th>PA</th>
    <th>NRR</th><th>PR</th><th>Pts</th></tr></thead>
    <tbody>${rows
      .map(
        (r, i) => `
      <tr class="${i < qn ? cls : ""}">
        <td>${i + 1}</td><td class="name">${r.name}</td>
        <td>${r.P}</td><td>${r.W}</td><td>${r.L}</td>
        <td>${r.PF}</td><td>${r.PA}</td>
        <td>${r.P === 0 ? "—" : r.NRR.toFixed(2)}</td>
        <td>${r.P === 0 ? "—" : r.PA === 0 && r.PF > 0 ? "∞" : r.PR.toFixed(2)}</td>
        <td><b>${r.Pts}</b></td>
      </tr>`
      )
      .join("")}</tbody>`;
}

// ===== STAGE HELPERS =====
function done(sk, fixtures) {
  return fixtures.every((_, i) => state[sk]?.[`m${i}`]?.done);
}

function poolsDone() {
  return done("A", SCHED_A.fixtures) && done("B", SCHED_B.fixtures);
}

// ===== WILDCARDS =====
function wildRanking() {
  const sA = standings(POOL_A, state.A);
  const sB = standings(POOL_B, state.B);

  return [...sA.slice(3), ...sB.slice(3)].sort(
    (x, y) =>
      y.Pts - x.Pts ||
      y.NRR - x.NRR ||
      y.PR - x.PR ||
      y.PF - x.PF
  );
}

function renderWild() {
  const c = document.getElementById("wildStatus");
  if (!c) return;

  if (!poolsDone()) {
    c.innerHTML = `<p class="empty">Complete both pool stages first.</p>`;
    return;
  }

  const rk = wildRanking();
  const sA = standings(POOL_A, state.A);
  const sB = standings(POOL_B, state.B);

  const src = {};
  sA.forEach((r, i) => (src[r.name] = `A${i + 1}`));
  sB.forEach((r, i) => (src[r.name] = `B${i + 1}`));

  c.innerHTML = `<table>
    <thead><tr><th>#</th><th style="text-align:left">Player</th><th>From</th>
    <th>P</th><th>W</th><th>L</th><th>PF</th><th>PA</th>
    <th>NRR</th><th>PR</th><th>Pts</th></tr></thead>
    <tbody>${rk
      .map(
        (r, i) => `
      <tr class="${i < 2 ? "wild" : ""}">
        <td>${i + 1}</td><td class="name">${r.name}</td>
        <td><span class="badge">${src[r.name]}</span></td>
        <td>${r.P}</td><td>${r.W}</td><td>${r.L}</td>
        <td>${r.PF}</td><td>${r.PA}</td>
        <td>${r.P === 0 ? "—" : r.NRR.toFixed(2)}</td>
        <td>${r.P === 0 ? "—" : r.PA === 0 && r.PF > 0 ? "∞" : r.PR.toFixed(2)}</td>
        <td><b>${r.Pts}</b></td>
      </tr>`
      )
      .join("")}</tbody></table>
    <p class="stage-note" style="margin-top:10px">
      Top 2 (purple) get the last 2 QF Pool spots.
    </p>`;
}

// ===== QF POOLS =====
function qfPools() {
  const sA = standings(POOL_A, state.A);
  const sB = standings(POOL_B, state.B);
  const wc = wildRanking();

  const seeds = [
    sA[0].name,
    sB[0].name,
    sA[1].name,
    sB[1].name,
    sA[2].name,
    sB[2].name,
    wc[0].name,
    wc[1].name
  ];

  return {
    seeds,
    QA: [seeds[0], seeds[3], seeds[4], seeds[7]],
    QB: [seeds[1], seeds[2], seeds[5], seeds[6]]
  };
}

function renderQF() {
  const c = document.getElementById("qfStatus");
  if (!c) return;

  if (!poolsDone()) {
    c.innerHTML = `<p class="empty">Complete Pool A &amp; Pool B first.</p>`;
    return;
  }

  const { seeds, QA, QB } = qfPools();
  const sqa = schedule(QA);
  const sqb = schedule(QB);

  window._qaSch = sqa;
  window._qbSch = sqb;

  c.innerHTML = `
    <div style="font-size:12px;color:var(--muted);margin-bottom:12px">
      <b style="color:var(--gold)">Seedings:</b>
      ${seeds
        .map(
          (n, i) =>
            `<span style="margin-right:10px">#${i + 1} ${n}${
              i >= 6
                ? ' <span style="color:var(--purple)">(WC)</span>'
                : ""
            }</span>`
        )
        .join("")}
    </div>
    <div class="two-col">
      <div>
        <h3>QF Pool 1 <span class="badge">seeds 1,4,5,8</span></h3>
        <table id="tableQA"></table>
        <h3 style="margin-top:12px">Schedule</h3><div id="fixturesQA"></div>
      </div>
      <div>
        <h3>QF Pool 2 <span class="badge">seeds 2,3,6,7</span></h3>
        <table id="tableQB"></table>
        <h3 style="margin-top:12px">Schedule</h3><div id="fixturesQB"></div>
      </div>
    </div>
    <p class="stage-note" style="margin-top:12px">
      Top 2 from each pool → Semis.
    </p>`;

  renderFixtures("QA", sqa.fixtures, "fixturesQA", "QA");
  renderFixtures("QB", sqb.fixtures, "fixturesQB", "QB");
  renderTable("QA", QA, "tableQA", 2);
  renderTable("QB", QB, "tableQB", 2);
}

// ===== SEMIS & FINAL =====
function renderKO() {
  const c = document.getElementById("koStatus");
  if (!c) return;

  if (!poolsDone()) {
    c.innerHTML = `<p class="empty">Complete Pool A &amp; Pool B first.</p>`;
    return;
  }

  const { QA, QB } = qfPools();
  const sqa = schedule(QA);
  const sqb = schedule(QB);

  window._qaSch = sqa;
  window._qbSch = sqb;

  if (!done("QA", sqa.fixtures) || !done("QB", sqb.fixtures)) {
    c.innerHTML = `<p class="empty">Complete both QF Pools first.</p>`;
    return;
  }

  const sQA = standings(QA, state.QA);
  const sQB = standings(QB, state.QB);

  const ss = [sQA[0].name, sQB[0].name, sQA[1].name, sQB[1].name];

  c.innerHTML = `
    <h3>Semifinalists</h3>
    <div style="font-size:12px;color:var(--muted);margin-bottom:12px">
      ${ss
        .map(
          (n, i) =>
            `<span style="margin-right:10px">
              <b style="color:var(--gold)">S${i + 1}</b> ${n}
            </span>`
        )
        .join("")}
    </div>
    <div class="bracket" id="semiBracket"></div>
    <div id="finalWrap"></div>`;

  const sb = document.getElementById("semiBracket");

  const semis = [
    {
      key: "q1",
      label: "Qualifier 1 — S1 vs S2",
      pair: [ss[0], ss[1]]
    },
    {
      key: "elim",
      label: "Eliminator — S3 vs S4",
      pair: [ss[2], ss[3]]
    }
  ];

  semis.forEach((m) => sb.appendChild(koCard(m.key, m.label, m.pair)));

  if (!(state.KO.q1?.done && state.KO.elim?.done)) return;

  const q1 = state.KO.q1;
  const el = state.KO.elim;

  const q1w = q1.s1 > q1.s2 ? semis[0].pair[0] : semis[0].pair[1];
  const q1l = q1.s1 > q1.s2 ? semis[0].pair[1] : semis[0].pair[0];
  const elw = el.s1 > el.s2 ? semis[1].pair[0] : semis[1].pair[1];

  const q2p = [q1l, elw];

  sb.appendChild(
    koCard("q2", "Qualifier 2 — Q1 loser vs Elim winner", q2p)
  );

  if (!state.KO.q2?.done) return;

  const q2 = state.KO.q2;
  const q2w = q2.s1 > q2.s2 ? q2p[0] : q2p[1];
  const fp = [q1w, q2w];

  const fw = document.getElementById("finalWrap");

  fw.innerHTML = `
    <h3 style="margin-top:20px">🏆 Grand Final</h3>
    <div id="finalCard" style="max-width:320px;margin:0 auto"></div>`;

  document
    .getElementById("finalCard")
    .appendChild(koCard("final", "Final", fp, true));

  if (state.KO.final?.done) {
    const f = state.KO.final;

    fw.innerHTML += `
      <div class="champion">
        🏆 CHAMPION: ${f.s1 > f.s2 ? fp[0] : fp[1]}
      </div>`;
  }
}

function koCard(key, label, pair, gold = false) {
  const st = state.KO?.[key] || {
    s1: "",
    s2: "",
    done: false
  };

  const w1 = st.done && +st.s1 > +st.s2;
  const w2 = st.done && +st.s2 > +st.s1;

  const div = document.createElement("div");
  div.className = "ko-match";

  let s1el;
  let s2el;
  let btnEl = "";

  if (isAdmin) {
    s1el = `
      <input type="number" min="0" value="${st.s1}" ${
        st.done ? "disabled" : ""
      } id="KO-${key}-s1">`;

    s2el = `
      <input type="number" min="0" value="${st.s2}" ${
        st.done ? "disabled" : ""
      } id="KO-${key}-s2">`;

    btnEl = `
      <button class="btn btn-update"
        onclick="updateKO('${key}')">
        ${st.done ? "Edit" : "Save"}
      </button>`;
  } else {
    s1el = st.done
      ? `<div class="ko-score">${st.s1}</div>`
      : `<div class="ko-score-pending">—</div>`;

    s2el = st.done
      ? `<div class="ko-score">${st.s2}</div>`
      : `<div class="ko-score-pending">—</div>`;
  }

  div.innerHTML = `
    <div class="label" ${
      gold ? 'style="color:var(--gold)"' : ""
    }>${label}</div>
    <div class="ko-row">
      <span class="${w1 ? "won" : ""}">${pair[0]}</span>${s1el}
    </div>
    <div class="ko-row">
      <span class="${w2 ? "won" : ""}">${pair[1]}</span>${s2el}
    </div>
    ${btnEl}`;

  return div;
}

async function updateKO(key) {
  if (!isAdmin) return;

  const st = state.KO?.[key] || {};

  if (st.done) {
    st.done = false;
    state.KO[key] = st;
    renderKO();
    return;
  }

  const s1 = document.getElementById(`KO-${key}-s1`).value;
  const s2 = document.getElementById(`KO-${key}-s2`).value;

  if (s1 === "" || s2 === "" || +s1 === +s2) {
    alert("Enter valid scores.");
    return;
  }

  await saveKOMatch(key, +s1, +s2);
}

// ===== RESET =====
async function resetAll() {
  if (!isAdmin) {
    alert("Admin login required.");
    return;
  }

  if (!confirm("Reset ALL scores for everyone?")) return;

  try {
    setSync("syncing", "🟡 Resetting…");

    const data = await api("/tournament/reset", {
      method: "POST"
    });

    state = data.state || {
      A: {},
      B: {},
      QA: {},
      QB: {},
      KO: {}
    };

    setSync("live", "🟢 Live · Backend sync");
    rerenderAll();
  } catch (err) {
    console.error(err);
    setSync("offline", "🔴 Reset failed");
    alert(err.message || "Reset failed.");
  }
}

// ===== RENDER =====
function rerenderAll() {
  renderFixtures("A", SCHED_A.fixtures, "fixturesA", "A");
  renderFixtures("B", SCHED_B.fixtures, "fixturesB", "B");
  renderTable("A", POOL_A, "tableA", 3);
  renderTable("B", POOL_B, "tableB", 3);
  renderWild();
  renderQF();
  renderKO();
}

// ===== START =====
updateAdminBadge();
loadTournament();
