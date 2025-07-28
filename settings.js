let currentApiKey = "";

const apiKeyLabel = document.getElementById("apiKeyLabel");

const errorMessage = document.getElementById("error-message");



const apiKeyText = "Gemini API Key: ";
const defaultKeyText = "Using Default Key";
const customKeyText = "Using Your Custom Key";

const useDefaultButton = document.getElementById('useDefaultButton');

updateApiKey();

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'session' && changes.apiKey) {
    updateApiKey();
  }
});
errorMessage.style.display = "none";



function updateApiKey() {
  chrome.storage.session.get(["apiKey"], (result) => {
    currentApiKey = result.apiKey;
    document.getElementById('textbox').value = currentApiKey;
    if (!hasGeminiApiKeyFormat(textbox.value) && textbox.value !== "") {
      errorMessage.style.display = "inline";
    } else {
      errorMessage.style.display = "none";
    }
    if (currentApiKey === "") {
      useDefaultButton.disabled = true;
      apiKeyLabel.textContent = apiKeyText + defaultKeyText;
    } else {
      useDefaultButton.disabled = false;
      apiKeyLabel.textContent = apiKeyText + customKeyText;
    }
  });
}




useDefaultButton.addEventListener('click', () => {
  document.getElementById('textbox').value = "";
  chrome.runtime.sendMessage({type: "saveApiKey", value: ""});
  currentApiKey = "";
  useDefaultButton.disabled = true;
  apiKeyLabel.textContent = apiKeyText + defaultKeyText;
  btn.disabled = true;
  cancel.disabled = true;
  if (!hasGeminiApiKeyFormat(textbox.value) && textbox.value !== "") {
    errorMessage.style.display = "inline";
  } else {
    errorMessage.style.display = "none";
  }

});


const btn = document.getElementById('saveButton');
btn.addEventListener('click', () => {
  const text = document.getElementById('textbox').value;
  chrome.runtime.sendMessage({type: "saveApiKey", value: text});
  btn.disabled = true;
  cancel.disabled = true;
  if (text === "") {
    useDefaultButton.disabled = true;
    apiKeyLabel.textContent = apiKeyText + defaultKeyText;
  } else {
    useDefaultButton.disabled = false;
    apiKeyLabel.textContent = apiKeyText + customKeyText;
  }
  currentApiKey = text;
});

const cancel = document.getElementById('cancel');
cancel.addEventListener('click', () => {
  document.getElementById('textbox').value = currentApiKey;
  btn.disabled = true;
  cancel.disabled = true;

  if (!hasGeminiApiKeyFormat(textbox.value) && textbox.value !== "") {
    errorMessage.style.display = "inline";
  } else {
    errorMessage.style.display = "none";
  }
});

btn.disabled = true;
cancel.disabled = true;



const textbox = document.getElementById('textbox');

textbox.addEventListener('input', (e) => {
  const currentValue = e.target.value;
  if (currentValue === currentApiKey) {
    btn.disabled = true;
    cancel.disabled = true;
  } else {
    btn.disabled = false;
    cancel.disabled = false;
  }

  if (!hasGeminiApiKeyFormat(currentValue) && currentValue !== "") {
    errorMessage.style.display = "inline";
    btn.disabled = true;
  } else {
      errorMessage.style.display = "none";
  }

});



const logoutButton = document.getElementById("logout");
logoutButton.addEventListener('click', () => {
  chrome.runtime.sendMessage({type: 'signOut'})
});


function hasGeminiApiKeyFormat(key) {
  const regex = /^AIza[0-9A-Za-z\-_]{35}$/;
  return regex.test(key);
}