// واجهة جمر: صفحة واحدة بتوجيه عبر hash، بلا مكتبات خارجية.
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (c) => "$" + (c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const RARITY = { CONSUMER: "عادي", INDUSTRIAL: "صناعي", MIL_SPEC: "نادر", RESTRICTED: "مقيَّد", CLASSIFIED: "سرّي", COVERT: "خفي", CONTRABAND: "ممنوع" };
const LEDGER = { SANDBOX_CREDIT: "رصيد تجريبي", DEPOSIT: "إيداع", WITHDRAWAL: "سحب", CASE_PURCHASE: "فتح صندوق", REFUND: "استرداد", ADJUSTMENT: "تسوية", FEE: "رسوم" };
const ERRORS = {
  INSUFFICIENT_FUNDS: "رصيدك لا يكفي لفتح هذا الصندوق. أضف رصيدًا من المحفظة.",
  UNAUTHENTICATED: "سجّل الدخول أولًا.", AGE_NOT_VERIFIED: "يجب تأكيد أنك بالغ قبل الفتح.",
  USER_RESTRICTED: "حسابك مقيَّد حاليًا.", CASE_UNAVAILABLE: "هذا الصندوق غير متاح الآن.",
  TOPUP_LIMIT: "رصيدك التجريبي مرتفع بالفعل.",
};

const state = { user: null, balance: 0, sandbox: false };

async function api(path, opts = {}) {
  const res = await fetch("/api" + path, {
    method: opts.method || "GET",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.message || "حدث خطأ"), { code: data.error });
  return data;
}
const errText = (e) => ERRORS[e.code] || (e.code === "BAD_REQUEST" ? "تحقق من البيانات المدخلة." : "تعذّر إكمال الطلب. حاول مرة أخرى.");

function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.id); toast.id = setTimeout(() => t.classList.remove("show"), 3200);
}

// ───────── رسومات ─────────
const art = () => `<svg class="art" viewBox="0 0 120 120" aria-hidden="true">
  <path d="M16 80 86 12l22 6-6 22-68 66z" fill="currentColor" opacity=".28"/>
  <path d="M36 106 102 40l6-22-22-6z" fill="currentColor" opacity=".55"/>
  <path d="M16 80l20 26 6-36z" fill="currentColor" opacity=".95"/>
  <path d="m86 12 22 6-10 10z" fill="#fff" opacity=".7"/></svg>`;
const skinCard = (s, extra = "") =>
  `<div class="skin r-${s.rarity}">${art()}<b>${esc(s.name)}</b><small>${RARITY[s.rarity] || ""} ${money(s.price)}</small>${extra}</div>`;
const applyBars = (root) => root.querySelectorAll("[data-w]").forEach((el) => el.style.setProperty("--w", el.dataset.w + "%"));

// ───────── الرأس ─────────
function renderHeader() {
  const here = location.hash.split("/")[1] || "";
  const link = (h, label, key) => `<a href="#/${h}" ${here === key ? 'aria-current="page"' : ""}>${label}</a>`;
  $("#nav").innerHTML = link("", "الصناديق", "") + link("inventory", "المخزون", "inventory") + link("wallet", "المحفظة", "wallet") + link("fairness", "العدالة", "fairness");
  $("#account").innerHTML = state.user
    ? `<span class="bal" id="bal">${money(state.balance)}</span><span>${esc(state.user.name)}</span><button class="link" id="logout">خروج</button>`
    : `<button class="btn primary" id="login-btn">تسجيل الدخول</button>`;
  $("#login-btn")?.addEventListener("click", openLogin);
  $("#logout")?.addEventListener("click", async () => { await api("/auth/logout", { method: "POST" }); await refreshMe(); location.hash = "#/"; toast("تم تسجيل الخروج"); });
}
async function refreshMe() {
  const me = await api("/me");
  state.user = me.user; state.balance = me.balance || 0; renderHeader();
}
const setBalance = (b) => { state.balance = b; const el = $("#bal"); if (el) el.textContent = money(b); };

// ───────── الصفحات ─────────
async function home() {
  const [cases, feed] = await Promise.all([api("/cases"), api("/feed")]);
  const strip = cases.flatMap((c) => c.preview).map((s) => skinCard(s)).join("");
  $("#view").innerHTML = `
    <section class="hero">
      <h1>افتح الصندوق.<br>احتفظ بما ربحته.</h1>
      <p>كل سحب يُنفَّذ على الخادم بمولّد عشوائي تشفيري، واحتمالات كل صندوق معلنة قبل أن تفتحه.</p>
      <div class="row"><a class="btn primary big" href="#case-list">تصفّح الصناديق</a><a class="btn big" href="#/fairness">كيف نضمن العدالة</a></div>
    </section>
    <div class="marquee" aria-hidden="true"><div class="track">${strip}${strip}${strip}${strip}</div></div>
    <h2 class="sec" id="case-list">الصناديق</h2>
    <div class="grid">${cases.map((c) => `
      <a class="case" href="#/case/${esc(c.slug)}">
        <div class="fan">${c.preview.map((s) => skinCard(s)).join("")}</div>
        <h3>${esc(c.name)}</h3><span class="price">${money(c.price)}</span>
      </a>`).join("") || '<p class="empty">لا توجد صناديق منشورة بعد.</p>'}</div>
    <h2 class="sec">آخر النتائج</h2>
    <div class="feed">${feed.map((f) => skinCard(f.skin, `<span class="who">${esc(f.user)} من ${esc(f.case)}</span>`)).join("") || '<p class="empty">ستظهر هنا أحدث عمليات الفتح.</p>'}</div>`;
}

function pickWeighted(items) {
  let r = Math.random() * 100;
  for (const i of items) { r -= i.percent; if (r < 0) return i; }
  return items[items.length - 1];
}

async function casePage(slug) {
  const c = await api("/cases/" + encodeURIComponent(slug));
  const idle = Array.from({ length: 14 }, () => skinCard(pickWeighted(c.items))).join("");
  $("#view").innerHTML = `
    <div class="casehead"><div><h1>${esc(c.name)}</h1><p class="sub">النسخة ${c.version}، السعر ${money(c.price)} لكل فتح</p></div></div>
    <div class="reel" id="reel"><div class="needle"></div><div class="track" id="track">${idle}</div></div>
    <div class="openrow"><button class="btn primary big" id="open">افتح الصندوق بـ ${money(c.price)}</button></div>
    <h2 class="sec">محتويات الصندوق واحتمالاتها</h2>
    <p class="sub">هذه الأوزان هي المستخدمة فعليًا في السحب، ومجموعها 100%.</p>
    <div class="odds">${c.items.map((i) => `
      <div class="odd r-${i.rarity}"><span class="nm">${esc(i.name)}</span><span class="rr">${RARITY[i.rarity]}</span>
      <span class="bar"><i data-w="${Math.min(100, i.percent * 1)}"></i></span><span class="pct">${i.percent.toFixed(2)}%</span></div>`).join("")}</div>`;
  applyBars($("#view"));
  $("#open").addEventListener("click", () => openBox(c));
}

let opening = false;
async function openBox(c) {
  if (!state.user) return openLogin();
  if (opening) return;
  opening = true;
  const btn = $("#open"); btn.disabled = true;
  try {
    const key = crypto.randomUUID();
    const r = await api(`/cases/${encodeURIComponent(c.slug)}/open`, { method: "POST", headers: { "Idempotency-Key": key }, body: {} });
    await spin(c, r.opening.skin);
    setBalance(r.balance);
    showResult(c, r.opening);
  } catch (e) {
    toast(errText(e));
  } finally { opening = false; btn.disabled = false; }
}

function spin(c, winner) {
  const track = $("#track"), reel = $("#reel");
  const N = 56, W = 44;
  track.style.transition = "none"; track.style.transform = "translateX(0)";
  track.innerHTML = Array.from({ length: N }, (_, i) => skinCard(i === W ? winner : pickWeighted(c.items))).join("");
  const card = track.children[0], cw = card.offsetWidth + parseFloat(getComputedStyle(track).columnGap || 12);
  const jitter = (Math.random() - 0.5) * cw * 0.6;
  const target = W * cw + card.offsetWidth / 2 - reel.clientWidth / 2 + jitter;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ms = reduce ? 400 : 6200;
  return new Promise((done) => {
    track.getBoundingClientRect();
    track.style.transition = `transform ${ms}ms cubic-bezier(.12,.72,.1,1)`;
    track.style.transform = `translateX(${-target}px)`;
    setTimeout(done, ms + 150);
  });
}

function showResult(c, o) {
  const d = $("#result");
  d.innerHTML = `<div class="win"><h2 id="result-title">ربحت ${esc(o.skin.name)}</h2>
    <p class="sub">${RARITY[o.skin.rarity]}، قيمتها المرجعية ${money(o.skin.price)}</p>${skinCard(o.skin)}
    <div class="actions"><button class="btn primary" id="again">افتح مرة أخرى</button><a class="btn" href="#/inventory" id="toinv">اذهب إلى المخزون</a></div></div>`;
  d.showModal();
  $("#again").onclick = () => { d.close(); openBox(c); };
  $("#toinv").onclick = () => d.close();
}

async function inventory() {
  if (!state.user) return gate("سجّل الدخول لعرض مخزونك.");
  const items = await api("/inventory");
  $("#view").innerHTML = `<h2 class="sec">مخزونك</h2>` + (items.length
    ? `<div class="invgrid">${items.map((i) => skinCard(i.skin)).join("")}</div>`
    : `<p class="empty">مخزونك فارغ. <a class="link" href="#/">افتح صندوقك الأول</a></p>`);
}

async function wallet() {
  if (!state.user) return gate("سجّل الدخول لعرض محفظتك.");
  const w = await api("/wallet/ledger");
  setBalance(w.balance);
  $("#view").innerHTML = `<h2 class="sec">المحفظة</h2>
    <div class="panel"><div class="bignum">${money(w.balance)}</div>
      ${state.sandbox ? `<p class="sub">الرصيد تجريبي. الإيداع والسحب الحقيقيان غير مفعّلين.</p><button class="btn primary" id="topup">أضف $100.00 تجريبية</button>` : `<p class="sub">الإيداع والسحب غير متاحين حاليًا.</p>`}</div>
    <h2 class="sec">سجل الحركات</h2>
    <div class="panel"><table><thead><tr><th>النوع</th><th>المبلغ</th><th>الرصيد بعدها</th><th>التاريخ</th></tr></thead><tbody>
    ${w.entries.map((e) => `<tr><td>${LEDGER[e.type] || e.type}</td><td class="${e.amount > 0 ? "pos" : "neg"}">${e.amount > 0 ? "+" : ""}${money(e.amount)}</td><td>${money(e.balanceAfter)}</td><td>${new Date(e.createdAt).toLocaleString("ar")}</td></tr>`).join("") || '<tr><td colspan="4" class="empty">لا توجد حركات بعد.</td></tr>'}
    </tbody></table></div>`;
  $("#topup")?.addEventListener("click", async () => {
    try { await api("/wallet/sandbox-topup", { method: "POST", body: {} }); toast("أُضيف الرصيد التجريبي"); wallet(); } catch (e) { toast(errText(e)); }
  });
}

function fairness() {
  $("#view").innerHTML = `<div class="prose"><h2 class="sec">كيف نضمن العدالة</h2>
    <h2>السحب على الخادم</h2><p>تُحسب نتيجة كل فتح على الخادم باستخدام مولّد أرقام عشوائية آمن تشفيريًا، ولا يستطيع المتصفح ولا لوحة الإدارة تغييرها.</p>
    <h2>احتمالات معلنة</h2><p>تُعرض احتمالات كل عنصر قبل الفتح بدقة جزء من المليون، ومجموعها 100% بالضبط، وإلا لا يُنشر الصندوق.</p>
    <h2>نسخ لا تتغير</h2><p>أي تعديل على صندوق ينشئ نسخة جديدة. تبقى النسخة القديمة كما هي، وكل عملية فتح مرتبطة بالنسخة التي نُفِّذت عليها.</p>
    <h2>سجل مالي ثابت</h2><p>كل تغيير في الرصيد يُسجَّل في دفتر حركات لا يمكن تعديله أو حذفه، ويُحفظ رقم السحب مع كل نتيجة.</p>
    <h2>اللعب المسؤول</h2><p>الموقع للبالغين فقط. فتح الصناديق يعتمد على الحظ ولا يضمن ربحًا، فحدّد ميزانية ولا تتجاوزها.</p></div>`;
}

function gate(msg) {
  $("#view").innerHTML = `<p class="empty">${msg}<br><br><button class="btn primary" id="g">تسجيل الدخول</button></p>`;
  $("#g").onclick = openLogin;
}

// ───────── تسجيل الدخول ─────────
function openLogin() {
  const d = $("#login");
  d.innerHTML = `<form method="dialog" id="lf"><h2 id="login-title">تسجيل الدخول</h2>
    ${state.sandbox ? `<p class="sub">الدخول عبر Steam وGoogle قيد الإضافة. حاليًا يمكنك الدخول بحساب تجريبي برصيد افتراضي.</p>
    <label for="nm">اسم العرض</label><input type="text" id="nm" minlength="2" maxlength="24" required autocomplete="nickname">
    <label class="check"><input type="checkbox" id="age" required><span>أؤكد أن عمري 18 سنة أو أكثر.</span></label>
    <div class="actions"><button class="btn primary" type="submit">دخول</button><button class="btn" type="button" id="x">إلغاء</button></div>`
    : `<p class="sub">تسجيل الدخول غير متاح حاليًا.</p><div class="actions"><button class="btn" type="button" id="x">إغلاق</button></div>`}</form>`;
  d.showModal();
  $("#x").onclick = () => d.close();
  $("#lf").onsubmit = async (ev) => {
    ev.preventDefault();
    try {
      await api("/auth/dev-login", { method: "POST", body: { name: $("#nm").value, over18: $("#age").checked } });
      d.close(); await refreshMe(); toast("أهلًا بك"); route();
    } catch (e) { toast(errText(e)); }
  };
}

// ───────── الكوكيز ─────────
const getConsent = () => { try { return JSON.parse(decodeURIComponent((document.cookie.match(/(?:^|; )consent=([^;]*)/) || [])[1] || "")); } catch { return null; } };
const setConsent = (c) => { document.cookie = `consent=${encodeURIComponent(JSON.stringify({ v: 1, ...c, at: Date.now() }))}; Max-Age=${180 * 86400}; Path=/; SameSite=Lax`; $("#consent").hidden = true; };
function consentBanner() {
  const b = $("#consent");
  b.hidden = false;
  b.innerHTML = `<p>نستخدم كوكيز ضرورية لتسجيل الدخول والأمان. الكوكيز الاختيارية (التحليلات والتسويق) معطّلة ما لم توافق عليها.</p>
    <div class="actions"><button class="btn primary" id="ca">قبول الكل</button><button class="btn" id="cr">رفض الاختيارية</button><button class="btn" id="cc">تخصيص</button></div>`;
  $("#ca").onclick = () => setConsent({ analytics: true, marketing: true });
  $("#cr").onclick = () => setConsent({ analytics: false, marketing: false });
  $("#cc").onclick = cookieSettings;
}
function cookieSettings() {
  const c = getConsent() || { analytics: false, marketing: false };
  const d = $("#cookies");
  d.innerHTML = `<form method="dialog" id="cf"><h2 id="cookies-title">إعدادات الكوكيز</h2>
    <div class="opt"><span>ضرورية: تسجيل الدخول والأمان</span><b>مفعّلة دائمًا</b></div>
    <div class="opt"><label class="check"><input type="checkbox" id="an" ${c.analytics ? "checked" : ""}><span>تحليلات الاستخدام</span></label></div>
    <div class="opt"><label class="check"><input type="checkbox" id="mk" ${c.marketing ? "checked" : ""}><span>تسويق وقياس الحملات</span></label></div>
    <p class="sub">يمكنك تغيير اختيارك أو سحب موافقتك في أي وقت من أسفل الصفحة.</p>
    <div class="actions"><button class="btn primary" type="submit">حفظ الاختيار</button><button class="btn" type="button" id="cx">إلغاء</button></div></form>`;
  d.showModal();
  $("#cx").onclick = () => d.close();
  $("#cf").onsubmit = () => { setConsent({ analytics: $("#an").checked, marketing: $("#mk").checked }); toast("حُفظت إعدادات الكوكيز"); };
}

// ───────── التوجيه ─────────
async function route() {
  renderHeader();
  const [, page, arg] = location.hash.split("/");
  try {
    if (page === "case") await casePage(arg);
    else if (page === "inventory") await inventory();
    else if (page === "wallet") await wallet();
    else if (page === "fairness") fairness();
    else await home();
  } catch (e) {
    $("#view").innerHTML = `<p class="empty">${esc(errText(e))}<br><br><a class="btn" href="#/">العودة إلى الصناديق</a></p>`;
  }
  if (!location.hash.startsWith("#case-list")) window.scrollTo(0, 0);
}

addEventListener("hashchange", (e) => { if (!location.hash.startsWith("#case-list")) route(); });
$("#cookie-settings").addEventListener("click", cookieSettings);

(async () => {
  const cfg = await api("/config");
  state.sandbox = cfg.sandbox; $("#sandbox").hidden = !cfg.sandbox;
  await refreshMe();
  await route();
  if (!getConsent()) consentBanner();
})();
