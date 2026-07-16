/**
 * Nexus AI Omega — Figma-Style Collaborative Co-Editing v2.3
 * Yjs CRDT • y-websocket • multi-admin cursors
 */
import { logger } from './logger.js';
// In production: import * as Y from 'yjs'; import { WebSocketServer } from 'ws';
export class CollabRoom {
  roomId: string;
  users = new Map<string,{name:string,color:string,cursor:{x:number,y:number}}>();
  constructor(roomId:string){ this.roomId = roomId; }
  join(userId:string, name:string){
    const colors=['#7c3aed','#06ffa5','#0ea5e9','#f43f5e','#fbbf24'];
    this.users.set(userId,{name, color: colors[this.users.size%colors.length], cursor:{x:0,y:0}});
    logger.info({room:this.roomId,userId},'collab join');
    return { awareness: [...this.users.entries()] };
  }
  updateCursor(userId:string,x:number,y:number){
    const u=this.users.get(userId); if(u) u.cursor={x,y};
  }
  applyUpdate(update:Uint8Array){
    // Y.applyUpdate(ydoc, update)
    return { accepted:true, size:update.length };
  }
}
export const collabManager = {
  rooms: new Map<string,CollabRoom>(),
  get(room:string){ if(!this.rooms.has(room)) this.rooms.set(room,new CollabRoom(room)); return this.rooms.get(room)!; }
};
