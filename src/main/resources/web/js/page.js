"use strict";
let urlParams = new URLSearchParams();
window.location.hash.substring(1).split("?")
    .map(it => new URLSearchParams(it)
    .forEach((a, b) => urlParams.append(b, a)));
let mcIdUsername = urlParams.get("username");
let mcauth_code = urlParams.get("mcauth_code");
let mcauth_success = urlParams.get("mcauth_success");
$(() => {
    if (mcauth_success === "false") {
        addToast("Couldn't authenticate with Minecraft.ID", urlParams.get("mcauth_msg"));
    }
    if (mcauth_code != null) {
        history.replaceState(null, null, "#");
    }
});
let connectionStatus = document.getElementById("connection_status");
let corsStatus = document.getElementById("cors_status");
let listening = document.getElementById("listening");
let accounts = document.getElementById("accounts-list");
let cors_proxy_txt = document.getElementById("cors-proxy");
let ws_url_txt = document.getElementById("ws-url");
let listenVisible = false;
let deltaTime = 0;
let workers = [];
$(() => {
    workers = new Array(navigator.hardwareConcurrency)
        .fill(null)
        .map(() => new Worker("js/worker.js"));
    workers.forEach(it => it.onmessage = onWorkerMsg);
});
$(() => {
    if (navigator.serviceWorker) {
        navigator.serviceWorker.register("sw.js")
            .then(() => setTimeout(() => swRefreshFiles(), 1000));
    }
});
$(() => {
    $(".async-css").attr("rel", "stylesheet");
    $("form").on("submit", e => e.preventDefault());
    $("a[href='javascript:']").on("click", e => e.preventDefault());
    cors_proxy_txt.value = getCorsProxy();
    ws_url_txt.value = getWsUrl();
    $("#form_add_mc").on("submit", () => loginMc($("#mc_email").val(), $("#mc_password").val()));
    $("#form_add_ms").on("submit", () => loginMs());
    $("#form_ws_url").on("submit", () => setWsUrl($("#ws-url").val()));
    $("#form_cors_proxy").on("submit", () => setCorsProxy($("#cors-proxy").val()));
    $("#form_listen").on("submit", () => submittedListen());
    $("#form_send_token").on("submit", () => submittedSendToken());
    $("#en_notific").on("click", () => Notification.requestPermission().then(renderActions));
    $("#listen_continue").on("click", () => clickedListenContinue());
    window.addEventListener('beforeinstallprompt', e => e.preventDefault());
    ohNo();
    refreshAccountList();
    setInterval(refreshCorsStatus, 10 * 60 * 1000);
    refreshCorsStatus();
    resetHtml();
});
$(() => {
    connect();
});
function swRefreshFiles() {
    navigator.serviceWorker.ready.then(ready => ready.active.postMessage({
        action: "cache",
        urls: performance.getEntriesByType("resource").map(it => it.name)
    }));
}
function setWsStatus(txt) {
    connectionStatus.innerText = txt;
}
function refreshCorsStatus() {
    corsStatus.innerText = "...";
    getIpAddress(true).then(ip => {
        return getIpAddress(false).then(ip2 => corsStatus.innerText = "OK " + ip + (ip !== ip2 ? " (different IP)" : ""));
    }).catch(e => corsStatus.innerText = "error: " + e);
}
function addMcAccountToList(account) {
    let line = $(`<li class='input-group d-flex'>
    <span class='input-group-text'><img alt="?" src="?" loading="lazy" width=24 class='mc-head'/></span>
    <span class='form-control mc-user'></span>
    <button type="button" class='btn btn-danger mc-remove'>Logout</button>
    </li>`);
    let txt = account.name;
    if (account instanceof MicrosoftAccount)
        txt += " (" + account.msUser + ")";
    line.find(".mc-user").text(txt);
    line.find(".mc-remove").on("click", () => account.logout());
    let head = line.find(".mc-head");
    head.attr("alt", account.name + "'s head");
    head.attr("src", "https://crafthead.net/helm/" + account.id);
    $(accounts).append(line);
}
function addUsernameList(username) {
    let line = $("<option class='mc_username'></option>");
    line.text(username);
    $("#send_token_user").append(line);
    $("#backend_user_list").append(line.clone());
}
function refreshAccountList() {
    accounts.innerHTML = "";
    $("#send_token_user .mc_username").remove();
    $("#backend_user_list .mc_username").remove();
    getActiveAccounts()
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach(it => {
        addMcAccountToList(it);
        addUsernameList(it.name);
    });
}
$("#mcIdUsername").text(mcIdUsername);
function submittedListen() {
    let user = $("#listen_username").val();
    if (!user)
        return;
    if ($("#listen_online")[0].checked) {
        let callbackUrl = new URL(location.href);
        callbackUrl.search = "";
        callbackUrl.hash = "#username=" + encodeURIComponent(user);
        location.href = "https://api.minecraft.id/gateway/start/" + encodeURIComponent(user)
            + "?callback=" + encodeURIComponent(callbackUrl.toString());
    }
    else {
        let taskId = Math.random();
        workers.forEach(it => it.postMessage({ action: "listen_pow", user: user, id: taskId, deltaTime: deltaTime }));
        addToast("Offline username", "Please wait a minute...");
    }
}
function submittedSendToken() {
    let account = findAccountByMcName($("#send_token_user").val());
    account.acquireActiveToken()
        .then(() => {
        sendSocket(JSON.stringify({
            "action": "save_access_token",
            "mc_access_token": account.accessToken
        }));
    })
        .catch(e => addToast("Failed to send access token", e));
}
function clickedListenContinue() {
    sendSocket(JSON.stringify({
        "action": "minecraft_id_login",
        "username": mcIdUsername,
        "code": mcauth_code
    }));
    mcauth_code = null;
    renderActions();
}
function renderActions() {
    $("#en_notific").hide();
    $("#listen_continue").hide();
    $("#listen_open").hide();
    $("#send_token_open").hide();
    if (Notification.permission === "default") {
        $("#en_notific").show();
    }
    if (listenVisible) {
        if (mcIdUsername != null && mcauth_code != null) {
            $("#listen_continue").show();
        }
        $("#listen_open").show();
        $("#send_token_open").show();
    }
}
function onWorkerMsg(e) {
    if (e.data.action === "completed_pow")
        onCompletedPoW(e);
}
function onCompletedPoW(e) {
    addToast("Offline username", "Completed proof of work");
    workers.forEach(it => it.postMessage({ action: "cancel", id: e.data.id }));
    sendSocket(e.data.msg);
}
function addListeningList(userId, username, token) {
    let line = $("<p><img alt='?' src='?' loading='lazy' width=24 class='head'/> <span class='username'></span> <button class='btn btn-danger' type='button'>Unlisten</button></p>");
    line.find(".username").text(username || userId);
    line.find(".btn").on("click", () => {
        removeToken(token);
        line.remove();
        unlisten(userId);
    });
    let head = line.find(".head");
    head.attr("alt", userId + "'s head");
    head.attr("src", "https://crafthead.net/helm/" + userId);
    $(listening).append(line);
}
function addToast(title, msg, yes = null, no = null) {
    let toast = $(`<div class="toast" role="alert" aria-live="assertive" aria-atomic="true">
 <div class="toast-header">
   <strong class="me-auto toast_title_msg"></strong>
   <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
 </div>
 <div class="toast-body">
   <pre class="txt"></pre>
   <div class="btns mt-2 pt-2 border-top"></div>
 </div>
</div>`);
    toast.find(".toast_title_msg").text(title);
    let tBody = toast.find(".toast-body");
    tBody.find(".txt").text(msg);
    let btns = $(tBody).find(".btns");
    let hasButtons = false;
    if (yes != null) {
        hasButtons = true;
        let btn = $("<button type='button' data-bs-dismiss='toast' class='btn btn-primary btn-sm'>Yes</button>");
        btn.on("click", yes);
        btns.append(btn);
    }
    if (no != null) {
        hasButtons = true;
        let btn = $("<button type='button' data-bs-dismiss='toast' class='btn btn-secondary btn-sm'>No</button>");
        btn.on("click", no);
        btns.append(btn);
    }
    if (!hasButtons) {
        btns.addClass("d-none");
    }
    $("#toasts").prepend(toast);
    new bootstrap.Toast(toast[0]).show();
}
function resetHtml() {
    listening.innerHTML = "";
    listenVisible = false;
    renderActions();
}
function ohNo() {
    try {
        icanhazepoch().then(sec => {
            const calcDelta = Date.now() - sec * 1000;
            if (Math.abs(calcDelta) > 10000) {
                addToast("Time isn't synchronized", "Please synchronize your computer time to NTP servers");
                deltaTime = calcDelta;
                console.log("applying delta time " + deltaTime);
            }
            else {
                console.log("time seems synchronized");
            }
        });
        try {
            new BroadcastChannel("test");
        }
        catch (e) {
            addToast("Unsupported browser", "This browser doesn't support required APIs");
        }
        new Date().getDay() === 3 && console.log("it's snapshot day 🐸 my dudes");
        new Date().getDate() === 1 && new Date().getMonth() === 3 && addToast("LICENSE EXPIRED", "Your ViaVersion has expired, please renew it at https://viaversion.com/ for only $99");
    }
    catch (e) {
        console.log(e);
    }
}
function checkFetchSuccess(msg) {
    return (r) => {
        if (!r.ok)
            throw r.status + " " + msg;
        return r;
    };
}
async function getIpAddress(cors) {
    return fetch((cors ? getCorsProxy() : "") + "https://ipv4.icanhazip.com")
        .then(checkFetchSuccess("code"))
        .then(r => r.text())
        .then(it => it.trim());
}
function icanhazepoch() {
    return fetch("https://icanhazepoch.com")
        .then(checkFetchSuccess("code"))
        .then(r => r.text())
        .then(it => parseInt(it.trim()));
}
let notificationCallbacks = new Map();
$(() => {
    new BroadcastChannel("viaaas-notification").addEventListener("message", handleSWMsg);
});
function handleSWMsg(event) {
    console.log("sw msg: " + event);
    let data = event.data;
    let callback = notificationCallbacks.get(data.tag);
    notificationCallbacks.delete(data.tag);
    if (callback == null)
        return;
    callback(data.action);
}
function authNotification(msg, yes, no) {
    if (!navigator.serviceWorker || Notification.permission !== "granted") {
        addToast("Allow auth impersonation?", msg, yes, no);
        return;
    }
    let tag = uuid.v4();
    navigator.serviceWorker.ready.then(r => {
        r.showNotification("Click to allow auth impersonation", {
            body: msg,
            tag: tag,
            vibrate: [200, 10, 100, 200, 100, 10, 100, 10, 200],
            actions: [
                { action: "reject", title: "Reject" },
                { action: "confirm", title: "Confirm" }
            ]
        });
        notificationCallbacks.set(tag, action => {
            if (action === "reject") {
                no();
            }
            else if (!action || action === "confirm") {
                yes();
            }
        });
        setTimeout(() => {
            notificationCallbacks.delete(tag);
        }, 30 * 1000);
    });
}
function defaultCors() {
    return "https://crp123-cors.herokuapp.com/";
}
function getCorsProxy() {
    return localStorage.getItem("viaaas_cors_proxy") || defaultCors();
}
function setCorsProxy(url) {
    localStorage.setItem("viaaas_cors_proxy", url);
    refreshCorsStatus();
}
let activeAccounts = [];
function loadAccounts() {
    (JSON.parse(localStorage.getItem("viaaas_mc_accounts")) || []).forEach((it) => {
        if (it.clientToken) {
            addActiveAccount(new MojangAccount(it.id, it.name, it.accessToken, it.clientToken));
        }
        else if (it.msUser && myMSALObj.getAccountByUsername(it.msUser)) {
            addActiveAccount(new MicrosoftAccount(it.id, it.name, it.accessToken, it.msUser));
        }
    });
}
$(() => loadAccounts());
function saveRefreshAccounts() {
    localStorage.setItem("viaaas_mc_accounts", JSON.stringify(getActiveAccounts()));
    refreshAccountList();
}
function getActiveAccounts() {
    return activeAccounts;
}
class McAccount {
    constructor(id, username, accessToken) {
        this.id = id;
        this.name = username;
        this.accessToken = accessToken;
        this.loggedOut = false;
    }
    async logout() {
        activeAccounts = activeAccounts.filter(it => it !== this);
        saveRefreshAccounts();
        this.loggedOut = true;
    }
    async checkActive() {
        return fetch(getCorsProxy() + "https://authserver.mojang.com/validate", {
            method: "post",
            body: JSON.stringify({
                accessToken: this.accessToken,
                clientToken: this.clientToken || undefined
            }),
            headers: { "content-type": "application/json" }
        }).then(data => data.ok);
    }
    async joinGame(hash) {
        await this.acquireActiveToken()
            .then(() => fetch(getCorsProxy() + "https://sessionserver.mojang.com/session/minecraft/join", {
            method: "post",
            body: JSON.stringify({
                accessToken: this.accessToken,
                selectedProfile: this.id,
                serverId: hash
            }),
            headers: { "content-type": "application/json" }
        }))
            .then(checkFetchSuccess("Failed to join session"));
    }
    async refresh() {
    }
    async acquireActiveToken() {
        return this.checkActive()
            .then(success => {
            if (!success) {
                return this.refresh().then(() => {
                });
            }
            return Promise.resolve();
        })
            .catch(e => addToast("Failed to refresh token!", e));
    }
}
class MojangAccount extends McAccount {
    constructor(id, username, accessToken, clientToken) {
        super(id, username, accessToken);
        this.clientToken = clientToken;
    }
    async logout() {
        await super.logout();
        await fetch(getCorsProxy() + "https://authserver.mojang.com/invalidate", {
            method: "post",
            body: JSON.stringify({
                accessToken: this.accessToken,
                clientToken: this.clientToken
            }),
            headers: { "content-type": "application/json" }
        }).then(checkFetchSuccess("not success logout"));
    }
    async refresh() {
        console.log("refreshing " + this.id);
        let jsonResp = await fetch(getCorsProxy() + "https://authserver.mojang.com/refresh", {
            method: "post",
            body: JSON.stringify({
                accessToken: this.accessToken,
                clientToken: this.clientToken
            }),
            headers: { "content-type": "application/json" },
        })
            .then(async (r) => {
            if (r.status === 403) {
                try {
                    await this.logout();
                }
                catch (e) {
                    console.error(e);
                }
                throw "403, token expired?";
            }
            return r;
        })
            .then(checkFetchSuccess("code"))
            .then(r => r.json());
        console.log("refreshed " + jsonResp.selectedProfile.id);
        this.accessToken = jsonResp.accessToken;
        this.clientToken = jsonResp.clientToken;
        this.name = jsonResp.selectedProfile.name;
        this.id = jsonResp.selectedProfile.id;
        saveRefreshAccounts();
    }
}
class MicrosoftAccount extends McAccount {
    constructor(id, username, accessToken, msUser) {
        super(id, username, accessToken);
        this.msUser = msUser;
    }
    async logout() {
        await super.logout();
        let msAccount = myMSALObj.getAccountByUsername(this.msUser);
        if (!msAccount)
            return;
        const logoutRequest = { account: msAccount };
        await myMSALObj.logoutPopup(logoutRequest);
    }
    async refresh() {
        let msTokenResp = await getTokenPopup(this.msUser, getLoginRequest());
        let xboxJson = await fetch("https://user.auth.xboxlive.com/user/authenticate", {
            method: "post",
            body: JSON.stringify({
                Properties: {
                    AuthMethod: "RPS", SiteName: "user.auth.xboxlive.com",
                    RpsTicket: "d=" + msTokenResp.accessToken
                }, RelyingParty: "http://auth.xboxlive.com", TokenType: "JWT"
            }),
            headers: { "content-type": "application/json" }
        })
            .then(checkFetchSuccess("xbox response not success"))
            .then(r => r.json());
        let xstsJson = await fetch("https://xsts.auth.xboxlive.com/xsts/authorize", {
            method: "post",
            body: JSON.stringify({
                Properties: { SandboxId: "RETAIL", UserTokens: [xboxJson.Token] },
                RelyingParty: "rp://api.minecraftservices.com/", TokenType: "JWT"
            }),
            headers: { "content-type": "application/json" }
        })
            .then(resp => {
            if (resp.status !== 401)
                return resp;
            return resp.json().then(errorData => {
                let error = errorData.XErr;
                switch (error) {
                    case 2148916233:
                        throw "Xbox account not found";
                    case 2148916235:
                        throw "Xbox Live not available in this country";
                    case 2148916238:
                        throw "Account is underage, add it to a family";
                }
                throw "xsts error code " + error;
            });
        })
            .then(checkFetchSuccess("xsts response not success"))
            .then(r => r.json());
        let mcJson = await fetch(getCorsProxy() + "https://api.minecraftservices.com/authentication/login_with_xbox", {
            method: "post",
            body: JSON.stringify({ identityToken: "XBL3.0 x=" + xstsJson.DisplayClaims.xui[0].uhs + ";" + xstsJson.Token }),
            headers: { "content-type": "application/json" }
        })
            .then(checkFetchSuccess("mc response not success"))
            .then(r => r.json());
        let jsonProfile = await fetch(getCorsProxy() + "https://api.minecraftservices.com/minecraft/profile", {
            method: "get",
            headers: { "content-type": "application/json", "authorization": "Bearer " + mcJson.access_token }
        })
            .then(profile => {
            if (profile.status === 404)
                throw "Minecraft profile not found";
            if (!profile.ok)
                throw "profile response not success " + profile.status;
            return profile.json();
        });
        this.accessToken = mcJson.access_token;
        this.name = jsonProfile.name;
        this.id = jsonProfile.id;
        saveRefreshAccounts();
    }
    async checkActive() {
        return fetch(getCorsProxy() + "https://api.minecraftservices.com/entitlements/mcstore", {
            method: "get",
            headers: { "authorization": "Bearer " + this.accessToken }
        }).then(data => data.ok);
    }
}
function findAccountByMcName(name) {
    return activeAccounts.find(it => it.name.toLowerCase() === name.toLowerCase());
}
function findAccountByMs(username) {
    return getActiveAccounts().find(it => it.msUser === username);
}
function addActiveAccount(acc) {
    activeAccounts.push(acc);
    saveRefreshAccounts();
}
function loginMc(user, pass) {
    const clientToken = uuid.v4();
    fetch(getCorsProxy() + "https://authserver.mojang.com/authenticate", {
        method: "post",
        body: JSON.stringify({
            agent: { name: "Minecraft", version: 1 },
            username: user,
            password: pass,
            clientToken: clientToken,
        }),
        headers: { "content-type": "application/json" }
    }).then(checkFetchSuccess("code"))
        .then(r => r.json())
        .then(data => {
        let acc = new MojangAccount(data.selectedProfile.id, data.selectedProfile.name, data.accessToken, data.clientToken);
        addActiveAccount(acc);
        return acc;
    }).catch(e => addToast("Failed to login", e));
    $("#form_add_mc input").val("");
}
function getLoginRequest() {
    return { scopes: ["XboxLive.signin"] };
}
let redirectUrl = "https://viaversion.github.io/VIAaaS/src/main/resources/web/";
if (location.hostname === "localhost" || whitelistedOrigin.includes(location.origin)) {
    redirectUrl = location.origin + location.pathname;
}
const msalConfig = {
    auth: {
        clientId: azureClientId,
        authority: "https://login.microsoftonline.com/consumers/",
        redirectUri: redirectUrl,
    },
    cache: {
        cacheLocation: "localStorage",
        storeAuthStateInCookie: false,
    }
};
const myMSALObj = new msal.PublicClientApplication(msalConfig);
function loginMs() {
    let req = getLoginRequest();
    req["prompt"] = "select_account";
    myMSALObj.loginRedirect(req);
}
$(() => myMSALObj.handleRedirectPromise().then((resp) => {
    if (resp) {
        let found = findAccountByMs(resp.account.username);
        if (!found) {
            let accNew = new MicrosoftAccount("", "", "", resp.account.username);
            accNew.refresh()
                .then(() => addActiveAccount(accNew))
                .catch(e => addToast("Failed to get token", e));
        }
        else {
            found.refresh()
                .catch(e => addToast("Failed to refresh token", e));
        }
    }
}));
function getTokenPopup(username, request) {
    request.account = myMSALObj.getAccountByUsername(username);
    request.loginHint = username;
    return myMSALObj.acquireTokenSilent(request)
        .catch((e) => {
        console.warn("silent token acquisition fails.");
        if (error instanceof msal.InteractionRequiredAuthError) {
            return myMSALObj.acquireTokenPopup(request).catch((error) => console.error(error));
        }
        else {
            console.warn(e);
        }
    });
}
let wsUrl = getWsUrl();
let socket = null;
function defaultWs() {
    let url = new URL("ws", location.href);
    url.protocol = "wss";
    return window.location.host.endsWith("github.io") || !window.location.protocol.startsWith("http")
        ? "wss://localhost:25543/ws" : url.toString();
}
function getWsUrl() {
    return localStorage.getItem("viaaas_ws_url") || defaultWs();
}
function setWsUrl(url) {
    localStorage.setItem("viaaas_ws_url", url);
    location.reload();
}
function saveToken(token) {
    let hTokens = JSON.parse(localStorage.getItem("viaaas_tokens")) || {};
    let tokens = getTokens();
    tokens.push(token);
    hTokens[wsUrl] = tokens;
    localStorage.setItem("viaaas_tokens", JSON.stringify(hTokens));
}
function removeToken(token) {
    let hTokens = JSON.parse(localStorage.getItem("viaaas_tokens")) || {};
    let tokens = getTokens();
    tokens = tokens.filter(it => it !== token);
    hTokens[wsUrl] = tokens;
    localStorage.setItem("viaaas_tokens", JSON.stringify(hTokens));
}
function getTokens() {
    return (JSON.parse(localStorage.getItem("viaaas_tokens")) || {})[wsUrl] || [];
}
function listen(token) {
    socket.send(JSON.stringify({ "action": "listen_login_requests", "token": token }));
}
function unlisten(id) {
    socket.send(JSON.stringify({ "action": "unlisten_login_requests", "uuid": id }));
}
function confirmJoin(hash) {
    socket.send(JSON.stringify({ action: "session_hash_response", session_hash: hash }));
}
function handleJoinRequest(parsed) {
    authNotification("Allow auth impersonation from VIAaaS instance?\nAccount: "
        + parsed.user + "\nServer Message: \n"
        + parsed.message.split(/[\r\n]+/).map((it) => "> " + it).join('\n'), () => {
        let account = findAccountByMcName(parsed.user);
        if (account) {
            account.joinGame(parsed.session_hash)
                .finally(() => confirmJoin(parsed.session_hash))
                .catch((e) => addToast("Couldn't contact session server", "Error: " + e));
        }
        else {
            confirmJoin(parsed.session_hash);
            addToast("Couldn't find account", "Couldn't find " + parsed.user + ", check Accounts tab");
        }
    }, () => confirmJoin(parsed.session_hash));
}
function onWsMsg(event) {
    let parsed = JSON.parse(event.data);
    switch (parsed.action) {
        case "ad_login_methods":
            listenVisible = true;
            renderActions();
            break;
        case "login_result":
            if (!parsed.success) {
                addToast("Couldn't verify Minecraft account", "VIAaaS returned failed response");
            }
            else {
                listen(parsed.token);
                saveToken(parsed.token);
            }
            break;
        case "listen_login_requests_result":
            if (parsed.success) {
                addListeningList(parsed.user, parsed.username, parsed.token);
            }
            else {
                removeToken(parsed.token);
            }
            break;
        case "session_hash_request":
            handleJoinRequest(parsed);
            break;
        case "parameters_request":
            handleParametersRequest(parsed);
            break;
    }
}
function handleParametersRequest(parsed) {
    let url = new URL("https://" + $("#connect_address").val());
    socket.send(JSON.stringify({
        action: "parameters_response",
        callback: parsed["callback"],
        version: $("#connect_version").val(),
        host: url.hostname,
        port: parseInt(url.port) || 25565,
        frontOnline: $("#connect_online").val(),
        backName: $("#connect_user").val() || undefined
    }));
}
function listenStoredTokens() {
    getTokens().forEach(listen);
}
function onWsConnect() {
    setWsStatus("connected");
    resetHtml();
    listenStoredTokens();
}
function onWsError(e) {
    console.log(e);
    setWsStatus("socket error");
    resetHtml();
}
function onWsClose(evt) {
    setWsStatus("disconnected with close code " + evt.code + " and reason: " + evt.reason);
    resetHtml();
    setTimeout(connect, 5000);
}
function connect() {
    setWsStatus("connecting...");
    socket = new WebSocket(wsUrl);
    socket.onerror = onWsError;
    socket.onopen = onWsConnect;
    socket.onclose = onWsClose;
    socket.onmessage = onWsMsg;
}
function sendSocket(msg) {
    if (!socket) {
        console.error("couldn't send msg, socket isn't set");
        return;
    }
    socket.send(msg);
}
