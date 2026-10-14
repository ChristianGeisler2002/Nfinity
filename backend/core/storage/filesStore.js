const path = require('node:path');
const crypto = require('node:crypto');
const { readArray, writeArray } = require('./jsonStore');

const FILES_FILE = process.env.FILES_FILE || path.join(__dirname, '..', '..', 'data', 'files.json');

async function createFileRecord(file) {
  const record = { ...file, id: crypto.randomUUID(), created_at: new Date().toISOString() };
  const records = readArray(FILES_FILE);
  records.push(record);
  writeArray(FILES_FILE, records);
  return record;
}

module.exports = { createFileRecord };
