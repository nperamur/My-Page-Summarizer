let loading = false;

const button = document.getElementById('button');
const input = document.getElementById('textBox');
button.addEventListener('click', () => {
  const textValue = input.value;
  if (textValue.trim() !== "" && document.getElementById('content') && !loading) {
    const content = document.getElementById('content');

    content.appendChild(document.createElement('br'));
    content.appendChild(document.createElement('br'));

    const span = document.createElement('span');
    span.className = 'message-bubble';
    span.style.cssFloat = 'right';
    span.textContent = textValue;

    content.appendChild(span);

    content.appendChild(document.createElement('br'));
    content.appendChild(document.createElement('br'));

    document.getElementById('content').scrollTop = document.getElementById('content').scrollHeight;
    document.getElementById('textBox').value = "";
    chrome.runtime.sendMessage({action: 'follow-up', content: textValue});
  }

});

input.addEventListener("keydown", function(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    button.click();
  }
});



chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "LOADING") {
    loading = true;
  } else if (message.type === "UPDATED") {
    loading = false;
  }

});


