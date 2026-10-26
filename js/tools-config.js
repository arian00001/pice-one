/* ==========================================================================
   What the Workshop talks to. Nothing here is secret — this file ships with
   the site, so never put a private key in it.

   contact.accessKey
     Free key from https://web3forms.com — it is tied to one inbox, and that is
     where every message from tools.html lands. Paste it below and the contact
     form starts sending for real. This is the "email inbox" switch.
     (Prefer Formspree? Swap `endpoint` and put that form's ID in `accessKey`.)

   chat.endpoint
     Any OpenAI-compatible chat endpoint. The default is the free, key-less
     Pollinations text API, so the assistant works out of the box. Point it at
     your own server or gateway later by changing this one line.
   ========================================================================== */

window.OP_TOOLS = {
  contact: {
    endpoint: 'https://api.web3forms.com/submit',
    accessKey: '',
  },
  chat: {
    endpoint: 'https://text.pollinations.ai/',
    system: 'You are the guide of a ONE PIECE fan tribute site. Answer in a warm, short, cinematic tone, at most a few sentences.',
  },
};