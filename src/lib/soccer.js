// Browser-facing compatibility entry point. Node imports the same shared module.
export {
  MATCH_SECONDS,
  SOC,
  SOCCER_CONTACT_RADIUS,
  socInitial,
  socStepCar,
  socStep,
  socExtrapolateBall,
  socBumpBallWithCar,
} from '../../shared/microSoccerPhysics.js';
