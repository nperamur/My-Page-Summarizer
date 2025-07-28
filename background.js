const firebaseHandlerPath = "/firebasehandler.html"
let creating;





async function hasDocument(path) {
  const matchedClients = await clients.matchAll();
  return matchedClients.some(
    (c) => c.url === chrome.runtime.getURL(path)
  );
}


async function setupOffscreenDocument(path) {
  if (!(await hasDocument(path))) {
    if (creating) {
      await creating;
    } else {
      creating = chrome.offscreen.createDocument({
        url: path,
        reasons: [
            chrome.offscreen.Reason.DOM_SCRAPING
        ],
        justification: 'authentication'
      });
      await creating;
      creating = null;
    }
  }
}

async function closeOffscreenDocument() {
  if (!(await hasDocument())) {
    return;
  }
  await chrome.offscreen.closeDocument();
}


let pageText = '';
let latestRequestId = 0;



chrome.offscreen.hasDocument().then(exists => {
  if (!exists) {
    setupOffscreenDocument(firebaseHandlerPath);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_TEXT') {
      sendResponse({text: pageText});
  }
  if (message.action === "loadContent") {
    pageText = "loading";
    chrome.runtime.sendMessage({type:"LOADING"});
    chrome.storage.session.get("signedIn" , function(result) {
      let signedIn = result.signedIn;
      if (signedIn) {
        latestRequestId++;
        loadResponse(latestRequestId);
      }
    });

  }

  if (message.action === "resetText") {
      pageText = "";
  }

  if (message.action === "follow-up") {
    pageText = "\nloading";
    chrome.runtime.sendMessage({type:"LOADING"});
    const key = "text";
    const newEntry = "\nUser's follow-up: \n" + message.content;

    chrome.storage.session.get([key], (result) => {
      const previous = result[key] || "";
      const updated = previous + newEntry;

      chrome.storage.session.set({ [key]: updated });
    });

    latestRequestId++;
    loadResponse(latestRequestId);

  }


  if (message.action === "popup") {
    chrome.storage.session.get("signedIn" , function(result) {
      let signedIn = result.signedIn;
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTabId = tabs[0].id;
        if (tabs.length === 0) return;
        chrome.storage.session.get(['touchedTabs'], (res) => {
          const tabsSet = new Set(res.touchedTabs || []);
          tabsSet.add(currentTabId);
          chrome.storage.session.set({ touchedTabs: [...tabsSet] });
        });
        const url = "Current Webpage Url:" + tabs[0].url;

        const key = "text";
        chrome.storage.session.set({ [key]: url });

        chrome.scripting.executeScript({
          target: { tabId: currentTabId },
          func: createInPagePopup,
          args: [signedIn]
        });

      });
    });



  }

  if (message.type === 'signOut') {
    pageText = "";
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) return;
      const currentTabId = tabs[0].id;
      chrome.scripting.executeScript({
        target: { tabId: currentTabId },
        func: () => {
          const chatScreen = document.getElementById('chat');
          chatScreen.src = "";
          const settingsScreen = document.getElementById('settings');
          const loginScreen = document.getElementById("login");


          const settingsButton = document.getElementById("settings-button");
          const backButton = document.getElementById("back-button");
          loginScreen.style.display = "block";
          chatScreen.style.display = "none";
          settingsScreen.src = chrome.runtime.getURL('settings.html');
          settingsScreen.style.display = "none";
          settingsButton.style.display = "block";
          backButton.style.display = "none";


        }
      });
    });

  }



  if (message.type === "signInStatus") {
      chrome.storage.session.set({ signedIn: message.authState });
  }

  if (message.type === 'startGoogleOAuth') {
    pageText = "";
    try {
      startGoogleOAuth().then(json => {
        chrome.runtime.sendMessage({type: 'finishedGoogleAuth', refreshToken: json.refresh_token, accessToken: json.access_token});
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const currentTabId = tabs[0].id;
          if (tabs.length === 0) return;
          const url = tabs[0].url;

          chrome.storage.session.set({ ["text"]:  "Current Webpage Url: " + url});

          chrome.scripting.executeScript({
            target: { tabId: currentTabId },
            func: () => {
              const chatScreen = document.getElementById('chat');
              chatScreen.src = chrome.runtime.getURL('popup.html');
              const settingsScreen = document.getElementById('settings');
              const loginScreen = document.getElementById("login");

              const settingsButton = document.getElementById("settings-button");
              const backButton = document.getElementById("back-button");

              loginScreen.style.display = "none";
              chatScreen.style.display = settingsButton.style.display;
              settingsScreen.style.display = backButton.style.display;
            }
          });

        });



      });
    } catch (err) {
        console.error(err);
    }
  }

  if (message.type === 'retrievedRefreshToken') {
    let refreshToken = message.refreshToken;
    exchangeRefreshTokenForAccessToken(refreshToken).then((json => {
      let idToken = json.id_token;
      chrome.storage.session.set({ idToken: idToken });
      chrome.runtime.sendMessage({type: 'extendCurrentSession', id_token: idToken});
      latestRequestId++;
      sendRequestToGemini(idToken, latestRequestId);

    }));
  }

  if (message.type === 'retrievedApiKey') {
    chrome.storage.session.set({ apiKey: message.apiKey});
  }

});




async function loadResponse(id) {
  let textContent = "";
  chrome.storage.session.get(['idToken'], (result) => {
    if (chrome.runtime.lastError) {
      console.error('Error getting idToken:', chrome.runtime.lastError);
      return;
    }

    const idToken = result.idToken;

    if (idToken) {
       sendRequestToGeminiWithToken(idToken, id);
    } else {
      sendRequestToGeminiWithRefreshedToken();
    }
  });

}

//sends request to gemini but refreshes when it receives a 401
async function sendRequestToGeminiWithToken(idToken, id) {
  let textContent = "";

  const text = await new Promise((resolve) => {
    chrome.storage.session.get(["text"], (result) => {
      resolve(result["text"] || "");
    });
  });

  const requestBody = await buildGeminiRequestBody(text, idToken);
  fetch("https://my-page-summarizer.nperamur.workers.dev/sendRequestToGemini", {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(requestBody)
  }).then(response => {
    if (response.status != 200 && response.status != 401) {
      textContent = "Something went wrong. There was an error in retrieving the response. Status code: " + response.status;
      if (latestRequestId === id) {
        pageText = textContent;
        chrome.storage.session.set({ ["text"]: text + "\n Your previous response: \n" + textContent });
        chrome.runtime.sendMessage({type: 'UPDATED', text:textContent});
      }

    } else if (response.status == 401) {
        sendRequestToGeminiWithRefreshedToken();
    } else {
      response.json().then(myJson => {
        textContent += myJson.candidates[0].content.parts[0].text;

        if (latestRequestId === id) {
            pageText = textContent;
            chrome.storage.session.set({ ["text"]: text + "\n Your previous response: \n" + textContent });
            chrome.runtime.sendMessage({type: 'UPDATED', text:textContent});
        }

      });
    }

  });
}


async function buildGeminiRequestBody(text, idToken) {
  const result = await chrome.storage.session.get("apiKey");
  const apiKey = result.apiKey;

  const payload = {
    textContent: text,
    id_token: idToken,
  };


  if (apiKey != null && typeof apiKey === "string" && apiKey.trim().length > 0) {
    payload.api_key = apiKey;
  }

  return payload;
}


function sendRequestToGeminiWithRefreshedToken() {
    chrome.runtime.sendMessage({ type: 'getRefreshToken' });
}

//sends request to gemini but doesn't refresh if fails with 401
async function sendRequestToGemini(idToken, id) {
  let textContent = "";
  const text = await new Promise((resolve) => {
    chrome.storage.session.get(["text"], (result) => {
      resolve(result["text"] || "");
    });
  });
  const requestBody = await buildGeminiRequestBody(text, idToken);
  fetch("https://my-page-summarizer.nperamur.workers.dev/sendRequestToGemini", {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(requestBody)
  }).then(response => {
    if (response.status != 200) {
      textContent = "Something went wrong. There was an error in retrieving the response. Status code: " + response.status;

      if (latestRequestId === id) {
        pageText = textContent;
        chrome.storage.session.set({ ["text"]: text + "\n Your previous response: \n" + textContent });
        chrome.runtime.sendMessage({type: 'UPDATED', text:textContent});
      }
      response.json().then(myJson => {
          console.log(myJson);
      });

    } else {
      response.json().then(myJson => {
        textContent += myJson.candidates[0].content.parts[0].text;

        if (latestRequestId === id) {
          pageText = textContent;
          chrome.storage.session.set({ ["text"]: text + "\n Your previous response: \n" + textContent });
          chrome.runtime.sendMessage({type: 'UPDATED', text:textContent});
        }
      });
    }


  });
}


function generateCodeVerifier(length = 128) {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  let verifier = "";
  for (let i = 0; i < length; i++) {
    verifier += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return verifier;
}

async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function generateRandomState(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for(let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}


async function startGoogleOAuth() {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const clientId = "163674124159-565i76cu572a6pnqp7jod1csdjq3ffu0.apps.googleusercontent.com";
  const redirectUri = "https://bmcjppabanjojkjineokkolbobogkema.chromiumapp.org/"; // e.g. chrome-extension://<id>/oauth2

  const scopes = [
    'openid'

  ];

  const scopeParam = encodeURIComponent(scopes.join(" "));
  const state = generateRandomState();

  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${clientId}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${scopeParam}` +
    `&code_challenge=${codeChallenge}` +
    `&state=${encodeURIComponent(state)}` +
    `&code_challenge_method=S256` +
    `&access_type=offline` +
    `&prompt=consent`;

  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      {
        url: authUrl,
        interactive: true,
      },
      async (redirectUrl) => {
        if (chrome.runtime.lastError || !redirectUrl) {
          return reject(chrome.runtime.lastError);
        }

        // Parse code from redirectUrl
        const url = new URL(redirectUrl);
        const code = url.searchParams.get("code");
        if (!code) {
          return reject(new Error("Authorization code not found"));
        }

        try {
          // Exchange code for tokens
          const tokens = await exchangeCodeForTokens(code, codeVerifier);
          resolve(tokens);
        } catch (e) {
          reject(e);
        }
      }
    );
  });
}


async function exchangeCodeForTokens(code, codeVerifier) {
  const response = await fetch("https://my-page-summarizer.nperamur.workers.dev/finishOauthFlow", {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
        code: code,
        codeVerifier: codeVerifier
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
  }

  const tokens = await response.json();
  return tokens;
}


async function exchangeRefreshTokenForAccessToken(refresh_token) {
  const response = await fetch("https://my-page-summarizer.nperamur.workers.dev/refreshTokenExchange", {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
        refreshToken: refresh_token
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
  }

  const tokens = await response.json();
  return tokens;
}




chrome.contextMenus.removeAll(() => {
  chrome.contextMenus.create({
    id: "highlightOption",
    title: "Summarize Text",
    contexts: ["selection"]
  });
});



chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "highlightOption") {
    chrome.storage.session.get("signedIn", function(result) {
      let signedIn = result.signedIn;
//        text = info.selectionText;
      chrome.storage.session.set({ ["text"]: info.selectionText });
      chrome.storage.session.get(['touchedTabs'], (res) => {
        const tabsSet = new Set(res.touchedTabs || []);
        tabsSet.add(tab.id);
        chrome.storage.session.set({ touchedTabs: [...tabsSet] });
      });
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: createInPagePopup,
        args: [signedIn]
      });
    });


  }
});

async function setActiveTab(windowId, tabId) {
  const data = await chrome.storage.session.get('windowTabs');
  const windowTabs = data.windowTabs || {};
  windowTabs[windowId] = tabId;
  await chrome.storage.session.set({ windowTabs });
}


async function getActiveTab(windowId) {
  const data = await chrome.storage.session.get('windowTabs');
  const windowTabs = data.windowTabs || {};
  return windowTabs[windowId];
}

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const currentTabId = activeInfo.tabId;
  const currentWindowId = activeInfo.windowId;

  const lastTabId = await getActiveTab(currentWindowId);

  setActiveTab(currentWindowId, currentTabId);

  const { touchedTabs = [] } = await chrome.storage.session.get([
    'touchedTabs'
  ]);


  if (lastTabId !== undefined && touchedTabs.includes(lastTabId)) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: lastTabId },
        func: () => {
          const popup = document.getElementById('popup');
          const overlay = document.getElementById('overlay');
          if (popup) popup.remove();
          if (overlay) overlay.remove();
        },
      });


    } catch (e) {
        console.error(e);
    }
  }

});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { touchedTabs = [] } = await chrome.storage.session.get(['touchedTabs']);
  if (touchedTabs.includes(tabId)) {
    const updatedTabs = touchedTabs.filter(id => id !== tabId);
    await chrome.storage.session.set({ touchedTabs: updatedTabs });
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url) {
    return;
  }

  const { touchedTabs = [] } = await chrome.storage.session.get([
    'touchedTabs'
  ]);
  if (touchedTabs.includes(tabId)) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const popup   = document.getElementById('popup');
          const overlay = document.getElementById('overlay');
          if (popup)   popup.remove();
          if (overlay) overlay.remove();
        }
      });
    } catch (e) {
      console.error('Failed to remove popup on tab update:', e);
    }
  }
});

let lastFocusedWindowId = null;

chrome.windows.onFocusChanged.addListener(async (newWindowId) => {
  if (newWindowId === chrome.windows.WINDOW_ID_NONE) {
    return;
  }

  const { touchedTabs = [] } = await chrome.storage.session.get([
      'touchedTabs'
  ]);

  // Optionally await this if you need details about the new window
  const newWindow = await chrome.windows.get(newWindowId);
  if (!newWindow || newWindow.type !== "normal") {
    return;
  }

  if (lastFocusedWindowId !== null && lastFocusedWindowId !== newWindowId) {
    const currentTabId = await getActiveTab(lastFocusedWindowId);
    if (currentTabId !== undefined && touchedTabs.includes(currentTabId)) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: currentTabId },
          func: () => {
            const popup = document.getElementById('popup');
            const overlay = document.getElementById('overlay');
            if (popup) popup.remove();
            if (overlay) overlay.remove();
          }
        });
      } catch (e) {
        console.error('Failed to remove popup:', e);
      }
    }
  }

  lastFocusedWindowId = newWindowId;
});








function createInPagePopup(signedIn) {
    const prevPopup = document.getElementById('popup');
    const prevOverlay = document.getElementById('overlay');
    if (prevPopup) prevPopup.remove();
    if (prevOverlay) prevOverlay.remove();

  chrome.runtime.sendMessage({action:"resetText"});


  const loginScreen = document.createElement('iframe');
    loginScreen.src = chrome.runtime.getURL('sign-in.html');
    loginScreen.style = `
      flex-grow: 1;
      border: none;
      width: 100%;
      height: 100%;
      position: relative;
      display: none;
    `;
  loginScreen.id = "login";




  const overlay = document.createElement('div');
  overlay.style = `
    position: fixed;
    top: 0; left: 0;
    width: 0%; height: 0%;
    z-index: 9998;
  `;

  overlay.id = 'overlay';

  const popup = document.createElement('div');
  popup.id = 'popup';
  popup.style = `
    position: fixed;
    top: 100px; right: 0;
    width: 420px; height: 330px;
    background: white;
    border: 1px solid #aaa;
    border-radius: 6px;
    box-shadow: 0 0 10px rgba(0,0,0,0.3);
    z-index: 9999;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  `;


  // Create drag handle
  const dragHandle = document.createElement('div');

  dragHandle.style.cssText = `
    all: initial;
    height: 30px;
    background: #333;
    color: white;
    cursor: move;
    display: flex;
    align-items: center;
    justify-content: center;
    user-select: none;
    font-family: Arial, sans-serif;
  `;


  dragHandle.textContent = "My Page Summarizer";


  const exitButton = document.createElement('button');
  exitButton.style.all = "initial";

  exitButton.textContent = "x"
  exitButton.style.position = "absolute";
  exitButton.style.right = "0px";
  exitButton.style.border = "none";
  exitButton.style.width = "27px";
  exitButton.style.height = "27px";
  exitButton.style.background = "red";
  exitButton.style.color = "white";
  exitButton.style.fontFamily = "Arial, sans-serif";
  exitButton.style.display = "flex";
  exitButton.style.alignItems = "center";
  exitButton.style.justifyContent = "center";

  exitButton.addEventListener("click", function() {
    popup.remove();
    overlay.remove();
  });



  let svg = `<svg class="settings-icon" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="27" height="27" viewBox="-50 -50 356 356" xml:space="preserve">
           <g style="stroke: none; stroke-width: 0; stroke-dasharray: none; stroke-linecap: butt; stroke-linejoin: miter; stroke-miterlimit: 10; fill: none; fill-rule: nonzero; opacity: 1;" transform="translate(1.4065934065934016 1.4065934065934016) scale(2.81 2.81)">
              <path d="M 88.568 54.357 L 88.568 54.357 c -8.337 -3.453 -8.337 -15.262 0 -18.715 l 0 0 c 1.183 -0.49 1.745 -1.847 1.255 -3.03 l -4.369 -10.547 c -0.49 -1.183 -1.847 -1.745 -3.03 -1.255 l 0 0 c -8.337 3.453 -16.687 -4.897 -13.233 -13.233 l 0 0 c 0.49 -1.183 -0.072 -2.54 -1.255 -3.03 l -10.548 -4.37 c -1.183 -0.49 -2.54 0.072 -3.03 1.255 c -3.453 8.337 -15.262 8.337 -18.715 0 c -0.49 -1.183 -1.847 -1.745 -3.03 -1.255 L 22.065 4.547 c -1.183 0.49 -1.745 1.847 -1.255 3.03 c 3.453 8.337 -4.897 16.687 -13.234 13.234 c -1.183 -0.49 -2.54 0.072 -3.03 1.255 L 0.177 32.613 c -0.49 1.183 0.072 2.54 1.255 3.03 l 0 0 c 8.337 3.453 8.337 15.262 0 18.715 l 0 0 c -1.183 0.49 -1.745 1.847 -1.255 3.03 l 4.369 10.547 c 0.49 1.183 1.847 1.745 3.03 1.255 l 0 0 c 8.337 -3.453 16.687 4.897 13.233 13.234 l 0 0 c -0.49 1.183 0.072 2.54 1.255 3.03 l 10.547 4.369 c 1.183 0.49 2.54 -0.072 3.03 -1.255 l 0 0 c 3.453 -8.337 15.262 -8.337 18.715 0 l 0 0 c 0.49 1.183 1.847 1.745 3.03 1.255 l 10.547 -4.369 c 1.183 -0.49 1.745 -1.847 1.255 -3.03 l 0 0 c -3.453 -8.337 4.897 -16.687 13.234 -13.233 c 1.183 0.49 2.54 -0.072 3.03 -1.255 l 4.369 -10.547 C 90.313 56.204 89.751 54.848 88.568 54.357 z M 45 64.052 c -10.522 0 -19.052 -8.53 -19.052 -19.052 S 34.478 25.949 45 25.949 S 64.052 34.479 64.052 45 S 55.522 64.052 45 64.052 z" style="stroke: none; stroke-width: 1; stroke-dasharray: none; stroke-linecap: butt; stroke-linejoin: miter; stroke-miterlimit: 10; fill: rgb(168,168,168); fill-rule: nonzero; opacity: 1;" transform=" matrix(1 0 0 1 0 0) " stroke-linecap="round" />
           </g>
           </svg>`
  const settingsButton = document.createElement('button');
  settingsButton.style.all = "initial";


  settingsButton.style.position = "absolute";
  settingsButton.style.left = "0px";
  settingsButton.style.width = "27px";
  settingsButton.style.height = "27px";
  settingsButton.style.display = "flex";
  settingsButton.style.alignItems = "center";
  settingsButton.style.justifyContent = "space-between";
  settingsButton.innerHTML = svg;
  settingsButton.id = "settings-button";


  dragHandle.appendChild(exitButton);
  dragHandle.appendChild(settingsButton);

  const backButton = document.createElement('button');
  backButton.textContent = "⬅️";
  backButton.style.all = "initial";

  backButton.style.position = "absolute";
  backButton.style.left = "0px";
  backButton.style.color = "white";
  backButton.style.width = "27px";
  backButton.style.height = "27px";
  backButton.style.display = "flex";
  backButton.style.alignItems = "center";
  backButton.style.justifyContent = "space-between";
  backButton.id = "back-button";

  backButton.addEventListener("click", function() {
    if (loginScreen.style.display != "none") {
      return;
    }

    settingsFrame.style.display = "none";
    settingsButton.style.display = "block";
    iframe.style.display = "block";
    backButton.style.display = "none";
    settingsFrame.src = chrome.runtime.getURL('settings.html');
  });


  // Create iframe
  const iframe = document.createElement('iframe');
  iframe.id = 'chat';
  iframe.src = chrome.runtime.getURL('popup.html');
  iframe.style = `
    flex-grow: 1;
    border: none;
    width: 100%;
    height: 100%;
    position: relative;
  `;


  const settingsFrame = document.createElement('iframe');
  settingsFrame.style = `
    flex-grow: 1;
    border: none;
    width: 100%;
    height: 100%;
    position: relative;
  `;
  settingsFrame.src = chrome.runtime.getURL('settings.html');
  settingsFrame.id = "settings";



  settingsButton.addEventListener("click", function() {
    if (loginScreen.style.display != "none") {
      return;
    }
    iframe.style.display = "none";
    settingsFrame.style.display = "block";
    backButton.style.display = "block";
    settingsButton.style.display = "none";
  });



  if (!signedIn) {
     loginScreen.style.display = "block";
     iframe.style.display = "none";
     settingsFrame.style.display = "none";
  }
  dragHandle.appendChild(backButton);
  popup.appendChild(dragHandle);
  popup.appendChild(iframe);
  popup.appendChild(loginScreen);
  popup.appendChild(settingsFrame);
  backButton.style.display = "none";
  settingsFrame.style.display = "none";


  document.body.append(overlay, popup);


  // Drag logic
  let isDragging = false;
  let offsetX, offsetY;

  dragHandle.addEventListener('mousedown', (e) => {
    isDragging = true;
    offsetX = e.clientX - popup.offsetLeft;
    offsetY = e.clientY - popup.offsetTop;
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    popup.style.left = (e.clientX - offsetX) + 'px';
    popup.style.top = Math.min(Math.max(-10, (e.clientY - offsetY)), window.innerHeight - 20) + 'px';

  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });
}


chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: {tabId: tab.id},
    files: ['create-popup.js']
  });
});












