'use client';
import React, { useCallback, useState } from 'react';
import ReactFlow, { Background, Controls, MiniMap, addEdge, useEdgesState, useNodesState, Handle, Position } from 'reactflow';
import 'reactflow/dist/style.css';

const nodeTypes = {
  trigger: ({data}:{data:any}) => (
    <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-sm min-w-[180px]">
      <div className="text-[10px] text-emerald-300 uppercase">Trigger</div>
      <b>{data.label}</b>
      <Handle type="source" position={Position.Right} />
    </div>
  ),
  condition: ({data}:{data:any}) => (
    <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm min-w-[180px]">
      <Handle type="target" position={Position.Left} />
      <div className="text-[10px] text-amber-300 uppercase">Condition</div>
      <b>{data.label}</b>
      <Handle type="source" position={Position.Right} />
    </div>
  ),
  action: ({data}:{data:any}) => (
    <div className="px-3 py-2 rounded-xl bg-violet-500/10 border border-violet-500/30 text-sm min-w-[180px]">
      <Handle type="target" position={Position.Left} />
      <div className="text-[10px] text-violet-300 uppercase">Action</div>
      <b>{data.label}</b>
    </div>
  )
};

const initialNodes = [
  { id:'1', type:'trigger', position:{x:50,y:120}, data:{label:'👋 User Joins'}},
  { id:'2', type:'condition', position:{x:320,y:120}, data:{label:'Account Age < 7d?'}},
  { id:'3', type:'action', position:{x:600,y:60}, data:{label:'🎟️ Open Verify Ticket'}},
  { id:'4', type:'action', position:{x:600,y:180}, data:{label:'✅ Assign Member Role'}},
];
const initialEdges = [
  { id:'e1-2', source:'1', target:'2' },
  { id:'e2-3', source:'2', target:'3', label:'yes' },
  { id:'e2-4', source:'2', target:'4', label:'no' },
];

export default function ActionBuilder(){
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const onConnect = useCallback((c:any)=> setEdges(eds=> addEdge({...c, animated:true}, eds)), []);

  return (
    <div className="glass rounded-[22px] p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[12px] uppercase tracking-widest text-zinc-400">⚙️ Visual Node Automation Studio — v2.2</div>
          <div className="text-sm text-zinc-300">Drag • Drop • Zapier-style • max 50 steps • circuit breaker</div>
        </div>
        <div className="flex gap-2 text-xs">
          <button className="px-3 py-2 rounded-lg bg-white/5 border border-white/10">Trigger +</button>
          <button className="px-3 py-2 rounded-lg bg-white/5 border border-white/10">Condition +</button>
          <button className="px-3 py-2 rounded-lg bg-violet-600">Deploy Flow</button>
        </div>
      </div>
      <div style={{height:520}} className="rounded-xl overflow-hidden border border-violet-900/25">
        <ReactFlow
          nodes={nodes} edges={edges}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{hideAttribution:true}}
          style={{background:'#0a0d1d'}}
        >
          <Background color="#232848" gap={22} />
          <MiniMap nodeColor="#7c3aed" maskColor="rgba(0,0,0,.6)" />
          <Controls />
        </ReactFlow>
      </div>
      <div className="text-[11px] text-zinc-400 mt-2">Compiled → JSON execution tree → Kafka `automod-tasks` • WASM sandbox optional</div>
    </div>
  );
}
