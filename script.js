let OPENAI_API_KEY = "";
let PERPLEXITY_API_KEY = ""; 

let conversations = []; 
let currentConversation = []; 
let currentHistoryId = 0; 


async function loadApiKeys() {
    try {
      const response = await fetch("https://script.google.com/macros/s/AKfycbxE6il3-QCWksacjZ4D7a8AWt1Tt-ZrXIfZwTZ76l0wOThPsWbuFCNHQvXx8vZh-XXd/exec"); // Replace with your URL
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      const rawText = await response.text();
  
      const keys = JSON.parse(rawText);

      OPENAI_API_KEY = keys.OPENAI_KEY || "";
      PERPLEXITY_API_KEY = keys.PPLX_KEY || "";
      
    } catch (error) {
      console.error("Failed to load API keys from Google Sheets:", error);
    }
  }
  

async function fetchPerplexityResponse() {
  const endpoint = "https://api.perplexity.ai/chat/completions";
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
  };

  let messages = currentConversation.map(msg => ({
    role: msg.sender === "You" ? "user" : "assistant",
    content: msg.message
  }));

  while (messages.length && messages[messages.length - 1].role === "assistant") {
    messages.pop();
  }

  const body = JSON.stringify({
    model: "sonar",
    messages: messages,
  });
  try {
    const response = await fetch(endpoint, { method: "POST", headers, body });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Perplexity API Error:", errorData);
      throw new Error(`API Error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;

  } catch (error) {
    console.error("Error fetching Perplexity response:", error);
    return "Sorry, there was an issue connecting to Perplexity.";
  }
}



async function fetchChatGPTResponse() {
  const endpoint = "https://api.openai.com/v1/chat/completions";
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${OPENAI_API_KEY}`,
  };

  // Build the message history for OpenAI
  const messages = [
    { role: "system", content: "You are a helpful assistant." },
    ...currentConversation.map(msg => ({
      role: msg.sender === "You" ? "user" : "assistant",
      content: msg.message
    }))
  ];

  const body = JSON.stringify({
    model: "gpt-3.5-turbo",
    messages: messages,
    max_tokens: 150,
    temperature: 0.7,
  });

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("OpenAI API Error:", errorData);
      throw new Error(`API Error: ${errorData.error.message}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;

  } catch (error) {
    console.error("Error fetching ChatGPT response:", error);
    return "Sorry, there was an issue connecting to ChatGPT.";
  }
}

  async function fetchModelResponseWithPuter(prompt) {
  try {
    const response = await puter.ai.chat(prompt, { model: "gpt-5-nano" }); // or other available models
    return response.message ? response.message.content : response;
  } catch (error) {
    console.error("Error connecting to Puter:", error);
    return "Sorry, there was an issue connecting to Puter.";
  }
}


function displayConversation(conversation) {
  const responseArea = document.getElementById("responseArea");
  responseArea.innerHTML = "";

  conversation.forEach((messageObj) => {
    const wrapper = document.createElement("div");
    wrapper.classList.add("message-wrapper");

    const div = document.createElement("div");
    div.classList.add("message", messageObj.sender === "You" ? "user" : "chatgpt");

    if (messageObj.sender !== "You") {
      const content = messageObj.message;

      const parts = content.split(/(```[\s\S]*?```)/g);

      parts.forEach(part => {
        if (part.startsWith("```")) {
          const codeContent = part.replace(/```(\w+)?\n?/, "").replace(/```$/, "");

          const pre = document.createElement("pre");
          const code = document.createElement("code");
          code.textContent = codeContent.trim();
          pre.appendChild(code);
          div.appendChild(pre);
        } else {
          const lines = part.split(/\n/).filter(line => line.trim() !== "");
          if (lines.length > 1) {
            const ul = document.createElement("ul");
            lines.forEach(line => {
              const li = document.createElement("li");
              li.textContent = line.trim();
              ul.appendChild(li);
            });
            div.appendChild(ul);
          } else {
            const p = document.createElement("p");
            p.textContent = part.trim();
            div.appendChild(p);
          }
        }
      });
    } else {
      div.textContent = messageObj.message;
    }

    const copyBtn = document.createElement("button");
    copyBtn.textContent = "📋 Copy";
    copyBtn.classList.add("copy-btn");
    copyBtn.addEventListener("click", () => {
      const cleanCopyText = messageObj.message.replace(/```(\w+)?\n?/g, "").replace(/```/g, "");
      navigator.clipboard.writeText(cleanCopyText)
        .then(() => {
          copyBtn.textContent = "✅ Copied!";
          setTimeout(() => (copyBtn.textContent = "📋 Copy"), 1500);
        })
        .catch(() => alert("Copy failed"));
    });

    wrapper.appendChild(div);
    wrapper.appendChild(copyBtn);
    responseArea.appendChild(wrapper);
  });
}

  

function updateHistory(conversationId) {
  const history = document.getElementById("history");

  let existingItem = document.querySelector(`li[data-conversation-id="${conversationId}"]`);
  if (existingItem) return;

  const historyItem = document.createElement("li");
  historyItem.textContent = `Conversation ${conversationId}`;
  historyItem.dataset.conversationId = conversationId;

  historyItem.addEventListener("click", () => {
    document.querySelectorAll(".sidebar li").forEach((item) => {
      item.classList.remove("active");
    });
    historyItem.classList.add("active");

    const conversation = conversations[conversationId - 1];
    displayConversation(conversation);
  });

  history.appendChild(historyItem);
}


document.getElementById("userInput").addEventListener("keydown", async function (e) {
    // Shift + Enter sends the message
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      await sendMessage();
    }
  });
  
document.getElementById("sendButton").addEventListener("click", async function () {
  await sendMessage();
});

async function sendMessage() {
    const inputField = document.getElementById("userInput");
    const sendButton = document.getElementById("sendButton");
    const modelSelector = document.getElementById("modelSelector");
    const selectedModel = modelSelector.value;
  
    const userMessage = inputField.value.trim();
  
    if (!userMessage) return;
  
    sendButton.disabled = true;
    inputField.disabled = true;
  
    if (currentConversation.length === 0) {
      currentHistoryId = conversations.length + 1;
      updateHistory(currentHistoryId);
    }
  
    currentConversation.push({ sender: "You", message: userMessage });
    displayConversation(currentConversation);
    inputField.value = "";
  
    const placeholder = { sender: "Chat", message: "" };
    currentConversation.push(placeholder);
    displayConversation(currentConversation);
  
    try {
      let responseText = "";
      
      if (selectedModel === "puter") {
        responseText = await fetchModelResponseWithPuter(userMessage);
      } else if (selectedModel === "chat") {
        responseText = await fetchChatGPTResponse(userMessage);
      } else if (selectedModel === "per") {
        responseText = await fetchPerplexityResponse(userMessage);
      } else {
        responseText = await fetchModelResponseWithPuter(userMessage);
      }
  
      await animateTyping(responseText, placeholder);
    } catch (error) {
      console.error(error);
      placeholder.message = "Error: Unable to fetch response.";
    }
  
    displayConversation(currentConversation);
  
    sendButton.disabled = false;
    inputField.disabled = false;
    inputField.focus();
  
    saveHistoryToCookies();
  }
  
  // Event listener for "New" button
document.getElementById("newConversationButton").addEventListener("click", function () {
  if (currentConversation.length > 0) {
    // Save the current conversation to history
    conversations.push(currentConversation);
  }

  // Start a new conversation
  currentConversation = [];

  // Clear the response area
  document.getElementById("responseArea").innerHTML =
    '<p class="center-text">What can I help with?</p>';

  // Clear active history highlight
  document.querySelectorAll(".sidebar li").forEach((item) => {
    item.classList.remove("active");
  });
});
function saveHistoryToCookies() {
    const serializedHistory = JSON.stringify(conversations);
    setCookie('chatHistory', serializedHistory, 7); // Store it for 7 days
  }

function setCookie(name, value, days) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    const expires = `expires=${date.toUTCString()}`;
    document.cookie = `${name}=${encodeURIComponent(value)}; ${expires}; path=/`;
  }
  
  function getCookie(name) {
    const cookieArr = document.cookie.split("; ");
    for (let i = 0; i < cookieArr.length; i++) {
      const cookie = cookieArr[i];
      const [cookieName, cookieValue] = cookie.split("=");
      if (cookieName === name) {
        return decodeURIComponent(cookieValue);
      }
    }
    return null;
  }

  async function animateTyping(fullText, placeholderObj) {
    const lines = fullText.split(/\r?\n/); // Split by newlines
    placeholderObj.message = "";
    displayConversation(currentConversation);
  
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === "") continue; // skip blank lines
  
      // Append the next line with a newline
      placeholderObj.message += lines[i] + "\n";
  
      // Re-render the message
      displayConversation(currentConversation);
  
      // Wait before showing the next line
      await new Promise((resolve) => setTimeout(resolve, 500)); // 500ms per line
    }
  }
    
  const textarea = document.getElementById("userInput");

  textarea.addEventListener("input", () => {
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
  });
  
  
  function loadHistoryFromCookies() {
    const savedHistory = getCookie('chatHistory');
    if (savedHistory) {
      try {
        conversations = JSON.parse(savedHistory);
  
        conversations.forEach((conversation, index) => {
          updateHistory(index + 1); // Rebuild sidebar history
        });
      } catch (error) {
        console.error("Failed to parse saved history:", error);
      }
    }
  }
  
  
  function deleteCookie(name) {
    document.cookie = `${name}=; path=/;`;  // Only delete the cookie without setting an expiration date
  }
  
  // Load the conversation history from cookies when the page is loaded
  window.onload = () => {
    loadApiKeys();
    loadHistoryFromCookies();
  };
  










