const SECRET_KEY='EXOEXO';
const ADMIN_USERNAME='admin';
const ADMIN_PASSWORD='12345678';
const TOKEN_TTL_SECONDS=21600;

function doGet(){return json({ok:true,service:'EXORDIUM Pokémon Card Checklist'})}
function doPost(e){try{const b=JSON.parse(e.postData.contents||'{}');return json({ok:true,...route(b)})}catch(err){return json({ok:false,error:String(err.message||err)})}}
function json(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)}
function ss(){return SpreadsheetApp.getActiveSpreadsheet()}
function sh(n){return ss().getSheetByName(n)}
function ensureSheet(n,h){let s=sh(n);if(!s)s=ss().insertSheet(n);if(s.getLastRow()===0)s.appendRow(h);return s}
function ensureSchema(){
 ensureSheet('Users',['Username','Name','Email','Phone','Password Hash','Role','Created At']);
 ensureSheet('Owned',['Username','Set Name','Card ID','Owned','Updated At']);
 const s=sh('Users'),r=s.getDataRange().getValues();
 if(r.length<2)s.appendRow([ADMIN_USERNAME,'Administrator','admin@example.com','',hashPassword(ADMIN_PASSWORD),'admin',new Date()]);
 else{const i=r.findIndex((x,n)=>n>0&&String(x[0]).toLowerCase()===ADMIN_USERNAME);if(i<0)s.appendRow([ADMIN_USERNAME,'Administrator','admin@example.com','',hashPassword(ADMIN_PASSWORD),'admin',new Date()])}
}
function route(b){ensureSchema();switch(b.action){
 case'register':return register(b);case'login':return login(b);case'me':return {user:auth(b).user};
 case'bootstrap':auth(b);return {sets:ss().getSheets().map(s=>s.getName()).filter(n=>!['Users','Owned'].includes(n)).map(name=>({name}))};
 case'cards':return cards(b);case'setOwned':return setOwned(b);case'collectionStats':return stats(b);
 case'adminUsers':requireAdmin(b);return {users:listUsers()};case'adminResetPassword':requireAdmin(b);return adminResetPassword(b);case'adminDeleteUser':requireAdmin(b);return adminDeleteUser(b);
 default:throw new Error('Unknown action')}
}
function register(b){
 ['username','name','email','phone','password'].forEach(k=>{if(!String(b[k]||'').trim())throw new Error(k+' is required')});
 if(String(b.password).length<8)throw new Error('Password must be at least 8 characters.');
 const s=sh('Users'),r=s.getDataRange().getValues(),u=String(b.username).trim().toLowerCase(),e=String(b.email).trim().toLowerCase(),p=String(b.phone).trim();
 if(r.slice(1).some(x=>String(x[0]).toLowerCase()===u))throw new Error('Username already exists.');
 if(r.slice(1).some(x=>String(x[2]).toLowerCase()===e))throw new Error('Email already exists.');
 if(r.slice(1).some(x=>String(x[3])===p))throw new Error('Phone number already exists.');
 s.appendRow([String(b.username).trim(),String(b.name).trim(),e,p,hashPassword(b.password),'user',new Date()]);return{}
}
function login(b){
 const id=String(b.identity||'').trim().toLowerCase(),p=String(b.password||''),r=sh('Users').getDataRange().getValues().slice(1);
 const x=r.find(a=>String(a[0]).toLowerCase()===id||String(a[2]).toLowerCase()===id||String(a[3]).toLowerCase()===id);
 if(!x||x[4]!==hashPassword(p))throw new Error('Invalid login credentials.');
 const user={username:x[0],name:x[1],email:x[2],phone:x[3],role:x[5]};
 const token=Utilities.getUuid()+'-'+Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,user.username+Date.now()+SECRET_KEY));
 CacheService.getScriptCache().put('token:'+token,JSON.stringify(user),TOKEN_TTL_SECONDS);return{token,user}
}
function auth(b){const t=String(b.token||'');if(!t)throw new Error('Not authenticated.');const r=CacheService.getScriptCache().get('token:'+t);if(!r)throw new Error('Session expired.');return{user:JSON.parse(r)}}
function requireAdmin(b){const a=auth(b);if(a.user.role!=='admin')throw new Error('Admin only.');return a}
function cards(b){
 const a=auth(b),n=String(b.setName||'');if(!n||['Users','Owned'].includes(n))throw new Error('Invalid set.');
 const s=sh(n);if(!s)throw new Error('Set not found.');const v=s.getDataRange().getValues();const h=v.shift(),ix=Object.fromEntries(h.map((x,i)=>[String(x).trim(),i]));
 const cs=v.filter(r=>r[ix['ID']]!=='').map(r=>({id:String(r[ix['ID']]),name:String(r[ix['Card Name']]),setCode:String(r[ix['Set Code']]),totalSetNumber:String(r[ix['Total Set Number']]),rarity:String(r[ix['Rarity']]),imageUrl:String(r[ix['Image URL']])}));
 const o=sh('Owned').getDataRange().getValues().slice(1).filter(r=>String(r[0])===a.user.username&&String(r[1])===n&&String(r[3]).toLowerCase()==='true').map(r=>String(r[2]));
 return{cards:cs,owned:o}
}
function setOwned(b){
 const a=auth(b),s=sh('Owned'),r=s.getDataRange().getValues(),n=String(b.setName),id=String(b.cardId),i=r.findIndex((x,k)=>k>0&&String(x[0])===a.user.username&&String(x[1])===n&&String(x[2])===id);
 if(i>0){s.getRange(i+1,4).setValue(!!b.owned);s.getRange(i+1,5).setValue(new Date())}else s.appendRow([a.user.username,n,id,!!b.owned,new Date()]);return{}
}
function stats(b){
 const a=auth(b),names=ss().getSheets().map(s=>s.getName()).filter(n=>!['Users','Owned'].includes(n));let total=0;
 names.forEach(n=>{const s=sh(n);if(s&&s.getLastRow()>1)total+=s.getLastRow()-1});
 const o=sh('Owned').getDataRange().getValues().slice(1).filter(r=>String(r[0])===a.user.username&&String(r[3]).toLowerCase()==='true');
 return{total,owned:o.length}
}
function listUsers(){return sh('Users').getDataRange().getValues().slice(1).filter(r=>r[0]).map(r=>({username:r[0],name:r[1],email:r[2],phone:r[3],role:r[5]}))}
function adminResetPassword(b){const u=String(b.username).toLowerCase(),p=String(b.newPassword||'');if(p.length<8)throw new Error('Password must be at least 8 characters.');const s=sh('Users'),r=s.getDataRange().getValues(),i=r.findIndex((x,n)=>n>0&&String(x[0]).toLowerCase()===u);if(i<0)throw new Error('User not found.');s.getRange(i+1,5).setValue(hashPassword(p));return{}}
function adminDeleteUser(b){const u=String(b.username).toLowerCase();if(u===ADMIN_USERNAME)throw new Error('Admin cannot be deleted.');const s=sh('Users'),r=s.getDataRange().getValues(),i=r.findIndex((x,n)=>n>0&&String(x[0]).toLowerCase()===u);if(i<0)throw new Error('User not found.');s.deleteRow(i+1);const o=sh('Owned'),or=o.getDataRange().getValues();for(let j=or.length-1;j>0;j--)if(String(or[j][0]).toLowerCase()===u)o.deleteRow(j+1);return{}}
function hashPassword(p){const b=Utilities.computeHmacSha256Signature(String(p),SECRET_KEY);return b.map(x=>{x=x<0?x+256:x;const h=x.toString(16);return h.length===1?'0'+h:h}).join('')}
