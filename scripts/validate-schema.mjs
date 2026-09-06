#!/usr/bin/env node
/**
 * Validate each _data/*.json file against its sibling *.schema.json, if one exists.
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const root = path.dirname(url.fileURLToPath(import.meta.url));
const dataDir = path.join(root, '..', '_data');

const ajv = new Ajv2020({ allErrors: true });

const schemaFiles = fs.readdirSync(dataDir).filter((f) => f.endsWith('.schema.json'));

if (schemaFiles.length === 0) {
  console.error('ERROR: no *.schema.json files found in _data');
  process.exit(1);
}

let hadError = false;

for (const schemaFile of schemaFiles) {
  const dataFile = schemaFile.replace(/\.schema\.json$/, '.json');
  const dataPath = path.join(dataDir, dataFile);

  if (!fs.existsSync(dataPath)) {
    console.error(`ERROR: ${schemaFile} has no matching data file ${dataFile}`);
    hadError = true;
    continue;
  }

  const schema = JSON.parse(fs.readFileSync(path.join(dataDir, schemaFile), 'utf8'));
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  const validate = ajv.compile(schema);
  if (validate(data)) {
    console.log(`OK: ${dataFile} matches ${schemaFile}`);
  } else {
    hadError = true;
    console.error(`ERROR: ${dataFile} does not match ${schemaFile}:`);
    for (const err of validate.errors) {
      console.error(`  ${err.instancePath || '/'} ${err.message}`);
    }
  }
}

if (hadError) process.exit(1);
