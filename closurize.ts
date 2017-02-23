import * as ts from 'typescript';

import {TypeTranslator} from './type-translator';

export function getTransformer(program: ts.Program):
    ts.TransformerFactory<ts.SourceFile> {
  return context => {
    function visitFunction(node: ts.FunctionDeclaration) {
      let typeChecker = program.getTypeChecker();

      let text = '*\n ';
      for (let param of node.parameters) {
        let closureType = new TypeTranslator(typeChecker, param)
                              .translate(typeChecker.getTypeAtLocation(param));
        text += `* @param {${closureType}} \n `;
      }
      const sig = typeChecker.getSignatureFromDeclaration(node);

      let retType = typeChecker.getReturnTypeOfSignature(sig);
      const closureRetType =
          new TypeTranslator(typeChecker, node).translate(retType);

      text += `* @return {${closureRetType}} \n `;

      // why not? error in lexical env?
      // ts.visitParameterList(node.parameters, (node) => {text += '* @param\n';
      // return node;}, context);
      // ts.visitEachChild(node, visit, context);
      return ts.addSyntheticLeadingComment(
          node, ts.SyntaxKind.MultiLineCommentTrivia, text, true);
    }

    function visit(node: ts.Node): ts.VisitResult<ts.Node> {
      switch (node.kind) {
      case ts.SyntaxKind.FunctionDeclaration:
        return visitFunction(node as ts.FunctionDeclaration);
      default:
        return ts.visitEachChild(node, visit, context);
      }
    }
    return file => visit(file) as ts.SourceFile;
  }
}
