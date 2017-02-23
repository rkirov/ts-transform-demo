import * as ts from 'typescript';

export function getTransformer(program: ts.Program):
    ts.TransformerFactory<ts.SourceFile> {
  return context => {
    function visitExport(node: ts.ExportDeclaration) {
      if (node.exportClause) {
        // console.log(node);
        return node;
      }
      let exports = expandSymbolsFromExportStar(node);
      let newNode = ts.createExportDeclaration(
          undefined, undefined, ts.createNamedExports(exports.map(
                                    s => ts.createExportSpecifier(s, s))),
          node.moduleSpecifier)
                    // console.log(newNode);
                    return newNode;
    }
    function visit(node: ts.Node): ts.VisitResult<ts.Node> {
      switch (node.kind) {
      case ts.SyntaxKind.ExportDeclaration:
        return visitExport(node as ts.ExportDeclaration);
      default:
        return ts.visitEachChild(node, visit, context);
      }
    }

    /**
     * Given a "export * from ..." statement, gathers the symbol names it
     * actually
     * exports to be used in a statement like "export {foo, bar, baz} from ...".
     *
     * This is necessary because TS transpiles "export *" by just doing a
     * runtime loop
     * over the target module's exports, which means Closure won't see the
     * declarations/types
     * that are exported.
     */
    function expandSymbolsFromExportStar(exportDecl: ts.ExportDeclaration):
        string[] {
      // You can't have an "export *" without a module specifier.
      const moduleSpecifier = exportDecl.moduleSpecifier!;
      let typeChecker = program.getTypeChecker();

      // Gather the names of local exports, to avoid reexporting any
      // names that are already locally exported.
      // To find symbols declared like
      //   export {foo} from ...
      // we must also query for "Alias", but that unfortunately also brings in
      //   import {foo} from ...
      // so the latter is filtered below.
      let locals = typeChecker.getSymbolsInScope(exportDecl.getSourceFile(),
                                                 ts.SymbolFlags.Export |
                                                     ts.SymbolFlags.Alias);
      let localSet = new Set<string>();
      for (let local of locals) {
        if (local.declarations &&
            local.declarations.some(
                (d: ts.Node) => d.kind === ts.SyntaxKind.ImportSpecifier)) {
          continue;
        }
        localSet.add(local.name);
      }

      // Expand the export list, then filter it to the symbols we want to
      // reexport.
      let exports = typeChecker.getExportsOfModule(
          typeChecker.getSymbolAtLocation(moduleSpecifier));
      const reexports = new Set<string>();
      for (let sym of exports) {
        // let name = unescapeName(sym.name);
        let name = sym.name;
        if (localSet.has(name)) {
          // This name is shadowed by a local definition, such as:
          // - export var foo ...
          // - export {foo} from ...
          continue;
        }
        // if (this.generatedExports.has(name)) {
        //   // Already exported via an earlier expansion of an "export * from
        //   ...".
        //   continue;
        // }
        // this.generatedExports.add(name);
        reexports.add(name);
      }

      return Array.from(reexports.keys());
    }

    return file => visit(file) as ts.SourceFile;
  }
}