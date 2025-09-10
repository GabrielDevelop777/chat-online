// Elementos da DOM
const loginScreen = document.getElementById("login-screen");
const loginForm = document.getElementById("login-form");
const loginInput = document.getElementById("login-input");

const chatScreen = document.getElementById("chat-screen");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatMessages = document.getElementById("chat-messages");

// Elementos da Sidebar
const sidebar = document.getElementById("sidebar");
const onlineUsers = document.getElementById("online-users");
const userInfo = document.getElementById("user-info");
const toggleSidebarButton = document.getElementById("toggle-sidebar-button");
const sidebarOverlay = document.getElementById("sidebar-overlay");

// Estado do cliente
const user = { id: "", name: "", color: "" };
let websocket;
let notificationPermission = "default";

const colors = [
	"#34D399",
	"#F87171",
	"#60A5FA",
	"#FBBF24",
	"#A78BFA",
	"#F472B6",
	"#2DD4BF",
	"#FB923C",
];

const getRandomColor = () => colors[Math.floor(Math.random() * colors.length)];

// --- Funções de Notificação ---

const requestNotificationPermission = async () => {
	if (!("Notification" in window)) {
		console.log("Este navegador não suporta notificações de desktop.");
		return;
	}

	if (Notification.permission === "granted") {
		notificationPermission = "granted";
	} else if (Notification.permission !== "denied") {
		const permission = await Notification.requestPermission();
		notificationPermission = permission;
	}
};

const showNotification = (title, options) => {
	if (notificationPermission === "granted" && document.hidden) {
		new Notification(title, options);
	}
};

// --- Funções de Renderização ---

const scrollToBottom = () => {
	chatMessages.scrollTop = chatMessages.scrollHeight;
};

const renderUserList = (users) => {
	onlineUsers.innerHTML = "";
	users.forEach((u) => {
		const userElement = document.createElement("div");
		userElement.className =
			"flex items-center gap-3 p-2 rounded-lg mb-2 transition hover:bg-slate-700/50";
		userElement.innerHTML = `
                      <div class="w-3 h-3 rounded-full" style="background-color: ${u.color};"></div>
                      <span class="font-medium text-slate-300">${u.name}</span>
                  `;
		onlineUsers.appendChild(userElement);
	});
};

const renderSystemMessage = (content) => {
	const messageElement = document.createElement("div");
	messageElement.className = "text-center my-3";
	messageElement.innerHTML = `<span class="bg-slate-700 text-slate-400 text-xs font-semibold px-3 py-1 rounded-full">${content}</span>`;
	chatMessages.appendChild(messageElement);
	scrollToBottom();
};

const renderChatMessage = (message) => {
	const { sender, content, timestamp } = message;
	const isSelf = sender.id === user.id;

	const messageWrapper = document.createElement("div");
	messageWrapper.className = `flex items-end gap-3 my-4 ${isSelf ? "justify-end" : "justify-start"}`;

	const avatar = `<div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0" style="background-color: ${sender.color};">${sender.name.charAt(0).toUpperCase()}</div>`;

	const messageBubble = `
                  <div class="max-w-xs lg:max-w-md">
                      <div class="flex items-baseline gap-2 ${isSelf ? "justify-end" : ""}">
                          <span class="font-bold text-sm" style="color: ${sender.color};">${isSelf ? "Você" : sender.name}</span>
                          <span class="text-xs text-slate-500">${timestamp}</span>
                      </div>
                      <div class="mt-1 px-4 py-2 rounded-xl break-words ${isSelf ? "bg-indigo-600 rounded-br-none" : "bg-slate-700 rounded-bl-none"}">
                          ${content}
                      </div>
                  </div>
              `;

	messageWrapper.innerHTML = isSelf
		? messageBubble + avatar
		: avatar + messageBubble;
	chatMessages.appendChild(messageWrapper);
	scrollToBottom();
};

const updateUserInfo = () => {
	userInfo.innerHTML = `
                  <p class="text-sm text-slate-400">Logado como:</p>
                  <div class="flex items-center gap-3 mt-2">
                      <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white" style="background-color: ${user.color};">${user.name.charAt(0).toUpperCase()}</div>
                      <span class="font-semibold">${user.name}</span>
                  </div>
              `;
};

// --- Lógica do WebSocket ---

const connectWebSocket = () => {
	// CORREÇÃO: Aponta diretamente para a URL do seu backend no Render.
	// O protocolo 'wss://' é obrigatório para conexões seguras.
	const wsUrl = "wss://chat-backend-90pn.onrender.com";

	websocket = new WebSocket(wsUrl);

	websocket.onopen = () => {
		console.log("Conectado ao servidor WebSocket.");
		const loginMessage = {
			type: "login",
			payload: { name: user.name, color: user.color },
		};
		websocket.send(JSON.stringify(loginMessage));
	};

	websocket.onmessage = (event) => {
		const message = JSON.parse(event.data);

		switch (message.type) {
			case "user_list_update":
				renderUserList(message.users);
				const currentUser = message.users.find(
					(u) => u.name === user.name && u.color === user.color,
				);
				if (currentUser && !user.id) {
					user.id = currentUser.id;
					updateUserInfo();
				}
				break;
			case "system_message":
				renderSystemMessage(message.content);
				if (message.content.includes("entrou no chat")) {
					showNotification("Novo usuário!", {
						body: message.content,
						icon: `https://placehold.co/64x64/34D399/FFFFFF?text=🎉`,
					});
				}
				break;
			case "chat_message":
				renderChatMessage(message);
				if (message.sender.id !== user.id) {
					showNotification(message.sender.name, {
						body: message.content,
						icon: `https://placehold.co/64x64/${message.sender.color.substring(1)}/FFFFFF?text=${message.sender.name.charAt(0).toUpperCase()}`,
					});
				}
				break;
		}
	};

	websocket.onclose = () => {
		console.log("Desconectado do servidor WebSocket.");
		renderSystemMessage("Você foi desconectado. Tente recarregar a página.");
	};

	websocket.onerror = (error) => {
		console.error("Erro no WebSocket:", error);
		renderSystemMessage("Erro de conexão. Verifique o console.");
	};
};

// --- Manipuladores de Eventos ---

loginForm.addEventListener("submit", (event) => {
	event.preventDefault();

	user.name = loginInput.value.trim();
	user.color = getRandomColor();

	if (user.name) {
		loginScreen.classList.remove("fade-in");
		loginScreen.classList.add("fade-out");

		setTimeout(() => {
			loginScreen.classList.add("hidden");
			chatScreen.classList.remove("hidden");
			chatScreen.classList.add("flex", "fade-in");
			connectWebSocket();
			requestNotificationPermission(); // Pede permissão de notificação
		}, 500);
	}
});

chatForm.addEventListener("submit", (event) => {
	event.preventDefault();

	const content = chatInput.value.trim();

	if (content && websocket && websocket.readyState === WebSocket.OPEN) {
		const message = {
			type: "message",
			payload: { content },
		};
		websocket.send(JSON.stringify(message));
		chatInput.value = "";
	}
});

// --- Lógica da Sidebar Responsiva ---

const openSidebar = () => {
	sidebar.classList.remove("-translate-x-full");
	sidebarOverlay.classList.remove("hidden");
};

const closeSidebar = () => {
	sidebar.classList.add("-translate-x-full");
	sidebarOverlay.classList.add("hidden");
};

toggleSidebarButton.addEventListener("click", openSidebar);
sidebarOverlay.addEventListener("click", closeSidebar);
