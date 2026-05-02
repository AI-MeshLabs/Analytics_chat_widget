(function () {
  if (window.__OnePointAnalyticsWidgetLoaded) return;
  window.__OnePointAnalyticsWidgetLoaded = true;

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
    "  right: 24px;",
    "  bottom: 24px;",
    "  z-index: 2147483647;",
    "  font-family: Arial, Helvetica, sans-serif;",
    "  color: #172033;",
    "}",
    ".panel {",
    "  width: 380px;",
    "  max-width: calc(100vw - 32px);",
    "  height: 560px;",
    "  background: rgba(255, 255, 255, 0.96);",
    "  border: 1px solid rgba(226, 234, 242, 0.95);",
    "  border-radius: 22px;",
    "  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.18);",
    "  overflow: hidden;",
    "  display: flex;",
    "  flex-direction: column;",
    "  backdrop-filter: blur(14px);",
    "}",
    ".hidden { display: none; }",
    ".header {",
    "  padding: 14px 16px;",
    "  background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%);",
    "  color: #fff;",
    "  display: flex;",
    "  justify-content: space-between;",
    "  gap: 12px;",
    "}",
    ".title { font-size: 15px; font-weight: 700; margin: 0 0 4px; }",
    ".subtitle { font-size: 12px; color: rgba(255,255,255,0.85); line-height: 1.4; margin: 0; }",
    ".clear-btn {",
    "  align-self: flex-start;",
    "  background: rgba(255,255,255,0.14);",
    "  color: #fff;",
    "  border: 1px solid rgba(255,255,255,0.22);",
    "  border-radius: 10px;",
    "  font-size: 11px;",
    "  font-weight: 700;",
    "  padding: 7px 9px;",
    "  cursor: pointer;",
    "}",
    ".body { flex: 1; display: flex; flex-direction: column; min-height: 0; background: linear-gradient(180deg, #f8fbff 0%, #ffffff 100%); }",
    ".chat { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; }",
    ".msg { max-width: 88%; padding: 10px 12px; border-radius: 14px; font-size: 13px; line-height: 1.5; }",
    ".msg.user { align-self: flex-end; background: #1d4ed8; color: #fff; border-bottom-right-radius: 6px; }",
    ".msg.bot { align-self: flex-start; background: #fff; border: 1px solid #e5edf9; color: #172033; border-bottom-left-radius: 6px; }",
    ".msg.bot strong { font-weight: 700; }",
    ".typing { font-size: 12px; color: #64748b; padding: 0 14px 8px; }",
    ".input-wrap { border-top: 1px solid #e6eaf2; padding: 12px 14px 14px; background: rgba(255,255,255,0.95); }",
    ".input-row { display: flex; gap: 8px; align-items: center; border: 1px solid #dfe7f3; border-radius: 14px; background: #f8fafc; padding: 8px; }",
    ".input { flex: 1; border: none; outline: none; background: transparent; font-size: 13px; color: #172033; }",
    ".send { border: none; border-radius: 10px; background: #2563eb; color: #fff; font-weight: 700; font-size: 12px; padding: 9px 12px; cursor: pointer; }",
    ".send[disabled], .input[disabled] { opacity: 0.7; cursor: not-allowed; }",
    ".footer { margin-top: 8px; font-size: 11px; color: #6b7280; text-align: center; line-height: 1.45; }",
    ".fab-wrap { position: relative; margin-top: 12px; display: flex; justify-content: flex-end; }",
    ".fab-label { position: absolute; right: 74px; bottom: 12px; background: #0f172a; color: #fff; padding: 8px 11px; border-radius: 10px; font-size: 12px; box-shadow: 0 12px 30px rgba(15,23,42,0.18); }",
    ".fab { width: 62px; height: 62px; border: none; border-radius: 20px; background: linear-gradient(135deg, #2563eb 0%, #0f172a 100%); color: #fff; font-size: 24px; font-weight: 700; box-shadow: 0 16px 40px rgba(15,23,42,0.24); cursor: pointer; }",
  ].join("");

  var shell = document.createElement("div");
  shell.className = "shell";

  var panel = document.createElement("section");
  panel.className = "panel";

  var header = document.createElement("div");
  header.className = "header";
  header.innerHTML =
    '<div><p class="title">OnePoint Analytics Assistant</p><p class="subtitle">Ask questions about call volume, durations, unsuccessful calls, and trends.</p></div>';

  var clearBtn = document.createElement("button");
  clearBtn.className = "clear-btn";
  clearBtn.type = "button";
  clearBtn.textContent = "Clear";
  header.appendChild(clearBtn);

  var body = document.createElement("div");
  body.className = "body";

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
  input.placeholder = "Ask about calls, durations, and trends...";
  input.type = "text";

  var sendBtn = document.createElement("button");
  sendBtn.className = "send";
  sendBtn.type = "submit";
  sendBtn.textContent = "Send";

  inputRow.appendChild(input);
  inputRow.appendChild(sendBtn);

  var footer = document.createElement("p");
  footer.className = "footer";
  footer.innerHTML = "Powered by AI MESHLABS<br>&copy;2026 OnePoint Health. All rights reserved.";

  inputWrap.appendChild(inputRow);
  inputWrap.appendChild(footer);

  body.appendChild(chat);
  body.appendChild(typing);
  body.appendChild(inputWrap);

  panel.appendChild(header);
  panel.appendChild(body);

  var fabWrap = document.createElement("div");
  fabWrap.className = "fab-wrap";
  var fabLabel = document.createElement("div");
  fabLabel.className = "fab-label";
  fabLabel.textContent = "Analytics AI";
  var fab = document.createElement("button");
  fab.className = "fab";
  fab.type = "button";
  fab.textContent = "✦";
  fabWrap.appendChild(fabLabel);
  fabWrap.appendChild(fab);

  shell.appendChild(panel);
  shell.appendChild(fabWrap);
  shadowRoot.appendChild(style);
  shadowRoot.appendChild(shell);

  var initialMessages = [
    {
      role: "bot",
      text: "Hi, I am your call analytics assistant. I can summarize call activity, average durations, unsuccessful calls, and trends.",
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

  function renderMessages() {
    chat.innerHTML = "";
    for (var i = 0; i < messages.length; i++) {
      var item = messages[i];
      var node = document.createElement("div");
      node.className = "msg " + (item.role === "user" ? "user" : "bot");
      if (item.role === "user") {
        node.textContent = item.text;
      } else {
        appendAssistantTextWithBoldNumbers(node, item.text);
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

  inputWrap.addEventListener("submit", function (event) {
    event.preventDefault();
    var text = input.value.trim();
    if (!text || isLoading) return;
    input.value = "";
    askQuestion(text);
  });

  clearBtn.addEventListener("click", function () {
    messages = initialMessages.slice();
    input.value = "";
    setLoading(false);
    renderMessages();
  });

  fab.addEventListener("click", function () {
    panel.classList.toggle("hidden");
  });

  renderMessages();
})();
