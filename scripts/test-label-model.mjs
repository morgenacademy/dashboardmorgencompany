import assert from 'node:assert/strict';
import { deriveServiceLabel, deriveChannel, PRODUCT_TYPE_TO_LABEL } from '../src/label-model.js';

// product_type -> service_label
assert.equal(deriveServiceLabel('automatisering'), 'build');
assert.equal(deriveServiceLabel('abonnement'), 'build');
assert.equal(deriveServiceLabel('training'), 'train');
assert.equal(deriveServiceLabel('strategie'), 'implement');
assert.equal(deriveServiceLabel('programma'), 'implement');
assert.equal(deriveServiceLabel('samenwerking'), 'other');
assert.equal(deriveServiceLabel('other'), 'other');
assert.equal(deriveServiceLabel(undefined), 'other');
assert.equal(deriveServiceLabel('onbekend-type'), 'other');

// mapping is data, niet alleen functie
assert.equal(PRODUCT_TYPE_TO_LABEL.training, 'train');

// kanaal uit tekst
assert.equal(deriveChannel('Factuur 260708_michielpro_invoice_claudecode'), 'michielpro');
assert.equal(deriveChannel('MichielPro training'), 'michielpro');
assert.equal(deriveChannel('Gewone offerte'), 'direct');
assert.equal(deriveChannel(''), 'direct');
assert.equal(deriveChannel(null), 'direct');

console.log('label-model: OK');
