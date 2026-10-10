import test from 'node:test';
import assert from 'node:assert/strict';
import {category} from '../src/validation.js';
test('categoria é opcional e aceita somente texto de até 80 caracteres',()=>{
  assert.equal(category(undefined),'Sem categoria');assert.equal(category('  '),'Sem categoria');assert.equal(category(' Filamento '),'Filamento');assert.throws(()=>category({}));assert.throws(()=>category('a'.repeat(81)));
});
