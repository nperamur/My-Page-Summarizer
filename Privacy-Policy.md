# My Page Summarizer Privacy Policy
**Last Updated:** July 22, 2025


Please read this Privacy Policy carefully before using the My Page Summarizer Chrome Extension ("the Extension", "we", "us", or "our").
We recommend that you read this notice in full to ensure you are fully informed about the way we collect, use, store, or otherwise process your personal information.


---

## 1. Introduction
The “My Page Summarizer” browser extension provides an interface for summarizing the content of web pages using the Google Gemini AI model. It allows users to generate summaries of either the entire webpage (via the active tab’s URL) or specific sections of text on the page selected by the user.  
This Privacy Policy explains what information we collect, how we use it, and what we may temporarily handle during the summarization process. We are committed to respecting your privacy and minimizing data collection wherever possible.

## 2. Data Handled by this Browser Extension
- **Name and Email (from Google Sign-In)** – These may be available via the Google Sign-in, but are not directly used, stored, or processed by the extension in any way.
- **Google ID Token** – Used solely for authentication and to identify your session and is obtained after the Google Sign-in.
- **Firebase UID** – The Google ID Token is exchanged for a Firebase UID, which is used to securely identify the user in the Firestore database. This enables us to access user-specific data, such as refresh tokens and API keys, associated with the signed-in user.
- **Refresh Token** – In the Firestore Database, we store a token which we get from the Google Sign-in that allows us to refresh your session.
- **User-Provided Gemini API Key** – If you choose to input your own Gemini API key, you consent to it being securely collected and stored in our database. This key is used exclusively to fetch responses from the Gemini API on your behalf and may offer reduced rate limits compared to the default setup. Your key is **not shared with third parties** and is used only for its intended purpose.
- **Chat Messages** – Any chat message sent through our user interface is sent to Google Gemini on your behalf. The chat history may be temporarily stored locally to help the model keep track of previous interactions within the conversation. By using the chat feature, you acknowledge that your input is processed by Google and subject to [Google’s Terms of Service](https://ai.google.dev/gemini-api/terms) and [Privacy Policy](https://policies.google.com/privacy). This includes Google's right to use the submitted data, which may involve using it to improve and train their models. **Please avoid submitting any sensitive, confidential, or personally identifiable information in your messages.**
- **Website Content** – The URL of the currently active tab may be sent to the Gemini API to generate a full-page summary. Any text you select on the webpage for summarization will also be sent to Gemini. This information may be temporarily stored locally to help maintain the context of the conversation within the session but is not stored elsewhere. **Please do not select any sensitive, confidential, or personally identifiable information for summarization.**

## 3. No Use of Cookies and Tracking
We do not use cookies or any other tracking technologies in this extension and have no plans to do so in the future.

## 4. No Sale of Personal Information
We do not sell, trade, or rent your personal information to any third parties. However, please note that any content submitted through the chat is sent to the Google Gemini API, and is subject to [Google’s Terms of Service](https://ai.google.dev/gemini-api/terms) and [Privacy Policy](https://policies.google.com/privacy), which may include the use of submitted data for model improvement and other purposes.

## 5. Data Retention
Your user-provided Gemini API key is stored in our database until you choose to update it or switch back to the default internal key. Once you change or remove the key, the previous key is permanently deleted from our database. 