export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow semicolon after type declarations ending with a bracket',
      recommended: false,
    },
    fixable: 'code',
    schema: [],
  },
  create (context) {
    function getLastTypeNode (typeNode) {
      // For intersections or unions, check the last type
      if (
        typeNode.type === 'TSIntersectionType' ||
        typeNode.type === 'TSUnionType'
      ) {
        const types = typeNode.types
        return getLastTypeNode(types[types.length - 1])
      }
      // For parenthesized types, unwrap
      if (typeNode.type === 'TSParenthesizedType') {
        return getLastTypeNode(typeNode.typeAnnotation)
      }
      // For type operators (like Readonly<{ ... }>), dive into the typeAnnotation if present
      if (typeNode.type === 'TSTypeOperator' && typeNode.typeAnnotation) {
        return getLastTypeNode(typeNode.typeAnnotation)
      }
      // For type assertions (rare in type aliases), dive in
      if (typeNode.type === 'TSTypeAssertion' && typeNode.typeAnnotation) {
        return getLastTypeNode(typeNode.typeAnnotation)
      }
      // For mapped types, treat as TSTypeLiteral-ish
      if (typeNode.type === 'TSMappedType') {
        return typeNode
      }
      // Otherwise, return the node itself
      return typeNode
    }

    function endsWithBracketType (typeNode) {
      const last = getLastTypeNode(typeNode)
      // Type literal: { ... }
      if (last.type === 'TSTypeLiteral') return true
      // Mapped type: { [K in Keys]: ... }
      if (last.type === 'TSMappedType') return true
      return false
    }

    return {
      TSTypeAliasDeclaration (node) {
        const sourceCode = context.getSourceCode()
        const lastToken = sourceCode.getLastToken(node)
        if (
          endsWithBracketType(node.typeAnnotation) &&
          lastToken &&
          lastToken.value === ';'
        ) {
          context.report({
            node: lastToken,
            message: 'Do not use a semicolon after a type declaration ending with a bracket.',
            fix: fixer => fixer.remove(lastToken),
          })
        }
      },
    }
  },
}
