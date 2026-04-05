CRESSCOX AI CHATBOT SETUP

1) Copy chatbot.css and chatbot.js into your website folder.
2) Add this inside <head>:
   <link rel="stylesheet" href="chatbot.css">

3) Add this before </body>:
   <script>
     window.CX_CHATBOT_API_BASE_URL = "http://localhost:3000";
     window.CX_CHATBOT_ASSISTANT_NAME = "CresscoX Concierge";
     window.CX_CHATBOT_COMPANY_NAME = "CresscoX";
   </script>
   <script src="chatbot.js"></script>

4) In the chatbot backend folder:
   npm install
   copy .env.example to .env
   add your OPENAI_API_KEY
   npm start

5) Open your website in the browser.

Notes:
- Keep your OpenAI API key only on the server.
- This chatbot uses conversation memory per browser session.
- It is designed for natural business conversations, not option-based flows.
