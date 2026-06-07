// core/model.js — the data model. The LEFT table of every join.
// Pure data, no DOM, no cytoscape. An entity id is join key + animation key + address.

/** @typedef {{id:string,label:string,kind:string,container:string,tags:string[],note?:string}} Entity */
/** @typedef {{id:string,source:string,target:string,label:string,kind:string,note?:string,src?:string}} Edge */
/** @typedef {{panel:string,locator:string}} Ref */
/** @typedef {{entityIds:Set<string>,edgeIds:Set<string>,focus?:string,note?:string}} View */
/** @typedef {{entities:Entity[],edges:Edge[],refs:Map<string,Ref[]>,tours:object}} Model */

export const Panel = { FS: 'fs', SQL: 'sql', CODE: 'code', API: 'api', GRAPH: 'graph' };

export function entity({ id, label = id, kind = 'node', container = 'root', tags = [], note } = {}) {
  return { id, label, kind, container, tags, ...(note ? { note } : {}) };
}

export function edge({ source, target, label = '', kind = 'dep' }, i = 0) {
  return { id: `${source}>>${target}#${i}`, source, target, label, kind };
}

export function makeModel({ entities = [], edges = [], refs = new Map(), tours = {}, ...extra } = {}) {
  return { entities, edges, refs, tours, ...extra };
}

export const byId = model => new Map(model.entities.map(e => [e.id, e]));
export const refsOf = (model, id, panel) =>
  (model.refs.get(id) || []).filter(r => !panel || r.panel === panel);
