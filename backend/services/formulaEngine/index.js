// Formula Engine: Deterministic, parses and evaluates salary formulas
// No UI dependencies, fails on circular refs, negative values, or invalid expressions

class FormulaEngine {
  constructor(formulas) {
    this.formulas = formulas; // { CODE: 'expression' }
    this.values = {}; // { CODE: value }
    this.visited = new Set();
  }

  evaluate(code, context) {
    if (this.values[code] !== undefined) return this.values[code];
    if (this.visited.has(code)) throw new Error(`Circular reference detected for ${code}`);
    this.visited.add(code);
    const expr = this.formulas[code];
    if (!expr) throw new Error(`No formula for ${code}`);
    // Replace variable codes in formula with their values, avoiding Math functions
    const resolvedExpr = expr.replace(/\b([A-Z_]+)\b/g, (match) => {
      if (match === 'Math') return 'Math'; // Explicitly allow Math
      if (context[match] !== undefined) return context[match];
      if (this.formulas[match]) return this.evaluate(match, context);
      throw new Error(`Unknown variable ${match} in formula for ${code}`);
    });
    // Evaluate the resolved expression safely
    let value;
    try {
      value = Function(`"use strict";return (${resolvedExpr})`)();
    } catch (e) {
      throw new Error(`Invalid formula for ${code}: ${expr}`);
    }
    if (typeof value !== 'number' || isNaN(value) || value < 0) throw new Error(`Invalid value for ${code}`);
    this.values[code] = value;
    return value;
  }
}

module.exports = FormulaEngine;