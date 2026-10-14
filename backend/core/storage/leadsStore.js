const path = require('node:path');
const crypto = require('node:crypto');
const { readArray, writeArray } = require('./jsonStore');

const LEADS_FILE = process.env.LEADS_FILE || path.join(__dirname, '..', '..', 'data', 'leads.json');

async function createLead(lead) {
  const leads = readArray(LEADS_FILE);
  const saved = { ...lead, id: lead.id || crypto.randomUUID() };
  leads.push(saved);
  writeArray(LEADS_FILE, leads);
  return saved;
}

module.exports = { createLead };
