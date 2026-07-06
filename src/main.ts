import { generate_program, run_path } from './program.js';
import { max_programs } from './const.js';
import * as fs from 'node:fs';


function main(): void {
  fs.mkdirSync(run_path, { recursive: true });

  for (let i = 0; i < max_programs; ++i) {
    if (generate_program() === undefined) {
      console.log(`Failed to write program ${i + 1}! Quitting.`);
      process.exit(1); // Exit with error code
    }
  }

  process.exit(0); // Exit with success code
}

main();
