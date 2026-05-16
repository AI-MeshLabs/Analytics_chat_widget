(function () {
  if (window.__OnePointAnalyticsWidgetLoaded) return;
  window.__OnePointAnalyticsWidgetLoaded = true;
  window.__OPAW_WIDGET_BUILD = "20260516-responsive";

  var config = window.AnalyticsWidgetConfig || {};
  var apiBase = (config.apiBase || window.location.origin || "").replace(/\/$/, "");
  var token = config.token || "";

  var host = document.createElement("div");
  host.id = "onepoint-analytics-widget-root";
  document.body.appendChild(host);

  var shadowRoot = host.attachShadow({ mode: "open" });

  var style = document.createElement("style");
  style.textContent = [
    ":host { all: initial; }",
    ".shell {",
    "  position: fixed;",
    "  right: max(16px, env(safe-area-inset-right, 0px));",
    "  bottom: max(16px, env(safe-area-inset-bottom, 0px));",
    "  z-index: 2147483647;",
    "  display: flex;",
    "  flex-direction: column;",
    "  align-items: flex-end;",
    "  max-height: calc(100dvh - max(16px, env(safe-area-inset-top, 0px)) - max(16px, env(safe-area-inset-bottom, 0px)));",
    "  --opaw-fab-stack: 86px;",
    "  --opaw-panel-max-h: calc(100vh - var(--opaw-fab-stack) - max(16px, env(safe-area-inset-top, 0px)) - max(16px, env(safe-area-inset-bottom, 0px)));",
    "  --opaw-panel-max-h: calc(100dvh - var(--opaw-fab-stack) - max(16px, env(safe-area-inset-top, 0px)) - max(16px, env(safe-area-inset-bottom, 0px)));",
    "  font-family: Arial, Helvetica, sans-serif;",
    "  color: #172033;",
    "}",
    ".panel {",
    "  width: 380px;",
    "  max-width: calc(100vw - 32px);",
    "  height: min(560px, var(--opaw-panel-max-h));",
    "  max-height: var(--opaw-panel-max-h);",
    "  transition: width 0.2s ease, height 0.2s ease, max-height 0.2s ease;",
    "  background: rgba(255, 255, 255, 0.96);",
    "  border: 1px solid rgba(226, 234, 242, 0.95);",
    "  border-radius: 22px;",
    "  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.18);",
    "  overflow: hidden;",
    "  display: flex;",
    "  flex-direction: column;",
    "  flex-shrink: 1;",
    "  min-height: 0;",
    "  backdrop-filter: blur(14px);",
    "}",
    ".hidden { display: none; }",
    ".header {",
    "  padding: 14px 16px;",
    "  background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%);",
    "  color: #fff;",
    "  display: flex;",
    "  justify-content: space-between;",
    "  align-items: flex-start;",
    "  gap: 12px;",
    "  flex-shrink: 0;",
    "}",
    ".header > div:first-child { min-width: 0; flex: 1; }",
    ".title { font-size: 15px; font-weight: 700; margin: 0 0 4px; line-height: 1.3; }",
    ".subtitle { font-size: 12px; color: rgba(255,255,255,0.85); line-height: 1.4; margin: 0; }",
    ".clear-btn {",
    "  align-self: flex-start;",
    "  display: inline-flex;",
    "  align-items: center;",
    "  justify-content: center;",
    "  width: 32px;",
    "  height: 32px;",
    "  box-sizing: border-box;",
    "  background: rgba(255,255,255,0.14);",
    "  color: #fff;",
    "  border: 1px solid rgba(255,255,255,0.22);",
    "  border-radius: 10px;",
    "  padding: 0;",
    "  cursor: pointer;",
    "}",
    ".body { flex: 1; display: flex; flex-direction: column; min-height: 0; background: linear-gradient(180deg, #f8fbff 0%, #ffffff 100%); }",
    ".chat { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; }",
    ".msg { max-width: 88%; padding: 10px 12px; border-radius: 14px; font-size: 13px; line-height: 1.5; }",
    ".msg.user { align-self: flex-end; background: #1d4ed8; color: #fff; border-bottom-right-radius: 6px; }",
    ".msg.bot { align-self: flex-start; background: #fff; border: 1px solid #e5edf9; color: #172033; border-bottom-left-radius: 6px; }",
    ".msg.bot strong { font-weight: 700; }",
    ".typing { font-size: 12px; color: #64748b; padding: 0 14px 8px; flex-shrink: 0; }",
    ".input-wrap { border-top: 1px solid #e6eaf2; padding: 12px 14px 14px; background: rgba(255,255,255,0.95); flex-shrink: 0; }",
    ".input-row { display: flex; gap: 8px; align-items: center; border: 1px solid #dfe7f3; border-radius: 14px; background: #f8fafc; padding: 8px; }",
    ".input { flex: 1; border: none; outline: none; background: transparent; font-size: 13px; color: #172033; }",
    ".send { border: none; border-radius: 10px; background: #2563eb; color: #fff; font-weight: 700; font-size: 12px; padding: 9px 12px; cursor: pointer; }",
    ".send[disabled], .input[disabled] { opacity: 0.7; cursor: not-allowed; }",
    ".footer { margin-top: 8px; font-size: 12px; color: #6b7280; text-align: center; line-height: 1.45; }",
    ".fab-wrap { display: flex; flex-direction: row; align-items: center; gap: 6px; margin-top: 12px; flex-shrink: 0; }",
    ".fab-label { position: relative; flex-shrink: 0; width: 68px; height: 38px; background: #0f172a; color: #fff; border-radius: 999px; font-size: 11px; display: flex; align-items: center; justify-content: center; box-shadow: 0 12px 30px rgba(15,23,42,0.18); white-space: nowrap; pointer-events: none; transform: translateY(-5px); }",
    ".fab-label::after { content: ''; position: absolute; right: 8px; bottom: -4px; width: 10px; height: 10px; background: #0f172a; transform: rotate(45deg); border-bottom-right-radius: 3px; }",
    ".fab { flex-shrink: 0; width: 62px; height: 62px; border: none; border-radius: 20px; background: linear-gradient(135deg, #2563eb 0%, #0f172a 100%); color: #fff; font-size: 24px; font-weight: 700; box-shadow: 0 16px 40px rgba(15,23,42,0.24); cursor: pointer; }",
    ".chips-row { display: flex; flex-wrap: wrap; gap: 8px; border-bottom: 1px solid #e2e8f0; padding: 10px 16px; background: rgba(255,255,255,0.9); flex-shrink: 0; }",
    ".chip { border: 1px solid #dbeafe; background: #eff6ff; color: #1d4ed8; border-radius: 999px; padding: 6px 12px; font-size: 11px; font-weight: 600; cursor: pointer; font-family: inherit; }",
    ".chip:hover { background: #dbeafe; }",
    ".header-actions { display: flex; gap: 6px; align-items: flex-start; flex-shrink: 0; }",
    ".panel.panel-expanded { width: min(600px, calc(100vw - 32px)); height: min(800px, var(--opaw-panel-max-h)); max-height: var(--opaw-panel-max-h); }",
    "@media (max-width: 640px) {",
    "  .shell { right: max(12px, env(safe-area-inset-right, 0px)); bottom: max(12px, env(safe-area-inset-bottom, 0px)); --opaw-fab-stack: 80px; }",
    "  .panel, .panel.panel-expanded { width: min(380px, calc(100vw - 24px)); border-radius: 18px; }",
    "  .header { padding: 12px 14px; }",
    "  .title { font-size: 14px; }",
    "  .subtitle { font-size: 11px; }",
    "}",
    "@media (max-height: 720px) {",
    "  .panel { height: min(480px, var(--opaw-panel-max-h)); }",
    "}",
  ].join("");

  var shell = document.createElement("div");
  shell.className = "shell";

  var panel = document.createElement("section");
  panel.className = "panel hidden";

  var header = document.createElement("div");
  header.className = "header";
  header.innerHTML =
    '<div><p class="title">OnePoint Call Analytics</p><p class="subtitle">Ask Sally questions in plain English about call volume, durations, unsuccessful calls, and daily trends.</p></div>';

  var headerActions = document.createElement("div");
  headerActions.className = "header-actions";
  var clearIconHtml =
    '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4.5H14"></path><path d="M6 2.5H10"></path><path d="M3.5 4.5L4.2 13.5C4.25 14.1 4.75 14.5 5.35 14.5H10.65C11.25 14.5 11.75 14.1 11.8 13.5L12.5 4.5"></path><path d="M6.5 7V12"></path><path d="M9.5 7V12"></path></svg>';
  var expandIconHtml =
    '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 1.5H14.5V6.5"></path><path d="M14.5 1.5L8.75 7.25"></path><path d="M6.5 14.5H1.5V9.5"></path><path d="M1.5 14.5L7.25 8.75"></path></svg>';
  var collapseIconHtml =
    '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 1.5H1.5V6.5"></path><path d="M1.5 1.5L7.25 7.25"></path><path d="M9.5 14.5H14.5V9.5"></path><path d="M14.5 14.5L8.75 8.75"></path></svg>';
  var minimizeIconHtml =
    '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8H12.5"></path></svg>';

  var clearBtn = document.createElement("button");
  clearBtn.className = "clear-btn";
  clearBtn.type = "button";
  clearBtn.innerHTML = clearIconHtml;
  clearBtn.style.color = "#ffffff";
  clearBtn.setAttribute("aria-label", "Clear chat");
  clearBtn.title = "Clear chat";

  var expandBtn = document.createElement("button");
  expandBtn.className = "clear-btn";
  expandBtn.type = "button";
  expandBtn.innerHTML = expandIconHtml;
  expandBtn.style.color = "#ffffff";
  expandBtn.setAttribute("aria-expanded", "false");
  expandBtn.setAttribute("aria-label", "Expand panel");
  expandBtn.title = "Expand panel";

  var minimizeBtn = document.createElement("button");
  minimizeBtn.className = "clear-btn";
  minimizeBtn.type = "button";
  minimizeBtn.innerHTML = minimizeIconHtml;
  minimizeBtn.style.color = "#ffffff";
  minimizeBtn.setAttribute("aria-label", "Minimize panel");
  minimizeBtn.title = "Minimize panel";
  headerActions.appendChild(clearBtn);
  headerActions.appendChild(expandBtn);
  headerActions.appendChild(minimizeBtn);
  header.appendChild(headerActions);

  expandBtn.addEventListener("click", function () {
    var on = panel.classList.toggle("panel-expanded");
    expandBtn.innerHTML = on ? collapseIconHtml : expandIconHtml;
    expandBtn.setAttribute("aria-expanded", on ? "true" : "false");
    expandBtn.setAttribute("aria-label", on ? "Collapse panel" : "Expand panel");
    expandBtn.title = on ? "Collapse panel" : "Expand panel";
  });

  clearBtn.addEventListener("click", function () {
    messages = initialMessages.slice();
    input.value = "";
    setLoading(false);
    renderMessages();
  });

  var body = document.createElement("div");
  body.className = "body";

  var chipsRow = document.createElement("div");
  chipsRow.className = "chips-row";

  var chat = document.createElement("div");
  chat.className = "chat";

  var typing = document.createElement("div");
  typing.className = "typing hidden";
  typing.textContent = "Assistant is typing...";

  var inputWrap = document.createElement("form");
  inputWrap.className = "input-wrap";

  var inputRow = document.createElement("div");
  inputRow.className = "input-row";

  var input = document.createElement("input");
  input.className = "input";
  input.placeholder = "Ask about today's calls, average duration, failed calls, trends...";
  input.type = "text";

  var sendBtn = document.createElement("button");
  sendBtn.className = "send";
  sendBtn.type = "submit";
  sendBtn.textContent = "Send";

  var chipDefs = [
    { label: "Calls today", fill: "Tell me the number of calls made today" },
    { label: "Average duration", fill: "Tell me the average call duration for today" },
    { label: "Unsuccessful calls", fill: "Tell me the unsuccessful calls for today" },
  ];

  inputRow.appendChild(input);
  inputRow.appendChild(sendBtn);

  var footer = document.createElement("p");
  footer.className = "footer";
  footer.innerHTML =
    'Powered by <a href="https://aimeshlabs.com/" target="_blank" rel="noopener noreferrer"><strong>AI MESHLABS</strong></a><br>&copy;2026 <a href="https://onepointhealth.com.au/" target="_blank" rel="noopener noreferrer"><strong>OnePoint Health</strong></a>. All rights reserved.';

  inputWrap.appendChild(inputRow);
  inputWrap.appendChild(footer);

  body.appendChild(chipsRow);
  body.appendChild(chat);
  body.appendChild(typing);
  body.appendChild(inputWrap);

  panel.appendChild(header);
  panel.appendChild(body);

  var fabWrap = document.createElement("div");
  fabWrap.className = "fab-wrap";
  var fabLabel = document.createElement("div");
  fabLabel.className = "fab-label";
  fabLabel.textContent = "Ask Me";
  var fab = document.createElement("button");
  fab.className = "fab";
  fab.type = "button";
  fab.textContent = "✦";
  fab.setAttribute("aria-expanded", "false");
  fab.setAttribute("aria-label", "Open OnePoint Call Analytics");
  fabWrap.appendChild(fabLabel);
  fabWrap.appendChild(fab);

  shell.appendChild(panel);
  shell.appendChild(fabWrap);
  shadowRoot.appendChild(style);
  shadowRoot.appendChild(shell);

  var initialMessages = [
    {
      role: "bot",
      text: "Hi there, I'm Sally, your Analytics AI Assistant. I can summarise call activity, average durations, unsuccessful calls etc.",
    },
  ];

  var messages = initialMessages.slice();
  var isLoading = false;

  function appendAssistantTextWithBoldNumbers(container, text) {
    var re = /(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)/g;
    var lastIndex = 0;
    var match;
    while ((match = re.exec(text)) !== null) {
      if (match.index > lastIndex) {
        container.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }
      var strong = document.createElement("strong");
      strong.textContent = match[0];
      container.appendChild(strong);
      lastIndex = re.lastIndex;
    }
    if (lastIndex < text.length) {
      container.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
  }

  function appendAssistantFormatted(container, text) {
    var segments = text.split(/(\*\*[\s\S]*?\*\*)/g);
    for (var si = 0; si < segments.length; si++) {
      var seg = segments[si];
      if (!seg) continue;
      var bm = seg.match(/^\*\*([\s\S]*?)\*\*$/);
      if (bm) {
        var st = document.createElement("strong");
        st.textContent = bm[1];
        container.appendChild(st);
      } else {
        appendAssistantTextWithBoldNumbers(container, seg);
      }
    }
  }

  function renderMessages() {
    chat.innerHTML = "";
    for (var i = 0; i < messages.length; i++) {
      var item = messages[i];
      var node = document.createElement("div");
      node.className = "msg " + (item.role === "user" ? "user" : "bot");
      if (item.role === "user") {
        node.textContent = item.text;
      } else {
        appendAssistantFormatted(node, item.text);
      }
      chat.appendChild(node);
    }
    chat.scrollTop = chat.scrollHeight;
  }

  function setLoading(loading) {
    isLoading = loading;
    if (loading) typing.classList.remove("hidden");
    else typing.classList.add("hidden");
    input.disabled = loading;
    sendBtn.disabled = loading;
    sendBtn.textContent = loading ? "Sending..." : "Send";
  }

  function getApiUrl() {
    return apiBase + "/api/analytics-chat/query";
  }

  var CHAT_FETCH_MS = 45000;

  function chatTimeoutSignal(ms) {
    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
      return AbortSignal.timeout(ms);
    }
    var c = new AbortController();
    setTimeout(function () {
      c.abort();
    }, ms);
    return c.signal;
  }

  async function askQuestion(question) {
    messages.push({ role: "user", text: question });
    renderMessages();
    setLoading(true);

    try {
      var headers = { "Content-Type": "application/json" };
      if (token) headers.Authorization = "Bearer " + token;

      var res = await fetch(getApiUrl(), {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ question: question }),
        signal: chatTimeoutSignal(CHAT_FETCH_MS),
      });

      if (!res.ok) throw new Error("Request failed");
      var payload = await res.json();
      messages.push({
        role: "bot",
        text: (payload && payload.answer) || "No response available.",
      });
    } catch (err) {
      var msg =
        err && err.name === "AbortError"
          ? "That request took too long (server or database may be slow). Try a shorter range or try again."
          : "Sorry, I could not fetch analytics right now. Please try again.";
      messages.push({
        role: "bot",
        text: msg,
      });
    } finally {
      setLoading(false);
      renderMessages();
    }
  }

  for (var cj = 0; cj < chipDefs.length; cj++) {
    (function (def) {
      var chipBtn = document.createElement("button");
      chipBtn.type = "button";
      chipBtn.className = "chip";
      chipBtn.textContent = def.label;
      chipBtn.addEventListener("click", function () {
        if (isLoading) return;
        void askQuestion(def.fill);
      });
      chipsRow.appendChild(chipBtn);
    })(chipDefs[cj]);
  }

  inputWrap.addEventListener("submit", function (event) {
    event.preventDefault();
    var text = input.value.trim();
    if (!text || isLoading) return;
    input.value = "";
    askQuestion(text);
  });

  minimizeBtn.addEventListener("click", function () {
    panel.classList.add("hidden");
    panel.classList.remove("panel-expanded");
    expandBtn.innerHTML = expandIconHtml;
    expandBtn.setAttribute("aria-expanded", "false");
    expandBtn.setAttribute("aria-label", "Expand panel");
    expandBtn.title = "Expand panel";
    fab.setAttribute("aria-expanded", "false");
    fab.setAttribute("aria-label", "Open OnePoint Call Analytics");
  });

  fab.addEventListener("click", function () {
    panel.classList.toggle("hidden");
    var closed = panel.classList.contains("hidden");
    fab.setAttribute("aria-expanded", closed ? "false" : "true");
    fab.setAttribute(
      "aria-label",
      closed ? "Open OnePoint Call Analytics" : "Minimize OnePoint Call Analytics",
    );
    if (closed) {
      panel.classList.remove("panel-expanded");
      expandBtn.innerHTML = expandIconHtml;
      expandBtn.setAttribute("aria-expanded", "false");
      expandBtn.setAttribute("aria-label", "Expand panel");
      expandBtn.title = "Expand panel";
    }
  });

  renderMessages();
})();
