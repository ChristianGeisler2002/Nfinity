const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readArray, writeArray } = require('../backend/core/storage/jsonStore');

test('atomic replacement preserves valid data and rejects a corrupt store', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nfinity-store-'));
  const file = path.join(directory, 'records.json');
  try {
    assert.deepEqual(readArray(file), []);
    writeArray(file, [{ id: 1 }]);
    writeArray(file, [{ id: 1 }, { id: 2 }]);
    assert.equal(readArray(file).length, 2);
    assert.equal(fs.readdirSync(directory).length, 1);
    fs.writeFileSync(file, '{corrupt');
    assert.throws(() => readArray(file));
    assert.equal(fs.readFileSync(file, 'utf8'), '{corrupt');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
