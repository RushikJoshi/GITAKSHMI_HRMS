/**
 * SalaryStructure Controller (LEGACY - Superseded by SalaryEngine & SalaryController)
 */

exports.suggestSalaryStructure = async (req, res) => {
    res.status(410).json({ message: "This endpoint is deprecated. Use SalaryController.preview instead." });
};

exports.createSalaryStructure = async (req, res) => {
    res.status(410).json({ message: "This endpoint is deprecated. Use SalaryController.assign instead." });
};

exports.getSalaryStructure = async (req, res) => {
    res.status(410).json({ message: "This endpoint is deprecated. Refer to the Applicant's salarySnapshotId." });
};
