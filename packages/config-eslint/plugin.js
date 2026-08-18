/**
 * Forbidden Math members (implementation-defined or non-deterministic).
 * Math.sqrt / abs / min / max / floor / ceil / round / trunc / sign / fround / imul
 * are IEEE-exact or specified and are allowed (imul is required by the PRNG).
 */
const FORBIDDEN_MATH = new Set([
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'atan2',
  'pow',
  'exp',
  'log',
  'log2',
  'log10',
  'log1p',
  'expm1',
  'sinh',
  'cosh',
  'tanh',
  'asinh',
  'acosh',
  'atanh',
  'hypot',
  'cbrt',
  'random',
]);

function memberChain(node) {
  const parts = [];
  let current = node;
  while (current) {
    if (current.type === 'MemberExpression') {
      if (current.computed) {
        if (current.property.type === 'Literal' && typeof current.property.value === 'string') {
          parts.unshift(current.property.value);
          current = current.object;
          continue;
        }
        break;
      }
      if (current.property.type === 'Identifier') {
        parts.unshift(current.property.name);
        current = current.object;
        continue;
      }
      break;
    }
    if (current.type === 'Identifier') {
      parts.unshift(current.name);
      break;
    }
    break;
  }
  return parts;
}

function endsWith(chain, suffix) {
  if (chain.length < suffix.length) return false;
  for (let i = 0; i < suffix.length; i++) {
    if (chain[chain.length - suffix.length + i] !== suffix[i]) return false;
  }
  return true;
}

const noNondeterminism = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Forbid non-deterministic Math, ** , Date, performance.now, and crypto.getRandomValues in simulation code.',
    },
    schema: [],
    messages: {
      forbiddenMath:
        'Do not use Math.{{name}} in simulation code. Import the detmath equivalent instead.',
      forbiddenPow:
        'The ** operator is forbidden in simulation code (same semantics as Math.pow). Use detmath.pow.',
      forbiddenDateNow: 'Date.now is forbidden in simulation code. Use the tick counter.',
      forbiddenGetTime: 'Date#getTime is forbidden in simulation code. Use the tick counter.',
      forbiddenNewDate: 'new Date() is forbidden in simulation code. Use the tick counter.',
      forbiddenPerformanceNow:
        'performance.now is forbidden in simulation code. Use the tick counter.',
      forbiddenGetRandomValues:
        'crypto.getRandomValues is forbidden in simulation code. Use the seeded PRNG.',
    },
  },
  create(context) {
    return {
      MemberExpression(node) {
        const chain = memberChain(node);
        if (chain.length >= 2 && chain[chain.length - 2] === 'Math') {
          const name = chain[chain.length - 1];
          if (FORBIDDEN_MATH.has(name)) {
            context.report({ node, messageId: 'forbiddenMath', data: { name } });
          }
        }
      },
      BinaryExpression(node) {
        if (node.operator === '**') {
          context.report({ node, messageId: 'forbiddenPow' });
        }
      },
      NewExpression(node) {
        const chain = memberChain(node.callee);
        if (chain[chain.length - 1] === 'Date' && (chain.length === 1 || chain[0] === 'globalThis')) {
          context.report({ node, messageId: 'forbiddenNewDate' });
        }
      },
      CallExpression(node) {
        const chain = memberChain(node.callee);
        if (endsWith(chain, ['Date', 'now'])) {
          context.report({ node, messageId: 'forbiddenDateNow' });
        } else if (endsWith(chain, ['getTime'])) {
          context.report({ node, messageId: 'forbiddenGetTime' });
        } else if (endsWith(chain, ['performance', 'now'])) {
          context.report({ node, messageId: 'forbiddenPerformanceNow' });
        } else if (endsWith(chain, ['getRandomValues'])) {
          context.report({ node, messageId: 'forbiddenGetRandomValues' });
        }
      },
    };
  },
};

const NODE_BUILTINS = new Set([
  'assert',
  'buffer',
  'child_process',
  'cluster',
  'crypto',
  'dgram',
  'dns',
  'events',
  'fs',
  'fs/promises',
  'http',
  'http2',
  'https',
  'module',
  'net',
  'os',
  'path',
  'perf_hooks',
  'process',
  'punycode',
  'querystring',
  'readline',
  'repl',
  'stream',
  'string_decoder',
  'timers',
  'tls',
  'tty',
  'url',
  'util',
  'v8',
  'vm',
  'worker_threads',
  'zlib',
]);

const DOM_GLOBALS = new Set([
  'window',
  'document',
  'navigator',
  'localStorage',
  'sessionStorage',
  'requestAnimationFrame',
  'cancelAnimationFrame',
]);

function isHostModule(source) {
  if (source.startsWith('node:')) return true;
  if (NODE_BUILTINS.has(source)) return true;
  if (source === 'phaser' || source.startsWith('phaser/')) return true;
  if (source === 'react' || source.startsWith('react/') || source === 'react-dom') return true;
  if (source === 'next' || source.startsWith('next/')) return true;
  return false;
}

const noHostImports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Forbid Phaser, React, Next, node:*, Node builtins, and DOM globals in simulation code.',
    },
    schema: [],
    messages: {
      hostImport:
        'Simulation code cannot import {{source}}. sim-core and game simulation/ directories must stay headless.',
      hostRequire: 'Simulation code cannot require() host modules. Keep the simulation headless.',
      domGlobal:
        'Simulation code cannot reference the DOM global {{name}}. Keep presentation out of the sim.',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();
    return {
      ImportDeclaration(node) {
        if (typeof node.source.value === 'string' && isHostModule(node.source.value)) {
          context.report({
            node: node.source,
            messageId: 'hostImport',
            data: { source: node.source.value },
          });
        }
      },
      CallExpression(node) {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'require' &&
          node.arguments[0]?.type === 'Literal' &&
          typeof node.arguments[0].value === 'string' &&
          isHostModule(node.arguments[0].value)
        ) {
          context.report({ node, messageId: 'hostRequire' });
        }
      },
      Identifier(node) {
        if (!DOM_GLOBALS.has(node.name)) return;
        const parent = sourceCode.getParent(node);
        if (parent?.type === 'Property' && parent.key === node && !parent.computed) return;
        if (parent?.type === 'MemberExpression' && parent.property === node && !parent.computed) {
          return;
        }
        context.report({ node, messageId: 'domGlobal', data: { name: node.name } });
      },
    };
  },
};

const plugin = {
  meta: { name: 'stickworld', version: '0.0.0' },
  rules: {
    'no-nondeterminism': noNondeterminism,
    'no-host-imports': noHostImports,
  },
};

export default plugin;
export { FORBIDDEN_MATH, noNondeterminism, noHostImports };
