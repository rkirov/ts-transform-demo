import * as ts from 'typescript';

export function getTransformer(program: ts.Program):
    ts.TransformerFactory<ts.SourceFile> {
  return context => {
    function visitIExpression(node: ts.Identifier) {
      if (node.text === 'nana')
        return ts.createAsExpression(ts.createVoidZero(), ts.createNode(ts.SyntaxKind.NeverKeyword) as ts.TypeNode);
      return node;
    }
    function visit(node: ts.Node): ts.VisitResult<ts.Node> {
      switch (node.kind) {
      case ts.SyntaxKind.Identifier:
        return visitIExpression(node as ts.Identifier);
      default:
        return ts.visitEachChild(node, visit, context);
      }
    }
    return file => visit(file) as ts.SourceFile;
  }
}