(() => {
"use strict";
const cfg=window.GOPLAN_CONFIG||{};
const API=String(cfg.apiBase||"").replace(/\/+$/,"");
const $=id=>document.getElementById(id);
const state={idToken:"",user:null,revision:0,timer:null,pollTimer:null,syncing:false,suppress:false,lastSnapshot:null,messages:[],watches:[],itinerary:null};
const styles=document.createElement("style");
styles.textContent=`#goplanAccount{display:flex;align-items:center;gap:8px;margin-left:4px}#goplanCloudStatus{font-size:11px;color:var(--muted);max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#goplanLoginSlot{min-width:40px;min-height:40px}#goplanLogout{border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--ink);padding:9px 12px;font-size:12px;font-weight:650}#goplanCloudPanel{border:1px solid var(--line);border-radius:13px;background:var(--accent-soft);padding:12px;margin:12px 0;color:var(--ink);font-size:12px}#goplanCloudPanel button,#goplanChatSend,#goplanPlaceSearchBtn,#goplanPushBtn{border:0;border-radius:11px;background:var(--accent);color:white;padding:10px 13px;font-weight:700;font-size:12px}#goplanAiTools{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}#goplanAiTools button{border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--ink);padding:10px;font-size:12px;font-weight:650}#goplanChatLog{display:grid;gap:9px;max-height:260px;overflow:auto;margin:12px 0;padding:2px}.goplan-chat-msg{padding:10px 12px;border-radius:13px;background:var(--accent-soft);font-size:12px;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere}.goplan-chat-msg.user{background:var(--card);border:1px solid var(--line)}#goplanChatForm{display:flex;gap:7px;align-items:flex-end}#goplanChatInput,#goplanPlaceQuery{width:100%;min-width:0;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:12px;padding:10px 12px;font:inherit;font-size:13px}#goplanChatInput{min-height:44px;max-height:110px;resize:vertical}#goplanPlaceSearch{display:grid;gap:8px;margin:14px 0}#goplanPlaceResults{display:grid;gap:9px;margin:10px 0}.goplan-place-card{display:grid;grid-template-columns:88px 1fr;gap:10px;align-items:start;border:1px solid var(--line);background:var(--card);border-radius:13px;padding:9px}.goplan-place-card img{width:88px;height:88px;object-fit:cover;border-radius:10px;background:var(--accent-soft)}.goplan-place-card strong{font-size:12px;line-height:1.4;display:block}.goplan-place-card p{font-size:10px;color:var(--muted);line-height:1.5;margin:4px 0}.goplan-place-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}.goplan-place-actions button,.goplan-place-actions a{border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink);padding:6px 8px;font-size:10px;text-decoration:none}
#goplanProfileBtn{border:1px solid var(--line);border-radius:11px;background:var(--card);color:var(--ink);padding:9px 11px;font-size:11px;font-weight:650}
#goplanProfileModal{position:fixed;z-index:70;inset:0;background:#10182799;display:flex;align-items:center;justify-content:center;padding:18px}
#goplanProfileModal[hidden]{display:none}
#goplanProfileCard{width:min(480px,100%);max-height:88vh;overflow:auto;background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:20px;padding:20px;box-shadow:0 20px 60px #0003}
#goplanProfileCard h2{font-size:18px;margin:0 0 12px}
#goplanProfileCard p{font-size:11px;color:var(--muted);line-height:1.7}
#goplanProfileCard button{border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--ink);padding:8px 10px;font-size:11px}
#goplanProfileIdentity{display:flex;gap:12px;align-items:center;margin:10px 0 16px}
#goplanProfileAvatar{width:52px;height:52px;object-fit:cover;border-radius:50%;background:var(--accent-soft)}
#goplanProfileActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
#goplanProfileMemories{display:grid;gap:7px;max-height:130px;overflow:auto}
.goplan-memory-row{display:flex;gap:8px;align-items:start;padding:8px;border:1px solid var(--line);border-radius:10px;font-size:11px}
.goplan-memory-row span{flex:1;line-height:1.5}
#goplanProfileCard .goplan-danger{border-color:#e5b6b6;color:#a33;background:#fff4f4}
@media(max-width:760px){#goplanProfileBtn{padding:8px 9px}#goplanAccount{gap:5px}}#goplanPushState,#goplanWatchList{font-size:11px;color:var(--muted);line-height:1.6;margin-top:8px}@media(max-width:760px){#goplanAccount{margin-left:auto}#goplanCloudStatus{display:none}#goplanLoginSlot{min-width:38px}}`;
document.head.appendChild(styles);
function status(message,isError){const node=$("goplanCloudStatus");if(node){node.textContent=message;node.title=message;node.style.color=isError?"#b54747":"var(--muted)";}const panel=$("goplanCloudText");if(panel)panel.textContent=message;}
function apiUrl(path){if(!API)throw new Error("APIの接続先が未設定です。config.js の apiBase を設定してください。");return API+path;}
async function api(path,options){if(!state.idToken)throw new Error("先にGoogleアカウントでログインしてください。");const response=await fetch(apiUrl(path),{...(options||{}),headers:{"Content-Type":"application/json","Authorization":"Bearer "+state.idToken,...((options&&options.headers)||{})}});let payload={};try{payload=await response.json();}catch{}if(!response.ok){const error=new Error(payload.message||payload.error||"通信に失敗しました。");error.status=response.status;error.payload=payload;throw error;}return payload;}
function decodeJwt(token){try{const part=token.split(".")[1].replace(/-/g,"+").replace(/_/g,"/");return JSON.parse(decodeURIComponent(escape(atob(part))));}catch{return {};}}
function clone(value){return JSON.parse(JSON.stringify(value||{}));}
function stripStamp(item){const result={...item};delete result._updatedAt;return JSON.stringify(result);}
function snapshotCloud(){return clone(window.GoPlanApp.getCloudState());}
function mergeCollection(localItems,remoteItems,tombstones,collection){const merged=new Map();for(const item of [...(remoteItems||[]),...(localItems||[])]){if(!item||!item.id)continue;const previous=merged.get(item.id);if(!previous||Number(item._updatedAt||0)>=Number(previous._updatedAt||0))merged.set(item.id,clone(item));}const deleted=new Map();for(const item of tombstones||[]){if(item.collection!==collection)continue;deleted.set(item.id,Math.max(deleted.get(item.id)||0,Number(item.deletedAt||0)));}for(const [id,item] of merged){if(deleted.has(id)&&deleted.get(id)>=Number(item._updatedAt||0))merged.delete(id);}return [...merged.values()];}
function mergeCloud(local,remote){
  const all=new Map();
  for(const t of [...(remote.tombstones||[]),...(local.tombstones||[])]){
    if(!t||!t.id||!t.collection)continue;
    const key=t.collection+":"+t.id,old=all.get(key);
    if(!old||Number(t.deletedAt)>Number(old.deletedAt))all.set(key,clone(t));
  }
  const tombstones=[...all.values()].slice(-3000);
  const localNewer=Number(local.updatedAt||0)>=Number(remote.updatedAt||0);
  const conversations=new Map();
  for(const conversation of [...(remote.aiConversations||[]),...(local.aiConversations||[])]){
    if(!conversation||!conversation.id)continue;
    const old=conversations.get(conversation.id);
    if(!old||Number(conversation.updatedAt||0)>=Number(old.updatedAt||0))conversations.set(conversation.id,clone(conversation));
  }
  const plans=new Map();
  for(const plan of [...(remote.savedAiPlans||[]),...(local.savedAiPlans||[])]){
    if(!plan||!plan.id)continue;
    const old=plans.get(plan.id);
    if(!old||Number(plan.savedAt||0)>=Number(old.savedAt||0))plans.set(plan.id,clone(plan));
  }
  const memories=[...new Set([...(remote.aiMemories||[]),...(local.aiMemories||[])].map(value=>String(value||"").trim()).filter(Boolean))].slice(-40);
  return {
    wishes:mergeCollection(local.wishes,remote.wishes,tombstones,"wishes"),
    plans:mergeCollection(local.plans,remote.plans,tombstones,"plans"),
    tombstones,
    themeSettings:localNewer?local.themeSettings:remote.themeSettings,
    sharedThemeSettings:localNewer?local.sharedThemeSettings:remote.sharedThemeSettings,
    wallpaper:localNewer?local.wallpaper:remote.wallpaper,
    profile:local.profile||remote.profile||{},
    preferences:{...(remote.preferences||{}),...(local.preferences||{})},
    aiConversations:[...conversations.values()].sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0)).slice(0,60),
    savedAiPlans:[...plans.values()].sort((a,b)=>Number(b.savedAt||0)-Number(a.savedAt||0)).slice(0,100),
    aiMemories:memories,
    updatedAt:Math.max(Number(local.updatedAt||0),Number(remote.updatedAt||0),Date.now())
  };
}
function stampLocalChanges(){if(!window.GoPlanApp||state.suppress)return;const current=snapshotCloud();if(state.lastSnapshot){const now=Date.now();for(const collection of ["wishes","plans"]){const oldMap=new Map((state.lastSnapshot[collection]||[]).map(item=>[item.id,item]));const newMap=new Map((current[collection]||[]).map(item=>[item.id,item]));for(const [id,item] of newMap){const before=oldMap.get(id);if(!before||stripStamp(before)!==stripStamp(item))item._updatedAt=now;}for(const [id] of oldMap){if(!newMap.has(id))current.tombstones.push({id,collection,deletedAt:now});}}current.updatedAt=now;window.GoPlanApp.applyCloudState(current,{render:false,persist:true});}state.lastSnapshot=snapshotCloud();}
async function syncCloud(){if(!state.idToken||state.syncing)return;state.syncing=true;status("クラウドと同期しています…");try{let local=snapshotCloud();for(let attempt=0;attempt<4;attempt++){const remote=await api("/api/sync",{method:"GET"});if(remote.data)local=mergeCloud(local,remote.data);else local.updatedAt=Date.now();let saved=null;try{saved=await api("/api/sync",{method:"PUT",body:JSON.stringify({revision:remote.revision||0,data:local})});}catch(error){if(error.status===409&&error.payload){local=mergeCloud(local,error.payload.data||{});continue;}throw error;}if(saved){state.revision=saved.revision;state.suppress=true;window.GoPlanApp.applyCloudState(local,{render:true,persist:true});state.suppress=false;state.lastSnapshot=snapshotCloud();status("Googleアカウントと同期済み");return;}}throw new Error("別の端末で変更が続いているため同期できません。もう一度同期してください。");}catch(error){state.suppress=false;status(error.message||"同期に失敗しました。",true);console.warn("GoPlan cloud sync:",error);}finally{state.syncing=false;}}
function queueSync(){if(!state.idToken||state.suppress)return;clearTimeout(state.timer);state.timer=setTimeout(syncCloud,900);}
function startCloudPolling(){clearInterval(state.pollTimer);state.pollTimer=setInterval(()=>{if(document.visibilityState==="visible"&&state.idToken&&!state.syncing)syncCloud();},30000);}
function setAccount(user){state.user=user;const slot=$("goplanLoginSlot");if(slot){slot.innerHTML="";if(user){const pill=document.createElement("button");pill.id="goplanLogout";pill.textContent="ログアウト";pill.title=user.email||"Googleアカウント";pill.addEventListener("click",logout);slot.appendChild(pill);}else{slot.textContent="未ログイン";}}const profileButton=$("goplanProfileBtn");if(profileButton)profileButton.textContent=user?(user.name||user.email||"プロフィール"):"プロフィール";const name=$("goplanProfileName"),email=$("goplanProfileEmail"),avatar=$("goplanProfileAvatar");if(name)name.textContent=user?(user.name||"Googleアカウント"):"ログインしていません";if(email)email.textContent=user?(user.email||""):"Googleアカウントでログインするとクラウド機能を利用できます。";if(avatar){if(user&&user.picture&&/^https:\/\//.test(user.picture)){avatar.src=user.picture;avatar.hidden=false;}else{avatar.removeAttribute("src");avatar.hidden=true;}}renderProfileMemories();}

  function renderProfileMemories(){
    const root=$("goplanProfileMemories");if(!root)return;root.innerHTML="";
    const memories=window.GoPlanApp?window.GoPlanApp.getApprovedAiMemories():[];
    if(!memories.length){root.textContent="保存済みメモリーはありません。";return;}
    for(const memory of memories){
      const row=document.createElement("div");row.className="goplan-memory-row";
      const value=document.createElement("span");value.textContent=memory;
      row.appendChild(value);root.appendChild(row);
    }
  }
  function exportUserData(){
    const snapshot=window.GoPlanApp?window.GoPlanApp.getCloudState():{};
    const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),app:"GoPlan",data:snapshot},null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);const link=document.createElement("a");
    link.href=url;link.download="goplan-backup-"+new Date().toISOString().slice(0,10)+".json";
    document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
  }
  
  async function loadCloudBackups(){
    const root=$("goplanCloudBackups");if(!root)return;
    if(!state.idToken){root.textContent="Googleアカウントにログインするとクラウドバックアップを確認できます。";return;}
    root.textContent="バックアップを読み込んでいます…";
    try{
      const result=await api("/api/backups");
      root.innerHTML="";
      if(!result.backups||!result.backups.length){root.textContent="クラウドに復元可能な過去データはまだありません。次回以降の同期で自動保存されます。";return;}
      for(const backup of result.backups){
        const row=document.createElement("div");row.className="goplan-memory-row";
        const label=document.createElement("span");label.textContent=new Date(backup.created_at).toLocaleString("ja-JP")+" · revision "+backup.revision;
        const restore=document.createElement("button");restore.textContent="復元";
        restore.addEventListener("click",async()=>{
          if(!confirm("この時点のクラウドデータに戻します。現在の端末データは先にローカルバックアップします。続けますか？"))return;
          if(!window.GoPlanApp||!await window.GoPlanApp.createProtectedBackup("クラウド復元前"))return;
          restore.disabled=true;restore.textContent="復元中…";
          try{
            await api("/api/backups/restore",{method:"POST",body:JSON.stringify({id:backup.id,revision:result.currentRevision})});
            const latest=await api("/api/sync");
            if(latest.data){
              state.suppress=true;window.GoPlanApp.applyCloudState(latest.data,{render:true,persist:true});state.suppress=false;
              state.lastSnapshot=snapshotCloud();restoreConversation();renderSavedAiPlans();
            }
            status("クラウドバックアップを復元しました。");
            await loadCloudBackups();
          }catch(error){state.suppress=false;alert(error.message||"復元できませんでした。");restore.disabled=false;restore.textContent="復元";}
        });
        row.append(label,restore);root.appendChild(row);
      }
    }catch(error){root.textContent=error.message||"クラウドバックアップを読み込めませんでした。";}
  }
async function deleteCloudData(){
    if(!state.idToken){alert("先にGoogleアカウントでログインしてください。");return;}
    if(!confirm("クラウド上のGoPlanデータ、保存場所の監視設定、通知登録、AI利用回数を削除します。端末内のデータとバックアップは残ります。続けますか？"))return;
    if(!window.GoPlanApp||!await window.GoPlanApp.createProtectedBackup("クラウドデータ削除前"))return;
    try{
      await api("/api/account/delete",{method:"POST",body:"{}"});
      alert("クラウド上のGoPlanデータを削除しました。端末内のデータは残っています。");
      logout();
    }catch(error){alert(error.message||"クラウドデータを削除できませんでした。");}
  }
  function addProfileUi(group){
    if(!$("goplanProfileBtn")){
      const button=document.createElement("button");button.id="goplanProfileBtn";button.type="button";button.textContent="プロフィール";
      button.addEventListener("click",()=>{$("goplanProfileModal").hidden=false;renderProfileMemories();});
      group.appendChild(button);
    }
    if($("goplanProfileModal"))return;
    const modal=document.createElement("div");modal.id="goplanProfileModal";modal.hidden=true;
    modal.innerHTML="<section id=\"goplanProfileCard\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"goplanProfileTitle\"><h2 id=\"goplanProfileTitle\">GoPlanプロフィール</h2><div id=\"goplanProfileIdentity\"><img id=\"goplanProfileAvatar\" alt=\"プロフィール画像\" hidden><div><strong id=\"goplanProfileName\">ログインしていません</strong><p id=\"goplanProfileEmail\">Googleアカウントでログインするとクラウド機能を利用できます。</p></div></div><h3 style=\"font-size:13px\">通知設定</h3><label><input type=\"checkbox\" id=\"goplanAllNotifications\" checked> 通知を受け取る</label><p>通知は毎日6:00〜22:00の間に送信されます。予定通知は予定時刻の約30分前です。</p><h3 style=\"font-size:13px\">クラウドバックアップ</h3><button type=\"button\" id=\"goplanLoadCloudBackups\">バックアップ履歴を表示</button><div id=\"goplanCloudBackups\"></div><h3 style=\"font-size:13px\">PLANIメモリー</h3><div id=\"goplanProfileMemories\"></div><div id=\"goplanProfileActions\"><button type=\"button\" id=\"goplanExportData\">データを書き出す</button><button type=\"button\" id=\"goplanClearMemories\">AIメモリーを削除</button><button type=\"button\" id=\"goplanClearConversation\">会話履歴を削除</button><button type=\"button\" id=\"goplanCloudDelete\" class=\"goplan-danger\">クラウドデータを削除</button><button type=\"button\" id=\"goplanProfileClose\">閉じる</button></div><p>会話や保存メモリーはGoPlanのクラウドに保存され、AI回答を作るため設定済みのAIサービスに送信されます。パスワード、住所、電話番号などの個人情報や秘密情報は入力しないでください。</p><p><a href=\"./privacy.html\" target=\"_blank\" rel=\"noopener noreferrer\">プライバシーについて</a></p></section>";
    document.body.appendChild(modal);
    modal.addEventListener("click",event=>{if(event.target===modal)modal.hidden=true;});
    $("goplanProfileClose").addEventListener("click",()=>modal.hidden=true);
    $("goplanExportData").addEventListener("click",exportUserData);
    $("goplanClearMemories").addEventListener("click",()=>{if(!confirm("PLANIに保存したメモリーをすべて削除しますか？"))return;window.GoPlanApp.clearAiMemories();renderProfileMemories();});
    $("goplanClearConversation").addEventListener("click",()=>{if(!confirm("PLANIとの会話履歴をすべて削除しますか？"))return;window.GoPlanApp.clearAiConversation();state.messages=[];const log=$("goplanChatLog");if(log)log.innerHTML="";});
    $("goplanCloudDelete").addEventListener("click",deleteCloudData);
    $("goplanLoadCloudBackups").addEventListener("click",loadCloudBackups);
    $("goplanAllNotifications").checked=localStorage.getItem("goplan-notifications-enabled-v1")!=="false";
    $("goplanAllNotifications").addEventListener("change",()=>{const prefs=window.GoPlanApp.getCloudState().preferences||{};prefs.notificationsEnabled=$("goplanAllNotifications").checked;window.GoPlanApp.setCloudPreferences(prefs);queueSync();});
    renderProfileMemories();
  }
function logout(){state.idToken="";state.user=null;state.revision=0;clearInterval(state.pollTimer);clearTimeout(state.timer);state.pollTimer=null;state.lastSnapshot=snapshotCloud();if(window.google&&google.accounts&&google.accounts.id)google.accounts.id.disableAutoSelect();setAccount(null);initGoogleIdentity();status("ログアウトしました。端末内データは残っています。");}
function initGoogleIdentity(){const clientId=String(cfg.googleClientId||localStorage.getItem("outing-google-client-id-v1")||"").trim();const slot=$("goplanLoginSlot");if(!slot)return;if(!API){status("クラウドAPIの設定待ち");slot.textContent="未設定";return;}if(!clientId){status("Google Client IDの設定待ち");slot.textContent="未設定";return;}let attempts=0;const timer=setInterval(()=>{attempts++;if(window.google&&google.accounts&&google.accounts.id){clearInterval(timer);google.accounts.id.initialize({client_id:clientId,callback:async response=>{if(!response.credential)return status("Googleログインに失敗しました。",true);state.idToken=response.credential;const claims=decodeJwt(response.credential);const user={email:claims.email||"",name:claims.name||"",picture:claims.picture||""};setAccount(user);try{const me=await api("/api/me");setAccount(me.user||user);await syncCloud();startCloudPolling();restoreConversation();updateUsage(me.aiUsageCount||0);await loadWatches();}catch(error){status(error.message,true);}}});google.accounts.id.renderButton(slot,{theme:"outline",size:"medium",shape:"pill",text:"signin_with",locale:"ja"});return;}if(attempts>=30){clearInterval(timer);slot.textContent="ログイン読込失敗";status("Googleログインを読み込めませんでした。ページを再読み込みしてください。",true);}},300);}
function updateUsage(count){const node=$("aiUsageCount");if(node)node.textContent=String(Number(count)||0)+"回";}
function appendMessage(role,content){const log=$("goplanChatLog");if(!log)return;const message=document.createElement("div");message.className="goplan-chat-msg"+(role==="user"?" user":"");message.textContent=content;log.appendChild(message);if(role==="assistant"&&window.GoPlanApp){const save=document.createElement("button");save.type="button";save.textContent="この回答をAIメモリーに保存";save.style.cssText="justify-self:start;border:1px solid var(--line);border-radius:9px;padding:6px 9px;background:var(--card);color:var(--muted);font-size:10px";save.addEventListener("click",()=>{if(!confirm("この回答をPLANIのメモリーに保存しますか？保存した内容は次回以降の会話で参考にされます。"))return;window.GoPlanApp.saveApprovedAiMemory(content);save.textContent="保存しました";save.disabled=true;});log.appendChild(save);}log.scrollTop=log.scrollHeight;}
async function sendChat(text){if(!text.trim())return;appendMessage("user",text);state.messages.push({role:"user",content:text});if(window.GoPlanApp)window.GoPlanApp.saveAiConversation(state.messages);const input=$("goplanChatInput");if(input)input.value="";const send=$("goplanChatSend");if(send)send.disabled=true;try{const result=await api("/api/plani/chat",{method:"POST",body:JSON.stringify({messages:state.messages,memories:window.GoPlanApp?window.GoPlanApp.getApprovedAiMemories():[]})});const reply=result.reply||"返答を取得できませんでした。";state.messages.push({role:"assistant",content:reply});if(window.GoPlanApp)window.GoPlanApp.saveAiConversation(state.messages);appendMessage("assistant",reply);updateUsage(result.usageCount||0);}catch(error){appendMessage("assistant",error.message||"PLANIに接続できませんでした。");}finally{if(send)send.disabled=false;}}
function renderPlaceResults(places){const root=$("goplanPlaceResults");if(!root)return;root.innerHTML="";if(!places.length){root.textContent="候補が見つかりませんでした。検索語を変えてみてください。";return;}for(const place of places){const card=document.createElement("article");card.className="goplan-place-card";if(place.photoUrl){const image=document.createElement("img");image.alt=place.name+"の写真";image.loading="lazy";image.src=API+place.photoUrl;card.appendChild(image);}else{const blank=document.createElement("div");blank.style.cssText="width:88px;height:88px;border-radius:10px;background:var(--accent-soft)";card.appendChild(blank);}const body=document.createElement("div");const title=document.createElement("strong");title.textContent=place.name;const address=document.createElement("p");address.textContent=place.address||"住所情報なし";const rating=document.createElement("p");rating.textContent=place.rating?"評価 "+place.rating+"（"+(place.ratingCount||0)+"件）":"評価情報なし";const actions=document.createElement("div");actions.className="goplan-place-actions";const add=document.createElement("button");add.textContent="行きたいに追加";add.addEventListener("click",()=>{window.GoPlanApp.addWishFromPlace({...place,photoUrl:place.photoUrl?API+place.photoUrl:""});add.textContent="追加済み";add.disabled=true;});const watch=document.createElement("button");watch.textContent="情報変更を通知";watch.addEventListener("click",async()=>{try{await api("/api/places/watch",{method:"POST",body:JSON.stringify({placeId:place.id,name:place.name})});watch.textContent="監視中";watch.disabled=true;await loadWatches();}catch(error){alert(error.message);}});actions.append(add,watch);if(place.mapsUrl){const link=document.createElement("a");link.href=place.mapsUrl;link.target="_blank";link.rel="noopener noreferrer";link.textContent="地図";actions.appendChild(link);}body.append(title,address,rating,actions);card.appendChild(body);root.appendChild(card);}}
async function searchPlaces(){const query=($("goplanPlaceQuery")&&$("goplanPlaceQuery").value||"").trim();if(!query)return;const button=$("goplanPlaceSearchBtn");if(button){button.disabled=true;button.textContent="検索中…";}try{const result=await api("/api/places/search",{method:"POST",body:JSON.stringify({query})});renderPlaceResults(result.places||[]);}catch(error){const root=$("goplanPlaceResults");if(root)root.textContent=error.message||"場所を検索できませんでした。";}finally{if(button){button.disabled=false;button.textContent="場所を検索";}}}
async function loadWatches(){const root=$("goplanWatchList");if(!root||!state.idToken)return;try{const result=await api("/api/places/watch");state.watches=result.watches||[];root.innerHTML="";if(!state.watches.length){root.textContent="通知を設定した場所はまだありません。";return;}for(const watch of state.watches){const row=document.createElement("div");row.style.cssText="display:flex;justify-content:space-between;gap:8px;align-items:center;padding:5px 0";const name=document.createElement("span");name.textContent=watch.place_name;const remove=document.createElement("button");remove.textContent="解除";remove.addEventListener("click",async()=>{try{await api("/api/places/watch/"+encodeURIComponent(watch.id),{method:"DELETE"});await loadWatches();}catch(error){alert(error.message);}});row.append(name,remove);root.appendChild(row);}}catch(error){root.textContent=error.message;}}
function base64UrlToBytes(value){const base64=value.replace(/-/g,"+").replace(/_/g,"/");const raw=atob(base64+"=".repeat((4-base64.length%4)%4));return Uint8Array.from(raw,char=>char.charCodeAt(0));}
async function enablePush(){const node=$("goplanPushState");try{if(!("serviceWorker"in navigator)||!("PushManager"in window)||!("Notification"in window))throw new Error("この端末・ブラウザはプッシュ通知に対応していません。");const configResponse=await fetch(apiUrl("/api/config"));const publicConfig=await configResponse.json();if(!publicConfig.vapidPublicKey)throw new Error("通知サーバーの設定がまだ完了していません。");const permission=await Notification.requestPermission();if(permission!=="granted")throw new Error("通知が許可されませんでした。端末の設定を確認してください。");const registration=await navigator.serviceWorker.ready;let subscription=await registration.pushManager.getSubscription();if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:base64UrlToBytes(publicConfig.vapidPublicKey)});await api("/api/push/register",{method:"POST",body:JSON.stringify(subscription.toJSON())});if(node)node.textContent="通知を有効にしました。予定の30分前と保存した場所の情報変更を通知します。";}catch(error){if(node)node.textContent=error.message||"通知を有効にできませんでした。";}}

  async function generateItinerary(){
    const destination=$("goplanPlanDestination").value.trim();
    const date=$("goplanPlanDate").value;
    if(!destination||!date){alert("行き先と日付を入力してください。");return;}
    const button=$("goplanGeneratePlan"),root=$("goplanPlanResult");
    button.disabled=true;button.textContent="調べてプランを作成中…";root.textContent="営業時間やアクセスを確認しています。";
    try{
      const result=await api("/api/plani/itinerary",{method:"POST",body:JSON.stringify({
        destination,date,startTime:$("goplanPlanStart").value||"10:00",endTime:$("goplanPlanEnd").value||"18:00",
        startingPoint:$("goplanPlanStartPoint").value,interests:$("goplanPlanInterests").value
      })});
      state.itinerary=result.itinerary;
      updateUsage(result.usageCount||0);
      renderItinerary(result.itinerary);
    }catch(error){root.textContent=error.message||"プランを作成できませんでした。";}
    finally{button.disabled=false;button.textContent="プランを作成";}
  }
  function renderItinerary(itinerary){
    const root=$("goplanPlanResult");root.innerHTML="";
    const title=document.createElement("h3");title.textContent=itinerary.title||"おでかけプラン";
    const summary=document.createElement("p");summary.textContent=itinerary.summary||"";
    root.append(title,summary);
    for(const item of itinerary.items||[]){
      const card=document.createElement("article");card.className="goplan-place-card";card.style.gridTemplateColumns="1fr";
      const head=document.createElement("strong");head.textContent=(item.time?item.time+" · ":"")+item.name;
      const detail=document.createElement("p");detail.textContent=(item.area?item.area+"\n":"")+(item.durationMinutes?item.durationMinutes+"分\n":"")+item.detail;
      card.append(head,detail);
      if(item.sourceUrl&&/^https:\/\//.test(item.sourceUrl)){
        const link=document.createElement("a");link.href=item.sourceUrl;link.target="_blank";link.rel="noopener noreferrer";link.textContent="情報を確認";link.style.fontSize="11px";card.appendChild(link);
      }
      root.appendChild(card);
    }
    const saveMemory=document.createElement("button");saveMemory.type="button";saveMemory.textContent="PLANIの保存プランに追加";saveMemory.style.cssText="margin:10px 8px 0 0;border:1px solid var(--line);border-radius:10px;padding:9px 12px;background:var(--card);color:var(--ink);font-size:11px";saveMemory.addEventListener("click",()=>{window.GoPlanApp.saveAiPlan(itinerary);saveMemory.textContent="保存しました";saveMemory.disabled=true;});root.appendChild(saveMemory);
    const save=document.createElement("button");save.type="button";save.textContent="このプランを「行く予定」に保存";
    save.addEventListener("click",()=>{
      const memo=(itinerary.items||[]).map(item=>(item.time?item.time+" ":"")+item.name+"｜"+(item.area||"")+"｜"+(item.detail||"")+(item.sourceUrl?"｜"+item.sourceUrl:"")).join("\n");
      window.GoPlanApp.addPlanFromAi({title:itinerary.title||"おでかけプラン",date:itinerary.date||$("goplanPlanDate").value,area:$("goplanPlanDestination").value,memo});
      save.textContent="予定に保存しました";save.disabled=true;
    });
    root.appendChild(save);
  }
  function saveNotificationPreferences(){
    if(!window.GoPlanApp)return;
    const prefs=window.GoPlanApp.getCloudState().preferences||{};
    prefs.planNotifications=$("goplanPlanNotifications").checked;
    prefs.placeNotifications=$("goplanPlaceNotifications").checked;
    prefs.notificationsEnabled=true;
    window.GoPlanApp.setCloudPreferences(prefs);
    queueSync();
  }

  function restoreConversation(){
    const cloud=window.GoPlanApp?window.GoPlanApp.getCloudState():{};
    const saved=(cloud.aiConversations||[]).find(item=>item.id==="main");
    if(!saved||!Array.isArray(saved.messages)||!saved.messages.length)return;
    state.messages=saved.messages.slice(-40);
    const log=$("goplanChatLog");if(!log)return;log.innerHTML="";
    for(const message of state.messages)appendMessage(message.role,message.content);
  }
  function renderSavedAiPlans(){
    const root=$("goplanSavedPlanList");if(!root)return;root.innerHTML="";
    const cloud=window.GoPlanApp?window.GoPlanApp.getCloudState():{};
    const plans=Array.isArray(cloud.savedAiPlans)?cloud.savedAiPlans:[];
    if(!plans.length){root.textContent="保存したプランはまだありません。";return;}
    for(const plan of plans){
      const card=document.createElement("article");card.className="goplan-place-card";card.style.gridTemplateColumns="1fr";
      const title=document.createElement("strong");title.textContent=plan.title||"おでかけプラン";
      const summary=document.createElement("p");summary.textContent=(plan.date||"日付未定")+" · "+(plan.summary||"");
      const buttons=document.createElement("div");buttons.className="goplan-place-actions";
      const add=document.createElement("button");add.textContent="行く予定に追加";
      add.addEventListener("click",()=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(String(plan.date||""))){alert("日付のないプランです。作成し直してください。");return;}const memo=(plan.items||[]).map(item=>(item.time?item.time+" ":"")+item.name+"｜"+(item.area||"")+"｜"+(item.detail||"")+(item.sourceUrl?"｜"+item.sourceUrl:"")).join("\\n");window.GoPlanApp.addPlanFromAi({title:plan.title,date:plan.date,area:"PLANI保存プラン",memo});add.textContent="追加しました";add.disabled=true;});
      const remove=document.createElement("button");remove.textContent="保存から削除";remove.addEventListener("click",()=>{if(!confirm("この保存プランを削除しますか？"))return;window.GoPlanApp.deleteAiPlan(plan.id);renderSavedAiPlans();});
      buttons.append(add,remove);card.append(title,summary,buttons);root.appendChild(card);
    }
  }
function addUi(){const topbar=document.querySelector(".topbar");if(topbar&&!$("goplanAccount")){const group=document.createElement("div");group.id="goplanAccount";const statusNode=document.createElement("span");statusNode.id="goplanCloudStatus";statusNode.textContent="未接続";const slot=document.createElement("div");slot.id="goplanLoginSlot";group.append(statusNode,slot);topbar.appendChild(group);addProfileUi(group);}const modal=$("planiModal");if(modal&&!$("goplanChatLog")){const body=modal.querySelector(".modal");const usage=$("aiUsageCount")&&$("aiUsageCount").closest(".ai-usage-row");const oldStatus=body.querySelector(".status-line");if(oldStatus)oldStatus.hidden=true;const oldHint=body.querySelector(".hint");if(oldHint)oldHint.hidden=true;const tools=document.createElement("section");tools.innerHTML="<div id=\"goplanCloudPanel\"><strong>クラウド接続</strong><div id=\"goplanCloudText\">接続状態を確認しています。</div></div><div id=\"goplanAiTools\"><button type=\"button\" id=\"goplanShowChat\">PLANIに相談</button><button type=\"button\" id=\"goplanShowPlaces\">場所を検索・追加</button><button type=\"button\" id=\"goplanShowPlan\">1日プランを作る</button><button type=\"button\" id=\"goplanShowSavedPlans\">保存したプラン</button></div><section id=\"goplanChatSection\"><div id=\"goplanChatLog\"><div class=\"goplan-chat-msg\">こんにちは！PLANIだよ。おでかけ先探しやプラン作りを手伝うよ。</div></div><form id=\"goplanChatForm\"><textarea id=\"goplanChatInput\" rows=\"2\" maxlength=\"4000\" placeholder=\"行きたい場所や相談したいことを書いてね\"></textarea><button id=\"goplanChatSend\" type=\"submit\">送信</button></form></section><section id=\"goplanPlaceSearch\" hidden><input id=\"goplanPlaceQuery\" type=\"text\" maxlength=\"300\" placeholder=\"例：横浜の雨でも楽しめる場所\"><button type=\"button\" id=\"goplanPlaceSearchBtn\">場所を検索</button><div id=\"goplanPlaceResults\"></div><div id=\"goplanWatchList\"></div></section><section id=\"goplanSavedPlans\" hidden><div id=\"goplanSavedPlanList\"></div></section><section id=\"goplanPlanBuilder\" hidden><label for=\"goplanPlanDestination\">行き先</label><input id=\"goplanPlanDestination\" type=\"text\" maxlength=\"180\" placeholder=\"例：横浜・みなとみらい\"><label for=\"goplanPlanDate\" style=\"margin-top:8px\">日付</label><input id=\"goplanPlanDate\" type=\"date\"><div style=\"display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px\"><div><label for=\"goplanPlanStart\">開始</label><input id=\"goplanPlanStart\" type=\"time\" value=\"10:00\"></div><div><label for=\"goplanPlanEnd\">終了</label><input id=\"goplanPlanEnd\" type=\"time\" value=\"18:00\"></div></div><label for=\"goplanPlanStartPoint\" style=\"margin-top:8px\">出発地点（任意）</label><input id=\"goplanPlanStartPoint\" type=\"text\" maxlength=\"200\" placeholder=\"例：武蔵小杉駅\"><label for=\"goplanPlanInterests\" style=\"margin-top:8px\">興味・希望（任意）</label><input id=\"goplanPlanInterests\" type=\"text\" maxlength=\"500\" placeholder=\"例：カフェ、景色、写真\"><button type=\"button\" id=\"goplanGeneratePlan\" style=\"margin-top:10px\">プランを作成</button><div id=\"goplanPlanResult\"></div></section><div style=\"margin-top:12px\"><button type=\"button\" id=\"goplanPushBtn\">プッシュ通知を有効にする</button><div id=\"goplanPushState\"></div><label style=\"display:flex;align-items:center;gap:8px;margin-top:8px\"><input type=\"checkbox\" id=\"goplanPlanNotifications\" checked> 予定の30分前に通知</label><label style=\"display:flex;align-items:center;gap:8px;margin-top:5px\"><input type=\"checkbox\" id=\"goplanPlaceNotifications\" checked> 保存した場所の情報変更を通知</label></div>";if(usage)usage.before(tools);else body.appendChild(tools);$("goplanChatForm").addEventListener("submit",event=>{event.preventDefault();sendChat($("goplanChatInput").value);});$("goplanPlaceSearchBtn").addEventListener("click",searchPlaces);$("goplanPlaceQuery").addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();searchPlaces();}});$("goplanShowChat").addEventListener("click",()=>{$("goplanChatSection").hidden=false;$("goplanPlaceSearch").hidden=true;$("goplanPlanBuilder").hidden=true;$("goplanSavedPlans").hidden=true;});$("goplanShowPlaces").addEventListener("click",()=>{$("goplanChatSection").hidden=true;$("goplanPlaceSearch").hidden=false;$("goplanPlanBuilder").hidden=true;$("goplanSavedPlans").hidden=true;});$("goplanShowPlan").addEventListener("click",()=>{$("goplanChatSection").hidden=true;$("goplanPlaceSearch").hidden=true;$("goplanPlanBuilder").hidden=false;$("goplanSavedPlans").hidden=true;if(!$("goplanPlanDate").value)$("goplanPlanDate").value=new Date().toISOString().slice(0,10);});
      $("goplanShowSavedPlans").addEventListener("click",()=>{$("goplanChatSection").hidden=true;$("goplanPlaceSearch").hidden=true;$("goplanPlanBuilder").hidden=true;$("goplanSavedPlans").hidden=false;renderSavedAiPlans();});
      $("goplanGeneratePlan").addEventListener("click",generateItinerary);
      $("goplanPlanNotifications").addEventListener("change",saveNotificationPreferences);
      $("goplanPlaceNotifications").addEventListener("change",saveNotificationPreferences);
      $("goplanPushBtn").addEventListener("click",enablePush);
      $("goplanPlanNotifications").checked=localStorage.getItem("goplan-plan-notifications-v1")!=="false";
      $("goplanPlaceNotifications").checked=localStorage.getItem("goplan-place-notifications-v1")!=="false";
    }}
function init(){if(!window.GoPlanApp){status("GoPlan本体との接続を確認できませんでした。");return;}addUi();state.lastSnapshot=snapshotCloud();restoreConversation();window.addEventListener("goplan:datachange",()=>{stampLocalChanges();queueSync();});window.addEventListener("online",queueSync);document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&state.idToken)syncCloud();});initGoogleIdentity();if(!API)status("API未設定：ローカル機能は利用できます。");}
document.addEventListener("DOMContentLoaded",init);
})();