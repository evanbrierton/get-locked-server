import {
  isWebSocketCloseEvent,
  WebSocket,
} from "https://deno.land/std@0.106.0/ws/mod.ts";
import EventType from "./EventType.ts";

import { ROTATIONS_BEFORE_REPEAT, COLORS, CLOTHING } from './constants.ts';
import { replaceAll, format } from './utils.ts';

const pickRandom = (arr: string[]) =>
  arr[Math.floor(Math.random() * arr.length)]!;

const getColor = () => pickRandom(COLORS);

const getClothing = () => pickRandom(CLOTHING);

class Room {
  turn = 0;
  players = new Map<string, WebSocket>();
  code: string;
  host: string;
  settings: { [key: string]: boolean } = {};
  cards: string[] = [];
  custom: string[] = [];
  used: string[] = [];

  constructor(code: string, host: WebSocket, name: string) {
    this.code = code;
    this.host = name;
    this.connect(host, name);
    this.initialiseCards();
  }

  useCard = (card: string) => {
    this.used.push(card);
    if (this.used.length > this.players.size * ROTATIONS_BEFORE_REPEAT) {
      this.used.shift();
    }
    return card;
  };

  randomCard = () => (
    pickRandom(
      this.cards.filter((card: string) => !this.used.includes(card)),
    ) ?? pickRandom(this.cards) ?? ''
  );

  addCustomCards = (cards: string[]) => {
    this.custom = [...this.custom, ...cards];
    this.initialiseCards();
  };

  getTarget = () => {
    const players = this.getPlayerNames()
    return pickRandom(this.getPlayerNames().filter((player: string) => player !== players[this.turn]))
  };

  getPlayerNames = () => Array.from(this.players.keys());

  initialiseCards = async () => {
    const sets: { [key: string]: string[] } = JSON.parse(await Deno.readTextFile("./cards.json"))

    this.cards = Object.entries({ ...sets, Custom: this.custom })
      .filter(([set]) => this.settings[set])
      .flatMap(([, cards]) => cards)
  };

  // deno-lint-ignore no-explicit-any
  broadcast = (message: { type: EventType; payload?: any }) => {
    this.players.forEach((player) => {
      if (!player.isClosed) player.send(JSON.stringify(message));
    });
  }

  start = () => {
    this.broadcast({ type: EventType.START })
  }

  update = () => {
    console.log('updating');
    console.log(this.cards);

    const replacers = {
      '$TARGET': this.getTarget,
      '$COLOR': getColor,
      '$CLOTHING': getClothing
    };

    const find = Object.keys(replacers!);
    const replace = Object.values(replacers!).map((fn) => fn());

    this.broadcast({ type: EventType.UPDATE, payload: {
        players: this.getPlayerNames(),
        turn: this.turn,
        card: replaceAll(this.useCard(this.randomCard()), find, replace),
        code: this.code,
    } });
  }

  connect = async (client: WebSocket, name: string) => {
    if (this.getPlayerNames().map(format).includes(format(name))) {
      console.log('f');
      await client.send(
        JSON.stringify({
          type: EventType.ERROR,
          payload: "Name already taken.",
        }),
      );
      return;
    } else client.send(JSON.stringify({ type: EventType.CONNECT, payload: this.code }));

    this.players.set(name, client);
    console.log(`${name} joined room ${this.code}`);

    for await (const event of client) {
      if (isWebSocketCloseEvent(event)) this.players.delete(name);
      if (typeof event === "string") {
        console.log(event);
        const e = JSON.parse(event);
        console.log(e);
        console.log(`e: ${e.type}`);

        switch (e.type) {
          case EventType.CARDS:
            this.addCustomCards(e.payload.cards);
            this.update();
            break;

          case EventType.SETTINGS:
            if (name === this.host) this.settings = e.payload.settings;
            this.update();
            break;

          case EventType.PROGRESS: {
            const players = this.getPlayerNames();
            if (name === players[this.turn]) {
              this.turn = (this.turn + 1) % this.players.size;
              this.update();
            }
            break;
          }

          case EventType.START:
            this.start();
            this.update();
            break;
        }
      }
    }
  };
}

export default Room;
