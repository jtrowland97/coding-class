(() => {
  "use strict";

  const API_URL = "https://www.omdbapi.com/";
  const PAGE_SIZE = 10; // OMDb returns 10 results per search page
  const API_KEY = "de05039"; // get a free key at https://www.omdbapi.com/apikey.aspx

  const state = {
    query: null,
    page: 1,
    totalPages: 0,
    searchCtl: null,
    detailCtl: null,
  };

  const $ = (id) => document.getElementById(id);
  const els = {
    form: $("searchForm"),
    status: $("status"),
    results: $("results"),
    grid: $("resultGrid"),
    pager: $("pager"),
    prev: $("prev"),
    next: $("next"),
    pageInfo: $("pageInfo"),
    detail: $("detail"),
  };

  /* ---------- helpers ---------- */

  // Build DOM nodes safely (textContent only, never innerHTML with API data).
  function h(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    }
    for (const c of children.flat()) if (c != null) node.append(c);
    return node;
  }

  // OMDb uses the literal string "N/A" for missing values.
  const val = (v) => (v && v !== "N/A" ? v : null);
  const list = (v) => (val(v) ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);

  function setStatus(msg, isError = false) {
    els.status.textContent = msg;
    els.status.classList.toggle("text-curtain", isError);
    els.status.classList.toggle("font-medium", isError);
    els.status.classList.toggle("text-soft", !isError);
  }

  // Shared Tailwind class strings
  const THUMB = "grid aspect-[2/3] place-items-center overflow-hidden rounded-sm bg-steel font-serif text-paper";
  const NOTE = "mt-4 max-w-[60ch] text-sm text-soft";

  /* ---------- API layer ---------- */

  async function omdb(params, signal) {
    const url = new URL(API_URL);
    url.search = new URLSearchParams({ apikey: API_KEY, ...params }).toString();

    let res;
    try {
      res = await fetch(url, { signal });
    } catch (err) {
      if (err.name === "AbortError") throw err;
      throw new Error("Couldn’t reach OMDb. Check your connection and try again.");
    }
    if (res.status === 401) throw new Error("OMDb rejected the API key. Check API_KEY in app.js.");
    if (!res.ok) throw new Error(`OMDb returned an error (HTTP ${res.status}). Try again in a moment.`);

    const data = await res.json();
    if (data.Response === "False") throw new Error(data.Error || "OMDb returned no data.");
    return data;
  }

  /* ---------- search ---------- */

  async function runSearch(query, page = 1) {
    state.searchCtl?.abort();
    const ctl = (state.searchCtl = new AbortController());
    state.query = query;
    state.page = page;

    setStatus(`Searching for “${query.q}”…`);
    els.results.hidden = true;
    els.prev.disabled = els.next.disabled = true;

    try {
      const params = { s: query.q, page };
      if (query.type) params.type = query.type;
      if (query.y) params.y = query.y;
      const data = await omdb(params, ctl.signal);

      const total = Number(data.totalResults) || data.Search.length;
      state.totalPages = Math.ceil(total / PAGE_SIZE);
      renderResults(data.Search);
      setStatus(
        `${total.toLocaleString()} result${total === 1 ? "" : "s"} for “${query.q}”. Choose a film to see its credits.`
      );
    } catch (err) {
      if (err.name === "AbortError") return;
      els.grid.replaceChildren();
      els.pager.hidden = true;
      const friendly =
        err.message === "Movie not found!"
          ? `No titles match “${query.q}”. Check the spelling or remove the year and type filters.`
          : err.message;
      setStatus(friendly, true);
    }
  }

  function renderResults(items) {
    els.grid.replaceChildren(
      ...items.map((it) =>
        h(
          "button",
          {
            class: "group flex cursor-pointer flex-col gap-2 text-left",
            type: "button",
            "data-id": it.imdbID,
            onclick: () => selectFilm(it.imdbID),
          },
          h(
            "div",
            { class: `${THUMB} text-5xl` },
            val(it.Poster)
              ? h("img", {
                  class: "h-full w-full object-cover",
                  src: it.Poster,
                  alt: "",
                  loading: "lazy",
                  onerror: (e) => e.target.replaceWith(document.createTextNode(it.Title[0])),
                })
              : document.createTextNode(it.Title[0])
          ),
          h("div", { class: "font-serif text-xl leading-tight group-hover:text-curtain", text: it.Title }),
          h("div", { class: "text-sm text-soft", text: [it.Year, it.Type].filter(Boolean).join(", ") })
        )
      )
    );
    els.results.hidden = false;

    els.pager.hidden = state.totalPages <= 1;
    els.pageInfo.textContent = `Page ${state.page} of ${state.totalPages}`;
    els.prev.disabled = state.page <= 1;
    els.next.disabled = state.page >= state.totalPages;
  }

  /* ---------- film detail ---------- */

  async function selectFilm(imdbID) {
    state.detailCtl?.abort();
    const ctl = (state.detailCtl = new AbortController());

    history.replaceState(null, "", "#" + imdbID);
    els.detail.hidden = false;
    els.detail.replaceChildren(
      h("div", {
        class:
          "h-[22rem] animate-shimmer bg-[linear-gradient(90deg,#f5f7f6,#e7eae8,#f5f7f6)] bg-[length:200%_100%] motion-reduce:animate-none",
        "aria-hidden": "true",
      })
    );
    els.detail.scrollIntoView({ block: "start" });
    setStatus("Loading credits…");

    try {
      const film = await omdb({ i: imdbID, plot: "full" }, ctl.signal);
      renderFilm(film);
      setStatus(`Showing credits for ${film.Title}.`);
    } catch (err) {
      if (err.name === "AbortError") return;
      els.detail.hidden = true;
      setStatus(err.message, true);
    }
  }

  // Roles hang to the left of a shared centre axis, like an end-credits roll.
  function creditRow(role, names, i) {
    if (!names.length) return null;
    return h(
      "div",
      {
        class:
          "grid animate-roll gap-x-7 gap-y-1 border-t border-line py-3.5 motion-reduce:animate-none sm:grid-cols-2",
        style: `animation-delay:${i * 60}ms`,
      },
      h("dt", { class: "font-serif text-[1.3rem] italic leading-snug text-steel sm:text-right", text: role }),
      h("dd", { class: "m-0" }, names.map((n) => h("div", { class: "text-[1.05rem]", text: n })))
    );
  }

  function renderFilm(f) {
    const rows = [
      ["Directed by", list(f.Director)],
      ["Written by", list(f.Writer)],
      ["Starring", list(f.Actors)],
      ["Production", list(f.Production)],
      ["Genre", list(f.Genre)],
      ["Released", list(f.Released)],
      ["Runtime", list(f.Runtime)],
      ["Language", list(f.Language)],
      ["Country", list(f.Country)],
      ["Rated", list(f.Rated)],
      ["Recognition", val(f.Awards) ? [f.Awards] : []],
    ];
    let n = 0;
    const creditNodes = rows.map(([role, names]) => creditRow(role, names, n++));

    const liClass = "flex justify-between gap-4 border-t border-line py-1.5 last:border-b";
    const ratings = (f.Ratings || []).map((r) =>
      h("li", { class: liClass }, h("span", { text: r.Source }), h("b", { class: "font-semibold", text: r.Value }))
    );
    if (val(f.imdbVotes)) {
      ratings.push(
        h("li", { class: liClass }, h("span", { text: "IMDb votes" }), h("b", { class: "font-semibold", text: f.imdbVotes }))
      );
    }

    const missing = [];
    if (!val(f.Production)) missing.push("production company");
    if (!val(f.Writer)) missing.push("writers");

    els.detail.replaceChildren(
      h(
        "article",
        {
          class:
            "grid gap-10 border border-line bg-paper p-5 sm:p-8 md:grid-cols-[minmax(10rem,17rem)_1fr] lg:p-12",
        },
        h(
          "aside",
          { class: "max-w-[14rem] self-start md:sticky md:top-4 md:max-w-none" },
          h(
            "div",
            { class: `${THUMB} text-7xl` },
            val(f.Poster)
              ? h("img", { class: "h-full w-full object-cover", src: f.Poster, alt: `Poster for ${f.Title}` })
              : document.createTextNode(f.Title[0])
          ),
          ratings.length ? h("ul", { class: "mt-4 text-sm", "aria-label": "Ratings" }, ratings) : null
        ),
        h(
          "div",
          {},
          h("h2", { class: "font-serif text-[clamp(2.2rem,5vw,3.6rem)] font-normal leading-none", text: f.Title }),
          h("p", { class: "mt-2 text-soft", text: [f.Year, f.Type].filter(Boolean).join(", ") }),
          val(f.Plot) ? h("p", { class: "mb-9 mt-6 max-w-[60ch]", text: f.Plot }) : null,
          h("dl", { class: "m-0" }, creditNodes),
          missing.length ? h("p", { class: NOTE, text: `OMDb has no ${missing.join(" or ")} listed for this title.` }) : null,
          val(f.imdbID)
            ? h(
                "p",
                { class: NOTE },
                h("a", {
                  class: "text-steel underline hover:text-curtain",
                  href: `https://www.imdb.com/title/${encodeURIComponent(f.imdbID)}/fullcredits`,
                  target: "_blank",
                  rel: "noopener",
                  text: "See the complete crew list on IMDb",
                })
              )
            : null
        )
      )
    );
  }

  /* ---------- wiring ---------- */

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(els.form);
    runSearch({ q: fd.get("q").trim(), type: fd.get("type"), y: fd.get("y").trim() }, 1);
  });

  els.prev.addEventListener("click", () => runSearch(state.query, state.page - 1));
  els.next.addEventListener("click", () => runSearch(state.query, state.page + 1));

  // Open a deep link (#tt1234567) on load.
  if (/^#tt\d+$/.test(location.hash)) selectFilm(location.hash.slice(1));
})();
