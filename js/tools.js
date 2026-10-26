/* ==========================================================================
   The Workshop — the three tools behind tools.html.

   Everything runs in the page: the ZIP is opened in memory, the assistant is
   called directly, the contact form posts to the inbox key in tools-config.js.
   ========================================================================== */

(() => {
  const config = window.OP_TOOLS || {};
  const $ = (selector) => document.querySelector(selector);

  /* --------------------------------------------------------------- tabs */

  const tabs = [...document.querySelectorAll('[data-tab]')];
  const panels = [...document.querySelectorAll('[data-panel]')];

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((item) => item.setAttribute('aria-selected', String(item === tab)));
      panels.forEach((panel) => {
        panel.hidden = panel.dataset.panel !== tab.dataset.tab;
      });
    });
  });

  const size = (bytes) =>
    bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

  /* ------------------------------------------------------------ the zip */

  const JSZIP_URL = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
  const MAX_BYTES = 60 * 1024 * 1024;
  const IMAGE = /\.(png|jpe?g|webp|gif|avif|svg)$/i;
  const TEXT = /\.(html?|css|js|json|md|txt|xml|csv|yml|yaml)$/i;

  const drop = $('#drop');
  const fileInput = $('#file');
  const zipStatus = $('#zip-status');
  const zipList = $('#zip-list');
  const zipFiles = $('#zip-files');
  const zipMeta = $('#zip-meta');
  const preview = $('#zip-preview');
  const previewName = $('#preview-name');
  const previewBody = $('#preview-body');
  const previewDownload = $('#preview-download');

  let jszipPromise = null;
  let objectUrl = null;

  function loadJSZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    if (!jszipPromise) {
      jszipPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = JSZIP_URL;
        script.onload = () => resolve(window.JSZip);
        script.onerror = () => reject(new Error('The unzip library could not load — check the connection.'));
        document.head.appendChild(script);
      });
    }
    return jszipPromise;
  }

  function setStatus(element, message, tone) {
    element.textContent = message || '';
    if (tone) element.dataset.tone = tone;
    else delete element.dataset.tone;
  }

  function clearPreview() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    preview.hidden = true;
    previewBody.textContent = '';
    previewDownload.removeAttribute('href');
  }

  async function showEntry(entry) {
    clearPreview();
    preview.hidden = false;
    previewName.textContent = entry.name;
    const base = entry.name.split('/').pop() || entry.name;

    try {
      const blob = await entry.async('blob');
      objectUrl = URL.createObjectURL(blob);
      previewDownload.href = objectUrl;
      previewDownload.download = base;

      if (IMAGE.test(base)) {
        const image = document.createElement('img');
        image.className = 'preview__image';
        image.alt = entry.name;
        image.src = objectUrl;
        previewBody.appendChild(image);
        return;
      }

      if (TEXT.test(base)) {
        const text = await blob.text();
        const block = document.createElement('pre');
        block.className = 'preview__text';
        block.textContent = text.length > 200000 ? `${text.slice(0, 200000)}\n\n… a first slice only` : text;
        previewBody.appendChild(block);
        return;
      }

      if (/\.pdf$/i.test(base)) {
        const frame = document.createElement('iframe');
        frame.className = 'preview__frame';
        frame.title = entry.name;
        frame.src = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        previewBody.appendChild(frame);
        return;
      }

      const note = document.createElement('p');
      note.className = 'preview__note';
      note.textContent = 'No preview for this one — download it to open it.';
      previewBody.appendChild(note);
    } catch (error) {
      previewBody.textContent = 'This file could not be read.';
    }
  }

  async function openZip(file) {
    if (!file) return;

    if (!/\.zip$/i.test(file.name)) {
      setStatus(zipStatus, 'That is not a .zip — choose a ZIP archive.', 'bad');
      return;
    }
    if (file.size > MAX_BYTES) {
      setStatus(zipStatus, 'That archive is bigger than 60 MB.', 'bad');
      return;
    }

    clearPreview();
    zipList.hidden = true;
    setStatus(zipStatus, 'Opening the archive…');

    try {
      const JSZip = await loadJSZip();
      const archive = await JSZip.loadAsync(file);
      const entries = Object.values(archive.files).filter(
        (entry) => !entry.dir && !/^__MACOSX\//.test(entry.name) && !/(^|\/)\.DS_Store$/.test(entry.name)
      );

      if (!entries.length) {
        setStatus(zipStatus, 'That archive is empty.', 'bad');
        return;
      }

      entries.sort((left, right) => left.name.localeCompare(right.name));
      zipFiles.textContent = '';

      let total = 0;
      entries.forEach((entry) => {
        const bytes = (entry._data && entry._data.uncompressedSize) || 0;
        total += bytes;

        const row = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';

        const name = document.createElement('span');
        name.className = 'file__name';
        name.textContent = entry.name;

        const meta = document.createElement('span');
        meta.className = 'file__size';
        meta.textContent = bytes ? size(bytes) : '';

        button.append(name, meta);
        button.addEventListener('click', () => showEntry(entry));
        row.appendChild(button);
        zipFiles.appendChild(row);
      });

      zipMeta.textContent = `${entries.length} files · ${size(total)}`;
      zipList.hidden = false;
      setStatus(zipStatus, 'Pick a file to look inside — nothing was uploaded anywhere.', 'good');
    } catch (error) {
      setStatus(zipStatus, error.message || 'That archive could not be opened.', 'bad');
    }
  }

  drop.addEventListener('click', (event) => {
    // the hidden input lives inside the drop zone: its own click must not loop back
    if (event.target === fileInput) return;
    fileInput.click();
  });
  drop.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fileInput.click();
    }
  });
  fileInput.addEventListener('change', () => openZip(fileInput.files[0]));

  ['dragenter', 'dragover'].forEach((type) =>
    drop.addEventListener(type, (event) => {
      event.preventDefault();
      drop.classList.add('is-over');
    })
  );
  ['dragleave', 'drop'].forEach((type) =>
    drop.addEventListener(type, (event) => {
      event.preventDefault();
      drop.classList.remove('is-over');
    })
  );
  drop.addEventListener('drop', (event) => openZip(event.dataTransfer.files[0]));

  $('#zip-clear').addEventListener('click', () => {
    zipFiles.textContent = '';
    zipList.hidden = true;
    clearPreview();
    setStatus(zipStatus, '');
    fileInput.value = '';
  });

  /* ----------------------------------------------------------- assistant */

  const chatLog = $('#chat-log');
  const chatForm = $('#chat-form');
  const chatInput = $('#chat-input');
  const chatStatus = $('#chat-status');
  const history = [];

  function bubble(role, text) {
    const line = document.createElement('p');
    line.className = `bubble bubble--${role}`;
    line.textContent = text;
    chatLog.appendChild(line);
    chatLog.scrollTop = chatLog.scrollHeight;
    return line;
  }

  async function ask(messages) {
    const endpoint = (config.chat && config.chat.endpoint) || 'https://text.pollinations.ai/';
    const base = endpoint.endsWith('/') ? endpoint : `${endpoint}/`;
    const system =
      (config.chat && config.chat.system) ||
      'You are the guide of a ONE PIECE fan tribute site. Answer briefly and warmly.';

    const payload = [{ role: 'system', content: system }, ...messages.slice(-12)];

    try {
      const response = await fetch(`${base}openai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'openai', messages: payload }),
      });
      if (response.ok) {
        const data = await response.json();
        const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        if (text) return String(text).trim();
      }
    } catch (error) {
      // fall through to the plain endpoint
    }

    const flat = payload.map((message) => `${message.role}: ${message.content}`).join('\n');
    const plain = await fetch(`${base}${encodeURIComponent(flat)}`);
    if (!plain.ok) throw new Error('The assistant is quiet right now — try again in a moment.');
    const answer = (await plain.text()).trim();
    if (!answer) throw new Error('The assistant is quiet right now — try again in a moment.');
    return answer;
  }

  chatForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const question = chatInput.value.trim();
    if (!question) return;

    chatInput.value = '';
    chatInput.disabled = true;
    setStatus(chatStatus, '');

    const empty = chatLog.querySelector('.chat__empty');
    if (empty) empty.remove();

    bubble('user', question);
    const pending = bubble('bot', '…');
    pending.classList.add('is-waiting');

    try {
      const answer = await ask([...history, { role: 'user', content: question }]);
      history.push({ role: 'user', content: question }, { role: 'assistant', content: answer });
      if (history.length > 24) history.splice(0, history.length - 24);
      pending.textContent = answer;
    } catch (error) {
      pending.remove();
      setStatus(chatStatus, error.message || 'The assistant did not answer.', 'bad');
    } finally {
      chatInput.disabled = false;
      chatInput.focus();
    }
  });

  /* ------------------------------------------------------------- contact */

  const contactForm = $('#contact-form');
  const contactStatus = $('#contact-status');

  contactForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const contact = config.contact || {};

    if (!contact.accessKey) {
      setStatus(
        contactStatus,
        'Add your free Web3Forms key to js/tools-config.js first — the README shows the two-minute way.',
        'bad'
      );
      return;
    }

    const button = contactForm.querySelector('button[type="submit"]');
    button.disabled = true;
    setStatus(contactStatus, 'Sending…');

    try {
      const data = new FormData(contactForm);
      data.set('access_key', contact.accessKey);
      data.set('subject', 'A note from the ONE PIECE site');

      const response = await fetch(contact.endpoint || 'https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: data,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success === false) {
        throw new Error(result.message || 'The message could not be sent.');
      }

      contactForm.reset();
      setStatus(contactStatus, 'Sent — it is in the inbox already. Thank you.', 'good');
    } catch (error) {
      setStatus(contactStatus, error.message || 'The message could not be sent.', 'bad');
    } finally {
      button.disabled = false;
    }
  });

  /* ------------------------------------------------------------- install */

  const install = $('#install');
  let promptEvent = null;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    promptEvent = event;
    install.hidden = false;
  });

  install.addEventListener('click', async () => {
    if (!promptEvent) return;
    promptEvent.prompt();
    await promptEvent.userChoice;
    promptEvent = null;
    install.hidden = true;
  });
})();