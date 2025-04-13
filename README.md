# shared-ipc

A simple JavaScript library providing an asynchronous method call interface for Workers, Iframes and cross-window contexts using postMessage.

## Installation

```bash
npm install shared-ipc
```

## Usage

### Basic Setup

```javascript
import { 
  makeIpcRequest, 
  sendIpcMessage, 
  addMessageHandler, 
  handleMessage 
} from "shared-ipc";

// In both frames/workers:
window.addEventListener("message", handleMessage);

// Add message handlers
addMessageHandler("greet", (name) => {
  return `Hello ${name}!`;
});

// In parent frame communicating with iframe:
const iframe = document.getElementById("my-iframe");
await makeIpcRequest(iframe, "greet", "World"); // Returns "Hello World!"

// Or send a message without waiting for response
sendIpcMessage(iframe, "notification", { type: "alert" });
```

## API

### `makeIpcRequest(target, call, data)`
Makes an IPC request and returns a promise that resolves with the response.

### `sendIpcMessage(target, call, data)`
Sends an IPC message without waiting for a response.

### `addMessageHandler(name, handler)`
Adds a handler function for a specific message type.

### `handleMessage(event)`
The message event handler that processes incoming messages.

### `PublicPromise`
Utility class used internally for managing promise resolution.

## License

MIT