
// PWA installation support
let deferredInstallPrompt = null;
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  const btn = document.getElementById("installBtn");
  if (btn) btn.hidden = false;
});
window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  const btn = document.getElementById("installBtn");
  if (btn) btn.hidden = true;
});
document.addEventListener("click", async (event) => {
  if (event.target && event.target.id === "installBtn") {
    if (!deferredInstallPrompt) {
      const help = document.getElementById("installHelp");
      if (help) {
        help.hidden = false;
        help.textContent = "إذا لم يظهر التثبيت، افتح قائمة المتصفح ⋮ ثم اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».";
      }
      return;
    }
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    event.target.hidden = true;
  }
});

const SUPABASE_URL="https://novkheywufddqqoigxqe.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_EKXv02mF9-otOGhnG4CYpw_x4KLPffX"; // replace if rotated
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const SESSION_KEY="freedom_village_session_v3";
let sessionToken=localStorage.getItem(SESSION_KEY)||"";
let currentUser=null;
let cache={news:[],prayers:[],services:[],events:[],emergency:[],complaints:[],suggestions:[]};

const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const today=()=>new Date().toISOString().slice(0,10);

function setMsg(id,msg,ok=false){const el=$(id);el.textContent=msg;el.className=ok?"success":"error"}
function fmtDate(d){return new Intl.DateTimeFormat("ar-SY",{dateStyle:"full"}).format(d)}
function tick(){
  const d=new Date();
  $("clock").textContent=new Intl.DateTimeFormat("ar-SY",{hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(d);
  $("gregorianDate").textContent=fmtDate(d);
  try{$("hijriDate").textContent=new Intl.DateTimeFormat("ar-SA-u-ca-islamic",{dateStyle:"full"}).format(d)}catch{}
  updateOnline();
}
function updateOnline(){ $("onlineState").textContent=navigator.onLine?"متصل":"دون اتصال"; $("onlineState").style.background=navigator.onLine?"#e5f7ef":"#fff0e9"; $("onlineState").style.color=navigator.onLine?"#087f5b":"#a24d2b" }
setInterval(tick,1000);tick();
window.addEventListener("online",updateOnline);window.addEventListener("offline",updateOnline);

async function rpc(name,args={}){
  const {data,error}=await sb.rpc(name,args);
  if(error) throw new Error(error.message||"تعذر الاتصال بالخادم");
  return data;
}
async function publicGet(table,order="created_at"){
  const q=sb.from(table).select("*");
  if(order)q.order(order,{ascending:false});
  const {data,error}=await q;
  if(error)throw new Error(error.message);
  return data||[];
}

async function login(code){
  if(!code)throw new Error("أدخل رمز الدخول");
  const data=await rpc("login_by_code",{p_code:code});
  if(!data?.length)throw new Error("رمز الدخول غير صحيح");
  const u=data[0];
  sessionToken=u.session_token;
  localStorage.setItem(SESSION_KEY,sessionToken);
  currentUser={id:u.user_id,role:u.role,name:u.display_name};
  $("welcomeName").textContent=currentUser.name||"مرحباً";
  $("adminNav").hidden=currentUser.role!=="admin";
  $("loginView").classList.add("hidden");
  $("mainView").classList.remove("hidden");
  await loadAll();
}
async function restoreSession(){
  if(!sessionToken)return;
  try{
    const data=await rpc("validate_session",{p_token:sessionToken});
    if(!data?.length)throw new Error("expired");
    const u=data[0];currentUser={id:u.user_id,role:u.role,name:u.display_name};
    $("welcomeName").textContent=currentUser.name||"مرحباً";
    $("adminNav").hidden=currentUser.role!=="admin";
    $("loginView").classList.add("hidden");$("mainView").classList.remove("hidden");
    await loadAll();
  }catch{sessionToken="";localStorage.removeItem(SESSION_KEY)}
}
$("loginForm").addEventListener("submit",async e=>{
  e.preventDefault();$("loginError").textContent="جارٍ التحقق…";
  try{await login($("accessCode").value.trim())}catch(err){$("loginError").textContent=err.message}
});
$("logoutBtn").onclick=async()=>{
  try{if(sessionToken)await rpc("logout_session",{p_token:sessionToken})}catch{}
  localStorage.removeItem(SESSION_KEY);location.reload();
};

document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>{
  if(b.hidden)return;showTab(b.dataset.tab);
}));
function showTab(id){
  document.querySelectorAll(".tab-section").forEach(x=>x.classList.remove("active"));
  $(id).classList.add("active");
  document.querySelectorAll(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.tab===id));
  window.scrollTo({top:0,behavior:"smooth"});
}
document.querySelectorAll(".admin-tabs .chip").forEach(b=>b.addEventListener("click",()=>{
  document.querySelectorAll(".admin-tabs .chip").forEach(x=>x.classList.remove("active"));
  document.querySelectorAll(".admin-panel").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");$(b.dataset.panel).classList.add("active");
}));

async function loadAll(){
  try{
    [cache.news,cache.prayers,cache.services,cache.events,cache.emergency]=await Promise.all([
      publicGet("news"),publicGet("prayer_times","prayer_date"),publicGet("services"),
      publicGet("events","event_at"),publicGet("emergency_contacts")
    ]);
    renderAllPublic();
    const {data:settings,error}=await sb.from("app_settings").select("value").eq("key","about").maybeSingle();
    if(!error)$("aboutText").textContent=settings?.value||"لا توجد معلومات مضافة بعد.";
    if(currentUser.role==="admin")await loadAdmin();
    else await loadMine();
  }catch(err){console.error(err);toast(err.message)}
}
function renderAllPublic(){renderNews();renderPrayer();renderServices();renderEvents();renderEmergency()}
function renderNews(){
  $("newsList").innerHTML=cache.news.length?cache.news.map(x=>`<article class="item"><h3>${esc(x.title)}</h3><p>${esc(x.body)}</p><small>${esc(x.created_at?.slice(0,10)||"")}</small></article>`).join(""):`<div class="item">لا توجد أخبار حالياً.</div>`;
  $("newsPreview").textContent=cache.news[0]?.title||"لا توجد أخبار حالياً.";
}
function renderPrayer(){
  const p=cache.prayers.find(x=>x.prayer_date===today())||cache.prayers[0];
  const labels={fajr:"الفجر",sunrise:"الشروق",dhuhr:"الظهر",asr:"العصر",maghrib:"المغرب",isha:"العشاء"};
  $("prayerList").innerHTML=p?Object.keys(labels).map(k=>`<div class="item prayer"><span>${labels[k]}</span><strong>${esc(p[k]||"—")}</strong></div>`).join(""):`<div class="item">لم تُدخل أوقات الصلاة بعد.</div>`;
  $("nextPrayer").textContent=p?nextPrayerText(p):"لم تُدخل أوقات الصلاة بعد.";
}
function nextPrayerText(p){
  const labels={fajr:"الفجر",sunrise:"الشروق",dhuhr:"الظهر",asr:"العصر",maghrib:"المغرب",isha:"العشاء"};
  const now=new Date();let best=null;
  for(const k of Object.keys(labels)){if(!p[k])continue;const [h,m]=p[k].split(":").map(Number);const d=new Date(now);d.setHours(h,m,0,0);if(d>now){best=[k,d];break}}
  if(!best)return"انتهت أوقات اليوم أو لم تُدخل كاملة.";
  const diff=best[1]-now, hours=Math.floor(diff/3600000), mins=Math.ceil((diff%3600000)/60000);
  return`الصلاة القادمة: ${labels[best[0]]} الساعة ${p[best[0]]} • بعد ${hours?hours+" ساعة ":""}${mins} دقيقة`;
}
function renderServices(){$("servicesList").innerHTML=cache.services.length?cache.services.map(x=>`<article class="card glass"><h3>${esc(x.name)}</h3><p>${esc(x.description||"")}</p></article>`).join(""):`<div class="item">لا توجد خدمات مضافة بعد.</div>`}
function renderEvents(){$("eventsList").innerHTML=cache.events.length?cache.events.map(x=>`<article class="item"><h3>${esc(x.title)}</h3><p>${esc(x.description||"")}</p><small>${esc(x.event_at||"")}</small></article>`).join(""):`<div class="item">لا توجد فعاليات مضافة بعد.</div>`}
function renderEmergency(){$("emergencyList").innerHTML=cache.emergency.length?cache.emergency.map(x=>`<article class="card glass"><h3>${esc(x.name)}</h3><p>${esc(x.description||"")}</p><a href="tel:${esc(x.phone)}"><b>${esc(x.phone)}</b></a></article>`).join(""):`<div class="item">لا توجد جهات اتصال مضافة بعد.</div>`}

async function loadMine(){
  const [c,s]=await Promise.all([
    rpc("get_my_complaints",{p_token:sessionToken}),
    rpc("get_my_suggestions",{p_token:sessionToken})
  ]);
  cache.complaints=c||[];cache.suggestions=s||[];renderMine();
}
function renderMine(){
  $("myComplaints").innerHTML=cache.complaints.length?cache.complaints.map(x=>`<article class="item"><h3>${esc(x.reference_no)} — ${esc(x.title)}</h3><p>${esc(x.body)}</p><small>الحالة: ${esc(x.status)} • ${esc(x.created_at?.slice(0,10)||"")}</small></article>`).join(""):`<div class="item">لا توجد شكاوى بعد.</div>`;
  $("mySuggestions").innerHTML=cache.suggestions.length?cache.suggestions.map(x=>`<article class="item"><h3>${esc(x.title)}</h3><p>${esc(x.body)}</p><small>الحالة: ${esc(x.status)} • ${esc(x.created_at?.slice(0,10)||"")}</small></article>`).join(""):`<div class="item">لا توجد مقترحات بعد.</div>`;
}
$("complaintForm").addEventListener("submit",async e=>{
  e.preventDefault();
  try{const d=await rpc("submit_complaint",{p_token:sessionToken,p_title:$("complaintTitle").value.trim(),p_body:$("complaintBody").value.trim()});e.target.reset();setMsg("complaintMsg",`تم إرسال الشكوى. رقم المتابعة: ${d?.[0]?.reference_no||"—"}`,true);await loadMine()}catch(err){setMsg("complaintMsg",err.message)}
});
$("suggestionForm").addEventListener("submit",async e=>{
  e.preventDefault();
  try{await rpc("submit_suggestion",{p_token:sessionToken,p_title:$("suggestionTitle").value.trim(),p_body:$("suggestionBody").value.trim()});e.target.reset();setMsg("suggestionMsg","تم إرسال المقترح بنجاح.",true);await loadMine()}catch(err){setMsg("suggestionMsg",err.message)}
});

async function loadAdmin(){
  const [news,prayers,services,events,emergency,cases,suggestions,settings]=await Promise.all([
    publicGet("news"),publicGet("prayer_times","prayer_date"),publicGet("services"),
    publicGet("events","event_at"),publicGet("emergency_contacts"),
    rpc("admin_get_complaints",{p_token:sessionToken}),rpc("admin_get_suggestions",{p_token:sessionToken}),
    sb.from("app_settings").select("value").eq("key","about").maybeSingle()
  ]);
  cache.news=news;cache.prayers=prayers;cache.services=services;cache.events=events;cache.emergency=emergency;
  cache.complaints=cases||[];cache.suggestions=suggestions||[];
  $("aboutInput").value=settings?.data?.value||"";
  renderAllPublic();renderAdmin();
}
function renderAdmin(){
  $("stats").innerHTML=[
    ["الأخبار",cache.news.length],["الشكاوى",cache.complaints.length],
    ["المقترحات",cache.suggestions.length],["الخدمات",cache.services.length]
  ].map(([a,b])=>`<div class="card glass stats-card"><span>${a}</span><strong style="display:block;font-size:30px;margin-top:8px">${b}</strong></div>`).join("");
  $("adminNewsList").innerHTML=cache.news.map(x=>`<div class="item"><b>${esc(x.title)}</b><p>${esc(x.body)}</p></div>`).join("")||`<div class="item">لا توجد أخبار.</div>`;
  $("adminPrayerList").innerHTML=cache.prayers.map(x=>`<div class="item"><b>${esc(x.prayer_date)}</b><p>${["fajr","sunrise","dhuhr","asr","maghrib","isha"].map(k=>`${k}: ${esc(x[k]||"—")}`).join(" • ")}</p></div>`).join("")||`<div class="item">لا توجد أوقات.</div>`;
  $("adminServicesList").innerHTML=cache.services.map(x=>`<div class="item"><b>${esc(x.name)}</b><p>${esc(x.description||"")}</p></div>`).join("")||`<div class="item">لا توجد خدمات.</div>`;
  $("adminEventsList").innerHTML=cache.events.map(x=>`<div class="item"><b>${esc(x.title)}</b><p>${esc(x.event_at||"")}</p><p>${esc(x.description||"")}</p></div>`).join("")||`<div class="item">لا توجد فعاليات.</div>`;
  $("adminEmergencyList").innerHTML=cache.emergency.map(x=>`<div class="item"><b>${esc(x.name)}</b><p>${esc(x.phone)}</p><p>${esc(x.description||"")}</p></div>`).join("")||`<div class="item">لا توجد جهات اتصال.</div>`;
  $("adminComplaintList").innerHTML=cache.complaints.map(x=>`<div class="item"><b>${esc(x.reference_no)} — ${esc(x.title)}</b><p>${esc(x.body)}</p><label>الحالة<select data-case="${esc(x.id)}" class="case-status"><option ${x.status==="جديدة"?"selected":""}>جديدة</option><option ${x.status==="قيد المراجعة"?"selected":""}>قيد المراجعة</option><option ${x.status==="قيد المعالجة"?"selected":""}>قيد المعالجة</option><option ${x.status==="تم الحل"?"selected":""}>تم الحل</option><option ${x.status==="مغلقة"?"selected":""}>مغلقة</option></select></label></div>`).join("")||`<div class="item">لا توجد شكاوى.</div>`;
  $("adminSuggestionList").innerHTML=cache.suggestions.map(x=>`<div class="item"><b>${esc(x.title)}</b><p>${esc(x.body)}</p><small>الحالة: ${esc(x.status)}</small></div>`).join("")||`<div class="item">لا توجد مقترحات.</div>`;
  document.querySelectorAll(".case-status").forEach(sel=>sel.addEventListener("change",async e=>{
    try{await rpc("admin_update_complaint_status",{p_token:sessionToken,p_complaint_id:e.target.dataset.case,p_status:e.target.value});toast("تم تحديث حالة الشكوى")}catch(err){toast(err.message)}
  }));
}
async function adminAction(name,args){
  try{await rpc(name,{p_token:sessionToken,...args});await loadAdmin();toast("تم الحفظ بنجاح")}catch(err){toast(err.message)}
}
$("newsForm").addEventListener("submit",async e=>{e.preventDefault();await adminAction("admin_create_news",{p_title:$("newsTitle").value.trim(),p_body:$("newsBody").value.trim()});e.target.reset()});
$("prayerForm").addEventListener("submit",async e=>{e.preventDefault();await adminAction("admin_save_prayer",{p_prayer_date:$("prayerDate").value,p_fajr:$("fajr").value||null,p_sunrise:$("sunrise").value||null,p_dhuhr:$("dhuhr").value||null,p_asr:$("asr").value||null,p_maghrib:$("maghrib").value||null,p_isha:$("isha").value||null});e.target.reset()});
$("serviceForm").addEventListener("submit",async e=>{e.preventDefault();await adminAction("admin_create_service",{p_name:$("serviceName").value.trim(),p_description:$("serviceDescription").value.trim()});e.target.reset()});
$("eventForm").addEventListener("submit",async e=>{e.preventDefault();await adminAction("admin_create_event",{p_title:$("eventTitle").value.trim(),p_event_at:$("eventDate").value||null,p_description:$("eventDescription").value.trim()});e.target.reset()});
$("emergencyForm").addEventListener("submit",async e=>{e.preventDefault();await adminAction("admin_create_emergency",{p_name:$("emergencyName").value.trim(),p_phone:$("emergencyPhone").value.trim(),p_description:$("emergencyDescription").value.trim()});e.target.reset()});
$("settingsForm").addEventListener("submit",async e=>{e.preventDefault();await adminAction("admin_set_about",{p_value:$("aboutInput").value.trim()})});

function toast(msg){
  let el=$("toast");if(!el){el=document.createElement("div");el.id="toast";el.style.cssText="position:fixed;z-index:100;left:50%;bottom:105px;transform:translateX(-50%);background:#10251e;color:#fff;padding:12px 16px;border-radius:14px;font-weight:800;max-width:90%;text-align:center";document.body.appendChild(el)}
  el.textContent=msg;clearTimeout(window.__toast);window.__toast=setTimeout(()=>el.remove(),3000);
}
if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
restoreSession();
