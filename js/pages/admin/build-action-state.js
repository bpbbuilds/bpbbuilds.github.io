/**
 * Apply a successful admin build mutation to the local list state.
 *
 * The API normally returns the updated build. This fallback keeps the panel
 * responsive if an older endpoint response only acknowledges the action.
 * @param {object} build
 * @param {string} action
 */
export function applyBuildAction(build, action) {
  const next = { ...build };
  switch (action) {
    case 'approve_op':
      next.is_op = true;
      next.op_requested = false;
      break;
    case 'deny_op':
      next.op_requested = false;
      break;
    case 'set_featured':
      next.is_featured = true;
      break;
    case 'unset_featured':
      next.is_featured = false;
      break;
    case 'hide':
      next.is_public = false;
      break;
    case 'restore':
      next.is_public = true;
      break;
    default:
      break;
  }
  return next;
}
