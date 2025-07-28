import DOMPurify from 'dompurify';


function send() {
  chrome.runtime.sendMessage({type: 'GET_TEXT'}, (response) => {
    const element = document.getElementById('content');
    element.style.fontFamily = "'Inter', sans-serif";
    element.style.color = "#333333";


    const html = element.innerHTML;
    const loaderSpanHTML = '<span class="loader"></span>';
    const lastLoadingIndex = html.lastIndexOf('loading' + loaderSpanHTML);

    if (lastLoadingIndex !== -1) {
      // We preserve the content before and after "loading"
      const before = html.substring(0, lastLoadingIndex);
      const after = html.substring(lastLoadingIndex + ('loading' + loaderSpanHTML).length);
      element.innerHTML = before + after;
    }

    if (response.text.endsWith('loading')) {
      element.innerHTML += geminiMarkdownToHTML(response.text + loaderSpanHTML);
    } else {
      element.innerHTML += geminiMarkdownToHTML(response.text);
    }
  });

}

function loadContent() {
  chrome.runtime.sendMessage({action: 'loadContent'});
}



loadContent();


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "LOADING") {
    send();
  }
  if (message.type === "UPDATED") {
    send();
  }

});



function geminiMarkdownToHTML(md) {
  return `<style>
           h1,h2,h3,h4,h5,h6 { margin:0; font-size:1.1em; font-weight:bold; }
         </style>` + DOMPurify.sanitize(md)
    .replace(/^###### (.*)$/gm, '<h6>$1</h6>')
    .replace(/^##### (.*)$/gm, '<h5>$1</h5>')
    .replace(/^#### (.*)$/gm, '<h4>$1</h4>')
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')

    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')

    .replace(/^\s*\* (.*)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\s*)+/g, match => `<ul>${match.trim()}</ul>`)

    .replace(/\n(?!<\/?li>)/g, '<br>');
}










