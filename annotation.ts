import * as ts from 'typescript';

export function getTransformer(program: ts.Program):
    ts.TransformerFactory<ts.SourceFile> {
  return context => {
    function shouldLower(decorator: ts.Decorator) {
      // Walk down the expression to find the identifier of the decorator
      // function
      let node: ts.Node = decorator;
      while (node.kind !== ts.SyntaxKind.Identifier) {
        switch (node.kind) {
        case ts.SyntaxKind.Decorator:
          node = (node as ts.Decorator).expression;
          break;
        case ts.SyntaxKind.CallExpression:
          node = (node as ts.CallExpression).expression;
          break;
        // PropertyAccessExpression is intentionally missing here,
        // because the rest of the rewriter does not handle such
        // expressions.
        default:
          return false;
        }
      }

      let decSym = program.getTypeChecker().getSymbolAtLocation(node);
      if (decSym.flags & ts.SymbolFlags.Alias) {
        decSym = program.getTypeChecker().getAliasedSymbol(decSym);
      }
      for (let d of decSym.getDeclarations()) {
        // Switch to the TS JSDoc parser in the future to avoid false positives
        // here.
        // For example using '@Annotation' in a true comment.
        // However, a new TS API would be needed, track at
        // https://github.com/Microsoft/TypeScript/issues/7393.
        let commentNode: ts.Node = d;
        // Not handling PropertyAccess expressions here, because they are
        // filtered earlier.
        if (commentNode.kind === ts.SyntaxKind.VariableDeclaration) {
          if (!commentNode.parent)
            continue;
          commentNode = commentNode.parent;
        }
        // Go up one more level to VariableDeclarationStatement, where usually
        // the comment lives. If the declaration has an 'export', the
        // VDList.getFullText will not contain the comment.
        if (commentNode.kind === ts.SyntaxKind.VariableDeclarationList) {
          if (!commentNode.parent)
            continue;
          commentNode = commentNode.parent;
        }
        let range = ts.getLeadingCommentRanges(commentNode.getFullText(), 0);
        if (!range)
          continue;
        for (let {pos, end} of range) {
          let jsDocText = commentNode.getFullText().substring(pos, end);
          if (jsDocText.includes('@Annotation'))
            return true;
        }
      }
      return false;
    }

    function decoratorsToLower(n: ts.Node): ts.Decorator[] {
      if (n.decorators) {
        return n.decorators.filter(shouldLower);
      }
      return [];
    }
    function visitClass(node: ts.ClassDeclaration) {
      let dec = decoratorsToLower(node);
      let newClass = ts.createClassDeclaration(
          undefined!, node.modifiers!, node.name!, node.typeParameters!,
          node.heritageClauses!,
          node.members.concat(ts.createProperty(
              undefined, [ ts.SyntaxKind.StaticKeyword as any ], 'decorators',
              undefined, undefined,
              ts.createArrayLiteral(dec.map(d => d.expression)))));
      return newClass;
    }
    function visit(node: ts.Node): ts.VisitResult<ts.Node> {
      switch (node.kind) {
      case ts.SyntaxKind.ClassDeclaration:
        return visitClass(node as ts.ClassDeclaration);
      default:
        return ts.visitEachChild(node, visit, context);
      }
    }
    return file => visit(file) as ts.SourceFile;
  }
}