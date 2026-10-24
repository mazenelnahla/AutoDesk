import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { processLocalHeuristicCommand } from '../services/llmStudio.ts';
import { indexScheduleRecords, findScheduleRecord } from './scheduleRecords.ts';
import { parseExcelSchedule, saveMasterExcelPool, loadMasterExcelPool, saveProjectScheduleData, saveScheduleData, fetchScheduleForProject } from './excelSchedule.ts';

test('switching models and projects cannot reuse schedules by numeric dbId', () => {
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  const a = {saipemIdent:'BRIDGE-P1',dbId:25,modelUrn:'model-a',projectId:'p',completionPercentage:100,status:'completed'};
  const b = {...a,saipemIdent:'OTHER-P1',modelUrn:'model-b',completionPercentage:35,status:'delayed'};
  saveScheduleData('model-a',indexScheduleRecords([a]),'p');
  saveScheduleData('model-b',indexScheduleRecords([b]),'p');
  const load = (modelKey, modelIdents = {}) => Object.values(fetchScheduleForProject({projectId:'p',modelKey,modelIdents}).scheduleMap);
  assert.deepEqual(load('model-a').map(row=>row.saipemIdent),['BRIDGE-P1']);
  assert.deepEqual(load('model-b').map(row=>row.saipemIdent),['OTHER-P1']);
  assert.deepEqual(load('new-model'),[]);
  assert.deepEqual(Object.values(fetchScheduleForProject({projectId:'other',modelKey:'model-a',modelIdents:{'BRIDGE-P1':{dbIds:[25]}}}).scheduleMap),[]);
  const unscoped = {...a,modelUrn:undefined};
  saveMasterExcelPool([unscoped]);
  assert.deepEqual(load('new-model',{'OTHER-P1':{dbIds:[25]}}),[]);
  assert.equal(load('model-a',{'BRIDGE-P1':{dbIds:[25]}}).length,1);
});

test('Excel import keeps three element rows with the same IDENT', async () => {
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet([25,7,1905].map((dbId,i) => ({
    Saipem_IDENT:'DC6-BRIDGE-P1',dbId,Status:['completed','in_progress','delayed'][i],
    'Complete Percentage':[100,55,35][i], 'Start Date':'2026-10-05','End Date':'2026-10-20',
  }))), 'Schedule');
  const file = new File([XLSX.write(book,{type:'buffer',bookType:'xlsx'})], 'test.xlsx');
  const rows = await parseExcelSchedule(file,{id:'project',name:'APS Learning'});
  assert.equal(rows.length,3);
  assert.equal(loadMasterExcelPool().length,3);
  saveProjectScheduleData('project',indexScheduleRecords(rows));
  const {scheduleMap} = fetchScheduleForProject({projectId:'project'});
  assert.deepEqual(Object.values(scheduleMap).map(row=>[row.dbId,row.status]),[[25,'completed'],[7,'in_progress'],[1905,'delayed']]);
});

test('shared IDENT records retain element schedules through storage and reload', () => {
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  const rows = [25, 7, 1905].map((dbId, i) => ({saipemIdent:'DC6-BRIDGE-P1', dbId, projectId:'project', projectName:'APS Learning', completionPercentage:[100,55,35][i], status:['completed','in_progress','delayed'][i]}));
  saveMasterExcelPool(rows);
  assert.equal(loadMasterExcelPool().length,3);
  saveProjectScheduleData('project', indexScheduleRecords(rows));
  const reload = () => fetchScheduleForProject({projectId:'project', projectName:'APS Learning', modelIdents:{'DC6-BRIDGE-P1':{dbIds:[7,25,1905]}}}).scheduleMap;
  const records = reload();
  assert.equal(Object.keys(records).length,3);
  for (const row of rows) assert.equal(findScheduleRecord(records,row.saipemIdent,row.dbId).status,row.status);
  const context = {scheduleDataMap:records,modelIdentsMap:{'DC6-BRIDGE-P1':{dbIds:[7,25,1905]}}};
  assert.deepEqual(processLocalHeuristicCommand('isolate delayed',context).action.dbIds,[1905]);
  assert.deepEqual(processLocalHeuristicCommand('isolate completed',context).action.dbIds,[25]);
  assert.equal(findScheduleRecord(records,'DC6-BRIDGE-P1',999),undefined);
  saveMasterExcelPool([{...rows[0],completionPercentage:80,status:'in_progress'}]);
  assert.equal(loadMasterExcelPool().length,3);
  assert.equal(loadMasterExcelPool().find(row=>row.dbId===25).completionPercentage,80);
  saveMasterExcelPool([{...rows[0],projectId:'other'}]);
  assert.equal(Object.keys(reload()).length,3);
});

test('legacy storage is rekeyed and shared schedules remain a fallback', () => {
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  const shared = {saipemIdent:'A',completionPercentage:10,status:'in_progress',projectId:'p'};
  const specific = {...shared,dbId:25,completionPercentage:100,status:'completed'};
  storage.set('autodesk_project_schedule_p',JSON.stringify({A:specific}));
  saveMasterExcelPool([shared]);
  const {scheduleMap} = fetchScheduleForProject({projectId:'p',modelIdents:{A:{dbIds:[25,26]}}});
  assert.equal(Object.keys(scheduleMap).length,2);
  assert.equal(findScheduleRecord(scheduleMap,'A',25).completionPercentage,100);
  assert.equal(findScheduleRecord(scheduleMap,'A',26).completionPercentage,10);
  assert.equal(findScheduleRecord(scheduleMap,'A',26).dbId,undefined);
});
