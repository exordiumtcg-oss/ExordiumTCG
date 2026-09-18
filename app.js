const API_URL=""https://script.google.com/macros/s/AKfycbyaNd6MyhbsrlJIATUQcagVkk7AjO0j2kYOAZ7fbbaai1FptfIJHksqb2asPhZ5HlUlAA/exec";
let state={token:null,user:null,sets:[],cards:[],owned:new Set(),currentSet:"",allOwned:0};

const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
function toast(msg){$("toast").textContent=msg;$("toast").style.display="block";setTimeout(()=>$("toast").style.display="none",2800)}
async function api(action,data={}){if(API_URL.startsWith("PASTE_"))throw new Error("Connect the Google Apps Script URL in app.js first.");const r=await fetch(API_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action,...data,token:state.token})});const j=await r.json();if(!j.ok)throw new Error(j.error||"Request failed");return j}

document.querySelectorAll(".auth-tab").forEach(b=>b.onclick=()=>showAuth(b.dataset.auth));
function showAuth(mode){document.querySelectorAll(".auth-tab").forEach(b=>b.classList.toggle("active",b.dataset.auth===mode));$("loginForm").hidden=mode!=="login";$("registerForm").hidden=mode!=="register"}
$("loginForm").onsubmit=async e=>{e.preventDefault();try{const j=await api("login",{identity:$("loginIdentity").value.trim(),password:$("loginPassword").value});state.token=j.token;state.user=j.user;localStorage.setItem("pokemonToken",state.token);await boot()}catch(x){toast(x.message)}};
$("loginPassword").onkeydown=e=>{if(e.key==="Enter")$("loginForm").requestSubmit()};
$("registerForm").onsubmit=async e=>{e.preventDefault();if($("regPassword").value!==$("regPassword2").value)return toast("Passwords do not match.");try{await api("register",{username:$("regUsername").value.trim(),name:$("regName").value.trim(),email:$("regEmail").value.trim(),phone:$("regPhone").value.trim(),password:$("regPassword").value});toast("Account created. Please log in.");showAuth("login");$("loginIdentity").value=$("regUsername").value.trim()}catch(x){toast(x.message)}};

async function boot(){
 $("authView").hidden=true;$("appView").hidden=false;
 try{const j=await api("bootstrap");state.sets=j.sets;renderSets();await loadSet(state.sets.at(-1)?.name);await loadTotals()}catch(x){toast(x.message)}
}
function renderSets(){const s=$("setSelect");s.innerHTML=state.sets.map(x=>`<option value="${esc(x.name)}">${esc(x.name)}</option>`).join("");s.onchange=()=>loadSet(s.value);$("openLatestBtn").onclick=()=>loadSet(state.sets.at(-1)?.name)}
async function loadSet(name){
 if(!name)return;state.currentSet=name;$("setSelect").value=name;
 try{const j=await api("cards",{setName:name});state.cards=j.cards;state.owned=new Set(j.owned);
  $("setTitle").textContent=name;$("setMeta").textContent=`${state.cards.length} cards in this series`;
  $("featureTitle").textContent=name;$("featureChip").textContent=j.cards[0]?.setCode||"SET";
  $("featureOwned").textContent=state.owned.size;$("featureTotal").textContent=state.cards.length;
  if(j.cards[0]?.imageUrl)$("featureImage").src=j.cards[0].imageUrl; else $("featureImage").removeAttribute("src");
  renderRarities();renderCards();renderProgress();
 }catch(x){toast(x.message)}
}
function renderRarities(){const values=[...new Set(state.cards.map(c=>c.rarity).filter(Boolean))].sort();$("raritySelect").innerHTML='<option value="">All Rarities</option>'+values.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("")}
function filteredCards(){const q=$("search").value.trim().toLowerCase(),r=$("raritySelect").value,s=$("sortSelect").value;
 let a=state.cards.filter(c=>(!q||String(c.id).toLowerCase().includes(q)||String(c.name).toLowerCase().includes(q))&&(!r||c.rarity===r));
 a.sort((x,y)=>s==="name"?x.name.localeCompare(y.name):String(x.id).localeCompare(String(y.id),undefined,{numeric:true}));
 return a
}
function renderCards(){const a=filteredCards();$("cards").innerHTML=a.map(c=>`<article class="card-item ${state.owned.has(String(c.id))?"owned":""}">
 <div class="card-img">${state.owned.has(String(c.id))?'<span class="owned-badge">OWNED</span>':""}<img loading="lazy" src="${esc(c.imageUrl)}" alt="${esc(c.name)}" onerror="this.style.opacity=.15"></div>
 <div class="card-name" title="${esc(c.name)}">${esc(c.name)}</div><div class="card-number">${esc(c.id)} / ${esc(c.totalSetNumber)}</div>
 <div class="card-bottom"><span class="rarity">${esc(c.rarity||"")}</span><label class="check"><input type="checkbox" data-id="${esc(c.id)}" ${state.owned.has(String(c.id))?"checked":""}> Owned</label></div></article>`).join("");
 $("empty").hidden=a.length>0;document.querySelectorAll(".check input").forEach(x=>x.onchange=()=>toggleOwned(x.dataset.id,x.checked))}
async function toggleOwned(id,checked){if(checked)state.owned.add(String(id));else state.owned.delete(String(id));renderCards();renderProgress();try{await api("setOwned",{setName:state.currentSet,cardId:String(id),owned:checked});loadTotals()}catch(x){toast(x.message)}}
function renderProgress(){const total=state.cards.length,owned=state.owned.size,p=total?Math.round(owned/total*100):0;$("setPercent").textContent=p+"%";$("progressBar").style.width=p+"%";$("featureOwned").textContent=owned;$("featureTotal").textContent=total}
async function loadTotals(){try{const j=await api("collectionStats");state.allOwned=j.owned;$("totalCards").textContent=j.total;$("totalOwned").textContent=j.owned;$("totalMissing").textContent=Math.max(0,j.total-j.owned);$("totalPercent").textContent=(j.total?Math.round(j.owned/j.total*100):0)+"%"}catch(e){}}
$("search").oninput=renderCards;$("raritySelect").onchange=renderCards;$("sortSelect").onchange=renderCards;
$("syncBtn").onclick=async()=>{try{await loadSet(state.currentSet);await loadTotals();toast("Synced with Google Sheets.")}catch(e){toast(e.message)}};
$("logoutBtn").onclick=()=>{localStorage.removeItem("pokemonToken");location.reload()};
$("themeBtn").onclick=()=>document.body.classList.toggle("light");
document.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();$("search").focus()}});
$("settingsBtn").onclick=async()=>{try{const j=await api("adminUsers");$("usersTable").innerHTML=j.users.map(u=>`<div class="user-row"><div><b>${esc(u.username)}</b><div class="muted">${esc(u.name)}</div></div><div>${esc(u.email)}</div><div>${esc(u.phone)}</div><div>${esc(u.role)}</div><button class="mini" onclick="resetUser('${esc(u.username)}')">Reset password</button><button class="danger" onclick="deleteUser('${esc(u.username)}')">Delete</button></div>`).join("");$("adminModal").hidden=false}catch(e){toast(e.message)}};
$("closeAdmin").onclick=()=>$("adminModal").hidden=true;
window.resetUser=async u=>{const p=prompt(`New password for ${u}:`);if(!p)return;try{await api("adminResetPassword",{username:u,newPassword:p});toast("Password reset.")}catch(e){toast(e.message)}};
window.deleteUser=async u=>{if(!confirm(`Delete ${u}?`))return;try{await api("adminDeleteUser",{username:u});$("settingsBtn").click();toast("User deleted.")}catch(e){toast(e.message)}};
document.querySelectorAll(".nav-item[data-nav]").forEach(b=>b.onclick=()=>{document.querySelectorAll(".nav-item[data-nav]").forEach(x=>x.classList.remove("active"));b.classList.add("active");if(b.dataset.nav==="cards"||b.dataset.nav==="collections")document.querySelector(".card-grid").scrollIntoView({behavior:"smooth"})});

(async()=>{const t=localStorage.getItem("pokemonToken");if(t){state.token=t;try{const j=await api("me");state.user=j.user; if(state.user.role==="admin")$("settingsBtn").hidden=false;await boot()}catch(e){localStorage.removeItem("pokemonToken")}}})();
