"use strict";

// @ts-nocheck
import WebSocket, { WebSocketServer } from "ws";
import { EventEmitter } from "node:events";

export class WebSocketExpress extends EventEmitter {
  constructor(httpServer, root_path, authentication_callback) {
    super();
    this.root_path = root_path || "/ws";
    this.authentication = authentication_callback;
    this.paths = [];
    this.httpServer = httpServer;
    this._upgrade();
  }

  broadcastByPath(path, payload) {
    let cli = this.paths.find((p) => {
      return p.path == path;
    });

    if (cli && cli.WebSocket) {
      cli.WebSocket.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload, { binary: isBinary });
        }
      });
    }
  }

  _url(url) {
    return new URL("http://localhost" + url);
  }

  // Crea el websocket en el servidor
  _createWebSocket(request, socket, head, url_data) {
    let wscreated = this.paths.find((w) => w.path === url_data.pathname);
    if (wscreated) {
      this._wshandleUpgrade(
        wscreated.WebSocket,
        request,
        socket,
        head,
        url_data
      );
    } else {
      let WSServer = new WebSocketServer({ noServer: true });
      WSServer.on("connection", (socketc) => {
        console.log("Client connected to ws " + url_data.pathname);
      });

      this._wshandleUpgrade(WSServer, request, socket, head, url_data);
      // Agrega el path a la lista
      this.paths.push({
        path: url_data.pathname,
        WebSocket: WSServer,
      });
    }
  }

  _wshandleUpgrade(wsServer, request, socket, head, url_data) {
    wsServer.handleUpgrade(request, socket, head, (socketc) => {
      socketc.on("message", (message) => {
        this.emit("message", {
          socket: socketc,
          message: message,
          url: url_data,
        });
      });

      this.emit("client_connection", { socket: socketc, url: url_data });
      wsServer.emit("connection", socketc, request);
    });
  }

  _upgrade() {
    this.httpServer.on("upgrade", (request, socket, head) => {
      let urlData = this._url(request.url);

      if (urlData.pathname.startsWith(this.root_path)) {
        if (this.authentication) {
          if (this.authentication(request, socket, head, urlData)) {
            this._createWebSocket(request, socket, head, urlData);
          } else {
            socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
            socket.destroy();
          }
        } else {
          this._createWebSocket(request, socket, head, urlData);
        }
      } else {
        socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        socket.destroy();
      }
    });
  }
}
