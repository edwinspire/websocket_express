'use strict'

// @ts-nocheck
import WebSocket, { WebSocketServer } from 'ws'
import { EventEmitter } from 'node:events'

export class WSServer extends EventEmitter {
  constructor(httpServer, authentication_callback) {
    super()
    this.authentication = authentication_callback
    this.pathDevices = '/ws/device'
    this.wsPaths = []
    //this.wsDevices = {}

    /*
    this.authorizedDevices = {
      '1e9058bf-26b1-4341-a694-bbbd5833c00e': { geox: 0, geoy: 0 },
      telegrambot: { geox: 0, geoy: 0 },
    }
    */
    this.httpServer = httpServer
    this._upgrade()
  }

  _url(url) {
    return new URL('http://localhost' + url)
  }

  // Crea el websocket en el servidor
  _createWebSocket(request, socket, head, url_data) {
    console.log('_createWebSocket > = ', url_data)
    let wscreated = this.wsPaths.find((w) => w.path === url_data.pathname)
    if (wscreated) {
      this._wshandleUpgrade(
        wscreated.WebSocket,
        request,
        socket,
        head,
        url_data,
      )
    } else {
      let WSServer = new WebSocketServer({ noServer: true })
      WSServer.on('connection', (socketc) => {
        console.log('Client connected to ws ' + url_data.pathname)
      })

      this._wshandleUpgrade(WSServer, request, socket, head, url_data)
      // Agrega el path a la lista
      this.wsPaths.push({
        path: url_data.pathname,
        WebSocket: WSServer,
      })
    }
  }

  _wshandleUpgrade(wsServer, request, socket, head, url_data) {
    wsServer.handleUpgrade(request, socket, head, (socketc) => {
      console.log('conectado 2 ' + url_data.pathname)

      socketc.on('message', (message) => {
        this.emit('message', {
          socket: socketc,
          message: message,
          url: url_data,
        })
      })

      this.emit('connection', { socket: socketc, url: url_data })
      wsServer.emit('connection', socketc, request)
    })
  }

  _upgrade() {
    this.httpServer.on('upgrade', (request, socket, head) => {
      let urlData = this._url(request.url)

      if (urlData.pathname.startsWith('/ws')) {
        if (this.authentication) {
          if (this.authentication(request, socket, head, urlData)) {
            this._createWebSocket(request, socket, head, urlData)
          } else {
            socket.destroy()
          }
        } else {
          this._createWebSocket(request, socket, head, urlData)
        }
      } else {
        socket.destroy()
      }
    })
  }
}
