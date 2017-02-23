import * as ts from 'typescript';

import * as annotator from './annotation';
import * as closurize from './closurize';
import * as exportStar from './export_star';
import * as nonsense from './nonsense';

const fileMap = new Map<string, string>();
const sourcesMap = new Map<string, ts.SourceFile>();
const outputs = new Map<string, string>();

fileMap.set('test.ts', `
export * from './child';

import * as child from './child';

/** @Annotation */ declare let Test1: (x:any) => any;
@Test1
export class Foo {
}

/**
 * foo
 */
function f(a: () => null | {a: string}, b: string) {
  function g() {};
  return 0;
}
let nana = child.x;
let x = '' + nana;
`);

fileMap.set('child.ts', `
export let x = 0;
export let y = '';
`);

fileMap.forEach((v, k) => sourcesMap.set(
                    k, ts.createSourceFile(k, v, ts.ScriptTarget.ES2015)));

const options: ts.CompilerOptions = {
  'experimentalDecorators' : true,
  'emitDecoratorMetadata' : true
};
const host: ts.CompilerHost = {
  getSourceFile : (fileName) => sourcesMap.get(fileName)!,
  getDefaultLibFileName : () => 'lib.d.ts',
  getCurrentDirectory : () => '',
  getDirectories : () => [],
  getCanonicalFileName : (fileName) => fileName,
  useCaseSensitiveFileNames : () => true,
  getNewLine : () => '\n',
  fileExists : (fileName) => fileMap.has(fileName),
  readFile : (fileName) => fileMap.has(fileName) ? fileMap.get(fileName)! : '',
  writeFile : (fileName, text) => outputs.set(fileName, text),
};

const program = ts.createProgram(Array.from(fileMap.keys()), options, host);

if (program.getSemanticDiagnostics().length > 0) {
  console.log('semantic diag', program.getSemanticDiagnostics());
  process.exit(-1);
}

if (program.getSyntacticDiagnostics().length > 0) {
  console.log('syntactic diag', program.getSyntacticDiagnostics());
  process.exit(-1);
}

const result = program.emit(undefined, host.writeFile, undefined, false, {
  'before' : [
    closurize.getTransformer(program), exportStar.getTransformer(program),
    annotator.getTransformer(program)
  ],
  'after' : [
    nonsense.getTransformer(program)
  ]
});

for (let [k, v] of outputs) {
  console.log('file:', k);
  console.log('====');
  console.log(v);
}