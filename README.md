# Experiments with TS transforms

## Notes

- the transformers run before or after the {es5,es6} emit. They run after type checking and symbol resolution,
thus should not alter any of those. There is no enforcement or detection if the transformation changes.
- can emit non-sense - ts.setTextRange(ts.createTypeOf(ts.createLiteral(0)) -> emits 'typeof 0' to .js, no error.

## Transformations
- export * rewriter
- decorator down-leveling

## Other tsickle transformations to try
- goog.module rewriter