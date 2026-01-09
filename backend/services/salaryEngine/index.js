// Salary Engine: Resolves salary templates, evaluates formulas, outputs salary snapshot
const FormulaEngine = require('../formulaEngine');

class SalaryEngine {
  /**
   * Generates an immutable salary snapshot for an employee or applicant/candidate.
   * 
   * @param {Object} params
   * @param {Object} params.tenantDB - Tenant database connection
   * @param {ObjectId} params.employeeId - Employee ID (optional if applicantId provided)
   * @param {ObjectId} params.applicantId - Applicant ID (optional if employeeId provided)
   * @param {ObjectId} params.tenantId - Tenant ID
   * @param {Number} params.annualCTC - Annual CTC
   * @param {Object} params.template - Salary Template document with components and formulas
   * @param {Date} params.effectiveDate - When this salary becomes effective
   */
  static async generateSnapshot({ tenantDB, employeeId, applicantId, tenantId, annualCTC, template, effectiveDate }) {
    if (!tenantDB) throw new Error('tenantDB is required');
    if (!employeeId && !applicantId) throw new Error('employeeId or applicantId is required');
    if (!annualCTC || isNaN(annualCTC) || annualCTC <= 0) throw new Error('Positive annualCTC is required');
    if (!template) throw new Error('Salary template is required');

    const EmployeeSalarySnapshot = tenantDB.model('EmployeeSalarySnapshot');

    // Prepare formulas and metadata
    const formulas = {};
    const componentMeta = {};
    const M2A = 12;

    // 1. Process Earnings
    if (template.earnings) {
      template.earnings.forEach(e => {
        const code = e.code || e.componentCode || e.name.toUpperCase().replace(/\s+/g, '_');
        formulas[code] = e.formula || (e.annualAmount || (e.monthlyAmount * M2A)).toString();
        componentMeta[code] = { name: e.name, type: 'EARNING' };
      });
    }

    // 2. Process Employer Deductions (Benefits)
    if (template.employerDeductions) {
      template.employerDeductions.forEach(d => {
        const code = d.code || d.componentCode || d.name.toUpperCase().replace(/\s+/g, '_');
        formulas[code] = d.formula || (d.annualAmount || (d.monthlyAmount * M2A)).toString();
        componentMeta[code] = { name: d.name, type: 'BENEFIT' };
      });
    }

    // 3. Process Employee Deductions
    if (template.employeeDeductions) {
      template.employeeDeductions.forEach(d => {
        const code = d.code || d.componentCode || d.name.toUpperCase().replace(/\s+/g, '_');
        formulas[code] = d.formula || (d.annualAmount || (d.monthlyAmount * M2A)).toString();
        componentMeta[code] = { name: d.name, type: 'DEDUCTION' };
      });
    }

    // Context for evaluation
    const context = { CTC: annualCTC };
    formulas['CTC'] = annualCTC.toString();

    // 4. Resolve via FormulaEngine
    const engine = new FormulaEngine(formulas);

    const earnings = [];
    const deductions = [];
    const benefits = [];

    for (const code in componentMeta) {
      try {
        const amount = engine.evaluate(code, context);
        const meta = componentMeta[code];

        const item = {
          name: meta.name,
          code: code,
          amount: Math.round(amount * 100) / 100,
          formula: formulas[code],
          resolved: true
        };

        if (meta.type === 'EARNING') earnings.push(item);
        else if (meta.type === 'DEDUCTION') deductions.push(item);
        else if (meta.type === 'BENEFIT') benefits.push(item);
      } catch (err) {
        throw new Error(`Formula resolution failed for ${code}: ${err.message}`);
      }
    }

    // 5. Validation
    const earningsSum = earnings.reduce((sum, e) => sum + e.amount, 0);
    const benefitsSum = benefits.reduce((sum, b) => sum + b.amount, 0);
    const totalCost = Math.round((earningsSum + benefitsSum) * 100) / 100;

    // Strict validation requirement: Earnings + Benefits = CTC
    if (Math.abs(totalCost - annualCTC) > 10) {
      throw new Error(`Salary Integrity Error: Components total ₹${totalCost} but target CTC is ₹${annualCTC}. Difference too large.`);
    }

    // 6. Persistence
    const snapshot = await EmployeeSalarySnapshot.create({
      employee: employeeId || null,
      applicant: applicantId || null,
      tenant: tenantId,
      ctc: annualCTC,
      earnings,
      deductions,
      benefits,
      effectiveDate: effectiveDate || new Date()
    });

    return snapshot;
  }
}

module.exports = SalaryEngine;