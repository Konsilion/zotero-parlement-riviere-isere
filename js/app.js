/* =========================================================
   Zotero Vitrine — logique front
   - Fetch collection.json
   - Rendu des cartes
   - Filtres (recherche + tags + année + type)
   - Modale détail + copie BibTeX
   ========================================================= */

(() => {
  "use strict";

  // ---------- État global ----------
  const state = {
    items: [],            // items de la collection
    meta: {},             // generated_at, count, ...
    selectedTags: new Set(),
    searchText: "",
    selectedYear: "",
    selectedType: "",
  };

  // ---------- DOM ----------
  const els = {
    search: document.getElementById("search"),
    yearSelect: document.getElementById("year-select"),
    typeSelect: document.getElementById("type-select"),
    tagList: document.getElementById("tag-list"),
    resetBtn: document.getElementById("reset-filters"),
    grid: document.getElementById("grid"),
    resultCount: document.getElementById("result-count"),
    modal: document.getElementById("modal"),
    modalType: document.getElementById("modal-type"),
    modalTitle: document.getElementById("modal-title"),
    modalAuthors: document.getElementById("modal-authors"),
    modalYear: document.getElementById("modal-year"),
    modalDateAdded: document.getElementById("modal-dateAdded"),
    modalTags: document.getElementById("modal-tags"),
    modalAbstract: document.getElementById("modal-abstract"),
    modalSource: document.getElementById("modal-source"),
    modalBibtex: document.getElementById("modal-bibtex"),
    modalCopied: document.getElementById("modal-copied"),
  };

  // ---------- Utils ----------
  const escapeHtml = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const formatAuthors = (authors) => {
    if (!authors || authors.length === 0) return "Auteur inconnu";
    if (authors.length === 1) return authors[0];
    if (authors.length === 2) return authors.join(" & ");
    if (authors.length <= 5) return authors.slice(0, -1).join(", ") + " & " + authors.at(-1);
    return authors.slice(0, 3).join(", ") + ", et al.";
  };

  // Petite "carte" → représentation compacte pour la grille
  const formatAuthorsShort = (authors) => {
    if (!authors || authors.length === 0) return "Auteur inconnu";
    if (authors.length === 1) return authors[0];
    if (authors.length === 2) return authors.join(", ");
    return authors[0] + " et al.";
  };

  // ---------- Fetch initial ----------
  async function loadCollection() {
    try {
      const resp = await fetch("data/collection.json", { cache: "no-store" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      state.items = data.items || [];
      state.meta = data;

      buildFilterOptions();
      render();
    } catch (err) {
      els.grid.innerHTML = `<p class="empty">
        ⚠️ Impossible de charger <code>data/collection.json</code>.<br>
        <small>${escapeHtml(err.message)}</small><br><br>
        <small>Avez-vous lancé <code>python scripts/fetch_zotero.py</code> ?</small>
      </p>`;
      console.error(err);
    }
  }

  // ---------- Construction des options de filtres ----------
  function buildFilterOptions() {
    // Années distinctes
    const years = new Set();
    const types = new Set();
    const tagCounts = new Map();

    for (const it of state.items) {
      if (it.year) years.add(it.year);
      if (it.type) types.add(it.type);
      for (const t of it.tags) {
        tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
      }
    }

    // Remplir select année (tri décroissant)
    [...years].sort((a, b) => b.localeCompare(a)).forEach((y) => {
      const opt = document.createElement("option");
      opt.value = y;
      opt.textContent = y;
      els.yearSelect.appendChild(opt);
    });

    // Remplir select type (alphabétique)
    [...types].sort((a, b) => a.localeCompare(b, "fr")).forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      els.typeSelect.appendChild(opt);
    });

    // Remplir tags (tri par fréquence décroissante)
    const sortedTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);
    if (sortedTags.length === 0) {
      els.tagList.innerHTML = `<p class="muted">Aucun tag</p>`;
    } else {
      els.tagList.innerHTML = "";
      for (const [tag, count] of sortedTags) {
        const pill = document.createElement("button");
        pill.type = "button";
        pill.className = "tag-pill";
        pill.dataset.tag = tag;
        pill.innerHTML = `${escapeHtml(tag)}<span class="tag-count">${count}</span>`;
        pill.addEventListener("click", () => {
          if (state.selectedTags.has(tag)) {
            state.selectedTags.delete(tag);
            pill.classList.remove("active");
          } else {
            state.selectedTags.add(tag);
            pill.classList.add("active");
          }
          render();
        });
        els.tagList.appendChild(pill);
      }
    }
  }

  // ---------- Filtrage ----------
  function getFilteredItems() {
    const q = state.searchText.trim().toLowerCase();
    return state.items.filter((it) => {
      // Recherche texte : titre, auteurs, abstract, tags
      if (q) {
        const haystack = [
          it.title,
          ...(it.authors || []),
          it.abstract,
          ...(it.tags || []),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      // Année
      if (state.selectedYear && it.year !== state.selectedYear) return false;
      // Type
      if (state.selectedType && it.type !== state.selectedType) return false;
      // Tags (intersection : l'item doit avoir TOUS les tags sélectionnés)
      if (state.selectedTags.size > 0) {
        const itemTags = new Set(it.tags || []);
        for (const t of state.selectedTags) {
          if (!itemTags.has(t)) return false;
        }
      }
      return true;
    });
  }

  // ---------- Rendu ----------
  function render() {
    const filtered = getFilteredItems();
    els.resultCount.textContent = `${filtered.length} résultat${filtered.length > 1 ? "s" : ""}`;

    if (filtered.length === 0) {
      els.grid.innerHTML = `<p class="empty">Aucun document ne correspond aux filtres.</p>`;
      return;
    }

    els.grid.innerHTML = filtered.map((it) => renderCard(it)).join("");

    // Attache les listeners sur les cartes
    els.grid.querySelectorAll(".card").forEach((card) => {
      card.addEventListener("click", () => {
        const key = card.dataset.key;
        const item = state.items.find((i) => i.key === key);
        if (item) openModal(item);
      });
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          card.click();
        }
      });
    });
  }

  function renderCard(it) {
    const visibleTags = (it.tags || []).slice(0, 4);
    const hiddenCount = (it.tags || []).length - visibleTags.length;

    return `
      <article class="card" data-key="${escapeHtml(it.key)}" tabindex="0" role="button" aria-label="Voir le détail de ${escapeHtml(it.title)}">
        <span class="card-type">${escapeHtml(it.type || "Document")}</span>
        <h2 class="card-title">${escapeHtml(it.title)}</h2>
        <p class="card-authors">${escapeHtml(formatAuthorsShort(it.authors))}</p>
        <p class="card-meta">${it.year ? escapeHtml(it.year) : "Année inconnue"}</p>
        <div class="card-tags">
          ${visibleTags.map((t) => `<span class="card-tag">${escapeHtml(t)}</span>`).join("")}
          ${hiddenCount > 0 ? `<span class="card-tag more">+${hiddenCount}</span>` : ""}
        </div>
      </article>
    `;
  }

  // ---------- Modale ----------
  function openModal(item) {
    els.modalType.textContent = item.type || "Document";
    els.modalTitle.textContent = item.title;
    els.modalAuthors.textContent = formatAuthors(item.authors);
    els.modalYear.textContent = item.year ? `📅 ${item.year}` : "";
    els.modalDateAdded.textContent = item.dateAdded ? `Ajouté le ${item.dateAdded}` : "";

    // Tags
    els.modalTags.innerHTML = (item.tags || [])
      .map((t) => `<span class="card-tag">${escapeHtml(t)}</span>`)
      .join("");

    // Abstract
    if (item.abstract && item.abstract.trim()) {
      els.modalAbstract.textContent = item.abstract;
      els.modalAbstract.classList.remove("empty");
    } else {
      els.modalAbstract.textContent = "Pas de résumé disponible.";
      els.modalAbstract.classList.add("empty");
    }

    // Bouton source
    const sourceUrl = item.url || (item.doi ? `https://doi.org/${item.doi}` : null);
    if (sourceUrl) {
      els.modalSource.href = sourceUrl;
      els.modalSource.classList.remove("disabled");
      els.modalSource.textContent = "Ouvrir la source";
    } else {
      els.modalSource.removeAttribute("href");
      els.modalSource.classList.add("disabled");
      els.modalSource.textContent = "Pas de lien disponible";
    }

    // Stocker l'item courant pour le bouton BibTeX
    els.modalBibtex.dataset.key = item.key;
    els.modalCopied.textContent = "";

    els.modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }

  function closeModal() {
    els.modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

  // ---------- BibTeX ----------
  function buildBibtex(item) {
    // Type Zotero → type BibTeX
    const BIBTEX_TYPE = {
      "book": "book",
      "bookSection": "incollection",
      "journalArticle": "article",
      "magazineArticle": "article",
      "newspaperArticle": "article",
      "thesis": "phdthesis",
      "report": "techreport",
      "conferencePaper": "inproceedings",
      "manuscript": "unpublished",
      "webpage": "misc",
      "preprint": "article",
    };
    // Le frontend n'a pas le type Zotero brut (on a le libellé FR).
    // On retombe sur une heuristique basée sur le libellé :
    const FR_TO_BIBTEX = {
      "Livre": "book",
      "Chapitre de livre": "incollection",
      "Article de revue": "article",
      "Article de magazine": "article",
      "Article de presse": "article",
      "Thèse": "phdthesis",
      "Rapport": "techreport",
      "Communication": "inproceedings",
      "Manuscrit": "unpublished",
      "Page web": "misc",
      "Pré-publication": "article",
    };
    const type = FR_TO_BIBTEX[item.type] || "misc";

    // Clé de citation
    const firstAuthor = (item.authors && item.authors[0]) || "inconnu";
    const lastName = firstAuthor.split(" ").pop().toLowerCase().replace(/[^a-z]/g, "");
    const year = item.year || "nodate";
    const citeKey = `${lastName}${year}_${(item.key || "").slice(-4)}`;

    // Auteurs BibTeX : "Dupont, Jean" → "Dupont, Jean"
    const bibAuthors = (item.authors || [])
      .map((a) => {
        const parts = a.trim().split(/\s+/);
        if (parts.length === 1) return parts[0];
        const last = parts[0];
        const first = parts.slice(1).join(" ");
        return `${last}, ${first}`;
      })
      .join(" and ");

    const fields = [];
    fields.push(`  title = {${item.title || ""}}`);
    if (bibAuthors) fields.push(`  author = {${bibAuthors}}`);
    if (item.year) fields.push(`  year = {${item.year}}`);
    if (item.doi) fields.push(`  doi = {${item.doi}}`);
    if (item.url) fields.push(`  url = {${item.url}}`);
    if (item.abstract) fields.push(`  abstract = {${item.abstract.replace(/[{}]/g, "")}}`);
    if (item.dateAdded) fields.push(`  note = {Ajouté à Zotero le ${item.dateAdded}}`);

    return `@${type}{${citeKey},\n${fields.join(",\n")}\n}`;
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // Fallback : sélection + execCommand
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (_) { /* ignore */ }
      document.body.removeChild(ta);
      return ok;
    }
  }

  // ---------- Listeners globaux ----------
  function attachListeners() {
    // Recherche (debounced)
    let searchTimer = null;
    els.search.addEventListener("input", (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.searchText = e.target.value;
        render();
      }, 150);
    });

    // Année
    els.yearSelect.addEventListener("change", (e) => {
      state.selectedYear = e.target.value;
      render();
    });

    // Type
    els.typeSelect.addEventListener("change", (e) => {
      state.selectedType = e.target.value;
      render();
    });

    // Reset
    els.resetBtn.addEventListener("click", () => {
      state.selectedTags.clear();
      state.searchText = "";
      state.selectedYear = "";
      state.selectedType = "";
      els.search.value = "";
      els.yearSelect.value = "";
      els.typeSelect.value = "";
      els.tagList.querySelectorAll(".tag-pill.active").forEach((p) => p.classList.remove("active"));
      render();
    });

    // Modale : fermeture
    els.modal.querySelectorAll("[data-close]").forEach((el) => {
      el.addEventListener("click", closeModal);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && els.modal.getAttribute("aria-hidden") === "false") {
        closeModal();
      }
    });

    // BibTeX
    els.modalBibtex.addEventListener("click", async () => {
      const key = els.modalBibtex.dataset.key;
      const item = state.items.find((i) => i.key === key);
      if (!item) return;
      const bib = buildBibtex(item);
      const ok = await copyToClipboard(bib);
      els.modalCopied.textContent = ok ? "✓ Citation BibTeX copiée !" : "⚠️ Copie impossible — sélectionne manuellement.";
    });
  }

  // ---------- Boot ----------
  document.addEventListener("DOMContentLoaded", () => {
    attachListeners();
    loadCollection();
  });
})();
