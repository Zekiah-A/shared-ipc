import {
	makeIpcRequest,
	sendIpcMessage,
	addMessageHandler,
	handleMessage
} from "shared-ipc";

window.addEventListener("message", handleMessage);

addMessageHandler("greet", (name) => {
	return `Hello ${name}!`;
});

addMessageHandler("notification", ({ type, message }) => {
	console.log("Received notification ", type, message);
});

await makeIpcRequest(window, "greet", "World"); // Returns "Hello World!"
sendIpcMessage(window, "notification", { type: "alert", message: "Something happened!" });
