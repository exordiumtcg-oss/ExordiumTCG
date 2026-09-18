const API_URL = "https://script.google.com/macros/s/AKfycbyaNd6MyhbsrlJIATUQcagVkk7AjO0j2kYOAZ7fbbaai1FptfIJHksqb2asPhZ5HlUlAA/exec";

let state = {
  token: null,
  user: null,
  sets: [],
  cards: [],
  owned: new Set(),
  currentSet: "",
  allOwned: 0
};

const $ = id => document.getElementById(id);

const esc = s =>
  String(s ?? "").replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));

function toast(msg) {
  const el = $("toast");
  if (!el) return;

  el.textContent = msg;
  el.style.display = "block";

  setTimeout(() => {
    el.style.display = "none";
  }, 2800);
}


/* =========================
   API
========================= */

async function apiGet(action, data = {}) {
  const params = new URLSearchParams({
    action,
    ...data,
    token: state.token || ""
  });

  const response = await fetch(`${API_URL}?${params.toString()}`);
  const json = await response.json();

  if (json.success === false) {
    throw new Error(json.message || "Request failed.");
  }

  return json;
}


async function apiPost(action, data = {}) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({
      action,
      ...data,
      token: state.token
    })
  });

  const json = await response.json();

  if (json.success === false) {
    throw new Error(json.message || "Request failed.");
  }

  return json;
}


/* =========================
   AUTH TABS
========================= */

document.querySelectorAll(".auth-tab").forEach(button => {
  button.onclick = () => showAuth(button.dataset.auth);
});


function showAuth(mode) {
  document.querySelectorAll(".auth-tab").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.auth === mode
    );
  });

  if ($("loginForm")) {
    $("loginForm").hidden = mode !== "login";
  }

  if ($("registerForm")) {
    $("registerForm").hidden = mode !== "register";
  }
}


/* =========================
   LOGIN
========================= */

$("loginForm").onsubmit = async e => {
  e.preventDefault();

  const identifier = $("loginIdentity").value.trim();
  const password = $("loginPassword").value;

  if (!identifier || !password) {
    toast("Please enter your login information.");
    return;
  }

  try {
    const result = await apiPost("login", {
      identifier: identifier,
      password: password
    });

    state.token = result.token;
    state.user = result.user;

    localStorage.setItem("pokemonToken", state.token);

    await boot();

  } catch (error) {
    toast(error.message);
  }
};


$("loginPassword").onkeydown = e => {
  if (e.key === "Enter") {
    $("loginForm").requestSubmit();
  }
};


/* =========================
   REGISTER
========================= */

$("registerForm").onsubmit = async e => {
  e.preventDefault();

  const password = $("regPassword").value;
  const confirmPassword = $("regPassword2").value;

  if (password !== confirmPassword) {
    toast("Passwords do not match.");
    return;
  }

  try {
    await apiPost("register", {
      username: $("regUsername").value.trim(),
      name: $("regName").value.trim(),
      email: $("regEmail").value.trim(),
      phone: $("regPhone").value.trim(),
      password: password,
      confirmPassword: confirmPassword
    });

    toast("Account created. Please log in.");

    showAuth("login");

    $("loginIdentity").value =
      $("regUsername").value.trim();

  } catch (error) {
    toast(error.message);
  }
};


/* =========================
   BOOT APP
========================= */

async function boot() {

  $("authView").hidden = true;
  $("appView").hidden = false;

  if (
    state.user &&
    state.user.role === "admin" &&
    $("settingsBtn")
  ) {
    $("settingsBtn").hidden = false;
  }

  try {
    const result = await apiGet("sets");

    state.sets = result.sets || [];

    renderSets();

    if (state.sets.length > 0) {
      await loadSet(state.sets[state.sets.length - 1].name);
    }

    await loadTotals();

  } catch (error) {
    toast(error.message);
  }
}


/* =========================
   SETS
========================= */

function renderSets() {

  const select = $("setSelect");

  if (!select) return;

  select.innerHTML = state.sets
    .map(set => `
      <option value="${esc(set.name)}">
        ${esc(set.name)}
      </option>
    `)
    .join("");

  select.onchange = () => {
    loadSet(select.value);
  };

  if ($("openLatestBtn")) {
    $("openLatestBtn").onclick = () => {
      if (state.sets.length > 0) {
        loadSet(state.sets[state.sets.length - 1].name);
      }
    };
  }
}


/* =========================
   LOAD SET
========================= */

async function loadSet(name) {

  if (!name) return;

  state.currentSet = name;

  if ($("setSelect")) {
    $("setSelect").value = name;
  }

  try {

    const cardsResult = await apiGet("cards", {
      setName: name
    });

    const ownedResult = await apiGet("owned", {
      setName: name
    });

    state.cards = cardsResult.cards || [];

    const ownedObject = ownedResult.owned || {};

    state.owned = new Set(
      Object.keys(ownedObject).filter(
        id => ownedObject[id] === true
      )
    );

    if ($("setTitle")) {
      $("setTitle").textContent = name;
    }

    if ($("setMeta")) {
      $("setMeta").textContent =
        `${state.cards.length} cards in this series`;
    }

    if ($("featureTitle")) {
      $("featureTitle").textContent = name;
    }

    if ($("featureChip")) {
      $("featureChip").textContent =
        state.cards[0]?.setCode || "SET";
    }

    if ($("featureImage")) {
      if (state.cards[0]?.imageUrl) {
        $("featureImage").src =
          state.cards[0].imageUrl;
      } else {
        $("featureImage").removeAttribute("src");
      }
    }

    renderRarities();
    renderCards();
    renderProgress();

  } catch (error) {
    toast(error.message);
  }
}


/* =========================
   RARITIES
========================= */

function renderRarities() {

  const values = [
    ...new Set(
      state.cards
        .map(card => card.rarity)
        .filter(Boolean)
    )
  ].sort();

  if (!$("raritySelect")) return;

  $("raritySelect").innerHTML =
    '<option value="">All Rarities</option>' +
    values
      .map(value => `
        <option value="${esc(value)}">
          ${esc(value)}
        </option>
      `)
      .join("");
}


/* =========================
   FILTER
========================= */

function filteredCards() {

  const q =
    $("search")?.value.trim().toLowerCase() || "";

  const rarity =
    $("raritySelect")?.value || "";

  const sort =
    $("sortSelect")?.value || "number";

  let cards = state.cards.filter(card => {

    const matchesSearch =
      !q ||
      String(card.id)
        .toLowerCase()
        .includes(q) ||
      String(card.name)
        .toLowerCase()
        .includes(q);

    const matchesRarity =
      !rarity ||
      card.rarity === rarity;

    return matchesSearch && matchesRarity;
  });

  cards.sort((a, b) => {

    if (sort === "name") {
      return String(a.name)
        .localeCompare(String(b.name));
    }

    return String(a.id).localeCompare(
      String(b.id),
      undefined,
      { numeric: true }
    );
  });

  return cards;
}


/* =========================
   RENDER CARDS
========================= */

function renderCards() {

  const container = $("cards");

  if (!container) return;

  const cards = filteredCards();

  container.innerHTML = cards
    .map(card => {

      const owned =
        state.owned.has(String(card.id));

      return `
        <article class="card-item ${owned ? "owned" : ""}">

          <div class="card-img">

            ${
              owned
                ? '<span class="owned-badge">OWNED</span>'
                : ""
            }

            <img
              loading="lazy"
              src="${esc(card.imageUrl)}"
              alt="${esc(card.name)}"
              onerror="this.style.opacity=.15"
            >

          </div>

          <div
            class="card-name"
            title="${esc(card.name)}"
          >
            ${esc(card.name)}
          </div>

          <div class="card-number">
            ${esc(card.id)}
            /
            ${esc(card.totalSetNumber)}
          </div>

          <div class="card-bottom">

            <span class="rarity">
              ${esc(card.rarity || "")}
            </span>

            <label class="check">

              <input
                type="checkbox"
                data-id="${esc(card.id)}"
                ${owned ? "checked" : ""}
              >

              Owned

            </label>

          </div>

        </article>
      `;
    })
    .join("");

  if ($("empty")) {
    $("empty").hidden = cards.length > 0;
  }

  document
    .querySelectorAll(".check input")
    .forEach(input => {

      input.onchange = () => {
        toggleOwned(
          input.dataset.id,
          input.checked
        );
      };

    });
}


/* =========================
   OWNED
========================= */

async function toggleOwned(id, checked) {

  const cardId = String(id);

  if (checked) {
    state.owned.add(cardId);
  } else {
    state.owned.delete(cardId);
  }

  renderCards();
  renderProgress();

  try {

    await apiPost("setOwned", {
      setName: state.currentSet,
      cardID: cardId,
      owned: checked
    });

    await loadTotals();

  } catch (error) {

    toast(error.message);

    // Reload from server if save failed
    await loadSet(state.currentSet);
  }
}


/* =========================
   PROGRESS
========================= */

function renderProgress() {

  const total = state.cards.length;
  const owned = state.owned.size;

  const percent =
    total
      ? Math.round((owned / total) * 100)
      : 0;

  if ($("setPercent")) {
    $("setPercent").textContent =
      percent + "%";
  }

  if ($("progressBar")) {
    $("progressBar").style.width =
      percent + "%";
  }

  if ($("featureOwned")) {
    $("featureOwned").textContent = owned;
  }

  if ($("featureTotal")) {
    $("featureTotal").textContent = total;
  }
}


/* =========================
   TOTAL COLLECTION
========================= */

async function loadTotals() {

  try {

    const result = await apiGet("summary", {
      setName: state.currentSet
    });

    const total =
      Number(result.totalCards || 0);

    const owned =
      Number(result.ownedCards || 0);

    const missing =
      Math.max(0, total - owned);

    const percent =
      Number(result.percentage || 0);

    state.allOwned = owned;

    if ($("totalCards")) {
      $("totalCards").textContent = total;
    }

    if ($("totalOwned")) {
      $("totalOwned").textContent = owned;
    }

    if ($("totalMissing")) {
      $("totalMissing").textContent = missing;
    }

    if ($("totalPercent")) {
      $("totalPercent").textContent =
        Math.round(percent) + "%";
    }

  } catch (error) {
    console.error(error);
  }
}


/* =========================
   SEARCH / SORT
========================= */

if ($("search")) {
  $("search").oninput = renderCards;
}

if ($("raritySelect")) {
  $("raritySelect").onchange = renderCards;
}

if ($("sortSelect")) {
  $("sortSelect").onchange = renderCards;
}


/* =========================
   SYNC
========================= */

if ($("syncBtn")) {

  $("syncBtn").onclick = async () => {

    try {

      await loadSet(state.currentSet);
      await loadTotals();

      toast("Synced with Google Sheets.");

    } catch (error) {
      toast(error.message);
    }

  };

}


/* =========================
   LOGOUT
========================= */

if ($("logoutBtn")) {

  $("logoutBtn").onclick = async () => {

    try {
      if (state.token) {
        await apiPost("logout");
      }
    } catch (error) {
      console.error(error);
    }

    localStorage.removeItem("pokemonToken");

    location.reload();
  };

}


/* =========================
   THEME
========================= */

if ($("themeBtn")) {

  $("themeBtn").onclick = () => {
    document.body.classList.toggle("light");
  };

}


/* =========================
   CTRL + K SEARCH
========================= */

document.addEventListener("keydown", e => {

  if (
    (e.ctrlKey || e.metaKey) &&
    e.key.toLowerCase() === "k"
  ) {

    e.preventDefault();

    if ($("search")) {
      $("search").focus();
    }

  }

});


/* =========================
   ADMIN USERS
========================= */

if ($("settingsBtn")) {

  $("settingsBtn").onclick = async () => {

    try {

      const result = await apiGet("users");

      if ($("usersTable")) {

        $("usersTable").innerHTML =
          (result.users || [])
            .map(user => `
              <div class="user-row">

                <div>
                  <b>${esc(user.username)}</b>
                  <div class="muted">
                    ${esc(user.name)}
                  </div>
                </div>

                <div>
                  ${esc(user.email)}
                </div>

                <div>
                  ${esc(user.phone)}
                </div>

                <div>
                  ${esc(user.role)}
                </div>

                <button
                  class="mini"
                  onclick="resetUser('${esc(user.username)}')"
                >
                  Reset password
                </button>

                <button
                  class="danger"
                  onclick="deleteUser('${esc(user.username)}')"
                >
                  Delete
                </button>

              </div>
            `)
            .join("");
      }

      if ($("adminModal")) {
        $("adminModal").hidden = false;
      }

    } catch (error) {
      toast(error.message);
    }

  };

}


/* =========================
   CLOSE ADMIN
========================= */

if ($("closeAdmin")) {

  $("closeAdmin").onclick = () => {
    $("adminModal").hidden = true;
  };

}


/* =========================
   ADMIN RESET PASSWORD
========================= */

window.resetUser = async username => {

  const newPassword =
    prompt(`New password for ${username}:`);

  if (!newPassword) return;

  try {

    await apiPost("resetPassword", {
      username: username,
      newPassword: newPassword
    });

    toast("Password reset successfully.");

  } catch (error) {
    toast(error.message);
  }

};


/* =========================
   ADMIN DELETE USER
========================= */

window.deleteUser = async username => {

  if (!confirm(`Delete ${username}?`)) {
    return;
  }

  try {

    await apiPost("deleteUser", {
      username: username
    });

    toast("User deleted.");

    if ($("settingsBtn")) {
      $("settingsBtn").click();
    }

  } catch (error) {
    toast(error.message);
  }

};


/* =========================
   NAVIGATION
========================= */

document
  .querySelectorAll(".nav-item[data-nav]")
  .forEach(button => {

    button.onclick = () => {

      document
        .querySelectorAll(".nav-item[data-nav]")
        .forEach(item =>
          item.classList.remove("active")
        );

      button.classList.add("active");

      if (
        button.dataset.nav === "cards" ||
        button.dataset.nav === "collections"
      ) {

        const grid =
          document.querySelector(".card-grid");

        if (grid) {
          grid.scrollIntoView({
            behavior: "smooth"
          });
        }

      }

    };

  });


/* =========================
   AUTO LOGIN
========================= */

(async () => {

  const token =
    localStorage.getItem("pokemonToken");

  if (!token) return;

  state.token = token;

  try {

    // There is no "me" endpoint in your Apps Script.
    // We validate the token by requesting the sets
    // and then loading the collection.

    const result = await apiGet("sets");

    state.sets = result.sets || [];

    if (state.sets.length === 0) {
      throw new Error("No card sets found.");
    }

    $("authView").hidden = true;
    $("appView").hidden = false;

    renderSets();

    await loadSet(
      state.sets[state.sets.length - 1].name
    );

    await loadTotals();

  } catch (error) {

    console.error(error);

    localStorage.removeItem("pokemonToken");

    state.token = null;
    state.user = null;

  }

})();
