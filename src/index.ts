import { v4 } from "https://deno.land/std@0.78.0/uuid/mod.ts";
import { serve } from "https://deno.land/std@0.106.0/http/server.ts";
import {
  acceptWebSocket,
  isWebSocketCloseEvent,
  WebSocket,
} from "https://deno.land/std@0.106.0/ws/mod.ts";
import Room from "./Room.ts";
import EventType from "./EventType.ts";

const port = +(Deno.env.get('PORT') || 8080);
const server = serve({ port });
const sockets = new Map<string, WebSocket>();
const rooms = new Map<string, Room>();

const generateRoomCode = (length = 6) => {
  const alphabet = Array.from(Array.from({ length: 26 }, (_, i) => i + 65)).map((x) =>
    String.fromCharCode(x)
  );
  return Array.from(Array(length)).map(() =>
    alphabet[Math.floor(Math.random() * alphabet.length)]
  ).join("");
};

const handleConnection = async (client: WebSocket) => {
  const uid = v4.generate();
  sockets.set(uid, client);

  // deno-lint-ignore no-explicit-any
  const send = (message: { type: EventType; payload: { [key: string]: any } }) => (
    client.send(JSON.stringify(message))
  );

  for await (const event of client) {
    console.log(sockets.size);
    if (isWebSocketCloseEvent(event)) sockets.delete(uid);
    if (typeof event === "string") {
      const e = JSON.parse(event);
      console.log(`server:`);
      console.log(e);
      switch (e.type) {
        case EventType.HOST: {
          const code = generateRoomCode();
          rooms.set(code, new Room(code, client, e.payload.name));
          send({ type: EventType.UPDATE, payload: { code } });
          console.log('br');
          break;
        }

        case EventType.JOIN: {
          const room = rooms.get(e.payload.code);
          if (room) room.connect(client, e.payload.name);
          else {
            send({
              type: EventType.ERROR,
              payload: { message: "Room not found!" },
            });
          }
        }   
      }
    }
  }
};

console.log(`Listening on port ${port}`);
for await (const req of server) {
  const { conn, r: bufReader, w: bufWriter, headers } = req;
  acceptWebSocket({ conn, bufReader, bufWriter, headers }).then(
    handleConnection,
  );
}
