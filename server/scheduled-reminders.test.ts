import assert from 'node:assert/strict';
import {createScheduledReminderPoller} from './scheduled-reminders';
async function main() {
 let connected=false, queries=0;
 let rows=[{ticketNumber:'TEST1',scheduledRetrievalAt:'2026-09-28T10:10:00Z',status:'active'}];
 const sent: string[]=[];
 const poll=createScheduledReminderPoller({listeners:()=>connected?['staff1']:[],mayReceive:()=>true,upcoming:async()=>{queries++;return rows},send:(_listener,t,time)=>{sent.push(t.ticketNumber+time)}});
 await poll(); assert.equal(queries,0,'idle app must not wake database');
 connected=true; await poll(); await poll(); assert.equal(sent.length,1,'duplicate reminders suppressed');
 assert.equal(rows[0].status,'active','reminder does not complete ticket');
 rows[0].scheduledRetrievalAt='2026-09-28T10:15:00Z';await poll();assert.equal(sent.length,2,'reschedule alerts again');
 rows=[];await poll();rows=[{ticketNumber:'TEST1',scheduledRetrievalAt:'2026-09-28T10:15:00Z',status:'active'}];await poll();assert.equal(sent.length,3,'cancel and re-add resets reminder');
 connected=false;await poll();const before=queries;await poll();assert.equal(queries,before);connected=true;await poll();assert.equal(sent.length,4,'reconnect can receive reminder');
 let release!:()=>void, calls=0;
 const pending=new Promise<void>(resolve=>release=resolve);
 const slow=createScheduledReminderPoller({listeners:()=>['staff1'],mayReceive:()=>true,upcoming:async()=>{calls++;await pending;return []},send:()=>{}});
 const running=slow();await slow();assert.equal(calls,1,'overlapping intervals excluded');release();await running;
 let failed=true;
 const retry=createScheduledReminderPoller({listeners:()=>['staff1'],mayReceive:()=>true,upcoming:async()=>{if(failed)throw Error('temporary');return rows},send:()=>{}});
 await assert.rejects(retry());failed=false;await retry();
 let listeners=['other-ou'];
 const deliveries: string[]=[];
 const scoped=createScheduledReminderPoller({listeners:()=>listeners, upcoming:async()=>rows,
  mayReceive:(listener)=>listener.startsWith('allowed'),
  send:(listener)=>{deliveries.push(listener)}});
 await scoped();assert.deepEqual(deliveries,[],'other organization gets no reminder');
 listeners.push('allowed-one');await scoped();await scoped();
 assert.deepEqual(deliveries,['allowed-one'],'unrelated listener does not consume reminder');
 listeners.push('allowed-two');await scoped();
 assert.deepEqual(deliveries,['allowed-one','allowed-two'],'new staff gets its own reminder');
 console.log('Reminder tests passed: idle, duplicate, reschedule, cancellation, reconnect, overlap and retry; no ticket mutations.');
}
void main();
