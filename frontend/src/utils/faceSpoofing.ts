import * as faceapi from 'face-api.js';

export type LivenessAction = 'BLINK' | 'TURN_LEFT' | 'TURN_RIGHT' | 'SMILE';

export const getRandomActions = (count: number = 2): LivenessAction[] => {
  const actions: LivenessAction[] = ['BLINK', 'TURN_LEFT', 'TURN_RIGHT', 'SMILE'];
  // Shuffle array
  for (let i = actions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [actions[i], actions[j]] = [actions[j], actions[i]];
  }
  return actions.slice(0, count);
};

// Calculates Eye Aspect Ratio to detect blinks
const getEAR = (eye: faceapi.Point[]) => {
  if (!eye || eye.length < 6) return 0;
  // Compute the euclidean distances between the two sets of vertical eye landmarks
  const p2_minus_p6 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
  const p3_minus_p5 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
  // Compute the euclidean distance between the horizontal eye landmark
  const p1_minus_p4 = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);

  // Compute the eye aspect ratio
  return (p2_minus_p6 + p3_minus_p5) / (2.0 * p1_minus_p4);
};

export const detectAction = (landmarks: faceapi.FaceLandmarks68, action: LivenessAction): boolean => {
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();
  const nose = landmarks.getNose();
  const jaw = landmarks.getJawOutline();
  const mouth = landmarks.getMouth();

  switch (action) {
    case 'BLINK': {
      const leftEAR = getEAR(leftEye);
      const rightEAR = getEAR(rightEye);
      const avgEAR = (leftEAR + rightEAR) / 2.0;
      console.log('Liveness [BLINK] avgEAR:', avgEAR.toFixed(3));
      return avgEAR < 0.25;
    }
    
    case 'TURN_LEFT': {
      // If turning left, the nose is closer to the left side of the jaw
      const noseTip = nose[3]; // rough nose tip
      const leftJaw = jaw[0];
      const rightJaw = jaw[16];
      const distLeft = Math.hypot(noseTip.x - leftJaw.x, noseTip.y - leftJaw.y);
      const distRight = Math.hypot(noseTip.x - rightJaw.x, noseTip.y - rightJaw.y);
      const ratio = distRight / distLeft;
      console.log('Liveness [TURN_LEFT] ratio:', ratio.toFixed(3));
      return ratio > 1.15;
    }
    
    case 'TURN_RIGHT': {
      // If turning right, the nose is closer to the right side of the jaw
      const noseTip = nose[3];
      const leftJaw = jaw[0];
      const rightJaw = jaw[16];
      const distLeft = Math.hypot(noseTip.x - leftJaw.x, noseTip.y - leftJaw.y);
      const distRight = Math.hypot(noseTip.x - rightJaw.x, noseTip.y - rightJaw.y);
      const ratio = distLeft / distRight;
      console.log('Liveness [TURN_RIGHT] ratio:', ratio.toFixed(3));
      return ratio > 1.15;
    }

    case 'SMILE': {
      // Distance between mouth corners vs jaw width
      const leftMouth = mouth[0];
      const rightMouth = mouth[6];
      const mouthWidth = Math.hypot(leftMouth.x - rightMouth.x, leftMouth.y - rightMouth.y);
      
      const leftJaw = jaw[0];
      const rightJaw = jaw[16];
      const jawWidth = Math.hypot(leftJaw.x - rightJaw.x, leftJaw.y - rightJaw.y);
      
      const ratio = mouthWidth / jawWidth;
      console.log('Liveness [SMILE] ratio:', ratio.toFixed(3));
      return ratio > 0.32;
    }
    
    default:
      return false;
  }
};
