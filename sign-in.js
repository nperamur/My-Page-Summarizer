const loginButton = document.getElementById('login');

loginButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({type: 'startGoogleOAuth'});
});
