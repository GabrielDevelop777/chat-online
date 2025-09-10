const setAppHeight = () =>
	document.documentElement.style.setProperty(
		"--app-height",
		`${window.innerHeight}px`,
	);
window.addEventListener("resize", setAppHeight);
setAppHeight();

const loginScreen = document.getElementById("login-screen"),
	loginCard = document.getElementById("login-card"),
	loginForm = document.getElementById("login-form"),
	loginInput = document.getElementById("login-input"),
	chatScreen = document.getElementById("chat-screen"),
	chatForm = document.getElementById("chat-form"),
	chatInput = document.getElementById("chat-input"),
	chatMessages = document.getElementById("chat-messages"),
	sidebar = document.getElementById("sidebar"),
	onlineUsers = document.getElementById("online-users"),
	userInfo = document.getElementById("user-info"),
	toggleSidebarButton = document.getElementById("toggle-sidebar-button"),
	sidebarOverlay = document.getElementById("sidebar-overlay");

const user = { id: "", name: "", color: "" };
let websocket,
	notificationPermission = "default";

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

const requestNotificationPermission = async () => {
	if ("Notification" in window)
		notificationPermission = await Notification.requestPermission();
};
const showNotification = (title, options) => {
	if (notificationPermission === "granted" && document.hidden)
		new Notification(title, options);
};
const scrollToBottom = () => {
	chatMessages.scrollTop = chatMessages.scrollHeight;
};

const renderUserList = (users) => {
	onlineUsers.innerHTML = users
		.map(
			(u) =>
				`<div class="flex items-center gap-3 p-2 rounded-lg mb-2 transition hover:bg-slate-700/50 animate-fade-in"><div class="w-3 h-3 rounded-full" style="background-color: ${u.color};"></div><span class="font-medium text-slate-300">${u.name}</span></div>`,
		)
		.join("");
};

const renderSystemMessage = (content, type = "default") => {
	const el = document.createElement("div");
	el.className = `system-message system-message-${type} text-center my-3 animate-fade-in`;
	el.innerHTML = `<span class="bg-slate-700 text-slate-400 text-xs font-semibold px-3 py-1 rounded-full">${content}</span>`;
	chatMessages.appendChild(el);
	scrollToBottom();
	return el;
};

const renderChatMessage = (message, isHistory = false) => {
	const { sender, content, timestamp } = message;
	const isSelf = user.id
		? sender.id === user.id
		: sender.name === user.name && sender.color === user.color;
	const wrapper = document.createElement("div");
	wrapper.className = `flex items-end gap-3 my-4 ${isSelf ? "justify-end" : "justify-start"}`;
	const avatar = `<div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0" style="background-color: ${sender.color};">${sender.name.charAt(0).toUpperCase()}</div>`;
	const bubble = document.createElement("div");
	bubble.className = `max-w-xs lg:max-w-md ${isHistory ? "" : isSelf ? "animate-bubble-self" : "animate-bubble-other"}`;
	bubble.innerHTML = `<div class="flex items-baseline gap-2 ${isSelf ? "justify-end" : ""}"><span class="font-bold text-sm" style="color: ${sender.color};">${isSelf ? "Você" : sender.name}</span><span class="text-xs text-slate-500">${timestamp}</span></div><div class="mt-1 px-4 py-2 rounded-xl break-words ${isSelf ? "bg-indigo-600 rounded-br-none" : "bg-slate-700 rounded-bl-none"}">${content}</div>`;
	wrapper.innerHTML = isSelf
		? bubble.outerHTML + avatar
		: avatar + bubble.outerHTML;
	chatMessages.appendChild(wrapper);
	if (!isHistory) scrollToBottom();
};

const updateUserInfo = () => {
	userInfo.innerHTML = `<p class="text-sm text-slate-400">Logado como:</p><div class="flex items-center gap-3 mt-2"><div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white" style="background-color: ${user.color};">${user.name.charAt(0).toUpperCase()}</div><span class="font-semibold">${user.name}</span></div>`;
};

const connectWebSocket = () => {
	const wsUrl = "wss://chat-backend-90pn.onrender.com";
	websocket = new WebSocket(wsUrl);
	websocket.onopen = () => {
		websocket.send(
			JSON.stringify({
				type: "login",
				payload: { name: user.name, color: user.color },
			}),
		);
	};
	websocket.onmessage = (event) => {
		const message = JSON.parse(event.data);
		switch (message.type) {
			case "chat_history":
				message.payload.forEach((msg) => renderChatMessage(msg, true));
				scrollToBottom();
				break;
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
				if (
					message.content.includes("entrou no chat") &&
					!message.content.startsWith(user.name)
				)
					showNotification("Novo usuário!", { body: message.content });
				break;
			case "chat_message":
				renderChatMessage(message);
				if (message.sender.id !== user.id)
					showNotification(message.sender.name, {
						body: message.content,
						icon: `https://placehold.co/64x64/${message.sender.color.substring(1)}/FFFFFF?text=${message.sender.name.charAt(0).toUpperCase()}`,
					});
				break;
		}
	};
	websocket.onclose = () =>
		renderSystemMessage("Foi desligado. O servidor pode estar offline.");
	websocket.onerror = () => {
		renderSystemMessage(
			"Erro de ligação. Verifique se o servidor está online e tente recarregar a página.",
		);
	};
};

loginForm.addEventListener("submit", (event) => {
	event.preventDefault();
	user.name = loginInput.value.trim();
	if (!user.name) return;
	user.color = getRandomColor();
	loginCard.classList.add("animate-zoom-out");
	loginCard.addEventListener(
		"animationend",
		() => {
			loginScreen.classList.add("hidden");
			chatScreen.classList.remove("hidden", "opacity-0");
			chatScreen.classList.add("animate-zoom-in");
			connectWebSocket();
			requestNotificationPermission();
		},
		{ once: true },
	);
});

chatForm.addEventListener("submit", (event) => {
	event.preventDefault();
	const content = chatInput.value.trim();
	if (content && websocket?.readyState === WebSocket.OPEN) {
		websocket.send(JSON.stringify({ type: "message", payload: { content } }));
		chatInput.value = "";
	}
});

toggleSidebarButton.addEventListener("click", () => {
	sidebar.classList.remove("-translate-x-full");
	sidebarOverlay.classList.remove("hidden");
});
sidebarOverlay.addEventListener("click", () => {
	sidebar.classList.add("-translate-x-full");
	sidebarOverlay.classList.add("hidden");
});
