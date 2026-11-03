export function calculateInstallerStatus(claims = [], trainingProgress = 0) {
  const reviewed = claims.filter((claim) => ['approved', 'rejected', 'needs_information'].includes(claim.status));
  const approved = claims.filter((claim) => claim.status === 'approved');
  const rejected = claims.filter((claim) => claim.status === 'rejected');
  const firstPassApproved = approved.filter((claim) => !claim.information_request_count);
  const approvedAfterInfo = approved.filter((claim) => claim.information_request_count > 0);
  const needsInformation = claims.filter((claim) => claim.status === 'needs_information');
  const approvalRate = reviewed.length ? approved.length / reviewed.length : 0;

  let score = null;
  let scoreBreakdown = null;
  if (reviewed.length) {
    const reviewPoints = (
      firstPassApproved.length * 100
      + approvedAfterInfo.length * 70
      + needsInformation.length * 40
    ) / reviewed.length;
    const integrityPoints = Math.max(0, 100 - (rejected.length / reviewed.length) * 100);
    const experiencePoints = Math.min(100, (approved.length / 15) * 100);
    const trainingPoints = Math.max(0, Math.min(100, Number(trainingProgress) || 0));
    score = Math.round(reviewPoints * 0.6 + integrityPoints * 0.2 + experiencePoints * 0.1 + trainingPoints * 0.1);
    scoreBreakdown = {
      claimQuality: Math.round(reviewPoints),
      integrity: Math.round(integrityPoints),
      experience: Math.round(experiencePoints),
      training: Math.round(trainingPoints),
    };
  }

  let status = 'New';
  if (approved.length >= 15 && approvalRate >= 0.9 && Number(trainingProgress) >= 100) status = 'FastAmps Elite';
  else if (approved.length >= 5 && rejected.length === 0) status = 'Trusted';
  else if (approved.length >= 1) status = 'Verified';

  const nextTarget = status === 'New' ? 1 : status === 'Verified' ? 5 : status === 'Trusted' ? 15 : approved.length;

  return {
    status,
    label: status === 'New' ? 'New – first approval pending' : status,
    score,
    scoreBreakdown,
    reviewedCount: reviewed.length,
    approvedCount: approved.length,
    nextReviewCount: Math.max(0, nextTarget - approved.length),
  };
}
