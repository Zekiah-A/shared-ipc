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

### `makeIpcRequest(target:IpcTarget, call:string, data:any)`
Makes an IPC request and returns a promise that resolves with the response.

### `sendIpcMessage(target:IpcTarget, call:string, data:any)`
Sends an IPC message without waiting for a response.

### `addIpcMessageHandler(name:string, handler:Function)`
Adds a handler function for a specific message type.

### `handleIpcMessage(data:IpcEventData)`
The message event handler that processes incoming messages.

### `PublicPromise`
Utility class used internally for managing promise resolution.

### `IpcTarget` compatibility matrix:
| Type                   | Window (Browser) | Worker (Browser) | MessagePort (Node) | 
|------------------------|------------------|------------------|--------------------|
| **Window (Browser)**   | ✅ Yes           | ✅ Yes           | ❌ No              |
| **Worker (Browser)**   | ✅ Yes           | ✅ Yes           | ❌ No              |
| **Iframe (Browser)**   | ✅ Yes           | ✅ Yes           | ❌ No              |
| **MessagePort (Node)** | ❌ No            | ❌ No            | ✅ Yes             |
| **Worker (Node)**      | ❌ No            | ❌ No            | ✅ Yes             |


## License

MIT