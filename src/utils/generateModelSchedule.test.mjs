import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateModelSchedule } from './generateModelSchedule.ts';
import { effectiveStatus, STATUS_COLORS } from './statusColors.ts';
const source = [{saipemIdent:'SHARED', dbId:7, modelUrn:'a', projectId:'p', category:'BEAM', status:'delayed', completionPercentage:35, notes:'Original'}];
const scan = {SHARED:{dbIds:[7,25,30],elements:{25:{name:'Beam 25',category:'BEAM',externalId:'guid25',parameters:{Length:'25'}}}}};
test('fills missing dbIds using scanned identity while preserving source rows',()=>{
 const before=structuredClone(source);
 const rows=generateModelSchedule(scan,source,'a','p');
 assert.deepEqual(rows.map(x=>x.dbId),[25,30]);
 assert.equal(rows[0].elementName,'Beam 25');
 assert.equal(rows[0].customFields.ExternalId,'guid25');
 assert.equal(rows[0].customFields.ModelUrn,'a');
 assert.equal(rows[0].status,'delayed');
 assert.match(rows[0].notes,/GENERATED SAMPLE/);
 assert.deepEqual(source,before);
 assert.deepEqual(generateModelSchedule(scan,[...source,...rows],'a','p'),[]);
});
test('does not copy progress or dbIds across model or project boundaries',()=>{
 const rows=generateModelSchedule(scan,source,'other','p');
 assert.equal(rows.length,3); assert.equal(rows[0].status,'not_started');
 assert.equal(generateModelSchedule(scan,source,'a','other')[0].status,'not_started');
});
test('status precedence and colors match the viewer contract',()=>{
 assert.equal(effectiveStatus({status:'delayed',completionPercentage:100}),'delayed');
 assert.equal(effectiveStatus({status:'in_progress',completionPercentage:100}),'completed');
 assert.equal(STATUS_COLORS.delayed,'#f02b2b');
 assert.equal(STATUS_COLORS.in_progress,'#ff8000');
});
